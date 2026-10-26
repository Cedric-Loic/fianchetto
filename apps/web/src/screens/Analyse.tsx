import { useEffect, useState } from 'react';
import type { ImportedGameSummary, ImportResult } from '@sq/shared';
import { AnalysisBoard } from '../analysis/AnalysisBoard';
import { checkFen, parsePgn, START_FEN } from '../analysis/tree';
import { useAnalysisTree } from '../analysis/useAnalysisTree';
import { pollDelay, wait } from '../lib/poll';
import { api, type Result } from '../lib/api';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { Button } from '../ui/Button';
import { IconChart, IconClose, IconHourglass } from '../ui/icons';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { Tabs } from '../ui/Tabs';

const COUNTS = [20, 50, 100] as const;

const IMPORT_ERRORS: Record<string, string> = {
  CHESSCOM_USER_NOT_FOUND: 'Pseudo chess.com introuvable.',
  CHESSCOM_UNAVAILABLE:
    'chess.com ne répond pas (connexion Internet ?). La cause exacte est dans le terminal du serveur.',
  CHESSCOM_RATE_LIMITED: 'chess.com limite les requêtes : réessaie dans une minute.',
  BAD_REQUEST: 'Requête invalide.',
  NOT_AUTHENTICATED: 'Connecte-toi pour importer des parties.',
};

function importMessage(res: Result<ImportResult>): { text: string; error: boolean } {
  if (!res.ok) return { text: IMPORT_ERRORS[res.error] ?? 'Import impossible.', error: true };
  const { imported, duplicates, invalid } = res.data;
  const parts = [`${imported} partie${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}`];
  if (duplicates > 0) parts.push(`${duplicates} déjà présente${duplicates > 1 ? 's' : ''}`);
  if (invalid > 0) parts.push(`${invalid} illisible${invalid > 1 ? 's' : ''}`);
  return { text: `${parts.join(', ')}.`, error: false };
}

/** Résultat vu du camp de l'utilisateur : victoire, défaite, nulle (ou résultat brut). */
function outcome(g: ImportedGameSummary): { text: string; className: string } {
  if (g.result === '1/2-1/2') return { text: 'Nulle', className: '' };
  if (!g.userColor || (g.result !== '1-0' && g.result !== '0-1')) {
    return { text: g.result, className: '' };
  }
  const won = (g.result === '1-0') === (g.userColor === 'w');
  return won ? { text: 'Victoire', className: 'win' } : { text: 'Défaite', className: 'loss' };
}

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

/** Point de départ : moyennes sur les parties analysées dont le camp de l'utilisateur est connu. */
function Baseline({ games }: { games: ImportedGameSummary[] }) {
  const stats = games.flatMap((g) => (g.stats ? [g.stats] : []));
  if (stats.length === 0) {
    return (
      <EmptyState icon={<IconChart size={40} />} title="Point de départ pas encore mesuré">
        Analyse tes parties importées pour mesurer ta précision, tes gaffes par partie…
      </EmptyState>
    );
  }
  const accuracy = average(stats.flatMap((s) => (s.accuracy === null ? [] : [s.accuracy])));
  const per = (key: 'blunder' | 'mistake' | 'inaccuracy') =>
    (average(stats.map((s) => s[key])) ?? 0).toFixed(1).replace('.', ',');
  return (
    <div className="baseline" data-testid="baseline">
      <div>
        <strong>{stats.length}</strong>
        <span className="muted">parties analysées</span>
      </div>
      <div>
        <strong>{accuracy === null ? '—' : `${accuracy.toFixed(1).replace('.', ',')} %`}</strong>
        <span className="muted">précision moyenne</span>
      </div>
      <div>
        <strong>{per('blunder')}</strong>
        <span className="muted">gaffes par partie</span>
      </div>
      <div>
        <strong>{per('mistake')}</strong>
        <span className="muted">erreurs par partie</span>
      </div>
      <div>
        <strong>{per('inaccuracy')}</strong>
        <span className="muted">imprécisions par partie</span>
      </div>
    </div>
  );
}

type AnalyseTab = 'import' | 'board';

/** Lien vers l'échiquier d'analyse, avec la position si ce n'est pas celle de départ. */
const boardLink = (fen: string) =>
  fen === START_FEN ? '#/analyse/board' : `#/analyse/board?fen=${encodeURIComponent(fen)}`;

