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
  await page.getByLabel('Pseudo').fill(`co${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

async function createGame(page: Page, data: Record<string, unknown>): Promise<string> {
  const res = await page.request.post('/api/games', { data });
  const { gameId } = (await res.json()) as { gameId: string };
  return gameId;
}

test('partie coachée : question, cases, réponse, continuer, une fois par position', async ({
  page,
}) => {
  await register(page);
  let prompts = 0;
  const answers: unknown[] = [];
  // Le serveur est simulé : une question à la position initiale, puis plus rien.
  await page.route('**/api/games/*/coach-prompt', async (route) => {
    prompts += 1;
    // Le mode strict de React peut doubler la première requête : on pose la question tant
    // qu'aucune réponse n'est arrivée.
    const prompt =
      answers.length === 0
        ? { ply: 0, kind: 'chance', question: 'Quelles cases contrôle ton fou en c1 ?' }
        : null;
    await route.fulfill({ json: { prompt } });
  });
  await page.route('**/api/games/*/coach-answer', async (route) => {
    answers.push(route.request().postDataJSON());
    await route.fulfill({
      json: { correct: false, squares: ['e3'], explanation: 'Le pion e3 est la seule case.' },
    });
  });
  const gameId = await createGame(page, {
    mode: 'bot',
    variant: 'classic',
    level: 1,
    timeControl: 'untimed',
    color: 'w',
    training: true,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/#/game/${gameId}`);
  const ask = page.getByTestId('coach-ask');
  await expect(ask).toContainText('Le coach te demande');
  await expect(page.getByTestId('coach-question')).toContainText('fou en c1');
  await expect(page.getByTestId('coach-validate')).toBeDisabled();

  // Pendant la question, un clic sélectionne une case (aucun coup joué).
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.locator('[data-testid="square-mark"].mark-pick')).toHaveCount(2);
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(0);
  await clickSquare(page, 'e4');
  await page.screenshot({ path: 'test-results/coach-question.png' });
  await page.getByTestId('coach-validate').click();

  expect(answers).toEqual([{ ply: 0, squares: ['e2'] }]);
  await expect(page.getByTestId('coach-verdict')).toContainText('Pas tout à fait');
  await expect(page.getByTestId('coach-explanation')).toContainText('pion e3');
  await expect(page.locator('[data-testid="square-mark"].mark-correct')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/coach-reponse.png' });
  await page.getByTestId('coach-continue').click();
  await expect(ask).toHaveCount(0);

  // La main est rendue ; la question n'est pas reposée pour cette position.
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });
  const afterAnswer = prompts;
  await page.waitForTimeout(1000);
  expect(prompts).toBe(afterAnswer);
  expect(answers).toHaveLength(1);
});

test('partie coachée : une erreur serveur ne bloque pas la partie', async ({ page }) => {
  await register(page);
  await page.route('**/api/games/*/coach-prompt', (route) =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } }),
  );
  const gameId = await createGame(page, {
    mode: 'bot',
    variant: 'classic',
    level: 1,
    timeControl: 'untimed',
    color: 'w',
    training: true,
  });
  await page.goto(`/#/game/${gameId}`);
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('coach-ask')).toHaveCount(0);
});

test('aucune question hors entraînement classique (Secret Queen, hot-seat, classée)', async ({
  page,
}) => {
  await register(page);
  let prompts = 0;
  await page.route('**/api/games/*/coach-prompt', async (route) => {
    prompts += 1;
    await route.fulfill({ json: { prompt: null } });
  });
  const games = [
    { mode: 'bot', variant: 'secret-queen', level: 1, timeControl: 'untimed', color: 'w' },
    { mode: 'bot', variant: 'classic', level: 1, timeControl: 'untimed', color: 'w' },
    {
      mode: 'hotseat',
      variant: 'classic',
      timeControl: 'untimed',
      whiteName: 'Alice',
      blackName: 'Bob',
    },
    {
      mode: 'hotseat',
      variant: 'secret-queen',
      timeControl: 'untimed',
      whiteName: 'Alice',
      blackName: 'Bob',
    },
  ];
  for (const g of games) {
    const gameId = await createGame(page, g);
    await page.goto(`/#/game/${gameId}`);
    await page.waitForTimeout(1500);
  }
  expect(prompts).toBe(0);
});
