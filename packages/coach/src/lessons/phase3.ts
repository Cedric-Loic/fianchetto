import type { Lesson } from './types.js';

/*
 * Phase 3 du plan : « jouer avec un plan ». Dix leçons : activer ses pièces, cases faibles et
 * avant-postes, colonnes ouvertes, structures de pions (pion isolé, pion passé), le bon et le
 * mauvais fou, la prophylaxie, l’attaque contre le roque, la conversion d’un avantage et les
 * finales de tours pratiques. Les positions sont des positions de milieu de jeu typiques ; les
 * exercices « cases » sont calculés exactement (mobilité, pions, colonnes).
 */

export const PHASE_3: Lesson[] = [
  {
    id: 'activite-pieces',
    phase: 3,
    title: 'Activer sa pire pièce',
    summary: 'Quand rien ne presse, améliore la pièce qui sert le moins.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Dans une position calme, la question n’est pas « que puis-je attaquer ? » mais **« quelle est ma pire ' +
          'pièce ? »** Celle qui contrôle le moins de cases, qui regarde ses propres pions ou qui est restée au bord. ' +
          'Tant qu’elle ne joue pas, tu joues avec une pièce de moins.',
      },
      {
        kind: 'example',
        fen: 'r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/N3PN2/PP2BPPP/R2Q1RK1 w - - 0 1',
        caption:
          'Le cavalier a3 touche quatre cases dont aucune n’est utile. Cb5 ou Cc2 le rapprochent du jeu : ' +
          'c’est la pièce à améliorer, bien avant de pousser un pion.',
        arrows: [
          ['a3', 'b5'],
          ['a3', 'c2'],
        ],
        marks: ['a3'],
      },
      {
        kind: 'walkthrough',
        title: 'Une tour qui cherche sa colonne',
        fen: '2r2rk1/pp2bppp/4pn2/3p4/3P4/2N1PN2/PP2BPPP/R4RK1 w - - 0 1',
        moves: [
          {
            uci: 'a1c1',
            comment:
              'La tour a1 ne regardait que sa case : elle prend la colonne c, ouverte, face à la tour noire.',
          },
          {
            uci: 'a7a6',
            comment: 'Les Noirs prennent de l’espace, mais ne gênent pas le plan blanc.',
          },
          {
            uci: 'f1d1',
            comment: 'La seconde tour rejoint le centre : chaque pièce a désormais une tâche.',
          },
          {
            uci: 'f8d8',
            comment:
              'Les Noirs font de même ; la partie reste équilibrée, mais jouée avec toutes les pièces.',
          },
        ],
      },
      {
        kind: 'text',
        title: 'Ma méthode',
        body:
          '1. Compte, pièce par pièce, les cases qu’elle contrôle.\n' +
          '2. Choisis la plus mal placée.\n' +
          '3. Cherche la case où elle gênerait l’adversaire, puis le chemin pour l’y amener.\n' +
          '4. Vérifie que le déplacement ne laisse rien en prise.',
      },
    ],
    exercises: [
      {
        fen: 'r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/N3PN2/PP2BPPP/R2Q1RK1 w - - 0 1',
        prompt: 'Quelle est ta pire pièce ? Joue le coup qui l’améliore.',
        mode: 'engine',
        solution: ['a3b5'],
        tolerance: 6,
        traps: ['b2b4'],
        hints: [
          'Quelle pièce blanche touche le moins de cases ?',
          'Un cavalier au bord ne contrôle que la moitié de ses cases habituelles.',
          'Le cavalier a3 doit se rapprocher du centre.',
        ],
        explanation:
          'Cb5 (ou Cc2, Cb1) remet le cavalier en jeu. b4 ?, pour « gagner de l’espace », perd un pion : ' +
          'Fxb4.',
      },
      {
        fen: '2r2rk1/pp2bppp/4pn2/3p4/3P4/2N1PN2/PP2BPPP/R4RK1 w - - 0 1',
        prompt: 'La colonne c est ouverte et la tour noire l’occupe déjà. Active ta tour passive.',
        mode: 'engine',
        solution: ['a1c1'],
        tolerance: 5,
        traps: ['c3d5'],
        hints: [
          'Quelle tour ne regarde aucune colonne intéressante ?',
          'Une colonne ouverte est un chemin libre pour une tour.',
          'Tc1 prend la colonne c. Cxd5 ?, au contraire, ne gagne qu’un pion défendu.',
        ],
        explanation:
          'Tac1 conteste la colonne. Cxd5 ? exd5 : le pion d5 est défendu, et le cavalier est perdu pour un pion.',
      },
      {
        fen: 'r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 1',
        prompt: 'Le fou c1 est enfermé derrière tes pions. Trouve-lui une porte de sortie.',
        mode: 'engine',
        solution: ['b2b3'],
        tolerance: 5,
        traps: ['c3b5'],
        hints: [
          'Le fou c1 a une seule case : laquelle ?',
          'Un fou enfermé se libère en ouvrant une diagonale, pas en forçant le jeu.',
          'b3 prépare Fb2 ; ou Fd2 pour relier les tours.',
        ],
        explanation: 'b3 puis Fb2 donne au fou une diagonale. Cb5 ? lâche un cavalier : cxb5.',
      },
      {
        fen: 'r4rk1/pp3ppp/2p5/8/2P5/1P2P3/P4PPP/R2R2K1 w - - 0 1',
        prompt: 'La colonne d est à toi. Quel est le meilleur endroit pour ta tour ?',
        mode: 'choice',
        solution: ['d1d7'],
        accepted: ['d1d7', 'd1d6'],
        hints: [
          'Une tour active aime les rangées où l’adversaire a ses pions.',
          'Quelle est la 7e rangée pour les Blancs ?',
          'Td7 attaque b7 et f7.',
        ],
        explanation:
          'Td7 : la tour attaque deux pions à la fois depuis la 7e rangée, et rien ne peut la déloger. Td6 est ' +
          'aussi correct ; Ta1-c1 reste passif.',
      },
      {
        fen: 'r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Désigne les pièces blanches (tours, fous, cavaliers, dame) qui n’ont qu’un seul coup possible.',
        mode: 'squares',
        solution: [],
        squares: ['a1', 'c1', 'e2', 'f1'],
        hints: [
          'Compte les cases libres autour de chaque pièce, captures comprises.',
          'Ce sont les pièces entourées de leurs propres pions et pièces.',
          'Il y en a quatre : deux fous et deux tours.',
        ],
        explanation:
          'Ta1 (seulement b1), Fc1 (d2), Fe2 (d3) et Tf1 (e1) sont étouffées : tu peux les libérer avant de ' +
          'chercher quoi que ce soit d’autre.',
      },
    ],
  },
  {
    id: 'cases-faibles-avant-postes',
    phase: 3,
    title: 'Cases faibles et avant-postes',
    summary: 'Une case qu’aucun pion adverse ne peut plus défendre est un cadeau pour un cavalier.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un pion ne recule jamais. Donc, quand un pion a avancé ou disparu, **les cases qu’il gardait deviennent ' +
          'faibles** : plus aucun pion ne pourra les défendre. Avant de pousser un pion, demande-toi quelle case il ' +
          'cesse de garder ; avant de te lancer, demande-toi quelles cases adverses n’ont plus de gardien.',
      },
      {
        kind: 'example',
        fen: 'r2q1rk1/pb1n2pp/1pp1p3/4Np2/3P4/3B4/PPP1QPPP/R4RK1 w - - 0 1',
        caption:
          'Le cavalier e5 est un **avant-poste** : protégé par le pion d4, et aucun pion noir (d ou f) ne pourra ' +
          'jamais le chasser. Les Noirs n’ont qu’à l’échanger.',
        arrows: [['d4', 'e5']],
        marks: ['e5'],
      },
      {
        kind: 'text',
        title: 'Trois conditions',
        body:
          'Un bon avant-poste est :\n' +
          '1. **protégé** par un de tes pions ;\n' +
          '2. sur une case que **aucun pion adverse** ne peut attaquer, maintenant ou plus tard ;\n' +
          '3. occupé par un cavalier, de préférence : il est plus fort au centre qu’un fou.',
      },
      {
        kind: 'walkthrough',
        title: 'Installer le cavalier',
        fen: 'r4rk1/pb2q1pp/1pp1p3/5p2/3P4/2P2N2/PP2QPPP/R4RK1 w - - 0 1',
        moves: [
          {
            uci: 'f3e5',
            comment: 'Ce, soutenu par d4 : aucun pion noir ne peut plus attaquer e5.',
          },
          { uci: 'e7d6', comment: 'Les Noirs visent le cavalier, mais d4 le protège.' },
          { uci: 'f1e1', comment: 'Les Blancs renforcent la case et préparent f3 puis e4.' },
        ],
      },
    ],
    exercises: [
      {
        fen: 'r2q1rk1/pb1n2pp/1pp1p3/4Np2/3P4/3B4/PPP1QPPP/R4RK1 w - - 0 1',
        prompt: 'Quelle pièce blanche occupe un avant-poste ?',
        mode: 'squares',
        solution: [],
        squares: ['e5'],
        hints: [
          'Un avant-poste est protégé par un pion et hors de portée des pions adverses.',
          'Regarde dans le camp noir.',
          'Le pion d4 protège la pièce ; les pions noirs d et f n’existent plus.',
        ],
        explanation:
          'Le cavalier e5 est protégé par d4, et il n’y a plus de pion noir sur les colonnes d ni f pour le ' +
          'chasser (le pion f5 est à la même hauteur : il ne l’attaque pas).',
      },
      {
        fen: 'r2q1rk1/ppp1bppp/4pn2/8/3N4/2N1B3/PP2BPPP/R2Q1RK1 w - - 0 1',
        prompt:
          'Tu voudrais installer un cavalier en d5. Quels pions noirs peuvent encore l’attaquer, tôt ou tard ?',
        mode: 'squares',
        solution: [],
        squares: ['c7', 'e6'],
        hints: [
          'Un pion attaque en diagonale, vers l’avant. Qui peut se retrouver en c6 ou e6 ?',
          'Un pion noir qui est au-dessus de la 5e rangée peut encore descendre.',
          'e6 l’attaque déjà ; l’autre est sur la 7e rangée.',
        ],
        explanation:
          'e6 attaque d5 tout de suite, et c7 le pourrait après c6. Tant que ces deux pions sont là, d5 n’est pas ' +
          'un avant-poste.',
      },
      {
        fen: 'r2q1rk1/pp2bppp/2n1pn2/8/2P1P3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 1',
        prompt:
          'Un cavalier posé en d5 doit être protégé par un pion. Quels pions blancs le protégeraient ?',
        mode: 'squares',
        solution: [],
        squares: ['c4', 'e4'],
        hints: [
          'Un pion blanc protège en diagonale vers l’avant.',
          'Quelles cases d’un pion blanc touchent d5 ?',
          'Les pions sont sur la 4e rangée.',
        ],
        explanation:
          'c4 et e4 protègent d5 : un cavalier y serait bien soutenu, comme dans la structure Maroczy.',
      },
      {
        fen: 'r4rk1/pb2q1pp/1pp1p3/5p2/3P4/2P2N2/PP2QPPP/R4RK1 w - - 0 1',
        prompt: 'Quelle case permanente peux-tu offrir à ton cavalier f3 ?',
        mode: 'choice',
        solution: ['f3e5'],
        accepted: ['f3e5'],
        hints: [
          'Cherche une case centrale que ni d6 ni f6 ne pourront garder.',
          'Les Noirs ont avancé leur pion f.',
          'Ce, soutenu par d4.',
        ],
        explanation:
          'Ce : d4 le protège, et les pions noirs d et f ne peuvent plus l’attaquer. Le cavalier restera là ' +
          'aussi longtemps que tu voudras.',
      },
      {
        fen: 'r4rk1/pp2qppp/2p2n2/3p4/5P2/1PP1P3/PB2Q1PP/R4RK1 b - - 0 1',
        prompt: 'Les Noirs jouent : trouve l’avant-poste du cavalier f6.',
        mode: 'choice',
        solution: ['f6e4'],
        accepted: ['f6e4'],
        hints: [
          'Les pions blancs d et f sont sur d3 et f4 : quelle case ne gardent-ils plus ?',
          'Le cavalier cherche une case au centre, devant les pions blancs.',
          'La case e4 est protégée par d5.',
        ],
        explanation:
          'Ce4 : protégé par d5, et le pion blanc d n’est plus là pour l’attaquer. Même idée, côté noir.',
      },
    ],
  },
  {
    id: 'colonnes-ouvertes',
    phase: 3,
    title: 'Les colonnes ouvertes',
    summary: 'Une tour a besoin de lignes ouvertes : prends-les, double-les, entre en 7e rangée.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une tour derrière un pion ne sert à rien. Où vont tes tours ? Sur une **colonne ouverte** (aucun pion) ' +
          'ou **semi-ouverte** (aucun pion à toi, mais un pion adverse à attaquer). Quand la colonne est ouverte, ' +
          'les deux camps y veulent leurs tours : le premier qui s’y installe avec le soutien de la seconde ' +
          'obtient l’initiative.',
      },
      {
        kind: 'example',
        fen: '2r2rk1/pp2bppp/4pn2/8/3P4/4PN2/PP2BPPP/R2R2K1 w - - 0 1',
        caption:
          'La colonne c est ouverte. Tc1 la conteste ; si les Noirs l’occupent seuls, leur tour peut entrer ' +
          'en c2.',
        arrows: [['d1', 'c1']],
        marks: ['c8'],
      },
      {
        kind: 'text',
        title: 'Ce que fait une tour sur une colonne ouverte',
        body:
          '1. Elle **s’installe** (l’adversaire ne peut plus la chasser avec un pion).\n' +
          '2. Elle **double** : deux tours sur la même colonne sont bien plus fortes qu’une.\n' +
          '3. Elle **entre** : avec une case d’invasion (7e rangée, 8e rangée), elle attaque les pions par derrière.',
      },
      {
        kind: 'walkthrough',
        title: 'L’invasion en 7e rangée',
        fen: '5rk1/pp3ppp/4p3/8/8/4P3/PP3PPP/2R3K1 w - - 0 1',
        moves: [
          { uci: 'c1c7', comment: 'La tour entre en 7e rangée : elle attaque b7 et f7 à la fois.' },
          {
            uci: 'f8d8',
            comment: 'Les Noirs sortent leur tour, mais le pion b7 n’a plus de défenseur.',
          },
          {
            uci: 'c7b7',
            comment: 'La tour prend un pion et reste en 7e rangée, où rien ne peut la chasser.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '2r2rk1/pp3ppp/4p3/8/8/4P3/PP3PPP/R2R2K1 w - - 0 1',
        prompt: 'Quelles tours (des deux camps) sont déjà sur une colonne ouverte ?',
        mode: 'squares',
        solution: [],
        squares: ['c8', 'd1'],
        hints: [
          'Une colonne ouverte ne contient aucun pion, ni blanc ni noir.',
          'Regarde les colonnes c et d.',
          'Une tour blanche et une tour noire.',
        ],
        explanation:
          'Les colonnes c et d sont ouvertes : Tc8 et Td1 y sont. Ta1 est restée sur la colonne a, où il y a ' +
          'son pion.',
      },
      {
        fen: '2r2rk1/pp2bppp/4pn2/8/3P4/4PN2/PP2BPPP/R2R2K1 w - - 0 1',
        prompt: 'Conteste la colonne ouverte avant que la tour noire n’entre chez toi.',
        mode: 'engine',
        solution: ['d1c1'],
        tolerance: 5,
        traps: ['d4d5', 'f3e5'],
        hints: [
          'Quelle colonne ouverte les deux camps convoitent-ils ?',
          'Ta tour d1 peut changer de colonne en un coup.',
          'Tc1 : si les Noirs échangent, ta seconde tour recapture.',
        ],
        explanation:
          'Tc1 prend part à la lutte. d5 ? exd5 perd un pion ; Ce5 ? est vite chassé et laisse c2 aux Noirs.',
      },
      {
        fen: '5rk1/pp3ppp/4p3/8/8/4P3/PP3PPP/2R3K1 w - - 0 1',
        prompt: 'Ta tour tient la colonne c, qui est libre. Où doit-elle entrer ?',
        mode: 'choice',
        solution: ['c1c7'],
        accepted: ['c1c7'],
        hints: [
          'Une tour est très forte sur la rangée où l’adversaire a ses pions.',
          'Quelle est la 7e rangée pour les Blancs ?',
          'Tc7 attaque a7, b7 et f7 en même temps.',
        ],
        explanation:
          'Tc7 : la tour s’installe en 7e rangée et attaque trois pions. Les Noirs ne peuvent pas tout défendre.',
      },
      {
        fen: 'r4rk1/pp3ppp/2p1bn2/8/8/2P1BN2/PP3PPP/R4RK1 w - - 0 1',
        prompt:
          'La colonne d est ouverte, et tes deux tours sont encore dans les coins. Laquelle activer ?',
        mode: 'choice',
        solution: ['f1d1'],
        accepted: ['f1d1'],
        hints: [
          'Les tours doivent aller sur les colonnes sans pion.',
          'La tour a1 est déjà sur le bord : celle de f1 peut rejoindre le centre.',
          'Td1, avec la tour de a1 qui suivra.',
        ],
        explanation:
          'Tfd1 prend la colonne d ; la tour a1 pourra la rejoindre en c1 ou en d1 plus tard. ' +
          'Mieux vaut commencer par la tour qui a le chemin libre.',
      },
      {
        fen: '3r1rk1/pp3ppp/2p1p3/8/2P5/1P6/P4PPP/R3R1K1 w - - 0 1',
        prompt:
          'Quelles tours (des deux camps) sont sur une colonne ouverte ou semi-ouverte, c’est-à-dire sans pion de leur couleur ?',
        mode: 'squares',
        solution: [],
        squares: ['e1', 'd8'],
        hints: [
          'Pour chaque tour, regarde s’il y a un de ses propres pions sur sa colonne.',
          'Ta2 et Tf8 sont derrière un pion de leur camp.',
          'La tour blanche vise le pion e6 ; la tour noire a une colonne entièrement libre.',
        ],
        explanation:
          'Te1 est sur une colonne semi-ouverte : elle attaque e6. Td8 est sur la colonne d, ouverte. Ta1 et Tf8 ' +
          'sont bloquées par leurs propres pions a2 et f7.',
      },
    ],
  },
  {
    id: 'pion-isole',
    phase: 3,
    title: 'Le pion isolé',
    summary:
      'Un pion sans voisin est une cible : apprends à l’attaquer, à le bloquer, ou à en jouer.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un pion est **isolé** quand il n’a aucun pion de sa couleur sur les deux colonnes voisines. Aucun pion ' +
          'ne pourra jamais le protéger, ni garder la case devant lui. Pose-toi la question : **qui le défend ? ' +
          'et qui l’attaque ?** Si tu l’attaques, tu comptes les attaquants ; si c’est le tien, tu cherches de ' +
          'l’activité en échange.',
      },
      {
        kind: 'example',
        fen: 'r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
        caption:
          'Le pion d4 est isolé. La case de **blocage** est d5 : un cavalier noir y est idéal, protégé par rien ' +
          'mais impossible à chasser par un pion. Mais d4 reste bien défendu : on ne le prend pas encore.',
        arrows: [['f6', 'd5']],
        marks: ['d4', 'd5'],
      },
      {
        kind: 'text',
        title: 'Deux camps, deux plans',
        body:
          '**Contre le pion isolé** : bloque-le, échange les pièces (la faiblesse pèse plus en finale), double ' +
          'les attaquants sur lui.\n' +
          '**Avec le pion isolé** : garde les pièces, cherche l’initiative et la poussée d4-d5. Sans cela, la ' +
          'finale est difficile.',
      },
      {
        kind: 'walkthrough',
        title: 'Compter les attaquants',
        fen: 'r1bq1rk1/pp3ppp/2n1pn2/2b5/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
        moves: [
          {
            uci: 'c6d4',
            comment:
              'Trois attaquants (cavalier, fou, dame) contre deux défenseurs (cavalier, dame) : d4 tombe.',
          },
          { uci: 'f3d4', comment: 'Les Blancs reprennent : sinon ils perdent un pion sans rien.' },
          {
            uci: 'c5d4',
            comment: 'Le fou reprend : les Noirs ont gagné un pion, et le fou d4 attaque c3.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: 'r2q1rk1/pp2b1pp/2p1pn2/8/3P4/2N5/PP2BPPP/R2Q1RK1 w - - 0 1',
        prompt: 'Désigne les pions isolés (des deux camps).',
        mode: 'squares',
        solution: [],
        squares: ['d4', 'e6'],
        hints: [
          'Un pion isolé n’a aucun pion allié sur les colonnes voisines.',
          'Regarde le centre.',
          'Un pion blanc et un pion noir.',
        ],
        explanation:
          'd4 (pas de pion blanc en c ni en e) et e6 (pas de pion noir en d ni en f). Les autres pions ont tous un voisin.',
      },
      {
        fen: 'r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
        prompt: 'Les Noirs jouent. Quel coup bloque le pion isolé ?',
        mode: 'choice',
        solution: ['f6d5'],
        accepted: ['f6d5'],
        hints: [
          'La case de blocage est devant le pion isolé.',
          'Un cavalier se pose très bien sur cette case.',
          'Cd5, et il pourra être échangé mais jamais chassé par un pion.',
        ],
        explanation:
          'Cd5 : la case devant le pion isolé est la plus faible. Un cavalier noir en d5 gêne tout le jeu blanc.',
      },
      {
        fen: 'r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
        prompt:
          'Le pion d4 est isolé mais défendu deux fois. Joue un coup de pression sans le prendre.',
        mode: 'engine',
        solution: ['b7b6'],
        tolerance: 4,
        traps: ['c6d4', 'f6e4'],
        hints: [
          'Compte les attaquants et les défenseurs de d4.',
          'Deux défenseurs contre un attaquant : la prise perd du matériel.',
          'Joue un coup de développement, comme ...b6 ou ...Cd5.',
        ],
        explanation:
          'Cxd4 ? Cxd4 : tu perds une pièce pour un pion. Cxe4 ? aussi, le cavalier c3 le prend. ...b6, ...Cd5 ou ' +
          '...Dd6 augmentent la pression sans rien risquer.',
      },
      {
        fen: 'r1bq1rk1/pp3ppp/2n1pn2/2b5/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
        prompt:
          'Ton fou c5 est attaqué par le pion isolé. Compte les attaquants sur d4 : que joues-tu ?',
        mode: 'engine',
        solution: ['c6d4'],
        tolerance: 4,
        traps: ['b7b6', 'd8d6', 'f6d5'],
        hints: [
          'Combien de pièces noires attaquent d4 ? Combien de pièces blanches le défendent ?',
          'Cavalier, fou et dame d’un côté ; cavalier et dame de l’autre.',
          'Trois contre deux : prends le pion.',
        ],
        explanation:
          'Trois attaquants contre deux défenseurs : Cxd4 (ou Fxd4) gagne un pion. Ignorer l’attaque perd le fou : dxc5.',
      },
      {
        fen: '6k1/p4p1p/4p1p1/8/2P5/P3P3/6PP/6K1 w - - 0 1',
        prompt: 'Combien de pions isolés ? Désigne-les tous (des deux camps).',
        mode: 'squares',
        solution: [],
        squares: ['a3', 'c4', 'e3', 'a7'],
        hints: [
          'Pour chaque pion, regarde s’il a un voisin de sa couleur sur la colonne d’à côté.',
          'Les pions g et h sont voisins ; les pions f, g et h noirs aussi.',
          'Trois pions blancs et un seul pion noir.',
        ],
        explanation:
          'Chez les Blancs a3, c4 et e3 sont sans voisin ; chez les Noirs seul a7 l’est. Ensemble ce sont quatre ' +
          'faiblesses potentielles.',
      },
    ],
  },
  {
    id: 'pion-passe',
    phase: 3,
    title: 'Le pion passé',
    summary:
      'Un pion que plus aucun pion adverse ne peut arrêter : à créer, à protéger, à bloquer.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un pion est **passé** quand aucun pion adverse ne se trouve devant lui, ni sur sa colonne ni sur les ' +
          'deux colonnes voisines. Seules les pièces peuvent l’arrêter. « Un pion passé doit être poussé » ' +
          '(Nimzovitch) : mais d’abord, vérifie qu’il est soutenu et que ses cases de passage sont libres.',
      },
      {
        kind: 'example',
        fen: '6k1/pp3p2/7p/3P4/8/8/PP3P2/6K1 w - - 0 1',
        caption:
          'Le pion d5 est passé : aucun pion noir en c, d ni e. Le pion noir h6 l’est aussi : aucun pion blanc ' +
          'en g ni en h. En revanche f2 et f7 se bloquent l’un l’autre : ils ne sont pas passés.',
        marks: ['d5', 'h6'],
      },
      {
        kind: 'text',
        title: 'Trois idées',
        body:
          '1. **Créer** un pion passé : échanger, ou sacrifier pour ouvrir une ligne (la percée).\n' +
          '2. **Protéger** le pion passé : un pion qui le soutient en fait un pion passé protégé.\n' +
          '3. **Bloquer** le pion passé adverse : une pièce sur la case devant lui, de préférence un cavalier.',
      },
      {
        kind: 'walkthrough',
        title: 'La percée',
        fen: '8/ppp5/8/PPP5/8/8/8/K6k w - - 0 1',
        moves: [
          { uci: 'b5b6', comment: 'Le sacrifice : on offre un pion pour ouvrir la position.' },
          {
            uci: 'a7b6',
            comment: 'Si les Noirs prennent avec a7, la colonne a s’ouvre pour le pion blanc.',
          },
          {
            uci: 'c5c6',
            comment: 'Un second sacrifice, pour éliminer le dernier défenseur de la colonne.',
          },
          { uci: 'b7c6', comment: 'Les Noirs prennent à nouveau.' },
          {
            uci: 'a5a6',
            comment: 'Le pion a est passé et personne ne peut l’arrêter : il va à dame.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '6k1/pp3p2/7p/3P4/8/8/PP3P2/6K1 w - - 0 1',
        prompt: 'Désigne les pions passés (des deux camps).',
        mode: 'squares',
        solution: [],
        squares: ['d5', 'h6'],
        hints: [
          'Un pion est passé quand rien ne l’arrête de front ni en diagonale.',
          'Regarde le centre et l’aile h.',
          'Il y en a un de chaque couleur.',
        ],
        explanation:
          'd5 : pas de pion noir en c, d ni e. h6 : pas de pion blanc en g ni h. Les pions des colonnes a, b et f se gênent mutuellement.',
      },
      {
        fen: '6k1/pp4pp/8/3P4/4P3/8/PP3PPP/6K1 w - - 0 1',
        prompt: 'Les Blancs ont deux pions passés. Lequel est protégé par un pion ?',
        mode: 'squares',
        solution: [],
        squares: ['d5'],
        hints: [
          'Un pion protège en diagonale vers l’avant.',
          'Quel pion blanc se trouve à côté et en retrait de l’autre ?',
          'e4 protège d5.',
        ],
        explanation:
          'd5 est protégé par e4 : c’est un pion passé protégé, très difficile à attaquer. e4, lui, n’est protégé par rien.',
      },
      {
        fen: '8/ppp5/8/PPP5/8/8/8/K6k w - - 0 1',
        prompt: 'Trois pions contre trois : crée un pion passé par un sacrifice.',
        mode: 'exact',
        solution: ['b5b6', 'a7b6', 'c5c6', 'b7c6', 'a5a6'],
        hints: [
          'Aucun pion n’est passé : il faut en créer un en sacrifiant.',
          'Pousse le pion central en l’offrant.',
          'b6 ! : si a7xb6, joue c6 et le pion a est libre.',
        ],
        explanation:
          '1.b6 axb6 2.c6 bxc6 3.a6 : le pion a est passé et ne peut plus être arrêté. C’est la percée.',
      },
      {
        fen: '6k1/pp3ppp/8/4N3/3p4/8/PP3PPP/6K1 w - - 0 1',
        prompt: 'Le pion noir d4 est passé. Où le cavalier le bloque-t-il le mieux ?',
        mode: 'choice',
        solution: ['e5d3'],
        accepted: ['e5d3'],
        hints: [
          'Un blocage se place directement devant le pion.',
          'Le pion d4 avance vers d3.',
          'Cd3 le bloque et reste hors de portée des pions.',
        ],
        explanation:
          'Cd3 : le cavalier bloque le pion passé, qu’il ne peut pas prendre mais qu’il arrête. Aucun pion noir ne peut chasser la case d3.',
      },
      {
        fen: '6k1/2p2p1p/3p4/4P3/P7/8/6PP/6K1 w - - 0 1',
        prompt: 'Un pion passé de chaque côté : désigne-les. Attention, e5 n’en est pas un.',
        mode: 'squares',
        solution: [],
        squares: ['a4', 'c7'],
        hints: [
          'Regarde si un pion adverse est devant le pion, sur sa colonne ou une colonne voisine.',
          'e5 est arrêté par d6, qui peut le prendre ou l’attendre.',
          'Les deux pions passés sont sur les ailes, éloignés des autres pions.',
        ],
        explanation:
          'a4 n’a aucun pion noir en a ni b ; c7 n’a aucun pion blanc en b, c ni d. e5 est arrêté par d6 et f7. ' +
          'Un pion passé éloigné attire le roi adverse loin des autres pions.',
      },
    ],
  },
  {
    id: 'bon-fou-mauvais-fou',
    phase: 3,
    title: 'Bon fou, mauvais fou',
    summary:
      'Un fou est bon quand ses pions sont sur l’autre couleur : compte-les, puis libère ou échange.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un fou ne change jamais de couleur de case. Si **tes pions sont sur les cases de la même couleur que ton ' +
          'fou**, ils le bloquent : c’est un **mauvais fou**. S’ils sont sur l’autre couleur, le fou est **bon** : ' +
          'il voit loin et protège tes pions. Avant de parler de plan, compte : combien de mes pions sont sur la ' +
          'couleur de mon fou ?',
      },
      {
        kind: 'example',
        fen: '2b1k3/p4pp1/1p1p3p/4P3/3P4/2P5/PP3P2/2B1K3 w - - 0 1',
        caption:
          'Le fou c1 est sur une case sombre, comme b2, c3, d4, e5 et f2 : il est muré derrière sa propre ' +
          'chaîne. Le fou noir c8, lui, voit presque toutes ses cases.',
        marks: ['c1', 'b2', 'c3', 'd4', 'e5', 'f2'],
      },
      {
        kind: 'text',
        title: 'Que faire d’un mauvais fou ?',
        body:
          '1. Le **sortir de la chaîne** avant de la fermer (…Ff5 avant …e6, Ff4 avant e3).\n' +
          '2. L’**échanger** contre une pièce adverse, de préférence le bon fou.\n' +
          '3. **Changer les pions** de couleur : un pion qui avance ou qui s’échange libère des cases.',
      },
      {
        kind: 'walkthrough',
        title: 'Sortir le fou avant de fermer la chaîne',
        fen: 'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 2 4',
        moves: [
          {
            uci: 'c8f5',
            comment: 'Le fou c8 sort d’abord : plus tard, e6 l’aurait enfermé derrière la chaîne.',
          },
          { uci: 'e2e3', comment: 'Les Blancs développent tranquillement.' },
          {
            uci: 'e7e6',
            comment:
              'Maintenant e6 est possible : le fou est en dehors de la chaîne et reste actif.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '4k3/pp3pp1/2p1p3/3pP3/3P4/2P5/PP3PPP/2B1K3 w - - 0 1',
        prompt: 'Ton fou est en c1. Quels pions blancs sont sur des cases de sa couleur ?',
        mode: 'squares',
        solution: [],
        squares: ['b2', 'c3', 'd4', 'e5', 'f2', 'h2'],
        hints: [
          'c1 est une case sombre. Cherche les pions sur des cases sombres.',
          'a1 est sombre, b1 est claire, c1 est sombre… alterne de rangée en rangée.',
          'Six pions sur huit : ton fou est vraiment mauvais.',
        ],
        explanation:
          'b2, c3, d4, e5, f2 et h2 sont sur des cases sombres, comme le fou : il est bloqué par ses propres pions. ' +
          'Seuls a2 et g2 sont sur des cases claires.',
      },
      {
        fen: '2b1k3/p4pp1/1p1p3p/4P3/3P4/2P5/PP3P2/2B1K3 w - - 0 1',
        prompt: 'Les deux camps ont un fou. Lequel est le mauvais fou ? Désigne-le.',
        mode: 'squares',
        solution: [],
        squares: ['c1'],
        hints: [
          'Compte, pour chaque fou, les pions de son camp sur sa couleur.',
          'Le fou c8 est sur une case claire. Combien de pions noirs sont sur des cases claires ?',
          'Seul f7 est sur une case claire côté noir ; côté blanc, ils sont cinq.',
        ],
        explanation:
          'Les pions blancs b2, c3, d4, e5 et f2 sont sombres : le fou c1 est muré. Les pions noirs sont presque ' +
          'tous sombres aussi : le fou c8 (case claire) est bon.',
      },
      {
        fen: '2b1k3/pp3pp1/2p1p2p/3p4/3P4/2P1P3/PP3PPP/4K3 b - - 0 1',
        prompt: 'Le fou noir est en c8. Quels pions noirs sont sur des cases de sa couleur ?',
        mode: 'squares',
        solution: [],
        squares: ['b7', 'c6', 'd5', 'e6', 'f7'],
        hints: [
          'c8 est une case claire. h1 est claire, g1 est sombre…',
          'Les pions du centre sont tous du même côté de la couleur.',
          'Cinq pions : de b7 à f7, sauf un de la 7e rangée.',
        ],
        explanation:
          'b7, c6, d5, e6 et f7 sont sur des cases claires : le fou c8 est enfermé derrière sa propre chaîne. ' +
          'C’est le défaut classique des structures du type Française ou Slave : il faut sortir le fou à temps.',
      },
      {
        fen: 'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 2 4',
        prompt:
          'Les Noirs veulent jouer …e6, qui enfermerait le fou c8 derrière la chaîne. Que jouent-ils d’abord ?',
        mode: 'choice',
        solution: ['c8f5'],
        accepted: ['c8f5'],
        hints: [
          'Le fou c8 doit sortir avant que e6 ne ferme la diagonale.',
          'Où peut-il aller sans être gêné par ses pions ?',
          'Ff5 : le fou est sorti de la chaîne.',
        ],
        explanation:
          '…Ff5 sort le fou, puis …e6 ferme la chaîne sans l’enfermer : c’est l’idée de la défense Slave.',
      },
      {
        fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3',
        prompt:
          'Les Blancs veulent jouer e3 plus tard, ce qui enfermerait le fou c1. Où le mettent-ils d’abord ?',
        mode: 'choice',
        solution: ['c1f4'],
        accepted: ['c1f4', 'c1g5'],
        hints: [
          'Même idée que côté noir : le fou doit sortir avant e3.',
          'Deux cases possibles, toutes deux en dehors de la chaîne de pions.',
          'Ff4 (ou Fg5) : le fou est devant les pions.',
        ],
        explanation:
          'Ff4 (système de Londres) ou Fg5 : le fou sort devant la chaîne, et e3 ne l’enfermera plus.',
      },
    ],
  },
  {
    id: 'prophylaxie',
    phase: 3,
    title: 'La prophylaxie',
    summary: 'Avant de jouer ton coup, demande-toi : « que veut faire mon adversaire ? »',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Une idée simple, que les bons joueurs répètent : **« Que veut mon adversaire ? »** Avant d’appliquer ton ' +
          'plan, regarde ce qu’il ferait s’il avait le trait. S’il y a une idée dangereuse (un cavalier qui veut ' +
          'sauter, un clouage, une poussée de pion), tu peux l’empêcher d’un seul coup tranquille : c’est la ' +
          '**prophylaxie**.',
      },
      {
        kind: 'example',
        fen: 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        caption:
          'Les Noirs voudraient jouer …Cb4, qui attaque le fou d3 et la case c2. Deux pièces noires peuvent y aller : ' +
          'le cavalier c6 et le fou e7. Un simple a3 enlève cette case.',
        arrows: [
          ['c6', 'b4'],
          ['e7', 'b4'],
        ],
        marks: ['b4'],
      },
      {
        kind: 'text',
        title: 'Trois questions',
        body:
          '1. Quelle est **la dernière chose** que mon adversaire a faite ? Quelle menace crée-t-elle ?\n' +
          '2. S’il pouvait jouer **deux coups** de suite, que ferait-il ?\n' +
          '3. Est-ce que je peux l’en empêcher sans perdre de temps ? (petit coup de pion, échange, tour)',
      },
      {
        kind: 'walkthrough',
        title: 'Un coup de pion bien placé',
        fen: 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        moves: [
          {
            uci: 'a2a3',
            comment: 'Prophylaxie : la case b4 n’est plus accessible à un cavalier ni à un fou.',
          },
          { uci: 'c6a5', comment: 'Les Noirs cherchent une autre case pour leur cavalier.' },
          {
            uci: 'c3e2',
            comment:
              'Les Blancs regroupent leurs pièces et poursuivent leur plan, sans rien craindre en b4.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Que veulent les Noirs ? Quelles pièces noires peuvent aller en b4 au prochain coup ?',
        mode: 'squares',
        solution: [],
        squares: ['c6', 'e7'],
        hints: [
          'Un cavalier saute en L ; un fou glisse sur la diagonale, si elle est libre.',
          'Le fou noir n’est pas celui de c8.',
          'Le cavalier de la colonne c et le fou de la colonne e.',
        ],
        explanation:
          'Cb4 (depuis c6) et Fb4 (depuis e7, par la diagonale e7-b4) sont possibles : les deux attaquent des pièces blanches.',
      },
      {
        fen: 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        prompt: 'Quel petit coup te débarrasse de l’idée …Cb4 ?',
        mode: 'choice',
        solution: ['a2a3'],
        accepted: ['a2a3'],
        hints: [
          'Quelle case veux-tu retirer aux pièces noires ?',
          'Un pion peut garder une case : b4 est dans la zone de quel pion ?',
          'a3 attaque b4.',
        ],
        explanation:
          'a3 : le pion garde b4, les cavaliers et les fous noirs ne peuvent plus s’y poser. C’est le coup le plus ' +
          'précis ici ; les autres laissent plus de choix à l’adversaire.',
      },
      {
        fen: 'r1bq1rk1/pp1pbppp/2n1p3/4N3/3P4/2PB4/PP3PPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Tu voudrais garder ton cavalier e5. Quels pions noirs peuvent le chasser en un coup ?',
        mode: 'squares',
        solution: [],
        squares: ['d7', 'f7'],
        hints: [
          'Un pion attaque en diagonale vers l’avant : d6 ou f6 attaquent e5.',
          'Quels pions peuvent aller en d6 ou en f6 ?',
          'Ils sont tous deux sur leur case de départ.',
        ],
        explanation:
          'd7-d6 et f7-f6 attaquent e5. Avant d’installer un cavalier, vérifie combien de pions peuvent le chasser.',
      },
      {
        fen: 'r1bq1rk1/ppp1bppp/4pn2/3p4/1n1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Les Noirs viennent de jouer …Cb4. Quelles pièces ou quels pions blancs attaque-t-il ?',
        mode: 'squares',
        solution: [],
        squares: ['a2', 'c2', 'd3'],
        hints: [
          'Le cavalier attaque 8 cases en L. Lesquelles sont occupées par une pièce blanche ?',
          'Il attaque deux pions et un fou.',
          'a2, c2 et la case de ton fou.',
        ],
        explanation:
          'Le cavalier b4 attaque a2, c2 et d3. Rien n’est en prise (chaque cible est défendue), mais la menace ' +
          '…Cxd3 ou …Cxc2 impose de réagir.',
      },
      {
        fen: 'r1bq1rk1/ppp1bppp/4pn2/3p4/1n1P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 1',
        prompt: 'Le cavalier b4 attaque ton fou d3. Réponds sans rien laisser en prise.',
        mode: 'engine',
        solution: ['a2a3'],
        tolerance: 3,
        traps: ['d3c4'],
        hints: [
          'Ton fou est-il vraiment en danger ? Qui le défend ?',
          'Le pion c2 défend d3. Mais certaines cases de retraite sont attaquées.',
          'a3 chasse le cavalier ; Fe2 est aussi bon. Fc4 ?? perd le fou.',
        ],
        explanation:
          'a3 (ou Fe2) : le fou est défendu, il suffit de réagir calmement. Fc4 ? dxc4 : le pion d5 prend le fou.',
      },
    ],
  },
  {
    id: 'roi-roque-attaque',
    phase: 3,
    title: 'Attaquer le roque',
    summary: 'Compte attaquants et défenseurs avant de sacrifier : l’attaque doit être prête.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Un roi roqué est protégé par ses pions et ses pièces. Pour l’attaquer, demande-toi : **combien de mes ' +
          'pièces visent le roque ? combien de pièces adverses le défendent ?** Tant que tu as moins d’attaquants ' +
          'que d’adversaires, ne sacrifie rien : fais venir une pièce de plus (cavalier en g5 ou f5, tour en 3e ' +
          'rangée, dame sur la diagonale du fou).',
      },
      {
        kind: 'example',
        fen: '4rrk1/pbqn1ppp/3p4/5N2/3P3Q/8/1P3PPP/1B2RRK1 w - - 0 1',
        caption:
          'La dame h4 et le fou b1 visent h7, mais le cavalier f5 masque le fou. Le cavalier bouge avec échec : ' +
          'c’est une attaque à la découverte contre h7.',
        arrows: [
          ['b1', 'h7'],
          ['h4', 'h7'],
          ['f5', 'e7'],
        ],
        marks: ['h7'],
      },
      {
        kind: 'text',
        title: 'Les pièces d’attaque',
        body:
          '1. La **dame** près du roque (h5, h4, g4) et un **fou** sur la diagonale b1-h7.\n' +
          '2. Un **cavalier** en g5, f5 ou e5, qui attaque h7, f7 ou g7 sans que des pions puissent le chasser.\n' +
          '3. Une **tour** qui monte (Ta3-h3) ou qui occupe une colonne ouverte devant le roi.\n' +
          'Quand tu as plus d’attaquants que le roi n’a de défenseurs, les sacrifices marchent.',
      },
      {
        kind: 'walkthrough',
        title: 'Un échec à la découverte',
        fen: '4rrk1/pbqn1ppp/3p4/5N2/3P3Q/8/1P3PPP/1B2RRK1 w - - 0 1',
        moves: [
          {
            uci: 'f5e7',
            comment: 'Échec du cavalier, qui démasque en même temps le fou b1 sur h7.',
          },
          { uci: 'e8e7', comment: 'Les Noirs prennent le cavalier, mais ne parent pas la menace.' },
          {
            uci: 'h4h7',
            comment: 'Dxh7 est mat : le fou b1 la soutient, et le roi n’a aucune case.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: '4rrk1/pbqn1ppp/3p4/5N2/3P3Q/8/1P3PPP/1B2RRK1 w - - 0 1',
        prompt:
          'Quelles pièces blanches attaquent déjà les pions devant le roi noir (f7, g7, h7) ?',
        mode: 'squares',
        solution: [],
        squares: ['f5', 'h4'],
        hints: [
          'Pour chaque pièce, regarde si elle peut prendre sur f7, g7 ou h7.',
          'Le fou b1 est masqué par une de tes pièces : il ne compte pas encore.',
          'Une dame et un cavalier.',
        ],
        explanation:
          'La dame h4 attaque h7 par la colonne h, et le cavalier f5 attaque g7. Le fou b1 est bloqué par le ' +
          'cavalier : il viendra en renfort quand celui-ci bougera.',
      },
      {
        fen: '4rrk1/pbqn1ppp/3p4/5N2/3P3Q/8/1P3PPP/1B2RRK1 w - - 0 1',
        prompt: 'Combien de pièces noires défendent h7 ? Désigne-les.',
        mode: 'squares',
        solution: [],
        squares: ['g8'],
        hints: [
          'Une pièce défend h7 si elle peut s’y rendre en le prenant.',
          'Le cavalier d7 et la dame c7 sont-ils utiles pour h7 ?',
          'Seul le roi défend h7.',
        ],
        explanation:
          'Seul le roi g8 défend h7 : le cavalier d7 bloque la dame c7 sur la 7e rangée et n’attaque pas h7. ' +
          'Deux attaquants contre un défenseur : l’attaque est prête.',
      },
      {
        fen: '4rrk1/pbqn1ppp/3p4/5N2/3P3Q/8/1P3PPP/1B2RRK1 w - - 0 1',
        prompt: 'Trouve la combinaison : échec à la découverte, puis mat.',
        mode: 'exact',
        solution: ['f5e7', 'e8e7', 'h4h7'],
        hints: [
          'Quelle pièce masque le fou b1 ?',
          'Le cavalier peut bouger avec échec.',
          'Ce7+ force la réponse noire ; ensuite, la dame prend h7.',
        ],
        explanation:
          'Ce7+ ! Si Txe7 (ou Rh8), Dxh7# : le fou b1 soutient la dame, et le cavalier a ouvert sa diagonale en ' +
          'donnant échec.',
      },
      {
        fen: '5rk1/pb3ppp/8/q6n/2B5/2N2Q2/1P3PPP/4R1K1 w - - 0 1',
        prompt: 'Le fou c4 vise f7 et la dame f3 aussi. Trouve la suite qui force le mat.',
        mode: 'exact',
        solution: ['f3f7', 'f8f7', 'e1e8'],
        hints: [
          'Combien de pièces blanches attaquent f7 ? Combien le défendent ?',
          'Deux attaquants (dame et fou) contre un seul défenseur : sacrifie la dame.',
          'Dxf7+ Txf7 : la tour est clouée par le fou. Que joue ta tour ?',
        ],
        explanation:
          'Dxf7+ ! Txf7 (forcé), puis Te8# : la tour noire est clouée par le fou c4 et ne peut pas interposer.',
      },
      {
        fen: 'r1bq1rk1/pp1pbppp/2n1p3/4N3/3P4/2PB4/PP3PPP/R1BQ1RK1 w - - 0 1',
        prompt:
          'Le fou d3 vise h7, mais as-tu assez d’attaquants ? Compte, puis joue un coup qui renforce l’attaque.',
        mode: 'engine',
        solution: ['d1h5'],
        tolerance: 4,
        traps: ['d3h7'],
        hints: [
          'Combien de pièces blanches attaquent h7 ? Et combien défendent le roque noir ?',
          'Un sacrifice prématuré perd une pièce : mieux vaut amener un attaquant de plus.',
          'Dh5 amène la dame vers h7 ; Fxh7+ ? ne mène à rien ici.',
        ],
        explanation:
          'Fxh7+ ? Rxh7 : il n’y a pas de seconde pièce pour poursuivre (la dame est loin, le cavalier n’attaque pas ' +
          'h7). Dh5 ou f4 ajoutent un attaquant sans rien risquer.',
      },
    ],
  },
  {
    id: 'convertir-avantage',
    phase: 3,
    title: 'Convertir un avantage',
    summary: 'Quand on est mieux, on échange et on simplifie : on ne cherche pas la combinaison.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Avoir un avantage ne gagne pas la partie : il faut le **convertir**. Beaucoup de parties se perdent ' +
          'au moment où l’on se croit gagnant et où l’on cherche la combinaison. Un réflexe simple : **quand je ' +
          'suis mieux, j’échange les pièces.** Chaque échange réduit le contre-jeu adverse et rapproche d’une ' +
          'finale où l’avantage compte.',
      },
      {
        kind: 'example',
        fen: 'r4rk1/pp3ppp/2q1p3/8/8/2Q1P3/PPP2PPP/R4RK1 w - - 0 1',
        caption:
          'Les Blancs ont un pion de plus. Dxc6 bxc6 échange les dames : le pion supplémentaire pèse davantage et ' +
          'la structure noire est abîmée. Tout autre coup laisse les Noirs échanger ou jouer pour le contre-jeu.',
        arrows: [['c3', 'c6']],
      },
      {
        kind: 'text',
        title: 'Trois réflexes',
        body:
          '1. **Échange** d’abord les dames, puis les pièces actives de l’adversaire.\n' +
          '2. **Évite** les complications : une position simple ne laisse pas de coup surprise.\n' +
          '3. **Cherche le contre-jeu** de l’adversaire (que veut-il ?) et empêche-le avant d’avancer.',
      },
      {
        kind: 'walkthrough',
        title: 'Le plan en action',
        fen: 'r4rk1/pp3ppp/2q1p3/8/8/2Q1P3/PPP2PPP/R4RK1 w - - 0 1',
        moves: [
          { uci: 'c3c6', comment: 'Échange des dames : on réduit le jeu de l’adversaire.' },
          { uci: 'b7c6', comment: 'Les Noirs reprennent et se retrouvent avec des pions doublés.' },
          {
            uci: 'a1d1',
            comment:
              'Les tours prennent les colonnes ouvertes ; le pion de plus s’impose sans risque.',
          },
          {
            uci: 'f8d8',
            comment: 'Les Noirs échangent une paire de tours : ils n’ont plus de contre-jeu.',
          },
        ],
      },
    ],
    exercises: [
      {
        fen: 'r4rk1/pp3ppp/2q1p3/8/8/2Q1P3/PPP2PPP/R4RK1 w - - 0 1',
        prompt: 'Tu as un pion de plus et les dames se font face. Que fais-tu ?',
        mode: 'engine',
        solution: ['c3c6'],
        tolerance: 4,
        traps: ['c3b3', 'f2f4'],
        hints: [
          'Quand tu es mieux, quel type d’échange réduit le contre-jeu de l’adversaire ?',
          'Les dames sont sur la même colonne et rien ne gêne.',
          'Dxc6 bxc6 : la finale est gagnante.',
        ],
        explanation:
          'Dxc6 bxc6 simplifie vers une finale où le pion de plus décidera. Esquiver l’échange (Db3, f4) laisse ' +
          'les Noirs échanger à leur manière ou chercher le contre-jeu.',
      },
      {
        fen: '2r2rk1/pp3ppp/2q1p3/8/2Q5/4P3/PPP2PPP/R2R2K1 w - - 0 1',
        prompt: 'Même situation : un pion de plus, la dame noire est en face de la tienne.',
        mode: 'engine',
        solution: ['c4c6'],
        tolerance: 4,
        traps: ['b2b3', 'g1f1'],
        hints: [
          'Les dames sont sur la même colonne.',
          'Un échange de dames ne coûte rien et simplifie.',
          'Dxc6 bxc6, puis tes tours prennent les colonnes ouvertes.',
        ],
        explanation:
          'Dxc6 bxc6 : encore une fois, l’échange des dames est le coup le plus simple. Les coups lents laissent ' +
          'les Noirs échanger eux-mêmes ou doubler leurs tours avec activité.',
      },
      {
        fen: 'r1bq1rk1/pp3ppp/2nbpn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 1',
        prompt: 'Quelle pièce noire est la plus active (celle qui a le plus de coups) ?',
        mode: 'squares',
        solution: [],
        squares: ['d6'],
        hints: [
          'Compte les coups possibles de chaque pièce noire.',
          'Un fou sur une diagonale ouverte voit presque tout l’échiquier.',
          'C’est un fou.',
        ],
        explanation:
          'Le fou d6 contrôle la grande diagonale vers ton roque. Quand on est mieux, on échange en priorité la ' +
          'pièce active de l’adversaire.',
      },
      {
        fen: '2r2rk1/pp3ppp/2n1pn2/3q4/3P4/2N1PN2/PP3PPP/2RQ1RK1 w - - 0 1',
        prompt: 'Quelle pièce noire est la plus active (celle qui a le plus de coups) ?',
        mode: 'squares',
        solution: [],
        squares: ['d5'],
        hints: [
          'Compte les cases libres de chaque pièce.',
          'La pièce la plus mobile est aussi la plus puissante.',
          'C’est la dame, au centre.',
        ],
        explanation:
          'La dame d5 touche seize cases. L’échanger (Cxd5) réduit le jeu de l’adversaire à presque rien.',
      },
      {
        fen: '1r3rk1/pp3ppp/2q1p3/8/8/2Q1P3/PPP2PPP/R2R2K1 w - - 0 1',
        prompt: 'Toujours un pion de plus. Cette fois, ne cherche pas autre chose : échange.',
        mode: 'engine',
        solution: ['c3c6'],
        tolerance: 4,
        traps: ['c3d3', 'g1f1'],
        hints: [
          'Quelle pièce adverse est la plus active ?',
          'La dame noire : l’échanger enlève tout son contre-jeu.',
          'Dxc6 bxc6, avec un pion de plus et une structure noire abîmée.',
        ],
        explanation:
          'Dxc6 bxc6 : l’échange des dames est de nouveau le meilleur plan. Ne pas le faire laisse les Noirs ' +
          'choisir le moment de l’échange, ou doubler leurs tours sur ta position.',
      },
    ],
  },
  {
    id: 'finales-tours-pratiques',
    phase: 3,
    title: 'Finales de tours : le pratique',
    summary: 'Tour derrière le pion passé, tour active, coupure du roi, pont sur la 4e rangée.',
    minutes: 15,
    sections: [
      {
        kind: 'text',
        body:
          'Les finales de tours sont les plus fréquentes, donc les plus rentables. Quatre idées pratiques, à ' +
          'retenir avant les positions théoriques (Lucena, Philidor) :\n' +
          '1. **La tour derrière le pion passé**, le tien comme celui de l’adversaire (règle de Tarrasch).\n' +
          '2. **La tour active** : une tour agressive vaut mieux qu’un pion de plus passif.\n' +
          '3. **La coupure** : une tour qui coupe le roi adverse sur une colonne ou une rangée le tient à l’écart.\n' +
          '4. **La 4e rangée** : pour gagner avec un pion en 7e, la tour construit un « pont » sur la 4e rangée.',
      },
      {
        kind: 'example',
        fen: 'r7/8/8/P2k4/8/8/6K1/4R3 w - - 0 1',
        caption:
          'Le pion a5 est passé. Place ta tour derrière lui, en a1 : elle le soutient sur toute sa marche, et ' +
          'aucune tour adverse ne peut s’y glisser.',
        arrows: [['e1', 'a1']],
        marks: ['a5'],
      },
      {
        kind: 'text',
        title: 'Le pont',
        body:
          'Avec un pion en 7e rangée et le roi caché devant lui, la difficulté est de faire sortir le roi de ' +
          'l’abri des échecs. La tour se place sur la **4e rangée**, d’où elle protège le roi des échecs latéraux. ' +
          'Dans la position de Lucena, c’est Td4 !',
      },
      {
        kind: 'walkthrough',
        title: 'Le pont de Lucena',
        fen: '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1',
        moves: [
          { uci: 'f1d1', comment: 'Échec qui éloigne le roi noir.' },
          { uci: 'd8e7', comment: 'Le roi noir doit s’écarter de la colonne d.' },
          { uci: 'd1d4', comment: 'Le pont : la tour sur la 4e rangée servira d’abri aux échecs.' },
          { uci: 'a2a1', comment: 'Les Noirs tentent de donner des échecs par derrière.' },
          { uci: 'b8c7', comment: 'Le roi blanc sort de son abri.' },
          { uci: 'a1c1', comment: 'Échec.' },
          { uci: 'c7b6', comment: 'Le roi se rapproche de la tour.' },
          { uci: 'c1b1', comment: 'Un échec de plus.' },
          { uci: 'b6c6', comment: 'Le roi avance encore.' },
          { uci: 'b1c1', comment: 'Les Noirs continuent à donner des échecs.' },
          { uci: 'c6b5', comment: 'Le roi blanc approche de la tour.' },
          { uci: 'c1b1', comment: 'Dernier échec avant le pont.' },
          { uci: 'd4b4', comment: 'Le pont : la tour s’interpose, le pion est promu.' },
        ],
      },
    ],
    exercises: [
      {
        fen: '8/8/3k4/P6p/7r/8/6K1/R7 w - - 0 1',
        prompt: 'Désigne les tours qui sont derrière un pion passé de leur camp.',
        mode: 'squares',
        solution: [],
        squares: ['a1'],
        hints: [
          'Un pion passé est un pion que les pions adverses ne peuvent plus arrêter.',
          'Pour les Blancs, « derrière » veut dire sur une rangée plus basse.',
          'La tour noire est devant son pion h5, pas derrière.',
        ],
        explanation:
          'Ta1 est derrière le pion a5 : elle le soutient pendant toute sa marche. Th4 est devant son pion h5 : ' +
          'elle le gêne plutôt qu’elle ne l’aide.',
      },
      {
        fen: '8/8/8/P2r3k/6R1/2K5/8/8 w - - 0 1',
        prompt: 'La tour noire attaque ton pion passé a5. Où mets-tu ta tour ?',
        mode: 'engine',
        solution: ['g4a4'],
        tolerance: 5,
        traps: ['g4g3', 'g4g1'],
        hints: [
          'Ton pion a5 est attaqué : il faut le défendre sans perdre le temps de ta tour.',
          'Une tour défend mieux un pion passé depuis l’arrière.',
          'Ta4 : la tour est derrière le pion.',
        ],
        explanation:
          'Ta4 défend le pion depuis l’arrière, et il pourra avancer avec le soutien de la tour. Les autres coups ' +
          'perdent le pion et la partie devient nulle.',
      },
      {
        fen: '8/8/7k/P2r4/8/5K2/6R1/8 w - - 0 1',
        prompt: 'Même idée : ta tour est loin du pion. Ramène-la au bon endroit.',
        mode: 'engine',
        solution: ['g2a2'],
        tolerance: 5,
        traps: ['f3e4', 'g2h2'],
        hints: [
          'Quelle est la colonne du pion passé ?',
          'La tour doit être derrière le pion, sur sa colonne.',
          'Ta2 : la tour est en bas de la colonne a.',
        ],
        explanation:
          'Ta2 : la tour garde le pion depuis l’arrière. Ignorer le pion (Re4 ?, Th2) le laisse tomber et la ' +
          'finale est nulle.',
      },
      {
        fen: '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1',
        prompt: 'Position de Lucena : trouve le premier coup, puis le pont sur la 4e rangée.',
        mode: 'exact',
        solution: ['f1d1', 'd8e7', 'd1d4'],
        hints: [
          'Il faut d’abord éloigner le roi noir de la colonne du pion.',
          'Un échec sur la colonne d y arrive.',
          'Td1+, puis Td4.',
        ],
        explanation:
          'Td1+ éloigne le roi, puis Td4 : la tour sur la 4e rangée protégera le roi des échecs latéraux.',
      },
      {
        fen: 'r4rk1/pp3ppp/2p1p3/8/8/2P1P3/PP3PPP/3R1RK1 w - - 0 1',
        prompt: 'Quelle tour est la plus active (celle qui a le plus de cases) ? Désigne-la.',
        mode: 'squares',
        solution: [],
        squares: ['d1'],
        hints: [
          'Compte les cases libres de chaque tour.',
          'Une colonne ouverte donne beaucoup de cases.',
          'C’est une tour blanche.',
        ],
        explanation:
          'Td1 occupe la colonne d, ouverte : onze cases. Les autres tours sont bloquées par leurs pions ou ' +
          'leurs voisines. Une tour active est la clé des finales de tours.',
      },
    ],
  },
];
