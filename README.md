# Fianchetto

Plateforme d'échecs web personnelle, servie en local, au style chess.com. Premier mode de jeu :
**Secret Queen**. Avant la partie, chaque joueur désigne en secret un de ses 8 pions : ce pion
est en réalité une **dame**, mais il reste affiché comme un pion pour tout le monde jusqu'à
l'écran de fin. À l'adversaire de la démasquer.

- Variantes : **Classique** (échecs standard, coups possibles affichés en option) et
  **Secret Queen**, chacune avec son propre Elo.
- Modes : contre un bot (5 niveaux, partie classée Elo) ou à deux sur le même écran (hot-seat).
- **Coach** : tableau de bord (phase du programme, plan de la semaine, recommandations, profil de
  faiblesses, courbes de progression, objectifs, bilan mensuel).
- **Leçons** (coach) : les 10 leçons de la phase 1 (routine anti-gaffe, tactiques de base, mats,
  ouverture), avec exercices validés par le serveur.
- **Entraînement contre le bot** (coach) : indices progressifs, garde-fou avant une gaffe,
  reprise de coups, bilan de fin de partie, rejouer à partir d'une erreur.
- **Puzzles** (coach) : base Lichess au niveau ou par thème, révisions des puzzles ratés,
  puzzles tirés de tes propres erreurs, classement puzzle (Glicko-2).
- **Analyse** (coach) : revue de chaque partie (classe de chaque coup, explication des erreurs,
  précision), import de parties PGN ou chess.com, mesure de ton point de départ.
- Cadences : 1+0, 3+2, 5+0, 10+0 ou sans pendule.
- Serveur autoritatif : le secret adverse ne quitte jamais le serveur avant la fin de partie.

> **État : étapes 0 à 11 terminées** (plateforme et coach complets ; leçons des phases 2 à 4 à venir) (Secret Queen, puis plateforme et variante classique).
> Recette et preuves : [`docs/RECETTE.md`](docs/RECETTE.md). Suite prévue (coach personnel) :
> [`docs/PLAN-COACH.md`](docs/PLAN-COACH.md).

## Prérequis

- **Node.js ≥ 22.12** (`node -v`) ; ≥ 22.15 pour `pnpm puzzles:import` (décompression zstd)
- **pnpm 10** : `corepack enable` (pnpm est fourni avec Node via corepack)

## Installation et lancement

```bash
pnpm install
pnpm dev
```

Puis ouvre <http://127.0.0.1:5173>, choisis la variante (Classique ou Secret Queen), les noms
et la cadence, et clique sur « Jouer ». Le serveur écoute sur `127.0.0.1:3001` ; les deux écoutent
uniquement sur la boucle locale.

## Commandes

| Commande              | Effet                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`            | lance le serveur et le web, avec rechargement à chaud                                                                                                                                            |
| `pnpm check`          | formatage (Prettier), lint (ESLint), types (tsc), tests unitaires (Vitest)                                                                                                                       |
| `pnpm test`           | tests unitaires seulement                                                                                                                                                                        |
| `pnpm test:e2e`       | tests de bout en bout (Playwright) ; la première fois : `pnpm exec playwright install chromium`                                                                                                  |
| `pnpm test:stress`    | tests longs (10 000 parties aléatoires)                                                                                                                                                          |
| `pnpm verify`         | `pnpm check` puis `pnpm test:e2e`                                                                                                                                                                |
| `pnpm format`         | formate tout le code                                                                                                                                                                             |
| `pnpm puzzles:import` | une seule fois : télécharge la base de puzzles Lichess (≈ 250 Mo, lus en flux) et en garde 150 000 (600 à 2000) dans `data/puzzles.db` ; `--file chemin.csv.zst` pour un fichier déjà téléchargé |

## Structure

```
apps/
  server/        Fastify + WebSocket : parties, pendules, comptes, Elo, SQLite, bot
  web/           React + Vite + Zustand : toute l'interface
packages/
  shared/        contrats partagés (types + schémas Zod), Secret<T>
  engine/        règles : position réelle, légalité, fins de partie, projection par joueur
  coach/         coach : classes des coups, précision, explications des erreurs, lecture PGN
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

## Comment jouer

1. **Connexion → Créer un compte** (comptes locaux, mot de passe haché).
2. **Choisis la variante** en haut de l'accueil : Classique ou Secret Queen.
   - **Classique** : la partie commence tout de suite. Les coups possibles de la pièce
     sélectionnée sont marqués (désactivable dans ⚙ Réglages).
   - **Secret Queen** : suis les étapes ci-dessous.
3. **Contre le bot** (Secret Queen) : choisis le niveau, la couleur et la cadence, puis ton pion
   secret (30 s).
   Ton propre pion-dame est marqué d'une petite couronne ♛, visible de toi seul.
