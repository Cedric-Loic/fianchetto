import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('puzzle par thème : coup adverse animé, échec puis solution, réussite classée', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`pz${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Puzzles' }).click();
  await expect(page.getByTestId('puzzle-rating')).toContainText('1500');
  // Base de démonstration des tests : sinon (serveur de dev déjà lancé), test sauté.
  await page.getByTestId('puzzle-mode-theme').click();
  // Thème sans puzzle d'abord (au cas où « Fourchette » serait déjà le thème du jour).
  await page.getByTestId('puzzle-theme').selectOption('mateIn3');
  await expect(page.getByTestId('puzzle-status')).toContainText('Aucun puzzle');
  const forkResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/puzzles/next') && (r.request().postData() ?? '').includes('"fork"'),
  );
  await page.getByTestId('puzzle-theme').selectOption('fork');
  const body = (await (await forkResponse).json()) as { attempt?: { puzzleId: string } };
  test.skip(body.attempt?.puzzleId !== 'T0002', 'base de puzzles réelle');

  // T0002 : après …h6, la fourchette Nc7+ gagne la tour. On se trompe d'abord.
  await expect(page.locator('img[data-square="h6"]')).toHaveCount(1);
  await clickSquare(page, 'b5');
  await clickSquare(page, 'd6');
  await expect(page.getByTestId('puzzle-status')).toContainText("Ce n'est pas le bon coup");
  await page.getByTestId('show-solution').click();
  await expect(page.locator('img[data-square="a8"]')).toHaveAttribute('alt', 'wn', {
    timeout: 5000,
  });

  // Puzzle suivant du thème « Pièce en prise » : réussi, classement en hausse.
  await page.getByTestId('puzzle-theme').selectOption('hangingPiece');
  await expect(page.locator('img[data-square="d8"]')).toHaveAttribute('alt', 'bk');
  await clickSquare(page, 'c3');
  await expect(page.getByTestId('legal-hint').first()).toBeVisible();
  await clickSquare(page, 'e5');
  await expect(page.getByTestId('puzzle-status')).toContainText('Réussi');
  await expect(page.getByTestId('puzzle-mode-review')).toContainText('(0)');
  await page.screenshot({ path: 'test-results/puzzles.png' });
});
