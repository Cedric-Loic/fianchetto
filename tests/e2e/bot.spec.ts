import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('compte, partie classée contre le bot, Elo mis à jour', async ({ page }) => {
  const username = `e2e${Date.now() % 1_000_000_000}`;
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(username);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toContainText(`${username} (1200)`);

  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();

  // Choix du pion secret : pas d'écran de passage, le bot est déjà prêt.
  await expect(page.getByTestId('opponent-ready')).toBeVisible();
  await clickSquare(page, 'd2');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();

  // Ma dame secrète est marquée en permanence (moi seul la vois).
  await expect(page.getByTestId('secret-marker')).toHaveCount(1);
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  // Le bot répond.
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '⚑ Abandonner' }).click();
  const modal = page.getByTestId('end-modal');
  await expect(modal).toContainText('gagne par abandon');
  await expect(page.getByTestId('elo-change')).toContainText('1200 →');
  await page.screenshot({ path: 'test-results/bot-fin.png' });

  await page.goto(`/#/profile/${username}`);
  await expect(page.getByText('Défaite')).toBeVisible();
});
