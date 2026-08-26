# PASSAGEM — trazer o sobrechassi para a régua do semirreboque

> ## ⚠️ FECHADO EM 2026-08-20 — LEIA A §29 DO `ARCHITECTURE.md` ANTES DESTE ARQUIVO
>
> As cinco pendências da terceira leva foram medidas e corrigidas. **Três dos
> diagnósticos escritos abaixo estavam ERRADOS**, e é por isso que este aviso
> existe em vez de o arquivo ser apagado — quem vier atrás precisa saber onde a
> pista era falsa:
>
> | seção | o que ela dizia | o que a medida disse |
> | --- | --- | --- |
> | **A** (engate) | *"elas continuam sendo cascas conexas distintas"* | `componentesConexas()` devolve **1**: o `stitch_all` soldou. Separa-se por REGIÃO, com a cota do metal do doador. |
> | **B** (rebite) | *"0,1 mm de diferença, que não explica o que ele vê"* | `RIB_FLAT_CENTER` está **33,4 mm** fora, e o referencial soma **+20 mm** no semirreboque e **−1 mm** no sobrechassi. Os dois erros se cancelavam num só implemento. |
> | **C** (caninhos) | *"o candidato é a família `lanterna-lateral-chassis`"* | Não é: são **sete tubos de 20 × 20 × 2 946 mm** de `metal-pouco-polido` embutidos na parede. A lanterna é peça legítima e FICA. |
> | **D** (trilho) | *"a §26.5 mediu 3,5 mm"* | Medido de novo nos dois com o mesmo instrumento: **2,9 mm**. O contrato é `RAIL_PROUD > PLATE_T`. |
> | **E** (fitas) | *"o próximo passo é tirar o delta do censo"* | Certo, e faltava metade: eram **duas réguas** (flanco e face) e **dois cantos** — as oito do canto traseiro nunca eram tocadas. |
>
> O instrumento novo é `tools/trailer-bench/medir-0820.mjs` (~20 s por
> implemento, com modo foto e varredura de raios). O portão no app é
> `tools/studio-bench/checks-referencial-0820.mjs`.
>
> **O que continua em aberto está na §29.9 do `ARCHITECTURE.md`.**

**Estado: histórico. Escrito em 2026-08-19, fim da sessão.**

**A regra que organiza tudo:** *"tudo está correto no semirreboque, então você
tem uma referência"* — Kennedy. O semirreboque
(`semirreboque_frigorifico_paleteiro.glb`) é o PADRÃO OURO. Toda decisão desta
frente é "medir no semirreboque e reproduzir no sobrechassi", nunca "escolher um
número que pareça bom".

Contexto anterior: `ARCHITECTURE.md` §24 (o bake do sobrechassi), §25 (os dois
rígidos), §26 (a porta virou asset), **§27 e §28 (esta frente)**.

---

## 1. O MÉTODO — leia isto antes de qualquer coisa

Nada aqui se resolve lendo código. O que resolve é **medir as duas peças e
comparar por cota**. A ferramenta é:

```bash
node tools/studio-bench/bench.mjs --gpu --geometry \
     --checks checks-sobrechassi-0819.mjs > /tmp/censo.txt
```

Ela despeja, no app de verdade, **malha a malha: nome do nó + material +
triângulos + caixa no referencial da raiz**, para o semirreboque E para o
sobrechassi (2 274 e 1 094 linhas). O JSON sai em duas linhas `CENSO-*` do
relatório; extraia com:

```python
import re, json
txt = open('/tmp/censo.txt', encoding='utf-8', errors='replace').read()
m = re.search(r'^  =    CENSO-sobrechassi → (.*)$', txt, re.M)
d = json.loads(json.loads(m.group(1)))     # {'implemento':…, 'malhas':[…]}
```

Cada linha é `{n: nó, p: pai, m: material, t: triângulos, v: visível, b: [x0,y0,z0,x1,y1,z1]}`.

**A comparação é por COTA, não por nome** — o export do sobrechassi perdeu os
nomes, mas a geometria é a mesma em milímetros.

### As outras sondas desta frente

