import { useEffect, useState } from 'react';
import { VARIANTS, type LeaderboardResponse, type Variant } from '@sq/shared';
import { api } from '../lib/api';
import { VARIANT_LABEL } from './labels';

/** Classement local des comptes, un par variante. */
export function Leaderboard() {
  const [variant, setVariant] = useState<Variant>('classic');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  useEffect(() => {
    void api.leaderboard(variant).then(setData);
  }, [variant]);
  // Réponse d'une autre variante (changement d'onglet en cours) : rien à afficher.
  const entries = data?.variant === variant ? data.entries : [];
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Classement</h2>
        <div className="tabs" role="tablist">
          {VARIANTS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={v === variant}
              className={v === variant ? 'tc selected' : 'tc'}
              onClick={() => setVariant(v)}
            >
              {VARIANT_LABEL[v]}
            </button>
          ))}
        </div>
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
              <tr key={e.username}>
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
    </div>
  );
}
