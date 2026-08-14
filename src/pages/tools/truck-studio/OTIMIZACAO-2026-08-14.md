# Truck Studio — o seletor de qualidade que faltava (2026-08-14)

**ISTO É UM REGISTRO DO QUE FOI FEITO.** O levantamento que o originou está em
`ANALISE-PERF-UX-2026-08-12.md`; a passagem anterior, em
`OTIMIZACAO-2026-08-13.md` — e **duas seções daquele documento descrevem um
estado que não existe**, o que está anotado em vermelho no topo dele.

O pedido: *"preciso otimizar ao máximo, perdendo o mínimo de qualidade
possível… mesmo colocando no modo de qualidade baixa, que por sinal não vejo
diferença nenhuma, nem visual, nem de performance"*, depois refinado para *"um
seletor de qualidade real, capaz de fazer rodar até em computadores mais simples
com i5 de 10ª geração com gráfico integrado"*.

---

## 0. O veredito, e por que o relato estava certo

Auditado botão por botão, num monitor a `devicePixelRatio` 1 e fora do cenário
Estúdio, a diferença efetiva entre Alta e Baixa era **um uniforme de shader**:

| botão | Alta → Baixa | efeito real ao girar a câmera |
|---|---|---|
| `pixelRatioCap` | 2 → 1 | **zero.** `min(dpr, cap)` é um TETO; a dpr 1, `min(1,2)` e `min(1,1)` são o mesmo número |
| `shadowMapSize` | 3072 → 1024 | **zero.** `shadowMap.autoUpdate = false` — o passe não roda na órbita. E o bias não era escalado junto |
| `anisotropy` | 8 → 2 | **zero.** Não é reaplicada a textura já carregada |
| `floorReflection` | on → off | só existe no cenário Estúdio |
| `orangePeel` | on → off | um uniforme, e só nos pixels da lataria pintada |

O erro de forma, e ele é o que explica todos os cinco: **o perfil só tinha
botões de AMOSTRAGEM DE PIXEL, e esta cena nunca foi limitada por
preenchimento.** Ela é limitada por chamadas de desenho (~2 400/quadro, das
quais o implemento é 90 %), por ALU de fragmento (~2 800 numa lataria à noite) e
por memória (1 097,9 MB medidos).

> **A lição que governa este documento:** um perfil de qualidade que não pode
> mexer em `#define` nem em parâmetro de construtor não tem como atender uma
> placa integrada. A restrição "só botões quentes" estava certa para o
> ADAPTADOR AUTOMÁTICO e errada para o SELETOR. Agora ela vale só para o
> primeiro.

---

## 1. Três classes de botão, e quem pode tocar em cada uma

| classe | custo de troca | quem pode acionar |
|---|---|---|
| **QUENTE** | nenhum — nem realocação nem recompilação | o medidor automático **e** o usuário |
| **FRIO** | `#define` / chave de cache de programa / parâmetro de construtor → **cortina** | **só o usuário** |
| **ASSET** | exige recarregar a cena e os arquivos | só o usuário, e só se o servidor declarar a variante |

O medidor **nunca** toca em frio. Um engasgo de recompilação disparado sozinho,
no meio de um arrasto, é precisamente o defeito que a adaptação existe para
evitar. Quem clicou em "Baixa", por outro lado, pediu — e paga uma cortina de
dois segundos, que é o mesmo carregamento que ele já vê ao trocar de cenário.

### A tabela

**Quentes**

| botão | Alta | Média | Baixa | o que se perde |
|---|---|---|---|---|
| `renderScale` **(novo)** | 1,00 | 0,80 | 0,65 | 64 % e 42 % dos fragmentos. Imagem mais macia |
| `shadowMapSize` | 3072 | 2048 | 2048 | o Baixo **recupera** sombra — 1024² era perda sem ganho |
| `floorReflection` | `full` | `lod` | `off` | Médio: o reflexo perde o que não sobrevive ao mip lido |
| `orangePeel` | on | **off** | off | ~860 ALU/fragmento pintado; some a micro-ondulação do verniz em close |
| `flakeOctaves` | 2 | 2 | 1 | possível "pop" de granulação numa distância |
| `vegetation` | 1,00 | 0,60 | 0,35 | bosque mais ralo |
| `seeThroughSamples` | 8 | 8 | 4 | nada perceptível — é pré-teste |
| `lodMinPx` | 0 | 1,5 | 3,0 | a 3 px a parafusaria some em plano geral |
| `probeSize` | 256 | 256 | 128 | reflexo local mais grosseiro (já passa por PMREM) |
| `pmremSteps` / `pmremMinMs` | 12/110 | 8/150 | 6/200 | metade dos picos de 10-40 ms no arrasto do relógio |
| `envCacheMax` | 3 | 3 | 2 | volta mais lenta a um cenário já visitado |
| `rainAmount` / `rainRipples` | 1,0/on | 0,7/on | 0,45/off | chuva mais rala, sem anéis de impacto |
| `ceilingSpots` | on | on | off | o teto do Estúdio perde as luminárias decorativas |
| anisotropia (veículo/chão) | 8/16 | 4/8 | 2/2 | rasante mais borrado |

