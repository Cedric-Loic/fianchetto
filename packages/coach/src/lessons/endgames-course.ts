import type { Lesson } from './types.js';

/*
 * Cours de finales, palier 1 (1000-1200). Chaque chapitre est une leçon liée à une finale jouée
 * contre le moteur (`endgames.ts`) : question d'abord, explication ensuite, pas à pas commenté,
 * quiz de concepts (cases, choix, coup exact), puis exercices. Les annotations sont originales.
 *
 * Les positions sont vérifiées par les tests (légalité, solutions jouables) et par Stockfish
 * (`pnpm test:stress`) ; les positions de pions le sont aussi par la base KPK (`kpk.ts`).
 */

const MAT_DAME: Lesson = {
  id: 'fin-mat-dame',
  phase: 1,
  title: 'Mat de la dame : la méthode pas à pas',
  summary: 'Un mur, un roi qui approche, un mat : jamais de pat.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Tu as une dame et ton roi, l’adversaire n’a que son roi. Si tu donnes des échecs au hasard, le roi noir ' +
        'file vers le centre et tu tournes en rond. **Que dois-tu lui retirer, coup après coup ?** Des cases.\n\n' +
        'La dame ne mate jamais seule : elle construit une prison, et ton roi vient la fermer. Trois temps :\n' +
        '1. **Le mur** : la dame se place à un « saut de cavalier » du roi adverse. Elle lui interdit une grande ' +
        'zone, et il ne peut pas l’attaquer.\n' +
        '2. **Le rapprochement** : ton roi avance un pas à la fois, pendant que la dame tient le mur.\n' +
        '3. **Le mat** : quand le roi noir est sur un bord et que ton roi est à deux cases de lui, la dame donne ' +
        'l’échec.',
    },
    {
      kind: 'example',
      fen: '8/8/8/4k3/8/3Q4/8/4K3 b - - 0 1',
      caption:
        'Après Dd3, combien de cases restent au roi noir ? Trois seulement : e6, f6 et f4. La dame est à un saut ' +
        'de cavalier de e5 : elle ferme la colonne d, la 3e rangée et deux diagonales, sans que le roi puisse la ' +
        'toucher.',
      arrows: [
        ['d3', 'd8'],
        ['d3', 'h3'],
        ['d3', 'h7'],
      ],
      marks: ['e6', 'f6', 'f4'],
    },
    {
      kind: 'walkthrough',
      title: 'Du mur au mat',
      fen: '8/8/8/5k2/3Q4/8/8/4K3 w - - 0 1',
      moves: [
        {
          uci: 'd4d6',
          comment:
            'Le mur. La dame est à un saut de cavalier du roi f5 : elle lui ferme la colonne d et la 6e rangée, sans ' +
            'même donner échec.',
        },
        {
          uci: 'f5e4',
          comment: 'Le roi noir cherche à s’approcher de ton roi pour s’échapper.',
        },
        {
          uci: 'e1e2',
          comment:
            'Le rapprochement : un pas à la fois. La dame ne bouge pas, elle tient déjà le mur.',
        },
        { uci: 'e4f5', comment: 'Le roi noir tourne dans sa boîte.' },
        {
          uci: 'e2f3',
          comment:
            'Encore un pas. Ton roi reste à distance de deux cases du roi noir : deux rois ne peuvent jamais se toucher.',
        },
        { uci: 'f5g5', comment: 'Le roi noir est repoussé vers le bord droit.' },
        {
          uci: 'd6e6',
          comment:
            'La dame referme la boîte : toute la 6e rangée est interdite. Compte les cases du roi noir avant ' +
            'de jouer : il lui en reste deux (h4 et h5), donc pas de pat.',
        },
        { uci: 'g5h5', comment: 'Le roi noir reste sur le bord.' },
        {
          uci: 'f3f4',
          comment: 'Ton roi couvre g3, g4 et g5. Le roi noir n’a plus qu’une case : h4.',
        },
        { uci: 'h5h4', comment: 'Seul coup possible.' },
        {
          uci: 'e6g4',
          comment:
            'Mat ! Le roi blanc contrôle g3 et g5, la dame contrôle h3 et h5 et donne l’échec. Aucune case libre.',
        },
      ],
    },
    {
      kind: 'text',
      title: 'Le piège : le pat',
      body:
        'Avant chaque coup de dame, **compte les cases libres du roi noir**. Si elles tombent à zéro et que le roi ' +
        'n’est pas en échec, la partie est nulle. Après Dg6??, ci-dessous, le roi h8 n’a plus aucun coup : ' +
        'au lieu de gagner, tu fais pat.',
    },
    {
      kind: 'example',
      fen: '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1',
      caption:
        'Pat : le roi noir n’est pas en échec mais g8, g7 et h7 sont contrôlées. Un mat était pourtant tout près ' +
        '(Dg7# ou Dh2#).',
      marks: ['g8', 'g7', 'h7'],
    },
  ],
  exercises: [
    {
      fen: '8/8/8/4k3/8/3Q4/8/4K3 b - - 0 1',
      prompt: 'La dame vient de jouer Dd3. Désigne les cases où le roi noir peut encore aller.',
      mode: 'squares',
      solution: [],
      squares: ['e6', 'f6', 'f4'],
      hints: [
        'Regarde les huit cases autour du roi noir, une par une.',
        'La dame contrôle la colonne d, la 3e rangée et les diagonales qui partent de d3.',
        'Il reste trois cases : e6, f6 et f4.',
      ],
      explanation:
        'Le roi e5 ne peut pas aller en d4, d5, d6 (colonne d), ni en e4 et f5 (diagonale de la dame). Il lui ' +
        'reste e6, f6 et f4 : la dame a déjà fait le plus gros du travail.',
    },
    {
      fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
      prompt: 'Place la dame à un saut de cavalier du roi noir (e5), sans la mettre en prise.',
      mode: 'choice',
      solution: ['d1d3'],
      accepted: ['d1d3', 'd1g4', 'd1d7'],
      hints: [
        'Un saut de cavalier, c’est deux cases dans une direction et une sur le côté.',
        'Depuis e5, le cavalier irait en d3, g4, d7, c4, c6, f3, f7 ou g6. Laquelle ta dame atteint-elle ?',
        'Dd3, Dg4 ou Dd7 conviennent.',
      ],
      explanation:
        'Dd3, Dg4 et Dd7 sont à un saut de cavalier du roi e5. Dd5+ ou Dd4 (collées au roi) se feraient capturer ' +
        'puisque ton roi est trop loin pour les protéger.',
    },
    {
      fen: '8/8/8/5K1k/8/8/8/Q7 w - - 0 1',
      prompt: 'Mat en 1.',
      mode: 'exact',
      solution: ['a1h1'],
      hints: [
        'Le roi noir est sur le bord h. Que contrôle ton roi f5 ?',
        'Il couvre g4, g5 et g6. Il manque un échec qui interdise h4 et h6.',
        'Dh1# (ou Dh8#) : échec sur la colonne h.',
      ],
      explanation:
        'Dh1# : la dame donne échec sur la colonne h, qui ferme aussi h4 et h6, et le roi f5 couvre g4, g5 et g6.',
    },
    {
      fen: '6k1/8/1Q4K1/8/8/8/8/8 w - - 0 1',
      prompt: 'Gagne tout de suite, mais attention au pat.',
      mode: 'engine',
      solution: ['b6b8'],
      tolerance: 5,
      traps: ['b6f6'],
      hints: [
        'Compte les cases libres du roi g8 après chaque coup de dame candidat.',
        'Df6 prive le roi de toutes ses cases sans lui donner échec.',
        'Db8# ou Dd8# : échec sur la 8e rangée.',
      ],
      explanation:
        'Db8# (ou Dd8#) est mat : f7, g7 et h7 sont couvertes par le roi g6. Df6?? est pat : f8, h8, f7, g7 et h7 ' +
        'sont toutes interdites et le roi n’est pas en échec.',
    },
    {
      fen: '4k3/8/8/4K3/7Q/8/8/8 w - - 0 1',
      prompt: 'Mat en 2 : un coup tranquille, puis le mat.',
      mode: 'exact',
      solution: ['e5e6', 'e8f8', 'h4h8'],
      hints: [
        'Les rois sont face à face. Quel coup du roi enlève des cases sans donner d’échec ?',
        'Re6 prend d7, e7 et f7. La dame couvre déjà d8.',
        'Re6, le roi noir n’a qu’une case (f8), puis Dh8#.',
      ],
      explanation:
        'Re6 ! réduit le roi noir à une seule case, f8 (d8 est sous la diagonale de la dame). Après …Rf8, Dh8# : ' +
        'le roi e6 couvre e7, f7, et la dame couvre g7, g8 et la 8e rangée.',
    },
    {
      fen: '8/8/8/8/3k4/8/8/K4Q2 w - - 0 1',
      prompt: 'Place la dame à un saut de cavalier du roi d4, sans la mettre en prise.',
      mode: 'engine',
      solution: ['f1f3'],
      tolerance: 5,
      traps: ['f1d3', 'f1c4'],
      hints: [
        'Le roi noir peut prendre toute pièce voisine qui n’est pas protégée.',
        'Ton roi est loin : la dame ne doit pas se mettre à côté du roi d4.',
        'Df3 (ou De2, Db5) : un saut de cavalier de d4.',
      ],
      explanation:
        'Df3 ferme la 3e rangée et la colonne f sans que le roi puisse l’approcher. Dd3+ ?? et Dc4+ ?? sont des ' +
        'échecs gratuits : le roi noir prend la dame, ton roi est trop loin pour la protéger.',
    },
  ],
};

