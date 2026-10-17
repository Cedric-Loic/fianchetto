import { expect, test, type Page } from '@playwright/test';

/** Clique au centre d'une case (plateau orienté Blancs en bas). */
async function clickSquare(page: Page, square: string, orientation: 'w' | 'b' = 'w') {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const file = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const rank = Number(square[1]) - 1;
  const x = orientation === 'w' ? file : 7 - file;
  const y = orientation === 'w' ? 7 - rank : rank;
  const size = box.width / 8;
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('partie hot-seat complète : choix secrets, passage, mat par la dame secrète, révélation', async ({
  page,
}) => {
  await page.goto('/');
  const seat = page.locator('.home-panel', { hasText: 'À deux sur cet écran' });
  await seat.getByLabel('Blancs').fill('Alice');
  await seat.getByLabel('Noirs').fill('Bob');
  await seat.getByRole('button', { name: 'Sans pendule' }).click();
  await seat.getByRole('button', { name: 'Jouer', exact: true }).click();

  // Écran de passage Blancs : le plateau n'est pas visible.
  await expect(page.getByTestId('handoff')).toContainText('Alice (Blancs)');
  await expect(page.getByTestId('board')).toHaveCount(0);
  await page.getByRole('button', { name: 'Je suis prêt' }).click();
  await clickSquare(page, 'e2', 'w');
  await page.getByRole('button', { name: 'Confirmer' }).click();

  // Écran de passage Noirs, plateau caché ; les Noirs choisissent sur un plateau orienté Noirs.
  await expect(page.getByTestId('handoff')).toContainText('Bob (Noirs)');
  await expect(page.getByTestId('board')).toHaveCount(0);
  await page.getByRole('button', { name: 'Je suis prêt' }).click();
  await clickSquare(page, 'd7', 'b');
  await page.getByRole('button', { name: 'Confirmer' }).click();

  // Partie : aucun marqueur de dame visible sans maintenir le bouton.
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('secret-marker')).toHaveCount(0);

  // Bouton « Voir ma dame secrète » (Blancs au trait) : visible seulement pendant le maintien.
  const peek = page.getByTestId('peek');
  await peek.hover();
  await page.mouse.down();
  await expect(page.locator('[data-testid="secret-marker"]')).toHaveCount(1);
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await expect(page.getByTestId('secret-marker')).toHaveCount(0);

  const played = async (from: string, to: string, n: number) => {
    await clickSquare(page, from);
    await clickSquare(page, to);
    await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(n);
  };
  await played('a2', 'a3', 1);
  await played('f7', 'f6', 2);
  await played('a3', 'a4', 3);
  await played('g7', 'g5', 4);

  // Coup illégal : message générique, rien ne bouge.
  await clickSquare(page, 'b1');
  await clickSquare(page, 'b4');
  await expect(page.getByText('Coup illégal.')).toBeVisible();
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(4);

  // La dame secrète (affichée pion en e2) mate en diagonale : notée en coordonnées.
  await played('e2', 'h5', 5);
  await expect(page.getByTestId('move-list')).toContainText('e2-h5#');

  // Fin : révélation des deux dames.
  const modal = page.getByTestId('end-modal');
  await expect(modal).toContainText('Alice (Blancs) gagne par échec et mat');
  await expect(page.getByTestId('reveal-w')).toContainText('e2');
  await expect(page.getByTestId('reveal-w')).toContainText('h5');
  await expect(page.getByTestId('reveal-b')).toContainText('d7');
  await page.screenshot({ path: 'test-results/hotseat-fin.png' });
});