| arquivo | responde |
| --- | --- |
| `tools/studio-bench/checks-perfil-0819.mjs` | o perfil CRU do friso, faixa de 0,5 mm, e onde as calotas caem |
| `tools/studio-bench/checks-emenda-0819.mjs` | z de cada dobra de emenda e de cada coluna de rebite, no referencial do implemento |
| `tools/studio-bench/checks-friso-0819.mjs` | fases lisas medidas × previstas + varredura de raios da saia |
| `tools/studio-bench/checks-scan-0819.mjs` | varredura de raios genérica (mapa ASCII do que aparece numa janela) |
| `tools/studio-bench/checks-verifica-0819.mjs` | portão das oito correções (⚠️ ficou LENTO; ver §6) |
| `node tools/trailer-bench/shoot-impl.mjs <glb>` | sobe SÓ o `TrailerBody` + as correções de bake e fotografa — **rápido**, sem trocar chassi |

⚠️ ~~`shoot-impl.mjs` não chama `markShared()`~~ — **CONSERTADO em 2026-08-20**:
`implprobe.ts` passou a chamá-la antes das correções, como `buildTrailerRig()`
faz, e o relatório traz `geometriaCompartilhada`. A armadilha era real (o trilho
de piso saía com 280 mm em vez de 210, porque os dois flancos são o mesmo molde
e a edição de vértice rodava duas vezes); agora dá para tirar cota de vértice
dali.

---

## 2. O QUE FOI PEDIDO — os 16 pontos, na ordem em que chegaram

### Primeira leva (19:47–19:50)

1. **Posicionamento do implemento sobre o chassi do truck** — a carroceria
   nascia metros atrás da cabine. ✅ FEITO (§27.6)
2. **Thermo King: posição + peças flutuando.** ✅ FEITO (§27.5) — mas ver 14
3. **Suporte do varão: tem parte preta de plástico.** ✅ FEITO (§27.2)
4. **Textura do batente (manípulo da porta traseira) errada.** ✅ FEITO (§27.3)
5. **Peça que prende a porta na lateral tem parte preta.** ⚠️ PARCIAL — ver A
6. **Os "caninhos" abaixo do frame metálico devem ser removidos.** ❌ ABERTO — ver C
7. **Mangueiras traseiras: deve ficar uma; registro laranja.** ✅ FEITO
8. **Rebite fora de posição.** ⚠️ PARCIAL — ver B

### Segunda leva (21:09–21:15)

9. **A peça do engate ficou TODA preta; ela tem uma parte metálica.** ⚠️ ver A
10. **Frame metálico inferior ainda errado.** ❌ ABERTO — ver D
11. **Rebite: na parte ELEVADA do friso, não na lisa; e não na parte remontada.**
    ⚠️ PARCIAL — ver B
12. **O vão entre cabine e carroceria, nos 3 chassis.** ✅ FEITO (§28.4)
13. **Faixa refletiva vertical: no centro do frame entre a lateral e a frente;
    na traseira, no frame vertical da lateral.** ❌ ABERTO — ver E
14. **Centralizar o Thermo King no vão que existe para ele.** ✅ FEITO (§28.3)
15. *"analise melhor como é no semirreboque"* — a régua.
16. **O MACHO da traseira também tem parte preta de plástico.** ⚠️ ver A

### Terceira leva (fim da sessão) — **o que continua quebrado**

> "os rebites estão melhores mas ainda não 100% centralizados na parte lisa dos
> frisos, as peças que prendem a traseira na lateral estão completamente pretas
> mas o centro são metálicos e no semirreboque tem isso, o frame metálico
> inferior está errado, com a parte branca sobrepondo ele em partes, as faixas
> refletivas da lateral continuam mal posicionadas, os caninhos que ficam abaixo
> do frame metálico continuam lá, **são 2 em uma lateral, 3 em outra e 2 na
> frente**"

---

## 3. O QUE FOI FEITO — onde está cada coisa

### 3.1 `tools/implement-bake/graft-materials.mjs` (NOVO)

**A causa-raiz de metade dos defeitos:** o `stitch_all` do export fundiu seis
materiais em `metal-pouco-polido`. `materialize.mjs` (§24) não podia recuperar —
ele lê o NOME DA MALHA, e o nome já vinha fundido.

A ferramenta copia o material REAL do doador (`semirreboque_…_paleteiro.glb`),
com textura, e reatribui as primitivas do alvo por **assinatura de tamanho**.

