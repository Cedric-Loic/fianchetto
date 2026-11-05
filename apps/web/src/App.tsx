import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react';
import { connect, disconnect } from './lib/net';
import { useSession } from './lib/session';
import { useGame } from './lib/store';
import { Calc } from './screens/Calc';
import { Exam } from './screens/Exam';
import { Endgames } from './screens/Endgames';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Learn } from './screens/Learn';
import { Openings } from './screens/Openings';
import { Login } from './screens/Login';
import { LessonPage, Lessons } from './screens/Lessons';
import { Profile } from './screens/Profile';
import { Progress } from './screens/Progress';
import { Reviews } from './screens/Reviews';
import { Puzzles } from './screens/Puzzles';
import { Selection } from './screens/Selection';
import { Today } from './screens/Today';
import { Train } from './screens/Train';
import { NavBar, type NavSection } from './ui/NavBar';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import { Loading } from './ui/Spinner';

// Revue et échiquier d'analyse chargés à la demande : chess.js (exploration de variantes sur
// des positions publiques) n'est jamais dans le code de l'écran de partie.
const Analyse = lazy(() => import('./screens/Analyse').then((m) => ({ default: m.Analyse })));
const Review = lazy(() => import('./screens/Review').then((m) => ({ default: m.Review })));

type Route =
  | { page: 'home' }
  | { page: 'login' }
  | { page: 'leaderboard' }
  | { page: 'profile'; username: string }
  | { page: 'analyse'; tab: 'import' | 'board'; fen: string | null }
  | { page: 'puzzles'; mode?: 'theme' | 'review' | 'mine'; theme?: string }
  | { page: 'today' }
  | { page: 'coach' }
  | { page: 'learn'; module: string | null }
  | { page: 'train' }
  | { page: 'calc' }
  | { page: 'progress' }
  | { page: 'lessons' }
  | { page: 'endgames' }
  | { page: 'openings' }
  | { page: 'reviews' }
  | { page: 'exam'; stage: number; kind: 'stage' | 'mini' }
  | { page: 'lesson'; id: string; exercise: number | null }
  | { page: 'review'; id: string; guided: boolean }
  | { page: 'game'; gameId: string };

/** Routage par l'URL (`#/game/<id>`, `#/profile/<pseudo>`…) : survit au rafraîchissement. */
function parseHash(h: string): Route {
  let m = /^#\/game\/([\w-]+)$/.exec(h);
  if (m?.[1]) return { page: 'game', gameId: m[1] };
  m = /^#\/profile\/([\w-]+)$/.exec(h);
  if (m?.[1]) return { page: 'profile', username: m[1] };
  // Revue, éventuellement lancée directement en mode guidé (#/review/<id>/guided).
  m = /^#\/review\/([\w-]+)(\/guided)?$/.exec(h);
  if (m?.[1]) return { page: 'review', id: m[1], guided: m[2] !== undefined };
  if (h === '#/analyse') return { page: 'analyse', tab: 'import', fen: null };
  // Échiquier d'analyse, éventuellement sur une position : #/analyse/board?fen=<FEN encodée>.
  m = /^#\/analyse\/board(?:\?fen=(.*))?$/.exec(h);
  if (m) {
    let fen: string | null;
    try {
      fen = m[1] ? decodeURIComponent(m[1]) : null;
    } catch {
      fen = null;
    }
    return { page: 'analyse', tab: 'board', fen };
  }
  if (h === '#/puzzles') return { page: 'puzzles' };
  // Ancienne adresse du coach : redirigée vers « Aujourd'hui » (voir App).
  if (h === '#/coach') return { page: 'coach' };
  if (h === '#/today') return { page: 'today' };
  if (h === '#/train') return { page: 'train' };
  if (h === '#/calc') return { page: 'calc' };
  if (h === '#/progress') return { page: 'progress' };
  // Parcours, éventuellement sur un module : #/learn?module=<id>.
  m = /^#\/learn(?:\?module=([\w-]+))?$/.exec(h);
  if (m) return { page: 'learn', module: m[1] ?? null };
  // « Mes parties » : même page que l'ancienne Analyse.
  if (h === '#/games') return { page: 'analyse', tab: 'import', fen: null };
  // Liens du coach : #/puzzles/theme/fork, #/puzzles/review, #/puzzles/mine.
  m = /^#\/puzzles\/theme\/([A-Za-z0-9]+)$/.exec(h);
  if (m?.[1]) return { page: 'puzzles', mode: 'theme', theme: m[1] };
  if (h === '#/puzzles/review') return { page: 'puzzles', mode: 'review' };
  if (h === '#/puzzles/mine') return { page: 'puzzles', mode: 'mine' };
  if (h === '#/lessons') return { page: 'lessons' };
  if (h === '#/endgames') return { page: 'endgames' };
  if (h === '#/openings') return { page: 'openings' };
  if (h === '#/reviews') return { page: 'reviews' };
  // #/lessons/<id>?exercise=n : un seul exercice (révisions), retour à #/reviews ensuite.
  m = /^#\/lessons\/([\w-]+)(?:\?exercise=(\d+))?$/.exec(h);
  if (m?.[1]) return { page: 'lesson', id: m[1], exercise: m[2] ? Number(m[2]) : null };
  // Examen de palier (#/exam/1) ou mini-test de finales (#/exam/1/mini).
  m = /^#\/exam\/([123])(\/mini)?$/.exec(h);
  if (m?.[1]) return { page: 'exam', stage: Number(m[1]), kind: m[2] ? 'mini' : 'stage' };
  if (h === '#/login') return { page: 'login' };
  if (h === '#/leaderboard') return { page: 'leaderboard' };
  return { page: 'home' };
}

