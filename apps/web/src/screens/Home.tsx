import { useEffect, useState, type ReactNode } from 'react';
import {
  TIME_CONTROLS,
  TIME_CONTROL_IDS,
  type BotLevelInfo,
  type CoachDashboard,
  type TimeControlId,
  type Variant,
} from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { pieceUrl, useSettings } from '../lib/settings';
import { Button } from '../ui/Button';
import { IconBook, IconBulb, IconChart, IconPuzzle, IconTarget } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { Tabs } from '../ui/Tabs';
import { VARIANT_LABEL } from './labels';

/** Mode choisi sur l'accueil : une variante, ou l'entraînement (classique contre le bot). */
type Mode = Variant | 'training';

function TimeControls(props: { value: TimeControlId; onChange: (id: TimeControlId) => void }) {
  return (
    <div className="time-controls">
      {TIME_CONTROL_IDS.map((id) => (
        <Button key={id} pressed={id === props.value} onClick={() => props.onChange(id)}>
          {TIME_CONTROLS[id].label}
        </Button>
      ))}
    </div>
  );
}

/** Carte d'un mode : icône, nom, description. */
function ModeLabel(props: { icon: ReactNode; title: string; text: string }) {
  return (
    <>
      <span className="mode-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="mode-text">
        <strong>{props.title}</strong>
        <span>{props.text}</span>
      </span>
    </>
  );
}

/**
 * Bandeau du coach : première tâche de la semaine pas encore faite, sinon première
 * recommandation. Rien tant que le tableau de bord n'est pas chargé.
 */
