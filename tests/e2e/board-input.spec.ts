import { expect, test, type Page } from '@playwright/test';

/** Centre d'une case, plateau vu des Blancs (les puzzles T0002/T0003 se jouent avec les Blancs). */
async function center(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  return { x: box.x + (x + 0.5) * size, y: box.y + (y + 0.5) * size };
}

async function clickSquare(page: Page, square: string) {
  const { x, y } = await center(page, square);
  await page.mouse.click(x, y);
}

test('puzzle : clic droit pendant un glisser annule, premove pendant la réponse adverse', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`bi${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Puzzles' }).click();
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

  // T0002 : après …h6 (animé), Cc7+ Rd7 Cxa8.
  await expect(page.locator('img[data-square="h6"]')).toHaveCount(1);

  // Glisser le cavalier b5 vers d6, clic droit en plein glisser : tout est annulé, le cavalier
  // revient en b5 et rien n'est joué (sinon d6 ferait rater le puzzle).
  const b5 = await center(page, 'b5');
  const d6 = await center(page, 'd6');
  await page.mouse.move(b5.x, b5.y);
  await page.mouse.down();
  await page.mouse.move(d6.x, d6.y, { steps: 6 });
  await expect(page.locator('img.piece.dragging')).toHaveCount(1);
  await page.mouse.down({ button: 'right' });
  await expect(page.locator('img.piece.dragging')).toHaveCount(0);
  await page.mouse.up();
  await page.mouse.up({ button: 'right' });
  await page.mouse.move(0, 0);
  await expect(page.locator('img[data-square="b5"]')).toHaveAttribute('alt', 'wn');
  await expect(page.locator('.sq.selected')).toHaveCount(0);
  await expect(page.getByTestId('arrows')).toHaveCount(0);
  await expect(page.getByTestId('puzzle-status')).toContainText('À toi');

  // Cc7+, puis premove Cc7xa8 pendant la réponse adverse : il part tout seul et résout le puzzle.
  await clickSquare(page, 'b5');
  await clickSquare(page, 'c7');
  await clickSquare(page, 'c7');
  await clickSquare(page, 'a8');
  await expect(page.locator('.sq.premove')).toHaveCount(2);
  await expect(page.locator('img[data-square="a8"]')).toHaveAttribute('alt', 'wn');
  await expect(page.getByTestId('puzzle-status')).toContainText('Réussi');
  await expect(page.locator('.sq.premove')).toHaveCount(0);
  await expect(page.locator('img[data-square="a8"]')).toHaveAttribute('alt', 'wn');
  await page.screenshot({ path: 'test-results/puzzle-premove.png' });
});
