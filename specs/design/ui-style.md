# Design — Estilo Visual e Kit de UI

> Paleta dark "geodésica" (ardósia escura, ciano radar, âmbar e verde esmeralda), tipografia, componentes e padrões de HUD.
>
> **Requisitos cobertos:** REQ-UI-001 a REQ-UI-005, REQ-NFR-004, REQ-NFR-007, REQ-NFR-008.

---

## 1. Tokens (`src/index.css` → `@theme` do Tailwind v4 e `src/ui/tokens.ts`)

| Token | Valor Tailwind | Hex | Uso |
| :--- | :--- | :--- | :--- |
| `bg-base` | `slate-950` | #020617 | Fundo de tela |
| `bg-panel` | `slate-900/90` | #0f172a | Painéis, com `backdrop-blur-sm` |
| `bg-raised` | `slate-800` | #1e293b | Cards, inputs |
| `border` | `slate-700` | #334155 | Bordas |
| `text` | `slate-100` | #f1f5f9 | Texto primário |
| `text-muted` | `slate-400` | #94a3b8 | Secundário |
| `radar` | `cyan-400` | #22d3ee | Ativo, foco, HUD, LiDAR 1º retorno |
| `radar-dim` | `cyan-700` | #0e7490 | Grades, wireframe |
| `warn` | `amber-400` | #fbbf24 | Alertas, golden hour, avisos |
| `ok` | `emerald-400` | #34d399 | Sucesso, LiDAR solo, cobertura verde |
| `danger` | `rose-500` | #f43f5e | Erro, crítico, cobertura vermelha, RTH |
| `rift` | `violet-500` | #8b5cf6 | Fendas, Multiverso |
| `money` | `lime-300` | #bef264 | Valores em R$ positivos |

- Em `src/ui/tokens.ts`, os mesmos valores ficam exportados como constantes para os engines de Canvas: `COLORS.radar` etc.
- **Proibido** usar cores hex soltas nos componentes React. Use classes Tailwind ou `COLORS`.
- **Exceções:** as paletas procedurais dos biomas, em `src/world/terrain/biomes/*`, e as cores de cosméticos e clientes, em `src/data`.

### 1.1 Tipografia
- **UI:** `font-sans` do sistema (`ui-sans-serif, system-ui`).
- **HUD, números, coordenadas e tabelas técnicas:** `font-mono` (`ui-monospace, SFMono-Regular, Menlo, Consolas`) com `tabular-nums`.
- **Escala:**
  - título de tela `text-2xl font-semibold tracking-wide uppercase`;
  - título de painel `text-sm font-semibold uppercase tracking-widest text-cyan-400`;
  - corpo `text-sm`;
  - HUD `text-xs`/`text-sm`.

### 1.2 Linguagem visual
- **Cantos:** `rounded-lg` em painéis e `rounded-md` em controles.
- **Painel tático:**
  - borda `border border-slate-700`;
  - sombra interna "glow" no ativo: `shadow-[0_0_12px_rgba(34,211,238,0.25)]`;
  - cantoneiras decorativas nos 4 cantos (pseudo-elementos de 8 px em `cyan-400/60`).
- **Grade de fundo** nas telas técnicas: `bg-[linear-gradient(...)]` com linhas `slate-800` a cada 32 px.
- **Ícones:** `lucide-react`, `size={16|20|24}`, `strokeWidth={1.75}`.

---

## 2. Kit de componentes (`src/ui/`)

