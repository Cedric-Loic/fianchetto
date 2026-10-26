import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`tr${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

test('entraînement : non classée, indices progressifs, reprise de coup', async ({ page }) => {
  await register(page);
  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByTestId('training-toggle').check();
  // Pas de pendule en entraînement.
  await expect(bot.getByRole('button', { name: 'Sans pendule' })).toHaveCount(0);
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await expect(page.getByTestId('training-panel')).toBeVisible();
  await expect(page.getByText('Entraînement', { exact: true })).toBeVisible();

  // Indices : l'idée, puis la pièce (case surlignée), puis le coup (flèche).
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('hint-text')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('hint-text')).toContainText('Joue ton');
  await expect(page.locator('.sq.selected')).toHaveCount(1);
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('hint-text')).toContainText('Le meilleur coup');
  await expect(page.locator('[data-testid="arrows"] line')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/entrainement-indice.png' });

  // Un coup, la réponse du bot, puis reprise : retour à la position initiale.
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  const moves = page.getByTestId('move-list').locator('button.move');
  await expect(moves).toHaveCount(2, { timeout: 20_000 });
  await page.getByTestId('takeback').click();
  await expect(moves).toHaveCount(0);
  await expect(page.locator('img[data-square="e2"]')).toHaveAttribute('alt', 'wp');
});

test('garde-fou avant une gaffe, mat, bilan du coach', async ({ page }) => {
  // Partie coachée désactivée : ce test porte sur le garde-fou, pas sur les questions du coach.
  await page.addInitScript(() => localStorage.setItem('sq-settings', '{"coached":false}'));
  await register(page);
  // Coup du berger, Blancs au trait : Qxf7# gagne, Qg4 ?? perd la dame.
  const res = await page.request.post('/api/games', {
    data: {
      mode: 'bot',
      variant: 'classic',
      level: 1,
      timeControl: 'untimed',
      color: 'w',
      training: true,
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    },
  });
  const { gameId } = (await res.json()) as { gameId: string };
  await page.goto(`/#/game/${gameId}`);
  await expect(page.getByTestId('training-panel')).toBeVisible();

  // Indice de niveau 1 : l'idée et la zone à regarder (le roi à mater), sans le coup.
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('hint-text')).toContainText('mat en 1', { timeout: 15_000 });
  await expect(page.locator('[data-testid="square-mark"][data-square="e8"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="arrows"] line')).toHaveCount(0);

  await clickSquare(page, 'h5');
  await clickSquare(page, 'g4');
  await expect(page.getByTestId('guard')).toContainText('La dame jouée en g4 est en prise', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Je cherche un autre coup' }).click();
  await expect(page.locator('img[data-square="h5"]')).toHaveAttribute('alt', 'wq');

  await clickSquare(page, 'h5');
  await clickSquare(page, 'f7');
  const modal = page.getByTestId('end-modal');
  await expect(modal).toContainText('gagne par échec et mat', { timeout: 15_000 });
  // Les marques de l'indice disparaissent au coup suivant.
  await expect(page.getByTestId('square-mark')).toHaveCount(0);
  await expect(page.getByTestId('elo-change')).toHaveCount(0);
  await modal.getByRole('link', { name: /Revue de la partie/ }).click();
  await expect(page.getByTestId('coach-summary')).toContainText('Aucune erreur notable', {
    timeout: 60_000,
  });
});
