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
