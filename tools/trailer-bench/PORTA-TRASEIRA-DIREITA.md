# Inventário da `#porta-traseira-direita` — a fonte do kit da porta lateral

Lido do `.gltf` COM HIERARQUIA (nó 2927, 87 malhas), com as matrizes aplicadas.
Coordenadas **da porta**, em milímetros:

- `u` ao longo do painel, **a partir da borda da DOBRADIÇA** (x −1,2109)
- `v` altura a partir do pé da folha (y 0,4560)
- `w` para **FORA** (a traseira olha para −Z, então `w = −(z − (−4,2491))`)

Folha: **1200 × 2450 mm**. As duas portas traseiras são imagens ESPELHADAS uma
da outra — a esquerda tem a dobradiça na borda de maior x, a direita na de
menor. Portar a DIREITA para a lateral direita é um giro de −90° em Y
(`x = −z, y = y, z = x`), determinante +1: nenhum espelho, a mão se preserva.

## Lado da dobradiça

| peça | du×dv×dw | n | u | v | w |
|---|---|---|---|---|---|
| tala (dobradiça) `metal-pouco-polido` | 312×92×46 | 4 | 64,2 | 201,9 · 884,0 · 1566,0 · 2248,1 | 25,3 |
| pino da dobradiça `parafusos` | 22×130×22 | 4 | −80,3 | mesmas alturas | 36,8 |
| porca do pino `parafusos` | 25×34×25 | 8 | −80,3 | ±32 de cada altura | 36,8 |
| rebite `parafusos` | 17×17×30 | 16 | 65,2 e 205,2 | ±37,5 de cada altura | −4,9 |

**Passo da dobradiça: 682,05 mm**, primeira a 201,9 mm do pé. (A porta LATERAL
do mesmo modelo usa 687,9 e 143,1 — são conjuntos diferentes.)

## Varão e seus encaixes

| peça | du×dv×dw | n | u | v | w |
|---|---|---|---|---|---|
| varão `metal-pouco-polido` | 25×2480×25 | 1 | 1100,2 | 1224,8 | 24,5 |
| cabeçote de ponta | 83×161×43 | 2 | 1100,2 | 50,5 · 2399,5 | 23,8 |
| **guia do varão (fêmea)** | 100×34×41 | 2 | 1100,2 | 885,0 · 1565,0 | 23,2 |
| suporte da guia | 38×44×41 | 2 | 1100,2 | 885,0 · 1565,0 | 23,0 |
| anel do varão | 36×9×36 | 4 | 1100,3 | 10 · 104 · 2346 · 2440 | 24,6 |
| **macho de ponta (came)** | 75×92×35 | 2 | 1120,4 | −32,7 · 2482,8 | 24,6 |

O macho passa **além da folha** nas duas pontas (v −32,7 e 2482,8): é ele que
entra no encaixe do frame. **Esse encaixe NÃO existe no rip** — nem na traseira
nem na lateral. É peça soldada ao perfil do vão e precisa ser modelada.

## Fecho

| peça | du×dv×dw | n | u | v | w |
|---|---|---|---|---|---|
| batente `borracha-preta` | 42×115×13 | 1 | 823,5 | 193,3 | 35,6 |
| suporte `metal-claro` | 134×58×36 | 1 | 926,3 | 193,3 | 25,5 |
| contra-fecho `metal-claro` | 271×110×37 | 1 | 979,7 | 193,1 | 24,8 |
| manípulo `metal-claro` | 247×124×43 | 1 | 1015,4 | 193,3 | 23,6 |
| alavanca `metal-pouco-polido` | 54×150×12 | 1 | 1010,2 | 7,8 | 6,8 |

Todo o fecho mora a **v ≈ 193 mm** — altura de canela, não de peito.

## O que isto desmente no código atual

`DOOR_PARTS` em `trailer-door.ts` tem SETE famílias e o inventário tem
**catorze**. Duas identificações estão trocadas:

- o `134×58×36` (`metal-claro`), que o código chama de **GUIA** e distribui em
  quatro alturas ao longo do varão, é peça do FECHO, a v 193 mm;
- a guia de verdade é o `100×34×41` a v 885 e 1565 — **duas**, não quatro, e com
  o suporte `38×44×41` no mesmo ponto.

Faltam por inteiro: pino e porca da dobradiça, rebites, cabeçote de ponta, anéis
do varão, batente de borracha e o encaixe soldado ao frame.
