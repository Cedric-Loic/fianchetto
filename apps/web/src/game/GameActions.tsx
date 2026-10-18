import type { Color, ViewerGameState } from '@sq/shared';
import { send } from '../lib/net';
import { SIDE } from '../screens/labels';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { IconDraw, IconFlag } from '../ui/icons';

/**
 * Actions d'une partie en cours : proposer la nulle, abandonner (après confirmation), ou
 * répondre à une proposition de nulle (à deux sur l'écran). Mêmes actions dans le panneau et
 * dans la barre discrète du mode concentration (`compact`).
 */
export function GameActions(props: {
  state: ViewerGameState;
  /** Camp qui agit : le mien contre le bot, le camp au trait à deux sur l'écran. */
  actor: Color;
  onResign: () => void;
  compact?: boolean;
}) {
  const { state, actor } = props;
  const isBot = state.mode === 'bot';
  const size = props.compact ? 's' : 'm';
  if (state.drawOffer !== null && isBot) {
    return <div className="draw-offer">Nulle proposée, en attente de la réponse…</div>;
  }
  if (state.drawOffer !== null) {
    const other: Color = state.drawOffer === 'w' ? 'b' : 'w';
    return (
      <div className="draw-offer">
        <p>
          {state.players[state.drawOffer].name} propose la nulle. {state.players[other].name} :
        </p>
        <div className="actions">
          <Button size={size} onClick={() => send({ type: 'answer-draw', accept: true })}>
            Accepter
          </Button>
          <Button size={size} onClick={() => send({ type: 'answer-draw', accept: false })}>
            Refuser
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={props.compact ? 'focus-actions-buttons' : 'actions'}>
      <Button
        size={size}
        variant={props.compact ? 'ghost' : 'secondary'}
        data-testid="offer-draw"
        onClick={() => send({ type: 'offer-draw', color: actor })}
      >
        <IconDraw size={18} />
        Proposer nulle
      </Button>
      <Button
        size={size}
        variant={props.compact ? 'ghost' : 'secondary'}
        data-testid="resign"
        onClick={props.onResign}
      >
        <IconFlag size={18} />
        Abandonner
      </Button>
    </div>
  );
}

/** Confirmation d'abandon (Échap ou « Continuer » : on reprend la partie). */
export function ResignDialog(props: {
  state: ViewerGameState;
  actor: Color;
  onCancel: () => void;
}) {
  const { state, actor } = props;
  return (
    <Dialog
      title="Abandonner la partie ?"
      onClose={props.onCancel}
      testId="resign-dialog"
      initialFocus="[data-autofocus]"
    >
      <p>
        {state.mode === 'bot'
          ? 'La partie sera comptée comme perdue.'
          : `${state.players[actor].name} (${SIDE[actor]}) perd la partie.`}
      </p>
      <div className="actions">
        <Button data-autofocus onClick={props.onCancel}>
          Continuer la partie
        </Button>
        <Button
          variant="danger"
          data-testid="confirm-resign"
          onClick={() => {
            props.onCancel();
            send({ type: 'resign', color: actor });
          }}
        >
          <IconFlag size={18} />
          Abandonner
        </Button>
      </div>
    </Dialog>
  );
}
