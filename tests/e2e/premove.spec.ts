import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('premove pendant la réflexion du bot, joué automatiquement à mon tour', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`pm${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-5').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await clickSquare(page, 'a2');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  // Écran de partie affiché (le plateau de sélection a disparu).
  await expect(page.getByTestId('move-list')).toBeVisible();

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(1);
  // Premoves enchaînés (Cg1-f3 puis Cf3-g5) puis clic droit : tout est annulé, le cavalier
  // revient en g1.
  await clickSquare(page, 'g1');
  await clickSquare(page, 'f3');
  await clickSquare(page, 'f3');
  await clickSquare(page, 'g5');
  await expect(page.locator('img[data-square="g5"]')).toHaveAttribute('alt', 'wn');
  await expect(page.locator('.sq.premove')).toHaveCount(3);
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await expect(page.locator('.sq.premove')).toHaveCount(0);
  await expect(page.locator('img[data-square="g1"]')).toHaveAttribute('alt', 'wn');

  // Pendant que le bot réfléchit : premove Cg1-f3 (cases marquées en rouge).
  await clickSquare(page, 'g1');
  await clickSquare(page, 'f3');
  await expect(page.locator('.sq.premove')).toHaveCount(2);
  // Le bot joue, puis le premove part tout seul : joué, ou refusé avec le message générique
  // s'il est devenu illégal (par exemple si la dame secrète du bot vient de donner échec).
  await expect
    .poll(
      async () =>
        (await page.getByTestId('move-list').innerText()).includes('Nf3') ||
        (await page.getByText('Coup illégal.').isVisible()),
      { timeout: 20_000 },
    )
    .toBe(true);
  await expect(page.locator('.sq.premove')).toHaveCount(0);
});
