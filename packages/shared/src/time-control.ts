import { z } from 'zod';

/** Cadences disponibles (§2). `untimed` = partie sans pendule. */
export const TIME_CONTROL_IDS = [
  'bullet-1+0',
  'blitz-3+2',
  'blitz-5+0',
  'rapid-10+0',
  'untimed',
] as const;
export const TimeControlIdSchema = z.enum(TIME_CONTROL_IDS);
export type TimeControlId = z.infer<typeof TimeControlIdSchema>;

export interface TimeControl {
  id: TimeControlId;
  label: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'untimed';
  /** Temps initial par joueur en millisecondes, `null` pour une partie sans pendule. */
  initialMs: number | null;
  incrementMs: number;
}

export const TIME_CONTROLS: Readonly<Record<TimeControlId, TimeControl>> = {
  'bullet-1+0': {
    id: 'bullet-1+0',
    label: '1 min',
    category: 'bullet',
    initialMs: 60_000,
    incrementMs: 0,
  },
  'blitz-3+2': {
    id: 'blitz-3+2',
    label: '3 | 2',
    category: 'blitz',
    initialMs: 180_000,
    incrementMs: 2_000,
  },
  'blitz-5+0': {
    id: 'blitz-5+0',
    label: '5 min',
    category: 'blitz',
    initialMs: 300_000,
    incrementMs: 0,
  },
  'rapid-10+0': {
    id: 'rapid-10+0',
    label: '10 min',
    category: 'rapid',
    initialMs: 600_000,
    incrementMs: 0,
  },
  untimed: {
    id: 'untimed',
    label: 'Sans pendule',
    category: 'untimed',
    initialMs: null,
    incrementMs: 0,
  },
};

/** Durée du choix du pion secret (§3.9). */
export const SECRET_SELECTION_MS = 30_000;
