import { AIRCRAFT, getVehicle, SENSORS, VEHICLES } from '@/data/catalog';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { SOUVENIRS } from '@/data/souvenirs';
import type { Contract, UnlockCondition } from '@/types';
import { hasIcon } from '@/ui/iconRegistry';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { BIOMES } from '@/world/terrain/biomes';
import {
  C00,
  CONTRACTS,
  contractByMarker,
  findContract,
  getContract,
  initialContracts,
  MUSEUM_GRID,
  museumSlot,
  museumSlotCoords,
} from '.';

const HEX = /^#[0-9a-f]{6}$/i;

function referencedContracts(cond: UnlockCondition): string[] {
  if (cond.type === 'CONTRACT_DONE') return [cond.contractId];
  if (cond.type === 'ALL' || cond.type === 'ANY') return cond.of.flatMap(referencedContracts);
  return [];
}

describe('schema dos contratos', () => {
  it('ids e marcadores únicos, no formato da campanha', () => {
    const ids = CONTRACTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const markers = CONTRACTS.map((c) => c.overworldMarker);
    expect(new Set(markers).size).toBe(markers.length);
    expect(ids).toContain('C00');
  });

  it.each(CONTRACTS.map((c) => [c.id, c] as const))('%s: campos válidos', (_id, c: Contract) => {
    // Identidade e mapa.
    expect(c.id).toMatch(c.dimension === 'REAL' ? /^C0[0-6]$/ : /^R(0[1-9]|1[01])$/);
    const marker = WORLD_MAP.markers.find((m) => m.char === c.overworldMarker);
    expect(marker?.kind).toBe(c.dimension === 'REAL' ? 'CONTRACT' : 'RIFT');
    expect(c.minVehicle).toBe(MARKER_ACCESS[c.overworldMarker]);
    expect(BIOMES[c.biome]).toBeDefined();

    // Cliente.
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.client.name.length).toBeGreaterThan(0);
    expect(hasIcon(c.client.portrait.icon)).toBe(true);
    expect(c.client.portrait.primary).toMatch(HEX);
    expect(c.client.portrait.secondary).toMatch(HEX);
    expect(c.client.portrait.initials).toMatch(/^[A-Z]{1,3}$/);

    // Parâmetros físicos.
    expect(c.aoi.widthM).toBeGreaterThan(0);
    expect(c.aoi.lengthM).toBeGreaterThanOrEqual(c.aoi.widthM);
    expect(c.ceilingM).toBeGreaterThan(0);
    expect(c.lightingOptions.length).toBeGreaterThan(0);
    expect(c.wind.meanMs).toBeGreaterThanOrEqual(0);

    // Requisitos: ids únicos com o prefixo do contrato, ao menos um crítico.
    const reqIds = c.requirements.map((r) => r.id);
    expect(new Set(reqIds).size).toBe(reqIds.length);
    for (const r of c.requirements) {
      expect(r.id.startsWith(`${c.id}-`)).toBe(true);
      expect(r.label.length).toBeGreaterThan(0);
    }
    expect(c.requirements.some((r) => r.severity === 'CRITICAL')).toBe(true);

    // Equipamento recomendado e veículos existem no catálogo.
    for (const a of c.recommended.aircraft) expect(AIRCRAFT.some((x) => x.id === a)).toBe(true);
    for (const s of c.recommended.sensors) {
      expect(SENSORS.some((x) => x.id === s) || s === 'POD_LIDAR').toBe(true);
    }
    expect(VEHICLES.some((v) => v.id === c.recommended.vehicle)).toBe(true);
    expect(getVehicle(c.minVehicle)).toBeDefined();

    // Recompensas.
    expect(c.basePaymentBRL).toBeGreaterThan(0);
    expect(Number.isInteger(c.basePaymentBRL)).toBe(true);
    expect(c.xp).toBeGreaterThan(0);
    expect(SOUVENIRS.some((s) => s.id === c.souvenirId)).toBe(true);
    expect(c.museum.wing).toBe(c.dimension);
    expect(c.museum.incomePerMinBRL).toBeGreaterThan(0);

    // Desbloqueio só referencia contratos do catálogo.
    for (const id of referencedContracts(c.unlock)) expect(findContract(id)).toBeDefined();

    // Diálogos: de 1 a 4 linhas por bloco.
    for (const block of [c.dialogs.briefing, c.dialogs.success, c.dialogs.failure]) {
      expect(block.length).toBeGreaterThanOrEqual(1);
      expect(block.length).toBeLessThanOrEqual(4);
      for (const line of block) expect(line.trim().length).toBeGreaterThan(0);
    }

    // Plano de referência coerente com o catálogo e as opções do contrato.
    const ref = c.referencePlan;
    const aircraft = AIRCRAFT.find((a) => a.id === ref.aircraftId);
    expect(aircraft?.compatibleSensors).toContain(ref.sensorId);
    expect(c.lightingOptions).toContain(ref.lighting);
    expect(ref.heightM).toBeLessThanOrEqual(c.ceilingM);
    for (const p of [...ref.gcps, ...ref.cps]) {
      expect(p.u).toBeGreaterThanOrEqual(0);
      expect(p.u).toBeLessThanOrEqual(c.aoi.lengthM);
      expect(p.v).toBeGreaterThanOrEqual(0);
      expect(p.v).toBeLessThanOrEqual(c.aoi.widthM);
    }
  });

  it('setores do museu únicos por ala, dentro da grade e fora do oceano decorativo (3, 1)', () => {
    const real = CONTRACTS.filter((c) => c.museum.wing === 'REAL').map((c) => c.museum.slot);
    expect(new Set(real).size).toBe(real.length);
    for (const slot of real) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(MUSEUM_GRID.cols * MUSEUM_GRID.rows);
      expect(slot).not.toBe(museumSlot(3, 1));
    }
  });

  it('C00 conforme a ficha: 6 requisitos (mais o de execução), R$ 2.500, setor (2, 1), desbloqueio ALWAYS', () => {
    expect(C00.requirements).toHaveLength(7);
    expect(C00.basePaymentBRL).toBe(250_000);
    expect(museumSlotCoords(C00.museum.slot)).toEqual({ col: 2, lin: 1 });
    expect(C00.museum.incomePerMinBRL).toBe(1_000);
    expect(C00.unlock).toEqual({ type: 'ALWAYS' });
    expect(C00.dialogs.briefing).toHaveLength(3);
  });

  it('todo contrato termina com o requisito crítico de execução do voo: 0,5, ou 0,4 no tutorial', () => {
    for (const c of CONTRACTS) {
      const last = c.requirements.at(-1);
      const value = c.id === 'C00' ? 0.4 : 0.5;
      expect(last, c.id).toEqual({
        id: `${c.id}-exec`,
        label: `Execução do voo ≥ ${value * 100} %`,
        severity: 'CRITICAL',
        check: { type: 'MIN_EXECUTION', value },
      });
      expect(
        c.requirements.filter((r) => r.check.type === 'MIN_EXECUTION'),
        c.id,
      ).toHaveLength(1);
    }
  });

  it('busca por id e por marcador; o progresso inicial libera só os ALWAYS', () => {
    expect(getContract('C00')).toBe(C00);
    expect(() => getContract('C99')).toThrow(RangeError);
    expect(findContract('C99')).toBeUndefined();
    expect(contractByMarker('0')).toBe(C00);
    expect(contractByMarker('z')).toBeUndefined();
    const progress = initialContracts();
    for (const c of CONTRACTS) {
      expect(progress[c.id]?.status).toBe(c.unlock.type === 'ALWAYS' ? 'AVAILABLE' : 'LOCKED');
    }
  });

  it('museumSlot rejeita posições fora da grade', () => {
    expect(museumSlot(0, 0)).toBe(0);
    expect(museumSlot(3, 1)).toBe(7);
    expect(() => museumSlot(4, 0)).toThrow(RangeError);
    expect(() => museumSlot(0, 2)).toThrow(RangeError);
  });
});
