import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage, ViewerGameState } from '@sq/shared';
import { startServer } from '../src/app.js';

type App = Awaited<ReturnType<typeof startServer>>;
let app: App | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

/** Client de test : envoie des messages et attend le prochain snapshot ou refus. */
async function connect() {
  app = await startServer(0, { logLevel: 'silent', dbPath: ':memory:' });
  const { port } = app.server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'hotseat',
      timeControl: 'untimed',
      whiteName: 'A',
      blackName: 'B',
    }),
  });
  const { gameId } = (await res.json()) as { gameId: string };
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox: ServerMessage[] = [];
  const raw: string[] = [];
  const waiters: ((m: ServerMessage) => void)[] = [];
  ws.on('message', (data: Buffer) => {
    raw.push(data.toString());
    const msg = JSON.parse(data.toString()) as ServerMessage;
    const w = waiters.shift();
    if (w) w(msg);
    else inbox.push(msg);
  });
  await new Promise((r) => ws.once('open', r));
  const next = () =>
    new Promise<ServerMessage>((resolve) => {
      const m = inbox.shift();
      if (m) resolve(m);
      else waiters.push(resolve);
    });
  const call = async (msg: object) => {
    ws.send(JSON.stringify(msg));
    return next();
  };
  const state = (m: ServerMessage): ViewerGameState => {
    if (m.type !== 'snapshot') throw new Error(`attendu snapshot, reçu ${m.type}`);
    return m.state;
  };
  return { ws, gameId, call, state, raw };
}

describe('partie hot-seat de bout en bout', () => {
  it('choix séquentiels, refus sans motif, révélation à la fin seulement', async () => {
    const { ws, gameId, call, state, raw } = await connect();
    let s = state(await call({ type: 'join', gameId }));
    expect(s.phase).toBe('secret-selection');
    expect(s.selection).toMatchObject({ chooser: 'w', handoffPending: true });

    s = state(await call({ type: 'start-selection' }));
    expect(s.selection?.remainingMs).toBeGreaterThan(0);
    s = state(await call({ type: 'lock-secret', square: 'e2' }));
    expect(s.selection).toMatchObject({ chooser: 'b', handoffPending: true, ready: { w: true } });
    await call({ type: 'start-selection' });
    s = state(await call({ type: 'lock-secret', square: 'd7' }));
    expect(s.phase).toBe('playing');
    expect(s.board?.ownSecret).toBeNull();

    // La dame secrète blanche (e2) avance comme un pion : notation de pion.
    s = state(await call({ type: 'move', clientMoveId: 'm1', move: { from: 'e2', to: 'e4' } }));
    expect(s.board?.moves.at(-1)?.san).toBe('e4');
    // Coup illégal : refus sans motif.
    expect(
      await call({ type: 'move', clientMoveId: 'm2', move: { from: 'a7', to: 'a3' } }),
    ).toEqual({ type: 'move-rejected', clientMoveId: 'm2' });

    // Bouton hot-seat : case du camp au trait (Noirs : d7).
    expect(await call({ type: 'peek-secret' })).toEqual({
      type: 'secret-peek',
      color: 'b',
      square: 'd7',
    });

    // Avant la fin, aucun message n'a contenu de type réel « q » ailleurs qu'en d1/d8.
    for (const msg of raw.filter((r) => !r.includes('secret-peek'))) {
      const parsed = JSON.parse(msg) as ServerMessage;
      if (parsed.type !== 'snapshot' || !parsed.state.board) continue;
      expect(parsed.state.board.reveal).toBeNull();
      const queens = parsed.state.board.pieces.filter((p) => p.type === 'q').map((p) => p.square);
      expect(queens.sort()).toEqual(['d1', 'd8']);
    }

    s = state(await call({ type: 'resign' }));
    expect(s.phase).toBe('ended');
    expect(s.board?.result).toEqual({ winner: 'w', reason: 'resignation' });
    expect(s.board?.reveal?.secrets.w.initialSquare).toBe('e2');
    expect(s.board?.reveal?.secrets.b.initialSquare).toBe('d7');
    ws.close();
  });
});
