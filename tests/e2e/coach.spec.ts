import { expect, test } from '@playwright/test';

const PGN = `[Event "Live Chess"]
[Date "2026.10.01"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
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
  await page.screenshot({ path: 'test-results/revue.png' });

  // Point de départ mesuré sur la partie analysée.
  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page.getByTestId('baseline')).toContainText('1parties analysées');
  await page.screenshot({ path: 'test-results/analyse-imports.png', fullPage: true });
});
