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
| `pnpm check` vert, README complet, démo de chaque étape                                       | ✅   | `pnpm check` (lint, types, 291 tests) ; `pnpm test:e2e` (7 parcours navigateur) ; README ; captures Playwright dans `test-results/`                                                                                                                    |

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
