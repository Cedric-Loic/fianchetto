import { useEffect, useRef, useState } from 'react';
import type { CalcAnswerResponse, CalcProblem, Square } from '@sq/shared';
import { Board, type BoardMark } from '../game/Board';
import { api } from '../lib/api';
import { looksLikePromotion, parseUci } from '../lib/calc';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSan } from '../lib/notation';
import { playSound } from '../lib/sound';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { SIDE } from './labels';

/*
 * Entraîneur de calcul : la position reste figée, le joueur saisit sa ligne (ses coups et les
 * répliques adverses) au clic ou au clavier, répond à une question sur la position finale, puis
 * le serveur révèle la solution. Le client n'a aucune règle d'échecs : le serveur valide chaque
 * coup et juge la réponse.
 */

const DEPTHS = [
  { depth: 1, label: '1 coup', detail: 'ton coup seulement' },
  { depth: 2, label: '2 coups', detail: 'ton coup, sa réplique, ton coup' },
  { depth: 3, label: '3 coups', detail: '5 demi-coups : le plus exigeant' },
] as const;

const MISSING_DB_MESSAGE = "La base de puzzles n'est pas installée : pnpm puzzles:import";

/** Délai entre deux coups de la solution rejouée. */
const SOLUTION_STEP_MS = 800;

interface Stats {
  streak: number;
  best: number;
  solved: number;
  total: number;
}

type Load =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'login' }
  | { status: 'error' }
  | { status: 'ready'; problem: CalcProblem };

/** Page « Calcul » : choix de la profondeur, puis une position après l'autre. */
export function Calc() {
  const [depth, setDepth] = useState<number | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'idle' });
  const [stats, setStats] = useState<Stats>({ streak: 0, best: 0, solved: 0, total: 0 });

  const fetchProblem = async (d: number) => {
    setDepth(d);
    setLoad({ status: 'loading' });
    const res = await api.calcNext(d);
    if (res.ok) {
      setLoad(
        res.data.problem ? { status: 'ready', problem: res.data.problem } : { status: 'missing' },
      );
    } else setLoad({ status: res.status === 401 ? 'login' : 'error' });
  };
  const record = (ok: boolean) =>
    setStats((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return {
        streak,
        best: Math.max(s.best, streak),
        solved: s.solved + (ok ? 1 : 0),
        total: s.total + 1,
      };
    });

  if (load.status === 'login') {
    return <LoginRequired title="Calcul" text="Connecte-toi pour t’entraîner au calcul." />;
  }
  if (load.status === 'loading') return <Loading label="Recherche d’une position…" />;
  if (load.status === 'ready' && depth !== null) {
    return (
      <CalcProblemView
        key={load.problem.id}
        problem={load.problem}
        stats={stats}
        onResult={record}
        onNext={() => void fetchProblem(depth)}
        onDepth={() => setLoad({ status: 'idle' })}
      />
    );
  }

  return (
    <div className="page" data-testid="calc-depth">
      <section className="panel page-panel">
        <a href="#/train" className="back-link">
          ← S’entraîner
        </a>
        <h2>Calcul</h2>
        <p className="muted">
          La position reste figée : tu calcules dans ta tête, tu écris ta ligne, puis tu réponds à
          une question sur la position finale. Combien de coups veux-tu calculer ?
        </p>
        <div className="quick-grid">
          {DEPTHS.map((d) => (
            <div key={d.depth} className="panel quick-card">
              <h3>{d.label}</h3>
              <p className="muted">{d.detail}</p>
              <Button
                size="s"
                variant="primary"
                className="stretched"
                data-testid={`calc-depth-${d.depth}`}
                onClick={() => void fetchProblem(d.depth)}
              >
                Commencer
              </Button>
            </div>
          ))}
        </div>
        {load.status === 'missing' && (
          <EmptyState icon="♞" title={MISSING_DB_MESSAGE} testId="calc-missing" />
        )}
        {load.status === 'error' && (
          <p className="error" role="alert" data-testid="calc-error">
            Impossible de charger une position. Vérifie que le serveur tourne, puis réessaie.
          </p>
        )}
      </section>
    </div>
  );
}

interface LineMove {
  uci: string;
  san: string;
}

