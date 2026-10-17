/*
 * Classement Glicko-2 (Glickman, 2013), mis à jour après chaque puzzle comme sur Lichess :
 * le joueur « affronte » le puzzle, dont le classement est fixe.
 */

export interface Glicko {
  rating: number;
  /** Écart type du classement (RD). */
  deviation: number;
  volatility: number;
}

/**
 * Classement de départ : 1500, écart 250 (provisoire mais moins brutal que 350 : un premier échec
 * sur un puzzle à 1000 coûte ≈ 300 points au lieu de ≈ 500).
 */
export const INITIAL_GLICKO: Glicko = { rating: 1500, deviation: 250, volatility: 0.06 };

const SCALE = 173.7178;
/** Contrainte de volatilité (Lichess : 0,75 pour les puzzles). */
const TAU = 0.75;
const MIN_DEVIATION = 45;
const MAX_DEVIATION = 350;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/** Nouveau classement après un puzzle : `score` = 1 (réussi) ou 0 (raté). */
export function updateGlicko(
  player: Glicko,
  opponent: { rating: number; deviation: number },
  score: number,
): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  const muJ = (opponent.rating - 1500) / SCALE;
  const gJ = g(opponent.deviation / SCALE);
  const expected = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
  const v = 1 / (gJ * gJ * expected * (1 - expected));
  const delta = v * gJ * (score - expected);

  // Nouvelle volatilité : résolution de f(x) = 0 par la méthode d'Illinois.
  const a = Math.log(player.volatility ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - d)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const volatility = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gJ * (score - expected);
  return {
    rating: muNew * SCALE + 1500,
    deviation: Math.max(MIN_DEVIATION, Math.min(MAX_DEVIATION, phiNew * SCALE)),
    volatility,
  };
}
