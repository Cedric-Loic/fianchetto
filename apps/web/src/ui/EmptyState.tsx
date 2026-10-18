import type { ReactNode } from 'react';
import { Button } from './Button';

/** État vide : icône, titre, texte et action facultatifs. */
export function EmptyState(props: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="empty-state" data-testid={props.testId}>
      {props.icon && (
        <div className="empty-icon" aria-hidden="true">
          {props.icon}
        </div>
      )}
      <p className="empty-title">{props.title}</p>
      {props.children && <div className="empty-text">{props.children}</div>}
      {props.action && <div className="empty-action">{props.action}</div>}
    </div>
  );
}

/** Page réservée aux comptes : invitation à se connecter. */
export function LoginRequired({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>{title}</h2>
        <EmptyState
          icon="♟"
          title="Connexion requise"
          action={
            <Button variant="primary" href="#/login">
              Se connecter
            </Button>
          }
        >
          {text}
        </EmptyState>
      </div>
    </div>
  );
}
