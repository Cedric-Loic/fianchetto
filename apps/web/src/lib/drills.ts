import type { Square } from '@sq/shared';

/** Durée en « m:ss » (pendules et temps de cycle) ; au-delà d'une heure « h:mm:ss ». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// --- Vision de l'échiquier -------------------------------------------------------------------

const FILES = 'abcdefgh';

export function squareAt(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

/** Case au hasard, différente de `avoid`. */
export function randomSquare(random: () => number = Math.random, avoid?: Square): Square {
  for (;;) {
    const sq = squareAt(Math.floor(random() * 8), Math.floor(random() * 8));
    if (sq !== avoid) return sq;
  }
}

/** Couleur d'une case : a1 est foncée. */
export function squareColor(square: Square): 'light' | 'dark' {
  const file = FILES.indexOf(square[0] ?? 'a');
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 0 ? 'dark' : 'light';
}

const KNIGHT_JUMPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;

/** Nombre minimal de coups de cavalier pour aller de `from` à `to` (parcours en largeur). */
export function knightDistance(from: Square, to: Square): number {
  const start: [number, number] = [FILES.indexOf(from[0] ?? 'a'), Number(from[1]) - 1];
  const goal = `${to}`;
  const seen = new Set([from]);
  let frontier: [number, number][] = [start];
  for (let d = 0; frontier.length > 0; d++) {
    const next: [number, number][] = [];
    for (const [f, r] of frontier) {
      if (squareAt(f, r) === goal) return d;
      for (const [df, dr] of KNIGHT_JUMPS) {
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const sq = squareAt(nf, nr);
        if (seen.has(sq)) continue;
        seen.add(sq);
        next.push([nf, nr]);
      }
    }
    frontier = next;
  }
  return -1;
}

export type VisionDrill = 'coords' | 'color' | 'knight';

const RECORDS_KEY = 'sq.vision.records';

/** Meilleurs scores de vision (stockage du navigateur : aucune donnée de partie). */
export function visionRecords(): Partial<Record<VisionDrill, number>> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<VisionDrill, number>>) : {};
  } catch {
    return {};
  }
}

/** Enregistre un score ; renvoie `true` si c'est un nouveau record. */
export function saveVisionScore(drill: VisionDrill, score: number): boolean {
  const records = visionRecords();
  const best = records[drill];
  if (best !== undefined && best >= score) return false;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...records, [drill]: score }));
  } catch {
    // Stockage indisponible (navigation privée) : le record n'est pas gardé.
  }
  return true;
}
