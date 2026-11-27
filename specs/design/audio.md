# Design — Áudio Procedural (Web Audio API)

> Todos os sons são sintetizados em tempo real. Não há arquivos de áudio.
>
> **Requisitos cobertos:** REQ-AUD-001, REQ-AUD-002, REQ-AUD-003.

---

## 1. `AudioEngine` (`src/audio/AudioEngine.ts`)

```ts
class AudioEngine {
  static get(): AudioEngine;
  unlock(): void;                       // cria/resume o AudioContext; chamado no 1º gesto do usuário
  readonly ready: boolean;
  setVolumes(master: number, sfx: number, muted: boolean): void;
  play(id: SfxId, opts?: { pitch?: number; gain?: number; pan?: number }): void;   // one-shot
  startLoop(id: LoopId): LoopHandle;    // sons contínuos
  noiseBuffer(): AudioBuffer;           // ruído branco de 1 s, gerado uma vez e reutilizado
}
interface LoopHandle { setParam(name: 'pitch' | 'gain' | 'rate', value: number): void; stop(fadeS?: number): void }
type SfxId = 'SHUTTER' | 'RTH_BEEP' | 'PIGEON_COO' | 'CASH_REGISTER' | 'CRASH' | 'UI_CLICK' | 'UI_HOVER'
           | 'ALERT' | 'TAKEOFF' | 'RIFT_OPEN' | 'LEVEL_UP' | 'COLLECT' | 'DENIED' | 'STAGE_DONE'
           | 'GRADE' | 'GRADE_MISS' | 'GUST_CUT' | 'GUST_HIT' | 'TURN_OK';
type LoopId = 'LIDAR_HUM' | 'MOTOR' | 'WIND' | 'PROCESSING';
```

**Grafo de nós:**
```
fontes → gainSfx → gainMaster → DynamicsCompressor (threshold −18 dB, ratio 4) → destination
```

**Regras:**
- **Desbloqueio:** um listener global (`pointerdown`, `keydown`, `gamepadconnected` + 1º botão) chama `unlock()` uma vez. Antes do desbloqueio, `play()` é um no-op silencioso, e não há erro.
- **Limite de vozes:** no máximo 24 vozes one-shot simultâneas. Acima disso, a nova chamada do mesmo `SfxId` é descartada.
- **`SHUTTER`:** limitado a uma reprodução a cada 60 ms.
- **Volumes:** `master` e `sfx` de 0 a 1. O ganho efetivo é `value²`, uma curva perceptual. `muted` zera o master com rampa de 50 ms.

---

## 2. Envelope padrão

`env(gainParam, t0, { a, d, s, r, peak, sustainTime })` aplica `linearRampToValueAtTime` (ataque) e `exponentialRampToValueAtTime` (decaimento e release, nunca até 0: mínimo 0,0001).

---

## 3. Receitas

