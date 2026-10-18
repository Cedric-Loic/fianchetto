import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Captures de contrôle des finitions (lot 2), bureau et téléphone : fin de partie (victoire avec
 * célébration, défaite avec écart d'Elo), mode concentration et sa barre d'actions, puzzles
 * (éclair, série, classement), carte « Partie en cours », menu du compte, barre d'éval chiffrée.
 * Lancé seulement à la demande :
 *   FIANCHETTO_SHOTS=/chemin/du/dossier pnpm test:e2e tests/e2e/screenshots-lot2.spec.ts
 */
const OUT = process.env.FIANCHETTO_SHOTS;

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function hotseatClassic(page: Page) {
  await page.goto('/');
  await page.getByTestId('variant-classic').click();
  const seat = page.locator('.home-panel', { hasText: 'À deux sur cet écran' });
  await seat.getByLabel('Blancs').fill('Alice');
  await seat.getByLabel('Noirs').fill('Bob');
  await seat.getByRole('button', { name: 'Sans pendule' }).click();
  await seat.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();
}

test('captures du lot 2 (bureau et téléphone)', async ({ page }) => {
  test.skip(!OUT, 'captures à la demande (FIANCHETTO_SHOTS)');
  test.setTimeout(240_000);
  const dir = OUT ?? '';
  mkdirSync(dir, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

  for (const [label, width, height] of [
    ['bureau', 1366, 768],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    // Un compte neuf par format : puzzles jamais vus, Elo de départ.
    await page.context().clearCookies();
    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
    await page.getByLabel('Pseudo').fill(`lot${Date.now() % 1_000_000_000}`);
    await page.getByLabel('Mot de passe').fill('motdepasse');
    await page.getByRole('button', { name: "S'inscrire" }).click();
    await expect(page.getByTestId('my-rating')).toBeVisible();

    // Victoire (mat du berger inversé, à deux) : bandeau or et éclats en vol.
    await hotseatClassic(page);
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ] as const) {
      await clickSquare(page, from);
      await clickSquare(page, to);
    }
    await expect(page.getByTestId('end-banner')).toContainText('Victoire');
    await page.waitForTimeout(500);
    await shot(`fin-victoire-${label}`);
    await page.waitForTimeout(2600);
    await shot(`fin-victoire-apres-${label}`);

    // Mode concentration : barre d'actions, puis confirmation d'abandon.
    await hotseatClassic(page);
    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await page.getByTestId('focus-button').click();
    await expect(page.getByTestId('focus-actions')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(`plein-ecran-${label}`);
    await page.getByTestId('focus-actions').getByRole('button', { name: 'Abandonner' }).click();
    await page.waitForTimeout(200);
    await shot(`plein-ecran-abandon-${label}`);
    await page.getByRole('button', { name: 'Continuer la partie' }).click();
    await page.getByTitle('Quitter le mode concentration (Échap)').click();

    // Partie contre le bot : panneau « À toi de jouer », puis carte d'accueil, puis défaite
    // par abandon avec écart d'Elo.
    await page.goto('/');
    const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
    await bot.getByTestId('level-1').click();
    await bot.getByRole('button', { name: 'Blancs' }).click();
    await bot.getByRole('button', { name: 'Sans pendule' }).click();
    await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
    await expect(page.getByTestId('turn-banner')).toContainText('À toi de jouer');
    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
      timeout: 20_000,
    });
    await shot(`partie-bot-${label}`);
    const gameUrl = page.url();
    await page.goto('/');
    await expect(page.getByTestId('resume-opponent')).toBeVisible();
    await shot(`accueil-reprise-${label}`);
    await page.goto(gameUrl);
    await page.getByTestId('resign').click();
    await page.getByTestId('confirm-resign').click();
    await expect(page.getByTestId('end-banner')).toContainText('Défaite');
    await page.waitForTimeout(1600);
    await shot(`fin-defaite-${label}`);

    // Puzzles : base de démonstration des tests (fourchette T0002 ratée, puis réussite).
    await page.goto('/#/puzzles');
    await page.getByTestId('puzzle-mode-theme').click();
    await page.getByTestId('puzzle-theme').selectOption('hangingPiece');
    await expect(page.locator('img[data-square="d8"]')).toHaveAttribute('alt', 'bk');
    await shot(`puzzles-${label}`);
    await clickSquare(page, 'c3');
    await clickSquare(page, 'e5');
    await expect(page.getByTestId('puzzle-status')).toContainText('Réussi');
    await page.waitForTimeout(250);
    await shot(`puzzles-reussi-${label}`);
    await page.getByTestId('puzzle-theme').selectOption('fork');
    await expect(page.locator('img[data-square="h6"]')).toHaveCount(1);
    await clickSquare(page, 'b5');
    await clickSquare(page, 'd6');
    await expect(page.getByTestId('puzzle-status')).toContainText("Ce n'est pas le bon coup");
    await page.waitForTimeout(150);
    await shot(`puzzles-rate-${label}`);

    // Menu du compte.
    await page.goto('/');
    if (label === 'mobile') await page.getByTestId('nav-toggle').click();
    await page.getByTestId('nav-user').click();
    await shot(`menu-compte-${label}`);
  }
});
