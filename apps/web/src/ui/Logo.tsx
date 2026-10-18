import { useId } from 'react';

/** Cases sombres du damier (grille 4 × 4 de cases de 12 px, à partir de (6, 6)). */
const DARK_SQUARES: readonly [number, number][] = [
  [18, 6],
  [42, 6],
  [6, 18],
  [30, 18],
  [18, 30],
  [42, 30],
  [6, 42],
  [30, 42],
];

export interface LogoProps {
  /** Côté de l'icône, en pixels. */
  size?: number;
  /** Icône suivie du mot « Fianchetto ». */
  withText?: boolean;
  className?: string;
}

/**
 * Logo Fianchetto : un fou sur la grande diagonale d'un coin de damier (dessin original).
 * Les couleurs suivent les jetons du thème (classes `logo-*` dans styles.css) ; les attributs
 * gardent les couleurs d'origine si la feuille de style n'est pas chargée. Décoratif : le texte
 * voisin (ou le lien qui l'entoure) porte le nom.
 */
export function Logo({ size = 32, withText = false, className }: LogoProps) {
  // Identifiant de dégradé unique : plusieurs logos peuvent cohabiter sur la page.
  const gradient = `fi-diag-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
      <defs>
        <linearGradient id={gradient} x1="1" y1="1" x2="0" y2="0">
          <stop className="logo-glow" offset="0" stopColor="#81b64c" stopOpacity="0.55" />
          <stop className="logo-glow" offset="1" stopColor="#81b64c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="logo-bg" width="64" height="64" rx="14" fill="#262421" />
      <g className="logo-squares" fill="#34312d">
        {DARK_SQUARES.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" />
        ))}
      </g>
      <path d="M6 6h12l36 36v12h-12L6 18z" fill={`url(#${gradient})`} />
      <g className="logo-piece" fill="#81b64c">
        <circle cx="41" cy="20.5" r="3.6" />
        <path d="M41 24c-5.8 5-8.8 10.2-8.8 14.8 0 2.5 1 4.4 2.7 5.6h12.2c1.7-1.2 2.7-3.1 2.7-5.6 0-4.6-3-9.8-8.8-14.8z" />
        <rect x="33.5" y="45.6" width="15" height="3" rx="1.5" />
        <rect x="30.5" y="49.6" width="21" height="4.6" rx="2.2" />
      </g>
      <path
        className="logo-cut"
        d="M44.8 29.8l-6.4 6.8"
        stroke="#262421"
        strokeWidth="2.4"
        strokeLinecap="round"
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
