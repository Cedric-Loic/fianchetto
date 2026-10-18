import { lazy, Suspense, useEffect, useState } from 'react';
import { connect, disconnect } from './lib/net';
import { useSession } from './lib/session';
import { useGame } from './lib/store';
import { Coach } from './screens/Coach';
import { Endgames } from './screens/Endgames';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Openings } from './screens/Openings';
import { Login } from './screens/Login';
import { LessonPage, Lessons } from './screens/Lessons';
import { Profile } from './screens/Profile';
import { Puzzles } from './screens/Puzzles';
import { Selection } from './screens/Selection';
import { NavBar, type NavSection } from './ui/NavBar';
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
  | { page: 'coach' }
  | { page: 'lessons' }
  | { page: 'endgames' }
  | { page: 'openings' }
  | { page: 'lesson'; id: string }
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
  if (h === '#/coach') return { page: 'coach' };
  // Liens du coach : #/puzzles/theme/fork, #/puzzles/review, #/puzzles/mine.
  m = /^#\/puzzles\/theme\/([A-Za-z0-9]+)$/.exec(h);
  if (m?.[1]) return { page: 'puzzles', mode: 'theme', theme: m[1] };
  if (h === '#/puzzles/review') return { page: 'puzzles', mode: 'review' };
  if (h === '#/puzzles/mine') return { page: 'puzzles', mode: 'mine' };
  if (h === '#/lessons') return { page: 'lessons' };
  if (h === '#/endgames') return { page: 'endgames' };
  if (h === '#/openings') return { page: 'openings' };
  m = /^#\/lessons\/([\w-]+)$/.exec(h);
  if (m?.[1]) return { page: 'lesson', id: m[1] };
  if (h === '#/login') return { page: 'login' };
  if (h === '#/leaderboard') return { page: 'leaderboard' };
  return { page: 'home' };
}

/** Rubrique de la barre de navigation correspondant à la page. */
function sectionOf(route: Route): NavSection {
  switch (route.page) {
    case 'home':
    case 'game':
      return 'play';
    case 'lessons':
    case 'lesson':
    case 'endgames':
    case 'openings':
      return 'lessons';
    case 'analyse':
    case 'review':
      return 'analyse';
    case 'profile':
      return null;
    default:
      return route.page;
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
  } else if (route.page === 'coach') content = <Coach />;
  else if (route.page === 'lessons') content = <Lessons />;
  else if (route.page === 'endgames') content = <Endgames />;
  else if (route.page === 'openings') content = <Openings />;
  else if (route.page === 'lesson') content = <LessonPage key={route.id} id={route.id} />;
  else if (route.page === 'review')
    content = <Review key={hash} id={route.id} guided={route.guided} />;
  else if (route.page === 'home') {
    content = <Home onStart={(id) => (location.hash = `#/game/${id}`)} />;
  } else if (!state) content = <Loading label="Connexion…" />;
  else if (state.phase === 'secret-selection') {
    // Clé : un nouveau chooser (ou un nouvel écran de passage) repart d'un choix vide.
    const key = `${state.selection?.chooser}-${state.selection?.handoffPending}`;
    content = <Selection key={key} state={state} />;
  } else content = <GameScreen state={state} onLeave={() => (location.hash = '#/')} />;

  return (
    <>
      {/* Mode concentration : pas de barre de navigation, l'échiquier seul. */}
      {!(focus && route.page === 'game') && <NavBar section={sectionOf(route)} hash={hash} />}
      <Suspense fallback={<Loading label="Chargement…" />}>{content}</Suspense>
    </>
  );
}
