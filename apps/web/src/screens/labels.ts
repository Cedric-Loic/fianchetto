import type { Color, GameResult, Variant } from '@sq/shared';

export const SIDE: Record<Color, string> = { w: 'Blancs', b: 'Noirs' };

export const VARIANT_LABEL: Record<Variant, string> = {
  classic: 'Classique',
  'secret-queen': 'Secret Queen',
};

export const REASONS: Record<GameResult['reason'], string> = {
  checkmate: 'par échec et mat',
  resignation: 'par abandon',
  timeout: 'au temps',
  stalemate: 'par pat',
  'insufficient-material': 'par manque de matériel',
  'timeout-vs-insufficient-material': 'temps écoulé, matériel insuffisant',
  'fifty-move-rule': 'par la règle des 50 coups',
  'threefold-repetition': 'par triple répétition',
  agreement: 'par accord mutuel',
};

export const REASON_SHORT: Record<GameResult['reason'], string> = {
  checkmate: 'mat',
  resignation: 'abandon',
  timeout: 'temps',
  stalemate: 'pat',
  'insufficient-material': 'matériel',
  'timeout-vs-insufficient-material': 'temps/matériel',
  'fifty-move-rule': '50 coups',
  'threefold-repetition': 'répétition',
  agreement: 'accord',
};
