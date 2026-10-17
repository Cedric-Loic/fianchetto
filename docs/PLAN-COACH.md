# Plan : plateforme Fianchetto et coach personnel

Statut : **étapes 6 et 7 terminées** (plateforme, variante classique, revue et import de
parties). Étapes 8 à 11 : en attente du GO.

## 1. Point de départ et objectif

| Donnée             | Valeur                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Elo chess.com      | 1000 en blitz, 950 en cadence lente (hypothèse : Rapide)                                   |
| Temps disponible   | 2 à 4 h par semaine                                                                        |
| Objectif           | 1600, dans 6 à 8 mois si possible, sinon la meilleure progression sur un an                |
| Cerveau du coach   | 100 % local (Stockfish + règles de détection), aucun service externe                       |
| Import des parties | PGN (hors ligne) + récupération chess.com en option (seule exception réseau, à la demande) |
| Puzzles            | sous-ensemble d'environ 150 000 puzzles de la base Lichess (CC0), stocké en local          |

### Réalisme (estimation, pas une promesse)

- Avec 2 à 4 h par semaine, **+600 Elo en 6 à 8 mois est peu probable**. Fourchette réaliste,
  en travaillant de façon régulière et ciblée :
  - à 8 mois : **1300 à 1450** ;
  - à 12 mois : **1450 à 1600**.
- 1600 en 8 mois devient plausible vers **5 à 6 h par semaine**.
- Le levier n° 1 à 1000 Elo est connu : la plupart des parties se perdent sur des **pièces
  laissées en prise et des tactiques simples ratées ou subies**. Le plan y consacre donc
  l'essentiel du temps au début. Ouvertures et finales viennent ensuite, à petite dose.

## 2. Semaine type (3 h)

| Activité                                             | Fréquence  | Durée  |
| ---------------------------------------------------- | ---------- | ------ |
| Puzzles du jour (thème de la semaine + révisions)    | 5 × 15 min | 75 min |
| Parties lentes (15+10), dont une contre le bot coach | 2 parties  | 60 min |
| Analyse de ses propres parties avec le coach         | 2 × 10 min | 20 min |
| Leçon de la semaine (théorie + exercices)            | 1          | 20 min |
| Blitz, facultatif, seulement après le reste          | libre      | —      |

Règle du coach : **pas de blitz tant que les puzzles du jour ne sont pas faits**. Une partie
lente analysée rapporte plus que dix parties de blitz.

## 3. Programme en 4 phases

| Phase | Mois | Thème principal            | Contenu                                                                                                                                                                                                                                                                             |
| ----- | ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 1–2  | **Ne plus rien donner**    | Routine avant chaque coup (échecs, prises, menaces), pièces en prise, attaque double, fourchette, clouage, enfilade, mats en 1 et 2, principes d'ouverture, mats de base (D+R, T+R).                                                                                                |
| 2     | 3–4  | **Calculer et punir**      | Tactiques en 2 et 3 coups, coups candidats, attaque découverte, déviation, surcharge, un répertoire d'ouvertures simple (Blancs : partie italienne ; Noirs : 1…e5 et 1…d5), pièges de ce répertoire, finales de pions (opposition, règle du carré), gestion de la pendule en blitz. |
| 3     | 5–6  | **Jouer avec un plan**     | Activité des pièces, colonnes ouvertes, cases fortes, pions faibles, sécurité du roi, convertir un avantage, finales de tours (Lucena, Philidor, tour active).                                                                                                                      |
| 4     | 7+   | **Programme personnalisé** | Le coach choisit les thèmes selon ton profil de faiblesses mesuré (section 5).                                                                                                                                                                                                      |

Passage d'une phase à l'autre : quand les indicateurs sont atteints, pas à date fixe. Exemple
pour la phase 1 : moins d'une gaffe par partie lente sur les 10 dernières parties.

## 4. Fonctionnalités du site

### 4.1 Plateforme et mode classique

- L'accueil propose un choix de mode : **Classique**, **Secret Queen**, **Entraînement**
  (coach).