const MAT_TOUR: Lesson = {
  id: 'fin-mat-tour',
  phase: 1,
  title: 'Mat de la tour : la boîte et l’opposition',
  summary: 'La tour coupe, le roi monte, un coup d’attente donne l’opposition, puis l’échec.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Avec une tour, le mat est plus long qu’avec une dame : la tour n’enferme qu’une rangée à la fois. ' +
        'Mais la recette est la même, **répétée quatre fois** : on coupe, on approche, on repousse.\n\n' +
        '**Question : comment forcer le roi noir à reculer d’une rangée, puisque la tour seule ne peut pas ?** ' +
        'Réponse : avec l’aide du roi. Quand les rois sont face à face avec **une case entre eux**, celui qui ' +
        'n’a pas le trait « a l’opposition ». L’autre roi ne peut ni avancer ni rester : il doit céder.',
    },
    {
      kind: 'text',
      title: 'La méthode, en quatre gestes',
      body:
        '1. **Coupe** : la tour prend une rangée entre les deux rois (avec échec, si possible). Le roi noir ne ' +
        'la franchira jamais.\n' +
        '2. **Approche** : ton roi monte jusqu’à faire face au roi noir, à deux rangées de lui.\n' +
        '3. **Attente** : si les rois sont en opposition mais que **c’est à toi de jouer**, perds un temps avec ' +
        'la tour : elle change de case en restant sur sa rangée de coupe, loin du roi adverse. Maintenant ' +
        'c’est aux Noirs de céder.\n' +
        '4. **Échec** : quand le roi noir a cédé, la tour donne échec sur la rangée suivante, et le roi est ' +
        'repoussé. On recommence jusqu’à la dernière rangée, où l’échec est mat.',
    },
    {
      kind: 'walkthrough',
      title: 'La boîte qui rétrécit',
      fen: '8/8/4k3/8/4K3/8/8/R7 w - - 0 1',
      moves: [
        {
          uci: 'a1a6',
          comment:
            'Coupe avec échec : la 6e rangée est fermée. Le roi noir ne pourra plus descendre.',
        },
        { uci: 'e6e7', comment: 'Il recule : il lui reste les rangées 7 et 8.' },
        {
          uci: 'e4d5',
          comment:
            'Approche : ton roi monte. La tour reste loin du roi noir, où il ne peut pas l’attaquer.',
        },
        { uci: 'e7f7', comment: 'Le roi noir se déplace, mais ne peut pas franchir la 6e rangée.' },
        { uci: 'd5e5', comment: 'Ton roi continue à monter.' },
        { uci: 'f7g7', comment: 'Le roi noir glisse vers le côté.' },
        { uci: 'e5f5', comment: 'Ton roi se place face à lui, à deux rangées.' },
        {
          uci: 'g7f7',
          comment:
            'Les rois sont en opposition (f5 face à f7) et c’est à toi de jouer : si tu avances, le roi noir ' +
            'reste devant ta tour. Il faut perdre un temps.',
        },
        {
          uci: 'a6e6',
          comment:
            'Le coup d’attente ! La tour change de case mais garde la 6e rangée fermée, protégée par ton roi f5. ' +
            'Maintenant c’est au roi noir de céder l’opposition.',
        },
        { uci: 'f7g7', comment: 'Il cède : il s’écarte de la colonne f.' },
        {
          uci: 'e6e7',
          comment: 'Échec sur la 7e rangée : le roi noir est repoussé sur la dernière rangée.',
        },
        { uci: 'g7f8', comment: 'Il n’a plus que la 8e rangée.' },
        {
          uci: 'f5f6',
          comment: 'Opposition de nouveau : f6 face à f8, et c’est aux Noirs de jouer.',
        },
        { uci: 'f8g8', comment: 'Seul coup : e8 et e7 sont tenues par la tour.' },
        {
          uci: 'e7c7',
          comment:
            'Un nouveau coup d’attente : la tour reste sur la 7e rangée, loin du roi. Les Noirs doivent encore céder.',
        },
        { uci: 'g8h8', comment: 'Le roi noir va dans le coin.' },
        {
          uci: 'f6g6',
          comment: 'Ton roi prend g7 et h7 sous contrôle : le roi noir n’a plus qu’une case, g8.',
        },
        { uci: 'h8g8', comment: 'Seul coup.' },
        {
          uci: 'c7c8',
          comment: 'Mat ! Échec sur la 8e rangée, f7, g7 et h7 sont couvertes par le roi.',
        },
      ],
    },
    {
      kind: 'text',
      title: 'Deux erreurs classiques',
      body:
        '**La tour collée au roi adverse** : un échec depuis une case voisine, non protégée, se fait capturer. ' +
        'Garde la tour loin, sur la bande de coupe.\n' +
        '**La précipitation** : si tu donnes l’échec alors que les rois ne sont pas en opposition, le roi ' +
        'noir recule d’un pas mais revient aussitôt. Un coup d’attente vaut mieux qu’un échec inutile.',
    },
  ],
  exercises: [
    {
      fen: '8/8/R3k3/8/4K3/8/8/8 b - - 0 1',
      prompt: 'Après Ta6+, désigne les cases où le roi noir peut aller.',
      mode: 'squares',
      solution: [],
      squares: ['d7', 'e7', 'f7'],
      hints: [
        'Regarde d’abord ce que la tour a6 interdit.',
        'La tour ferme toute la 6e rangée, et ton roi e4 ferme d5, e5 et f5.',
        'Il reste d7, e7 et f7 : le roi recule.',
      ],
      explanation:
        'La tour interdit d6 et f6, le roi e4 interdit d5, e5 et f5. Le roi noir doit reculer sur la 7e rangée : ' +
        'la boîte vient de se réduire de deux rangées.',
    },
    {
      fen: '8/5k2/R7/5K2/8/8/8/8 w - - 0 1',
      prompt: 'Les Blancs ont le trait. Quel roi a l’opposition ? Clique sur son roi.',
      mode: 'squares',
      solution: [],
      squares: ['f7'],
      hints: [
        'Les deux rois se font face avec une case entre eux.',
        'Celui qui a l’opposition est celui qui n’a pas le trait.',
        'Les Blancs doivent jouer : c’est le roi noir qui a l’opposition.',
      ],
      explanation:
        'Celui qui doit jouer perd l’opposition : il est obligé de reculer ou de s’écarter. Ici, les Blancs jouent ; ' +
        'ils vont perdre un temps avec la tour pour renvoyer le problème aux Noirs.',
    },
    {
      fen: '8/5k2/R7/5K2/8/8/8/8 w - - 0 1',
      prompt:
        'Les Blancs doivent donner le trait aux Noirs sans lâcher la 6e rangée. Quel coup d’attente ?',
      mode: 'choice',
      solution: ['a6e6'],
      accepted: ['a6e6', 'a6c6', 'a6b6'],
      hints: [
        'Si ton roi avance, le roi noir garde l’opposition. Que peut jouer la tour sans changer la situation ?',
        'La tour reste sur la 6e rangée et change de case.',
        'Te6, Tc6 ou Tb6 : un coup d’attente de la tour.',
      ],
      explanation:
        'Un coup d’attente ne change rien à la position, sauf le trait : c’est maintenant aux Noirs de jouer en ' +
        'opposition. La tour doit rester sur la 6e rangée et ne pas être attaquée (Te6 est protégée par le roi f5).',
    },
    {
      fen: '8/8/8/8/5K1k/8/8/R7 w - - 0 1',
      prompt: 'Mat en 1.',
      mode: 'exact',
      solution: ['a1h1'],
      hints: [
        'Les rois sont face à face, avec g4 entre eux.',
        'Ton roi couvre g3, g4 et g5. Il manque un échec sur la colonne h.',
        'Th1#.',
      ],
      explanation:
        'Th1# : le roi f4 couvre g3, g4 et g5, la tour donne échec sur la colonne h et interdit h3 et h5.',
    },
    {
      fen: '7k/8/8/4R1K1/8/8/8/8 w - - 0 1',
      prompt: 'Mat en 2 : un coup de roi tranquille, puis le mat.',
      mode: 'exact',
      solution: ['g5g6', 'h8g8', 'e5e8'],
      hints: [
        'Le roi noir est dans le coin. Quelles cases ton roi peut-il lui retirer ?',
        'Rg6 couvre g7 et h7, sans donner échec.',
        'Rg6, le roi noir n’a que g8, puis Te8#.',
      ],
      explanation:
        'Rg6 ! couvre g7 et h7 sans donner échec : le roi noir n’a que g8, et Te8# l’enferme sur la 8e rangée.',
    },
    {
      fen: '8/8/8/8/3k4/R7/8/4K3 w - - 0 1',
      prompt: 'Donne échec avec la tour, sans la mettre en prise.',
      mode: 'engine',
      solution: ['a3a4'],
      tolerance: 5,
      traps: ['a3d3', 'a3c3'],
      hints: [
        'Une tour collée au roi adverse n’est protégée par personne.',
        'Cherche une case de la 4e rangée, loin du roi.',
        'Ta4+ : échec depuis le bord de l’échiquier.',
      ],
      explanation:
        'Ta4+ donne échec depuis la case la plus éloignée. Td3+ ?? et Tc3+ ?? posent la tour à côté du roi d4 : il la ' +
        'prend et la partie devient nulle.',
    },
  ],
};

