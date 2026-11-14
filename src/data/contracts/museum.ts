/** Grade da ala Real do museu (holo-table §5): 4 colunas × 2 linhas de setores. */
export const MUSEUM_GRID = { cols: 4, rows: 2 } as const;

/** `slot` numérico de um setor em (coluna, linha), como na ficha do contrato. */
export function museumSlot(col: number, lin: number): number {
  if (col < 0 || col >= MUSEUM_GRID.cols || lin < 0 || lin >= MUSEUM_GRID.rows) {
    throw new RangeError(`Setor fora da grade do museu: (${col}, ${lin})`);
  }
  return lin * MUSEUM_GRID.cols + col;
}

/** Coluna e linha de um `slot`. */
export function museumSlotCoords(slot: number): { col: number; lin: number } {
  return { col: slot % MUSEUM_GRID.cols, lin: Math.floor(slot / MUSEUM_GRID.cols) };
}
