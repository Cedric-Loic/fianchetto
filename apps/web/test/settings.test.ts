import { afterEach, describe, expect, it } from 'vitest';
import { BOARD_THEMES, boardTheme, loadSettings } from '../src/lib/settings';

afterEach(() => localStorage.clear());

describe('réglages : thème d’échiquier', () => {
  it('« marine » est le thème par défaut et « vert » n’existe plus', () => {
    expect(Object.keys(BOARD_THEMES)).toContain('marine');
    expect(Object.keys(BOARD_THEMES)).not.toContain('vert');
    expect(loadSettings().board).toBe('marine');
  });

  it('migre un réglage enregistré « vert » vers « marine » sans toucher au reste', () => {
    localStorage.setItem('sq-settings', JSON.stringify({ board: 'vert', sound: false }));
    const settings = loadSettings();
    expect(settings.board).toBe('marine');
    expect(settings.sound).toBe(false);
  });

  it('remplace une valeur inconnue ou invalide par « marine » et garde un thème connu', () => {
    expect(boardTheme('rose')).toBe('marine');
    expect(boardTheme('toString')).toBe('marine');
    expect(boardTheme(42)).toBe('marine');
    expect(boardTheme('bois')).toBe('bois');
  });
});
