import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/*
 * Revue guidée, « Apprends de tes erreurs » (vraie route de réessai) et moteur en direct réel
 * (flux SSE de Stockfish, option « Menace »). Captures de contrôle si FIANCHETTO_SHOTS est
 * défini.
 */
const OUT = process.env.FIANCHETTO_SHOTS;

const PGN = `[Event "Live Chess"]
[Date "2026.10.01"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
`;

const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

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
  await page.getByLabel('Pseudo').fill(`rm${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

async function shots(page: Page, name: string, desktop: [number, number] = [1366, 768]) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  for (const [label, width, height] of [
    ['bureau', desktop[0], desktop[1]],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${name}-${label}.png`) });
    await page.screenshot({ path: join(OUT, `${name}-${label}-complet.png`), fullPage: true });
    // Aucun débordement horizontal, même sur un téléphone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `débordement horizontal (${name}, ${label})`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

interface ReviewJson {
  state: { status: string; review?: { evals: { bestMoveUci: string | null }[] } };
}

test('revue guidée jusqu’au bilan, puis « Apprends de tes erreurs »', async ({ page }) => {
  test.setTimeout(180_000);
  await register(page);
  await page.goto('/#/analyse');
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await expect(page.getByTestId('import-message')).toContainText('1 partie importée');
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });
  const reviewId = /#\/review\/([\w-]+)/.exec(page.url())?.[1] ?? '';

  // Revue guidée : bandeau, bulle du coach, moments clés un par un.
  await page.getByTestId('start-guided').click();
  await expect(page.getByTestId('mode-banner')).toContainText('Revue guidée');
  await expect(page.getByTestId('mode-progress')).toHaveText(/^1 \/ \d+$/);
  await expect(page.getByTestId('guided-moment')).toBeVisible();
  await expect(page.getByTestId('win-swing')).toContainText('%');
  // Le premier moment : la gaffe 3. Nxe5 (case citée surlignée au survol).
  await expect(page.getByTestId('guided-moment')).toContainText('Nxe5');
  const ref = page.getByTestId('square-ref').first();
  const square = (await ref.textContent()) ?? '';
  await ref.hover();
  await expect(page.locator(`.square-mark.mark-target[data-square="${square}"]`)).toHaveCount(1);
  await page.mouse.move(0, 0);
  await shots(page, 'revue-guidee');

  for (let i = 0; i < 20 && (await page.getByTestId('guided-next').isVisible()); i++) {
    await page.getByTestId('guided-next').click();
  }
  await expect(page.getByTestId('mode-progress')).toHaveText('Bilan');
  const summary = page.getByTestId('guided-summary');
  await expect(summary).toContainText('Précision');
  await expect(page.getByTestId('summary-tips').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('summary-puzzles')).toHaveAttribute(
    'href',
    /^#\/puzzles\/(theme\/\w+|mine)$/,
  );
  await shots(page, 'revue-guidee-bilan');

  // « Apprends de tes erreurs » depuis le bilan : position AVANT 3. Nxe5.
  await page.getByTestId('summary-learn').click();
  await expect(page.getByTestId('mode-banner')).toContainText('Apprends de tes erreurs');
  await expect(page.getByTestId('learn-prompt')).toContainText('meilleur coup que Nxe5');
  await expect(page.locator('img[data-square="f3"]')).toHaveAttribute('alt', 'wn');

  // Un coup faux (3. Ba6 ?? bxa6), jugé par le vrai serveur : réfutation, puis retour.
  await clickSquare(page, 'f1');
  await clickSquare(page, 'a6');
  await expect(page.getByTestId('learn-feedback')).toContainText('✗', { timeout: 30_000 });
  await expect(page.locator('img[data-square="f1"]')).toHaveAttribute('alt', 'wb', {
    timeout: 10_000,
  });
  await expect(page.getByTestId('learn-feedback')).toContainText('Cherche encore');

  // La solution : flèche du meilleur coup, puis on le joue.
  await page.getByTestId('learn-solution-button').click();
  await expect(page.getByTestId('learn-solution')).toContainText('Solution :');
  await expect(page.locator('[data-testid="arrows"] g[data-kind="best"]')).toHaveCount(1);
  await shots(page, 'apprends-erreurs');
  const res = await page.request.get(`/api/reviews/${reviewId}`);
  const json = (await res.json()) as ReviewJson;
  const best = json.state.review?.evals[4]?.bestMoveUci ?? '';
  expect(best).toMatch(/^[a-h][1-8][a-h][1-8]/);
  await clickSquare(page, best.slice(0, 2));
  await clickSquare(page, best.slice(2, 4));
  await expect(page.getByTestId('learn-feedback')).toContainText('✓ Bien joué', {
    timeout: 30_000,
  });
  await page.getByTestId('learn-next').click();
  // Échap : retour à la revue guidée (bilan), puis à la revue libre.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guided-summary')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('start-guided')).toBeVisible();
});

