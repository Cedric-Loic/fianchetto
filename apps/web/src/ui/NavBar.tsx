import { useEffect, useRef, useState } from 'react';
import type { UserPublic } from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { SettingsMenu, SettingsPanel } from '../game/SettingsMenu';
import { Logo } from './Logo';
import { IconLogout, IconMenu, IconSettings, IconUser } from './icons';

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
          {user ? (
            <AccountMenu
              user={user}
              current={hash === `#/profile/${user.username}`}
              onNavigate={close}
              onLogout={() => void api.logout().then(() => setUser(null))}
            />
          ) : (
            <>
              <SettingsMenu />
              <a
                href="#/login"
                className="nav-link"
                aria-current={current('login')}
                onClick={close}
              >
                Connexion
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * Menu du compte : avatar et pseudo ; au clic, profil, réglages et déconnexion. Se referme au
 * clic ailleurs et sur Échap.
 */
function AccountMenu(props: {
  user: UserPublic;
  current: boolean;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState<'menu' | 'settings' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { username } = props.user;

  useEffect(() => {
    if (open !== 'menu') return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-button"
        aria-haspopup="menu"
        aria-expanded={open === 'menu'}
        data-testid="nav-user"
        onClick={() => setOpen(open === 'menu' ? null : 'menu')}
      >
        <span className="account-avatar" aria-hidden="true">
          {username.slice(0, 1)}
        </span>
        {username}
      </button>
      {open === 'menu' && (
        <div className="account-dropdown" role="menu" aria-label="Compte">
          <span className="account-name">
            Connecté : <strong>{username}</strong>
          </span>
          <a
            role="menuitem"
            href={`#/profile/${username}`}
            className="account-item"
            aria-current={props.current ? 'page' : undefined}
            data-testid="nav-profile"
            onClick={() => {
              setOpen(null);
              props.onNavigate();
            }}
          >
            <IconUser size={18} />
            Mon profil
          </a>
          <button
            type="button"
            role="menuitem"
            className="account-item"
            data-testid="settings"
            onClick={() => setOpen('settings')}
          >
            <IconSettings size={18} />
            Réglages
          </button>
          <button
            type="button"
            role="menuitem"
            className="account-item"
            data-testid="logout"
            onClick={() => {
              setOpen(null);
              props.onLogout();
            }}
          >
            <IconLogout size={18} />
            Déconnexion
          </button>
        </div>
      )}
      {open === 'settings' && <SettingsPanel onClose={() => setOpen(null)} />}
    </div>
  );
}
