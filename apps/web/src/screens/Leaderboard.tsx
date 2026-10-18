import { useEffect, useState } from 'react';
import { VARIANTS, type LeaderboardResponse, type Variant } from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { IconWarning } from '../ui/icons';
import { EmptyState } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { Tabs } from '../ui/Tabs';
import { VARIANT_LABEL } from './labels';

/** Classement local des comptes, un par variante. */
export function Leaderboard() {
  const user = useSession((s) => s.user);
  const [variant, setVariant] = useState<Variant>('classic');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void api.leaderboard(variant).then((res) => {
      setFailed(res === null);
      if (res) setData(res);
    });
  }, [variant]);
  // Réponse d'une autre variante (changement d'onglet en cours) : chargement.
  const entries = data?.variant === variant ? data.entries : null;
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Classement</h2>
        <Tabs
          label="Variante"
          value={variant}
          onChange={setVariant}
          items={VARIANTS.map((v) => ({ id: v, label: VARIANT_LABEL[v] }))}
        />
        {failed && entries === null ? (
          <EmptyState icon={<IconWarning size={40} />} title="Classement indisponible">
            Le serveur ne répond pas. Réessaie dans un instant.
          </EmptyState>
        ) : entries === null ? (
          <Loading inline />
        ) : entries.length === 0 ? (
          <EmptyState
            icon="♚"
            title="Personne n'est encore classé"
            testId="leaderboard-empty"
            action={
              <Button variant="primary" href={user ? '#/' : '#/login'}>
                {user ? 'Jouer une partie classée' : 'Créer un compte'}
              </Button>
            }
          >
            Le classement apparaît après la première partie classée contre le bot.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Elo</th>
                  <th>Parties</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.username} className={e.username === user?.username ? 'me' : ''}>
                    <td>{e.rank}</td>
                    <td>
                      <a href={`#/profile/${e.username}`}>{e.username}</a>
                    </td>
                    <td>
                      <strong>{e.rating}</strong>
                    </td>
                    <td>{e.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
