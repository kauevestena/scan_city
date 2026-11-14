# Produto — Scan City

> Visão do produto, narrativa, loop de jogo e glossário. Fonte: seção 1 de [spec_inicial.md](../spec_inicial.md).

---

## 1. Pitch

**Scan City** é um simulador RPG de gerenciamento, exploração e engenharia cartográfica. Ele combina rigor técnico real de **Fotogrametria** e **LiDAR** com:
- exploração de mundo aberto em 2D top-down;
- voo arcade em perspectiva 2.5D, com rolagem para frente e relevo visível;
- uma mesa topográfica holográfica que cresce conforme o mundo é mapeado;
- um laboratório de infográficos interativos;
- missões paralelas em dimensões paródicas da cultura pop.

O jogador aprende fotogrametria **jogando**. As fórmulas reais (GSD, sobreposição, base aérea, densidade LiDAR, RMSE e PEC-PCD) determinam o sucesso das missões.

---

## 2. Narrativa

### 2.1 A herança
O jogador é neto de um **agrimensor analógico** que mapeava fronteiras com teodolito, bússola, baliza e caderneta de campo. Dele, herdou:
- uma **oficina decadente**, que vira a sede da GeoSurvey;
- **instrumentos clássicos**: a *Estação Total do Avô* (usada para medir GCPs) e a caderneta;
- **Atlas**, um pombo-correio com senso de orientação sobrenatural, que carrega uma câmera de peito. Atlas é a primeira "aeronave" do jogo.

### 2.2 O sonho: o Grande Museu da Terra
Diante da degradação ambiental e da demolição silenciosa do patrimônio, o jogador quer construir o **Grande Museu da Terra**. É um arquivo digital 1:1 com réplicas 3D, ortofotos históricas e nuvens LiDAR de cada região. O Museu é a **Mesa Topográfica Holográfica** no centro do escritório, e cada contrato concluído esculpe um novo setor nela.

### 2.3 O dilema comercial
Preservar não dá lucro imediato. Para financiar o museu, o jogador funda a **GeoSurvey Soluções Cartográficas** e atende contratos comerciais (prefeituras, mineradoras, fazendeiros, ONGs e órgãos de patrimônio).

A concorrente desonesta **MegaMap Corp** entrega mapas distorcidos, sem pontos de controle, e tenta roubar clientes:
- faz contrapropostas mais baratas;
- toma os contratos em que o jogador falha.

### 2.4 As Anomalias Dimensionais
Durante os levantamentos, os sensores detectam **fendas espaciais** para universos paralelos paródicos. Os contratos secretos dessas fendas pagam fortunas e desbloqueiam dioramas na **Ala Secreta do Multiverso** do Museu. Dentro das fendas, drones sofrem interferência eletromagnética, e só Atlas é imune.

---

## 3. Personas de jogador

| Persona | Motivação | O que o jogo oferece |
| :--- | :--- | :--- |
| **Estudante/profissional de geo** | Ver fórmulas reais em ação | Laboratório de infográficos, relatório com RMSE e PEC-PCD, parâmetros reais de sensores |
| **Jogador casual de gestão** | Progresso, upgrades, coleção | Loja, árvore de skills, museu com renda passiva, souvenirs, cosméticos |
| **Jogador arcade** | Ação e reflexo | Voo 2.5D com obstáculos, vento, bateria e risco de colisão |
| **Fã de cultura pop** | Humor e referências | Fendas com clientes paródicos e visuais temáticos |

---

## 4. Loop de gameplay

```
                ┌─────────────────────────────────────────────────────────┐
                ▼                                                         │
┌──────────────────┐  porta   ┌──────────────┐  aceitar   ┌──────────────┐ │
│ OFFICE (Sede)    │────────▶ │ WORLD_MAP    │──────────▶ │ FIELD_SETUP  │ │
│ loja, skills,    │ ◀────────│ andar/dirigir│ ◀──────────│ GCPs, plano, │ │
│ equipe, museu    │  sede    │ eventos      │  cancelar  │ mini-games   │ │
└──────────────────┘          └──────────────┘            └──────┬───────┘ │
   ▲   │  ▲  ▲                    ▲     ▲                        │ decolar │
   │   │  │  │                    │     │ dados na fila           ▼         │
   │   │  │  │                    │     └──────────────── ┌──────────────┐  │
   │   │  │  │ workstation        │       (sem Van)       │SURVEY_FLIGHT │  │
   │   │  │  └──────────────┐     │ falha/abandono        │ voo 2.5D     │  │
   │   │  │                 │     └───────────────────────┤ fotos/LiDAR  │  │
   │   │  │                 ▼                             └──────┬───────┘  │
   │   │  │         ┌────────────────────┐   com Van Lab         │          │
   │   │  │         │ PROCESSING_RESULTS │ ◀─────────────────────┘          │
   │   │  │         │ SfM, relatório,    │                                  │
   │   │  │         │ pagamento, XP      │──── enviar ao museu ──┐          │
   │   │  │         └────────────────────┘                       ▼          │
   │   │  │                                         ┌──────────────────┐    │
   │   │  └─────────────────────────────────────────│ HOLO_TABLE_VIEW  │    │
   │   │                                            └──────────────────┘    │
   │   └──────────────▶ INFOGRAPHIC_LAB ────────────────────────────────────┘
   └─────────────────── upgrades → contratos mais difíceis ────────────────┘
```

**Ciclo curto (uma missão, de 5 a 15 min):** briefing → planejamento (GCPs, sensor, altura, sobreposição) → mini-games opcionais → voo → processamento → relatório e pagamento → museu.

