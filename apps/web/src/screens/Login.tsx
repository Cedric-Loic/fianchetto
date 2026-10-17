import { useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

/** Connexion / inscription (comptes locaux). */
export function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setUser = useSession((s) => s.setUser);

  const submit = async () => {
    setError(null);
    const user =
      mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password);
    if (!user) {
      return setError(
        mode === 'login'
          ? 'Pseudo ou mot de passe incorrect.'
          : 'Inscription impossible (pseudo déjà pris, ou : 3 à 20 caractères, mot de passe de 8 caractères minimum).',
      );
    }
    setUser(user);
    onDone();
  };

  return (
    <div className="home">
      <div className="panel home-panel">
        <h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <label>
          Pseudo
          <input
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
        </label>
        <button className="primary big" onClick={() => void submit()}>
          {mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
        {error && <p className="error">{error}</p>}
        <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );
}
