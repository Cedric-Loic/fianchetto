import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { importPuzzles, LICHESS_PUZZLES_URL } from '../src/puzzles/importer.js';

/*
 * `pnpm puzzles:import` : télécharge une seule fois la base de puzzles Lichess (≈ 250 Mo
 * compressés, lus en flux) et en garde un sous-ensemble dans data/puzzles.db.
 * Options : --file <chemin .csv ou .csv.zst> (fichier déjà téléchargé), --max, --min, --max-rating.
 */

const { values } = parseArgs({
  // « pnpm puzzles:import -- --file … » transmet aussi le « -- » : on l'ignore.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    file: { type: 'string' },
    max: { type: 'string', default: '150000' },
    min: { type: 'string', default: '600' },
    'max-rating': { type: 'string', default: '2000' },
    db: { type: 'string' },
  },
});

const dbPath = values.db ?? fileURLToPath(new URL('../../../data/puzzles.db', import.meta.url));
// pnpm lance le script depuis apps/server : un chemin relatif part du dossier d'origine.
const file = values.file ? resolve(process.env.INIT_CWD ?? process.cwd(), values.file) : undefined;
process.stdout.write(
  file
    ? `Lecture de ${file}…\n`
    : `Téléchargement de ${LICHESS_PUZZLES_URL} (lecture en flux, arrêt dès que c'est suffisant)…\n`,
);
const kept = await importPuzzles({
  ...(file ? { file } : {}),
  dbPath,
  max: Number(values.max),
  minRating: Number(values.min),
  maxRating: Number(values['max-rating']),
  onProgress: (n, read) => process.stdout.write(`\r${n} puzzles retenus sur ${read} lus…        `),
});
process.stdout.write(`\n${kept} puzzles enregistrés dans ${dbPath}.\n`);
