# Secret Queen Chess

Jeu d'échecs web personnel, servi en local, au style chess.com, avec un mode unique :
**Secret Queen**. Avant la partie, chaque joueur désigne en secret un de ses 8 pions : ce pion
est en réalité une **dame**, mais il reste affiché comme un pion pour tout le monde jusqu'à
l'écran de fin. À l'adversaire de la démasquer.

- Modes : contre un bot (5 niveaux, partie classée Elo) ou à deux sur le même écran (hot-seat).
- Cadences : 1+0, 3+2, 5+0, 10+0 ou sans pendule.
- Serveur autoritatif : le secret adverse ne quitte jamais le serveur avant la fin de partie.

> **État : étape 3 terminée** : parties contre le bot (5 niveaux, classées Elo) avec comptes
> locaux, profil et classement, et parties à deux sur le même écran. Thèmes, sons, flèches,
> premoves et analyse arrivent à l'étape 4.

## Prérequis

- **Node.js ≥ 22.12** (`node -v`)
- **pnpm 10** : `corepack enable` (pnpm est fourni avec Node via corepack)

## Installation et lancement

```bash
pnpm install
pnpm dev
```

Puis ouvre <http://127.0.0.1:5173>, choisis les noms et la cadence, et clique sur « Jouer ». Le serveur écoute sur `127.0.0.1:3001` ; les deux écoutent
uniquement sur la boucle locale.

## Commandes

| Commande           | Effet                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`         | lance le serveur et le web, avec rechargement à chaud                                           |
| `pnpm check`       | formatage (Prettier), lint (ESLint), types (tsc), tests unitaires (Vitest)                      |
| `pnpm test`        | tests unitaires seulement                                                                       |
| `pnpm test:e2e`    | tests de bout en bout (Playwright) ; la première fois : `pnpm exec playwright install chromium` |
| `pnpm test:stress` | tests longs (10 000 parties aléatoires)                                                         |
| `pnpm verify`      | `pnpm check` puis `pnpm test:e2e`                                                               |
| `pnpm format`      | formate tout le code                                                                            |

## Structure

```
apps/
  server/        Fastify + WebSocket : parties, pendules, comptes, Elo, SQLite, bot
  web/           React + Vite + Zustand : toute l'interface
packages/
  shared/        contrats partagés (types + schémas Zod), Secret<T>
  engine/        règles : position réelle, légalité, fins de partie, projection par joueur
  bot/           bot à information imparfaite + analyse de fin de partie
tests/
  e2e/           parcours utilisateur (Playwright)
  security/      banc d'attaque : fuites du secret, règles
tools/
  eslint-plugin-secret/   règle de lint « secret/no-expose »
config/
  game.config.json        Elo (départ, K) et niveaux du bot
docs/
  SPEC.md        cahier des charges d'origine
  RULES.md       règles de référence précises
  SECURITY.md    modèle de menace du secret
  DECISIONS.md   journal des décisions
```

## Comment le secret est protégé (résumé)

Le serveur garde la **position réelle** (le pion choisi y est une dame) et calcule pour chaque
joueur une **vue projetée** où la dame secrète adverse est un pion. Le client n'a ni moteur de
règles ni accès au type `Secret<T>`, qui se masque (« [REDACTED] ») dans tout log ou sérialisation.
Détails et limites assumées (base SQLite, canaux auxiliaires) : [`docs/SECURITY.md`](docs/SECURITY.md).

## Feuille de route

| Étape | Contenu                                                        | État    |
| ----- | -------------------------------------------------------------- | ------- |
| 0     | Monorepo, contrats, CI locale, journal des décisions           | ✅      |
| 1     | Moteur (règles, projection, notation) + banc de tests de fuite | ✅      |
| 2     | Serveur + interface : partie hot-seat complète                 | ✅      |
| 3     | Bot, comptes, Elo, pendules                                    | ✅      |
| 4     | Thèmes, sons, flèches, premoves, rejeu et analyse              | à venir |
| 5     | Audit de sécurité du secret, recette                           | à venir |

## Licences et crédits

Usage strictement personnel. Aucun asset, logo, police ni son de chess.com. Crédits : voir `CREDITS.md`.
