import { useEffect, useState } from 'react';
import type { EndgameSummary } from '@sq/shared';
import { api } from '../lib/api';
import { startEndgame } from '../lib/endgame';
import { useSession } from '../lib/session';
import { SIDE } from './labels';
import { Button } from '../ui/Button';
import { LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconPlay } from '../ui/icons';

/**
 * Finales contre le bot : positions de référence à jouer contre Stockfish à pleine force, en
 * partie d'entraînement non classée. Une finale est réussie dès que le résultat attendu a été
 * obtenu une fois.
 */
export function Endgames() {
  const user = useSession((s) => s.user);
  const [endgames, setEndgames] = useState<EndgameSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (user) void api.endgames().then((r) => setEndgames(r?.endgames ?? []));
  }, [user]);
  if (!user) {
    return <LoginRequired title="Finales" text="Connecte-toi pour suivre ta progression." />;
  }
  if (endgames === null) return <Loading label="Chargement des finales…" />;
  const passed = endgames.filter((e) => e.passed).length;
  const play = async (id: string) => {
    setBusy(id);
    setError(false);
    if (!(await startEndgame(id))) {
      setError(true);
      setBusy(null);
    }
  };
  return (
    <div className="page">
      <div className="panel page-panel">
        <a href="#/lessons" className="back-link">
          ← Leçons
        </a>
        <h2>Finales contre le bot</h2>
        <p className="muted">
          {passed} finale{passed > 1 ? 's' : ''} réussie{passed > 1 ? 's' : ''} sur{' '}
          {endgames.length}. Le bot joue à pleine force ; indices et reprises de coups restent
          disponibles.
        </p>
        {error && (
          <p className="error" role="alert">
            Impossible de lancer la finale. Réessaie dans un instant.
          </p>
        )}
        <div className="lesson-list">
          {endgames.map((e, i) => (
            <div key={e.id} className="lesson-card endgame-card" data-testid={`endgame-${e.id}`}>
              <span className="lesson-number">{i + 1}</span>
              <span className="lesson-body">
                <strong>{e.title}</strong>
                <span className="muted">
                  Avec les {SIDE[e.color]} · {e.goal === 'win' ? 'Gagner' : 'Tenir la nulle'} ·{' '}
                  {e.objective}
                </span>
                {e.lesson && (
                  <a href={`#/lessons/${e.lesson}`} className="muted">
                    Revoir la leçon
                  </a>
                )}
              </span>
              <span className={`lesson-status${e.passed ? ' win' : ''}`}>
                {e.passed
                  ? '✓ Réussie'
                  : e.attempts > 0
                    ? `${e.attempts} essai${e.attempts > 1 ? 's' : ''}`
                    : ''}
              </span>
              <Button
                size="s"
                variant={e.passed ? 'secondary' : 'primary'}
                disabled={busy !== null}
                onClick={() => void play(e.id)}
                data-testid={`endgame-play-${e.id}`}
              >
                <IconPlay size={16} />
                Jouer
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
