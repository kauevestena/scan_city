import type {
  Aircraft,
  CameraSensor,
  FieldEquipment,
  Hardware,
  Lens,
  LidarPayload,
  StaffRole,
  Vehicle,
} from '@/types';
import { AIRCRAFT } from './aircraft';
import { FIELD_EQUIPMENT } from './fieldEquipment';
import { HARDWARE, HARDWARE_ORDER } from './hardware';
import { LENSES } from './lenses';
import { PAYLOADS } from './payloads';
import { SENSORS } from './sensors';
import { STAFF } from './staff';
import { VEHICLES } from './vehicles';

export { AIRCRAFT, ATLAS_RULES, T2_COMBO_ITEMS } from './aircraft';
export { FIELD_EQUIPMENT, POINT_LIMITS, SIGMA_Z_FACTOR } from './fieldEquipment';
export { HARDWARE, HARDWARE_ORDER } from './hardware';
export { LENSES } from './lenses';
export { brl } from './money';
export { PAYLOADS } from './payloads';
export { SENSORS } from './sensors';
export { STAFF } from './staff';
export { VEHICLES, WHEELED_VEHICLES } from './vehicles';

/** Catálogo completo, para funções de domínio que recebem o catálogo por parâmetro. */
export interface Catalog {
  sensors: readonly CameraSensor[];
  lenses: readonly Lens[];
  payloads: readonly LidarPayload[];
  aircraft: readonly Aircraft[];
  vehicles: readonly Vehicle[];
  fieldEquipment: readonly FieldEquipment[];
  hardware: readonly Hardware[];
  staff: readonly StaffRole[];
}

export const CATALOG: Catalog = {
  sensors: SENSORS,
  lenses: LENSES,
  payloads: PAYLOADS,
  aircraft: AIRCRAFT,
  vehicles: VEHICLES,
  fieldEquipment: FIELD_EQUIPMENT,
  hardware: HARDWARE,
  staff: STAFF,
};

function byId<T extends { id: string }>(items: readonly T[], id: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new RangeError(`Item de catálogo desconhecido: ${id}`);
  return found;
}

export const getSensor = (id: string): CameraSensor => byId(SENSORS, id);
export const getLens = (id: string): Lens => byId(LENSES, id);
export const getPayload = (id: string): LidarPayload => byId(PAYLOADS, id);
export const getAircraft = (id: string): Aircraft => byId(AIRCRAFT, id);
export const getVehicle = (id: string): Vehicle => byId(VEHICLES, id);
export const getFieldEquipment = (id: string): FieldEquipment => byId(FIELD_EQUIPMENT, id);
export const getHardware = (id: string): Hardware => byId(HARDWARE, id);
export const getStaffRole = (id: string): StaffRole => byId(STAFF, id);

/**
 * Item que precisa ser possuído antes da compra (progression §5): tier anterior das
 * aeronaves, VTOL para o Pod LiDAR e o hardware anterior da lista.
 */
export const PURCHASE_PREREQUISITES: Readonly<Record<string, string>> = {
  DRONE_T2: 'DRONE_T1',
  VTOL_T3: 'DRONE_T2',
  POD_LIDAR: 'VTOL_T3',
  ...Object.fromEntries(
    HARDWARE_ORDER.slice(1).map((id, i) => [id, HARDWARE_ORDER[i] as string] as const),
  ),
};

/** Câmeras vendidas avulsas (as demais vêm com a aeronave ou com o pod). */
export const PURCHASABLE_SENSORS = SENSORS.filter((s) => s.priceBRL > 0).map((s) => s.id);

const ITEM_NAMES: ReadonlyMap<string, string> = new Map(
  [SENSORS, LENSES, PAYLOADS, AIRCRAFT, VEHICLES, FIELD_EQUIPMENT, HARDWARE].flatMap((list) =>
    list.map((item): [string, string] => [item.id, item.name]),
  ),
);

/** Todos os ids de itens compráveis ou possuíveis (referências `OWNS`). */
export const ALL_ITEM_IDS: ReadonlySet<string> = new Set(ITEM_NAMES.keys());

/** Nome de exibição de um item do catálogo (o próprio id, se desconhecido). */
export function itemName(id: string): string {
  return ITEM_NAMES.get(id) ?? id;
}