```bash
node tools/implement-bake/graft-materials.mjs --dry           # relata
node tools/implement-bake/graft-materials.mjs                 # aplica
node tools/implement-bake/graft-materials.mjs --only <mat>    # uma linha só
```

Já aplicado ao `.glb` em cena. Backup: `…glb.bak-graft-2026-08-19`.

| enxertado | de | assinatura | instâncias |
| --- | --- | --- | --- |
| `suporte-varao-preto` | `metal-pouco-polido` | 38 × 44 × 41 | 8 |
| `engate-femea-preto` | `metal-pouco-polido` | 17 × 79 × 57 | 3 |
| `engate-macho-preto` | `metal-pouco-polido` | 54 × 149 × 12 | 3 |
| `cano-ar-preto` | `metal-pouco-polido` | 48 × 300 × 48 | 2 |
| `registro-corpo-laranja` | `plastico-preto-polido` | (por nome de nó) | 2 |
| `metal-galvanizado-mantido` | `Cor_padrao_branco` | 26 × 140 × 8 380 | 2 |
| `metal-claro` → `inox-ferragem` | (remapeamento inteiro) | — | 3 primitivas |

**GOTCHAs da ferramenta**
- A cota do ACESSOR **não é** a da bancada: o rip está em cm e o nó
  `stitch_result_stitch_all` gira 180° em torno de (1,0,1)/√2, o que **troca X e
  Z**. Ela transforma os 8 cantos pela cadeia de nós antes de comparar.
- As instâncias **não compartilham orientação** — a comparação é com as cotas
  **ORDENADAS**.
- O portão é a contagem de **INSTÂNCIAS**, e ela **recusa a gravação inteira**
  se não bater.
- **NÃO é idempotente**: numa segunda passada as primitivas já não têm o
  material de origem e a contagem reprova. Use `--only` ou volte o backup.

### 3.2 Código do engine

| onde | o quê |
| --- | --- |
| `models.ts` `placeTrailer()` | mede a caixa em `bboxInFrame(t, t, bodyPanelPred(t))` — antes lia `state.trailerBox`, que podia ser do implemento ANTERIOR (3,2 m de erro com o log dizendo "150 mm") |
| `mounting.ts` `solveRigidMount()` | recebe `centerX`; devolvia `x = 0` e jogava fora o centramento |
| `mounting.ts` `measureCabRearWall()` | NOVO — a parede da cabine por histograma de ÁREA virada para −Z |
| `models.ts` `attachThermoKing()` | lê `mount: { yawDeg, z }` do `*_meta.json` |
| `models.ts` `placeThermoKing()` | encosta o PLANO DE MONTAGEM (não `bbox.min.z`) e centra a CARCAÇA no VÃO |
| `models.ts` `measureTkRecess()` | NOVO — o recorte da testeira, por duas travessas de 1,25 m |
| `models.ts` `measureValeRows()` | fase da fileira = `RIB_FLAT_CENTER − pitch/2`; calota em `crest`; escalar 0,58 → 0,29 |
| `trailer-bake-fixes.ts` `fixLowFrameRail()` | NOVO — sobe o topo do trilho e o traz à frente da pele |
| `trailer-bake-fixes.ts` `removeExtraRearHose()` | NOVO |
| `trailer-bake-fixes.ts` `splitFusedBlackCap()` | NOVO — separa a ferragem de duas cores por COMPONENTE CONEXA |
| `trailer-bake-fixes.ts` `fixCornerTape()` | ganhou a centragem em Z no montante |
| `implements.json` | `lowFrameRail`, `singleRearHose` |
| `thermoking_p360_meta.json` | bloco `mount` |

---

## 4. O QUE CONTINUA QUEBRADO — com diagnóstico e próximo passo

### A. As peças do engate saem TODAS pretas (pedidos 5, 9, 16)

**O que o semirreboque tem** (medido):

```
fêmea (no flanco, z −6,44)   mesh_826    16 × 79 × 38   metal-pouco-polido   ← o CENTRO metálico
                             mesh_826_1  17 × 79 × 57   engate-femea-preto   ← a capa preta
macho (na porta, z −7,48)    mesh_1841   39 × 150 × 10  metal-pouco-polido
                             mesh_1841_1 54 × 65 × 12   engate-macho-preto
```

