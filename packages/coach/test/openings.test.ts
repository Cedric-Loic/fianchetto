import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  OPENING_INTERVALS_DAYS,
  OPENING_LINES,
  nextOpeningSchedule,
  openingLearned,
  openingLineById,
  openingLineSteps,
  openingsRecommendation,
  repertoireDeviation,
} from '../src/index.js';

const DAY = 24 * 3600 * 1000;

describe('répertoire d’ouvertures : contenu', () => {
  it('6 à 10 lignes par camp, de 6 à 10 coups, identifiants uniques, idée en une phrase', () => {
    expect(new Set(OPENING_LINES.map((l) => l.id)).size).toBe(OPENING_LINES.length);
    for (const color of ['w', 'b'] as const) {
      const lines = OPENING_LINES.filter((l) => l.color === color);
      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(lines.length).toBeLessThanOrEqual(10);
    }
    for (const line of OPENING_LINES) {
      const moves = Math.ceil(line.moves.length / 2);
      expect(moves, line.id).toBeGreaterThanOrEqual(6);
      expect(moves, line.id).toBeLessThanOrEqual(10);
      // Le joueur joue le dernier coup de la ligne.
      expect((line.moves.length - 1) % 2 === 0 ? 'w' : 'b', line.id).toBe(line.color);
      expect(line.idea.trim().length).toBeGreaterThan(20);
      expect(openingLineById(line.id)).toBe(line);
    }
  });

  it('chaque coup est légal et écrit en SAN canonique (chess.js)', () => {
    for (const line of OPENING_LINES) {
      const chess = new Chess();
      for (const san of line.moves) {
        const m = chess.move(san);
        expect(m.san, `${line.id} : ${san}`).toBe(san);
      }
      expect(openingLineSteps(line)).toHaveLength(line.moves.length);
    }
    // Les pièges vont au bout : le mat de Légal est bien un mat.
    const legal = openingLineById('w-legal');
    const steps = legal ? openingLineSteps(legal) : [];
    expect(new Chess(steps.at(-1)?.fen).isCheckmate()).toBe(true);
  });

  it('une seule réponse du joueur par position (sauf 1…e5 / 1…d5 contre 1. e4)', () => {
    for (const color of ['w', 'b'] as const) {
      const answers = new Map<string, Set<string>>();
      for (const line of OPENING_LINES.filter((l) => l.color === color)) {
        line.moves.forEach((san, i) => {
          if ((i % 2 === 0 ? 'w' : 'b') !== color) return;
          const key = line.moves.slice(0, i).join(' ');
          answers.set(key, (answers.get(key) ?? new Set()).add(san));
        });
      }
      for (const [position, moves] of answers) {
        if (color === 'b' && position === 'e4') expect([...moves].sort()).toEqual(['d5', 'e5']);
        else expect(moves.size, `${color} après « ${position} »`).toBe(1);
      }
    }
  });
});

describe('sortie du répertoire', () => {
  it('le joueur s’écarte : coup et réponse attendue', () => {
    expect(repertoireDeviation(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'w')).toEqual({
      ply: 5,
      moveNumber: 3,
      by: 'player',
      played: 'Bb5',
      expected: ['Bc4'],
    });
    expect(repertoireDeviation(['d4', 'Nf6'], 'b')).toMatchObject({
      ply: 2,
      by: 'player',
      expected: ['d5'],
    });
    expect(repertoireDeviation(['e4', 'c5'], 'b')).toMatchObject({
      moveNumber: 1,
      by: 'player',
      expected: ['e5', 'd5'],
    });
  });

  it('l’adversaire s’écarte ; échecs et annotations ignorés', () => {
    expect(repertoireDeviation(['e4', 'c5', 'Nf3'], 'w')).toMatchObject({
      ply: 2,
      by: 'opponent',
      played: 'c5',
    });
    expect(
      repertoireDeviation(
        ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5!', 'd5', 'exd5', 'Nxd5?!', 'Nxf7!'],
        'w',
      ),
    ).toBeNull();
  });

  it('partie fidèle jusqu’au bout d’une ligne, ou trop courte : rien à signaler', () => {
    const line = openingLineById('b-qgd');
    expect(line && repertoireDeviation([...line.moves, 'Bxe7', 'Qxe7', 'O-O'], 'b')).toBeNull();
    expect(repertoireDeviation(['e4'], 'w')).toBeNull();
    expect(repertoireDeviation([], 'b')).toBeNull();
  });
});

describe('répétition espacée', () => {
  const now = 1_000_000;
  it('intervalles des puzzles : 1, 3, 7 puis 21 jours, répété', () => {
    expect(OPENING_INTERVALS_DAYS).toEqual([1, 3, 7, 21]);
    let s = nextOpeningSchedule(null, true, now);
    expect(s).toEqual({ step: 0, dueAt: now + DAY });
    s = nextOpeningSchedule(s, true, now);
    expect(s).toEqual({ step: 1, dueAt: now + 3 * DAY });
    s = nextOpeningSchedule(s, true, now);
    s = nextOpeningSchedule(s, true, now);
    expect(s).toEqual({ step: 3, dueAt: now + 21 * DAY });
    expect(openingLearned(s)).toBe(true);
    expect(nextOpeningSchedule(s, true, now).step).toBe(3);
  });

  it('un échec renvoie au premier intervalle', () => {
    expect(nextOpeningSchedule({ step: 2, dueAt: 0 }, false, now)).toEqual({
      step: 0,
      dueAt: now + DAY,
    });
    expect(nextOpeningSchedule(null, false, now).step).toBe(0);
    expect(openingLearned(null)).toBe(false);
  });

  it('recommandation du coach seulement si des lignes sont dues', () => {
    expect(openingsRecommendation(0)).toBeNull();
    expect(openingsRecommendation(3)).toMatchObject({ href: '#/openings' });
  });
});
