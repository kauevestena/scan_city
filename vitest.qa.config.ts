import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * `npm run qa:flight`: os pilotos simulados com várias sementes (ADR-032). Fica fora do
 * `npm run test` porque leva minutos; `QA_SEEDS` escolhe quantas (padrão 3).
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.qa.ts'],
      testTimeout: 1_800_000,
    },
  }),
);
