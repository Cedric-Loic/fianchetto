import { useEffect, useState } from 'react';
import type { Square, ViewerGameState } from '@sq/shared';
import { Board } from '../game/Board';
import { initialPieces } from '../lib/position';
import { send } from '../lib/net';
import { useGame } from '../lib/store';

/**
 * Choix du pion secret en hot-seat : écran de passage (plateau caché), puis choix en 30 s.
 * Le choix local n'est jamais conservé après le verrouillage.
 */
export function Selection({ state }: { state: ViewerGameState }) {
  const selection = state.selection;
  const receivedAt = useGame((s) => s.receivedAt);
  const [choice, setChoice] = useState<Square | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const chooser = selection?.chooser ?? 'w';

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (!selection) return null;
  const name = state.players[chooser].name;
  const other = state.players[chooser === 'w' ? 'b' : 'w'].name;
  const side = chooser === 'w' ? 'Blancs' : 'Noirs';

  if (selection.handoffPending) {
    return (
      <div className="handoff" data-testid="handoff">
        <h2>
          {name} ({side}), à vous de choisir votre pion secret
        </h2>
        <p>{other}, détournez le regard.</p>
        <button className="primary big" onClick={() => send({ type: 'start-selection' })}>
          Je suis prêt
        </button>
      </div>
    );
  }

  const remaining = Math.max(0, (selection.remainingMs ?? 0) - (now - receivedAt));
  return (
    <div className="selection">
      <div className="selection-header">
        <h2>
          {name} ({side}) : choisissez le pion qui sera votre dame secrète
        </h2>
        <div className={`clock running${remaining < 10_000 ? ' low' : ''}`}>
          {Math.ceil(remaining / 1000)} s
        </div>
      </div>
      <Board
        pieces={initialPieces()}
        orientation={chooser}
        movable={null}
        highlighted={choice}
        crowns={choice ? [choice] : []}
        onPieceClick={(p) => p.color === chooser && p.type === 'p' && setChoice(p.square)}
      />
      <div className="selection-actions">
        <p className="muted">Sans confirmation à temps, un pion est tiré au hasard.</p>
        <button
          className="primary big"
          disabled={choice === null}
          onClick={() => choice && send({ type: 'lock-secret', square: choice })}
        >
          Confirmer
        </button>
      </div>
    </div>
  );
}
