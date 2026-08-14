# Truck Studio — análise de desempenho e usabilidade (2026-08-12)

**ISTO É UMA ANÁLISE, NÃO UM REGISTRO.** O `ARCHITECTURE.md` ao lado é o
registro do que existe; este arquivo é o levantamento do que *poderia* melhorar,
com as medidas que sustentam cada afirmação e o risco de cada mexida. Onde eu
não medi, está escrito "estimado".

> ## ⚠️ PARTE DISTO JÁ FOI FEITA — leia `OTIMIZACAO-2026-08-13.md` primeiro
>
> Uma passagem em 2026-08-13 implementou a Fase 1 (o laço sob demanda) e uma
> variante medida da Fase 3 (texturas). **Onde os dois documentos discordarem, o
> de 13/08 vale** — ele mediu, este estimou. O que mudou de status:
>
> * **§2.1 — FEITO.** `ON_DEMAND_RENDERING = true`. A 4ª lacuna
>   (`ui/paint-panel.ts`) foi fechada, e apareceu uma QUINTA coisa que este
>   documento não previu: o reflexo do piso era um gancho de `onFrame`, ou seja
>   uma segunda renderização completa da cena rodando também em quadro pulado.
>   Sem mover esse gancho, ligar a flag não teria economizado nada no Estúdio.
>   Medido na placa: 405 M triângulos/s → 0 com a cena parada.
> * **§2.2, "normal maps JPG → WebP, trivial" — ERRADO, e a medição está no
>   doc novo.** O dano de croma já está gravado no JPEG; transcodificar não o
>   desfaz. Lossless triplica o download, com perdas soma uma segunda geração.
> * **§2.2/§3.5, redimensionar os conjuntos de chão — NÃO CEDE.** Passados por
>   um portão de erro medido, os dezesseis mapas estão no tamanho certo.
>   Empacotar AO+rugosidade num ORM também não fecha (lossless +12 MB de
>   download; com perdas o AO da grama erra 4 %). Para o chão sobra KTX2.
> * **§2.3 — parcialmente FEITO por outro caminho.** Não houve fusão nem
>   decimação. A medição achou algo melhor: **1 302 das 2 157 primitivas do
>   implemento têm carga Draco byte a byte IDÊNTICA**. Deduplicadas no arquivo
>   (−8,8 MB de download, geometria intocada). Compartilhá-las em tempo de
>   execução é o maior ganho ainda na mesa e tem um perigo com nome — ver §4 do
>   doc novo.
> * **§1.2 — os números caíram.** O acervo saiu de 2 034 para 1 744 MB de VRAM;
>   a cena de referência, de ~972 para ~857 MB.
> * **§3 (perfil adaptativo), §3.6 (LOD), §4.1 (perda de contexto) — CONTINUAM
>   ABERTOS** e continuam válidos como escritos.

O pedido que originou o documento: *"ache pontos para aumentar a performance e
usabilidade… no meu PC, que é bom, não está ruim, então manteria uma qualidade
melhor, mas caso o PC do usuário seja mais básico, se adaptar"*. Ou seja: o alvo
não é "deixar mais rápido", é **manter o teto onde ele está e criar um piso**.
Tudo abaixo é lido sob essa regra.

---

## 0. Método

O que foi medido, e como:

* **Geometria e texturas dos `.glb`** — leitura direta do chunk JSON de cada
  arquivo (contagem de primitivas, acessores de índice, `EXT_mesh_gpu_instancing`,
  e o cabeçalho de cada imagem embutida para extrair formato e dimensão). Isso é
  medida de arquivo, não de runtime: é exata para triângulos, contagem de
  primitivas e resolução de textura.
* **VRAM** — *estimada* a partir das dimensões, pela conta padrão
  `w · h · 4 bytes · 1,333` (RGBA8 + pirâmide de mipmaps). É a mesma conta que o
  cabeçalho de `scene/set.ts` já usa ("~22 MB de VRAM cada com mipmaps" para um
  2048²), então os dois números concordam.
* **Cobertura de `invalidate()`** — varredura de todos os 44 módulos do engine
  cruzada com os pontos de mutação de estado visível.
* **Custos de quadro** — reaproveitados das medições que o próprio código já
  registra (o reflexo do piso, o passe de sombra, o pool de spots). **Não** rodei
  a bancada com GPU: `tools/studio-bench` sobe SwiftShader por padrão, e um fps
  de renderização por software não responde nenhuma pergunta deste documento.

---

## 1. O retrato: quanto custa uma cena hoje

Cena de referência — a mais comum: **`distrito-industrial` + Volvo FH 2021 4x2 +
implemento**.

### 1.1 Geometria e chamadas de desenho

| fonte | triângulos | primitivas | nós | materiais |
|---|---:|---:|---:|---:|
| `trailer.glb` | **5 310 000** | **2 157** | 5 852 | 38 |
| `set.glb` (distrito) | 2 530 000¹ | 100 | 120 | 30 |
| cavalo (FH 2021 4x2) | 320 000 | 85 | 85 | 85 |
| Thermo King + rodas | ~10 000 | 13 | 7 | 11 |
| **total** | **≈ 8,2 M** | **≈ 2 355** | — | — |

¹ 0,25 M de geometria multiplicada por `EXT_mesh_gpu_instancing` — a vegetação.
Instanciada, custa ~15 chamadas, não 2 500.

Isso confirma, medindo o arquivo, o número que o cabeçalho de `scene/scene.ts`
já anotava de observação: *"~2200-2900 draw calls e ~9-10 M triângulos"*.

