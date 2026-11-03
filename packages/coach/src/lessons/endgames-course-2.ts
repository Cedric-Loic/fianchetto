import type { Lesson } from './types.js';

/*
 * Cours de finales, palier 2 (1200-1400). Même format que le palier 1 : une question d'abord,
 * l'explication ensuite, un pas à pas commenté puis des exercices (cases, choix, coup exact,
 * moteur). Les annotations sont originales.
 *
 * Vérification : les positions de pions purs le sont par la base KPK (`kpk.ts`), les autres par
 * Stockfish (`pnpm test:stress`, apps/server/test/{lessons,endgames}.stress.ts). Les chapitres
 * dont l'évaluation du moteur n'est pas fiable (forteresses) n'ont pas de partie contre le bot :
 * leçon et quiz de concepts seulement.
 */

const OPPOSITION_DISTANCE: Lesson = {
  id: 'fin-opposition-distance',
  phase: 2,
  title: 'L’opposition à distance',
  summary:
    'Trois ou cinq cases entre les rois : prends la ligne avant que l’autre roi ne s’approche.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Dans une vraie partie, les rois sont rarement à une case d’écart. **Question : comment savoir, de loin, ' +
        'qui aura l’opposition quand ils se seront rapprochés ?** Compte les cases libres entre eux, sur une ' +
        'colonne, une rangée ou une diagonale. Si leur nombre est **impair** (1, 3 ou 5), celui qui n’a pas le ' +
        'trait possède l’opposition. S’il est pair, personne ne l’a encore.\n\n' +
        'L’opposition directe (une case entre les rois) n’est que le cas le plus simple de cette règle.',
    },
    {
      kind: 'example',
      fen: '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
      caption:
        'Trois cases libres entre les rois (e2, e3, e4) : c’est une opposition à distance. Les Blancs ont le ' +
        'trait, ce sont donc les Noirs qui l’ont. Si le roi blanc avance en e2, le roi noir répond Re4 : ' +
        'l’opposition directe lui revient.',
      marks: ['e2', 'e3', 'e4'],
    },
    {
      kind: 'text',
      title: 'À quoi ça sert ?',
      body:
        'Quand ton roi est encore trop loin pour l’opposition directe, tu prends l’opposition à distance. Ensuite :\n' +
        '1. si le roi adverse s’approche, tu t’approches aussi : à chaque pas, tu gardes la parité ;\n' +
        '2. s’il s’écarte, tu entres par l’autre côté, vers une case clé du pion.\n\n' +
        'Le défenseur raisonne pareil : s’il prend l’opposition à distance, le roi adverse n’entre pas, et c’est nulle.',
    },
    {
      kind: 'walkthrough',
      title: 'Prendre l’opposition de loin',
      fen: '4k3/8/8/8/8/2P2K2/8/8 w - - 0 1',
      moves: [
        {
          uci: 'f3e4',
          comment:
            'Re4 ! Les rois sont sur la colonne e avec trois cases libres entre eux (e5, e6, e7) : c’est aux Noirs ' +
            'de jouer, donc tu as l’opposition à distance. Tous les autres coups de roi laissent nulle.',
        },
        {
          uci: 'e8d7',
          comment: 'Le roi noir doit quitter la colonne e et cherche à se rapprocher du pion.',
        },
        {
          uci: 'e4d5',
          comment:
            'Rd5 : ton roi est sur une case clé du pion c3 (deux rangées devant lui : b5, c5, d5). Le roi noir n’a plus de ' +
            'moyen de l’arrêter.',
        },
        {
          uci: 'd7c7',
          comment: 'Les Noirs se placent en face, pour tenter de reprendre l’opposition.',
        },
        {
          uci: 'd5c5',
          comment:
            'Rc5 ! Opposition directe (c5 face à c7) avec les Noirs au trait. Rc4 ou Re6 ne gagneraient plus : ' +
            'seul ce coup garde la case clé.',
        },
        { uci: 'c7d8', comment: 'Le roi noir doit céder.' },
        {
          uci: 'c5c6',
          comment:
            'Ton roi gagne la 6e rangée, devant son pion : le roi noir est repoussé sur le bord.',
        },
        { uci: 'd8e8', comment: 'Le roi noir recule.' },
        {
          uci: 'c3c4',
          comment:
            'Maintenant le pion peut avancer, escorté par le roi. La suite est la technique des cases clés.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '8/8/3k4/8/8/8/8/K7 w - - 0 1',
      prompt:
        'Le roi noir est en d6. Désigne les cases où ton roi aurait l’opposition à distance (trois cases libres entre les rois, en ligne droite ou en diagonale).',
      mode: 'squares',
      solution: [],
      squares: ['d2', 'h6', 'h2'],
      hints: [
        'Il faut exactement trois cases libres entre les deux rois, sur une colonne, une rangée ou une diagonale.',
        'Compte quatre cases à partir de d6 dans chaque direction, sans sortir de l’échiquier.',
        'Les trois cases sont d2, h6 et h2.',
      ],
      explanation:
        'd2 (colonne d), h6 (6e rangée) et h2 (diagonale) laissent trois cases libres. Vers le haut et vers la gauche, ' +
        'l’échiquier est trop court : a6 et a3 ne laissent que deux cases.',
    },
    {
      fen: '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
      prompt: 'Les Blancs ont le trait. Quel roi a l’opposition à distance ? Clique sur son roi.',
      mode: 'squares',
      solution: [],
      squares: ['e5'],
      hints: [
        'Compte les cases libres entre les rois : sont-elles en nombre impair ?',
        'Celui qui a l’opposition est celui qui n’a pas le trait.',
        'Les Blancs doivent jouer : le roi noir a l’opposition.',
      ],
      explanation:
        'Trois cases libres (e2, e3, e4), nombre impair : celui qui n’a pas le trait, le roi noir, a l’opposition. ' +
        'Si c’était aux Noirs de jouer, ce serait l’inverse.',
    },
    {
      fen: '8/2k5/8/8/8/8/1K2P3/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Où va le roi ?',
      mode: 'engine',
      solution: ['b2c3'],
      tolerance: 5,
      traps: ['b2b3', 'b2c2', 'e2e4'],
      hints: [
        'Ton roi est loin du pion et du roi noir. Quelle ligne peut-il prendre sur le roi noir, avec le bon nombre de cases ?',
        'Le roi noir est en c7 : cherche la colonne c.',
        'Rc3 : c3 et c7 ont trois cases libres entre eux.',
      ],
      explanation:
        'Rc3 ! prend l’opposition à distance sur la colonne c, avec les Noirs au trait. Rb3 ? ou Rc2 ? perdent le rapport ' +
        'des cases ; e4 ? lance le pion trop tôt. Dans les trois cas, le roi noir reprend la bonne parité et c’est nulle.',
    },
    {
      fen: '4k3/8/8/8/2PK4/8/8/8 b - - 0 1',
      prompt: 'Avec les Noirs, tiens la nulle contre le pion c4. Ton roi est loin : où vas-tu ?',
      mode: 'engine',
      solution: ['e8d8'],
      tolerance: 5,
      traps: ['e8e7', 'e8f7'],
      hints: [
        'Le roi blanc est en d4 : sur quelle colonne peux-tu te placer face à lui ?',
        'La colonne d est la bonne : compte les cases entre d8 et d4.',
        'Rd8 : trois cases libres (d5, d6, d7) et le trait est aux Blancs.',
      ],
      explanation:
        'Rd8 ! Les rois sont sur la colonne d avec trois cases libres, c’est aux Blancs de jouer : tu as l’opposition à ' +
        'distance. Re7 ? ou Rf7 ? laissent le roi blanc entrer en d5 ou e5 : le pion passe.',
    },
    {
      fen: '5k2/8/8/8/8/3P2K1/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Quel coup de roi prend l’opposition à distance ?',
      mode: 'engine',
      solution: ['g3f4'],
      tolerance: 5,
      traps: ['g3g4', 'g3f3'],
      hints: [
        'Le roi noir est en f8 : regarde la colonne f.',
        'Il faut trois cases libres entre les rois.',
        'Rf4 : f5, f6, f7 sont libres.',
      ],
      explanation:
        'Rf4 ! Trois cases libres sur la colonne f, le trait est aux Noirs : opposition à distance. Rg4 ? et Rf3 ? ne ' +
        'tiennent pas la bonne colonne ; le roi noir s’installe en face et le pion ne passe plus.',
    },
    {
      fen: '4k3/8/8/8/8/2P2K2/8/8 w - - 0 1',
      prompt: 'Joue le début de la méthode : opposition à distance, puis les cases clés.',
      mode: 'exact',
      solution: ['f3e4', 'e8d7', 'e4d5', 'd7c7', 'd5c5'],
      hints: [
        'Premier coup : prends l’opposition à distance sur la colonne e.',
        'Ensuite, le roi noir s’écarte : entre sur une case clé du pion c3 (5e rangée).',
        'Re4, puis Rd5 et Rc5 pour rependre l’opposition directe.',
      ],
      explanation:
        'Re4 (opposition à distance), Rd5 (case clé du pion c3), puis Rc5 (opposition directe) : à chaque étape, un seul ' +
        'coup garde le gain. Les autres coups de roi laissent nulle.',
    },
  ],
};

