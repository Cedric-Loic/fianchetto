import { useState } from 'react';
import { TIME_CONTROLS, TIME_CONTROL_IDS, type TimeControlId } from '@sq/shared';

/** Accueil : nouvelle partie hot-seat (le mode bot arrive à l'étape 3). */
export function Home({ onStart }: { onStart: (gameId: string) => void }) {
  const [white, setWhite] = useState('Joueur 1');
  const [black, setBlack] = useState('Joueur 2');
  const [timeControl, setTimeControl] = useState<TimeControlId>('blitz-5+0');
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'hotseat', timeControl, whiteName: white, blackName: black }),
    });
    if (!res.ok) return setError('Impossible de créer la partie.');
    const { gameId } = (await res.json()) as { gameId: string };
    onStart(gameId);
  };

  return (
    <div className="home">
      <h1>Secret Queen Chess</h1>
      <p className="tagline">Un de vos pions est une dame. Personne ne sait lequel.</p>
      <div className="panel home-panel">
        <h2>Partie à deux sur cet écran</h2>
        <label>
          Blancs
          <input value={white} maxLength={32} onChange={(e) => setWhite(e.target.value)} />
        </label>
        <label>
          Noirs
          <input value={black} maxLength={32} onChange={(e) => setBlack(e.target.value)} />
        </label>
        <div className="time-controls">
          {TIME_CONTROL_IDS.map((id) => (
            <button
              key={id}
              className={id === timeControl ? 'tc selected' : 'tc'}
              onClick={() => setTimeControl(id)}
            >
              {TIME_CONTROLS[id].label}
            </button>
          ))}
        </div>
        <button
          className="primary big"
          disabled={!white.trim() || !black.trim()}
          onClick={() => void create()}
        >
          Jouer
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted">Contre le bot : bientôt (étape 3).</p>
      </div>
    </div>
  );
}
