/**
 * Textos de interface visíveis ao jogador (pt-BR).
 * Os textos de conteúdo (contratos, catálogo, diálogos) ficam nos respectivos arquivos de `src/data/`.
 */
export const STRINGS = {
  app: {
    title: 'Scan City',
    tagline: 'Simulador RPG de fotogrametria e LiDAR',
    company: 'GeoSurvey Soluções Cartográficas',
    version: (v: string) => `Versão ${v}`,
  },
  player: {
    defaultName: 'Geodesta',
  },
  economy: {
    insufficientFunds: (missing: string) => `Saldo insuficiente (faltam ${missing})`,
  },
  save: {
    invalidTitle: 'Save inválido descartado',
    invalidBody: 'Uma cópia foi guardada como backup. Começando um novo jogo.',
    writeFailedTitle: 'Não foi possível salvar',
    writeFailedBody: 'O navegador recusou a gravação. O progresso desta sessão pode se perder.',
  },
  pause: {
    title: 'Jogo pausado',
    resume: 'Continuar',
  },
  input: {
    padConnected: (family: string) => `Controle conectado: ${family}`,
    padDisconnected: (family: string) => `Controle desconectado: ${family}`,
    nonStandardMapping: 'Controle com mapeamento não padrão — botões podem variar',
    families: { XBOX: 'Xbox', PLAYSTATION: 'PlayStation', GENERIC: 'Genérico' },
    devices: { AUTO: 'Automático', KEYBOARD: 'Teclado', XBOX: 'Xbox', PLAYSTATION: 'PlayStation' },
    keys: {
      space: 'Espaço',
      arrows: 'Setas',
      wheel: 'Roda',
      drag: 'Arrastar',
    },
  },
  soundBoard: {
    title: 'Mesa de som',
    effects: 'Efeitos',
    loops: 'Sons contínuos',
    mixer: 'Volumes',
    master: 'Volume geral',
    sfx: 'Efeitos sonoros',
    muted: 'Mudo',
    unmuted: 'Som ligado',
    motorVariant: 'Motor',
    variants: { MULTIROTOR: 'Multirrotor', FIXED_WING: 'Asa fixa', BIRD: 'Atlas' },
    loopRate: 'Taxa / velocidade',
    loopGain: 'Intensidade',
    locked: 'Clique ou aperte uma tecla para liberar o áudio.',
  },
  ui: {
    close: 'Fechar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    continue: 'Continuar',
    dismissToast: 'Dispensar aviso',
    notifications: 'Avisos',
    dialogueNext: 'Avançar diálogo',
  },
  checklist: {
    status: { pass: 'Atendido', warn: 'Atenção', fail: 'Não atendido', pending: 'Pendente' },
    severity: { CRITICAL: 'Crítico', MAJOR: 'Importante', MINOR: 'Menor' },
  },
} as const;