const PASSE_ELOIGNE: Lesson = {
  id: 'fin-pion-passe-eloigne',
  phase: 2,
  title: 'Le pion passé éloigné',
  summary:
    'Un pion passé loin des autres pions occupe le roi adverse, pendant que le tien mange l’autre aile.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Tu as un pion de plus sur l’aile a, mais ni toi ni l’adversaire n’avez de pion de ce côté-là d’autre : c’est un ' +
        '**pion passé éloigné** (éloigné des autres pions, donc de l’action). **Question : un roi peut-il être à deux ' +
        'endroits à la fois ?** Non. Le roi noir doit courir arrêter ce pion, et pendant ce temps ton roi se promène ' +
        'sur l’autre aile, où il mange les pions adverses.\n\n' +
        'Le pion éloigné est un **appât** : même s’il tombe, tu as gagné les temps nécessaires.',
    },
    {
      kind: 'example',
      fen: '4k3/5ppp/8/8/P7/8/5PPP/4K3 w - - 0 1',
      caption:
        'Le pion a4 est passé et éloigné des pions f, g, h. Le roi noir ne peut pas le laisser filer, mais s’il part, ' +
        'les pions f7, g7 et h7 restent sans protection contre le roi blanc.',
      marks: ['a4'],
    },
    {
      kind: 'text',
      title: 'La méthode',
      body:
        '1. **Ne cours pas** avec le pion : s’il est attaqué, laisse-le, ou pousse-le si cela gagne un temps.\n' +
        '2. **Lance ton roi** vers le centre puis vers l’aile où les pions noirs sont faibles.\n' +
        '3. Calcule la course : le roi noir revient-il à temps ? S’il a pris le pion a, il est à six colonnes de ses ' +
        'propres pions.',
    },
    {
      kind: 'walkthrough',
      title: 'L’appât et la promenade du roi',
      fen: '8/6pp/3k4/8/P7/4K3/6PP/8 w - - 0 1',
      moves: [
        {
          uci: 'e3f4',
          comment:
            'Ton roi file vers l’autre aile, sans s’occuper du pion a4. Il se rapproche des pions g7 et h7.',
        },
        { uci: 'd6c5', comment: 'Le roi noir va chercher le pion a4 : il s’éloigne de ses pions.' },
        { uci: 'h2h4', comment: 'Un coup utile : le pion h garde de la place derrière le roi.' },
        { uci: 'c5b4', comment: 'Le roi noir approche encore du pion a4.' },
        { uci: 'f4e5', comment: 'Ton roi continue vers les pions noirs, pas vers le pion perdu.' },
        {
          uci: 'b4a4',
          comment:
            'Le pion a4 est pris : les Noirs ont gagné un pion, mais perdu des temps précieux.',
        },
        {
          uci: 'e5e6',
          comment:
            'Le roi blanc passe sur la 6e rangée : les pions g7 et h7 n’ont plus de roi pour les défendre.',
        },
        { uci: 'a4b4', comment: 'Le roi noir revient, il est déjà trop tard.' },
        { uci: 'e6f7', comment: 'Ton roi attaque le pion g7.' },
        { uci: 'g7g6', comment: 'Les Noirs avancent pour éviter la capture.' },
        { uci: 'g2g4', comment: 'Les pions blancs s’avancent à leur tour, protégés par le roi.' },
        { uci: 'g6g5', comment: 'Seule tentative.' },
        { uci: 'h4g5', comment: 'Ton pion h prend en g5 : tu es de nouveau devant.' },
        { uci: 'b4c5', comment: 'Le roi noir est trop loin, au bout de l’échiquier.' },
        { uci: 'f7g7', comment: 'Ton roi mange tout sur la 7e rangée : le pion h7 est perdu.' },
        { uci: 'h7h6', comment: 'Les Noirs tentent de sauver ce qui peut l’être.' },
        {
          uci: 'g5h6',
          comment:
            'Deux pions passés, g et h, soutenus par le roi, contre un roi noir sorti du jeu : la partie est gagnée.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '4k3/5ppp/8/8/P7/8/5PPP/4K3 w - - 0 1',
      prompt: 'Désigne le pion passé éloigné.',
      mode: 'squares',
      solution: [],
      squares: ['a4'],
      hints: [
        'Un pion passé n’a aucun pion adverse devant lui, ni sur sa colonne ni sur les colonnes voisines.',
        'Regarde les ailes : un seul pion est loin des autres.',
        'C’est le pion a4.',
      ],
      explanation:
        'Le pion a4 est passé (aucun pion noir en a ni en b) et éloigné des pions de l’aile roi. Les pions f, g et h ne ' +
        'sont pas passés : ils se font face.',
    },
    {
      fen: '8/5pp1/8/8/Pk6/6K1/5PP1/8 w - - 0 1',
      prompt: 'Ton pion a4 est attaqué. Que fais-tu ?',
      mode: 'engine',
      solution: ['g3f4'],
      tolerance: 10,
      traps: ['g3g4', 'g3f3', 'f2f4'],
      hints: [
        'Peux-tu défendre le pion a4 avec ton roi ? Et en vaut-il la peine ?',
        'Le pion est un appât : où ton roi doit-il aller plutôt ?',
        'Rf4 : le roi file vers l’aile roi, le pion a4 tombera.',
      ],
      explanation:
        'Rf4 ! Le roi noir mange le pion, mais ton roi arrive sur les pions f et g avant lui. Les autres coups laissent ' +
        'le roi noir revenir à temps : nulle.',
    },
    {
      fen: '8/5pp1/8/8/P6K/1k6/5PP1/8 w - - 0 1',
      prompt:
        'Cette fois ton pion peut courir : le roi noir est à côté mais il est en retard. Que joues-tu ?',
      mode: 'engine',
      solution: ['a4a5'],
      tolerance: 10,
      traps: ['h4g4', 'f2f4', 'h4g5'],
      hints: [
        'Le roi noir est en b3, à deux colonnes de l’aile a, mais le pion est loin d’être arrêté.',
        'Un pion passé doit être poussé quand le roi adverse ne peut pas le prendre.',
        'a5 !',
      ],
      explanation:
        'a5 ! Le pion avance d’un cran, hors de portée du roi noir (il ne peut pas l’attaquer tout de suite), et tu ' +
        'gardes l’initiative. Un coup de roi donnerait aux Noirs le temps de prendre le pion et de revenir.',
    },
    {
      fen: '4k3/p4ppp/8/8/8/8/5PPP/4K3 b - - 0 1',
      prompt: 'Cette fois, c’est un pion noir qui est passé et éloigné. Clique sur lui.',
      mode: 'squares',
      solution: [],
      squares: ['a7'],
      hints: [
        'Le même raisonnement vaut pour les Noirs.',
        'Cherche le pion qui n’a plus aucun pion blanc devant lui.',
        'C’est le pion a7.',
      ],
      explanation:
        'Les Blancs n’ont aucun pion en a ni en b : le pion a7 est passé, et loin de l’aile roi où se trouvent tous les ' +
        'autres pions. C’est maintenant le roi blanc qui doit s’en soucier.',
    },
    {
      fen: '8/5pp1/8/8/Pk6/8/2K2PP1/8 w - - 0 1',
      prompt: 'Le roi noir attaque ton pion a4. Défends-tu ? Joue le bon coup de roi.',
      mode: 'engine',
      solution: ['c2d3'],
      tolerance: 10,
      traps: ['c2d2', 'a4a5', 'c2d1'],
      hints: [
        'Le pion a4 est loin et mal protégé : le défendre coûte du temps.',
        'Ton roi doit aller vers le centre et l’aile roi, pas vers le pion.',
        'Rd3, puis Re4.',
      ],
      explanation:
        'Rd3 ! Le roi file vers le centre : si les Noirs prennent a4, ton roi est déjà devant leurs pions f et g. ' +
        'a5 ? et les coups de roi passifs laissent le roi noir revenir à temps.',
    },
  ],
};