const DEUX_TOURS: Lesson = {
  id: 'fin-deux-tours',
  phase: 1,
  title: 'Mat des deux tours : l’escalier',
  summary: 'Une tour coupe, l’autre donne échec, puis on change : le roi est balayé jusqu’au bord.',
  minutes: 12,
  sections: [
    {
      kind: 'text',
      body:
        'Avec deux tours, ton roi n’a besoin de rien : les tours font tout. **Question : si une tour coupe ' +
        'une rangée, que peut faire l’autre ?** Elle donne échec sur la rangée voisine, et le roi est repoussé. ' +
        'On répète avec les rôles échangés : c’est l’escalier.\n\n' +
        'La règle de sécurité : **les deux tours ne se touchent jamais**, et aucune ne reste à côté du roi ' +
        'noir. Garde-les loin, sur des colonnes ou des rangées différentes.',
    },
    {
      kind: 'walkthrough',
      title: 'L’escalier en action',
      fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
      moves: [
        {
          uci: 'h1h5',
          comment: 'La première tour coupe la 5e rangée : le roi noir ne descendra plus.',
        },
        { uci: 'd6c7', comment: 'Le roi noir se rapproche du bord.' },
        {
          uci: 'a1a6',
          comment: 'La deuxième tour coupe la 6e rangée. Les deux tours forment l’escalier.',
        },
        {
          uci: 'c7b7',
          comment:
            'Le roi noir attaque la tour a6 : il faut la déplacer, mais sans perdre la coupe.',
        },
        {
          uci: 'a6f6',
          comment: 'La tour s’éloigne en restant sur la 6e rangée. Elle est loin du roi.',
        },
        { uci: 'b7c7', comment: 'Le roi noir revient.' },
        {
          uci: 'h5h7',
          comment: 'Échec sur la 7e rangée : le roi est repoussé vers la dernière.',
        },
        { uci: 'c7b8', comment: 'Il n’a plus qu’une rangée.' },
        {
          uci: 'f6f8',
          comment: 'Mat ! Les tours h7 et f8 verrouillent la 7e et la 8e rangée.',
        },
      ],
    },
    {
      kind: 'text',
      title: 'Le pat, encore',
      body:
        'Comme avec la dame, un coup « trop fort » peut ne laisser aucune case au roi sans lui donner échec. ' +
        'Avant de poser une tour sur la même colonne que le roi, compte les cases qui lui restent.',
    },
  ],
  exercises: [
    {
      fen: '8/1k6/R7/7R/8/8/8/4K3 b - - 0 1',
      prompt: 'Le roi noir joue. Quelle tour est en danger ? Clique sur elle.',
      mode: 'squares',
      solution: [],
      squares: ['a6'],
      hints: [
        'Quelle tour est voisine du roi noir ?',
        'Une tour à côté du roi, sans protection, peut être prise.',
        'La tour a6 touche le roi b7 : Rxa6 est possible.',
      ],
      explanation:
        'Le roi b7 est voisin de la tour a6, qui n’est pas protégée : il peut la prendre. La tour h5, elle, est loin. ' +
        'C’est pourquoi les tours restent à distance du roi adverse.',
    },
    {
      fen: 'k7/7R/8/8/8/8/6R1/4K3 w - - 0 1',
      prompt: 'Mat en 1.',
      mode: 'exact',
      solution: ['g2g8'],
      hints: [
        'La tour h7 couvre la 7e rangée. Que reste-t-il au roi a8 ?',
        'La 8e rangée : il faut y donner échec avec l’autre tour.',
        'Tg8# : échec depuis l’autre bout de la rangée.',
      ],
      explanation:
        'Tg8# : la tour h7 ferme a7 et b7, la tour g8 donne échec sur la 8e rangée, de loin, donc sans risque.',
    },
    {
      fen: '2R5/8/8/8/4R3/8/7K/5k2 w - - 0 1',
      prompt: 'Gagne tout de suite, mais attention au pat.',
      mode: 'engine',
      solution: ['c8f8'],
      tolerance: 5,
      traps: ['c8c2'],
      hints: [
        'Compte les cases du roi f1 après chaque coup de tour.',
        'Tc2 coupe la 2e rangée, mais ne donne pas échec.',
        'Tf8# : échec sur la colonne f.',
      ],
      explanation:
        'Tf8# : la tour e4 ferme la colonne e, ton roi h2 couvre g1 et g2, et la tour f8 donne échec sur la colonne f. ' +
        'Tc2?? est pat : le roi f1 n’a plus aucune case.',
    },
    {
      fen: '7R/7R/k4K2/8/8/8/8/8 w - - 0 1',
      prompt: 'Mat en 2 : un coup qui réduit le roi à une seule case, puis le mat.',
      mode: 'exact',
      solution: ['h8b8', 'a6a5', 'h7a7'],
      hints: [
        'Le roi a6 est coincé près du bord. Ta tour h7 couvre déjà la 7e rangée.',
        'Une tour sur la colonne b lui retire b5, b6 et b7, sans donner échec.',
        'Tb8, le roi n’a que a5, puis Ta7#.',
      ],
      explanation:
        'Tb8 ferme la colonne b : le roi a6 n’a que a5. Ta7# : la tour a7 donne échec sur la colonne a et ferme a4 ' +
        'et a6, la tour b8 ferme b4, b5 et b6.',
    },
    {
      fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
      prompt: 'Premier coup de l’escalier : coupe le roi d6 sans mettre de tour en prise.',
      mode: 'choice',
      solution: ['h1h5'],
      accepted: ['h1h5', 'a1a5'],
      hints: [
        'Une tour doit couper une rangée sous le roi, loin de lui.',
        'Le roi est sur la 6e rangée : la 5e est la rangée de coupe.',
        'Th5 ou Ta5.',
      ],
      explanation:
        'Th5 (ou Ta5) coupe la 5e rangée : le roi d6 ne descendra plus jamais. Ta6+ ou Th6+ donneraient échec, mais ' +
        'laisseraient le roi libre de redescendre en d5 ou c5.',
    },
    {
      fen: '5K1k/8/R7/8/8/R7/8/8 w - - 0 1',
      prompt: 'Gagne tout de suite, mais attention au pat.',
      mode: 'engine',
      solution: ['a6h6'],
      tolerance: 5,
      traps: ['a6a7'],
      hints: [
        'Compte les cases du roi h8 après chaque coup de tour.',
        'Ta7 ferme la 7e rangée mais ne donne pas échec.',
        'Th6# (ou Th3#) : échec sur la colonne h.',
      ],
      explanation:
        'Th6# : le roi f8 ferme g8 et g7, la tour donne échec sur la colonne h. Ta7?? est pat : le roi h8 n’a aucune ' +
        'case et n’est pas attaqué.',
    },
  ],
};

