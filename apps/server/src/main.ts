import { DEFAULT_SERVER_PORT } from '@sq/shared';
import { startServer } from './app.js';

const port = Number(process.env['PORT'] ?? DEFAULT_SERVER_PORT);

startServer(port).catch((error: unknown) => {
  process.stderr.write(`Démarrage du serveur impossible : ${String(error)}\n`);
  process.exit(1);
});
