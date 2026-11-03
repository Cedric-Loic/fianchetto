import { DEFAULT_SERVER_PORT } from '@sq/shared';
import { startServer } from './app.js';

const port = Number(process.env['PORT'] ?? DEFAULT_SERVER_PORT);

// Base de puzzles de remplacement (tests de bout en bout) ; sinon data/puzzles.db.
const puzzlesPath = process.env['FIANCHETTO_PUZZLES_DB'];

startServer(port, puzzlesPath ? { puzzlesPath } : {}).catch((error: unknown) => {
  process.stderr.write(`Démarrage du serveur impossible : ${String(error)}\n`);
  process.exit(1);
});
