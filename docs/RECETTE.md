# Recette finale

État au 2026-10-17, branche `claude/sleepy-hawking-d1s8ne`. Chaque exigence du cahier des charges
(`docs/SPEC.md`) est reliée à sa preuve : test automatisé, ou vérification manuelle à faire.

Légende : ✅ couvert par un test automatisé · 👁 à vérifier à l'œil · ⚠️ limite connue

## Définition de « terminé » (§10)

| Exigence                                                                                      | État | Preuve                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Indistinguabilité : deux secrets, mêmes coups publics → messages identiques pour l'adversaire | ✅   | `tests/security/server.test.ts` (WebSocket réel, bot scripté, le bot essuie des refus dans un seul des deux mondes) ; `tests/security/indistinguishability.test.ts` (projections, paires de mondes fast-check) ; 10 000 paires dans `pnpm test:stress` |
| Canari : aucun payload, store, stockage navigateur ni log serveur ne contient le secret       | ✅   | `server.test.ts` (FEN réelles absentes des messages et des logs niveau debug) ; `tests/security/e2e/browser.spec.ts` (frames WebSocket, localStorage, sessionStorage, IndexedDB, cookie illisible) ; `canary-engine.test.ts`                           |
| Rejeu après rafraîchissement ou reconnexion sans fuite                                        | ✅   | `server.test.ts` (reconnexion WebSocket en pleine partie) ; `browser.spec.ts` (rechargement de page)                                                                                                                                                   |
| `pnpm check` vert, README complet, démo de chaque étape                                       | ✅   | `pnpm check` (lint, types, 315 tests à l'étape 6) ; `pnpm test:e2e` (9 parcours navigateur) ; README ; captures Playwright dans `test-results/`                                                                                                        |

## Règles Secret Queen (§3)

| Exigence                                                                                                                     | État | Preuve                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| Position réelle standard, moteur standard fait foi (chess.js validé)                                                         | ✅   | perft initial 1-5, Kiwipete 1-4 (`packages/engine/test/perft-*.test.ts`)               |
| Dame secrète affichée pion jusqu'à la fin, aucune révélation visuelle                                                        | ✅   | `projection.test.ts` (sécurité), `browser.spec.ts`                                     |
| Échec annoncé sans case ni pièce attaquante                                                                                  | ✅   | `projection.test.ts` (moteur)                                                          |
| Coup illégal : message générique, sans pénalité                                                                              | ✅   | `refusal.test.ts`, contrat `move-rejected` sans motif, e2e hot-seat                    |
| Captures, matériel, notation sur types affichés                                                                              | ✅   | `notation.test.ts`, `projection.test.ts`                                               |
| Notation publique (pion standard / coordonnées, désambiguïsation publique)                                                   | ✅   | `notation.test.ts` (moteur et sécurité)                                                |
| Cas limites §3.8 (roque, en passant, promotion, 8e rangée, pat/mat, matériel, 50 coups, répétition, drapeau, abandon, nulle) | ✅   | `packages/engine/test/edge-cases.test.ts`                                              |
| Choix du pion en 30 s, tirage CSPRNG, adversaire voit « prêt »                                                               | ✅   | `apps/server/test/hotseat.test.ts`, `bot-games.test.ts`                                |
| Révélation à l'écran de fin, puis rejeu et analyse                                                                           | ✅   | e2e hot-seat (révélation, analyse) ; analyse refusée avant la fin (`analysis.test.ts`) |

## Confidentialité (§4)

| Vecteur                                             | État  | Preuve                                                                                                                         |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| Messages WebSocket, snapshots, reconnexion          | ✅    | `server.test.ts`, `browser.spec.ts`                                                                                            |
| Réponses REST et erreurs                            | ✅    | analyse 409 avant la fin, PGN public pendant la partie (`analysis.test.ts`) ; messages d'erreur génériques (relecture du code) |
| Bundle JS                                           | ✅    | `tests/security/bundle.test.ts` (ni moteur, ni bot, ni `Secret`, ni Stockfish, ni source map)                                  |
| localStorage / sessionStorage / IndexedDB           | ✅    | `browser.spec.ts` (seules les préférences d'affichage)                                                                         |
| Store de l'UI                                       | ✅    | ne contient que les snapshots reçus (vérifiés par le canari sur les frames)                                                    |
| Logs serveur                                        | ✅    | `server.test.ts` (capture niveau debug)                                                                                        |
| Export de notation                                  | ✅    | PGN public pendant, réel après (`analysis.test.ts`)                                                                            |
| Identifiants de pièces                              | ✅    | identifiant du pion d'origine (`projection.test.ts`)                                                                           |
| `Secret<T>` masqué + lint                           | ✅    | `packages/shared/test/secret.test.ts`, `tools/eslint-plugin-secret`                                                            |
| Base SQLite : secret seulement dans `secret_state`  | ✅ ⚠️ | `server.test.ts` ; lisible par l'administrateur local (limite assumée)                                                         |
| Hot-seat : marqueur seulement au maintien du bouton | ✅ ⚠️ | e2e hot-seat ; confiance physique (voir SECURITY.md)                                                                           |

## Bot (§5)

| Exigence                                                                       | État   | Preuve                                                                                       |
| ------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| Observation seule, aucun accès au secret humain                                | ✅     | `bot-games.test.ts` (observations identiques quel que soit le secret humain) ; worker séparé |
| Croyance mise à jour par les événements observables, monde réel jamais éliminé | ✅     | `packages/bot/test/belief.test.ts`                                                           |
| 5 niveaux, partie classée contre chacun, Elo mis à jour                        | ✅     | `bot-games.test.ts` (Stockfish réel)                                                         |
| Pendule gérée, temps de réflexion humain                                       | ✅     | `think-time.test.ts`                                                                         |
| Nulle selon l'évaluation, revanche acceptée                                    | ✅ / 👁 | code (`shouldAcceptDraw`), e2e revanche à vérifier à l'œil                                   |
| Force réelle des niveaux par rapport à l'Elo nominal                           | 👁      | à calibrer en jouant                                                                         |

## Interface (§6)

| Exigence                                                                          | État   | Preuve                                                             |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Glisser-déposer, clic-clic, premoves, flèches, retournement                       | ✅     | `tests/e2e/gameplay.spec.ts`, `premove.spec.ts`, `hotseat.spec.ts` |
| Pendules, captures, avantage matériel, liste des coups, navigation                | ✅ / 👁 | e2e ; rendu à vérifier à l'œil                                     |
| Accueil, choix du pion, écran de passage, fin, rejeu, analyse, profil, classement | ✅     | e2e hot-seat et bot                                                |
| Thèmes, pièces, sons                                                              | ✅ / 👁 | e2e thème ; sons à écouter                                         |
| Mode concentration                                                                | ✅     | `gameplay.spec.ts`                                                 |
| Aucun asset chess.com, aucun réseau au runtime                                    | ✅     | `CREDITS.md` ; pièces et sons locaux                               |

## Étape 6 : plateforme et variante classique

| Exigence                                                                      | État   | Preuve                                                                                 |
| ----------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Accueil multi-variantes (Classique par défaut, Secret Queen)                  | ✅     | `tests/e2e/classic.spec.ts`, specs Secret Queen (onglet sélectionné)                   |
| Classique à deux et contre le bot, sans choix secret                          | ✅     | `classic.spec.ts`, `apps/server/test/classic.test.ts`                                  |
| Notation SAN standard, mat, fins de partie, PGN, analyse                      | ✅     | `packages/engine/test/classic.test.ts`, `classic.test.ts` (serveur), `classic.spec.ts` |
| Pendule classique : départ après le premier coup des Blancs                   | ✅     | `apps/server/test/classic.test.ts`                                                     |
| Elo séparé par variante, migration de l'ancien Elo vers Secret Queen          | ✅     | `classic.test.ts` (serveur), `bot-games.test.ts`, `bot.spec.ts`, `classic.spec.ts`     |
| Coups possibles : réglage (actif par défaut), classique seulement             | ✅ / 👁 | `classic.spec.ts` (activé, désactivé) ; rendu à vérifier à l'œil                       |
| Secret Queen inchangé : `legalMoves` toujours nul, projections non croisables | ✅     | `projection.test.ts` (moteur et banc), `surface.test.ts`, `utils.test.ts` (scanner)    |
| Bot classique (un seul monde : la position réelle)                            | ✅     | `packages/bot/test/belief.test.ts`, `player.test.ts`                                   |
| Force réelle des niveaux du bot en classique                                  | 👁      | à calibrer en jouant                                                                   |

## Étape 7 : analyse et import de parties

| Exigence                                                                           | État   | Preuve                                                                  |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Classe de chaque coup, précision, bilan par camp                                   | ✅     | `packages/coach/test/review.test.ts`                                    |
| Explications : mat manqué/permis, pièce en prise, fourchettes, matériel, générique | ✅     | `packages/coach/test/explain.test.ts` (positions réelles)               |
| Revue d'une partie locale (classique et Secret Queen), refusée avant la fin        | ✅     | `apps/server/test/analysis.test.ts`, `classic.test.ts`, e2e hot-seat    |
| Import PGN (plusieurs parties, doublons, illisibles, camp de l'utilisateur)        | ✅     | `apps/server/test/review.test.ts`, `tests/e2e/coach.spec.ts`            |
| Import chess.com (archives, variantes ignorées, erreurs 404/502)                   | ✅ / 👁 | `review.test.ts` (faux serveur) ; à essayer avec ton vrai pseudo        |
| Parties importées privées                                                          | ✅     | `review.test.ts` (autre compte : 404)                                   |
| Analyse par lot, progression, point de départ                                      | ✅ / 👁 | `review.test.ts`, `coach.spec.ts` ; pertinence des explications à juger |

## Étape 8 : puzzles

| Exigence                                                                           | État   | Preuve                                                                                   |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Import de la base Lichess (filtres, tranches de classement, CSV et zstd)           | ✅ / 👁 | `apps/server/test/puzzles.test.ts` (échantillon) ; vrai téléchargement à lancer chez toi |
| Validation des coups par le serveur, autre mat accepté, coup illégal sans pénalité | ✅     | `puzzles.test.ts`                                                                        |
| Classement Glicko-2, indice = réussite non classée                                 | ✅     | `packages/coach/test/puzzles.test.ts`, `puzzles.test.ts`                                 |
| Révisions espacées (1, 3, 7, 21 jours)                                             | ✅     | `puzzles.test.ts`                                                                        |
| Mes erreurs : puzzles tirés des revues, autre bon coup accepté (Stockfish)         | ✅     | `puzzles.test.ts`, `packages/coach/test/puzzles.test.ts`                                 |
| Écran puzzles : coup adverse animé, solution, thème, réglage des coups possibles   | ✅ / 👁 | `tests/e2e/puzzles.spec.ts` (base de démonstration)                                      |

## Étape 9 : entraînement contre le bot

| Exigence                                                              | État   | Preuve                                                            |
| --------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Partie d'entraînement non classée, sans pendule, classique seulement  | ✅     | `apps/server/test/training.test.ts`, `tests/e2e/training.spec.ts` |
| Indices progressifs (idée, pièce, coup)                               | ✅ / 👁 | `training.test.ts`, `training.spec.ts` ; pertinence à juger       |
| Garde-fou avant une gaffe (sans souffler le meilleur coup)            | ✅     | `training.test.ts`, `packages/coach/test/explain.test.ts`, e2e    |
| Reprise de coups, y compris pendant la réflexion du bot               | ✅     | `training.test.ts`, `training.spec.ts`                            |
| Bilan du coach : 3 moments clés et un conseil ; revue lancée d'office | ✅     | `training.test.ts`, `coach.spec.ts`, `training.spec.ts`           |
| Rejouer à partir d'une erreur (partie depuis une FEN)                 | ✅     | `packages/engine/test/classic.test.ts`, `coach.spec.ts`           |

## Étape 10 : leçons

| Exigence                                                                 | État   | Preuve                                                           |
| ------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------- |
| 10 leçons de la phase 1 : texte, positions commentées, exercices         | ✅ / 👁 | `packages/coach/test/lessons.test.ts` ; qualité du texte à juger |
| Positions légales et solutions jouables                                  | ✅     | `lessons.test.ts`                                                |
| Solutions uniques (meilleur coup de Stockfish), pièges vraiment perdants | ✅     | `apps/server/test/lessons.stress.ts` (`pnpm test:stress`)        |
| Validation des coups par le serveur (exact, choix, tolérance Stockfish)  | ✅     | `apps/server/test/lessons.test.ts`                               |
| Progression : meilleur score, leçon validée à 80 %                       | ✅     | `lessons.test.ts`, `tests/e2e/lessons.spec.ts`                   |

## Étape 11 : tableau de bord du coach

| Exigence                                                              | État   | Preuve                                                         |
| --------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Phase du programme et critères de passage                             | ✅     | `packages/coach/test/dashboard.test.ts`                        |
| Plan de la semaine suivi (puzzles, parties lentes, analyses, leçon)   | ✅     | `dashboard.test.ts`, `apps/server/test/coach.test.ts`          |
| Profil de faiblesses (20 dernières parties : erreurs, phases, thèmes) | ✅     | `dashboard.test.ts`, `coach.test.ts`                           |
| Courbes : chess.com (en-têtes PGN), puzzle, précision, Elo classique  | ✅ / 👁 | `coach.test.ts`, `tests/e2e/dashboard.spec.ts` ; rendu à l'œil |
| Objectifs du plan et bilan mensuel                                    | ✅     | `dashboard.test.ts`                                            |
| Recommandations menant au bon exercice                                | ✅     | `dashboard.spec.ts`                                            |

## Étape 12 : interface, premove, analyse interactive

| Exigence                                                       | État   | Preuve                                                                    |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Logo, favicon, navigation et affichage mobile sans débordement | ✅ / 👁 | `tests/e2e/layout.spec.ts` ; captures à l'œil                             |
| Premove (bot, puzzles, leçons), réglage on/off                 | ✅     | `apps/web/test/usePremoves.test.ts`, `tests/e2e/board-input.spec.ts`      |
| Tout bouton autre que le gauche annule la pièce en main        | ✅     | `apps/web/test/Board.test.tsx`, `board-input.spec.ts`                     |
| Exploration de variantes, échiquier d'analyse (FEN, PGN)       | ✅     | `apps/web/test/tree.test.ts`, `tests/e2e/analysis-board.spec.ts`          |
| Moteur en direct à 3 lignes, menace ; FEN seule, sans partie   | ✅     | `apps/server/test/analysis-live.test.ts`, `review-modes.spec.ts`          |
| Schémas des explications (flèches, cases, ligne)               | ✅     | `packages/coach/test/explain.test.ts`                                     |
| Revue guidée, « Apprends de tes erreurs »                      | ✅     | `apps/web/test/moments.test.ts`, `learn.test.tsx`, `review-retry.test.ts` |
| chess.js absent de l'écran de partie et du chargement initial  | ✅     | `tests/security/bundle.test.ts`                                           |

## Étape 14 : plateau maximal et coach pédagogique

| Exigence                                                                   | État | Preuve                                                                                       |
| -------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| Plateau à la taille maximale sur chaque écran (3 tailles d'écran)          | ✅   | `tests/e2e/board-size.spec.ts`                                                               |
| Compétences, répétition espacée, parcours, séance du jour                  | ✅   | `packages/coach/test/{skills,plan}.test.ts`, `apps/server/test/learning.test.ts`             |
| Cartes de révision alimentées par le serveur (exercices, erreurs)          | ✅   | `apps/server/test/learning.test.ts`, `tests/e2e/coach.spec.ts`                               |
| Leçons v2 : exercices à cases, indices, parties commentées                 | ✅   | `apps/server/test/lessons-socratic.test.ts`, `tests/e2e/lessons.spec.ts`                     |
| Leçons de phase 3 et parties classiques, solutions vérifiées par Stockfish | ✅   | `pnpm test:stress` (`apps/server/test/lessons.stress.ts`)                                    |
| Partie coachée : seulement en entraînement classique, jamais Secret Queen  | ✅   | `apps/server/test/coached.test.ts`, `tests/security/coach-routes.test.ts`, `coached.spec.ts` |

## Limites connues (acceptées)

- Base SQLite lisible par l'administrateur local (§4).
- Canaux auxiliaires hors périmètre (§4). Effet de bord favorable : le temps de réflexion humain
  du bot masque en grande partie la durée de son calcul, qui dépendait du nombre de mondes
  possibles.
- Hot-seat : confiance physique ; tout onglet ouvert sur la même partie peut demander la case de
  la dame du camp au trait (serveur limité à 127.0.0.1, identifiant de partie aléatoire).
- Inférences inhérentes aux règles (`docs/RULES.md` §9) : coups refusés, coups notés en
  coordonnées, échecs sans cause visible.
- Pièces « alpha » : licence pour usage personnel non commercial.
