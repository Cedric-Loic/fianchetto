import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Lot 3 : premier lancement guidé, partie sur téléphone (bande de coups, barre d'actions),
 * coup joué au clavier. Captures de contrôle à la demande (FIANCHETTO_SHOTS=/dossier).
 */
const OUT = process.env.FIANCHETTO_SHOTS;

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function hotseatClassic(page: Page) {
  await page.goto('/');
  await page.getByTestId('variant-classic').click();
  const seat = page.locator('.home-panel', { hasText: 'À deux sur cet écran' });
  await seat.getByRole('button', { name: 'Sans pendule' }).click();
  await seat.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
}

test('premier lancement guidé : parcouru une fois, puis plus jamais proposé', async ({ page }) => {
  // Navigateur piloté : pas de guide par défaut (les autres parcours ne le voient jamais).
  await page.goto('/');
  await expect(page.getByTestId('quick-play')).toBeVisible();
  await expect(page.getByTestId('onboarding')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('fianchetto-force-onboarding', '1'));
  await page.reload();
  const dialog = page.getByTestId('onboarding');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('onboarding-step')).toContainText('Étape 1 sur 3');
  await page.getByTestId('felt-2').click();
  await expect(page.getByTestId('onboarding-step')).toContainText('Étape 2 sur 3');
  await page.getByTestId('onboarding-tc-rapid-10+0').click();
  await page.getByTestId('onboarding-username').fill('mon_pseudo');
  await expect(page.getByTestId('onboarding-import')).toHaveAttribute('href', '#/analyse');
  await page.getByTestId('onboarding-finish').click();
  await expect(dialog).toHaveCount(0);

  // Cadence reprise par le bouton « Jouer » (sans compte : à deux sur cet écran).
  await expect(page.getByTestId('quick-play-summary')).toContainText('10 min');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sq-settings') ?? '{}') as unknown,
  );
  expect(saved).toMatchObject({
    onboarded: true,
    chessComUsername: 'mon_pseudo',
    lastPlay: { level: 2, timeControl: 'rapid-10+0' },
  });
  await page.reload();
  await expect(page.getByTestId('quick-play')).toBeVisible();
  await expect(page.getByTestId('onboarding')).toHaveCount(0);

  // « Jouer » relance la dernière configuration.
  await page.getByTestId('quick-play').click();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page).toHaveURL(/#\/game\//);
});