const CASES_CLES: Lesson = {
  id: 'fin-cases-cles',
  phase: 1,
  title: 'Cases clés : le roi devant le pion',
  summary: 'Où doit aller ton roi pour que le pion passe quoi qu’il arrive ?',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Un roi et un pion contre un roi : est-ce gagné ? Pas toujours. **Question : à partir de quelles cases ton roi ' +
        'est-il sûr de faire passer le pion ?** Ces cases s’appellent les **cases clés**. Si ton roi les atteint, le ' +
        'pion ira à dame quoi que fasse l’adversaire. Si le roi adverse les occupe avant toi, c’est le plus souvent nulle.',
    },
    {
      kind: 'example',
      fen: '8/8/8/8/4P3/8/8/K6k w - - 0 1',
      caption:
        'Le pion e4 a trois cases clés : d6, e6 et f6, deux rangées devant lui. Un roi blanc sur l’une d’elles ' +
        'gagne, que ce soit à lui ou aux Noirs de jouer.',
      marks: ['d6', 'e6', 'f6'],
    },
    {
      kind: 'text',
      title: 'Où sont les cases clés ? (pion blanc, hors colonnes a et h)',
      body:
        '1. Pion sur la 2e, la 3e ou la 4e rangée : les **trois cases situées deux rangées devant lui** ' +
        '(pion e2 : d4, e4, f4 ; pion e3 : d5, e5, f5 ; pion e4 : d6, e6, f6).\n' +
        '2. Pion sur la 5e rangée : les trois cases de la 6e et les trois de la 7e rangée.\n' +
        '3. Pour les Noirs, on retourne l’échiquier.\n\n' +
        'Conséquence pratique : **ton roi se place devant le pion, pas à côté ni derrière**. Le roi adverse, lui, ' +
        'cherche à occuper ces cases ou à attaquer le pion.',
    },
    {
      kind: 'walkthrough',
      title: 'Cap sur les cases clés',
      fen: '8/8/5k2/8/2P5/4K3/8/8 w - - 0 1',
      moves: [
        {
          uci: 'e3d4',
          comment:
            'Le pion c4 a pour cases clés b6, c6 et d6. Le roi monte vers elles ; Rd4 est le seul coup gagnant ' +
            '(Rd3 ou c5 laissent nulle).',
        },
        { uci: 'f6e7', comment: 'Le roi noir se rapproche, mais il est encore loin.' },
        { uci: 'd4c5', comment: 'Ton roi se place devant le pion et touche b6, c6 et d6.' },
        { uci: 'e7e6', comment: 'Le roi noir garde d6, mais pas c6.' },
        {
          uci: 'c5c6',
          comment: 'Case clé atteinte ! À partir d’ici, le pion passe quoi que fasse le roi noir.',
        },
        { uci: 'e6e7', comment: 'Le roi noir recule d’une case.' },
        { uci: 'c4c5', comment: 'Maintenant le pion peut avancer, escorté par le roi.' },
        { uci: 'e7d8', comment: 'Il tente de rester devant le pion.' },
        { uci: 'c6b7', comment: 'Le roi blanc gagne la 7e rangée.' },
        { uci: 'd8d7', comment: 'Le roi noir reste collé au pion.' },
        { uci: 'c5c6', comment: 'Échec du pion, protégé par le roi.' },
        { uci: 'd7d6', comment: 'Le roi noir attaque le pion, mais il est protégé.' },
        { uci: 'c6c7', comment: 'Le pion arrive en 7e rangée.' },
        { uci: 'd6e5', comment: 'Le roi noir ne peut plus rien arrêter.' },
        { uci: 'b7c6', comment: 'Le roi blanc dégage la case de promotion.' },
        { uci: 'e5f6', comment: 'Les Noirs n’ont plus de défense.' },
        { uci: 'c7c8q', comment: 'Promotion : la dame blanche gagne la partie.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/8/8/8/4P3/8/8/K6k w - - 0 1',
      prompt: 'Désigne les cases clés du pion e4.',
      mode: 'squares',
      solution: [],
      squares: ['d6', 'e6', 'f6'],
      hints: [
        'Compte deux rangées devant le pion.',
        'Le pion est en e4 : deux rangées plus haut, c’est la 6e rangée.',
        'Les cases clés sont d6, e6 et f6, autour de la colonne du pion.',
      ],
      explanation:
        'Un roi blanc en d6, e6 ou f6 fait passer le pion e4 : les cases clés sont toujours les trois cases situées ' +
        'deux rangées devant le pion.',
    },
    {
      fen: '8/8/8/8/8/2P5/8/K6k w - - 0 1',
      prompt: 'Désigne les cases clés du pion c3.',
      mode: 'squares',
      solution: [],
      squares: ['b5', 'c5', 'd5'],
      hints: [
        'Pion sur la 3e rangée : où se trouvent les cases deux rangées devant ?',
        'Deux rangées devant c3, c’est la 5e rangée.',
        'Les cases clés sont b5, c5 et d5.',
      ],
      explanation:
        'Deux rangées devant le pion c3, il y a b5, c5 et d5. Un roi blanc sur l’une de ces cases gagne.',
    },
    {
      fen: '8/8/8/5k2/2P5/4K3/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Où va le roi ?',
      mode: 'engine',
      solution: ['e3d4'],
      tolerance: 10,
      traps: ['c4c5', 'e3d3'],
      hints: [
        'Les cases clés de c4 sont b6, c6 et d6. Ton roi est loin derrière le pion.',
        'Le roi doit monter vers la 6e rangée sans passer derrière le pion.',
        'Rd4.',
      ],
      explanation:
        'Rd4 ! prépare Rc5 puis Rc6. Pousser le pion (c5 ?) laisse le roi noir l’attaquer, et Rd3 ? perd un temps : ' +
        'dans les deux cas le roi noir s’installe devant le pion et fait nulle.',
    },
    {
      fen: '8/5k2/8/3P4/3K4/8/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent : vise les cases clés du pion d5.',
      mode: 'engine',
      solution: ['d4c5'],
      tolerance: 10,
      traps: ['d5d6', 'd4e5'],
      hints: [
        'Un pion sur la 5e rangée a pour cases clés les cases c6, d6, e6 (et celles de la 7e).',
        'Ton roi doit aller sur la 6e rangée, devant le pion. Le roi noir garde e6 et d6.',
        'Rc5, puis Rc6.',
      ],
      explanation:
        'Rc5 ! mène au roi sur c6, une case clé que le roi noir ne peut pas défendre. d6 ? est trop tôt : ' +
        'le roi noir bloque devant le pion. Re5 ? laisse le roi noir en e7 et fait nulle.',
    },
    {
      fen: '8/8/8/8/4P3/2k5/4K3/8 b - - 0 1',
      prompt: 'Les Noirs jouent et font nulle. Le roi blanc est derrière le pion : profites-en.',
      mode: 'engine',
      solution: ['c3d4'],
      tolerance: 10,
      traps: ['c3b4', 'c3c4'],
      hints: [
        'Le pion e4 n’est protégé que par le roi derrière lui. Attaque-le !',
        'Pour défendre, mets ton roi devant le pion ou sur une case qui l’attaque.',
        'Rd4.',
      ],
      explanation:
        'Rd4 ! attaque le pion et prend les cases clés les plus utiles. Après Rb4 ? ou Rc4 ?, le roi noir est ' +
        'trop loin du pion : le roi blanc passe devant et gagne.',
    },
    {
      fen: '8/8/8/8/2k5/8/4P3/4K3 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent : le pion est encore sur sa case de départ.',
      mode: 'engine',
      solution: ['e1f2'],
      tolerance: 10,
      traps: ['e2e4', 'e1d2'],
      hints: [
        'Les cases clés de e2 sont d4, e4 et f4 : le roi noir est tout près d’elles.',
        'Ton roi doit monter du côté où le roi noir ne peut pas l’empêcher d’avancer.',
        'Rf2, puis Rf3.',
      ],
      explanation:
        'Rf2 ! : le roi blanc va en f3, puis e4 ou f4 (cases clés). e4 ? lance le pion trop tôt, et Rd2 ? va du ' +
        'mauvais côté : dans les deux cas, le roi noir prend l’avantage.',
    },
  ],
};

