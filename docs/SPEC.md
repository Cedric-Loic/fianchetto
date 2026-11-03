# PROJET « Secret Queen Chess » : jeu d'échecs personnel inspiré de chess.com

> Cahier des charges d'origine, reproduit tel quel. Les précisions et arbitrages ultérieurs sont
> dans `docs/DECISIONS.md` (qui prime en cas de divergence) et `docs/RULES.md`.

## 0. Mode de travail (à lire en premier)
- Ne code rien tout de suite. Relis tout, résume ta compréhension en 10 lignes maximum, liste au plus 5 points encore ambigus, propose le plan, puis attends mon « GO ».
- Si une règle ou un point lié au secret est ambigu, arrête-toi et pose-moi la question. Pas de supposition silencieuse.
- Tu es l'orchestrateur et tu travailles avec des sous-agents (section 8).
- Je suis développeur de niveau intermédiaire : code lisible, README, commentaires sur les parties non triviales, une seule commande pour tout lancer.
- Tiens à jour docs/DECISIONS.md (une ligne par décision : date, choix, raison).

## 1. Objectif
Un jeu d'échecs web, jouable en local, qui reprend l'esthétique et l'ergonomie de chess.com, avec un mode unique et central : « Secret Queen ». Usage strictement personnel.

## 2. Décisions déjà prises
- Modes : contre un bot, et local sur le même écran (hot-seat). Pas de mode en ligne 1 contre 1.
- Comptes locaux avec classement Elo, uniquement contre le bot (par niveau). Le hot-seat n'est pas classé.
- Cadences : Bullet 1+0, Blitz 3+2 et 5+0, Rapide 10+0, sans pendule.
- Fonctions : glisser-déposer et clic-clic, historique des coups, sons, abandon, nulle, revanche, premoves, thèmes de plateau et de pièces, flèches et surlignages manuels (clic droit), analyse et rejeu après la partie.
- Plateforme : web servi en local, serveur sur ma machine, lié à 127.0.0.1 uniquement.
- Pas de surbrillance des coups légaux dans ce mode, pour personne.

## 3. Règles du Secret Queen (spécification)
3.1 La partie suit les règles FIDE. Avant le début, chaque joueur désigne en secret un de ses 8 pions. Ce pion est en réalité une dame : mouvements, captures et échecs de dame dès le premier coup. Pour tout le monde, elle est affichée comme un pion pendant toute la partie, jusqu'à l'écran de fin.

3.2 Implémentation : l'état réel est une position d'échecs standard où le pion choisi est remplacé par une dame. Le moteur standard fait foi pour la légalité. Le mode n'ajoute qu'une couche d'information (vue par joueur). Tu peux utiliser chess.js (MIT) si des tests prouvent qu'il gère les positions avec une dame supplémentaire ; sinon écris le moteur toi-même.

3.3 Aucune révélation visuelle : ni quand elle bouge comme une dame, ni quand elle capture, ni quand elle donne échec, ni quand elle est capturée. Pas de bouton « révéler ». C'est à l'adversaire de la détecter.

3.4 Échec : le joueur en échec reçoit « échec » (roi surligné, son), jamais la case ni la nature de la pièce attaquante. Mat et pat sont annoncés comme en standard.

3.5 Coup illégal : refusé avec un message générique, identique quel que soit le motif. Aucune pénalité, le joueur rejoue. Aucune surbrillance de coups ni de cases.

3.6 Capture de la dame secrète : affichée comme la capture d'un pion. La liste des captures, le compteur de matériel et la notation utilisent les types AFFICHÉS, jamais les types réels.

3.7 Notation publique : pour une pièce affichée « pion », notation de pion standard si c'est un coup de pion légal (e4, exd5), sinon coordonnées (a2-d5, a2xd5). Suffixes + et #. La notation réelle (Qd5) n'apparaît qu'en analyse après la fin.

