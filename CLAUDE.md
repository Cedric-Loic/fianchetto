# Secret Queen Chess — consignes pour Claude

Jeu d'échecs web personnel, servi en local (127.0.0.1), au look chess.com, avec un mode unique :
**Secret Queen** (chaque camp transforme en secret un de ses pions en dame).

À lire avant toute modification :

- `docs/SPEC.md` : cahier des charges d'origine ;
- `docs/RULES.md` : règles de référence précises (notation publique, fins de partie, projection) ;
- `docs/SECURITY.md` : modèle de menace du secret ;
- `docs/DECISIONS.md` : arbitrages (prime sur les autres documents).

## Règles d'or

1. **Le secret adverse ne sort jamais du serveur avant la fin de partie** : ni WebSocket, ni REST,
   ni erreur, ni log, ni bundle, ni stockage navigateur, ni identifiant de pièce.
2. Toute donnée réelle (position réelle, FEN réelle, SAN réelle, secrets) est enveloppée dans
   `Secret<T>` (`@sq/shared/secret`) ou dans une classe à champs privés dont `toJSON` et `inspect`
   renvoient « [REDACTED] ». `expose()` n'est autorisé que dans la liste blanche d'`eslint.config.js`.
3. Les contrats (`packages/shared`) ne changent que par décision de l'orchestrateur, tracée dans
   `docs/DECISIONS.md`.
4. Pas de surbrillance des coups légaux. Refus de coup sans motif.
5. Aucune dépendance réseau au runtime. Aucun asset, logo, police ou son de chess.com.

## Organisation (orchestrateur + sous-agents)

| Rôle                               | Dossiers en écriture                                            | Définition                      |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------- |
| orchestrateur (session principale) | racine, `packages/shared`, `config`, `docs`, `.claude`, `tools` | —                               |
| engine                             | `packages/engine`                                               | `.claude/agents/engine.md`      |
| server                             | `apps/server`                                                   | `.claude/agents/server.md`      |
| bot                                | `packages/bot`                                                  | `.claude/agents/bot.md`         |
| web                                | `apps/web`, `tests/e2e`                                         | `.claude/agents/web.md`         |
| qa-security                        | `tests/security` uniquement (lecture seule ailleurs)            | `.claude/agents/qa-security.md` |

- Seul l'orchestrateur modifie les `package.json` et `pnpm-lock.yaml` : un agent qui a besoin d'une
  dépendance la demande dans son rapport.
- Les agents ne commitent pas : l'orchestrateur relit, lance `pnpm check`, commite et pousse.

## Commandes

| Commande           | Effet                                                  |
| ------------------ | ------------------------------------------------------ |
| `pnpm dev`         | serveur (127.0.0.1:3001) + web (http://127.0.0.1:5173) |
| `pnpm check`       | Prettier, ESLint, types, tests unitaires               |
| `pnpm test`        | tests unitaires (Vitest)                               |
| `pnpm test:e2e`    | tests Playwright (lance `pnpm dev`)                    |
| `pnpm test:stress` | tests longs (10 000 parties aléatoires)                |
| `pnpm format`      | formate le code                                        |

Tests d'un seul paquet : `pnpm vitest run --project engine` (noms : shared, engine, bot, server,
web, security, lint-rules).

## Conventions

- TypeScript strict, ESM. Imports relatifs avec extension `.js` (sans extension dans `apps/web`, convention Vite).
- Identifiants en anglais ; commentaires, documentation et interface en français.
- Commentaires sur les parties non triviales uniquement. Code lisible par un développeur
  intermédiaire.
- `no-console` partout dans le code de production (le serveur utilise son logger).
