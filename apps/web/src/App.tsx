import { useEffect, useState } from 'react';
import { connect, disconnect } from './lib/net';
import { useGame } from './lib/store';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Selection } from './screens/Selection';

/** Identifiant de partie lu dans l'URL (`#/game/<id>`) : survit au rafraîchissement. */
function gameIdFromHash(): string | null {
  const match = /^#\/game\/([\w-]+)$/.exec(location.hash);
  return match?.[1] ?? null;
}

export function App() {
  const [gameId, setGameId] = useState(gameIdFromHash);
  const state = useGame((s) => s.state);

  useEffect(() => {
    const onHash = () => setGameId(gameIdFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

  if (!gameId) {
    return <Home onStart={(id) => (location.hash = `#/game/${id}`)} />;
  }
  if (!state) return <div className="loading">Connexion…</div>;
  if (state.phase === 'secret-selection') {
    // Clé : un nouveau chooser (ou un nouvel écran de passage) repart d'un choix vide.
    const key = `${state.selection?.chooser}-${state.selection?.handoffPending}`;
    return <Selection key={key} state={state} />;
  }
  return <GameScreen state={state} onLeave={() => (location.hash = '')} />;
}
