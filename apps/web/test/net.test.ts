import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientMessage } from '@sq/shared';
import { connect, disconnect, send, SEND_TIMEOUT_MS } from '../src/lib/net';
import { useGame } from '../src/lib/store';

/** Faux WebSocket : le test ouvre, ferme et inspecte les messages envoyés. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

const MOVE: ClientMessage = {
  type: 'move',
  clientMoveId: 'id-1',
  move: { from: 'e2', to: 'e4' },
};
const last = () => FakeSocket.instances[FakeSocket.instances.length - 1] as FakeSocket;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  useGame.setState({ toast: null, rejections: 0 });
});

afterEach(() => {
  disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('file d’attente du socket', () => {
  it('envoie les messages en attente à l’ouverture, après le join', () => {
    connect('g1');
    send(MOVE);
    expect(last().sent).toEqual([]);
    last().open();
    expect(last().sent).toEqual([{ type: 'join', gameId: 'g1' }, MOVE]);
    vi.advanceTimersByTime(SEND_TIMEOUT_MS + 10);
    expect(useGame.getState().toast).toBeNull();
  });

  it('envoie directement quand le socket est ouvert', () => {
    connect('g1');
    last().open();
    send({ type: 'resign' });
    expect(last().sent).toEqual([{ type: 'join', gameId: 'g1' }, { type: 'resign' }]);
  });

  it('garde les messages pendant une reconnexion', () => {
    connect('g1');
    last().open();
    last().close();
    send(MOVE);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    last().open();
    expect(last().sent).toEqual([{ type: 'join', gameId: 'g1' }, MOVE]);
  });

  it('abandonne un coup non envoyé : toast et annulation de l’affichage optimiste', () => {
    connect('g1');
    send(MOVE);
    vi.advanceTimersByTime(SEND_TIMEOUT_MS + 10);
    const { toast, rejections } = useGame.getState();
    expect(toast).toMatch(/Connexion au serveur perdue/);
    expect(rejections).toBe(1);
    // Ouverture tardive : le coup abandonné ne part pas.
    last().open();
    expect(last().sent).toEqual([{ type: 'join', gameId: 'g1' }]);
  });

  it('une autre action non envoyée affiche un toast sans compter de refus', () => {
    send({ type: 'offer-draw' });
    vi.advanceTimersByTime(SEND_TIMEOUT_MS + 10);
    expect(useGame.getState().toast).toMatch(/action non envoyée/);
    expect(useGame.getState().rejections).toBe(0);
  });

  it('ignore un message serveur mal formé', () => {
    connect('g1');
    last().open();
    expect(() => last().onmessage?.({ data: '{pas du json' })).not.toThrow();
  });

  it('oublie la file en changeant de partie', () => {
    connect('g1');
    send(MOVE);
    connect('g2');
    last().open();
    expect(last().sent).toEqual([{ type: 'join', gameId: 'g2' }]);
    vi.advanceTimersByTime(SEND_TIMEOUT_MS + 10);
    expect(useGame.getState().toast).toBeNull();
  });
});
