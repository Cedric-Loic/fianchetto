import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisEvent } from '@sq/shared';
import { EnginePanel } from '../src/analysis/EnginePanel';
import { MoveTree } from '../src/analysis/MoveTree';
import { AnalysisTree, START_FEN } from '../src/analysis/tree';
import { parseSseChunk, THREAT_DEPTH, threatFen, useEngine } from '../src/analysis/useEngine';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const FEN_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const LINES: AnalysisEvent = {
  type: 'lines',
  fen: FEN_E4,
  lines: [
    {
      multipv: 1,
      depth: 14,
      evalCp: 32,
      mate: null,
      pv: ['e7e5', 'g1f3', 'b8c6'],
      sanPv: ['e5', 'Nf3', 'Nc6'],
    },
    { multipv: 2, depth: 14, evalCp: -120, mate: null, pv: ['c7c5'], sanPv: ['c5'] },
    { multipv: 3, depth: 14, evalCp: null, mate: 3, pv: ['f7f6'], sanPv: ['f6'] },
  ],
};

/** Faux flux SSE : le test pousse les événements un par un. */
function fakeStream() {
  const encoder = new TextEncoder();
  let push: (event: AnalysisEvent) => void = () => {};
  let close: () => void = () => {};
  const urls: string[] = [];
  const signals: AbortSignal[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    urls.push(url);
    if (init.signal) signals.push(init.signal);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        close = () => controller.close();
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, urls, signals, push: (e: AnalysisEvent) => push(e), close: () => close() };
}

function Harness(props: { fen: string; onPlay?: (ucis: string[]) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const engine = useEngine(props.fen, enabled);
  return (
    <>
      <EnginePanel
        fen={props.fen}
        engine={engine}
        enabled={enabled}
        onToggle={setEnabled}
        onPlay={props.onPlay ?? (() => {})}
        onHover={setHover}
      />
      <span data-testid="hover">{hover ?? ''}</span>
    </>
  );
}

const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe('flux SSE', () => {
  it('découpe les événements data:', () => {
    const { events, rest } = parseSseChunk('data: {"a":1}\n\ndata: {"b"');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b"');
  });
});

describe('EnginePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('affiche les lignes, la profondeur, joue un coup et signale le survol', async () => {
    const stream = fakeStream();
    const onPlay = vi.fn();
    render(<Harness fen={FEN_E4} onPlay={onPlay} />);
    // Anti-rebond : rien avant 150 ms.
    expect(stream.fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(160));
    expect(stream.urls[0]).toBe(`/api/analysis/stream?fen=${encodeURIComponent(FEN_E4)}&multipv=3`);
    stream.push(LINES);
    await flush();
    const lines = screen.getAllByTestId('engine-line');
    expect(lines).toHaveLength(3);
    expect(screen.getAllByTestId('engine-eval').map((e) => e.textContent)).toEqual([
      '+0,3',
      '-1,2',
      '#3',
    ]);
    expect(lines[0]?.textContent).toContain('1…e52.Nf3Nc6');
    expect(screen.getByTestId('engine-depth').textContent).toContain('Profondeur 14');

    fireEvent.click(screen.getByRole('button', { name: 'Nf3' }));
    expect(onPlay).toHaveBeenCalledWith(['e7e5', 'g1f3']);
    fireEvent.mouseEnter(lines[1] as HTMLElement);
    expect(screen.getByTestId('hover').textContent).toBe('c7c5');
    fireEvent.mouseLeave(lines[1] as HTMLElement);
    expect(screen.getByTestId('hover').textContent).toBe('');

    stream.push({ type: 'done', fen: FEN_E4 });
    await flush();
    expect(screen.getByTestId('engine-depth').textContent).toBe('Profondeur 14');
  });

  it('ferme le flux au changement de position et quand le moteur est coupé', async () => {
    const stream = fakeStream();
    const view = render(<Harness fen={START_FEN} />);
    await act(() => vi.advanceTimersByTimeAsync(160));
    expect(stream.fetchMock).toHaveBeenCalledTimes(1);
    // Deux changements rapprochés : une seule nouvelle requête (anti-rebond).
    view.rerender(<Harness fen={FEN_E4} />);
    expect(stream.signals[0]?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(50));
    view.rerender(<Harness fen={START_FEN} />);
    await act(() => vi.advanceTimersByTimeAsync(160));
    expect(stream.fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('engine-toggle'));
    expect(stream.signals[1]?.aborted).toBe(true);
    expect(screen.queryByTestId('engine-depth')).toBeNull();
    view.unmount();
  });

  it('menace : flux court sur le trait inversé, fermé, puis analyse principale', async () => {
    const stream = fakeStream();
    function ThreatHarness(props: { enabled: boolean }) {
      const engine = useEngine(FEN_E4, props.enabled, 3, true);
      return (
        <EnginePanel
          fen={FEN_E4}
          engine={engine}
          enabled={props.enabled}
          onToggle={() => {}}
          onPlay={() => {}}
          onHover={() => {}}
          threat={{ enabled: true, inCheck: false, onToggle: () => {} }}
        />
      );
    }
    const view = render(<ThreatHarness enabled />);
    await act(() => vi.advanceTimersByTimeAsync(160));
    // Une seule requête à la fois : la menace d'abord (une ligne, Blancs au trait).
    expect(stream.urls).toEqual([
      `/api/analysis/stream?fen=${encodeURIComponent(threatFen(FEN_E4))}&multipv=1`,
    ]);
    expect(screen.getByTestId('engine-threat').textContent).toBe('Menace : calcul…');
    stream.push({
      type: 'lines',
      fen: threatFen(FEN_E4),
      lines: [
        {
          multipv: 1,
          depth: THREAT_DEPTH,
          evalCp: 80,
          mate: null,
          pv: ['f1c4'],
          sanPv: ['Bc4'],
        },
      ],
    });
    await flush();
    // Profondeur atteinte : flux de la menace fermé, analyse principale lancée.
    expect(stream.signals[0]?.aborted).toBe(true);
    expect(stream.urls[1]).toBe(`/api/analysis/stream?fen=${encodeURIComponent(FEN_E4)}&multipv=3`);
    expect(screen.getByTestId('engine-threat').textContent).toBe('Menace : Bc4');
    stream.push(LINES);
    await flush();
    expect(screen.getAllByTestId('engine-line')).toHaveLength(3);
    expect(screen.getByTestId('engine-threat').textContent).toBe('Menace : Bc4');

    // Moteur coupé : aucun flux, pas de menace.
    view.rerender(<ThreatHarness enabled={false} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(stream.urls).toHaveLength(2);
    expect(screen.queryByTestId('engine-threat')).toBeNull();
  });

  it('menace : roi en échec, rien n’est calculé', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <EnginePanel
        fen={FEN_E4}
        engine={{ status: 'done', lines: [], depth: 0, message: null, threat: null }}
        enabled
        onToggle={() => {}}
        onPlay={() => {}}
        onHover={() => {}}
        threat={{ enabled: true, inCheck: true, onToggle: () => {} }}
      />,
    );
    expect(screen.getByTestId('engine-threat').textContent).toContain('Roi en échec');
  });

  it('message discret si le moteur est indisponible', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 503 })));
    render(<Harness fen={START_FEN} />);
    await act(() => vi.advanceTimersByTimeAsync(160));
    await flush();
    expect(screen.getByTestId('engine-message').textContent).toBe(
      'Moteur indisponible pour le moment.',
    );
  });
});