**O implemento é 92 % das chamadas de desenho da cena.** E a distribuição dele é
o achado:

```
material                            primitivas   triângulos
inox-ferragem                            1 154    1 559 976
metal-preto                                583    1 107 714
Faixa-3M                                    76          912
Cor_padrao_branco(metalBranco)              63       45 548
plastico-preto                              43      589 273
… (mais 33 materiais)                      238    2 006 800
                                    ──────────   ──────────
TOTAL                                    2 157    5 310 223
```

Três leituras, todas acionáveis:

1. **2 157 primitivas em 38 materiais.** A razão é 57:1. Nenhuma API de gráficos
   precisa de 1 154 chamadas para desenhar um material só.
2. **Zero reuso de geometria.** Varri as assinaturas de acessor de todas as
   2 157 primitivas: **2 157 únicas, 0 repetidas**. Não há uma única instância no
   arquivo — apesar de 483 malhas se chamarem
   `stitch_result_stitch_all_parafusos_*`, ou seja, o mesmo parafuso repetido
   quase quinhentas vezes, cada uma com a própria cópia de vértices.
3. **1 068 das 2 151 malhas somam 5 % dos triângulos.** Metade das chamadas de
   desenho do implemento entrega um vigésimo da imagem. (Mediana: 684 tri/malha.)

`vehicle/material-setup.ts` já mediu o subconjunto vizinho — 640 malhas abaixo de
5 cm, 788 k triângulos — e o usa para tirá-las do **passe de sombra**. A mesma
medida serve para tirá-las da **cena** quando a câmera está longe; ver §3.6.

### 1.2 Memória de vídeo — o número que decide se o PC básico roda

Estimativa por asset (RGBA8 + mips):

| asset | imagens | VRAM est. | observação |
|---|---:|---:|---|
| `/textures/` (chão compartilhado) | 16 | **358 MB** | 4 conjuntos × 4 mapas, **todos 2048²** |
| `trailer.glb` | 33 | **251 MB** | inclui uma 4096² e 20 WebP *lossless* 1024² |
| `set.glb` (distrito) | 36 | **144 MB** | |
| cavalo FH 2021 4x2 | 92 | 77 MB | |
| par de HDRs (dia + noite) | 2 | 34 MB | 2048×1024 HalfFloat |
| PMREM + alvo de mistura do céu | — | ~47 MB | |
| mapa de sombra 3072² | — | 38 MB | o próprio código anota 37,7 MB |
| **soma da cena de referência** | | **≈ 950 MB** | |

Trocando o cavalo, piora:

| cavalo | imagens | VRAM est. | por quê |
|---|---:|---:|---|
| `volvo_fh16_2012_6x4a` | 91 | **159 MB** | duas 2048² **em PNG cru** dentro do glb |
| `iveco_sway_metallica` | 88 | **220 MB** | **88 imagens PNG**, duas delas 4096² — nunca passou pelo passo WebP do pipeline |
| `daf_xg_2021_4x2` | 92 | 58 MB | |
| `scania_r_2016_4x2` | 74 | 40 MB | |

Com o Metallica em cena a sessão chega a **≈ 1,1 GB de VRAM**.

**Por que este é o item nº 1 para o "PC básico".** Uma GPU integrada típica
(Iris Xe, Vega 8) não tem 1 GB dedicado: ela empresta da RAM do sistema. Num
notebook de 8 GB, 1 GB de texturas mais o resto do navegador põe o driver a
paginar — e a paginação de textura não aparece como "20 fps", aparece como
engasgo de meio segundo a cada movimento de câmera, ou como perda de contexto
(§4.1). Nenhum ajuste de resolução de render conserta isso; só menos bytes de
textura conserta.

> **A §6 do `ARCHITECTURE.md` caducou neste ponto.** Ela dispensa KTX2 com o
> argumento de que *"os sets viajam sem textura, então a pressão de memória de
> GPU que justificava KTX2 nunca chegou"*. Era verdade em 2026-08-03. Hoje o
> `set.glb` do distrito traz **36 imagens** e o implemento traz **251 MB**. A
> premissa mudou; a conclusão precisa ser reexaminada. Ver §3.1.

### 1.3 Rede — o primeiro boot

| item | bytes |
|---|---:|
| `set.glb` distrito | 18,0 MB |
| `sky.hdr` + `sky-night.hdr` | 9,7 MB (baixados **em paralelo, os dois, antes da cortina subir**) |
| `trailer.glb` | 30,0 MB |
| cavalo (FH 2021 4x2) | 10,4 MB |
| 16 mapas de chão | ~22 MB |
| Thermo King, rodas, manifestos, thumbs | ~3 MB |
| **primeiro boot** | **≈ 93 MB** |

`core/prefetch.ts` já cobre a maior parte disso com aquecimento especulativo
durante os cinco passos do seletor, e é um desenho correto. O que sobra são os
itens da §5 (lixo servido e assets superdimensionados).

### 1.4 O laço

* `ON_DEMAND_RENDERING = false` — **o laço redesenha 60×/s uma cena que, parada,
  é idêntica quadro a quadro.** Ver §2.1: esta é a maior economia disponível e
  ela está a uma linha de distância.
* Sombra: `autoUpdate = false`, redesenhada só quando suja. Correto e já feito.
* Matrizes congeladas em `models.ts` + `scene.matrixAutoUpdate = false`. Correto
  e já feito.
* Luzes: 1 direcional com sombra 3072² PCF (17 amostras), 1 direcional de recorte,
  1 hemisférica, e **um pool de 14 `SpotLight` à noite** (8 postes + 2 faróis +
  2 lanternas de cauda + 2 do cavalo iluminando o baú), sem sombra.
  `NUM_SPOT_LIGHTS` é binário 0↔14.
