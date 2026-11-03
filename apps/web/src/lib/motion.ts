import { useEffect, useRef, useState } from 'react';

/** L'utilisateur a demandé de limiter les animations (réglage du système). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Compteur animé : la valeur affichée glisse vers `target` (courbe adoucie, `duration` ms), en
 * partant de `from` au premier rendu puis de la dernière valeur affichée. Sans animation si le
 * système le demande.
 */
export function useCountUp(target: number, from: number = target, duration = 1200): number {
  const [value, setValue] = useState(from);
  const shown = useRef(from);
  useEffect(() => {
    const start = shown.current;
    if (start === target) return;
    const instant = prefersReducedMotion();
    const t0 = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = instant ? 1 : Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - k) ** 3;
      const v = Math.round(start + (target - start) * eased);
      shown.current = v;
      setValue(v);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
