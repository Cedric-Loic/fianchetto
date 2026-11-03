import type { Color, ReviewMove } from '@sq/shared';
import { formatDuration, timeSpentSummary, type TimeSpentOptions } from './timeSpent';

/**
 * Carte « Temps de réflexion » de la revue (étape 2) : temps moyen par coup, erreurs contre autres
 * coups, et un message simple. Rien si les pendules sont absentes ou si mon camp est inconnu.
 */
export function TimeSpentCard(props: {
  moves: readonly ReviewMove[];
  clocks: readonly (number | null)[] | null | undefined;
  userColor: Color | null;
  options?: TimeSpentOptions;
}) {
  const summary = timeSpentSummary(props.moves, props.clocks, props.userColor, props.options);
  if (!summary) return null;
  const { errors, others } = summary;
  return (
    <div className="move-card time-spent" data-testid="time-spent">
      <p>
        <strong>Temps de réflexion</strong>
      </p>
      <p className="time-spent-row">
        <span>Temps moyen par coup</span>
        <strong data-testid="time-average">{formatDuration(summary.averageMs)}</strong>
      </p>
      <p className="time-spent-row">
        <span>Sur mes erreurs ({errors?.count ?? 0})</span>
        <strong data-testid="time-errors">{errors ? formatDuration(errors.averageMs) : '—'}</strong>
      </p>
      <p className="time-spent-row">
        <span>Sur les autres coups ({others?.count ?? 0})</span>
        <strong data-testid="time-others">{others ? formatDuration(others.averageMs) : '—'}</strong>
      </p>
      <p data-testid="time-message">{summary.message}</p>
    </div>
  );
}