const PERCEE: Lesson = {
  id: 'fin-percee',
  phase: 2,
  title: 'La percée de pions',
  summary:
    'Trois pions contre trois : en sacrifiant le pion central, tu ouvres la voie à un pion passé.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Les pions blancs a5, b5, c5 font face aux pions noirs a7, b7, c7. Personne ne peut avancer sans perdre un pion. ' +
        'Pourtant les Blancs gagnent. **Question : que se passe-t-il si tu offres un pion pour ouvrir une colonne ?** ' +
        'C’est la **percée** : tu sacrifies un ou deux pions pour qu’un des tiens devienne passé.\n\n' +
        'Avec trois pions contre trois côte à côte, le pion du **milieu** avance en premier : b6 !',
    },
    {
      kind: 'example',
      fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
      caption:
        'Après b6, les Noirs ont deux réponses. 1…axb6 2.c6 ! (le pion c file) ; 1…cxb6 2.a6 ! (le pion a file). ' +
        'Dans les deux cas, un pion noir est détourné et un pion blanc devient passé.',
      arrows: [['b5', 'b6']],
      marks: ['b6'],
    },
    {
      kind: 'text',
      title: 'Avant de sacrifier : calcule',
      body:
        '1. Combien de coups faut-il au pion passé pour promouvoir ? Le roi adverse peut-il l’arrêter ? Dans la position ' +
        'du diagramme, le roi noir est en g8, trop loin.\n' +
        '2. Si le roi adverse est proche (en b8, par exemple), la percée ne marche plus : il rattrape le pion et tu as ' +
        'perdu deux pions pour rien.\n' +
        '3. La percée fonctionne aussi sur l’aile roi, avec f5, g5, h5 contre f7, g7, h7 : g6 !',
    },
    {
      kind: 'walkthrough',
      title: 'Deux pions pour une dame',
      fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
      moves: [
        {
          uci: 'b5b6',
          comment: 'Le sacrifice du pion central. Il ouvre une colonne devant a5 et c5.',
        },
        {
          uci: 'a7b6',
          comment:
            'Si les Noirs prennent avec a7, la colonne a est dégagée pour le pion blanc ; s’ils prennent avec c7, ce sera la colonne c.',
        },
        {
          uci: 'c5c6',
          comment:
            'Deuxième sacrifice : le pion c6 menace c6xb7. Si les Noirs l’ignorent, cxb7 et le pion b promeut.',
        },
        {
          uci: 'b7c6',
          comment:
            'Les Noirs prennent avec b7, la seule capture : il ne reste aucun pion noir pour garder la colonne a.',
        },
        {
          uci: 'a5a6',
          comment:
            'Voilà le pion passé : aucun pion noir ne peut plus l’arrêter. Il reste à vérifier la course avec le roi noir.',
        },
        {
          uci: 'g8f7',
          comment: 'Le roi noir court vers le pion, mais il est à six colonnes de a8.',
        },
        { uci: 'a6a7', comment: 'Le pion arrive en 7e rangée.' },
        { uci: 'f7e7', comment: 'Le roi noir est encore loin de b8 et de a8.' },
        { uci: 'a7a8q', comment: 'Promotion : la percée a réussi.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
      prompt: 'Quel pion blanc faut-il sacrifier en premier ? Clique sur lui.',
      mode: 'squares',
      solution: [],
      squares: ['b5'],
      hints: [
        'Tu veux ouvrir une colonne devant deux de tes pions.',
        'Le sacrifice doit servir les deux pions voisins.',
        'C’est le pion du milieu, b5.',
      ],
      explanation:
        'Le pion b5 est en contact avec a7 et c7 ; en avançant, il laisse les deux pions voisins en prise de la colonne ' +
        'ouverte. Un sacrifice de a5 ou c5 ne laisse que la moitié du travail.',
    },
    {
      fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Trouve la percée.',
      mode: 'engine',
      solution: ['b5b6'],
      tolerance: 5,
      traps: ['c5c6', 'a5a6', 'g1f2'],
      hints: [
        'Quel pion peut avancer pour être capturé et ouvrir le jeu des deux côtés ?',
        'C’est le pion central qui avance d’une case.',
        'b6 !',
      ],
      explanation:
        'b6 ! Les Noirs prennent avec a7 ou c7 et un pion blanc devient passé. c6 ? et a6 ? se heurtent à un pion noir ' +
        'qui reste en place, et le roi noir arrive à temps.',
    },
    {
      fen: '6k1/1pp5/1p6/P1P5/8/8/8/6K1 w - - 0 1',
      prompt: 'Les Noirs ont repris avec a7 (1.b6 axb6). Continue la percée.',
      mode: 'exact',
      solution: ['c5c6', 'b7c6', 'a5a6'],
      hints: [
        'Quel pion peut maintenant se sacrifier pour libérer la colonne a ?',
        'Le pion c avance en c6 : il menace c6xb7.',
        'c6, bxc6 et a6.',
      ],
      explanation:
        'c6 ! attire le pion b7 : après bxc6, la colonne a est vide et a6 est imparable (et si les Noirs ignorent ' +
        'c6, cxb7 promeut).',
    },
    {
      fen: '6k1/pp6/1p6/P1P5/8/8/8/6K1 w - - 0 1',
      prompt:
        'Cette fois les Noirs ont repris avec c7 (1.b6 cxb6). Quel est le deuxième sacrifice ?',
      mode: 'exact',
      solution: ['a5a6', 'b7a6', 'c5c6'],
      hints: [
        'Le pion c peut passer si la colonne c est libre : quel pion noir la garde ?',
        'Le pion a avance en a6 : il attire le pion b7.',
        'a6, bxa6 et c6.',
      ],
      explanation:
        'a6 ! attire le pion b7 vers la colonne a : le pion c5 file sans obstacle. En miroir de l’autre réponse.',
    },
    {
      fen: '1k6/5ppp/8/5PPP/8/8/8/1K6 w - - 0 1',
      prompt: 'Même idée sur l’aile roi. Quel est le sacrifice ?',
      mode: 'engine',
      solution: ['g5g6'],
      tolerance: 5,
      traps: ['f5f6', 'h5h6'],
      hints: [
        'Trois pions contre trois : lequel avance en premier ?',
        'Toujours le pion du milieu.',
        'g6 !',
      ],
      explanation: 'g6 ! ouvre la voie des deux côtés. f6 ? ou h6 ? sont repris sans contrepartie.',
    },
    {
      fen: '1k6/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
      prompt:
        'Le roi noir est en b8, tout près du pion qui deviendrait passé. Faut-il quand même sacrifier ?',
      mode: 'engine',
      solution: ['g1f2'],
      tolerance: 5,
      traps: ['b5b6', 'c5c6'],
      hints: [
        'Après b6, un pion deviendra passé. Qui l’arrête ?',
        'Le roi noir est en b8 : il rattrape le pion passé facilement.',
        'Ne sacrifie pas : amène ton roi, par exemple Rf2.',
      ],
      explanation:
        'Rf2. Avec le roi noir si près, la percée ne marche pas : b6? perd deux pions, car le pion passé est capturé par le ' +
        'roi. Avant de sacrifier, on compte toujours les coups du roi adverse.',
    },
  ],
};

