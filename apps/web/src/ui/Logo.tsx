export interface LogoProps {
  /** Côté de l'icône, en pixels. */
  size?: number;
  /** Icône suivie du mot « Fianchetto ». */
  withText?: boolean;
  className?: string;
}

/**
 * Logo Fianchetto : un fou découpé par la grande diagonale, qui se prolonge hors de la pièce
 * (dessin original). Le trait de découpe a la couleur du fond de tuile. Les couleurs suivent les
 * jetons du thème (classes `logo-*` dans styles.css) ; les attributs gardent les couleurs
 * d'origine si la feuille de style n'est pas chargée. Décoratif : le texte voisin (ou le lien qui
 * l'entoure) porte le nom.
 */
export function Logo({ size = 32, withText = false, className }: LogoProps) {
  const icon = (
    <svg
      className="logo-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="logo-bg" width="64" height="64" rx="15" fill="#0b1324" />
      <g className="logo-piece" fill="#c9a55c">
        <circle cx="32" cy="12.5" r="4.2" />
        <path d="M32 17.2c-7.6 6.4-11 12.6-11 18.2 0 4 2.4 7 5.6 8.6h10.8c3.2-1.6 5.6-4.6 5.6-8.6 0-5.6-3.4-11.8-11-18.2z" />
        <rect x="23.5" y="45.6" width="17" height="3.6" rx="1.8" />
        <path d="M17.5 56.5c0-3.6 3.4-5.6 7.6-5.6h13.8c4.2 0 7.6 2 7.6 5.6z" />
      </g>
      <path
        className="logo-cut"
        d="M8 56L56 8"
        stroke="#0b1324"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        className="logo-diag"
        d="M9.5 54.5l8-8M46.5 17.5l8-8"
        stroke="#c9a55c"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
  if (!withText) return className ? <span className={className}>{icon}</span> : icon;
  return (
    <span className={`logo-lockup${className ? ` ${className}` : ''}`}>
      {icon}
      <span className="logo-word">Fianchetto</span>
    </span>
  );
}
