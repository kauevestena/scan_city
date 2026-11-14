/** Versão atual do formato de save (architecture §6). */
export const SAVE_VERSION = 1;

/**
 * `MIGRATIONS[n]` converte um save da versão `n` para a `n + 1`.
 * Ainda não existe formato anterior ao v1, então a tabela começa vazia.
 */
export const MIGRATIONS: Record<
  number,
  (save: Record<string, unknown>) => Record<string, unknown>
> = {};

export type MigrationResult =
  { ok: true; save: Record<string, unknown>; from: number } | { ok: false; reason: string };

/** Aplica as migrações em sequência até `SAVE_VERSION`. Versão maior que a atual é inválida. */
export function migrateSave(
  raw: Record<string, unknown>,
  migrations: Record<
    number,
    (save: Record<string, unknown>) => Record<string, unknown>
  > = MIGRATIONS,
): MigrationResult {
  const from = raw.version;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 0) {
    return { ok: false, reason: 'versão ausente ou inválida' };
  }
  if (from > SAVE_VERSION) {
    return { ok: false, reason: `versão ${from} é mais nova que a suportada (${SAVE_VERSION})` };
  }
  let save = raw;
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: `não há migração da versão ${v}` };
    save = { ...step(save), version: v + 1 };
  }
  return { ok: true, save, from };
}