const ROI_ACTIF: Lesson = {
  id: 'fin-roi-actif',
  phase: 2,
  title: 'Le roi actif',
  summary:
    'En finale, le roi est une pièce de combat : centralise-le, attaque les pions, entre chez l’adversaire.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Au milieu de jeu, le roi se cache. En finale, il n’y a presque plus de pièces pour l’attaquer. ' +
        '**Que vaut alors le roi ?** Autant qu’une pièce mineure. Trois habitudes :\n' +
        '1. **Au centre** (d4, e4, d5, e5), il surveille les deux ailes.\n' +
        '2. **Vers les pions faibles** de l’adversaire : un pion isolé ou non protégé est une cible.\n' +
        '3. **Avant de pousser les pions** : un roi passif attend, un roi actif gagne un temps à chaque coup.',
    },
    {
      kind: 'example',
      fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
      caption:
        'Les deux rois sont à égalité de matériel, mais le roi blanc est au centre et attaque le pion c5. Re5-d5 ' +
        'prendra c5, quand le roi noir n’a que le choix de se replier.',
      arrows: [
        ['e5', 'd5'],
        ['d5', 'c5'],
      ],
      marks: ['c5'],
    },
    {
      kind: 'walkthrough',
      title: 'Le roi prend les pions',
      fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
      moves: [
        {
          uci: 'e5d5',
          comment:
            'Rd5 ! Le roi attaque c5 tout en gardant le roi noir à distance. Rf5 ou Re4 ne font que perdre du temps.',
        },
        { uci: 'f7e7', comment: 'Le roi noir tente de revenir, mais il est en retard d’un temps.' },
        {
          uci: 'd5c5',
          comment:
            'Le roi blanc mange le pion c5, et se place devant son pion c4 : il aura bientôt la case clé c6.',
        },
        { uci: 'e7f8', comment: 'Le roi noir recule.' },
        {
          uci: 'c5c6',
          comment: 'Rc6 : case clé du pion c4. Le pion passera, quoi que fasse le roi noir.',
        },
        { uci: 'f8e7', comment: 'Le roi noir reste sur la 7e rangée.' },
        { uci: 'c4c5', comment: 'Maintenant le pion avance, protégé par le roi.' },
        { uci: 'e7f8', comment: 'Les Noirs reculent encore.' },
        {
          uci: 'c6c7',
          comment: 'Le roi blanc passe devant son pion : la promotion en c8 est imparable.',
        },
      ],
    },
    {
      kind: 'text',
      title: 'Et quand c’est l’adversaire qui est actif ?',
      body:
        'Retiens le contraire : un roi qui reste dans le coin laisse l’adversaire entrer. Si ton roi est loin, **rapproche-le ' +
        'du centre immédiatement**, même si ça demande un pion : un roi actif vaut souvent un pion.',
    },
  ],
  exercises: [
    {
      fen: '8/5k2/8/8/8/8/8/6K1 w - - 0 1',
      prompt: 'Désigne les quatre cases centrales, où un roi est le plus actif.',
      mode: 'squares',
      solution: [],
      squares: ['d4', 'e4', 'd5', 'e5'],
      hints: [
        'Pense à d’où le roi voit les deux ailes.',
        'Ce sont les quatre cases du milieu de l’échiquier.',
        'd4, e4, d5 et e5.',
      ],
      explanation:
        'Du centre, le roi atteint n’importe quelle aile en trois coups. C’est là qu’il faut le conduire en finale.',
    },
    {
      fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Où va ton roi ?',
      mode: 'engine',
      solution: ['e5d5'],
      tolerance: 5,
      traps: ['e5f5', 'e5e4', 'e5f4'],
      hints: [
        'Cherche un pion adverse que ton roi peut attaquer.',
        'Le pion c5 n’est protégé par rien : va l’attaquer.',
        'Rd5 (ou Rd6) : le roi attaque c5.',
      ],
      explanation:
        'Rd5 ! attaque c5, protège ton pion c4 et gagne des temps. Rf5 ? ou Re4 ? ne menacent rien : le roi noir se replie sur la ' +
        'défense et la partie est nulle.',
    },
    {
      fen: '8/5k2/8/2p5/2P5/4K3/8/8 b - - 0 1',
      prompt:
        'Avec les Noirs, tiens la nulle : les deux rois sont encore loin du centre. Où va ton roi ?',
      mode: 'engine',
      solution: ['f7e6'],
      tolerance: 5,
      traps: ['f7g6', 'f7g7'],
      hints: [
        'Le roi blanc va aller vers le centre. Que dois-tu faire en premier ?',
        'N’aille pas vers la colonne g : le roi blanc entrerait à gauche.',
        'Re6 (ou Re7, Rf6) : le roi va vers le centre.',
      ],
      explanation:
        'Re6 ! Ton roi défend ses pions et empêche le roi blanc d’entrer en d5 ou en f5. Rg6 ? et Rg7 ? s’éloignent du ' +
        'centre : le roi blanc arrive en d5 et gagne le pion c5.',
    },
    {
      fen: '8/5k2/8/2p1K3/2P5/8/8/8 w - - 0 1',
      prompt: 'Les Blancs jouent. Quel premier coup de roi gagne ?',
      mode: 'choice',
      solution: ['e5d5'],
      accepted: ['e5d5', 'e5d6'],
      hints: [
        'Le roi doit attaquer le pion c5.',
        'Deux cases touchent le pion c5 : une seule est sûre.',
        'Rd5 ou Rd6.',
      ],
      explanation:
        'Rd5 et Rd6 attaquent c5 et gagnent. Rd4 est impossible (le pion c5 contrôle d4), et les autres coups laissent nulle.',
    },
    {
      fen: '8/5p2/3p4/4K3/8/8/8/6k1 w - - 0 1',
      prompt: 'Quel pion noir ton roi attaque-t-il ? Clique sur lui.',
      mode: 'squares',
      solution: [],
      squares: ['d6'],
      hints: [
        'Le roi blanc attaque les pions des cases qui l’entourent.',
        'Cherche un pion noir adjacent au roi e5.',
        'Le pion d6 est attaqué, et il n’est pas protégé.',
      ],
      explanation:
        'Le roi e5 touche d6, que ni le pion f7 (il protège e6 et g6) ni le roi g1 ne défendent : Rxd6 gagne un pion.',
    },
  ],
};

