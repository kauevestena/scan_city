# Roteiro de QA manual

> O que só uma pessoa consegue verificar: o toque humano no **Firefox e no Edge**, o **controle de verdade**, o **FPS com GPU**, o **som** e a **campanha jogada**. O resto já passou: 2183 testes de unidade, os 137 testes E2E no Chromium **e no Firefox 155** (`npm run e2e` e `npm run e2e:firefox`, inclusive acessibilidade, teclado e controle emulado), o jogo publicado e um teste de entradas aleatórias (`npm run qa:random`); ver da T079 à T083 e a T092 em [tasks.md](tasks.md). Cada seção termina com uma tabela para anotar o resultado. Quem fecha uma pendência atualiza a pergunta aberta ([OQ-013](open-questions.md), [OQ-014](open-questions.md)) e a matriz de rastreabilidade (§9).

---

## 0. Preparação

**Sem instalar nada:** a versão publicada, `https://kauevestena.github.io/scan_city/`, é o mesmo build de produção e aceita os mesmos parâmetros de URL (`https://kauevestena.github.io/scan_city/?debug=1&skipIntro=1`); onde o roteiro diz `http://localhost:4173`, use esse endereço. Serve para Firefox, Edge, controle e som em qualquer máquina.

1. **Build de produção**, não o `npm run dev` (o servidor de desenvolvimento compila na hora e muda os tempos):

   ```bash
   npm install
   npm run build && npm run preview     # http://localhost:4173
   ```

2. **Zerar o jogo** quando o roteiro pedir: `Esc → Novo jogo` (guarda um backup) ou, no console do navegador (F12), `localStorage.clear()` e recarregar.
3. **Parâmetros de URL** (só valem com `debug=1`; descritos em [architecture §7](design/architecture.md)):

   | Parâmetro | Para que serve aqui |
   | :--- | :--- |
   | `debug=1` | contador de FPS e painel **F9** (estado, transições, ações rápidas, tempo por etapa) |
   | `skipIntro=1` | pula a carta do avô |
   | `unlockAll=1` | todos os contratos disponíveis e todos os itens (desliga as dicas do tutorial) |
   | `money=<n>` | saldo inicial em reais |
   | `screen=<TELA>` | abre a tela direto: `OFFICE`, `WORLD_MAP`, `FIELD_SETUP`, `SURVEY_FLIGHT`, `PROCESSING_RESULTS`, `HOLO_TABLE_VIEW`, `INFOGRAPHIC_LAB`, `UIKIT`, `SOUNDBOARD` |
   | `contract=<id>` | contrato das telas de campo, voo e processamento (`C00` a `C06`, `R01` a `R11`) |
   | `autopilot=1` | o voo segue o plano sozinho (liga o tempo ×8) |
   | `calm=1` | voo sem rajadas e sem erro de entrada de faixa (não use na §6) |
   | `seed=<n>` | seed global (eventos e rival) |

4. **Se algo falhar**, anote: a URL, os passos, o que esperava, o que viu, os erros do console (F12) e, se puder, o save (`localStorage.getItem('scan-city-save')`, depois de `Esc → Salvar agora`).

---

## 1. Firefox (REQ-NFR-009, [OQ-014](open-questions.md))

O REQ-NFR-009 já está ✅: a suíte E2E inteira passa no Firefox 155 e o jogo publicado passa o vertical slice do C00 nele ([OQ-014](open-questions.md), T083). Esta seção é a **confirmação humana**: o que a suíte não enxerga (como o jogo *parece* e *soa* no Firefox, o controle de verdade). O Tailwind v4 exige Firefox **128 ou mais novo**; anote a versão testada.

**Roteiro do C00** (o mesmo do `slice.spec.ts`; leva uns 5 minutos). Abra o console (F12) antes e **não deve aparecer erro em vermelho** em nenhum passo.

