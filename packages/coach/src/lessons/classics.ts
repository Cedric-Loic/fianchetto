import type { Lesson } from './types.js';

/*
 * Parties classiques commentées (domaine public) : chaque leçon rejoue une partie célèbre coup par
 * coup, puis pose des questions « que jouerais-tu ici ? » aux moments clés. Les coups sont ceux de
 * la partie historique ; les commentaires sont originaux, un par coup. Phase 1 : pièges et mats
 * courts ; phase 2 : miniatures et attaques contre le roque ; phase 3 : attaques et sacrifices.
 * Chaque partie est vérifiée : coups légaux, résultat final, questions contrôlées par Stockfish
 * (apps/server/test/lessons.stress.ts). Seules figurent des parties dont la liste de coups est
 * connue exactement ; la leçon « classique-berger » est une partie d’école, sans auteur.
 */

export const CLASSICS_1: Lesson[] = [
  {
    id: 'classique-lazard',
    phase: 1,
    title: 'Le piège de Lazard (Gibaud–Lazard, Paris, 1924)',
    summary:
      'Six coups : un coup de pion « chasse-cavalier » qui coûte la partie, et un mat où les pièces blanches se bouchent elles-mêmes.',
    minutes: 8,
    sections: [
      {
        kind: 'text',
        body: 'En 1924, à Paris, Gibaud joue les Blancs contre Lazard. La partie ne dure que six coups et elle est restée célèbre : elle montre ce qu’un seul réflexe, « chasser la pièce qui me dérange avec un pion », peut coûter quand on ne s’est pas demandé où cette pièce peut sauter.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) pourquoi 4.h3 est une faute alors qu’il attaque une pièce ; (2) la case e3, d’où le cavalier attaque deux pièces à la fois ; (3) combien de pièces blanches entourent leur propre roi quand le mat arrive.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'd2d4',
            comment:
              'Les Blancs avancent le pion dame de deux cases : il prend le centre et ouvre la route au fou c1 et à la dame.',
          },
          {
            uci: 'g8f6',
            comment:
              'Les Noirs sortent un cavalier vers le centre. De f6 il surveille e4 et d5, et il n’enferme aucune autre pièce.',
          },
          {
            uci: 'b1d2',
            comment:
              'Un coup tranquille mais peu précis : le cavalier se développe, mais il bouche la diagonale du fou c1. Cf3 aurait gêné moins de monde. Note déjà que les pièces blanches se serrent autour du roi.',
          },
          {
            uci: 'e7e5',
            comment:
              'Un gambit : les Noirs offrent un pion pour ouvrir la partie. Prendre un pion offert n’est pas interdit, mais on se demande d’abord : « qu’est-ce que cela me coûte, et quelles cases cela libère-t-il pour l’adversaire ? »',
          },
          {
            uci: 'd4e5',
            comment:
              'Les Blancs prennent le pion. Placé en e5, il attaque le cavalier f6 : les Noirs doivent réagir.',
          },
          {
            uci: 'f6g4',
            comment:
              'Le cavalier se retire en attaquant le pion e5 qu’il vient d’offrir. Regarde aussi les cases où il pourra sauter ensuite : e3, par exemple, ou f2.',
          },
          {
            uci: 'h2h3',
            comment:
              'Un réflexe naturel : chasser le cavalier avec un coup de pion. Mais h3 ne développe rien, et il oublie la bonne question : « où cette pièce peut-elle aller, et qu’attaquerait-elle là ? » Cgf3 ou e4 étaient sans danger.',
          },
          {
            uci: 'g4e3',
            comment:
              'Un sacrifice : le cavalier saute en e3 et attaque à la fois la dame d1 et le fou f1. Plus important encore, s’il est pris, le pion f2 quitte sa place et laisse une ligne ouverte devant le roi.',
          },
          {
            uci: 'f2e3',
            comment:
              'Prendre la pièce paraît naturel, et ne pas la prendre ne sauverait pas la partie non plus. Mais le pion f2 vient de s’éloigner : la diagonale h4–e1 est ouverte devant le roi.',
          },
          {
            uci: 'd8h4',
            comment:
              'Échec ! La dame sort sur la diagonale libérée. Le roi ne peut pas bouger : sa dame, son cavalier d2, son pion e2 et son fou f1 l’entourent, et f2 est attaquée.',
          },
          {
            uci: 'g2g3',
            comment:
              'Le seul coup légal : le pion g3 s’interpose. Aucune autre pièce blanche ne peut se placer entre la dame et le roi.',
          },
          {
            uci: 'h4g3',
            comment:
              'La dame prend le pion g3, toujours avec échec. Le pion h3 est trop avancé pour reprendre, le roi n’a aucune case : mat ! Les pièces blanches se sont bouchées elles-mêmes tout au long de la partie.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : (1) avant de chasser une pièce adverse avec un pion, je cherche toutes les cases où elle peut sauter ; (2) un sacrifice est bon quand il ouvre une ligne vers un roi non roqué et entouré de ses propres pièces ; (3) je roque tôt et je ne laisse pas mes pièces enfermer mon roi.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPPNPPPP/R1BQKBNR b KQkq - 2 2',
        prompt:
          'Les Blancs viennent de jouer Cd2, qui bloque leur fou c1. Quel coup de pion joues-tu pour prendre le centre ?',
        mode: 'choice',
        solution: ['e7e5'],
        accepted: ['e7e5', 'd7d5'],
        hints: [
          'Quels pions peuvent occuper le centre ?',
          'Lazard a choisi un gambit : il offre un pion pour ouvrir la partie.',
          'e5 (d5 serait plus calme).',
        ],
        explanation:
          'e5 est un gambit audacieux (d5 est plus calme). Il prépare Cg4 puis la case e3, si les Blancs prennent sans réfléchir.',
      },
      {
        fen: 'rnbqkb1r/pppp1ppp/8/4P3/6n1/8/PPPNPPPP/R1BQKBNR w KQkq - 1 4',
        prompt:
          'Le cavalier noir est en g4. Les Blancs ont le trait : chasser le cavalier avec un pion, ou développer ? Que jouerais-tu ?',
        mode: 'engine',
        solution: ['e2e4'],
        tolerance: 8,
        traps: ['h2h3'],
        hints: [
          'Demande-toi d’abord où le cavalier g4 peut sauter : e3 ? f2 ?',
          'Un coup de pion qui chasse une pièce n’est pas un coup de développement.',
          'Joue un coup qui occupe le centre ou qui sort une pièce, comme e4 ou Cgf3.',
        ],
        explanation:
          'e4 (ou Cgf3) est sans danger. h3? se heurte à Ce3! : le cavalier fourche la dame et le fou et, après fxe3, Dh4+ gagne la partie.',
      },
      {
        fen: 'rnbqkb1r/pppp1ppp/8/4P3/6n1/7P/PPPNPPP1/R1BQKBNR b KQkq - 0 4',
        prompt:
          'Les Blancs ont joué h3 pour chasser ton cavalier. Au lieu de le retirer, quelle case gagne la partie ?',
        mode: 'engine',
        solution: ['g4e3'],
        tolerance: 8,
        traps: ['g4e5'],
        hints: [
          'Ton cavalier est attaqué, mais il peut aussi attaquer.',
          'Cherche une case où il attaque la dame et le fou à la fois.',
          'Ce3 !',
        ],
        explanation:
          'Ce3! fourche la dame d1 et le fou f1 et ouvre la diagonale du roi. Reprendre tout de suite le pion e5 rendrait l’avantage aux Blancs.',
      },
      {
        fen: 'rnbqkb1r/pppp1ppp/8/4P3/8/4P2P/PPPNP1P1/R1BQKBNR b KQkq - 0 5',
        prompt:
          'Les Blancs ont pris ton cavalier par fxe3. Trouve le mat en 2 : tu joues, l’adversaire n’a qu’un coup, puis tu mates.',
        mode: 'exact',
        solution: ['d8h4', 'g2g3', 'h4g3'],
        hints: [
          'Quelle ligne le départ du pion f2 vient-il d’ouvrir ?',
          'Ta dame peut-elle s’y placer avec échec ?',
          'Dh4+, g3 forcé, Dxg3#.',
        ],
        explanation:
          'Dh4+ g3 Dxg3# : le roi est enfermé par ses propres pièces et h3 ne peut pas reprendre.',
      },
    ],
  },
  {
    id: 'classique-shilling',
    phase: 1,
    title: 'Le piège du shilling (gambit de Blackburne, XIXe siècle)',
    summary:
      'Un pion offert, une dame qui frappe deux fois et un mat de cavalier : l’art de se demander ce que devient la pièce qui prend.',
    minutes: 8,
    sections: [
      {
        kind: 'text',
        body: 'Le « gambit du shilling » est attribué au maître anglais Joseph Blackburne (XIXe siècle). Selon la tradition, il le jouait contre des amateurs pour gagner quelques shillings. Le piège est simple, mais il illustre une leçon durable : un pion offert est une question, pas un cadeau.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) la tentation du pion e5 ; (2) la double menace de la dame sur e5 et g2 ; (3) la façon dont les propres pièces blanches bouchent leur roi au moment du mat.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment:
              'Le pion roi avance de deux cases : il prend le centre et ouvre la route à la dame et au fou f1.',
          },
          {
            uci: 'e7e5',
            comment:
              'Les Noirs répondent de la même façon : le centre est partagé et le fou f8 est libéré.',
          },
          {
            uci: 'g1f3',
            comment:
              'Le cavalier sort en attaquant e5 : développer en menaçant, c’est gagner un temps.',
          },
          {
            uci: 'b8c6',
            comment: 'Le cavalier défend e5 en se développant : la parade la plus naturelle.',
          },
          {
            uci: 'f1c4',
            comment:
              'Le fou vise f7, la case la plus fragile du camp noir tant que le roi n’a pas roqué, puisque seul le roi la garde.',
          },
          {
            uci: 'c6d4',
            comment:
              'Le piège ! Le cavalier quitte son poste de défenseur et attaque Cf3, en laissant le pion e5 à la merci des Blancs. Quand on te tend un pion, demande-toi : « que devient la pièce qui prend ? »',
          },
          {
            uci: 'f3e5',
            comment:
              'Les Blancs prennent le pion et visent f7 une deuxième fois. Cxd4 exd4, plus simple, leur gardait un léger avantage. Cxe5 est tentant, mais il laisse la dame noire frapper.',
          },
          {
            uci: 'd8g5',
            comment:
              'Une double attaque : la dame menace le cavalier e5 et surtout le pion g2, que plus personne ne défend depuis que le fou a quitté f1. Il fallait y penser avant de prendre.',
          },
          {
            uci: 'e5f7',
            comment:
              'Le cavalier prend f7 et attaque la dame et la tour h8 : on dirait que les Blancs gagnent encore. Mais ils n’ont pas répondu à la menace sur g2. Fxf7+ était bien plus prudent.',
          },
          {
            uci: 'g5g2',
            comment:
              'La dame prend g2. Elle attaque la tour h1 et le pion e4, et le roi blanc, resté au centre, va payer son retard de roque.',
          },
          {
            uci: 'h1f1',
            comment:
              'La tour h1 est attaquée et se retire en f1. Mais elle prend à son roi la case f1, sa dernière échappatoire.',
          },
          {
            uci: 'g2e4',
            comment:
              'Échec sur la colonne e ! Le roi ne peut aller nulle part : d1, d2, f1 et f2 sont occupées par ses propres pièces, et e2 est attaquée.',
          },
          {
            uci: 'c4e2',
            comment:
              'Le fou s’interpose en e2. C’est la pire des parades : il est maintenant cloué contre le roi, et il masque la dame d1 sur la diagonale d1–f3.',
          },
          {
            uci: 'd4f3',
            comment:
              'Mat ! Le cavalier saute en f3 avec échec. Le fou e2 est cloué et ne peut pas le prendre, la dame est masquée par ce même fou, et le roi n’a aucune case libre.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : (1) un pion offert est une question, pas un cadeau : je regarde ce que devient la pièce qui prend et ce que fait l’adversaire ensuite ; (2) un roi qui reste au centre est vite en danger sur la colonne e ; (3) avant de capturer, je défends mes cases faibles (ici g2) ou je roque.',
      },
    ],
    exercises: [
      {
        fen: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        prompt:
          'Le cavalier noir est venu en d4 et laisse le pion e5 à ta portée. Que jouerais-tu ?',
        mode: 'engine',
        solution: ['f3d4'],
        tolerance: 8,
        hints: [
          'Compte ce que chaque camp peut capturer sur d4 et sur e5.',
          'Une façon de désamorcer un piège est d’échanger la pièce qui le tend.',
          'Cxd4 exd4, puis tu roques.',
        ],
        explanation:
          'Cxd4 exd4 laisse les Blancs mieux (centre, développement). Cxe5 reste jouable, mais il demande de résister ensuite à Dg5! : la voie la plus simple est d’échanger le cavalier qui tend le piège.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/8/4N3/2BnP3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4',
        prompt:
          'Les Blancs ont pris le pion e5 avec le cavalier. Quel coup de dame crée une double menace ?',
        mode: 'engine',
        solution: ['d8g5'],
        tolerance: 8,
        traps: ['d4c2'],
        hints: [
          'Ta dame est encore à la maison : quelle case lui donne deux cibles à la fois ?',
          'Regarde le cavalier e5 et le pion g2 : quelle case les relie à ta dame ?',
          'Dg5 !',
        ],
        explanation:
          'Dg5! attaque le cavalier e5 et le pion g2, non défendu. Cc2+?, avec l’idée de fourchette, perd une pièce après Dxc2.',
      },
      {
        fen: 'r1b1kbnr/pppp1ppp/8/4N1q1/2BnP3/8/PPPP1PPP/RNBQK2R w KQkq - 1 5',
        prompt:
          'La dame noire attaque e5 et g2. Le cavalier peut prendre f7, mais est-ce la meilleure idée ?',
        mode: 'engine',
        solution: ['c4f7'],
        tolerance: 12,
        traps: ['e5f7'],
        hints: [
          'Avant de capturer avec le cavalier, vérifie ce qui se passe sur g2.',
          'Une capture avec échec garde l’initiative.',
          'Fxf7+ !',
        ],
        explanation:
          'Fxf7+ gagne un pion avec échec et garde le contrôle. Cxf7? Dxg2! mène à un mat en quelques coups.',
      },
      {
        fen: 'r1b1kbnr/pppp1Npp/8/6q1/2BnP3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5',
        prompt:
          'Les Blancs ont pris f7. Rejoue le piège jusqu’au bout : tu joues les Noirs et l’adversaire répond comme dans la partie.',
        mode: 'exact',
        solution: ['g5g2', 'h1f1', 'g2e4', 'c4e2', 'd4f3'],
        hints: [
          'Quel pion est resté sans défenseur ?',
          'Après Tf1, la dame prend avec échec ; puis un cavalier achève.',
          'Dxg2, Tf1, Dxe4+, Fe2, Cf3#.',
        ],
        explanation: 'Dxg2 Tf1 Dxe4+ Fe2 Cf3# : le roi est mat dans son propre camp.',
      },
    ],
  },
  {
    id: 'classique-berger',
    phase: 1,
    title: 'Le coup du berger (partie d’école)',
    summary: 'Le mat en quatre coups le plus connu, et surtout la façon de le parer.',
    minutes: 8,
    sections: [
      {
        kind: 'text',
        body: 'Le coup du berger n’est pas une partie célèbre d’un maître, mais le premier piège que l’on rencontre : il se joue depuis des siècles dans les cours d’école. Savoir le jouer ne sert à rien contre un joueur attentif ; savoir le parer évite de perdre en quatre coups.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) quelle case est la cible des deux pièces blanches ; (2) qui défend cette case au moment où la dame arrive ; (3) pourquoi Cf6 donne l’impression de bien répondre.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'On prend le centre : le pion libère le fou f1 et la dame.',
          },
          {
            uci: 'e7e5',
            comment: 'Les Noirs répondent de la même façon.',
          },
          {
            uci: 'f1c4',
            comment:
              'Le fou vise f7, le pion que seul le roi défend. Pour les Noirs, c’est la case sensible tant qu’ils n’ont pas roqué.',
          },
          {
            uci: 'b8c6',
            comment:
              'Les Noirs développent un cavalier et défendent e5, mais personne ne défend f7. Retiens la question à poser à chaque coup : « qui garde mes points faibles ? »',
          },
          {
            uci: 'd1h5',
            comment:
              'La dame sort avec deux idées : prendre e5, et surtout f7, qu’elle attaque avec le fou. Menace : Dxf7 mat. Sortir la dame si tôt est risqué si l’adversaire sait se défendre.',
          },
          {
            uci: 'g8f6',
            comment:
              'Ce cavalier attaque la dame : cela ressemble à une bonne réponse, puisqu’on gagne un temps. Mais il ne défend pas f7. Il fallait répondre à la menace : g6 ou De7.',
          },
          {
            uci: 'h5f7',
            comment:
              'La dame prend f7, protégée par le fou c4. Le roi ne peut pas la capturer, et ses cases de fuite sont prises ou occupées : d8 et f8 par ses propres pièces, e7 par la dame. Mat !',
          },
        ],
      },
      {
        kind: 'example',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        caption:
          'Voilà la parade : les Blancs menacent Dxf7 mat. Les Noirs ont trois bonnes réponses, g6 (qui chasse la dame), De7 ou Df6 (qui gardent f7). Cf6 ?? perd tout de suite.',
        arrows: [
          ['h5', 'f7'],
          ['c4', 'f7'],
        ],
        marks: ['f7'],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : (1) quand une pièce adverse me menace, je regarde d’abord ce qu’elle menace vraiment, pas seulement ce qu’elle attaque ; (2) le pion f7 (ou f2) n’est défendu que par le roi : c’est la cible des premiers coups ; (3) sortir la dame très tôt est dangereux si l’adversaire sait parer, car on perd du temps.',
      },
    ],
    exercises: [
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        prompt:
          'Les Noirs n’ont pas défendu f7. Quel coup de dame ajoute une deuxième attaque sur ce pion ?',
        mode: 'choice',
        solution: ['d1h5'],
        accepted: ['d1h5', 'd1f3'],
        hints: [
          'Quelle pièce peut viser f7 en un seul coup ?',
          'Il y a deux cases possibles pour la dame.',
          'Dh5 (ou Df3).',
        ],
        explanation:
          'Dh5 et Df3 visent f7, que le roi est seul à défendre. Mais le plan se parera facilement si l’adversaire connaît la menace.',
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        prompt: 'Les Blancs menacent Dxf7 mat. Quelle parade joues-tu ?',
        mode: 'engine',
        solution: ['g7g6'],
        tolerance: 8,
        traps: ['g8f6'],
        hints: [
          'Quelle pièce ou quel pion peut défendre f7 ?',
          'Tu peux aussi attaquer la dame qui menace.',
          'g6 chasse la dame ; De7 défend aussi.',
        ],
        explanation:
          'g6 attaque la dame et la chasse ; De7 ou Df6 défendent f7. Cf6?? Dxf7# perd sur-le-champ.',
      },
      {
        fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4',
        prompt:
          'Après g6, la dame blanche se retire en f3 et vise de nouveau f7. Quel développement parent la menace ?',
        mode: 'engine',
        solution: ['g8f6'],
        tolerance: 8,
        traps: ['f8g7'],
        hints: [
          'Quel obstacle peux-tu placer entre la dame et f7 ?',
          'Un cavalier qui sort fait deux choses à la fois.',
          'Cf6 : il bloque la colonne f et se développe.',
        ],
        explanation:
          'Cf6 bloque la colonne f et sort un cavalier. Fg7?? est un développement naturel, mais Dxf7# mate aussitôt.',
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        prompt: 'Les Noirs ont joué Cf6?? Trouve le mat en 1.',
        mode: 'exact',
        solution: ['h5f7'],
        hints: [
          'Quelle case est attaquée par deux pièces et défendue par une seule ?',
          'La dame doit être protégée par le fou.',
          'Dxf7#.',
        ],
        explanation: 'Dxf7# : la dame est protégée par le fou c4 et le roi n’a plus de case.',
      },
    ],
  },
];

