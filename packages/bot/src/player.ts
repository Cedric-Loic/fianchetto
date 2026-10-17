import { randomInt } from 'node:crypto';
import { Chess } from 'chess.js';
import type {
  BotLevel,
  BotObservation,
  BotPlayer,
  MoveIntent,
  PromotionPiece,
  Square,
} from '@sq/shared';
import { worldsFor, type Hypothesis } from './belief.js';
import { LEVELS, type LevelSettings } from './levels.js';
import { targetThinkMs } from './think-time.js';
import type { UciEngine, UciLine } from './uci.js';

interface Candidate {
  intent: MoveIntent;
  /** Score moyen pondéré sur les mondes où le coup est légal. */
  score: number;
  /** Poids total des mondes où le coup est légal. */
  support: number;
}

const key = (m: MoveIntent) => `${m.from}${m.to}${m.promotion ?? ''}`;

/**
 * Bot Secret Queen : analyse chaque monde compatible avec ses observations, puis choisit le
 * coup au meilleur score moyen. Il ne voit QUE son observation (vue publique, son propre
 * secret, ses refus) : aucun accès au secret de l'humain. En classique, il n'y a qu'un monde :
 * la position réelle.
 */
export class SecretQueenBot implements BotPlayer {
  readonly #engine: UciEngine;
  readonly #level: LevelSettings;

  readonly #humanPace: boolean;

  /** `humanPace` : attendre un temps de réflexion humain avant de jouer (désactivé en test). */
  constructor(engine: UciEngine, level: BotLevel, options: { humanPace?: boolean } = {}) {
    this.#humanPace = options.humanPace ?? true;
    this.#engine = engine;
    const settings = LEVELS[level];
    if (!settings) throw new Error('Niveau inconnu.');
    this.#level = settings;
  }

  chooseSecret(candidates: readonly Square[]): Square {
    const square = candidates[randomInt(candidates.length)];
    if (!square) throw new Error('Aucun pion candidat.');
    return square;
  }

  /** Temps de réflexion total pour ce coup, selon la pendule. */
  #budgetMs(observation: BotObservation, worlds: number): number {
    const clock = observation.state.clock;
    const wanted = this.#level.movetimeMs * worlds;
    if (!clock) return wanted;
    const remaining = clock.remainingMs[observation.botColor];
    return Math.max(20 * worlds, Math.min(wanted, remaining / 30 + clock.incrementMs * 0.7));
  }

  async #evaluate(observation: BotObservation, worlds: Hypothesis[]) {
    const perWorld = this.#budgetMs(observation, worlds.length) / worlds.length;
    const results: { world: Hypothesis; lines: UciLine[] }[] = [];
    for (const world of worlds) {
      const lines = await this.#engine.analyze(world.fen, {
        movetimeMs: perWorld,
        multipv: this.#level.multipv,
        skill: this.#level.skill,
      });
      results.push({ world, lines });
    }
    return results;
  }

  async chooseMove(observation: BotObservation): Promise<MoveIntent> {
    const started = Date.now();
    const worlds = worldsFor(observation);
    const plies = observation.state.board?.moves.length ?? 0;
    const rejectedNow = new Set(
      observation.rejections.filter((r) => r.ply === plies).map((r) => key(r.move)),
    );
    const evaluations = await this.#evaluate(observation, worlds);

    const candidates = new Map<string, Candidate>();
    for (const { world, lines } of evaluations) {
      const legal = new Chess(world.fen).moves({ verbose: true });
      const worst = Math.min(...lines.map((l) => l.score), 0) - 150;
      for (const m of legal) {
        const intent: MoveIntent = m.promotion
          ? { from: m.from, to: m.to, promotion: m.promotion as PromotionPiece }
          : { from: m.from, to: m.to };
        if (m.promotion && m.promotion !== 'q') continue;
        const k = key(intent);
        if (rejectedNow.has(k)) continue;
        const line = lines.find((l) => l.move === `${m.from}${m.to}${m.promotion ?? ''}`);
        const score = line ? line.score : worst;
        const c = candidates.get(k) ?? { intent, score: 0, support: 0 };
        c.score += world.weight * score;
        c.support += world.weight;
        candidates.set(k, c);
      }
    }
    // Un coup illégal dans le monde réel serait seulement refusé, sans pénalité : on garde les
    // coups légaux dans au moins la moitié des mondes, notés sur ceux-ci.
    const ranked = [...candidates.values()]
      .filter((c) => c.support >= 0.5 - 1e-9)
      .map((c) => ({ ...c, score: c.score / c.support }))
      .sort((a, b) => b.score - a.score);
    const pool = ranked.length > 0 ? ranked : [...candidates.values()];
    const chosen = this.#pick(pool.slice(0, this.#level.multipv));
    if (!chosen) throw new Error('Aucun coup candidat.');
    // Temps de réflexion humain, seulement pour le premier essai du coup (pas après un refus).
    if (this.#humanPace && rejectedNow.size === 0) {
      const wait = targetThinkMs(observation) - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
    return chosen.intent;
  }

  /** Tirage pondéré (softmax en centipions) : plus la température est haute, plus il y a d'erreurs. */
  #pick(pool: Candidate[]): Candidate | undefined {
    const t = this.#level.temperature;
    if (t <= 0 || pool.length <= 1) return pool[0];
    const best = pool[0]?.score ?? 0;
    const weights = pool.map((c) => Math.exp(Math.max(-50, (c.score - best) / t)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = (randomInt(1_000_000) / 1_000_000) * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i] ?? 0;
      if (r <= 0) return pool[i];
    }
    return pool.at(-1);
  }

  /** Accepte la nulle si sa position moyenne est nettement mauvaise. */
  async shouldAcceptDraw(observation: BotObservation): Promise<boolean> {
    const worlds = worldsFor(observation);
    if (worlds.length === 0) return false;
    const evaluations = await this.#evaluate(observation, worlds);
    const average = evaluations.reduce(
      (sum, { world, lines }) => sum + world.weight * (lines[0]?.score ?? 0),
      0,
    );
    return average <= -150;
  }
}