const OPPOSITION: Lesson = {
  id: 'fin-opposition',
  phase: 1,
  title: 'L’opposition directe',
  summary:
    'Face à face avec une case entre les rois : celui qui n’a pas le trait gagne la bataille.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Deux rois ne peuvent jamais se toucher. Quand ils se font face avec **une seule case entre eux** (même ' +
        'colonne, même rangée ou même diagonale), ils sont **en opposition**. **Question : qui est avantagé, celui ' +
        'qui doit jouer ou celui qui attend ?** Celui qui attend. Le roi qui doit jouer est obligé de s’écarter et ' +
        'laisse passer l’autre : on dit que l’autre « a l’opposition ».',
    },
    {
      kind: 'example',
      fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1',
      caption:
        'Les Blancs ont le trait : ce sont les Noirs qui ont l’opposition. Aucun roi ne peut entrer en e5 sans se ' +
        'retrouver à côté de l’autre ; le roi qui doit jouer s’écarte, et l’autre avance.',
      marks: ['e5'],
    },
    {
      kind: 'text',
      title: 'Les règles à retenir',
      body:
        '1. L’attaquant place son roi **devant** son pion. Il veut l’opposition, pour que le roi adverse cède.\n' +
        '2. Si c’est à lui de jouer, il peut **perdre un temps** avec un coup de pion, comme la tour dans le mat : ' +
        'l’opposition change de camp.\n' +
        '3. Le défenseur reste **devant** le pion et reprend l’opposition à chaque occasion. S’il laisse passer ' +
        'le roi adverse sur la rangée devant le pion, c’est perdu.\n\n' +
        'Cette leçon traite l’opposition directe, de près. L’opposition à distance et la triangulation viennent ' +
        'au palier suivant.',
    },
    {
      kind: 'walkthrough',
      title: 'Perdre un temps pour gagner l’opposition',
      fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
      moves: [
        {
          uci: 'e2e3',
          comment:
            'Les rois sont en opposition mais les Blancs ont le trait : le coup de pion est le coup d’attente. ' +
            'Maintenant ce sont les Noirs qui doivent céder.',
        },
        { uci: 'e6d6', comment: 'Le roi noir doit s’écarter.' },
        { uci: 'e4f5', comment: 'Le roi blanc passe devant le pion, sur la 5e rangée.' },
        { uci: 'd6e7', comment: 'Les Noirs se replient.' },
        {
          uci: 'f5e5',
          comment:
            'Ton roi se place en e5, devant le pion et en opposition face au roi e7 : les Noirs doivent céder.',
        },
        { uci: 'e7f7', comment: 'Le roi noir s’écarte à nouveau.' },
        { uci: 'e5d6', comment: 'Le roi blanc gagne la 6e rangée : le roi noir est repoussé.' },
        { uci: 'f7e8', comment: 'Le roi noir recule sur la dernière rangée.' },
        { uci: 'e3e4', comment: 'Le pion avance, escorté par le roi.' },
        { uci: 'e8d8', comment: 'Les Noirs se replient.' },
        { uci: 'e4e5', comment: 'Le pion avance encore.' },
        { uci: 'd8c8', comment: 'Les Noirs reculent.' },
        {
          uci: 'd6e7',
          comment:
            'Le roi blanc devance le pion sur la 7e rangée : le pion ira à dame, c’est gagné.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/8/4k3/8/8/8/8/K7 w - - 0 1',
      prompt:
        'Le roi noir est en e6. Désigne toutes les cases où ton roi serait en opposition avec lui (une case entre les rois, en ligne droite).',
      mode: 'squares',
      solution: [],
      squares: ['c6', 'g6', 'e4', 'e8'],
      hints: [
        'Il faut exactement une case libre entre les deux rois.',
        'Compte deux cases à partir de e6, vers la gauche, la droite, le haut et le bas.',
        'Les quatre cases sont c6, g6, e4 et e8.',
      ],
      explanation:
        'Deux cases de distance, en ligne droite : c6, g6, e4 et e8. (Sur les diagonales, c4, g4, c8 et g8 donnent ' +
        'l’opposition diagonale.)',
    },
    {
      fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1',
      prompt: 'Les Blancs ont le trait. Quel roi a l’opposition ? Clique sur son roi.',
      mode: 'squares',
      solution: [],
      squares: ['e6'],
      hints: [
        'Les rois se font face avec une case entre eux.',
        'Celui qui a l’opposition est celui qui n’a pas le trait.',
        'Les Blancs jouent : le roi noir a l’opposition.',
      ],
      explanation:
        'Le camp qui doit jouer perd l’opposition : il doit s’écarter et laisser l’autre passer.',
    },
    {
      fen: '8/8/4k3/8/4K3/8/8/8 b - - 0 1',
      prompt: 'Les Noirs ont le trait. Quel roi a l’opposition ? Clique sur son roi.',
      mode: 'squares',
      solution: [],
      squares: ['e4'],
      hints: [
        'Même position que précédemment, mais le trait a changé.',
        'Celui qui a l’opposition est celui qui n’a pas le trait.',
        'Les Noirs jouent : le roi blanc a l’opposition.',
      ],
      explanation:
        'C’est maintenant le roi noir qui doit céder : le roi blanc a l’opposition. Le même emplacement des rois ' +
        'donne l’avantage à l’autre camp quand le trait change.',
    },
    {
      fen: '8/8/8/3k4/8/8/8/K7 w - - 0 1',
      prompt: 'Le roi noir est en d5. Où serait ton roi en opposition diagonale avec lui ?',
      mode: 'squares',
      solution: [],
      squares: ['b3', 'f3', 'b7', 'f7'],
      hints: [
        'En diagonale aussi, il faut une case libre entre les deux rois.',
        'Compte deux cases en diagonale depuis d5, dans les quatre directions.',
        'Les quatre cases sont b3, f3, b7 et f7.',
      ],
      explanation:
        'L’opposition diagonale compte aussi : deux cases en diagonale, une libre entre les rois. Les cases ' +
        'sont b3, f3, b7 et f7.',
    },
    {
      fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent : les rois sont en opposition, mais tu as le trait.',
      mode: 'engine',
      solution: ['e2e3'],
      tolerance: 10,
      traps: ['e4e3', 'e4d3'],
      hints: [
        'Ton roi doit rester devant le pion. Que peux-tu jouer pour donner le trait aux Noirs ?',
        'Tu as un coup d’attente à portée de main : le pion.',
        'e3.',
      ],
      explanation:
        'e3 ! garde le roi en e4 et renvoie le trait aux Noirs : ils perdent l’opposition. Re3 ? ou Rd3 ? reculent ' +
        'derrière le pion : le roi noir passe devant, c’est nulle.',
    },
    {
      fen: '8/3k4/8/4P3/4K3/8/8/8 b - - 0 1',
      prompt: 'Les Noirs jouent et font nulle : où placer le roi ?',
      mode: 'engine',
      solution: ['d7e7'],
      tolerance: 10,
      traps: ['d7c6', 'd7c7'],
      hints: [
        'Où doit rester le roi défenseur par rapport au pion ?',
        'Devant lui, sur la colonne e : la colonne c est trop loin.',
        'Re7 (Re8, Rd8 ou Re6 conviennent aussi).',
      ],
      explanation:
        'Re7 ! reste devant le pion et prend l’opposition quand le roi blanc avance. Rc6 ? ou Rc7 ? passent sur le ' +
        'côté : Rd5 et le roi blanc gagne.',
    },
  ],
};

