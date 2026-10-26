import { expect, test, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page
    .getByLabel('Pseudo')
    .fill(`le${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1000)}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

async function clickSquare(page: Page, square: string, black = false) {
  const board = page.getByTestId('exercises').getByTestId('board');
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const file = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const rank = Number(square[1]);
  // Plateau retourné quand les Noirs ont le trait.
  const x = black ? 7 - file : file;
  const y = black ? rank - 1 : 8 - rank;
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('leçon : explications, six exercices réussis, leçon validée', async ({ page }) => {
  await register(page);

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
  for (const [squares, black] of [
    [['e5', 'h4'], false],
    [['e4', 'g4'], true],
    [['e5'], false],
  ] as const) {
    for (const sq of squares) await clickSquare(page, sq, black);
    await page.getByTestId('squares-validate').click();
    await expect(status).toContainText('Réussi', { timeout: 15_000 });
    await page.getByTestId('next-exercise').click();
  }
  await expect(page.getByTestId('lesson-result')).toContainText('6 / 6');
  await expect(page.getByTestId('lesson-result')).toContainText('Leçon validée');

  await page.getByRole('link', { name: 'Leçons', exact: true }).last().click();
  await expect(page.getByTestId('lesson-routine')).toContainText('Validée');
});

test('exercice de cases : indice, mauvaise réponse corrigée', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await register(page);
  await page.goto('/#/lessons/routine?exercise=3');
  await expect(page.getByText('Désigne-les')).toBeVisible();
  await expect(page.getByTestId('exercise-explanation')).toHaveCount(0);
  await page.getByTestId('exercise-hint').click();
  await expect(page.getByTestId('hint-list').locator('li')).toHaveCount(1);
  await clickSquare(page, 'e5');
  await clickSquare(page, 'h4');
  await clickSquare(page, 'a7');
  await clickSquare(page, 'a7'); // re-clic : retirée
  await expect(page.getByTestId('square-mark')).toHaveCount(2);
  await page.getByTestId('exercise-hint').click();
  await page.screenshot({ path: 'test-results/lecon-squares.png' });
  await page.getByTestId('squares-validate').click();
  await expect(page.getByTestId('exercise-status')).toContainText('Réussi');
  // Mauvaise réponse : les bonnes cases sont révélées avec l'explication.
  await page.goto('/#/lessons/routine?exercise=5');
  await clickSquare(page, 'd4');
  await page.getByTestId('squares-validate').click();
  await expect(page.getByTestId('exercise-status')).toContainText('Pas tout à fait');
  await expect(page.getByTestId('exercise-explanation')).toBeVisible();
  await expect(page.getByTestId('square-mark')).toHaveCount(1);
});

test('partie commentée : suivant, précédent, liste des coups', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await register(page);
  await page.goto('/#/lessons/routine');
  const walk = page.getByTestId('walkthrough');
  await walk.scrollIntoViewIfNeeded();
  await expect(walk).toContainText('Coup 0 /');
  await page.getByTestId('walkthrough-next').click();
  await expect(walk).toContainText('Coup 1 /');
  await expect(page.getByTestId('walkthrough-comment')).toContainText('e4');
  await page.getByTestId('walkthrough-next').click();
  await page.getByTestId('walkthrough-prev').click();
  await expect(walk).toContainText('Coup 1 /');
  await page.keyboard.press('ArrowRight');
  await expect(walk).toContainText('Coup 2 /');
  await page.getByTestId('walkthrough-moves').locator('button').nth(3).click();
  await expect(walk).toContainText('Coup 4 /');
  await page.screenshot({ path: 'test-results/lecon-walkthrough.png' });
});
