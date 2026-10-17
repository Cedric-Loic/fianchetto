import { useEffect, useState } from 'react';
import { TIME_CONTROLS, TIME_CONTROL_IDS, type BotLevelInfo, type TimeControlId } from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

function TimeControls(props: { value: TimeControlId; onChange: (id: TimeControlId) => void }) {
  return (
    <div className="time-controls">
      {TIME_CONTROL_IDS.map((id) => (
        <button
          key={id}
          className={id === props.value ? 'tc selected' : 'tc'}
          onClick={() => props.onChange(id)}
        >
          {TIME_CONTROLS[id].label}
        </button>
      ))}
    </div>
  );
}

/** Accueil : partie contre le bot (classée) ou à deux sur cet écran. */
export function Home({ onStart }: { onStart: (gameId: string) => void }) {
  const user = useSession((s) => s.user);
  const [levels, setLevels] = useState<BotLevelInfo[]>([]);
  const [level, setLevel] = useState(3);
  const [color, setColor] = useState<'w' | 'b' | 'random'>('random');
  const [botTc, setBotTc] = useState<TimeControlId>('blitz-5+0');
  const [white, setWhite] = useState('Joueur 1');
  const [black, setBlack] = useState('Joueur 2');
  const [seatTc, setSeatTc] = useState<TimeControlId>('blitz-5+0');
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.botLevels().then((l) => setLevels(l ?? []));
  }, []);
  useEffect(() => {
    if (user) void api.activeGame().then((a) => setActive(a?.gameId ?? null));
  }, [user]);

  const create = async (body: unknown) => {
    setError(null);
    const res = await api.createGame(body);
    if (!res) return setError('Impossible de créer la partie.');
    onStart(res.gameId);
  };

  return (
    <div className="home wide">
      <h1>Fianchetto</h1>
      <p className="tagline">Secret Queen : un de vos pions est une dame. Personne ne sait lequel.</p>
      {active && (
        <div className="panel resume">
          Une partie est en cours.{' '}
          <button className="primary" onClick={() => onStart(active)}>
            Reprendre
          </button>
        </div>
      )}
      <div className="home-cards">
        <div className="panel home-panel">
          <h2>Contre le bot</h2>
          {!user ? (
            <>
              <p className="muted">Partie classée : connecte-toi pour suivre ton Elo.</p>
              <a className="button primary" href="#/login">
                Se connecter
              </a>
            </>
          ) : (
            <>
              <div className="levels">
                {levels.map((l) => (
                  <button
                    key={l.level}
                    data-testid={`level-${l.level}`}
                    className={l.level === level ? 'tc selected' : 'tc'}
                    onClick={() => setLevel(l.level)}
                  >
                    <strong>{l.name}</strong>
                    <span className="muted">{l.elo}</span>
                  </button>
                ))}
              </div>
              <div className="colors">
                {(
                  [
                    ['w', 'Blancs'],
                    ['random', 'Au hasard'],
                    ['b', 'Noirs'],
                  ] as const
                ).map(([c, label]) => (
                  <button
                    key={c}
                    className={c === color ? 'tc selected' : 'tc'}
                    onClick={() => setColor(c)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TimeControls value={botTc} onChange={setBotTc} />
              <button
                className="primary big"
                onClick={() => void create({ mode: 'bot', level, color, timeControl: botTc })}
              >
                Jouer contre le bot
              </button>
            </>
          )}
        </div>

        <div className="panel home-panel">
          <h2>À deux sur cet écran</h2>
          <label>
            Blancs
            <input value={white} maxLength={32} onChange={(e) => setWhite(e.target.value)} />
          </label>
          <label>
            Noirs
            <input value={black} maxLength={32} onChange={(e) => setBlack(e.target.value)} />
          </label>
          <TimeControls value={seatTc} onChange={setSeatTc} />
          <button
            className="primary big"
            disabled={!white.trim() || !black.trim()}
            onClick={() =>
              void create({
                mode: 'hotseat',
                timeControl: seatTc,
                whiteName: white,
                blackName: black,
              })
            }
          >
            Jouer
          </button>
          <p className="muted">Partie non classée.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