| Id | Receita | Duração |
| :--- | :--- | :--- |
| `SHUTTER` | (1) Ruído → `highpass` 2,5 kHz → env (a 1 ms, d 25 ms, peak 0,6). (2) Clique: `square` 1,8 kHz, env (a 0, d 8 ms, peak 0,3). (3) Segundo clique de "espelho" 45 ms depois, a 1,2 kHz e peak 0,2 | 80 ms |
| `LIDAR_HUM` (loop) | `sawtooth` 110 Hz + `sawtooth` 220,7 Hz (desafinado) → `lowpass` 900 Hz (Q 6), com cutoff modulado por um LFO `sine` de 2 Hz (±400 Hz), que corresponde à varredura do leque → gain 0,12. `setParam('rate')` muda a frequência do LFO | contínuo |
| `RTH_BEEP` | `square` 880 Hz em 3 pulsos de 90 ms com 70 ms de intervalo, peak 0,25. Repetido pelo HUD a cada 1,5 s enquanto o alerta estiver ativo | 0,4 s |
| `PIGEON_COO` | Duas notas: `sine` com glide de 420→300 Hz (180 ms) e depois 380→280 Hz (220 ms). AM por um `sine` de 28 Hz, com profundidade de 0,5, via gain modulado. Passa por um `bandpass` de 600 Hz (Q 1,5) | 0,5 s |
| `CASH_REGISTER` | (1) "Cha": ruído → `bandpass` 3 kHz, d 60 ms. (2) "Ching": 3 osciladores `triangle` em 1568, 2093 e 2637 Hz, com a 2 ms e d 600 ms, peaks 0,3/0,2/0,15, iniciando 50 ms depois | 0,7 s |
| `CRASH` | Ruído → `lowpass` com sweep de 2 kHz→200 Hz em 600 ms, peak 0,8. Mais `sine` com queda de 80→30 Hz (impacto), d 400 ms | 0,7 s |
| `UI_CLICK` | `triangle` 1200 Hz, d 30 ms, peak 0,15 | 30 ms |
| `UI_HOVER` | `sine` 1800 Hz, d 15 ms, peak 0,05 | 15 ms |
| `ALERT` | `square` alternando 660/990 Hz a cada 120 ms, 4 vezes, peak 0,2 | 0,5 s |
| `TAKEOFF` | Ruído → `bandpass` com sweep de 300→1200 Hz em 2,5 s, mais `sawtooth` com rampa de 60→140 Hz | 2,5 s |
| `RIFT_OPEN` | 4 `sine` em acorde aumentado (C5, E5, G#5, C6), detune ±15 cents, com LFO de vibrato de 6 Hz e reverb simples (3 `delay` de 70, 110 e 170 ms com feedback 0,3) | 1,5 s |
| `LEVEL_UP` | Arpejo `triangle` C5-E5-G5-C6, 80 ms cada | 0,4 s |
| `COLLECT` | `sine` com glide de 1200→2400 Hz em 120 ms | 0,12 s |
| `DENIED` | `square` 180 Hz, dois pulsos de 80 ms | 0,25 s |
| `STAGE_DONE` | `sine` 880 Hz e depois 1320 Hz, 60 ms cada | 0,15 s |
| `GRADE` | `triangle` 660 Hz × `pitch`, a 2 ms, d 90 ms, peak 0,22, mais `sine` uma oitava acima, peak 0,08 | 0,1 s |
| `GRADE_MISS` | `sine` com queda de 220→140 Hz em 120 ms, peak 0,2 (som surdo) | 0,12 s |
| `GUST_CUT` | ruído em passa-banda subindo de 1,6 para 4,2 kHz em 140 ms (o vento rasgado) e um `triangle` que sobe de 880 para 1760 Hz | 0,2 s |
| `GUST_HIT` | ruído em passa-baixa descendo de 900 para 250 Hz em 300 ms (um sopro grave) | 0,32 s |
| `TURN_OK` | ruído em passa-banda subindo de 0,8 para 3 kHz em 250 ms (o ar varrido na inclinação) e dois `triangle`, 660 e 990 Hz (uma quinta acima), a 40 e 120 ms | 0,28 s |
| `MOTOR` (loop) | Multirrotor: `sawtooth` (frequência = 80 + 6·v Hz) → `lowpass` 1,2 kHz, gain 0,08, mais ruído → `bandpass` 400 Hz com gain 0,04. Asa fixa: `sawtooth` (50 + 3·v Hz). Atlas: sem motor, mas um "bater de asas" (ruído em pulsos de 40 ms a cada 250 ms, com frequência de pulsos ∝ v) | contínuo |
| `WIND` (loop) | Ruído → `lowpass` 500 Hz, com gain proporcional ao |vento| (0..0,15) | contínuo |
| `PROCESSING` (loop) | Fan noise: ruído → `lowpass` 300 Hz, gain 0,05 × speedFactor^0,3. Mais "bips" de disco aleatórios a cada 0,3–0,8 s | contínuo |

---

## 4. Integração com o jogo

| Evento | Som |
| :--- | :--- |
| Foto disparada (automática ou manual) | `SHUTTER` |
| Sensor LiDAR ativo | `LIDAR_HUM` (iniciar/parar ao alternar) |
| Alerta RTH ativo | `RTH_BEEP` a cada 1,5 s |
| Clique em Atlas no poleiro / decolagem com Atlas / evento "Atlas encontra milho" | `PIGEON_COO` |
| Pagamento creditado no relatório / venda | `CASH_REGISTER` |
| Colisão / queda | `CRASH` |
| Botões e foco | `UI_CLICK` / `UI_HOVER` |
| Compra negada / transição inválida | `DENIED` |
| Subir de nível | `LEVEL_UP` |
| Anel coletado (R01) / marco geodésico encontrado | `COLLECT` |
| Entrar na aba Fendas / abrir briefing de fenda | `RIFT_OPEN` |
| Etapa do pipeline concluída | `STAGE_DONE` |
| Amostra do voo com nota Perfeita ou Boa ([survey-flight §5.21](../features/survey-flight.md)) | `GRADE`, com `pitch = 2^(g/12)`, onde `g` é o grau atual da escala pentatônica maior (0, 2, 4, 7, 9, 12, 14…): cada Perfeita seguida sobe um grau (até o 12º), a Boa repete o grau |
| Amostra do voo com nota Fraca ou Rejeitada | `GRADE_MISS`, e a sequência volta ao grau 0 |
| Rajada chega cortada pelo contragolpe / sem ele ([ADR-034](../decisions.md)) | `GUST_CUT` / `GUST_HIT` |
| Boletim da linha: passada aceita / recusada | `STAGE_DONE` / `DENIED` |
| Manobra da troca de faixa no tempo / cedo, tarde ou do lado errado ([ADR-035](../decisions.md)) | `TURN_OK` / `GRADE_MISS` |

---

## 5. Testes

- Mock mínimo de `AudioContext` com `createOscillator`, `createGain`, `createBiquadFilter`, `createBufferSource`, `createBuffer`, `createDynamicsCompressor` e `createDelay` que registra as chamadas.
- **Casos:**
  1. Nenhum contexto criado antes de `unlock()`.
  2. `play('SHUTTER')` cria ≥ 2 fontes e um filtro highpass.
  3. O limite de 60 ms do obturador.
  4. `setVolumes(0,5, 1, false)` resulta em `gainMaster.gain.value === 0,25`.
  5. `muted` zera o master.
- **Sound board** (`?debug=1&screen=SOUNDBOARD`): um botão por `SfxId` e um toggle por `LoopId`.