/**
 * Échiquier d'analyse libre : position de départ (ou FEN du lien), chargement d'une FEN ou d'un
 * PGN, variantes, moteur en direct.
 */
function BoardTab({ fen }: { fen: string | null }) {
  const invalid = fen !== null && checkFen(fen) !== null;
  const ctl = useAnalysisTree(fen && !invalid ? fen.trim() : START_FEN);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(
    invalid ? 'La FEN du lien est invalide : position de départ affichée.' : null,
  );
  const node = ctl.tree.get(ctl.current);

  const load = () => {
    const input = text.trim();
    if (!input) return;
    // Une FEN tient sur une ligne et compte au moins sept « / » ; sinon on tente le PGN.
    if (!input.includes('\n') && (input.match(/\//g) ?? []).length === 7) {
      const problem = checkFen(input);
      if (problem) return setError(problem);
      ctl.load(input);
    } else {
      const res = parsePgn(input);
      if (!res.ok) return setError(res.error);
      ctl.load(res.fen, res.moves);
    }
    setError(null);
    setText('');
  };

  return (
    <AnalysisBoard
      controller={ctl}
      panelBottom={
        <div className="load-position">
          <label htmlFor="load-position">Charger une FEN ou un PGN</label>
          <textarea
            id="load-position"
            rows={2}
            value={text}
            data-testid="load-position"
            placeholder="Colle une FEN ou un PGN"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row">
            <Button size="s" variant="primary" disabled={!text.trim()} onClick={load}>
              Charger
            </Button>
            <Button size="s" onClick={() => ctl.load(START_FEN)}>
              Position de départ
            </Button>
            <a className="muted position-link" href={boardLink(node.fen)} data-testid="board-link">
              Lien de la position
            </a>
          </div>
          {error && (
            <p className="error" data-testid="load-error">
              {error}
            </p>
          )}
        </div>
      }
    />
  );
}

/**
 * Analyse : onglet « Importer » (parties chess.com ou PGN, analyse, point de départ) et onglet
 * « Échiquier d'analyse » (plateau libre).
 */
export function Analyse({ tab = 'import', fen = null }: { tab?: AnalyseTab; fen?: string | null }) {
  return (
    <div className={`analyse-shell${tab === 'board' ? ' board-shell' : ''}`}>
      <Tabs
        label="Analyse"
        className="analyse-tabs"
        value={tab}
        onChange={(t) => (location.hash = t === 'board' ? '#/analyse/board' : '#/analyse')}
        items={[
          { id: 'import', label: 'Mes parties', testId: 'tab-import' },
          { id: 'board', label: "Échiquier d'analyse", testId: 'tab-board' },
        ]}
      />
      {tab === 'board' ? <BoardTab key={fen ?? ''} fen={fen} /> : <Imports />}
    </div>
  );
}

/**
 * Import de parties (chess.com à la demande, fichier ou texte PGN), liste des parties importées
 * avec leur analyse, point de départ mesuré.
 */
function Imports() {
  const user = useSession((s) => s.user);
  const chessCom = useSettings((s) => s.chessComUsername);
  const update = useSettings((s) => s.update);
  const [count, setCount] = useState<number>(50);
  const [pgn, setPgn] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [games, setGames] = useState<ImportedGameSummary[] | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Liste des parties ; rafraîchie tant que des analyses sont en cours.
  const pending = games?.some((g) => g.review === 'queued' || g.review === 'running') ?? false;
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const { signal } = controller;
    // Chargement, puis (analyses en cours) interrogations successives, sans chevauchement,
    // de plus en plus espacées ; tout s'arrête au démontage.
    void (async () => {
      for (let round = 0; ; round++) {
        const r = await api.imports(signal);
        if (signal.aborted) return;
        if (r) setGames(r.games);
        if (!pending || !(await wait(pollDelay(round), signal))) return;
      }
    })();
    return () => controller.abort();
  }, [user, refresh, pending]);

  if (!user) {
    return (
      <LoginRequired title="Analyse" text="Connecte-toi pour importer et analyser tes parties." />
    );
  }

  const run = async (action: () => Promise<Result<ImportResult>>) => {
    setBusy(true);
    setMessage(null);
    const res = await action();
    setBusy(false);
    setMessage(importMessage(res));
    setRefresh((r) => r + 1);
  };

  const onFile = (file: File | undefined) => {
    if (file) void file.text().then(setPgn);
  };

  const toAnalyse = games?.filter((g) => g.review === 'none' || g.review === 'error').length ?? 0;

  return (
    <div className="page analyse">
      <div className="panel page-panel">
        <h2>Importer des parties</h2>
        <div className="import-grid">
          <div className="import-box">
            <h3>Depuis chess.com</h3>
            <label>
              Ton pseudo chess.com
              <input
                value={chessCom}
                maxLength={40}
                data-testid="chesscom-username"
                onChange={(e) => update({ chessComUsername: e.target.value.trim() })}
              />
            </label>
            <div className="row">
              {COUNTS.map((n) => (
                <Button key={n} size="s" pressed={n === count} onClick={() => setCount(n)}>
                  {n} dernières
                </Button>
              ))}
            </div>
            <Button
              variant="primary"
              disabled={busy || chessCom.length < 2}
              onClick={() => void run(() => api.importChessCom(chessCom, count))}
            >
              Récupérer mes parties
            </Button>
            <p className="muted">
              Seul accès à Internet de l'application : l'API publique de chess.com, uniquement quand
              tu cliques.
            </p>
          </div>
          <div className="import-box">
            <h3>Fichier ou texte PGN</h3>
            <input
              type="file"
              accept=".pgn,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <textarea
              rows={6}
              placeholder="Colle ici une ou plusieurs parties au format PGN"
              value={pgn}
              data-testid="pgn-input"
              onChange={(e) => setPgn(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={busy || pgn.trim() === ''}
              onClick={() =>
                void run(async () => {
                  const res = await api.importPgn(pgn, chessCom);
                  if (res.ok) setPgn('');
                  return res;
                })
              }
            >
              Importer le PGN
            </Button>
          </div>
        </div>
        {busy && <Loading inline label="Import en cours…" />}
        {message && (
          <p className={message.error ? 'error' : 'muted'} data-testid="import-message">
            {message.text}
          </p>
        )}
      </div>

      <div className="panel page-panel">
        <h2>Ton point de départ</h2>
        <Baseline games={games ?? []} />
      </div>

      <div className="panel page-panel">
        <div className="list-header">
          <h2>Parties importées</h2>
          <Button
            disabled={toAnalyse === 0}
            data-testid="review-all"
            onClick={() => void api.reviewAll().then(() => setRefresh((r) => r + 1))}
          >
            Tout analyser ({toAnalyse})
          </Button>
        </div>
        {games === null && <Loading inline />}
        {games?.length === 0 && (
          <EmptyState icon="♞" title="Aucune partie importée pour l'instant">
            Récupère tes parties chess.com ou colle un PGN ci-dessus.
          </EmptyState>
        )}
        <div className="table-scroll" hidden={!games?.length}>
          <table className="table" data-testid="imported-games">
            <thead>
              <tr>
                <th>Date</th>
                <th>Blancs</th>
                <th>Noirs</th>
                <th>Résultat</th>
                <th>Cadence</th>
                <th>Analyse</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {games?.map((g) => {
                const o = outcome(g);
                const player = (name: string, elo: number | null, me: boolean) => (
                  <span className={me ? 'me' : ''}>
                    {name}
                    {elo !== null && <span className="muted"> ({elo})</span>}
                  </span>
                );
                return (
                  <tr key={g.id}>
                    <td className="muted">{g.date ?? '—'}</td>
                    <td>{player(g.white, g.whiteElo, g.userColor === 'w')}</td>
                    <td>{player(g.black, g.blackElo, g.userColor === 'b')}</td>
                    <td className={o.className}>{o.text}</td>
                    <td className="muted">{g.timeControl ?? '—'}</td>
                    <td>
                      {g.review === 'done' ? (
                        <a href={`#/review/${g.id}`}>
                          {g.stats?.accuracy != null ? `${g.stats.accuracy} %` : 'Revue'}
                          {g.stats && g.stats.blunder > 0 && (
                            <span className="loss"> · {g.stats.blunder} ??</span>
                          )}
                        </a>
                      ) : g.review === 'queued' || g.review === 'running' ? (
                        <span className="muted icon-link">
                          <IconHourglass size={16} />
                          en cours
                        </span>
                      ) : (
                        <a href={`#/review/${g.id}`}>Analyser</a>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="link"
                        title="Supprimer"
                        aria-label="Supprimer la partie"
                        onClick={() =>
                          window.confirm('Supprimer cette partie importée ?') &&
                          void api.deleteImport(g.id).then(() => setRefresh((r) => r + 1))
                        }
                      >
                        <IconClose size={16} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
