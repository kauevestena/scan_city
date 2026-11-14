Você é um Arquiteto de Software Sênior, Engenheiro Cartógrafo/Geodesta e Lead Game Designer especialista em sistemas interativos.
Sua missão é desenvolver um mega-aplicativo completo em React (Artifact de arquivo único) chamado **"Scan City"**, um simulador RPG de gerenciamento, exploração e engenharia que une rigor técnico real de Fotogrametria e LiDAR, exploração de mundo aberto em 2D, voo arcade em perspectiva 2.5D (pseudo-3D inspirado em *River Raid*), mesa topográfica holográfica viva, infográficos interativos e missões paralelas em dimensões da cultura pop.

---

### 1. ENREDO, UNIVERSO & LOOP DE GAMEPLAY
- **A Herança e o Propósito:** Você é neto de um agrimensor analógico das antigas que mapeava fronteiras com teodolito, bússola, baliza e caderneta de campo. Dele, você herdou uma oficina decadente, instrumentos clássicos e **"Atlas"**, um pombo-correio domesticado com senso de orientação sobrenatural.
- **O Sonho Principal (O Museu da Terra):** Diante da rápida degradação ambiental e da demolição silenciosa do patrimônio histórico, você decide construir o **Grande Museu da Terra**: um arquivo digital 1:1 preservando cada região do mundo em réplicas tridimensionais milimétricas, ortofotos históricas e nuvens de pontos LiDAR.
- **O Dilema Comercial & A Empresa Rival:** Preservar o mundo não gera lucro imediato. Para financiar o museu, comprar drones profissionais e bancar viagens de campo, você funda a **"GeoSurvey Soluções Cartográficas"** para atender contratos comerciais (prefeituras, mineradoras, fazendeiros, engenheiros). Ao mesmo tempo, precisa superar a concorrente desonesta **"MegaMap Corp"**, que entrega mapas distorcidos sem pontos de controle e tenta roubar seus clientes.
- **As Anomalias Dimensionais (Multiverso Pop):** Durante os levantamentos, seus sensores detectam fendas espaciais conectadas a universos paralelos povoados por paródias dos videogames, animes e cinema. Esses contratos secretos pagam fortunas e desbloqueiam dioramas exclusivos na **Ala Secreta do Multiverso** do seu Museu.

---

### 2. ARQUITETURA DE TELAS & DUALIDADE DE PERSPECTIVAS
O aplicativo opera sob uma máquina de estados central (`useState`) que alterna estritamente a câmera, a física, os controles e a renderização entre 7 estados:

1. `OFFICE` **(Sede da GeoSurvey — Hub Interativo):**
   - Visão interativa do escritório contendo: **Workstation de Processamento SfM**, **Garagem de Frota Terrestre**, **Poleiro do Pombo Atlas** (comedouro de milho e calibração da câmera), **Estante de Relíquias/Souvenirs**, **Laboratório de Infográficos** e, no centro da sala, a **Mesa Topográfica Holográfica (O Museu)**.
2. `WORLD_MAP` **(Mundo Aberto — Perspectiva Top-Down 2D Clássica):**
   - **Estilo Visual:** Mapa de navegação estilo *Super Mario World*, *Pokémon* ou *Zelda: A Link to the Past*.
   - **Jogabilidade de Deslocamento:** Aqui o jogador **NÃO voa**. Ele controla o avatar do agrimensor a pé, de bicicleta ou dirigindo seus veículos desbloqueados (Carro Popular, Picape 4x4, Van Laboratório) por rodovias, estradas de terra batida e trilhas, podendo encontrar eventos aleatórios de campo no caminho.
   - **Seletor de Dimensão:** Abas/botões para alternar entre **Contratos do Mundo Real** (campanha principal) e **Fendas Dimensionais** (missões especiais). Encostar em um marcador abre o briefing do cliente e leva ao planejamento de campo.
