import type { Vehicle } from '@/types';
import { brl } from './money';

/** catalog §5 — Veículos. Velocidade em tiles/s; tile ausente = intransponível. */
export const VEHICLES: readonly Vehicle[] = [
  {
    id: 'FOOT_BIKE',
    name: 'A Pé / Bicicleta',
    priceBRL: 0,
    speedTilesS: {
      ROAD_PAVED: 6,
      ROAD_DIRT: 5,
      TRAIL: 4,
      GRASS: 3,
      FOREST: 2,
      SAND: 2.5,
      HILL: 2,
      SNOW: 1.5,
      URBAN: 5,
      BRIDGE: 6,
    },
    gcpReachM: 150,
    gcpNetwork: 'ROADS_TRAILS',
    maxSlopePct: 30,
    allowSwamp: false,
    processesInField: false,
  },
  {
    id: 'COMPACT_CAR',
    name: 'Carro Compacto',
    priceBRL: brl(18_000),
    speedTilesS: { ROAD_PAVED: 12, ROAD_DIRT: 7, URBAN: 9, BRIDGE: 12 },
    gcpReachM: 150,
    gcpNetwork: 'ROADS',
    maxSlopePct: 30,
    allowSwamp: false,
    processesInField: false,
  },
  {
    id: 'PICKUP_4X4',
    name: 'Picape 4x4 Off-Road',
    priceBRL: brl(55_000),
    speedTilesS: {
      ROAD_PAVED: 10,
      ROAD_DIRT: 9,
      TRAIL: 7,
      GRASS: 6,
      FOREST: 3,
      SAND: 5,
      HILL: 5,
      HILL_STEEP: 3,
      SWAMP: 3,
      SNOW: 4,
      URBAN: 7,
      BRIDGE: 10,
    },
    gcpReachM: 400,
    gcpNetwork: 'OFFROAD',
    maxSlopePct: 60,
    allowSwamp: true,
    processesInField: false,
  },
  {
    id: 'LAB_VAN',
    name: 'Van Laboratório Móvel',
    priceBRL: brl(90_000),
    speedTilesS: { ROAD_PAVED: 10, ROAD_DIRT: 6, URBAN: 8, BRIDGE: 10 },
    gcpReachM: 150,
    gcpNetwork: 'ROADS',
    maxSlopePct: 30,
    allowSwamp: false,
    processesInField: true,
    fieldSpeedFactor: 2.5,
  },
];

/** Veículos com rodas (eventos de campo `FLAT_TIRE` e `CATTLE`, catalog §12). */
export const WHEELED_VEHICLES = ['COMPACT_CAR', 'PICKUP_4X4', 'LAB_VAN'] as const;