/** Rubrique de la barre de navigation correspondant à la page (la rubrique parente). */
function sectionOf(route: Route): NavSection {
  switch (route.page) {
    case 'today':
    case 'coach':
      return 'today';
    case 'home':
    case 'game':
      return 'play';
    case 'learn':
    case 'lessons':
    case 'lesson':
    case 'exam':
    case 'endgames':
    case 'openings':
      return 'learn';
    case 'train':
    case 'calc':
    case 'puzzles':
    case 'reviews':
      return 'train';
    case 'analyse':
    case 'review':
      return 'games';
    case 'progress':
    case 'leaderboard':
      return 'progress';
    case 'login':
      return 'login';
    case 'profile':
      return null;
  }
}

/** Attente de la partie : si elle est introuvable ou tarde trop, on le dit et on propose de sortir. */
function GameLoading() {
  const missing = useGame((s) => s.gameMissing);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (!missing && !slow) return <Loading label="Connexion…" />;
  return (
    <div className="page">
      <div className="panel page-panel" data-testid="game-missing">
        <EmptyState
          icon="♟"
          title={missing ? 'Partie introuvable' : 'Connexion au serveur lente'}
          action={
            <Button variant="primary" href="#/">
              Retour à l'accueil
            </Button>
          }
        >
          {missing
            ? "Cette partie n'existe plus ou n'est pas la tienne (le lien date peut-être d'avant un redémarrage du serveur)."
            : 'Le serveur ne répond pas encore. Vérifie que « pnpm dev » tourne, puis recharge la page.'}
        </EmptyState>
      </div>
    </div>
  );
}

/** Titre de la page : alimente l'onglet du navigateur et le titre de niveau 1 (lecteurs d'écran). */
function titleOf(route: Route): string {
  switch (route.page) {
    case 'home':
      return 'Jouer';
    case 'game':
      return 'Partie';
    case 'login':
      return 'Connexion';
    case 'leaderboard':
      return 'Classement';
    case 'profile':
      return `Profil de ${route.username}`;
    case 'analyse':
      return route.tab === 'board' ? "Échiquier d'analyse" : 'Mes parties';
    case 'puzzles':
      return 'Puzzles';
    case 'today':
    case 'coach':
      return "Aujourd'hui";
    case 'learn':
      return 'Apprendre';
    case 'train':
      return "S'entraîner";
    case 'calc':
      return 'Calcul';
    case 'progress':
      return 'Progrès';
    case 'lessons':
    case 'lesson':
      return 'Leçons';
    case 'endgames':
      return 'Finales';
    case 'openings':
      return 'Ouvertures';
    case 'reviews':
      return 'Révisions';
    case 'exam':
      return route.kind === 'mini' ? 'Mini-test de finales' : `Examen du palier ${route.stage}`;
    case 'review':
      return 'Revue de partie';
  }
}