const PION_DE_TOUR: Lesson = {
  id: 'fin-pion-de-tour',
  phase: 1,
  title: 'Le pion de tour : nulle dans le coin',
  summary: 'Pourquoi le pion a ou h ne passe pas quand le roi défenseur est dans le coin.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Avec un pion de tour (colonne a ou h), la règle des cases clés ne marche plus. **Question : qu’a ce pion de ' +
        'spécial ?** Il est au bord : ton roi ne peut l’escorter que d’un seul côté, et le roi adverse s’installe dans ' +
        'le **coin** de promotion, où on ne peut plus le déloger.\n\n' +
        'Le défenseur a deux atouts : il bloque la case de promotion, et ses cases de coin sont des cases de **pat** : ' +
        'si l’attaquant joue trop vite, c’est nulle.',
    },
    {
      kind: 'example',
      fen: '7k/7P/6K1/8/8/8/8/8 w - - 0 1',
      caption:
        'Position de nulle : le pion est en h7, le roi noir dans le coin. Rh6 ?? est pat, et Rf7 ? ou Rf6 ? ' +
        'laissent le roi noir prendre le pion. Les Blancs ne peuvent pas progresser.',
      marks: ['g8', 'h8'],
    },
    {
      kind: 'text',
      title: 'Le défenseur : cap sur le coin',
      body:
        'Pour un pion h sur la 6e rangée, le roi noir fait nulle s’il atteint f7, g7, h7, g8 ou h8, quelle que soit ' +
        'la position du roi blanc. Plus le pion est avancé, moins il y a de cases : retiens surtout **g7, g8, h7, ' +
        'h8**.\n\n' +
        'L’attaquant, lui, doit couper le roi noir du coin **avant qu’il y arrive**. Si le roi noir est resté trop ' +
        'loin (colonne d ou e), le pion pousse tout de suite et gagne.',
    },
    {
      kind: 'walkthrough',
      title: 'Tenir la nulle : le roi arrive dans la zone',
      fen: '8/8/4k3/6KP/8/8/8/8 b - - 0 1',
      moves: [
        {
          uci: 'e6f7',
          comment: 'Cap sur le coin ! Rd7 ? se laisserait couper de la colonne g : perdu.',
        },
        { uci: 'g5h6', comment: 'Le roi blanc prend la case devant le pion.' },
        { uci: 'f7g8', comment: 'Le roi noir arrive dans la zone sûre du coin.' },
        { uci: 'h6g6', comment: 'Les Blancs essaient de gêner.' },
        { uci: 'g8h8', comment: 'Le roi noir se met dans le coin : c’est la place la plus sûre.' },
        {
          uci: 'g6f7',
          comment:
            'Le roi blanc couvre g8 et g7, mais h7 reste libre : pas de pat, et pas de progrès non plus.',
        },
        { uci: 'h8h7', comment: 'Seule case libre du roi noir.' },
        { uci: 'h5h6', comment: 'Les Blancs tentent de pousser le pion.' },
        { uci: 'h7h6', comment: 'Le pion est capturé : roi contre roi, la partie est nulle.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/8/7P/8/8/8/8/K6k w - - 0 1',
      prompt:
        'Le pion blanc est en h6. Désigne les cases où un roi noir fait nulle quelle que soit la position du roi blanc.',
      mode: 'squares',
      solution: [],
      squares: ['f7', 'g7', 'h7', 'g8', 'h8'],
      hints: [
        'Ce sont des cases proches du coin de promotion h8.',
        'Il y a deux cases sur la 8e rangée et trois sur la 7e.',
        'f7, g7, h7, g8 et h8.',
      ],
      explanation:
        'Si le roi noir atteint l’une de ces cinq cases, il fait nulle quelle que soit la position du roi blanc. ' +
        'Avec un pion a, c’est la zone symétrique : c7, b7, a7, b8 et a8.',
    },
    {
      fen: '8/8/P7/8/8/8/8/K6k w - - 0 1',
      prompt: 'Le pion blanc est en a6. Désigne les cases du roi noir qui font nulle.',
      mode: 'squares',
      solution: [],
      squares: ['c7', 'b7', 'a7', 'b8', 'a8'],
      hints: [
        'C’est la même idée que pour le pion h, mais de l’autre côté.',
        'Le coin de promotion est a8.',
        'a7, a8, b7, b8 et c7.',
      ],
      explanation: 'Symétrique du pion h : c7, b7, a7, b8 et a8 sont les cases de nulle.',
    },
    {
      fen: '3k4/8/8/7P/5K2/8/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent : le roi noir est loin du coin.',
      mode: 'engine',
      solution: ['h5h6'],
      tolerance: 10,
      traps: ['f4g5', 'f4e5'],
      hints: [
        'Le roi noir est en d8, trop loin pour atteindre le coin avant le pion.',
        'Il ne faut pas lui laisser le temps d’arriver en f7 ou g7.',
        'h6 !',
      ],
      explanation:
        'h6 ! : le pion file avant que le roi noir n’atteigne g7. Si tu perds un temps (Rg5 ? ou Re5 ?), il arrive ' +
        'dans la zone du coin et la nulle est acquise.',
    },
    {
      fen: '8/8/4k3/6KP/8/8/8/8 b - - 0 1',
      prompt: 'Les Noirs jouent et font nulle : où va ton roi ?',
      mode: 'engine',
      solution: ['e6f7'],
      tolerance: 10,
      traps: ['e6d6', 'e6d7'],
      hints: [
        'Le pion est en h5 : quel est ton objectif ?',
        'Va vers le coin h8, pas vers la colonne d.',
        'Rf7 (Re7 convient aussi).',
      ],
      explanation:
        'Rf7 ! se rapproche du coin. Rd6 ? ou Rd7 ? s’en éloignent et le roi blanc passe : le pion file et gagne.',
    },
    {
      fen: '8/5k2/7K/7P/8/8/8/8 b - - 0 1',
      prompt: 'Les Noirs jouent et font nulle. Attention aux coups qui te coupent du coin.',
      mode: 'engine',
      solution: ['f7g8'],
      tolerance: 10,
      traps: ['f7e7', 'f7e6'],
      hints: [
        'Ton roi est déjà proche du coin. Ne t’en éloigne surtout pas.',
        'Va sur la 8e rangée, dans la zone de nulle.',
        'Rg8 (Rf8 ou Rf6 conviennent aussi).',
      ],
      explanation:
        'Rg8 ! reste dans la zone du coin. Re7 ? ou Re6 ? te coupent de la colonne g : le roi blanc prend g7 et le ' +
        'pion passe.',
    },
  ],
};

