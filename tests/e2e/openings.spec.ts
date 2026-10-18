import { expect, test, type Page } from '@playwright/test';

/** Clique au centre d'une case (plateau orienté Blancs en bas). */
async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function play(page: Page, uci: string) {
  await clickSquare(page, uci.slice(0, 2));
  await clickSquare(page, uci.slice(2, 4));
}

test('répertoire : réviser une ligne, erreur puis ligne recommencée jusqu’au mat de Légal', async ({
  page,
}) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`op${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('nav-user')).toBeVisible();

  await page.getByRole('link', { name: 'Leçons' }).click();
  await page.getByTestId('lessons-openings').click();
  await expect(page.getByRole('heading', { name: 'Répertoire d’ouvertures' })).toBeVisible();
  await expect(page.getByTestId('openings-due')).toContainText('Aucune ligne due');
  await expect(page.getByTestId('openings-review')).toContainText('Apprendre une nouvelle ligne');
  await expect(page.getByTestId('opening-w-legal')).toContainText('Nouvelle');
  await page.getByTestId('opening-train-w-legal').click();

  const status = page.getByTestId('opening-status');
  await expect(status).toContainText('coup 1 sur 8');
  // Erreur au premier coup : le bon coup est montré, puis la ligne recommence.
  await play(page, 'd2d4');
  await expect(page.getByTestId('opening-mistake')).toContainText('Le répertoire joue e4');
  await expect(status).toContainText('On recommence la ligne : à toi', { timeout: 10_000 });

  const line = ['e2e4', 'g1f3', 'f1c4', 'b1c3', 'h2h3', 'f3e5', 'c4f7', 'c3d5'];
  for (const [i, uci] of line.entries()) {
    await play(page, uci);
    if (i + 1 < line.length) await expect(status).toContainText(`coup ${i + 2} sur 8`);
  }
  await expect(page.getByTestId('opening-done')).toContainText('Elle reviendra demain');
  await expect(page.getByTestId('opening-played')).toContainText('8. Nd5#');

  await page.getByRole('button', { name: '← Répertoire' }).click();
  await expect(page.getByTestId('opening-w-legal')).toContainText('En cours · dans 1 j');
});
