/* Saisie des coups de l'entraîneur de calcul (formats de texte, forme d'une promotion). */

const FILE_RE = /^([a-h][1-8])[\s\-x]?([a-h][1-8])([qrbn])?$/;

/** Lit « e2e4 », « e2-e4 » ou « e7e8q » ; `null` si le format n'est pas reconnu. */
export function parseUci(text: string): string | null {
  const m = FILE_RE.exec(text.trim().toLowerCase());
  return m ? `${m[1]}${m[2]}${m[3] ?? ''}` : null;
}

/** Le coup a la forme d'une promotion (7e → 8e rangée ou 2e → 1re, d'une colonne au plus). */
export function looksLikePromotion(from: string, to: string): boolean {
  const files = Math.abs('abcdefgh'.indexOf(from[0] ?? '') - 'abcdefgh'.indexOf(to[0] ?? ''));
  return files <= 1 && ((from[1] === '7' && to[1] === '8') || (from[1] === '2' && to[1] === '1'));
}