**O que o sobrechassi tem:** UMA malha por peça, com a cota da UNIÃO
(17 × 79 × 57 e 54 × 149 × 12). O `stitch_all` fundiu as duas.

**O que foi feito:** `splitFusedBlackCap()` em `trailer-bake-fixes.ts` — acha as
COMPONENTES CONEXAS da geometria (elas eram objetos distintos, então continuam
cascas distintas), compara a caixa de cada uma com a cota da capa e devolve
`material` em array com dois grupos de índice. Chamado por
`splitEngateHardware()` em `loadTrailer()`, **depois** de
`splitTrailerHardware()`.

**Por que ainda sai preto — as três hipóteses, em ordem de probabilidade:**

1. **A malha não tem duas componentes conexas.** Se o `stitch_all` SOLDOU os
   vértices, não há o que separar. `componentesConexas()` devolve 1 e a função
   sai calada (`if (comps.length < 2) continue;`).
   **Como confirmar:** rode a bancada e procure no console
   `[bake] ferragem de duas cores dividida — N malha(s)`. Se a linha não
   aparecer, é isto.
   **Se for isto**, a saída é geométrica: dividir por REGIÃO em vez de
   topologia. Para o MACHO é fácil — a capa preta é os 65 mm de cima dos 149
   (`y ≥ box.max.y − 0,065`). Para a FÊMEA a capa envolve o corpo em z
   (57 contra 38, mesmo y), então o corte é `|z − centro| > 19 mm` → capa.
2. **A ordem.** `splitEngateHardware()` roda depois de `splitTrailerHardware()`,
   que reescreve `mesh.material` como VALOR ÚNICO. Se alguma coisa depois disso
   reescrever de novo (`applyTrailerFinish`, `setPaintTarget`, `applyTrim`), o
   array vira valor único e a peça volta a ter uma cor só.
   **Como confirmar:** `mesh.material` é array no fim de `loadTrailer()`?
3. **A fusão por material** (`vehicle/merge.ts`) engole malhas com material em
   array de um jeito que perde o segundo grupo.

**Verificação mínima:** um check que ache as malhas por cota e imprima
`Array.isArray(mesh.material)` e `geometry.groups.length`.

### B. O rebite ainda não 100% centrado na parte lisa (pedidos 8, 11)

**O que já foi medido e é fato:**

- O perfil tem **31 mm de plano recuado (a 5,3 mm da crista) e 22 mm de crista
  chata** — perfil cru em `checks-perfil-0819.mjs`:
  ```
  fase  0…8 mm    5,3 mm sob a crista     ┐ plano recuado (31 mm)
  fase  9…31 mm   0…2 mm (arco, pico 19,9) ← CRISTA CHATA (22 mm)
  fase 31…62 mm   5,3 mm sob a crista     ┘
  ```
- `RIB_FLAT_CENTER = 46,7 mm` aponta para o meio do **plano recuado**.
- O olho lê a **crista** como "parte lisa" — foi o que a foto do dono provou
  (calota 26,9 mm = meio passo acima do centro da faixa uniforme).
- **A correção aplicada:** `rowPhase = RIB_FLAT_CENTER − pitch/2` = **20,05 mm**.

**O que sobra:** o dono diz "melhores mas ainda não 100% centralizados". O
centro medido da crista é **20,15 mm** (média de 8,9 e 31,4). Estamos em
20,05 — 0,1 mm de diferença, que **não explica** o que ele vê. Então uma das
duas:

1. **A fase real da crista não é 20,15.** O perfil foi amostrado em UMA janela
   (`z −3…−2`, `y row0+10·pitch … +12·pitch`). Repita em três janelas ao longo do
   flanco e nos DOIS lados; se a fase variar, a grade (`row0`) é que está torta.
2. **`row0 = floorY + skirtHeight` não é a origem da grade que o rebuild
   ladrilha.** Compare com `valeInfo.row0` (foram iguais no semirreboque —
   confira no sobrechassi).

