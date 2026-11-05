import { expect, test, type Page } from '@playwright/test';

/*
 * Entraîneur de calcul (#/calc). Les routes /api/calc/* sont simulées (page.route) pour un
 * déroulé déterministe : profondeur, saisie au clic et au clavier, coup illégal, annulation,
 * question, résultat et solution rejouée. Un dernier test interroge le vrai serveur.
 */

const START = '6k1/p4ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
const SOLUTION = [
  { uci: 'h2h3', san: 'h3', fen: '6k1/p4ppp/8/8/8/7P/5PP1/3R2K1 b - - 0 1' },
  { uci: 'a7a6', san: 'a6', fen: '6k1/5ppp/p7/8/8/7P/5PP1/3R2K1 w - - 0 1' },
  { uci: 'g2g3', san: 'g3', fen: '6k1/5ppp/p7/8/8/6PP/5P2/3R2K1 b - - 0 1' },
];
const SAN: Record<string, string> = { h2h3: 'h3', a7a6: 'a6', g2g3: 'g3' };

const problem = (id: string, extra: object = {}) => ({
  id,
  fen: START,
  color: 'w',
  depth: 2,
  plies: 3,
  technique: 'forced',
  prompt: 'Les Blancs jouent : calcule la ligne forcée.',
  question: {
    text: 'Quelle pièce est la plus active à la fin de la ligne ?',
    options: ['Le roi noir', 'La tour blanche', 'Le pion a6'],
  },
  ...extra,
});

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

/** Simule les trois routes ; `problems` est consommé dans l'ordre. */
async function mockCalc(page: Page, problems: (object | null)[], legal: (uci: string) => boolean) {
  const queue = [...problems];
  const answers: unknown[] = [];
  await page.route('**/api/calc/next*', (route) =>
    route.fulfill({ json: { problem: queue.shift() ?? null } }),
  );
  await page.route('**/api/calc/*/step', (route) => {
    const { uci } = route.request().postDataJSON() as { uci: string };
    return route.fulfill({
      json: legal(uci) ? { legal: true, san: SAN[uci] ?? uci } : { legal: false, san: '' },
    });
  });
  await page.route('**/api/calc/*/answer', (route) => {
    const body = route.request().postDataJSON() as { line: string[]; answer: number };
    answers.push(body);
    return route.fulfill({
      json: {
        lineCorrect: body.line.join(',') === 'h2h3,a7a6,g2g3',
        answerCorrect: body.answer === 1,
        solution: SOLUTION,
        correctAnswer: 1,
        explanation: 'La tour contrôle la colonne d et le roi noir reste enfermé.',
      },
    });
  });
  return answers;
}

test('calcul : profondeur, saisie au clic et au clavier, question, résultat, solution', async ({
  page,
}) => {
  const answers = await mockCalc(page, [problem('c1'), problem('c2')], (uci) => uci in SAN);
  await page.goto('/#/calc');
  await expect(page.getByTestId('calc-depth')).toBeVisible();
  await page.getByTestId('calc-depth-2').click();
  await expect(page.getByTestId('calc')).toBeVisible();
  await expect(page.getByTestId('calc')).toContainText('Le plateau ne bouge pas');
  await expect(page.getByTestId('side-badge')).toContainText('Tu joues les Blancs');
  // Aucune solution dans le DOM avant la réponse.
  await expect(page.getByTestId('calc-solution')).toHaveCount(0);
  await expect(page.getByTestId('calc')).not.toContainText('Solution');

  // Premier coup au clic : la case de départ est surlignée, puis la ligne s'inscrit ; les
  // pièces ne bougent pas.
  await clickSquare(page, 'h2');
  await expect(page.locator('.square-mark[data-square="h2"]')).toHaveCount(1);
  await clickSquare(page, 'h3');
  await expect(page.getByTestId('calc-line-move')).toHaveText(['Toi : h3']);
  await expect(page.locator('img[data-square="h2"]')).toHaveAttribute('alt', 'wp');
  await expect(page.locator('img[data-square="h3"]')).toHaveCount(0);

  // Coup illégal saisi au clavier : message, on resaisit.
  await page.getByTestId('calc-input').fill('e2e4');
  await page.getByTestId('calc-input-submit').click();
  await expect(page.getByTestId('calc-message')).toHaveText('Coup illégal.');
  await expect(page.getByTestId('calc-line-move')).toHaveCount(1);
  // Format incorrect.
  await page.getByTestId('calc-input').fill('Nf3');
  await page.getByTestId('calc-input').press('Enter');
  await expect(page.getByTestId('calc-message')).toContainText('Format attendu');

  await page.getByTestId('calc-input').fill('a7a6');
  await page.getByTestId('calc-input').press('Enter');
  await expect(page.getByTestId('calc-line-move')).toHaveText(['Toi : h3', 'Adversaire : a6']);
  await clickSquare(page, 'g2');
  await clickSquare(page, 'g3');
  await expect(page.getByTestId('calc-line-move')).toHaveCount(3);

  // Ligne complète : la question apparaît ; annuler le dernier coup la fait disparaître.
  await expect(page.getByTestId('calc-question')).toBeVisible();
  await page.getByTestId('calc-undo').click();
  await expect(page.getByTestId('calc-question')).toHaveCount(0);
  await expect(page.getByTestId('calc-line-move')).toHaveCount(2);
  await page.getByTestId('calc-input').fill('g2g3');
  await page.getByTestId('calc-input').press('Enter');
  await expect(page.getByTestId('calc-question')).toBeVisible();

  await expect(page.getByTestId('calc-validate')).toBeDisabled();
  await page.getByTestId('calc-option-1').click();
  await page.screenshot({ path: 'test-results/calc-question.png' });
  await page.getByTestId('calc-validate').click();

  await expect(page.getByTestId('calc-line-verdict')).toContainText('✓');
  await expect(page.getByTestId('calc-answer-verdict')).toContainText('✓');
  await expect(page.getByTestId('calc-solution')).toContainText('Solution : h3 a6 g3');
  await expect(page.getByTestId('calc-explanation')).toContainText('colonne d');
  expect(answers).toEqual([{ line: ['h2h3', 'a7a6', 'g2g3'], answer: 1 }]);
  await expect(page.getByTestId('calc-streak')).toContainText('Série : 1 · 1 / 1');
  // La solution est rejouée sur le plateau (g2 → g3 en dernier).
  await expect(page.locator('img[data-square="g3"]')).toHaveAttribute('alt', 'wp', {
    timeout: 6000,
  });
  await page.screenshot({ path: 'test-results/calc-result.png' });

  // Position suivante : ligne vide, série conservée.
  await page.getByTestId('calc-next').click();
  await expect(page.getByTestId('calc-line-move')).toHaveCount(0);
  await expect(page.getByTestId('calc-streak')).toContainText('Série : 1');
  await expect(page.locator('img[data-square="h2"]')).toHaveAttribute('alt', 'wp');
});

