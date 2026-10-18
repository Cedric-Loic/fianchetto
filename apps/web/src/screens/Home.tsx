import { useEffect, useState, type ReactNode } from 'react';
import {
  TIME_CONTROLS,
  TIME_CONTROL_IDS,
  type BotLevelInfo,
  type CoachDashboard,
  type TimeControlId,
  type Variant,
} from '@sq/shared';
import { api, summarizePgn, type PgnSummary } from '../lib/api';
import { useSession } from '../lib/session';
import { DEFAULT_LAST_PLAY, pieceUrl, useSettings, type LastPlay } from '../lib/settings';
import { Button } from '../ui/Button';
import {
  IconBook,
  IconBulb,
  IconChart,
  IconPlay,
  IconPuzzle,
  IconTarget,
  IconUser,
} from '../ui/icons';
import { Logo } from '../ui/Logo';
import { Tabs } from '../ui/Tabs';
import { VARIANT_LABEL } from './labels';
import { Onboarding } from './Onboarding';
import { onboardingWanted } from '../lib/onboarding';

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

/**
 * Carte « Partie en cours » : adversaire, variante et nombre de coups joués, lus dans le PGN
 * public de la partie ; à défaut, simple invitation à reprendre.
 */
function ResumeCard(props: { gameId: string; username: string; onResume: () => void }) {
  const [summary, setSummary] = useState<PgnSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api.gamePgn(props.gameId).then((pgn) => {
      if (!cancelled && pgn) setSummary(summarizePgn(pgn));
    });
    return () => {
      cancelled = true;
    };
  }, [props.gameId]);
  const opponent = !summary
    ? null
    : summary.white === props.username
      ? summary.black
      : summary.black === props.username
        ? summary.white
        : `${summary.white} – ${summary.black}`;
  const moves = summary ? Math.ceil(summary.plies / 2) : 0;
  return (
    <section className="panel banner resume" data-testid="resume-card" aria-label="Partie en cours">
      <span className="banner-icon">
        <IconUser size={28} />
      </span>
      <span className="banner-body">
        <span className="banner-title">Partie en cours</span>
        {opponent ? (
          <>
            <span className="resume-opponent" data-testid="resume-opponent">
              contre {opponent}
            </span>
            <span className="resume-meta">
              <span>{summary && VARIANT_LABEL[summary.variant]}</span>
              <span data-testid="resume-moves">
                {moves === 0
                  ? 'Aucun coup joué'
                  : `${moves} coup${moves > 1 ? 's' : ''} joué${moves > 1 ? 's' : ''}`}
              </span>
            </span>
          </>
        ) : (
          <span>Une partie t'attend.</span>
        )}
      </span>
      <Button variant="primary" onClick={props.onResume}>
        <IconPlay size={18} />
        Reprendre
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
const COLOR_LABEL = { w: 'avec les Blancs', b: 'avec les Noirs', random: 'couleur au hasard' };

/** Salutation selon l'heure. */
function greeting(name: string | null): string {
  const hour = new Date().getHours();
  const hello = hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
  return `${hello}${name ? ` ${name}` : ''}, prêt pour une partie ?`;
}

/**
 * Accueil : bouton « Jouer » qui relance la dernière configuration, puis choix du mode
 * (Classique, Secret Queen, Entraînement), partie contre le bot (classée, ou entraînement) ou à
 * deux sur cet écran ; tâche du coach et accès rapides. Premier lancement guidé si besoin.
 */
export function Home({ onStart }: { onStart: (gameId: string) => void }) {
  const user = useSession((s) => s.user);
  const pieceSet = useSettings((s) => s.pieces);
  const updateSettings = useSettings((s) => s.update);
  const [onboarding, setOnboarding] = useState(() =>
    onboardingWanted(useSettings.getState().onboarded),
  );
  // Dernière configuration jouée (ou choisie au premier lancement) : valeurs de départ.
  const [initial] = useState<LastPlay>(() => useSettings.getState().lastPlay ?? DEFAULT_LAST_PLAY);
  const [variant, setVariant] = useState<Variant>(initial.variant);
  const [trainingChoice, setTraining] = useState(initial.training);
  // Entraînement : variante classique seulement.
  const training = trainingChoice && variant === 'classic';
  const mode: Mode = training ? 'training' : variant;
  const [levels, setLevels] = useState<BotLevelInfo[]>([]);
  const [level, setLevel] = useState(initial.level);
  const [color, setColor] = useState<'w' | 'b' | 'random'>(initial.color);
  const [botTc, setBotTc] = useState<TimeControlId>(initial.timeControl);
  const [white, setWhite] = useState('Joueur 1');
  const [black, setBlack] = useState('Joueur 2');
  const [seatTc, setSeatTc] = useState<TimeControlId>(initial.timeControl);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.botLevels().then((l) => setLevels(l ?? []));
  }, []);
  useEffect(() => {
    if (user) void api.activeGame().then((a) => setActive(a?.gameId ?? null));
  }, [user]);

  /** Crée la partie et mémorise sa configuration pour le bouton « Jouer ». */
  const launch = async (play: LastPlay) => {
    setError(null);
    updateSettings({ lastPlay: play });
    const res = await api.createGame(
      play.mode === 'bot'
        ? {
            mode: 'bot',
            variant: play.variant,
            level: play.level,
            color: play.color,
            timeControl: play.training ? 'untimed' : play.timeControl,
            ...(play.training ? { training: true } : {}),
          }
        : {
            mode: 'hotseat',
            variant: play.variant,
            timeControl: play.timeControl,
            whiteName: white.trim() || 'Joueur 1',
            blackName: black.trim() || 'Joueur 2',
          },
    );
    if (!res) return setError('Impossible de créer la partie.');
    onStart(res.gameId);
  };

  // Bouton « Jouer » : la dernière configuration ; sans compte, une partie contre le bot
  // devient une partie à deux sur cet écran (même variante et cadence).
  const remembered = useSettings((s) => s.lastPlay) ?? DEFAULT_LAST_PLAY;
  const quick: LastPlay =
    remembered.mode === 'bot' && !user
      ? { ...remembered, mode: 'hotseat', training: false }
      : remembered;
  const quickLevel = levels.find((l) => l.level === quick.level);
  const quickSummary =
    quick.mode === 'bot'
      ? [
          quick.training ? 'Entraînement' : VARIANT_LABEL[quick.variant],
          `contre ${quickLevel ? `${quickLevel.name} (${quickLevel.elo})` : `le bot niveau ${quick.level}`}`,
          COLOR_LABEL[quick.color],
          quick.training ? 'sans pendule' : TIME_CONTROLS[quick.timeControl].label,
        ].join(' · ')
      : [
          VARIANT_LABEL[quick.variant],
          'à deux sur cet écran',
          TIME_CONTROLS[quick.timeControl].label,
        ].join(' · ');

  const chooseMode = (m: Mode) => {
    setVariant(m === 'training' ? 'classic' : m);
    setTraining(m === 'training');
  };

  return (
    <div className="home">
      <header className="home-hero">
        <Logo size={36} />
        <h1>Fianchetto</h1>
        <p className="tagline" data-testid="greeting">
          {greeting(user?.username ?? null)}
        </p>
      </header>

      <section className="panel quick-play" aria-label="Partie rapide">
        <Button
          variant="primary"
          size="l"
          className="quick-play-button"
          data-testid="quick-play"
          onClick={() => void launch(quick)}
        >
          <IconPlay size={22} />
          Jouer
        </Button>
        <span className="quick-play-summary" data-testid="quick-play-summary">
          {quickSummary}
        </span>
      </section>

      {active && user && (
        <ResumeCard
          key={active}
          gameId={active}
          username={user.username}
          onResume={() => onStart(active)}
        />
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
                  void launch({ mode: 'bot', variant, training, level, color, timeControl: botTc })
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
              void launch({
                mode: 'hotseat',
                variant,
                training: false,
                level,
                color,
                timeControl: seatTc,
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
      {onboarding && (
        <Onboarding
          onDone={() => {
            // Le guide a pu régler le niveau du bot et la cadence : on les reprend.
            const play = useSettings.getState().lastPlay ?? DEFAULT_LAST_PLAY;
            setLevel(play.level);
            setBotTc(play.timeControl);
            setSeatTc(play.timeControl);
            setOnboarding(false);
          }}
        />
      )}

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
