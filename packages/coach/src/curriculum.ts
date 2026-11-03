import type { SkillId, SkillLevel } from '@sq/shared';
import { weakestSkill } from './skills.js';

/*
 * Parcours en modules (ordre conseillé, jamais bloquant). Un module travaille une compétence et
 * enchaîne des étapes : leçon, finale ou ouverture. Les puzzles ciblés et les cartes de révision
 * viennent en plus, via la séance du jour.
 */

export type StepRef =
  | { type: 'lesson'; id: string }
  | { type: 'endgame'; id: string }
  | { type: 'opening'; id: string };

export interface CurriculumModule {
  id: string;
  phase: number;
  title: string;
  skill: SkillId;
  steps: StepRef[];
}

const lesson = (id: string): StepRef => ({ type: 'lesson', id });
const endgame = (id: string): StepRef => ({ type: 'endgame', id });

export const CURRICULUM: CurriculumModule[] = [
  {
    id: 'm-method',
    phase: 1,
    title: 'Ma méthode de réflexion',
    skill: 'method',
    steps: [lesson('routine')],
  },
  {
    id: 'm-safety',
    phase: 1,
    title: 'Ne plus rien donner',
    skill: 'piece-safety',
    steps: [lesson('pieces-en-prise'), lesson('attaque-double')],
  },
  { id: 'm-forks', phase: 1, title: 'Fourchettes', skill: 'forks', steps: [lesson('fourchette')] },
  {
    id: 'm-pins',
    phase: 1,
    title: 'Clouages et enfilades',
    skill: 'pins-skewers',
    steps: [lesson('clouage'), lesson('enfilade')],
  },
  {
    id: 'm-mates',
    phase: 1,
    title: 'Mats de base',
    skill: 'mates',
    steps: [
      lesson('mat-du-couloir'),
      lesson('mats-de-base'),
      lesson('mats-elementaires'),
      lesson('fin-mat-dame'),
      endgame('dame-roi'),
      lesson('fin-mat-tour'),
      endgame('tour-roi'),
      lesson('fin-deux-tours'),
      endgame('deux-tours'),
    ],
  },
  {
    id: 'm-opening',
    phase: 1,
    title: "Principes d'ouverture",
    skill: 'opening-principles',
    steps: [lesson('principes-ouverture')],
  },
  {
    id: 'm-classics-1',
    phase: 1,
    title: 'Parties classiques : pièges et mats courts',
    skill: 'opening-principles',
    steps: [lesson('classique-berger'), lesson('classique-shilling'), lesson('classique-lazard')],
  },
  {
    id: 'm-calc',
    phase: 2,
    title: 'Calculer sans se tromper',
    skill: 'calculation',
    steps: [
      lesson('coups-candidats'),
      lesson('tactiques-2-coups'),
      lesson('tactiques-3-coups'),
      lesson('deviation'),
      lesson('surcharge'),
    ],
  },
  {
    id: 'm-discovered',
    phase: 2,
    title: 'Attaques découvertes',
    skill: 'discovered',
    steps: [lesson('attaque-decouverte')],
  },
  {
    id: 'm-endgames-1',
    phase: 1,
    title: 'Finales de pions : les bases',
    skill: 'pawn-endgames',
    steps: [
      lesson('fin-cases-cles'),
      endgame('cases-cles'),
      lesson('fin-opposition'),
      endgame('opposition-gagner'),
      endgame('opposition-tenir'),
      lesson('regle-du-carre'),
      endgame('carre-courir'),
      endgame('carre-rattraper'),
      lesson('fin-pion-de-tour'),
      endgame('pion-de-tour'),
      lesson('fin-dame-pion'),
      endgame('dame-contre-pion'),
    ],
  },
  {
    id: 'm-endgames-2a',
    phase: 2,
    title: 'Finales de pions : au-delà des bases',
    skill: 'pawn-endgames',
    steps: [
      lesson('fin-opposition-distance'),
      endgame('opposition-distance'),
      lesson('fin-pion-passe-eloigne'),
      endgame('passe-eloigne'),
      lesson('fin-percee'),
      endgame('percee'),
      lesson('fin-roi-actif'),
      endgame('roi-actif'),
      lesson('fin-bon-fou'),
      endgame('bon-fou'),
      lesson('fin-forteresse-fou'),
    ],
  },
  {
    id: 'm-endgames-2b',
    phase: 2,
    title: 'Finales de tours : les positions clés',
    skill: 'rook-endgames',
    steps: [
      lesson('fin-lucena'),
      endgame('lucena'),
      lesson('fin-philidor'),
      endgame('philidor'),
      lesson('fin-tour-derriere'),
      endgame('tour-derriere'),
    ],
  },
  {
    id: 'm-endgames-3a',
    phase: 3,
    title: 'Finales de tours : défendre et couper',
    skill: 'rook-endgames',
    steps: [
      lesson('fin-vancura'),
      endgame('vancura'),
      lesson('fin-petit-cote'),
      lesson('fin-couper-roi'),
      lesson('fin-tours-deux-cotes'),
    ],
  },
  {
    id: 'm-endgames-3b',
    phase: 3,
    title: 'Finales de pièces : fous, cavaliers, forteresses',
    skill: 'pawn-endgames',
    steps: [
      lesson('fin-fous-opposes'),
      endgame('fous-opposes'),
      lesson('fin-fou-cavalier'),
      lesson('fin-forteresses'),
    ],
  },
  {
    id: 'm-pawns',
    phase: 2,
    title: 'Finales de pions',
    skill: 'pawn-endgames',
    steps: [lesson('opposition')],
  },
  {
    id: 'm-repertoire',
    phase: 2,
    title: 'Mon répertoire',
    skill: 'repertoire',
    steps: [lesson('pieges-italienne'), lesson('pieges-noirs')],
  },
  {
    id: 'm-classics-2',
    phase: 2,
    title: 'Parties classiques : tactique et développement',
    skill: 'calculation',
    steps: [
      lesson('classique-opera'),
      lesson('classique-legal'),
      lesson('classique-reti'),
      lesson('classique-lasker-thomas'),
    ],
  },
  {
    id: 'm-plans',
    phase: 3,
    title: 'Jouer avec un plan',
    skill: 'plans',
    steps: [
      lesson('activite-pieces'),
      lesson('cases-faibles-avant-postes'),
      lesson('colonnes-ouvertes'),
      lesson('prophylaxie'),
    ],
  },
  {
    id: 'm-classics-3',
    phase: 3,
    title: 'Parties classiques : attaque et plans',
    skill: 'plans',
    steps: [
      lesson('classique-lasker-bauer'),
      lesson('classique-immortelle'),
      lesson('classique-evergreen'),
      lesson('classique-rotlewi-rubinstein'),
    ],
  },
  {
    id: 'm-structures',
    phase: 3,
    title: 'Structures de pions',
    skill: 'plans',
    steps: [lesson('pion-isole'), lesson('pion-passe'), lesson('bon-fou-mauvais-fou')],
  },
  {
    id: 'm-convert',
    phase: 3,
    title: 'Convertir et finir',
    skill: 'rook-endgames',
    steps: [
      lesson('roi-roque-attaque'),
      lesson('convertir-avantage'),
      lesson('finales-tours-pratiques'),
    ],
  },
];

