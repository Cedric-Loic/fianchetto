import { expect, test, type Page } from '@playwright/test';

/** Clique au centre d'une case (plateau orienté Blancs en bas). */
async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('classique à deux : coups possibles (réglage), mat, fin sans révélation, analyse', async ({
  page,
}) => {
  await page.goto('/');
  // La variante classique est celle par défaut.
  await expect(page.getByTestId('variant-classic')).toHaveAttribute('aria-selected', 'true');
  const seat = page.locator('.home-panel', { hasText: 'À deux sur cet écran' });
  await seat.getByLabel('Blancs').fill('Alice');
  await seat.getByLabel('Noirs').fill('Bob');
  await seat.getByRole('button', { name: 'Sans pendule' }).click();
  await seat.getByRole('button', { name: 'Jouer', exact: true }).click();

  // Pas de choix secret : la partie commence tout de suite.
  await expect(page.getByTestId('move-list')).toBeVisible();
  await expect(page.getByTestId('handoff')).toHaveCount(0);
  await expect(page.getByTestId('peek')).toHaveCount(0);

  // Coups possibles du pion e2 : e3 et e4.
  await clickSquare(page, 'e2');
  await expect(page.getByTestId('legal-hint')).toHaveCount(2);
  // Réglage désactivé : plus aucun marquage.
  await page.getByTestId('settings').click();
  await page.getByTestId('setting-legal-moves').uncheck();
  await expect(page.getByTestId('legal-hint')).toHaveCount(0);
  await page.getByTestId('setting-legal-moves').check();
  await page.getByTestId('settings').click();

  const played = async (from: string, to: string, n: number) => {
    await clickSquare(page, from);
    await clickSquare(page, to);
    await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(n);
  };
  await played('f2', 'f3', 1);
  await played('e7', 'e5', 2);
  await played('g2', 'g4', 3);
  await played('d8', 'h4', 4);
  await expect(page.getByTestId('move-list')).toContainText('Qh4#');

  const modal = page.getByTestId('end-modal');
  await expect(modal).toContainText('Bob (Noirs) gagne par échec et mat');
  await expect(modal).not.toContainText('dames secrètes');
  await page.getByRole('button', { name: 'Voir le plateau' }).click();
  await page.getByRole('button', { name: /Analyser la partie/ }).click();
  await expect(page.getByTestId('analysis')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/classique-analyse.png' });
});

test('classique contre le bot : partie classée, Elo classique séparé', async ({ page }) => {
  const username = `cl${Date.now() % 1_000_000_000}`;
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(username);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('my-rating')).toContainText('Classique : 1200');

  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();
  await expect(page.getByTestId('secret-marker')).toHaveCount(0);

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '⚑ Abandonner' }).click();
  await expect(page.getByTestId('elo-change')).toContainText('Elo Classique : 1200 →');

  await page.goto(`/#/profile/${username}`);
  await expect(page.getByTestId('rating-classic')).toContainText('1 partie classée');
  await expect(page.getByTestId('rating-secret-queen')).toContainText('1200');
  await expect(page.getByRole('cell', { name: 'Classique' })).toBeVisible();
});