/** Un problème : saisie de la ligne, question, résultat. À remonter avec une `key` par problème. */
function CalcProblemView(props: {
  problem: CalcProblem;
  stats: Stats;
  onResult: (ok: boolean) => void;
  onNext: () => void;
  onDepth: () => void;
}) {
  const { problem } = props;
  const san = useSan();
  const [line, setLine] = useState<LineMove[]>([]);
  const [from, setFrom] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<CalcAnswerResponse | null>(null);
  const [pieces, setPieces] = useState(() => piecesFromFen(problem.fen));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  const complete = line.length >= problem.plies;
  const input = !complete && !result;

  const submit = async (uci: string) => {
    if (!input || busy) return;
    setBusy(true);
    setMessage(null);
    const res = await api.calcStep(
      problem.id,
      line.map((l) => l.uci),
      uci,
    );
    setBusy(false);
    if (!res.ok) {
      setMessage(res.status === 0 ? 'Serveur injoignable.' : 'Coup refusé par le serveur.');
      return;
    }
    if (res.data.legal) {
      setLine((l) => [...l, { uci, san: res.data.san }]);
      setPromo(null);
      setText('');
      playSound('move');
      return;
    }
    const [a, b] = [uci.slice(0, 2), uci.slice(2, 4)];
    // Un pion qui atteint la dernière rangée sans pièce de promotion : on demande laquelle.
    if (uci.length === 4 && looksLikePromotion(a, b)) {
      setPromo({ from: a, to: b });
      return;
    }
    setPromo(null);
    setMessage('Coup illégal.');
    playSound('illegal');
  };

  const onSquare = (sq: Square) => {
    if (!input || busy || promo) return;
    if (from === null) setFrom(sq);
    else if (from === sq) setFrom(null);
    else {
      const uci = `${from}${sq}`;
      setFrom(null);
      void submit(uci);
    }
  };

  const onText = () => {
    const uci = parseUci(text);
    if (!uci) {
      setMessage('Format attendu : e2e4 (case de départ, case d’arrivée).');
      return;
    }
    void submit(uci);
  };

  const undo = () => {
    if (result || busy) return;
    setLine((l) => l.slice(0, -1));
    setFrom(null);
    setPromo(null);
    setMessage(null);
    setChoice(null);
  };

  const validate = async () => {
    if (choice === null || busy || result) return;
    setBusy(true);
    const res = await api.calcAnswer(
      problem.id,
      line.map((l) => l.uci),
      choice,
    );
    setBusy(false);
    if (!res.ok) {
      setMessage(res.status === 0 ? 'Serveur injoignable.' : 'Réponse refusée par le serveur.');
      return;
    }
    const verdict = res.data;
    setResult(verdict);
    const ok = verdict.lineCorrect && verdict.answerCorrect;
    playSound(ok ? 'success' : 'failure');
    props.onResult(ok);
    // Solution rejouée sur le plateau, coup par coup.
    verdict.solution.forEach((step, i) => {
      timers.current.push(
        setTimeout(
          () => {
            setPieces((prev) => carryIds(prev, piecesFromFen(step.fen), step.uci));
            setLastMove({
              from: step.uci.slice(0, 2) as Square,
              to: step.uci.slice(2, 4) as Square,
            });
          },
          SOLUTION_STEP_MS * (i + 1),
        ),
      );
    });
  };

  const marks: BoardMark[] = from ? [{ square: from, kind: 'pick' }] : [];
  const who = (i: number) => (i % 2 === 0 ? 'Toi' : 'Adversaire');

  return (
    <BoardLayout
      className="exercise calc"
      testId="calc"
      board={
        <Board
          pieces={pieces}
          orientation={problem.color}
          movable={null}
          lastMove={lastMove}
          squareMarks={marks}
          {...(input ? { onSquareClick: onSquare } : {})}
        />
      }
      side={
        <>
          <a href="#/train" className="back-link">
            ← S’entraîner
          </a>
          <div className="puzzle-stats-row">
            <h2>
              Calcul · {problem.depth} coup{problem.depth > 1 ? 's' : ''}
            </h2>
            <span className="muted" data-testid="calc-streak">
              Série : {props.stats.streak} · {props.stats.solved} / {props.stats.total}
            </span>
          </div>
          <p>
            <strong>{problem.prompt}</strong>
          </p>
          <p className="muted">
            Trait aux {SIDE[problem.color]}. Le plateau ne bouge pas : écris {problem.plies}{' '}
            demi-coup{problem.plies > 1 ? 's' : ''} (tes coups et les répliques adverses).
          </p>

          <ol className="calc-line" data-testid="calc-line" aria-label="Ta ligne">
            {line.map((m, i) => (
              <li key={i} data-testid="calc-line-move">
                <span className="muted">{who(i)} :</span> <strong>{san(m.san)}</strong>
              </li>
            ))}
            {input && (
              <li className="muted" data-testid="calc-next-ply">
                {who(line.length)} : coup {line.length + 1} sur {problem.plies}…
              </li>
            )}
          </ol>

          {input && (
            <>
              <form
                className="calc-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  onText();
                }}
              >
                <input
                  type="text"
                  value={text}
                  placeholder="e2e4"
                  aria-label="Coup à saisir (par exemple e2e4)"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={8}
                  data-testid="calc-input"
                  onChange={(e) => setText(e.target.value)}
                />
                <Button type="submit" size="s" disabled={busy} data-testid="calc-input-submit">
                  Jouer ce coup
                </Button>
              </form>
              <p className="muted">
                Ou clique la case de départ puis la case d’arrivée
                {from ? ` (départ : ${from})` : ''}.
              </p>
            </>
          )}
          {promo && (
            <div className="move-card" role="group" aria-label="Promotion" data-testid="calc-promo">
              <p>Promotion en :</p>
              <div className="actions">
                {(
                  [
                    ['q', 'Dame'],
                    ['r', 'Tour'],
                    ['b', 'Fou'],
                    ['n', 'Cavalier'],
                  ] as const
                ).map(([p, name]) => (
                  <Button
                    key={p}
                    size="s"
                    data-testid={`calc-promo-${p}`}
                    onClick={() => void submit(`${promo.from}${promo.to}${p}`)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {message && (
            <p className="error" role="alert" data-testid="calc-message">
              {message}
            </p>
          )}
          {!result && (
            <Button
              size="s"
              variant="outline"
              disabled={line.length === 0 || busy}
              onClick={undo}
              data-testid="calc-undo"
            >
              Annuler le dernier coup
            </Button>
          )}

          {complete && (
            <div className="calc-question" data-testid="calc-question">
              <p>
                <strong>{problem.question.text}</strong>
              </p>
              <div className="choice-list" role="group" aria-label="Réponses">
                {problem.question.options.map((label, i) => {
                  const right = result?.correctAnswer === i;
                  const wrong = result !== null && choice === i && !right;
                  return (
                    <Button
                      key={i}
                      variant={right ? 'primary' : wrong ? 'outline' : 'secondary'}
                      pressed={choice === i}
                      disabled={result !== null || busy}
                      onClick={() => setChoice(i)}
                      data-testid={`calc-option-${i}`}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              {!result && (
                <Button
                  variant="primary"
                  disabled={choice === null || busy}
                  onClick={() => void validate()}
                  data-testid="calc-validate"
                >
                  Valider
                </Button>
              )}
            </div>
          )}

          {result && (
            <div className="move-card puzzle-status" data-testid="calc-result">
              <p className={result.lineCorrect ? 'win' : 'loss'} data-testid="calc-line-verdict">
                {result.lineCorrect ? '✓ Ta ligne est correcte.' : '✗ Ta ligne n’est pas la bonne.'}
              </p>
              <p
                className={result.answerCorrect ? 'win' : 'loss'}
                data-testid="calc-answer-verdict"
              >
                {result.answerCorrect ? '✓ Bonne réponse.' : '✗ Mauvaise réponse.'}
              </p>
              <p data-testid="calc-solution">
                Solution : {result.solution.map((s) => san(s.san)).join(' ')}
              </p>
              <p data-testid="calc-explanation">{result.explanation}</p>
            </div>
          )}
          {result && (
            <div className="actions">
              <Button variant="primary" onClick={props.onNext} data-testid="calc-next">
                Position suivante
              </Button>
              <Button variant="ghost" onClick={props.onDepth}>
                Changer de profondeur
              </Button>
            </div>
          )}
        </>
      }
    />
  );
}