| # | Passo | Esperado | ☐ |
| :-: | :--- | :--- | :-: |
| 1 | Abra `/?debug=1&skipIntro=1&autopilot=1&seed=4` | o escritório aparece, com a barra superior (saldo, nível, XP) | ☐ |
| 2 | Com `Tab` chegue a "Porta — sair para o mapa" e aperte `Enter` | o mapa-múndi abre; uma dica do tutorial aparece (`H` a dispensa) | ☐ |
| 3 | `F9`, em "Teleportar para marcador" clique em `C00`, `F9` de novo; aperte `Enter` junto ao marcador | o aviso "Sítio do Avô" e depois o briefing; **Aceitar** abre o campo | ☐ |
| 4 | Aba 1: **Sugestão automática**; aba 2: mexa no controle "Altura (H)" com as setas; aba 4: **DECOLAR** | os pontos de apoio aparecem no mapa de satélite, o plano muda e o voo começa | ☐ |
| 5 | Espere o autopilot (×8) | o terreno rola, o HUD atualiza, o som do motor toca e aparece o diálogo "Voo concluído" | ☐ |
| 6 | O autopilot escolhe **Levar dados ao escritório** sozinho, 1,5 s depois; ande para a direita até "Entrar na sede" e aperte `Espaço` | volta ao mapa e depois ao escritório (uma missão aguarda processamento) | ☐ |
| 7 | **Workstation → Processar** | o pipeline anda e o relatório abre com **APROVADO** | ☐ |
| 8 | **Enviar à Mesa do Museu** | a mesa holográfica mostra o setor "Sítio do Avô" | ☐ |

**O que olhar no Firefox em particular:**

- [ ] Nada fica sem estilo (cores, bordas, sombras, o brilho dos botões) e a fonte é a do sistema, sem salto de layout.
- [ ] Os canvases (terreno do voo, mapa, mesa 3D, nuvem do relatório) ficam nítidos e sem faixas ou emendas; o minimapa do mapa-múndi é de pixels grossos, não borrado.
- [ ] Sem rolagem horizontal ou vertical em 1280 × 720 e em 1920 × 1080.
- [ ] O som toca depois do primeiro clique (`/?debug=1&screen=SOUNDBOARD`: um botão por efeito).
- [ ] `Tab`, `Shift+Tab`, setas, `Enter`, `Esc` e `Backspace` fazem o que a tela diz, e o foco aparece com um anel.
- [ ] Arrastar com o mouse orbita a mesa 3D e a nuvem do relatório; a roda dá zoom; o clique no mapa de satélite coloca um ponto.
- [ ] **Privacidade rígida** (opcional): com "Bloquear todos os cookies" (ou o armazenamento do site desligado) o jogo ainda abre no escritório e joga; na primeira troca de tela aparece "Não foi possível salvar". Sem salvar, é o esperado ([ADR-027](decisions.md)).
- [ ] Sem lentidão que atrapalhe: o voo do C01 é fluido (o requisito é só "funcionar", sem meta de FPS; anote o número da §4 se medir).

| Navegador e versão | SO | Resultado | Notas |
| :--- | :--- | :-: | :--- |
| Firefox ___ | ___ | ☐ | |

---

## 2. Chrome e Edge (REQ-NFR-009)

Repita o roteiro da §1 em cada um, nas versões atuais, e some o controle de verdade (§3), que o requisito pede em Chrome e Edge. O Edge é Chromium; o esperado é igual ao do Chrome.

| Navegador e versão | SO | Roteiro do C00 | Controle (§3) | Notas |
| :--- | :--- | :-: | :-: | :--- |
| Chrome ___ | ___ | ☐ | ☐ | |
| Edge ___ | ___ | ☐ | ☐ | |

---

## 3. Controle de verdade (REQ-INP-002 e REQ-INP-006)

Os E2E só emulam o controle (`navigator.getGamepads`); falta um aparelho real. Teste um **Xbox** (ou compatível) e um **PS5/DualSense**, por USB e por Bluetooth se puder. O navegador só enxerga o controle **depois de um aperto de botão**.

Abra `/?debug=1&skipIntro=1&unlockAll=1`, aperte um botão e confira:

