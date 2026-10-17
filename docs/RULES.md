# Règles de référence — Secret Queen

Document de référence pour `packages/engine`, `apps/server` et `tests/security`. Il précise le
cahier des charges (`docs/SPEC.md`, §3) avec les arbitrages validés (`docs/DECISIONS.md`).
En cas de divergence : DECISIONS.md > ce document > SPEC.md.

## 1. Position réelle

- La **position réelle** est une position d'échecs standard : le pion choisi par chaque camp y
  est remplacé par une dame, sur la même case. Le moteur standard fait foi pour la légalité.
- Conséquences automatiques d'un moteur standard (à prouver par des tests, pas à recoder) :
  - la dame secrète ne crée jamais de case de prise en passant et ne prend jamais en passant (H2) ;
  - arrivée en dernière rangée, elle reste une dame (pas de promotion) ;
  - un coup de dame secrète sans prise ne remet pas le compteur des 50 coups à zéro ;
  - elle donne échec, cloue, attaque les cases de roque comme une dame.
- Le secret de chaque camp est fixé avant le premier coup et ne change jamais. Il est identifié
  par l'identifiant de pièce du pion d'origine (ex. `wpe2`), qui suit la pièce jusqu'à sa capture.

## 2. Ce que voit un joueur (projection)

`projectForViewer(partie, spectateur)` produit un `ViewerBoardState` (`packages/shared`).

Contenu autorisé :

- pièces sur l'échiquier avec leur **type affiché** (la dame secrète est un `p`), triées par case ;
- trait, numéro de coup, historique des coups publics (`PublicMove`) ;
- annonce `inCheck` pour le camp au trait (jamais la case ni la pièce attaquante) ;
- pièces capturées (types affichés, dans l'ordre chronologique des prises) ;
- `ownSecret` : identifiant et case de la dame secrète **du spectateur lui-même** (`null` si
  capturée) ; toujours `null` pour le spectateur `public` ;
- `result` et `reveal` : non nuls **si et seulement si** la partie est terminée.

Contenu interdit avant la fin (fuite directe ou indirecte) :

- tout type réel, la FEN réelle, la notation réelle ;
- la **case de prise en passant** (elle existe après un double pas d'un vrai pion, pas après celui
  d'une dame secrète) ;
- le **compteur des 50 coups** (un coup de dame secrète ne le remet pas à zéro) ;
- les droits de roque, le nombre de répétitions, la liste des coups légaux, le motif d'un refus.

## 3. Notation publique (§3.7)

Pour un coup de la pièce P, de la case `from` à la case `to`, sur l'échiquier public B
(pièces affichées avant le coup) :

### 3.1 Pièce affichée « pion »

Le coup est **« de pion »** si et seulement si l'une des conditions suivantes est vraie
(avant = vers la 8e rangée pour les Blancs, vers la 1re pour les Noirs) :

1. c'est un vrai pion (tous ses coups légaux sont des coups de pion, y compris prise en passant et
   promotion) ;
2. c'est la dame secrète et le coup est géométriquement un coup de pion **sans promotion** :
   - `from` est sur une rangée qu'un pion peut occuper (2 à 7) ;
   - `to` n'est **pas** sur la dernière rangée (un vrai pion devrait s'y promouvoir) ;
   - et : avance d'une case vers une case vide ; ou avance de deux cases depuis la rangée de
     départ des pions, case intermédiaire et case d'arrivée vides ; ou avance d'une case en
     diagonale sur une case occupée par une pièce adverse.

   Une diagonale vers une case vide n'est jamais un coup de pion pour la dame secrète, même sur la
   case de prise en passant : elle ne prend pas en passant, le pion adverse reste en place.

- Coup de pion → notation de pion standard : `e4`, `exd5`, `exd6` (prise en passant), `e8=Q`.
- Sinon → coordonnées : `a2-d5`, ou `a2xd5` si `to` contient une pièce adverse.

### 3.2 Autres pièces affichées (N, B, R, Q, K)

