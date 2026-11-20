import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/** Os testes de desafio do voo (ADR-032): pesados, rodam depois dos outros, sem disputar CPU. */
const CHALLENGE = 'src/engines/flight/challenge/**/*.test.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // O teste de tokens lê index.css como texto (`?raw`).
      css: true,
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: [CHALLENGE],
            sequence: { groupOrder: 0 },
          },
        },
        {
          extends: true,
          test: {
            name: 'challenge',
            include: [CHALLENGE],
            // Os testes de tempo dos outros arquivos já terminaram.
            sequence: { groupOrder: 1 },
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/types/**', 'src/vite-env.d.ts'],
        thresholds: {
          lines: 60,
          'src/domain/**': { lines: 90 },
          'src/lib/**': { lines: 90 },
        },
      },
    },
  }),
);
