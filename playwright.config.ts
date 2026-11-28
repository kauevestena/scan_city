import { defineConfig, devices } from '@playwright/test';

/**
 * No CI (ADR-039): uma nova tentativa por teste, que o relatório marca como *flaky* em vez de
 * esconder; o relatório HTML e a captura de tela das falhas, guardados pelo workflow. Na máquina
 * local nada muda.
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    screenshot: CI ? 'only-on-failure' : 'off',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
