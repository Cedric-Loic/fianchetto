import { createReadStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import * as zlib from 'node:zlib';
import Database from 'better-sqlite3';
import { bankSchema } from '../persistence/puzzles.js';

/*
 * Import (une seule fois) d'un sous-ensemble de la base de puzzles Lichess (licence CC0,
 * https://database.lichess.org/#puzzles) dans `data/puzzles.db`. Lecture en flux du CSV
 * compressé (zstd), filtre de qualité, répartition égale par tranche de 50 points de
 * classement ; le téléchargement s'arrête dès que toutes les tranches sont pleines.
 */

export const LICHESS_PUZZLES_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

export interface ImportOptions {
  /** Fichier local (.csv ou .csv.zst) ; sinon téléchargement depuis `url`. */
  file?: string;
  url?: string;
  dbPath: string;
  /** Nombre de puzzles visé. */
  max?: number;
  minRating?: number;
  maxRating?: number;
  /** Progression : nombre de puzzles retenus. */
  onProgress?: (kept: number, read: number) => void;
}

const BUCKET = 50;
/** Filtres de qualité : puzzles bien joués et appréciés, classement fiable. */
const MIN_POPULARITY = 80;
const MIN_PLAYS = 100;
const MAX_DEVIATION = 90;

function zstdDecompress(): NodeJS.ReadWriteStream {
  const create = (zlib as unknown as { createZstdDecompress?: () => NodeJS.ReadWriteStream })
    .createZstdDecompress;
  if (!create) {
    throw new Error(
      'Décompression zstd indisponible : Node ≥ 22.15 requis (ou décompresse le fichier et ' +
        'passe le .csv avec --file).',
    );
  }
  return create();
}

async function openSource(options: ImportOptions, abort: AbortController): Promise<Readable> {
  const compressed = options.file ? options.file.endsWith('.zst') : true;
  let raw: Readable;
  if (options.file) {
    raw = createReadStream(options.file);
  } else {
    const res = await fetch(options.url ?? LICHESS_PUZZLES_URL, { signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`Téléchargement impossible (HTTP ${res.status}).`);
    raw = Readable.fromWeb(res.body as never);
  }
  if (!compressed) return raw;
  const out = zstdDecompress();
  raw.on('error', (e) => out.emit('error', e));
  return raw.pipe(out) as unknown as Readable;
}

/** Importe les puzzles ; renvoie le nombre de puzzles enregistrés. */
export async function importPuzzles(options: ImportOptions): Promise<number> {
  const max = options.max ?? 150_000;
  const minRating = options.minRating ?? 600;
  const maxRating = options.maxRating ?? 2000;
  const buckets = Math.ceil((maxRating - minRating + 1) / BUCKET);
  const perBucket = Math.ceil(max / buckets);
  const filled = new Array<number>(buckets).fill(0);
  let full = 0;

  if (options.dbPath !== ':memory:') mkdirSync(dirname(options.dbPath), { recursive: true });
  const db = new Database(options.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(bankSchema(''));
  db.exec('DELETE FROM puzzles');
  const insert = db.prepare(
    `INSERT OR IGNORE INTO puzzles (id, fen, moves, rating, deviation, popularity, plays, themes,
       game_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const batch: unknown[][] = [];
  const flush = db.transaction((rows: unknown[][]) => {
    for (const row of rows) insert.run(...row);
  });

  const abort = new AbortController();
  const source = await openSource(options, abort);
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  let kept = 0;
  let read = 0;
  try {
    for await (const line of lines) {
      read++;
      // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
      const f = line.split(',');
      if (f.length < 9 || f[0] === 'PuzzleId') continue;
      const rating = Number(f[3]);
      const deviation = Number(f[4]);
      const popularity = Number(f[5]);
      const plays = Number(f[6]);
      if (!(rating >= minRating && rating <= maxRating)) continue;
      if (!(popularity >= MIN_POPULARITY && plays >= MIN_PLAYS && deviation <= MAX_DEVIATION)) {
        continue;
      }
      const bucket = Math.floor((rating - minRating) / BUCKET);
      if ((filled[bucket] ?? perBucket) >= perBucket) continue;
      filled[bucket] = (filled[bucket] ?? 0) + 1;
      if (filled[bucket] === perBucket) full++;
      batch.push([
        f[0],
        f[1],
        f[2],
        rating,
        deviation,
        popularity,
        plays,
        ` ${f[7]} `,
        f[8] || null,
      ]);
      kept++;
      if (batch.length >= 5000) {
        flush(batch.splice(0));
        options.onProgress?.(kept, read);
      }
      if (full === buckets) break;
    }
  } finally {
    flush(batch.splice(0));
    lines.close();
    abort.abort();
    source.destroy();
    db.close();
  }
  options.onProgress?.(kept, read);
  return kept;
}
