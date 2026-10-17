import { describe, expect, it } from 'vitest';
import { ClassicGame } from '@sq/engine';
import { classicWorld, computeBelief, worldsFor } from '../src/belief.js';
import { newGame, observe, randomMove, rng } from './helpers.js';

describe('croyance du bot', () => {
  it('au départ, les 8 pions adverses sont possibles, avec le même poids', () => {
    const game = newGame({ w: 'e2', b: 'd7' });
    const worlds = computeBelief(observe(game, 'b'));
    expect(worlds.map((w) => w.pieceId)).toHaveLength(8);
    expect(worlds.every((w) => Math.abs(w.weight - 1 / 8) < 1e-9)).toBe(true);
  });

  it('un « pion » qui se déplace en diagonale sur une case vide est la dame', () => {
    const game = newGame({ w: 'e2', b: 'd7' });
    expect(game.play('w', { from: 'e2', to: 'g4' }).ok).toBe(true);
    const worlds = computeBelief(observe(game, 'b'));
    expect(worlds.map((w) => w.pieceId)).toEqual(['wpe2']);
  });

  it('un échec sans cause visible désigne les pions qui peuvent le donner', () => {
    const game = newGame({ w: 'f2', b: 'a7' });
    for (const [c, m] of [
      ['w', { from: 'e2', to: 'e4' }],
      ['b', { from: 'f7', to: 'f6' }],
      ['w', { from: 'a2', to: 'a3' }],
      ['b', { from: 'g7', to: 'g5' }],
    ] as const) {
      expect(game.play(c, m).ok).toBe(true);
    }
    // La dame secrète (f2) n'a pas bougé : seule l'annonce d'échec trahirait… rien ici.
    const worlds = computeBelief(observe(game, 'b'));
    expect(worlds.some((w) => w.pieceId === 'wpf2')).toBe(true);
  });

  it('le monde réel n’est jamais éliminé (parties aléatoires, refus compris)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const random = rng(seed);
      const files = 'abcdefgh';
      const w = `${files[Math.floor(random() * 8)]}2` as const;
      const b = `${files[Math.floor(random() * 8)]}7` as const;
      const game = newGame({ w: w as 'a2', b: b as 'a7' });
      const rejections: { ply: number; move: { from: 'a1'; to: 'a1' } }[] = [];
      for (let ply = 0; ply < 40 && !game.isOver; ply++) {
        if (game.turn === 'b') {
          // Le bot (Noirs) tente un coup au hasard ; un refus est mémorisé.
          const from = `${files[Math.floor(random() * 8)]}${1 + Math.floor(random() * 8)}`;
          const to = `${files[Math.floor(random() * 8)]}${1 + Math.floor(random() * 8)}`;
          const move = { from, to } as { from: 'a1'; to: 'a1' };
          if (!game.play('b', move).ok) rejections.push({ ply: game.plyCount, move });
          else continue;
        }
        if (!randomMove(game, random)) break;
        const worlds = computeBelief(observe(game, 'b', rejections));
        expect(worlds.map((x) => x.pieceId)).toContain(`wp${w}`);
      }
    }
  });
});

describe('partie classique', () => {
  it('un seul monde : la position réelle, rejouée depuis les coups publics', () => {
    const game = ClassicGame.create();
    for (const m of [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ] as const) {
      expect(game.play(game.turn, m).ok).toBe(true);
    }
    const worlds = worldsFor(observe(game, 'b'));
    expect(worlds).toHaveLength(1);
    expect(worlds[0]?.fen).toBe(game.positions().at(-1));
    expect(worlds[0]?.weight).toBe(1);
  });

  it('promotion rejouée correctement', () => {
    const game = ClassicGame.create();
    for (const m of ['e2e4', 'd7d5', 'e4d5', 'c7c6', 'd5c6', 'g8f6', 'c6b7', 'b8d7', 'b7a8n']) {
      const intent = { from: m.slice(0, 2), to: m.slice(2, 4) } as { from: 'a1'; to: 'a1' };
      const promotion = m[4] as 'n' | undefined;
      expect(game.play(game.turn, promotion ? { ...intent, promotion } : intent).ok).toBe(true);
    }
    expect(classicWorld(observe(game, 'b'))[0]?.fen).toBe(game.positions().at(-1));
  });
});

describe('partie classique depuis une FEN', () => {
  it('la position réelle part de la FEN de départ', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const game = ClassicGame.create(fen);
    expect(game.play('w', { from: 'f1', to: 'b5' }).ok).toBe(true);
    const obs = observe(game, 'b');
    expect(obs.state.initialFen).toBe(fen);
    expect(classicWorld(obs)[0]?.fen).toBe(game.positions().at(-1));
  });
});
