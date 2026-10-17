import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout. Lance serveur + web (`pnpm dev`) puis pilote Chromium.
 * - tests/e2e : parcours utilisateur ;
 * - tests/security/e2e : attaques côté navigateur (agent qa-security).
 * Première utilisation sur ta machine : `pnpm exec playwright install chromium`.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'security/e2e/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
