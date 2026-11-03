import { useSettings } from '../lib/settings';
import { BLUNDER_CHECK, ROUTINE_QUESTIONS } from './routine';
import { Button } from '../ui/Button';
import { IconBulb } from '../ui/icons';

/**
 * Partie lente : bouton « Routine de réflexion » et, déplié, les trois questions à se poser avant
 * chaque coup. Le panneau est mémorisé ouvert ou fermé dans les réglages. Texte statique : rien
 * de la position n'y figure.
 */
export function ThinkingRoutine() {
  const open = useSettings((s) => s.routineOpen);
  const update = useSettings((s) => s.update);
  return (
    <div className="routine" data-testid="routine">
      <Button
        data-testid="routine-button"
        aria-expanded={open}
        aria-controls="routine-panel"
        title="Routine de réflexion (touche r)"
        onClick={() => update({ routineOpen: !open })}
      >
        <IconBulb size={18} />
        Routine de réflexion
      </Button>
      {open && (
        <section id="routine-panel" className="routine-panel" data-testid="routine-panel">
          <ol className="routine-steps">
            {ROUTINE_QUESTIONS.map((q) => (
              <li key={q.title} data-testid="routine-question">
                <span className="routine-q">
                  <strong>{q.title}</strong>
                  <span className="muted">{q.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="routine-check" data-testid="routine-check">
            <strong>Vérification anti-gaffe.</strong> {BLUNDER_CHECK}
          </p>
        </section>
      )}
    </div>
  );
}
