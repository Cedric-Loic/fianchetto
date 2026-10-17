import { expect, test } from '@playwright/test';

const d = new Date();
const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
const PGN = `[Event "Live Chess"]
[Date "${date}"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "980"]
[TimeControl "900+10"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
`;

test('tableau de bord : phase, semaine, profil, courbes, lien vers les puzzles', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`db${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  // Tableau de bord vide : phase 1, invitation à analyser.
  await page.locator('nav').getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('coach-phase')).toContainText('Phase 1 · Ne plus rien donner');
  await expect(page.getByTestId('coach-reco').getByRole('link').first()).toHaveAttribute(
    'href',
    '#/analyse',
  );

  // Une partie importée et analysée.
  await page.locator('nav').getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('move-card')).toBeVisible({ timeout: 60_000 });

  await page.locator('nav').getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('task-reviews')).toContainText('1 / 2');
  await expect(page.getByTestId('task-slow-games')).toContainText('1 / 2');
  await expect(page.getByTestId('coach-weaknesses')).toContainText('Pièce laissée en prise');
  await expect(page.getByTestId('curve-chesscom-rapid').locator('svg')).toBeVisible();
  await expect(page.getByTestId('coach-months')).toContainText('980');
  await page.screenshot({ path: 'test-results/coach.png', fullPage: true });

  // La recommandation principale mène aux puzzles du bon thème.
  await page
    .getByTestId('coach-reco')
    .getByRole('link', { name: /erreur la plus fréquente/ })
    .click();
  await expect(page).toHaveURL(/#\/puzzles\/theme\/hangingPiece$/);
  await expect(page.getByTestId('puzzle-theme')).toHaveValue('hangingPiece');
});
