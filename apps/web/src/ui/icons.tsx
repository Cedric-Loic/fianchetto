import type { ReactNode } from 'react';

/** Icônes originales (traits simples, couleur du texte), décoratives. */
function Icon({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Ampoule : entraînement, indices. */
export function IconBulb({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
    </Icon>
  );
}

/** Pièce de puzzle : puzzles tactiques. */
export function IconPuzzle({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z" />
    </Icon>
  );
}

/** Livre ouvert : leçons. */
export function IconBook({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z" />
      <path d="M12 6v13" />
    </Icon>
  );
}

/** Courbe : analyse de parties. */
export function IconChart({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-4 3 3 5-6" />
    </Icon>
  );
}

/** Cible : objectif du coach. */
export function IconTarget({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </Icon>
  );
}

/** Trois traits (menu) ou croix (fermer). */
export function IconMenu({ open, size }: { open: boolean; size?: number }) {
  return (
    <Icon size={size}>
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </Icon>
  );
}