**Ciclo longo (campanha):**
1. Ganhar dinheiro, XP e reputação.
2. Comprar aeronaves, sensores, veículos e hardware.
3. Desbloquear contratos mais exigentes.
4. Completar a Maquete da Terra (7 setores) e a Ala do Multiverso (11 dioramas).

**Condição de "fim" da campanha:**
- Todos os 7 contratos reais aprovados exibem a cena final, com a carta do avô e o Museu inaugurado.
- O jogo continua aberto depois disso, para as fendas, os replays e as melhorias de nota.

---

## 5. Pilares de design

1. **A técnica é a mecânica.** Toda escolha técnica (altura, lente, sobreposição, velocidade, GCPs, iluminação) tem consequência mensurável no relatório e no pagamento.
2. **Risco × qualidade.** Voar baixo melhora o GSD, mas aumenta o risco e exige voar mais devagar. Voar rápido economiza bateria, mas abre buracos na sobreposição e borra as fotos.
3. **Progressão visível.** A mesa holográfica sai do gesso cinza e ganha relevo colorido. A estante enche de souvenirs, e a frota cresce.
4. **Humor com respeito.** Clientes e fendas são divertidos, e a técnica permanece correta.

---

## 6. Glossário técnico

| Termo | Definição no jogo |
| :--- | :--- |
| **AOI** | *Area of Interest*: retângulo do contrato a ser mapeado (largura × comprimento, em m) |
| **GSD** | *Ground Sampling Distance*: tamanho de um pixel no terreno (cm/px). Quanto menor, mais nítido |
| **Footprint (pegada)** | Área do terreno coberta por uma foto: W_g × H_g |
| **Sobreposição longitudinal (p)** | % de sobreposição entre fotos consecutivas da mesma linha (*forward overlap*) |
| **Sobreposição lateral (q)** | % de sobreposição entre linhas de voo vizinhas (*side overlap*) |
| **Base aérea (B)** | Distância entre dois disparos consecutivos |
| **Espaçamento (S)** | Distância entre linhas de voo adjacentes |
| **Linha de voo** | Trajeto retilíneo sobre a AOI no qual as fotos são disparadas |
| **GCP** | *Ground Control Point*: alvo xadrez no solo com coordenada conhecida, usado no ajustamento |
| **CP** | *Check Point*: alvo de verificação, **não** usado no ajustamento. Mede a acurácia real |
| **RMSE** | Erro médio quadrático dos resíduos (cm), por eixo X, Y, Z e resultante planimétrica |
| **RTK** | *Real Time Kinematic*: correção GNSS em tempo real com precisão centimétrica |
| **FIX / FLOAT** | Estado da solução RTK: FIX é centimétrica, FLOAT é degradada (decimétrica) |
| **IMU** | Unidade inercial (giroscópios e acelerômetros) que mede a atitude da aeronave |
| **SfM** | *Structure from Motion*: reconstrução 3D a partir de fotos sobrepostas |
| **SIFT / ORB** | Algoritmos de extração de *features* (pontos característicos) nas imagens |
| **Tie points** | Pontos homólogos encontrados em várias fotos |
| **BBA** | *Bundle Block Adjustment*: ajustamento em bloco por feixes perspectivos |
| **k₁, k₂, p₁, p₂** | Coeficientes de distorção radial (k) e tangencial (p) da lente |
| **MDS / DSM** | Modelo Digital de Superfície, com prédios e copas |
| **MDT / DTM** | Modelo Digital de Terreno: solo nu, sem vegetação nem construções |
| **TIN** | *Triangulated Irregular Network*: malha triangulada |
| **NDVI** | Índice de vegetação por diferença normalizada: (NIR − R)/(NIR + R) |
| **True-Ortho** | Ortofoto sem tombamento de prédios. Exige alta sobreposição |
| **PEC-PCD** | Padrão de Exatidão Cartográfica dos Produtos Cartográficos Digitais (ET-CQDG, Brasil), com classes A, B, C e D |
| **EP** | Erro Padrão máximo admitido por classe PEC-PCD |
| **ASPRS** | Padrões de acurácia posicional da *American Society for Photogrammetry and Remote Sensing* |
| **Crab angle** | Ângulo de deriva: correção de proa necessária para manter a linha sob vento cruzado |
| **Terrain Following (TF)** | Modo em que a aeronave mantém a altura constante **sobre o terreno** (AGL) |
| **AGL / MSL** | Altura acima do terreno / altitude acima do nível de referência |
| **Malha cruzada** | Voo em duas direções perpendiculares, para modelar fachadas e melhorar a geometria |
| **Oblíqua** | Câmera inclinada (45°/60°) para fotografar fachadas e paredes verticais |
| **Rolling Shutter** | Sensor lido linha a linha. Em movimento, gera o "efeito gelatina" |
| **Global Shutter** | Sensor exposto todo de uma vez, sem distorção de movimento |
| **Motion blur** | Arrasto da imagem durante a exposição: v · t_exp / GSD (px) |
| **PRR** | *Pulse Repetition Rate*: pulsos LiDAR por segundo |
| **Retornos LiDAR** | 1º retorno (topo de copa ou telhado), retornos intermediários e último retorno (solo) |
| **RTH** | *Return To Home*: retorno automático à base |
| **Golden Hour** | Sol baixo, com sombras longas que prejudicam a correlação de pixels |
| **REURB** | Regularização Fundiária Urbana |
| **Van Lab** | Van laboratório que processa os dados no campo |
