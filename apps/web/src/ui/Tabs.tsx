import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  testId?: string;
}

/**
 * Onglets (rôle tablist / tab, aria-selected, flèches du clavier). Un seul style d'onglets dans
 * l'application ; la variante `cards` (grandes cartes, accueil) garde le même comportement.
 */
export function Tabs<T extends string>(props: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Nom accessible de la liste d'onglets. */
  label: string;
  variant?: 'tabs' | 'cards';
  className?: string;
}) {
  const { items, value, onChange } = props;
  const listRef = useRef<HTMLDivElement>(null);

  // Flèches gauche / droite, Début / Fin : onglet voisin, sélectionné et focalisé.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    const item = items[next];
    if (!item) return;
    e.preventDefault();
    onChange(item.id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  const variant = props.variant ?? 'tabs';
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={props.label}
      className={`${variant === 'cards' ? 'tab-cards' : 'tabs'}${props.className ? ` ${props.className}` : ''}`}
      onKeyDown={onKeyDown}
    >
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={t.testId}
            className={variant === 'cards' ? 'tab-card' : 'tab'}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
