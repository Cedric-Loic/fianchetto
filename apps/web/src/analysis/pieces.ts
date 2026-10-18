import type { DisplayedPiece } from '@sq/shared';

let fresh = 0;

const distance = (a: string, b: string) =>
  Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(a.charCodeAt(1) - b.charCodeAt(1));

/**
 * Transmet les identifiants des pièces d'une position à une autre, quelle que soit la distance
 * entre elles (coup suivant, coup précédent, saut dans l'arbre) : les pièces qui ont bougé
 * glissent au lieu de réapparaître. Une pièce restée en place garde son identifiant ; les autres
 * reprennent celui de la pièce disparue la plus proche, de même type puis de même couleur
 * (promotion). Les pièces nouvelles reçoivent un identifiant neuf.
 */
export function morphPieces(
  previous: readonly DisplayedPiece[],
  next: readonly DisplayedPiece[],
): DisplayedPiece[] {
  const used = new Set<string>();
  const result: (DisplayedPiece | null)[] = next.map((p) => {
    const same = previous.find(
      (q) => !used.has(q.id) && q.square === p.square && q.color === p.color && q.type === p.type,
    );
    if (!same) return null;
    used.add(same.id);
    return { ...p, id: same.id };
  });
  for (const strict of [true, false]) {
    next.forEach((p, i) => {
      if (result[i]) return;
      let best: DisplayedPiece | null = null;
      for (const q of previous) {
        if (used.has(q.id) || q.color !== p.color || (strict && q.type !== p.type)) continue;
        if (!best || distance(q.square, p.square) < distance(best.square, p.square)) best = q;
      }
      if (best) {
        used.add(best.id);
        result[i] = { ...p, id: best.id };
      }
    });
  }
  return next.map((p, i) => result[i] ?? { ...p, id: `new${fresh++}` });
}