3. `FIELD_SETUP` **(Planejamento Técnico & Mini-Games de Campo — Visão Ortogonal 2D):**
   - Mapa de satélite estático da Área de Interesse (AOI).
   - **Alocação de Pontos de Apoio (GCPs e Check Points):** O jogador clica no terreno para cravar alvos xadrez. A acessibilidade depende do veículo terrestre (sem 4x4, o jogador fica restrito à beira da estrada e não consegue colocar GCPs em morros ou brejos).
   - **Configuração de Sensores e Plano de Voo:** Seleção de lentes ($24\text{mm}$, $35\text{mm}$), sensores ($20\text{MP}$, $45\text{MP}$, tamanho do pixel em $\mu m$), sliders de altura ($H$), sobreposição longitudinal ($60\%\text{--}85\%$) e lateral ($50\%\text{--}80\%$), velocidade da aeronave e traçado automático das linhas de voo (*flight lines*) com posições estimadas de disparo.
   - **Mini-Games Rápidos de Pré-Voo (Bônus de Precisão):**
     - *Nivelamento da Base GNSS RTK:* Centralizar a bolha de nível em um alvo circular para garantir precisão sub-centimétrica.
     - *Calibração da IMU:* Seguir um padrão em "8" com o analógico/mouse para zerar a deriva giroscópica.
4. `SURVEY_FLIGHT` **(Execução do Voo — Motor 2.5D Pseudo-3D no Canvas):**
   - **Transição Cinematográfica:** A aeronave decola do solo e a câmera posiciona-se atrás dela olhando para o horizonte. O mundo plano transforma-se em um ambiente pseudo-3D com ponto de fuga central e profundidade real.
5. `PROCESSING_RESULTS` **(Esteira SfM, Quality Report & Visualizador de Produtos):**
   - Barra de processamento na Workstation (velocidade definida pelo hardware comprado), relatório técnico de precisão (RMSE X, Y, Z conforme tolerâncias PEC-PCD / ASPRS), mapa de calor de sobreposição, visualizador multicamada (Ortofoto, MDS, MDT, Nuvem de Pontos 3D rotacionável e NDVI) e botão para enviar os dados à Mesa do Museu.
6. `HOLO_TABLE_VIEW` **(Inspeção 3D em Tela Cheia do Museu):**
   - Rotação orbital 360°, zoom, alternância entre **Terra Real** e **Multiverso**, camadas de visualização e gerenciamento de alas do museu.
7. `INFOGRAPHIC_LAB` **(Simulador Teórico & Infográficos Interativos):**
   - Central educacional interativa sobre os princípios físicos e matemáticos da Fotogrametria e do LiDAR.

---

### 3. MOTOR DE VOO 2.5D (RIVER RAID AVANÇADO)
Na tela `SURVEY_FLIGHT`, o Canvas HTML5 nativo (60 FPS via `requestAnimationFrame`) deve criar uma forte ilusão de profundidade tridimensional e relevo:

- **Projeção em Perspectiva Cônica:**
  - Todas as entidades (montanhas, curvas de nível, vales, prédios, casas, árvores, postes, fiação, canos, blocos, crateras e alvos GCP no solo) possuem coordenadas 3D $(X, Y, Z)$, onde $Z$ representa a distância até a câmera.
  - Fator de escala dinâmico:
    $$\text{scale} = \frac{\text{focal\_length}}{Z + \text{camera\_offset}}$$
  - Coordenadas de tela convergindo para o ponto de fuga no horizonte:
    $$X_{\text{screen}} = \text{HorizonX} + X \cdot \text{scale}$$
    $$Y_{\text{screen}} = \text{HorizonY} + (Y + \text{ElevacaoTerreno}(X, Z)) \cdot \text{scale}$$
- **Relevo Visível & Sensação de Aproximação:**
  - O terreno é fatiado em faixas horizontais de perspectiva (estilo Mode-7 avançado) com **relevo visível em perspectiva**: morros se erguem bloqueando parcialmente o horizonte e ravinas afundam com sombreamento dinâmico (*hillshade*) e curvas de nível projetadas no solo.
  - Obstáculos surgem minúsculos no horizonte ($Z$ alto) e crescem exponencialmente conforme se aproximam da câmera ($Z \to 0$), exigindo desvios laterais ou ganho de altitude.
- **Controle de Altitude ($H$) e Consequências Técnicas:**
  - **Subir ($H \uparrow$):** Afasta copas de árvores e prédios, amplia o *footprint* no solo, mas piora o GSD (menor nitidez).
  - **Descer ($H \downarrow$):** Aproxima prédios e copas de árvores da tela criando sensação de velocidade extrema e risco de colisão, melhora o GSD, mas reduz o *footprint* (exigindo velocidade menor para não abrir buracos na sobreposição).
