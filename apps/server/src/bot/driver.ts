import { randomInt } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { BOT_WORKER_URL, type BotRequest, type BotResponse } from '@sq/bot';
import {
  MoveIntentSchema,
  type BotLevel,
  type BotObservation,
  type MoveIntent,
  type Square,
} from '@sq/shared';

/** Ce dont une partie a besoin pour faire jouer le bot. */
export interface BotDriver {
  chooseSecret(candidates: readonly Square[]): Square;
  chooseMove(observation: BotObservation): Promise<MoveIntent>;
  shouldAcceptDraw(observation: BotObservation): Promise<boolean>;
  /** Arrêt du bot (et de son moteur) ; la promesse éventuelle se résout une fois tout arrêté. */
  dispose(): void | Promise<void>;
}

/** Délai laissé au worker pour arrêter Stockfish avant de le forcer à s'arrêter. */
const STOP_GRACE_MS = 1000;

export interface WorkerBotOptions {
  /** `false` : le bot joue sans temps de réflexion simulé (tests, e2e). */
  humanPace?: boolean;
  /** Délai de grâce de l'arrêt (tests). Défaut : 1 s. */
  stopGraceMs?: number;
  /** Module du worker (tests). Défaut : le worker du bot. */
  workerUrl?: URL;
}

/**
 * Bot exécuté dans un `worker_thread` séparé (§5) : il ne reçoit que des observations
 * sérialisées par `postMessage`, jamais l'état réel de la partie.
 */
export class WorkerBot implements BotDriver {
  readonly #worker: Worker;
  readonly #stopGraceMs: number;
  #nextId = 1;
  readonly #pending = new Map<number, (response: BotResponse) => void>();
  #exited = false;
  readonly #exit: Promise<void>;
  #disposing: Promise<void> | null = null;

  constructor(level: BotLevel, options: WorkerBotOptions = {}) {
    this.#stopGraceMs = options.stopGraceMs ?? STOP_GRACE_MS;
    this.#worker = new Worker(options.workerUrl ?? BOT_WORKER_URL, {
      workerData: { level, humanPace: options.humanPace ?? true },
    });
    this.#worker.on('message', (response: BotResponse) => {
      this.#pending.get(response.id)?.(response);
      this.#pending.delete(response.id);
    });
    // Worker en erreur : les demandes en cours échouent (la partie n'est pas bloquée à vie).
    this.#worker.on('error', () => this.#failPending());
    this.#exit = new Promise((resolve) => {
      this.#worker.once('exit', () => {
        this.#exited = true;
        this.#failPending();
        resolve();
      });
    });
    this.#worker.unref();
  }

  /** Le worker s'est arrêté (normalement ou non). */
  get exited(): boolean {
    return this.#exited;
  }

  #failPending(): void {
    for (const [id, done] of this.#pending) done({ id, ok: false });
    this.#pending.clear();
  }

  #request(kind: BotRequest['kind'], observation: BotObservation): Promise<unknown> {
    if (this.#exited || this.#disposing) return Promise.reject(new Error('Bot arrêté.'));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, (response) =>
        response.ok ? resolve(response.result) : reject(new Error('Erreur du bot.')),
      );
      this.#worker.postMessage({ id, kind, observation } satisfies BotRequest);
    });
  }

  /** Choix uniforme au hasard (CSPRNG), §5. */
  chooseSecret(candidates: readonly Square[]): Square {
    const square = candidates[randomInt(candidates.length)];
    if (!square) throw new Error('Aucun candidat.');
    return square;
  }

  async chooseMove(observation: BotObservation): Promise<MoveIntent> {
    return MoveIntentSchema.parse(await this.#request('chooseMove', observation));
  }

  async shouldAcceptDraw(observation: BotObservation): Promise<boolean> {
    return (await this.#request('shouldAcceptDraw', observation)) === true;
  }

  /**
   * Demande au worker de s'arrêter (il arrête Stockfish puis se termine) et attend sa sortie ;
   * passé le délai de grâce, il est arrêté de force. Sans cette attente, Stockfish resterait
   * orphelin.
   */
  dispose(): Promise<void> {
    if (this.#disposing) return this.#disposing;
    this.#failPending();
    if (this.#exited) return (this.#disposing = Promise.resolve());
    this.#worker.postMessage('stop');
    const timer = setTimeout(() => void this.#worker.terminate(), this.#stopGraceMs);
    timer.unref();
    this.#disposing = this.#exit.then(() => clearTimeout(timer));
    return this.#disposing;
  }
}