**Próximo passo concreto:** rodar `checks-perfil-0819.mjs` no **sobrechassi**
(hoje ele só roda no que estiver carregado, que é o semirreboque) e comparar
`platô.centro` com `rowPhase`. Um `checks-perfil` que aceite `?impl=` resolve.

⚠️ **`RIB_FLAT_CENTER` não deve mudar** — é a régua da ferragem da porta
traseira (`raiseDoorCatches`), aprovada em foto em 2026-08-12. O que muda é
`rowPhase`, local a `measureValeRows()`.

⚠️ `RIVET_FROM_SEAM = 0.012` (sobre a aba do remonte). Foi a zero por engano no
meio da sessão e voltou — a frase do dono era *"não estão na parte remontada"*,
ou seja o deslocamento tem de EXISTIR.

### C. Os "caninhos" — **a pista definitiva chegou no fim**

> *"são 2 em uma lateral, 3 em outra e 2 na frente"* — sete peças, **assimétrico**.

Isso é uma assinatura forte e ainda não foi cruzada com o censo. O candidato
mais próximo no sobrechassi é:

```
metal-preto  d=(0.017, 0.045, 0.110)  n=8   {frente:2, esquerda:2, direita:3, centro:1}
             y −0,021…0,167   (ou seja ABAIXO/na borda do pé do trilho)
```

— que é o **corpo das lanternas laterais de chassi**
(`lanterna-lateral-chassis(corpo)/(leds)/(vidro)`, dez ao todo, em
z −4,11 · −1,37 · 0 · 1,37 · 4,11). A distribuição 2/2/3 bate com "2 na frente,
2 numa lateral, 3 na outra" quase exatamente.

**Mas cuidado:** lanterna de chassi é peça legítima. Antes de remover,
**confirme com o dono se é isso** ou faça a prova visual: esconda essa família
(`o.visible = false` para `/^lanterna-lateral-chassis/`) e fotografe o mesmo
enquadramento das fotos dele (19-49-42 e 21-09-46).

Medidas já feitas que ajudam:
- As barras aparecem em **y ≈ 1,12…1,25** no semirreboque (≈ 130 mm de altura,
  ~45 mm de largura), sobre a faixa preta do chassi.
- A varredura de raios daquela faixa devolve `metal-preto` de ponta a ponta —
  ou seja, o que se vê é uma FACE do esqueleto preto pegando o céu
  (`metalness: 1`), e não necessariamente uma peça a mais.
- No sobrechassi há um deles visível em
  `tools/trailer-bench/shots-implemento/rel-base-meio.png` (a haste branca sob o
  trilho) — dá para tirar o z dele invertendo o enquadramento de `__shotRel`.

### D. O frame metálico inferior — **a parte branca sobrepõe em partes**

**Isso é diagnóstico fechado, e a correção é de uma linha.**

`fixLowFrameRail()` empurra o trilho para `skin + RAIL_PROUD`, com
`RAIL_PROUD = 0,0005` (0,5 mm), medido no semirreboque. Só que no semirreboque
a pele **não tem remonte por cima** naquele ponto, e no sobrechassi tem:
`applyPlateLap()` desloca a chapa de livery para fora em até
**`PLATE_T` = 2,2 mm**, e isso acontece DEPOIS de `fixLowFrameRail()`
(`buildLiveryPanels()` roda após `buildTrailerRig()`).

Resultado: nas chapas que estão no alto do degrau, a pele fica **1,7 mm à frente
do trilho** — e é exatamente "a parte branca sobrepondo ele em partes".

**Correção:** `RAIL_PROUD` tem de ser maior que `PLATE_T`. A §26.5 mediu no
semirreboque que o trilho **sobressai 3,5 mm da pele** — use isso:

```ts
const RAIL_PROUD = 0.0035;   // e não 0.0005
```

Confira também que `skinDe()` está medindo a pele com o remonte incluído; se
`SIDE_L/SIDE_R` ainda não existirem quando `fixLowFrameRail()` roda (não
existem — os painéis de livery nascem depois), ela mede `TRAILER_BODY`, que é o
plano SEM remonte. Os 3,5 mm cobrem os 2,2 do remonte com folga.

**O que já está certo e não deve ser mexido** (medido nos dois):

