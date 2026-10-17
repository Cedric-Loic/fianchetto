import { ServerMessageSchema, type ClientMessage } from '@sq/shared';
import { useGame } from './store';

let socket: WebSocket | null = null;
let currentGame: string | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

/** Ouvre (ou rouvre) la connexion et rejoint la partie. Reconnexion automatique. */
export function connect(gameId: string): void {
  currentGame = gameId;
  if (retry) clearTimeout(retry);
  socket?.close();
  const ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
  );
  socket = ws;
  ws.onopen = () => send({ type: 'join', gameId });
  ws.onmessage = (event: MessageEvent<string>) => {
    const parsed = ServerMessageSchema.safeParse(JSON.parse(event.data));
    if (parsed.success) useGame.getState().receive(parsed.data);
  };
  ws.onclose = () => {
    if (socket === ws && currentGame === gameId) retry = setTimeout(() => connect(gameId), 1000);
  };
}

export function disconnect(): void {
  currentGame = null;
  socket?.close();
  socket = null;
}

export function send(message: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
