# Constituição do Projeto — Scan City

> Princípios **imutáveis** que regem toda a implementação. Qualquer tarefa, decisão ou código que contradiga este documento está errado. Este documento só muda por ADR explícita em [decisions.md](decisions.md).

---

## 1. Stack fixada

| Camada | Tecnologia | Observações |
| :--- | :--- | :--- |
| Build / dev server | **Vite** (última estável) | `npm create vite@latest` com template `react-ts` |
| UI | **React 18+** com componentes funcionais e hooks | Sem class components |
| Linguagem | **TypeScript** com `"strict": true`, `noUncheckedIndexedAccess`, `noImplicitOverride` | Proibido `any` explícito (use `unknown` + narrowing) |
| Estilo | **Tailwind CSS v4** via `@tailwindcss/vite` | Tokens em [design/ui-style.md](design/ui-style.md) |
| Ícones | **lucide-react** | Único pacote de ícones permitido |
| Estado global | **Zustand** (+ middleware `persist`) | Store acessível fora do React via `getState()` |
| Gráficos | **Canvas 2D nativo** + `requestAnimationFrame` | Proibido WebGL, Three.js, Pixi, bibliotecas de gráfico |
| Áudio | **Web Audio API** (`AudioContext`) | Proibido arquivos de áudio externos |
| Testes unitários | **Vitest** + **@testing-library/react** + `jsdom` | |
| Testes E2E | **Playwright** (Chromium) | |
| Qualidade | **ESLint** (typescript-eslint, react-hooks) + **Prettier** | |
| Gerenciador | **npm** | `package-lock.json` versionado |

Dependências de runtime permitidas: `react`, `react-dom`, `zustand`, `lucide-react`. Qualquer outra precisa de ADR.

---

## 2. Princípios de arquitetura

1. **Domínio puro.** Toda a matemática cartográfica, regras de negócio, avaliação de missão e economia ficam em `src/domain/`. Esse código é TypeScript puro e não importa nada de React, DOM, Canvas, Zustand ou Web Audio. A cobertura de testes dele é ≥ 90 % das linhas.
2. **Engines fora do React.** Os motores de Canvas (`src/engines/*`) são classes ou funções TS que:
   - recebem um `CanvasRenderingContext2D`, o estado de input e um estado de simulação **mutável** próprio;
   - **não** chamam `setState` a cada frame;
   - comunicam-se com a store apenas por **eventos discretos**, como foto disparada, colisão ou fim de linha;
   - alimentam o HUD React por um *snapshot* publicado a no máximo **10 Hz**.
3. **Determinismo.** Tudo que é aleatório usa o PRNG seedado de `src/lib/rng.ts`, nunca `Math.random()`. Isso vale para terreno, resíduos de GCP, eventos de campo e lances do rival. A mesma seed gera o mesmo resultado. A seed de um contrato é `hashString(contract.id) ^ contract.seed`.
4. **Unidades SI internamente.** Use metros, segundos, radianos, m/s e Hz. As conversões (cm/px, mm, µm, graus, km/h) só acontecem na camada de apresentação, via `src/lib/format.ts`. Nomes de variáveis com unidade levam sufixo (`heightM`, `pixelPitchM`, `intervalS`, `fovRad`).
5. **Dados separados do código.** Catálogos, contratos, diálogos, textos de UI e tabelas de balanceamento ficam em `src/data/`, tipados pelas interfaces de [design/data-model.md](design/data-model.md).
6. **Uma fonte de verdade por conceito.** As funções de `domain/` são as únicas implementações das fórmulas. O Laboratório de Infográficos, o planejamento de campo, o HUD de voo e o relatório **reusam** essas funções e nunca as duplicam.
7. **Máquina de estados explícita.** A navegação entre as 7 telas passa exclusivamente por `goTo()` de [design/architecture.md](design/architecture.md). Uma transição fora da tabela é um bug.
8. **Sem assets binários externos.** Todo visual é desenhado proceduralmente em Canvas ou montado com Tailwind e ícones lucide. Todo som é sintetizado. Não há imagens, fontes web nem arquivos de áudio.

---

## 3. Convenções de código

- **Nomes:** `PascalCase` para componentes e tipos, `camelCase` para funções e variáveis, `SCREAMING_SNAKE_CASE` para enums de string e constantes globais.
- **Arquivos:** componentes em `PascalCase.tsx`, módulos em `camelCase.ts`, testes ao lado do arquivo como `*.test.ts(x)`.
- **Imports:** alias `@/` aponta para `src/`.
- **Idioma:**
  - Identificadores no código em **inglês**.
  - Textos visíveis ao jogador em **pt-BR**, centralizados em `src/data/strings.ts` ou nos arquivos de conteúdo.
  - Comentários em pt-BR ou inglês, só quando explicam o *porquê*.