const DAME_PION: Lesson = {
  id: 'fin-dame-pion',
  phase: 1,
  title: 'Dame contre pion en 7e',
  summary:
    'Les échecs forcent le roi devant son pion : pion central ou de cavalier, la dame gagne.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Le pion adverse est sur la 7e rangée et menace de devenir dame. Tu as une dame, mais ton roi est loin. ' +
        '**Question : comment capturer le pion sans lui laisser une case de promotion ?**\n\n' +
        'Le plan : donner des **échecs successifs** qui obligent le roi adverse à se placer devant son pion. Cela ' +
        'bloque son pion et te laisse du temps : ton roi s’approche, puis la dame prend le pion ou mate.',
    },
    {
      kind: 'walkthrough',
      title: 'Pion central : les échecs puis le roi',
      fen: '8/8/8/2K5/8/5Q2/3p4/4k3 w - - 0 1',
      moves: [
        {
          uci: 'f3e3',
          comment: 'Échec depuis une case éloignée : le roi noir doit répondre.',
        },
        {
          uci: 'e1d1',
          comment:
            'Le roi noir se place devant son pion (Rf1 est possible aussi) : il ne peut plus avancer.',
        },
        {
          uci: 'c5d4',
          comment:
            'Un coup de roi tranquille. La dame tient le roi noir sur le bord, il n’y a plus de menace.',
        },
        {
          uci: 'd1c2',
          comment:
            'Le roi noir libère la case d1 : il menace d1=D. Mais ta dame garde le pion d2 sous contrôle.',
        },
        {
          uci: 'e3c3',
          comment: 'Échec : le roi noir est repoussé, et la dame attaque le pion d2.',
        },
        { uci: 'c2b1', comment: 'Le roi noir se réfugie dans le coin.' },
        { uci: 'c3d2', comment: 'La dame capture le pion.' },
        { uci: 'b1a1', comment: 'Le roi noir n’a plus que le coin.' },
        {
          uci: 'd4c3',
          comment:
            'Le roi blanc arrive à deux cases. Attention : un coup de dame trop fort serait pat.',
        },
        { uci: 'a1b1', comment: 'Seul coup.' },
        { uci: 'd2b2', comment: 'Mat ! Le roi blanc protège la dame.' },
      ],
    },
    {
      kind: 'text',
      title: 'L’exception : pion de tour ou de fou',
      body:
        'Avec un pion de **fou** (colonnes c ou f) ou de **tour** (colonnes a ou h), le roi noir se glisse dans ' +
        'le coin. Si la dame capture le pion, c’est **pat**. Quand le roi blanc est **loin**, ce sont des nulles.\n\n' +
        'Avec un pion **central** (d, e) ou de **cavalier** (b, g), le roi noir n’a pas ce refuge : la dame gagne ' +
        'même seule.',
    },
    {
      kind: 'example',
      fen: '7K/8/8/8/8/8/2Q5/k7 b - - 0 1',
      caption:
        'Pat après Dxc2 ? contre un pion de fou : le roi a1 n’a plus de case libre (a2, b1 et b2 sont couvertes) et ' +
        'n’est pas en échec.',
      marks: ['a2', 'b1', 'b2'],
    },
  ],
  exercises: [
    {
      fen: 'k6K/8/8/8/3Q4/8/pppppppp/8 w - - 0 1',
      prompt:
        'Le roi blanc est loin. Désigne les pions contre lesquels la dame gagne (pions de cavalier et pions centraux).',
      mode: 'squares',
      solution: [],
      squares: ['b2', 'd2', 'e2', 'g2'],
      hints: [
        'Les pions de tour et de fou font nulle quand le roi est loin.',
        'Il reste les colonnes b, d, e et g.',
        'b2, d2, e2 et g2.',
      ],
      explanation:
        'Contre un pion de cavalier (b, g) ou central (d, e), la dame force le roi devant son pion et gagne. Contre ' +
        'les autres, le pat sauve le défenseur.',
    },
    {
      fen: 'k6K/8/8/8/3Q4/8/pppppppp/8 w - - 0 1',
      prompt: 'Désigne les pions contre lesquels la dame, avec le roi loin, ne gagne pas (nulle).',
      mode: 'squares',
      solution: [],
      squares: ['a2', 'c2', 'f2', 'h2'],
      hints: [
        'C’est l’ensemble complémentaire de l’exercice précédent.',
        'Pions de tour et de fou.',
        'a2, c2, f2 et h2.',
      ],
      explanation:
        'Les pions de tour (a, h) et de fou (c, f) permettent au roi de se réfugier dans le coin, où la capture ' +
        'du pion fait pat.',
    },
    {
      fen: '8/8/8/2K5/8/5Q2/3p4/4k3 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent : le premier coup de la méthode.',
      mode: 'engine',
      solution: ['f3e3'],
      tolerance: 5,
      traps: ['f3f1', 'f3f2'],
      hints: [
        'Tu veux forcer le roi noir à se placer devant son pion, avec des échecs.',
        'Attention : ne donne pas échec à côté du roi, il prendrait la dame.',
        'De3+ (échec depuis une case éloignée).',
      ],
      explanation:
        'De3+ est un échec sûr. Df1+ ?? et Df2+ ?? posent la dame à côté du roi : il la prend.',
    },
    {
      fen: '8/8/2K5/8/8/8/3p3Q/4k3 w - - 0 1',
      prompt:
        'Même méthode, roi plus loin : donne le premier échec, le roi noir répond, ton roi approche.',
      mode: 'exact',
      solution: ['h2h1', 'e1e2', 'h1e4'],
      hints: [
        'Ton roi est loin. Combien d’échecs peux-tu donner ?',
        'Les échecs en série font avancer ta dame vers le roi noir et gardent la main.',
        'Dh1+, puis De4+.',
      ],
      explanation:
        'Dh1+ puis De4+ forcent le roi noir à reculer, puis à revenir devant son pion : ton roi, lui, a le temps ' +
        'd’arriver. Un pion central ne résiste pas.',
    },
    {
      fen: '8/8/8/8/8/2K5/3Q4/1k6 w - - 0 1',
      prompt: 'Mat en 1.',
      mode: 'exact',
      solution: ['d2b2'],
      hints: [
        'Ton roi protège-t-il une case voisine du roi noir ?',
        'Le roi c3 protège b2. La dame peut y aller sans être prise.',
        'Db2#.',
      ],
      explanation:
        'Db2# : la dame est protégée par le roi c3, et le roi b1 n’a plus aucune case libre (a1, a2, c1, c2).',
    },
  ],
};

export const ENDGAMES_COURSE: Lesson[] = [
  MAT_DAME,
  MAT_TOUR,
  DEUX_TOURS,
  CASES_CLES,
  OPPOSITION,
  PION_DE_TOUR,
  DAME_PION,
];
