import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale accessible : rôle `dialog`, `aria-modal`, titre relié, focus placé dans la
 * fenêtre à l'ouverture, piégé (Tab / Maj+Tab bouclent), rendu à l'élément d'origine à la
 * fermeture ; Échap et clic sur le fond appellent `onClose`.
 */
export function Dialog(props: {
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  /** Contenu avant le titre (bandeau, illustration…). */
  header?: ReactNode;
  className?: string;
  testId?: string;
  /** Élément focalisé à l'ouverture (sélecteur CSS dans la fenêtre), sinon le premier focalisable. */
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { initialFocus } = props;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    const target =
      (initialFocus ? root?.querySelector<HTMLElement>(initialFocus) : null) ??
      root?.querySelector<HTMLElement>(FOCUSABLE) ??
      root;
    target?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [initialFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Échap ferme la fenêtre seulement (pas le mode concentration derrière elle).
      e.stopPropagation();
      e.preventDefault();
      props.onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal${props.className ? ` ${props.className}` : ''}`}
        data-testid={props.testId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {props.header}
        <h2 id={titleId}>{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}
