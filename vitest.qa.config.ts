import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';

/**
 * `npm run qa:flight`: os pilotos simulados com várias sementes (ADR-032). Fica fora do
 * `npm run test` porque leva minutos; `QA_SEEDS` escolhe quantas (padrão 3).
 */
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['src/**/*.qa.ts'], testTimeout: 1_800_000 },
});
