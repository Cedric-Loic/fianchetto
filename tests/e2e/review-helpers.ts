import { expect, type Page } from '@playwright/test';

/**
 * Attend l'ouverture de la revue d'une partie analysée. Si l'étape 1 de la revue réflexive
 * (sans moteur) est proposée, elle est passée : les parcours qui testent la revue normale
 * l'ignorent (voir self-review.spec.ts pour l'étape 1 elle-même).
 */
export async function openedReview(page: Page): Promise<void> {
  await expect(page.getByTestId('move-card').or(page.getByTestId('self-step'))).toBeVisible({
    timeout: 60_000,
  });
  if (await page.getByTestId('self-step').isVisible()) {
    await page.getByTestId('self-skip').click();
  }
  await expect(page.getByTestId('move-card')).toBeVisible();
}