**Frios**

| botão | Alta | Média | Baixa | o que se perde |
|---|---|---|---|---|
| `antialias` | true | true | **true** | nada — ver §3 |
| `spotPool` | 14 | 6 | 0 | Médio: some a poça de luz sob os postes. Baixo: nenhuma luz direta à noite |
| `shadowType` | pcf | pcf | basic | 16 taps a menos. Borda dura, e um dia chuvoso perde a penumbra larga |
| `groundVariant` | — | `@ktx2` | `@ktx2` | (arquivos não existem ainda — inerte) |
| `hdrVariant` | — | — | `@1k` | o fundo de céu amolece; a iluminação não muda |

### A escala é uma FAIXA, não um número

Um nível define uma faixa e um alvo de tempo de quadro; um controlador anda
dentro dela para **segurar** o alvo. É o que separa "mais rápido em média" de
"fluido" — a percepção de travamento vem da VARIÂNCIA, não da média.

| nível | faixa | alvo | por quê |
|---|---|---|---|
| Alta | 0,85–1,00 | 16,7 ms | quem está aqui tem máquina para 60 fps |
| Média | 0,65–1,00 | 16,7 ms | idem, com mais espaço para ceder |
| Baixa | 0,50–0,85 | **22,2 ms** | 45 fps, e não 60: exigir 16,7 ms numa integrada afundaria a resolução até o ilegível perseguindo um alvo inalcançável |

E a ORDEM mudou: o controlador mexe na **escala primeiro** — barata, reversível
e sem tocar em decisão autorada — e só desce de nível quando a escala satura no
piso da faixa. A versão anterior fazia o contrário: tirava sombra e casca de
laranja antes de tentar o botão que devolve quadros.

---

## 2. Os defeitos consertados no caminho

Nenhum destes era o pedido. Todos apareceram na auditoria e todos são reais.

### 2.1 O bias da sombra não escalava com o lado do mapa

Metros por texel tem **dois** fatores — `(2·meia-caixa) / lado-do-mapa` — e
`setShadowSpan()` compensava só o numerador. O denominador passou a variar
quando o perfil ganhou `shadowMapSize`, e ninguém escalou por ele. A 1024², um
`normalBias` de 2 cm que valia 1,3 texel passa a valer **0,43** — que é
exatamente o regime de peter-panning que o bloco de `SHADOW_BIAS` existe para
evitar. **O nível Baixo provavelmente já vinha com a sombra descolada do pneu**,
e o sintoma seria lido como "a qualidade baixa é feia" em vez de "o bias está
errado". Composto com o passo largo de ±60 m, o fator chegava a 1/9.

`applyShadowBias()` é agora o único dono dos dois fatores.

### 2.2 A sonda somava sinais de CPU com sinais de GPU

`weakHint` valia −2 e núcleos, memória e `maxTextureSize` valiam +1 cada. Um i5
de 10ª com UHD 630 e 16 GB somava **+1 ⇒ `alta`** — a máquina que motivou o
pedido abria no nível mais pesado.

O erro conceitual: **uma CPU boa não torna uma integrada rápida; ela só garante
que o gargalo será a GPU.** Agora a classe do adaptador é um TETO e os demais
sinais só rebaixam dentro dele. A lista de integradas cresceu (Iris Xe, Radeon
6xxM/7xxM, Arc integrada); **Apple Silicon ficou de fora de propósito** —
memória unificada a 100-400 GB/s não é "integrada" no sentido que importa aqui.

### 2.3 O medidor media a coisa errada

Era `performance.now()` em volta do `render()`, ou seja tempo de **submissão**.
Numa máquina limitada por CPU isso não vê nada do que domina; e com
`setAnimationLoop` preso ao vsync, uma GPU saturada deixa o bloqueio no swap,
fora do `render()`. **O medidor lia "está tudo bem" numa máquina a 20 fps.**

