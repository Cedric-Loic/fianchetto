import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SERVER_PORT } from '@sq/shared';
import { startServer, type ServerOptions } from './app.js';

const port = Number(process.env['PORT'] ?? DEFAULT_SERVER_PORT);

// Base de puzzles de remplacement (tests de bout en bout) ; sinon data/puzzles.db.
const puzzlesPath = process.env['FIANCHETTO_PUZZLES_DB'];

// `--web` (pnpm start) : le serveur sert aussi le site compilé, sur le même port.
const webRoot = fileURLToPath(new URL('../../web/dist', import.meta.url));
const serveWeb = process.argv.includes('--web');
if (serveWeb && !existsSync(webRoot)) {
  process.stderr.write(
    'Site non compilé : lance « pnpm start » (qui compile avant de démarrer).\n',
  );
  process.exit(1);
}
const options: ServerOptions = {
  ...(puzzlesPath ? { puzzlesPath } : {}),
  ...(serveWeb ? { webRoot } : {}),
};

startServer(port, options)
  .then(() => {
    if (serveWeb) process.stdout.write(`Fianchetto : http://127.0.0.1:${port}\n`);
  })
  .catch((error: unknown) => {
    process.stderr.write(`Démarrage du serveur impossible : ${String(error)}\n`);
    process.exit(1);
  });
