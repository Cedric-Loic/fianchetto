import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

// Pas de serveur dans les tests unitaires : toutes les requêtes échouent proprement.
vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 401 })));

describe('App', () => {
  it('affiche le titre', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Fianchetto' })).toBeTruthy();
    expect(screen.getByText('Se connecter')).toBeTruthy();
  });
});