const LUCENA: Lesson = {
  id: 'fin-lucena',
  phase: 2,
  title: 'La position de Lucena',
  summary: 'Pion en 7e rangée, roi devant lui, roi adverse coupé : la tour construit un pont.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Tu as une tour et un pion de plus. Le pion est en 7e rangée, ton roi est devant lui, sur la case de promotion. ' +
        'Le roi adverse est coupé du pion par ta tour. **Question : pourquoi ne gagnes-tu pas simplement en ' +
        'poussant le pion ?** Parce que ton roi bloque la case de promotion, et que chaque fois qu’il sortira, la tour ' +
        'adverse lui donnera échec.\n\n' +
        'Il faut donc **sortir le roi de son abri**, avec une tour qui l’abrite des échecs : c’est le **pont**.',
    },
    {
      kind: 'example',
      fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
      caption:
        'Position de Lucena. Le pion b7 est en 7e rangée, le roi b8 devant lui. La tour c1 coupe le roi noir : il ne peut ' +
        'pas passer en colonne c. Le pion n’est pas un pion de tour : c’est la condition pour que la méthode marche.',
      marks: ['b7', 'b8', 'c1'],
    },
    {
      kind: 'text',
      title: 'La méthode en quatre temps',
      body:
        '1. **Chasse** le roi noir de la colonne voisine par un échec de tour (Td1+) : il s’éloigne du pion.\n' +
        '2. **Pont** : la tour se pose sur la 4e rangée (Td4), assez loin du roi noir.\n' +
        '3. **Sors** le roi (Rc7) vers la rangée de la tour, en avançant d’échec en échec.\n' +
        '4. Quand il arrive sur la rangée du pont, tu **interposes** la tour : Tb4 ! Après la capture, le roi reprend et le ' +
        'pion promeut.',
    },
    {
      kind: 'walkthrough',
      title: 'Du pont à la dame',
      fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
      moves: [
        {
          uci: 'c1d1',
          comment:
            'Échec sur la colonne d : le roi noir est repoussé loin de la colonne c, il ne peut plus gêner le pion.',
        },
        { uci: 'd8e7', comment: 'Le roi noir s’écarte (Re8 est possible aussi).' },
        {
          uci: 'd1d4',
          comment:
            'Le pont : la tour est en 4e rangée. Plus tard, elle s’interposera sur la colonne b, quand le roi s’y abritera.',
        },
        {
          uci: 'a2a1',
          comment: 'Les Noirs préparent des échecs : leur tour se place sur la 1re rangée.',
        },
        {
          uci: 'b8c7',
          comment:
            'Le roi sort de son abri, et menace b8=D. Les Noirs n’ont qu’une ressource : les échecs.',
        },
        { uci: 'a1c1', comment: 'Échec sur la colonne c.' },
        {
          uci: 'c7b6',
          comment: 'Le roi s’abrite derrière son pion, en descendant vers la tour d4.',
        },
        { uci: 'c1b1', comment: 'Échec sur la colonne b : le pion b7 est attaqué.' },
        { uci: 'b6c6', comment: 'Le roi défend le pion b7 en sortant de la colonne b.' },
        { uci: 'b1c1', comment: 'Les Noirs donnent échec à nouveau.' },
        {
          uci: 'c6b5',
          comment: 'Le roi arrive sur la 5e rangée : il touche la rangée de la tour.',
        },
        { uci: 'c1b1', comment: 'Dernier échec utile : sur la colonne b.' },
        {
          uci: 'd4b4',
          comment:
            'Le pont ! La tour s’interpose sur la colonne b, protégée par le roi. Plus aucun échec n’est possible.',
        },
        {
          uci: 'b1b4',
          comment: 'Les Noirs prennent la tour (sinon le pion b8 promeut sans résistance).',
        },
        {
          uci: 'b5b4',
          comment: 'Le roi reprend. Le pion b7 promeut : roi et dame contre roi, c’est gagné.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '1K6/1P2k3/8/8/3R4/8/8/r7 w - - 0 1',
      prompt: 'Où se trouve la tour qui sert de pont ? Clique sur sa case.',
      mode: 'squares',
      solution: [],
      squares: ['d4'],
      hints: [
        'Le pont se construit sur une rangée précise.',
        'Cette rangée est la 4e, loin du roi noir.',
        'La tour blanche est en d4.',
      ],
      explanation:
        'La tour d4 est sur la 4e rangée : elle pourra s’interposer en b4 quand le roi blanc arrivera en b5 et que la tour ' +
        'noire donnera échec depuis la colonne b.',
    },
    {
      fen: '1K2k3/1P6/8/8/8/8/r7/3R4 w - - 0 1',
      prompt: 'Les Noirs viennent de jouer Re7. Construis le pont.',
      mode: 'engine',
      solution: ['d1d4'],
      tolerance: 5,
      traps: ['d1d2'],
      hints: [
        'Ta tour ne doit pas rester sur la 1re rangée, où les échecs la gênent.',
        'La rangée du pont est la 4e.',
        'Td4.',
      ],
      explanation:
        'Td4 ! met la tour sur la 4e rangée, hors de portée du roi noir. Td2 ? se laisse prendre par la tour a2 : tout ' +
        'est perdu.',
    },
    {
      fen: '8/1P2k3/1K6/8/3R4/8/8/1r6 w - - 0 1',
      prompt: 'La tour noire donne échec depuis b1. Comment sors-tu du jeu d’échecs ?',
      mode: 'engine',
      solution: ['b6c6'],
      tolerance: 5,
      traps: ['b6a5', 'b6c5'],
      hints: [
        'Le roi doit quitter la colonne b, mais pas pour n’importe quelle case : il doit défendre le pion b7.',
        'Quelles cases protègent b7 ? Regarde la 6e rangée.',
        'Rc6 (ou Ra6).',
      ],
      explanation:
        'Rc6 ! sort de la colonne b tout en défendant b7. Ra5 ? et Rc5 ? abandonnent la défense du pion : la tour noire ' +
        'le prend, et la finale est nulle.',
    },
    {
      fen: '8/1P2k3/8/1K6/3R4/8/8/1r6 w - - 0 1',
      prompt: 'Le roi est en b5, la tour noire donne échec. Termine la construction.',
      mode: 'engine',
      solution: ['d4b4'],
      tolerance: 5,
      traps: ['b5c5', 'b5a5'],
      hints: [
        'Ton roi ne peut plus se cacher en avançant : il lui faut un abri.',
        'La tour d4 est sur la 4e rangée : elle peut aller sur la colonne b.',
        'Tb4 !',
      ],
      explanation:
        'Tb4 ! interpose la tour, protégée par le roi. Les Noirs la prennent (Txb4+) et Rxb4 mène à la promotion. Rc5 ? ou ' +
        'Ra5 ? laissent la tour noire continuer à donner échec.',
    },
    {
      fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
      prompt: 'Joue la méthode complète : chasse, pont, sortie du roi, interposition.',
      mode: 'exact',
      solution: [
        'c1d1',
        'd8e7',
        'd1d4',
        'a2a1',
        'b8c7',
        'a1c1',
        'c7b6',
        'c1b1',
        'b6c6',
        'b1c1',
        'c6b5',
        'c1b1',
        'd4b4',
      ],
      hints: [
        'Premier coup : un échec qui éloigne le roi noir.',
        'Ensuite, la tour descend en 4e rangée (le pont), et le roi marche vers elle.',
        'Td1+, Td4, puis Rc7-b6-c6-b5 et enfin Tb4.',
      ],
      explanation:
        'Td1+ chasse le roi noir, Td4 construit le pont, le roi sort en avançant vers la 5e rangée, et Tb4 termine : ' +
        'c’est la position de Lucena de la théorie.',
    },
  ],
};