function CoachBanner() {
  const [data, setData] = useState<CoachDashboard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api.dashboard().then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!data) return null;
  const task = data.week.tasks.find((t) => t.done < t.target);
  const reco = data.recommendations[0];
  if (!task && !reco) return null;
  return (
    <section className="panel banner" data-testid="coach-banner" aria-label="Coach">
      <span className="banner-icon">
        <IconTarget size={28} />
      </span>
      <div className="banner-body">
        <span className="banner-title">Coach : ta tâche du jour</span>
        {task ? (
          <>
            <strong>{task.label}</strong>
            <span className="muted">
              {task.done} / {task.target} cette semaine
            </span>
            <span className="progress">
              <span
                className="progress-bar"
                style={{ width: `${Math.min(100, (task.done / task.target) * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <strong>{reco?.text}</strong>
        )}
      </div>
      <Button variant="primary" href={task?.href ?? reco?.href ?? '#/coach'}>
        Y aller
      </Button>
    </section>
  );
}

/** Accès rapides vers les écrans de progression. */
const QUICK_LINKS = [
  {
    title: 'Puzzles',
    text: 'Des positions tactiques à ton niveau, et tes erreurs à réviser.',
    href: '#/puzzles',
    action: 'Résoudre',
    icon: <IconPuzzle />,
  },
  {
    title: 'Leçons',
    text: 'Le programme du coach, phase par phase, avec exercices.',
    href: '#/lessons',
    action: 'Apprendre',
    icon: <IconBook />,
  },
  {
    title: 'Analyse',
    text: 'Importe tes parties chess.com ou PGN et trouve tes erreurs.',
    href: '#/analyse',
    action: 'Importer mes parties',
    icon: <IconChart />,
  },
];

/**
 * Accueil : choix du mode (Classique, Secret Queen, Entraînement), puis partie contre le bot
 * (classée, ou entraînement) ou à deux sur cet écran ; tâche du coach et accès rapides.
 */
export function Home({ onStart }: { onStart: (gameId: string) => void }) {
  const user = useSession((s) => s.user);
  const pieceSet = useSettings((s) => s.pieces);
  const [variant, setVariant] = useState<Variant>('classic');
  const [trainingChoice, setTraining] = useState(false);
  // Entraînement : variante classique seulement.
  const training = trainingChoice && variant === 'classic';
  const mode: Mode = training ? 'training' : variant;
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

  const chooseMode = (m: Mode) => {
    setVariant(m === 'training' ? 'classic' : m);
    setTraining(m === 'training');
  };

  return (
    <div className="home">
      <header className="home-hero">
        <Logo size={88} />
        <h1>Fianchetto</h1>
        <p className="tagline">Ta plateforme d'échecs personnelle.</p>
      </header>

      {active && (
        <div className="panel banner resume">
          <span className="banner-body">
            <span className="banner-title">Partie en cours</span>
            <span>Une partie t'attend.</span>
          </span>
          <Button variant="primary" onClick={() => onStart(active)}>
            Reprendre
          </Button>
        </div>
      )}
      {user && <CoachBanner key={user.username} />}

      <Tabs<Mode>
        variant="cards"
        label="Mode de jeu"
        value={mode}
        onChange={chooseMode}
        items={[
          {
            id: 'classic',
            testId: 'variant-classic',
            label: (
              <ModeLabel
                icon={<img src={pieceUrl(pieceSet, 'w', 'n')} alt="" />}
                title={VARIANT_LABEL.classic}
                text="Les échecs, tout simplement."
              />
            ),
          },
          {
            id: 'secret-queen',
            testId: 'variant-secret-queen',
            label: (
              <ModeLabel
                icon={
                  <>
                    <img src={pieceUrl(pieceSet, 'w', 'p')} alt="" />
                    <span className="mode-mark">♛</span>
                  </>
                }
                title={VARIANT_LABEL['secret-queen']}
                text="Un de vos pions est une dame. Personne ne sait lequel."
              />
            ),
          },
          {
            id: 'training',
            testId: 'mode-training',
            label: (
              <ModeLabel
                icon={<IconBulb size={30} />}
                title="Entraînement"
                text="Contre le bot avec le coach : indices, garde-fou, reprises."
              />
            ),
          },
        ]}
      />

      <div className="home-cards">
        <div className="panel home-panel">
          <h2>Contre le bot</h2>
          {!user ? (
            <>
              <p className="muted">Partie classée : connecte-toi pour suivre ton Elo.</p>
              <Button variant="primary" href="#/login">
                Se connecter
              </Button>
            </>
          ) : (
            <>
              <p className="muted" data-testid="my-rating">
                Ton Elo {VARIANT_LABEL[variant]} : <strong>{user.ratings[variant].rating}</strong>
              </p>
              <div className="levels">
                {levels.map((l) => (
                  <Button
                    key={l.level}
                    data-testid={`level-${l.level}`}
                    pressed={l.level === level}
                    onClick={() => setLevel(l.level)}
                  >
                    <strong>{l.name}</strong>
                    <span className="muted">{l.elo}</span>
                  </Button>
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
                  <Button key={c} pressed={c === color} onClick={() => setColor(c)}>
                    {label}
                  </Button>
                ))}
              </div>
              {variant === 'classic' && (
                <label className="check">
                  <input
                    type="checkbox"
                    data-testid="training-toggle"
                    checked={trainingChoice}
                    onChange={(e) => setTraining(e.target.checked)}
                  />{' '}
                  Entraînement avec le coach : indices, garde-fou, reprise de coups (sans pendule,
                  non classée)
                </label>
              )}
              {!training && <TimeControls value={botTc} onChange={setBotTc} />}
              <Button
                variant="primary"
                size="l"
                onClick={() =>
                  void create({
                    mode: 'bot',
                    variant,
                    level,
                    color,
                    timeControl: training ? 'untimed' : botTc,
                    ...(training ? { training: true } : {}),
                  })
                }
              >
                Jouer contre le bot
              </Button>
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
          <Button
            variant="primary"
            size="l"
            disabled={!white.trim() || !black.trim()}
            onClick={() =>
              void create({
                mode: 'hotseat',
                variant,
                timeControl: seatTc,
                whiteName: white,
                blackName: black,
              })
            }
          >
            Jouer
          </Button>
          <p className="muted">
            Partie non classée{training ? ', en variante classique (sans coach)' : ''}.
          </p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="quick-links" aria-labelledby="quick-links-title">
        <h2 id="quick-links-title">Pour progresser</h2>
        <div className="quick-grid">
          {QUICK_LINKS.map((q) => (
            <div key={q.href} className="panel quick-card">
              <h3>
                {q.icon}
                {q.title}
              </h3>
              <p className="muted">{q.text}</p>
              <Button size="s" href={q.href} className="stretched">
                {q.action}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
