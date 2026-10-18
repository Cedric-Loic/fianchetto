// Faux worker du bot (tests du pilote). À « stop » : niveau 1 → se termine 200 ms plus tard
// (le temps d'arrêter un moteur) ; niveau 2 → ignore la demande (le pilote doit alors
// l'arrêter de force après le délai de grâce).
import { parentPort, workerData } from 'node:worker_threads';

parentPort?.on('message', (request) => {
  if (request === 'stop' && workerData.level === 1) setTimeout(() => process.exit(0), 200);
});
// Garde le worker en vie tant qu'il n'est pas arrêté.
setInterval(() => undefined, 1000);
