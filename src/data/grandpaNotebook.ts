import type { SouvenirFace } from '@/types';
import { FINALE_LETTER } from './office';

/**
 * A Caderneta de Campo do Avô (catalog §11.1, ADR-036): 14 páginas, da capa à contracapa. A
 * contracapa interna de trás tem duas versões excludentes: o bolso, antes do final, e a carta
 * do Vô, depois (o final diz que ela estava "entre as folhas da caderneta velha").
 *
 * Os ângulos da poligonal somam 360°00'00" (quadrilátero: (4 − 2) · 180°), as conversões são as
 * do sistema antigo (braça = 2,2 m; légua de sesmaria = 6,6 km; alqueire paulista = 24.200 m²;
 * mineiro, o dobro) e a conta do GSD é a de domain-math §1 (100 m × 4,4 µm ÷ 8,8 mm = 5 cm).
 */
export const NOTEBOOK_FACES: readonly SouvenirFace[] = [
  {
    label: 'Capa',
    surface: 'COVER',
    blocks: [
      { type: 'TITLE', text: 'CADERNETA DE CAMPO', ink: 'PRINT' },
      { type: 'TEXT', text: 'Nº 7', ink: 'PRINT', size: 'SM', align: 'CENTER' },
      { type: 'TEXT', text: 'do Vô. Não mexa.', ink: 'INK', align: 'CENTER' },
    ],
  },
  {
    label: 'Por dentro da capa',
    surface: 'PAGE',
    paper: 'PLAIN',
    decor: ['COFFEE_RING'],
    blocks: [
      { type: 'TITLE', text: 'Esta caderneta é do Vô' },
      {
        type: 'TEXT',
        text: 'Se você a encontrou, devolva no Sítio do Avô: estrada de terra, depois da mangueira. Cuidado com a Mimosa.',
      },
      {
        type: 'TEXT',
        text: 'Recompensa: um café passado na hora e um pedaço de bolo, se o Zé Bento não tiver comido antes.',
      },
      { type: 'GAP', size: 10 },
      {
        type: 'TEXT',
        text: 'Cadernetas nº 1 a 6: uma o rio levou, uma a chuva lavou, uma virou ninho do Atlas e três estão emprestadas para o Zé Bento, que jura que devolveu.',
        ink: 'PENCIL',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Regras do agrimensor',
    surface: 'PAGE',
    paper: 'RULED',
    blocks: [
      { type: 'TITLE', text: 'Regras do agrimensor' },
      {
        type: 'LIST',
        ordered: true,
        items: [
          'Meça duas vezes. Confira três. Reclame quatro.',
          'Mapa sem ponto de controle é desenho bonito.',
          'O norte não muda. O humor do Zé Bento depende do café.',
          'Erro grosseiro não se ajusta: se assume.',
          'Se a bolha não centraliza, a culpa é do tripé. Ou do chão. ~~Nunca minha.~~ Às vezes minha.',
          'Nunca solte o pombo com fome: ele volta, mas passa na padaria antes.',
          'Quem tem pressa voa rápido e fotografa borrado.',
        ],
      },
    ],
  },
  {
    label: 'Poligonal do sítio',
    surface: 'PAGE',
    paper: 'RULED',
    decor: ['THUMBPRINT'],
    blocks: [
      { type: 'TITLE', text: 'Poligonal do sítio, 14 de março' },
      {
        type: 'TABLE',
        columns: ['Est.', 'PV', 'Ângulo', 'Dist. (m)', 'Obs.'],
        widths: [0.12, 0.11, 0.3, 0.21, 0.26],
        rows: [
          ['E1', 'E2', '87°14\'20"', '142,37', '—'],
          ['E2', 'E3', '92°05\'10"', '98,12', 'vaca'],
          ['E3', 'E4', '88°31\'40"', '141,90', 'vaca (2)'],
          ['E4', 'E1', '92°08\'50"', '97,85', 'café'],
        ],
      },
      { type: 'TEXT', text: 'Soma: 360°00\'00". __Fechou na mosca.__' },
      {
        type: 'TEXT',
        text: 'O Zé Bento diz que foi sorte. Foi competência. E um pouco de sorte.',
        ink: 'PENCIL',
        size: 'SM',
      },
      {
        type: 'TEXT',
        text: 'A Mimosa cruzou o alinhamento E2–E3 duas vezes. Vou cobrar pedágio.',
        ink: 'RED',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Croqui do sítio',
    surface: 'PAGE',
    paper: 'GRID',
    blocks: [
      { type: 'TITLE', text: 'Croqui (sem escala, com carinho)' },
      {
        type: 'SKETCH',
        sketch: 'SITE_SURVEY',
        height: 292,
        labels: ['E1', 'E2', 'E3', 'E4', 'casa', 'mangueira', 'córrego', 'Mimosa', 'N'],
      },
      {
        type: 'TEXT',
        text: 'Não medir debaixo da mangueira em dezembro: cai manga no prisma.',
        ink: 'PENCIL',
        size: 'SM',
      },
      {
        type: 'TEXT',
        text: 'O córrego muda de lugar a cada enchente. O mapa, não. Quem está certo?',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Atlas',
    surface: 'PAGE',
    paper: 'PLAIN',
    decor: ['FEATHER'],
    blocks: [
      { type: 'TITLE', text: 'ATLAS, ficha técnica' },
      {
        type: 'SKETCH',
        sketch: 'ATLAS',
        height: 250,
        labels: [
          'olho de quem sabe onde é o norte',
          'papo: 3 punhados de milho',
          'câmera de peito (tolera)',
          'autonomia: 1 milho por minuto',
        ],
      },
      { type: 'TEXT', text: 'Peso: 380\u00a0g, antes do almoço.' },
      { type: 'TEXT', text: 'Velocidade: mais que o meu jipe. Menos que a fofoca na vila.' },
    ],
  },
  {
    label: 'Diário do Atlas',
    surface: 'PAGE',
    paper: 'RULED',
    decor: ['CORN_KERNEL'],
    blocks: [
      { type: 'TITLE', text: 'Diário de bordo (do pombo)' },
      {
        type: 'LIST',
        items: [
          'Dia 3: soltei o Atlas a 2\u00a0km do sítio. Chegou antes de mim e comeu o meu milho.',
          'Dia 9: testei contra a bússola. A bússola errou. O Atlas, não.',
          'Dia 15: tentou bicar o prisma da estação. Achou que era milho de vidro.',
          'Dia 22: amarrei a câmera no peito dele. Ficou ofendido dois dias. Depois posou.',
        ],
      },
      {
        type: 'TEXT',
        text: 'Conclusão: o Atlas é melhor que GPS. Não precisa de satélite, só de milho.',
        ink: 'RED',
      },
    ],
  },
  {
    label: 'A Velha Senhora',
    surface: 'PAGE',
    paper: 'GRID',
    blocks: [
      { type: 'TITLE', text: 'A Velha Senhora' },
      {
        type: 'SKETCH',
        sketch: 'TOTAL_STATION',
        height: 268,
        labels: ['luneta', 'nível de bolha', 'prisma (não é milho)', 'tripé (manca da perna 2)'],
      },
      {
        type: 'TEXT',
        text: 'Comprada em 1998. Mede um ângulo com 5\u00a0segundos de precisão. Para ligar, leva 5\u00a0minutos.',
        size: 'SM',
      },
      {
        type: 'TEXT',
        text: 'Fica para o neto. GCP se mede com ela: nada de confiar só no GPS do drone.',
        ink: 'RED',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Os moços do drone',
    surface: 'PAGE',
    paper: 'RULED',
    blocks: [
      { type: 'TITLE', text: 'Os moços do drone' },
      {
        type: 'TEXT',
        text: 'Hoje apareceram uns moços de terno com um drone e nenhum ponto de controle. Disseram: "o software corrige".',
      },
      { type: 'TEXT', text: 'O software não corrige o caráter.', ink: 'RED' },
      { type: 'TEXT', text: 'Mas fiquei curioso e fiz a conta:', size: 'SM' },
      { type: 'SKETCH', sketch: 'GSD', height: 120, labels: ['f', 'pixel', 'H', 'GSD'] },
      { type: 'TEXT', text: 'GSD = H × pixel ÷ f', align: 'CENTER' },
      {
        type: 'TEXT',
        text: 'H\u00a0=\u00a0100\u00a0m, pixel de 4,4\u00a0µm, f\u00a0=\u00a08,8\u00a0mm: GSD\u00a0=\u00a05\u00a0cm. Hm. Nada mal para um brinquedo.',
        size: 'SM',
      },
      {
        type: 'TEXT',
        text: 'E se o Atlas carregasse uma câmera dessas?',
        ink: 'PENCIL',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Compras e conversões',
    surface: 'PAGE',
    paper: 'RULED',
    decor: ['COFFEE_DROPS'],
    blocks: [
      { type: 'TITLE', text: 'Comprar na vila' },
      {
        type: 'LIST',
        items: [
          'milho (muito)',
          'café (mais)',
          'pilhas para a Velha Senhora',
          'tinta rosa para os alvos',
          '~~chapéu novo~~ achar o chapéu: o Atlas escondeu de novo',
        ],
      },
      { type: 'TITLE', text: 'Conversões úteis' },
      {
        type: 'TABLE',
        columns: ['Medida', 'Vale'],
        widths: [0.44, 0.56],
        rows: [
          ['1 braça', '2,2 m'],
          ['1 légua', '6,6 km'],
          ['1 alqueire paulista', '24.200 m²'],
          ['1 alqueire mineiro', 'o dobro, e o mineiro acha pouco'],
          ['1 cafezinho', '15\u00a0min de pausa'],
          ['1 "logo ali"', 'de 2 a 40\u00a0km'],
        ],
      },
    ],
  },
  {
    label: 'Um sonho',
    surface: 'PAGE',
    paper: 'GRID',
    blocks: [
      { type: 'TITLE', text: 'Um sonho (não contar pro Zé Bento)' },
      {
        type: 'TEXT',
        text: 'Um museu da Terra inteira. Cada sítio, cada rio, cada morro, medido e guardado para quem vier depois.',
      },
      {
        type: 'SKETCH',
        sketch: 'MUSEUM',
        height: 196,
        labels: ['a mesa', 'a maquete cresce a cada mapa', 'eu, de chapéu, admirando'],
      },
      {
        type: 'TEXT',
        text: 'Custo estimado: muito. Dinheiro disponível: R$\u00a012,50 e um pombo.',
        ink: 'PENCIL',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Amanhã',
    surface: 'PAGE',
    paper: 'RULED',
    blocks: [
      { type: 'TITLE', text: 'Amanhã' },
      {
        type: 'LIST',
        items: [
          'Ensinar o neto a nivelar o tripé. Paciência: ele puxou a mim.',
          'Mostrar onde ficam os marcos. Explicar que o marco não se mexe: quem se mexe é a gente.',
          'Apresentar o Atlas direito. Os dois são teimosos, vão se dar bem.',
        ],
      },
      {
        type: 'SKETCH',
        sketch: 'IPE_FLOWER',
        height: 150,
        labels: ['ipê do portão, florada de agosto'],
      },
    ],
  },
  {
    label: 'O bolso',
    surface: 'PAGE',
    paper: 'PLAIN',
    decor: ['TAPE'],
    when: 'BEFORE_FINALE',
    blocks: [
      { type: 'TITLE', text: 'Bolso dos papéis importantes' },
      {
        type: 'LIST',
        items: [
          'recibo da Velha Senhora (1998)',
          'receita do bolo de fubá da Dona Cida',
          'um mapa do tesouro: é do Zé Bento, de quando era menino',
        ],
      },
      { type: 'GAP', size: 12 },
      {
        type: 'TEXT',
        text: 'No fundo do bolso, um envelope colado com fita: "Abrir só quando o museu estiver de pé."',
        ink: 'PENCIL',
        size: 'SM',
      },
    ],
  },
  {
    label: 'A carta do Vô',
    surface: 'PAGE',
    paper: 'PLAIN',
    decor: ['FOLD', 'TAPE'],
    when: 'AFTER_FINALE',
    blocks: [
      { type: 'GAP', size: 18 },
      { type: 'TEXT', text: FINALE_LETTER, size: 'LG' },
      { type: 'GAP', size: 14 },
      {
        type: 'TEXT',
        text: 'P.S.: o chapéu está com o Atlas. Sempre esteve.',
        ink: 'PENCIL',
        size: 'SM',
      },
    ],
  },
  {
    label: 'Contracapa',
    surface: 'BACK_COVER',
    blocks: [
      { type: 'TEXT', text: 'Acabou o papel, não o trabalho.', align: 'CENTER' },
      { type: 'TEXT', text: 'Vá medir alguma coisa.', size: 'SM', align: 'CENTER' },
    ],
  },
];