export function App() {
  const [hash, setHash] = useState(() => location.hash);
  const route = parseHash(hash);
  const state = useGame((s) => s.state);
  const focus = useGame((s) => s.focus);
  const refresh = useSession((s) => s.refresh);
  const gameId = route.page === 'game' ? route.gameId : null;

  useEffect(() => {
    void refresh();
    const onHash = () => setHash(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [refresh]);

  const title = titleOf(route);
  useEffect(() => {
    document.title = `${title} · Fianchetto`;
  }, [title]);

  // #/coach n'existe plus : redirection vers « Aujourd'hui ».
  const redirect = route.page === 'coach';
  useEffect(() => {
    if (redirect) location.replace('#/today');
  }, [redirect]);

  useEffect(() => {
    useGame.getState().reset();
    if (gameId) connect(gameId);
    else disconnect();
  }, [gameId]);

  // Revanche : on suit la nouvelle partie.
  const next = state?.rematch.nextGameId;
  useEffect(() => {
    if (next) location.hash = `#/game/${next}`;
  }, [next]);

  // Fin d'une partie classée : on rafraîchit l'Elo affiché.
  const ended = state?.phase === 'ended';
  useEffect(() => {
    if (ended) void refresh();
  }, [ended, refresh]);

  let content;
  if (route.page === 'login') content = <Login onDone={() => (location.hash = '#/')} />;
  else if (route.page === 'leaderboard') content = <Leaderboard />;
  else if (route.page === 'profile') content = <Profile username={route.username} />;
  else if (route.page === 'analyse') content = <Analyse tab={route.tab} fen={route.fen} />;
  else if (route.page === 'puzzles') {
    content = (
      <Puzzles key={hash} initialMode={route.mode ?? 'rated'} initialTheme={route.theme ?? null} />
    );
  } else if (route.page === 'today' || route.page === 'coach') content = <Today />;
  else if (route.page === 'progress') content = <Progress />;
  else if (route.page === 'learn') content = <Learn module={route.module} />;
  else if (route.page === 'train') content = <Train />;
  else if (route.page === 'calc') content = <Calc />;
  else if (route.page === 'reviews') content = <Reviews />;
  else if (route.page === 'lessons') content = <Lessons />;
  else if (route.page === 'endgames') content = <Endgames />;
  else if (route.page === 'openings') content = <Openings />;
  else if (route.page === 'exam')
    content = <Exam key={hash} stage={route.stage} kind={route.kind} />;
  else if (route.page === 'lesson')
    content = <LessonPage key={hash} id={route.id} only={route.exercise} />;
  else if (route.page === 'review')
    content = <Review key={hash} id={route.id} guided={route.guided} />;
  else if (route.page === 'home') {
    content = <Home key={hash} onStart={(id) => (location.hash = `#/game/${id}`)} />;
  } else if (!state) content = <GameLoading />;
  else if (state.phase === 'secret-selection') {
    // Clé : un nouveau chooser (ou un nouvel écran de passage) repart d'un choix vide.
    const key = `${state.selection?.chooser}-${state.selection?.handoffPending}`;
    content = <Selection key={key} state={state} />;
  } else content = <GameScreen state={state} onLeave={() => (location.hash = '#/')} />;

  // Lien d'évitement : le routage par l'URL interdit un simple `href="#main"`, on déplace le focus.
  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('main')?.focus();
  };

  return (
    <>
      <a href="#main" className="skip-link" onClick={skip}>
        Aller au contenu
      </a>
      {/* Mode concentration : pas de barre de navigation, l'échiquier seul. */}
      {!(focus && route.page === 'game') && <NavBar section={sectionOf(route)} hash={hash} />}
      <main id="main" tabIndex={-1}>
        {/* Titre de niveau 1 des pages qui n'ont pas de grand titre visible (l'accueil a le sien). */}
        {route.page !== 'home' && <h1 className="sr-only">{title}</h1>}
        <Suspense fallback={<Loading label="Chargement…" />}>{content}</Suspense>
      </main>
    </>
  );
}
