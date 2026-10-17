import { readFileSync } from 'node:fs';
import { GameConfigSchema, type GameConfig } from '@sq/shared';

/** Lit config/game.config.json (Elo, niveaux du bot) ; un fichier invalide empêche le démarrage. */
export function loadConfig(): GameConfig {
  const url = new URL('../../../config/game.config.json', import.meta.url);
  return GameConfigSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}
