import type { Color, EndgameSummary, GameResult, ViewerGameState } from '@sq/shared';
import { endgameSucceeded, startEndgame } from '../lib/endgame';
import { useCountUp } from '../lib/motion';
import { send } from '../lib/net';
import { SIDE, VARIANT_LABEL } from '../screens/labels';
import { outcomeFor, resultText, type Outcome } from './outcome';
import { Button } from '../ui/Button';
import { Celebration } from '../ui/Celebration';
import { Dialog } from '../ui/Dialog';
import { IconChart, IconDraw, IconFlag, IconPlay, IconRetry, IconTrophy } from '../ui/icons';

function bannerText(outcome: Outcome, result: GameResult, state: ViewerGameState): string {
  if (outcome === 'draw') return 'Partie nulle';
  if (outcome === 'loss') return 'Défaite';
  return state.viewer === 'public' && result.winner
    ? `Victoire des ${SIDE[result.winner]}`
    : 'Victoire !';
}

/**
 * Verdict d'une finale : réussie, trop de coups (bon résultat mais limite dépassée) ou objectif
 * non atteint ; dans les deux cas d'échec, renvoie vers le cours.
 */
function EndgameVerdict(props: {
  endgame: EndgameSummary;
  result: GameResult;
  state: ViewerGameState;
}) {
  const { endgame, result, state } = props;
  // Coups du joueur tels qu'affichés dans la liste (les coups repris n'y figurent plus).
  const moves = (state.board?.moves ?? []).filter((m) => m.color === endgame.color).length;
  const goodResult = endgameSucceeded(endgame, result);
  const tooMany = goodResult && endgame.maxMoves !== null && moves > endgame.maxMoves;
  const success = goodResult && !tooMany;
  return (
    <div className="endgame-verdict-block">
      <p className={`endgame-verdict ${success ? 'win' : 'loss'}`} data-testid="endgame-verdict">
        {success
          ? `Finale réussie : ${endgame.goal === 'win' ? 'tu as gagné' : 'tu as tenu la nulle'} !`
          : tooMany
            ? `Trop de coups : ${moves} > ${endgame.maxMoves}. Le résultat est bon, mais la finale se joue en ${endgame.maxMoves} coups maximum.`
            : `Objectif non atteint : ${endgame.objective}`}
      </p>
      {!success && endgame.lesson && (
        <Button href={`#/lessons/${endgame.lesson}`} data-testid="endgame-course-link">
          Revoir le cours
        </Button>
      )}
    </div>
  );
}

/** Écart d'Elo : compteur animé de l'ancien classement vers le nouveau. */
function EloChange(props: { variant: ViewerGameState['variant']; before: number; after: number }) {
  const shown = useCountUp(props.after, props.before);
  const delta = shown - props.before;
  return (
    <p className="elo-change" data-testid="elo-change">
      Elo {VARIANT_LABEL[props.variant]} : {props.before} → <strong>{shown}</strong>{' '}
      <span
        className={`elo-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}
        data-testid="elo-delta"
      >
        {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
        {Math.abs(delta)}
      </span>
    </p>
  );
}

/**
 * Fin de partie : bandeau victoire / défaite / nulle, résultat, écart d'Elo animé, révélation
 * des dames secrètes, « Revue guidée » en action principale ; célébration à la victoire qui
 * vient d'avoir lieu.
 */
export function EndDialog(props: {
  state: ViewerGameState;
  result: GameResult;
  /** Elo après la partie (compte rafraîchi), pour une partie classée. */
  ratingAfter: number | null;
  /** La partie vient de se terminer sous nos yeux (pas un rechargement de page). */
  justEnded: boolean;
  /** Finale contre le bot jouée par cette partie : réussite ou échec, et « Réessayer ». */
  endgame?: EndgameSummary | null;
  onClose: () => void;
  onLeave: () => void;
}) {
  const { state, result } = props;
  const board = state.board;
  const me: Color | null = state.viewer === 'public' ? null : state.viewer;
  const outcome = outcomeFor(result, state.viewer);
  const before = me ? state.players[me].rating : null;
  const BannerIcon = outcome === 'win' ? IconTrophy : outcome === 'loss' ? IconFlag : IconDraw;
  return (
    <>
      {outcome === 'win' && props.justEnded && <Celebration />}
      <Dialog
        title={resultText(result, state)}
        onClose={props.onClose}
        testId="end-modal"
        className={`end-modal end-${outcome}`}
        initialFocus="[data-autofocus]"
        header={
          <div className={`end-banner ${outcome}`} data-testid="end-banner">
            <BannerIcon size={30} />
            <span>{bannerText(outcome, result, state)}</span>
          </div>
        }
      >
        {state.rated && before !== null && props.ratingAfter !== null && (
          <EloChange variant={state.variant} before={before} after={props.ratingAfter} />
        )}
        {props.endgame && <EndgameVerdict endgame={props.endgame} result={result} state={state} />}
        {board?.reveal && <h3>Les dames secrètes</h3>}
        {(['w', 'b'] as const).map((c) => {
          const s = board?.reveal?.secrets[c];
          if (!s) return null;
          return (
            <p key={c} data-testid={`reveal-${c}`}>
              {state.players[c].name} ({SIDE[c]}) : le pion de <strong>{s.initialSquare}</strong>
              {s.finalSquare ? `, aujourd'hui en ${s.finalSquare}` : ', capturé en cours de partie'}
            </p>
          );
        })}
        <div className="end-actions">
          <Button
            variant="primary"
            size="l"
            block
            href={`#/review/${state.gameId}/guided`}
            data-testid="guided-review-link"
            data-autofocus
          >
            <IconPlay size={18} />
            Revue guidée
          </Button>
          <div className="actions">
            <Button href={`#/review/${state.gameId}`}>
              <IconChart size={18} />
              Revue de la partie
            </Button>
            {props.endgame ? (
              <Button
                onClick={() => void startEndgame(props.endgame?.id ?? '')}
                data-testid="endgame-retry"
              >
                <IconRetry size={18} />
                Réessayer
              </Button>
            ) : (
              <Button onClick={() => send({ type: 'offer-rematch' })}>
                <IconRetry size={18} />
                Revanche
              </Button>
            )}
          </div>
          <div className="actions">
            <Button variant="ghost" onClick={props.onClose}>
              Voir le plateau
            </Button>
            <Button variant="ghost" onClick={props.onLeave}>
              Nouvelle partie
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