A régua agora é o tempo de **parede entre dois quadros DESENHADOS
CONSECUTIVOS**, com a cadeia rompida em quadro pulado — senão uma cena parada
por meio minuto entregaria "30 000 ms por quadro" no instante em que alguém
encostasse no mouse. A submissão continua sendo medida como **segundo canal**: a
razão entre as duas é o que distingue "limitado por GPU" de "limitado por CPU",
que é a diferença entre baixar resolução e baixar contagem de objetos.

Os limiares passaram a ser **relativos ao alvo do nível**. Os antigos eram 13 ms
e 28 ms fixos, escritos contra 60 Hz: num nível com alvo de 45 fps o gatilho de
descida disparava com a máquina ainda dentro da meta.

### 2.4 Congelar o nível parava o medidor

`reportFrameTime()` saía na primeira linha quando `mode !== 'auto'`, então
`frameTimeEma()` continuava devolvendo a última leitura feita em automático — e
o painel de diagnóstico mostraria um número velho com cara de atual. **Quem fixa
"Baixa" para comparar com "Alta" é exatamente quem precisa do número.** Medir e
adaptar foram separados.

### 2.5 Um bug que o compilador não pega

`floorReflection` era `boolean` e virou `'full' | 'lod' | 'off'`. O teste em
`cyclorama.ts` era `if (!getProfile().floorReflection) return;` — que **continua
compilando** com o tipo novo e passa a estar sempre errado, porque `'off'` é uma
string não vazia e portanto truthy. O nível Baixo pagaria a passada inteira em
silêncio.

### 2.6 O cache de ambiente chaveava por `id`, não por URL

`serra` e `distrito-industrial` apontam para os **mesmos dois arquivos** HDR.
Visitar os dois decodificava e retinha **duas cópias idênticas — ~33,6 MB** e um
segundo parse RGBE. Junto: o guarda de despejo usava `break` em vez de
`continue`, então o teto real era `MAX_CACHE + 1`.

### 2.7 Uma cascata de CSS que derrotava o painel de luz

`.truck-studio-root #ts-hud button` pontua `(1,1,1)`;
`.truck-studio-root .ts-hud-tile` pontua `(0,2,0)`. Um id vence qualquer número
de classes, então o *reset* estava descartando `background-color`,
`border-color` e `color` das pastilhas — **inclusive o verde da selecionada**. Só
o `outline` sobrevivia (não é declarado no reset), e é por isso que nunca
*pareceu* quebrado. O comentário do próprio bloco declara a intenção contrária
("the tiles opt in to their own surface in section 6"). Corrigido com `:where()`,
que contribui zero.

⚠️ **Isto muda a aparência do painel de iluminação que já estava no ar.** É
conserto, não regressão — mas é visual, e num painel autoral.

### 2.8 Três defeitos no reflexo do piso

(i) a passada não tinha `try/finally`, então uma exceção deixava o piso do
estúdio invisível e o renderizador apontado para o alvo do reflexo **para
sempre**; (ii) no estado desligado nada zerava `reflectStrength`, então depois de
uma captura no nível Baixo a viewport mostrava um reflexo congelado da pose da
foto; (iii) `WebGLShadowMap.render()` roda quando `needsUpdate` é true mesmo com
`autoUpdate === false`, então no modo `lod` o mapa de sombra teria sido assado a
partir da cena PODADA.

---

## 3. Três recomendações da análise anterior que a medição derrubou

### 3.1 `BatchedMesh` — descartado

Lida a implementação do three 0.179.1, ela cobra o que a fusão simples não cobra:
depende de `WEBGL_multi_draw` e **o fracasso é silencioso** (sem a extensão, um
`drawElements` + um upload de uniforme por instância — pior que malhas
separadas); `renderer.info.render.calls` **mente nos dois sentidos**, então um
teste de aceitação baseado nele aprovaria um lote que não bate nada; ~190 MB
pré-alocados; a lista é reconstruída todo quadro no padrão; e `boundingSphere`
nunca é invalidada por `setMatrixAt`, que este engine faz a cada resize.

**Para 942 primitivas em 13 materiais, fundir por material entrega as mesmas 13
chamadas sem nada disso.**

### 3.2 MSAA fica LIGADO em todos os níveis

