import { expect, test } from '@playwright/test';
import { openedReview } from './review-helpers';

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

  await page.locator('nav').getByRole('link', { name: 'Mes parties', exact: true }).click();
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
  await openedReview(page);
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
  await page.locator('nav').getByRole('link', { name: 'Mes parties', exact: true }).click();
  await expect(page.getByTestId('baseline')).toContainText('1parties analysées');
  await page.screenshot({ path: 'test-results/analyse-imports.png', fullPage: true });
});

test("pages Aujourd'hui, Progrès et Apprendre ; écran Révisions vide", async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`cp${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.setViewportSize({ width: 1920, height: 1080 });
  // Aujourd'hui : séance du jour, révisions dues, prochaine étape du parcours.
  await page.goto('/#/today');
  const session = page.getByTestId('coach-session');
  await expect(session).toContainText('Séance du jour');
  await expect(session.locator('.session-steps li').first()).toBeVisible();
  await expect(page.getByTestId('session-start')).toHaveText('Commencer');
  await expect(page.getByTestId('today-reviews-count')).toContainText('Aucune carte due');
  await expect(page.getByTestId('path-next')).toBeVisible();
  await page.screenshot({ path: 'test-results/aujourdhui.png' });

  // Progrès : compétences (14), objectifs et classement.
  await page.goto('/#/progress');
  await expect(page.locator('[data-testid^="skill-"]')).toHaveCount(14);
  await expect(page.getByTestId('coach-skills')).toContainText('pas encore mesuré');
  await expect(page.getByTestId('coach-targets')).toBeVisible();
  await expect(page.getByTestId('leaderboard')).toContainText('Classement');

  // Apprendre : le parcours conseillé et les paliers.
  await page.goto('/#/learn');
  await expect(page.getByTestId('coach-path')).toContainText('Parcours');
  await expect(page.getByTestId('stage-P1')).toBeVisible();

  await page.goto('/#/today');
  await page.getByTestId('to-reviews').click();
  await expect(page).toHaveURL(/#\/reviews$/);
  await expect(page.getByTestId('reviews-count')).toContainText('0 carte due');
  await expect(page.getByTestId('reviews')).toContainText('Rien à réviser');
});
