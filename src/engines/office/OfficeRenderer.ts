/**
 * Sala do escritório desenhada em Canvas (office §4): paredes de tijolo, piso de tábuas,
 * luminárias com poeira na luz e os 9 móveis. Tudo procedural, em "pixel art" de retângulos.
 * As cores da sala são do engine (REQ-UI-001 permite hex nos engines).
 */
import { OFFICE_H, OFFICE_HOTSPOTS, OFFICE_W, type OfficeHotspotId } from '@/data/office';
import { hash2 } from '@/lib/rng';
import type { AircraftId, HardwareId, StaffRoleId, VehicleId } from '@/types';
import { COLORS, withAlpha } from '@/ui/tokens';
import {
  ATLAS_BEAK,
  ATLAS_EYE,
  ATLAS_INK,
  ATLAS_NECK,
  ATLAS_NECK_SHEEN,
  mixHex,
} from '../flight/aircraftSprite';

export interface OfficeSceneState {
  aircraft: readonly AircraftId[];
  vehicles: readonly VehicleId[];
  hardware: HardwareId;
  /** Cores dos souvenirs obtidos, na ordem da estante. */
  souvenirColors: readonly string[];
  staff: Readonly<Record<StaffRoleId, number>>;
  /** Cores do acessório do Atlas, ou `null` sem acessório. */
  atlasAccessory: { primary: string; secondary: string } | null;
  /** Qual acessório: cada um tem o seu desenho; sem id, a faixa no pescoço. */
  atlasAccessoryId?: string;
  /** Preview `soft3d` da maquete do museu sobre a mesa; sem ele, o relevo em linhas. */
  holo?: {
    draw(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      timeS: number,
    ): void;
  } | null;
}

const PAL = {
  brick: '#4a2f27',
  brickAlt: '#55362c',
  mortar: '#2b1c18',
  floor: '#5b4129',
  floorAlt: '#4f3822',
  seam: '#36261a',
  wood: '#7a5233',
  woodDark: '#4e321e',
  metal: '#3c4655',
  metalLight: '#5b6676',
  paper: '#e9dfc4',
  cork: '#a0764a',
  pigeon: '#8f97a3',
  pigeonDark: '#626a76',
  beak: '#e2a14a',
  feet: '#e8836b',
  cere: '#e5e7eb',
  door: '#6b4527',
  sky: '#9fd3f0',
  screen: '#0b3a44',
  flaskA: '#4ade80',
  flaskB: '#a78bfa',
  gate: '#2b333e',
  car: '#c2410c',
  van: '#e2e8f0',
  skin: '#d6a07a',
} as const;

const rect = (id: OfficeHotspotId) =>
  (OFFICE_HOTSPOTS.find((h) => h.id === id) as (typeof OFFICE_HOTSPOTS)[number]).rect;

export type FleetSpriteKind =
  'DRONE_T1' | 'DRONE_T2' | 'VTOL_T3' | 'COMPACT_CAR' | 'PICKUP_4X4' | 'LAB_VAN';

/** Frota visível na garagem: cresce conforme as compras (office §4). */
export function fleetSprites(
  aircraft: readonly AircraftId[],
  vehicles: readonly VehicleId[],
): Array<{ kind: FleetSpriteKind; x: number; y: number }> {
  const g = rect('GARAGE');
  const out: Array<{ kind: FleetSpriteKind; x: number; y: number }> = [];
  (['DRONE_T1', 'DRONE_T2', 'VTOL_T3'] as const).forEach((id, i) => {
    if (aircraft.includes(id)) out.push({ kind: id, x: g.x + 30 + i * 78, y: g.y + 52 });
  });
  (['COMPACT_CAR', 'PICKUP_4X4', 'LAB_VAN'] as const).forEach((id, i) => {
    if (vehicles.includes(id)) out.push({ kind: id, x: g.x + 20 + i * 84, y: g.y + 150 });
  });
  return out;
}

/** Os 18 nichos da estante (6 × 3) e quais estão preenchidos. */
export function shelfSlots(filled: number): Array<{ x: number; y: number; filled: boolean }> {
  const s = rect('SHELF');
  return Array.from({ length: 18 }, (_, i) => ({
    x: s.x + 22 + (i % 6) * 30,
    y: s.y + 46 + Math.floor(i / 6) * 58,
    filled: i < filled,
  }));
}

