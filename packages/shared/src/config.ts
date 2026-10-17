import { z } from 'zod';
import { BotLevelSchema } from './game-state.js';

/**
 * Schéma du fichier de configuration `config/game.config.json` (Elo, niveaux du bot).
 * Lu par le serveur au démarrage ; une valeur invalide fait échouer le démarrage.
 */
export const GameConfigSchema = z.object({
  elo: z.object({
    initial: z.number().int().positive(),
    /** K appliqué pendant les `provisionalGames` premières parties classées. */
    kProvisional: z.number().positive(),
    provisionalGames: z.number().int().nonnegative(),
    /** K appliqué ensuite. */
    kEstablished: z.number().positive(),
  }),
  botLevels: z
    .array(
      z.object({
        level: BotLevelSchema,
        name: z.string().min(1),
        /** Elo nominal, utilisé comme classement fixe de l'adversaire. */
        elo: z.number().int().positive(),
      }),
    )
    .length(5),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;
