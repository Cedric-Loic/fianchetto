/** Indicateur de chargement (anneau animé). */
export function Spinner({ size = 'm' }: { size?: 's' | 'm' | 'l' }) {
  return <span className={`spinner spinner-${size}`} aria-hidden="true" />;
}

/** Chargement : page entière (centré, par défaut) ou en ligne dans un panneau. */
export function Loading({
  label = 'Chargement…',
  inline = false,
}: {
  label?: string;
  inline?: boolean;
}) {
  return (
    <div className={inline ? 'loading-inline' : 'loading'} role="status">
      <Spinner size={inline ? 's' : 'l'} />
      <span>{label}</span>
    </div>
  );
}
