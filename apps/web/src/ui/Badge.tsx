import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'info' | 'danger';

/** Petite étiquette (variante, partie classée, entraînement…). */
export function Badge({
  tone = 'neutral',
  children,
  testId,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} data-testid={testId}>
      {children}
    </span>
  );
}