- Notation SAN standard : `Nf3`, `Bxe5`, `O-O`, `O-O-O`.
- **Désambiguïsation calculée sur l'échiquier public, sans tenir compte des clouages ni des
  échecs** : on considère les autres pièces du même camp et du même **type affiché** qui pourraient
  atteindre `to` selon leur mouvement (pièces glissantes bloquées par toute pièce, case d'arrivée
  vide ou adverse). Règle SAN habituelle ensuite (colonne, sinon rangée, sinon les deux).
  - Raison 1 : la dame secrète (affichée pion) ne doit jamais provoquer de désambiguïsation entre
    dames (`Q1d3` trahirait une deuxième dame).
  - Raison 2 : un clouage par la dame secrète adverse ne doit jamais supprimer une
    désambiguïsation (le joueur apprendrait l'existence du clouage).
  - Conséquence assumée : la notation publique peut contenir une désambiguïsation que la SAN
    réelle omettrait.

### 3.3 Suffixes

`+` si le camp adverse est en échec dans la position réelle après le coup, `#` s'il est mat.
L'échec est une annonce publique (§3.4) ; le camp qui donne échec le sait toujours.

### 3.4 Notation réelle

SAN standard sur la position réelle (ex. `Qd5`). Uniquement dans `reveal`, après la fin.

## 4. Coups refusés (§3.5)

- Tout coup illégal dans la position réelle est refusé, sans pénalité ; le joueur rejoue.
- Le refus ne porte **aucun motif** (`move-rejected` sans raison) ; le client affiche toujours
  « Coup illégal. ». Il n'est communiqué qu'à l'auteur du coup (jamais à l'adversaire ni au bot
  adverse).
- Sondage : un refus renseigne sur la position réelle (ex. prise en passant refusée contre un
  « pion » qui a avancé de deux cases). C'est voulu et gratuit pour les humains. Le bot ne sonde
  jamais exprès : il apprend seulement des refus de coups qu'il voulait jouer.

## 5. Fins de partie

Toutes calculées sur la **position réelle**, déclarées **automatiquement** :

| Fin                  | Condition                                                                                         | Résultat                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mat                  | camp au trait en échec sans coup légal                                                            | victoire de l'autre camp                                                                        |
| Pat                  | camp au trait sans coup légal, pas en échec                                                       | nulle                                                                                           |
| Matériel insuffisant | aucun des deux camps ne peut mater (R/R, R+F/R, R+C/R, R+F/R+F même couleur)                      | nulle                                                                                           |
| 50 coups             | 100 demi-coups sans prise ni coup de vrai pion                                                    | nulle                                                                                           |
| Triple répétition    | même position réelle 3 fois (placement réel, trait, roques, prise en passant réellement possible) | nulle                                                                                           |
| Chute du drapeau     | pendule à 0                                                                                       | défaite, sauf si l'adversaire n'a pas de matériel suffisant pour mater (pièces réelles) → nulle |
| Abandon              | à tout moment pendant la phase de jeu                                                             | défaite                                                                                         |
| Nulle par accord     | proposition acceptée                                                                              | nulle                                                                                           |

- Une proposition de nulle reste valable jusqu'à la réponse de l'adversaire ou jusqu'à ce que
  celui-ci joue un coup. Un joueur ne peut pas reproposer avant d'avoir joué un nouveau coup.
- Nulle déclarée automatiquement plutôt que sur réclamation (FIDE) : un joueur ne peut pas
  connaître le vrai compteur ni la vraie position.

## 6. Choix du pion secret (§3.9)

- Candidats : les 8 pions du camp, désignés par leur case de départ (H1).
- 30 s pour choisir et verrouiller. Sans verrouillage à temps : tirage uniforme côté serveur avec
  un CSPRNG (`crypto.randomInt`). Le bot tire aussi uniformément avec `crypto.randomInt`.
- L'adversaire ne voit que « prêt ».
- Mode bot : choix simultanés. Hot-seat : Blancs puis Noirs, chacun précédé d'un écran de passage ;
  le chrono de 30 s démarre quand le joueur quitte l'écran de passage ; le plateau n'est jamais
  visible pendant le choix de l'autre.

## 7. Hot-seat

- Un seul écran, qui affiche la vue `public` (aucun secret).
- Pas d'écran de passage entre les coups.
- Bouton « Voir ma dame secrète » : agit pour le camp au trait ; le client demande la case au
  serveur (`peek-secret`) quand le bouton est enfoncé et l'efface au relâchement ; le marqueur
  disparaît aussi au changement de trait, même si le bouton reste enfoncé.
- Pas de premoves. Retournement automatique du plateau désactivé par défaut (option).

## 8. Révélation (§3.10)

À la fin seulement : écran de fin avec les deux dames, puis rejeu et analyse (FEN et notation
réelles, évaluation du moteur sur les positions réelles).

## 9. Inférences inhérentes au jeu (pas des fuites)

Ces déductions découlent des règles validées ; les tests de fuite ne doivent pas les signaler :

- un coup noté en coordonnées, un « pion » sur sa 1re rangée ou en dernière rangée ;
- un échec sans cause visible ;
- un coup refusé (voir §4) ;
- l'absence de nulle alors que la position **publique** s'est répétée 3 fois : possible seulement
  si la dame secrète a échangé sa case avec un vrai pion ; la répétition est jugée sur la position
  réelle (§3.8) ;
- les canaux auxiliaires (temps de réponse, taille des paquets) : hors périmètre (§4).
