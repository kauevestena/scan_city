import {
  Bike,
  Box,
  CircleDashed,
  CircleDot,
  Cylinder,
  Gem,
  Grid3x3,
  HardHat,
  KeyRound,
  NotebookPen,
  Package,
  Paintbrush,
  Sparkle,
  Sprout,
  Sword,
  Triangle,
  Wheat,
  Wine,
} from 'lucide-react';
import type { Souvenir } from '@/types';
import { registerIcons } from '@/ui/iconRegistry';
import { NOTEBOOK_FACES } from './grandpaNotebook';

registerIcons({
  Bike,
  Box,
  CircleDashed,
  CircleDot,
  Cylinder,
  Gem,
  Grid3x3,
  HardHat,
  KeyRound,
  NotebookPen,
  Package,
  Paintbrush,
  Sparkle,
  Sprout,
  Sword,
  Triangle,
  Wheat,
  Wine,
});

/**
 * catalog §11 — 18 souvenirs, um por contrato, entregues na primeira aprovação. Cada um tem a
 * forma e as faces para examinar (catalog §11.1, ADR-036): a caderneta se folheia, os outros se
 * viram para mostrar o que se lê neles.
 */
export const SOUVENIRS: readonly Souvenir[] = [
  {
    id: 'SV_NOTEBOOK',
    contractId: 'C00',
    name: 'Caderneta de Campo do Avô',
    story:
      'Seu Zé Bento a guardou na gaveta da cozinha por anos. Cada página tem um ângulo anotado a lápis e uma mancha de café.',
    icon: 'NotebookPen',
    color: '#fde68a',
    form: 'BOOK',
    faces: NOTEBOOK_FACES,
  },
  {
    id: 'SV_CITY_KEY',
    contractId: 'C01',
    name: 'Chave da Cidade',
    story:
      'O Prefeito Aurélio garante que não abre porta nenhuma. "É simbólica, viu? Mas o cadastro, esse sim, ficou impecável."',
    icon: 'KeyRound',
    color: '#fbbf24',
    form: 'OBJECT',
    faces: [
      { label: 'A chave', surface: 'OBJECT', blocks: [] },
      {
        label: 'Placa do estojo',
        surface: 'PLAQUE',
        blocks: [
          { type: 'TITLE', text: 'CHAVE DA CIDADE', ink: 'ENGRAVED' },
          {
            type: 'TEXT',
            text: 'À GeoSurvey Soluções Cartográficas, pelo cadastro mais reto da história desta cidade',
            ink: 'ENGRAVED',
            align: 'CENTER',
          },
          {
            type: 'TEXT',
            text: 'Não abre portas, cofres nem gavetas',
            ink: 'ENGRAVED',
            size: 'SM',
            align: 'CENTER',
          },
        ],
      },
      {
        label: 'Certificado',
        surface: 'CARD',
        blocks: [
          { type: 'TITLE', text: 'Certificado de Autenticidade', ink: 'PRINT' },
          {
            type: 'TEXT',
            text: 'A Prefeitura Municipal certifica que esta chave é simbólica e não abre coisa nenhuma. Tentar usá-la na porta da Prefeitura será tratado como excesso de entusiasmo.',
            ink: 'PRINT',
            size: 'SM',
          },
          { type: 'TEXT', text: 'Obs.: o IPTU continua devido.', ink: 'INK' },
          { type: 'SIGNATURE', text: 'Aurélio, Prefeito' },
          { type: 'STAMP', text: 'CONFERE COM O ORIGINAL' },
        ],
      },
    ],
  },
  {
    id: 'SV_CORN_GOLD',
    contractId: 'C02',
    name: 'Espiga Dourada',
    story:
      'Seu Valdemar pintou a maior espiga da safra para agradecer o mapa de vigor. O Atlas olha para ela com saudade.',
    icon: 'Wheat',
    color: '#facc15',
    form: 'OBJECT',
    faces: [
      { label: 'A espiga', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta',
        surface: 'TAG',
        blocks: [
          { type: 'TITLE', text: 'Maior espiga da safra' },
          {
            type: 'FIELDS',
            rows: [
              ['Comprimento', '31 cm'],
              ['NDVI do pé', '0,91'],
              ['Pintura', 'tinta de trator'],
            ],
          },
          { type: 'TEXT', text: '__NÃO É PARA O POMBO.__', ink: 'RED', align: 'CENTER' },
          {
            type: 'TEXT',
            text: 'Falta um grão. Suspeito: Atlas. Álibi: nenhum.',
            ink: 'PENCIL',
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'Valdemar' },
        ],
      },
    ],
  },
  {
    id: 'SV_BRAZIL_NUT',
    contractId: 'C03',
    name: 'Semente de Castanheira',
    story:
      'A Dra. Jaci entregou a semente com um pedido: plantá-la onde o mapa mostrar terra firme. A floresta agradece em séculos.',
    icon: 'Sprout',
    color: '#65a30d',
    form: 'OBJECT',
    faces: [
      { label: 'A semente', surface: 'OBJECT', blocks: [] },
      {
        label: 'Envelope',
        surface: 'NOTE',
        blocks: [
          { type: 'TITLE', text: 'Como plantar' },
          {
            type: 'LIST',
            ordered: true,
            items: [
              'Escolha terra firme (o seu MDT sabe onde).',
              'Plante a 3\u00a0cm de fundura.',
              'Espere uns 12\u00a0anos pela primeira castanha.',
              'Espere uns 500\u00a0anos pela árvore inteira.',
              'Não desista no passo 4.',
            ],
          },
          {
            type: 'TEXT',
            text: 'Ela só dá fruto com a abelha certa por perto. Igual mapa: só fecha com o ponto certo.',
            ink: 'PENCIL',
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'Dra. Jaci' },
        ],
      },
    ],
  },
  {
    id: 'SV_ORE_NUGGET',
    contractId: 'C04',
    name: 'Pepita de Minério',
    story:
      'A Eng.ª Rosa pesou a pepita e riu: "Com o seu volume, sei até quanto ela representa da pilha. Uns 0,000001 %."',
    icon: 'Gem',
    color: '#f97316',
    form: 'OBJECT',
    faces: [
      { label: 'A pepita', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta de amostra',
        surface: 'LABEL',
        blocks: [
          { type: 'TITLE', text: 'AMOSTRA DE MINÉRIO', ink: 'PRINT' },
          {
            type: 'FIELDS',
            rows: [
              ['Nº', '0001'],
              ['Massa', '312 g'],
              ['Teor de Fe', '64\u00a0%'],
              ['Fração da pilha', '0,000001\u00a0%'],
            ],
          },
          {
            type: 'TEXT',
            text: "Volume da pilha: drone. Volume da pepita: copo d'água. Os dois fecharam.",
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'Eng.ª Rosa' },
        ],
      },
    ],
  },
  {
    id: 'SV_TILE',
    contractId: 'C05',
    name: 'Azulejo Português',
    story:
      'Um azulejo solto da fachada da matriz, catalogado e devolvido em réplica. A Arq.ª Helena fez questão que o original ficasse com você.',
    icon: 'Grid3x3',
    color: '#3b82f6',
    form: 'OBJECT',
    faces: [
      { label: 'O azulejo', surface: 'OBJECT', blocks: [] },
      {
        label: 'O verso',
        surface: 'OBJECT',
        blocks: [
          { type: 'STAMP', text: 'FÁBRICA DE LOUÇA · 1872' },
          { type: 'TEXT', text: 'Fachada norte, fiada 12, peça 47.' },
          {
            type: 'TEXT',
            text: 'A réplica já está no lugar. Se alguém perguntar, você não viu nada.',
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'H.' },
        ],
      },
    ],
  },
  {
    id: 'SV_BOTTLE_MAP',
    contractId: 'C06',
    name: 'Garrafa com Mapa',
    story:
      'A Comandante Iara achou a garrafa encalhada no estuário. Dentro, um croqui da costa de 1890 — bem diferente do seu.',
    icon: 'Wine',
    color: '#22d3ee',
    form: 'OBJECT',
    faces: [
      { label: 'A garrafa', surface: 'OBJECT', blocks: [] },
      {
        label: 'O croqui de 1890',
        surface: 'MAP',
        blocks: [
          {
            type: 'SKETCH',
            sketch: 'COAST_1890',
            height: 300,
            labels: ['farol', 'praia', 'aqui há monstros', '(ou capivaras)', 'N'],
          },
          {
            type: 'TEXT',
            text: 'Escala: 1\u00a0palmo = umas 3\u00a0léguas, mais ou menos.',
            size: 'SM',
          },
          {
            type: 'TEXT',
            text: 'Hoje o mar está uns 270\u00a0m mais para cá. Cmte. Iara',
            ink: 'RED',
            size: 'SM',
          },
        ],
      },
    ],
  },
  {
    id: 'SV_GOLD_RING',
    contractId: 'R01',
    name: 'Anel Dourado',
    story:
      'Sonisvaldo jogou o anel para você sem nem parar de correr. "Valeu, valeu, tchau!" Ainda está quente.',
    icon: 'CircleDot',
    color: '#facc15',
    form: 'OBJECT',
    faces: [
      { label: 'O anel', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta',
        surface: 'TAG',
        blocks: [
          { type: 'TITLE', text: 'Anel de coleção' },
          {
            type: 'FIELDS',
            rows: [
              ['Série', 'nº 1 de muitos'],
              ['Achado', 'correndo'],
              ['Entregue', 'correndo'],
            ],
          },
          {
            type: 'TEXT',
            text: 'Se cair no chão, ele sai quicando e piscando. Não tente pegar.',
            size: 'SM',
          },
          { type: 'TEXT', text: 'Ainda está morno.', ink: 'PENCIL', size: 'SM' },
          { type: 'SIGNATURE', text: 'S.' },
        ],
      },
    ],
  },
  {
    id: 'SV_GREEN_PIPE',
    contractId: 'R02',
    name: 'Cano Verde em Miniatura',
    story:
      'Seu Márcio montou o cano com sobras da oficina. Ele jura que, se você pular em cima, ele faz um barulhinho.',
    icon: 'Cylinder',
    color: '#22c55e',
    form: 'OBJECT',
    faces: [
      { label: 'O cano', surface: 'OBJECT', blocks: [] },
      {
        label: 'Placa',
        surface: 'PLAQUE',
        blocks: [
          { type: 'TITLE', text: 'BROSS ENCANAMENTOS', ink: 'ENGRAVED' },
          {
            type: 'TEXT',
            text: 'Cano verde em miniatura, escala 1:50',
            ink: 'ENGRAVED',
            align: 'CENTER',
          },
          {
            type: 'TEXT',
            text: 'Garantia: 1 vida. Vidas extras vendidas à parte',
            ink: 'ENGRAVED',
            size: 'SM',
            align: 'CENTER',
          },
        ],
      },
    ],
  },
  {
    id: 'SV_STAR_SPHERE',
    contractId: 'R03',
    name: 'Esfera Laranja de 4 Estrelas',
    story:
      'Guko trocou a esfera por um pastel na saída do platô. Ninguém sabe se ela concede desejos, mas brilha no escuro.',
    icon: 'Sparkle',
    color: '#fb923c',
    form: 'OBJECT',
    faces: [
      { label: 'A esfera', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta',
        surface: 'TAG',
        blocks: [
          { type: 'TITLE', text: 'Esfera laranja' },
          {
            type: 'FIELDS',
            rows: [
              ['Estrelas', '4'],
              ['Troca', '1 pastel de carne'],
              ['Desejos', 'não inclusos'],
            ],
          },
          {
            type: 'TEXT',
            text: 'Brilha no escuro. Gritar perto dela não adianta, e os vizinhos reclamam.',
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'Guko' },
        ],
      },
    ],
  },
  {
    id: 'SV_TRIANGLE',
    contractId: 'R04',
    name: 'Fragmento do Triângulo Geodésico',
    story:
      'Lino ergueu o fragmento acima da cabeça e soltou um "HYAAAH!" que espantou todas as fadas do bosque.',
    icon: 'Triangle',
    color: '#fde047',
    form: 'OBJECT',
    faces: [
      { label: 'O fragmento', surface: 'OBJECT', blocks: [] },
      {
        label: 'Bilhete',
        surface: 'NOTE',
        blocks: [
          { type: 'TITLE', text: 'Fragmento do Triângulo' },
          {
            type: 'SKETCH',
            sketch: 'TRIANGULATION',
            height: 150,
            labels: ['V1', 'V2', 'V3'],
          },
          {
            type: 'TEXT',
            text: 'Vértice de 1ª ordem da rede do bosque. Lado: 47,3\u00a0km. Erro de fechamento: 0,8".',
            size: 'SM',
          },
          { type: 'TEXT', text: 'HYAAAH!', ink: 'RED', size: 'LG', align: 'CENTER' },
          {
            type: 'TEXT',
            text: 'Os outros dois fragmentos ficam para o próximo levantamento.',
            ink: 'PENCIL',
            size: 'SM',
          },
          { type: 'SIGNATURE', text: 'Lino' },
        ],
      },
    ],
  },
  {
    id: 'SV_CUBE_ORE',
    contractId: 'R05',
    name: 'Bloco de Minério Cúbico',
    story:
      'Estêvão entregou o bloco sem piscar e saiu andando em ângulo reto. É perfeitamente cúbico. Perfeitamente.',
    icon: 'Box',
    color: '#38bdf8',
    form: 'OBJECT',
    faces: [
      { label: 'O bloco', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta de amostra',
        surface: 'LABEL',
        blocks: [
          { type: 'TITLE', text: 'AMOSTRA CÚBICA', ink: 'PRINT' },
          {
            type: 'FIELDS',
            rows: [
              ['Aresta', '10,000 cm'],
              ['Ângulos', '90,000°'],
              ['Planeza', 'perfeita'],
              ['Origem', 'ninguém sabe'],
            ],
          },
          { type: 'TEXT', text: 'O laser mediu três vezes e ficou sem graça.', size: 'SM' },
          { type: 'SIGNATURE', text: 'Estêvão' },
        ],
      },
    ],
  },
  {
    id: 'SV_THEODOLITE_SWORD',
    contractId: 'R06',
    name: 'Espada-Teodolito em Miniatura',
    story:
      'Geraldo deixou a miniatura sobre a mesa e resmungou um "Hm." Vindo dele, é quase um discurso.',
    icon: 'Sword',
    color: '#cbd5e1',
    form: 'OBJECT',
    faces: [
      { label: 'A espada', surface: 'OBJECT', blocks: [] },
      {
        label: 'Placa',
        surface: 'PLAQUE',
        blocks: [
          { type: 'TITLE', text: 'ESPADA-TEODOLITO', ink: 'ENGRAVED' },
          {
            type: 'TEXT',
            text: 'Para monstros e para medições',
            ink: 'ENGRAVED',
            align: 'CENTER',
          },
          {
            type: 'TEXT',
            text: 'Lâmina graduada em centímetros, nível de bolha no punho',
            ink: 'ENGRAVED',
            size: 'SM',
            align: 'CENTER',
          },
        ],
      },
      {
        label: 'Bilhete',
        surface: 'NOTE',
        blocks: [
          { type: 'GAP', size: 170 },
          { type: 'TEXT', text: 'Hm.', size: 'LG', align: 'CENTER' },
          { type: 'GAP', size: 30 },
          { type: 'SIGNATURE', text: 'G.' },
        ],
      },
    ],
  },
  {
    id: 'SV_CARDBOARD_BOX',
    contractId: 'R07',
    name: 'Caixa de Papelão',
    story:
      'A Cobrinha Sólida insistiu que é o equipamento mais avançado da base. Às vezes, a caixa parece mudar de lugar sozinha.',
    icon: 'Package',
    color: '#a16207',
    form: 'OBJECT',
    faces: [
      { label: 'A caixa', surface: 'OBJECT', blocks: [] },
      {
        label: 'Dentro da caixa',
        surface: 'OBJECT',
        blocks: [
          { type: 'TEXT', text: 'Não há ninguém aqui.', size: 'LG', align: 'CENTER' },
          {
            type: 'TEXT',
            text: 'Se você está lendo isto, eu já não estou nesta caixa.',
            align: 'CENTER',
          },
          {
            type: 'TEXT',
            text: 'Devolva a caixa: é o equipamento mais avançado da base.',
            ink: 'PENCIL',
            size: 'SM',
            align: 'CENTER',
          },
          { type: 'SIGNATURE', text: 'C. S.' },
        ],
      },
    ],
  },
  {
    id: 'SV_BMX',
    contractId: 'R08',
    name: 'BMX em Miniatura',
    story:
      'CJ entregou a bicicletinha e suspirou: "Ah droga, agora vou ter que mapear o bairro vizinho também."',
    icon: 'Bike',
    color: '#ef4444',
    form: 'OBJECT',
    faces: [
      { label: 'A bicicleta', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta',
        surface: 'TAG',
        blocks: [
          { type: 'TITLE', text: 'BMX aro 20 (em escala)' },
          {
            type: 'FIELDS',
            rows: [
              ['Escala', '1:12'],
              ['Freio', 'só o da frente'],
              ['Serve para', 'enfeitar a estante'],
            ],
          },
          { type: 'TEXT', text: 'Não serve para fugir de nada. Já tentei.', size: 'SM' },
          { type: 'SIGNATURE', text: 'CJ' },
        ],
      },
    ],
  },
  {
    id: 'SV_CAP',
    contractId: 'R09',
    name: 'Boné Virado para Trás',
    story:
      'Ailton tirou o boné da cabeça para você. "Pegou o mapa todo! Agora eu pego as espécies todas."',
    icon: 'HardHat',
    color: '#ef4444',
    form: 'OBJECT',
    faces: [
      { label: 'O boné', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta interna',
        surface: 'TAG',
        blocks: [
          {
            type: 'FIELDS',
            rows: [
              ['Tamanho', 'único'],
              ['Dono', 'Ailton'],
              ['Lavagem', 'à mão'],
            ],
          },
          { type: 'TEXT', text: '__NUNCA USAR PARA A FRENTE.__', ink: 'RED', align: 'CENTER' },
          {
            type: 'TEXT',
            text: 'Cabem seis bichinhos no forro. Não pergunte.',
            ink: 'PENCIL',
            size: 'SM',
          },
        ],
      },
    ],
  },
  {
    id: 'SV_EXHAUST_PORT',
    contractId: 'R10',
    name: 'Escotilha de Exaustão (miniatura)',
    story:
      'Lorde Válter mandou a réplica "como lembrete da sua eficiência". A respiração ao fundo da ligação foi… desconfortável.',
    icon: 'CircleDashed',
    color: '#94a3b8',
    form: 'OBJECT',
    faces: [
      { label: 'A escotilha', surface: 'OBJECT', blocks: [] },
      {
        label: 'Placa de projeto',
        surface: 'PLAQUE',
        blocks: [
          { type: 'TITLE', text: 'ESCOTILHA DE EXAUSTÃO TÉRMICA', ink: 'ENGRAVED' },
          {
            type: 'TEXT',
            text: 'Diâmetro real: 2\u00a0m · escala 1:20',
            ink: 'ENGRAVED',
            align: 'CENTER',
          },
          {
            type: 'TEXT',
            text: 'Nota do projeto: nenhum ponto fraco',
            ink: 'ENGRAVED',
            size: 'SM',
            align: 'CENTER',
          },
        ],
      },
      {
        label: 'Bilhete',
        surface: 'NOTE',
        blocks: [
          { type: 'TEXT', text: 'Como lembrete da sua eficiência.', size: 'LG' },
          {
            type: 'TEXT',
            text: 'O projeto dizia: nenhum ponto fraco. O seu levantamento achou um, com 1,8\u00a0cm de GSD. Não espalhe.',
          },
          { type: 'SIGNATURE', text: 'Lorde V.' },
        ],
      },
    ],
  },
  {
    id: 'SV_PAINT_PISTOL',
    contractId: 'R11',
    name: 'Pistola de Tinta Marcadora',
    story:
      'Dona Laura deixou uma das pistolas que usa para marcar pontos nos paredões. "Mire nos GCPs, querida, não em mim."',
    icon: 'Paintbrush',
    color: '#ec4899',
    form: 'OBJECT',
    faces: [
      { label: 'A pistola', surface: 'OBJECT', blocks: [] },
      {
        label: 'Etiqueta',
        surface: 'TAG',
        blocks: [
          { type: 'TITLE', text: 'Pistola marcadora' },
          {
            type: 'FIELDS',
            rows: [
              ['Cor', 'rosa-GCP'],
              ['Alcance', '15 m'],
              ['Mira', 'melhor que a sua'],
            ],
          },
          { type: 'TEXT', text: 'Mire nos GCPs, querida, não em mim.', size: 'SM' },
          { type: 'SIGNATURE', text: 'Laura' },
        ],
      },
    ],
  },
];