const PHILIDOR: Lesson = {
  id: 'fin-philidor',
  phase: 2,
  title: 'La défense de Philidor',
  summary: 'Tour sur la 6e rangée, roi devant le pion ; quand le pion avance, échecs par derrière.',
  minutes: 20,
  sections: [
    {
      kind: 'text',
      body:
        'Tu défends une finale de tours avec un pion de moins : le pion e5 est soutenu par son roi et sa tour. **Question : ' +
        'comment empêcher le roi blanc de monter vers ton roi ?** Ta tour se place sur la **6e rangée** : le roi blanc ne ' +
        'peut pas la traverser, et le pion non plus tant que la tour la garde.\n\n' +
        'Cela donne trois consignes :\n' +
        '1. **Ton roi** reste sur la 8e rangée, devant le pion (e8, d8 ou f8).\n' +
        '2. **Ta tour** garde la 6e rangée, loin du roi blanc, hors de portée de son pion.\n' +
        '3. **Quand le pion avance en e6**, il quitte la zone gardée : la tour passe **derrière** lui et donne des ' +
        'échecs de loin.',
    },
    {
      kind: 'example',
      fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
      caption:
        'Position de départ du chapitre. Le roi noir est en e8, la tour b6 garde la 6e rangée : le roi f5 ne peut pas ' +
        'aller en e6, f6 ou g6. Si la tour noire quitte la 6e rangée trop tôt (Tb1 ? Rd... ), les Blancs passent.',
      marks: ['e8', 'b6'],
    },
    {
      kind: 'text',
      title: 'Les échecs par derrière',
      body:
        'Pourquoi ça marche ? Parce que le roi blanc, devant son pion, n’a **aucun abri contre les échecs**. S’il se ' +
        'cache derrière le pion, la tour noire change de côté ; s’il monte, elle donne échec de plus loin encore. ' +
        'Ta tour doit rester **loin du roi** : si elle est trop près, il la chasse en gagnant un temps.',
    },
    {
      kind: 'walkthrough',
      title: 'Tenir la 6e rangée, puis passer derrière',
      fen: '4k3/8/r7/3KP3/8/8/8/7R w - - 0 1',
      moves: [
        { uci: 'h1h7', comment: 'Les Blancs prennent la 7e rangée pour préparer e6.' },
        {
          uci: 'e8d8',
          comment:
            'Le roi noir reste sur la 8e rangée, la tour a6 garde toujours la 6e. Rien n’est possible pour les Blancs.',
        },
        { uci: 'e5e6', comment: 'Le pion franchit la 6e rangée : il est protégé par le roi.' },
        {
          uci: 'a6a2',
          comment:
            'Maintenant la tour passe derrière : elle donne des échecs à longue distance, où le roi blanc ne trouve pas d’abri.',
        },
        {
          uci: 'd5e5',
          comment: 'Le roi blanc tente de sortir des échecs en changeant de colonne.',
        },
        { uci: 'a2d2', comment: 'La tour suit le roi sur la 2e rangée.' },
        { uci: 'e5f6', comment: 'Le roi s’approche du pion.' },
        {
          uci: 'd2f2',
          comment: 'Échec ! La tour garde la distance, et le roi blanc doit encore bouger.',
        },
        {
          uci: 'f6e5',
          comment: 'Le roi revient sur ses pas : les échecs vont se répéter, c’est nulle.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '4k3/6R1/r7/4PK2/8/8/8/8 b - - 0 1',
      prompt: 'Désigne les cases de la 6e rangée où ta tour est en sécurité.',
      mode: 'squares',
      solution: [],
      squares: ['a6', 'b6', 'c6', 'h6'],
      hints: [
        'Une case est sûre si ni le roi f5, ni le pion e5, ni la tour g7 ne la contrôle.',
        'Le roi touche e6, f6 et g6 ; le pion garde d6 et f6 ; la tour contrôle la colonne g.',
        'Les cases sûres sont a6, b6, c6 et h6.',
      ],
      explanation:
        'd6 est prise par le pion e5, e6, f6 et g6 par le roi (et f6 par le pion, g6 par la tour) : la tour y serait ' +
        'capturée. Elle peut rester en a6, b6, c6 ou h6.',
    },
    {
      fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
      prompt: 'Position de départ du chapitre. Garde la 6e rangée sans mettre ta tour en danger.',
      mode: 'engine',
      solution: ['b6h6'],
      tolerance: 5,
      traps: ['b6b5', 'b6e6'],
      hints: [
        'Ta tour doit rester sur la 6e rangée, mais pas à portée du roi ni du pion.',
        'Une case de la 6e rangée loin du roi f5 : a6, c6 ou h6 conviennent.',
        'Th6 (Ta6 ou Tc6 aussi).',
      ],
      explanation:
        'Th6 ! (ou Ta6, Tc6) garde la 6e rangée. Tb5+ ? te laisse sans la 6e rangée, et Te6 ? se fait capturer par le ' +
        'roi f5 : dans les deux cas le roi blanc passe.',
    },
    {
      fen: '4k3/8/r7/3KP3/8/8/8/6R1 b - - 0 1',
      prompt: 'La tour blanche est en g1. Quel coup choisis-tu ?',
      mode: 'engine',
      solution: ['a6b6'],
      tolerance: 5,
      traps: ['a6a1', 'a6a8'],
      hints: [
        'Le pion est encore en e5 : peut-on déjà quitter la 6e rangée ?',
        'Non : la tour doit rester sur la 6e rangée tant que le pion n’a pas avancé.',
        'Tb6 (ou Ta5+).',
      ],
      explanation:
        'Tb6 ! garde la 6e rangée. Ta1 ? et Ta8 ? quittent la 6e rangée trop tôt : le roi blanc passe en d6 ou e6 et la ' +
        'finale est perdue.',
    },
    {
      fen: '4k3/8/r7/4PK2/8/8/8/6R1 b - - 0 1',
      prompt: 'Même idée : le pion est toujours en e5. Où va ta tour ?',
      mode: 'engine',
      solution: ['a6h6'],
      tolerance: 5,
      traps: ['a6a1', 'a6a5'],
      hints: [
        'Ta tour garde la 6e rangée, mais le roi f5 contrôle e6, f6 et g6.',
        'Reste loin du roi, sur la 6e rangée.',
        'Th6 (ou Ta6, Tb6 sont aussi possibles).',
      ],
      explanation:
        'Th6 ! reste sur la 6e rangée, hors de portée du roi. Ta1 ? quitte la 6e rangée, Ta5+ ? ne mène à rien : le ' +
        'roi blanc passe en e6 et gagne.',
    },
    {
      fen: '4k3/6R1/r3P3/3K4/8/8/8/8 b - - 0 1',
      prompt: 'Le pion vient d’avancer en e6. Que fait ta tour ?',
      mode: 'engine',
      solution: ['a6a1'],
      tolerance: 5,
      hints: [
        'Le pion a franchi la 6e rangée : ta tour a un autre rôle.',
        'Elle doit aller donner des échecs de loin.',
        'Ta1 (ou Ta2, Ta5+) : la tour passe derrière.',
      ],
      explanation:
        'Ta1 ! La tour donne ses échecs par derrière : le roi blanc n’a pas d’abri et le pion e6 est bloqué par le roi noir. ' +
        'C’est la défense de Philidor, nulle.',
    },
  ],
};

const TOUR_DERRIERE: Lesson = {
  id: 'fin-tour-derriere',
  phase: 2,
  title: 'La tour derrière le pion passé',
  summary: 'Derrière ton pion passé comme derrière celui de l’adversaire : la règle de Tarrasch.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Il y a un pion passé sur l’échiquier, le tien ou celui de l’adversaire. **Où places-tu ta tour ?** ' +
        '**Derrière** lui (règle de Tarrasch), pour trois raisons :\n' +
        '1. Derrière ton pion, elle le soutient sur toute sa marche et **protège la case de promotion** : si on prend la ' +
        'dame, tu reprends.\n' +
        '2. Elle ne gêne pas ton roi, qui peut marcher devant.\n' +
        '3. Derrière le pion de l’adversaire, elle le bloque sans perdre de mobilité : plus il avance, plus la tour voit ' +
        'de cases.\n\n' +
        'Une tour **devant** son pion perd des cases à chaque pas du pion, et doit abandonner la défense du pion.',
    },
    {
      kind: 'example',
      fen: '8/3k4/7r/PK6/8/8/8/R7 w - - 0 1',
      caption:
        'Tour derrière le pion a5 : les Blancs gagnent (a6 !, puis a7). La tour a1 protège la case de promotion et les ' +
        'échecs noirs ne servent à rien.',
      marks: ['a1', 'a5'],
    },
    {
      kind: 'example',
      fen: 'R7/3k4/7r/PK6/8/8/8/8 w - - 0 1',
      caption:
        'Même position, mais la tour blanche est devant le pion, en a8 : les Noirs font nulle. La tour gêne son propre ' +
        'pion et laisse la tour noire attaquer par derrière.',
      marks: ['a8', 'a5'],
    },
    {
      kind: 'walkthrough',
      title: 'La tour protège la case de promotion',
      fen: '8/3k4/7r/PK6/8/8/8/R7 w - - 0 1',
      moves: [
        {
          uci: 'a5a6',
          comment:
            'Le pion avance : la tour a1 le soutient sur toute la colonne. Aucune autre tour ne pourrait le faire.',
        },
        { uci: 'd7c7', comment: 'Le roi noir se rapproche du pion.' },
        { uci: 'a6a7', comment: 'Le pion arrive en 7e rangée, la menace est a8=D.' },
        { uci: 'h6h5', comment: 'Les Noirs donnent échec pour gagner du temps.' },
        { uci: 'b5c4', comment: 'Le roi sort de l’échec en se dirigeant vers la tour noire.' },
        { uci: 'h5h4', comment: 'Un autre échec, sur la 4e rangée.' },
        { uci: 'c4c5', comment: 'Le roi remonte d’une rangée.' },
        { uci: 'h4h5', comment: 'Les Noirs répètent les échecs.' },
        { uci: 'c5d4', comment: 'Le roi change de rangée.' },
        { uci: 'h5h4', comment: 'Encore un échec.' },
        { uci: 'd4e5', comment: 'Le roi se rapproche de la colonne h.' },
        { uci: 'h4h5', comment: 'Les Noirs donnent un dernier échec.' },
        { uci: 'e5f6', comment: 'Le roi est enfin hors d’atteinte des échecs latéraux.' },
        {
          uci: 'h5h8',
          comment: 'Les Noirs placent la tour sur la 8e rangée pour contrôler a8.',
        },
        {
          uci: 'a7a8q',
          comment: 'Promotion ! La dame est protégée par la tour a1, derrière le pion.',
        },
        { uci: 'h8a8', comment: 'Les Noirs prennent la dame.' },
        { uci: 'a1a8', comment: 'La tour reprend : une tour de plus, la partie est gagnée.' },
      ],
    },
  ],
  exercises: [
    {
      fen: '7r/8/P4k2/8/7p/8/6K1/R7 w - - 0 1',
      prompt: 'Désigne les tours qui sont derrière leur pion passé.',
      mode: 'squares',
      solution: [],
      squares: ['a1', 'h8'],
      hints: [
        'Pour les Blancs, « derrière » veut dire sur une rangée plus basse ; pour les Noirs, plus haute.',
        'Regarde la colonne a, puis la colonne h.',
        'Les tours a1 et h8 sont derrière leurs pions.',
      ],
      explanation:
        'La tour a1 est sous le pion a6 (qui avance vers la 8e rangée). La tour h8 est au-dessus du pion noir h4 (qui ' +
        'avance vers la 1re rangée). Les deux soutiennent leur pion sur toute sa marche.',
    },
    {
      fen: '8/3k4/7r/PK6/8/8/8/R7 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Trouve le premier coup.',
      mode: 'engine',
      solution: ['a5a6'],
      tolerance: 5,
      traps: ['a1c1', 'a1a4'],
      hints: [
        'Ta tour est derrière le pion : elle est bien placée. Que dois-tu faire du pion ?',
        'Le pion ne doit pas attendre : le roi noir est trop loin.',
        'a6 !',
      ],
      explanation:
        'a6 ! pousse le pion, soutenu par la tour. Tc1 ? et Ta4 ? donnent du temps aux Noirs : le roi noir se rapproche et la ' +
        'finale est nulle.',
    },
    {
      fen: '8/P1k5/8/1K5r/8/8/8/R7 w - - 0 1',
      prompt: 'Échec de la tour noire. Où va ton roi ?',
      mode: 'engine',
      solution: ['b5c4'],
      tolerance: 5,
      traps: ['b5a4'],
      hints: [
        'Quel est ton plan pour échapper aux échecs sans perdre le pion a7 ?',
        'Le roi marche vers la tour noire, pas vers le pion : les échecs se ralentissent.',
        'Rc4 (ou Rb4).',
      ],
      explanation:
        'Rc4 ! Ton roi s’approche de la tour noire, hors de portée du roi noir. Ra4 ? reste sur la colonne a et bloque ' +
        'la tour a1, qui ne soutient plus le pion.',
    },
    {
      fen: '8/3k4/7r/PK6/8/8/8/R7 w - - 0 1',
      prompt: 'Joue le début : a6, a7 sans temps perdu.',
      mode: 'exact',
      solution: ['a5a6', 'd7c7', 'a6a7'],
      hints: [
        'Le pion avance, protégé par la tour.',
        'Après le coup du roi noir, continue.',
        'a6, puis a7.',
      ],
      explanation:
        'a6 puis a7 : le pion arrive en 7e rangée en deux coups. La tour a1 protège la case de promotion.',
    },
    {
      fen: '7r/8/3k4/P7/8/8/6K1/8 b - - 0 1',
      prompt:
        'Le pion blanc a5 est passé. Désigne les cases de la colonne a où ta tour serait derrière lui.',
      mode: 'squares',
      solution: [],
      squares: ['a1', 'a2', 'a3', 'a4'],
      hints: [
        'Le pion blanc avance vers la 8e rangée.',
        'Derrière lui, c’est sur une rangée plus basse.',
        'Les cases a1, a2, a3 et a4.',
      ],
      explanation:
        'Derrière un pion blanc, c’est sous lui : a1, a2, a3 ou a4. De là, ta tour attaque le pion sans jamais gêner ' +
        'l’avance du roi adverse, et chaque pas du pion rend la colonne plus longue.',
    },
  ],
};

