import { importPuzzles } from '../../apps/server/src/puzzles/importer.js';
import { E2E_PUZZLES_DB } from '../../playwright.config.js';

/** Remplit la base de puzzles des tests avec les puzzles de démonstration (format Lichess). */
export default async function globalSetup(): Promise<void> {
  const file = new URL('../../apps/server/test/fixtures/puzzles.csv', import.meta.url).pathname;
  await importPuzzles({ file, dbPath: E2E_PUZZLES_DB });
}
