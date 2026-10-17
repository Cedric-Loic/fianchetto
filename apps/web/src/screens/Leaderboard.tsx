import { useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@sq/shared';
import { api } from '../lib/api';

/** Classement local des comptes. */
export function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  useEffect(() => {
    void api.leaderboard().then(setData);
  }, []);
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Classement</h2>
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
            {data?.entries.map((e) => (
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
