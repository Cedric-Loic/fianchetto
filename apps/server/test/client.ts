import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import type { ServerMessage, ViewerGameState } from '@sq/shared';
import { startServer, type ServerOptions } from '../src/app.js';

/** Serveur de test + client HTTP/WebSocket avec cookie de session. */
export async function testServer(options: ServerOptions = {}) {
  const app = await startServer(0, { logLevel: 'silent', dbPath: ':memory:', ...options });
  const base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  let cookie = '';
  const http = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`http://${base}${path}`, {
      method,
      headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0] ?? '';
    return { status: res.status, json: await res.json() };
  };
  const ws = async () => {
    const socket = new WebSocket(`ws://${base}/ws`, { headers: { cookie } });
    const inbox: ServerMessage[] = [];
    let latest: ViewerGameState | null = null;
    const waiters: (() => void)[] = [];
    socket.on('message', (d: Buffer) => {
      const msg = JSON.parse(d.toString()) as ServerMessage;
      inbox.push(msg);
      if (msg.type === 'snapshot') latest = msg.state;
      for (const w of waiters.splice(0)) w();
    });
    await new Promise((r) => socket.once('open', r));
    /** Attend qu'une condition sur le dernier état soit vraie. */
    const until = async (pred: (s: ViewerGameState) => boolean, timeoutMs = 60_000) => {
      const end = Date.now() + timeoutMs;
      while (!(latest && pred(latest))) {
        if (Date.now() > end) throw new Error('délai dépassé');
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 200);
        });
      }
      return latest;
    };
    const send = (msg: object) => socket.send(JSON.stringify(msg));
    return { socket, inbox, until, send, state: () => latest };
  };
  return { app, http, ws };
}
