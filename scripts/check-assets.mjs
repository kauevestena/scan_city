// REQ-NFR-006: o build não pode conter imagens, fontes ou áudios externos.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, e não `.pathname`: o `.pathname` mantém `%20` e acentos codificados e, no
// Windows, vem como `/C:/...`, então o script falharia (ou, pior, não varreria nada).
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const FORBIDDEN =
  /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|mp3|ogg|wav|flac|m4a|aac|mp4|webm|woff2?|ttf|otf|eot)$/i;

if (!existsSync(DIST)) {
  console.error('check:assets — dist/ não existe. Rode "npm run build" antes.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
const offenders = files.filter((f) => FORBIDDEN.test(f));

if (offenders.length > 0) {
  console.error(`check:assets — ${offenders.length} asset(s) proibido(s) em dist/:`);
  for (const f of offenders) console.error(`  ${relative(process.cwd(), f)}`);
  process.exit(1);
}
console.log(`check:assets — OK (${files.length} arquivo(s) em dist/, nenhum asset externo)`);
