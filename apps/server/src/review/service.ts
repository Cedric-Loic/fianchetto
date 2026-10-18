import { buildReview, type ReviewInput } from '@sq/coach';
import { evaluatePositions, UciEngine, type PositionAnalysis } from '@sq/bot';
import type { ReviewStatus } from '@sq/shared';
import type { GameStore } from '../persistence/db.js';

interface Job {
  id: string;
  /** Partie à analyser, lue au moment du traitement (`null` : introuvable). */
  load: () => ReviewInput | null;
}

/** Ce que le service attend du moteur (`UciEngine` ; remplaçable dans les tests). */
export type ReviewEngine = Pick<UciEngine, 'alive' | 'analyze' | 'quit'>;

export interface ReviewOptions {
  /** Temps Stockfish par position d'une revue (défaut : 150 ms). */
  movetimeMs?: number | undefined;
  createEngine?: () => ReviewEngine;
  /** Arrêt du moteur après cette durée sans travail (défaut : 2 min). */
  idleMs?: number;
  /** Durée de conservation en mémoire d'un échec de revue (défaut : 10 min). */
  errorTtlMs?: number;
}

type PendingStatus = Exclude<ReviewStatus, { status: 'done' | 'none' }>;

const IDLE_MS = 2 * 60_000;
const ERROR_TTL_MS = 10 * 60_000;

/**
 * File d'analyse en arrière-plan : un seul Stockfish, une partie à la fois. Une revue demandée
 * pour être lue tout de suite passe devant les analyses par lot. Les revues terminées sont
 * gardées dans SQLite ; l'état en cours (attente, progression, échec) vit en mémoire, et les
 * échecs sont oubliés après un délai. Le moteur s'arrête après une période d'inactivité.
 */
export class ReviewService {
  readonly #store: GameStore;
  readonly #movetimeMs: number;
  readonly #createEngine: () => ReviewEngine;
  readonly #idleMs: number;
  readonly #errorTtlMs: number;
  readonly #queue: Job[] = [];
  readonly #state = new Map<string, PendingStatus>();
  readonly #errorTimers = new Map<string, NodeJS.Timeout>();
  #engine: ReviewEngine | null = null;
  #running = false;
  /** Évaluations isolées en cours (puzzles, entraînement…). */
  #evaluating = 0;
  #idle: NodeJS.Timeout | null = null;
  #disposed = false;

  constructor(store: GameStore, options: ReviewOptions = {}) {
    this.#store = store;
    this.#movetimeMs = options.movetimeMs ?? 150;
    this.#createEngine = options.createEngine ?? (() => new UciEngine());
    this.#idleMs = options.idleMs ?? IDLE_MS;
    this.#errorTtlMs = options.errorTtlMs ?? ERROR_TTL_MS;
  }

  status(id: string): ReviewStatus {
    const review = this.#store.getReview(id);
    if (review) return { status: 'done', review };
    return this.#state.get(id) ?? { status: 'none' };
  }

  /** Statut en mémoire seulement (listes : la présence d'une revue est lue à part). */
  pendingStatus(id: string): PendingStatus | { status: 'none' } {
    return this.#state.get(id) ?? { status: 'none' };
  }

  /** Statut résumé (listes) : sans charger la revue complète. */
  hasReview(id: string): boolean {
    return this.#store.hasReview(id);
  }

  /** Met la partie en file (sauf si elle est déjà analysée ou en cours). */
  request(id: string, load: Job['load'], options: { priority?: boolean } = {}): void {
    if (this.#store.hasReview(id)) return;
    const current = this.#state.get(id);
    if (current && current.status !== 'error') {
      // Déjà en attente : une demande prioritaire la fait passer devant.
      const index = this.#queue.findIndex((job) => job.id === id);
      if (options.priority && index > 0) this.#queue.unshift(...this.#queue.splice(index, 1));
      return;
    }
    this.#setState(id, { status: 'queued' });
    const job = { id, load };
    if (options.priority) this.#queue.unshift(job);
    else this.#queue.push(job);
    void this.#pump();
  }

  #setState(id: string, state: PendingStatus | null): void {
    const timer = this.#errorTimers.get(id);
    if (timer) clearTimeout(timer);
    this.#errorTimers.delete(id);
    if (state === null) {
      this.#state.delete(id);
      return;
    }
    this.#state.set(id, state);
    if (state.status === 'error') {
      // Échec oublié après un délai : la mémoire ne grossit pas, la revue redevient « à faire ».
      const purge = setTimeout(() => {
        this.#errorTimers.delete(id);
        if (this.#state.get(id)?.status === 'error') this.#state.delete(id);
      }, this.#errorTtlMs);
      purge.unref();
      this.#errorTimers.set(id, purge);
    }
  }

  #engineReady(): ReviewEngine {
    this.#clearIdle();
    if (!this.#engine?.alive) this.#engine = this.#createEngine();
    return this.#engine;
  }

  async #pump(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      for (let job = this.#queue.shift(); job && !this.#disposed; job = this.#queue.shift()) {
        await this.#run(job);
      }
    } finally {
      this.#running = false;
      this.#scheduleIdle();
    }
  }

  async #run(job: Job): Promise<void> {
    try {
      const input = job.load();
      if (!input) throw new Error('Partie introuvable.');
      this.#setState(job.id, { status: 'running', progress: 0 });
      const evals = await evaluatePositions(this.#engineReady() as UciEngine, input.positions, {
        movetimeMs: this.#movetimeMs,
        onProgress: (progress) => this.#state.set(job.id, { status: 'running', progress }),
      });
      if (this.#disposed) return;
      this.#store.saveReview(job.id, buildReview(input, evals));
      this.#setState(job.id, null);
    } catch {
      this.#setState(job.id, { status: 'error' });
    }
  }

  /**
   * Évalue une seule position avec le même Stockfish (vérification d'un coup de puzzle). Les
   * demandes passent dans la file du moteur, entre deux positions d'une analyse en cours.
   * `null` si le moteur est indisponible (mort, délai dépassé) : l'appelant répond 503.
   */
  async evaluate(fen: string, movetimeMs = 200): Promise<PositionAnalysis | null> {
    if (this.#disposed) return null;
    this.#evaluating++;
    try {
      const engine = this.#engineReady() as UciEngine;
      const [result] = await evaluatePositions(engine, [fen], { movetimeMs });
      return result ?? null;
    } catch {
      return null;
    } finally {
      this.#evaluating--;
      this.#scheduleIdle();
    }
  }

  #clearIdle(): void {
    if (this.#idle) clearTimeout(this.#idle);
    this.#idle = null;
  }

  #scheduleIdle(): void {
    this.#clearIdle();
    if (this.#disposed || !this.#engine || this.#running || this.#evaluating > 0) return;
    this.#idle = setTimeout(() => {
      this.#idle = null;
      if (this.#running || this.#evaluating > 0) return;
      this.#engine?.quit();
      this.#engine = null;
    }, this.#idleMs);
    this.#idle.unref();
  }

  dispose(): void {
    this.#disposed = true;
    this.#queue.length = 0;
    this.#clearIdle();
    for (const timer of this.#errorTimers.values()) clearTimeout(timer);
    this.#errorTimers.clear();
    this.#engine?.quit();
    this.#engine = null;
  }
}
