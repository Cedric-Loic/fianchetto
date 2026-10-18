import { expect, test } from '@playwright/test';

test('accueil : verrou souple du blitz avec confirmation, niveau du bot conseillé', async ({
  page,
}) => {
  // Niveau conseillé : un nouveau compte n'a pas encore de partie contre le bot, on l'ajoute à la
  // réponse réelle du serveur (le reste, dont le verrou du blitz, vient du serveur).
  await page.route('**/api/coach/dashboard', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, suggestedBotLevel: 2 } });
  });

  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`rg${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
  await page.goto('/');

  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  // Pas encore de puzzle aujourd'hui : bandeau et cadenas sur le blitz et le bullet.
  await expect(bot.getByTestId('blitz-lock')).toContainText("Fais d'abord tes puzzles du jour");
  await expect(bot.getByTestId('blitz-lock').getByRole('link')).toHaveAttribute(
    'href',
    '#/puzzles',
  );
  await expect(bot.getByTestId('tc-blitz-3+2').locator('svg')).toBeVisible();
  await expect(page.getByTestId('home-streak')).toContainText('Série : 0 jour');

  // Niveau conseillé : badge et présélection (aucune configuration mémorisée).
  await expect(bot.getByTestId('level-2').getByTestId('level-suggested')).toHaveText('conseillé');
  await expect(bot.getByTestId('level-2')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/regularite-accueil.png', fullPage: true });

  // Un clic sur le blitz demande confirmation ; jamais de blocage.
  await bot.getByTestId('tc-blitz-3+2').click();
  const dialog = page.getByTestId('blitz-lock-dialog');
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'test-results/regularite-verrou-blitz.png' });
  await dialog.getByRole('button', { name: 'Jouer quand même' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(bot.getByTestId('tc-blitz-3+2')).toHaveAttribute('aria-pressed', 'true');

  // Tableau de bord : série, objectif du jour, minutes de la semaine.
  await page.locator('nav').getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('day-streak')).toContainText('0 jour');
  await expect(page.getByTestId('daily-goal')).toContainText('0 / 10 puzzles');
  await expect(page.getByTestId('week-minutes')).toContainText('/ 3 h');
  await page
    .getByTestId('coach-regularity')
    .screenshot({ path: 'test-results/regularite-coach.png' });
});
