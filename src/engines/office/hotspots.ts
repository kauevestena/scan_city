import { OFFICE_H, OFFICE_W, type OfficeHotspot } from '@/data/office';

/** Posição do hotspot em porcentagem do canvas (para os botões sobrepostos). */
export function hotspotStyle(h: OfficeHotspot): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return {
    left: pct(h.rect.x, OFFICE_W),
    top: pct(h.rect.y, OFFICE_H),
    width: pct(h.rect.w, OFFICE_W),
    height: pct(h.rect.h, OFFICE_H),
  };
}

/** Ponto lógico (px) dentro do retângulo do hotspot? */
export function hitHotspot(h: OfficeHotspot, x: number, y: number): boolean {
  return x >= h.rect.x && x <= h.rect.x + h.rect.w && y >= h.rect.y && y <= h.rect.y + h.rect.h;
}

/** Tamanho que cabe em (w, h) mantendo a proporção do canvas da sala. */
export function fitOffice(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(width / OFFICE_W, height / OFFICE_H);
  return { width: Math.floor(OFFICE_W * scale), height: Math.floor(OFFICE_H * scale) };
}
