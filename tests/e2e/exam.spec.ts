import { expect, test, type Page } from '@playwright/test';

/*
 * Examens de palier et mini-test de finales. Les routes /api/exams sont simulées (page.route) pour
 * un jeu de questions connu ; les questions sont de vrais exercices de la leçon « routine », donc
 * jugés par les routes réelles des leçons (le serveur reste juge) : exercices 0, 1, 2 (coup) et
 * 3, 5 (cases).
 */

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page
    .getByLabel('Pseudo')
    .fill(`ex${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1000)}`);
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
  const x = black ? 7 - file : file;
  const y = black ? rank - 1 : 8 - rank;
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

const summary = (stage: number, over: Record<string, unknown> = {}) => ({
  stage,
  best: null,
  total: 20,
  passed: false,
  available: true,
  miniPassed: false,
  ...over,
});

/** Simule GET /api/exams et POST /api/exams/1/start|result ; renvoie les résultats postés. */
async function mockExams(page: Page, summaries = [summary(1), summary(2), summary(3)]) {
  const posted: unknown[] = [];
  const { exercises } = (await (await page.request.get('/api/lessons/routine')).json()) as {
    exercises: unknown[];
  };
  const q = (index: number, skill: string) => ({
    lesson: 'routine',
    index,
    skill,
    exercise: exercises[index],
  });
  await page.route('**/api/exams', (route) => route.fulfill({ json: { exams: summaries } }));
  await page.route('**/api/exams/1/start', (route) =>
    route.fulfill({
      json: {
        stage: 1,
        kind: 'mini',
        questions: [
          q(0, 'piece-safety'),
          q(1, 'piece-safety'),
          q(2, 'threats'),
          q(3, 'forks'),
          q(5, 'forks'),
        ],
      },
    }),
  );
  await page.route('**/api/exams/1/result', (route) => {
    posted.push(route.request().postDataJSON());
    return route.fulfill({
      json: { exam: summary(1, { best: 8, miniPassed: false }), passedNow: false },
    });
  });
  return posted;
}

