import { expect, test, type Page } from '@playwright/test';

/*
 * Entraînement rapide (étape 17) : « Trouve la menace », contre la montre et Woodpecker avec les
 * routes du serveur simulées (la base de puzzles n'est pas installée en test), vision de
 * l'échiquier en vrai (aucun serveur).
 */

const BEFORE = '6k1/1p3ppp/8/8/8/8/5PPP/R5K1 b - - 0 1';
const AFTER_B6 = '6k1/5ppp/1p6/8/8/8/5PPP/R5K1 w - - 0 2';
const MATE = 'R5k1/5ppp/1p6/8/8/8/5PPP/6K1 b - - 1 2';

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page
    .getByLabel('Pseudo')
    .fill(`dr${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1000)}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

/** Clic au centre d'une case, selon l'orientation du plateau. */
async function clickSquare(page: Page, square: string, orientation: 'w' | 'b' = 'w') {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  let x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  let y = 8 - Number(square[1]);
  if (orientation === 'b') {
    x = 7 - x;
    y = 7 - y;
  }
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

const attempt = (id: string) => ({
  attemptId: id,
  source: 'lichess',
  puzzleId: `P-${id}`,
  rating: 900,
  themes: ['backRankMate'],
  color: 'w',
  fenBefore: BEFORE,
  setup: { uci: 'b7b6', san: 'b6', fen: AFTER_B6 },
  legalMoves: [
    { from: 'a1', to: 'a8' },
    { from: 'a1', to: 'a7' },
  ],
  rated: false,
  origin: null,
});

/** Coup d'un puzzle simulé : Ta8# réussit, tout autre coup échoue. */
async function mockMoves(page: Page) {
  await page.route('**/api/puzzles/*/move', (route) => {
    const { uci } = route.request().postDataJSON() as { uci: string };
    const solved = uci === 'a1a8';
    return route.fulfill({
      json: {
        status: solved ? 'solved' : 'failed',
        steps: solved ? [{ uci: 'a1a8', san: 'Ra8#', fen: MATE }] : [],
        legalMoves: [],
        solution: solved ? null : [{ uci: 'a1a8', san: 'Ra8#', fen: MATE }],
        rating: null,
      },
    });
  });
}

test('S’entraîner : les quatre nouveaux exercices sont proposés', async ({ page }) => {
  await page.goto('/#/train');
  for (const id of ['threats', 'rush', 'woodpecker', 'vision']) {
    await expect(page.getByTestId(`train-${id}`)).toBeVisible();
  }
  await page.getByTestId('train-vision').getByRole('link').click();
  await expect(page).toHaveURL(/#\/vision$/);
});

test('Trouve la menace : pièce adverse puis case, coup impossible, verdict et suite', async ({
  page,
}) => {
  const stats = { attempts: 0, correct: 0, streak: 0 };
  await page.route('**/api/threats/next', (route) =>
    route.fulfill({
      json: {
        problem: {
          id: 'T1',
          fen: AFTER_B6,
          color: 'b',
          lastMove: { from: 'b7', to: 'b6', san: 'b6' },
          rating: 900,
        },
        stats,
      },
    }),
  );
  await page.route('**/api/threats/T1/answer', (route) => {
    const { uci } = route.request().postDataJSON() as { uci: string };
    if (uci !== 'a1a8') return route.fulfill({ status: 422, json: { error: 'ILLEGAL' } });
    return route.fulfill({
      json: {
        correct: true,
        line: [{ uci: 'a1a8', san: 'Ra8#', fen: MATE }],
        themes: ['backRankMate'],
        explanation: 'Bien vu : après b6, l’adversaire menaçait Ra8# (mat du couloir).',
        stats: { attempts: 1, correct: 1, streak: 1 },
      },
    });
  });
  await register(page);
  await page.goto('/#/threats');
  await expect(page.getByTestId('threats')).toContainText('Tu viens de jouer b6');
  await expect(page.getByTestId('side-badge')).toContainText('Tu joues les Noirs');
  // Mes pièces ne comptent pas : il faut une pièce adverse.
  await clickSquare(page, 'g8', 'b');
  await expect(page.getByTestId('threats-notice')).toContainText('pièce des Blancs');
  await clickSquare(page, 'a1', 'b');
  await clickSquare(page, 'b2', 'b');
  await expect(page.getByTestId('threats-choice')).toContainText('a1');
  await page.getByTestId('threats-validate').click();
  await expect(page.getByTestId('threats-notice')).toContainText('pas possible');
  await clickSquare(page, 'a8', 'b');
  await page.getByTestId('threats-validate').click();
  await expect(page.getByTestId('threats-result')).toContainText('Bien vu');
  await expect(page.getByTestId('threats-result')).toContainText('Mat du couloir');
  await expect(page.getByTestId('threats-stats')).toContainText('Série : 1');
  await page.getByTestId('threats-replay').click();
  await expect(page.locator('img[data-square="a8"]')).toHaveAttribute('alt', 'wr');
});

test('contre la montre : réussite, erreur, arrêt, score envoyé', async ({ page }) => {
  let n = 0;
  const results: unknown[] = [];
  await page.route('**/api/puzzles/next', (route) => {
    const body = route.request().postDataJSON() as { mode: string; index: number };
    expect(body.mode).toBe('rush');
    expect(body.index).toBe(n);
    return route.fulfill({ json: { attempt: attempt(`R${n++}`) } });
  });
  await mockMoves(page);
  await page.route('**/api/rush', (route) =>
    route.fulfill({ json: { best: { 3: 4, 5: null }, recent: [] } }),
  );
  await page.route('**/api/rush/result', (route) => {
    results.push(route.request().postDataJSON());
    return route.fulfill({ json: { best: { 3: 4, 5: null }, recent: [] } });
  });
  await register(page);
  await page.goto('/#/rush');
  await expect(page.getByTestId('rush-best-3')).toContainText('Record : 4');
  await page.getByTestId('rush-start-3').click();
  await expect(page.getByTestId('rush-clock')).toContainText(/2:5\d|3:00/);
  await expect(page.locator('img[data-square="b6"]')).toHaveAttribute('alt', 'bp');
  await clickSquare(page, 'a1');
  await clickSquare(page, 'a8');
  await expect(page.getByTestId('rush-score')).toHaveText('1');
  // Puzzle suivant : position de départ (tour en a1), puis coup adverse b6.
  await expect(page.locator('img[data-square="a1"]')).toHaveAttribute('alt', 'wr');
  await expect(page.locator('img[data-square="b6"]')).toHaveAttribute('alt', 'bp');
  await clickSquare(page, 'a1');
  await clickSquare(page, 'a7');
  await expect(page.getByTestId('rush-errors')).toHaveAttribute('aria-label', /1 erreur/);
  await page.getByTestId('rush-stop').click();
  await expect(page.getByTestId('rush-over')).toContainText('1 puzzle en 3 min');
  expect(results).toEqual([{ minutes: 3, score: 1, errors: 1 }]);
});

test('Woodpecker : lot, puzzle réussi, progression du cycle', async ({ page }) => {
  let state: object = { set: null, bank: true };
  const set = (position: number, solved: number) => ({
    size: 25,
    cycle: 1,
    position,
    solved,
    ms: position * 4000,
    targetMs: null,
    history: [],
    finished: false,
  });
  await page.route('**/api/woodpecker', (route) => route.fulfill({ json: state }));
  await page.route('**/api/woodpecker/start', (route) => {
    state = { set: set(0, 0), bank: true };
    return route.fulfill({ json: state });
  });
  await page.route('**/api/puzzles/next', (route) => {
    expect((route.request().postDataJSON() as { mode: string }).mode).toBe('woodpecker');
    return route.fulfill({ json: { attempt: attempt('W1') } });
  });
  await mockMoves(page);
  await register(page);
  await page.goto('/#/woodpecker');
  await expect(page.getByTestId('woodpecker-intro')).toContainText('Méthode Woodpecker');
  await page.getByTestId('woodpecker-start-25').click();
  await expect(page.getByTestId('woodpecker')).toContainText('cycle 1 / 7');
  await expect(page.locator('img[data-square="b6"]')).toHaveAttribute('alt', 'bp');
  state = { set: set(1, 1), bank: true };
  await clickSquare(page, 'a1');
  await clickSquare(page, 'a8');
  await expect(page.getByTestId('woodpecker-status')).toContainText('Réussi');
  await expect(page.getByTestId('woodpecker-progress')).toContainText('1 / 25 faits');
  await expect(page.getByTestId('woodpecker-next')).toBeVisible();
});

test('vision : coordonnées, couleur des cases, cavalier', async ({ page }) => {
  await page.goto('/#/vision');
  // Coordonnées : les repères de l'échiquier sont masqués.
  await page.getByTestId('vision-start').click();
  for (let i = 0; i < 3; i++) {
    const target = (await page.getByTestId('vision-prompt').locator('strong').textContent()) ?? '';
    await clickSquare(page, target);
    await expect(page.getByTestId('vision-score')).toHaveText(String(i + 1));
  }

  await page.getByTestId('vision-tab-color').click();
  await page.getByTestId('vision-start').click();
  const square = (await page.locator('.vision-cover .vision-target').textContent()) ?? 'a1';
  const dark = ('abcdefgh'.indexOf(square[0] ?? 'a') + Number(square[1]) - 1) % 2 === 0;
  await page.getByTestId(dark ? 'vision-dark' : 'vision-light').click();
  await expect(page.getByTestId('vision-score')).toHaveText('1');

  await page.getByTestId('vision-tab-knight').click();
  await page.getByTestId('vision-start').click();
  const [from, to] = await page.getByTestId('vision-prompt').locator('strong').allTextContents();
  const distance = await page.evaluate(
    ([a, b]) => {
      const pos = (s: string) => ['abcdefgh'.indexOf(s[0] ?? 'a'), Number(s[1]) - 1];
      const key = (f: number, r: number) => `${f},${r}`;
      const [tf, tr] = pos(b ?? 'a1');
      let frontier = [pos(a ?? 'a1')];
      const seen = new Set([key(frontier[0]?.[0] ?? 0, frontier[0]?.[1] ?? 0)]);
      for (let d = 0; d < 10; d++) {
        const next: number[][] = [];
        for (const [f = 0, r = 0] of frontier) {
          if (f === tf && r === tr) return d;
          for (const [df, dr] of [
            [1, 2],
            [2, 1],
            [2, -1],
            [1, -2],
            [-1, -2],
            [-2, -1],
            [-2, 1],
            [-1, 2],
          ] as const) {
            const nf = f + df;
            const nr = r + dr;
            if (nf < 0 || nf > 7 || nr < 0 || nr > 7 || seen.has(key(nf, nr))) continue;
            seen.add(key(nf, nr));
            next.push([nf, nr]);
          }
        }
        frontier = next;
      }
      return -1;
    },
    [from, to],
  );
  await page.getByTestId(`vision-knight-${distance}`).click();
  await expect(page.getByTestId('vision-score')).toHaveText('1');
});
