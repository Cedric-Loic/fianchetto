/** Barre de progression accessible (meter) : `done` sur `total`. */
export function ProgressBar({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  return (
    <span
      className="progress"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <span className="progress-bar" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </span>
  );
}
