import fc from 'fast-check';
import { it } from 'vitest';
import { runWorldPair } from './harness.js';
import { arbWorldPairScenario } from './world-pairs.js';

it('profil', () => {
  const scenarios = fc.sample(arbWorldPairScenario(220), { numRuns: 20, seed: 5 });
  for (const inv of [false, true]) {
    const t0 = performance.now();
    let plies = 0, attempts = 0, one = 0, ann = 0;
    for (const s of scenarios) {
      const r = runWorldPair(s, { maxPlies: 60, checkInvariants: inv });
      plies += r.committed.length; attempts += r.attempts; one += r.oneSided; ann += r.announcementMismatch;
    }
    const dt = performance.now() - t0;
    process.stdout.write(`inv=${inv} ${dt.toFixed(0)}ms total, ${(dt / 20).toFixed(1)}ms/paire, plies=${plies} attempts=${attempts} oneSided=${one} ann=${ann}\n`);
  }
}, 600_000);
