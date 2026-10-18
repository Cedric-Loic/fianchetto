import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, reviewFailureMessage, REQUEST_TIMEOUT_MS } from '../src/lib/api';
import { pollDelay } from '../src/lib/poll';

/** `fetch` qui ne répond jamais, mais rejette quand son signal est interrompu. */
function hangingFetch() {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('renvoie les données ou le statut d’erreur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ error: 'GAME_NOT_FOUND' }, { status: 404 }))),
    );
    expect(await request('GET', '/api/x')).toEqual({
      ok: false,
      status: 404,
      error: 'GAME_NOT_FOUND',
    });
  });

  it('statut 0 sur erreur réseau', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect(await request('GET', '/api/x')).toEqual({ ok: false, status: 0, error: 'NETWORK' });
  });

  it('abandonne après le délai maximal par défaut', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const promise = request('GET', '/api/x');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    expect(await promise).toEqual({ ok: false, status: 0, error: 'TIMEOUT' });
  });

  it('respecte un délai personnalisé', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const promise = request('GET', '/api/x', undefined, { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(110);
    expect(await promise).toMatchObject({ status: 0, error: 'TIMEOUT' });
  });

  it('s’interrompt avec le signal de l’appelant', async () => {
    const fetchMock = hangingFetch();
    const controller = new AbortController();
    const promise = request('GET', '/api/x', undefined, { signal: controller.signal });
    controller.abort();
    expect(await promise).toEqual({ ok: false, status: 0, error: 'ABORTED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signal déjà interrompu : aucune requête', async () => {
    const fetchMock = hangingFetch();
    const controller = new AbortController();
    controller.abort();
    expect(await request('GET', '/api/x', undefined, { signal: controller.signal })).toMatchObject({
      status: 0,
      error: 'ABORTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('messages et interrogations', () => {
  it('distingue un serveur injoignable d’une partie introuvable', () => {
    expect(reviewFailureMessage(0)).toBe('Serveur injoignable.');
    expect(reviewFailureMessage(404)).toBe('Partie introuvable.');
    expect(reviewFailureMessage(409)).toBe("La partie n'est pas encore terminée.");
  });

  it('espace progressivement les interrogations de 700 ms à 2 s', () => {
    expect(pollDelay(0)).toBe(700);
    const delays = Array.from({ length: 10 }, (_, i) => pollDelay(i));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] as number);
    }
    expect(pollDelay(50)).toBe(2000);
  });
});
