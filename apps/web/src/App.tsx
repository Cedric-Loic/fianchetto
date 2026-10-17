import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { connect, disconnect } from './lib/net';
import { useSession } from './lib/session';
import { useGame } from './lib/store';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Login } from './screens/Login';
import { Profile } from './screens/Profile';
import { Selection } from './screens/Selection';
import { SettingsMenu } from './game/SettingsMenu';

type Route =
  | { page: 'home' }
  | { page: 'login' }
  | { page: 'leaderboard' }
  | { page: 'profile'; username: string }
  | { page: 'game'; gameId: string };

/** Routage par l'URL (`#/game/<id>`, `#/profile/<pseudo>`…) : survit au rafraîchissement. */
function parseHash(): Route {
  const h = location.hash;
  let m = /^#\/game\/([\w-]+)$/.exec(h);
  if (m?.[1]) return { page: 'game', gameId: m[1] };
  m = /^#\/profile\/([\w-]+)$/.exec(h);
  if (m?.[1]) return { page: 'profile', username: m[1] };
  if (h === '#/login') return { page: 'login' };
  if (h === '#/leaderboard') return { page: 'leaderboard' };
  return { page: 'home' };
}

function Nav() {
  const { user, setUser } = useSession();
  return (
    <nav className="nav-bar">
      <a href="#/" className="logo">
        ♞ Fianchetto
      </a>
      <a href="#/">Jouer</a>
      <a href="#/leaderboard">Classement</a>
      <span className="spacer" />
      <SettingsMenu />
      {user ? (
        <>
          <a href={`#/profile/${user.username}`} data-testid="nav-user">
            {user.username}
          </a>
          <button className="link" onClick={() => void api.logout().then(() => setUser(null))}>
            Déconnexion
          </button>
        </>
      ) : (
        <a href="#/login">Connexion</a>
      )}
    </nav>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const state = useGame((s) => s.state);
  const focus = useGame((s) => s.focus);
  const refresh = useSession((s) => s.refresh);
  const gameId = route.page === 'game' ? route.gameId : null;

  useEffect(() => {
    void refresh();
    const onHash = () => setRoute(parseHash());
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
  else if (route.page === 'home') {
    content = <Home onStart={(id) => (location.hash = `#/game/${id}`)} />;
  } else if (!state) content = <div className="loading">Connexion…</div>;
  else if (state.phase === 'secret-selection') {
    // Clé : un nouveau chooser (ou un nouvel écran de passage) repart d'un choix vide.
    const key = `${state.selection?.chooser}-${state.selection?.handoffPending}`;
    content = <Selection key={key} state={state} />;
  } else content = <GameScreen state={state} onLeave={() => (location.hash = '#/')} />;

  return (
    <>
      {/* Mode concentration : pas de barre de navigation, l'échiquier seul. */}
      {!(focus && route.page === 'game') && <Nav />}
      {content}
    </>
  );
}