| | pé (do piso) | topo (do piso) | espessura |
| --- | --- | --- | --- |
| semirreboque | −82,5 mm | +127,5 mm | 26 mm |
| sobrechassi (depois da correção) | −82,5 mm | +127,5 mm | 26 mm |

**O que ainda difere e talvez seja o resto da queixa:** a SEÇÃO. O perfil do
semirreboque tem um degrau a meia altura que o do sobrechassi não tem — visível
no A/B em `tools/trailer-bench/comparacao-0819/AB-trilho.png` (semirreboque em
cima). Isso é geometria que o bake não traz; forjá-la é inventar peça, então
precisa de decisão do dono antes.

### E. As faixas refletivas verticais continuam mal posicionadas

O que foi feito: `fixCornerTape()` reancora em Y (§26.5) e agora centra em Z no
montante de canto mais próximo (§28.5), quando ele está a menos de 300 mm.

**O que ainda falta medir** — e é o que o pedido 13 diz por extenso:

> *"deveria ficar no centro do frame metálico entre a lateral e a frente, e a da
> traseira no frame vertical da lateral"*

São DUAS regras diferentes, uma por extremidade, e a implementação de hoje
aplica UMA (o montante mais próximo). Além disso há **duas fitas por canto** — a
da face de flanco (chata em X) e a da face dianteira/traseira (chata em Z) — e
só a primeira é movida.

**Medidas de referência no semirreboque** (todas já no censo):
```
montante de canto        metal-estrutura-principal-padrao
                         73 × 2 850 × 70 mm, |x| 1,267, z ±4,21 (sobrechassi)
fita de flanco           50 mm em z, 300 mm em y
fita da face             50 mm em x, 300 mm em y
semirreboque, topo       y 4,141 = teto − 28 mm
semirreboque, base       y 1,340 = piso − 52 mm
semirreboque, DOBRA      36 mm em dx E 36 em dz  ← o sobrechassi NÃO tem
```

**Próximo passo:** tirar do censo do SEMIRREBOQUE a posição em z de cada uma das
quatro fitas verticais em relação ao montante correspondente, e reproduzir esse
delta. Não invente centro — meça o delta.

---

## 5. Como VERIFICAR (o ciclo que funciona)

1. **Rápido, sem trocar chassi** (aparência do implemento + log das correções):
   ```bash
   node tools/trailer-bench/shoot-impl.mjs sobrechassi_frigorifico_gancheiro.glb
   node tools/trailer-bench/shoot-impl.mjs semirreboque_frigorifico_paleteiro.glb
   ```
   Saem 13 PNG em `tools/trailer-bench/shots-implemento/` — as vistas `rel-*`
   são **ancoradas na caixa do baú em coordenadas normalizadas**, então o mesmo
   nome fotografa o MESMO lugar nos dois implementos. É assim que se faz o A/B.
   ⚠️ Ele sobrescreve a pasta: copie o primeiro conjunto antes de rodar o
   segundo.
2. **Completo, com chassi** (montagem, Thermo King, materiais em cena):
   ```bash
   node tools/studio-bench/bench.mjs --gpu --geometry \
        --checks checks-verifica-0819.mjs > /tmp/v.txt
   ```
3. `./node_modules/.bin/tsc -b` e
   `./node_modules/.bin/vitest run src/pages/tools/truck-studio`
   (82 testes; os 7 que falham em `navigation-context` e `catalog-resolves` são
   pré-existentes e de outra frente).

⚠️ **A bancada com `--geometry` trava passando de ~10 min** quando encadeia
várias trocas de chassi (o Scania P tem 2,9 M triângulos). `checks-verifica-0819`
faz cinco trocas e não terminou. **Quebre em corridas de uma troca só.**

⚠️ Mate o Chromium órfão depois: `pkill -9 -f chrome-headless-shell`.

---

## 6. Fatos medidos que a próxima sessão não precisa remedir