/** Atlas pisca a cada ~4 s e bica a cada ~7 s (determinístico pelo tempo). */
export function atlasPose(timeS: number): { blink: boolean; peck: number } {
  const blink = timeS % 4 < 0.15;
  const phase = timeS % 7;
  const peck = phase < 0.6 ? Math.sin((phase / 0.6) * Math.PI) : 0;
  return { blink, peck };
}

/**
 * O Atlas no poleiro, de perfil e olhando para a direita (T097): o mesmo pombo do voo — cabeça
 * grande, olho laranja com a sobrancelha franzida, topete em três pontas, pescoço iridescente,
 * as barras escuras na asa dobrada, a cauda com a ponta escura e os pés no poleiro. `(cx, by)`
 * é o centro do corpo; o acessório equipado é desenhado do jeito dele.
 */
export function drawPerchedAtlas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  by: number,
  timeS: number,
  accessory: OfficeSceneState['atlasAccessory'],
  accessoryId?: string,
): void {
  const { blink, peck } = atlasPose(timeS);
  const poly = (pts: readonly (readonly [number, number])[]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const oval = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  };
  // Pés agarrados no poleiro.
  ctx.fillStyle = PAL.feet;
  ctx.fillRect(cx - 7, by + 13, 3, 7);
  ctx.fillRect(cx + 4, by + 13, 3, 7);
  ctx.fillRect(cx - 10, by + 18, 9, 3);
  ctx.fillRect(cx + 1, by + 18, 9, 3);
  // Cauda em leque, com a ponta escura.
  ctx.fillStyle = PAL.pigeonDark;
  poly([
    [cx - 14, by - 4],
    [cx - 42, by + 6],
    [cx - 40, by + 17],
    [cx - 12, by + 10],
  ]);
  ctx.fillStyle = ATLAS_INK;
  poly([
    [cx - 35, by + 3.5],
    [cx - 42, by + 6],
    [cx - 40, by + 17],
    [cx - 33, by + 14.5],
  ]);
  // Corpo gordinho e o peito mais claro.
  ctx.fillStyle = PAL.pigeon;
  oval(cx, by, 24, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  oval(cx + 8, by + 5, 13, 9);
  // Asa dobrada: as duas barras escuras e a ponta das rêmiges.
  ctx.fillStyle = PAL.pigeonDark;
  oval(cx - 7, by + 1, 17, 11, -0.25);
  ctx.fillStyle = ATLAS_INK;
  oval(cx - 21, by + 6, 6, 4, -0.25);
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 9, by - 7);
  ctx.lineTo(cx - 13, by + 8);
  ctx.moveTo(cx - 2, by - 8);
  ctx.lineTo(cx - 6, by + 8);
  ctx.stroke();
  // Pescoço iridescente: o verde e o brilho violeta que corre devagar.
  const nx = cx + 14 + peck * 3;
  const ny = by - 9 + peck * 5;
  ctx.fillStyle = ATLAS_NECK;
  oval(nx, ny, 10, 9, -0.5);
  ctx.fillStyle = ATLAS_NECK_SHEEN;
  oval(nx + Math.sin(timeS * 1.7) * 3, ny, 5, 6, -0.5);
  // Topete de três pontas, para trás; a cabeça grande e redonda cobre a base.
  const hx = cx + 18 + peck * 6;
  const hy = by - 17 + peck * 10;
  ctx.fillStyle = ATLAS_INK;
  poly([
    [hx - 9, hy - 6],
    [hx - 16, hy - 16],
    [hx - 5, hy - 10],
    [hx - 6, hy - 20],
    [hx, hy - 11],
    [hx + 3, hy - 18],
    [hx + 4, hy - 9],
  ]);
  ctx.fillStyle = mixHex(PAL.pigeon, ATLAS_INK, 0.22);
  ctx.beginPath();
  ctx.arc(hx, hy, 12, 0, Math.PI * 2);
  ctx.fill();
  // Bico com a ponta mais escura e a cera branca na base.
  ctx.fillStyle = ATLAS_BEAK;
  poly([
    [hx + 9, hy - 3],
    [hx + 20, hy + 1],
    [hx + 9, hy + 4],
  ]);
  ctx.fillStyle = mixHex(ATLAS_BEAK, ATLAS_INK, 0.35);
  poly([
    [hx + 16, hy - 0.5],
    [hx + 20, hy + 1],
    [hx + 16, hy + 2.5],
  ]);
  ctx.fillStyle = PAL.cere;
  oval(hx + 10, hy - 3, 3, 2);
  // Olho laranja com brilho (piscando, um traço) e a sobrancelha franzida.
  const ex = hx + 3;
  const ey = hy - 2;
  ctx.fillStyle = ATLAS_INK;
  if (blink) {
    ctx.fillRect(ex - 4, ey, 8, 1.5);
  } else {
    ctx.fillStyle = ATLAS_EYE;
    ctx.beginPath();
    ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.arc(ex + 0.8, ey, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 1.6, ey - 1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ATLAS_INK;
  }
  poly([
    [ex - 5, ey - 8],
    [ex + 6, ey - 4.5],
    [ex + 5.5, ey - 2.5],
    [ex - 5, ey - 5.5],
  ]);
  if (accessory)
    drawPerchedAccessory(ctx, { cx, by, hx, hy, nx, ny, timeS }, accessory, accessoryId);
}

/** O acessório do Atlas no poleiro, pelo id (sem id, a faixa no pescoço com a plaquinha). */
function drawPerchedAccessory(
  ctx: CanvasRenderingContext2D,
  at: { cx: number; by: number; hx: number; hy: number; nx: number; ny: number; timeS: number },
  colors: { primary: string; secondary: string },
  accessoryId: string | undefined,
): void {
  const { cx, by, hx, hy, nx, ny, timeS } = at;
  switch (accessoryId) {
    case 'ATLAS_GOGGLES': {
      // Óculos de aviador levantados na testa: a tira em volta da cabeça e a lente no alto.
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy, 10.5, -1.2, -2.8, true);
      ctx.stroke();
      ctx.fillStyle = colors.secondary;
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 11, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(hx + 2.5, hy - 13, 1.5, 1.5);
      return;
    }
    case 'ATLAS_SCARF': {
      // Cachecol: a volta no pescoço e as pontas balançando atrás.
      const wave = Math.sin(timeS * 2.2) * 1.5;
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.moveTo(nx - 6, ny + 1);
      ctx.quadraticCurveTo(nx - 16, ny - 2 + wave, nx - 26, ny + 3 + wave * 1.5);
      ctx.lineTo(nx - 25, ny + 8 + wave * 1.5);
      ctx.quadraticCurveTo(nx - 15, ny + 5 + wave, nx - 5, ny + 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(nx, ny + 2, 11, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(nx - 25, ny + 4 + wave * 1.5, 3, 3);
      ctx.fillRect(nx - 4, ny + 1, 8, 2);
      return;
    }
    case 'ATLAS_GPS_PACK': {
      // Mochilinha GPS nas costas: a antena com a bolinha e o LED que pisca.
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 12, by - 19);
      ctx.lineTo(cx - 15, by - 31);
      ctx.stroke();
      ctx.fillStyle = colors.primary;
      ctx.fillRect(cx - 16, by - 20, 15, 11);
      ctx.fillStyle = colors.secondary;
      ctx.beginPath();
      ctx.arc(cx - 15, by - 31, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (Math.floor(timeS * 2) % 2 === 0) ctx.fillRect(cx - 6, by - 17, 3, 3);
      return;
    }
    case 'ATLAS_LAUREL': {
      // Coroa de louros em volta do alto da cabeça, com a fitinha atrás.
      ctx.fillStyle = colors.primary;
      for (let k = 0; k < 7; k++) {
        const a = -2.7 + k * 0.33;
        ctx.beginPath();
        ctx.ellipse(
          hx + Math.cos(a) * 12,
          hy + Math.sin(a) * 12,
          3.4,
          1.7,
          a + Math.PI / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(hx - 14, hy - 6, 3, 6);
      ctx.fillRect(hx - 12, hy - 5, 3, 7);
      return;
    }
    default:
      // A faixa no pescoço e a plaquinha.
      ctx.fillStyle = colors.primary;
      ctx.fillRect(nx - 8, ny + 2, 16, 4);
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(nx - 8, ny + 6, 6, 6);
  }
}

export const DUST_COUNT = 36;

/** Partícula de poeira `i` no instante t: deriva lenta dentro dos cones das luminárias. */
export function dustParticle(i: number, timeS: number): { x: number; y: number; alpha: number } {
  const lamp = i % 2 === 0 ? 380 : 900;
  const sx = hash2(i, 1, 77);
  const sy = hash2(i, 2, 77);
  const speed = 4 + hash2(i, 3, 77) * 8;
  const y = 60 + ((sy * 320 + timeS * speed) % 320);
  const spread = (y - 40) * 0.45;
  const x = lamp + (sx - 0.5) * 2 * spread + Math.sin(timeS * 0.5 + i) * 6;
  return { x, y, alpha: 0.15 + 0.35 * hash2(i, 4, 77) };
}

export class OfficeRenderer {
  private timeS = 0;

  update(dtS: number): void {
    this.timeS += dtS;
  }

  get time(): number {
    return this.timeS;
  }

  render(
    ctx: CanvasRenderingContext2D,
    state: OfficeSceneState,
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.scale(width / OFFICE_W, height / OFFICE_H);
    this.drawRoom(ctx);
    this.drawLamps(ctx);
    this.drawShelf(ctx, state.souvenirColors);
    this.drawCareer(ctx);
    this.drawHoloTable(ctx, state.holo ?? null);
    this.drawPerch(ctx, state.atlasAccessory, state.atlasAccessoryId);
    this.drawDoor(ctx);
    this.drawWorkstation(ctx, state.hardware);
    this.drawStaffDesk(ctx, state.staff);
    this.drawLab(ctx);
    this.drawGarage(ctx, state);
    this.drawDust(ctx);
    ctx.restore();
  }

  private drawRoom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PAL.mortar;
    ctx.fillRect(0, 0, OFFICE_W, 384);
    for (let row = 0; row < 16; row++) {
      const offset = row % 2 === 0 ? 0 : 24;
      for (let col = -1; col < 28; col++) {
        ctx.fillStyle = hash2(col, row, 5) > 0.5 ? PAL.brick : PAL.brickAlt;
        ctx.fillRect(col * 48 + offset + 1, row * 24 + 1, 46, 22);
      }
    }
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(0, 372, OFFICE_W, 14);
    for (let row = 0; row < 9; row++) {
      ctx.fillStyle = row % 2 === 0 ? PAL.floor : PAL.floorAlt;
      ctx.fillRect(0, 386 + row * 32, OFFICE_W, 32);
      ctx.fillStyle = PAL.seam;
      ctx.fillRect(0, 386 + row * 32, OFFICE_W, 2);
      const shift = (row * 173) % 240;
      for (let x = shift; x < OFFICE_W; x += 240) ctx.fillRect(x, 386 + row * 32, 2, 32);
    }
  }

  private drawLamps(ctx: CanvasRenderingContext2D): void {
    for (const x of [380, 900]) {
      ctx.fillStyle = PAL.metal;
      ctx.fillRect(x - 1, 0, 2, 34);
      ctx.fillRect(x - 22, 34, 44, 12);
      const cone = ctx.createLinearGradient(x, 46, x, 380);
      cone.addColorStop(0, 'rgba(254, 243, 199, 0.22)');
      cone.addColorStop(1, 'rgba(254, 243, 199, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x - 20, 46);
      ctx.lineTo(x + 20, 46);
      ctx.lineTo(x + 150, 380);
      ctx.lineTo(x - 150, 380);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawDust(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < DUST_COUNT; i++) {
      const p = dustParticle(i, this.timeS);
      ctx.fillStyle = `rgba(254, 243, 199, ${p.alpha})`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  private drawShelf(ctx: CanvasRenderingContext2D, colors: readonly string[]): void {
    const s = rect('SHELF');
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(s.x + 8, s.y + 70 + k * 58, s.w - 16, 6);
    }
    shelfSlots(colors.length).forEach((slot, i) => {
      if (slot.filled) {
        ctx.fillStyle = colors[i] as string;
        ctx.beginPath();
        ctx.arc(slot.x + 10, slot.y + 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(slot.x + 6, slot.y + 6, 3, 3);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(slot.x + 3, slot.y + 4, 14, 18);
      }
    });
  }

  private drawCareer(ctx: CanvasRenderingContext2D): void {
    const c = rect('CAREER');
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = PAL.cork;
    ctx.fillRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 4; row++) {
        const x = c.x + 30 + col * 52;
        const y = c.y + 20 + row * 26;
        ctx.fillStyle = PAL.paper;
        ctx.fillRect(x - 10, y - 6, 20, 14);
        if (row < 3) {
          ctx.fillStyle = PAL.woodDark;
          ctx.fillRect(x - 1, y + 8, 2, 12);
        }
      }
    }
  }

  private drawHoloTable(ctx: CanvasRenderingContext2D, holo: OfficeSceneState['holo']): void {
    const h = rect('HOLO_TABLE');
    const cx = h.x + h.w / 2;
    const top = h.y + 110;
    // Base metálica.
    ctx.fillStyle = PAL.metal;
    ctx.beginPath();
    ctx.moveTo(h.x + 20, top);
    ctx.lineTo(h.x + h.w - 20, top);
    ctx.lineTo(h.x + h.w - 50, h.y + h.h);
    ctx.lineTo(h.x + 50, h.y + h.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.metalLight;
    ctx.fillRect(h.x + 20, top - 6, h.w - 40, 8);
    // Projeção: relevo em linhas que ondulam devagar.
    const glow = ctx.createRadialGradient(cx, top - 30, 10, cx, top - 30, 150);
    glow.addColorStop(0, withAlpha(COLORS.radar, 0.28));
    glow.addColorStop(1, withAlpha(COLORS.radar, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(h.x, h.y - 20, h.w, 140);
    if (holo) {
      // A maquete do museu, girando sobre a mesa.
      holo.draw(ctx, h.x + 10, h.y - 20, h.w - 20, 130, this.timeS);
      return;
    }
    ctx.strokeStyle = withAlpha(COLORS.radar, 0.7);
    ctx.lineWidth = 1;
    for (let row = 0; row < 7; row++) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const x = h.x + 40 + (k / 24) * (h.w - 80);
        const y =
          top -
          18 -
          row * 9 -
          10 * Math.sin(k * 0.5 + row * 0.7 + this.timeS * 0.8) * Math.sin((k / 24) * Math.PI);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private drawPerch(
    ctx: CanvasRenderingContext2D,
    accessory: OfficeSceneState['atlasAccessory'],
    accessoryId: string | undefined,
  ): void {
    const p = rect('PERCH');
    const cx = p.x + p.w / 2;
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(cx - 4, p.y + 70, 8, p.h - 70);
    ctx.fillRect(cx - 40, p.y + p.h - 8, 80, 8);
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(cx - 46, p.y + 66, 92, 8);
    drawPerchedAtlas(ctx, cx, p.y + 46, this.timeS, accessory, accessoryId);
  }

  private drawDoor(ctx: CanvasRenderingContext2D): void {
    const d = rect('DOOR');
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = PAL.door;
    ctx.fillRect(d.x + 12, d.y + 12, d.w - 24, d.h - 12);
    ctx.fillStyle = PAL.sky;
    ctx.fillRect(d.x + 40, d.y + 34, d.w - 80, 70);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(d.x + d.w / 2 - 2, d.y + 34, 4, 70);
    ctx.fillStyle = PAL.beak;
    ctx.beginPath();
    ctx.arc(d.x + d.w - 34, d.y + d.h / 2 + 20, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWorkstation(ctx: CanvasRenderingContext2D, hardware: HardwareId): void {
    const w = rect('WORKSTATION');
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(w.x, w.y + 90, w.w, 16);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(w.x + 10, w.y + 106, 12, w.h - 106);
    ctx.fillRect(w.x + w.w - 22, w.y + 106, 12, w.h - 106);
    const laptop = hardware === 'OLD_LAPTOP';
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(w.x + 50, w.y + (laptop ? 30 : 10), laptop ? 110 : 140, laptop ? 62 : 80);
    ctx.fillStyle = PAL.screen;
    ctx.fillRect(w.x + 56, w.y + (laptop ? 36 : 16), laptop ? 98 : 128, laptop ? 50 : 68);
    ctx.fillStyle = withAlpha(COLORS.ok, 0.8);
    const lines = laptop ? 6 : 8;
    for (let k = 0; k < lines; k++) {
      const len = 20 + hash2(k, Math.floor(this.timeS * 2), 9) * 60;
      ctx.fillRect(w.x + 62, w.y + (laptop ? 42 : 22) + k * 7, len, 3);
    }
    if (!laptop) {
      ctx.fillStyle = PAL.metal;
      ctx.fillRect(w.x + 196, w.y + 30, 30, 62);
      ctx.fillStyle = withAlpha(COLORS.radar, 0.9);
      ctx.fillRect(w.x + 204, w.y + 40, 14, 3);
    }
  }

  private drawStaffDesk(ctx: CanvasRenderingContext2D, staff: OfficeSceneState['staff']): void {
    const s = rect('STAFF');
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(s.x, s.y + 70, s.w, 14);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(s.x + 8, s.y + 84, 10, s.h - 84);
    ctx.fillRect(s.x + s.w - 18, s.y + 84, 10, s.h - 84);
    const people = (staff.INTERN ?? 0) + (staff.JUNIOR_ENG ?? 0);
    for (let k = 0; k < 5; k++) {
      const x = s.x + 26 + k * 42;
      if (k < people) {
        ctx.fillStyle = k < (staff.JUNIOR_ENG ?? 0) ? COLORS.radarDim : COLORS.warn;
        ctx.fillRect(x - 10, s.y + 34, 20, 34);
        ctx.fillStyle = PAL.skin;
        ctx.beginPath();
        ctx.arc(x, s.y + 24, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(x - 10, s.y + 100, 20, 6);
      }
    }
  }

  private drawLab(ctx: CanvasRenderingContext2D): void {
    const l = rect('LAB');
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(l.x, l.y + 96, l.w, 14);
    ctx.fillRect(l.x + 10, l.y + 110, 10, l.h - 110);
    ctx.fillRect(l.x + l.w - 20, l.y + 110, 10, l.h - 110);
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(l.x + 20, l.y, 120, 80);
    ctx.strokeStyle = COLORS.radarDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const x = l.x + 28 + k * 10;
      const y = l.y + 60 - 30 * Math.abs(Math.sin(k * 0.6));
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const bubble = (Math.sin(this.timeS * 2) + 1) / 2;
    [PAL.flaskA, PAL.flaskB].forEach((color, i) => {
      const x = l.x + 160 + i * 28;
      ctx.fillStyle = withAlpha(COLORS.text, 0.25);
      ctx.fillRect(x - 3, l.y + 56, 6, 16);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, l.y + 82, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - 2, l.y + 66 - bubble * 8 - i * 4, 3, 3);
    });
  }

  private drawGarage(ctx: CanvasRenderingContext2D, state: OfficeSceneState): void {
    const g = rect('GARAGE');
    ctx.fillStyle = PAL.gate;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.fillStyle = PAL.metal;
    for (let k = 0; k < 4; k++) ctx.fillRect(g.x, g.y + k * 8, g.w, 3);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(g.x + 14, g.y + 84, g.w - 28, 6);
    for (const sprite of fleetSprites(state.aircraft, state.vehicles)) {
      this.drawFleetSprite(ctx, sprite.kind, sprite.x, sprite.y);
    }
  }

  private drawFleetSprite(
    ctx: CanvasRenderingContext2D,
    kind: FleetSpriteKind,
    x: number,
    y: number,
  ): void {
    if (kind === 'VTOL_T3') {
      ctx.fillStyle = PAL.van;
      ctx.fillRect(x, y + 10, 60, 6);
      ctx.fillRect(x + 22, y, 12, 26);
      return;
    }
    if (kind === 'DRONE_T1' || kind === 'DRONE_T2') {
      const size = kind === 'DRONE_T2' ? 24 : 18;
      ctx.fillStyle = kind === 'DRONE_T2' ? COLORS.textMuted : PAL.metalLight;
      ctx.fillRect(x + 10, y + 8, size, 8);
      ctx.fillStyle = withAlpha(COLORS.text, 0.4);
      for (const dx of [0, size + 14]) ctx.fillRect(x + dx, y + 4, 14, 3);
      return;
    }
    const body = kind === 'LAB_VAN' ? PAL.van : kind === 'PICKUP_4X4' ? COLORS.radarDim : PAL.car;
    const length = kind === 'LAB_VAN' ? 76 : 66;
    ctx.fillStyle = body;
    ctx.fillRect(x, y + 14, length, 26);
    ctx.fillRect(x + 8, y, length - 30, 16);
    ctx.fillStyle = COLORS.bgBase;
    for (const wx of [x + 12, x + length - 16]) {
      ctx.beginPath();
      ctx.arc(wx, y + 42, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
