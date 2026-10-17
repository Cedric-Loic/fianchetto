import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BotObservationSchema,
  ClientMessageSchema,
  GameConfigSchema,
  materialAdvantage,
  pawnStartSquares,
  SQUARES,
  ServerMessageSchema,
  type ViewerGameState,
} from '../src/index.js';

const sampleState: ViewerGameState = {
  gameId: 'g1',
  variant: 'secret-queen',
  mode: 'bot',
  viewer: 'w',
  phase: 'playing',
  rated: true,
  timeControl: 'blitz-3+2',
  players: {
    w: { name: 'moi', rating: 1200, isBot: false, botLevel: null },
    b: { name: 'Joueur de club', rating: 1200, isBot: true, botLevel: 3 },
  },
  selection: null,
  board: {
    viewer: 'w',
    pieces: [{ id: 'wpe2', color: 'w', type: 'p', square: 'e4' }],
    turn: 'b',
    fullmoveNumber: 1,
    inCheck: false,
    moves: [
      {
        ply: 1,
        color: 'w',
        pieceId: 'wpe2',
        displayedType: 'p',
        from: 'e2',
        to: 'e4',
        san: 'e4',
        capture: null,
        promotion: null,
        castle: null,
        check: false,
        checkmate: false,
      },
    ],
    captured: { w: [], b: [] },
    ownSecret: { pieceId: 'wpd2', square: 'd2' },
    result: null,
    reveal: null,
    legalMoves: null,
  },
  clock: { remainingMs: { w: 180_000, b: 180_000 }, running: 'b', incrementMs: 2_000 },
  drawOffer: null,
  rematch: { offeredBy: null, nextGameId: null },
};

describe('primitives', () => {
  it('64 cases uniques', () => {
    expect(new Set(SQUARES).size).toBe(64);
  });

  it('8 pions candidats par camp (H1)', () => {
    expect(pawnStartSquares('w')).toEqual(['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2']);
    expect(pawnStartSquares('b')).toHaveLength(8);
  });

  it('avantage matériel sur types affichés', () => {
    // Les Blancs ont perdu un « pion » (peut-être la dame secrète : on compte 1), les Noirs un cavalier.
    expect(materialAdvantage({ w: ['p'], b: ['n'] }, 'w')).toBe(2);
    expect(materialAdvantage({ w: ['p'], b: ['n'] }, 'b')).toBe(-2);
  });
});

describe('schémas', () => {
  it('un snapshot valide passe la validation', () => {
    const msg = { type: 'snapshot', state: sampleState, cause: null };
    expect(ServerMessageSchema.parse(msg)).toEqual(msg);
  });

  it('un refus de coup ne porte aucun motif', () => {
    const parsed = ServerMessageSchema.parse({
      type: 'move-rejected',
      clientMoveId: 'm1',
      reason: 'pinned',
    });
    expect(parsed).toEqual({ type: 'move-rejected', clientMoveId: 'm1' });
  });

  it('rejette un message client inconnu', () => {
    expect(ClientMessageSchema.safeParse({ type: 'reveal-opponent' }).success).toBe(false);
  });

  it("l'observation du bot doit être projetée pour son camp", () => {
    const ok = BotObservationSchema.safeParse({
      botColor: 'w',
      state: sampleState,
      rejections: [],
    });
    const ko = BotObservationSchema.safeParse({
      botColor: 'b',
      state: sampleState,
      rejections: [],
    });
    expect(ok.success).toBe(true);
    expect(ko.success).toBe(false);
  });

  it('config/game.config.json est valide', () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL('../../../config/game.config.json', import.meta.url), 'utf8'),
    );
    const config = GameConfigSchema.parse(raw);
    expect(config.elo.initial).toBe(1200);
    expect(config.botLevels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});