export interface CurriculumProgress {
  lessons: ReadonlySet<string>;
  endgames: ReadonlySet<string>;
  openings: ReadonlySet<string>;
}

export function stepDone(step: StepRef, progress: CurriculumProgress): boolean {
  if (step.type === 'lesson') return progress.lessons.has(step.id);
  if (step.type === 'endgame') return progress.endgames.has(step.id);
  return progress.openings.has(step.id);
}

export interface NextStep {
  module: CurriculumModule;
  step: StepRef;
  /** Avancement du module avant cette étape (étapes faites / total). */
  done: number;
}

/**
 * Prochaine étape conseillée : dans les modules de la phase en cours (ou antérieurs) encore
 * incomplets, on prend celui de la compétence la plus faible, sinon le premier dans l'ordre.
 */
export function nextStep(
  progress: CurriculumProgress,
  skills: SkillLevel[],
  phase: number,
  modules: CurriculumModule[] = CURRICULUM,
): NextStep | null {
  const open = modules.filter(
    (m) => m.phase <= phase && m.steps.some((s) => !stepDone(s, progress)),
  );
  if (open.length === 0) return null;
  const weakest = weakestSkill(
    skills,
    open.map((m) => m.skill),
  );
  const module = open.find((m) => m.skill === weakest && m.phase === open[0]!.phase) ?? open[0]!;
  const step = module.steps.find((s) => !stepDone(s, progress))!;
  return { module, step, done: module.steps.filter((s) => stepDone(s, progress)).length };
}
