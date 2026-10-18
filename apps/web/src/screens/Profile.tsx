import { useEffect, useState } from 'react';
import { VARIANTS, type ProfileResponse } from '@sq/shared';
import { api } from '../lib/api';
import { REASON_SHORT, VARIANT_LABEL } from './labels';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';

const classedGames = (n: number) => (n <= 1 ? `${n} partie classée` : `${n} parties classées`);

/** Profil : Elo de chaque variante et historique des parties. */
export function Profile({ username }: { username: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null | undefined>(undefined);
  useEffect(() => {
    void api.profile(username).then(setProfile);
  }, [username]);

  if (profile === undefined) return <Loading label="Chargement du profil…" />;
  if (profile === null) {
    return (
      <div className="page">
        <div className="panel page-panel">
          <EmptyState
            icon="?"
            title="Profil introuvable"
            action={<Button href="#/leaderboard">Voir le classement</Button>}
          >
            Aucun compte ne porte le pseudo « {username} ».
          </EmptyState>
        </div>
      </div>
    );
  }
  const { user, history } = profile;
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>{user.username}</h2>
        <div className="ratings">
          {VARIANTS.map((v) => (
            <p key={v} className="big-rating" data-testid={`rating-${v}`}>
              {VARIANT_LABEL[v]} <strong>{user.ratings[v].rating}</strong>{' '}
              <span className="muted">· {classedGames(user.ratings[v].gamesPlayed)}</span>
            </p>
          ))}
        </div>
        <h3>Historique</h3>
        {history.length === 0 ? (
          <EmptyState
            icon="♙"
            title="Aucune partie pour l'instant"
            action={
              <Button variant="primary" href="#/">
                Jouer une partie
              </Button>
            }
          >
            Les parties terminées apparaissent ici, avec leur revue.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Variante</th>
                  <th>Adversaire</th>
                  <th>Résultat</th>
                  <th>Cadence</th>
                  <th>Elo</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((g) => {
                  const outcome =
                    g.winner === null ? 'Nulle' : g.winner === g.color ? 'Victoire' : 'Défaite';
                  const delta =
                    g.ratingAfter !== null && g.ratingBefore !== null
                      ? g.ratingAfter - g.ratingBefore
                      : null;
                  return (
                    <tr key={g.gameId}>
                      <td>{VARIANT_LABEL[g.variant]}</td>
                      <td>
                        {g.opponentName}{' '}
                        {g.mode === 'hotseat' && <span className="muted">(à deux)</span>}
                      </td>
                      <td
                        className={
                          outcome === 'Victoire' ? 'win' : outcome === 'Défaite' ? 'loss' : ''
                        }
                      >
                        {outcome}{' '}
                        <span className="muted">{g.reason ? REASON_SHORT[g.reason] : ''}</span>
                      </td>
                      <td>{g.timeControl}</td>
                      <td>
                        {g.ratingAfter ?? '—'}
                        {delta !== null && (
                          <span className={delta >= 0 ? 'win' : 'loss'}>
                            {' '}
                            ({delta >= 0 ? '+' : ''}
                            {delta})
                          </span>
                        )}
                      </td>
                      <td className="muted">
                        {g.endedAt ? new Date(g.endedAt).toLocaleDateString('fr-FR') : ''}
                      </td>
                      <td>
                        <a href={`#/review/${g.gameId}`} title="Revue de la partie">
                          📊 Revue
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
