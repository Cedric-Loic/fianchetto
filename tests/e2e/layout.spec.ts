import { expect, test, type Page } from '@playwright/test';

/** Format téléphone (iPhone 12 à 14). */
test.use({ viewport: { width: 390, height: 844 } });

/** Aucun défilement horizontal : la page tient dans la largeur de la fenêtre. */
async function expectNoHorizontalScroll(page: Page) {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    inner: window.innerWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.inner);
  // Plus strict : même une barre de défilement verticale ne crée pas de débordement.
  expect(size.scroll).toBeLessThanOrEqual(size.client);
}

/** Ouvre le menu repliable et y suit un lien ; le menu se referme au changement de page. */
async function navigate(page: Page, name: string) {
  const toggle = page.getByTestId('nav-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('nav').getByRole('link', { name, exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
}

test('favicon et métadonnées', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /échecs/);
  const icon = await request.get('/favicon.svg');
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('<svg');
});

test('390 px : accueil, menu repliable, partie contre le bot, puzzles sans défilement horizontal', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fianchetto' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Menu replié : rubriques cachées, bouton à trois traits.
  const nav = page.locator('nav');
  await expect(nav.getByRole('link', { name: 'Puzzles', exact: true })).toBeHidden();
  await navigate(page, 'Classement');
  await expect(page).toHaveURL(/#\/leaderboard$/);
  await expect(nav.getByRole('link', { name: 'Puzzles', exact: true })).toBeHidden();
  // Rubrique courante surlignée.
  await page.getByTestId('nav-toggle').click();
  await expect(nav.getByRole('link', { name: 'Classement', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expectNoHorizontalScroll(page);

  // Compte, puis partie contre le bot.
  await navigate(page, 'Connexion');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`ly${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('my-rating')).toBeVisible();
  await expectNoHorizontalScroll(page);

  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();
  await expectNoHorizontalScroll(page);
  // Plateau à la largeur de l'écran, moins une petite marge.
  const box = await page.getByTestId('board').boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(4);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390 - 4);
  expect(box?.width).toBeGreaterThan(340);

  await navigate(page, 'Puzzles');
  await expect(page.getByTestId('puzzle-status')).toBeVisible();
  await expect(page.getByTestId('board')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
