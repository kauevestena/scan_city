import type { Souvenir } from '@/types';

/** catalog §11 — 18 souvenirs, um por contrato, entregues na primeira aprovação. */
export const SOUVENIRS: readonly Souvenir[] = [
  {
    id: 'SV_NOTEBOOK',
    contractId: 'C00',
    name: 'Caderneta de Campo do Avô',
    story:
      'Seu Zé Bento a guardou na gaveta da cozinha por anos. Cada página tem um ângulo anotado a lápis e uma mancha de café.',
    icon: 'NotebookPen',
    color: '#fde68a',
  },
  {
    id: 'SV_CITY_KEY',
    contractId: 'C01',
    name: 'Chave da Cidade',
    story:
      'O Prefeito Aurélio garante que não abre porta nenhuma. "É simbólica, viu? Mas o cadastro, esse sim, ficou impecável."',
    icon: 'KeyRound',
    color: '#fbbf24',
  },
  {
    id: 'SV_CORN_GOLD',
    contractId: 'C02',
    name: 'Espiga Dourada',
    story:
      'Seu Valdemar pintou a maior espiga da safra para agradecer o mapa de vigor. O Atlas olha para ela com saudade.',
    icon: 'Wheat',
    color: '#facc15',
  },
  {
    id: 'SV_BRAZIL_NUT',
    contractId: 'C03',
    name: 'Semente de Castanheira',
    story:
      'A Dra. Jaci entregou a semente com um pedido: plantá-la onde o mapa mostrar terra firme. A floresta agradece em séculos.',
    icon: 'Sprout',
    color: '#65a30d',
  },
  {
    id: 'SV_ORE_NUGGET',
    contractId: 'C04',
    name: 'Pepita de Minério',
    story:
      'A Eng.ª Rosa pesou a pepita e riu: "Com o seu volume, sei até quanto ela representa da pilha. Uns 0,000001 %."',
    icon: 'Gem',
    color: '#f97316',
  },
  {
    id: 'SV_TILE',
    contractId: 'C05',
    name: 'Azulejo Português',
    story:
      'Um azulejo solto da fachada da matriz, catalogado e devolvido em réplica. A Arq.ª Helena fez questão que o original ficasse com você.',
    icon: 'Grid3x3',
    color: '#3b82f6',
  },
  {
    id: 'SV_BOTTLE_MAP',
    contractId: 'C06',
    name: 'Garrafa com Mapa',
    story:
      'A Comandante Iara achou a garrafa encalhada no estuário. Dentro, um croqui da costa de 1890 — bem diferente do seu.',
    icon: 'Wine',
    color: '#22d3ee',
  },
  {
    id: 'SV_GOLD_RING',
    contractId: 'R01',
    name: 'Anel Dourado',
    story:
      'Sonisvaldo jogou o anel para você sem nem parar de correr. "Valeu, valeu, tchau!" Ainda está quente.',
    icon: 'CircleDot',
    color: '#facc15',
  },
  {
    id: 'SV_GREEN_PIPE',
    contractId: 'R02',
    name: 'Cano Verde em Miniatura',
    story:
      'Seu Márcio montou o cano com sobras da oficina. Ele jura que, se você pular em cima, ele faz um barulhinho.',
    icon: 'Cylinder',
    color: '#22c55e',
  },
  {
    id: 'SV_STAR_SPHERE',
    contractId: 'R03',
    name: 'Esfera Laranja de 4 Estrelas',
    story:
      'Guko trocou a esfera por um pastel na saída do platô. Ninguém sabe se ela concede desejos, mas brilha no escuro.',
    icon: 'Sparkle',
    color: '#fb923c',
  },
  {
    id: 'SV_TRIANGLE',
    contractId: 'R04',
    name: 'Fragmento do Triângulo Geodésico',
    story:
      'Lino ergueu o fragmento acima da cabeça e soltou um "HYAAAH!" que espantou todas as fadas do bosque.',
    icon: 'Triangle',
    color: '#fde047',
  },
  {
    id: 'SV_CUBE_ORE',
    contractId: 'R05',
    name: 'Bloco de Minério Cúbico',
    story:
      'Estêvão entregou o bloco sem piscar e saiu andando em ângulo reto. É perfeitamente cúbico. Perfeitamente.',
    icon: 'Box',
    color: '#38bdf8',
  },
  {
    id: 'SV_THEODOLITE_SWORD',
    contractId: 'R06',
    name: 'Espada-Teodolito em Miniatura',
    story:
      'Geraldo deixou a miniatura sobre a mesa e resmungou um "Hm." Vindo dele, é quase um discurso.',
    icon: 'Sword',
    color: '#cbd5e1',
  },
  {
    id: 'SV_CARDBOARD_BOX',
    contractId: 'R07',
    name: 'Caixa de Papelão',
    story:
      'A Cobrinha Sólida insistiu que é o equipamento mais avançado da base. Às vezes, a caixa parece mudar de lugar sozinha.',
    icon: 'Package',
    color: '#a16207',
  },
  {
    id: 'SV_BMX',
    contractId: 'R08',
    name: 'BMX em Miniatura',
    story:
      'CJ entregou a bicicletinha e suspirou: "Ah droga, agora vou ter que mapear o bairro vizinho também."',
    icon: 'Bike',
    color: '#ef4444',
  },
  {
    id: 'SV_CAP',
    contractId: 'R09',
    name: 'Boné Virado para Trás',
    story:
      'Ailton tirou o boné da cabeça para você. "Pegou o mapa todo! Agora eu pego as espécies todas."',
    icon: 'HardHat',
    color: '#ef4444',
  },
  {
    id: 'SV_EXHAUST_PORT',
    contractId: 'R10',
    name: 'Escotilha de Exaustão (miniatura)',
    story:
      'Lorde Válter mandou a réplica "como lembrete da sua eficiência". A respiração ao fundo da ligação foi… desconfortável.',
    icon: 'CircleDashed',
    color: '#94a3b8',
  },
  {
    id: 'SV_PAINT_PISTOL',
    contractId: 'R11',
    name: 'Pistola de Tinta Marcadora',
    story:
      'Dona Laura deixou uma das pistolas que usa para marcar pontos nos paredões. "Mire nos GCPs, querida, não em mim."',
    icon: 'Paintbrush',
    color: '#ec4899',
  },
];