4. **À deux sur cet écran** (Secret Queen) : chacun choisit son pion à tour de rôle (l'autre détourne le regard) ;
   pendant la partie, maintiens « Voir ma dame secrète » pour la retrouver.
5. Pendant la partie : glisser-déposer ou clic-clic, clic droit pour les flèches (ou pour
   annuler la pièce en main), premoves contre le bot, en puzzles et en leçons (clic droit pour
   les annuler, désactivables dans ⚙ Réglages), ⛶ pour le mode concentration.
6. À la fin (Secret Queen) : révélation des deux dames.
7. **Revue de la partie** (bouton de fin de partie, ou 📊 dans le profil) : Stockfish analyse
   chaque coup ; explication des imprécisions (?!), erreurs (?) et gaffes (??) avec flèches et
   cases marquées, « ▶ Voir la ligne », précision des deux camps. Le plateau est jouable :
   explore des variantes (← → ↑ ↓, f pour retourner), active le **Moteur** (3 lignes
   cliquables) et la **Menace** (touche x). **▶ Revue guidée** parcourt les moments clés avec
   le coach ; **Apprends de tes erreurs** te fait retrouver le bon coup à chaque erreur.
8. **Coach** (menu) : ta page d'accueil d'entraînement. Elle dit où tu en es (phase du plan et
   critères pour passer à la suivante), ce qu'il reste à faire cette semaine, et quoi faire
   maintenant ; les courbes suivent ton Elo chess.com (lu dans tes parties importées), ton
   classement puzzle et ta précision.
9. **Leçons** (menu) : lis la leçon, regarde les positions commentées, puis fais les exercices ;
   la leçon est validée à 80 % d'exercices réussis du premier coup.
10. **Entraînement** (accueil → Classique → Contre le bot → case « Entraînement avec le coach ») :
    partie non classée et sans pendule ; 💡 Indice (1 clic : l'idée, 2 : la pièce, 3 : le coup),
    ↶ Reprendre le coup, et le coach demande « Es-tu sûr ? » avant une gaffe (désactivable dans
    ⚙ Réglages). À la fin : la revue s'ouvre avec le **bilan du coach** (3 moments clés et un
    conseil). Dans toute revue, **↺ Rejouer d'ici** relance la partie depuis la position d'avant
    ton erreur.
11. **Puzzles** (menu ; lance d'abord `pnpm puzzles:import` une fois) :

- **Au niveau** : légèrement au-dessus de ton classement puzzle ;
- **Thème** : fourchette, clouage, mat en 2… (le thème du jour suit le plan de progression) ;
- **Révisions** : les puzzles ratés reviennent après 1, 3, 7 puis 21 jours ;
- **Mes erreurs** : les positions où tu t'es trompé dans tes parties analysées.
  💡 Indice : montre la pièce à jouer (une réussite avec indice ne compte pas au classement).

12. **Analyse** (menu) : importe tes parties chess.com (ton pseudo, 20 à 100 dernières) ou un
    fichier PGN, analyse-les (« Tout analyser ») et lis ton point de départ. L'import chess.com
    est le seul accès à Internet de l'application, uniquement quand tu cliques. L'onglet
    **Échiquier d'analyse** charge une FEN ou un PGN, avec le moteur en direct.

## Comment le secret est protégé (résumé)

Le serveur garde la **position réelle** (le pion choisi y est une dame) et calcule pour chaque
joueur une **vue projetée** où la dame secrète adverse est un pion. Le client n'a ni moteur de
règles ni accès au type `Secret<T>`, qui se masque (« [REDACTED] ») dans tout log ou sérialisation.
Détails et limites assumées (base SQLite, canaux auxiliaires) : [`docs/SECURITY.md`](docs/SECURITY.md).

## Feuille de route

| Étape | Contenu                                                        | État |
| ----- | -------------------------------------------------------------- | ---- |
| 0     | Monorepo, contrats, CI locale, journal des décisions           | ✅   |
| 1     | Moteur (règles, projection, notation) + banc de tests de fuite | ✅   |
| 2     | Serveur + interface : partie hot-seat complète                 | ✅   |
| 3     | Bot, comptes, Elo, pendules                                    | ✅   |
| 4     | Thèmes, sons, flèches, premoves, rejeu et analyse              | ✅   |
| 5     | Audit de sécurité du secret, recette                           | ✅   |
| 6     | Plateforme : variante classique, Elo par variante              | ✅   |
| 7     | Coach : revue de partie, import PGN et chess.com               | ✅   |
| 8     | Coach : puzzles (Lichess, thèmes, révisions, mes erreurs)      | ✅   |
| 9     | Coach : entraînement (indices, garde-fou, reprise), bilan      | ✅   |
| 10    | Coach : leçons (moteur et 10 leçons de la phase 1)             | ✅   |
| 11    | Coach : tableau de bord                                        | ✅   |
| 12    | Interface et logo, premove partout, analyse interactive        | ✅   |

## Licences et crédits

Usage strictement personnel. Aucun asset, logo, police ni son de chess.com. Crédits : voir `CREDITS.md`.