export const CLASSICS_2: Lesson[] = [
  {
    id: 'classique-opera',
    phase: 2,
    title: 'La partie de l’Opéra (Morphy, 1858)',
    summary: 'Une miniature célèbre : développement, clouages et mat en 17 coups.',
    minutes: 18,
    sections: [
      {
        kind: 'text',
        body: 'En 1858, à Paris, Paul Morphy joue pendant une représentation d’opéra contre deux amateurs qui conseillent le duc de Brunswick et le comte Isouard. Il gagne en 17 coups en appliquant sans faille les principes d’ouverture : **chaque coup apporte une pièce** et profite du retard adverse.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) combien de pièces Morphy a sorties quand son adversaire n’en a qu’une ; (2) chaque fois qu’une menace apparaît, la question « que menace-t-il ? » ; (3) le thème final : un cavalier cloué, puis dévié.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment:
              'Morphy ouvre au centre : le pion occupe une case clé et libère le fou f1 et la dame.',
          },
          {
            uci: 'e7e5',
            comment: 'Les Noirs répondent symétriquement, le plus simple.',
          },
          {
            uci: 'g1f3',
            comment:
              'Le cavalier sort en attaquant e5 : développer en menaçant, c’est gagner un temps.',
          },
          {
            uci: 'd7d6',
            comment: 'Défense Philidor : solide, mais elle enferme un peu le fou f8.',
          },
          {
            uci: 'd2d4',
            comment:
              'Morphy attaque le centre noir avant que les Noirs aient développé quoi que ce soit.',
          },
          {
            uci: 'c8g4',
            comment:
              'Le fou sort tôt et cloue le cavalier f3 contre la dame. Une seule pièce sortie, et déjà en avant : attention.',
          },
          {
            uci: 'd4e5',
            comment:
              'Prise d’un pion central. Rien ne presse pour les Noirs : l’échange va suivre.',
          },
          {
            uci: 'g4f3',
            comment: 'Le fou prend le cavalier cloué : sinon les Noirs perdent un pion pour rien.',
          },
          {
            uci: 'd1f3',
            comment: 'La dame reprend en se développant, et vise déjà f7.',
          },
          {
            uci: 'd6e5',
            comment:
              'Les Noirs reprennent le pion : l’égalité matérielle est rétablie, mais leur roi est encore au centre.',
          },
          {
            uci: 'f1c4',
            comment:
              'Le fou et la dame visent f7, défendu par le seul roi. **Question « menaces »** : Dxf7 serait mat !',
          },
          {
            uci: 'g8f6',
            comment:
              'Parade obligatoire : le cavalier bloque la colonne f et sauve le roi. Sans la question « quelle est la menace ? », les Noirs étaient perdus.',
          },
          {
            uci: 'f3b3',
            comment: 'Double menace : Dxb7 d’un côté, et la batterie dame-fou sur f7 de l’autre.',
          },
          {
            uci: 'd8e7',
            comment:
              'Les Noirs défendent f7 avec la dame. Morphy ne se laisse pas tenter par b7 : il préfère finir son développement.',
          },
          {
            uci: 'b1c3',
            comment:
              'Le dernier cavalier sort. Chaque coup apporte une pièce de plus dans la partie : c’est le vrai secret de Morphy.',
          },
          {
            uci: 'c7c6',
            comment:
              'Le pion c6 protège b5 et d5, mais il n’aide pas le développement des Noirs, toujours sans roque.',
          },
          {
            uci: 'c1g5',
            comment:
              'Le fou cloue le cavalier f6 contre la dame e7 : le cavalier ne peut plus bouger sans perdre la dame.',
          },
          {
            uci: 'b7b5',
            comment:
              'Les Noirs veulent chasser le fou c4, mais ils ouvrent leur aile dame alors que le roi est au centre : l’adversaire va en profiter.',
          },
          {
            uci: 'c3b5',
            comment:
              'Sacrifice de cavalier : Morphy ouvre les lignes autour d’un roi non roqué. Il a vérifié les échecs et les prises, puis il a calculé.',
          },
          {
            uci: 'c6b5',
            comment:
              'Les Noirs prennent la pièce, mais le pion c6 disparaît : la diagonale a4-e8 est ouverte.',
          },
          {
            uci: 'c4b5',
            comment: 'Échec ! Le fou reprend le pion avec gain de tempo sur la diagonale ouverte.',
          },
          {
            uci: 'b8d7',
            comment:
              'Parade forcée : le cavalier b8 s’interpose. Il est maintenant cloué par le fou b5 contre le roi.',
          },
          {
            uci: 'e1c1',
            comment:
              'Le roque long met la tour sur la colonne d, d’un seul coup : développer en attaquant le cavalier cloué.',
          },
          {
            uci: 'a8d8',
            comment:
              'Les Noirs défendent d7 avec la tour, mais le cavalier reste cloué : il ne peut pas bouger.',
          },
          {
            uci: 'd1d7',
            comment:
              'La tour prend le cavalier cloué : elle donne une pièce d’échange contre le cavalier, mais le clouage reste sur la colonne d.',
          },
          {
            uci: 'd8d7',
            comment:
              'Reprise forcée : la tour d7 est maintenant elle-même clouée par le fou b5 contre le roi e8.',
          },
          {
            uci: 'h1d1',
            comment:
              'La seconde tour arrive : la tour d7 (clouée) est attaquée deux fois, par la tour d1 et par le fou b5.',
          },
          {
            uci: 'e7e6',
            comment:
              'La dame défend d7 une fois de plus, et propose l’échange des dames sur la diagonale b3-e6.',
          },
          {
            uci: 'b5d7',
            comment:
              'Sacrifice de fou : les Noirs peuvent reprendre avec la dame ou avec le cavalier. Avec le cavalier, ils vont bloquer eux-mêmes la colonne d.',
          },
          {
            uci: 'f6d7',
            comment:
              'Le cavalier reprend en d7, mais il est maintenant le seul pièce qui masque la colonne d devant le roi.',
          },
          {
            uci: 'b3b8',
            comment:
              'Sacrifice de dame : le cavalier d7 doit prendre, et il abandonne la colonne d. C’est une déviation.',
          },
          {
            uci: 'd7b8',
            comment: 'Seule prise possible, et la colonne d s’ouvre pour la tour.',
          },
          {
            uci: 'd1d8',
            comment:
              'Mat : la tour d8 est protégée par le fou g5 ; d7 et e7 sont contrôlés, et f8 et f7 sont occupés par les propres pièces noires.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : sortir des pièces vaut mieux que prendre des pions ; un roi resté au centre est une cible ; avant de jouer un coup tentant, je demande « que menace l’adversaire ? ». Les Noirs ont perdu parce qu’ils ont joué avec une seule pièce.',
      },
    ],
    exercises: [
      {
        fen: 'rn1qkb1r/ppp2ppp/5n2/4p3/2B1P3/5Q2/PPP2PPP/RNB1K2R w KQkq - 2 7',
        prompt:
          'Les Noirs viennent de parer Dxf7# par Cf6. Comment poursuivre l’initiative sans rien laisser en prise ?',
        mode: 'engine',
        solution: ['f3b3'],
        tolerance: 7,
        traps: ['f3f6', 'c4f7'],
        hints: [
          'Quelle pièce n’a pas encore sa place ? Pas de prise : cherche un coup de menace.',
          'La dame et le fou visent déjà f7 : ajoute une deuxième menace.',
          'Db3 attaque b7 et garde la pression sur f7.',
        ],
        explanation:
          'Db3 menace b7 et f7 à la fois. Dxf6? gxf6 coûte la dame pour un cavalier, et Fxf7+? Rxf7 donne une pièce pour un pion.',
      },
      {
        fen: 'rn2kb1r/pp2qppp/2p2n2/4p3/2B1P3/1QN5/PPP2PPP/R1B1K2R w KQkq - 0 9',
        prompt:
          'Les Noirs ont joué c6. Que jouerais-tu pour développer la dernière pièce mineure avec gain de temps ?',
        mode: 'engine',
        solution: ['c1g5'],
        tolerance: 7,
        traps: ['b3b7'],
        hints: [
          'Quelles pièces blanches ne sont pas développées ?',
          'Une pièce qui cloue en développant fait deux choses à la fois.',
          'Fg5 cloue le cavalier f6 contre la dame e7.',
        ],
        explanation:
          'Fg5 sort le fou avec clouage. Dxb7? Db4+ puis Dxb2 : le pion empoisonné fait perdre le contrôle de la partie.',
      },
      {
        fen: 'rn2kb1r/p3qppp/2p2n2/1p2p1B1/2B1P3/1QN5/PPP2PPP/R3K2R w KQkq - 0 10',
        prompt: 'Les Noirs ont joué b5 pour chasser le fou. Quel sacrifice ouvre le roi noir ?',
        mode: 'engine',
        solution: ['c3b5'],
        tolerance: 8,
        traps: ['g5f6'],
        hints: [
          'Le roi noir est encore au centre : cherche une ligne à ouvrir.',
          'Quelle pièce peut prendre b5 et faire sauter le pion c6 ?',
          'Cxb5 : si cxb5, Fxb5+ avec échec sur la diagonale.',
        ],
        explanation:
          'Cxb5 donne une pièce mais ouvre la diagonale a4-e8 et la colonne b. Fxf6? gxf6 est sans intérêt.',
      },
      {
        fen: 'r3kb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/R3K2R w KQkq - 1 12',
        prompt:
          'Le cavalier d7 est cloué par le fou b5. Quel coup met la tour sur la colonne d tout en mettant le roi à l’abri ?',
        mode: 'engine',
        solution: ['e1c1'],
        tolerance: 8,
        hints: [
          'Que peut faire le roi pour libérer une tour d’un seul coup ?',
          'Roquer, mais de quel côté ?',
          'Le grand roque met la tour sur d1.',
        ],
        explanation:
          'O-O-O développe la tour sur la colonne d et attaque le cavalier cloué : on ajoute un attaquant sans rien laisser en prise.',
      },
      {
        fen: '4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 2 15',
        prompt:
          'Mat en 3. Les Blancs ont une dame, une tour et un fou pour attaquer. Donne la suite complète : tu joues, l’adversaire répond de force, etc.',
        mode: 'exact',
        solution: ['b5d7', 'f6d7', 'b3b8', 'd7b8', 'd1d8'],
        hints: [
          'Quel sacrifice enlève la pièce qui bloque la colonne d ?',
          'Après Fxd7+ Cxd7, la dame peut-elle venir sur b8 ?',
          'Fxd7+ Cxd7, Db8+ Cxb8, Td8#.',
        ],
        explanation:
          'Fxd7+ Cxd7 Db8+! Cxb8 Td8# : le cavalier est dévié de la colonne d, et le fou g5 protège la tour.',
      },
    ],
  },
  {
    id: 'classique-legal',
    phase: 2,
    title: 'Le mat de Légal (1750)',
    summary:
      'Un sacrifice de dame qui réussit parce que le cavalier n’était cloué que contre la dame.',
    minutes: 12,
    sections: [
      {
        kind: 'text',
        body: 'Le mat de Légal, ancien de près de trois siècles, se rejoue encore. Il montre qu’un clouage contre la dame n’est pas un clouage absolu : le cavalier peut bouger, à condition qu’on ait vu la suite.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le clouage du cavalier f3 contre la dame ; (2) pourquoi les Noirs prennent la dame sans regarder les échecs ; (3) le mat final avec trois pièces seulement.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Ouverture classique : le pion occupe le centre.',
          },
          {
            uci: 'e7e5',
            comment: 'Réponse symétrique des Noirs.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier attaque e5 en se développant.',
          },
          {
            uci: 'd7d6',
            comment: 'Les Noirs défendent e5 d’un pion : solide, mais cela bloque le fou f8.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7, case faible tant que le roi noir n’a pas roqué.',
          },
          {
            uci: 'c8g4',
            comment:
              'Le fou noir cloue le cavalier f3 contre la dame. Tentant, mais il quitte la défense de f7 et sort sans raison tactique.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier c3 développe une pièce et prépare le piège : il contrôle d5.',
          },
          {
            uci: 'g7g6',
            comment:
              'Les Noirs préparent un fianchetto mais n’ont pas posé la question des menaces : que veulent les Blancs ?',
          },
          {
            uci: 'f3e5',
            comment:
              'Sacrifice de dame ! Le cavalier f3 n’est cloué que contre la dame, pas contre le roi : il peut partir.',
          },
          {
            uci: 'g4d1',
            comment:
              'Les Noirs prennent la dame : gagner une dame est tentant, mais ils n’ont pas regardé les échecs.',
          },
          {
            uci: 'c4f7',
            comment:
              'Échec : le fou prend f7, et le roi ne peut pas reprendre car le cavalier e5 protège f7.',
          },
          {
            uci: 'e8e7',
            comment: 'Le roi est forcé d’aller en e7.',
          },
          {
            uci: 'c3d5',
            comment:
              'Mat : le cavalier d5 donne l’échec, et le roi est enfermé par sa propre dame, son fou f8 et son pion d6.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : avant de prendre une pièce, je regarde les échecs que l’adversaire peut donner ensuite. Un clouage contre la dame n’empêche pas de bouger la pièce clouée : c’est un sacrifice.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
        prompt:
          'Les Noirs viennent de défendre e5. Quel développement naturel vise f7, le point faible des Noirs ?',
        mode: 'engine',
        solution: ['f1c4'],
        tolerance: 7,
        traps: ['f3e5'],
        hints: [
          'Quelle pièce mineure n’est pas encore sortie ?',
          'Le fou roi a une belle diagonale.',
          'Fc4 vise f7.',
        ],
        explanation: 'Fc4 développe le fou vers f7. Cxe5? dxe5 donne un cavalier pour un pion.',
      },
      {
        fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4',
        prompt:
          'Que jouerais-tu avec les Noirs ? Pense à ce que menacent les Blancs avant de fianchetter.',
        mode: 'engine',
        solution: ['g8f6'],
        tolerance: 8,
        traps: ['g7g6'],
        hints: [
          'Quelle menace les Blancs ont-ils ? Regarde e5.',
          'Le cavalier f3 est cloué, mais seulement contre la dame : il peut partir.',
          'Mieux vaut développer un cavalier : Cf6 ou Cc6.',
        ],
        explanation:
          'g6 ? permet Cxe5! Fxd1 Fxf7+ Re7 Cd5#. Un développement normal comme Cf6 ou Cc6 évite le piège.',
      },
      {
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
        prompt:
          'Les Noirs ont joué g6. Les Blancs ont une pièce clouée. Quel coup sacrifie la dame pour mater ?',
        mode: 'engine',
        solution: ['f3e5'],
        tolerance: 8,
        traps: ['c4f7'],
        hints: [
          'Le cavalier f3 est-il vraiment cloué ?',
          'Que se passe-t-il si le cavalier prend un pion en e5 ?',
          'Cxe5 offre la dame : si Fxd1, Fxf7+ puis Cd5#.',
        ],
        explanation: 'Cxe5 ! Si Fxd1, Fxf7+ Re7 Cd5#. Fxf7+? Rxf7 perd une pièce sans raison.',
      },
      {
        fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
        prompt: 'Les Noirs ont pris la dame. Trouve le mat en 2 (ta suite complète).',
        mode: 'exact',
        solution: ['c4f7', 'e8e7', 'c3d5'],
        hints: [
          'Quel échec peux-tu donner avec le fou ?',
          'Le roi n’a qu’une case de fuite.',
          'Fxf7+ Re7, Cd5#.',
        ],
        explanation:
          'Fxf7+ Re7 Cd5# : le roi est enfermé par sa propre dame, son fou f8 et son pion d6.',
      },
    ],
  },
  {
    id: 'classique-reti',
    phase: 2,
    title: 'Réti–Tartakower (Vienne, 1910)',
    summary: 'Un mat au sixième coup contre la défense Caro-Kann.',
    minutes: 10,
    sections: [
      {
        kind: 'text',
        body: 'Richard Réti bat Savielly Tartakower en six coups à Vienne en 1910. La partie est une leçon sur la menace cachée : un cavalier qui se dévoile avec échec en démasquant une pièce.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) la dame placée derrière le cavalier e4 ; (2) la case d6 et le roque impossible ; (3) pourquoi Cgf6 ne résout rien.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Le pion roi occupe le centre.',
          },
          {
            uci: 'c7c6',
            comment:
              'La défense Caro-Kann : les Noirs préparent d5 en gardant une structure solide.',
          },
          {
            uci: 'd2d4',
            comment: 'Les Blancs prennent aussi le centre.',
          },
          {
            uci: 'd7d5',
            comment: 'Les Noirs attaquent e4 : le centre va se découvrir.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier défend e4 et se développe : un coup naturel.',
          },
          {
            uci: 'd5e4',
            comment: 'Les Noirs échangent le pion central.',
          },
          {
            uci: 'c3e4',
            comment: 'Le cavalier reprend le pion et se place au centre.',
          },
          {
            uci: 'b8d7',
            comment:
              'Le cavalier d7 prépare Cgf6 sans risquer d’échange en f6. Un coup courant, mais il bloque la dame.',
          },
          {
            uci: 'd1e2',
            comment:
              'Piège : la dame se place derrière le cavalier e4. Il menace de partir avec échec en d6, démasquant la dame sur e7.',
          },
          {
            uci: 'g8f6',
            comment:
              'Les Noirs attaquent le cavalier au lieu de regarder la menace. Ils ont oublié de demander « que menace-t-il ? ».',
          },
          {
            uci: 'e4d6',
            comment:
              'Mat : le cavalier d6 donne échec, et le roi e8 est entouré de ses pièces (d8, f8, d7, e7, f7).',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : demander « quelle est la menace ? » avant chaque coup. Un coup de développement automatique (Cgf6) peut être une gaffe si la case d6 est libre pour un cavalier.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
        prompt:
          'Les Noirs vont jouer d5xe4 : le pion e4 doit être défendu. Quel développement le protège ?',
        mode: 'choice',
        solution: ['b1c3'],
        accepted: ['b1c3', 'b1d2'],
        hints: [
          'Quelle pièce mineure défend e4 en se développant ?',
          'Deux cavaliers peuvent aller en c3 ou d2.',
          'Cc3 ou Cd2.',
        ],
        explanation:
          'Cc3 défend e4 en développant un cavalier. Cd2 aussi, mais il bloque le fou c1.',
      },
      {
        fen: 'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP1QPPP/R1B1KBNR b KQkq - 2 5',
        prompt:
          'Cd6 menace d’être mat. Désigne toutes les pièces noires qui touchent le roi e8 et l’emprisonnent.',
        mode: 'squares',
        squares: ['d8', 'f8', 'd7', 'e7', 'f7'],
        solution: [],
        hints: [
          'Regarde les huit cases autour du roi.',
          'Combien sont occupées par ses propres pièces ?',
          'Les cinq cases voisines sont occupées.',
        ],
        explanation:
          'Toutes les cases voisines du roi sont occupées par ses propres pièces : un échec de cavalier en d6 serait mat.',
      },
      {
        fen: 'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP1QPPP/R1B1KBNR b KQkq - 2 5',
        prompt:
          'Les Blancs menacent Cd6# après le départ du cavalier e4. Que jouerais-tu avec les Noirs ?',
        mode: 'engine',
        solution: ['d7f6'],
        tolerance: 10,
        traps: ['g8f6'],
        hints: [
          'Que peut faire le cavalier e4 en deux coups ?',
          'La case d6 est-elle contrôlée ? Le roi a-t-il une case de fuite ?',
          'Cdf6 libère d7 pour le roi ; Dc7 ou e6 contrôlent aussi d6.',
        ],
        explanation:
          'Il faut libérer une case de fuite ou contrôler d6 : Cdf6, Dc7 ou e6. Cgf6?? laisse le cavalier d7 en place et permet Cd6#.',
      },
      {
        fen: 'r1bqkb1r/pp1npppp/2p2n2/8/3PN3/8/PPP1QPPP/R1B1KBNR w KQkq - 3 6',
        prompt: 'Les Noirs ont joué Cgf6. Trouve le mat en un coup.',
        mode: 'exact',
        solution: ['e4d6'],
        hints: [
          'Le cavalier e4 découvre la dame sur e7.',
          'Quelle case donne échec au roi e8 ?',
          'Cd6#.',
        ],
        explanation:
          'Cd6# : le roi est entouré de ses propres pièces, et le cavalier d6 ne peut pas être pris.',
      },
    ],
  },
  {
    id: 'classique-lasker-thomas',
    phase: 2,
    title: 'Lasker–Thomas (Londres, 1912) : la chasse au roi',
    summary:
      'Un sacrifice de dame sur h7, un double échec et un roi noir chassé de h7 jusqu’en g1 : le modèle de l’attaque contre un roi roqué.',
    minutes: 18,
    sections: [
      {
        kind: 'text',
        body: 'En 1912, à Londres, Edward Lasker (à ne pas confondre avec le champion du monde Emanuel Lasker) joue les Blancs contre Sir George Thomas, l’un des meilleurs joueurs britanniques de l’époque. La partie est devenue un modèle : les Blancs attirent le roi noir hors de son abri, puis le chassent à travers tout l’échiquier.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) la diagonale h5–e8, que ...f5 puis ...fxe4 laissent ouverte ; (2) le cavalier f6, défenseur clé de h7, et la raison de son échange ; (3) comment des pions (h4, g3) et des pièces mineures chassent un roi à découvert.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'd2d4',
            comment:
              'Les Blancs avancent le pion dame : il prend le centre et libère le fou c1 et la dame.',
          },
          {
            uci: 'e7e6',
            comment: 'Réponse solide : le pion e6 soutient d5 et libère le fou f8.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier sort vers le centre : il garde d4 et contrôle e5.',
          },
          {
            uci: 'f7f5',
            comment:
              'La défense hollandaise : le pion f5 contrôle e4. Mais il a un prix, car il ouvre peu à peu la diagonale e8–h5 qui mène droit au roi noir. Retiens ce détail.',
          },
          {
            uci: 'e2e4',
            comment:
              'Un gambit : les Blancs offrent le pion e4 pour ouvrir le centre et éloigner le pion f de sa place. Ils veulent des lignes ouvertes pour leurs pièces, et ils sont prêts à investir un pion.',
          },
          {
            uci: 'f5e4',
            comment:
              'Les Noirs acceptent. Le pion quitte f5 : la diagonale h5–e8 est désormais libre pour une dame blanche.',
          },
          {
            uci: 'b1c3',
            comment:
              'Le cavalier sort en attaquant e4 : les Blancs veulent récupérer le pion en se développant.',
          },
          {
            uci: 'g8f6',
            comment:
              'Le cavalier défend e4. Il garde aussi les cases h5 et h7, un rôle qui va compter plus tard.',
          },
          {
            uci: 'c1g5',
            comment:
              'Le fou sort en clouant le cavalier f6 contre la dame d8. Un cavalier cloué ne peut pas défendre librement.',
          },
          {
            uci: 'f8e7',
            comment:
              'Les Noirs dénouent le clouage et se préparent à roquer : un coup naturel et correct.',
          },
          {
            uci: 'g5f6',
            comment:
              'Pourquoi échanger ce fou ? Parce que le cavalier f6 défend h5 et h7. En l’éliminant, les Blancs affaiblissent le futur abri du roi noir.',
          },
          {
            uci: 'e7f6',
            comment:
              'Reprise normale. Le fou f6 s’installe sur la grande diagonale, mais il ne garde pas h7.',
          },
          {
            uci: 'c3e4',
            comment:
              'Les Blancs récupèrent le pion e4 : le gambit est terminé, le matériel est égal, et le cavalier central attaque le fou f6.',
          },
          {
            uci: 'b7b6',
            comment:
              'Les Noirs préparent Fb7 sur la grande diagonale : un bon plan, mais un peu lent face à ce qui se prépare.',
          },
          {
            uci: 'f3e5',
            comment:
              'Un avant-poste : le cavalier e5, soutenu par le pion d4, ne peut pas être chassé par un pion. Il surveille d7, f7 et g6, et rapproche les Blancs du roi noir.',
          },
          {
            uci: 'e8g8',
            comment:
              'Le roque met le roi noir à l’abri, du moins en apparence. En g8, il est sur la diagonale que les Blancs sont en train d’occuper.',
          },
          {
            uci: 'f1d3',
            comment:
              'Le fou prend la diagonale b1–h7 : il vise h7, mais le cavalier e4 lui barre encore la route. Une batterie se prépare, le cavalier va bientôt s’écarter.',
          },
          {
            uci: 'c8b7',
            comment:
              'Les Noirs sortent le dernier fou et attaquent e4, mais oublient la sécurité de leur roi. C’est le moment de se demander : « que veut faire mon adversaire ? »',
          },
          {
            uci: 'd1h5',
            comment:
              'La dame arrive sur h5, la case que le cavalier noir ne garde plus. Elle vise h7 que le fou d3 soutient en secret derrière le cavalier e4.',
          },
          {
            uci: 'd8e7',
            comment:
              'L’erreur. La dame ne défend pas h7 : le pion g7 lui barre la route. Fxe5, qui élimine le cavalier gênant, était plus sûr.',
          },
          {
            uci: 'h5h7',
            comment:
              'Le sacrifice de dame ! Le roi doit prendre, et il quitte ainsi son abri pour une case où il croisera la diagonale du fou d3, que seul le cavalier e4 masque encore.',
          },
          {
            uci: 'g8h7',
            comment:
              'La prise est forcée : le roi n’a pas d’autre coup. Il est maintenant en h7, en face du fou d3.',
          },
          {
            uci: 'e4f6',
            comment:
              'Double échec ! Le cavalier prend le fou f6 en donnant échec, et découvre en même temps le fou d3. Contre un double échec, on ne peut que déplacer le roi.',
          },
          {
            uci: 'h7h6',
            comment:
              'Le roi n’a que deux cases, car g8 est contrôlée par le cavalier f6. Le roi en h8 serait mat en un coup (Cg6, un mat étouffé) : il part vers h6.',
          },
          {
            uci: 'e5g4',
            comment:
              'Le second cavalier entre dans la danse : Cg4+ donne échec, et les deux cavaliers se protègent mutuellement. Le roi n’a plus qu’une case.',
          },
          {
            uci: 'h6g5',
            comment:
              'Seul coup légal. Le roi s’avance en plein champ ennemi, ce qui annonce la fin.',
          },
          {
            uci: 'h2h4',
            comment:
              'Un pion qui donne échec est difficile à parer. Le pion h4 est protégé par la tour h1, et le roi ne peut pas le prendre.',
          },
          {
            uci: 'g5f4',
            comment:
              'Seul coup légal : la case f4 est la seule qui reste, car h4 est défendu par la tour.',
          },
          {
            uci: 'g2g3',
            comment: 'Un deuxième pion donne échec : g3 attaque f4 et soutient h4.',
          },
          {
            uci: 'f4f3',
            comment:
              'Encore un coup forcé : le roi est repoussé vers le camp blanc, sous le feu du fou d3.',
          },
          {
            uci: 'd3e2',
            comment:
              'Le fou revient donner échec. D’autres coups matent un coup plus tôt, mais celui-ci est convaincant : toutes les cases du roi sont surveillées l’une après l’autre.',
          },
          {
            uci: 'f3g2',
            comment: 'Seul coup légal : le roi file vers g2.',
          },
          {
            uci: 'h1h2',
            comment:
              'La tour h1 donne échec en h2 : elle est protégée par le pion g3, et le roi ne peut pas la prendre.',
          },
          {
            uci: 'g2g1',
            comment:
              'Seul coup légal : Rxh2 est impossible, g3 défend la tour. Mais le roi blanc, resté en e1, cache la tour a1…',
          },
          {
            uci: 'e1d2',
            comment:
              'Mat à la découverte ! Le roi blanc s’écarte et la tour a1 donne échec le long de la première rangée. Les cases de fuite sont toutes prises : f1 par la tour a1, f2 et g2 et h1 par la tour h2, et la tour h2 est protégée par g3. Le roi noir a été chassé de h7 jusqu’à g1.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : (1) quand un pion s’avance devant un roi, je cherche les lignes qu’il ouvre ; (2) j’élimine le défenseur clé (le cavalier f6) avant d’attaquer h7 ; (3) un sacrifice de dame se justifie quand il mène à un mat forcé : je calcule tous les échecs, jusqu’au bout, avant de jouer.',
      },
    ],
    exercises: [
      {
        fen: 'rnbqkbnr/pppp2pp/4p3/8/3Pp3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4',
        prompt:
          'Le pion f est parti de f7 vers e4. Désigne les trois cases vides de la diagonale e8–h5 par lesquelles une dame blanche pourrait atteindre le roi noir.',
        mode: 'squares',
        squares: ['f7', 'g6', 'h5'],
        solution: [],
        hints: [
          'La diagonale part du roi e8 et file vers l’aile roi.',
          'Elle passe par les cases f7 et g6, avant d’arriver au bord.',
          'f7, g6 et h5.',
        ],
        explanation:
          'La diagonale e8–f7–g6–h5 est désormais ouverte : ...f5 a affaibli la maison du roi noir.',
      },
      {
        fen: 'rnbqk2r/ppppb1pp/4pn2/6B1/3Pp3/2N2N2/PPP2PPP/R2QKB1R w KQkq - 4 6',
        prompt:
          'Le cavalier f6 défend h5 et h7, deux cases clés devant le roi noir. Comment l’éliminer ?',
        mode: 'engine',
        solution: ['g5f6'],
        tolerance: 6,
        traps: ['f3e5'],
        hints: [
          'Quelle pièce défend les cases h5 et h7 ?',
          'Tu as déjà une pièce qui l’attaque.',
          'Fxf6.',
        ],
        explanation:
          'Fxf6 Fxf6 Cxe4 supprime le défenseur de h7 et regagne le pion. Ce5? abandonne la protection du fou g5, qui tombe.',
      },
      {
        fen: 'rn3rk1/pbppq1pp/1p2pb2/4N2Q/3PN3/3B4/PPP2PPP/R3K2R w KQ - 6 11',
        prompt:
          'Les Noirs viennent de jouer De7. Regarde bien la position : les Blancs peuvent-ils sacrifier la dame ? Trouve le coup qui force le mat.',
        mode: 'engine',
        solution: ['h5h7'],
        tolerance: 5,
        traps: ['e1g1'],
        hints: [
          'Le fou d3 est masqué par le cavalier e4.',
          'Quelle case, devant le roi, est attaquée par la dame et le fou à la fois ?',
          'Dxh7+ Rxh7 Cxf6+ : double échec.',
        ],
        explanation:
          'Dxh7+! Rxh7 Cxf6+ est un double échec qui force un mat en sept coups. Roquer laisse tout de même échapper la victoire.',
      },
      {
        fen: 'rn3r2/pbppq1p1/1p2pN2/6k1/3P2N1/3B4/PPP2PPP/R3K2R w KQ - 3 14',
        prompt:
          'Le roi noir est sur g5, entouré de tes cavaliers. Quel échec le pousse plus loin ?',
        mode: 'engine',
        solution: ['h2h4'],
        tolerance: 5,
        traps: ['f6h7'],
        hints: [
          'Quelle pièce peut attaquer g5 sans être prise ?',
          'Un pion, soutenu par la tour h1.',
          'h4+.',
        ],
        explanation:
          'h4+ chasse le roi, qui ne peut pas prendre le pion défendu par la tour. Ch7+? donne un échec inutile et laisse tout échapper.',
      },
      {
        fen: 'rn3r2/pbppq1p1/1p2pN2/8/3P2NP/6P1/PPP1BPk1/R3K2R w KQ - 3 17',
        prompt: 'Mat en 2 : trouve l’échec avec la tour, que le roi noir ne peut pas prendre.',
        mode: 'engine',
        solution: ['h1h2'],
        tolerance: 5,
        hints: [
          'Quelle pièce peut donner échec depuis la colonne h ?',
          'Elle doit être protégée par le pion g3.',
          'Th2+ puis le roi blanc s’écarte et découvre la tour a1.',
        ],
        explanation:
          'Th2+ Rg1, puis Rd2# (ou tout autre déplacement) : la tour a1 donne échec à la découverte.',
      },
    ],
  },
];