- **Operação dos Sensores em Tempo Real:**
  - **Câmera Fotogramétrica RGB:** Projeta um trapézio luminoso (*footprint*) no relevo 2.5D a cada disparo automático calculado pelo intervalo de sobreposição, acompanhado de flash suave, contador de fotos e alerta de "Overlap Insuficiente" se voar rápido demais ou sair da faixa. Se voar rápido com pouca luz, gera alerta de *Motion Blur*.
  - **Sensor LiDAR:** Projeta um leque de feixes laser ciano/verde oscilando transversalmente sobre o relevo, exibindo em tempo real a densidade de pontos ($pts/m^2$) e diferenciando primeiros retornos (copas/telhados) de últimos retornos (solo/MDT).
- **Condições Climáticas & Dinâmica de Voo:**
  - **Iluminação:** *Sol a Pino / Nublado* (ideal, sem sombras duras) vs. *Golden Hour* (sombras longas que prejudicam a correlação de pixels no SfM).
  - **Vento Cruzado e Térmicas:** Empurram a aeronave lateralmente, exigindo compensação do ângulo de deriva (*crab angle*).
  - **Gestão de Recurso:** Bateria (ou Sementes/Milho para o pombo Atlas) com alerta sonoro de **Retorno à Base (RTH)** — se zerar no ar, perde os dados coletados.

---

### 4. RIGOR TÉCNICO: CÁLCULOS, PROCESSAMENTO SFM & INFOGRÁFICOS

#### A. Fórmulas Fotogramétricas Reais Implementadas no Código
- **Ground Sampling Distance ($GSD$):**
  $$GSD = \frac{H \cdot s_{\text{pixel}}}{f} \quad (\text{em cm/px})$$
- **Dimensões da Pegada no Solo ($W_g \times H_g$):**
  $$W_g = \frac{H \cdot W_{\text{sensor}}}{f}, \quad H_g = \frac{H \cdot H_{\text{sensor}}}{f}$$
- **Base Aérea ($B$) e Espaçamento entre Faixas ($S$):**
  $$B = H_g \cdot \left(1 - \frac{p\%}{100}\right), \quad S = W_g \cdot \left(1 - \frac{q\%}{100}\right)$$
- **Intervalo de Disparo ($\Delta t$):** $\Delta t = \frac{B}{v_{\text{voo}}}$

#### B. Pipeline SfM e Quality Report (`PROCESSING_RESULTS`)
- Simulação visual das etapas: *1. Extração de Features (SIFT/ORB) $\to$ 2. Correspondência de Tie Points $\to$ 3. Ajustamento em Bloco por Feixes (BBA) e Calibração de Lente ($k_1, k_2, p_1, p_2$) $\to$ 4. Densificação da Nuvem de Pontos $\to$ 5. Geração de MDS/MDT $\to$ 6. Ortorretificação e Mosaico*.
- **Relatório de Qualidade Técnico:**
  - Tabela de **Erro Médio Quadrático (RMSE)** em $X, Y, Z$ (em cm) para GCPs e Check Points (penalizado se houver poucos GCPs, GCPs alinhados em linha reta ou uso de *Rolling Shutter* sem RTK), com aprovação baseada nas tolerâncias cartográficas (PEC-PCD / ASPRS).
  - **Mapa de Calor de Sobreposição:** Verde ($\ge 5$ fotos/pixel), Amarelo ($3\text{--}4$), Vermelho ($< 3$ ou falha por excesso de velocidade).
- **Visualizador Interativo de Produtos Gerados:**
  - Alternância entre: **Ortofoto RGB**, **MDS (Modelo Digital de Superfície hipsométrico sombreado)**, **MDT (Modelo Digital de Terreno sem vegetação via LiDAR)**, **Nuvem de Pontos / Malha 3D (TIN)** rotacionável no Canvas e **Índice NDVI**.

#### C. Laboratório de Infográficos & Simulações (`INFOGRAPHIC_LAB`)
Quatro painéis interativos no escritório onde o jogador manipula sliders e observa diagramas animados:
1. **Óptica & GSD:** Corte transversal mostrando altura $H$, distância focal $f$ e tamanho do pixel projetado no terreno.
2. **Estereoscopia & Paralaxe ($B/H$):** Duas posições de câmera interceptando o topo e a base de um prédio, demonstrando como a paralaxe calcula a cota $Z$.
3. **LiDAR vs. Fotogrametria no Dossel:** Comparativo animado mostrando pulsos laser atravessando folhas (1º, 2º e último retorno atingindo o solo/MDT) enquanto a câmera RGB enxerga apenas a superfície da copa (MDS).
4. **Global Shutter vs. Rolling Shutter:** Simulação visual da distorção geométrica ("efeito gelatina") em alta velocidade.