test('coup joué au clavier : flèches, Entrée pour prendre puis poser', async ({ page }) => {
  await hotseatClassic(page);
  await expect(page.getByRole('gridcell', { name: 'e4, vide' })).toBeVisible();
  await page.getByRole('gridcell', { name: 'a1, tour blanche' }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('gridcell', { name: 'e2, pion blanc' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('board-announce')).toContainText('pion blanc en e2');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('move-list')).toContainText('e4');
  await expect(page.getByRole('gridcell', { name: 'e4, pion blanc' })).toBeVisible();
  await expect(page.getByTestId('move-announce')).not.toBeEmpty();
  // Échap annule une prise en main.
  await page.getByRole('gridcell', { name: 'e7, pion noir' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sq.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sq.selected')).toHaveCount(0);
});

test.describe('téléphone (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('partie : bande de coups, barre d’actions fixe, cibles de 44 px, pas de débordement', async ({
    page,
  }) => {
    await hotseatClassic(page);
    const strip = page.getByTestId('move-strip');
    const bar = page.getByTestId('mobile-actions');
    await expect(strip).toBeVisible();
    await expect(bar).toBeVisible();
    // Panneau de bureau absent : pas de doublon des actions.
    await expect(page.locator('.side-panel .nav')).toBeHidden();

    const moves = [
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['g1', 'f3'],
      ['b8', 'c6'],
      ['f1', 'c4'],
      ['g8', 'f6'],
      ['d2', 'd3'],
      ['f8', 'c5'],
      ['c2', 'c3'],
      ['d7', 'd6'],
      ['b1', 'd2'],
      ['a7', 'a6'],
    ] as const;
    for (const [i, [from, to]] of moves.entries()) {
      await clickSquare(page, from);
      await clickSquare(page, to);
      await expect(strip.locator('button.move')).toHaveCount(i + 1);
    }
    await expectNoHorizontalScroll(page);

    // Le coup courant est visible dans la bande, qui défile horizontalement (en douceur).
    const currentInside = () =>
      strip.evaluate((el) => {
        const cur = el.querySelector('.move.current');
        if (!cur) return false;
        const a = el.getBoundingClientRect();
        const b = cur.getBoundingClientRect();
        return b.left >= a.left - 1 && b.right <= a.right + 1;
      });
    await expect.poll(currentInside).toBe(true);
    const scrolled = await strip.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolled).toBe(true);

    // Barre fixe en bas de la fenêtre, toutes les cibles d'au moins 44 px.
    const barBox = await bar.boundingBox();
    expect(Math.round((barBox?.y ?? 0) + (barBox?.height ?? 0))).toBe(844);
    for (const button of await bar.getByRole('button').all()) {
      const b = await button.boundingBox();
      expect(b?.width).toBeGreaterThanOrEqual(44);
      expect(b?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(bar.getByRole('button', { name: 'Retourner le plateau' })).toBeVisible();
    await expect(bar.getByTestId('focus-button')).toBeVisible();

    // Navigation depuis la barre : le coup courant recule dans la bande.
    await bar.getByRole('button', { name: 'Précédent' }).click();
    await expect(strip.locator('.move.current')).toHaveText('Nbd2');

    // Abandon depuis la barre : confirmation.
    await bar.getByTestId('resign').click();
    await expect(page.getByTestId('resign-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer la partie' }).click();
    await expectNoHorizontalScroll(page);
  });
});

test('captures du lot 3 (bureau et téléphone)', async ({ page }) => {
  test.skip(!OUT, 'captures à la demande (FIANCHETTO_SHOTS)');
  test.setTimeout(180_000);
  const dir = OUT ?? '';
  mkdirSync(dir, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

  for (const [label, width, height] of [
    ['bureau', 1366, 768],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('fianchetto-force-onboarding', '1');
    });
    await page.reload();
    await expect(page.getByTestId('onboarding')).toBeVisible();
    await shot(`guide-1-${label}`);
    await page.getByTestId('felt-3').click();
    await shot(`guide-2-${label}`);
    await page.getByTestId('onboarding-tc-blitz-5+0').click();
    await page.getByTestId('onboarding-username').fill('mon_pseudo');
    await shot(`guide-3-${label}`);
    await page.getByTestId('onboarding-finish').click();
    await page.evaluate(() => localStorage.removeItem('fianchetto-force-onboarding'));

    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
    await page.getByLabel('Pseudo').fill(`l3${Date.now() % 1_000_000_000}`);
    await page.getByLabel('Mot de passe').fill('motdepasse');
    await page.getByRole('button', { name: "S'inscrire" }).click();
    await expect(page.getByTestId('my-rating')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(`accueil-${label}`);

    await page.goto('/#/coach');
    await expect(page.getByTestId('coach-next')).toBeVisible();
    await shot(`coach-${label}`);
    await page.getByTestId('coach-week').scrollIntoViewIfNeeded();
    await shot(`coach-semaine-${label}`);

    await hotseatClassic(page);
    for (const [from, to] of [
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['g1', 'f3'],
      ['b8', 'c6'],
      ['f1', 'b5'],
      ['a7', 'a6'],
      ['b5', 'a4'],
      ['g8', 'f6'],
    ] as const) {
      await clickSquare(page, from);
      await clickSquare(page, to);
    }
    await page.getByRole('gridcell', { name: 'e1, roi blanc' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await shot(`partie-${label}`);
  }
});
