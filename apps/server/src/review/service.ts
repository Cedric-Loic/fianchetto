import { buildReview, type ReviewInput } from '@sq/coach';
import { evaluatePositions, UciEngine, type PositionAnalysis } from '@sq/bot';
import type { ReviewStatus } from '@sq/shared';
import type { GameStore } from '../persistence/db.js';

interface Job {
  id: string;
  /** Partie à analyser, lue au moment du traitement (`null` : introuvable). */
  load: () => ReviewInput | null;
}

/**
 * File d'analyse en arrière-plan : un seul Stockfish, une partie à la fois. Une revue demandée
 * pour être lue tout de suite passe devant les analyses par lot. Les revues terminées sont
 * gardées dans SQLite ; l'état en cours (attente, progression, échec) vit en mémoire.
 */
export class ReviewService {
  readonly #store: GameStore;
  readonly #movetimeMs: number;
  readonly #queue: Job[] = [];
  readonly #state = new Map<string, Exclude<ReviewStatus, { status: 'done' | 'none' }>>();
  #engine: UciEngine | null = null;
  #running = false;
  #disposed = false;

  constructor(store: GameStore, options: { movetimeMs?: number } = {}) {
    this.#store = store;
    this.#movetimeMs = options.movetimeMs ?? 150;
  }

  status(id: string): ReviewStatus {
    const review = this.#store.getReview(id);
    if (review) return { status: 'done', review };
    return this.#state.get(id) ?? { status: 'none' };
  }

  /** Statut résumé (listes) : sans charger la revue complète. */
  hasReview(id: string): boolean {
    return this.#store.getReview(id) !== undefined;
  }

  /** Met la partie en file (sauf si elle est déjà analysée ou en cours). */
  request(id: string, load: Job['load'], options: { priority?: boolean } = {}): void {
    if (this.#store.getReview(id)) return;
    const current = this.#state.get(id);
    if (current && current.status !== 'error') {
      // Déjà en attente : une demande prioritaire la fait passer devant.
      const index = this.#queue.findIndex((job) => job.id === id);
      if (options.priority && index > 0) this.#queue.unshift(...this.#queue.splice(index, 1));
      return;
    }
    this.#state.set(id, { status: 'queued' });
    const job = { id, load };
    if (options.priority) this.#queue.unshift(job);
    else this.#queue.push(job);
    void this.#pump();
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
    }
  }

  async #run(job: Job): Promise<void> {
    try {
      const input = job.load();
      if (!input) throw new Error('Partie introuvable.');
      this.#state.set(job.id, { status: 'running', progress: 0 });
      this.#engine ??= new UciEngine();
      const evals = await evaluatePositions(this.#engine, input.positions, {
        movetimeMs: this.#movetimeMs,
        onProgress: (progress) => this.#state.set(job.id, { status: 'running', progress }),
      });
      if (this.#disposed) return;
      this.#store.saveReview(job.id, buildReview(input, evals));
      this.#state.delete(job.id);
    } catch {
      this.#state.set(job.id, { status: 'error' });
    }
  }

  /**
   * Évalue une seule position avec le même Stockfish (vérification d'un coup de puzzle). Les
   * demandes passent dans la file du moteur, entre deux positions d'une analyse en cours.
   */
  async evaluate(fen: string, movetimeMs = 200): Promise<PositionAnalysis | null> {
    if (this.#disposed) return null;
    this.#engine ??= new UciEngine();
    const [result] = await evaluatePositions(this.#engine, [fen], { movetimeMs });
    return result ?? null;
  }

  dispose(): void {
    this.#disposed = true;
    this.#queue.length = 0;
    this.#engine?.quit();
    this.#engine = null;
  }
}
