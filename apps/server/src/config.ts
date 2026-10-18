import { readFileSync } from 'node:fs';
import { GameConfigSchema, type GameConfig } from '@sq/shared';

/** Lit config/game.config.json (Elo, niveaux du bot) ; un fichier invalide empêche le démarrage. */
export function loadConfig(): GameConfig {
  const url = new URL('../../../config/game.config.json', import.meta.url);
  return GameConfigSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}

/**
 * Rythme « humain » du bot (temps de réflexion simulé). `FIANCHETTO_HUMAN_PACE=0` (ou `false`)
 * le désactive : tests de bout en bout rapides. Activé par défaut.
 */
export function humanPaceFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env['FIANCHETTO_HUMAN_PACE']?.trim().toLowerCase();
  return value !== '0' && value !== 'false';
}