---

### 5. CAMPANHAS: MUNDO REAL vs. FENDAS DIMENSIONAIS

#### A. Campanha Principal — Contratos do Mundo Real (Constrói a Maquete da Terra)
1. **Metrópole Vertical:** *Cliente:* Prefeito. *Objetivo:* Atualização cadastral de IPTU (*True-Ortho*). Exige sobreposição lateral $\ge 80\%$ para evitar o tombamento de arranha-céus e lidar com perda de sinal GNSS/RTK nos cânions urbanos.
2. **Planalto Agrícola:** *Cliente:* Produtor Rural. *Objetivo:* Monitoramento de safra e vigor vegetativo (NDVI) com câmera multiespectral. Áreas gigantescas (exige Asa Fixa) e textura homogênea que desafia o alinhamento SIFT.
3. **Floresta Amazônica:** *Cliente:* Instituto Ambiental / ONG. *Objetivo:* Topografia e regularização fundiária sob dossel fechado. Exige obrigatoriamente **LiDAR de múltiplos retornos** para penetrar as copas e gerar o MDT do solo.
4. **Mina a Céu Aberto:** *Cliente:* Engenheiro de Minas. *Objetivo:* Cálculo volumétrico de corte e aterro de minério. Desníveis brutais exigindo modo **Acompanhamento de Terreno (Terrain Following)**.
5. **Centro Histórico Colonial:** *Cliente:* Órgão de Patrimônio (IPHAN). *Objetivo:* Restauração arquitetônica. Exige voo em malha cruzada e câmera oblíqua para modelar fachadas de casarões e desviar de fiação elétrica baixa.
6. **Zona Costeira e Estuário:** *Cliente:* Agência Marítima. *Objetivo:* Monitoramento de erosão costeira sob ventos fortes e superfície da água com reflexo especular (ausência de *tie points*).

#### B. Side-Quests — Anomalias Dimensionais (Paródias da Cultura Pop — Ala do Multiverso)
Acessadas por fendas brilhantes no mapa aberto; alimentam a **Ala Secreta do Multiverso** no Museu:
1. **Colinas Verdes dos Espinhos (Sonic):** *Cliente:* **"Sonisvaldo"** (ouriço marrom hiperativo de tênis vermelhos gastos). *Contrato:* Ortofoto de pista ($GSD < 3\text{cm}$) para achar buracos antes que um cientista bigodudo construa fábricas de robôs. *Visual 2.5D:* Loops de pedra e anéis dourados flutuantes.
2. **Reino dos Encanamentos (Mario):** *Cliente:* **"Seu Márcio Bross"** (encanador aposentado gordinho de macacão azul e boné "M"). *Contrato:* Cadastro planialtimétrico de bueiros contra infestações de tartarugas voadoras e plantas carnívoras. *Visual 2.5D:* Canos verdes gigantes e plataformas de tijolos.
3. **Planalto dos Guerreiros (Dragon Ball):** *Cliente:* **"Guko"** (lutador faminto de quimono laranja e cabelo espetado). *Contrato:* Cálculo volumétrico de terra vaporizada em crateras pós-torneio apocalíptico para prestar contas à prefeitura. *Visual 2.5D:* Crateras esféricas e raios de energia residuais.
4. **Bosque das Fadas Perdidas (Zelda):** *Cliente:* **"Lino"** (arqueólogo mudo de túnica verde que só grita *"HYAAAH!"*). *Contrato:* Varredura LiDAR sob névoa mágica e copas densas para revelar o *"Templo do Triângulo Geodésico Dourado"* soterrado.
5. **Mina dos Blocos Cúbicos (Minecraft):** *Cliente:* **"Estêvão"** (minerador de camisa ciano que não pisca e anda em ângulos retos). *Contrato:* Nuvem de pontos 3D de taludes em degraus cúbicos para identificar deformações e prevenir vazamento de lava.
6. **Pântano Cinzento (The Witcher):** *Cliente:* **"Geraldo de Rívia"** (caçador de pragas grisalho com duas espadas: uma de aço e uma de teodolito). *Contrato:* Mapeamento termográfico/batimétrico para achar tocas de criaturas no brejo sem sujar as botas.
7. **Base Polar das Sombras (Metal Gear Solid):** *Cliente:* **"Cobrinha Sólida"** (agente de bandana escondido numa caixa de papelão). *Contrato:* Reconhecimento aéreo furtivo sob nevasca ($2\times$ drenagem de bateria) para modelar uma arma bípede gigante no pátio.
8. **Bairro dos Santos (GTA San Andreas):** *Cliente:* **"Carlinhos Joilson (CJ)"** (regata branca e bicicleta BMX reclamando: *"Ah droga, lá vou eu mapear de novo"*). *Contrato:* Regularização Fundiária Urbana (REURB) de vielas e becos.
9. **Savana das Gramas Altas (Pokémon):** *Cliente:* **"Ailton da Rocha"** (treinador de boné virado para trás e mochila gigante). *Contrato:* Mapa multiespectral NDVI para identificar corredores de espécies raras sem pisar em cobras elétricas.
10. **Trincheira da Estrela de Ferro (Star Wars):** *Cliente:* **"Lorde Válter"** (executivo de armadura preta com respiração ruidosa). *Contrato:* Inspeção LiDAR de alta densidade ($> 100\text{ pts/m}^2$) dentro de uma trincheira metálica para checar uma escotilha de exaustão de 2m.
11. **Tumbas dos Desfiladeiros (Tomb Raider):** *Cliente:* **"Dona Laura da Silva"** (aristocrata de trança e pistolas de tinta para marcar pontos de apoio). *Contrato:* Fotogrametria oblíqua (45°/60°) de templos esculpidos em falésias verticais.

