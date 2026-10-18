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

test('finale contre le bot : ouvrir depuis les leçons, le bot répond, échec puis Réessayer', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`fi${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Leçons' }).click();
  await page.getByTestId('lessons-endgames').click();
  await expect(page.getByRole('heading', { name: 'Finales contre le bot' })).toBeVisible();
  await expect(page.getByTestId('endgame-lucena')).toContainText('Position de Lucena');
  await page.getByTestId('endgame-play-lucena').click();

  // Partie d'entraînement depuis la position de Lucena, objectif affiché.
  await expect(page.getByTestId('endgame-goal')).toContainText('Position de Lucena');
  await expect(page.getByTestId('turn-banner')).toContainText('Entraînement');
  const firstGame = page.url();
  // Td1+ : le bot (Stockfish) répond.
  await clickSquare(page, 'c1');
  await clickSquare(page, 'd1');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 30_000,
  });

  await page.getByTestId('resign').click();
  await page.getByTestId('confirm-resign').click();
  const modal = page.getByTestId('end-modal');
  await expect(modal.getByTestId('endgame-verdict')).toContainText('Objectif non atteint');
  await modal.getByTestId('endgame-retry').click();
  await expect(page).not.toHaveURL(firstGame);
  await expect(page.getByTestId('endgame-goal')).toContainText('Position de Lucena');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(0);

  await page.goto('/#/endgames');
  await expect(page.getByTestId('endgame-lucena')).toContainText('1 essai');
});
