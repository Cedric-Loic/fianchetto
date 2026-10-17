import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage, ViewerGameState } from '@sq/shared';
import { startServer } from '../src/app.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Ouvre une connexion, envoie une suite de messages, renvoie le dernier snapshot reçu. */
async function session(port: number, messages: object[]): Promise<ViewerGameState> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((r) => ws.once('open', r));
  let last: ViewerGameState | null = null;
  for (const msg of messages) {
    ws.send(JSON.stringify(msg));
    const reply = await new Promise<ServerMessage>((resolve) =>
      ws.once('message', (d: Buffer) => resolve(JSON.parse(d.toString()) as ServerMessage)),
    );
    if (reply.type === 'snapshot') last = reply.state;
  }
  ws.close();
  if (!last) throw new Error('aucun snapshot');
  return last;
}

describe('persistance SQLite', () => {
  it('une partie en cours reprend après un redémarrage du serveur', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sq-'));
    dirs.push(dir);
    const dbPath = join(dir, 'test.db');

    let app = await startServer(0, { logLevel: 'silent', dbPath });
    let port = (app.server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/games`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'hotseat',
        timeControl: 'blitz-5+0',
        whiteName: 'A',
        blackName: 'B',
      }),
    });
    const { gameId } = (await res.json()) as { gameId: string };
    const before = await session(port, [
      { type: 'join', gameId },
      { type: 'start-selection' },
      { type: 'lock-secret', square: 'e2' },
      { type: 'start-selection' },
      { type: 'lock-secret', square: 'd7' },
      { type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } },
    ]);
    await app.close();

    app = await startServer(0, { logLevel: 'silent', dbPath });
    port = (app.server.address() as AddressInfo).port;
    const after = await session(port, [{ type: 'join', gameId }]);
    expect(after.phase).toBe('playing');
    expect(after.board?.moves).toEqual(before.board?.moves);
    expect(after.board?.pieces).toEqual(before.board?.pieces);
    expect(after.clock?.remainingMs.w).toBeGreaterThan(290_000);

    // La partie continue, secrets compris (la dame secrète noire en d7 joue en diagonale).
    const next = await session(port, [
      { type: 'join', gameId },
      { type: 'move', clientMoveId: '2', move: { from: 'd7', to: 'a4' } },
    ]);
    expect(next.board?.moves.at(-1)?.san).toBe('d7-a4');
    await app.close();
  });
});