- **Formatação numérica:** pt-BR com vírgula decimal e moeda `R$ 12.345,00`, via `Intl.NumberFormat('pt-BR')`.
- **Funções puras** sempre que possível. Efeitos colaterais isolados em hooks, engines e na store.

---

## 4. Regras de ouro para o agente implementador

1. **Zero `TODO`, `FIXME`, `XXX`, funções vazias ou `throw new Error('not implemented')`** no código entregue. Uma tarefa só termina com o escopo dela 100 % funcional.
2. **Escopo estrito.** Implemente apenas o que a tarefa pede. Funcionalidade de tarefa futura não entra antes da hora. Pequenos ganchos (*interfaces*, *enums*) são permitidos quando a spec da tarefa atual os define.
3. **Telas ainda não implementadas** são servidas pelo `DebugScreenShell` (ver [tasks.md](tasks.md), T005). Ele mostra o nome da tela e os botões das transições válidas. O marco **M4** exige zero uso desse shell em produção. *(Encerrado na T079: o shell e a cena de demonstração saíram do repositório e o `ScreenRouter` virou um `Record<ScreenId, ComponentType>` total; ver ADR-026.)*
4. **A spec manda.** Se o código precisar divergir da spec, primeiro atualize a spec e registre uma ADR, depois mude o código.
5. **Ambiguidade:** não invente. Registre em [open-questions.md](open-questions.md) e escolha o comportamento mais conservador descrito na spec. Se nenhum existir, pare a tarefa.
6. **Testes primeiro no domínio.** Para tarefas de `domain/`, escreva os testes com os *golden values* de [design/domain-math.md](design/domain-math.md) antes da implementação.
7. **Verificação obrigatória** ao final de toda tarefa:
   ```bash
   npm run typecheck && npm run lint && npm run test && npm run build
   ```
   Some `npm run e2e` quando a tarefa indicar.

---

## 5. Definition of Done (DoD) — vale para toda tarefa

- [ ] Todos os critérios de aceite da tarefa estão marcados em [tasks.md](tasks.md).
- [ ] `typecheck`, `lint`, `test` e `build` passam sem erros nem *warnings* novos.
- [ ] Os testes novos cobrem o comportamento descrito, e o código de `domain/` tocado tem cobertura ≥ 90 %.
- [ ] Nenhum `TODO`, `console.log` de depuração ou código morto: `grep -rnE "TODO|FIXME|XXX" src` retorna vazio.
- [ ] Textos novos estão em pt-BR e centralizados em `src/data/`.
- [ ] Toda interação nova funciona com **teclado**, **mouse** e **gamepad** (quando aplicável à tela).
- [ ] O status da tarefa foi atualizado e, se houve decisão nova, existe ADR em [decisions.md](decisions.md).

---

## 6. Guarda de conteúdo — Fendas Dimensionais (paródias)

As side-quests das Fendas são **paródias e homenagens** à cultura pop. Para que o jogo continue sendo uma obra original:

- **Permitido:**
  - nomes paródicos definidos em [content/contracts-rifts.md](content/contracts-rifts.md), como "Sonisvaldo" ou "Seu Márcio Bross";
  - descrições **textuais** e humorísticas dos clientes;
  - motivos visuais **genéricos** desenhados proceduralmente, como anéis dourados, canos verdes, crateras, blocos cúbicos, névoa, caixas de papelão e trincheiras metálicas.
- **Proibido:**
  - reproduzir sprites, modelos, logos, marcas registradas, músicas, efeitos sonoros reconhecíveis, layouts de fases ou a aparência característica de personagens de qualquer jogo, anime ou filme existente;
  - usar os nomes originais das franquias em texto visível ao jogador.
- **Retratos dos clientes** são **emblemas abstratos**: forma geométrica, ícone lucide, duas cores e iniciais. Não são desenhos do personagem.
- Os nomes das franquias (Sonic, Mario etc.) aparecem **apenas** nesta pasta `specs/`, como referência de design. Nunca aparecem em `src/`. Um teste e o script `check:terms` (T059) fazem `grep` para garantir isso.

---

## 7. Qualidade de experiência

- **Resolução:** alvo 1280×720 a 1920×1080. Os Canvas respeitam `devicePixelRatio`.
- **Performance:** ≥ 55 FPS no voo 2.5D e na mesa holográfica no perfil de referência (ver REQ-NFR-001).
- **Acessibilidade:**
  - foco sempre visível;
  - contraste AA nos textos;
  - opção de **reduzir flashes e tremores de tela**;
  - toda a UI navegável sem mouse.
- **Robustez:** o jogo nunca quebra por save corrompido. Um save inválido é descartado com aviso, e o anterior vai para `scan-city-save-backup`.
