import { describe, expect, it } from 'vitest';
import { initialClockMs, parseGame, pgnClocks } from '../src/index.js';

/** Extrait d'un PGN chess.com (pendule `[%clk]` après chaque coup). */
const CHESSCOM = `[Event "Live Chess"]
[Site "Chess.com"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[TimeControl "600+5"]

1. e4 {[%clk 0:10:03.4]} 1... e5 {[%clk 0:10:04.1]} 2. Nf3 {[%clk 0:09:58]}
2... Nc6 {[%clk 1:00:00]} (2... d6 {[%clk 0:00:01]}) 3. Bc4 $1 {un commentaire} 0-1`;

describe('pendule des PGN', () => {
  it('lit le temps restant après chaque demi-coup', () => {
    expect(pgnClocks(CHESSCOM)).toEqual([603_400, 604_100, 598_000, 3_600_000, null]);
    // Même nombre de demi-coups que la partie lue par chess.js.
    expect(parseGame(CHESSCOM)?.moves).toHaveLength(5);
  });

  it('sans pendule, numéros collés aux coups', () => {
    expect(pgnClocks('[White "a"]\n\n1.e4 e5 2.Nf3 *')).toBeNull();
    expect(pgnClocks('1.e4 {[%clk 0:00:59.9]} 1...e5 {[%clk 0:01:00]} *')).toEqual([
      59_900, 60_000,
    ]);
  });

  it('temps initial d’après TimeControl', () => {
    expect(initialClockMs('600+5')).toBe(600_000);
    expect(initialClockMs('180')).toBe(180_000);
    expect(initialClockMs('1/86400')).toBeNull();
    expect(initialClockMs(null)).toBeNull();
  });
});
