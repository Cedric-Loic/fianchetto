import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Captures d'écran de contrôle visuel (bureau 1366 × 768 et téléphone 390 × 844) : accueil,
 * partie, revue, échiquier d'analyse, puzzles, coach, leçons. Lancé seulement à la demande :
 *   FIANCHETTO_SHOTS=/chemin/du/dossier pnpm test:e2e tests/e2e/screenshots.spec.ts
 */
const OUT = process.env.FIANCHETTO_SHOTS;

const PGN = `[Event "Live Chess"]
[Date "2026.10.01"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
`;

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('captures d’écran (bureau et téléphone)', async ({ page }) => {
  test.skip(!OUT, 'captures à la demande (FIANCHETTO_SHOTS)');
  test.setTimeout(180_000);
  const dir = OUT ?? '';
  mkdirSync(dir, { recursive: true });
  const shot = async (name: string, fullPage = false) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
  };

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`ui${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('my-rating')).toBeVisible();

  // Revue : une partie importée et analysée.
  await page.goto('/#/analyse');
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('move-list').locator('button.move', { hasText: 'Nxe5' }).first().click();
  const reviewUrl = page.url();

  // Partie contre le bot, quelques coups.
  await page.goto('/');
  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });
  const gameUrl = page.url();

  const pages: [string, string, () => Promise<void>][] = [
    ['accueil', '/', () => expect(page.getByTestId('coach-banner')).toBeVisible()],
    [
      'partie',
      gameUrl,
      () => expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2),
    ],
    ['revue', reviewUrl, () => expect(page.getByTestId('move-card')).toBeVisible()],
    [
      'echiquier',
      '/#/analyse/board',
      () => expect(page.getByTestId('analysis-board')).toBeVisible(),
    ],
    ['puzzles', '/#/puzzles', () => expect(page.getByTestId('puzzle-status')).toBeVisible()],
    ['coach', '/#/coach', () => expect(page.getByTestId('coach-phase')).toBeVisible()],
    ['lecons', '/#/lessons', () => expect(page.getByTestId('lesson-routine')).toBeVisible()],
    ['lecon', '/#/lessons/routine', () => expect(page.getByTestId('exercises')).toBeVisible()],
    ['classement', '/#/leaderboard', () => expect(page.locator('h2')).toBeVisible()],
  ];
  for (const [label, width, height] of [
    ['bureau', 1366, 768],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [name, url, ready] of pages) {
      await page.goto(url);
      await ready();
      await shot(`${name}-${label}`);
      if (name !== 'partie') await shot(`${name}-${label}-complet`, true);
    }
    if (label === 'mobile') {
      await page.goto('/');
      await page.getByTestId('nav-toggle').click();
      await shot('menu-mobile');
    }
  }
});
