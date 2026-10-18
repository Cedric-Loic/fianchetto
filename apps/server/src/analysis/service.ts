import { UciEngine, type AnalysisStream, type StreamOptions, type UciLine } from '@sq/bot';
import type { AnalysisEvent } from '@sq/shared';
import { analysablePosition, isFinal, toEngineLines } from './position.js';

/** Ce que le service attend du moteur (`UciEngine` ; remplaçable dans les tests). */
export interface LiveEngine {
  readonly alive: boolean;
  analyzeStream(
    fen: string,
    options: StreamOptions,
    onUpdate: (lines: UciLine[]) => void,
  ): AnalysisStream;
  quit(): void;
}

export interface AnalysisOptions {
  createEngine?: () => LiveEngine;
  /** Arrêt du moteur après cette durée sans recherche (défaut : 2 min). */
  idleMs?: number;
  maxDepth?: number;
  maxMs?: number;
}

/** Recherche en cours, vue de l'appelant. */
export interface LiveSearch {
  stop(): Promise<void>;
}

interface Current {
  stream: AnalysisStream;
}

const IDLE_MS = 2 * 60_000;

/**
 * Moteur en direct (échiquier d'analyse, revue) : un Stockfish dédié, distinct de celui des
 * revues, créé à la demande et arrêté après une période d'inactivité. Une seule recherche à la
 * fois : une nouvelle demande interrompt la précédente. Il ne reçoit qu'une FEN fournie par le
 * client, jamais une partie : aucune information secrète ne peut en sortir.
 */
export class AnalysisService {
  readonly #createEngine: () => LiveEngine;
  readonly #idleMs: number;
  readonly #maxDepth: number;
  readonly #maxMs: number;
  #engine: LiveEngine | null = null;
  #current: Current | null = null;
  #idle: NodeJS.Timeout | null = null;
  #disposed = false;

  constructor(options: AnalysisOptions = {}) {
    this.#createEngine = options.createEngine ?? (() => new UciEngine());
    this.#idleMs = options.idleMs ?? IDLE_MS;
    this.#maxDepth = options.maxDepth ?? 22;
    this.#maxMs = options.maxMs ?? 30_000;
  }

  /** Une recherche est en cours (ou en attente d'arrêt). */
  get busy(): boolean {
    return this.#current !== null;
  }

  /**
   * Lance l'analyse de `fen` : `onEvent` reçoit des événements `lines`, puis exactement un
   * événement final (`done` ou `error`). La recherche précédente éventuelle est arrêtée (elle
   * reçoit son `done`).
   */
  start(fen: string, multipv: number, onEvent: (event: AnalysisEvent) => void): LiveSearch {
    const idle: LiveSearch = { stop: () => Promise.resolve() };
    const chess = analysablePosition(fen);
    if (this.#disposed || !chess) {
      onEvent({ type: 'error', error: chess ? 'ENGINE_UNAVAILABLE' : 'INVALID_FEN' });
      return idle;
    }
    if (isFinal(chess)) {
      onEvent({ type: 'done', fen });
      return idle;
    }
    this.#clearIdle();
    void this.#current?.stream.stop();

    const engineFen = chess.fen();
    let ended = false;
    const end = (event: AnalysisEvent) => {
      if (ended) return;
      ended = true;
      onEvent(event);
    };
    let stream: AnalysisStream;
    try {
      if (!this.#engine?.alive) this.#engine = this.#createEngine();
      stream = this.#engine.analyzeStream(
        engineFen,
        { multipv, maxDepth: this.#maxDepth, maxMs: this.#maxMs },
        (lines) => {
          if (!ended) onEvent({ type: 'lines', fen, lines: toEngineLines(engineFen, lines) });
        },
      );
    } catch {
      end({ type: 'error', error: 'ENGINE_ERROR' });
      return idle;
    }
    const current: Current = { stream };
    this.#current = current;
    void stream.done
      .then(
        () => end({ type: 'done', fen }),
        () => end({ type: 'error', error: 'ENGINE_ERROR' }),
      )
      .finally(() => {
        if (this.#current !== current) return;
        this.#current = null;
        this.#scheduleIdle();
      });
    return { stop: () => stream.stop() };
  }

  #clearIdle(): void {
    if (this.#idle) clearTimeout(this.#idle);
    this.#idle = null;
  }

  #scheduleIdle(): void {
    this.#clearIdle();
    if (this.#disposed || !this.#engine) return;
    this.#idle = setTimeout(() => {
      this.#idle = null;
      if (this.#current) return;
      this.#engine?.quit();
      this.#engine = null;
    }, this.#idleMs);
    this.#idle.unref();
  }

  /** Arrêt du serveur : interrompt la recherche en cours (les flux reçoivent leur fin). */
  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#clearIdle();
    const current = this.#current;
    if (current) {
      await Promise.race([
        current.stream.stop(),
        new Promise((resolve) => setTimeout(resolve, 2000).unref()),
      ]);
    }
    this.#engine?.quit();
    this.#engine = null;
  }
}
