import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/ui/Button';
import { Tabs } from '../src/ui/Tabs';

function Harness() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabs
      label="Essai"
      value={value}
      onChange={setValue}
      items={[
        { id: 'a', label: 'Un' },
        { id: 'b', label: 'Deux', testId: 'tab-b' },
        { id: 'c', label: 'Trois' },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('rôles, aria-selected, clic et flèches du clavier', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Essai' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs[1]?.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(screen.getByTestId('tab-b'));
    expect(screen.getByRole('tab', { name: 'Deux' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Deux' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Trois' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Trois');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Trois' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Un' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Button', () => {
  it('bouton par défaut : type button, variante secondaire', () => {
    render(<Button>Ok</Button>);
    const b = screen.getByRole('button', { name: 'Ok' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('btn-secondary');
  });

  it('bouton de choix : aria-pressed', () => {
    render(<Button pressed>5 min</Button>);
    expect(screen.getByRole('button', { name: '5 min' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('avec href : lien <a>, variante et taille', () => {
    render(
      <Button href="#/login" variant="primary" size="l">
        Se connecter
      </Button>,
    );
    const a = screen.getByRole('link', { name: 'Se connecter' });
    expect(a.getAttribute('href')).toBe('#/login');
    expect(a.className).toContain('btn-primary');
    expect(a.className).toContain('btn-l');
  });
});
