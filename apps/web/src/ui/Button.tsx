import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
export type ButtonSize = 's' | 'm' | 'l';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Toute la largeur disponible. */
  block?: boolean;
  /** Bouton de choix (cadence, niveau, couleur…) : état « sélectionné » (aria-pressed). */
  pressed?: boolean;
  className?: string;
  children?: ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type AsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };

export type ButtonProps = AsButton | AsLink;

/** Classes CSS d'un bouton. */
function buttonClass(p: CommonProps): string {
  return [
    'btn',
    `btn-${p.variant ?? 'secondary'}`,
    `btn-${p.size ?? 'm'}`,
    p.block ? 'btn-block' : '',
    p.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Bouton commun : primaire, secondaire, contour or, discret, lien ou danger, en trois tailles. Avec `href`,
 * il est rendu comme un lien `<a>` (navigation par le hash, téléchargement…).
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, block, pressed, className, children, ...rest } = props;
    const cls = buttonClass({ variant, size, block, className });
    return (
      <a {...rest} className={cls} aria-current={pressed ? 'true' : rest['aria-current']}>
        {children}
      </a>
    );
  }
  const { variant, size, block, pressed, className, children, type, ...rest } = props;
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      aria-pressed={pressed ?? rest['aria-pressed']}
      className={buttonClass({ variant, size, block, className })}
    >
      {children}
    </button>
  );
}
