import type { Cosmetic, UnlockCondition } from '@/types';
import { COLORS } from '@/ui/tokens';
import { brl } from './catalog/money';

const REAL_CONTRACTS = ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'] as const;

/** Final da campanha (REQ-CNT-008): os 7 contratos reais aprovados. */
export const CAMPAIGN_FINALE: UnlockCondition = {
  type: 'ALL',
  of: REAL_CONTRACTS.map((contractId) => ({ type: 'CONTRACT_DONE', contractId })),
};

/** catalog §10 — Cosméticos. As cores hex são exceção permitida (dados de cosmético). */
export const COSMETICS: readonly Cosmetic[] = [
  {
    id: 'CHAR_VEST',
    slot: 'CHARACTER',
    name: 'Colete Laranja Clássico',
    priceBRL: 0,
    colors: { primary: '#f97316', secondary: '#1e293b' },
  },
  {
    id: 'CHAR_LABCOAT',
    slot: 'CHARACTER',
    name: 'Jaleco de Campo',
    priceBRL: brl(800),
    colors: { primary: '#e2e8f0', secondary: '#0e7490' },
  },
  {
    id: 'CHAR_UNIFORM',
    slot: 'CHARACTER',
    name: 'Uniforme GeoSurvey',
    priceBRL: brl(1_500),
    unlock: { type: 'LEVEL', min: 3 },
    colors: { primary: '#0891b2', secondary: '#f8fafc' },
  },
  {
    id: 'CHAR_RAINCOAT',
    slot: 'CHARACTER',
    name: 'Capa de Chuva Amarela',
    priceBRL: brl(1_000),
    colors: { primary: '#facc15', secondary: '#1e293b' },
  },
  {
    id: 'CHAR_GRANDPA_HAT',
    slot: 'CHARACTER',
    name: 'Chapéu do Avô',
    priceBRL: 0,
    unlock: CAMPAIGN_FINALE,
    colors: { primary: '#92400e', secondary: '#fde68a' },
  },
  {
    id: 'CHAR_MULTIVERSE',
    slot: 'CHARACTER',
    name: 'Traje Multiverso',
    priceBRL: 0,
    unlock: { type: 'RIFTS_DONE', count: 6 },
    colors: { primary: '#8b5cf6', secondary: '#22d3ee' },
  },
  {
    id: 'PAINT_GREY',
    slot: 'DRONE_PAINT',
    name: 'Cinza Padrão',
    priceBRL: 0,
    colors: { primary: '#64748b', secondary: '#0f172a' },
  },
  {
    id: 'PAINT_RADAR',
    slot: 'DRONE_PAINT',
    name: 'Ciano Radar',
    priceBRL: brl(600),
    colors: { primary: '#22d3ee', secondary: '#0f172a' },
  },
  {
    id: 'PAINT_AMBER',
    slot: 'DRONE_PAINT',
    name: 'Âmbar Alerta',
    priceBRL: brl(600),
    colors: { primary: '#fbbf24', secondary: '#1e293b' },
  },
  {
    id: 'PAINT_EMERALD',
    slot: 'DRONE_PAINT',
    name: 'Verde Esmeralda',
    priceBRL: brl(600),
    colors: { primary: '#34d399', secondary: '#022c22' },
  },
  {
    id: 'PAINT_CAMO',
    slot: 'DRONE_PAINT',
    name: 'Camuflagem',
    priceBRL: brl(1_200),
    unlock: { type: 'CONTRACT_DONE', contractId: 'C03' },
    colors: { primary: '#4d7c0f', secondary: '#365314' },
  },
  {
    id: 'PAINT_HOLO',
    slot: 'DRONE_PAINT',
    name: 'Holográfico',
    priceBRL: 0,
    unlock: { type: 'RIFTS_DONE', count: 11 },
    colors: { primary: '#a78bfa', secondary: '#22d3ee' },
  },
  {
    id: 'ATLAS_NONE',
    slot: 'ATLAS_ACCESSORY',
    name: 'Sem acessório',
    priceBRL: 0,
    // Sem acessório: as cores não são desenhadas.
    colors: { primary: '#64748b', secondary: '#0f172a' },
  },
  {
    id: 'ATLAS_GOGGLES',
    slot: 'ATLAS_ACCESSORY',
    name: 'Óculos de Aviador',
    priceBRL: brl(300),
    colors: { primary: '#78350f', secondary: '#fde68a' },
  },
  {
    id: 'ATLAS_SCARF',
    slot: 'ATLAS_ACCESSORY',
    name: 'Cachecol Vermelho',
    priceBRL: brl(300),
    colors: { primary: '#dc2626', secondary: '#fecaca' },
  },
  {
    id: 'ATLAS_GPS_PACK',
    slot: 'ATLAS_ACCESSORY',
    name: 'Mochilinha GPS',
    priceBRL: brl(700),
    unlock: { type: 'OWNS', itemId: 'GNSS_RTK_KIT' },
    colors: { primary: '#0f172a', secondary: '#22d3ee' },
  },
  {
    id: 'ATLAS_LAUREL',
    slot: 'ATLAS_ACCESSORY',
    name: 'Coroa de Louros',
    priceBRL: 0,
    unlock: { type: 'CONTRACT_DONE', contractId: 'C03' },
    colors: { primary: '#65a30d', secondary: '#fef08a' },
  },
];

/** Equipados num jogo novo (progression §3). */
/** Cores da skin equipada (a do colete se o id for desconhecido). */
export function characterColors(id: string): Cosmetic['colors'] {
  const skin = COSMETICS.find((c) => c.id === id && c.slot === 'CHARACTER');
  return (skin ?? (COSMETICS[0] as Cosmetic)).colors;
}

export const STARTING_COSMETICS = ['CHAR_VEST', 'PAINT_GREY', 'ATLAS_NONE'] as const;

/** Paleta do editor de emblema (catalog §10): tokens de ui-style §1 + 4 cores extras. */
export const EMBLEM_PALETTE: readonly string[] = [
  ...Object.values(COLORS),
  '#f97316',
  '#facc15',
  '#e2e8f0',
  '#8b5cf6',
].filter((color, i, all) => all.indexOf(color) === i);
