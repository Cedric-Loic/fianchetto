import { expect, test } from '@playwright/test';

const PGN = `[Event "Live Chess"]
[Date "2026.10.01"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]
[TimeControl "600+5"]

1. e4 {[%clk 0:10:03]} e5 {[%clk 0:10:04]} 2. Nf3 {[%clk 0:09:58]} Nc6 {[%clk 0:10:00]}
3. Nxe5 {[%clk 0:00:42]} Nxe5 {[%clk 0:09:55]} 4. d4 {[%clk 0:00:40]} Nc6 {[%clk 0:09:50]}
5. d5 {[%clk 0:00:35]} Nb4 {[%clk 0:09:45]} 6. a3 {[%clk 0:00:30]} Qh4 {[%clk 0:09:40]}
7. axb4 {[%clk 0:00:20]} Qxe4+ {[%clk 0:09:35]} 0-1
`;

test('import PGN, analyse, revue avec explication, point de départ', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`co${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Analyse' }).click();
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await expect(page.getByTestId('import-message')).toContainText('1 partie importée');
  const table = page.getByTestId('imported-games');
  await expect(table).toContainText('moi_cc');
  await expect(table.locator('.me')).toHaveText('moi_cc (1000)');
  await expect(table).toContainText('Défaite');

  // Analyse puis revue : 3. Nxe5 ?? laisse le cavalier en prise.
  await table.getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('accuracy-w')).toContainText('moi_cc');
  await page.getByTestId('move-list').locator('button.move', { hasText: 'Nxe5' }).first().click();
  await expect(page.getByTestId('move-card')).toContainText('Gaffe');
  await expect(page.getByTestId('explanation')).toContainText(
    'Le cavalier joué en e5 est en prise',
  );
  // Pendule lue dans le PGN : temps restant à côté du coup et dans la fiche du coup.
  await expect(page.getByTestId('move-clock')).toHaveText('· 0:42 à la pendule');
  await expect(page.getByTestId('move-list')).toContainText('Nxe5 ??0:42');
  await page.screenshot({ path: 'test-results/revue.png' });
  // Bilan du coach : la gaffe fait partie des moments clés, avec un conseil.
  await expect(page.getByTestId('coach-summary')).toContainText('Nxe5');
  await expect(page.getByTestId('coach-tip')).toBeVisible();

  // Rejouer d'ici : entraînement depuis la position d'avant la gaffe (cavalier encore en f3).
  await page.getByTestId('replay').click();
  await expect(page.getByTestId('training-panel')).toBeVisible();
  await expect(page.locator('img[data-square="f3"]')).toHaveAttribute('alt', 'wn');

  // Point de départ mesuré sur la partie analysée.
  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page.getByTestId('baseline')).toContainText('1parties analysées');
  await page.screenshot({ path: 'test-results/analyse-imports.png', fullPage: true });
});

test('page Coach : séance du jour, compétences, parcours ; écran Révisions vide', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`cp${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/coach');
  const session = page.getByTestId('coach-session');
  await expect(session).toContainText('Séance du jour');
  await expect(session.locator('.session-steps li').first()).toBeVisible();
  await expect(page.getByTestId('session-start')).toHaveText('Commencer');
  await expect(page.locator('[data-testid^="skill-"]')).toHaveCount(14);
  await expect(page.getByTestId('coach-skills')).toContainText('pas encore mesuré');
  await expect(page.getByTestId('coach-path')).toContainText('Parcours');
  await page.screenshot({
    path: '/tmp/claude-0/-home-user-fianchetto/f669a99c-69be-5c7c-a668-8806c175000f/scratchpad/coach.png',
  });

  await page.getByTestId('to-reviews').click();
  await expect(page).toHaveURL(/#\/reviews$/);
  await expect(page.getByTestId('reviews-count')).toContainText('0 carte due');
  await expect(page.getByTestId('reviews')).toContainText('Rien à réviser');
});
