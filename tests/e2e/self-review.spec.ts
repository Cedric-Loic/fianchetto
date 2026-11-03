import { expect, test, type Page } from '@playwright/test';

/*
 * Revue réflexive en deux temps : étape 1 sans moteur (ni barre d'évaluation, ni classes, ni
 * flèches, ni explications), marquage de moments et défauts de réflexion, étape 2 avec bandeau de
 * comparaison, puis profil de pensée (Progrès) et conseil (Aujourd'hui). Vraie analyse Stockfish.
 */
const PGN = `[Event "Live Chess"]
[Date "2026.10.01"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
`;

async function register(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`sr${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();
}

/** Importe la partie, ouvre sa revue ; renvoie l'adresse de la revue. */
async function openReview(page: Page): Promise<string> {
  await page.goto('/#/analyse');
  await page.getByTestId('chesscom-username').fill('moi_cc');
  await page.getByTestId('pgn-input').fill(PGN);
  await page.getByRole('button', { name: 'Importer le PGN' }).click();
  await expect(page.getByTestId('import-message')).toContainText('1 partie importée');
  await page.getByTestId('imported-games').getByRole('link', { name: 'Analyser' }).click();
  await expect(page.getByTestId('analysis-board')).toBeVisible({ timeout: 60_000 });
  return page.url();
}

test('étape 1 sans moteur, marquage d’un moment, étape 2 avec comparaison', async ({ page }) => {
  test.setTimeout(180_000);
  await register(page);
  const url = await openReview(page);

  // Étape 1 : plateau parcourable, mais rien qui vienne de l'analyse.
  await expect(page.getByTestId('self-step')).toBeVisible();
  await expect(page.getByTestId('eval-bar')).toHaveCount(0);
  await expect(page.getByTestId('eval-chart')).toHaveCount(0);
  await expect(page.getByTestId('move-card')).toHaveCount(0);
  await expect(page.getByTestId('start-guided')).toHaveCount(0);
  await expect(page.getByTestId('engine-toggle')).toHaveCount(0);
  await expect(page.locator('[data-testid="arrows"] g')).toHaveCount(0);
  await expect(page.locator('.class-symbol')).toHaveCount(0);
  await expect(page.getByTestId('self-submit')).toBeDisabled();

  // Le coup adverse ne se marque pas ; 3. Nxe5 (demi-coup 5) oui.
  const list = page.getByTestId('move-list');
  await list.locator('.move', { hasText: 'e5' }).first().click();
  await expect(page.getByTestId('self-current')).toContainText('coup de l’adversaire');
  await expect(page.getByTestId('self-mark')).toBeDisabled();
  await list.locator('.move', { hasText: 'Nxe5' }).first().click();
  await expect(page.getByTestId('self-current')).toContainText('ton coup');
  await page.getByTestId('self-mark').click();
  await expect(page.getByTestId('self-moment')).toHaveCount(1);
  await expect(page.getByTestId('moment-flag')).toHaveCount(1);
  // Le défaut est obligatoire.
  await expect(page.getByTestId('self-submit')).toBeDisabled();
  await page.getByTestId('self-flaw').selectOption('no-threat-check');
  await expect(page.getByTestId('self-submit')).toBeEnabled();
  await page.screenshot({ path: 'test-results/self-review-step1.png' });

  // Étape 2 : la revue se dévoile, le bandeau compare.
  await page.getByTestId('self-submit').click();
  await expect(page.getByTestId('self-compare-text')).toHaveText(
    /^Tu as signalé 1 moment ; le moteur en a repéré \d+ ; en commun : 1\.$/,
  );
  await expect(page.getByTestId('self-step')).toHaveCount(0);
  await expect(page.getByTestId('eval-bar')).toBeVisible();
  await expect(page.getByTestId('start-guided')).toBeVisible();
  await expect(page.getByTestId('moment-flag')).toHaveCount(1);
  await expect(page.getByTestId('self-compare-moment')).toContainText('Je n’ai pas regardé');
  await page.screenshot({ path: 'test-results/self-review-step2.png' });

  // Revue déjà faite : pas de nouvelle étape 1, le bandeau reste.
  await page.goto('/#/analyse');
  await page.goto(url);
  await expect(page.getByTestId('self-compare-text')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('self-step')).toHaveCount(0);

  // Progrès : profil de pensée ; Aujourd'hui : conseil.
  await page.goto('/#/progress');
  await expect(page.getByTestId('thinking-no-threat-check')).toBeVisible();
  await expect(page.getByTestId('thinking-advice')).toContainText('Que menace son dernier coup');
  await page.goto('/#/today');
  await expect(page.getByTestId('today-thinking-tip')).toContainText('Que menace son dernier coup');
});

test('« Passer cette étape » : la revue normale, rien n’est créé', async ({ page }) => {
  test.setTimeout(180_000);
  await register(page);
  // Sans revue réflexive : profil de pensée vide.
  await page.goto('/#/progress');
  await expect(page.getByTestId('thinking-profile')).toContainText('Pas encore de revue réflexive');

  const url = await openReview(page);
  await expect(page.getByTestId('self-step')).toBeVisible();
  await page.getByTestId('self-skip').click();
  await expect(page.getByTestId('start-guided')).toBeVisible();
  await expect(page.getByTestId('eval-bar')).toBeVisible();
  await expect(page.getByTestId('self-compare')).toHaveCount(0);

  // Rien n'a été enregistré : l'étape 1 est de nouveau proposée.
  await page.goto('/#/analyse');
  await page.goto(url);
  await expect(page.getByTestId('self-step')).toBeVisible({ timeout: 60_000 });
  await page.goto('/#/progress');
  await expect(page.getByTestId('thinking-profile')).toContainText('Pas encore de revue réflexive');
});