test('mini-test : cinq questions, bilan par compétence, solution cachée avant la réponse', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await register(page);
  const posted = await mockExams(page);

  await page.goto('/#/endgames');
  await expect(page.getByTestId('exam-mini-start')).toHaveText('Mini-test : 5 questions');
  await expect(page.getByTestId('exam-mini-passed')).toHaveCount(0);
  await page.getByTestId('exam-mini-start').click();

  const intro = page.getByTestId('exam-intro');
  await expect(intro).toContainText('5 questions');
  await expect(intro).toContainText('80 % pour valider');
  await expect(intro).toContainText('jamais bloquant');
  await page.screenshot({ path: 'test-results/exam-intro.png' });
  await page.getByTestId('exam-start').click();

  const status = page.getByTestId('exercise-status');
  const progress = page.getByTestId('exam-progress');
  const header = page.getByTestId('exam-header');

  // Questions 1 à 3 : coups réussis (la 3e après un clic maladroit, sans indice).
  for (const [n, from, to] of [
    [1, 'd1', 'd5'],
    [2, 'a3', 'b4'],
    [3, 'h2', 'h3'],
  ] as const) {
    await expect(progress).toHaveText(`Question ${n} / 5`);
    await expect(header.getByRole('meter')).toHaveAttribute('aria-valuenow', String(n - 1));
    // Ni explication ni solution avant la réponse.
    await expect(page.getByTestId('exercise-explanation')).toHaveCount(0);
    await expect(status).not.toContainText('solution');
    await expect(page.getByTestId('exam-next')).toHaveCount(0);
    if (n === 1) await page.screenshot({ path: 'test-results/exam-question.png' });
    await clickSquare(page, from);
    await clickSquare(page, to);
    await expect(status).toContainText('Réussi', { timeout: 15_000 });
    await expect(page.getByTestId('exam-score')).toHaveText(`Score : ${n} / ${n}`);
    await page.getByTestId('exam-next').click();
  }

  // Question 4 (cases) : réussie, mais avec un indice : elle ne compte pas du premier coup.
  await expect(progress).toHaveText('Question 4 / 5');
  await page.getByTestId('exercise-hint').click();
  await expect(page.getByTestId('hint-list').locator('li')).toHaveCount(1);
  await clickSquare(page, 'e5');
  await clickSquare(page, 'h4');
  await page.getByTestId('squares-validate').click();
  await expect(status).toContainText('Réussi', { timeout: 15_000 });
  await expect(page.getByTestId('exam-score')).toHaveText('Score : 3 / 4');
  await page.getByTestId('exam-next').click();

  // Question 5 : mauvaise réponse, corrigée après coup.
  await expect(progress).toHaveText('Question 5 / 5');
  await clickSquare(page, 'd4');
  await page.getByTestId('squares-validate').click();
  await expect(status).toContainText('Pas tout à fait', { timeout: 15_000 });
  await expect(page.getByTestId('exercise-explanation')).toBeVisible();
  await page.getByTestId('exam-next').click();
  await expect(page.getByTestId('exam-next')).toHaveCount(0);

  // Bilan : 3 / 5, à retravailler, compétence la plus faible mise en avant.
  await expect(page.getByTestId('exam-final-score')).toHaveText('3 / 5');
  await expect(page.getByTestId('exam-verdict')).toContainText('À retravailler');
  await expect(page.getByTestId('exam-skill-piece-safety')).toContainText('2 / 2');
  await expect(page.getByTestId('exam-skill-threats')).toContainText('1 / 1');
  await expect(page.getByTestId('exam-skill-forks')).toContainText('0 / 2');
  await expect(page.getByTestId('exam-skill-forks')).toHaveClass(/weakest/);
  await expect(page.getByTestId('exam-weakest')).toContainText('Fourchettes');
  await expect(page.getByTestId('exam-advice')).toHaveAttribute('href', /^#\/learn(\?module=.+)?$/);
  await expect(page.getByTestId('exam-saved')).toContainText('Meilleur score : 8 / 20');
  expect(posted).toEqual([{ kind: 'mini', correct: 3 }]);
  await page.screenshot({ path: 'test-results/exam-report.png', fullPage: true });

  // Refaire : on repart de la question 1 ; retour au parcours.
  await page.getByTestId('exam-restart').click();
  await expect(progress).toHaveText('Question 1 / 5');
  await page.getByRole('link', { name: "← Quitter l'examen" }).click();
  await expect(page).toHaveURL(/#\/endgames$/);
});

test('mini-test : tout juste, verdict réussi', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await register(page);
  const posted = await mockExams(page);
  await page.goto('/#/exam/1/mini');
  await page.getByTestId('exam-start').click();
  for (const [from, to] of [
    ['d1', 'd5'],
    ['a3', 'b4'],
    ['h2', 'h3'],
  ] as const) {
    await clickSquare(page, from);
    await clickSquare(page, to);
    await expect(page.getByTestId('exercise-status')).toContainText('Réussi', { timeout: 15_000 });
    await page.getByTestId('exam-next').click();
  }
  for (const squares of [['e5', 'h4'], ['e5']] as const) {
    for (const sq of squares) await clickSquare(page, sq);
    await page.getByTestId('squares-validate').click();
    await expect(page.getByTestId('exercise-status')).toContainText('Réussi', { timeout: 15_000 });
    await page.getByTestId('exam-next').click();
  }
  await expect(page.getByTestId('exam-final-score')).toHaveText('5 / 5');
  await expect(page.getByTestId('exam-verdict')).toContainText('Mini-test réussi');
  await expect(page.getByTestId('exam-weakest')).toHaveCount(0);
  expect(posted).toEqual([{ kind: 'mini', correct: 5 }]);
  await page.getByTestId('exam-back').click();
  await expect(page).toHaveURL(/#\/learn$/);
});

test('Apprendre : carte « Examen du palier » (jamais passé, meilleur score, validé, grisé)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await register(page);
  await mockExams(page, [
    summary(1, { best: 12 }),
    summary(2, { best: 18, passed: true }),
    summary(3, { available: false }),
  ]);
  await page.goto('/#/learn');
  await expect(page.getByTestId('exam-state-P1')).toHaveText('Meilleur score : 12 / 20');
  await expect(page.getByTestId('exam-start-P1')).toHaveAttribute('href', '#/exam/1');
  await page.screenshot({ path: 'test-results/exam-learn.png' });
  // Un palier à la fois : les autres cartes d'examen sont derrière leur onglet.
  await page.getByTestId('stage-tab-P2').click();
  await expect(page.getByTestId('exam-state-P2')).toContainText('✓ Validé');
  await page.getByTestId('stage-tab-P3').click();
  await expect(page.getByTestId('exam-start-P3')).toBeDisabled();
  await expect(page.getByTestId('exam-unavailable-P3')).toContainText('pas assez');
  await page.getByTestId('stage-tab-P1').click();
  await page.getByTestId('exam-start-P1').click();
  await expect(page).toHaveURL(/#\/exam\/1$/);
  await expect(page.getByTestId('exam-best')).toContainText('Meilleur score : 12 / 20');
});

test('Finales : badge « Mini-test réussi » une fois le mini-test validé', async ({ page }) => {
  await register(page);
  await mockExams(page, [summary(1, { miniPassed: true }), summary(2), summary(3)]);
  await page.goto('/#/endgames');
  await expect(page.getByTestId('exam-mini-passed')).toContainText('Mini-test réussi');
});

test('examen indisponible : message clair, sans plantage', async ({ page }) => {
  await register(page);
  await page.route('**/api/exams/2/start', (route) =>
    route.fulfill({ status: 409, json: { error: 'NOT_ENOUGH_EXERCISES' } }),
  );
  await page.goto('/#/exam/2');
  await page.getByTestId('exam-start').click();
  await expect(page.getByTestId('exam-error')).toContainText('pas assez');
});
