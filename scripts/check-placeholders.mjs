// REQ-NFR-005: falha se houver marcadores de trabalho pendente, funções vazias ou o antigo shell de
// depuração (`DebugScreenShell`) em src/. As funções vazias também são barradas pelo ESLint
// (`@typescript-eslint/no-empty-function`); aqui o grep as pega em qualquer arquivo de produção.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const PATTERN = /\b(TODO|FIXME|XXX)\b/;
/** O shell provisório de depuração (constitution §4.3) saiu na T079: nada pode voltar a usá-lo. */
const SHELL = /\bDebugScreenShell\b/;
/** Função (seta ou declarada) de corpo vazio, fora dos testes. */
const EMPTY_FUNCTION = /(=>\s*\{\s*\}|\bfunction\b[^(]*\([^)]*\)\s*\{\s*\})/;
const TEST_FILE = /\.test\.(ts|tsx)$/;
const EXTENSIONS = /\.(ts|tsx|css|mjs|js)$/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.test(name)) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const where = `${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`;
    if (PATTERN.test(line)) hits.push(where);
    else if (SHELL.test(line)) hits.push(`${where}  (o DebugScreenShell não existe mais)`);
    else if (!TEST_FILE.test(file) && EMPTY_FUNCTION.test(line)) {
      hits.push(`${where}  (função vazia)`);
    }
  });
}

if (hits.length > 0) {
  console.error(`check:placeholders — ${hits.length} marcador(es) encontrado(s):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(
  'check:placeholders — OK (sem TODO/FIXME/XXX, funções vazias nem DebugScreenShell em src/)',
);
