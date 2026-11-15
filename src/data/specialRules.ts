/**
 * Regras especiais dos contratos (contracts-real §1): nome, descrição para o jogador, ícone e os
 * sistemas em que cada uma atua. O comportamento está em `domain/specialRules`.
 */
import {
  Building2,
  Cable,
  CloudFog,
  Crosshair,
  Flame,
  Flashlight,
  Layers,
  Mountain,
  MountainSnow,
  Orbit,
  Paintbrush,
  RadioTower,
  Rows3,
  Snowflake,
  TreeDeciduous,
  Waves,
  Wind,
  Zap,
  Bolt,
  CircleDot,
} from 'lucide-react';
import type { SpecialRuleId } from '@/types';
import { registerIcons } from '@/ui/iconRegistry';

registerIcons({
  Building2,
  Cable,
  CircleDot,
  CloudFog,
  Crosshair,
  Flame,
  Flashlight,
  Layers,
  Mountain,
  MountainSnow,
  Orbit,
  Paintbrush,
  RadioTower,
  Rows3,
  Snowflake,
  TreeDeciduous,
  Waves,
  Wind,
  Zap,
  Bolt,
});

/** Sistemas em que uma regra atua (coluna "Onde atua" da spec). */
export type RuleSystem =
  | 'TERRAIN'
  | 'FLIGHT'
  | 'FIELD'
  | 'COVERAGE'
  | 'ACCURACY'
  | 'ENERGY'
  | 'PROCESSING'
  | 'EVALUATION'
  | 'ECONOMY';

export interface SpecialRuleDef {
  id: SpecialRuleId;
  name: string;
  /** Texto do briefing, em pt-BR. */
  description: string;
  /** Nome lucide (registrado acima). */
  icon: string;
  systems: readonly RuleSystem[];
}

