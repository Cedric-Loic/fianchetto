import {
  SKILL_FOR_KIND,
  SKILL_FOR_THEME,
  SKILL_IDS,
  SKILL_LABELS,
  type SkillId,
  type SkillLevel,
} from '@sq/shared';

/*
 * Niveau par compétence. Chaque preuve est un succès ou un échec daté ; son poids décroît avec
 * l'ancienneté (demi-vie de 30 jours). Les erreurs en partie sont des échecs de la compétence
 * correspondante. Le niveau est la part pondérée de succès, lissée par un a priori neutre pour
 * qu'une seule preuve ne fasse pas bondir le niveau.
 */

export interface SkillEvidence {
  skill: SkillId;
  success: boolean;
  /** Date en ms. */
  at: number;
}

const HALF_LIFE_DAYS = 30;
const PRIOR_WEIGHT = 2;
const DAY_MS = 86_400_000;
/** Fenêtre de comparaison pour la tendance. */
const TREND_DAYS = 14;

export function skillForTheme(theme: string): SkillId {
  return SKILL_FOR_THEME[theme] ?? 'calculation';
}

export function skillForKind(kind: string): SkillId {
  return SKILL_FOR_KIND[kind] ?? 'method';
}

function levelAt(evidence: SkillEvidence[], now: number): number | null {
  if (evidence.length === 0) return null;
  let good = 0;
  let total = 0;
  for (const e of evidence) {
    const age = Math.max(0, (now - e.at) / DAY_MS);
    const weight = Math.pow(0.5, age / HALF_LIFE_DAYS);
    total += weight;
    if (e.success) good += weight;
  }
  // A priori : 50 % pesant l'équivalent de PRIOR_WEIGHT preuves récentes.
  return Math.round(((good + PRIOR_WEIGHT * 0.5) / (total + PRIOR_WEIGHT)) * 100);
}

export function computeSkills(evidence: SkillEvidence[], now: number): SkillLevel[] {
  return SKILL_IDS.map((id) => {
    const mine = evidence.filter((e) => e.skill === id);
    const level = levelAt(mine, now);
    const before = mine.filter((e) => e.at <= now - TREND_DAYS * DAY_MS);
    const previous = levelAt(before, now - TREND_DAYS * DAY_MS);
    return {
      id,
      label: SKILL_LABELS[id],
      level,
      trend: level !== null && previous !== null ? level - previous : null,
      evidence: mine.length,
    };
  });
}

/** Compétence à travailler en priorité : la plus faible parmi celles qui ont des preuves,
 *  sinon la première des compétences demandées sans preuve. */
export function weakestSkill(skills: SkillLevel[], among: readonly SkillId[]): SkillId | null {
  const candidates = skills.filter((s) => among.includes(s.id));
  if (candidates.length === 0) return null;
  const unmeasured = candidates.find((s) => s.level === null);
  const measured = candidates.filter((s) => s.level !== null);
  if (measured.length > 0) {
    measured.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const worst = measured[0]!;
    if ((worst.level ?? 100) < 60 || !unmeasured) return worst.id;
  }
  return unmeasured?.id ?? null;
}