---

### 6. PROGRESSÃO RPG, ESCRITÓRIO, FROTA & GAME JUICE
- **Aeronaves & Sensores (Tiers):**
  - *Tier 0 — Pombo "Atlas":* Voo super estável, gasta milho em vez de bateria, imune a interferências eletromagnéticas das fendas, câmera analógica simples (pode desviar brevemente se avistar sementes ou insetos).
  - *Tier 1 — Drone Amador de Entrada:* Câmera *Rolling Shutter* (distorção geométrica em curvas), sem RTK, bateria curta (12 min).
  - *Tier 2 — Multirrotor Profissional RTK:* Câmera *Global Shutter* 45 MP, base GNSS RTK centimétrica, resistente a ventos moderados.
  - *Tier 3 — Asa Fixa (VTOL):* Alta velocidade de cruzeiro para grandes áreas rurais e crateras, raio de curva amplo.
  - *Tier 4 — Pod LiDAR Aerotransportado:* Scanner laser multi-retorno de alta frequência com IMU tática acoplada.
- **Frota Terrestre (Overworld 2D & Alcance de GCPs):**
  - *A Pé / Bicicleta* $\to$ *Carro Compacto* (estradas pavimentadas) $\to$ *Picape 4x4 Off-Road* (montanhas, minas, pântanos e GCPs em locais remotos) $\to$ *Van Laboratório Móvel* (processamento SfM direto no campo sem voltar ao escritório).
- **Upgrades do Escritório (Hardware & Equipe):**
  - *Hardware de Processamento:* Evoluir de **Notebook Velho Lento** $\to$ **PC Gamer** $\to$ **Workstation Multi-GPU** $\to$ **Servidores em Nuvem** (acelera drasticamente a barra de processamento SfM).
  - *Contratação de Equipe:* Contratar **Estagiários** e **Engenheiros Juniores** para automatizar a vetorização de mapas e aumentar o lucro dos contratos.
- **Customização Cosmética:**
  - Skins desbloqueáveis para o **personagem**, pintura para os **drones**, acessórios/cores para o **pombo Atlas** e emblema personalizado da empresa.
- **Árvore de Habilidades do Geodesta (3 Ramos com Pontos de XP):**
  1. *Pilotagem & Campo:* Redução de deriva do vento, autonomia estendida de bateria/milho, velocidade de deslocamento no mapa.
  2. *Engenharia & Sensores:* Maior densidade de *tie points* SIFT, redução de ruído LiDAR, compensação automática de *Rolling Shutter*.
  3. *Gestão & Curadoria:* +25% nos pagamentos de contratos, multiplicador de visitantes no Museu, desconto na loja de equipamentos.
