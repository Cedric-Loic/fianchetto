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
  dispose(): void;
}

/**
 * Bot exécuté dans un `worker_thread` séparé (§5) : il ne reçoit que des observations
 * sérialisées par `postMessage`, jamais l'état réel de la partie.
 */
export class WorkerBot implements BotDriver {
  readonly #worker: Worker;
  #nextId = 1;
  readonly #pending = new Map<number, (response: BotResponse) => void>();

  /** `humanPace: false` : le bot joue sans temps de réflexion simulé (tests). */
  constructor(level: BotLevel, options: { humanPace?: boolean } = {}) {
    this.#worker = new Worker(BOT_WORKER_URL, {
      workerData: { level, humanPace: options.humanPace ?? true },
    });
    this.#worker.on('message', (response: BotResponse) => {
      this.#pending.get(response.id)?.(response);
      this.#pending.delete(response.id);
    });
    // Worker en erreur : les demandes en cours échouent (la partie n'est pas bloquée à vie).
    this.#worker.on('error', () => {
      for (const [id, done] of this.#pending) done({ id, ok: false });
      this.#pending.clear();
    });
    this.#worker.unref();
  }

  #request(kind: BotRequest['kind'], observation: BotObservation): Promise<unknown> {
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

  dispose(): void {
    this.#worker.postMessage('stop');
    void this.#worker.terminate();
  }
}
