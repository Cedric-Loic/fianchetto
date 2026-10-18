import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { SettingsMenu } from '../game/SettingsMenu';
import { Logo } from './Logo';
import { IconMenu } from './icons';

/** Rubrique de la barre de navigation à surligner (selon la page affichée). */
export type NavSection =
  'play' | 'coach' | 'lessons' | 'puzzles' | 'analyse' | 'leaderboard' | 'login' | null;

const LINKS: { section: NavSection; href: string; label: string }[] = [
  { section: 'play', href: '#/', label: 'Jouer' },
  { section: 'coach', href: '#/coach', label: 'Coach' },
  { section: 'lessons', href: '#/lessons', label: 'Leçons' },
  { section: 'puzzles', href: '#/puzzles', label: 'Puzzles' },
  { section: 'analyse', href: '#/analyse', label: 'Analyse' },
  { section: 'leaderboard', href: '#/leaderboard', label: 'Classement' },
];

/**
 * Barre de navigation : logo, rubriques (la rubrique courante est surlignée), réglages, compte.
 * Sous 900 px, les rubriques passent dans un menu repliable (bouton à trois traits), refermé à
 * chaque changement de page.
 */
export function NavBar({ section, hash }: { section: NavSection; hash: string }) {
  const { user, setUser } = useSession();
  // Menu ouvert pour la page `hash` seulement : il se referme de lui-même au changement de page.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === hash;
  const close = () => setOpenAt(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const current = (s: NavSection) => (s === section ? 'page' : undefined);
  return (
    <nav className={`nav-bar${open ? ' open' : ''}`} aria-label="Navigation principale">
      <a href="#/" className="nav-logo" aria-label="Fianchetto, accueil" onClick={close}>
        <Logo size={30} withText />
      </a>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="nav-menu"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        data-testid="nav-toggle"
        onClick={() => setOpenAt(open ? null : hash)}
      >
        <IconMenu open={open} />
      </button>
      <div className="nav-menu" id="nav-menu">
        <div className="nav-links">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link"
              aria-current={current(l.section)}
              onClick={close}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-account">
          <SettingsMenu />
          {user ? (
            <>
              <a
                href={`#/profile/${user.username}`}
                className="nav-link"
                aria-current={hash === `#/profile/${user.username}` ? 'page' : undefined}
                data-testid="nav-user"
                onClick={close}
              >
                {user.username}
              </a>
              <button
                type="button"
                className="btn btn-link btn-s"
                onClick={() => void api.logout().then(() => setUser(null))}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <a href="#/login" className="nav-link" aria-current={current('login')} onClick={close}>
              Connexion
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