- **Mesa Topográfica Holográfica (`HOLO_TABLE_VIEW`):**
  - **Névoa Cartográfica (Fog of War):** Setores não mapeados são blocos de gesso cinza/wireframe; setores concluídos ganham relevo esculpido, ortofoto, prédios 3D e miniaturas animadas do pombo/drones percorrendo as rotas.
  - **Chave Dimensional:** Alterna instantaneamente entre o mapa contínuo da **Terra Real** e a galeria flutuante do **Multiverso**.
  - **Modos de Exibição:** *Ortofoto Realista*, *Hipsometria com Hillshade* e *LiDAR Neón (Nuvem + TIN)*.
  - **Estante de Relíquias & Renda Passiva:** Cada cliente especial deixa um souvenir físico na estante do escritório (anel dourado, cano verde em miniatura, esfera laranja de 4 estrelas, caixa de papelão), e o Museu gera renda passiva contínua em R$.
- **Áudio Procedural (Web Audio API):**
  - Sintetizador de efeitos sonoros integrado sem arquivos externos: clique mecânico de obturador a cada foto, zumbido de varredura LiDAR, bip de alerta RTH, arrulho do pombo Atlas e som de caixa registradora ao receber pagamentos.

---

### 7. SISTEMA DE CONTROLES UNIFICADO (PC & GAMEPADS XBOX / PS5)
Implementar suporte nativo a teclado/mouse e à **Web Gamepad API** (`navigator.getGamepads()`), detectando automaticamente controles conectados (`gamepadconnected`) e atualizando os ícones de botões na UI em tempo real:

| Ação no Jogo | Teclado & Mouse (PC) | Controle Xbox | Controle PlayStation (PS5) |
| :--- | :--- | :--- | :--- |
| **Mover Avatar / Veículo (Overworld 2D)** | `W, A, S, D` ou `Setas` | Analógico Esquerdo / D-Pad | Analógico Esquerdo / D-Pad |
| **Interagir / Entrar no Contrato** | `Espaço` ou `Enter` | Botão `A` | Botão `X` (Cruz) |
| **Manobrar / Velocidade (Voo 2.5D)** | `W / S` (Velocidade), `A / D` (Deriva) | Analógico Esquerdo | Analógico Esquerdo |
| **Controlar Altitude ($H$)** | `Q` (Subir) / `E` (Descer) | Gatilho `RT` (Subir) / `LT` (Descer) | Gatilho `R2` (Subir) / `L2` (Descer) |
| **Disparo Manual / Mini-Game** | `Espaço` | Botão `X` | Botão `Quadrado` |
| **Alternar Sensor (RGB / LiDAR)** | `1` / `2` ou `Tab` | Botão `Y` | Botão `Triângulo` |
| **Acionar Retorno à Base (RTH)** | `R` | Botão `B` | Botão `Círculo` |
| **Pausar / Abrir Menu** | `Esc` ou `M` | Botão `Menu` | Botão `Options` |

---

### 8. REQUISITOS ESTRITOS DE IMPLEMENTAÇÃO
- Desenvolva como um **componente React funcional, completo e auto-contido em um único arquivo** (pronto para rodar como Claude Artifact).
- Utilize **Tailwind CSS** para toda a UI, HUD tático, árvore de habilidades, diálogos e painéis técnicos (paleta dark mode geodésica: ardósia escura, ciano radar, âmbar e verde esmeralda).
- Utilize **Canvas HTML5 nativo** a 60 FPS (`requestAnimationFrame`) para o Overworld 2D, para o motor de Voo 2.5D pseudo-3D com relevo, para a Mesa Topográfica Holográfica 3D e para os visualizadores de produtos cartográficos.
- Utilize ícones da biblioteca `lucide-react` e efeitos sonoros gerados via `AudioContext` (Web Audio API).
- **Zero Placeholders:** O código deve ser 100% funcional e executável, sem abreviações do tipo `// TODO` ou funções vazias. Toda a matemática cartográfica, a máquina de estados, os contratos reais e dimensionais, os infográficos interativos, a Gamepad API e os motores gráficos devem estar integralmente programados.