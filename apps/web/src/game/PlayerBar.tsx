import { useEffect, useState } from 'react';
import { materialAdvantage, type Color, type PieceType, type PlayerInfo } from '@sq/shared';

const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  if (total < 20_000)
    return `${minutes}:${String(seconds).padStart(2, '0')}.${Math.floor((total % 1000) / 100)}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Pendule affichée : temps reçu du serveur, décompté localement pour le camp qui joue. */
function Clock({ ms, running, receivedAt }: { ms: number; running: boolean; receivedAt: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [running]);
  const shown = running ? ms - Math.max(0, now - receivedAt) : ms;
  return (
    <div className={`clock${running ? ' running' : ''}${shown < 20_000 ? ' low' : ''}`}>
      {formatClock(shown)}
    </div>
  );
}

export interface PlayerBarProps {
  color: Color;
  player: PlayerInfo;
  /** Pièces ADVERSES capturées par ce joueur (types affichés). */
  capturedByMe: readonly PieceType[];
  captured: Record<Color, readonly PieceType[]>;
  clock: { ms: number; running: boolean; receivedAt: number } | null;
  active: boolean;
}

/** Barre joueur : avatar, pseudo, Elo, pièces prises, avantage matériel (types affichés), pendule. */
export function PlayerBar({
  color,
  player,
  capturedByMe,
  captured,
  clock,
  active,
}: PlayerBarProps) {
  const advantage = materialAdvantage(captured, color);
  const sorted = [...capturedByMe].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const opponent = color === 'w' ? 'b' : 'w';
  return (
    <div className={`player-bar${active ? ' active' : ''}`}>
      <div className={`avatar ${color}`}>{player.name.slice(0, 1).toUpperCase()}</div>
      <div className="player-info">
        <div className="player-name">
          {player.name}
          {player.rating !== null && <span className="rating">({player.rating})</span>}
        </div>
        <div className="captured">
          {sorted.map((t, i) => (
            <img key={i} src={`/pieces/cburnett/${opponent}${t.toUpperCase()}.svg`} alt={t} />
          ))}
          {advantage > 0 && <span className="advantage">+{advantage}</span>}
        </div>
      </div>
      {clock && <Clock {...clock} />}
    </div>
  );
}