* Reflexo planar do piso: só no cenário Estúdio, segunda passada completa da
  cena, `SCALE 0,5`, MSAA 4×. **Custo medido pelo próprio código: 14,1 fps.**

---

## 2. Desempenho — achados, do maior ganho para o menor

### 2.1 O laço sob demanda está pronto e desligado — e falta **uma** lacuna

`scene/scene.ts:364` mantém `ON_DEMAND_RENDERING = false` e o comentário acima
explica por quê: três mutações do engine não passam por `invalidate()` e, com a
flag ligada, apareceriam como controles quebrados.

**Fui conferir as três. As três estão fechadas:**

| lacuna listada em 2026-08-?? | estado hoje |
|---|---|
| 1. `vehicle/livery.ts` — as três `CanvasTexture` do fabric | **fechada** — `livery.ts:924` chama `invalidate(3)` no `after:render` |
| 2. `vehicle/models.ts` `setPaintTarget()` | **fechada** — `models.ts:1189` |
| 3. `studio.ts` `applyChoice()` caminho só-cor (`runColor`) | **fechada** — `studio.ts` `applyColor()` termina em `invalidate()`, e o comentário diz explicitamente "aqui e não em `runColor()` porque os DOIS caminhos passam por esta função" |

Ou seja: **as três condições que a flag esperava foram satisfeitas e ninguém
voltou para virar a flag.**

**Mas há uma quarta, não listada, e ela é real.** Varri os 44 módulos:

```
ui/paint-panel.ts  →  paint.setPaint({ [f.key]: v })   ← NÃO invalida
```

`vehicle/paint.ts` é, por desenho, um **sumidouro de dependência**: importa `three`
e nada mais (o cabeçalho de `scene.ts` explica que inverter essa aresta fecharia
um ciclo e daria `ReferenceError` no boot). Portanto ele **não pode** chamar
`invalidate()`, e o painel "Ajustar a tinta" não o faz por ele. Com a flag ligada,
arrastar qualquer controle do painel de tinta muda os uniformes e **não muda a
tela**.

O conserto é de uma linha, no lugar certo: `ui/paint-panel.ts` importa
`invalidate` de `scene/scene.ts` (a UI já importa da cena em toda parte — o
`hud.ts` faz isso) e chama depois de cada `setPaint()`. Isso preserva o
sumidouro.

Os demais caminhos estão cobertos: o HUD escreve por `setLightParams` /
`setHourOfDay` / `setStudioParams` / `applyPreset`, todos terminando em
`applyRig()`, que invalida; o painel de acabamentos escreve por `trim.setTrim()`,
que invalida em `trim.ts:385`; `chrome.ts` escreve `controls.autoRotate`, que
`wantsFrame()` **lê** em vez de receber empurrado.

**Ganho:** numa cena parada — que é o estado em que o estúdio passa a maior parte
do tempo, porque o usuário está olhando — a GPU sai de 60 quadros/s para 0.
Aproximadamente **95 % do trabalho de GPU do estado ocioso**, pelo cálculo do
próprio comentário. Num notebook, isso é a diferença entre ventoinha ligada e
bateria durando.

**Risco:** médio, e mitigável. A defesa já está construída — `invalidate()` marca
3 quadros, não 1, e `wantsFrame()` centraliza tudo que é contínuo. O caminho
seguro é: fechar a 4ª lacuna, ligar via
`__studio.lighting.setOnDemandRendering(true)` (o afordance de console já existe),
exercitar a matriz de controles, e só então trocar a constante.

---

### 2.2 Texturas: 358 MB de chão para desenhar quatro superfícies

`/public/textures/` tem 16 arquivos, **todos 2048²**:

```
asphalt / concrete / grass / gravel   ×   diff, rough, normal, ao
```

* 4 dos 16 são **JPG** (os normal maps) e pesam 1,3–3,3 MB cada — `grass_nor.jpg`
  sozinho é 3,3 MB. Um normal map em JPG é a pior combinação possível: o
  subamostramento de croma do JPEG destrói exatamente o canal que carrega
  metade da normal.
* VRAM: **358 MB**, para texturas de chão que a câmera vê quase sempre em ângulo
  rasante e a mais de 10 m.
* Já há uma otimização inteligente no lugar (a base cacheada + clones por
  `repeat`, documentada em `set.ts`), então o problema não é duplicação — é
  resolução bruta.

**Três degraus de conserto, em ordem de esforço:**

| passo | VRAM | download | esforço |
|---|---:|---:|---|
| hoje | 358 MB | 22 MB | — |
| normal maps JPG → WebP/PNG 2048² | 358 MB | ~14 MB | trivial, e conserta o artefato de croma |
| variante 1024² para o nível Médio/Baixo | **89 MB** | ~6 MB | um script + um sufixo no manifesto |
| **KTX2/Basis (UASTC para normal, ETC1S para o resto)** | **≈ 45–90 MB** | ~8 MB | `KTX2Loader` + transcoder em `/vendor/` |

O KTX2 é o único que ganha **nos dois eixos ao mesmo tempo** e é o único que
resolve o problema de verdade, porque a textura fica comprimida *na GPU*, não só
no fio. O padrão de vendorização já existe e é conhecido pela casa:
`/vendor/draco/` já é servido assim (`config/assets.ts` → `dracoDecoderDir`).

**Fazer o mesmo para os veículos** é o segundo maior ganho:

* `trailer.glb` → 251 MB de VRAM, com **uma 4096²** e 20 WebP *lossless* 1024².
  Lossless é a escolha certa para o pipeline (a §6 documenta que ela preserva
  pixel a pixel), mas ela não muda a VRAM em nada — descomprime igual.
* `iveco_sway_metallica.glb` → **88 imagens PNG**, duas 4096². Este arquivo nunca
  passou pelo passo `webp` da receita da §6: 21,6 MB no fio e 220 MB na GPU.
  É o único do acervo assim.
* `volvo_fh16_2012_6x4a.glb` → duas **2048² em PNG cru** dentro de um arquivo que
  no resto é WebP. Passagem incompleta do pipeline.

> **Armadilha já documentada, e ela vale aqui:** `gltf-transform resize`
> reencoda **todas** as texturas do arquivo em WebP com perdas, normal maps
> inclusive. Para reduzir uma textura, a §6 do `ARCHITECTURE.md` manda escrever
> um script com `@gltf-transform/core` + `sharp` que troque só aquela imagem.
> Vale integralmente para qualquer passo de KTX2 que se faça.

---

### 2.3 O implemento: 2 157 chamadas de desenho para 38 materiais

Três frentes, com riscos muito diferentes.

**(a) Fusão por material do que é provadamente estático — ganho grande, risco
médio.**

`trailer-assembly.ts` já sabe, e documenta com medidas, o que ele **nunca
transforma**: o chassi, a rodagem, os para-lamas e a parafusaria sob o piso —
`Metal-preto` (924 k vértices), `paralamas` (299 k) e rodagem (992 k) são
literalmente puladas pelo filtro de altura. Fundir esse subconjunto em uma malha
por material, **depois da montagem**, derruba centenas de chamadas sem tocar em
nada paramétrico.

*O que a fusão não pode atropelar, e cada um tem dono no código:*
* `applyTrailerFinish()` despacha por **nome de material** — a fusão preserva o
  material, então isto sobrevive;
* `vehicle/trim.ts` casa **por material onde há material próprio e por NÓ onde
  não há** — fundir apaga nós, então a lista de nós de `trim` tem de ser
  reavaliada;
* `vehicle/lights.ts` resolve cor **por fragmento, a partir da posição de
  mundo** (§12.1 do `ARCHITECTURE.md`) — a fusão preserva posição de mundo, então
  isto sobrevive de graça, e é justamente porque a decisão já desceu para o
  fragmento que a fusão virou possível;
* `seethrough.ts` clona o material **por malha** para dar um número por objeto —
  fundir *reduz* o número de clones, o que é bom, mas muda a granularidade do
  veredito (não é problema: o chassi nunca é atravessado, ele está sob o
  veículo);
* `extractDoorKit()` guarda **a referência** e tem de rodar antes
  (`buildTrailerRig()`) — já é uma armadilha registrada.

*Trava de bancada obrigatória:* comparar o render antes/depois pixel a pixel nas
mesmas poses. Uma fusão que muda a imagem é uma fusão errada.

**(b) Instanciação da parafusaria — ganho médio, risco baixo, trabalho offline.**

483 malhas chamadas `stitch_result_stitch_all_parafusos_*` com **zero
compartilhamento de geometria**. Vale medir quantas são de fato idênticas a menos
de transformada; as que forem viram um `InstancedMesh` (ou um `dedup` offline com
`--materials false`, que já é a receita da casa). Isto é conserto de **asset**, não
de código — o caminho mais seguro dos três.

**(c) Decimação seletiva — ganho médio, risco baixo, trabalho offline.**

* `pneu-corpo`: **748 720 triângulos em 14 primitivas = 53 k tri por pneu.** Num
  quadro de 1080p onde um pneu ocupa ~20 k pixels, isso é ~2,7 triângulos por
  pixel. Um `simplify --ratio 0.3` nos pneus devolve ~500 k triângulos sem
  diferença visível em nenhuma distância que a órbita permite
  (`setVehicleFocus()` prende a lente a ~2,9 m no mínimo).
* `inox-ferragem`: 1,56 M tri. Vale um levantamento do que ali é rebite e
  parafuso.

> **Armadilha registrada:** `gltf-transform quantize` é **proibido** neste acervo
> (grade de cena inteira num bake cuja caixa local tem milhares de unidades). A
> grade **por primitiva** do Draco é o que torna 16/12/14 seguro. Qualquer passo
> novo de otimização de malha tem de respeitar isso.

---

### 2.4 A resolução de render é o botão dominante, e hoje é uma constante

```ts
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // scene.ts:246 e resize()
```

O custo de preenchimento escala com o **quadrado** do fator. Num monitor 4K a
DPR 2, isso são 33 M de pixels por quadro; num 1080p a DPR 1, 2 M. Um fator de
16× entre duas máquinas, decidido por uma constante.

Este é o botão certo para adaptação **contínua** (não por degraus), porque:
* é o único que não muda nenhum `#define` — trocá-lo não recompila nada;
* pode mudar por quadro;
* e é onde está o gargalo à noite, quando 14 spotlights são avaliadas por
  fragmento.

O que ele **não** resolve é o gargalo de dia, que é geometria (2 355 chamadas).
Por isso a adaptação precisa de um medidor, e não de uma tabela cega — ver §3.

---

### 2.5 O passe de sombra

`3072²` sobre `±24 m` (ou `±60 m` no passo largo), `PCFShadowMap` (17 amostras),
redesenhado só quando sujo. O raciocínio por trás de cada número está registrado
e é sólido — **não mexer no teto**. O que cabe é o piso:

| nível | mapSize | tipo | texels/m a ±24 m |
|---|---:|---|---:|
| Alta (hoje) | 3072 | PCF (17 amostras) | 64,0 |
| Média | 2048 | PCF | 42,7 |
| Baixa | 1024 | **Basic** (1 amostra) | 21,3 |

`mapSize` é realocação de alvo — barata e trocável a qualquer momento.
`shadowMap.type` é `#define`: **recompila toda a cena**, então só no boot ou sob
cortina. Ver a divisão quente/frio da §3.3.

---

### 2.6 Luzes: 14 spotlights avaliadas por fragmento à noite

O pool cresceu 8 → 12 → 14 ao longo das últimas rodadas, e cada crescimento tem
justificativa registrada. Mas o efeito acumulado é: **à noite, cada fragmento de
cada material da cena avalia 14 cones de luz**, mais a direcional com sombra, mais
a de recorte, mais a hemisférica.

Numa GPU integrada a 1080p com o caminhão ocupando 30 % da tela, isso é o item que
faz a noite render metade do dia.

`NUM_SPOT_LIGHTS` é chave de cache de programa, então **isto não é adaptável em
runtime** — é um `#define`. A saída é escolher o tamanho do pool **uma vez, no
boot**, pelo perfil:

| nível | pool | o que fica de fora |
|---|---:|---|
| Alta | 14 | — |
| Média | 8 | os 2 do cavalo→baú e 2 dos 8 postes |
| Baixa | 4 | só faróis + a cauda; os postes ficam com o **vidro aceso**, que é geometria emissiva e não custa luz |

O último detalhe é o que salva o nível Baixo visualmente: `lamps.ts` já separa
"o refletor" do "vidro aceso", e o vidro dá a fileira de pontos alaranjados
descendo a rua sem uma única luz. A noite continua legível.

---

### 2.7 O reflexo do piso — 14,1 fps, e não tem botão na interface

Só no cenário Estúdio, e o custo está medido no próprio arquivo. Hoje
`setFloorReflection()` e `setFloorReflectionScale()` são exportados **apenas para
o console e para a bancada**.

O cenário Estúdio é justamente o que existe para **julgar cor** — e é o cenário
em que um PC fraco mais quer o botão. Duas coisas: entrar no perfil (Baixa
desliga; Média baixa `SCALE` de 0,5 → 0,35 e tira o MSAA 4×) **e** ganhar um
controle na face de Estúdio do HUD, ao lado de fundo/preenchimento/recorte, que é
onde ele pertence.

---

### 2.8 O shader de tinta

Já está bem otimizado — o Voronoi é de 8 células e não de 27, e o comentário
explica por quê. O que sobra:

* **Casca de laranja (`uPeel`)**: 4 avaliações de `pPeelHeight`, cada uma com
  2 `pNoise`. É o trecho mais caro do shader e o efeito mais sutil dos três a
  qualquer distância acima de ~2 m. Candidato natural a `uPeel = 0` no nível
  Baixo — e ele já é um uniforme, então é trocável sem recompilar.
* As duas oitavas de floco (`cA`/`cB`) podem virar uma no nível Baixo, ao custo
  de perder o antialiasing por LOD. Mais arriscado visualmente que o item
  anterior; deixaria para depois.

---

## 3. A proposta central: um **perfil de qualidade** adaptativo

### 3.1 A regra que governa tudo

> **O perfil só mexe em AMOSTRAGEM. Nunca em decisão visual autorada.**

Resolução de render, anisotropia, resolução de sombra, número de amostras,
densidade de vegetação, LOD — sim. Cor, exposição, tonemap, preset, ângulo de
luz, arranjo de cenário, o que é pintável, onde a arte cai — **jamais**.

O teste prático: **uma captura tirada no nível Baixo tem de sair com o mesmo
enquadramento e a mesma luz da tirada no Alto, só mais serrilhada.** Se sair com
outra cor, o perfil passou de sua alçada.

Corolário: **a captura (`capture.ts`) e a gravação (`record.ts`) rodam sempre no
teto.** A captura já renderiza fora do laço, em ladrilhos, com a cortina no ar —
o preço não é pago no arrasto do usuário. Um PC fraco pode ter uma vista 3D
suave e ainda assim baixar a mesma imagem que o PC bom baixa; só demora mais para
gerá-la. Isso é o oposto de um sistema que degrada o produto.

### 3.2 Como detectar — três eixos, nenhum suficiente sozinho

**(a) Estático, antes do primeiro quadro** — o que dá para saber sem medir:

| sinal | onde | o que diz |
|---|---|---|
| `renderer.capabilities.maxTextureSize`, `maxSamples`, `getMaxAnisotropy()` | three | teto real do adaptador |
| `WEBGL_debug_renderer_info` → `UNMASKED_RENDERER_WEBGL` | GL | a string do adaptador (`"Intel(R) UHD Graphics"`) |
| `navigator.hardwareConcurrency`, `navigator.deviceMemory` | Chromium | classe de máquina |
| `navigator.connection.saveData` / `effectiveType` | Chromium | **já usado por `core/prefetch.ts` — reusar, não duplicar** |
| `devicePixelRatio × tamanho do holder` | DOM | **os pixels a preencher, que importam mais que a GPU** |
| `matchMedia('(pointer: coarse)')` | CSS | toque ⇒ provável móvel |

⚠️ **`UNMASKED_RENDERER_WEBGL` é mascarado no Firefox por privacidade** e pode
sumir do Chromium a qualquer versão. **Ausência tem de significar "desconhecido",
nunca "fraco"** — senão o Firefox inteiro cai no nível Baixo em máquinas boas, que
é exatamente o defeito que este sistema existe para não ter.

