import { expect, test, type Page } from '@playwright/test';

/** Les six rubriques : libellé, adresse, élément qui prouve que la page est chargée. */
const SECTIONS = [
  { name: "Aujourd'hui", hash: '#/today', ready: 'coach-session', needsUser: true },
  { name: 'Jouer', hash: '#/', ready: 'my-rating', needsUser: false },
  { name: 'Apprendre', hash: '#/learn', ready: 'stage-P1', needsUser: true },
  { name: "S'entraîner", hash: '#/train', ready: 'train', needsUser: false },
  { name: 'Mes parties', hash: '#/analyse', ready: 'chesscom-username', needsUser: true },
  { name: 'Progrès', hash: '#/progress', ready: 'coach-skills', needsUser: true },
] as const;

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`nv${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

test('six rubriques dans la barre, chacune charge sa page et se surligne', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await register(page);
  const nav = page.locator('nav');
  await expect(nav.locator('.nav-links a')).toHaveCount(6);
  await expect(nav.locator('.nav-links a')).toHaveText(SECTIONS.map((s) => s.name));

  for (const s of SECTIONS) {
    await nav.getByRole('link', { name: s.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${s.hash.replace('/', '\\/')}$`));
    await expect(page.getByTestId(s.ready).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: s.name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  }
});

test('visiteur : Jouer, Puzzles et Classement restent accessibles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fianchetto' })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: "S'entraîner", exact: true }).click();
  await page.getByTestId('train-puzzles').getByRole('link').click();
  await expect(page).toHaveURL(/#\/puzzles$/);
  await expect(page.locator('nav a[aria-current="page"]')).toHaveText("S'entraîner");
  await page.locator('nav').getByRole('link', { name: 'Progrès', exact: true }).click();
  await expect(page.getByTestId('leaderboard')).toContainText('Classement');
  // Pages réservées aux comptes : invitation à se connecter.
  await page.locator('nav').getByRole('link', { name: 'Apprendre', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible();
});

test('anciennes adresses : redirigées ou toujours valides, rubrique parente surlignée', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await register(page);
  const current = page.locator('nav a[aria-current="page"]');

  await page.goto('/#/coach');
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByTestId('coach-session')).toBeVisible();
  await expect(current).toHaveText("Aujourd'hui");

  const pages: [string, string, string][] = [
    ['/#/lessons', 'lesson-routine', 'Apprendre'],
    ['/#/lessons/routine', 'start-exercises', 'Apprendre'],
    ['/#/endgames', 'endgame-lucena', 'Apprendre'],
    ['/#/openings', 'openings-due', 'Apprendre'],
    ['/#/puzzles', 'puzzle-rating', "S'entraîner"],
    ['/#/calc', 'calc-depth', "S'entraîner"],
    ['/#/reviews', 'reviews', "S'entraîner"],
    ['/#/analyse', 'chesscom-username', 'Mes parties'],
    ['/#/analyse/board', 'analysis-board', 'Mes parties'],
    ['/#/leaderboard', 'leaderboard', 'Progrès'],
  ];
  for (const [url, ready, section] of pages) {
    await page.goto(url);
    await expect(page.getByTestId(ready).first(), url).toBeVisible();
    await expect(current, url).toHaveText(section);
  }
});

test('390×844 : menu repliable à six rubriques', async ({ page }) => {
  await register(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByTestId('nav-toggle');
  const nav = page.locator('nav');
  await expect(nav.getByRole('link', { name: 'Apprendre', exact: true })).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  for (const s of SECTIONS) {
    await expect(nav.getByRole('link', { name: s.name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/menu-mobile.png' });

  await nav.getByRole('link', { name: 'Apprendre', exact: true }).click();
  await expect(page).toHaveURL(/#\/learn$/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('stage-P1')).toBeVisible();
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
});