3.8 Cas limites à implémenter, chacun avec au moins un test :
- roque (case traversée attaquée par une dame secrète : refusé, message générique) ;
- prise en passant (ne s'applique jamais à la dame secrète, voir H2) ;
- promotion d'un pion ordinaire (choix de la pièce) ;
- dame secrète arrivée en 8e rangée (reste dame, pas de promotion, toujours affichée pion) ;
- pat et mat impliquant une dame secrète ;
- matériel insuffisant (calculé sur les pièces réelles) ;
- règle des 50 coups (un coup de dame secrète ne remet pas le compteur à zéro) ;
- triple répétition (sur la position réelle) ;
- chute du drapeau, abandon, nulle par accord.

3.9 Choix avant la partie : chaque joueur choisit un de ses 8 pions avec une limite de 30 s et confirme pour verrouiller. Si le temps est écoulé, tirage aléatoire uniforme côté serveur (CSPRNG). L'adversaire voit seulement « prêt ». En hot-seat, les choix sont séquentiels avec écran de passage, et le plateau n'est jamais visible pendant le choix de l'autre.

3.10 Fin de partie : les deux dames sont révélées sur l'écran de fin, puis en rejeu et analyse, et seulement après.

## 4. Confidentialité du secret (exigence n°1)
- Le serveur est autoritatif. L'identité de la dame secrète adverse ne sort jamais du serveur vers le client d'un joueur, avant la fin de partie.
- Le serveur calcule une vue par joueur (projectForViewer). Elle contient les types affichés, plus la case de la dame secrète du joueur lui-même (marqueur discret visible par lui seul).
- Vecteurs à fermer : état initial, snapshots, rafraîchissement et reconnexion, messages WebSocket, réponses REST, messages d'erreur, bundle JS, localStorage / IndexedDB / sessionStorage, store de l'UI, logs console et logs serveur (visibles dans mon terminal), export de notation, liste des captures, compteur de matériel, identifiants de pièces (aucun ne doit encoder le secret).
- Type enveloppe Secret<T> dont toJSON, toString et inspect renvoient « [REDACTED] », pour éviter les fuites par log. Ajoute une règle de lint ou un test qui interdit de sérialiser un Secret.
- Base SQLite : le secret n'y est écrit que s'il est nécessaire à la reprise de partie, dans un champ dédié et jamais loggé. Limite assumée : je suis l'administrateur local, la protection vise le client et les logs, pas l'inspection de la base. Documente-le.
- Hors périmètre : canaux auxiliaires (temps de réponse, taille des paquets).
- Hot-seat : le marqueur de ma dame n'est visible que pendant que je maintiens un bouton « Voir ma dame secrète » (H4). Pas de premoves en hot-seat.

## 5. Bot
- Interface stricte : Bot.chooseMove(observation). L'observation ne contient que : la vue publique, le secret du bot lui-même, et les retours « coup refusé ». Le bot ne doit pas pouvoir accéder au secret du joueur humain, ni par le type ni par l'API.
- Comportement équitable : le bot maintient une croyance sur lequel des 8 pions du joueur est la dame. Il met à jour cette croyance à chaque événement observable :
  - un « pion » qui bouge de façon impossible pour un pion (diagonale sur case vide, recul, plusieurs cases hors rang initial) est certainement la dame ;
  - annonces d'échec sans cause visible ;
  - refus de ses propres coups ;
  - captures de pions.
- Approche suggérée : échantillonner des hypothèses selon la croyance, évaluer chaque hypothèse avec un moteur sur une position standard (le pion hypothétique est remplacé par une dame), puis agréger les coups proposés. Moteur au choix : Stockfish (UCI, niveaux via UCI_Elo / Skill Level, GPLv3, usage personnel OK) ou moteur maison alpha-bêta. Justifie ton choix dans DECISIONS.md.
- Le bot choisit son propre pion secret de façon uniforme au hasard.
- 5 niveaux, Elo nominal configurable dans un fichier de config. Le bot gère la pendule, accepte ou refuse une nulle selon son évaluation, et accepte la revanche.
- Elo du joueur : départ 1200, K=40 pendant les 20 premières parties puis K=20, paramétrable (H5).

## 6. Produit et interface (look chess.com, assets originaux)
- Thème sombre (fond ≈ #312e2b, panneaux ≈ #262421), plateau vert et crème (≈ #769656 / #eeeed2) avec coordonnées dans les cases, surlignage du dernier coup, case sélectionnée, animations de déplacement.
- Barres joueur au-dessus et en dessous du plateau : avatar, pseudo, Elo, pendule, pièces capturées et avantage matériel (types affichés).
- Panneau droit : liste des coups sur deux colonnes, navigation (début, précédent, suivant, fin), abandon, nulle, revanche, nouvelle partie.
- Interactions : glisser-déposer et clic-clic, premoves (en mode bot uniquement), flèches et surlignages au clic droit, bouton pour retourner le plateau.
- Écrans : accueil (choix du mode, du niveau, de la cadence), choix du pion secret (30 s), écran de passage (hot-seat), partie, fin de partie (révélation), rejeu et analyse (évaluation du moteur sur positions réelles, meilleur coup, courbe), profil (Elo, historique), classement local.
- Thèmes de plateau et de pièces sélectionnables. Pièces open source (ex. jeux Lichess), sons CC0. N'utilise AUCUN asset, logo, police ni son de chess.com : reproduis le style, pas les fichiers.
- Aucune dépendance au réseau externe au runtime.

## 7. Stack
Monorepo pnpm, TypeScript strict. Web : React + Vite + Zustand. Serveur : Node 20+, Fastify, WebSocket (ws) pour les parties (coups, pendule, bot), REST pour comptes, Elo et historique. SQLite (better-sqlite3 ou Drizzle). Validation Zod. Tests : Vitest, Playwright. Mots de passe hachés (argon2 ou bcrypt), sessions par cookie httpOnly. Commandes : pnpm dev (serveur + web), pnpm test, pnpm check (lint, types, tests).

## 8. Répartition en sous-agents (.claude/agents/*.md)
Chaque agent a des dossiers exclusifs. Les contrats partagés (packages/shared) sont écrits d'abord par l'orchestrateur et ne changent que par décision tracée.
- orchestrator (toi) : repo, contrats de packages/shared (PublicMove, ViewerGameState, GameEvent, BotObservation), DECISIONS.md, revue, intégration, passage des portes de validation.
- engine : packages/engine. Position réelle, secrets, légalité, fin de partie, projectForViewer, notation publique et réelle. Aucun I/O. Livrables : tests perft (position initiale jusqu'à la profondeur 5, Kiwipete jusqu'à 4), tests des cas limites du 3.8, tests de propriétés sur parties aléatoires.
- server : apps/server. Parties, pendule autoritative, sessions, WebSocket, REST, SQLite, Elo, tirage du pion secret, projection par joueur, orchestration du bot, logs sans secret.
- bot : packages/bot. Croyance, échantillonnage, intégration du moteur, 5 niveaux, interface observation-seule, API d'analyse (évaluation de positions réelles).
- web : apps/web. Toute l'UI de la section 6, plateau (pointer events, flèches, premoves), thèmes, sons, écrans de choix et de passage, rejeu et analyse. Le store ne contient que la vue reçue du serveur.
- qa-security : lecture seule sur le code de prod, écrit uniquement des tests. Rôle d'attaquant : cherche toute fuite du secret et toute règle mal gérée.

## 9. Plan par étapes (porte de validation après chaque étape ; je valide avant la suivante)
- Étape 0 : monorepo, contrats, CI locale, DECISIONS.md. Critère : pnpm check passe.
- Étape 1 : engine, avec en parallèle le squelette du banc de tests de fuite par qa-security. Critères : perft OK, cas limites du 3.8 testés, projectForViewer couvert à 100 %, 10 000 parties aléatoires sans violation d'invariant.
- Étape 2 : server et web en parallèle sur les contrats. Critère : partie hot-seat complète jouable de bout en bout, avec choix secret, passage d'écran, révélation à la fin.
- Étape 3 : bot, comptes, Elo, pendules. Critère : partie classée contre chacun des 5 niveaux, Elo mis à jour, bot sans accès au secret humain (vérifié par test).
- Étape 4 : finitions : thèmes, sons, flèches, premoves, rejeu et analyse, fidélité visuelle.
- Étape 5 : audit de sécurité du secret et recette finale.

## 10. Définition de « terminé »
- Test d'indistinguishabilité : pour deux choix de secret différents et une même suite de coups publique, légale dans les deux mondes et produisant les mêmes annonces (échec, fin), les messages envoyés au client adverse sont strictement identiques (hors horodatages et identifiants normalisés).
- Test canari : un secret marqué est injecté, aucun payload sortant, store, stockage navigateur ni log serveur ne le contient.
- Rejeu après rafraîchissement ou reconnexion : aucune fuite.
- pnpm check vert, README complet, démo de chaque étape.

## 11. Hypothèses que j'ai faites (à contester si besoin)
H1 : n'importe lequel des 8 pions est éligible.
H2 : la dame secrète n'est jamais capturable en passant et ne capture jamais en passant.
H3 : un mode classique (sans dame secrète, avec surbrillance des coups) est un bonus de priorité basse, car le moteur le permet gratuitement.
H4 : marqueur de la dame visible seulement en maintenant un bouton en hot-seat.
H5 : paramètres Elo et niveaux du bot.
H6 : Elo mis à jour pour toute partie contre le bot, quelle que soit la cadence.
