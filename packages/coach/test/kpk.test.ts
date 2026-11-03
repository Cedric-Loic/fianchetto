import { describe, expect, it } from 'vitest';
import { kpkResult } from '../src/index.js';

/*
 * Base roi et pion contre roi : positions connues de la théorie. Le résultat est celui du camp
 * du pion, avec le meilleur jeu des deux camps.
 */

describe('kpkResult', () => {
  it.each([
    // Roi devant le pion, sur la 6e rangée : gain quel que soit le trait.
    ['4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'win'],
    ['4k3/8/4K3/4P3/8/8/8/8 b - - 0 1', 'win'],
    // Roi sur une case clé de la 6e rangée (e4 : d6, e6, f6).
    ['3k4/8/3K4/8/4P3/8/8/8 b - - 0 1', 'win'],
    // Opposition : le camp qui a l'opposition gagne, l'autre fait nulle.
    ['8/8/4k3/8/4K3/8/4P3/8 w - - 0 1', 'win'],
    ['8/4k3/8/3K4/4P3/8/8/8 w - - 0 1', 'win'],
    ['8/4k3/8/3K4/4P3/8/8/8 b - - 0 1', 'draw'],
    ['4k3/8/8/4P3/4K3/8/8/8 b - - 0 1', 'draw'],
    ['8/3k4/8/4K3/4P3/8/8/8 b - - 0 1', 'draw'],
    // Règle du carré.
    ['8/8/8/8/2k4P/8/8/K7 w - - 0 1', 'win'],
    ['8/8/8/8/3k3P/8/8/K7 b - - 0 1', 'draw'],
    ['8/8/8/5k2/P7/8/8/7K w - - 0 1', 'win'],
    ['8/8/8/8/P4k2/8/8/7K b - - 0 1', 'draw'],
    // Pion de tour : le roi défenseur dans le coin fait nulle, même contre un roi très avancé.
    ['7k/8/6K1/7P/8/8/8/8 b - - 0 1', 'draw'],
    ['7k/8/6K1/7P/8/8/8/8 w - - 0 1', 'draw'],
    ['6k1/8/5K2/7P/8/8/8/8 b - - 0 1', 'draw'],
    // Le pion de tour gagne si le roi défenseur est coupé du coin.
    ['8/8/8/8/k7/8/7P/7K w - - 0 1', 'win'],
    ['k7/8/8/7P/6K1/8/8/8 w - - 0 1', 'win'],
    ['5k2/8/8/7P/6K1/8/8/8 w - - 0 1', 'draw'],
    // Pion noir : même résultat par symétrie.
    ['8/4p3/8/4k3/8/4K3/8/8 b - - 0 1', 'win'],
    ['4k3/8/8/4p3/4K3/8/8/8 w - - 0 1', 'draw'],
    // Colonnes e à h : symétrie gauche-droite.
    ['8/8/8/8/k7/8/P7/K7 w - - 0 1', 'draw'],
  ] as const)('%s : %s', (fen, expected) => {
    expect(kpkResult(fen)).toBe(expected);
  });

  it('null si la position n’est pas roi et pion contre roi, ou si elle est illégale', () => {
    expect(kpkResult('8/8/8/8/8/8/8/K1k5 w - - 0 1')).toBeNull(); // pas de pion
    expect(kpkResult('8/8/8/4k3/8/8/4PP2/4K3 w - - 0 1')).toBeNull(); // deux pions
    expect(kpkResult('8/8/8/4k3/8/8/4P3/3QK3 w - - 0 1')).toBeNull(); // une dame en plus
    expect(kpkResult('8/8/8/8/8/3kK3/4P3/8 w - - 0 1')).toBeNull(); // rois adjacents
    expect(kpkResult('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toBeNull();
    expect(kpkResult('n’importe quoi')).toBeNull();
  });

  it('la base se construit vite (moins de 2 s)', () => {
    const start = Date.now();
    kpkResult('8/8/4k3/8/4K3/8/4P3/8 w - - 0 1');
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