**(b) Dinâmico — e é o único juiz honesto.**

Média móvel exponencial do tempo de quadro, janela de ~2 s, **contada só em
quadros DESENHADOS** (com o laço sujo ligado, um quadro pulado é 0 ms e mentiria
descaradamente). O laço já calcula `dt`; `getRenderStats()` já lê `renderer.info`.
Falta só o acumulador.

Regras que impedem oscilação, e todas são necessárias:
* histerese larga — sobe de nível com < 13 ms sustentados por 4 s; desce com
  > 28 ms sustentados por 2 s;
* no máximo **um degrau por 10 s**;
* **nunca adapta durante uma gravação** (`framePins > 0`), durante um tween de
  preset (`tweenT < 1`) ou nos 3 s seguintes a uma troca de veículo/cenário — os
  três são picos conhecidos, e adaptar em cima de um pico conhecido é aprender a
  coisa errada;
* teto de descidas por sessão, para o caso patológico.

**(c) A escolha do usuário, que ganha dos dois** — ver §3.4.

### 3.3 Os degraus, divididos por **custo de troca**

Esta divisão é o que torna a adaptação automática segura por construção.

**QUENTES — trocáveis a qualquer momento, sem recompilar nada:**

| controle | Alta | Média | Baixa | onde |
|---|---|---|---|---|
| escala de render | `min(dpr, 2)` | `min(dpr, 1.5)` | `1.0` (contínuo 0,6–1,0) | `scene.ts:246`, `resize()` |
| `key.shadow.mapSize` | 3072 | 2048 | 1024 | `SHADOW_MAP_SIZE` |
| passo largo de sombra | ±60 m | ±60 m | desligado | `tuneShadowSpan()` |
| anisotropia (veículo) | 8 | 4 | 1 | `TEXTURE_ANISOTROPY` |
| anisotropia (albedo do chão) | máx. do device | 8 | 2 | `set.ts:219` |
| reflexo do piso | `SCALE 0,5` + MSAA 4 | `0,35`, sem MSAA | desligado | `floor-reflection.ts` |
| casca de laranja | ligada | ligada | `uPeel = 0` | `paint.ts` |
| vegetação | 530 | ~300 | ~150 | `scenery.ts` |
| LOD do implemento | tudo | tudo | oculta as < 5 cm além de N m | novo (§3.6) |

**FRIOS — mudam `#define` ou parâmetro de construtor. Só no boot, ou sob
cortina:**

| controle | por quê |
|---|---|
| `antialias` | **parâmetro de construtor**, e o renderer nasce no *tempo de import* de `scene.ts` |
| `NUM_SPOT_LIGHTS` (14 / 8 / 4) | chave de cache de programa — recompila a cena inteira |
| `shadowMap.type` (PCF / Basic) | `#define` |

⚠️ **O adaptador automático só mexe nos QUENTES.** Nenhuma adaptação automática
pode causar um engasgo de recompilação — que seria precisamente o defeito que ela
existe para evitar. Trocar um controle frio é um ato do usuário, e ele passa pela
pílula ou pela cortina, que é o mecanismo honesto e **já existe** (`claimPill`,
`warmLightPrograms()`).

⚠️ **`antialias` tem uma restrição arquitetural real.** `new WebGLRenderer()` roda
no escopo de módulo de `scene.ts` — o cabeçalho diz isso na primeira linha. Para
decidir `antialias` pelo perfil, ou o perfil é resolvido **antes** desse import
(um módulo folha, lido por `scene.ts` no topo, que só faz a sondagem estática e
lê o `localStorage`), ou o renderer sai do escopo de módulo — e isso é uma
refatoração grande num arquivo que documenta em detalhe por que ele é assim.
**Recomendo o módulo folha.** Também é razoável simplesmente manter o MSAA sempre
ligado e usar só a escala de render: o DPR é a alavanca dominante e o MSAA num
buffer menor é barato.

### 3.4 A parte de usabilidade, que não é opcional

**Adaptação silenciosa é um defeito.** O próprio código já rejeitou essa forma em
`warnIfUnpaintable()`: *"um usuário informado é um bug relatado, um usuário calado
é um bug perdido"*. Vale igual aqui — um usuário cuja imagem piorou sozinha e que
não sabe por quê vai relatar "o estúdio está borrado", que é um bug impossível de
diagnosticar.

Então:
* um seletor de **quatro posições** no HUD: **Automático · Alta · Média · Baixa**;
* quando em Automático, o rótulo mostra onde ele está: `Automático · média`;
* **persistido** (mesma chave e mesmo padrão de `truckstudio.hud.v1`);
* a escolha manual **congela** o adaptador — quem escolheu Alta num PC fraco
  escolheu ver 20 fps, e isso é um direito.

### 3.5 O nível de textura precisa de trabalho offline

É o único degrau que não é uma linha de código, e é o de maior impacto para o PC
básico (§1.2). Duas variantes por conjunto de chão (`2k` e `1k`), servidas pelo
manifesto conforme o perfil; e o KTX2 por cima, quando houver fôlego. Sem isso, o
nível Baixo continua carregando 950 MB de VRAM — ele só desenha esses 950 MB mais
rápido.

### 3.6 LOD do implemento — o degrau mais barato de todos

`vehicle/material-setup.ts` **já mede** o diâmetro em espaço de mundo de cada
malha para decidir quem projeta sombra, e já sabe que 640 malhas ficam abaixo de
5 cm carregando 788 k triângulos. A mesma medida, guardada em `userData`, dá um
LOD de graça:

```
distância da câmera > N metros   ⇒   .visible = false nas malhas < 5 cm
```

Sem geometria nova, sem asset novo, sem `THREE.LOD`, reaproveitando uma medida
que já é paga na carga. Um parafuso de 3 cm a 15 m de distância ocupa menos de um
pixel; sumir com ele é literalmente invisível. **≈ 640 chamadas de desenho e
0,79 M triângulos** removidos da vista distante — que é justamente a vista em que
o cenário inteiro está em quadro e o quadro é mais caro.

---

## 4. Usabilidade

### 4.1 ⚠️ Não há tratamento de perda de contexto WebGL — e este é o item mais grave

Varri o engine: **zero** `webglcontextlost`, **zero** `webglcontextrestored`.

Com ~950 MB de VRAM numa GPU integrada, perda de contexto **não é teórica**: ela
acontece em suspensão/retomada do notebook, em reset de driver, em troca de GPU
(dual-GPU alternando), e quando o navegador decide recuperar memória. Hoje o
sintoma é **uma tela preta congelada, sem uma palavra**, e o usuário não tem nem
como saber que precisa recarregar.

Isto é justamente o cenário "PC mais básico" do pedido, e nenhum ajuste de
qualidade o cobre.

O mínimo honesto:
1. `preventDefault()` no `webglcontextlost` (sem isso, o contexto nunca é
   restaurado);
2. cortina com texto próprio — *"a placa de vídeo reiniciou; recarregando a
   cena…"*;
3. no `webglcontextrestored`, reconstruir a partir da escolha salva.

O ponto 3 é o mais barato dos três: **a máquina já existe.** `releasedChoice` +
`RELEASE_MS` já fazem exatamente "solte a cena, guarde a escolha, reconstrua sob
a cortina quando voltar". A recuperação de contexto é o mesmo caminho, disparado
por outro evento.

### 4.2 Não há sonda de WebGL2 — e a falha acontece no tempo de import

`new WebGLRenderer()` roda no escopo de módulo de `scene.ts`. Numa máquina sem
WebGL2 (three r163+ é WebGL2-only) ou com aceleração de hardware desligada, isso
**lança durante o `import()` dinâmico da rota** — e o que o usuário vê é a tela de
erro genérica do app, sem relação com a causa.

Dez linhas antes do import (`canvas.getContext('webgl2')` num canvas descartável)
permitem uma tela própria: *"Este navegador está sem aceleração 3D. Ative a
aceleração por hardware nas configurações, ou abra em outro navegador."* — o que
é acionável, ao contrário do que aparece hoje.

### 4.3 A vista 3D não tem atalho de teclado nenhum

O editor de plotagem tem o conjunto completo — setas com nudge, `Delete`,
`Ctrl+[`/`]` para ordem, `Esc`, e um botão `?` que os lista. A vista 3D tem
**zero**: enquadrar, girar, esconder interface, tela cheia, capturar — todos só
por clique, e todos com um alvo pequeno no canto superior direito.

Sugestão, no mesmo padrão que o editor já estabeleceu (`F` enquadrar, `R` girar,
`H` esconder interface, `Esc` sair de tela cheia, `?` a lista). Custo baixo,
ganho diário.

### 4.4 O usuário não sabe quanto vai baixar

O passo 1 (cenário) e o passo 3 (modelo) determinam entre 30 e 95 MB de
download. O `prefetch` já lê `navigator.connection.saveData` e se desliga — o que
é correto —, mas **o usuário não é avisado de nada**, nem do tamanho nem do fato
de o aquecimento ter sido desligado.

Um `≈ 28 MB` discreto no card de cenário e um aviso quando `saveData` está ligado.
A informação já existe: os pesos de `makeProgress()` são justamente uma estimativa
relativa dos mesmos números.

### 4.5 O reflexo do piso não tem interruptor

Ver §2.7. É o único item da lista que é ao mesmo tempo um achado de desempenho e
um de usabilidade.

### 4.6 "Enquadrar" não tem volta

`frameAll()` sobrescreve a pose sem guardar a anterior. Um clique acidental em
`#btn-reset` custa o enquadramento que o usuário levou meio minuto compondo. Um
desfazer de **um** nível (guardar posição + mira antes de sobrescrever, e um
segundo clique no mesmo botão dentro de N segundos volta) resolve sem interface
nova.

### 4.7 Itens menores

* **`prefers-reduced-motion` no 3D**: a cortina já respeita (`loader.ts:236`). O
  giro de apresentação é sempre iniciado pelo usuário, então está correto como
  está; sobra só o crossfade de 0,8 s dos presets, que poderia encurtar. Menor.
* **`distrito-industrial/thumb.webp` = 332 KB** contra 24 KB dos outros dois
  cards. É 14× mais pesada que suas irmãs e é uma das primeiras imagens que o
  usuário vê. Reexportar nas dimensões das outras (640×360).

---

## 5. Higiene de assets — ~35 MB de lixo no diretório servido

| arquivo | tamanho | situação |
|---|---:|---|
| `environments/distrito-industrial/set.glb.bak-2026-08-10-servidor` | 17 MB | backup, servido publicamente |
| `environments/distrito-industrial/set2.glb` | 7,1 MB | não referenciado pelo manifesto |
| `environments/porto-miami/` | 5,4 MB | cenário **não está** em `environments.json` (só um `manifest-block.json` solto) |
| `environments/rodovia/sky.hdr` | 5,5 MB | **agora órfão** — ver abaixo |