- [ ] `Menu` abre a pausa; em **Controles** a linha "Dispositivo ativo" mostra **Xbox** ou **PlayStation** e os botões da tabela mudam (A/B/X/Y ou ✕/○/□/△; `Menu` ou `Options`).
- [ ] **Escritório:** o D-pad (ou o analógico esquerdo) anda entre os nove pontos; `A` abre o painel; `B` fecha e devolve o foco.
- [ ] **Mapa:** o analógico anda sem **deriva** (solto, o avatar para); `LB` troca o veículo; `Y` troca Real e Fendas; `A` interage; `View`/`Create` dispensa a dica.
- [ ] **Campo:** `LB`/`RB` trocam de aba; `B` volta uma aba; o D-pad e `A` operam os controles. Na aba 3, com um mini-game aberto, o D-pad e o analógico movem a bolha (e o cursor da IMU) sem mexer no mapa, e o `B` interrompe o jogo e devolve o foco ao botão dele.
- [ ] **Voo** (`/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT&contract=C01`, **sem** `autopilot`): analógico esquerdo = velocidade e deriva; `RT`/`LT` sobem e descem **na proporção do aperto**; `X` tira foto; `Y` troca RGB e LiDAR (num contrato de LiDAR, como `contract=C03`); `B` pede o retorno à base; `RB` acelera o tempo; `Menu` pausa.
- [ ] **Mesa** (`screen=HOLO_TABLE_VIEW`): analógico direito orbita; `RT`/`LT` dão zoom; `X` muda o modo; `Y` troca a dimensão; `RB` abre o painel de alas.
- [ ] **Laboratório** (`screen=INFOGRAPHIC_LAB`): `LB`/`RB` trocam de aba; o D-pad anda entre os controles e, com um slider em foco, `←` `→` mudam o valor.
- [ ] **Troca ao vivo:** desligar o controle no meio do voo não derruba o jogo; ao religar e apertar um botão ele volta a valer; usar o teclado devolve os botões do teclado.

| Controle | Conexão | Navegador | Resultado | Notas |
| :--- | :--- | :--- | :-: | :--- |
| Xbox ___ | ___ | ___ | ☐ | |
| PS5 ___ | ___ | ___ | ☐ | |

---

## 4. FPS com GPU (REQ-NFR-001, [OQ-013](open-questions.md))

O requisito: **≥ 55 FPS** (média de 10 s) a 1280 × 720, DPR 1, qualidade **Alta**, no voo e na mesa, e **≥ 58 FPS** no mapa-múndi, num notebook de 4 núcleos com Chrome atual. A [ADR-024](decisions.md) mediu tudo em Chromium **sem GPU** (o canvas rasterizado por software, o pior caso); aqui se repete a tabela com GPU. Se der abaixo, o painel F9 diz qual etapa pesa.

**Como medir**

1. Janela do navegador em 1280 × 720 (ou o mais perto que der) e zoom de 100 %. Confira o DPR no console: `window.devicePixelRatio` (o requisito é **1**; numa tela com escala de 150 % ou 200 % o voo e a mesa baixam sozinhos a resolução do canvas quando o quadro fica lento, [ADR-033](decisions.md): anote o DPR e a escala que o F9 mostra em "Resolução do canvas", e meça uma vez também em escala 100 %).
2. `Esc → Configurações → Qualidade gráfica → Alta`.
3. Abra a cena, **feche o painel F9** (aberto, ele liga os contadores por etapa) e cole no console:

   ```js
   (async () => {
     await new Promise((r) => setTimeout(r, 10000)); // aquecimento
     const stamps = [];
     await new Promise((resolve) => {
       requestAnimationFrame(function tick(now) {
         stamps.push(now);
         if (now - stamps[0] >= 10000) resolve();
         else requestAnimationFrame(tick);
       });
     });
     const secs = (stamps.at(-1) - stamps[0]) / 1000;
     console.log(`FPS médio: ${((stamps.length - 1) / secs).toFixed(1)}`);
   })();
   ```

   (O contador "N FPS" no canto é uma média de 1 s; serve para ver a tendência.)
