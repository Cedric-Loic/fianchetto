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
          comment:
            'Ton roi couvre g3, g4 et g5. Le roi noir n’a plus qu’une case : h4.',
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
        { uci: 'f5f6', comment: 'Opposition de nouveau : f6 face à f8, et c’est aux Noirs de jouer.' },
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
      accepted: ['a6e6', 'a6d6', 'a6c6', 'a6b6'],
      hints: [
        'Si ton roi avance, le roi noir garde l’opposition. Que peut jouer la tour sans changer la situation ?',
        'La tour reste sur la 6e rangée et change de case.',
        'Te6, Td6, Tc6 ou Tb6 : un coup d’attente de la tour.',
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
          comment: 'Le roi noir attaque la tour a6 : il faut la déplacer, mais sans perdre la coupe.',
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

export const ENDGAMES_COURSE: Lesson[] = [MAT_DAME, MAT_TOUR, DEUX_TOURS];
