/// <reference types="node" />
/**
 * Os scripts `check:*` do release acham o projeto pelo próprio caminho (`import.meta.url`), e esse
 * caminho pode ter espaço, acento ou, no Windows, letra de unidade. Com `.pathname` o
 * `check:placeholders` caía com ENOENT, o `check:assets` dizia que `dist/` não existia e o
 * `check:terms` saía calado, sem varrer nada. Aqui eles rodam numa cópia dentro de uma pasta com
 * espaço e acento no nome e precisam passar no que está limpo e acusar o que não está.
 * Os termos de teste são montados em pedaços: este arquivo também é varrido pelos scripts.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const word = (...parts: string[]) => parts.join('');

const SCRIPTS = [
  ['check-placeholders.mjs', 'check:placeholders — OK'],
  ['check-forbidden-terms.mjs', 'check:terms — OK'],
  ['check-assets.mjs', 'check:assets — OK'],
] as const;

/** Um mini-projeto (`scripts/`, `src/` e `dist/`) numa pasta com espaço e acento no caminho. */
function makeProject() {
  const base = mkdtempSync(join(tmpdir(), 'scan city ação '));
  const root = join(base, 'meu projeto');
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
  cpSync(join(process.cwd(), 'scripts'), join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'src', 'limpo.ts'), 'export const limpo = 1;\n');
  writeFileSync(join(root, 'dist', 'index.html'), '<!doctype html>\n');
  writeFileSync(join(root, 'dist', 'assets', 'app.js'), 'export {};\n');
  return {
    root,
    run: (script: string) =>
      spawnSync(process.execPath, [join(root, 'scripts', script)], { cwd: root, encoding: 'utf8' }),
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

describe('scripts de verificação numa pasta com espaço e acento no caminho', () => {
  it('passam no projeto limpo e dizem que varreram (não saem calados)', () => {
    const project = makeProject();
    try {
      for (const [script, ok] of SCRIPTS) {
        const r = project.run(script);
        expect(r.stderr, script).toBe('');
        expect(r.status, script).toBe(0);
        expect(r.stdout, script).toContain(ok);
      }
    } finally {
      project.cleanup();
    }
  });

  it('acusam o que devem acusar', () => {
    const project = makeProject();
    try {
      writeFileSync(
        join(project.root, 'src', 'ruim.ts'),
        `// ${word('TO', 'DO')}: depois\nconst nome = '${word('so', 'nic')}';\n`,
      );
      writeFileSync(join(project.root, 'dist', 'assets', 'logo.png'), 'x');
      for (const [script] of SCRIPTS) {
        const r = project.run(script);
        expect(r.status, script).toBe(1);
        expect(r.stderr, script).toContain('— 1 ');
      }
    } finally {
      project.cleanup();
    }
  });
});
