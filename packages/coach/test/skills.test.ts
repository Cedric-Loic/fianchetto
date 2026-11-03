import { describe, expect, it } from 'vitest';
import {
  computeSkills,
  newCardSchedule,
  nextCardSchedule,
  skillForKind,
  skillForTheme,
  weakestSkill,
} from '../src/index.js';

const NOW = Date.UTC(2026, 9, 26);
const DAY = 86_400_000;

describe('compétences', () => {
  it('sans preuve : niveau inconnu', () => {
    const forks = computeSkills([], NOW).find((s) => s.id === 'forks')!;
    expect(forks.level).toBeNull();
    expect(forks.trend).toBeNull();
  });

  it('les succès montent le niveau, les échecs le baissent', () => {
    const good = Array.from({ length: 10 }, () => ({
      skill: 'forks' as const,
      success: true,
      at: NOW,
    }));
    const bad = Array.from({ length: 10 }, () => ({
      skill: 'forks' as const,
      success: false,
      at: NOW,
    }));
    expect(computeSkills(good, NOW).find((s) => s.id === 'forks')!.level).toBeGreaterThan(80);
    expect(computeSkills(bad, NOW).find((s) => s.id === 'forks')!.level).toBeLessThan(20);
  });

  it('les vieilles preuves pèsent moins que les récentes', () => {
    const old = [
      ...Array.from({ length: 5 }, () => ({
        skill: 'forks' as const,
        success: false,
        at: NOW - 120 * DAY,
      })),
      ...Array.from({ length: 5 }, () => ({ skill: 'forks' as const, success: true, at: NOW })),
    ];
    expect(computeSkills(old, NOW).find((s) => s.id === 'forks')!.level).toBeGreaterThan(70);
  });

  it('la tendance compare à il y a deux semaines', () => {
    const ev = [
      ...Array.from({ length: 6 }, () => ({
        skill: 'mates' as const,
        success: false,
        at: NOW - 20 * DAY,
      })),
      ...Array.from({ length: 6 }, () => ({ skill: 'mates' as const, success: true, at: NOW })),
    ];
    expect(computeSkills(ev, NOW).find((s) => s.id === 'mates')!.trend).toBeGreaterThan(0);
  });

  it('correspondances thème / erreur', () => {
    expect(skillForTheme('fork')).toBe('forks');
    expect(skillForTheme('inconnu')).toBe('calculation');
    expect(skillForKind('hanging-piece')).toBe('piece-safety');
    expect(skillForKind('autre')).toBe('method');
  });

  it('weakestSkill choisit la plus faible, ou une non mesurée si les mesurées vont bien', () => {
    const ev = [
      ...Array.from({ length: 8 }, () => ({ skill: 'forks' as const, success: false, at: NOW })),
      ...Array.from({ length: 8 }, () => ({ skill: 'mates' as const, success: true, at: NOW })),
    ];
    const skills = computeSkills(ev, NOW);
    expect(weakestSkill(skills, ['forks', 'mates'])).toBe('forks');
    expect(weakestSkill(skills, ['mates', 'plans'])).toBe('plans');
    expect(weakestSkill(skills, [])).toBeNull();
  });
});

describe('cartes de révision', () => {
  it('une carte neuve revient demain', () => {
    expect(newCardSchedule(NOW).dueAt).toBe(NOW + DAY);
  });

  it('les succès espacent, maîtrise au 3e', () => {
    let s = newCardSchedule(NOW);
    s = nextCardSchedule(s.step, true, NOW);
    expect(s.dueAt).toBe(NOW + 3 * DAY);
    expect(s.mastered).toBe(false);
    s = nextCardSchedule(s.step, true, NOW);
    s = nextCardSchedule(s.step, true, NOW);
    expect(s.mastered).toBe(true);
    expect(s.dueAt).toBe(NOW + 21 * DAY);
  });

  it('un échec renvoie à demain et retire la maîtrise', () => {
    const s = nextCardSchedule(4, false, NOW);
    expect(s).toEqual({ step: 0, dueAt: NOW + DAY, mastered: false });
  });
});
