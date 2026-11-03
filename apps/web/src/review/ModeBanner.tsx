import { useEffect, type ReactNode } from 'react';
import { IconClose } from '../ui/icons';

/**
 * Bandeau d'un mode de la revue (revue guidée, « Apprends de tes erreurs ») : titre,
 * progression, et sortie par le bouton ou la touche Échap.
 */
export function ModeBanner(props: {
  title: string;
  progress?: ReactNode;
  onExit: () => void;
  exitLabel?: string;
}) {
  const { onExit } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <div className="mode-banner" data-testid="mode-banner">
      <strong className="mode-title">{props.title}</strong>
      {props.progress !== undefined && (
        <span className="mode-progress" data-testid="mode-progress">
          {props.progress}
        </span>
      )}
      <button
        type="button"
        className="mode-exit"
        data-testid="mode-exit"
        title="Quitter (Échap)"
        onClick={onExit}
      >
        <IconClose size={16} />
        {props.exitLabel ?? 'Quitter'}
      </button>
    </div>
  );
}
