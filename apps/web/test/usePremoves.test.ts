import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePremoves } from '../src/game/usePremoves';

const nf3 = { from: 'g1', to: 'f3' } as const;
const ng5 = { from: 'f3', to: 'g5' } as const;
const e8q = { from: 'e7', to: 'e8', promotion: 'q' } as const;

describe('usePremoves', () => {
  it('ajoute plusieurs premoves dans l’ordre, `next` est le premier', () => {
    const { result } = renderHook(() => usePremoves(0));
    expect(result.current.premoves).toEqual([]);
    expect(result.current.next).toBeUndefined();
    act(() => {
      result.current.add(nf3);
      result.current.add(ng5);
    });
    expect(result.current.premoves).toEqual([nf3, ng5]);
    expect(result.current.next).toEqual(nf3);
  });

  it('`shift` retire le premier, `clear` vide la file', () => {
    const { result } = renderHook(() => usePremoves(0));
    act(() => {
      result.current.add(nf3);
      result.current.add(ng5);
      result.current.add(e8q);
    });
    act(() => result.current.shift());
    expect(result.current.premoves).toEqual([ng5, e8q]);
    expect(result.current.next).toEqual(ng5);
    act(() => result.current.clear());
    expect(result.current.premoves).toEqual([]);
    act(() => result.current.shift());
    expect(result.current.premoves).toEqual([]);
  });

  it('un changement de la clé de refus vide la file, qui repart de zéro', () => {
    const { result, rerender } = renderHook(({ key }) => usePremoves(key), {
      initialProps: { key: 0 },
    });
    act(() => {
      result.current.add(nf3);
      result.current.add(ng5);
    });
    rerender({ key: 1 });
    expect(result.current.premoves).toEqual([]);
    expect(result.current.next).toBeUndefined();
    act(() => result.current.add(e8q));
    expect(result.current.premoves).toEqual([e8q]);
    // Revenir à l'ancienne clé ne fait pas réapparaître l'ancienne file.
    rerender({ key: 0 });
    expect(result.current.premoves).toEqual([]);
  });

  it('réglage désactivé : file vide, et oubliée quand on le réactive', () => {
    const { result, rerender } = renderHook(({ on }) => usePremoves('k', on), {
      initialProps: { on: true },
    });
    act(() => result.current.add(nf3));
    expect(result.current.premoves).toEqual([nf3]);
    rerender({ on: false });
    expect(result.current.premoves).toEqual([]);
    rerender({ on: true });
    expect(result.current.premoves).toEqual([]);
  });
});