export const SPECIAL_RULES: readonly SpecialRuleDef[] = [
  {
    id: 'URBAN_CANYON_RTK_LOSS',
    name: 'Cânions urbanos',
    description:
      'Entre prédios altos, o sinal de satélite quica: o RTK cai para FLOAT e as fotos perdem precisão.',
    icon: 'Building2',
    systems: ['TERRAIN', 'FLIGHT', 'ACCURACY'],
  },
  {
    id: 'HOMOGENEOUS_TEXTURE',
    name: 'Textura homogênea',
    description:
      'Superfícies repetitivas atrapalham a correspondência de pontos: a acurácia piora e o processamento acha menos tie points.',
    icon: 'Layers',
    systems: ['ACCURACY', 'PROCESSING'],
  },
  {
    id: 'DENSE_CANOPY',
    name: 'Dossel denso',
    description:
      'Mata fechada: os pontos de apoio só valem nas clareiras e, sem LiDAR, o terreno sob as copas fica sem dados.',
    icon: 'TreeDeciduous',
    systems: ['TERRAIN', 'FIELD', 'COVERAGE'],
  },
  {
    id: 'STEEP_RELIEF',
    name: 'Relevo acidentado',
    description:
      'Taludes íngremes: em altitude constante, a altura sobre o solo varia muito, o GSD muda e há risco de colisão. Prefira o seguimento de terreno.',
    icon: 'Mountain',
    systems: ['TERRAIN', 'FLIGHT'],
  },
  {
    id: 'LOW_WIRES',
    name: 'Fios baixos',
    description: 'Postes e fios a 8–14 m de altura ao longo das ruas. Voe fora da altura dos fios.',
    icon: 'Cable',
    systems: ['TERRAIN', 'FLIGHT'],
  },
  {
    id: 'SPECULAR_WATER',
    name: 'Água especular',
    description:
      'Sob sol alto, a água reflete: fotos com mais da metade sobre a água não contam. Prefira luz nublada.',
    icon: 'Waves',
    systems: ['FLIGHT', 'COVERAGE', 'ACCURACY'],
  },
  {
    id: 'STRONG_WIND',
    name: 'Vento forte',
    description: 'Vento médio de 8 m/s ou mais: acima da tolerância da aeronave, a deriva dobra.',
    icon: 'Wind',
    systems: ['FLIGHT'],
  },
  {
    id: 'EM_INTERFERENCE',
    name: 'Interferência eletromagnética',
    description:
      'Tremor lateral, desvio de rumo e falhas no HUD, e a acurácia piora. O Atlas é imune.',
    icon: 'RadioTower',
    systems: ['FLIGHT', 'ACCURACY'],
  },
  {
    id: 'BLIZZARD_DRAIN',
    name: 'Nevasca',
    description: 'O frio dobra o consumo de energia e a visibilidade cai para 400 m.',
    icon: 'Snowflake',
    systems: ['FLIGHT', 'ENERGY'],
  },
  {
    id: 'MAGIC_FOG',
    name: 'Névoa mágica',
    description:
      'Visibilidade de 250 m: as fotos RGB não contam para a cobertura. O LiDAR não é afetado.',
    icon: 'CloudFog',
    systems: ['FLIGHT', 'COVERAGE'],
  },
  {
    id: 'SEARCHLIGHTS',
    name: 'Holofotes',
    description:
      'Cones de luz varrem o solo. Mais de 1,5 s dentro de um deles (3 s para o Atlas) vira uma detecção; o voo continua.',
    icon: 'Flashlight',
    systems: ['FLIGHT'],
  },
  {
    id: 'MOVING_HAZARDS',
    name: 'Perigos móveis',
    description:
      'Objetos oscilam sobre a área (10–25 m, ciclos de 3 a 6 s). Cronometre a passagem.',
    icon: 'Orbit',
    systems: ['FLIGHT'],
  },
  {
    id: 'ENERGY_BEAMS',
    name: 'Feixes de energia',
    description:
      'Colunas ligam por 2 s e desligam por 3 s, e pulsam 0,5 s antes de ligar. Só ferem quando ligadas.',
    icon: 'Zap',
    systems: ['FLIGHT'],
  },
  {
    id: 'LAVA_THERMALS',
    name: 'Térmicas de lava',
    description:
      'A lava gera correntes ascendentes de 6 m/s num raio de 40 m, que empurram a aeronave para cima.',
    icon: 'Flame',
    systems: ['TERRAIN', 'FLIGHT'],
  },
  {
    id: 'VERTICAL_CLIFFS',
    name: 'Paredões verticais',
    description: 'Paredões de 60 a 100 m: as fachadas só se modelam com fotos oblíquas.',
    icon: 'MountainSnow',
    systems: ['TERRAIN'],
  },
  {
    id: 'FEATURE_TARGETS',
    name: 'Alvos especiais',
    description:
      'Há alvos escondidos na área: capture-os com 3 fotos válidas ou com 50 pulsos/m² de LiDAR.',
    icon: 'Crosshair',
    systems: ['TERRAIN', 'FLIGHT', 'EVALUATION'],
  },
  {
    id: 'COLLECTIBLE_RINGS',
    name: 'Anéis coletáveis',
    description:
      'Anéis de 3 m flutuam de 10 a 40 m de altura. Cada um coletado rende R$ 50 extras.',
    icon: 'CircleDot',
    systems: ['FLIGHT', 'ECONOMY'],
  },
  {
    id: 'ELECTRIC_CREATURES',
    name: 'Criaturas elétricas',
    description:
      'A cada 8 a 12 s, uma descarga empurra a aeronave de lado por 2 s. O Atlas é imune.',
    icon: 'Bolt',
    systems: ['FLIGHT'],
  },
  {
    id: 'NARROW_TRENCH',
    name: 'Trincheira estreita',
    description: 'Uma trincheira de 50 m de largura e 40 m de profundidade, com torres nas bordas.',
    icon: 'Rows3',
    systems: ['TERRAIN'],
  },
  {
    id: 'PAINT_MARKERS',
    name: 'Marcadores de tinta',
    description:
      'Os pontos de apoio ignoram o alcance dos veículos; só a água e os telhados continuam inválidos.',
    icon: 'Paintbrush',
    systems: ['FIELD'],
  },
];

export function getSpecialRule(id: SpecialRuleId): SpecialRuleDef {
  const rule = SPECIAL_RULES.find((r) => r.id === id);
  if (!rule) throw new RangeError(`Regra especial desconhecida: ${id}`);
  return rule;
}
