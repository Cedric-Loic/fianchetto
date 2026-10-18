import { useEffect, useState } from 'react';
import { AnalysisEventSchema, type AnalysisEvent, type EngineLine } from '@sq/shared';

/*
 * Moteur en direct : flux SSE `GET /api/analysis/stream?fen=…&multipv=3`. Lu avec fetch (et non
 * EventSource) pour connaître le statut HTTP (401, 400, 503) et pour ne jamais se reconnecter
 * tout seul. Une seule recherche à la fois : le flux est fermé à chaque changement de position
 * (après un anti-rebond de 150 ms), à l'arrêt du moteur et au démontage.
 *
 * Option « Menace » : le serveur n'exécute qu'une recherche à la fois (une nouvelle demande
 * arrête la précédente), donc les deux flux ne peuvent pas tourner ensemble. On calcule d'abord
 * la menace (même position, l'autre camp au trait), brièvement et à profondeur limitée, puis on
 * ferme ce flux et on lance l'analyse principale.
 */

export type EngineStatus = 'off' | 'loading' | 'running' | 'done' | 'error';

export interface EngineState {
  status: EngineStatus;
  lines: EngineLine[];
  depth: number;
  /** Message discret en cas d'indisponibilité. */
  message: string | null;
  /** Option « Menace » : meilleur coup de l'adversaire s'il jouait maintenant (sinon `null`). */
  threat: EngineLine | null;
}

const OFF: EngineState = { status: 'off', lines: [], depth: 0, message: null, threat: null };
const LOADING: EngineState = { ...OFF, status: 'loading' };
export const ENGINE_DEBOUNCE_MS = 150;
/**
 * Recherche de la menace : arrêtée à cette profondeur, ou `THREAT_MAX_MS` après sa première
 * ligne, ou au plus tard après `THREAT_START_MS` (démarrage à froid du moteur compris).
 */
export const THREAT_DEPTH = 10;
export const THREAT_MAX_MS = 1500;
export const THREAT_START_MS = 5000;

/**
 * Même position, l'autre camp au trait, case en passant effacée : son meilleur coup est la
 * « menace ». À n'utiliser que si le camp au trait n'est pas en échec (position sinon illégale).
 */
export function threatFen(fen: string): string {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4) return fen;
  fields[1] = fields[1] === 'b' ? 'w' : 'b';
  fields[3] = '-';
  return fields.join(' ');
}

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

/**
 * Menace : flux court (une ligne) sur la position à trait inversé. Se résout dès que la
 * profondeur `THREAT_DEPTH` est atteinte, à la fin du flux, à l'expiration des délais, ou si
 * `signal` est interrompu ; le flux est alors fermé (le serveur arrête cette recherche).
 */
function searchThreat(
  fen: string,
  signal: AbortSignal,
  onLine: (line: EngineLine) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const own = new AbortController();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(limit);
      clearTimeout(short);
      signal.removeEventListener('abort', finish);
      own.abort();
      resolve();
    };
    const limit = setTimeout(finish, THREAT_START_MS);
    let short: ReturnType<typeof setTimeout> | undefined;
    signal.addEventListener('abort', finish);
    stream(fen, 1, own.signal, (event) => {
      if (finished) return;
      if (event.type !== 'lines') return finish();
      const line = event.lines[0];
      if (line) onLine(line);
      short ??= setTimeout(finish, THREAT_MAX_MS);
      if ((line?.depth ?? 0) >= THREAT_DEPTH) finish();
    }).catch(finish);
  });
}

/**
 * Lignes du moteur pour `fen` ; `enabled = false` (ou `fen = null`) : moteur coupé.
 * `threat` : calcule aussi la menace (le camp au trait ne doit pas être en échec).
 */
export function useEngine(
  fen: string | null,
  enabled: boolean,
  multipv = 3,
  threat = false,
): EngineState {
  const key = enabled && fen ? `${threat ? 'T' : 'N'}${fen}` : null;
  const [result, setResult] = useState<(EngineState & { key: string }) | null>(null);

  useEffect(() => {
    if (!key) return;
    const position = key.slice(1);
    const withThreat = key.startsWith('T');
    const controller = new AbortController();
    let state: EngineState = LOADING;
    const update = (patch: Partial<EngineState>) => {
      state = { ...state, ...patch };
      setResult({ ...state, key });
    };
    const main = () =>
      stream(position, multipv, controller.signal, (event) => {
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
    const timer = setTimeout(() => {
      void (async () => {
        if (withThreat) {
          await searchThreat(threatFen(position), controller.signal, (line) => {
            if (!controller.signal.aborted) update({ threat: line });
          });
        }
        if (!controller.signal.aborted) await main();
      })();
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