test('revue guidée en mode quiz : réponse, puis bulle du coach', async ({ page }) => {
  test.setTimeout(180_000);
  await register(page);
  await page.goto('/#/analyse');
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await expect(page.getByTestId('import-message')).toContainText('1 partie importée');
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('quiz-toggle').check();
  await page.getByTestId('start-guided').click();
  // Position AVANT 3. Nxe5 : consigne, ni bulle ni flèche.
  await expect(page.getByTestId('mode-banner')).toContainText('Mode quiz');
  await expect(page.getByTestId('learn-prompt')).toContainText('Quel coup jouerais-tu ici ?');
  await expect(page.getByTestId('guided-moment')).toHaveCount(0);
  await expect(page.locator('[data-testid="arrows"] g')).toHaveCount(0);
  await expect(page.locator('img[data-square="f3"]')).toHaveAttribute('alt', 'wn');
  await shots(page, 'quiz', [1920, 1080]);

  // Mauvaise réponse (3. Ba6 ?? bxa6) : réfutation, puis la bulle du coach.
  await clickSquare(page, 'f1');
  await clickSquare(page, 'a6');
  await expect(page.getByTestId('guided-moment')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('quiz-result')).toContainText('✗');
  await expect(page.getByTestId('guided-moment')).toContainText('Nxe5');
  await expect(page.getByTestId('quiz-score')).toContainText('0/1 trouvés');
  await shots(page, 'quiz-reponse', [1920, 1080]);

  for (let i = 0; i < 20 && (await page.getByTestId('guided-next').isVisible()); i++) {
    await page.getByTestId('guided-next').click();
    if (await page.getByTestId('quiz-skip').isVisible())
      await page.getByTestId('quiz-skip').click();
  }
  await expect(page.getByTestId('quiz-summary')).toContainText('0 / 1 trouvés');
});

test('moteur en direct réel : profondeur ≥ 5, puis menace', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page);
  await page.goto(`/#/analyse/board?fen=${encodeURIComponent(ITALIAN)}`);
  await expect(page.locator('img[data-square="c6"]')).toHaveAttribute('alt', 'bn');
  const toggle = page.getByTestId('engine-toggle');
  if (!(await toggle.isChecked())) await page.getByText('Moteur', { exact: true }).click();
  await expect(page.getByTestId('engine-depth')).toHaveText(/Profondeur ([5-9]|\d{2,})/, {
    timeout: 45_000,
  });
  await expect(page.getByTestId('engine-line').first()).toBeVisible();

  // Menace (touche x) : coup de l'adversaire s'il avait le trait, en flèche rouge.
  await page.keyboard.press('x');
  await expect(page.getByTestId('threat-toggle')).toBeChecked();
  await expect(page.getByTestId('engine-threat')).toHaveText(/^Menace : \S+$/, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-testid="arrows"] g[data-kind="threat"]')).toHaveCount(1);
  // L'analyse principale reprend ensuite.
  await expect(page.getByTestId('engine-depth')).toHaveText(/Profondeur ([5-9]|\d{2,})/, {
    timeout: 45_000,
  });
  await shots(page, 'menace');
  // Moteur coupé : plus de menace.
  await page.getByText('Moteur', { exact: true }).click();
  await expect(page.getByTestId('engine-threat')).toHaveCount(0);
  await expect(page.locator('[data-testid="arrows"] g[data-kind="threat"]')).toHaveCount(0);
});