| Componente | Props principais | Notas |
| :--- | :--- | :--- |
| `Panel` | `title?`, `icon?`, `actions?`, `variant: 'default'\|'rift'\|'danger'`, `children` | Cantoneiras, cabeçalho em `text-cyan-400` |
| `Button` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'\|'rift'`, `size`, `icon?`, `glyph?: ButtonAction`, `disabled`, `loading` | `data-focusable`. `glyph` exibe `<InputGlyph>` à direita. Toca `UI_CLICK` |
| `Slider` | `label`, `value`, `min`, `max`, `step`, `unit`, `format?`, `onChange`, `marks?`, `warnRange?` | Valor em `font-mono`. Faixa de aviso em âmbar. Teclado e gamepad (input §5) |
| `Tabs` | `tabs: {id,label,icon?,disabled?,reason?}[]`, `value`, `onChange` | `UI_TAB_PREV/NEXT`. Aba desabilitada mostra tooltip com o `reason` |
| `Modal` | `open`, `title`, `onClose?`, `size: 'sm'\|'md'\|'lg'\|'xl'`, `dismissable` | Focus trap e contexto de input `UI`. Overlay `bg-slate-950/70` |
| `ConfirmDialog` | `title`, `message`, `confirmLabel`, `danger?`, `onConfirm`, `onCancel` | Substitui `window.confirm` |
| `Toast` / `ToastHost` | `type: 'info'\|'success'\|'warn'\|'error'\|'money'\|'rift'`, `title`, `body?`, `icon?` | Até 4 visíveis, 4 s, empilhados no canto superior direito |
| `Stat` | `label`, `value`, `unit?`, `status?: 'ok'\|'warn'\|'danger'\|'neutral'`, `hint?` | Leitura técnica (HUD e painéis) |
| `Gauge` | `value 0..1`, `label`, `thresholds`, `variant: 'bar'\|'arc'` | Bateria, cobertura, XP |
| `ProgressBar` | `value 0..1`, `label?`, `striped?`, `animated?` | Pipeline e XP |
| `ChecklistItem` | `status: 'pass'\|'warn'\|'fail'\|'pending'`, `label`, `severity?`, `detail?` | Ícones `CheckCircle2`, `AlertTriangle`, `XCircle`, `Circle` |
| `Tooltip` | `content`, `children` | Hover e foco |
| `InputGlyph` | `action`, `label?` | Ver input §4 |
| `EmblemBadge` | `emblem: Emblem \| PortraitSpec`, `size` | Forma em SVG inline (paths simples) + ícone lucide + iniciais |
| `MoneyText` | `cents`, `signed?` | `formatBRL`. Positivo em `lime-300`, negativo em `rose-500` |
| `DialogueBox` | `speaker: PortraitSpec & {name}`, `lines: string[]`, `onDone` | Máquina de escrever (40 car/s). `INTERACT` completa a linha ou avança |

> O `EmblemBadge` pode usar SVG **inline gerado em JSX** (`<svg><path/></svg>`). Isso não conta como asset externo.

---

## 3. Layout das telas

- **Container raiz:** `h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none`.
- **Barra superior** (REQ-UI-003): altura 48 px, `bg-slate-900/95 border-b border-slate-800`. Da esquerda para a direita:
  - emblema + "GeoSurvey";
  - saldo (`MoneyText`);
  - nível + barra de XP (120 px);
  - reputação (`Gauge` mini);
  - renda do museu (`R$ x/min`);
  - indicador de dimensão;
  - glyph de pausa.
- **Telas com Canvas:** o Canvas ocupa o restante (`flex-1 relative`). O HUD React fica sobreposto com `absolute inset-0 pointer-events-none`, e os elementos interativos levam `pointer-events-auto`.
- **Breakpoints:** a base é 1280 × 720. Acima de 1600 px de largura, painéis laterais passam de 320 px para 380 px. Não há layout mobile.

---

## 4. HUD tático (voo) — padrão visual

- **Leituras:** `font-mono text-xs`, rótulo `text-slate-400`, valor `text-cyan-300`. Alertas piscam (`animate-pulse`), exceto com `reduceFlashes`.
- **Cantos da tela:** colchetes em L de `cyan-400/50`.
- **Alertas centrais:**
  - faixa `bg-amber-500/15 border-amber-400 text-amber-300` para aviso;
  - `rose` para crítico.
  - No máximo 2 visíveis, priorizados por severidade.
- **Minimapa:** 160 × 160 px, canto inferior direito, fundo `slate-950/80`, linhas do plano em `slate-500`, linha atual em `cyan-400`, fotos como pontos `emerald-400`.

---

## 5. Acessibilidade e conforto

- **Contraste:** texto mínimo `slate-300` sobre `slate-900`, AA.
- **Foco:** todo elemento focável tem foco visível (input §5).
- **`reduceFlashes`:**
  - desativa o flash do obturador (o contador ainda pulsa por cor, sem overlay branco);
  - desativa o screen shake;
  - troca `animate-pulse` por cor estática;
  - desativa o tremor de interferência eletromagnética.
- **Tamanho mínimo de alvo clicável:** 32 × 32 px.

---

## 6. Galeria de componentes

`?debug=1&screen=UIKIT` renderiza todos os componentes em todos os estados e variantes, incluindo os glyphs nos três dispositivos (forçados por um seletor), para inspeção visual (REQ-UI-002).
