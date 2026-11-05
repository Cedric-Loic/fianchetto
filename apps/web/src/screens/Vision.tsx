import { useEffect, useState } from 'react';
import type { Color, DisplayedPiece, Square } from '@sq/shared';
import { Board, type BoardMark } from '../game/Board';
import {
  formatClock,
  knightDistance,
  randomSquare,
  saveVisionScore,
  squareColor,
  visionRecords,
  type VisionDrill,
} from '../lib/drills';
import { playSound } from '../lib/sound';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';

/*
 * Vision de l'échiquier (Chess.com Vision, entraîneur de coordonnées Lichess) : retrouver une
 * case nommée, dire la couleur d'une case sans la voir, compter les sauts d'un cavalier. Tout se
 * passe dans le navigateur ; seuls les records sont gardés (stockage local).
 */

const DRILLS: { id: VisionDrill; label: string; seconds: number; text: string }[] = [
  {
    id: 'coords',
    label: 'Coordonnées',
    seconds: 30,
    text: 'Une case est annoncée : clique-la sur l’échiquier, le plus vite possible.',
  },
  {
    id: 'color',
    label: 'Couleur des cases',
    seconds: 30,
    text: 'Sans regarder l’échiquier : la case annoncée est-elle claire ou foncée ?',
  },
  {
    id: 'knight',
    label: 'Cavalier',
    seconds: 60,
    text: 'En combien de coups, au minimum, le cavalier atteint-il la case marquée ?',
  },
];

type Round = { target: Square; from: Square };

function newRound(drill: VisionDrill, previous?: Round): Round {
  const target = randomSquare(Math.random, previous?.target);
  if (drill !== 'knight') return { target, from: target };
  return { target, from: randomSquare(Math.random, target) };
}

export function Vision() {
  const [drill, setDrill] = useState<VisionDrill>('coords');
  const [orientation, setOrientation] = useState<Color>('w');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [round, setRound] = useState<Round>(() => newRound('coords'));
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState<{
    square: Square;
    tone: 'success' | 'error';
    id: number;
  } | null>(null);
  const [over, setOver] = useState<{ score: number; record: boolean } | null>(null);
  const [records, setRecords] = useState(visionRecords);
  const spec = DRILLS.find((d) => d.id === drill) ?? DRILLS[0];
  const running = endsAt !== null;
  const remaining = endsAt === null ? 0 : endsAt - now;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!running || remaining > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fin de la série au temps
    setEndsAt(null);
    const record = saveVisionScore(drill, score);
    setOver({ score, record: record && score > 0 });
    setRecords(visionRecords());
  }, [running, remaining, drill, score]);

  const start = () => {
    const t = Date.now();
    setNow(t);
    setScore(0);
    setErrors(0);
    setOver(null);
    setRound(newRound(drill));
    setEndsAt(t + (spec?.seconds ?? 30) * 1000);
  };
  const choose = (id: VisionDrill) => {
    setDrill(id);
    setEndsAt(null);
    setOver(null);
    setRound(newRound(id));
  };
  const answer = (ok: boolean, square: Square) => {
    if (!running) return;
    setFlash((f) => ({ square, tone: ok ? 'success' : 'error', id: (f?.id ?? 0) + 1 }));
    if (ok) {
      setScore((s) => s + 1);
      setRound((r) => newRound(drill, r));
    } else {
      setErrors((e) => e + 1);
      playSound('illegal');
    }
  };

  const pieces: DisplayedPiece[] =
    drill === 'knight' ? [{ id: 'vision-n', color: 'w', type: 'n', square: round.from }] : [];
  const marks: BoardMark[] =
    drill === 'knight' && running ? [{ square: round.target, kind: 'correct' }] : [];

  const board =
    drill === 'color' ? (
      <div className="vision-cover" data-testid="vision-cover">
        <span className="muted">Échiquier masqué</span>
        <span className="vision-target">{running ? round.target : '—'}</span>
      </div>
    ) : (
      <Board
        pieces={pieces}
        orientation={orientation}
        movable={null}
        squareMarks={marks}
        flash={flash}
        {...(drill === 'coords' && running
          ? { onSquareClick: (sq: Square) => answer(sq === round.target, sq) }
          : {})}
      />
    );

  return (
    <BoardLayout
      className="vision"
      testId="vision"
      board={board}
      side={
        <>
          <a href="#/train" className="back-link">
            ← S’entraîner
          </a>
          <h2>Vision de l’échiquier</h2>
          <Tabs
            label="Exercice de vision"
            value={drill}
            onChange={choose}
            items={DRILLS.map((d) => ({ id: d.id, label: d.label, testId: `vision-tab-${d.id}` }))}
          />
          <p className="muted">{spec?.text}</p>
          {drill !== 'color' && (
            <div className="btn-row">
              <span className="muted">Vu des</span>
              {(['w', 'b'] as const).map((c) => (
                <Button
                  key={c}
                  size="s"
                  variant={orientation === c ? 'secondary' : 'outline'}
                  pressed={orientation === c}
                  disabled={running}
                  onClick={() => setOrientation(c)}
                >
                  {c === 'w' ? 'Blancs' : 'Noirs'}
                </Button>
              ))}
            </div>
          )}
          <div className="puzzle-stats-row">
            <div className="rush-score">
              <span className="rush-points" data-testid="vision-score">
                {score}
              </span>
              <span className="muted">
                bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''}
                {errors > 0 && ` · ${errors} erreur${errors > 1 ? 's' : ''}`}
              </span>
            </div>
            <div
              className={`clock${running ? ' running' : ''}${running && remaining < 10_000 ? ' low' : ''}`}
            >
              {formatClock(running ? remaining : (spec?.seconds ?? 30) * 1000)}
            </div>
          </div>
          {running && drill !== 'color' && (
            <p className="vision-prompt" data-testid="vision-prompt" aria-live="polite">
              {drill === 'coords' ? (
                <>
                  Clique <strong className="vision-target">{round.target}</strong>
                </>
              ) : (
                <>
                  Cavalier en <strong>{round.from}</strong> → <strong>{round.target}</strong>
                </>
              )}
            </p>
          )}
          {running && drill === 'color' && (
            <div className="btn-row">
              <Button
                variant="outline"
                onClick={() => answer(squareColor(round.target) === 'light', round.target)}
                data-testid="vision-light"
              >
                Case claire
              </Button>
              <Button
                variant="outline"
                onClick={() => answer(squareColor(round.target) === 'dark', round.target)}
                data-testid="vision-dark"
              >
                Case foncée
              </Button>
            </div>
          )}
          {running && drill === 'knight' && (
            <div className="btn-row" role="group" aria-label="Nombre de coups">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  onClick={() =>
                    answer(knightDistance(round.from, round.target) === n, round.target)
                  }
                  data-testid={`vision-knight-${n}`}
                >
                  {n}
                </Button>
              ))}
            </div>
          )}
          {over && (
            <div className="move-card" data-testid="vision-over" aria-live="polite">
              <p>
                <strong>
                  {over.score} bonne{over.score > 1 ? 's' : ''} réponse{over.score > 1 ? 's' : ''}
                </strong>
                {over.record && <span className="win"> · Nouveau record !</span>}
              </p>
            </div>
          )}
          {!running && (
            <Button variant="primary" onClick={start} data-testid="vision-start">
              {over ? 'Recommencer' : 'Commencer'}
            </Button>
          )}
          <p className="muted" data-testid="vision-records">
            Records : coordonnées {records.coords ?? '—'} · couleurs {records.color ?? '—'} ·
            cavalier {records.knight ?? '—'}
          </p>
        </>
      }
    />
  );
}
