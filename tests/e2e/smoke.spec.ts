import { expect, test } from '@playwright/test';

test("la page d'accueil se charge et le serveur répond", async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fianchetto' })).toBeVisible();
  const health = await request.get('/api/health');
  expect(await health.json()).toEqual({ status: 'ok' });
});
