import { useEffect, useState } from 'react';
import { AnalysisEventSchema, type AnalysisEvent, type EngineLine } from '@sq/shared';

/*
 * Moteur en direct : flux SSE `GET /api/analysis/stream?fen=…&multipv=3`. Lu avec fetch (et non
 * EventSource) pour connaître le statut HTTP (401, 400, 503) et pour ne jamais se reconnecter
 * tout seul. Une seule recherche à la fois : le flux est fermé à chaque changement de position
 * (après un anti-rebond de 150 ms), à l'arrêt du moteur et au démontage.
 */

export type EngineStatus = 'off' | 'loading' | 'running' | 'done' | 'error';

export interface EngineState {
  status: EngineStatus;
  lines: EngineLine[];
  depth: number;
  /** Message discret en cas d'indisponibilité. */
  message: string | null;
}

const OFF: EngineState = { status: 'off', lines: [], depth: 0, message: null };
const LOADING: EngineState = { status: 'loading', lines: [], depth: 0, message: null };
export const ENGINE_DEBOUNCE_MS = 150;

const HTTP_MESSAGES: Record<number, string> = {
  401: 'Connecte-toi pour utiliser le moteur.',
  400: 'Position non analysable par le moteur.',
};
const UNAVAILABLE = 'Moteur indisponible pour le moment.';

/** Découpe un flux SSE en événements `data:` (les blocs incomplets restent dans le tampon). */
export function parseSseChunk(buffer: string): { events: string[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events = blocks
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n'),
    )
    .filter((data) => data !== '');
  return { events, rest };
}

async function stream(
  fen: string,
  multipv: number,
  signal: AbortSignal,
  onEvent: (event: AnalysisEvent) => void,
): Promise<void> {
  const res = await fetch(
    `/api/analysis/stream?fen=${encodeURIComponent(fen)}&multipv=${multipv}`,
    { signal, credentials: 'same-origin', headers: { accept: 'text/event-stream' } },
  );
  if (!res.ok || !res.body) {
    onEvent({ type: 'error', error: HTTP_MESSAGES[res.status] ?? UNAVAILABLE });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;
    for (const data of parsed.events) {
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const event = AnalysisEventSchema.safeParse(json);
      if (!event.success) continue;
      // Le serveur signale une erreur par un code : message générique en français.
      onEvent(event.data.type === 'error' ? { type: 'error', error: UNAVAILABLE } : event.data);
    }
  }
  onEvent({ type: 'done', fen });
}

/** Lignes du moteur pour `fen` ; `enabled = false` (ou `fen = null`) : moteur coupé. */
export function useEngine(fen: string | null, enabled: boolean, multipv = 3): EngineState {
  const key = enabled && fen ? fen : null;
  const [result, setResult] = useState<(EngineState & { key: string }) | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let state: EngineState = LOADING;
    const update = (patch: Partial<EngineState>) => {
      state = { ...state, ...patch };
      setResult({ ...state, key });
    };
    const timer = setTimeout(() => {
      stream(key, multipv, controller.signal, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === 'lines') {
          const depth = Math.max(0, ...event.lines.map((l) => l.depth));
          update({ status: 'running', lines: event.lines, depth });
        } else if (event.type === 'done') {
          if (state.status !== 'error') update({ status: 'done' });
        } else {
          update({ status: 'error', message: event.error });
        }
      }).catch(() => {
        if (!controller.signal.aborted) update({ status: 'error', message: UNAVAILABLE });
      });
    }, ENGINE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, multipv]);

  if (!key) return OFF;
  if (!result || result.key !== key) return LOADING;
  return result;
}
