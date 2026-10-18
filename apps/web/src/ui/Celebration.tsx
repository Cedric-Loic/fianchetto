import { useEffect, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '../lib/motion';

const COUNT = 56;
const COLORS = ['var(--accent)', 'var(--accent-hover)', 'var(--highlight)', 'var(--text)'];

/** Pseudo-hasard déterministe (rendu pur) : valeur dans [0, 1[ pour l'éclat `i`. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Célébration de victoire : éclats or projetés depuis le haut de l'écran, environ 2 s, puis plus
 * rien. Purement décoratif ; aucun rendu si le système demande de limiter les animations.
 */
export function Celebration() {
  const [on, setOn] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setOn(false), 2600);
    return () => clearTimeout(id);
  }, [on]);
  if (!on) return null;
  return (
    <div className="celebration" aria-hidden="true" data-testid="celebration">
      {Array.from({ length: COUNT }, (_, i) => (
        <span
          key={i}
          className={`confetti${i % 3 === 0 ? ' round' : ''}`}
          style={
            {
              '--x': `${rand(i, 1) * 100}vw`,
              '--dx': `${(rand(i, 2) - 0.5) * 30}vw`,
              '--r': `${(rand(i, 3) - 0.5) * 1440}deg`,
              '--delay': `${rand(i, 4) * 0.45}s`,
              '--dur': `${1.5 + rand(i, 5) * 0.6}s`,
              '--size': `${6 + rand(i, 6) * 7}px`,
              '--c': COLORS[i % COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
