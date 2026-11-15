import {
  Award,
  Box,
  DoorOpen,
  FlaskConical,
  Library,
  Mail,
  Monitor,
  Users,
  Warehouse,
} from 'lucide-react';
import type { PortraitSpec } from '@/types';
import { COLORS } from '@/ui/tokens';
import { registerIcons } from '@/ui/iconRegistry';

registerIcons({ Award, Box, DoorOpen, FlaskConical, Library, Mail, Monitor, Users, Warehouse });

/** Resolução lógica do canvas da sala (office §4). */
export const OFFICE_W = 1280;
export const OFFICE_H = 672;

export type OfficeHotspotId =
  'DOOR' | 'HOLO_TABLE' | 'LAB' | 'WORKSTATION' | 'GARAGE' | 'PERCH' | 'SHELF' | 'STAFF' | 'CAREER';

export interface OfficeHotspot {
  id: OfficeHotspotId;
  label: string;
  /** Nome do ícone lucide (office §5). */
  icon: string;
  /** Retângulo do móvel na resolução lógica (px). */
  rect: { x: number; y: number; w: number; h: number };
}

/** Os 9 móveis/hotspots da sala, na ordem de leitura (office §4). */
export const OFFICE_HOTSPOTS: readonly OfficeHotspot[] = [
  {
    id: 'SHELF',
    label: 'Estante de Relíquias',
    icon: 'Library',
    rect: { x: 56, y: 96, w: 210, h: 210 },
  },
  {
    id: 'CAREER',
    label: 'Quadro de Carreira',
    icon: 'Award',
    rect: { x: 300, y: 104, w: 170, h: 128 },
  },
  {
    id: 'HOLO_TABLE',
    label: 'Mesa Holográfica',
    icon: 'Box',
    rect: { x: 500, y: 190, w: 290, h: 190 },
  },
  {
    id: 'PERCH',
    label: 'Poleiro do Atlas',
    icon: 'Bird',
    rect: { x: 832, y: 112, w: 120, h: 170 },
  },
  {
    id: 'DOOR',
    label: 'Porta — sair para o mapa',
    icon: 'DoorOpen',
    rect: { x: 1044, y: 76, w: 170, h: 304 },
  },
  {
    id: 'WORKSTATION',
    label: 'Workstation',
    icon: 'Monitor',
    rect: { x: 56, y: 420, w: 240, h: 196 },
  },
  { id: 'STAFF', label: 'Mesa da Equipe', icon: 'Users', rect: { x: 320, y: 440, w: 230, h: 176 } },
  {
    id: 'LAB',
    label: 'Laboratório',
    icon: 'FlaskConical',
    rect: { x: 740, y: 420, w: 220, h: 196 },
  },
  { id: 'GARAGE', label: 'Garagem', icon: 'Warehouse', rect: { x: 984, y: 404, w: 270, h: 228 } },
];

/** Hotspots ativos no Escritório: os 9 (REQ-OFF-001). */
export const ACTIVE_HOTSPOTS: ReadonlySet<OfficeHotspotId> = new Set([
  'DOOR',
  'HOLO_TABLE',
  'LAB',
  'WORKSTATION',
  'GARAGE',
  'CAREER',
  'STAFF',
  'PERCH',
  'SHELF',
]);

/** Falante da introdução (REQ-OFF-007). */
export const GRANDPA_LETTER: PortraitSpec & { name: string } = {
  name: 'Carta do Avô',
  shape: 'SHIELD',
  icon: 'Mail',
  primary: COLORS.warn,
  secondary: COLORS.bgPanel,
  initials: '',
};

export const INTRO_LINES: readonly string[] = [
  'Se você está lendo isto, a oficina agora é sua. Os instrumentos estão velhos, mas medem certo.',
  'O Atlas vai te ajudar. Ele nunca se perde — e adora milho.',
  'O mundo está mudando depressa. Meça tudo antes que desapareça. Monte um museu da Terra.',
  'Comece pelo sítio. O Zé Bento te espera. — Vô',
];

/** Texto canônico da carta do avô no final da campanha (contracts-real §3). */
export const FINALE_LETTER =
  'Neto, se você está lendo isto, é porque terminou o que eu comecei com uma trena e um pombo. O mundo muda depressa — mas agora ele está guardado. Continue medindo. — Vô';

/** Final da campanha (REQ-CNT-008): 4 cartões com a carta e a inauguração do Grande Museu da Terra. */
export const FINALE_LINES: readonly string[] = [
  'Entre as folhas da caderneta velha, você encontra uma carta dobrada. A letra é do Vô.',
  FINALE_LETTER,
  'No pátio, as luzes se acendem: o Grande Museu da Terra abre as portas, com cada setor que você mapeou.',
  'O Atlas pousa no seu ombro com algo no bico: o velho chapéu do Vô. Agora ele é seu.',
];

/** Cosmético liberado (e entregue) pelo final. */
export const FINALE_REWARD = 'CHAR_GRANDPA_HAT';

/** Duração do destaque da Porta depois da intro. */
export const DOOR_HINT_MS = 6000;
