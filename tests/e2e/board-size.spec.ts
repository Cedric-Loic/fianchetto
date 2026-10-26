import { expect, test, type Page } from '@playwright/test';

/*
 * Taille du plateau (BoardLayout) : sur chaque écran à échiquier, le plateau occupe toute la place
 * disponible.
 *
 * Critère, avec une tolérance MARGIN = 40 px (arrondis, barre de défilement, bordures) :
 * - grand écran (≥ 900 px) : côté ≥ min(H, L) - MARGIN, où
 *   H = hauteur de la fenêtre - barre de navigation - barres joueur de l'écran - 24 px (padding),
 *   L = largeur - 32 px (padding) - 24 px (écart) - 300 px (panneau minimal) - barre d'évaluation ;
 *   et la page ne défile pas verticalement (tout tient dans la fenêtre) ;
 * - téléphone (< 900 px) : côté ≥ largeur - 16 px (gouttières) - 8 px, plateau dans l'écran.
 * Captures dans test-results/board-size-*.png.
 */
const MARGIN = 40;

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
] as const;

interface Screen {
  name: string;
  /** Hauteur réservée aux barres joueur au-dessus et au-dessous du plateau (grand écran). */
  bars: number;
  /** Largeur réservée à la barre d'évaluation (grand écran). */
  evalWidth: number;
  open: (page: Page) => Promise<void>;
}

async function signUp(page: Page, prefix: string) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`${prefix}${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('my-rating')).toBeVisible();
}

const SCREENS: Screen[] = [
  {
    name: 'partie',
    bars: 2 * (48 + 8),
    evalWidth: 0,
    open: async (page) => {
      const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
      await bot.getByTestId('level-1').click();
      await bot.getByRole('button', { name: 'Blancs' }).click();
      await bot.getByRole('button', { name: 'Sans pendule' }).click();
      await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
      await expect(page.getByTestId('turn-banner')).toBeVisible();
    },
  },
  {
    name: 'puzzles',
    bars: 0,
    evalWidth: 0,
    open: async (page) => {
      await page.goto('/#/puzzles');
      await expect(page.getByTestId('puzzle-rating')).toBeVisible();
    },
  },
  {
    name: 'analyse',
    // Onglets au-dessus (≈ 60 px), pas de barres de noms sur l'échiquier libre.
    bars: 60,
    evalWidth: 38,
    open: async (page) => {
      await page.goto('/#/analyse/board');
      await expect(page.getByTestId('analysis-board')).toBeVisible();
    },
  },
  {
    name: 'lecon',
    bars: 0,
    evalWidth: 0,
    open: async (page) => {
      await page.goto('/#/lessons/routine');
      await page.getByTestId('start-exercises').click();
      await expect(page.getByTestId('exercise-status')).toBeVisible();
    },
  },
  {
    name: 'ouvertures',
    bars: 0,
    evalWidth: 0,
    open: async (page) => {
      await page.goto('/#/openings');
      await page.getByTestId('opening-train-w-legal').click();
      await expect(page.getByTestId('opening-status')).toBeVisible();
    },
  },
];

for (const vp of VIEWPORTS) {
  test(`plateau maximal à ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(vp);
    await signUp(page, 'bs');
    const mobile = vp.width < 900;

    for (const screen of SCREENS) {
      await page.goto('/#/');
      await expect(page.getByTestId('my-rating')).toBeVisible();
      await screen.open(page);
      const board = page.getByTestId('board');
      await expect(board).toBeVisible();
      // Fin des transitions de mise en page.
      await page.waitForTimeout(200);
      const box = await board.boundingBox();
      if (!box) throw new Error('plateau introuvable');
      const navBottom = await page
        .locator('.nav-bar')
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: `test-results/board-size-${vp.width}-${screen.name}.png` });

      const label = `${screen.name} ${vp.width}×${vp.height}`;
      if (mobile) {
        expect(box.width, label).toBeGreaterThanOrEqual(vp.width - 16 - 8);
        expect(box.x, label).toBeGreaterThanOrEqual(4);
        expect(box.x + box.width, label).toBeLessThanOrEqual(vp.width - 4);
        // Plateau entièrement visible sous la navigation à l'arrivée sur l'écran.
        expect(box.y, label).toBeGreaterThanOrEqual(navBottom - 1);
      } else {
        const availH = vp.height - navBottom - screen.bars - 24;
        const availW = vp.width - 32 - 24 - 300 - screen.evalWidth;
        expect(box.width, label).toBeGreaterThanOrEqual(Math.min(availH, availW) - MARGIN);
        // Rien ne déborde : ni la page, ni le plateau sous le bas de la fenêtre.
        expect(docHeight, label).toBeLessThanOrEqual(vp.height + 1);
        expect(box.y + box.height, label).toBeLessThanOrEqual(vp.height);
      }
    }
  });
}
