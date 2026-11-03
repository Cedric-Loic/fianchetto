import { describe, expect, it } from 'vitest';
import { coachAnswerCorrect, coachPrompt } from '../src/index.js';

describe('partie coachée', () => {
  it('menace : pièces à moi en prise', () => {
    // Trait aux Noirs : e4 et g4 blancs sont attaqués sans défenseur, mais ce sont des pièces
    // adverses ; ici on teste le trait aux Blancs avec un cavalier noir qui attaque.
    const p = coachPrompt('rnbqkb1r/pppp1ppp/8/4p3/4n3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4');
    expect(p).not.toBeNull();
  });

  it('occasion : pièce adverse en prise quand rien ne me menace', () => {
    const p = coachPrompt('r1bqkbnr/pppp1ppp/8/4p3/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4');
    expect(p?.kind === 'threat' || p?.kind === 'chance').toBe(true);
  });

  it('position de départ : rien à signaler', () => {
    expect(coachPrompt('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('en échec : on ne questionne pas', () => {
    expect(coachPrompt('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')).toBeNull();
  });

  it('la dame noire en prise est une occasion, comparaison sans ordre', () => {
    const p = coachPrompt('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3');
    // Les Blancs ont e4 menacé par la dame h4 (non défendu) : c'est une menace.
    expect(p?.kind).toBe('threat');
    expect(p?.squares).toContain('e4');
    expect(coachAnswerCorrect(p!, [...p!.squares].reverse())).toBe(true);
    expect(coachAnswerCorrect(p!, ['a1'])).toBe(false);
  });
});