export const CLASSICS_3: Lesson[] = [
  {
    id: 'classique-lasker-bauer',
    phase: 3,
    title: 'Lasker–Bauer (Amsterdam, 1889)',
    summary: 'Le double sacrifice de fou : Fxh7+ puis Fxg7 contre un roi roqué.',
    minutes: 22,
    sections: [
      {
        kind: 'text',
        body: 'Emanuel Lasker joue contre Johann Bauer à Amsterdam en 1889. La partie est l’une des premières à montrer clairement le « sacrifice grec » : le fou prend h7 avec échec, le roi prend, puis la dame arrive avec échec. Lasker en ajoute un second sur g7 : un modèle pour toute attaque sur un roque.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) les plans des Blancs : fou b2 vers la grande diagonale, fou d3 vers h7, cavalier en e5 ; (2) le coup lent des Noirs (…a6) ; (3) comment chaque pièce blanche rejoint l’attaque.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'f2f4',
            comment: 'L’ouverture Bird : f4 contrôle la case e5 depuis le flanc roi.',
          },
          {
            uci: 'd7d5',
            comment: 'Les Noirs occupent le centre avec d5.',
          },
          {
            uci: 'e2e3',
            comment: 'e3 solidifie le centre et ouvre la diagonale du fou f1.',
          },
          {
            uci: 'g8f6',
            comment: 'Le cavalier sort et surveille e4.',
          },
          {
            uci: 'b2b3',
            comment: 'Plan des Blancs : le fou ira en b2 pour viser la grande diagonale.',
          },
          {
            uci: 'e7e6',
            comment: 'Les Noirs ouvrent la diagonale du fou f8.',
          },
          {
            uci: 'c1b2',
            comment: 'Le fou b2 regarde vers e5 et g7 : il est déjà bien placé.',
          },
          {
            uci: 'f8e7',
            comment: 'Le fou noir se prépare à roquer.',
          },
          {
            uci: 'f1d3',
            comment: 'Le fou d3 vise h7 : le plan d’attaque contre le roque se dessine.',
          },
          {
            uci: 'b7b6',
            comment: 'Les Noirs fianchettent aussi, mais ne pensent pas à la défense de h7.',
          },
          {
            uci: 'b1c3',
            comment: 'Le cavalier sort sans bloquer le fou b2 : un pion de moins dans le chemin.',
          },
          {
            uci: 'c8b7',
            comment:
              'Le fou b7 contrôle la grande diagonale, mais il est pour l’instant sans cible.',
          },
          {
            uci: 'g1f3',
            comment: 'Le second cavalier sort : le roque est proche.',
          },
          {
            uci: 'b8d7',
            comment: 'Le cavalier d7 surveille e5 mais enferme le fou b7.',
          },
          {
            uci: 'e1g1',
            comment: 'Roque blanc : le roi est en sécurité, toutes les pièces sont développées.',
          },
          {
            uci: 'e8g8',
            comment: 'Roque noir : à partir de maintenant, le roi noir sera la cible.',
          },
          {
            uci: 'c3e2',
            comment: 'Le cavalier se dirige vers g3, puis vers e5 ou h5.',
          },
          {
            uci: 'c7c5',
            comment: 'Les Noirs prennent de l’espace à l’aile dame, loin de l’action réelle.',
          },
          {
            uci: 'e2g3',
            comment:
              'Le cavalier g3 prépare e5 ou h5 : un bel exemple de pièce amenée vers le roque adverse.',
          },
          {
            uci: 'd8c7',
            comment:
              'La dame noire cherche une meilleure case, mais elle quitte la défense de l’aile roi.',
          },
          {
            uci: 'f3e5',
            comment:
              'Le cavalier arrive en e5 : un avant-poste soutenu par f4 et par le fou b2. Les Noirs ne pourraient le chasser que par f6, qui affaiblirait e6.',
          },
          {
            uci: 'd7e5',
            comment:
              'Les Noirs échangent le cavalier gênant ; mais la reprise donne au fou b2 un poste idéal.',
          },
          {
            uci: 'b2e5',
            comment: 'Le fou e5 domine la grande diagonale : il vise g7 et c7.',
          },
          {
            uci: 'c7c6',
            comment: 'La dame noire quitte la diagonale, sinon Fxc7 gagnerait du temps.',
          },
          {
            uci: 'd1e2',
            comment:
              'La dame se place derrière le fou d3 : elle prépare Cxh5 et le sacrifice en h7.',
          },
          {
            uci: 'a7a6',
            comment:
              'Un coup lent : les Noirs perdent un temps à l’aile dame, au lieu de renforcer le roque.',
          },
          {
            uci: 'g3h5',
            comment: 'Le cavalier saute en h5, attaque le cavalier f6 et gêne le roque noir.',
          },
          {
            uci: 'f6h5',
            comment:
              'Les Noirs prennent le cavalier, mais ouvrent la diagonale b1-h7 devant le fou d3 et laissent la dame e2 libre de prendre h5.',
          },
          {
            uci: 'd3h7',
            comment:
              'Le sacrifice classique du fou sur h7 : il détourne le roi et ouvre la colonne h.',
          },
          {
            uci: 'g8h7',
            comment: 'Le roi doit prendre, sinon il perd un pion sans compensation.',
          },
          {
            uci: 'e2h5',
            comment:
              'La dame reprend avec échec, et le cavalier h5 tombe : les Blancs ont récupéré toute leur pièce.',
          },
          {
            uci: 'h7g8',
            comment: 'Le roi retourne en g8, mais il a perdu son pion h7 : son roque est ouvert.',
          },
          {
            uci: 'e5g7',
            comment: 'Second sacrifice de fou : le fou e5 détruit le dernier bouclier du roi.',
          },
          {
            uci: 'g8g7',
            comment: 'Le roi prend, sinon le fou continue à gagner du matériel avec attaque.',
          },
          {
            uci: 'h5g4',
            comment:
              'Échec en g4 (et non en g5, où le fou e7 prendrait la dame) : le roi est repoussé vers h7.',
          },
          {
            uci: 'g7h7',
            comment: 'Le roi se met sur h7 : Kh8 donnait aussi lieu à une attaque.',
          },
          {
            uci: 'f1f3',
            comment: 'La tour entre en jeu par la troisième rangée : elle prépare Th3+.',
          },
          {
            uci: 'e6e5',
            comment: 'Les Noirs veulent libérer leur dame, mais ils ouvrent d’autres diagonales.',
          },
          {
            uci: 'f3h3',
            comment:
              'La tour arrive sur la colonne h avec échec : l’attaque est écrasante, et chaque pièce blanche participe.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : pour attaquer un roque, rassemble d’abord les pièces (fou d3, dame, cavalier h5), puis sacrifie. Calcule le sacrifice : Fxh7+ n’est bon que si la dame ou le cavalier peut suivre avec échec.',
      },
    ],
    exercises: [
      {
        fen: 'r4rk1/pbqnbppp/1p2pn2/2pp4/5P2/1P1BPNN1/PBPP2PP/R2Q1RK1 w - - 2 11',
        prompt:
          'Les deux camps ont roqué. Quel coup place un cavalier sur la case centrale que contrôlent déjà f4 et le fou b2 ?',
        mode: 'engine',
        solution: ['f3e5'],
        tolerance: 8,
        hints: [
          'Quelle case centrale est contrôlée par f4 et par le fou b2 ?',
          'Un cavalier solide au centre est une pièce de plus pour l’attaque.',
          'Ce5.',
        ],
        explanation:
          'Ce5 : un avant-poste soutenu par f4 et le fou b2. Les Noirs devront l’échanger ou affaiblir leur camp.',
      },
      {
        fen: 'r4rk1/1b2bppp/ppq1pn2/2ppB3/5P2/1P1BP1N1/P1PPQ1PP/R4RK1 w - - 0 14',
        prompt:
          'Les Noirs ont perdu un temps avec a6. Comment augmenter la pression sur le roque noir ?',
        mode: 'engine',
        solution: ['g3h5'],
        tolerance: 8,
        traps: ['d3h7'],
        hints: [
          'Quelle pièce n’attaque pas encore le roque ?',
          'Le cavalier g3 peut sauter vers l’aile roi.',
          'Ch5 attaque le cavalier f6 et fixe le roque.',
        ],
        explanation:
          'Ch5 menace Cxf6+ et force les Noirs à se décider. Fxh7+? tout de suite perd un fou : le cavalier n’est pas encore en h5 pour soutenir la dame.',
      },
      {
        fen: 'r4rk1/1b2bppp/ppq1p3/2ppB2n/5P2/1P1BP3/P1PPQ1PP/R4RK1 w - - 0 15',
        prompt:
          'Les Noirs ont pris le cavalier h5. Tu peux prendre ce cavalier avec la dame, mais un coup plus fort ouvre le roque. Lequel ?',
        mode: 'engine',
        solution: ['d3h7'],
        tolerance: 10,
        traps: ['e2h5'],
        hints: [
          'Le fou d3 vise quel pion ?',
          'Un sacrifice sur h7 peut-il être suivi d’un échec ?',
          'Fxh7+ Rxh7 Dxh5+.',
        ],
        explanation:
          'Fxh7+ Rxh7 Dxh5+ récupère la pièce et le pion avec une attaque. Dxh5? tout de suite ne donne qu’une égalité approximative.',
      },
      {
        fen: 'r4rk1/1b2bpp1/ppq1p3/2ppB2Q/5P2/1P2P3/P1PP2PP/R4RK1 w - - 1 17',
        prompt: 'Le roi noir est revenu sur g8. Quel second sacrifice détruit son abri ?',
        mode: 'engine',
        solution: ['e5g7'],
        tolerance: 10,
        traps: ['f1f3'],
        hints: ['Quel pion protège encore le roi ?', 'Le fou e5 vise g7.', 'Fxg7 Rxg7, puis Dg4+.'],
        explanation:
          'Fxg7! détruit le dernier bouclier du roi. Tf3? ne menace rien de précis et laisse les Noirs respirer.',
      },
      {
        fen: 'r4r2/1b2bpk1/ppq1p3/2pp3Q/5P2/1P2P3/P1PP2PP/R4RK1 w - - 0 18',
        prompt: 'Le roi noir a pris le fou g7. Quel échec continue l’attaque sans rien perdre ?',
        mode: 'engine',
        solution: ['h5g4'],
        tolerance: 10,
        traps: ['h5g5'],
        hints: [
          'Deux échecs sont possibles avec la dame : lequel est protégé par une pièce adverse ?',
          'Le fou e7 voit la case g5.',
          'Dg4+ ; Dg5+ perdrait la dame.',
        ],
        explanation:
          'Dg4+ chasse le roi. Dg5+? Fxg5 : le fou e7 prend la dame. Vérifie toujours si ta case d’échec est défendue.',
      },
      {
        fen: 'r4r2/1b2bp1k/ppq1p3/2pp4/5PQ1/1P2P3/P1PP2PP/R4RK1 w - - 2 19',
        prompt:
          'Le roi noir est sur h7, la dame est en g4. Quelle pièce apporte du renfort à l’attaque ?',
        mode: 'engine',
        solution: ['f1f3'],
        tolerance: 10,
        hints: [
          'Quelle pièce blanche n’a pas encore participé ?',
          'La tour f1 peut passer par la troisième rangée.',
          'Tf3 prépare Th3+.',
        ],
        explanation: 'Tf3 apporte la dernière pièce : Th3+ suit. Les Noirs sont perdus.',
      },
    ],
  },
  {
    id: 'classique-immortelle',
    phase: 3,
    title: 'L’Immortelle (Anderssen–Kieseritzky, 1851)',
    summary:
      'Trois pièces mineures contre deux tours, une dame et deux fous : le sacrifice absolu.',
    minutes: 25,
    sections: [
      {
        kind: 'text',
        body: 'Adolf Anderssen joue à Londres contre Lionel Kieseritzky une partie amicale, en marge du premier tournoi international. Il sacrifie fous, tours et dame pour mater avec trois pièces mineures. C’est devenu la partie « immortelle » parce que l’attaque l’emporte sur le matériel.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le pion g4 et le cavalier f5 : des avant-postes qui ne peuvent pas être chassés ; (2) les deux tours laissées en prise ; (3) comment les cavaliers et le fou se coordonnent pour le mat final.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Anderssen ouvre par le pion roi, comme toujours à son époque.',
          },
          {
            uci: 'e7e5',
            comment: 'Les Noirs répondent symétriquement.',
          },
          {
            uci: 'f2f4',
            comment:
              'Le gambit du roi : un pion est offert pour ouvrir la colonne f et dominer le centre.',
          },
          {
            uci: 'e5f4',
            comment: 'Les Noirs acceptent le gambit et prennent le pion.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7, la case la plus faible du camp noir.',
          },
          {
            uci: 'd8h4',
            comment:
              'La dame sort avec échec sur la diagonale e1-h4, ouverte parce que le pion f2 est parti.',
          },
          {
            uci: 'e1f1',
            comment:
              'Le roi perd le droit de roquer ; Anderssen accepte ce prix pour garder son fou et son initiative.',
          },
          {
            uci: 'b7b5',
            comment: 'Les Noirs offrent un pion pour chasser le fou c4 de sa diagonale.',
          },
          {
            uci: 'c4b5',
            comment: 'Le fou prend le pion b5 et garde un œil sur e8.',
          },
          {
            uci: 'g8f6',
            comment: 'Les Noirs développent le cavalier et attaquent e4.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier sort avec gain de temps : il attaque la dame noire.',
          },
          {
            uci: 'h4h6',
            comment: 'La dame se retire en h6, tout en protégeant le pion f4.',
          },
          {
            uci: 'd2d3',
            comment: 'Un coup tranquille : d3 protège e4 et libère le fou c1.',
          },
          {
            uci: 'f6h5',
            comment: 'Le cavalier h5 protège f4 et menace Cg3+.',
          },
          {
            uci: 'f3h4',
            comment: 'Le cavalier vise f5 pour attaquer la dame.',
          },
          {
            uci: 'h6g5',
            comment: 'La dame va en g5 et attaque le cavalier h4.',
          },
          {
            uci: 'h4f5',
            comment:
              'Le cavalier f5 s’installe : il attaque la dame, les cases g7 et h6, et il ne peut être chassé par un pion.',
          },
          {
            uci: 'c7c6',
            comment:
              'Les Noirs attaquent le fou b5 plutôt que de chercher la sécurité de leur roi.',
          },
          {
            uci: 'g2g4',
            comment:
              'Un pion est offert pour attaquer le cavalier h5 : Anderssen ignore le matériel et pense aux colonnes ouvertes.',
          },
          {
            uci: 'h5f6',
            comment:
              'Le cavalier h5 retourne en f6 : il quitte le jeu et laisse la colonne g libre.',
          },
          {
            uci: 'h1g1',
            comment: 'La tour prend la colonne g, ouverte, et vise le pion g7.',
          },
          {
            uci: 'c6b5',
            comment:
              'Les Noirs prennent le fou : ils ont désormais fou et pions de plus, mais leur roi est resté au centre.',
          },
          {
            uci: 'h2h4',
            comment: 'Le pion h attaque la dame noire.',
          },
          {
            uci: 'g5g6',
            comment: 'La dame se retire en g6, pas très loin du centre.',
          },
          {
            uci: 'h4h5',
            comment: 'Le pion h5 attaque encore la dame noire.',
          },
          {
            uci: 'g6g5',
            comment: 'La dame retourne en g5 en attaquant le cavalier f5.',
          },
          {
            uci: 'd1f3',
            comment: 'La dame arrive : elle prépare Fxf4, qui attaquerait la dame g5.',
          },
          {
            uci: 'f6g8',
            comment: 'Les Noirs libèrent la case f6 pour leur dame.',
          },
          {
            uci: 'c1f4',
            comment: 'Le fou prend le pion f4 avec gain de temps sur la dame g5.',
          },
          {
            uci: 'g5f6',
            comment: 'La dame va en f6, mais elle s’éloigne de la défense du roi noir.',
          },
          {
            uci: 'b1c3',
            comment: 'Le dernier cavalier sort et renforce la case d5.',
          },
          {
            uci: 'f8c5',
            comment: 'Le fou noir attaque la tour g1 : Anderssen est prêt à la sacrifier.',
          },
          {
            uci: 'c3d5',
            comment:
              'Le cavalier d5 attaque la dame f6 et la case c7 : les Blancs gardent l’initiative.',
          },
          {
            uci: 'f6b2',
            comment:
              'La dame prend le pion b2, attaque la tour a1 et s’échappe de l’attaque du cavalier.',
          },
          {
            uci: 'f4d6',
            comment:
              'Le fou d6 coupe le roi noir de f8 et de c7, et menace une attaque de mat. Anderssen laisse deux tours en prise.',
          },
          {
            uci: 'c5g1',
            comment: 'Les Noirs prennent la première tour.',
          },
          {
            uci: 'e4e5',
            comment:
              'Le pion e5 coupe la grande diagonale, empêchant la dame noire de défendre g7.',
          },
          {
            uci: 'b2a1',
            comment: 'Les Noirs prennent la seconde tour avec échec.',
          },
          {
            uci: 'f1e2',
            comment: 'Le roi se met à l’abri sur e2 ; il est seul, mais assez bien protégé.',
          },
          {
            uci: 'b8a6',
            comment: 'Les Noirs sortent leur dernier cavalier, mais ce coup ne défend pas g7.',
          },
          {
            uci: 'f5g7',
            comment: 'Échec : le cavalier prend g7 et ouvre le dernier acte.',
          },
          {
            uci: 'e8d8',
            comment:
              'Le roi n’a qu’une case : f8 est attaquée par le fou d6, e7 contrôlée par fou et cavaliers.',
          },
          {
            uci: 'f3f6',
            comment: 'Sacrifice de dame : l’échec force le cavalier g8 à prendre.',
          },
          {
            uci: 'g8f6',
            comment:
              'Le cavalier est obligé de prendre : il quitte g8 et laisse la case e7 à la merci du fou.',
          },
          {
            uci: 'd6e7',
            comment:
              'Mat : le fou e7, protégé par les deux cavaliers, et le cavalier g7 couvrent toutes les cases. Le roi est enfermé par ses propres pièces c8 et d7. Trois pièces mineures contre deux tours : la partie « immortelle ».',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : le matériel n’est qu’un moyen. Quand le roi adverse est au centre et qu’on a des pièces actives, une attaque peut valoir plus que deux tours. Mais seulement si on a calculé jusqu’au bout.',
      },
    ],
    exercises: [
      {
        fen: 'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQK1NR w KQkq - 2 4',
        prompt:
          'Les Noirs viennent de donner échec avec Dh4. Comment répondre sans abandonner la colonne f ?',
        mode: 'engine',
        solution: ['e1f1'],
        tolerance: 10,
        traps: ['g2g3'],
        hints: [
          'Le roi peut-il se déplacer ? Où ?',
          'Un coup de pion g3 coûterait un pion de plus.',
          'Rf1 : on perd le roque mais on garde la colonne f.',
        ],
        explanation:
          'Rf1 est le coup le plus fort. g3? fxg3 ouvre la position et la dame h4 devient très dangereuse.',
      },
      {
        fen: 'rnb1kb1r/p1pp1ppp/8/1B4qn/4Pp1N/3P4/PPP3PP/RNBQ1K1R w kq - 3 9',
        prompt: 'La dame noire attaque le cavalier h4. Quel coup d’avant-poste prends-tu ?',
        mode: 'engine',
        solution: ['h4f5'],
        tolerance: 10,
        traps: ['g2g3'],
        hints: [
          'Quelle case contrôle h6 et g7 ?',
          'Un cavalier central difficile à déloger.',
          'Cf5.',
        ],
        explanation:
          'Cf5 : avant-poste intouchable, et il attaque la dame. g3? perd du temps et le cavalier h4.',
      },
      {
        fen: 'rnb1kb1r/p2p1ppp/2p5/1B3Nqn/4Pp2/3P4/PPP3PP/RNBQ1K1R w kq - 0 10',
        prompt:
          'Les Noirs ont joué c6. Quel pion sacrifies-tu pour attaquer le cavalier h5 et ouvrir la colonne g ?',
        mode: 'choice',
        solution: ['g2g4'],
        accepted: ['g2g4'],
        hints: [
          'Quel pion peut attaquer le cavalier h5 ?',
          'Il ouvre la colonne g pour la tour.',
          'g4.',
        ],
        explanation:
          'g4 attaque le cavalier h5 et ouvre la colonne g. Le coup n’est pas le meilleur selon le moteur, mais il crée des menaces concrètes : c’est un sacrifice de pion de plus, au nom de l’attaque.',
      },
      {
        fen: 'rnb1kbnr/p2p1ppp/8/1p3NqP/4PpP1/3P1Q2/PPP5/RNB2KR1 w kq - 3 15',
        prompt:
          'Les Blancs peuvent reprendre le pion f4. Joue le coup qui attaque la dame au passage.',
        mode: 'engine',
        solution: ['c1f4'],
        tolerance: 8,
        hints: ['Quelle pièce peut prendre f4 ?', 'Le fou c1 est encore dans le camp.', 'Fxf4.'],
        explanation: 'Fxf4 reprend le pion et attaque la dame g5 : les Blancs gagnent du temps.',
      },
      {
        fen: 'rnb1kbnr/p2p1ppp/5q2/1p3N1P/4PBP1/3P1Q2/PPP5/RN3KR1 w kq - 1 16',
        prompt: 'Il manque un cavalier à ton attaque. Lequel sors-tu pour renforcer la case d5 ?',
        mode: 'engine',
        solution: ['b1c3'],
        tolerance: 8,
        hints: ['Quelle pièce n’est pas encore développée ?', 'Le cavalier b1 vise d5.', 'Cc3.'],
        explanation: 'Cc3 développe la dernière pièce et prépare Cd5.',
      },
      {
        fen: 'r1b1k1nr/p2p1ppp/n2B4/1p1NPN1P/6P1/3P1Q2/P1P1K3/q5b1 w kq - 2 21',
        prompt:
          'Les Noirs ont pris deux tours avec échec. Il est temps de finir : trouve le mat en 3 (ta suite complète).',
        mode: 'exact',
        solution: ['f5g7', 'e8d8', 'f3f6', 'g8f6', 'd6e7'],
        hints: [
          'Quel cavalier prend avec échec ?',
          'Après Rd8, une dame sacrifiée en f6 change tout.',
          'Cxg7+ Rd8, Df6+ Cxf6, Fe7#.',
        ],
        explanation:
          'Cxg7+ Rd8 Df6+! Cxf6 Fe7# : trois pièces mineures mattent un roi entouré de ses propres pièces.',
      },
    ],
  },
  {
    id: 'classique-evergreen',
    phase: 3,
    title: 'La Sempervirens (Anderssen–Dufresne, 1852)',
    summary: 'Une attaque de sacrifices : tour, dame, fou pour un mat à l’ancienne.',
    minutes: 25,
    sections: [
      {
        kind: 'text',
        body: 'Jean Dufresne a affronté Adolf Anderssen à Berlin en 1852. La partie, appelée « sempervirens » (toujours verte), est une brillante illustration du gambit Evans. Anderssen gagne en 24 coups avec des sacrifices de tour et de dame.',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) le gambit Evans : un pion offert pour des temps de développement ; (2) l’avantage de développement qui compense le matériel ; (3) la combinaison finale : tour, dame puis deux fous.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'e2e4',
            comment: 'Anderssen ouvre en occupant le centre.',
          },
          {
            uci: 'e7e5',
            comment: 'Son adversaire répond symétriquement.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier attaque e5 en se développant.',
          },
          {
            uci: 'b8c6',
            comment: 'Le cavalier défend e5.',
          },
          {
            uci: 'f1c4',
            comment: 'Le fou vise f7 : la partie italienne.',
          },
          {
            uci: 'f8c5',
            comment: 'Les Noirs sortent aussi leur fou.',
          },
          {
            uci: 'b2b4',
            comment:
              'Le gambit Evans : un pion est offert pour gagner du temps sur le fou et ouvrir le centre.',
          },
          {
            uci: 'c5b4',
            comment: 'Les Noirs acceptent le pion, mais leur fou a perdu un temps.',
          },
          {
            uci: 'c2c3',
            comment: 'Le pion attaque le fou et prépare d4 : les Blancs veulent un grand centre.',
          },
          {
            uci: 'b4a5',
            comment: 'Le fou se retire sur la diagonale a5-e1, où il surveille c3.',
          },
          {
            uci: 'd2d4',
            comment: 'Les Blancs ont maintenant un centre complet avec e4 et d4.',
          },
          {
            uci: 'e5d4',
            comment: 'Les Noirs prennent d4 : la colonne e va s’ouvrir.',
          },
          {
            uci: 'e1g1',
            comment:
              'Au lieu de reprendre le pion, Anderssen roque : il préfère le développement au matériel.',
          },
          {
            uci: 'd4d3',
            comment: 'Le pion noir avance en d3 : il gêne le fou c1 mais il est exposé.',
          },
          {
            uci: 'd1b3',
            comment:
              'La dame vise f7 : la batterie dame-fou sur la diagonale b3-g8 menace de gagner du matériel.',
          },
          {
            uci: 'd8f6',
            comment: 'La dame défend f7 et attaque le cavalier f3.',
          },
          {
            uci: 'e4e5',
            comment: 'Le pion e5 attaque la dame : gain de temps.',
          },
          {
            uci: 'f6g6',
            comment: 'La dame se retire en g6 : elle surveille g2 et la colonne g.',
          },
          {
            uci: 'f1e1',
            comment: 'La tour prend la colonne e, ouverte.',
          },
          {
            uci: 'g8e7',
            comment: 'Le cavalier développe et prépare le roque.',
          },
          {
            uci: 'c1a3',
            comment: 'Le fou a3 empêche le roque noir : la case f8 est attaquée.',
          },
          {
            uci: 'b7b5',
            comment: 'Les Noirs veulent chasser le fou c4, mais ils ouvrent leur aile dame.',
          },
          {
            uci: 'b3b5',
            comment: 'La dame prend le pion b5 et prépare Dxb7.',
          },
          {
            uci: 'a8b8',
            comment: 'La tour noire attaque la dame b5.',
          },
          {
            uci: 'b5a4',
            comment: 'La dame se retire en gardant le pion b7 à l’œil.',
          },
          {
            uci: 'a5b6',
            comment: 'Le fou b6 défend la dame et surveille f2.',
          },
          {
            uci: 'b1d2',
            comment: 'Le cavalier se développe sans perdre de temps.',
          },
          {
            uci: 'c8b7',
            comment: 'Le fou b7 se développe, mais il est gêné par son propre cavalier c6.',
          },
          {
            uci: 'd2e4',
            comment: 'Le cavalier e4 est actif : il menace Cf6+.',
          },
          {
            uci: 'g6f5',
            comment: 'La dame sort pour attaquer le cavalier e4.',
          },
          {
            uci: 'c4d3',
            comment: 'Le fou prend d3 : il récupère un pion et libère la diagonale b3.',
          },
          {
            uci: 'f5h5',
            comment: 'La dame attaque le cavalier f3 : Anderssen doit calculer avant de continuer.',
          },
          {
            uci: 'e4f6',
            comment: 'Échec : le cavalier saute en f6 pour attaquer le roi.',
          },
          {
            uci: 'g7f6',
            comment: 'Les Noirs prennent le cavalier, forcés.',
          },
          {
            uci: 'e5f6',
            comment: 'Le pion reprend et ouvre la colonne e.',
          },
          {
            uci: 'h8g8',
            comment: 'La tour noire attaque g2.',
          },
          {
            uci: 'a1d1',
            comment:
              'Anderssen ne défend pas son cavalier f3 : il apporte un dernier renfort sur la colonne d.',
          },
          {
            uci: 'h5f3',
            comment:
              'La dame noire prend le cavalier f3 : les Noirs gagnent du matériel, mais Anderssen a un plan.',
          },
          {
            uci: 'e1e7',
            comment: 'Sacrifice de tour avec échec : le cavalier c6 doit prendre.',
          },
          {
            uci: 'c6e7',
            comment: 'Forcé : le cavalier prend la tour.',
          },
          {
            uci: 'a4d7',
            comment: 'Sacrifice de dame : le roi noir est forcé de la prendre.',
          },
          {
            uci: 'e8d7',
            comment: 'Les Noirs prennent la dame : le roi quitte son abri.',
          },
          {
            uci: 'd3f5',
            comment: 'Échec : le fou f5 s’attaque au roi.',
          },
          {
            uci: 'd7e8',
            comment: 'Le roi retourne en e8.',
          },
          {
            uci: 'f5d7',
            comment: 'Échec : le fou d7 repousse le roi vers f8.',
          },
          {
            uci: 'e8f8',
            comment: 'Le roi se réfugie en f8.',
          },
          {
            uci: 'a3e7',
            comment:
              'Mat : le fou e7 donne le mat, protégé par le pion f6 ; le roi est enfermé par sa tour g8 et son pion f7.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : un pion ou une pièce donné pour le développement peut être gagnant si l’adversaire a des pièces mal placées. Calcule les sacrifices à fond : Anderssen a vu jusqu’au mat.',
      },
    ],
    exercises: [
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/b7/2B1P3/2Pp1N2/P4PPP/RNBQ1RK1 w kq - 0 8',
        prompt: 'Les Noirs ont avancé d3. Comment poursuivre l’attaque sur f7 ?',
        mode: 'engine',
        solution: ['d1b3'],
        tolerance: 10,
        hints: [
          'Quelle pièce n’attaque pas encore f7 ?',
          'La dame et le fou peuvent former une batterie.',
          'Db3.',
        ],
        explanation: 'Db3 forme une batterie avec le fou c4 sur f7.',
      },
      {
        fen: 'r1b1k1nr/pppp1ppp/2n2q2/b7/2B1P3/1QPp1N2/P4PPP/RNB2RK1 w kq - 2 9',
        prompt: 'La dame noire est en f6 : quel coup de pion la chasse avec gain de temps ?',
        mode: 'engine',
        solution: ['e4e5'],
        tolerance: 8,
        hints: ['Quelle poussée de pion attaque une pièce ?', 'Le pion e4 peut avancer.', 'e5.'],
        explanation: 'e5 chasse la dame avec gain de temps.',
      },
      {
        fen: 'r1b1k2r/p1ppnppp/2n3q1/bp2P3/2B5/BQPp1N2/P4PPP/RN2R1K1 w kq - 0 12',
        prompt:
          'Les Noirs viennent de jouer b5. Quelle pièce peut capturer le pion sans rien perdre ?',
        mode: 'engine',
        solution: ['b3b5'],
        tolerance: 8,
        hints: ['Qui attaque b5 ?', 'Le fou c4 et la dame b3 peuvent prendre.', 'Dxb5 ou Fxb5.'],
        explanation: 'Dxb5 (ou Fxb5) gagne le pion avec gain de temps.',
      },
      {
        fen: '1rb1k2r/p1ppnppp/2n3q1/bQ2P3/2B5/B1Pp1N2/P4PPP/RN2R1K1 w k - 1 13',
        prompt: 'La tour noire attaque ta dame. Où la poses-tu ?',
        mode: 'engine',
        solution: ['b5a4'],
        tolerance: 8,
        traps: ['f3h4'],
        hints: [
          'La dame est-elle attaquée ?',
          'Une case qui garde un œil sur le pion b7 et reste défendue.',
          'Da4.',
        ],
        explanation:
          'Da4 : la dame se retire en gardant le contrôle. Ch4? laisse la dame b5 attaquée par la tour.',
      },
      {
        fen: '1r2k2r/pbppnppp/1bn5/4Pq2/Q1B1N3/B1Pp1N2/P4PPP/R3R1K1 w k - 7 16',
        prompt: 'Le pion d3 gêne tes pièces. Que fais-tu pour libérer la diagonale de la dame ?',
        mode: 'engine',
        solution: ['c4d3'],
        tolerance: 8,
        hints: ['Le pion d3 est défendu ou non ?', 'Le fou c4 peut le prendre.', 'Fxd3.'],
        explanation: 'Fxd3 reprend le pion et libère la diagonale b3-g8.',
      },
      {
        fen: '1r2k1r1/pbppnp1p/1bn2P2/8/Q7/B1PB1q2/P4PPP/3RR1K1 w - - 0 20',
        prompt:
          'La dame noire est en f3. Les Blancs gagnent de force : trouve la suite complète jusqu’au mat (4 coups des Blancs).',
        mode: 'exact',
        solution: ['e1e7', 'c6e7', 'a4d7', 'e8d7', 'd3f5', 'd7e8', 'f5d7', 'e8f8', 'a3e7'],
        hints: [
          'Quelle tour sacrifie avec échec ?',
          'Après Cxe7, une dame sacrifiée en d7.',
          'Txe7+ Cxe7, Dxd7+ Rxd7, Ff5+ Re8, Fd7+ Rf8, Fxe7#.',
        ],
        explanation:
          'Txe7+ Cxe7 Dxd7+ Rxd7 Ff5+ Re8 Fd7+ Rf8 Fxe7# : la dame et la tour sont données pour un mat avec deux fous.',
      },
    ],
  },
  {
    id: 'classique-rotlewi-rubinstein',
    phase: 3,
    title: 'Rotlewi–Rubinstein (Łódź, 1907) : l’Immortelle de Rubinstein',
    summary:
      'Deux tours sacrifiées, une dame laissée en prise : des pièces actives sur des colonnes ouvertes l’emportent sur le matériel.',
    minutes: 20,
    sections: [
      {
        kind: 'text',
        body: 'À Łódź en 1907, Rubinstein conduit les Noirs contre Rotlewi. Après une ouverture sans histoire, les Noirs prennent possession des colonnes c et d et d’une belle diagonale pour le fou. Puis, sans prévenir, ils sacrifient une tour, la dame et une seconde tour : la partie est restée comme l’« Immortelle de Rubinstein ».',
      },
      {
        kind: 'text',
        title: 'Ce qu’il faut observer',
        body: '**À observer** : (1) la diagonale a7–g1 ouverte par les avances f4 et e4 ; (2) comment les deux tours noires sur les colonnes c et d préparent les sacrifices ; (3) l’ordre des sacrifices : chacun crée une menace plus grave que la perte de matériel.',
      },
      {
        kind: 'walkthrough',
        title: 'La partie, coup par coup',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [
          {
            uci: 'd2d4',
            comment:
              'Les Blancs ouvrent par le pion dame : il prend le centre et libère le fou c1 et la dame.',
          },
          {
            uci: 'd7d5',
            comment: 'Les Noirs répondent de la même façon : le pion d5 contrôle e4 et c4.',
          },
          {
            uci: 'g1f3',
            comment: 'Le cavalier se développe vers le centre : il garde d4 et surveille e5.',
          },
          {
            uci: 'e7e6',
            comment:
              'Le pion e6 soutient d5 et libère le fou f8. Le prix à payer est que le fou c8 reste enfermé derrière sa chaîne de pions.',
          },
          {
            uci: 'e2e3',
            comment:
              'Un pion qui soutient d4 et ouvre la diagonale du fou f1. En échange, le fou c1 reste bouché pour l’instant.',
          },
          {
            uci: 'c7c5',
            comment:
              'Les Noirs attaquent le centre blanc : le pion c5 vise d4. C’est le plan classique contre une chaîne de pions.',
          },
          {
            uci: 'c2c4',
            comment:
              'Les Blancs attaquent d5 à leur tour : le centre devient un champ de bataille.',
          },
          {
            uci: 'b8c6',
            comment:
              'Un deuxième attaquant sur d4, qui est visé deux fois (c5 et Cc6) et défendu deux fois (e3 et Cf3).',
          },
          {
            uci: 'b1c3',
            comment:
              'Le cavalier dame sort et appuie la pression sur d5 : on développe en visant le centre.',
          },
          {
            uci: 'g8f6',
            comment:
              'Les Noirs développent aussi, avec le même but : défendre d5 en sortant une pièce.',
          },
          {
            uci: 'd4c5',
            comment:
              'Les Blancs prennent le pion c5 et relâchent la tension au centre. Les Noirs vont reprendre tout de suite.',
          },
          {
            uci: 'f8c5',
            comment:
              'Le fou reprend en se développant, avec une belle diagonale vers f2 : bonne reprise.',
          },
          {
            uci: 'a2a3',
            comment:
              'Un coup préparatoire : il permettra b4 sans craindre Cb4 ni Fb4, mais il ne développe rien.',
          },
          {
            uci: 'a7a6',
            comment:
              'Les Noirs répondent en préparant b5, pour avoir de l’espace eux aussi à l’aile dame.',
          },
          {
            uci: 'b2b4',
            comment:
              'Le pion chasse le fou et gagne de l’espace. Les pions blancs avancent à l’aile dame, mais ceux qui couvrent le roi (e et f) vont avoir besoin de rester à leur place.',
          },
          {
            uci: 'c5d6',
            comment:
              'Le fou se retire sur la diagonale b8–h2, où il vise le pion h2 qui garde le roi blanc.',
          },
          {
            uci: 'c1b2',
            comment: 'Le fou rejoint la grande diagonale : il vise g7 et le roi noir.',
          },
          {
            uci: 'e8g8',
            comment:
              'Les Noirs roquent : la tour sort du coin, le roi se met à l’abri, et le développement est presque terminé.',
          },
          {
            uci: 'd1d2',
            comment:
              'La dame se place sur la colonne d, derrière la tour future, pour peser sur d5.',
          },
          {
            uci: 'd8e7',
            comment: 'La dame noire libère la colonne d et laisse d8 à la tour.',
          },
          {
            uci: 'f1d3',
            comment:
              'Le fou prend la diagonale b1–h7 : il vise le roi noir de loin, et attend Td1.',
          },
          {
            uci: 'd5c4',
            comment:
              'Les Noirs prennent le pion c4 : leur pion attaque le fou d3 et le centre se vide.',
          },
          {
            uci: 'd3c4',
            comment: 'Le fou reprend et revient sur la belle diagonale a2–g8, qui vise f7.',
          },
          {
            uci: 'b7b5',
            comment:
              'Les Noirs chassent le fou et gagnent de l’espace. Le pion b5 affaiblit pourtant les cases c6 et c5.',
          },
          {
            uci: 'c4d3',
            comment: 'Le fou se retire en gardant la diagonale b1–h7. Il reste actif.',
          },
          {
            uci: 'f8d8',
            comment:
              'La tour s’installe sur la colonne d, en face du fou d3 et de la dame d2 : elle prépare la pression sur d3.',
          },
          {
            uci: 'd2e2',
            comment: 'La dame quitte la colonne d pour ne pas se retrouver face à la tour noire.',
          },
          {
            uci: 'c8b7',
            comment: 'Le fou noir sort enfin : il vise la case g2 et le roi blanc dans son coin.',
          },
          {
            uci: 'e1g1',
            comment:
              'Les Blancs roquent à leur tour. Toutes les pièces sont développées : il faut maintenant un plan.',
          },
          {
            uci: 'c6e5',
            comment: 'Un excellent cavalier ! Il atteint la case centrale e5 et offre l’échange.',
          },
          {
            uci: 'f3e5',
            comment:
              'Les Blancs échangent leur cavalier f3 contre le cavalier noir actif, le plus gênant de tous.',
          },
          {
            uci: 'd6e5',
            comment:
              'Le fou reprend et s’installe au centre, face au fou b2 ; il surveille la diagonale vers h2.',
          },
          {
            uci: 'f2f4',
            comment:
              'Les Blancs chassent le fou et prennent de l’espace à l’aile roi. Mais f4 affaiblit la diagonale g1–a7 et la case e4 : un pion qui avance ne revient jamais.',
          },
          {
            uci: 'e5c7',
            comment:
              'Le fou se retire en gardant l’œil sur la diagonale b8–h2, et prêt à revenir en b6 avec échec.',
          },
          {
            uci: 'e3e4',
            comment:
              'Les Blancs avancent leur dernier pion central, mais ils ouvrent la diagonale a7–g1 : le roi blanc est maintenant à portée du fou noir.',
          },
          {
            uci: 'a8c8',
            comment:
              'La tour se pose en c8 contre le cavalier c3 : les Noirs ont deux tours sur les colonnes ouvertes.',
          },
          {
            uci: 'e4e5',
            comment:
              'Les Blancs gagnent de l’espace et menacent le cavalier f6. Ils pensent à l’attaque sur h7 avec Fe4 et Dh5.',
          },
          {
            uci: 'c7b6',
            comment: 'Échec ! Le fou profite de la diagonale libérée par les avances e4 et f4.',
          },
          {
            uci: 'g1h1',
            comment: 'Le roi se réfugie dans son coin. Mais la case h2 devient une faiblesse.',
          },
          {
            uci: 'f6g4',
            comment:
              'Le cavalier saute en g4 : il attaque e5 et menace h2, avec la dame en renfort.',
          },
          {
            uci: 'd3e4',
            comment:
              'Le fou vient en e4 et offre l’échange du fou b7, la pièce noire qui pèse sur la diagonale du roi blanc.',
          },
          {
            uci: 'e7h4',
            comment:
              'La dame sort avec une menace de mat : Dxh2# (h2 est attaquée par la dame et par le cavalier g4).',
          },
          {
            uci: 'g2g3',
            comment:
              'Les Blancs attaquent la dame. Mais le roi blanc a perdu des défenseurs : les cases blanches autour de h1 sont fragiles.',
          },
          {
            uci: 'c8c3',
            comment:
              'Le sacrifice ! La tour prend le cavalier c3, qui défendait le fou e4, et laisse la dame h4 en prise. Chaque coup noir crée maintenant une menace plus forte que la prise de la dame.',
          },
          {
            uci: 'g3h4',
            comment:
              'Les Blancs prennent la dame et se retrouvent avec neuf points contre trois. Mais ce n’est pas le matériel qui décidera.',
          },
          {
            uci: 'd8d2',
            comment:
              'Deuxième sacrifice : la tour va en d2, attaquer la dame e2 et le fou b2. Si la dame prend, la diagonale b7–h1 s’ouvre.',
          },
          {
            uci: 'e2d2',
            comment:
              'Les Blancs prennent la seconde tour. Mais leur dame quitte e2, et le fou e4 n’est plus protégé.',
          },
          {
            uci: 'b7e4',
            comment:
              'Échec ! Le fou b7 prend le fou e4 avec échec sur la diagonale du roi, et tout s’effondre pour les Blancs.',
          },
          {
            uci: 'd2g2',
            comment:
              'La dame s’interpose : c’est la seule façon d’éviter le mat immédiat. Mais Tf3 ne ferait que retarder la fin.',
          },
          {
            uci: 'c3h3',
            comment:
              'Th3! La tour menace Txh2 mat. Si Dxe4, Txh2# ; la dame g2 est clouée et ne peut pas prendre la tour. Les Blancs abandonnent.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Bilan',
        body: '**Ce que je retiens** : (1) un pion qui avance devant le roi ne revient jamais : f4 et e4 ont ouvert la diagonale a7–g1 au fou noir ; (2) pour sacrifier avec succès, j’ai d’abord développé toutes mes pièces et pris les colonnes ouvertes : l’attaque naît de l’activité ; (3) je compte les menaces plutôt que le matériel : chaque sacrifice de Rubinstein oblige l’adversaire à répondre et ne lui laisse pas le temps de profiter de sa dame.',
      },
    ],
    exercises: [
      {
        fen: '2rr2k1/1bb1qppp/p3pn2/1p2P3/1P3P2/P1NB4/1B2Q1PP/R4RK1 b - - 0 19',
        prompt:
          'Les Blancs ont avancé leurs pions e et f et ouvert la diagonale de leur roi. Quel échec met ton fou à l’action ?',
        mode: 'engine',
        solution: ['c7b6'],
        tolerance: 8,
        traps: ['f6d5', 'f6h5'],
        hints: [
          'Regarde la diagonale qui mène à g1 : qui la contrôle ?',
          'Le fou c7 peut s’y placer en donnant échec.',
          'Fb6+.',
        ],
        explanation:
          'Fb6+ profite de la diagonale ouverte par e4 et f4. Les coups de cavalier (Cd5, Ch5) laissent les Blancs reprendre l’initiative.',
      },
      {
        fen: '2rr2k1/1b2qppp/pb2pn2/1p2P3/1P3P2/P1NB4/1B2Q1PP/R4R1K b - - 2 20',
        prompt: 'Le roi blanc est en h1. Quel saut de cavalier attaque e5 et menace h2 ?',
        mode: 'engine',
        solution: ['f6g4'],
        tolerance: 8,
        traps: ['f6h5'],
        hints: [
          'Quelle case permet au cavalier de menacer h2 et e5 ?',
          'Il doit sauter vers l’aile roi blanc.',
          'Cg4 !',
        ],
        explanation:
          'Cg4 attaque e5 et prépare Dh4 avec la menace Dxh2#. Ch5? ne menace rien de comparable.',
      },
      {
        fen: '2rr2k1/1b3ppp/pb2p3/1p2P3/1P2BPnq/P1N3P1/1B2Q2P/R4R1K b - - 0 22',
        prompt:
          'Ta dame est attaquée par g3. Au lieu de la sauver, quel sacrifice de tour prépare la suite ?',
        mode: 'engine',
        solution: ['c8c3'],
        tolerance: 8,
        traps: ['h4h5', 'b7e4'],
        hints: [
          'Quelle pièce blanche défend le fou e4 ?',
          'Supprime ce défenseur, même au prix de ta dame.',
          'Txc3 !',
        ],
        explanation:
          'Txc3! ne sauve pas la dame mais élimine le cavalier qui protégeait le fou e4. Dh5? ou Fxe4? laissent les Blancs reprendre le contrôle.',
      },
      {
        fen: '3r2k1/1b3ppp/pb2p3/1p2P3/1P2BPnP/P1r5/1B2Q2P/R4R1K b - - 0 23',
        prompt:
          'Les Blancs ont pris ta dame. Quelle seconde tour sacrifies-tu pour éloigner la dame e2 ?',
        mode: 'engine',
        solution: ['d8d2'],
        tolerance: 8,
        traps: ['c3e3'],
        hints: [
          'Quelle pièce protège encore le fou e4 ?',
          'Attire-la hors de la case e2.',
          'Td2 !',
        ],
        explanation:
          'Td2! attaque la dame et le fou b2. Si Dxd2, le fou e4 n’est plus protégé et Fxe4+ gagne. Te3? laisse tout échapper.',
      },
      {
        fen: '6k1/1b3ppp/pb2p3/1p2P3/1P2BPnP/P1r5/1B1Q3P/R4R1K b - - 0 24',
        prompt:
          'Les Blancs ont pris ta seconde tour. Trouve la suite gagnante : tu joues, ils répondent comme dans la partie, tu joues encore.',
        mode: 'exact',
        solution: ['b7e4', 'd2g2', 'c3h3'],
        hints: [
          'Quelle pièce blanche n’est plus protégée ?',
          'Après l’interposition de la dame, cherche une tour menaçante sur h2.',
          'Fxe4+, Dg2, Th3 avec la menace Txh2#.',
        ],
        explanation:
          'Fxe4+ Dg2 Th3! : la dame g2 est clouée, Dxe4 ne sauve rien à cause de Txh2#, et les Blancs abandonnent.',
      },
    ],
  },
];
