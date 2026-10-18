import type { Lesson } from './types.js';

/*
 * Phase 2 du plan : « calculer et punir ». Dix leçons : la méthode des coups candidats, les
 * motifs tactiques suivants (découverte, déviation, surcharge), le calcul en 2 et 3 coups, les
 * finales de pions (opposition, règle du carré) et les pièges du répertoire.
 */

export const PHASE_2: Lesson[] = [
  {
    id: 'coups-candidats',
    phase: 2,
    title: 'Les coups candidats',
    summary: 'Avant de jouer le premier coup qui vient, dresser la liste des coups forcés.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Le premier coup qui te vient à l’esprit n’est pas toujours le meilleur. Un joueur fort ne calcule pas ' +
          'plus vite : il **choisit mieux quoi calculer**. Avant de te décider, fais la liste de deux ou trois ' +
          '**coups candidats**, puis compare-les.',
      },
      {
        kind: 'text',
        title: 'Dans quel ordre chercher',
        body:
          'Commence toujours par les coups **forcés**, ceux qui laissent le moins de choix à l’adversaire :\n' +
          '1. les **échecs** ;\n' +
          '2. les **prises** ;\n' +
          '3. les **menaces** (attaque d’une pièce, menace de mat).\n' +
          'Un échec se calcule vite, car les réponses sont peu nombreuses. Ne t’arrête pas à la première prise ' +
          'gagnante : il y a peut-être mieux juste à côté.',
      },
      {
        kind: 'example',
        fen: '6k1/1r3ppp/8/8/3q4/5Q2/5PPP/4R1K1 w - - 0 1',
        caption:
          'Dxb7 gagne une tour, mais l’échec Te8 vient avant dans la liste : c’est mat, car le roi noir est ' +
          'enfermé par ses pions.',
        arrows: [
          ['e1', 'e8'],
          ['f3', 'b7'],
        ],
      },
      {
        kind: 'text',
        title: 'Comparer',
        body:
          'Pour chaque candidat, imagine la **meilleure réponse adverse**, pas celle qui t’arrange. Garde le coup ' +
          'qui laisse la meilleure position après cette réponse.',
      },
    ],
    exercises: [
      {
        fen: '6k1/1r3ppp/8/8/3q4/5Q2/5PPP/4R1K1 w - - 0 1',
        prompt: 'La tour b7 est offerte. Regarde d’abord les échecs, puis joue le meilleur coup.',
        mode: 'exact',
        solution: ['e1e8'],
        explanation:
          'Te8# : les échecs d’abord ! Le roi noir n’a pas de case de fuite et rien ne peut s’interposer en f8.',
      },
      {
        fen: 'r1bq3k/pp4pp/3p4/4N3/8/8/PP3PPP/4R1K1 w - - 0 1',
        prompt: 'Le pion d6 attaque ton cavalier. Avant de le reculer, cherche un coup forcé.',
        mode: 'exact',
        solution: ['e5f7', 'h8g8', 'f7d8'],
        explanation:
          'Cf7+ fourchette le roi h8 et la dame d8 : après le coup du roi, Cxd8. Reculer le cavalier aurait ' +
          'laissé les Noirs avec une pièce de plus.',
      },
      {
        fen: '4r1k1/5ppp/3n4/8/q4B2/8/3Q1PPP/4R1K1 w - - 0 1',
        prompt: 'Le cavalier d6 peut être pris de deux façons. Laquelle est la bonne ?',
        mode: 'exact',
        solution: ['f4d6'],
        explanation:
          'Fxd6 gagne une pièce. Dxd6 ?? perdrait aussitôt : la dame ne défend plus la tour e1, et Txe1 est mat. ' +
          'Deux candidats qui se ressemblent peuvent avoir des conséquences opposées.',
      },
    ],
  },
  {
    id: 'attaque-decouverte',
    phase: 2,
    title: 'L’attaque découverte',
    summary: 'Une pièce s’écarte et démasque l’attaque d’une autre pièce.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une **attaque découverte** se produit quand une pièce bouge et **ouvre la ligne** d’une tour, d’un fou ou ' +
          'd’une dame placés derrière elle. Le coup crée deux menaces : celle de la pièce qui bouge et celle de la ' +
          'pièce démasquée.',
      },
      {
        kind: 'text',
        title: 'L’échec à la découverte',
        body:
          'Le cas le plus fort : la pièce démasquée donne **échec**. L’adversaire doit s’occuper de son roi, et la ' +
          'pièce qui a bougé peut prendre ce qu’elle veut, même une pièce défendue. Quand la pièce qui bouge donne ' +
          'aussi échec, c’est un **échec double** : seul un coup du roi peut le parer.',
      },
      {
        kind: 'example',
        fen: 'r1bq2k1/pp3ppp/8/8/8/2NB4/PP3PPP/3R2K1 w - - 0 1',
        caption:
          'Le fou d3 masque la tour d1, qui vise la dame d8. Fxh7+ ouvre la colonne avec échec : après Rxh7, Txd8.',
        arrows: [
          ['d3', 'h7'],
          ['d1', 'd8'],
        ],
      },
      {
        kind: 'text',
        title: 'Repérer le motif',
        body:
          'Cherche les **alignements** : ta tour, ton fou ou ta dame d’un côté, une pièce adverse importante (roi, ' +
          'dame) de l’autre, et une de tes pièces entre les deux. Ce n’est pas encore une menace… jusqu’à ce que la ' +
          'pièce du milieu bouge avec gain de temps.',
      },
    ],
    exercises: [
      {
        fen: 'r1bq2k1/pp3ppp/8/8/8/2NB4/PP3PPP/3R2K1 w - - 0 1',
        prompt: 'Ta tour vise la dame noire, mais ton fou est devant. Gagne la dame.',
        mode: 'exact',
        solution: ['d3h7', 'g8h7', 'd1d8'],
        explanation:
          'Fxh7+ : la tour d1 attaque la dame et le fou donne échec. Les Noirs doivent répondre à l’échec, puis Txd8.',
      },
      {
        fen: 'r1bq2k1/ppp2ppp/3b4/8/8/N7/PPP2PPP/R1BQ2K1 b - - 0 1',
        prompt:
          'Les Noirs jouent. Les deux dames se font face : fais disparaître la pièce du milieu avec échec.',
        mode: 'exact',
        solution: ['d6h2', 'g1h2', 'd8d1'],
        explanation:
          '…Fxh2+ ! démasque la dame d8 avec échec. Après Rxh2, …Dxd1 : la dame blanche n’était défendue par ' +
          'personne.',
      },
      {
        fen: '2rq3k/pbp4p/6p1/4N3/8/1P6/PB3PPP/4R1K1 w - - 0 1',
        prompt:
          'Le cavalier e5 masque le fou b2, braqué sur le roi h8. Choisis bien la case du cavalier : gagne la dame.',
        mode: 'engine',
        solution: ['e5f7'],
        tolerance: 10,
        traps: ['e5d3'],
        explanation:
          'Cf7+ est un échec double (le cavalier et le fou) qui attaque aussi la dame d8 : après le coup du roi, ' +
          'Cxd8. Cc6+ marchait aussi. Cd3+ ? donne bien échec, mais ne menace rien d’autre.',
      },
    ],
  },
  {
    id: 'deviation',
    phase: 2,
    title: 'La déviation',
    summary: 'Forcer un défenseur à quitter son poste.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une pièce qui **défend** quelque chose d’important a un travail. La **déviation** consiste à l’obliger à ' +
          'quitter ce travail : par un **échec** qu’elle doit parer, ou par une **offrande** qu’elle doit prendre. ' +
          'Dès qu’elle s’écarte, ce qu’elle défendait tombe.',
      },
      {
        kind: 'example',
        fen: '3r4/pp3pk1/5qp1/8/3Q4/8/PP3PP1/6KR w - - 0 1',
        caption:
          'Le roi g7 est le seul défenseur de la dame f6. Th7+ ! l’attire en h7, loin de f6 : Rxh7, puis Dxf6.',
        arrows: [
          ['h1', 'h7'],
          ['d4', 'f6'],
        ],
        marks: ['g7'],
      },
      {
        kind: 'text',
        title: 'Méthode',
        body:
          '1. Repère une cible : une pièce ou une case qui n’a **qu’un seul défenseur**.\n' +
          '2. Cherche un coup qui **oblige** ce défenseur à bouger : échec, prise, menace plus grave.\n' +
          '3. Vérifie que la cible tombe vraiment après la réponse forcée.\n' +
          'Cousine de la déviation : l’**élimination du défenseur**, où l’on prend tout simplement la pièce qui défend.',
      },
    ],
    exercises: [
      {
        fen: '3r4/pp3pk1/5qp1/8/3Q4/8/PP3PP1/6KR w - - 0 1',
        prompt: 'Le roi noir protège sa dame. Éloigne-le, puis gagne la dame.',
        mode: 'exact',
        solution: ['h1h7', 'g7h7', 'd4f6'],
        explanation:
          'Th7+ ! Rxh7 (sinon la tour reste en h7 et la dame tombe quand même), puis Dxf6 : une tour contre une dame.',
      },
      {
        fen: '5rk1/5ppp/1q3n2/6B1/7Q/3B4/5PPP/6K1 w - - 0 1',
        prompt: 'Le cavalier f6 est le seul défenseur de h7. Fais-le disparaître.',
        mode: 'exact',
        solution: ['g5f6'],
        explanation:
          'Fxf6 ! élimine le défenseur de h7. Si …gxf6, Dxh7# (la dame est soutenue par le fou d3). Sinon, les ' +
          'Blancs restent avec une pièce de plus et l’attaque.',
      },
    ],
  },
  {
    id: 'surcharge',
    phase: 2,
    title: 'La surcharge',
    summary: 'Un défenseur qui a deux tâches ne peut pas tout faire.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une pièce est **surchargée** quand elle défend **deux choses à la fois**. Elle tient tant que personne ne ' +
          'touche à rien. Mais si tu attaques l’une de ses deux tâches, elle doit choisir : si elle prend, elle ' +
          'abandonne l’autre.',
      },
      {
        kind: 'example',
        fen: '1r4k1/5ppp/pq6/8/3Q4/8/P4PPP/4R1K1 w - - 0 1',
        caption: 'La tour b8 défend la dame b6 et la 8e rangée. Dxb6 ! : si …Txb6, Te8 est mat.',
        arrows: [
          ['d4', 'b6'],
          ['e1', 'e8'],
        ],
        marks: ['b8'],
      },
      {
        kind: 'text',
        title: 'Le réflexe',
        body:
          'Pour chaque pièce adverse qui défend, demande-toi : **que défend-elle d’autre ?** La tour du fond qui ' +
          'garde la dernière rangée et une pièce, la dame qui garde un mat et une pièce, sont les victimes ' +
          'classiques.',
      },
    ],
    exercises: [
      {
        fen: '1r4k1/5ppp/pq6/8/3Q4/8/P4PPP/4R1K1 w - - 0 1',
        prompt: 'La tour b8 a deux tâches. Profite-en.',
        mode: 'exact',
        solution: ['d4b6'],
        explanation:
          'Dxb6 ! La tour ne peut pas reprendre : …Txb6 permettrait Te8#. Les Blancs gagnent la dame.',
      },
      {
        fen: '3r2k1/pp3ppp/2n5/3b4/8/8/P4PPP/3RR1K1 w - - 0 1',
        prompt: 'La tour d8 défend le fou d5 et la 8e rangée. Gagne une pièce.',
        mode: 'exact',
        solution: ['d1d5'],
        explanation:
          'Txd5 ! Si …Txd5, Te8 est mat. La tour d8 ne pouvait pas garder à la fois le fou et la dernière rangée.',
      },
    ],
  },
  {
    id: 'tactiques-2-coups',
    phase: 2,
    title: 'Les tactiques en 2 coups',
    summary: 'Un premier coup forcé prépare le coup qui gagne.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body:
          'Beaucoup de combinaisons tiennent en deux coups : un **premier coup forcé** (échec, sacrifice qu’il faut ' +
          'prendre) qui place une pièce adverse sur une mauvaise case, puis le **coup qui gagne** (mat, fourchette, ' +
          'prise). Le secret : après ton premier coup, compte les réponses possibles. S’il n’y en a qu’une, tu peux ' +
          'calculer la suite sans risque.',
      },
      {
        kind: 'example',
        fen: '3r3k/6pp/1q5N/8/2Q5/8/5PPP/6K1 w - - 0 1',
        caption:
          'Dg8+ ! : le roi ne peut pas prendre (le cavalier h6 défend g8), la tour doit le faire… et Cf7 est mat, ' +
          'le roi étant étouffé par ses propres pièces.',
        arrows: [
          ['c4', 'g8'],
          ['h6', 'f7'],
        ],
      },
      {
        kind: 'text',
        title: 'Visualiser',
        body:
          'Calcule sans toucher les pièces : après le premier coup, **revois la position dans ta tête** et ' +
          'demande-toi ce qui a changé (quelle case s’est libérée, quelle pièce a été attirée). C’est l’exercice qui ' +
          'fait le plus progresser en tactique.',
      },
    ],
    exercises: [
      {
        fen: '3r3k/6pp/1q5N/8/2Q5/8/5PPP/6K1 w - - 0 1',
        prompt: 'Mat en 2.',
        mode: 'exact',
        solution: ['c4g8', 'd8g8', 'h6f7'],
        explanation:
          'Dg8+ Txg8 Cf7# : c’est le **mat étouffé**. La tour a été attirée en g8 et bouche la dernière case du roi.',
      },
      {
        fen: '7r/pp3pk1/b5p1/8/6n1/2N5/PP3PP1/3QR1K1 b - - 0 1',
        prompt: 'Les Noirs jouent. Un sacrifice attire le roi blanc sur une case de fourchette.',
        mode: 'exact',
        solution: ['h8h1', 'g1h1', 'g4f2'],
        explanation:
          '…Th1+ ! Rxh1 (le fou a6 interdit f1), puis …Cxf2+ fourchette le roi et la dame d1.',
      },
    ],
  },
  {
    id: 'tactiques-3-coups',
    phase: 2,
    title: 'Les tactiques en 3 coups',
    summary: 'Enchaîner des coups forcés jusqu’au mat.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body:
          'Calculer trois coups paraît difficile, mais une suite d’**échecs** se calcule facilement : à chaque coup, ' +
          'l’adversaire n’a qu’une ou deux réponses. Le principe reste le même qu’en deux coups, avec une étape de ' +
          'plus : vérifie à chaque coup **toutes** les réponses adverses, pas seulement celle que tu espères.',
      },
      {
        kind: 'example',
        fen: '5rk1/1R2R1pp/8/8/8/8/5PPK/3q4 w - - 0 1',
        caption:
          'Deux tours sur la 7e rangée : Texg7+ Rh8, Txh7+ Rg8, Tbg7#. Chaque tour protège l’autre.',
        arrows: [
          ['e7', 'g7'],
          ['b7', 'g7'],
        ],
      },
      {
        kind: 'text',
        title: 'Le mat étouffé complet',
        body:
          'Le motif de la leçon précédente se prépare souvent par un échec double : le cavalier donne échec en ' +
          'découvrant la dame, le roi doit retourner dans le coin, puis le sacrifice de dame et le mat.',
      },
    ],
    exercises: [
      {
        fen: '5rk1/1R2R1pp/8/8/8/8/5PPK/3q4 w - - 0 1',
        prompt: 'Les Noirs ont une dame de plus. Mat en 3.',
        mode: 'exact',
        solution: ['e7g7', 'g8h8', 'g7h7', 'h8g8', 'b7g7'],
        explanation:
          'Texg7+ Rh8, Txh7+ Rg8, Tbg7# : les deux tours se protègent mutuellement, le roi n’a plus de case.',
      },
      {
        fen: '3r2k1/5Npp/1q6/8/2Q5/8/5PPP/6K1 w - - 0 1',
        prompt: 'Mat en 3 : commence par un échec double.',
        mode: 'exact',
        solution: ['f7h6', 'g8h8', 'c4g8', 'd8g8', 'h6f7'],
        explanation:
          'Ch6+ (échec double du cavalier et de la dame) Rh8, Dg8+ ! Txg8, Cf7# : le mat étouffé. Si …Rf8 au ' +
          'premier coup, Df7 est mat.',
      },
    ],
  },
  {
    id: 'opposition',
    phase: 2,
    title: 'Finales de pions : l’opposition',
    summary: 'Quand les rois se font face, celui qui ne doit pas jouer gagne la bataille.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body:
          'Dans les finales de pions, le roi est une pièce d’attaque. Deux rois ne peuvent pas se toucher : quand ils ' +
          'se font face avec **une case entre eux** (sur une colonne, une rangée ou une diagonale), on dit qu’ils ' +
          'sont **en opposition**. Celui qui **n’a pas le trait** « a l’opposition » : l’autre doit céder le ' +
          'passage.',
      },
      {
        kind: 'example',
        fen: '8/3k4/8/3K4/3P4/8/8/8 b - - 0 1',
        caption:
          'Le roi blanc est devant son pion, en opposition, et c’est aux Noirs de jouer : ils doivent s’écarter, ' +
          'le roi blanc avance et escorte le pion. Les Blancs gagnent.',
        arrows: [['d5', 'd7']],
        marks: ['d6'],
      },
      {
        kind: 'text',
        title: 'Les règles à retenir (roi + pion contre roi)',
        body:
          '1. L’attaquant place son roi **devant** son pion, pas à côté.\n' +
          '2. Il cherche à **prendre l’opposition** pour forcer le roi adverse à reculer.\n' +
          '3. Un coup de pion en réserve sert de **coup d’attente** pour reprendre l’opposition.\n' +
          '4. Le défenseur, lui, reste devant le pion et **prend l’opposition** chaque fois qu’il le peut : c’est nulle.',
      },
    ],
    exercises: [
      {
        fen: '8/3k4/8/8/3K4/3P4/8/8 w - - 0 1',
        prompt: 'Les Blancs jouent et gagnent : avance ton roi au bon endroit.',
        mode: 'engine',
        solution: ['d4d5'],
        tolerance: 10,
        traps: ['d4c4', 'd4e3'],
        explanation:
          'Rd5 ! prend l’opposition devant le pion : le roi noir doit céder et le roi blanc gagne du terrain (Rc5 et ' +
          'Re5 gagnent aussi). Un coup timide comme Rc4 ou Re3 laisse les Noirs prendre l’opposition : nulle.',
      },
      {
        fen: '8/4k3/8/8/4PK2/8/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent et font nulle : où placer le roi ?',
        mode: 'engine',
        solution: ['e7f6'],
        tolerance: 10,
        traps: ['e7f7', 'e7d6'],
        explanation:
          '…Rf6 ! prend l’opposition face au roi f4 : le roi blanc ne peut plus avancer. Après …Rf7 ? ou …Rd6 ?, ' +
          'Rf5 ou Re5 place le roi blanc devant son pion avec l’opposition : les Blancs gagnent.',
      },
      {
        fen: '8/8/3k4/8/2K5/3P4/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent. Un seul coup fait nulle.',
        mode: 'exact',
        solution: ['d6c6'],
        explanation:
          '…Rc6 ! : opposition face au roi c4. Toute autre case laisse le roi blanc avancer en c5 ou d5, devant son ' +
          'pion, et les Blancs gagnent.',
      },
    ],
  },
  {
    id: 'regle-du-carre',
    phase: 2,
    title: 'Finales de pions : la règle du carré',
    summary: 'Savoir d’un coup d’œil si le roi rattrape le pion.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un pion passé file vers la promotion ; le roi adverse peut-il le rattraper ? Pas besoin de compter les ' +
          'coups un par un : trace le **carré** du pion. Un côté va du pion jusqu’à sa case de promotion, et le carré ' +
          's’étend du même nombre de cases vers le roi adverse.',
      },
      {
        kind: 'text',
        title: 'La règle',
        body:
          'Si le roi adverse est **dans le carré**, ou peut y entrer **au coup qu’il va jouer**, il rattrape le pion. ' +
          'Sinon, le pion va à dame. Attention au trait : si c’est au camp du pion de jouer, trace le carré à partir ' +
          'de la case où le pion va arriver.',
      },
      {
        kind: 'example',
        fen: '8/8/8/5k2/P7/8/8/7K w - - 0 1',
        caption:
          'Les Blancs jouent a5 : le carré devient a5-d5-d8-a8. Le roi f5 n’y entre pas en un coup : le pion va à dame.',
        arrows: [['a4', 'a5']],
        marks: ['a5', 'd5', 'd8', 'a8'],
      },
      {
        kind: 'text',
        title: 'Les exceptions',
        body:
          'La règle ne compte que les deux rois et le pion : si une pièce barre la route du roi, ou si le pion est ' +
          'encore sur sa case de départ (il peut avancer de deux cases), recompte.',
      },
    ],
    exercises: [
      {
        fen: '8/8/8/5k2/P7/8/8/7K w - - 0 1',
        prompt: 'Les Blancs jouent. Le roi noir peut-il rattraper le pion ? Joue le coup gagnant.',
        mode: 'engine',
        solution: ['a4a5'],
        tolerance: 10,
        traps: ['h1g2'],
        explanation:
          'a5 ! : le roi f5 est hors du carré a5-d8, le pion va à dame. Après Rg2 ?, les Noirs jouent …Re5 et entrent ' +
          'dans le carré : nulle.',
      },
      {
        fen: '8/8/8/8/P4k2/8/8/7K b - - 0 1',
        prompt: 'Les Noirs jouent. Entre dans le carré du pion pour faire nulle.',
        mode: 'engine',
        solution: ['f4e5'],
        tolerance: 10,
        traps: ['f4f5', 'f4e3'],
        explanation:
          '…Re5 (ou …Re4) entre dans le carré a4-e8 et rattrape le pion. …Rf5 ? avance mais reste hors du carré : ' +
          'a5 et le pion va à dame.',
      },
    ],
  },
  {
    id: 'pieges-italienne',
    phase: 2,
    title: 'Pièges de la partie italienne (Blancs)',
    summary: 'Punir les erreurs typiques des Noirs après 1. e4 e5 2. Cf3 Cc6 3. Fc4.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body:
          'Avec les Blancs, ton répertoire est la **partie italienne** : 1. e4 e5 2. Cf3 Cc6 3. Fc4. Le fou c4 vise ' +
          'f7, le point faible du camp noir, défendu seulement par le roi. À ton niveau, beaucoup d’adversaires ' +
          'commettent les mêmes erreurs : les connaître rapporte des points tout de suite.',
      },
      {
        kind: 'example',
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
        caption:
          'Le fou g4 cloue le cavalier f3… seulement en apparence. Cxe5 ! : si …Fxd1 ??, Fxf7+ Re7 et Cd5 est mat.',
        arrows: [
          ['f3', 'e5'],
          ['c4', 'f7'],
          ['c3', 'd5'],
        ],
      },
      {
        kind: 'text',
        title: 'Ne pas tomber dans le piège adverse',
        body:
          'Après 3. Fc4, le coup 3…Cd4 tend un piège : 4. Cxe5 ?? Dg5 ! attaque le cavalier e5 et le pion g2, et ' +
          'les Noirs gagnent. La bonne réponse est simple : 4. Cxd4 exd4, et les Blancs ont un bon développement.',
      },
    ],
    exercises: [
      {
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
        prompt:
          'Les Noirs ont joué …g6 ? Le fou g4 cloue ton cavalier… vraiment ? Joue le coup fort, puis mate.',
        mode: 'exact',
        solution: ['f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'],
        explanation:
          'Cxe5 ! Fxd1 ?? Fxf7+ Re7 Cd5# : le mat de Légal. Si les Noirs ne prennent pas la dame (…dxe5), Dxg4 ' +
          'et les Blancs ont gagné un pion.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        prompt: 'Les Noirs ont joué 3…Cd4. Le pion e5 a l’air gratuit… Joue un bon coup.',
        mode: 'engine',
        solution: ['f3d4'],
        tolerance: 8,
        traps: ['f3e5'],
        explanation:
          'Cxd4 exd4 (ou le roque) : simple et bon. Cxe5 ?? tombe dans le piège : …Dg5 attaque le cavalier e5 et le ' +
          'pion g2, et les Noirs gagnent du matériel.',
      },
      {
        fen: 'r1bq1b1r/ppp2kpp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R w KQ - 0 7',
        prompt:
          'Défense des deux cavaliers : 4. Cg5 d5 5. exd5 Cxd5 ?! 6. Cxf7 ! Rxf7. Continue l’attaque avec un échec.',
        mode: 'exact',
        solution: ['d1f3'],
        explanation:
          'Df3+ ! attaque le roi et le cavalier d5, cloué contre le roi par le fou c4. Après …Re6, Cc3 met une ' +
          'pièce de plus sur d5 : le roi noir est en grand danger.',
      },
      {
        fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
        prompt: 'Après 4. Cg5 d5 5. exd5 Cxd5 ?!, f7 est faible. Joue un coup qui le prouve.',
        mode: 'choice',
        solution: ['g5f7'],
        accepted: ['g5f7', 'd2d4'],
        explanation:
          'Cxf7 ! (l’attaque « foie frit ») ou d4 ! ouvrent le jeu contre le roi noir. Le coup juste pour les ' +
          'Noirs au 5e coup était 5…Ca5.',
      },
    ],
  },
  {
    id: 'pieges-noirs',
    phase: 2,
    title: 'Pièges contre 1…e5 et la scandinave (Noirs)',
    summary: 'Défendre f7, punir les coups gourmands, surveiller la 5e rangée.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body:
          'Avec les Noirs, ton répertoire est **1…e5** contre 1. e4, et la **scandinave** (1. e4 d5) quand tu veux ' +
          'surprendre. Deux idées à garder en tête : protéger **f7** contre les attaques rapides, et profiter des ' +
          'pièces blanches qui s’aventurent sans défense.',
      },
      {
        kind: 'example',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        caption:
          'Le coup du berger : la dame h5 et le fou c4 visent f7. …Cf6 ?? permettrait Dxf7#. …g6 ou …De7 défendent.',
        arrows: [
          ['h5', 'f7'],
          ['c4', 'f7'],
        ],
        marks: ['f7'],
      },
      {
        kind: 'text',
        title: 'La scandinave : la dame a5 surveille la 5e rangée',
        body:
          'Après 1. e4 d5 2. exd5 Dxd5 3. Cc3 Da5, ta dame contrôle toute la **5e rangée** et la diagonale a5-e1. ' +
          'Une pièce blanche qui vient se poser en b5, e5 ou g5 sans protection est souvent perdue.',
      },
    ],
    exercises: [
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        prompt: 'Les Noirs jouent. Les Blancs menacent le mat en f7 : pare-le.',
        mode: 'engine',
        solution: ['g7g6'],
        tolerance: 10,
        traps: ['g8f6'],
        explanation:
          '…g6 chasse la dame tout en coupant la ligne h5-f7 (…De7 est bon aussi). …Cf6 ?? attaque la dame mais ' +
          'laisse Dxf7#.',
      },
      {
        fen: 'r1bqkb1r/pppp1p1p/2n2np1/4p3/2B1P3/1Q6/PPPP1PPP/RNB1K1NR b KQkq - 3 5',
        prompt: 'La dame blanche revient en b3 pour viser f7. Les Noirs jouent : contre-attaque !',
        mode: 'exact',
        solution: ['c6d4'],
        explanation:
          '…Cd4 ! attaque la dame b3 et menace …Cxc2+ (fourchette du roi et de la tour a1). Les Blancs perdent du ' +
          'temps, voire du matériel.',
      },
      {
        fen: 'r1b1kbnr/pppp1Npp/8/6q1/2BnP3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5',
        prompt:
          'Après 3…Cd4 4. Cxe5 ?? Dg5 ! 5. Cxf7, les Noirs jouent et gagnent : trouve la suite jusqu’au mat.',
        mode: 'exact',
        solution: ['g5g2', 'h1f1', 'g2e4', 'c4e2', 'd4f3'],
        explanation:
          '…Dxg2 menace la tour h1 ; après Tf1, …Dxe4+ Fe2 et …Cf3# : le roi blanc est étouffé par ses propres ' +
          'pièces.',
      },
      {
        fen: 'rnb1kb1r/ppp1pppp/5n2/q5B1/3P4/2N5/PPP2PPP/R2QKBNR b KQkq - 2 5',
        prompt: 'Scandinave : les Blancs viennent de jouer 5. Fg5 ?. Les Noirs jouent.',
        mode: 'exact',
        solution: ['a5g5'],
        explanation:
          '…Dxg5 : le fou g5 n’était défendu par rien, et la dame a5 contrôle toute la 5e rangée.',
      },
    ],
  },
];
