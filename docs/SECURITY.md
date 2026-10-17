# Confidentialité du secret — modèle de menace

Exigence n°1 (`docs/SPEC.md` §4) : avant la fin de partie, l'identité de la dame secrète adverse
ne sort jamais du serveur vers le client d'un joueur, ni vers un log.

> État : tous les mécanismes sont en place et audités (étape 5). Preuves : `docs/RECETTE.md`.

## Ce qui est protégé

| Adversaire                 | Ce qu'il peut observer                                                                                    | Protection                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Joueur humain (navigateur) | messages WebSocket, réponses REST, bundle JS, stockage navigateur, store de l'UI, outils de développement | le serveur n'envoie que `projectForViewer` ; le client n'a ni moteur ni `Secret` |
| Bot                        | son `BotObservation`                                                                                      | le bot tourne dans un worker séparé qui ne reçoit que l'observation sérialisée   |
| Toi, au terminal           | logs du serveur                                                                                           | `Secret<T>` masqué, logger avec redaction, test canari sur les logs              |

## Ce qui n'est pas protégé (limites assumées)

- **Inspection de la base SQLite.** Le secret y est écrit, dans un champ dédié, uniquement pour
  reprendre une partie après un redémarrage du serveur. Tu es l'administrateur local : la
  protection vise le client et les logs, pas l'accès au fichier `data/*.db`.
- **Canaux auxiliaires** : temps de réponse, taille des paquets, temps de réflexion du bot.
- **Hot-seat, plusieurs onglets** : tout client connecté à une partie hot-seat peut demander la
  case de la dame du camp au trait (`peek-secret`). Atténuation : serveur limité à 127.0.0.1,
  identifiant de partie aléatoire.
- **Hot-seat** : la confiance est physique. Le joueur qui ne joue pas doit détourner le regard
  quand l'autre maintient « Voir ma dame secrète ». Le client ne reçoit la case que pendant le
  maintien du bouton, pour le camp au trait.
- **Inférences inhérentes aux règles** (coups refusés, coups notés en coordonnées, échecs sans
  cause visible…) : voir `docs/RULES.md` §9.

- **Revue et import (étape 7)** : la revue d'une partie locale n'est servie qu'une fois la partie
  terminée (409 avant), avec les droits de l'export PGN ; elle ne porte que sur les positions
  réelles déjà révélées. Les parties importées ne sont visibles que par leur propriétaire.
  L'import chess.com est le seul accès réseau : côté serveur, sur clic explicite, et seules les
  URL `https://api.chess.com/pub/player/…` sont suivies (pas d'URL arbitraire venue de la réponse).

## Mécanismes

1. **Serveur autoritatif.** Le client envoie des intentions (`ClientMessage`) et n'affiche que des
   snapshots projetés pour lui (`ServerMessage`).
2. **Projection par joueur.** `projectForViewer` (packages/engine) est la seule fonction qui
   produit ce qu'un joueur voit. Champs interdits : voir `docs/RULES.md` §2. `legalMoves` y est
   toujours `null`. La variante classique a sa propre projection (`projectClassic`), qui refuse
   une partie Secret Queen (champ privé d'une autre classe) : elle ne peut pas servir à lire une
   position réelle secrète.
3. **Liste blanche à l'envoi.** Chaque message sortant est passé par son schéma Zod
   (`ServerMessageSchema.parse`), qui supprime toute clé non déclarée, puis contrôlé : un payload
   contenant « [REDACTED] » est une erreur de programmation et n'est pas envoyé.
4. **`Secret<T>`** (`@sq/shared/secret`). Champ privé ; `toJSON`, `toString`, `inspect` renvoient
   « [REDACTED] » ; `structuredClone` perd la valeur. Lecture uniquement via `expose()`.
5. **Lint.**
   - `secret/no-expose` : `expose()` interdit hors liste blanche (`packages/engine/src/internal/`,
     `apps/server/src/persistence/`, tests).
   - `no-console` dans tout le code de production.
   - `apps/web` ne peut importer ni `@sq/shared/secret`, ni `@sq/engine`, ni `@sq/bot`, ni
     `chess.js`.
   - `packages/bot` ne peut pas importer `@sq/shared/secret`.
6. **Refus sans motif.** `move-rejected` ne contient que l'identifiant du coup ; le texte affiché
   est la constante `GENERIC_ILLEGAL_MOVE_MESSAGE`.
7. **Identifiants neutres.** `PieceId` = couleur + type affiché initial + case initiale ; la dame
   secrète garde l'identifiant de son pion.
8. **Pas de stockage navigateur de l'état de partie.** Au rafraîchissement, le client redemande un
   snapshot. Le stockage local ne sert qu'aux préférences (thème, sons).

## Tests de garantie (définition de « terminé », §10)

Fichiers : `tests/security/server.test.ts` (WebSocket, logs, base), `tests/security/bundle.test.ts`
(bundle JS), `tests/security/e2e/browser.spec.ts` (navigateur), et le banc du moteur
(`indistinguishability`, `canary-engine`, `projection`, `notation`, `refusal`).

- **Indistinguabilité** : deux secrets différents, même suite de coups publics légale dans les deux
  mondes, mêmes annonces → messages envoyés à l'adversaire strictement identiques (horodatages,
  pendules et identifiants normalisés).
- **Canari** : un secret marqué est injecté ; aucun payload sortant, store, stockage navigateur,
  bundle ni log serveur ne le contient.
- **Reconnexion** : rafraîchissement et reconnexion en cours de partie, sans fuite.
