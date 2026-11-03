import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { explainMove, forkTargets, lineTactics, type EngineEval } from '../src/index.js';

/*
 * Détecteurs d'erreurs, sur de vraies positions. Les évaluations moteur sont écrites à la main
 * (ce que Stockfish renverrait) : les tests ne dépendent pas de Stockfish.
 */

const ev = (partial: Partial<EngineEval>): EngineEval => ({
  evalCp: 0,
  mate: null,
  bestMoveUci: null,
  pv: [],
  ...partial,
});

/** Position après une suite de coups UCI depuis la position initiale. */
function after(line: string): string {
  const chess = new Chess();
  for (const uci of line.split(' ').filter(Boolean)) {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return chess.fen();
}

function play(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess.fen();
}

describe('détecteurs', () => {
  it('pièce jouée en prise', () => {
    const fenBefore = after('e2e4 e7e5 g1f3 b8c6');
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'f3e5'),
      playedUci: 'f3e5',
      before: ev({ evalCp: 30, bestMoveUci: 'f1b5', pv: ['f1b5'] }),
      after: ev({ evalCp: -250, bestMoveUci: 'c6e5', pv: ['c6e5'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'hanging-piece',
      text: 'Le cavalier joué en e5 est en prise : Nxe5 le gagne.',
      visual: {
        arrows: [{ from: 'c6', to: 'e5', kind: 'threat' }],
        marks: [
          { square: 'e5', kind: 'hanging' },
          { square: 'c6', kind: 'attacker' },
        ],
      },
    });
  });

  it('autre pièce laissée en prise', () => {
    // Le fou g4, attaqué par la dame d4, reste sans défense.
    const fenBefore = '4k3/8/8/8/3Q2b1/5N2/8/4K3 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'e8e7'),
      playedUci: 'e8e7',
      before: ev({ evalCp: 900, bestMoveUci: 'g4f3', pv: ['g4f3'] }),
      after: ev({ evalCp: 1200, bestMoveUci: 'd4g4', pv: ['d4g4'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'hanging-piece',
      text: 'Laisse le fou g4 en prise : Qxg4 le gagne.',
    });
  });

  it('fourchette permise', () => {
    const fenBefore = 'r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'h7h6'),
      playedUci: 'h7h6',
      before: ev({ evalCp: 0, bestMoveUci: 'e8d7', pv: ['e8d7'] }),
      after: ev({ evalCp: 300, bestMoveUci: 'b5c7', pv: ['b5c7'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'allowed-fork',
      text: 'Permet la fourchette Nc7+ sur roi e8 et tour a8.',
      visual: {
        arrows: [{ from: 'b5', to: 'c7', kind: 'threat' }],
        marks: [
          { square: 'e8', kind: 'target' },
          { square: 'a8', kind: 'target' },
          { square: 'c7', kind: 'attacker' },
        ],
        line: ['h7h6', 'b5c7'],
      },
    });
  });

  it('fourchette manquée', () => {
    const fenBefore = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'e1d2'),
      playedUci: 'e1d2',
      before: ev({ evalCp: 400, bestMoveUci: 'd5c7', pv: ['d5c7'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'a8a2', pv: ['a8a2'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'missed-fork',
      text: 'Nc7+ était une fourchette sur roi e8 et tour a8.',
    });
  });

  it('prise gagnante manquée', () => {
    const fenBefore = '4k3/8/8/4n3/8/2B5/8/4K3 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'e1d1'),
      playedUci: 'e1d1',
      before: ev({ evalCp: 300, bestMoveUci: 'c3e5', pv: ['c3e5'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'e5c4', pv: ['e5c4'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'missed-material',
      text: 'Bxe5 gagnait le cavalier e5.',
    });
  });

  it('mat manqué', () => {
    const fenBefore = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'g2g3'),
      playedUci: 'g2g3',
      before: ev({ evalCp: null, mate: 1, bestMoveUci: 'a1a8', pv: ['a1a8'] }),
      after: ev({ evalCp: 500, bestMoveUci: 'h7h6', pv: ['h7h6'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'missed-mate',
      text: 'Mat en 1 manqué : Ra8# lançait le mat.',
    });
  });

  it('mat permis', () => {
    const fenBefore = '6k1/5ppp/1p6/8/8/8/5PPP/R5K1 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'b6b5'),
      playedUci: 'b6b5',
      before: ev({ evalCp: 500, bestMoveUci: 'h7h6', pv: ['h7h6'] }),
      after: ev({ evalCp: null, mate: 1, bestMoveUci: 'a1a8', pv: ['a1a8'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'allowed-mate',
      text: 'Ce coup permet un mat en 1, à commencer par Ra8#.',
    });
  });

  it('perte de matériel sur la suite, puis repli générique', () => {
    // Ne5 ?? : le cavalier est attaqué deux fois (fou b8, tour e7), défendu une fois (tour e1).
    // Bxe5 Rxe5 Rxe5 : les Blancs perdent cavalier et tour contre un fou.
    const fenBefore = '1b3k2/4r3/8/8/8/5N2/8/4RK2 w - - 0 1';
    const loss = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'f3e5'),
      playedUci: 'f3e5',
      before: ev({ evalCp: 0, bestMoveUci: 'f1g1', pv: ['f1g1'] }),
      after: ev({ evalCp: -500, bestMoveUci: 'b8e5', pv: ['b8e5', 'e1e5', 'e7e5'] }),
    });
    expect(loss).toMatchObject({
      kind: 'material-loss',
      text: 'Ce coup coûte du matériel (environ 5 points sur la suite) ; Kg1 était meilleur.',
    });

    const generic = explainMove({
      color: 'w',
      fenBefore: after(''),
      fenAfter: after('a2a4'),
      playedUci: 'a2a4',
      before: ev({ evalCp: 30, bestMoveUci: 'e2e4', pv: ['e2e4'] }),
      after: ev({ evalCp: -20, bestMoveUci: 'e7e5', pv: ['e7e5'] }),
    });
    expect(generic).toMatchObject({
      kind: 'generic',
      text: 'Meilleur coup : e4 (évaluation +0,3 au lieu de −0,2).',
    });
  });
});

describe('clouages, enfilades, finales', () => {
  it('enfilade permise', () => {
    // Kd2 ?? permet l'enfilade Rb2+ : le roi s'écarte et la tour h2 tombe.
    const fenBefore = '1r2k3/8/8/8/8/8/7R/3K4 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'd1d2'),
      playedUci: 'd1d2',
      before: ev({ evalCp: 0, bestMoveUci: 'd1e1', pv: ['d1e1'] }),
      after: ev({ evalCp: -500, bestMoveUci: 'b8b2', pv: ['b8b2', 'd2e3', 'b2h2'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'allowed-skewer',
      text: 'Permet l’enfilade Rb2+ : le roi d2 doit s’écarter et la tour h2 tombe.',
      visual: {
        arrows: [{ from: 'b8', to: 'b2', kind: 'threat' }],
        marks: [
          { square: 'd2', kind: 'target' },
          { square: 'h2', kind: 'hanging' },
          { square: 'b2', kind: 'attacker' },
        ],
        line: ['d1d2', 'b8b2', 'd2e3', 'b2h2'],
      },
    });
  });

  it('enfilade manquée', () => {
    // Re8+ : le roi e6 s'écarte, la dame e2 tombe.
    const fenBefore = 'R7/8/4k3/8/8/8/4q3/7K w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'h1g1'),
      playedUci: 'h1g1',
      before: ev({ evalCp: 400, bestMoveUci: 'a8e8', pv: ['a8e8', 'e6d6', 'e8e2'] }),
      after: ev({ evalCp: -900, bestMoveUci: 'e2e1', pv: ['e2e1'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'missed-skewer',
      text: 'Re8+ était une enfilade : le roi e6 devait s’écarter et la dame e2 tombait.',
      visual: { arrows: [{ from: 'a8', to: 'e8', kind: 'best' }] },
    });
  });

  it('clouage permis puis clouage manqué', () => {
    // …Nc6 ? permet Bb5, qui cloue le cavalier devant le roi (d5 le gagne ensuite).
    const fenBefore = '1n2k3/8/8/8/3P4/8/8/4KB2 b - - 0 1';
    const allowed = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'b8c6'),
      playedUci: 'b8c6',
      before: ev({ evalCp: 300, bestMoveUci: 'e8d7', pv: ['e8d7'] }),
      after: ev({ evalCp: 600, bestMoveUci: 'f1b5', pv: ['f1b5', 'e8d7', 'd4d5'] }),
    });
    expect(allowed).toMatchObject({
      kind: 'allowed-pin',
      text: 'Permet le clouage Bb5 : le cavalier c6 est cloué devant le roi e8.',
      visual: {
        marks: [
          { square: 'c6', kind: 'target' },
          { square: 'e8', kind: 'target' },
          { square: 'b5', kind: 'attacker' },
        ],
      },
    });

    const fenWhite = '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1';
    const missed = explainMove({
      color: 'w',
      fenBefore: fenWhite,
      fenAfter: play(fenWhite, 'e1d2'),
      playedUci: 'e1d2',
      before: ev({ evalCp: 600, bestMoveUci: 'f1b5', pv: ['f1b5'] }),
      after: ev({ evalCp: 300, bestMoveUci: 'c6d4', pv: ['c6d4'] }),
    });
    expect(missed).toMatchObject({
      kind: 'missed-pin',
      text: 'Bb5 clouait le cavalier c6 devant le roi e8.',
    });
  });

  it('pas de clouage sur un pion ni à travers un pion', () => {
    // Partie espagnole : Bb5 vise c6, mais le pion d7 est derrière.
    expect(
      lineTactics('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f1b5'),
    ).toEqual([]);
    // Fou pris aussitôt avec profit par un pion : rien.
    expect(lineTactics('4k3/1p6/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1a6')).toEqual([]);
  });

  it('finale gagnante mal convertie', () => {
    // Finale de pions (évaluations écrites à la main) : Kd2 garde 86 % de gain, Kf2 retombe à 50 %.
    const fenBefore = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'e1f2'),
      playedUci: 'e1f2',
      before: ev({ evalCp: 500, bestMoveUci: 'e1d2', pv: ['e1d2', 'e5e4', 'e1e2'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'e5e4', pv: ['e5e4'] }),
    });
    expect(explanation).toMatchObject({
      kind: 'endgame-conversion',
      text: 'Finale gagnante mal convertie : 86 % de chances de gain avant ce coup, 50 % après. Kd2 gardait le gain.',
      visual: { arrows: [{ from: 'e1', to: 'd2', kind: 'best' }] },
    });
    // En milieu de partie, même chute : repli générique.
    const middle = explainMove({
      color: 'w',
      fenBefore: after(''),
      fenAfter: after('a2a4'),
      playedUci: 'a2a4',
      before: ev({ evalCp: 500, bestMoveUci: 'e2e4', pv: ['e2e4'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'e7e5', pv: ['e7e5'] }),
    });
    expect(middle.kind).toBe('generic');
  });
});

describe('conséquences seules (garde-fou)', () => {
  it('ignore le mat manqué et décrit la pièce laissée en prise', () => {
    const fenBefore = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const ctx = {
      color: 'w' as const,
      fenBefore,
      fenAfter: play(fenBefore, 'h5g4'),
      playedUci: 'h5g4',
      before: ev({ evalCp: null, mate: 1, bestMoveUci: 'h5f7', pv: ['h5f7'] }),
      after: ev({ evalCp: -600, bestMoveUci: 'f6g4', pv: ['f6g4'] }),
    };
    expect(explainMove(ctx).kind).toBe('missed-mate');
    expect(explainMove(ctx, { consequencesOnly: true })).toMatchObject({
      kind: 'hanging-piece',
      text: 'La dame jouée en g4 est en prise : Nxg4 la gagne.',
    });
  });
});

describe('fourchettes', () => {
  it('une pièce prise aussitôt avec profit ne fait pas de fourchette', () => {
    // Nc7+ attaque e8 et a8, mais le cavalier est pris par la dame d8 (sans défense).
    expect(forkTargets('r2qk3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7')).toEqual([]);
    // Un pion défendu qui attaque deux pièces est une fourchette.
    expect(forkTargets('4k3/8/8/2n1b3/8/3PP3/8/4K3 w - - 0 1', 'd3d4')).toEqual([
      { type: 'n', square: 'c5' },
      { type: 'b', square: 'e5' },
    ]);
    // Le même pion sans défense est pris par le fou : pas de fourchette.
    expect(forkTargets('4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1', 'd3d4')).toEqual([]);
    // Coup illégal : rien.
    expect(forkTargets('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'e1e3')).toEqual([]);
  });
});
