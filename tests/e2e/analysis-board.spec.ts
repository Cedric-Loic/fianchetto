import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/*
 * Échiquier d'analyse (étape 12) : variantes dans la revue, échiquier libre (FEN / PGN),
 * moteur en direct (flux SSE simulé par `page.route` : le test ne dépend pas de Stockfish).
 * Captures de contrôle si FIANCHETTO_SHOTS est défini.
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

async function clickSquare(page: Page, square: string, orientation: 'w' | 'b' = 'w') {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  let x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  let y = 8 - Number(square[1]);
  if (orientation === 'b') [x, y] = [7 - x, 7 - y];
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`an${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

/** Flux SSE simulé : trois lignes pour la position demandée, puis fin. */
async function fakeEngine(page: Page) {
  await page.route('**/api/analysis/stream**', async (route) => {
    const fen = new URL(route.request().url()).searchParams.get('fen') ?? '';
    const white = fen.split(' ')[1] === 'w';
    const lines = [
      white
        ? { pv: ['f1c4', 'f8c5'], sanPv: ['Bc4', 'Bc5'], evalCp: 45 }
        : { pv: ['g8f6', 'd2d3'], sanPv: ['Nf6', 'd3'], evalCp: 30 },
      white
        ? { pv: ['f1b5', 'a7a6'], sanPv: ['Bb5', 'a6'], evalCp: 38 }
        : { pv: ['f8c5', 'c2c3'], sanPv: ['Bc5', 'c3'], evalCp: 41 },
      white
        ? { pv: ['d2d4', 'e5d4'], sanPv: ['d4', 'exd4'], evalCp: 20 }
        : { pv: ['d7d6', 'd2d4'], sanPv: ['d6', 'd4'], evalCp: 62 },
    ].map((l, i) => ({ multipv: i + 1, depth: 18, mate: null, ...l }));
    const events = [
      { type: 'lines', fen, lines },
      { type: 'done', fen },
    ];
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    });
  });
}

async function shots(page: Page, name: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  for (const [label, width, height] of [
    ['bureau', 1366, 768],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${name}-${label}.png`) });
    await page.screenshot({ path: join(OUT, `${name}-${label}-complet.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

test('revue : variante jouée sur l’échiquier, retour à la partie, moteur', async ({ page }) => {
  test.setTimeout(120_000);
  await register(page);
  await fakeEngine(page);
  await page.goto('/#/analyse');
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await expect(page.getByTestId('import-message')).toContainText('1 partie importée');
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });

  // La gaffe 3. Nxe5 : explication, et schéma (flèches) sur le plateau.
  const moves = page.getByTestId('move-list');
  await moves.locator('button.move', { hasText: 'Nxe5' }).first().click();
  await expect(page.getByTestId('explanation')).toContainText('en prise');
  await expect(page.locator('[data-testid="arrows"] g').first()).toBeVisible();

  // « Voir la ligne » (si la revue fournit un schéma) : variante temporaire, puis retour.
  if (await page.getByTestId('show-line').isVisible()) {
    await page.getByTestId('show-line').click();
    await expect(page.getByTestId('move-card')).toContainText('Variante', { timeout: 5_000 });
    await page.getByTestId('back-to-game').click();
    await expect(page.getByTestId('variation')).toHaveCount(0);
  }

  // Position avant la gaffe (après 2… Nc6), on joue 3. Bc4 au lieu de 3. Nxe5.
  await moves.locator('button.move', { hasText: 'Nc6' }).first().click();
  await clickSquare(page, 'f1');
  await clickSquare(page, 'c4');
  await expect(page.getByTestId('variation')).toContainText('Bc4');
  await expect(page.getByTestId('move-card')).toContainText('Variante');
  await expect(page.locator('img[data-square="c4"]')).toHaveAttribute('alt', 'wb');
  // Un coup de la partie reste un coup de la partie (pas de doublon).
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('move-card')).not.toContainText('Variante');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('move-card')).toContainText('Nxe5');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('move-card')).toContainText('Variante');

  // Moteur (flux simulé) : trois lignes, survol = flèche, clic = la ligne est jouée.
  await page.getByText('Moteur', { exact: true }).click();
  await expect(page.getByTestId('engine-line')).toHaveCount(3);
  await expect(page.getByTestId('engine-eval').first()).toHaveText('+0,3');
  await shots(page, 'revue-variante');
  await page.getByTestId('engine-line').nth(1).hover();
  await expect(page.locator('[data-testid="arrows"] g[data-kind="best"]')).toHaveCount(1);
  await page.getByTestId('engine-line').first().getByRole('button', { name: 'Nf6' }).click();
  await expect(page.getByTestId('variation')).toContainText('Nf6');

  // Retour à la partie : la carte du coup revient.
  await page.getByTestId('back-to-game').click();
  await expect(page.getByTestId('move-card')).not.toContainText('Variante');
  await expect(page.getByTestId('move-card')).toContainText('Nc6');
  await page.getByText('Moteur', { exact: true }).click();
  await moves.locator('button.move', { hasText: 'Nxe5' }).first().click();
  await shots(page, 'revue');
});