A tentação era desligá-lo no Baixo — 66 MB de cor+profundidade contra 16,6, numa
memória compartilhada. Mas esta cena é limitada por **shader de fragmento**, e
MSAA sombreia uma vez por **pixel**, não por amostra:

| | fragmentos sombreados | arestas |
|---|---:|---|
| MSAA 4× a `renderScale` 0,65 | **0,88 M** | boas |
| sem MSAA a `renderScale` 1,0 | 2,07 M | serrilhadas |

Mais barato no recurso dominante **e** mais bonito. Quem quiser mexer aqui tem
de refutar essa conta.

### 3.3 O LOD **não** é "sub-pixel", e vender isso seria desonesto

A lente é de 30° e a órbita é presa entre ~8,6 e ~22,4 m. Uma peça de 5 cm tem
**4,0 px de altura a 1080p a 25 m** — é visível. O limiar honestamente invisível
é **12,4 mm**, e nessa faixa há **2 primitivas no implemento inteiro**.

```
< 12,4 mm:     2 prims ·       38 tri
<  20 mm :    63 prims ·  104.485 tri
<  50 mm :   592 prims ·  697.996 tri
< 100 mm : 1.045 prims · 1.174.034 tri
```

**Este LOD custa qualidade.** É degradação legítima para os níveis baixos, e é
por isso que ele entrou como `lodMinPx` em PIXELS — um limiar que se pode
calibrar e explicar — e não como "esconde o que é pequeno".

---

## 4. Duas premissas minhas que os agentes refutaram

Registradas porque cada uma teria virado trabalho errado.

### 4.1 "O `retroreflect.ts` desperdiça ~450 ALU de dia" — **FALSO**

Eu havia instruído fechar o bloco com um `uNivel` amarrado a `rig.vehLights`,
porque ele roda um segundo laço completo sobre `NUM_SPOT_LIGHTS`. Verificado na
fonte do three e neste repositório:

* `setLampsEnabled()` é o único escritor de `SpotLight.visible` e move as 14 juntas;
* `WebGLRenderer.projectObject()` abre com `if (object.visible === false) return;`, então uma luz invisível nunca chega ao `pushLight()`;
* `replaceLightNums()` substitui o literal em `NUM_SPOT_LIGHTS` antes de compilar.

⇒ **De dia `NUM_SPOT_LIGHTS` é 0 e o laço de spots não existe no binário.** O
gate fecharia onde não há nada a fechar, e custaria duas regressões: o laço que
de fato sobrevive de dia é o DIRECIONAL — o sol —, que vale ~3,7× o albedo em
`directSpecular`, ou seja a leitura inteira de "esta fita é muito mais brilhante
que a chapa"; e um preset noturno com o relógio ao meio-dia é alcançável, e lá a
fita ignoraria lâmpadas visivelmente acesas.

O que foi feito no lugar, estritamente mais barato e sem regressão:
`pow(observacao, 4.0)` virou `ob2*ob2`. GLSL não tem sobrecarga inteira de `pow`,
então aquilo era `exp2(4·log2(x))` — duas operações de função especial por luz,
16 vezes por fragmento de fita à noite. E é **mais robusto**: `log2(0.0)` é
comportamento indefinido, e `observacao` é exatamente 0 metade do tempo.

### 4.2 "O reflexo é lido até o mipmap 4" — **erro de leitura meu**

4,0 é o **clamp**, não a faixa de trabalho. A expressão é `log2(1 + 0,12·d)`, que
só chega a 4 em **d = 125 m** — cinco vezes o alcance da órbita. Dentro dos
8,6–22,4 m o mipmap real vai de **1,03 a 1,88**. Dimensionar o corte do modo
`lod` pelo nível 4 teria removido coisa que o reflexo ainda mostra.

O corte correto saiu de uma conta de texel no mip que de fato é lido: **a segunda
maior aresta da caixa em espaço de mundo, a 0,08 m** — 3,7 texels de mip 0 por
leitura × (30°/540 px) = 0,206°, ou seja 8,0 cm a 22,4 m.

E uma terceira, que descarta o atalho óbvio: **`tsWorldDiameter` sozinho não
serve** para o reflexo, porque ele é a MAIOR aresta. As 27 longarinas do
implemento têm 14,3–14,6 m de comprimento e ~2 cm de largura: pelo diâmetro elas
sobrevivem; no reflexo são um risco de 2 cm que nenhum texel resolve.

---

## 5. O que continua na mesa

