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

/** Roue dentée : réglages. */
export function IconSettings({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
      <circle cx="12" cy="12" r="6.6" />
    </Icon>
  );
}

/** Drapeau : abandonner. */
export function IconFlag({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2.5 4L16 12H5" />
    </Icon>
  );
}

/** Deux moitiés d'un cercle séparées : proposer la nulle. */
export function IconDraw({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M11 4a8 8 0 0 0 0 16z" />
      <path d="M13 4a8 8 0 0 1 0 16" strokeDasharray="2.4 2.4" />
    </Icon>
  );
}

/** Flèche qui revient : reprendre un coup. */
export function IconUndo({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 6L4 10l4 4" />
      <path d="M4 10h10a6 6 0 0 1 0 12h-3" />
    </Icon>
  );
}

/** Flèche circulaire : recommencer, réessayer, rejouer. */
export function IconRetry({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4v4.5h4.5" />
    </Icon>
  );
}

/** Flèche vers un plateau : télécharger. */
export function IconDownload({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </Icon>
  );
}

/** Triangle : lancer, voir la ligne, suivant. */
export function IconPlay({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
    </Icon>
  );
}

/** Chevron gauche : précédent. */
export function IconPrev({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

/** Chevron droit : suivant. */
export function IconNext({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M9 5l7 7-7 7" />
    </Icon>
  );
}

/** Chevron et butée gauche : début. */
export function IconFirst({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M17 5l-7 7 7 7M6 5v14" />
    </Icon>
  );
}

/** Chevron et butée droite : fin. */
export function IconLast({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M7 5l7 7-7 7M18 5v14" />
    </Icon>
  );
}

/** Quatre coins : plein écran (mode concentration). */
export function IconExpand({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </Icon>
  );
}

/** Deux flèches opposées : retourner le plateau. */
export function IconFlip({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 20V5M4.5 8.5L8 5l3.5 3.5" />
      <path d="M16 4v15M12.5 15.5L16 19l3.5-3.5" />
    </Icon>
  );
}

/** Croix : fermer, supprimer. */
export function IconClose({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

/** Flèche en crochet : revenir. */
export function IconBack({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </Icon>
  );
}

/** Flèche vers le haut : promouvoir une variante. */
export function IconUp({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  );
}

/** Sablier : en cours. */
export function IconHourglass({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </Icon>
  );
}

/** Triangle d'alerte. */
export function IconWarning({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 4L2.8 20h18.4z" />
      <path d="M12 10v4.5M12 17.3v.1" />
    </Icon>
  );
}

/** Silhouette : profil. */
export function IconUser({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}

/** Porte et flèche sortante : déconnexion. */
export function IconLogout({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </Icon>
  );
}

/** Coupe : victoire. */
export function IconTrophy({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </Icon>
  );
}

/** Coche : réussite. */
export function IconCheck({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

/** Flamme : série de réussites. */
export function IconFlame({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.5-5 .3 1.7 1 2.5 2 3-.6-3 .2-5.8.5-8.5z" />
    </Icon>
  );
}

/** Cadenas : verrou souple (blitz avant les puzzles du jour). */
export function IconLock({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}