```
PELE (sobrechassi)         direita |x| 1,3101   esquerda |x| 1,2985   (assimétrica!)
PISO do baú                y 0,249  (pé da chapa frisada, depois do enxerto)
TETO                       y 2,989
PASSO DO FRISO             53,4 mm · relevo 5,3 mm
PERFIL DO FRISO            31 mm de plano recuado + 22 mm de crista chata
                           crista centrada na fase 20,15 mm da grade
TRILHO DE PISO (os dois)   pé piso −82,5 mm · topo piso +127,5 mm · 26 mm de chapa
FITA 3M BAIXA (os dois)    piso −52…−2 mm
MONTANTE DE CANTO          73 × 2 850 × 70 mm, |x| 1,267, z ±4,21
VÃO DA TESTEIRA (TK)       1,25 × 0,37 m, centro (0,005 · 2,674)
                           entre travessas em y 2,462…2,490 e 2,858…2,886
TK PEQUENO                 fundo em +Z (0,881 m² de face) · plano de montagem z 0,201
                           657 mm para fora · 255 mm para dentro do baú
MANGUEIRAS                 |x| 1,11 · y −0,800…0,030 · z −4,17…−3,84
ENGATE FÊMEA               |x| 1,31 · y 0,409…0,488 · z −3,21…−3,16 (2) e z +2,33 (1)
ENGATE MACHO               |x| 0,22 · y 0,389…0,538 · z −4,26
VARÃO (2, não 4)           |x| 0,111/0,127 · y 0,441…2,921
COLAR DO VARÃO             38 × 44 × 41 mm · 4 na cena (8 no arquivo)
MANÍPULO DA PORTA          247×124×42 + 271×110×37 + 134×58×35, |x| 0,07…0,38, y 0,587…0,711
VOLVO VM 6x2               frameTopY 1,189 · cabRearZ (manifesto) 1,033
                           ⚠️ a PAREDE está ~200 mm à frente disso — ver measureCabRearWall()
```

---

## 7. Arquivos tocados nesta sessão (tudo UNCOMMITTED)

```
NOVOS
  tools/implement-bake/graft-materials.mjs
  tools/studio-bench/checks-sobrechassi-0819.mjs      (o CENSO — a ferramenta principal)
  tools/studio-bench/checks-perfil-0819.mjs
  tools/studio-bench/checks-emenda-0819.mjs
  tools/studio-bench/checks-friso-0819.mjs
  tools/studio-bench/checks-scan-0819.mjs
  tools/studio-bench/checks-verifica-0819.mjs
  tools/trailer-bench/comparacao-0819/                (A/B do trilho)
  tools/trailer-bench/HANDOFF-SOBRECHASSI-2026-08-19.md  (este arquivo)

EDITADOS
  src/pages/tools/truck-studio/ARCHITECTURE.md                        §27 e §28
  src/pages/tools/truck-studio/engine/vehicle/models.ts
  src/pages/tools/truck-studio/engine/vehicle/mounting.ts
  src/pages/tools/truck-studio/engine/vehicle/trailer-bake-fixes.ts
  src/pages/tools/truck-studio/engine/vehicle/trailer-geometry.ts
  src/pages/tools/truck-studio/engine/vehicle/trailer-rig.ts
  src/pages/tools/truck-studio/engine/vehicle/implements.ts
  public/models/vehicles/implements.json
  public/models/vehicles/thermoking_p360_meta.json
  public/models/vehicles/sobrechassi_frigorifico_gancheiro.glb   (ENXERTADO — backup .bak-graft-2026-08-19)
  tools/trailer-bench/implprobe.ts + shoot-impl.mjs              (trilho e mangueira no relatório)
  tools/implement-bake/README.md                                (o passo 3)
```

---

## 8. A ordem sugerida para a próxima sessão (CUMPRIDA — ver o aviso no topo)

1. **D — `RAIL_PROUD = 0.0035`.** Uma linha, diagnóstico fechado, defeito
   visível em toda foto de flanco.
2. **A — o engate.** Rode a bancada e olhe o console: a linha
   `[bake] ferragem de duas cores dividida` aparece? A resposta escolhe entre as
   três hipóteses e as três têm conserto curto.
3. **C — os caninhos.** Esconda `lanterna-lateral-chassis` e fotografe; leve a
   foto ao dono. É a única das oito que ainda depende de confirmação humana.
4. **B — o rebite.** Rodar `checks-perfil-0819.mjs` sobre o SOBRECHASSI e
   comparar a fase da crista com `rowPhase`.
5. **E — as fitas verticais.** Tirar o delta fita↔montante do censo do
   semirreboque e reproduzir, nas quatro fitas e nas duas faces.