4. Com a medição feita, `F9` mostra o tempo de cada etapa em ms contra o orçamento (**voo 12 ms, mesa 10 ms**) e a resolução do canvas: anote as etapas que passarem de 2 ms e a escala (×1 é a resolução cheia a DPR 1).

**Cenas** (todas em `http://localhost:4173`; a coluna da ADR é a medição sem GPU, em Alta, com vsync de 60 Hz; num monitor de 120 ou 144 Hz o número pode passar de 60)

| Cena | URL e o que fazer | Meta | ADR-024 |
| :--- | :--- | :-: | :-: |
| Voo C01 (cidade) | `/?debug=1&skipIntro=1&autopilot=1&seed=3&screen=SURVEY_FLIGHT&contract=C01` | ≥ 55 | 60,0 |
| Voo C03 (floresta) | o mesmo, com `contract=C03` | ≥ 55 | 58,8 |
| Voo R04 (fada) | o mesmo, com `contract=R04` | ≥ 55 | 59,9 |
| Mesa, Real e Multiverso | `/?debug=1&skipIntro=1&screen=HOLO_TABLE_VIEW`; `F9` → **Mapear tudo (museu)**; `F9`; meça cada modo (`1`, `2`, `3`) nas duas dimensões (`Tab`) | ≥ 55 | 58,8 a 59,9 |
| Mapa-múndi andando | `/?debug=1&skipIntro=1&screen=WORLD_MAP`; segure `D` ou `→` e vá mudando de direção durante a medição | ≥ 58 | 60,0 |

| Máquina (CPU, GPU) | Navegador | DPR | C01 | C03 | R04 | Mesa (pior de 6) | Mapa | Escala do F9 (voo / mesa) | Notas |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- |
| ___ | ___ | ___ | ___ | ___ | ___ | ___ | ___ | ___ | |

---

## 5. Sons (escuta)

Os testes tocam todos os efeitos e confirmam que não há erro; **ninguém ouviu**. Abra `/?debug=1&screen=SOUNDBOARD`, **clique uma vez na página** (os navegadores só liberam o som depois do primeiro gesto) e toque um por um. As receitas estão em [audio.md](design/audio.md).

| Som | Quando toca no jogo | O que se deve ouvir | ☐ |
| :--- | :--- | :--- | :-: |
| `SHUTTER` | foto do voo | clique seco de obturador, com um segundo "tec" mais fraco logo depois | ☐ |
| `RTH_BEEP` | alerta de retorno à base | três bipes agudos, repetidos a cada 1,5 s enquanto o alerta durar | ☐ |
| `PIGEON_COO` | clicar no Atlas, decolar com ele | um arrulho de duas notas, descendo, com um leve tremor | ☐ |
| `CASH_REGISTER` | pagamento no relatório, venda | "cha" de chiado e um "ching" de três notas agudas | ☐ |
| `CRASH` | colisão ou queda | estouro grave de ruído que escurece, com um baque | ☐ |
| `UI_CLICK` / `UI_HOVER` | botões e foco | um clique curto; o de passar o mouse é ainda mais curto, mais agudo e bem mais baixo | ☐ |
| `ALERT` | ser detectado pelos holofotes (fenda R07) | sirene curta alternando dois tons | ☐ |
| `TAKEOFF` | começo do voo (com o Atlas toca o `PIGEON_COO`) | varredura de ruído e um zumbido que sobe, por 2,5 s | ☐ |
| `RIFT_OPEN` | abrir o briefing de fenda, nova fenda detectada | acorde brilhante e vibrado, com eco curto | ☐ |
| `LEVEL_UP` | subir de nível | arpejo de quatro notas subindo | ☐ |
| `COLLECT` | anel (R01) e marco geodésico | "blip" que sobe depressa | ☐ |
| `DENIED` | compra negada, ação inválida | dois toques graves e secos | ☐ |
| `STAGE_DONE` | etapa do pipeline concluída; linha aceita no voo | duas notas curtas, a segunda mais aguda | ☐ |
| `GRADE` | foto com nota Boa ou Perfeita no voo | um "plim" curto; numa sequência sobe de tom pela escala pentatônica | ☐ |
| `GRADE_MISS` | foto com nota Fraca ou Rejeitada | um "tum" grave que desce | ☐ |
| `PAGE_TURN` | virar a página da caderneta ou o souvenir no exame | um farfalhar de papel que sobe e a folha assentando logo depois | ☐ |

