import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App (squelette)', () => {
  it('affiche le titre', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Secret Queen Chess' })).toBeTruthy();
  });
});
