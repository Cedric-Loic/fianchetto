import { expect, test, type Page } from '@playwright/test';

async function center(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  return { x: box.x + (x + 0.5) * size, y: box.y + (y + 0.5) * size, size };
}

async function startHotseat(page: Page) {
  await page.goto('/');
  await page.getByTestId('variant-secret-queen').click();
  const seat = page.locator('.home-panel', { hasText: 'À deux sur cet écran' });
  await seat.getByRole('button', { name: 'Sans pendule' }).click();
  await seat.getByRole('button', { name: 'Jouer', exact: true }).click();
  for (const sq of ['a2', 'a7']) {
    await page.getByRole('button', { name: 'Je suis prêt' }).click();
    const c = await center(page, sq === 'a2' ? 'a2' : 'h2'); // plateau noir retourné : a7 ↔ h2
    await page.mouse.click(c.x, c.y);
    await page.getByRole('button', { name: 'Confirmer' }).click();
  }
  await expect(page.getByTestId('move-list')).toBeVisible();
}

test('glisser-déposer : pièce centrée sous le pointeur, case survolée, dépôt immédiat', async ({
  page,
}) => {
  await startHotseat(page);
  const from = await center(page, 'e2');
  const to = await center(page, 'e4');
  await page.mouse.move(from.x + from.size * 0.3, from.y + from.size * 0.3); // prise excentrée
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  // Fantôme sur la case de départ, case visée encadrée, pièce centrée sur le pointeur.
  await expect(page.locator('.piece.ghost')).toHaveCount(1);
  await expect(page.locator('.sq.drag-over')).toHaveCount(1);
  const dragged = await page.locator('.piece.dragging').boundingBox();
  expect(Math.abs((dragged?.x ?? 0) + (dragged?.width ?? 0) / 2 - to.x)).toBeLessThan(3);
  await page.mouse.up();
  // La pièce est sur e4 tout de suite, sans revenir en e2.
  await expect(page.locator('img[data-square="e4"]')).toHaveCount(1);
  await expect(page.getByTestId('move-list')).toContainText('e4');
});

test('mode concentration : seul l’échiquier, croix pour revenir', async ({ page }) => {
  await startHotseat(page);
  await page.getByTestId('focus-button').click();
  await expect(page.getByTestId('focus')).toBeVisible();
  await expect(page.getByTestId('move-list')).toHaveCount(0);
  await expect(page.locator('.nav-bar')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/concentration.png' });
  await page.getByTitle('Quitter le mode concentration (Échap)').click();
  await expect(page.getByTestId('focus')).toHaveCount(0);
  await expect(page.getByTestId('move-list')).toBeVisible();
  await expect(page.locator('.nav-bar')).toHaveCount(1);
});