**Loops** (um botão liga e desliga cada um; o motor tem três variantes: Multirrotor, Asa fixa e Atlas)

- [ ] `MOTOR`: o multirrotor zumbe e sobe de tom com a velocidade; a asa fixa é mais grave; o Atlas **não tem motor** e bate asas em pulsos.
- [ ] `WIND`: sopro grave, mais forte com mais vento.
- [ ] `LIDAR_HUM`: zumbido do sensor, que liga e desliga ao trocar RGB e LiDAR no voo.
- [ ] `PROCESSING`: ventoinha com bipes de disco irregulares, durante o pipeline.

**Mistura e integração**

- [ ] Nenhum efeito soa muito mais alto ou mais áspero que os outros; nada **estala** ao ligar ou desligar um loop.
- [ ] Em jogo: o disparo da câmera, o bipe de retorno à base, o pagamento e o nível tocam na hora certa; o motor e o vento calam na pausa e ao fim do voo.
- [ ] `Esc → Configurações`: o volume geral e o dos efeitos mudam o que se ouve, e **Mudo** silencia tudo.

| Fones ou caixas | Navegador | Resultado | Notas |
| :--- | :--- | :-: | :--- |
| ___ | ___ | ☐ | |

---

## 6. Voo com desafio (Fase 1 do replanejamento)

O primeiro teste humano achou o voo sem desafio ([ADR-029](decisions.md)). A Fase 1 (T084 a T092) faz a pilotagem valer: portais do corredor, nota por foto, rajadas avisadas, revoo da linha mal voada e cruzeiro automático. Os pilotos simulados confirmam as metas (`npm run qa:flight`: o parado reprova em tudo, o mediano e o bom aprovam em tudo), mas **só uma pessoa diz se ficou divertido**. As Fases 2 e 3 só serão especificadas depois deste teste.

**Como jogar:** sem `autopilot` e sem `calm`. O C00 pelo caminho normal, com o jogo zerado, para ver as dicas do primeiro voo; os outros direto no voo, com `/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT&contract=<id>` (o plano de referência do contrato). Bons para comparar: **C00** (tutorial), **C02** (vento forte, linhas longas), **C04** (relevo da mina), **C06** (rajadas fortes da costa), **R01** e **R09** (fendas, mais arcade).

**O que avaliar**

