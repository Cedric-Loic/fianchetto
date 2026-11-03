import { expect, test, type Page } from '@playwright/test';

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function signUp(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`slow${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByTestId('my-rating')).toBeVisible();
}

test('partie lente contre le bot : cadence, routine de réflexion, non classée', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signUp(page);

  // Le groupe « Parties lentes » n'existe que contre le bot (pas à deux sur l'écran).
  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  const slowGroup = bot.getByRole('group', { name: 'Parties lentes' });
  await expect(slowGroup).toContainText('non classée');
  await expect(slowGroup.getByTestId('tc-rapid-15+10')).toHaveText('15 | 10');
  await expect(slowGroup.getByTestId('tc-classical-30+0')).toHaveText('30 min');
  await expect(page.getByTestId('seat-tc-rapid-15+10')).toHaveCount(0);

  // Lien de la séance du jour : l'accueil présélectionne 15 | 10 contre le bot.
  await page.goto('/#/?slow=1');
  await expect(page.getByTestId('tc-rapid-15+10')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('slow-note')).toContainText('non classée');
  await page.screenshot({ path: 'test-results/slow-accueil.png' });

  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByTestId('play-bot').click();

  await expect(page.getByTestId('turn-banner')).toBeVisible();
  await expect(page.getByTestId('slow-badge')).toContainText('non classée');
  await expect(page.getByTestId('turn-banner').getByText('Classée', { exact: true })).toHaveCount(
    0,
  );
  // Pendule de 15 minutes.
  await expect(page.getByTestId('turn-banner')).toBeVisible();
  await expect(page.locator('.board-bar').first()).toContainText(/15:0\d|14:5\d/);

  // Routine : fermée au départ, ouverte au clic, dans le panneau latéral.
  await expect(page.getByTestId('routine-panel')).toHaveCount(0);
  await page.getByTestId('routine-button').click();
  const panel = page.getByTestId('routine-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('routine-question')).toHaveCount(3);
  await expect(panel).toContainText('Que menace son dernier coup ?');
  await expect(panel).toContainText('Échecs, prises, attaques');
  await expect(panel).toContainText('Mes coups candidats');
  await expect(page.getByTestId('routine-check')).toContainText('que peut-il répondre ?');
  const inSide = await panel.evaluate((el) => el.closest('.side-panel') !== null);
  expect(inSide).toBe(true);
  await page.screenshot({ path: 'test-results/slow-routine.png' });

  // Touche r : referme puis rouvre.
  await page.keyboard.press('r');
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('r');
  await expect(panel).toBeVisible();

  // La partie se joue normalement et le bot répond.
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('move-list').locator('button.move')).toHaveCount(2, {
    timeout: 20_000,
  });

  // Fin de partie : non classée, donc pas de variation d'Elo.
  await page.getByTestId('resign').click();
  await page.getByTestId('confirm-resign').click();
  await expect(page.getByTestId('end-modal')).toContainText('gagne par abandon');
  await expect(page.getByTestId('elo-change')).toHaveCount(0);
  await expect(page.getByTestId('routine-button')).toHaveCount(0);
});
