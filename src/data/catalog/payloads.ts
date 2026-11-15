import type { LidarPayload } from '@/types';
import { brl } from './money';

/** catalog §2 — Pod LiDAR (Tier 4, ADR-013). Inclui a IMU tática. */
export const PAYLOADS: readonly LidarPayload[] = [
  {
    id: 'POD_LIDAR',
    name: 'Pod LiDAR "Vaga-lume"',
    prrHz: 240_000,
    fovDeg: 70,
    maxReturns: 5,
    rangeAccuracyM: 0.03,
    scanFrequencyHz: 2,
    rgbSensorId: 'CAM_POD_RGB',
    priceBRL: brl(150_000),
    compatibleAircraft: ['DRONE_T2', 'VTOL_T3'],
    tier: 4,
  },
];