- [ ] **Portais:** dá para ver para onde ir? O losango do centro (a nota Perfeita) é legível sobre qualquer terreno?
- [ ] **Entrada da linha:** cada linha começa fora do eixo de propósito. Alinhar a tempo do primeiro portal parece justo?
- [ ] **Rajadas ([ADR-034](decisions.md)):** a frente de vento (a cortina com riscos que vem do lado da rajada) se vê bem sobre qualquer céu e terreno, sem alerta escrito? Dá para ler de que lado ela vem e quando chega?
- [ ] **Contragolpe:** tocar contra a rajada no instante em que a frente chega dá "NO TEMPO!" e quase não empurra. A janela (~0,29 s) parece justa: difícil, mas não sorte? "CEDO" e "TARDE" ajudam a acertar da próxima vez? O som (`GUST_CUT` / `GUST_HIT`) e o tranco da tela se entendem?
- [ ] **Ritmo:** o voo ×1,75 ficou mais rápido sem ficar injusto? O mundo passando (riscos de velocidade, nuvens baixas, rastros das asas) dá a sensação de velocidade?
- [ ] **Visual:** o céu (sol, raios, mar de nuvens), a inclinação da câmera nas curvas e o halo dos portais. Com "Reduzir flashes e tremores", a câmera fica reta e sem tranco?
- [ ] **Sem GPU:** numa máquina sem aceleração, o F9 mostra o degrau de detalhe descer (a inclinação sai primeiro) e o FPS se segura? Anote o degrau e a escala em que ficou.
- [ ] **Relevo:** a seta SUBA ▲ / DESÇA ▼ e o corredor que acompanha o terreno se entendem?
- [ ] **Notas e som:** a marca da nota a cada foto, a sequência que sobe de tom e o som do erro. Ajudam ou cansam depois de alguns minutos?
- [ ] **Boletim e revoo:** quando a linha volta ("REVOO NECESSÁRIO"), dá para entender por quê (qual eixo errou)?
- [ ] **Cruzeiro (`T`):** acelera na reta tranquila e solta sozinho no perigo (rajada, obstáculo, alerta). A surtida fica num tempo bom? Com o ritmo ×1,75 a do mediano vai de 0,5 a 6,7 minutos reais (eram até 10): anote se ainda pesa.
- [ ] **Parado não passa:** soltar os controles numa linha a reprova; o relatório explica a execução baixa?
- [ ] **Dificuldade:** os contratos reais puxam para a simulação e as fendas para o arcade. Algum frustra ou fica fácil demais?
- [ ] **Primeiro voo do C00:** as dicas (alinhar na entrada, a frente de vento e o contragolpe, o relevo, a nota, o cruzeiro, o boletim) aparecem na hora certa e se entendem?
- [ ] **IMU (campo, aba Calibração):** o "8" cabe inteiro no painel, o guia espera 2 s e anda numa velocidade que dá para seguir com o mouse e com o analógico?
- [ ] **Vento vertical ([ADR-035](decisions.md)):** a lâmina da rajada vertical (que desce do céu ou sobe do chão) se lê tão bem quanto a de lado? O contragolpe em `Q`/`E` no instante da chegada sai natural? As correntes verticais (riscos lentos subindo ou descendo) pedem a mão sem cansar?
- [ ] **Movimento vertical:** subir e descer aparecem na tela (a aeronave sai do lugar no quadro)? A subida mais rápida dá conta das rajadas?
- [ ] **Troca de faixa:** o portal da curva (a seta âmbar) e o aviso com as teclas aparecem a tempo? O acorde `W`+`E`+`D` (`W`+`A`+`Q`) e a sequência `D` → `E` → `W` funcionam no seu teclado? A janela parece justa na fácil, na média e na difícil? A arremetida e o retorno automático na terceira curva perdida se entendem? No controle, o analógico na diagonal com o gatilho do lado sai fácil?
- [ ] **Dificuldade:** o seletor do checklist explica o que muda e quanto paga? A fácil fica tranquila, a média como antes (mais o vertical) e a difícil desafia sem frustrar?
- [ ] **C01 com o Atlas:** com o pombo a 75–80 m, o voo passa por cima de todos os prédios e o contrato aprova?
- [ ] **O Atlas (T097):** no voo e no poleiro, ele parece destemido e fofo ao mesmo tempo? A piscada, o topete e a sobrancelha se leem no tamanho do voo? Cada acessório (óculos, cachecol, mochilinha, louros) se reconhece de trás e de perfil?
- [ ] **Chão:** a estrada de terra do C00 e as estradas da C02 ficam contínuas, sem quadrados marrons nem pontos soltos? As divisas (campo, mata, solo da mina) ficam em diagonal, sem escada?

| Contrato | Dificuldade | Execução no pós-voo | Divertido (1–5) | Difícil (1–5) | Notas |
| :--- | :-: | :-: | :-: | :-: | :--- |
| ___ | ___ | ___ % | ☐ | ☐ | |

---

## 7. Campanha jogada

O passo 4 da [T079](tasks.md) pedia uma partida de verdade; os testes automáticos só percorrem os caminhos certos. O que interessa aqui é a **sensação**: o que um teste não mede.

