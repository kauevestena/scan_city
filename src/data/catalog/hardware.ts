import type { Hardware, HardwareId } from '@/types';
import { brl } from './money';

/** catalog §6 — Hardware de processamento. Substitui o anterior; exige o anterior da lista. */
export const HARDWARE: readonly Hardware[] = [
  {
    id: 'OLD_LAPTOP',
    name: 'Notebook Velho Lento',
    speedFactor: 1,
    priceBRL: 0,
    description: 'O notebook herdado do escritório. Processa, mas dá tempo de passar um café.',
  },
  {
    id: 'GAMER_PC',
    name: 'PC Gamer',
    speedFactor: 2.5,
    priceBRL: brl(9_000),
    description: 'Placa de vídeo dedicada: a densificação da nuvem anda 2,5× mais rápido.',
  },
  {
    id: 'MULTI_GPU_WS',
    name: 'Workstation Multi-GPU',
    speedFactor: 6,
    priceBRL: brl(35_000),
    description: 'Várias GPUs trabalhando juntas no bundle e na nuvem densa.',
  },
  {
    id: 'CLOUD',
    name: 'Servidores em Nuvem',
    speedFactor: 15,
    priceBRL: brl(80_000),
    description:
      'Um data center inteiro a serviço da GeoSurvey. O processamento vira um piscar de olhos.',
  },
];

/** Ordem de compra: cada item exige possuir o anterior. */
export const HARDWARE_ORDER: readonly HardwareId[] = HARDWARE.map((h) => h.id);
