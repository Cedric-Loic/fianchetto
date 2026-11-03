import { ServerMessageSchema, type ClientMessage } from '@sq/shared';
import { useGame } from './store';

/*
 * Connexion WebSocket de la partie en cours. Un message envoyé pendant que le socket n'est pas
 * ouvert (connexion initiale, reconnexion) est mis en file et part à l'ouverture, juste après
 * le `join`. S'il n'a pas pu partir au bout de `SEND_TIMEOUT_MS`, il est abandonné : l'affichage
 * optimiste est annulé et un message clair est affiché (voir `useGame.sendFailed`).
 */

export const SEND_TIMEOUT_MS = 5000;
export const RECONNECT_DELAY_MS = 1000;

interface Queued {
  message: ClientMessage;
  timer: ReturnType<typeof setTimeout>;
}

let socket: WebSocket | null = null;
let currentGame: string | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let queue: Queued[] = [];

function clearQueue(): void {
  for (const item of queue) clearTimeout(item.timer);
  queue = [];
}

/** Envoie sur le socket ouvert ; `false` si l'envoi a échoué. */
function rawSend(ws: WebSocket, message: ClientMessage): boolean {
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

function flush(ws: WebSocket): void {
  const pending = queue;
  queue = [];
  for (const item of pending) {
    clearTimeout(item.timer);
    if (!rawSend(ws, item.message)) useGame.getState().sendFailed(item.message.type === 'move');
  }
}

/** Ouvre (ou rouvre) la connexion et rejoint la partie. Reconnexion automatique. */
export function connect(gameId: string): void {
  // Les messages en attente visaient une autre partie : on les oublie.
  if (currentGame !== gameId) clearQueue();
  currentGame = gameId;
  if (retry) clearTimeout(retry);
  retry = null;
  socket?.close();
  const ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
  );
  socket = ws;
  ws.onopen = () => {
    if (socket !== ws) return;
    rawSend(ws, { type: 'join', gameId });
    flush(ws);
  };
  ws.onmessage = (event: MessageEvent<string>) => {
    let json: unknown;
    try {
      json = JSON.parse(event.data);
    } catch {
      return;
    }
    const parsed = ServerMessageSchema.safeParse(json);
    if (parsed.success) useGame.getState().receive(parsed.data);
  };
  ws.onclose = () => {
    if (socket === ws && currentGame === gameId) {
      retry = setTimeout(() => connect(gameId), RECONNECT_DELAY_MS);
    }
  };
}

export function disconnect(): void {
  currentGame = null;
  if (retry) clearTimeout(retry);
  retry = null;
  clearQueue();
  socket?.close();
  socket = null;
}

/** Envoie un message, ou le met en file jusqu'à l'ouverture du socket (avec délai maximal). */
export function send(message: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    flush(socket);
    if (rawSend(socket, message)) return;
  }
  const item: Queued = {
    message,
    timer: setTimeout(() => {
      queue = queue.filter((q) => q !== item);
      useGame.getState().sendFailed(message.type === 'move');
    }, SEND_TIMEOUT_MS),
  };
  queue.push(item);
}
