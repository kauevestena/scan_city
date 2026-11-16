import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * E2E no Firefox (REQ-NFR-009): `npm run e2e:firefox`. Usa o mesmo servidor e os mesmos testes da
 * configuração padrão, só troca o navegador. Na primeira vez: `npx playwright install firefox`.
 */
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