test('échiquier d’analyse : FEN, coup joué, PGN, lien', async ({ page }) => {
  await page.goto('/#/analyse');
  await page.getByTestId('tab-board').click();
  await expect(page).toHaveURL(/#\/analyse\/board$/);
  await expect(page.getByTestId('analysis-board')).toBeVisible();

  // FEN invalide : message en français, rien ne change.
  await page.getByTestId('load-position').fill('8/8/8/8/8/8/8/8 w - - 0 1');
  await page.getByRole('button', { name: 'Charger', exact: true }).click();
  await expect(page.getByTestId('load-error')).toContainText('FEN invalide');

  await page.getByTestId('load-position').fill(ITALIAN);
  await page.getByRole('button', { name: 'Charger', exact: true }).click();
  await expect(page.getByTestId('load-error')).toHaveCount(0);
  await expect(page.locator('img[data-square="c6"]')).toHaveAttribute('alt', 'bn');
  await clickSquare(page, 'f1');
  await expect(page.getByTestId('legal-hint').first()).toBeVisible();
  await clickSquare(page, 'b5');
  await expect(page.getByTestId('move-list')).toContainText('Bb5');
  await clickSquare(page, 'a7');
  await clickSquare(page, 'a6');
  await expect(page.getByTestId('move-list')).toContainText('a6');
  // Un coup illégal ne change rien.
  await clickSquare(page, 'b5');
  await clickSquare(page, 'b8');
  await expect(page.locator('img[data-square="b5"]')).toHaveAttribute('alt', 'wb');
  // Variante : retour d'un coup, autre coup, puis suppression.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await clickSquare(page, 'f1');
  await clickSquare(page, 'c4');
  await expect(page.getByTestId('variation')).toContainText('Bc4');
  await page.getByTestId('promote-variation').click();
  await expect(page.getByTestId('variation')).toContainText('Bb5');
  await page.getByTestId('delete-variation').click();
  await expect(page.getByTestId('move-list')).not.toContainText('Bc4');

  // Lien de la position courante, puis PGN.
  const href = await page.getByTestId('board-link').getAttribute('href');
  expect(href).toContain('#/analyse/board?fen=');
  await page.getByTestId('load-position').fill('1. d4 d5 2. c4 e6 3. Nc3 Nf6 *');
  await page.getByRole('button', { name: 'Charger', exact: true }).click();
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(6);
  await page.keyboard.press('Home');
  await expect(page.locator('img[data-square="d2"]')).toHaveAttribute('alt', 'wp');
  await page.keyboard.press('End');
  await expect(page.locator('img[data-square="f6"]')).toHaveAttribute('alt', 'bn');
  await page.keyboard.press('f');
  await page.getByTestId('load-position').fill('1. e4 e5 2. Ke3 Qxz9');
  await page.getByRole('button', { name: 'Charger', exact: true }).click();
  await expect(page.getByTestId('load-error')).toContainText('PGN illisible');

  await page.goto(`/${href ?? ''}`);
  await expect(page.locator('img[data-square="c6"]')).toHaveAttribute('alt', 'bn');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(0);
});

test('échiquier d’analyse : moteur en direct (flux simulé)', async ({ page }) => {
  await register(page);
  await fakeEngine(page);
  await page.goto(`/#/analyse/board?fen=${encodeURIComponent(ITALIAN)}`);
  await expect(page.locator('img[data-square="c6"]')).toHaveAttribute('alt', 'bn');
  await page.getByText('Moteur', { exact: true }).click();
  await expect(page.getByTestId('engine-line')).toHaveCount(3);
  await expect(page.getByTestId('engine-depth')).toHaveText('Profondeur 18');
  // Meilleur coup du moteur en flèche, puis clic sur le 2e coup de la ligne.
  await expect(page.locator('[data-testid="arrows"] g[data-kind="best"]')).toHaveCount(1);
  await page.getByTestId('engine-line').first().getByRole('button', { name: 'Bc5' }).click();
  await expect(page.getByTestId('move-list')).toContainText('Bc4');
  await expect(page.getByTestId('move-list')).toContainText('Bc5');
  // Nouvelle position (Blancs au trait, coup 4) : nouvelles lignes.
  await expect(page.getByTestId('engine-line').first()).toContainText('4.Bc4');
  await shots(page, 'echiquier-analyse');
  // Le réglage est mémorisé.
  await page.reload();
  await expect(page.getByTestId('engine-toggle')).toBeChecked();
});