- Le mode classique offre les mêmes modes de jeu que Secret Queen (bot à 5 niveaux, à deux sur
  l'écran) et les mêmes cadences.
- **Elo séparé** par mode.
- Affichage des coups légaux : **paramètre dans les réglages**, actif seulement en classique.
  Toujours interdit en Secret Queen, et vérifié par un test.
- Isolation : le code classique ne passe jamais par la projection Secret Queen. Les règles de
  sécurité du secret (lint, banc d'attaque) restent inchangées.

### 4.2 Analyse des parties

Sources des parties analysées :

- parties locales (classique, bot, à deux) ;
- import PGN (fichier ou copier-coller) ;
- option « Récupérer mes parties chess.com » via l'API publique, à partir du pseudo, sur clic
  explicite.

Contenu de l'analyse :

- **Analyse Stockfish** de chaque coup, faite par un worker en arrière-plan, avec courbe
  d'évaluation et précision.
- **Classification** (meilleur, excellent, bon, imprécision, erreur, gaffe, gain manqué). Elle
  se calcule sur la perte de probabilité de gain, comme Lichess.
- **Explications locales** produites par des détecteurs écrits à la main, sur le meilleur coup
  et sur le coup joué :
  - pièce laissée en prise ;
  - fourchette, clouage ou mat manqués ;
  - tactique adverse non vue ;
  - roi exposé ;
  - échange défavorable ;
  - finale mal convertie.
    Exemple : « 14…Cd4 ? laisse le fou e7 sans défense ; 15.Dxe7 gagne une pièce ».
- **Rejouer à partir d'une erreur** contre Stockfish pour trouver le bon plan.
- Les erreurs détectées alimentent les puzzles personnels et le profil de faiblesses.

### 4.3 Puzzles

- Une base locale d'environ 150 000 puzzles Lichess, filtrés de 600 à 2000.
  - Elle est téléchargée **une seule fois par un script d'installation**, et non au runtime.
  - Licence CC0, créditée dans `CREDITS.md`.
- Un classement puzzle propre (Glicko-2), et des puzzles choisis légèrement au-dessus de ton
  niveau.
- Des modes « thème du jour » (lié à la phase), « mes erreurs » (positions tirées de tes
  parties) et « révision ».
- Les puzzles ratés reviennent plus tard (répétition espacée : 1, 3, 7 puis 21 jours).

### 4.4 Leçons

- Environ 40 leçons courtes (15 à 20 min) qui suivent les phases ci-dessus. Contenu écrit en
  français, stocké dans le dépôt.
- Format : une explication, puis des positions interactives (« trouve le coup »), puis un quiz
  final. Une leçon est validée quand le quiz est réussi à 80 %.
- Tout est rédigé spécialement pour le projet, sans contenu copié d'un site.

### 4.5 Parties contre le bot coach

- Des bots d'entraînement classiques, réglés **légèrement au-dessus** de ton niveau.
- **Indices progressifs** à la demande :
  1. la zone de l'échiquier ;
  2. la pièce à jouer ;
  3. le coup.
- **Garde-fou** (option) : avant de valider un coup qui laisse une pièce en prise, le coach
  demande « Es-tu sûr ? ». Ce garde-fou est actif en phase 1, puis désactivé progressivement.
- Retour en arrière autorisé en mode entraînement (pas en partie classée).
- Bilan automatique en fin de partie : les 3 moments clés et un conseil.

### 4.6 Tableau de bord du coach

- **Plan de la semaine** : les tâches de la section 2, avec leur suivi.
- **Profil de faiblesses**, calculé sur tes 20 dernières parties analysées :
  - gaffes par partie ;
  - thèmes tactiques ratés ;
  - phase de jeu où tu perds le plus ;
  - temps restant au moment des erreurs.
- **Courbes** : Elo local, classement puzzle, précision, et Elo chess.com (saisi à la main ou
  récupéré en option).
- **Bilan mensuel** : indicateurs, comparaison avec l'objectif, ajustement du plan.

## 5. Indicateurs de progression

| Indicateur                         | Départ (à mesurer) | Cible 6 mois  |
| ---------------------------------- | ------------------ | ------------- |
| Gaffes par partie lente            | à mesurer          | < 0,5         |
| Classement puzzle                  | à mesurer          | +400          |
| Précision moyenne (parties lentes) | à mesurer          | +10 points    |
| Elo chess.com Rapide / Blitz       | 950 / 1000         | 1300+ / 1300+ |

Le point de départ est mesuré en important tes 50 dernières parties chess.com dès que l'analyse
existe.

## 6. Ordre de développement proposé

Chaque étape se termine par `pnpm check`, des tests de bout en bout, un commit et ton
validation.

| Étape | Contenu                                                                                                     | Valeur pour toi                       |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 6     | Plateforme : accueil multi-modes, **mode classique** (bot + à deux), Elo par mode, réglage des coups légaux | jouer des parties classiques en local |
| 7     | **Analyse et import** : analyse Stockfish complète, classification, détecteurs, import PGN et chess.com     | mesurer ton point de départ           |
| 8     | **Puzzles** : base Lichess, classement, thèmes, puzzles issus de tes erreurs, répétition espacée            | entraînement tactique quotidien       |
| 9     | **Bot coach** : indices, garde-fou, retour en arrière, bilan de partie                                      | jouer en apprenant                    |
| 10    | **Leçons** : moteur de leçons et 10 premières leçons (phase 1), puis les suivantes par lots                 | théorie guidée                        |
| 11    | **Tableau de bord** : plan hebdomadaire, profil de faiblesses, courbes, bilan mensuel                       | suivi et adaptation automatique       |

Pourquoi cet ordre : l'analyse et les puzzles arrivent tôt parce qu'ils apportent le plus de
progrès, et parce que les autres briques en dépendent (le profil de faiblesses alimente
puzzles, leçons et plan).

## 7. Choix techniques (résumé)

- **Moteur classique** : chess.js directement, sans aucun lien avec `SecretQueenGame`. Bots
  classiques : Stockfish existant, avec force bridée par niveau.
- **Analyse** : file d'attente de jobs dans un worker Stockfish (multipv 3, profondeur adaptée),
  résultats mis en cache dans SQLite.
- **Détecteurs** : fonctions pures et testées sur une banque de positions annotées. C'est la
  partie la plus délicate : on commence avec 6 détecteurs fiables plutôt que 20 approximatifs.
- **Données** :
  - nouvelles tables `puzzles`, `puzzle_attempts`, `lessons_progress`, `imported_games`,
    `analyses_v2`, `weakness_snapshots` ;
  - la base de puzzles est stockée dans un fichier SQLite séparé, non versionné.
- **Réseau** : seule la récupération chess.com y accède, à la demande, côté serveur. C'est une
  exception tracée dans `DECISIONS.md`.

## 8. Risques

| Risque                                            | Parade                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Explications locales trop mécaniques              | Phrases rédigées par type de faute, avec les coups concrets cités                            |
| Temps de travail réel inférieur à 2 h par semaine | Le tableau de bord le montre ; le plan réduit au minimum utile (puzzles + 1 partie analysée) |
| Étalonnage des bots (Elo annoncé ≠ force réelle)  | Ajustement à partir de tes résultats                                                         |
| Taille de la base de puzzles                      | Sous-ensemble filtré, téléchargé une seule fois                                              |
