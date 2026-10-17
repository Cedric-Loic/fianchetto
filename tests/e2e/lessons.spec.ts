import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const board = page.getByTestId('exercises').getByTestId('board');
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('leçon : explications, trois exercices réussis, leçon validée', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`le${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Leçons' }).click();
  await page.getByTestId('lesson-routine').click();
  await expect(page.getByRole('heading', { name: /La routine anti-gaffe/ })).toBeVisible();
  await expect(page.getByText('Les trois questions')).toBeVisible();
  await page.screenshot({ path: 'test-results/lecon.png', fullPage: true });

  await page.getByTestId('start-exercises').click();
  const status = page.getByTestId('exercise-status');
  for (const [from, to] of [
    ['d1', 'd5'],
    ['a3', 'b4'],
    ['h2', 'h3'],
  ] as const) {
    await clickSquare(page, from);
    await clickSquare(page, to);
    await expect(status).toContainText('Réussi', { timeout: 15_000 });
    await expect(page.getByTestId('exercise-explanation')).toBeVisible();
    await page.getByTestId('next-exercise').click();
  }
  await expect(page.getByTestId('lesson-result')).toContainText('3 / 3');
  await expect(page.getByTestId('lesson-result')).toContainText('Leçon validée');

  await page.getByRole('link', { name: 'Leçons', exact: true }).last().click();
  await expect(page.getByTestId('lesson-routine')).toContainText('Validée');
});
