/// <reference types="node" />
/**
 * Guarda de paródias (REQ-CNT-006, constitution §6): nenhum nome de franquia em `src/`.
 * Os nomes de teste são montados em pedaços: o próprio arquivo é varrido pelo script.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RIFT_CONTRACTS } from './rifts';

const SCRIPT = join(process.cwd(), 'scripts', 'check-forbidden-terms.mjs');
const word = (...parts: string[]) => parts.join('');

function run(dir?: string) {
  return spawnSync('node', dir ? [SCRIPT, dir] : [SCRIPT], { encoding: 'utf8' });
}

function withFile(content: string, name = 'amostra.ts') {
  const dir = mkdtempSync(join(tmpdir(), 'terms-'));
  writeFileSync(join(dir, name), content);
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('check:terms', () => {
  it('src/ está limpo (o mesmo comando do verify)', () => {
    const r = run();
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('acusa um nome de franquia, com arquivo, linha e termo, e sai com erro', () => {
    const { dir, cleanup } = withFile(`const a = 1;\nconst nome = "${word('So', 'nic')} Boom";\n`);
    try {
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('1 termo(s) proibido(s)');
      expect(r.stderr).toContain('amostra.ts:2');
      expect(r.stderr).toContain(`"${word('so', 'nic')}"`);
    } finally {
      cleanup();
    }
  });

  it('pega as variações: maiúsculas, acento, espaços extras e termos de duas palavras', () => {
    const lines = [
      word('M', 'ARIO'),
      word('Poké', 'mon'),
      word('Dragon', '   ', 'Ball'),
      word('star', ' ', 'wars'),
      word('Lara', ' ', 'Croft'),
      word('the ', 'wit', 'cher', ' saga'),
    ];
    const { dir, cleanup } = withFile(lines.join('\n'));
    try {
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(`${lines.length} termo(s) proibido(s)`);
    } finally {
      cleanup();
    }
  });

  it('só vale como palavra inteira: "cenário", "invader" e afins passam', () => {
    const innocent = [
      'const scenario = "um cenário";',
      'const invader = true;',
      'const ultrasonic = 3;',
      'const flash = "flashes";',
      'const ashes = [];',
      'const gtags = 1;',
      'const stevedore = 0;',
    ].join('\n');
    const { dir, cleanup } = withFile(innocent);
    try {
      expect(run(dir).status).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('termos de uma palavra só valem soltos, mas a tag <link> do HTML não conta', () => {
    const bad = withFile(
      `const t = "${word('li', 'nk')} do herói";\nconst u = "${word('sna', 'ke')}";`,
    );
    const ok = withFile(`<${word('li', 'nk')} rel="stylesheet" href="x.css">\n`, 'pagina.html');
    try {
      const r = run(bad.dir);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('2 termo(s) proibido(s)');
      expect(run(ok.dir).status).toBe(0);
    } finally {
      bad.cleanup();
      ok.cleanup();
    }
  });

  it('o verify do projeto roda o check:terms', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:terms']).toBe('node scripts/check-forbidden-terms.mjs');
    expect(pkg.scripts.verify).toContain('npm run check:terms');
  });

  it('o catálogo das fendas só tem retratos de emblema abstrato (forma, ícone, duas cores, iniciais)', () => {
    for (const rift of RIFT_CONTRACTS) {
      const p = rift.client.portrait;
      expect(['CIRCLE', 'SHIELD', 'HEXAGON', 'DIAMOND', 'STAR']).toContain(p.shape);
      expect(p.icon).toMatch(/^[A-Z][A-Za-z0-9]+$/);
      expect(p.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.initials).toMatch(/^[A-Z]{1,3}$/);
    }
  });

  it('execFileSync no script com um diretório limpo devolve a mensagem de sucesso', () => {
    const { dir, cleanup } = withFile('export const a = 1;\n');
    try {
      expect(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' })).toContain('OK');
    } finally {
      cleanup();
    }
  });
});
