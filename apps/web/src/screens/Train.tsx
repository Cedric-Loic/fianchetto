import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { IconBook, IconFlag, IconPuzzle, IconRetry, IconTarget } from '../ui/icons';

const CARDS: {
  id: string;
  title: string;
  text: string;
  href: string;
  action: string;
  icon: ReactNode;
}[] = [
  {
    id: 'puzzles',
    title: 'Puzzles',
    text: 'Des positions tactiques à ton niveau, par thème, et tes erreurs à réviser.',
    href: '#/puzzles',
    action: 'Résoudre',
    icon: <IconPuzzle />,
  },
  {
    id: 'calc',
    title: 'Calcul',
    text: 'Calcule 1 à 3 coups sans bouger les pièces, puis réponds à une question.',
    href: '#/calc',
    action: 'Calculer',
    icon: <IconTarget />,
  },
  {
    id: 'reviews',
    title: 'Révisions',
    text: 'Les cartes dues : erreurs de parties et exercices ratés, à rejouer.',
    href: '#/reviews',
    action: 'Réviser',
    icon: <IconRetry />,
  },
  {
    id: 'endgames',
    title: 'Finales contre le bot',
    text: 'Des positions de référence à jouer contre Stockfish, avec indices.',
    href: '#/endgames',
    action: 'Jouer une finale',
    icon: <IconFlag />,
  },
  {
    id: 'openings',
    title: 'Ouvertures',
    text: 'Ton répertoire en répétition espacée : rejoue tes lignes au bon moment.',
    href: '#/openings',
    action: 'Réviser mes lignes',
    icon: <IconBook />,
  },
];

/** S'entraîner : accès directs aux exercices (puzzles, révisions, finales, ouvertures). */
export function Train() {
  return (
    <div className="page" data-testid="train">
      <section className="panel page-panel">
        <h2>S'entraîner</h2>
        <p className="muted">Choisis un exercice : chaque réponse nourrit ta progression.</p>
        <div className="quick-grid">
          {CARDS.map((c) => (
            <div key={c.id} className="panel quick-card" data-testid={`train-${c.id}`}>
              <h3>
                {c.icon}
                {c.title}
              </h3>
              <p className="muted">{c.text}</p>
              <Button size="s" href={c.href} className="stretched">
                {c.action}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