| item | ganho | risco |
|---|---|---|
| **Reaplicar o `texopt`** | −117 MB na cena de referência | baixo — a ferramenta e o portão já existem |
| **Fundir os 1.302 `bufferView` Draco duplicados** | −9,15 MB de download, −60 % do decode | **nenhum** — não toca um byte de geometria |
| **KTX2/UASTC** | fecha o Baixo em 171,5 MB | médio — e a ordem de deploy é INVERTIDA (§6) |
| **Fusão por material do conjunto estático** | 942 prims → 13 chamadas | médio — pré-requisito: `hideRoot` na caixa de cozinha |
| `registerLod()` explícito em `models.ts` | tira a dependência da impressão digital por varredura | baixo |
| `catalog.ts` repassar a raiz do manifesto | apaga o contorno de `loadTextureVariants()` | baixo |
| `ceiling.ts applyFade` recompila 5 programas ao cruzar 10,6–13,2 m | engasgo visível | médio |
| `setFloorReflectionAmount()` é inerte | a pastilha de fundo não controla o reflexo | muda aparência autorada |

---

## 6. Armadilhas para quem vier depois

* ⚠️ **A ordem de deploy do KTX2 é INVERTIDA.** `KHR_texture_basisu` entra em
  `extensionsRequired` — não há fonte de reserva — e o `GLTFLoader` **lança** se
  o `KTX2Loader` não estiver registrado. Um asset publicado antes do código não
  degrada: **quebra o estúdio inteiro**. Código primeiro, assets depois.
* ⚠️ **ETC1S não economiza nada numa UHD 630.** Sem ASTC e sem ETC2, a tabela de
  prioridades do `KTX2Loader` manda o ETC1S para BC7 do mesmo jeito que o UASTC —
  ele só perderia qualidade (erro até 14,7/255 na normal da grama) sem ganhar um
  byte de memória.
* ⚠️ **A árvore servida e `web/public/` divergiram** — manifestos diferentes
  (`armazem` × `serra`) e `set.glb` do distrito diferente. Reconciliar antes de
  qualquer pipeline, ou o próximo processamento roda sobre a árvore errada.
* ⚠️ **`renderer.info.render.calls` mente sob `BatchedMesh`** — 1 chamada no
  caminho multi-draw, N no fallback. Não use como régua de aceitação de lote.
* ⚠️ **`.visible` tem nove donos e nenhum árbitro.** Qualquer mecanismo novo que
  escreva nele precisa de POSSE POSITIVA (um registro do que ele mesmo escondeu),
  não da heurística "já estava escondido, não é meu" — essa só vale na porta de
  entrada, e só para quem roda uma vez.
* ⚠️ **O pool de spots é desparentado, não escondido.** `traverseVisible()` nunca
  alcança uma luz sem pai, então `NUM_SPOT_LIGHTS` cai sem um segundo escritor
  de `.visible`. Corolário: `getVehicleBeams().visivel` passa a mentir — o número
  verdadeiro é `getLampInfo().spotPool`.
* ⚠️ **A gravação (`record.ts`) não roda no teto.** Ela captura o canvas visível
  pelo laço vivo, então um vídeo gravado no nível Baixo sai sem os parafusos que
  o LOD escondeu. É a mesma classe de exceção conhecida que `quality.ts` já
  documenta para `spotPool` e `shadowType`.

---

## 7. Como conferir

```
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-qualidade.mjs
```

`checks-qualidade.mjs` foi **reescrito**, e o motivo é a lição da §0: a versão
anterior passava em tudo enquanto o seletor não fazia nada. Ela conferia que
`pixelRatioCap` caía de 2 para 1 — e num monitor a dpr 1 esse campo não tem
consequência nenhuma.

**Conferir que um número de configuração mudou não prova nada.** Os testes de
agora medem o efeito no renderizador:

* o **buffer de desenho** tem de encolher, em pixels;
* as **chamadas de desenho** e os **triângulos** têm de cair;
* a **contagem de instâncias** de vegetação tem de cair;
* o **bias da sombra** tem de acompanhar o lado do mapa;
* a **captura** tem de sair no teto, espiando a escrita do `Vector2` (a captura
  é bloqueante, então nenhum `setInterval` a observa).

No console, `__studio.quality.info()` responde tudo de uma vez, e o painel de
Configurações mostra ms de parede, ms de submissão, quadros/s, chamadas e
triângulos — que é o que teria feito este relatório desnecessário.
