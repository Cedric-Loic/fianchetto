import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer, type BotDriver } from '@sq/server';
import type { MoveIntent, Reveal, ServerMessage, Square, ViewerGameState } from '@sq/shared';

/*
 * Attaques au niveau du serveur (définition de « terminé », §10) :
 * - indistinguabilité des messages WebSocket envoyés à l'humain quand seul le secret du bot
 *   change (et même quand le bot essuie des refus dans un monde et pas dans l'autre) ;
 * - canari : aucune donnée réelle (FEN réelle, notation réelle) dans les messages avant la fin,
 *   ni dans les logs du serveur (niveau debug), ni hors de la colonne dédiée de la base ;
 * - reconnexion : le snapshot renvoyé à la reconnexion ne fuit rien de plus.
 */

const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

const HUMAN_MOVES: MoveIntent[] = [
  { from: 'e2', to: 'e4' },
  { from: 'd2', to: 'd4' },
  { from: 'g1', to: 'f3' },
  { from: 'f1', to: 'c4' },
];
const BOT_MOVES: MoveIntent[] = [
  { from: 'g8', to: 'f6' },
  { from: 'b8', to: 'c6' },
  { from: 'h7', to: 'h6' },
  { from: 'a7', to: 'a6' },
];

/** Faux bot scripté : son secret est imposé, et il peut tenter d'abord des coups illégaux. */
function scriptedBot(secret: Square, illegalFirst: boolean): BotDriver {
  let index = 0;
  let triedIllegal = false;
  return {
    chooseSecret: () => secret,
    chooseMove: () => {
      if (illegalFirst && !triedIllegal) {
        triedIllegal = true;
        return Promise.resolve({ from: 'e8', to: 'e6' }); // toujours illégal
      }
      triedIllegal = false;
      return Promise.resolve(BOT_MOVES[index++] ?? { from: 'a6', to: 'a5' });
    },
    shouldAcceptDraw: () => Promise.resolve(false),
    dispose: () => undefined,
  };
}

interface World {
  /** Messages bruts reçus par l'humain (y compris après reconnexion). */
  raw: string[];
  logs: string;
  reveal: Reveal;
  dbBytes: string;
}

/** Joue une partie humain (Blancs) contre un faux bot (Noirs) et collecte tout ce qui sort. */
async function playWorld(botSecret: Square, illegalFirst: boolean): Promise<World> {
  const dir = mkdtempSync(join(tmpdir(), 'sq-sec-'));
  tempDirs.push(dir);
  const dbPath = join(dir, 'game.db');
  let logs = '';
  const app = await startServer(0, {
    logLevel: 'debug',
    dbPath,
    logStream: { write: (line) => void (logs += line) },
    createBot: () => scriptedBot(botSecret, illegalFirst),
  });
  const base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const reg = await fetch(`http://${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'attaquant', password: 'motdepasse' }),
  });
  const cookie = (reg.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const created = await fetch(`http://${base}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      mode: 'bot',
      variant: 'secret-queen',
      level: 3,
      timeControl: 'untimed',
      color: 'w',
    }),
  });
  const { gameId } = (await created.json()) as { gameId: string };

  const raw: string[] = [];
  let latest: ViewerGameState | null = null;
  const open = async () => {
    const ws = new WebSocket(`ws://${base}/ws`, { headers: { cookie } });
    ws.on('message', (d: Buffer) => {
      raw.push(d.toString());
      const msg = JSON.parse(d.toString()) as ServerMessage;
      if (msg.type === 'snapshot') latest = msg.state;
    });
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ type: 'join', gameId }));
    return ws;
  };
  const until = async (pred: (s: ViewerGameState) => boolean) => {
    const end = Date.now() + 10_000;
    while (!(latest && pred(latest))) {
      if (Date.now() > end) throw new Error('délai dépassé');
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  let ws = await open();
  await until((s) => s.phase === 'secret-selection');
  ws.send(JSON.stringify({ type: 'lock-secret', square: 'a2' }));
  await until((s) => s.phase === 'playing');
  for (const [i, move] of HUMAN_MOVES.entries()) {
    ws.send(JSON.stringify({ type: 'move', clientMoveId: `m${i}`, move }));
    await until((s) => (s.board?.moves.length ?? 0) === 2 * (i + 1));
    if (i === 1) {
      // Rafraîchissement / reconnexion en pleine partie.
      ws.close();
      ws = await open();
      await until((s) => (s.board?.moves.length ?? 0) === 4);
    }
  }
  ws.send(JSON.stringify({ type: 'resign' }));
  await until((s) => s.phase === 'ended');
  ws.close();
  const reveal = (latest as ViewerGameState | null)?.board?.reveal;
  await app.close();
  if (!reveal) throw new Error('pas de révélation');
  return { raw, logs, reveal, dbBytes: readFileSync(dbPath).toString('latin1') };
}

/** Normalise ce qui varie légitimement : identifiant de partie, pendules, chronos. */
function normalize(raw: string, gameId: string): string {
  return raw
    .replaceAll(gameId, 'GAME')
    .replace(/"remainingMs":\d+/g, '"remainingMs":0')
    .replace(/"remainingMs":\{"w":\d+,"b":\d+\}/g, '"remainingMs":{}');
}

/** Messages reçus AVANT la fin de partie (la révélation, elle, diffère légitimement). */
function beforeEnd(raw: string[]): string[] {
  const cut = raw.findIndex((r) => r.includes('"phase":"ended"'));
  return cut === -1 ? raw : raw.slice(0, cut);
}

const gameIdOf = (raw: string[]) => /"gameId":"([^"]+)"/.exec(raw[0] ?? '')?.[1] ?? '';