**O `sky.hdr` do distrito FOI re-assado.** A §3 do `ARCHITECTURE.md` — descrita lá
como *"o único item vivo deste documento"* — diz que `distrito-industrial` aponta
para `environments/rodovia/sky.hdr` e que a pasta `rodovia/` não pode ser apagada.
Medido no manifesto de hoje:

```
distrito-industrial | hdri: environments/distrito-industrial/sky.hdr
                    | hdriNight: environments/distrito-industrial/sky-night.hdr
```

O caso está **fechado** e `environments/rodovia/` pode ser apagada. A §3 precisa
ser reescrita.

**Outras duas frases desatualizadas encontradas no caminho**, ambas na direção
de subestimar o custo atual:

* **§5, "Orçamento — batido com folga"**: diz `7,36 MB` para o `set.glb` do
  distrito. Medido: **17,22 MB**. Ainda dentro do alvo de 35 MB, mas 2,3× o que o
  documento comemora.
* **§2, "os sets saem do Blender sem textura"**: o `set.glb` do distrito traz
  **36 imagens / 3,02 MB / ~144 MB de VRAM**. Continua verdade para o *chão*
  (que vem dos conjuntos compartilhados), deixou de ser verdade para o arquivo.

---

## 6. Roteiro sugerido

Ordenado por **ganho ÷ risco**, não por tema.

### Fase 1 — barato, isolado, sem risco visual
1. Fechar a 4ª lacuna de `invalidate()` (`ui/paint-panel.ts`) — 1 linha.
2. Ligar `ON_DEMAND_RENDERING` atrás do afordance de console, exercitar, e só
   então trocar a constante. **Maior ganho de estado ocioso do documento.**
3. Tratamento de perda de contexto WebGL + sonda de WebGL2 (§4.1, §4.2).
4. Apagar os ~35 MB de lixo servido e reexportar a thumb do distrito.
5. Corrigir as três frases desatualizadas do `ARCHITECTURE.md` (§5 acima).

### Fase 2 — o perfil de qualidade, só com os controles QUENTES
6. Módulo folha `core/quality.ts`: sondagem estática + `localStorage` + o
   contrato de níveis. **Importado por `scene.ts` no topo**, para poder responder
   antes do `new WebGLRenderer()`.
7. Medidor de tempo de quadro no laço, com as travas anti-oscilação da §3.2(b).
8. Aplicar aos quentes: escala de render, `mapSize`, anisotropia, reflexo do
   piso, `uPeel`, densidade de vegetação.
9. O seletor de 4 posições no HUD, com o rótulo do nível corrente.

### Fase 3 — trabalho offline de asset (o que resolve o PC básico de verdade)
10. Normal maps de chão saindo do JPG.
11. Variantes 1k dos conjuntos de chão + o campo no manifesto.
12. Passar `iveco_sway_metallica.glb` e as duas PNG do `volvo_fh16_2012_6x4a` pelo
    passo WebP que o resto do acervo já tem.
13. Decidir sobre KTX2 (`KTX2Loader` + transcoder em `/vendor/`, no mesmo padrão
    do Draco). É a decisão de maior impacto do documento inteiro para VRAM.
14. Decimação dos pneus e dedup/instanciação da parafusaria.

### Fase 4 — o que precisa de bancada dedicada antes de existir
15. LOD do implemento pela medida que `setShadowCasters()` já faz (§3.6).
16. Fusão por material do subconjunto estático do implemento (§2.3a), com trava
    de comparação pixel a pixel.
17. Controles FRIOS no seletor de qualidade (`NUM_SPOT_LIGHTS`, `shadowMap.type`,
    `antialias`), sob cortina.

### Fase 5 — usabilidade
18. Atalhos de teclado da vista 3D + `?`.
19. Estimativa de download nos cards e aviso de `saveData`.
20. Desfazer de um nível no "enquadrar".

---

## 7. O que este documento **recomenda não fazer**

Achados que parecem oportunidade e são armadilha — três já estão registrados no
código, e repito aqui para que uma rodada de otimização não os atropele:

| tentação | por que não |
|---|---|
| `logarithmicDepthBuffer: true` | Desabilita **silenciosamente** o polygon offset da GPU, e este estúdio depende de `polygonOffset` em todo decalque que ele desenha. Já foi medido e revertido. |
| `gltf-transform quantize` | Grade de **cena inteira** num bake cuja caixa local tem milhares de unidades. Só a grade **por primitiva** do Draco é segura aqui. |
| `gltf-transform dedup` sem `--materials false` | Funde materiais byte-idênticos com nomes diferentes, e `applyTrailerFinish()` despacha **pelo nome**. Desfaz correções documentadas sem avisar. |
| `gltf-transform resize` para reduzir uma textura | Reencoda **todas** as texturas do arquivo em WebP com perdas, normal maps inclusive. |
| `PCFSoftShadowMap` | **Ignora `shadow.radius`** — foi medido: varrer a difusão de 0,15 a 6 mudava a luminância em 0,0. É o motivo de o tipo atual ser `PCFShadowMap`. |
| Rodar o reflexo do piso em quadros alternados | Já foi tentado. *"Não está um blur smooth, está meio que tremido"* — um reflexo não pode atrasar um quadro em relação ao que ele espelha. |
| Degradar a **captura** junto com a vista | Ela roda fora do laço, em ladrilhos, sob a cortina. O preço não é pago no arrasto, e a imagem baixada é o produto. |
| Adaptar qualidade durante gravação ou tween | São picos conhecidos. Adaptar em cima de um pico conhecido é aprender a coisa errada. |
| Tratar ausência de `UNMASKED_RENDERER_WEBGL` como "GPU fraca" | O Firefox mascara por privacidade. Ausência = desconhecido. |