test('calcul : mauvaise ligne et mauvaise réponse remettent la série à zéro', async ({ page }) => {
  await mockCalc(page, [problem('c1')], () => true);
  await page.goto('/#/calc');
  await page.getByTestId('calc-depth-2').click();
  for (const [i, uci] of ['h2h3', 'a7a6', 'h3h4'].entries()) {
    await page.getByTestId('calc-input').fill(uci);
    await page.getByTestId('calc-input').press('Enter');
    // Coup inscrit (et champ vidé) avant de saisir le suivant.
    await expect(page.getByTestId('calc-line-move')).toHaveCount(i + 1);
  }
  await page.getByTestId('calc-option-0').click();
  await page.getByTestId('calc-validate').click();
  await expect(page.getByTestId('calc-line-verdict')).toContainText('✗');
  await expect(page.getByTestId('calc-answer-verdict')).toContainText('✗');
  await expect(page.getByTestId('calc-streak')).toContainText('Série : 0 · 0 / 1');
});

test('calcul : promotion, la pièce est demandée', async ({ page }) => {
  const sent: string[] = [];
  await page.route('**/api/calc/next*', (route) =>
    route.fulfill({
      json: {
        problem: problem('p1', { fen: '8/4P1k1/8/8/8/8/8/6K1 w - - 0 1', depth: 1, plies: 1 }),
      },
    }),
  );
  await page.route('**/api/calc/*/step', (route) => {
    const { uci } = route.request().postDataJSON() as { uci: string };
    sent.push(uci);
    return route.fulfill({
      json: uci === 'e7e8q' ? { legal: true, san: 'e8=Q+' } : { legal: false, san: '' },
    });
  });
  await page.goto('/#/calc');
  await page.getByTestId('calc-depth-1').click();
  await clickSquare(page, 'e7');
  await clickSquare(page, 'e8');
  await expect(page.getByTestId('calc-promo')).toBeVisible();
  await page.getByTestId('calc-promo-q').click();
  await expect(page.getByTestId('calc-line-move')).toHaveText(['Toi : e8=Q+']);
  expect(sent).toEqual(['e7e8', 'e7e8q']);
});

test('calcul : base de puzzles absente, message clair', async ({ page }) => {
  await page.route('**/api/calc/next*', (route) => route.fulfill({ json: { problem: null } }));
  await page.goto('/#/calc');
  await page.getByTestId('calc-depth-1').click();
  await expect(page.getByTestId('calc-missing')).toContainText(
    "La base de puzzles n'est pas installée : pnpm puzzles:import",
  );
});

test('calcul : vrai serveur, une position ou le message de base absente', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`ca${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.locator('nav').getByRole('link', { name: "S'entraîner", exact: true }).click();
  await page.getByTestId('train-calc').getByRole('link').click();
  await expect(page).toHaveURL(/#\/calc$/);
  await page.getByTestId('calc-depth-1').click();
  await expect(page.getByTestId('calc').or(page.getByTestId('calc-missing'))).toBeVisible();
  if (await page.getByTestId('calc').isVisible()) {
    // Aucune solution avant la réponse.
    await expect(page.getByTestId('calc-solution')).toHaveCount(0);
    await expect(page.getByTestId('board')).toBeVisible();
  }
});