/** Données réelles qui ne doivent jamais sortir avant la fin : FEN et notation réelles. */
function realCanaries(reveal: Reveal): string[] {
  return [reveal.realInitialFen, ...reveal.plies.map((p) => p.realFenAfter)];
}

describe('serveur : indistinguabilité et canari', () => {
  it('le secret du bot (c7 ou g7) ne change aucun message reçu par l’humain, refus compris', async () => {
    const a = await playWorld('c7', false);
    const b = await playWorld('g7', true); // monde B : le bot essuie un refus à chaque coup
    const na = beforeEnd(a.raw).map((r) => normalize(r, gameIdOf(a.raw)));
    const nb = beforeEnd(b.raw).map((r) => normalize(r, gameIdOf(b.raw)));
    expect(na.length).toBeGreaterThan(8);
    expect(nb).toEqual(na);
    // Les deux mondes diffèrent bien en vérité.
    expect(a.reveal.secrets.b.initialSquare).toBe('c7');
    expect(b.reveal.secrets.b.initialSquare).toBe('g7');
  }, 60_000);

  it('canari : aucune FEN réelle dans les messages avant la fin, ni dans les logs', async () => {
    const w = await playWorld('e7', true);
    const canaries = realCanaries(w.reveal);
    for (const msg of beforeEnd(w.raw)) {
      for (const c of canaries) expect(msg).not.toContain(c);
      expect(msg).not.toContain('"reveal":{');
      // L'humain n'apprend jamais les refus du bot.
      expect(msg).not.toContain('move-rejected');
    }
    // Les logs du serveur (niveau debug) ne contiennent ni données réelles, ni Secret masqué,
    // ni le contenu de la colonne dédiée.
    expect(w.logs.length).toBeGreaterThan(0);
    for (const c of canaries) expect(w.logs).not.toContain(c);
    expect(w.logs).not.toContain('[REDACTED]');
    expect(w.logs).not.toContain('secret_state');
    expect(w.logs).not.toContain('"selection"');
  }, 60_000);

  it('base SQLite : le secret n’est que dans la colonne dédiée (limite documentée)', async () => {
    const w = await playWorld('b7', false);
    // La colonne publique `record` ne contient aucun choix de pion ; le choix (« b7 » du bot) est
    // dans `secret_state`. On vérifie la forme JSON : "selection" n'apparaît que dans le secret.
    const records = [
      ...w.dbBytes.matchAll(
        /\{"id":"[^"]+","variant":"[^"]+",[^\n]*?"mode"[^\n]*?"startedAt":"[^"]+"\}/g,
      ),
    ];
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r[0]).not.toContain('selection');
      expect(r[0]).not.toContain('"b7"');
    }
  }, 60_000);
});
