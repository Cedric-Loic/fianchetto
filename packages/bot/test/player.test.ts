import { afterAll, describe, expect, it } from 'vitest';
import type { BotRejection } from '@sq/shared';
import { SecretQueenBot } from '../src/player.js';
import { UciEngine } from '../src/uci.js';
import { newGame, observe, randomMove, rng } from './helpers.js';

const engine = new UciEngine();
afterAll(() => engine.quit());

describe('bot (Stockfish)', () => {
  it('choisit son pion secret parmi les candidats', () => {
    const bot = new SecretQueenBot(engine, 3);
    expect(['a7', 'b7']).toContain(bot.chooseSecret(['a7', 'b7']));
  });

  for (const level of [1, 5] as const) {
    it(`niveau ${level} : joue jusqu'à un coup accepté, 20 coups de suite`, async () => {
      const bot = new SecretQueenBot(engine, level);
      const game = newGame({ w: 'c2', b: 'e7' });
      const random = rng(level);
      const rejections: BotRejection[] = [];
      for (let i = 0; i < 20 && !game.isOver; i++) {
        if (!randomMove(game, random) || game.isOver) break;
        let accepted = false;
        for (let attempt = 0; attempt < 30 && !accepted; attempt++) {
          const move = await bot.chooseMove(observe(game, 'b', rejections));
          accepted = game.play('b', move).ok;
          if (!accepted) rejections.push({ ply: game.plyCount, move });
        }
        expect(accepted).toBe(true);
      }
    }, 120_000);
  }

  it('joue un coup légal dès l’ouverture (niveau 5)', async () => {
    const bot = new SecretQueenBot(engine, 5);
    const game = newGame({ w: 'a2', b: 'h7' });
    expect(game.play('w', { from: 'e2', to: 'e4' }).ok).toBe(true);
    const move = await bot.chooseMove(observe(game, 'b'));
    expect(game.play('b', move).ok).toBe(true);
  }, 60_000);
});
