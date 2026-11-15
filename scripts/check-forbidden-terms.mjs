// REQ-CNT-006 (constitution §6): falha se algum nome de franquia aparecer em src/ ou em outro
// diretório passado como argumento. Os nomes só existem nas specs, como referência de design.
//
// Uso: node scripts/check-forbidden-terms.mjs [diretório]   (padrão: src/)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** Termos proibidos (contracts-rifts §3). A lista pode ser expandida. */
export const FORBIDDEN_TERMS = [
  'sonic',
  'mario',
  'luigi',
  'bowser',
  'dragon ball',
  'goku',
  'kamehameha',
  'zelda',
  'link',
  'hyrule',
  'triforce',
  'minecraft',
  'steve',
  'creeper',
  'witcher',
  'geralt',
  'metal gear',
  'snake',
  'gta',
  'san andreas',
  'carl johnson',
  'pokemon',
  'pikachu',
  'ash',
  'star wars',
  'vader',
  'death star',
  'tomb raider',
  'lara croft',
];

const EXTENSIONS = /\.(ts|tsx|css|json|mjs|js|html|md|svg)$/;

/** Minúsculas e sem acentos: "Pokémon" casa com "pokemon". */
const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Cada termo vale como palavra inteira (`scenario` não é `mario`, `invader` não é `vader`). */
const PATTERNS = FORBIDDEN_TERMS.map((term) => ({
  term,
  regex: new RegExp(`(?<![a-z0-9])${term.replace(' ', '\\s+')}(?![a-z0-9])`),
}));

/** `link` de CSS e `<Link` de roteador não são o personagem: só o termo solto vale. */
const ALLOWED = [/<\/?link\b/, /\blink\s*:\s*#/, /rel=["']?stylesheet/];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.test(name)) out.push(full);
  }
  return out;
}

/** Ocorrências proibidas num texto: `{ line, term, text }[]`. */
export function findForbidden(text) {
  const hits = [];
  normalize(text)
    .split('\n')
    .forEach((line, i) => {
      for (const { term, regex } of PATTERNS) {
        if (!regex.test(line)) continue;
        if (term === 'link' && ALLOWED.some((a) => a.test(line))) continue;
        hits.push({ line: i + 1, term, text: line.trim() });
      }
    });
  return hits;
}

export function checkDirectory(dir) {
  const hits = [];
  for (const file of walk(dir)) {
    for (const hit of findForbidden(readFileSync(file, 'utf8'))) {
      hits.push({ file: relative(process.cwd(), file), ...hit });
    }
  }
  return hits;
}

// Só roda como script (não quando importado pelos testes).
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const target = resolve(process.argv[2] ?? new URL('../src', import.meta.url).pathname);
  const hits = checkDirectory(target);
  if (hits.length > 0) {
    console.error(`check:terms — ${hits.length} termo(s) proibido(s) encontrado(s):`);
    for (const h of hits) console.error(`  ${h.file}:${h.line}: "${h.term}" em: ${h.text}`);
    process.exit(1);
  }
  console.log(
    `check:terms — OK (nenhum nome de franquia em ${relative(process.cwd(), target) || '.'})`,
  );
}
