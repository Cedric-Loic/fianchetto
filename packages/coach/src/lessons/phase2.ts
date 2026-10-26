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
        hints: [
          'Dresse la liste : échecs, prises, menaces.',
          'Le roi g8 a-t-il une case de fuite ?',
          'Une tour sur la 8e rangée peut-elle être prise ou bloquée ?',
        ],
        explanation:
          'Te8# : les échecs d’abord ! Le roi noir n’a pas de case de fuite et rien ne peut s’interposer en f8.',
      },
      {
        fen: 'r1bq3k/pp4pp/3p4/4N3/8/8/PP3PPP/4R1K1 w - - 0 1',
        prompt: 'Le pion d6 attaque ton cavalier. Avant de le reculer, cherche un coup forcé.',
        mode: 'exact',
        solution: ['e5f7', 'h8g8', 'f7d8'],
        hints: [
          'Le pion d6 menace ton cavalier. Cherche d’abord un échec.',
          'Quels coups du cavalier donnent échec ?',
          'Cf7+ touche aussi la dame d8.',
        ],
        explanation:
          'Cf7+ fourchette le roi h8 et la dame d8 : après le coup du roi, Cxd8. Reculer le cavalier aurait ' +
          'laissé les Noirs avec une pièce de plus.',
      },
      {
        fen: '4r1k1/5ppp/3n4/8/q4B2/8/3Q1PPP/4R1K1 w - - 0 1',
        prompt: 'Le cavalier d6 peut être pris de deux façons. Laquelle est la bonne ?',
        mode: 'exact',
        solution: ['f4d6'],
        hints: [
          'Compare les deux prises : que garde ta dame en ce moment ?',
          'Qui protège ta tour e1 si la dame s’en va ?',
          'Prends avec le fou : Fxd6.',
        ],
        explanation:
          'Fxd6 gagne une pièce. Dxd6 ?? perdrait aussitôt : la dame ne défend plus la tour e1, et Txe1 est mat. ' +
          'Deux candidats qui se ressemblent peuvent avoir des conséquences opposées.',
      },
      {
        fen: 'r3k2r/ppp2ppp/2n5/3N4/3B4/8/PPP2PPP/R2QK2R w KQkq - 0 1',
        prompt:
          'Étape 1 de la liste : désigne les pièces blanches qui peuvent donner échec au prochain coup.',
        mode: 'squares',
        squares: ['d1', 'd5'],
        solution: [],
        hints: [
          'Passe tes pièces en revue une à une : laquelle peut atteindre une case qui attaque e8 ?',
          'Pense aux colonnes ouvertes et aux sauts du cavalier.',
          'Deux pièces seulement : une dame et un cavalier.',
        ],
        explanation:
          'La dame d1 donne échec en e2 (colonne e ouverte) et le cavalier d5 en c7 (avec prise) ou en f6. Le fou d4 et les tours n’ont aucun échec. Une liste de candidats commence par ces coups, même si on les écarte ensuite.',
      },
      {
        fen: '6k1/5ppp/8/3b4/8/8/5PPP/3RR1K1 w - - 0 1',
        prompt: 'Le fou d5 est offert. Regarde d’abord les échecs, puis joue le meilleur coup.',
        mode: 'exact',
        solution: ['e1e8'],
        hints: [
          'Quels échecs as-tu ?',
          'Le roi g8 a-t-il une case de fuite ? Peut-on s’interposer ?',
          'La colonne e est libre pour ta tour.',
        ],
        explanation:
          'Te8# : le roi est enfermé et le fou d5, qui évolue sur les cases blanches, ne peut pas s’interposer en f8. Txd5 gagnait un fou, mais l’échec vient avant dans la liste.',
      },
      {
        fen: '1k1r4/ppp1q3/8/2b4Q/8/4N3/PPP5/1K1R4 b - - 0 1',
        prompt:
          'Les Noirs jouent. Le cavalier e3 peut être pris de deux façons : laquelle est la bonne ?',
        mode: 'engine',
        solution: ['c5e3'],
        tolerance: 10,
        traps: ['e7e3'],
        hints: [
          'Compare Fxe3 et Dxe3 : que garde ta dame en ce moment ?',
          'Qui protège la tour d8 si la dame s’en va ?',
          'Prends avec le fou.',
        ],
        explanation:
          'Fxe3 gagne une pièce. Dxe3 ?? laisserait la tour d8 sans défenseur : Txd8# est mat. Deux candidats qui se ressemblent peuvent avoir des conséquences opposées.',
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
        kind: 'walkthrough',
        title: 'Un échec à la découverte',
        fen: 'r1bq2k1/pp3ppp/8/8/8/2NB4/PP3PPP/3R2K1 w - - 0 1',
        moves: [
          {
            uci: 'd3h7',
            comment:
              'Fxh7+ : le fou prend un pion avec échec. En quittant la colonne d, il démasque la tour d1 qui attaque la dame d8.',
          },
          {
            uci: 'g8h7',
            comment:
              'Les Noirs doivent répondre à l’échec : peu importe comment, la dame reste attaquée.',
          },
          {
            uci: 'd1d8',
            comment:
              'Txd8 : la tour prend la dame. Un fou pour une dame : c’est le prix de la découverte.',
          },
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
        hints: [
          'Quelle pièce masque l’attaque de la tour ?',
          'Si le fou s’écarte avec échec, l’adversaire n’a pas le temps de sauver sa dame.',
          'Fxh7+ ouvre la colonne d.',
        ],
        explanation:
          'Fxh7+ : la tour d1 attaque la dame et le fou donne échec. Les Noirs doivent répondre à l’échec, puis Txd8.',
      },
      {
        fen: 'r1bq2k1/ppp2ppp/3b4/8/8/N7/PPP2PPP/R1BQ2K1 b - - 0 1',
        prompt:
          'Les Noirs jouent. Les deux dames se font face : fais disparaître la pièce du milieu avec échec.',
        mode: 'exact',
        solution: ['d6h2', 'g1h2', 'd8d1'],
        hints: [
          'Les dames se font face : quelle pièce les sépare ?',
          'Une pièce qui s’écarte avec échec gagne un temps.',
          'Le fou d6 peut prendre h2 avec échec.',
        ],
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
        hints: [
          'Quelle pièce masque le fou b2 ?',
          'Si le cavalier donne aussi échec, l’échec est double.',
          'Le cavalier e5 peut aller en f7 : que touche-t-il ?',
        ],
        explanation:
          'Cf7+ est un échec double (le cavalier et le fou) qui attaque aussi la dame d8 : après le coup du roi, ' +
          'Cxd8. Cc6+ marchait aussi. Cd3+ ? donne bien échec, mais ne menace rien d’autre.',
      },
      {
        fen: '3rk3/8/8/8/3B4/8/8/3R2K1 w - - 0 1',
        prompt:
          'Une de tes pièces masque l’attaque de la tour d1. Désigne-la, ainsi que la pièce noire visée derrière elle.',
        mode: 'squares',
        squares: ['d4', 'd8'],
        solution: [],
        hints: [
          'Suis la colonne d depuis ta tour d1 : que rencontre-t-elle ?',
          'Après ta première pièce, quelle est la première pièce noire sur la colonne ?',
          'La première pièce est ton fou ; la seconde, une tour noire.',
        ],
        explanation:
          'Le fou d4 est la pièce-écran : s’il bouge, la tour d1 attaque la tour d8. Un coup de fou avec échec ou avec menace serait une attaque à la découverte.',
      },
      {
        fen: 'q3k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1',
        prompt: 'Le fou masque la tour e1. Gagne la dame noire.',
        mode: 'engine',
        solution: ['e4a8'],
        tolerance: 5,
        traps: ['e4g6'],
        hints: [
          'Que se passe-t-il si le fou quitte la colonne e ?',
          'Le fou peut prendre quelque chose en démasquant la tour.',
          'Fxa8+ : le fou prend la dame avec l’échec de la tour.',
        ],
        explanation:
          'Fxa8+ prend la dame et donne échec à la découverte : les Noirs doivent s’occuper de leur roi. Fg6+ ? donne aussi un échec à la découverte, mais laisse la dame en paix.',
      },
      {
        fen: '3qkb2/5ppp/8/8/4N3/8/5PPP/4R1K1 w - - 0 1',
        prompt: 'Un échec double, et c’est mat. Trouve-le.',
        mode: 'engine',
        solution: ['e4f6'],
        tolerance: 3,
        traps: ['e4d6'],
        hints: [
          'Combien d’échecs peux-tu donner d’un seul coup ?',
          'Un échec double ne se pare qu’en bougeant le roi : quelles cases lui restent ?',
          'Le cavalier doit aussi contrôler la case d7.',
        ],
        explanation:
          'Cf6# : échec double (cavalier et tour). Le roi n’a aucune case : d7 est couverte par le cavalier, e7 par la tour, et ses propres pièces occupent les autres. Cd6+ est aussi un échec double, mais laisse d7 au roi.',
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
        kind: 'walkthrough',
        title: 'Éloigner le défenseur',
        fen: '3r4/pp3pk1/5qp1/8/3Q4/8/PP3PP1/6KR w - - 0 1',
        moves: [
          {
            uci: 'h1h7',
            comment:
              'Th7+ ! : le roi g7 est le seul défenseur de la dame f6. On l’attire hors de son poste.',
          },
          {
            uci: 'g7h7',
            comment:
              'Rxh7 (sinon la tour reste en h7 et la dame tombe quand même). Le roi n’est plus voisin de f6.',
          },
          {
            uci: 'd4f6',
            comment:
              'Dxf6 : la dame blanche prend la dame noire, désormais sans défenseur. Bilan : une tour contre une dame.',
          },
        ],
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
        hints: [
          'Qui défend la dame f6 ?',
          'Comment forcer ce défenseur à bouger ?',
          'Th7+ : que se passe-t-il si le roi prend ?',
        ],
        explanation:
          'Th7+ ! Rxh7 (sinon la tour reste en h7 et la dame tombe quand même), puis Dxf6 : une tour contre une dame.',
      },
      {
        fen: '5rk1/5ppp/1q3n2/6B1/7Q/3B4/5PPP/6K1 w - - 0 1',
        prompt: 'Le cavalier f6 est le seul défenseur de h7. Fais-le disparaître.',
        mode: 'exact',
        solution: ['g5f6'],
        hints: [
          'Que défend le cavalier f6 ?',
          'Que se passe-t-il si tu le prends ?',
          'Fxf6 : si …gxf6, Dxh7#.',
        ],
        explanation:
          'Fxf6 ! élimine le défenseur de h7. Si …gxf6, Dxh7# (la dame est soutenue par le fou d3). Sinon, les ' +
          'Blancs restent avec une pièce de plus et l’attaque.',
      },
      {
        fen: '3r4/pp3pk1/5qp1/8/3Q4/8/PP3PP1/6KR w - - 0 1',
        prompt:
          'Étape 1 de la méthode : désigne les pièces noires (hors roi et pions) qui n’ont qu’un seul défenseur.',
        mode: 'squares',
        squares: ['d8', 'f6'],
        solution: [],
        hints: [
          'Compte les défenseurs de chaque pièce noire.',
          'La dame et la tour se protègent d’une façon bien particulière.',
          'La tour d8 et la dame f6.',
        ],
        explanation:
          'La dame f6 n’est protégée que par le roi g7, la tour d8 que par la dame. Éloigne le roi : la dame tombe, et la tour avec elle.',
      },
      {
        fen: 'rk6/1pp3pp/8/4q3/8/1PQ5/1KP3PP/4R3 b - - 0 1',
        prompt: 'Les Noirs jouent. Le roi blanc protège sa dame : éloigne-le, puis gagne la dame.',
        mode: 'exact',
        solution: ['a8a2', 'b2a2', 'e5c3'],
        hints: [
          'Qui protège la dame c3 ?',
          'Comment forcer ce défenseur à quitter son poste ?',
          '…Ta2+ : le roi doit-il prendre ?',
        ],
        explanation:
          '…Ta2+ ! Rxa2 (sinon la tour reste en a2 et la dame tombe quand même), puis …Dxc3 : une tour contre une dame.',
      },
      {
        fen: '1k6/ppp5/4b3/q7/1b6/2N3Q1/PPP5/1KR5 b - - 0 1',
        prompt: 'Le cavalier c3 garde a2. Fais-le disparaître.',
        mode: 'engine',
        solution: ['b4c3'],
        tolerance: 10,
        traps: ['a5a2'],
        hints: [
          'Que défend le cavalier c3 ?',
          'Que se passe-t-il si tu le prends ?',
          '…Fxc3 : si bxc3, …Dxa2#.',
        ],
        explanation:
          '…Fxc3 élimine le défenseur : après bxc3, …Dxa2# (la dame est soutenue par le fou e6). …Dxa2+ ? perdrait la dame : Cxa2.',
      },
      {
        fen: '4r3/1kp3pp/1pq5/8/4Q3/8/1PP3PP/RK6 w - - 0 1',
        prompt: 'Le roi noir protège sa dame : éloigne-le, puis gagne la dame.',
        mode: 'exact',
        solution: ['a1a7', 'b7a7', 'e4c6'],
        hints: [
          'Qui protège la dame c6 ?',
          'Comment forcer ce défenseur à quitter son poste ?',
          'Ta7+ : le roi doit-il prendre ?',
        ],
        explanation:
          'Ta7+ ! Rxa7 (sinon la tour reste en a7 et la dame tombe quand même), puis Dxc6 : une tour contre une dame.',
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
        kind: 'walkthrough',
        title: 'La tour surchargée',
        fen: '1r4k1/5ppp/pq6/8/3Q4/8/P4PPP/4R1K1 w - - 0 1',
        moves: [
          {
            uci: 'd4b6',
            comment:
              'Dxb6 : la tour b8 défend la dame ET garde la dernière rangée. Elle ne peut pas faire les deux.',
          },
          { uci: 'b8b6', comment: 'Si Txb6, la 8e rangée est abandonnée.' },
          {
            uci: 'e1e8',
            comment: 'Te8# : le roi est enfermé par ses pions. La surcharge a fonctionné.',
          },
        ],
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
        hints: [
          'Que défend la tour b8 ?',
          'Et si elle doit reprendre la dame ?',
          'Prends la dame b6 : la tour est-elle libre de reprendre ?',
        ],
        explanation:
          'Dxb6 ! La tour ne peut pas reprendre : …Txb6 permettrait Te8#. Les Blancs gagnent la dame.',
      },
      {
        fen: '3r2k1/pp3ppp/2n5/3b4/8/8/P4PPP/3RR1K1 w - - 0 1',
        prompt: 'La tour d8 défend le fou d5 et la 8e rangée. Gagne une pièce.',
        mode: 'exact',
        solution: ['d1d5'],
        hints: [
          'Que défend la tour d8 ?',
          'Que se passe-t-il sur la 8e rangée si elle reprend ?',
          'Txd5 : si …Txd5, Te8#.',
        ],
        explanation:
          'Txd5 ! Si …Txd5, Te8 est mat. La tour d8 ne pouvait pas garder à la fois le fou et la dernière rangée.',
      },
      {
        fen: '1r4k1/5ppp/pq6/8/3Q4/8/P4PPP/4R1K1 w - - 0 1',
        prompt: 'Quelle pièce noire défend la dame b6 ? Désigne-la.',
        mode: 'squares',
        squares: ['b8'],
        solution: [],
        hints: [
          'Quelles pièces noires voient la case b6 ?',
          'Une seule le fait, et elle se trouve sur la colonne b.',
          'C’est la même tour qui garde la 8e rangée.',
        ],
        explanation:
          'La tour b8 est seule à défendre la dame b6… et à garder la dernière rangée. Une pièce qui a deux tâches est surchargée.',
      },
      {
        fen: '1k1r4/ppp4p/8/4q3/8/6QP/PPP5/1K4R1 b - - 0 1',
        prompt: 'La tour g1 a deux tâches. Profites-en.',
        mode: 'exact',
        solution: ['e5g3', 'g1g3', 'd8d1'],
        hints: [
          'Que défend la tour g1 ?',
          'Et si elle doit reprendre ?',
          '…Dxg3 : la tour est-elle libre de reprendre ?',
        ],
        explanation:
          '…Dxg3 ! Si Txg3, …Td1# : la tour g1 ne peut pas à la fois reprendre et garder la 1re rangée.',
      },
      {
        fen: '1k1rr3/ppp4p/8/8/4B3/5N2/PPP3PP/1K2R3 b - - 0 1',
        prompt: 'La tour e1 défend le fou e4 et la 1re rangée. Gagne une pièce.',
        mode: 'exact',
        solution: ['e8e4', 'e1e4', 'd8d1'],
        hints: [
          'Que défend la tour e1 ?',
          'Elle ne peut pas reprendre et rester sur la 1re rangée.',
          '…Txe4 : si Txe4, …Td1#.',
        ],
        explanation:
          '…Txe4 ! Si Txe4, …Td1# : la tour e1 ne pouvait pas à la fois garder le fou et la dernière rangée.',
      },
      {
        fen: '1k4r1/ppp5/6qp/8/4Q3/8/PPP4P/1K1R4 w - - 0 1',
        prompt:
          'La dame g6 est défendue par la tour g8, qui garde aussi la 8e rangée. Gagne la dame.',
        mode: 'engine',
        solution: ['e4g6'],
        tolerance: 8,
        traps: ['d1d8'],
        hints: ['Que défend la tour g8 ?', 'Et si elle doit reprendre ?', 'Prends la dame g6.'],
        explanation:
          'Dxg6 ! Si Txg6, Td8# : la tour g8 ne peut pas à la fois reprendre et garder la dernière rangée. Td8+ ? tout de suite perdrait la tour : Txd8.',
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
        kind: 'walkthrough',
        title: 'Le mat étouffé en deux coups',
        fen: '3r3k/6pp/1q5N/8/2Q5/8/5PPP/6K1 w - - 0 1',
        moves: [
          {
            uci: 'c4g8',
            comment:
              'Dg8+ : le roi ne peut pas prendre (le cavalier h6 défend g8). Seule la tour peut capturer.',
          },
          {
            uci: 'd8g8',
            comment: 'Txg8 : la tour est attirée sur g8, où elle bouche la dernière case du roi.',
          },
          { uci: 'h6f7', comment: 'Cf7# : mat étouffé. Le roi est entouré de ses propres pièces.' },
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
        hints: [
          'Quel premier coup oblige l’adversaire à une réponse unique ?',
          'Un sacrifice de dame peut attirer une pièce sur une mauvaise case.',
          'Dg8+ : après la prise, quel coup mate ?',
        ],
        explanation:
          'Dg8+ Txg8 Cf7# : c’est le **mat étouffé**. La tour a été attirée en g8 et bouche la dernière case du roi.',
      },
      {
        fen: '7r/pp3pk1/b5p1/8/6n1/2N5/PP3PP1/3QR1K1 b - - 0 1',
        prompt: 'Les Noirs jouent. Un sacrifice attire le roi blanc sur une case de fourchette.',
        mode: 'exact',
        solution: ['h8h1', 'g1h1', 'g4f2'],
        hints: [
          'Un sacrifice peut attirer le roi blanc.',
          'Quelle case de fourchette touche le roi et la dame ?',
          '…Th1+ puis …Cxf2+.',
        ],
        explanation:
          '…Th1+ ! Rxh1 (le fou a6 interdit f1), puis …Cxf2+ fourchette le roi et la dame d1.',
      },
      {
        fen: 'r3k2r/ppp2ppp/8/3N4/8/8/PP3PPP/R2QKB1R w KQkq - 0 1',
        prompt: 'Désigne les pièces blanches qui peuvent donner échec au prochain coup.',
        mode: 'squares',
        squares: ['d1', 'd5', 'f1'],
        solution: [],
        hints: [
          'Ton coup forcé doit viser le roi e8.',
          'Diagonales, colonne e, sauts du cavalier : compte-les.',
          'Trois pièces : la dame, un fou et un cavalier.',
        ],
        explanation:
          'La dame d1 (Da4+ ou De2+), le cavalier d5 (Cxc7+ ou Cf6+) et le fou f1 (Fb5+). Lister les échecs d’abord, puis les calculer un à un : les réponses adverses sont peu nombreuses.',
      },
      {
        fen: '1k6/ppp5/8/5q2/8/n5Q1/PP6/K3R3 b - - 0 1',
        prompt: 'Les Noirs jouent : mat en 2.',
        mode: 'exact',
        solution: ['f5b1', 'e1b1', 'a3c2'],
        hints: [
          'Un sacrifice de dame attire une pièce sur une case qui étouffe le roi.',
          'Le roi a1 est entouré de ses propres pièces : quelle case lui manque encore ?',
          '…Db1+ : la dame est protégée par le cavalier a3.',
        ],
        explanation:
          '…Db1+ ! Txb1 (le roi ne peut pas prendre : le cavalier a3 protège la dame), puis …Cc2# : le mat étouffé.',
      },
      {
        fen: '3q2k1/5ppp/4R3/4R3/8/8/2P4K/5N2 w - - 0 1',
        prompt: 'Mat en 2 : sacrifie une tour pour attirer la dame.',
        mode: 'exact',
        solution: ['e6e8', 'd8e8', 'e5e8'],
        hints: [
          'Les deux tours sont sur la colonne e : quelle case de la dernière rangée les intéresse ?',
          'Un sacrifice sur e8 attire la dame.',
          'Te8+ Dxe8, puis la seconde tour reprend.',
        ],
        explanation:
          'Te8+ ! Dxe8 (seul coup légal) Txe8# : la dame est attirée sur e8 et la seconde tour mate. Le roi est enfermé par ses pions.',
      },
      {
        fen: '6k1/5pp1/1R3nBp/8/1P5K/8/8/8 w - - 0 1',
        prompt: 'Mat en 2 : un échec sur la dernière rangée.',
        mode: 'exact',
        solution: ['b6b8', 'f6e8', 'b8e8'],
        hints: [
          'Un échec sur la dernière rangée : qui peut répondre ?',
          'Le cavalier f6 est seul à pouvoir s’interposer.',
          'Tb8+ Ce8, et la tour reprend.',
        ],
        explanation:
          'Tb8+ Ce8 (seule parade) Txe8# : le fou g6 couvre f7 et h7, la tour couvre toute la dernière rangée.',
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
        kind: 'walkthrough',
        title: 'Les tours en escalier',
        fen: '5rk1/1R2R1pp/8/8/8/8/5PPK/3q4 w - - 0 1',
        moves: [
          { uci: 'e7g7', comment: 'Txg7+ : chaque tour protège l’autre sur la 7e rangée.' },
          {
            uci: 'g8h8',
            comment: 'Le roi ne peut pas prendre (la tour b7 défend g7) : il n’a que Rh8.',
          },
          {
            uci: 'g7h7',
            comment: 'Txh7+ : toujours avec échec, toujours protégée par la tour b7.',
          },
          { uci: 'h8g8', comment: 'Rg8 : la seule case légale.' },
          { uci: 'b7g7', comment: 'Tbg7# : les deux tours se protègent, le roi n’a plus de case.' },
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
        hints: [
          'Chaque tour protège l’autre : où peuvent-elles s’installer ?',
          'Une tour prend en g7 avec échec.',
          'Texg7+, puis Txh7+ et Tbg7#.',
        ],
        explanation:
          'Texg7+ Rh8, Txh7+ Rg8, Tbg7# : les deux tours se protègent mutuellement, le roi n’a plus de case.',
      },
      {
        fen: '3r2k1/5Npp/1q6/8/2Q5/8/5PPP/6K1 w - - 0 1',
        prompt: 'Mat en 3 : commence par un échec double.',
        mode: 'exact',
        solution: ['f7h6', 'g8h8', 'c4g8', 'd8g8', 'h6f7'],
        hints: [
          'Un échec double ne peut être paré que par un coup du roi.',
          'Quelle case le cavalier doit-il occuper pour donner un échec double ?',
          'Ch6+, puis un sacrifice de dame en g8.',
        ],
        explanation:
          'Ch6+ (échec double du cavalier et de la dame) Rh8, Dg8+ ! Txg8, Cf7# : le mat étouffé. Si …Rf8 au ' +
          'premier coup, Df7 est mat.',
      },
      {
        fen: '3r2k1/5ppp/6P1/8/5R2/3PB3/K7/8 w - - 0 1',
        prompt: 'Mat en 3 : commence par une prise avec échec.',
        mode: 'exact',
        solution: ['g6f7', 'g8f8', 'e3c5', 'd8d6', 'c5d6'],
        hints: [
          'Quelle pièce peut donner échec avec une prise ?',
          'Le pion g6 touche f7 : la tour f4 le soutient.',
          'gxf7+ puis un échec de fou sur la diagonale c5-f8.',
        ],
        explanation:
          'gxf7+ Rf8 (Rxf7 est impossible : la tour f4 défend f7), Fc5+ Td6 (seule parade), Fxd6# : le pion f7 enlève e8 et g8 au roi.',
      },
      {
        fen: '4Q3/kpp5/8/8/8/8/PP1r2r1/1KR5 b - - 0 1',
        prompt: 'Les Blancs ont une dame de plus, mais les Noirs matent en 3.',
        mode: 'exact',
        solution: ['d2b2', 'b1a1', 'b2a2', 'a1b1', 'g2b2'],
        hints: [
          'Les deux tours noires sont sur la 2e rangée : que peuvent-elles prendre avec échec ?',
          'Chaque tour protège l’autre.',
          '…Txb2+, puis …Txa2+ et …Tgxb2#.',
        ],
        explanation:
          '…Txb2+ Ra1 …Txa2+ Rb1 …Tgxb2# : les deux tours se protègent et le roi n’a plus de case. La dame blanche, trop loin, ne peut pas aider.',
      },
      {
        fen: '1k6/ppp5/8/5q2/8/6Q1/PPn5/1K2R3 b - - 0 1',
        prompt: 'Mat en 3 : commence par un échec double.',
        mode: 'exact',
        solution: ['c2a3', 'b1a1', 'f5b1', 'e1b1', 'a3c2'],
        hints: [
          'Un échec double ne se pare qu’en bougeant le roi.',
          'Quel saut du cavalier découvre la dame avec échec ?',
          '…Ca3+, puis un sacrifice de dame.',
        ],
        explanation:
          '…Ca3+ (échec double du cavalier et de la dame) Ra1, …Db1+ ! Txb1, …Cc2# : le mat étouffé.',
      },
      {
        fen: '8/7k/3bp3/2r5/8/1p6/PPP5/1K2R3 b - - 0 1',
        prompt: 'Mat en 3 : un pion ouvre le jeu avec échec.',
        mode: 'exact',
        solution: ['b3c2', 'b1c1', 'd6f4', 'e1e3', 'f4e3'],
        hints: [
          'Quelle capture donne échec et ouvre le roi blanc ?',
          'Le roi blanc doit être attiré sur la 1re rangée, puis enfilé par le fou.',
          '…bxc2+, puis un échec de fou.',
        ],
        explanation:
          '…bxc2+ Rc1, …Ff4+ Te3 …Fxe3# : le pion c2 prive le roi des cases b1 et d1, la tour c5 protège le pion.',
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
        kind: 'walkthrough',
        title: 'Escorter le pion',
        fen: '8/3k4/8/3K4/3P4/8/8/8 b - - 0 1',
        moves: [
          { uci: 'd7c7', comment: 'Les Noirs doivent céder l’opposition : leur roi s’écarte.' },
          {
            uci: 'd5e6',
            comment:
              'Le roi blanc avance : il passe en e6 sans que le roi noir puisse l’en empêcher.',
          },
          { uci: 'c7c6', comment: 'Le roi noir tente de se rapprocher du pion.' },
          { uci: 'd4d5', comment: 'd5+ : le pion avance avec échec, soutenu par le roi.' },
          { uci: 'c6c5', comment: 'Le roi noir recule, mais le pion avance et reste protégé.' },
          {
            uci: 'e6e5',
            comment: 'Re5 : le pion est escorté, la promotion approche. Les Blancs gagnent.',
          },
        ],
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
        hints: [
          'Où est l’opposition ? Qui doit céder ?',
          'Un roi devant son pion doit avancer, pas rester en arrière.',
          'Rd5 prend l’opposition devant le pion.',
        ],
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
        hints: [
          'Que veut faire le roi blanc ensuite ?',
          'Prends l’opposition face à lui.',
          '…Rf6 : face au roi f4.',
        ],
        explanation:
          '…Rf6 ! prend l’opposition face au roi f4 : le roi blanc ne peut plus avancer. Après …Rf7 ? ou …Rd6 ?, ' +
          'Rf5 ou Re5 place le roi blanc devant son pion avec l’opposition : les Blancs gagnent.',
      },
      {
        fen: '8/8/3k4/8/2K5/3P4/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent. Un seul coup fait nulle.',
        mode: 'exact',
        solution: ['d6c6'],
        hints: [
          'Où est l’opposition si les Noirs jouent ?',
          'Le roi blanc veut entrer en c5 ou d5.',
          '…Rc6 prend l’opposition.',
        ],
        explanation:
          '…Rc6 ! : opposition face au roi c4. Toute autre case laisse le roi blanc avancer en c5 ou d5, devant son ' +
          'pion, et les Blancs gagnent.',
      },
      {
        fen: '8/4k3/8/3K4/4P3/8/8/8 w - - 0 1',
        prompt: 'Les Blancs jouent et gagnent : prends l’opposition.',
        mode: 'engine',
        solution: ['d5e5'],
        tolerance: 10,
        traps: ['e4e5'],
        hints: [
          'Où est ton roi par rapport au pion ? À côté ou devant ?',
          'Place ton roi devant le pion, avec une case entre les deux rois.',
          'Re5 : les Noirs doivent céder.',
        ],
        explanation:
          'Re5 ! : le roi est devant son pion avec l’opposition, le roi noir doit s’écarter. e5 ? pousse le pion sans le roi : les Noirs prennent l’opposition et font nulle.',
      },
      {
        fen: '8/3k4/8/4K3/4P3/8/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent et font nulle : où placer le roi ?',
        mode: 'engine',
        solution: ['d7e7'],
        tolerance: 10,
        traps: ['d7c6', 'd7e8'],
        hints: [
          'Que veut faire le roi blanc ensuite ?',
          'Reste en face de lui, avec une case entre les deux rois.',
          '…Re7 prend l’opposition.',
        ],
        explanation:
          '…Re7 ! : opposition face au roi e5. …Rc6 ? laisse le roi blanc passer en e6, et …Re8 ? lui laisse Re6 avec l’opposition : dans les deux cas les Blancs gagnent.',
      },
      {
        fen: '8/8/6k1/4P3/3K4/8/8/8 b - - 0 1',
        prompt: 'Les Noirs jouent. Un seul coup fait nulle.',
        mode: 'exact',
        solution: ['g6f7'],
        hints: [
          'Où doit se trouver le roi défenseur par rapport au pion ?',
          'Devant lui, pas sur le côté.',
          'Le roi g6 est trop à droite : rapproche-toi de la colonne e.',
        ],
        explanation:
          '…Rf7 ! : le roi se replace devant le pion, prêt à prendre l’opposition (après Rd5, …Re7). Les autres coups laissent le roi blanc passer devant son pion.',
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
        kind: 'walkthrough',
        title: 'Le roi n’entre pas dans le carré',
        fen: '8/8/8/5k2/P7/8/8/7K w - - 0 1',
        moves: [
          {
            uci: 'a4a5',
            comment:
              'a5 : le carré du pion devient a5-d5-d8-a8. Le roi f5 n’y entre pas en un coup.',
          },
          { uci: 'f5e6', comment: 'Re6 : le roi s’approche, mais reste hors du carré.' },
          { uci: 'a5a6', comment: 'a6 : le carré rétrécit.' },
          { uci: 'e6d7', comment: 'Rd7 : le roi touche le bord du carré mais il est trop tard.' },
          { uci: 'a6a7', comment: 'a7 : encore un pas.' },
          { uci: 'd7c7', comment: 'Rc7 : le roi ne peut pas prendre le pion.' },
          { uci: 'a7a8q', comment: 'a8=D : le pion devient dame. Les Blancs gagnent.' },
        ],
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
        hints: [
          'Trace le carré du pion après son avancée.',
          'Le roi f5 peut-il y entrer en un coup ?',
          'a5 : le carré va jusqu’en d8.',
        ],
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
        hints: [
          'Le carré du pion a4 : de quelle case à quelle case ?',
          'Quelle case te permet d’entrer dans le carré au prochain coup ?',
          '…Re5 ou …Re4.',
        ],
        explanation:
          '…Re5 (ou …Re4) entre dans le carré a4-e8 et rattrape le pion. …Rf5 ? avance mais reste hors du carré : ' +
          'a5 et le pion va à dame.',
      },
      {
        fen: '8/8/8/8/8/P5k1/8/7K w - - 0 1',
        prompt: 'Les Blancs jouent. Le roi noir peut-il rattraper le pion ? Joue le coup gagnant.',
        mode: 'engine',
        solution: ['a3a4'],
        tolerance: 10,
        traps: ['h1g1'],
        hints: [
          'Trace le carré du pion après qu’il a avancé.',
          'Combien de coups faut-il au roi noir pour entrer dans ce carré ?',
          'Pousse le pion sans attendre : a4.',
        ],
        explanation:
          'a4 ! : le roi g3 est hors du carré et n’y entre pas. Chaque coup de roi, comme Rg1 ?, perd un temps : le roi noir se rapproche et finit par entrer dans le carré.',
      },
      {
        fen: '8/8/8/8/P7/5k2/8/7K b - - 0 1',
        prompt: 'Les Noirs jouent : entre dans le carré du pion pour faire nulle.',
        mode: 'engine',
        solution: ['f3e4'],
        tolerance: 10,
        traps: ['f3f2', 'f3e3'],
        hints: [
          'Le pion va jouer a5 : quel est alors son carré ?',
          'Quelle case te permet d’y entrer au prochain coup ?',
          '…Re4, puis …Rd5.',
        ],
        explanation:
          '…Re4 ! : après a5, …Rd5 entre dans le carré a5-d8. …Rf2 ? et …Re3 ? sont trop lents : le pion file à dame.',
      },
      {
        fen: '8/8/8/8/7P/2k5/8/6K1 b - - 0 1',
        prompt: 'Les Noirs jouent. Le pion h passe : un seul coup fait nulle.',
        mode: 'exact',
        solution: ['c3d4'],
        hints: [
          'Le pion va en h5 : trace le carré h5-e5-e8-h8.',
          'Ton roi doit pouvoir y entrer au coup suivant.',
          '…Rd4 se rapproche de la colonne e.',
        ],
        explanation:
          '…Rd4 ! : après h5, …Re5 entre dans le carré et rattrape le pion. Tout autre coup laisse le roi noir trop loin.',
      },
      {
        fen: '8/8/2k5/8/7P/8/8/K7 w - - 0 1',
        prompt: 'Les Blancs jouent : le roi noir est loin du carré. Gagne.',
        mode: 'engine',
        solution: ['h4h5'],
        tolerance: 10,
        traps: ['a1b1'],
        hints: [
          'Si le pion avance, de quel côté s’étend son carré ?',
          'Le roi c6 est-il dans le carré ? Peut-il y entrer en un coup ?',
          'Pas de temps à perdre : pousse le pion.',
        ],
        explanation:
          'h5 ! : le carré h5-e5-e8-h8 est hors d’atteinte du roi c6. Rb1 ? perd un temps et laisse le roi noir se rapprocher.',
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
        kind: 'walkthrough',
        title: 'Le mat de Légal',
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
        moves: [
          {
            uci: 'f3e5',
            comment:
              'Cxe5 ! : le cavalier prend un pion et « débloque » le fou g4. En apparence, ce cavalier était cloué.',
          },
          {
            uci: 'g4d1',
            comment: 'Fxd1 ?? : les Noirs prennent la dame et tombent dans le piège.',
          },
          { uci: 'c4f7', comment: 'Fxf7+ : échec, le roi n’a qu’une case.' },
          { uci: 'e8e7', comment: 'Re7 : le roi est forcé.' },
          {
            uci: 'c3d5',
            comment: 'Cd5# : mat de Légal. Le roi est entouré de ses propres pièces.',
          },
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
        hints: [
          'Le fou g4 cloue ton cavalier f3… mais à quoi ? À la dame ?',
          'Que se passe-t-il si les Noirs prennent la dame ?',
          'Cxe5 !',
        ],
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
        hints: ['Quel est le piège après Cxe5 ?', 'Que menace …Dg5 ?', 'Cxd4 simplifie.'],
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
        hints: [
          'Quelle pièce noire est clouée par le fou c4 ?',
          'Un échec qui attaque aussi la pièce clouée est précieux.',
          'Df3+.',
        ],
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
        hints: [
          'Quel point faible vise ton fou c4 ?',
          'Les Noirs ont pris en d5 avec le cavalier : f7 est-il bien défendu ?',
          'Cxf7 ou d4.',
        ],
        explanation:
          'Cxf7 ! (l’attaque « foie frit ») ou d4 ! ouvrent le jeu contre le roi noir. Le coup juste pour les ' +
          'Noirs au 5e coup était 5…Ca5.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4',
        prompt: 'Après 4. Cg5, désigne les pions noirs attaqués par le cavalier g5.',
        mode: 'squares',
        squares: ['f7', 'h7'],
        solution: [],
        hints: [
          'Un cavalier saute en « L » : compte ses huit cases depuis g5.',
          'Quelles cases portent un pion noir ?',
          'Une des deux est le point faible f7.',
        ],
        explanation:
          'Le cavalier g5 vise f7 (déjà visé par le fou c4, défendu seulement par le roi) et h7. Les Noirs doivent réagir : 4…d5 ! 5. exd5 Ca5 est la parade.',
      },
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 0 7',
        prompt: 'Après 4. c3 Cf6 5. d4 exd4 6. cxd4 Fb4+, comment parer l’échec ?',
        mode: 'choice',
        solution: ['c1d2'],
        accepted: ['c1d2', 'b1c3', 'b1d2'],
        hints: [
          'Tu peux interposer une pièce : lesquelles développent en même temps ?',
          'Le fou c1 et les cavaliers de l’aile dame peuvent s’interposer.',
          'Fd2 est le plus simple.',
        ],
        explanation:
          'Fd2 (ou Cc3, Cbd2) pare l’échec en développant une pièce. Rf1 ? perdrait le droit de roquer pour rien.',
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
        kind: 'walkthrough',
        title: 'Défendre f7 sans perdre de temps',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        moves: [
          { uci: 'g7g6', comment: '…g6 ! chasse la dame et coupe la diagonale h5-f7.' },
          { uci: 'h5f3', comment: 'La dame se replace en f3, toujours en direction de f7.' },
          { uci: 'g8f6', comment: '…Cf6 : un développement naturel, le cavalier couvre aussi h5.' },
          { uci: 'f3b3', comment: 'Db3 : la dame vise f7 avec le fou c4, encore la même idée.' },
          {
            uci: 'd8e7',
            comment:
              '…De7 : la dame protège f7 tout en se développant. Les Noirs n’ont plus rien à craindre.',
          },
        ],
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
        hints: [
          'Que menacent la dame h5 et le fou c4 ?',
          'Que protège …Cf6 ? Et que laisse-t-il en prise ?',
          '…g6 chasse la dame.',
        ],
        explanation:
          '…g6 chasse la dame tout en coupant la ligne h5-f7 (…De7 est bon aussi). …Cf6 ?? attaque la dame mais ' +
          'laisse Dxf7#.',
      },
      {
        fen: 'r1bqkb1r/pppp1p1p/2n2np1/4p3/2B1P3/1Q6/PPPP1PPP/RNB1K1NR b KQkq - 3 5',
        prompt: 'La dame blanche revient en b3 pour viser f7. Les Noirs jouent : contre-attaque !',
        mode: 'exact',
        solution: ['c6d4'],
        hints: [
          'Quelle pièce blanche peux-tu attaquer avec tempo ?',
          'La dame b3 est en face de f7 : comment la repousser ?',
          '…Cd4 attaque la dame.',
        ],
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
        hints: [
          'Quel coup noir attaque deux pièces blanches à la fois ?',
          'La dame g5 est puissante : regarde g2.',
          '…Dxg2, puis …Dxe4+.',
        ],
        explanation:
          '…Dxg2 menace la tour h1 ; après Tf1, …Dxe4+ Fe2 et …Cf3# : le roi blanc est étouffé par ses propres ' +
          'pièces.',
      },
      {
        fen: 'rnb1kb1r/ppp1pppp/5n2/q5B1/3P4/2N5/PPP2PPP/R2QKBNR b KQkq - 2 5',
        prompt: 'Scandinave : les Blancs viennent de jouer 5. Fg5 ?. Les Noirs jouent.',
        mode: 'exact',
        solution: ['a5g5'],
        hints: [
          'Quelle pièce blanche n’est pas défendue ?',
          'Ta dame a5 regarde toute la 5e rangée.',
          '…Dxg5.',
        ],
        explanation:
          '…Dxg5 : le fou g5 n’était défendu par rien, et la dame a5 contrôle toute la 5e rangée.',
      },
      {
        fen: 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
        prompt: 'Scandinave : 1. e4 d5 2. exd5. Récupère ton pion.',
        mode: 'choice',
        solution: ['d8d5'],
        accepted: ['d8d5', 'g8f6'],
        hints: [
          'Tu as perdu un pion au centre : comment le récupérer ?',
          'Une seule pièce noire peut le prendre tout de suite.',
          '…Dxd5, ou …Cf6 pour le prendre ensuite.',
        ],
        explanation:
          '…Dxd5 reprend aussitôt le pion, …Cf6 gagne un temps avant de le reprendre. La dame sera chassée par Cc3, mais …Da5 la remet à l’abri.',
      },
      {
        fen: 'rnb1kbnr/ppp1pppp/8/q7/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 0 4',
        prompt: 'Scandinave : 4. Cf3. Désigne les pièces blanches attaquées par ta dame a5.',
        mode: 'squares',
        squares: ['a2', 'c3'],
        solution: [],
        hints: [
          'La dame a5 voit une colonne, une rangée et deux diagonales.',
          'Regarde la diagonale a5-e1 et la colonne a.',
          'Un cavalier et un pion de l’aile dame.',
        ],
        explanation:
          'La dame a5 attaque le cavalier c3 (défendu par b2 et d2) et le pion a2 (défendu par la tour). Aucune prise n’est encore gagnante, mais ta dame surveille ces cases : une pièce posée sans défense en b5 ou g5 serait perdue.',
      },
    ],
  },
];
