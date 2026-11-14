// REQ-NFR-005: falha se houver marcadores de trabalho pendente em src/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const PATTERN = /\b(TODO|FIXME|XXX)\b/;
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
    if (PATTERN.test(line)) hits.push(`${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length > 0) {
  console.error(`check:placeholders — ${hits.length} marcador(es) encontrado(s):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('check:placeholders — OK (nenhum TODO/FIXME/XXX em src/)');