describe('MoveTree', () => {
  function setup() {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    const [e4 = '', e5 = ''] = tree.initialLine;
    const c5 = tree.play(e4, 'c7c5') ?? '';
    const nf3 = tree.play(c5, 'g1f3') ?? '';
    const d6 = tree.play(nf3, 'd7d6') ?? '';
    const nc3 = tree.play(c5, 'b1c3') ?? '';
    return { tree, e4, e5, c5, nf3, d6, nc3 };
  }
  const handlers = () => ({ onSelect: vi.fn(), onPromote: vi.fn(), onDelete: vi.fn() });

  it('ligne principale en colonnes, variantes entre parenthèses, nœud courant', () => {
    const { tree, nf3 } = setup();
    const h = handlers();
    render(<MoveTree tree={tree} current={nf3} {...h} />);
    const list = screen.getByTestId('move-list');
    expect(list.querySelectorAll('.move-row')).toHaveLength(2);
    const variation = screen.getByTestId('variation');
    expect(variation.textContent).toBe('1…c52.Nf3(2.Nc3)2…d6');
    expect(list.querySelector('.move.current')?.textContent).toBe('Nf3');
    expect(list.querySelector('.move.current')?.closest('.variation')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nc3' }));
    expect(h.onSelect).toHaveBeenCalled();
  });

  it('boutons Promouvoir et Supprimer dans une variante, rien sur la partie verrouillée', () => {
    const { tree, nf3, e5 } = setup();
    const h = handlers();
    const locked = new Set(tree.initialLine);
    const view = render(<MoveTree tree={tree} current={nf3} locked={locked} {...h} />);
    // La variante de premier niveau ne peut pas déloger un coup de la partie.
    expect(screen.queryByTestId('promote-variation')).toBeNull();
    fireEvent.click(screen.getByTestId('delete-variation'));
    expect(h.onDelete).toHaveBeenCalledWith(nf3);
    view.rerender(<MoveTree tree={tree} current={e5} locked={locked} {...h} />);
    expect(screen.queryByTestId('delete-variation')).toBeNull();
    // Sans verrou : promotion possible.
    view.rerender(<MoveTree tree={tree} current={nf3} {...h} />);
    fireEvent.click(screen.getByTestId('promote-variation'));
    expect(h.onPromote).toHaveBeenCalledWith(nf3);
  });

  it('symboles de classification sur la ligne principale', () => {
    const { tree, e4, e5 } = setup();
    const annotations = new Map([
      [e4, 'best' as const],
      [e5, 'blunder' as const],
    ]);
    render(
      <MoveTree tree={tree} current={tree.rootId} annotations={annotations} {...handlers()} />,
    );
    const text = screen.getByTestId('move-list').textContent ?? '';
    expect(text).toContain('e4 ★');
    expect(text).toContain('e5 ??');
  });
});