**Como jogar:** `/?debug=1&skipIntro=1` (sem `unlockAll`, para ver o tutorial e a progressão reais). `money=<n>` é permitido para pular a economia e `F9 → Gerar missão pendente` para pular um voo. Ordem dos sete contratos reais: **C00 → C01 → C05 → C06 → C02 → C04 → C03**. As fendas abrem junto: R01 e R02 com o C01; R07 com o C06; R08 e R11 com o C05; R09 com o C02; R03 e R05 com o C04; R04 com o C03; a R10 só com o C03 **e** cinco fendas. Concluir os sete reais mostra o final (a carta do avô e o Chapéu do Avô).

**O que avaliar**

- [ ] **Início:** a carta do avô, as cinco dicas do tutorial e o primeiro voo se entendem sem ajuda?
- [ ] **Voo manual:** os controles respondem bem (velocidade, deriva, altura, foto, retorno à base); o vento, a bateria e os obstáculos pedem atenção sem frustrar? (O voo em si tem a §6.)
- [ ] **Relatório:** quando reprova, dá para entender **por quê** (GSD, sobreposição, pontos de apoio, RMSE, PEC-PCD)? As fórmulas aparecem de um jeito que ensina?
- [ ] **Economia:** os preços da Garagem, da equipe e das habilidades contra o que os contratos pagam; a MegaMap (contraproposta e roubo de contrato); a renda do museu.
- [ ] **Variedade:** cada contrato tem cara própria (terreno, regra especial, clima); as fendas têm o clima paródico esperado (moldura violeta no HUD, anomalias).
- [ ] **Rejogar** um contrato concluído paga 40 %, sem souvenir.
- [ ] **Salvar e voltar:** fechar a aba no meio da campanha e reabrir mantém tudo (o autosave é a cada troca de tela).
- [ ] **Texto:** erros de português, termos técnicos errados, textos cortados.

| Trecho jogado | Tempo | Pontos bons | Problemas |
| :--- | :--- | :--- | :--- |
| ___ | ___ | | |

---

## 8. Aparência e conforto

- [ ] Em 1280 × 720 e em 1920 × 1080 nada se sobrepõe no HUD do voo, na barra superior, nos painéis e no relatório.
- [ ] Os textos sobre os canvases (HUD, rótulos da mesa, mapa-múndi) são legíveis sobre qualquer terreno.
- [ ] As transições entre telas e os efeitos (partículas, flash da foto) ficam bonitos e não incomodam; com `Esc → Configurações → Reduzir flashes e tremores` ligado o voo não pisca nem balança.
- [ ] Os 18 terrenos têm cara própria e sem emendas ou buracos visíveis.
- [ ] A mesa holográfica ganha corpo conforme os setores entram.
- [ ] **Souvenirs** (`/?debug=1&skipIntro=1&souvenirs=1` → Estante → **Examinar**, [office §5.1](features/office.md)): a caderneta abre fechada, vira em páginas duplas e fecha na contracapa; a letra parece escrita à mão e cabe na página, as tabelas e os esboços não se atropelam, e as piadas fazem sentido em pt-BR. A letra usa a fonte manuscrita da máquina ([ADR-036](decisions.md) §4): veja no **Windows** (Segoe Print) e no **macOS** (Bradley Hand ou Noteworthy), além do Linux. Cada um dos 18 objetos se reconhece pelo desenho, na estante da sala e na grade também. Depois do final, a contracapa interna traz a carta do Vô.

---

## 9. Fechando as pendências

- **Achou algo no Firefox, no Chrome ou no Edge (§1 e §2):** anote o navegador e a versão e abra uma tarefa nova (abaixo); o REQ-NFR-009 está ✅ pela suíte E2E, e uma falha humana o reabre.
- **FPS (§4) abaixo da meta:** anote a máquina e as etapas do F9 e abra uma pergunta nova; a OQ-013 fica com a Resolução "medido em ___".
- **Qualquer falha:** vire uma tarefa nova em [tasks.md](tasks.md) (com a spec afetada) antes de mexer no código, como em qualquer mudança (SDD, [README](README.md) §2).