const BON_FOU: Lesson = {
  id: 'fin-bon-fou',
  phase: 2,
  title: 'Fou et pion de tour : la couleur compte',
  summary: 'Le fou doit contrôler la case de promotion : sinon, le roi dans le coin fait nulle.',
  minutes: 15,
  sections: [
    {
      kind: 'text',
      body:
        'Un fou et un pion de tour contre le roi seul : gagné ou nulle ? **Question : de quelle couleur doit être le fou ?** ' +
        'De la couleur de la **case de promotion**. Pour le pion h blanc, c’est h8, une case sombre : un fou « de ' +
        'cases sombres » gagne. Le fou contrôle le coin, le roi noir ne s’y réfugie pas, et le pion passe.\n\n' +
        'Avec le fou de l’autre couleur, le roi noir va dans le coin et fait nulle (voir le chapitre sur les forteresses).',
    },
    {
      kind: 'example',
      fen: '7k/8/6K1/7P/8/8/8/2B5 w - - 0 1',
      caption:
        'Le fou c1 est sur une case sombre, comme h8 : c’est le bon fou. Le roi noir ne peut pas s’échapper et le mat ' +
        'arrive en cinq coups.',
      marks: ['h8', 'c1'],
    },
    {
      kind: 'text',
      title: 'Les pièges à éviter',
      body:
        'Le danger du bon fou est le **pat** : si le roi noir n’a aucune case et n’est pas en échec, la partie est nulle. ' +
        'Avant chaque coup, compte les cases du roi noir. Avec le pion en h7 et le roi en g6, le roi noir en h8 n’a aucune ' +
        'case : le mat doit venir du fou, par échec sur la diagonale.',
    },
    {
      kind: 'example',
      fen: '7k/7P/6K1/8/8/8/8/8 b - - 0 1',
      caption:
        'Pat : le roi noir n’est pas en échec, mais g8 (pion h7) et g7 (roi g6) lui sont interdites. Sans fou, ou avec un ' +
        'fou qui ne donne pas échec, la partie s’arrête là.',
      marks: ['g8', 'g7'],
    },
    {
      kind: 'walkthrough',
      title: 'Le fou donne le mat',
      fen: '7k/8/6K1/7P/8/8/8/2B5 w - - 0 1',
      moves: [
        {
          uci: 'c1a3',
          comment: 'Un coup tranquille du fou : il vise f8. Le roi noir en h8 n’a qu’une case, g8.',
        },
        { uci: 'h8g8', comment: 'Le roi noir est obligé d’aller en g8.' },
        {
          uci: 'h5h6',
          comment: 'Le pion avance : le roi noir peut retourner en h8 ou aller en f8.',
        },
        { uci: 'g8h8', comment: 'Le roi noir retourne dans le coin.' },
        {
          uci: 'a3d6',
          comment:
            'Le fou prend la diagonale d6-f8 : le roi noir n’a plus que g8 (f8 est prise). Il n’y a pas de pat, car g8 est libre.',
        },
        { uci: 'h8g8', comment: 'Seul coup.' },
        {
          uci: 'h6h7',
          comment: 'Le pion donne échec, et prive le roi noir de g8 : il ne peut aller qu’en h8.',
        },
        { uci: 'g8h8', comment: 'Seul coup : f8 est contrôlée par le fou.' },
        {
          uci: 'd6e5',
          comment:
            'Mat ! Le fou donne échec par la grande diagonale, g8 est prise par le pion, g7 par le roi et le fou.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '7k/8/6K1/7P/8/8/8/1BBBB3 w - - 0 1',
      prompt:
        'La case de promotion du pion h est h8. Désigne les fous qui sont « bons » (même couleur que h8).',
      mode: 'squares',
      solution: [],
      squares: ['c1', 'e1'],
      hints: [
        'La case h8 est sombre : un fou doit être sur une case sombre.',
        'a1 est sombre, b1 est claire, c1 est sombre, d1 est claire, e1 est sombre.',
        'Les fous c1 et e1.',
      ],
      explanation:
        'h8 est une case sombre, comme c1 et e1. Un fou posé sur b1 ou d1 (cases claires) ne contrôlera jamais la case de ' +
        'promotion.',
    },
    {
      fen: 'k7/8/1K6/P7/8/8/8/BBBB4 w - - 0 1',
      prompt: 'Cette fois, le pion est un pion a, il promeut en a8. Désigne les bons fous.',
      mode: 'squares',
      solution: [],
      squares: ['b1', 'd1'],
      hints: [
        'Quelle est la couleur de a8 ?',
        'a1 est sombre, donc a8 (sept rangées plus haut, même colonne) est claire.',
        'Les fous b1 et d1 (cases claires).',
      ],
      explanation:
        'Pour le pion a, la case de promotion est a8, une case claire : seuls les fous de cases claires, b1 et d1, gagnent. ' +
        'Le coin change selon le côté du pion.',
    },
    {
      fen: '6k1/8/3B2KP/8/8/8/8/8 w - - 0 1',
      prompt: 'Mat en 2 : un coup de pion, puis le fou.',
      mode: 'exact',
      solution: ['h6h7', 'g8h8', 'd6e5'],
      hints: [
        'Quel coup du pion donne échec ?',
        'h7+ : le roi noir n’a qu’une case. Où le fou donne-t-il alors échec ?',
        'h7+, Rh8, puis Fe5#.',
      ],
      explanation:
        'h7+ chasse le roi noir en h8, puis Fe5# : le fou donne échec par la diagonale, g8 est prise par le pion et g7 ' +
        'par le roi et le fou.',
    },
    {
      fen: '7k/7P/3B2K1/8/8/8/8/8 w - - 0 1',
      prompt: 'Mat en 1.',
      mode: 'exact',
      solution: ['d6e5'],
      hints: [
        'Le roi noir est en h8. Quelle diagonale mène à h8 ?',
        'C’est la grande diagonale a1-h8.',
        'Fe5#.',
      ],
      explanation:
        'Fe5# : le fou donne échec sur la grande diagonale, g8 est prise par le pion h7, g7 par le roi et le fou. Fe7 ou ' +
        'une autre case ne donnerait pas échec : pat.',
    },
    {
      fen: '7k/8/6K1/7P/8/8/8/2B5 w - - 0 1',
      prompt: 'Les Blancs jouent et gagnent. Trouve un bon premier coup, sans risque de pat.',
      mode: 'engine',
      solution: ['c1a3'],
      tolerance: 10,
      hints: [
        'Le roi noir n’a qu’une case. Ne le prive pas de la dernière.',
        'Un coup de fou tranquille convient.',
        'Fa3 (ou Fe3, Fb2+).',
      ],
      explanation:
        'Fa3 ! Le fou prépare Fd6 et le mat, sans rien enlever au roi noir. Tous les coups tranquilles du fou gagnent, à ' +
        'condition de laisser g8 au roi.',
    },
  ],
};

const FORTERESSE_FOU: Lesson = {
  id: 'fin-forteresse-fou',
  phase: 2,
  title: 'Le mauvais fou et la forteresse',
  summary:
    'Quand le fou n’est pas de la bonne couleur, le roi dans le coin tient : à reconnaître des deux côtés.',
  minutes: 18,
  sections: [
    {
      kind: 'text',
      body:
        'Une **forteresse**, c’est une position où le camp qui a l’avantage ne peut pas progresser, quoi qu’il fasse. ' +
        '**Question : peut-on être un fou de plus et ne pas gagner ?** Oui, quand le fou est de la mauvaise couleur : ' +
        'avec un pion de tour, le roi adverse tient dans le coin de promotion, que le fou ne contrôle jamais.\n\n' +
        'Retiens-le des deux côtés : si tu **défends**, vise le coin ; si tu **attaques**, ne gaspille pas ton fou en ' +
        'cherchant à tout prix la victoire, échange-le s’il le faut pour gagner une autre finale.',
    },
    {
      kind: 'example',
      fen: '7k/8/6K1/7P/8/8/8/5B2 b - - 0 1',
      caption:
        'Le fou f1 est sur une case claire. La case de promotion h8 est sombre : le fou ne l’attaquera jamais. Le roi noir ' +
        'reste en h8 ou g8, et les Blancs ne peuvent ni le mater ni le déloger.',
      marks: ['f1', 'h8'],
    },
    {
      kind: 'text',
      title: 'Pourquoi ça tient',
      body:
        'Le roi noir fait la navette entre h8 et g8. Si le pion arrive en h7 avec le roi en g6 et que le roi noir est en ' +
        'h8, il n’a plus aucune case : c’est pat. Si le roi blanc s’éloigne pour éviter le pat, le roi noir prend le ' +
        'pion. Dans tous les cas, nulle.\n\n' +
        'Ne confonds pas avec le « mauvais fou » du milieu de jeu (un fou gêné par ses propres pions) : ici, il s’agit ' +
        'de la couleur du fou par rapport à la case de promotion.',
    },
    {
      kind: 'walkthrough',
      title: 'Une nulle forcée : le pat dans le coin',
      fen: '7k/8/5K2/7P/8/8/8/5B2 w - - 0 1',
      moves: [
        {
          uci: 'f6g6',
          comment: 'Le roi blanc prend g7 et h7. Le roi noir n’a plus qu’une case : g8.',
        },
        { uci: 'h8g8', comment: 'Seul coup.' },
        { uci: 'h5h6', comment: 'Le pion avance ; le roi noir peut retourner en h8.' },
        { uci: 'g8h8', comment: 'Le roi noir retourne dans le coin, la seule case sûre.' },
        {
          uci: 'f1d3',
          comment:
            'Un coup d’attente du fou : il ne peut pas attaquer h8, case sombre. Le roi noir a encore g8.',
        },
        { uci: 'h8g8', comment: 'Seul coup : le roi noir revient en g8.' },
        {
          uci: 'h6h7',
          comment: 'Échec du pion. Le roi noir doit retourner en h8 : Rf8 ? perdrait.',
        },
        { uci: 'g8h8', comment: 'Seul coup, et le bon : la dame blanche ne naît jamais.' },
        {
          uci: 'd3f5',
          comment:
            'Quel que soit le coup du fou, le roi noir n’a plus de case et n’est pas en échec : pat. Les Blancs ne peuvent ' +
            'pas éviter la nulle.',
        },
      ],
    },
  ],
  exercises: [
    {
      fen: '7k/8/6K1/7P/8/8/8/5B2 w - - 0 1',
      prompt:
        'Le fou f1 est sur une case claire. Clique sur la case de promotion qu’il ne contrôlera jamais.',
      mode: 'squares',
      solution: [],
      squares: ['h8'],
      hints: [
        'Quelle est la case où le pion h doit promouvoir ?',
        'Le pion h blanc promeut en h8.',
        'h8, une case sombre.',
      ],
      explanation:
        'h8 est une case sombre ; le fou f1 ne quitte jamais les cases claires. C’est la clé de la forteresse.',
    },
    {
      fen: '6k1/8/5K2/7P/8/8/8/5B2 b - - 0 1',
      prompt:
        'Les Noirs jouent. Dans quel coin ton roi se réfugie-t-il pour tenir la nulle ? Clique sur la case.',
      mode: 'squares',
      solution: [],
      squares: ['h8'],
      hints: [
        'Le coin de promotion est celui que le fou ne contrôle pas.',
        'Le pion est sur la colonne h.',
        'h8.',
      ],
      explanation:
        'Rh8 ! Le roi noir se place dans le coin sombre : il n’en sortira plus, et le pion ne peut pas promouvoir.',
    },
    {
      fen: '6k1/7P/6K1/8/8/8/8/5B2 b - - 0 1',
      prompt: 'Le pion est en h7 et le roi noir est en échec. Où va ton roi ?',
      mode: 'choice',
      solution: ['g8h8'],
      accepted: ['g8h8'],
      hints: [
        'Une promotion en h8 est-elle possible si ton roi n’y est pas ?',
        'La case h8 doit rester occupée par ton roi.',
        'Rh8.',
      ],
      explanation:
        'Rh8 est le seul coup : Rf8 ? permet h8=D+, et le fou n’a pas besoin d’attaquer h8 puisque la dame promeut. Avec le roi ' +
        'en h8, les Blancs ne peuvent pas progresser.',
    },
    {
      fen: 'k7/8/1K6/P7/8/8/8/BBBB4 w - - 0 1',
      prompt: 'Le pion a promeut en a8, une case claire. Désigne les mauvais fous (cases sombres).',
      mode: 'squares',
      solution: [],
      squares: ['a1', 'c1'],
      hints: [
        'Quelle est la couleur de a8 ?',
        'a8 est une case claire : les mauvais fous sont sur des cases sombres.',
        'Les fous a1 et c1.',
      ],
      explanation:
        'Pour le pion a, la case a8 est claire : les fous de cases sombres (a1, c1) sont de la mauvaise couleur et ne ' +
        'gagnent pas.',
    },
    {
      fen: '7k/7P/6K1/8/8/8/8/5B2 b - - 0 1',
      prompt:
        'Le roi noir n’a aucune case et n’est pas en échec. Désigne les cases voisines du roi noir qui lui sont interdites.',
      mode: 'squares',
      solution: [],
      squares: ['g8', 'g7', 'h7'],
      hints: [
        'Le roi noir est en h8 : regarde ses trois voisines.',
        'g8 est attaquée par le pion h7, g7 par le roi g6.',
        'g8, g7 et h7 (le pion h7 est protégé par le roi).',
      ],
      explanation:
        'g8 est prise par le pion, g7 par le roi, et h7 est occupée par un pion protégé : c’est pat, donc nulle.',
    },
  ],
};

export const ENDGAMES_COURSE_2: Lesson[] = [
  OPPOSITION_DISTANCE,
  PASSE_ELOIGNE,
  PERCEE,
  ROI_ACTIF,
  LUCENA,
  PHILIDOR,
  TOUR_DERRIERE,
  BON_FOU,
  FORTERESSE_FOU,
];
