# Truck Studio — arquitetura dos cenários

**Isto é um REGISTRO, não um plano.** O que está escrito aqui já foi feito, ou foi
deliberadamente **não** feito — e nesse caso o motivo está anotado junto. Existem **dois**
itens em aberto: o `sky.hdr` do `distrito-industrial`
([§3](#3-em-aberto--o-skyhdr-nunca-foi-re-assado)) e a quarta face do livery, que
vive no `PLANO-2026-08-10.md` ao lado — o único bloco que sobrou dele. A entrega
de 2026-08-10 está registrada na [§9](#9-a-atualização-de-2026-08-10--sete-pedidos-seis-e-meio-entregues).

Este arquivo se chamava `REAL_ENVIRONMENT_PLAN.md` e abria com *"Status: research + plan.
No code changed yet."* Isso deixou de ser verdade por volta de 2026-08-03. Foi renomeado
porque um arquivo com aquele nome e aquela primeira linha se lê como uma lista de tarefas,
e a próxima pessoa tentaria executá-la — inclusive as partes que o código **decidiu não
seguir**.

---

## 0. Linha do tempo — o que realmente aconteceu

| Quando | O quê |
|---|---|
| — | Pesquisa original: diagnóstico do "porquê a cena lê como falsa", modelo de três cascas (NEAR/MID/FAR), levantamento de licenciamento, lista de ~40 assets do Sketchfab. |
| — | **A virada para o Blender.** A lista de assets foi ABANDONADA. Em vez de garimpar CC-BY, os dois cenários foram **modelados**: `tools/env-build/build_armazem.py` e `tools/env-build/build_industrial_park.py` (mais `build_warehouse.py`, `race_track.py`, `texture_infer.py` e os scripts de shot no mesmo diretório). **Modelagem substituiu curadoria.** |
| — | `scene/set.ts` nasce: cenário = geometria de verdade (`set.glb`), materiais NOMEADOS ligados por manifesto a conjuntos PBR compartilhados de `/textures/`. |
| **2026-08-03** | **Os três cenários só-HDRI foram removidos**: `rodovia`, `patio-logistico` e `urbano`. Eram foto equirect + chão procedural. Entraram `distrito-industrial` e `armazem`. |
| **2026-08-03+** | **O corte de código morto que veio junto.** `scene/scatter.ts` (−1351 linhas) e `scene/plate.ts` (−198) apagados; `scene/environment.ts` e `scene/scene.ts` reduzidos a uma fração. Total no `truck-studio/`: 19 arquivos, **+2.517 / −5.743**. Sumiram o `nearGround`/`setNearGround`, o scatter, o roadside, o shadowCatcher e o domo projetado (`GroundedSkybox`). |

> O `removedNote` de `environments.json` previa esse corte como "o próximo, e ele é
> grande". Foi.

---

## 1. Por que a cena antiga lia como falsa

**Esta é a parte mais valiosa do documento e ela continua inteiramente válida.** É o
argumento fundador: `environments.json` (`removedNote`) e o cabeçalho de `scene/set.ts`
reproduzem os quatro pontos abaixo como justificativa deles próprios. Se algum dia alguém
propuser voltar a "foto + chão procedural", é aqui que a resposta está.

Não era um problema de "o HDRI é ruim". HDRIs do Poly Haven são fotografias — fotorreais
por definição. O que quebrava a ilusão era a **transição** entre a foto e o CG:

| # | O que acontecia | Por que o olho rejeita |
|---|---|---|
| 1 | `nearGround` construía um **disco procedural** de asfalto + orla de grama, raio 26 m, fade 18 m, misturado ao fundo | Um chão perfeitamente circular, perfeitamente plano, com fade alpha radial. Chão de verdade tem meio-fio, ralo, junta, faixa pintada, e um horizonte *ocluído por objetos*, não desbotado por alpha. |
| 2 | O maquinário de `tintRgb` — um ensaio de calibração inteiro dentro de `environments.json` — existia para forçar o asfalto CG a casar com o asfalto da foto | Precisar disso *já é* o sintoma: dois renderizadores sendo reconciliados por um multiplicador de cor. Acerta a média e não tem como acertar a textura. |
| 3 | `scatter` espalhava 420 + 280 + … instâncias de grama, postes procedurais, mastro de pista | Instâncias espalhadas não têm **lógica de arranjo**. Um pátio real tem rastro de pneu, mancha de óleo, palete largado na porta, carro estacionado em vaga pintada. |
| 4 | **Nada ocluía o horizonte** | O caminhão fica sobre um disco dentro de uma foto infinita. Não existe meio-termo. **Este é o maior de todos.** |

Um `set` resolve os quatro de graça: a geometria é real, o arranjo é real, e o prédio
oclui o horizonte.

---

## 2. A arquitetura que existe: **uma** casca, não três

O plano original propunha três bandas por distância:

```
[ NEAR  0-40 m ]   geometria PBR modelada, iluminada pelo rig        <- ISTO EXISTE
[ MID  40-250 m ]  fotogrametria aérea, unlit/baked, fog + tint      <- NUNCA EXISTIU
[ FAR  250 m+   ]  o HDRI                                            <- existe, ver §3
```

**Só a banda NEAR foi construída**, e ela é o `set.glb`. Não há banda MID: nenhuma malha
fotogramétrica entrou no projeto, e portanto nenhum dos mecanismos que ela exigiria
(material unlit, tint linear por preset, fade por distância) foi escrito. Isso é uma
decisão, não uma pendência — ver [§7](#7-o-que-foi-deliberadamente-não-feito).

O que um cenário é hoje, concretamente:

| | `distrito-industrial` | `armazem` |
|---|---|---|
| `set` | `environments/distrito-industrial/set.glb` — **7.362.408 B** | `environments/armazem/set.glb` — **3.479.204 B** |
| `hdri` | `environments/rodovia/sky.hdr` (5.750.581 B) | **`null`** — iluminado só pelas próprias tiras emissivas |
| extensões do glb | Draco · WebP · `KHR_materials_emissive_strength` · `EXT_mesh_gpu_instancing` | Draco · WebP · `KHR_materials_emissive_strength` |
| `showSkyDome` | `false` | `false` (a casca fechada esconde o domo) |

**Por que os sets são tão leves:** eles saem do Blender **sem textura**. Os materiais de
chão são só NOMES (`ASPHALT_YARD`, `CONCRETE_APRON`, …) e o manifesto liga cada nome a um
conjunto PBR de `/textures/` que o app já baixa. Sem isso cada set carregaria a própria
cópia do mesmo asfalto 4k. É por isso que `distrito-industrial` cabe em 7 MB. Ver o
cabeçalho de `scene/set.ts` e `bindMaterials()`.

O `set` **não ilumina nada**. O rig (`scene/scene.ts` + `scene/presets.ts`) continua dono
absoluto de key/rim/hemi/fog; os materiais do set são PBR normais que respondem a ele — é
exatamente por isso que um set atravessa os seis presets e o ciclo dia/noite sem tratamento
especial.

---

## 3. EM ABERTO — o `sky.hdr` nunca foi re-assado

**Este é o único item vivo deste documento.**

O plano chamava isto de *"a mudança de maior impacto do documento inteiro"*, e ela
**não foi feita**. A ideia: com o set montado no Blender, renderizar dali um **equirect
4K HDR a partir da posição do pivô do caminhão** e enviar como o `sky.hdr` daquele
cenário. Nada no engine muda — `environments.json` já tem o campo `hdri`.

O estado real:

- **`distrito-industrial` aponta para `environments/rodovia/sky.hdr`** — uma foto de
  acervo do Poly Haven, de **outro lugar**. O fundo e o reflexo mostram um sítio; a
  geometria mostra outro. O cromado, o vidro e a tinta do caminhão refletem uma rodovia
  que não está ali.
- **`armazem` tem `hdri: null`.** Não é o re-assamento: é a ausência dele. O cenário é
  uma casca fechada iluminada pelas próprias tiras emissivas, e funciona porque nada de
  fora precisa aparecer. Não resolve o caso aberto — contorna.

Quem for mexer nisso: a pasta `/environments/rodovia/` hoje contém **só** `sky.hdr`, e
existe unicamente para servir de céu ao `distrito-industrial`. Assar um HDR próprio para
o `distrito-industrial` é o que finalmente permite apagá-la.

> ⚠️ **O `removedNote` de `environments.json` está desatualizado neste ponto.** Ele avisa
> que `/environments/patio-logistico/` "NÃO pode ser apagada" porque o `armazem` usaria o
> `sky.hdr` dela. Isso mudou: `patio-logistico/` **foi** apagada por inteiro e o `armazem`
> passou a `hdri: null`. Só o aviso sobre `/environments/rodovia/` continua valendo.

---

## 4. Licenciamento — o filtro que decide tudo

**Continua vivo e continua sendo o que sustenta a virada para o Blender.** Modelar em vez
de garimpar não foi preferência estética; foi a saída para o funil abaixo.

### Unreal / Fab
Boa parte do conteúdo de terceiros do Fab é usável fora da Unreal, mas **o conteúdo
autoral da Epic não é** — Paragon, MetaHumans, City Sample (a demo do Matrix), Downtown
West e Quixel Megascans são restritos ao motor. Ou seja: o visual "City Sample" que se
imagina é justamente o único que não dá para usar.

*Exceção que vale conferir na conta:* do lançamento do Fab (out/2024) até 31/12/2024, a
Megascans ficou gratuita para todos sob a Fab Standard License **para todos os motores e
ferramentas**, e o que foi reivindicado naquela janela segue licenciado para sempre.

### Unity Asset Store
A própria Unity confirma que outros motores são permitidos — **mas** a EULA proíbe entrega
em que *"usuários do seu projeto possam acessar ou extrair os arquivos brutos"*. Um app
three.js serve `.glb` por HTTP; qualquer um puxa pela aba Network. Um app web é o pior
caso possível para essa cláusula. A mesma cláusula existe na TurboSquid e na CGTrader.
**Trate asset pago de marketplace como inutilizável num build web público.**

### O que sobra
**CC0 e CC-BY.** CC-BY é perfeitamente viável aqui: já existem
`public/environments/CREDITS.md` e um bloco `credit{}` por cenário. Atribuição é problema
resolvido neste código.

### Google Photorealistic 3D Tiles — verificado, e é armadilha para *este* uso
A política da Map Tiles API exige que você **"não pré-busque, indexe, armazene ou faça
cache de qualquer Conteúdo"**. Não dá para assar num GLB nem no HDRI — tem de vir por
streaming ao vivo, cobrado por sessão, e é indisponível na UE. Viável como *funcionalidade
separada* mais adiante ("veja este caminhão na nossa planta de Ibiporã"), nunca como base.

---

## 5. Orçamento — batido com folga

O alvo era **≤ 35 MB por cenário** (desktop; ≤ 12 MB no fallback móvel), com ~800 k tri e
~15 MB só na banda NEAR.

Entregue: **7,36 MB** (`distrito-industrial`) e **3,48 MB** (`armazem`) de `set.glb`.
Somando o HDRI compartilhado, `distrito-industrial` fecha em ~13,4 MB de fio; `armazem`,
sem HDRI, em ~3,5 MB. Os alvos de draw call foram atacados por `EXT_mesh_gpu_instancing`
no `distrito-industrial`.

O que fez a conta fechar não foi decimação agressiva: foi o set **não carregar textura
nenhuma** (§2).

---

## 6. Pipeline de asset (`gltf-transform`)

A urgência de **KTX2 tornou-se sem efeito** e a linha *"KTX2 não é opcional"* foi removida
daqui. O motivo é §2: os sets viajam sem textura, então a pressão de memória de GPU que
justificava KTX2 nunca chegou. **Não existe `KTX2Loader` no projeto** e não há razão atual
para adicionar um. Só `/vendor/draco/` é vendorizado (`config/assets.ts` →
`dracoDecoderDir: "/vendor/draco/"`).

O que continua valendo é a receita:

```bash
npx @gltf-transform/cli dedup    in.glb a.glb --materials false
npx @gltf-transform/cli prune    a.glb  b.glb --keep-attributes false --keep-leaves true
npx @gltf-transform/cli webp     b.glb  c.glb --slots "*" --lossless
npx @gltf-transform/cli draco    c.glb  out.glb --method edgebreaker \
      --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14
```

Medido no `models/vehicles/trailer.glb`, que é o pior caso do acervo (bake do exportador
do three, sem Draco): **299,77 MB → 143,73 (dedup) → 99,05 (prune) → 85,35 (webp lossless)
→ 33,78 MB (Draco)**. 8,9× menor, com as 35 texturas pixel a pixel idênticas às PNG de
origem e nenhum triângulo de área não-nula perdido.

**Duas armadilhas, as duas silenciosas:**

1. **`dedup` funde materiais por padrão, e isso quebra a pintura.** Existem grupos de
   materiais byte-idênticos com NOMES DIFERENTES, e `applyTrailerFinish()` em
   `engine/vehicle/models.ts` despacha pelo **nome**. Uma rodada padrão derruba nomes e
   desfaz correções documentadas sem avisar. **`--materials false` é obrigatório.**
2. **Nunca rode `gltf-transform quantize`.** A grade dele é de CENA INTEIRA; num bake cuja
   caixa local tem milhares de unidades isso é catastrófico. A grade **por primitiva** do
   Draco é o que torna 16/12/14 seguro. Decalques que ficam décimos de milímetro
   sobressalentes sobrevivem a isso; a uma grade de cena, não.

Um terceiro cuidado, para texturas: `gltf-transform resize` **reencoda todas as texturas
do arquivo em WebP com perdas**, inclusive normal maps. Para reduzir UMA textura, escreva
um script com `@gltf-transform/core` + `sharp` que troque só aquela imagem.

Para malhas fotogramétricas (caso que não existe hoje), `simplify --ratio 0.25
--error 0.001` seria o cavalo de batalha — mas veja §7 antes de trazer uma.

---

## 7. O que foi deliberadamente **não** feito

Estas linhas existiam no plano e **não devem ser executadas**. Não são pendências.

| Item do plano | Situação |
|---|---|
| Lista de ~40 assets do Sketchfab (fotogrametria aérea, quarteirões urbanos, contêineres, cercas, carros) | **Descartada.** Os dois cenários foram modelados no Blender (`tools/env-build/`). Seguir a lista contraria a estratégia que o código adotou. |
| Banda MID de fotogrametria a 100–250 m | **Não construída.** Sem ela, nada de material unlit nem de fade por distância. |
| Tint linear por preset no material MID (item 3 do plano de código) | **Superado.** Só faria sentido com albedo fotogramétrico (sol assado dentro). Os dois sets são modelados e respondem ao rig direto. O gancho está descrito no cabeçalho de `scene/set.ts` caso um set fotogramétrico apareça. |
| `setsDir` em `core/paths.ts` / `config/assets.ts` (item 6) | **Não feito, e certo assim.** O caminho do set vem do manifesto por cenário; um diretório dedicado não acrescenta nada. |
| Ordem de fases 0–5, com `rodovia` / `patio-logistico` / `urbano` como cenários a evoluir | **Obsoleta.** Os três foram apagados em 2026-08-03. Quem seguir a "fase 4" vai trabalhar em cenários que não existem. |
| `scatter.ts` "continua opcional, não apagado" (item 4) | **Apagado mesmo** (−1351 linhas), junto com `plate.ts`. |
| KTX2 + transcoder ao lado do `/vendor/draco/` | **Sem efeito** — ver §6. |

O que **foi** feito, em forma mais rica que a proposta: o bloco `set` em
`environments.json` (itens 1 e 2), com mapa de materiais, `rotationY` e o resto do
manifesto; e `scene/lamps.ts` (item 5), que ganhou modelo de luminária de verdade
(`setLampModel`) em vez de só manter o mastro procedural.

---

## 8. Onde o código está

| Arquivo | Papel |
|---|---|
| `public/environments/environments.json` | manifesto dos cenários + `removedNote` (o argumento de §1) |
| `engine/scene/set.ts` | carrega o `set.glb`, liga materiais nomeados a conjuntos PBR de `/textures/`, molhagem por superfície |
| `engine/scene/environment.ts` | `applyEnvironment()` — HDRI, domo, modelo de poste, delega o set a `applySet()` |
| `engine/scene/scene.ts` · `presets.ts` | o rig de luz: dono de key/rim/hemi/fog e do ciclo dia/noite |
| `engine/scene/lamps.ts` | luminárias — pool distribuído, escala/orientação pela altura do modelo |
| `engine/catalog/catalog.ts` | tipos do manifesto |
| `tools/env-build/*.py` | **a fonte dos cenários**: scripts Blender que geram os `set.glb` |

---

## 9. A atualização de 2026-08-10 — sete pedidos, seis e meio entregues

Esta seção é o destino dos blocos que saíram do `PLANO-2026-08-10.md`. O plano
segue vivo com **um** bloco (7a, a quarta face do livery) e será apagado quando
ele sair.

O fio que costura os sete pedidos: o estúdio deixou de ser só um visualizador e
passou a ser uma ferramenta de **produzir material** — imagem, vídeo e uma
configuração de produto que se grava.

### 9.1 Tela cheia
`ui/chrome.ts`. O alvo é `root` e nunca `#canvas-holder` — o editor de plotagem é
IRMÃO de `#app`, e pedir tela cheia no holder o deixaria fora do elemento em tela
cheia, ou seja invisível. Prefixos `webkit*` porque o Safari só ganhou a API sem
prefixo na 16.4. Não é persistido, e não pode ser: tela cheia só se pede dentro
de um gesto do usuário.

### 9.2 Carregamento especulativo
`core/prefetch.ts`. **Aquece o cache HTTP, não a cena** — é a decisão que torna o
bloco seguro: um `fetch()` de baixa prioridade põe os bytes no cache e o
`GLTFLoader` posterior paga só o parse. Zero mudança em `applyChoice`, na fila de
aplicações ou em `loadCab()`, nenhum dos quais é reentrante. O implemento (31 MB)
começa a descer com o usuário ainda no passo 1 do seletor.

### 9.3 Estúdio: luz, fundo e imagem sem fundo
`scene/cyclorama.ts` · `scene/presets.ts` · `ui/hud.ts` · `scene/capture.ts`.
O HUD ganhou uma segunda FACE (não um segundo painel — ver o cabeçalho de
`hud.ts` sobre por que duas superfícies escrevendo o mesmo estado mataram a
sidebar): no cenário Estúdio a hora e o clima somem e entram fundo, preenchimento,
recorte, difusão e temperatura. As quatro pastilhas de `BACKDROPS` são pares
(escala da rampa de albedo, exposição) derivados da tabela de medições do
ciclorama, não escolhidos no olho. A captura ganhou `background: 'recorte'` —
alfa preservado, `ShadowMaterial` no piso para o veículo não flutuar, e PNG
forçado porque WebP com perdas franja a borda alfa.

**Correção de 2026-08-10 (pedido do dono do produto):** as pastilhas de fundo
eram uma variante própria — `.ts-hud-tiles--swatch`, com uma amostra de largura
inteira e o nome quebrando em duas linhas. As duas fileiras se SUBSTITUEM quando
o cenário troca, e substituir com outra forma faz o painel parecer que se
remontou. Agora a cor é um ÍCONE no mesmo slot de 18 px das pastilhas de clima
(`backdropIcon()`), o rótulo é de uma palavra como os quatro climas já eram, e a
fileira ficou ao lado da de clima no fim do corpo — mesmo lugar, mesma forma,
zero CSS próprio. Ver a nota em `ui/hud.css` seção 6.

### 9.4 Rotação: centro garantido e as duas pontas dentro do quadro
`scene/scene.ts`, bloco "o GIRO DE APRESENTAÇÃO". O botão era uma linha
(`controls.autoRotate = !controls.autoRotate`) e os três defeitos relatados eram
todos consequência de ligar o giro **sem mudar de modo**:

1. ele orbita em volta da MIRA, e a coleira `FOCUS_PAN_F` (0,28 · r) deixa
   arrastá-la ~3 m — órbita excêntrica. Ligar o giro **recentra** a mira
   (suavizado, τ 0,20 s) e **congela o pan**;
2. `minDistance` é 0,40 · r (~3,7 m num conjunto de 19 m), e girar de lá varre
   nariz e traseira para fora. O giro impõe um **piso** igual a
   `openingDistance(f.r)` — a mesma conta de `frameAll()`, e a esfera é
   independente de orientação, então vale nos 360°;
3. `controls.update()` passou a receber o **dt**. Sem argumento o OrbitControls
   avança o giro por QUADRO, ou seja meia velocidade a 30 fps. É o que torna
   `turntablePeriod()` uma promessa em vez de uma estimativa — e é dela que a
   gravação de "uma volta completa" depende.

O percurso é medido em **ÂNGULO** (`turntableTravel()`), não no relógio: um
contador de tempo mentiria em toda aba que perde quadros, e é justamente durante
uma gravação que perder quadros é comum.

### 9.5 Gravar vídeo
`scene/record.ts` — o IRMÃO de `scene/capture.ts`, e eles fazem o oposto um do
outro. Uma frase explica todas as diferenças: **`captureStream()` captura o
canvas que é COMPOSTO.** Não há API que transforme um render target em faixa de
vídeo, então tudo que a gravação quiser mudar na imagem tem de mudar NA TELA e
ser desfeito no fim — daí a tarja durante a gravação em 1080p, e daí o vídeo não
ter fundo transparente (nenhum contêiner do `MediaRecorder` carrega alfa de forma
confiável; o que resolve de verdade é o fundo preto do ciclorama, §9.3).

Dois modos: **Livre** (o usuário orbita, teto de 60 s) e **Volta completa**, que
liga o giro com `damping: false` — com amortecimento o começo e o fim são
acelerados e o laço não fecha — e para sozinho ao completar 2π. Durante a volta,
`suspendAvoidance(true)`: o desvio das construções vira oscilação de altura com o
período dos galpões, que é a coisa mais visível de um vídeo de 20 s. A suspensão
é um flag nosso e **não** `setCameraObstacles(null)`, porque a lista é de
`scene/set.ts` e devolvê-la daqui erraria se o cenário trocasse no meio.

`pinFrames()` entrou em `scene.ts` para a gravação não depender de
`ON_DEMAND_RENDERING` continuar `false`: um quadro que o laço decide não desenhar
é um quadro gravado repetido.

O codec é **sondado**, nunca presumido — `isTypeSupported` na ordem mp4/avc1 →
webm/vp9 → vp8 —, e a extensão sai do contêiner que ganhou, lido de
`recorder.mimeType` depois do `start()`.

### 9.6 Configurador de acabamentos
`vehicle/trim.ts` · `ui/trim-panel.ts` · `vehicle/paint.ts`.

**A mudança estrutural do lote foi em `paint.ts`:** ele era um singleton — um
`const U` de uniformes de módulo compartilhado por todo material de tinta —, e
pintar o teto de uma cor e o paralama de outra era impossível por construção.
Virou `PaintInstance`, uma classe com os próprios uniformes, receita e conjunto
de materiais. **A superfície pública não mudou uma linha** (`setPaint`,
`getPaintParams`, `makePaintMaterial`, `_sharedPaint` delegam para
`defaultPaint`), e o GLSL é byte a byte o mesmo — por isso
`customProgramCacheKey` continua `v5`: o programa compilado É o mesmo, o que
deixou de ser compartilhado são os VALORES.

Casar por MATERIAL onde há material próprio e por NÓ onde não há, que é a mesma
conclusão de `trailerPanelMeshes()`. As medições que corrigiram o plano estão em
`PLANO-2026-08-10.md` §0 — a mais importante: `inox-ferragem` é o material da
ferragem do implemento INTEIRO (1 559 976 tri, dos quais 3,6 % na caixa), então a
caixa casa por nó **mais** uma lista branca de materiais.

**A regra que governa tudo: sem cor escolhida, nada muda.** Teto e Thermo King já
eram pintados junto com o baú e continuam; paralamas e caixa nunca foram e
continuam como o bake os entregou. Isso é o que torna a funcionalidade puramente
aditiva — e é o que obriga `applyTrim()` a rodar DEPOIS de `setPaintTarget()`
(por `onPaintTargetApplied`), porque aquele escreve a cor do baú em toda malha de
`trailerPanelMeshes()`, teto e TK inclusive.

A interface é **deliberadamente mais discreta que os liveries**: uma tira
recolhida dentro de `#ts-panels`, com quatro pontinhos que já respondem "de que
cor está cada peça" sem ninguém abrir nada.

### 9.7 Arte estrutural em SVG — o fim da foto esticada
`tools/livery-svg/slice.mjs` (offline) · `vehicle/livery-art.ts` +
`vehicle/livery-structure.ts` (runtime) · `public/models/vehicles/panels/`

O painel do editor era uma FOTO — `panels/lateral.png` (168 kB) e
`panels/traseira.png` (540 kB) — esticada sobre a janela. Ela mostrava a
ferragem certa e NÃO redimensionava: um baú de 8,40 m e um de 15,40 m recebiam a
mesma imagem, então fita 3M, cantoneira e varões esticavam junto. Peças de
dimensão FIXA desenhadas com dimensão variável.

**O que substitui é uma GRADE 3×3 POR FACE**, recortada da prancha técnica do
cliente (5,52 MB de export de Illustrator) em 17 SVGs de 2 a 135 kB, mais um
manifesto `layout.json`:

```
┌─────────┬───────────────────┬─────────┐
│ canto   │  banda de TOPO    │ canto   │  altura FIXA, presa ao TETO
├─────────┼───────────────────┼─────────┤
│ montante│  JANELA DE ARTE   │ montante│
├─────────┼───────────────────┼─────────┤
│ canto   │  banda de BASE    │ canto   │  altura FIXA, presa ao PISO
└─────────┴───────────────────┴─────────┘
  largura                       largura
  FIXA                          FIXA
```

É a doutrina de `trailer-assembly.ts` (`roof`/`floor`/`stretch`/`follow`) no
plano da textura. **Não é o formato do arquivo que resolve o problema, é a
DECOMPOSIÇÃO:** uma foto é uma imagem só, então mudar de tamanho é uma
transformação afim sobre tudo que ela contém; a grade são 17 retângulos com
regras diferentes, e "acompanhar a medida" vira reposicioná-los. Ser vetor é o
que torna isso barato (nítido em qualquer resolução, 368 kB contra 692 kB), mas
quem conserta é a separação.

**As bandas das laterais LADRILHAM em vez de esticar**, e é o ponto: a fita 3M
mora dentro delas, com passo medido de 327,27 u = 1,1584 m (14 segmentos, mín =
máx). Esticar a banda esticaria a fita. Traseira e testeira NÃO ladrilham — lá a
banda é uma peça desenhada de ponta a ponta, e ladrilhar a repetiria num painel
de 2,6 m com um ladrilho de 2,4 m.

**DOIS PLANOS.** A foto era uma moldura com a janela vazada, e a ferragem passava
POR CIMA do desenho — é o que faz um texto atravessado pela borracha aparecer
cortado no editor do mesmo jeito que sai no baú. A pilha agora tem dois canvas
por painel: `.ts-structure` atrás do fabric (a chapa) e `.ts-structure--front`
na frente (a ferragem). As oito células da borda vão para o plano da frente; o
miolo da frente existe só na traseira, onde há varões, dobradiças e maçanetas
sobre a área pintável.

**Calibração:** `k = 15400 / 4350,85 = 3,53954 mm/u`. Confere consigo mesma —
cantoneira 241 + arte 2364 + rodapé 241 = 2846 mm contra os 804,3 u medidos entre
os dois trilhos = 2847 mm. E o corpo tem a MESMA altura nas quatro faces, com
divisões diferentes: lateral 241/2364/241, traseira 190/2438/219, testeira
241/2381/241.

Quatro armadilhas que o corte descobriu, todas silenciosas:

* **os 814 `path` da prancha usam comandos RELATIVOS** — todos. Um recorte que
  leia o `d` como pares de coordenadas absolutas mantém tudo: 738 caminhos
  "dentro" de uma janela de 75 × 13,6 u. `h`/`v` são piores, levam UM número e
  desalinham o resto do caminho;
* **o fundo da prancha é uma MESA de 7 443 × 5 136** que intersecta toda janela.
  Sem descartá-la, uma célula do plano da frente tapa o painel inteiro;
* **a fita corre POR CIMA do rodapé**, então recortar por retângulo traz o cinza
  junto — daí o descarte por classe (`drop`);
* **os 8 `<image>` são 4,5 MB dos 5,5 MB**, e dois deles são tiras de
  14 898 × 284 px correndo a lateral inteira: exatamente a coisa que estica.

**A resolução segue o tamanho EXIBIDO** (`setPanelDisplaySize`, teto 4 096 px,
histerese de 1,5×). Era impossível com a foto (2 048 px para qualquer baú).

**O que 7b NÃO fez:** a foto ainda é MEDIDA — `findWindow()` acha o vazado dela
para posicionar a tela do fabric — mas não é mais DESENHADA quando há arte
(`--ts-pw-img: none`). Trocar essa medição pela do manifesto é o passo seguinte
e é independente.

---

## 10. A rodada de 2026-08-11 — a noite, e a câmera que atravessa

Quatro pedidos numa frase do dono do produto: **arrumar árvore e poste sem
precisar desviar deles, atravessar o cenário em vez de fugir dele, trocar o céu
por um de noite de verdade, e acender as luzes** — dos postes e do caminhão, "a
partir das 18:00". Os quatro estão amarrados por uma decisão só, e é ela que
explica a ordem: **a câmera parou de desviar.**

### 10.1 O desvio saiu; a transparência entrou — `scene/seethrough.ts`

Até aqui `applyAvoidance()` puxava a câmera para perto e a levantava quando um
galpão entrava na frente do produto. Funcionava, e cobrava dois preços: a câmera
se mexia sozinha (o usuário arrasta para um lado e o enquadramento vai para
outro) e **o cenário tinha de ser autorado em volta disso** — a origem do vão de
128 m na fileira de postes deste set é exatamente essa. O maquinário do desvio
continua inteiro e testado no arquivo; o que não acontece mais é ele ser
alimentado (`setCameraObstacles` entrega lista vazia, e o cabeçalho lá diz como
religar).

**A v1 do substituto foi reprovada assim que foi vista rodando**, e vale
registrar por quê, porque o desenho atual é a resposta ponto a ponto. Ela abria
um túnel CILÍNDRICO entre a lente e o veículo e dissolvia por FRAGMENTO:

| defeito relatado | causa |
|---|---|
| *"levemente transparente mas ainda mostrando um pouco da construção"* | a queda radial deixa a maior parte da área em MEIO caminho — estado permanente, não transição |
| *"nem mesmo faz sentido somente parte de uma arvore ficar transparente"* | o cilindro corta a copa onde passa |
| *"isso esta sendo aplicado a faixa no chao da rua"* | quem recebia o tratamento era a família de molhagem `built`, e `surfaceOf()` devolve `built` para todo material cujo nome não casa a lista de chão — `LINE_PAINT` não casa |

A v2 troca o eixo do problema: **a decisão é por OBJETO, é binária, e sai da CPU.**
O shader recebe um número por objeto e mais nada.

* **Quem pode tapar** é quem tem ALTURA (o mesmo 0,35 m de `SHADOW_CAST_MIN_H` —
  o que projeta sombra é o que tapa) **e não é superfície de chão pela
  DECLARAÇÃO do manifesto**. As duas condições são necessárias: a altura sozinha
  deixava passar `kerbs` e `farmland`, cujas caixas envolventes são altas porque
  acompanham o relevo; a declaração sozinha deixaria passar `LINE_PAINT`, que o
  manifesto nomeia mas cuja família o nome não revela.
* **Quem decide** é a silhueta em TELA: o retângulo do objeto em NDC encostando no
  do veículo, mais profundidade. É a definição literal de "está atrapalhando", e
  é o que o cilindro tentava aproximar — mal, porque um cilindro de raio fixo
  cobre um cone visual que se abre.
* **Como um número por objeto chega ao shader**, que é o ponto difícil: as 11
  torres deste set são 11 NÓS apontando para a MESMA malha glTF, logo dividem
  geometria E material. Uniforme por material apagaria as onze; atributo por
  vértice também (geometria compartilhada). Então cada malha ganha um **clone do
  próprio material** — texturas por referência, mesmo programa, ~65 clones. A
  vegetação é a exceção e usa `InstancedBufferAttribute`, porque ali quem precisa
  de valor próprio é a INSTÂNCIA.
* **Histerese**, e não é refinamento: sem ela um poste que raspa o contorno da
  carreta troca de lado a cada quadro e o valor fica pendurado no meio da rampa —
  a mesma transparência parcial, por outro caminho. Medido antes de existir:
  `mast_m_2` estacionado em 0,04 com a câmera parada.
* **A sombra do que você atravessa continua inteira**, de propósito: o passe de
  sombra usa o `MeshDepthMaterial`, que não recebe a injeção. É o que separa
  "consigo ver o caminhão" de "o cenário sumiu".

### 10.2 Onde árvore e poste ficam — `scene/scenery.ts`

Liberada a amarra da câmera, o arranjo pode ser o de um lugar de verdade, e é
lido da geometria do próprio set — nunca de números cravados. Árvore vai em
canteiro (`median_*`, alinhada, passo de 14 m: alameda, não bosque) e em grama
(`turf_*`, por área), com porte repartido — 15 m no canteiro de 10,5 m entre duas
pistas não existe. Poste mantém as duas linhas de x e ganha passo constante em z,
alternando os lados: o vão caiu de **128 m para 27,2 m**.

**Três defeitos do `.glb` que só apareceram ao medir:**

1. **`InstancedMesh` não nasce zerado, nasce em IDENTIDADE** (r155+) — já
   registrado na rodada anterior, e é o que fazia 342 instâncias empilhadas na
   origem local virarem uma "lasca" no chão.
2. **Quatro dos seis postes do lado oeste tinham o braço virado para fora da
   rua.** Passou por detalhe enquanto a luminária era geometria apagada; deixou
   de passar quando ela virou luz. A correção não copia rotação de vizinho —
   deriva do lado (o braço aponta para o eixo da rua) e **verifica no mundo em vez
   de supor no nó**.
3. **O pareamento casca/copa pelo sufixo `_1` é ambíguo**, e essa é a mais
   silenciosa das três. O GLTFLoader batiza a segunda primitiva de `tree_pk_3`
   como `tree_pk_3_1` — mas o índice do protótipo TAMBÉM pode ser 1, então
   `tree_pk_1` (a casca do protótipo 1) e `tree_pk_1_1` (a copa dele) caíam em
   chaves diferentes. Consequência dupla: no plantio os dois pedaços ficavam com
   altura zero e eram descartados, ou seja **quatro dos dez protótipos
   continuavam nas posições de fábrica, em cima do asfalto** — o defeito que o
   módulo existe para consertar; e no atravessar recebiam vereditos independentes,
   a meia árvore. O par passou a ser **estrutural** (irmãos sob o `Group` de
   primitivas). Instâncias plantadas: **416 → 593**.

### 10.3 Dois céus, um mapa — `scene/skyblend.ts`

*"somente escurecer nao fica bom"*, e está certo: a noite era o plate de DIA com
`backgroundIntensity` em 6 % e `environmentIntensity` em 40 %. Escurecer não tira
o cúmulo iluminado por baixo, não tira o degradê quente do poente e não põe
estrela nem lua. Foto subexposta não vira noite.

O par é `kloppenheim_06_puresky` (dia) e `kloppenheim_02_puresky` (noite) — **a
mesma série**, medida em três eixos (ver `CREDITS.md` §1.0): a lua está a 5,0° do
sol em azimute, logo o `envRotation` de 4,7124 serve aos dois; a luminância média
é 43 % da de dia, logo o plate já escurece sozinho; e o pico é 55 633 contra 33,
logo o peso da noite entra por `smoothstep(0,25…0,95)` e não linear — numa
interpolação reta haveria meia lua de 28 mil unidades num céu de poente.

**Um alvo intermediário serve aos dois consumidores**, e é isso que torna o
esquema barato: `scene.environment` e `scene.background` aceitam UMA textura
cada, então a mistura acontece antes, num passe de tela cheia. O FUNDO é o
próprio alvo (reescrito a cada mudança, sub-milissegundo ⇒ atravessa liso) e o
REFLEXO é o PMREM dele, **limitado por taxa** (110 ms, passos de 1/12). O
descasamento é invisível porque o fundo é estrutura e o reflexo é ambiente
difuso; inverter a divisão seria imediatamente visível. Reusar o alvo do PMREM
(`fromEquirectangular(tex, rt)`) é o que dispensa reapontar `scene.environment`.

Com o plate certo no lugar, **os pisos de `nightness` subiram**: 0,06 → 0,22 no
fundo e 0,40 → 0,55 no reflexo. Somar os dois esmagamentos daria 2,6 % do céu de
dia — um buraco preto onde deveria haver céu.

### 10.4 O cenário traz o poste, o engine traz a luz — `scene/lamps.ts`

O manifesto do distrito dizia `lamps: { enabled: false }` com a justificativa de
que "a fileira procedural duplicaria a iluminação". Certa quanto à GEOMETRIA,
errada quanto à LUZ: as onze torres usam o material `FENCE_POST` — o mesmo mourão
do alambrado — e **o `set.glb` não tem um único material emissivo**. Aquelas
luminárias nunca acenderam.

`layout: 'set'` faz a divisão certa. Posição, altura (10,03 m), alcance do braço
(1,94 m) e tamanho do vidro são **medidos** por `scenery.ts`; `lamps.ts` esconde
as próprias primitivas e põe o refletor e o vidro aceso nas luminárias do set. O
pool continua sendo 8 (`NUM_SPOT_LIGHTS` é chave de cache de programa, e
`warmLightPrograms()` pré-compila as duas configurações na tela de carregamento),
então os oito refletores vão para as oito torres MAIS PRÓXIMAS do veículo — a
mais distante fica a 150 m, onde um refletor rende dois pixels. O vidro aceso vai
nas onze, porque é geometria emissiva e não custa luz.

**O vidro tem de sumir COM o poste.** Atravessar uma torre apaga o mastro no
shader, e o vidro é geometria do engine: sem vínculo, ele fica aceso flutuando no
céu. Foi fotografado na bancada às 20:00. `bindSeeThroughSatellite()` amarra um ao
veredito do outro.

### 10.5 As luzes do veículo, às 18:00 — `vehicle/lights.ts`

A tentação é uma lista de nomes, e ela não sobrevive ao acervo: os materiais de
luz aparecem com **47 nomes distintos** nos 49 bakes de cavalo, de cinco
convenções diferentes de quem ripou — inclusive um `parasol_mat_0002_faror` com
"farol" escrito errado em sueco. Uma lista falharia em silêncio no próximo
chassi, e a falha é invisível (ninguém abre o app às 20 h para conferir 58
chassis).

O que todos têm em comum vem do autor do modelo: **`emissiveFactor` não-preto e
`emissiveTexture` — 145 de 145 ocorrências**, e todo bake tem pelo menos uma. É a
mesma doutrina que `paint.ts` usa para achar a tinta: perguntar ao asset. E é o
`emissiveTexture` que torna a regra SEGURA — o brilho já vem localizado, então
mesmo um material com nome de lataria (o MAN tem `cabin_mat_0003_color` emissivo)
só acende onde o autor pintou a lâmpada. Não existe o modo de falha "um painel
inteiro brilhando".

O implemento é o caso contrário — oito materiais de lanterna e **zero** emissivo
autorado — e ali o nome é o único sinal, confiável porque é UM arquivo versionado
com o produto. As capas de acrílico (`alphaMode: BLEND`, opacidade 0,06) ficam de
fora por TRANSPARÊNCIA e não por nome, porque `lanterna-interna-lente` também tem
"lente" no nome e é a placa.

**Por que 18:00 e não `nightness`:** um motorista acende o farol pelo relógio, e
neste cenário o sol se põe às 18,4 h — amarrar à altura do sol deixaria as
lanternas em um quarto de brilho justamente às 18:00. A rampa de 36 minutos lê
como alguém acendendo. O nível mora no RIG (`RIG_BASE.vehLights`) para atravessar
`lerpRig()` como qualquer outro campo. **Registrar também as APAGA**, o que
corrige de passagem as lanternas de todos os 49 bakes brilhando ao meio-dia.

**O que fica de fora, de propósito: FEIXE.** Um farol que joga cone no asfalto
seriam mais duas `SpotLight`, e isso muda `NUM_SPOT_LIGHTS` — quebraria a
pré-compilação para todos os cenários, inclusive os de dia. Se for pedido, o
caminho é ENTRAR no pool de `lamps.ts`.

### 10.6 A bancada

`tools/studio-bench/checks-noite.mjs` — 60 travas, e três delas pegaram defeito
que revisão não pegaria: a transparência parcial estacionada (histerese), os
quatro protótipos sem par (pareamento estrutural) e o vidro de 40 cm acima da
luminária (o mastro tem 40 cm ENTERRADOS abaixo da origem do nó, e subtrair
`baseY` mede a altura do pedaço de geometria, que não é a altura de nada no
mundo). O agrupamento casca/copa é **reimplementado** na bancada de propósito: se
ela importasse a regra do engine, uma regra errada passaria por estar de acordo
consigo mesma — que é exatamente o que o sufixo `_1` fazia.

## 11. A rodada de 2026-08-12 — o canteiro central passou a ser curado

Pedido do dono do produto, sobre o canteiro central do distrito e **só** sobre
ele: fora *"as árvores que têm a raiz exposta e estão flutuando"*, fora *"todas
as mini árvores e os arbustos"*, fora *"as árvores com o tronco esbranquiçado"* —
e *"nos canteiros ao redor manter como está"*.

### 11.1 Por que o acervo não responde por nome

As quatro descrições são visuais, e o `.glb` não ajuda: **`PLANT_BARK` é UM
material só para as dez espécies**, então o que separa o plátano do eucalipto não
é nome nem material — é a região do atlas que as UVs de cada protótipo pegam. A
informação só existe nos pixels e na geometria. `vetoNoCanteiro()`
(`scene/scenery.ts`) mede as três coisas:

| critério | medida | valores das dez espécies |
| --- | --- | --- |
| **porte** | altura da união casca+copa | arbustos 1,6…2,6 m · árvores 7,5…13,0 m |
| **raiz aparente** | raio da casca **abaixo de `y = 0` local**, ÷ altura | `tree_pk_5` 0,274 · `tree_pk_0` 0,176 ‖ demais 0,043…0,059 |
| **casca esbranquiçada** | luminância linear **e** saturação do albedo do tronco, ponderadas por área de triângulo | `tree_pk_2` 0,153/0,04 · `tree_pk_1` 0,135/0,10 ‖ `tree_pk_3` 0,116/0,18 · `tree_pk_0` 0,100/0,21 |

Os três cortes caem em **buracos do histograma**, não em ajuste fino: a raiz
separa por um fator três, e no albedo cada eixo sozinho já separaria — exigir os
dois (claro **E** cinza, que é o que "esbranquiçado" quer dizer) só garante que
a reprovação exige as duas medidas de acordo.

**`y = 0` local é a linha de chão** porque foi ali que o autor da árvore pôs o
terreno: o que está abaixo é raiz, feita para ser enterrada. Como o plantio
ancora pelo pé do **tronco** (§10.2), esse pedaço sobe inteiro para cima da
grama — e é exatamente essa a "aranha de raízes" fotografada.

**O albedo é lido em tempo de carga**, com um `drawImage` de 128² do atlas (16 px
por célula de um atlas 8×8), uma vez por cenário. O atlas vem **dentro** do
`.glb`, então o canvas nunca é de outra origem e a armadilha de CORS que
`vehicle/livery.ts` documenta para as fotos de painel não alcança aqui. Ainda
assim, sem pixels a medida **abstém-se** em vez de reprovar: canteiro pelado é
pior que canteiro com uma espécie a mais.

### 11.2 O veto só tira canteiro — nunca empurra para a grama

A assimetria é o que atende *"manter como está"* nos canteiros ao redor: a
espécie perde o destino que só tinha dentro do canteiro e **mantém** o que já
tinha fora dele. Arbusto continua na grama (que já era o destino de ~97 % deles);
`tree_pk_0/1/2` não tinham outro destino e deixam de ser plantadas — 593 → 530
instâncias, as 63 todas do canteiro.

⚠️ **Tirar o canteiro da lista de alvos NÃO BASTA.** As caixas envolventes das
faixas **se sobrepõem** — a ilha da rotatória (`rb_island`) fica dentro de uma
faixa de grama —, então sortear "na grama" ainda punha planta na ilha. E o teste
tem de ser contra a extensão **crua** da faixa, não contra a recuada de `INSET`:
um arbusto sobrou no canteiro por estar dentro do meio-fio e fora da caixa
recuada, na orla de 1,2 m entre as duas.

### 11.3 A parede de troncos era empilhamento, não passo

O passo de 14 m estava certo. O que estava errado é que **cada espécie alinhada
percorria a faixa inteira sozinha**, e como a estação é `t = (i + 0,5) / n` — a
mesma conta para todas —, as quatro espécies aprovadas caíam nos **mesmos**
pontos, separadas só pelo jitter de ±1,6 m: quatro troncos numa caixa de 3,2 m a
cada 14 m. As espécies da alameda passaram a dividir as estações em round-robin.
Com uma única espécie aprovada (o estado de hoje) o laço é idêntico ao anterior;
o menor vão entre troncos do canteiro subiu de **3,2 m possíveis para 12,1 m
medidos**.

### 11.4 A bancada

`tools/studio-bench/checks-canteiro.mjs` imprime a **ficha medida** de cada
espécie ao lado do veredito e de onde ela foi plantada, e trava: nenhuma espécie
vetada dentro de um canteiro, todo tronco do canteiro de espécie aprovada, o
canteiro não pelado, a grama com a mesma população, nada fora de faixa e nenhum
empilhamento. As medidas são **reimplementadas** na bancada pelo mesmo motivo de
§10.6.

⚠️ **Duas armadilhas de câmera novas, e as duas mentiam com a pose "ok".**
`setVehicleFocus()` prende `controls.target` a um raio do rig e
`setInteriorBounds()` prende lente e mira dentro dos ~58 m do pátio — ambas em
`frameHook`, ou seja **depois** do `lookAt()` do check, e o `controls.update()`
do laço reaponta a câmera. A lente ficava exatamente onde se pediu e olhava para
o **caminhão**: a foto do pé da árvore saiu uma foto do baú. As duas são soltas
no começo das fotos, e a conferência de pose passou a incluir a **mira**.

---

## 12. A rodada de 2026-08-12 — as luzes que faltavam acender

> Continuação direta da §10.5. O relato que abriu a rodada foi *"o implemento e o
> cavalo possui muitas lanternas que ainda nao emitem luzes"*, e a auditoria do
> acervo mostrou que não era afinação: era a GRANULARIDADE da decisão.

### 12.1 A medida que derrubou a premissa: geometria FUNDIDA por material

Varridos os 57 bakes em disco (49 cavalos + `trailer.glb` + `iveco_sway_metallica`),
com um leitor do chunk JSON do glTF e as caixas dos accessors de POSITION:

| medida | valor |
|---|---|
| bakes com material de luz espalhado por > 30 % do comprimento | **37 de 57** |
| bakes em que UM material cobre 93–100 % | 12 |
| pior caso | `cabin_mat_0006_color` do MAN TGX: z −3,06…3,84, **uma primitiva**, e o **único** material emissivo externo do arquivo |

Nos bakes de cavalo há **uma primitiva por material**. Farol, delimitadora de
teto, lanterna de lateral e lanterna traseira do MAN moram na MESMA malha, com o
MESMO material. Não existe cor por material que sirva a isso — e o plano herdado
(clonar material por grupo de posição, §4.3 da passagem de bastão) também não,
porque **não há grupos**: é uma malha só.

Então a cor passou a ser resolvida **por fragmento**, no shader, a partir da
posição de mundo do pixel. É a única granularidade que a geometria do acervo
admite, e ela resolve o implemento junto — `lanterna-pequena-cantos-redondo(VERMELHO)`
tem peças na frente E atrás.

### 12.2 A régua é em METROS da face, não em fração do comprimento

`vehicle/lights.ts` mede as duas faces de cada raiz e o shader decide pela
DISTÂNCIA do fragmento a elas. A alternativa (`zRel` normalizado, 0,20/0,80) foi
medida e reprovada nos dois sentidos:

- as **seis delimitadoras do rufo** do implemento estão em z local −6,19…5,96 com
  as faces em −7,50 e 7,25. Em `zRel` isso é 0,09…0,90, ou seja duas das seis
  cruzariam os limiares e sairiam BRANCA e VERMELHA no meio de uma fileira de
  seis iguais. Em metros todas estão a 1,29–1,31 m das faces e as seis saem
  ÂMBAR, que é o pedido (*"delimitadoras do rufo: âmbar na lateral"*);
- o cluster do farol do FH 2021 tem 0,56 m de profundidade em z, e a régua em
  metros mantém o conjunto inteiro branco em qualquer chassi — 4x2 ou 6x4.

E o DATUM são as próprias lâmpadas, não a caixa da raiz: a caixa é cacheada
(`geometry.boundingBox`, `InstancedMesh.boundingBox`) e nenhum dos dois é
invalidado quando `TrailerAssembly.set()` reescreve os vértices. Medido, a
diferença entre os dois datums é 1 cm no implemento e 1 cm no MAN — e o datum das
lâmpadas dá de graça a propriedade de que a lâmpada mais dianteira e a mais
traseira caem exatamente sobre as faces.

### 12.3 Quem decide se é pisca: a PEÇA, não o material

O relato *"na lateral possui 4 lanternas em cada lateral, abaixo frame metalico"*
tinha uma causa de uma linha:

```
material `lanterna-pisca-quadrado(LEDs)`  × 10 primitivas
  peças  `lanterna-lateral-chassis(leds)-001…010`
         x = ±1,30 · y = 1,28 (SOB o frame) · z = 4,17 … −7,21  (5 por lado)
```

O material chama "pisca" e a peça é `lanterna-lateral-chassis`: quem autorou
reusou o material do pisca quadrado nas lanternas de POSIÇÃO da lateral. Os
piscas de verdade são `lanterna-pisca-circular-D/E`, em z = 7,24.

⚠️ E o nome do nó vem como `<peça>_<material>_<n>`, então testar o nó cru daria o
mesmo veredito que testar o material. `nomeDaPeca()` tira o sufixo ancorado no
fim — nunca todas as ocorrências, porque em `lanterna-pisca-circular-E_lanterna-pisca-circular_0`
a peça REALMENTE se chama pisca.

A regra: **quando a peça tem nome próprio de lâmpada, é ela que diz; senão vale o
material**, e o que é excluído pelo material passa por `readmitirPontaEscura()`.
Essa rede de segurança existe porque `r_light_mat_0000_animated_blinkers_col` é a
malha INTEIRA do conjunto traseiro em 6 bakes Scania e o ÚNICO material de luz da
traseira deles — apagá-lo deixava aqueles caminhões sem lanterna traseira. A régua
é 1,20 m até a lâmpada acesa mais próxima, e ela sai de quatro medidas:

| caso | z | acesa mais próxima | veredito |
|---|---|---|---|
| VW Titan `truck_mat_0001_pisca` | −2,24…−2,16 | farol a 0,55 m | fica apagado |
| Scania S 2024e `r_bumper…blinkers` | 3,22…3,29 | 1,46 m | **volta** |
| Scania R/S 2016 `r_light…blinkers` | 3,14…3,20 | 2,90 m | **volta** |
| implemento `lanterna-pisca-circular` | 7,24 | sobreposta | fica apagado |

⚠️ **A readmissão roda ANTES do cálculo das faces**, e a ordem inversa é um defeito
silencioso que a bancada não pega (ela carrega o Volvo, que não tem o caso). No
Scania a lâmpada devolvida É o conjunto traseiro, em z 3,14…3,20, e a acesa mais
traseira que sobrava era o `sideskirt` em 0,24: com as faces calculadas antes, a
traseira readmitida ficaria a 2,9 m da "face de trás" e sairia ÂMBAR — a correção
entregaria o defeito que ela existe para corrigir.

### 12.4 "interna" era EMBUTIDA, não "de dentro do baú"

As seis ovais do rufo saíam brancas porque `INTERNA_RE` casava `interna` em
`lanterna-interna-lente` e as classificava como luz de carga. Medido: x = ±1,21,
y = 4,04 — quina superior EXTERNA, ao longo dos 12 m. São delimitadoras laterais.
A palavra saiu do regex.

### 12.5 A fita reflete — `vehicle/retroreflect.ts` (NOVO)

Um retrorrefletor devolve a luz **para a fonte**, então o lóbulo é em torno de
`L`, não de `reflect(-L, N)`. A conta é sobre o ÂNGULO DE OBSERVAÇÃO, e as luzes
saem das próprias do three (`getSpotLightInfo()` etc.), não de um uniforme nosso —
o que faz o farol do cavalo acender a fita do implemento de graça.

⚠️ **Helper de GLSL vai em `<common>`, corpo vai no ponto de injeção.**
`<lights_fragment_end>` fica DENTRO de `void main()` e GLSL não admite função
aninhada: pôr a função ali dá `ERROR: '{' : syntax error` em todo material de
fita, e o `tsc` e o esbuild passam limpos. `<common>` é onde `struct IncidentLight`
é declarada, e o three só resolve os `#include` DEPOIS de `onBeforeCompile`.

### 12.6 As lâmpadas emitem — `vehicle/beams.ts` (NOVO)

O pool de `lamps.ts` cresceu de **8 para 12**: 8 postes + 4 do veículo (2 faróis,
2 lanternas traseiras). Não é luz nova, é vaga reservada — `NUM_SPOT_LIGHTS`
continua sendo constante de módulo e `warmLightPrograms()` continua pré-compilando
exatamente duas configurações.

E `lampsWanted()` passou a olhar `vehLights` além de `lampIntensity`: sem isso o
preset `ciclorama` (que autora `lampIntensity: 0`) deixaria as doze fora da cena e
o farol não emitiria nada às 21 h. Duas condições, UM interruptor — um terceiro
estado seria uma terceira configuração de shader.

### 12.7 O vidro da luminária não batia porque a luminária é uma CUNHA

Relato: *"a luz do poste, a posicao dela, oque seria o vidro, nao esta batendo
corretamente como deveria, a angulacao"*. A sonda `checks-poste-vidro.mjs` mediu
nos onze postes e o perfil por faixas de altura (36 vértices ao todo) explicou:

```
y 9,692          a 1,626        t ±0,21    ← ponta de dentro, EMBAIXO
y 9,826…9,860    a 1,593…1,769  t ±0,21
y 9,860…9,894    a 2,467        t ±0,21    ← ponta de fora, NO ALTO
y 9,994…10,028   a 2,434        t ±0,21
```

A carcaça sobe 0,17 m ao longo de 0,84 m de alcance — **11,3°** — e o vidro era
uma caixa HORIZONTAL: encostava numa ponta e ficava 17 cm no ar na outra. Mais
dois defeitos somados: `lensT` era medido e **descartado** na saída de
`medirLuminaria()` (a largura vinha de `LAMP_LENS_ASPECT`, constante da luminária
PROCEDURAL: 0,437 × 2 × 0,55 = 0,481 contra 0,42 da carcaça), e `outreach` era a
MÉDIA dos vértices além do corte, que inclui o tubo do braço e puxava o centro
9 cm para dentro.

| medida | antes | depois |
|---|---|---|
| desvio do vidro em planta | 0,093 m | **0,001 m** |
| largura do vidro × carcaça | 0,48 × 0,42 | **0,37 × 0,42** |
| alcance do braço | 1,94 m | **2,03 m** |
| inclinação do vidro | 0° | **11,3°**, a da face |

⚠️ **REGRA REUSÁVEL, e ela custou uma tentativa inteira: numa peça INCLINADA,
faixa de altura não recorta a face — recorta o comprimento.** Medir "o quinto de
baixo" da luminária devolveu 0,21 m de comprimento contra 0,87 m do conjunto, o
que parece um erro de conta e não é: num sólido em cunha, cortar por ALTURA
seleciona uma fatia ao longo do ALCANCE. A medida certa de uma face inclinada é o
PLANO dela (menor y por faixa de alcance, reta ajustada), nunca uma faixa. Vale
para qualquer coisa deste engine que meça superfície por corte de altura.

Achado de brinde, ainda latente: `rebuildSiteLenses()` fazia
`rotation.y = atan2(aimZ, aimX)`, o ESPELHO do correto `atan2(-aimZ, aimX)` —
inofensivo enquanto o braço é ±X exato (aimZ = 0) e errado por −2θ em qualquer set
com mastro em diagonal ou raiz girada. Corrigido; `placeLamp()` e o ramo `set` de
`applyLampLayout()` já usavam a conta certa.

### 12.8 Os três relatos da tarde — e o que cada um era de fato

**"tem o feixe de luz, mas nao sai da frontal".** O feixe estava CERTO: medido, a
fonte nasce em z −0,82, que é exatamente a face dianteira do conjunto, e o cone
cai no asfalto à frente. Quem estava apagada era a LENTE. A pilha de acertos já
dizia por quê desde a rodada anterior — `cabin_mat_0006_glass_ex` na frente, com
opacidade 0,8 —, e o que faltava não era nível (2,2 → 8 → 40 sem diferença: o
tonemap roda ANTES da mistura) e sim GRANULARIDADE, a mesma lição de §12.1: a capa
é **uma malha só** (`cabin_p7`, y 0,53…3,83 — para-brisa, janela e capa de farol),
então a decisão desce para o fragmento. `vehicle/headlight-cover.ts` clareia a capa
**só dentro da caixa do farol** (medida por `lights.ts`) e **só na proporção de
`vehLights`**. O para-brisa não muda (ele começa em y ~1,8; a caixa do farol
termina em 1,35 com folga) e de dia nada muda em lugar nenhum.

**"essa da frontal do implemento nao acende".** Medido na face dianteira do baú
(z local 7,25): `lanterna-pisca-circular-E` em x 1,12…1,21 e `-D` em
x −1,21…−1,12, y 1,32…1,41 — uma redonda de 9 cm em cada quina inferior da frente.
Um **semirreboque não tem seta dianteira**: aquilo é lanterna de POSIÇÃO, e quem
autorou reusou a peça do pisca circular, do mesmo jeito que reusou o material do
pisca quadrado nas dez da lateral. Segunda régua de readmissão, geométrica e não
nominal: **raiz SEM farol + lâmpada na face dianteira**. Ela não devolve seta
nenhuma do cavalo (aquelas raízes têm farol) nem seta traseira de implemento.
Cor: âmbar, porque a lente é âmbar — mesma doutrina do `(VERMELHO)`.

⚠️ E o caminho "a peça diz pisca" **deixou de ser terminal**. Ele descartava o
material na hora, então a régua acima nunca via a lanterna que ela existe para
acender. Agora os dois casos vão para a lista de espera e `readmitirPontaEscura()`
decide com as matrizes de mundo já valendo. O campo `piscaPorPeca` mantém as duas
réguas separadas: a da "ponta escura" continua NÃO valendo quando a peça afirma
ser seta — ela existe para material de nome errado em conjunto fundido, onde a
peça não opina.

**"a da traseira do cavalo nao afeta o implemento".** Verdade: o par da cauda mora
no extremo do comboio e joga no asfalto. A traseira do CAVALO fica no meio dele,
com a parede dianteira do baú a ~2 m — superfície branca, grande e perto. Duas
vagas novas (pool **12 → 14**), com o alvo na ALTURA da lanterna e não no chão, e
apagadas quando não há implemento (aí a traseira do cavalo já É a cauda).

### 12.9 A bancada

`checks-noite.mjs` ganhou as travas de lanterna de posição, delimitadora do rufo,
feixe e fita, e **perdeu** a trava "nenhum material com pisca no nome acende" — ela
mascarava justamente o defeito de §12.3. `checks-poste-vidro.mjs` é sonda nova.

⚠️ **Uma sonda não pode posar a câmera e depois rodar quadros.** Medido: o laço
reancora a órbita no veículo (`controls.target` volta para (0,33 · 2,30 · 5,88),
`maxDistance` 43,4 m) e `OrbitControls.update()` roda sem consultar `enabled`. Um
pedido a 72 m do veículo virava 43 m no quadro seguinte. A ordem certa é assentar
a luz primeiro e posar por último, chamando `captureViewport()` sem um único
`B.frame()` no meio — ela chama `stopLoop()` e renderiza com a câmera como está.

---

## 13. A rodada de 2026-08-12 — o painel do editor virou o próprio baú

Cinco relatos numa mensagem, e quatro deles são **o mesmo defeito**: *"parece que
tem uns 3 modelos remontados ali"*, *"não parece com o modelo 3D"*, *"o quadrado
não fica alinhado"*, *"fica cortado ou com espaço até o frame"*. O quinto é
separado: *"adicionar uma porta trava"*.

### 13.1 O defeito único: TRÊS retângulos onde só pode haver um

`vehicle/livery-snapshot.ts` já fotografava o implemento em ortográfica a cada
rebuild (§ da rodada anterior), e o card já usava essa foto em registro exato. O
**palco do editor**, não: ele ainda dimensionava a tela do fabric por
`canvasRect()`, uma conta herdada da foto estática que esticava a tela por
`1 / faixa pintável` para encaixá-la num vazado que **não existe mais** —
`panels/lateral.png` saiu do pacote de assets, então a medição 404 em silêncio e
`win` degradava para o quadrado unitário.

MEDIDO na bancada (`tools/studio-bench/checks-livery-registro.mjs`), palco de
961 × 194,9 px, ANTES:

| | x | y | w | h |
|---|---|---|---|---|
| chapa no retrato | 0,53 % | 1,75 % | 98,93 % | 92,47 % |
| tela do fabric | 0,53 % | 1,75 % | **100,0 %** | **113,72 %** |

**+23,0 % de altura com a origem certa.** A arte e o plano da frente iam ficando
cada vez mais abaixo da ferragem do retrato conforme se descia o painel, e as
duas apareciam juntas: dois trilhos, duas cantoneiras, dois para-choques. Na
traseira, +13,7 % de altura e +6,2 % de largura.

E um segundo efeito que explica "não parece com o modelo": a caixa resultante
tinha razão 4,336 contra 5,278 do buffer da tela (a razão da chapa) — **tudo era
mostrado 22 % mais alto do que sai no baú**. Círculo virava elipse na tela.

A correção é uma linha de doutrina: **a caixa da tela é `snap.box` e nada mais.**
Ela vem do mesmo render que produziu a foto, então o registro fecha por
construção. Depois: desvio 0 nos quatro números, nas duas faces, e **também
depois de adicionar uma porta** (o palco se reenquadra sozinho via
`setStageResizer`, porque o retrato é assíncrono e a caixa da chapa muda).

### 13.2 O retrato foi para TRÁS da arte

A foto estática era uma **moldura**: opaca em volta, vazada no meio, e por isso
tinha de ficar na frente. O retrato é o baú inteiro — chapa incluída. Na frente
ele esconderia o desenho, e o buraco que se abrisse nele só poderia ser um
RETÂNGULO enquanto a ferragem que precisa cobrir a arte tem silhueta de perfil.
Pior: ele repintava a mesma ferragem que o plano da frente já desenhava.

Atrás (`.ts-pw-behind`, ligada por `publishWindow()`), cada pixel tem **uma
fonte só**:

```
retrato                 a chapa como ela é — emenda, friso, rebite, cor corrente
tela do fabric          a arte do cliente, transparente
.ts-structure--front    o MESMO render com a chapa em depth-only
```

A oclusão deixou de ser aproximada por um retângulo e passou a ser a do modelo.

### 13.3 A área pintável agora é LIDA, não inferida

O passe da frente já é a resposta: um pixel com alfa ali é um pixel em que a arte
some atrás de metal. `measurePaintRect()` lê o alfa do recorte e anda **das
bordas para dentro** até a primeira linha/coluna livre — recuo do FRAME, não
"maior vão livre", porque vão de porta, varão e borracha central são obstruções
INTERIORES e o adesivo passa por cima delas.

Medido no `trailer.glb`: lateral 74 / 11 mm nos montantes, 210 mm de cantoneira,
131 mm de trilho — os 210 batem com `cap-top.h = 0,21` do manifesto e os 131 com
a faixa 0–127 mm que `measurePaintable()` já apontava. Traseira 92 / 92 / 129 /
13 mm.

Isso **aposenta** `measurePaintable()` (caixas de malha, com o `console.warn` que
existia porque ela erra) para degradação. O encaixe de arrasto e o "Alinhar ao
painel" já leem `outlineFrame()`, então é essa medida que faz encostar um objeto
no frame ser exato — sem folga e sem corte, que é o pedido.

**O tracejado NÃO é desenhado**, e a distinção importa: a MEDIDA ficou, o
DESENHO saiu a pedido (*"não quero aquelas linhas tracejadas"*). Ele deixou de
ser necessário no mesmo movimento que o tornou preciso — enquanto a moldura era
uma foto esticada com um buraco retangular, a linha era a única pista de onde a
ferragem ia cair; com a ferragem desenhada por cima da arte na silhueta exata do
modelo, o limite se vê olhando o painel.

### 13.4 O quadro fecha no frame; a luz é própria e fixa

Duas correções pedidas olhando a tela.

**Enquadramento.** As margens de contexto eram 8 / 5 / **18** cm — e os 18 cm de
baixo punham para-lama, lanterna de chassi e sombra de rodado na foto. O quadro
passa a fechar no FRAME, e cada margem tem uma peça que a justifica:

| | lateral | traseira | o que ela traz |
|---|---|---|---|
| lados | **15 cm** | 3 cm | o montante de canto tem 142–174 mm e entra só 5–80 mm na chapa: quase toda a peça fica AO LADO dela ("o frame da frente não está mostrando") |
| topo | 1 cm | 1 cm | a cantoneira já está dentro da chapa |
| pé | **9 cm** | **31 cm** | o trilho lateral nasce 82,5 mm abaixo do piso; na traseira, ver abaixo |

⚠️ **A margem conta da CAIXA DA CHAPA, e na traseira ela não chega ao piso.**
`PANEL_MM.rear` mede 2 577 mm num baú de 2 790 — a chapa termina ~213 mm acima
do piso, porque as folhas são geometria própria e descem além dela. Cada
centímetro pedido só começa a valer depois de vencer esse degrau, e foi ele que
fez 15 e depois 21 cm continuarem cortando acima da faixa refletiva inferior. A
bancada mede a fração de pixel VERMELHO da faixa, e o degrau aparece como um
salto: 21 cm → 1,5 %, 27 cm → 12,9 %, 34 cm → 13,4 % ("passando muito"). 31 cm
fecham rente ao pé dela.

**Luz.** O painel é um DOCUMENTO: tem de sair igual às três da tarde e às onze
da noite. As luzes da cena são apagadas durante o disparo e entra um
`RoomEnvironment` neutro **assado no próprio renderizador do snapshot** — uma
textura de render-target não atravessa contexto WebGL, então o ambiente vindo do
renderizador principal chegava VAZIO, e é por isso que o metal fechava preto.

**E não entra nenhuma direcional**, que é o achado do terceiro ajuste.
`vehicle/retroreflect.ts` soma na fita 3M um lóbulo
`Σ_luzes cor·(N·L)·(0,30 + ganho·(L·V)⁴)` percorrendo `directionalLights[]`,
`pointLights[]` e `spotLights[]`. A pose óbvia para fotografar um painel — chave
perto do eixo da lente — põe `L·V ≈ 1` e dispara o lóbulo inteiro: **a fita
estoura em branco e perde o vermelho**, e subir a exposição para clarear a chapa
piorava isso na mesma proporção. `HemisphereLight` e `scene.environment` não
entram naqueles laços, então com só esses dois o termo retro é zero por
construção. O relevo continua legível porque IBL não é luz chapada.

**Duas causas foram encontradas ATRÁS da luz**, e as duas explicam relatos que
pareciam de exposição:

* **o metal renderizava preto.** `models.refreshVehicleReflection()` prende em
  cada material do veículo o cubemap da sonda local, assado no renderizador
  PRINCIPAL. Um material com `envMap` próprio ignora `scene.environment`, e a
  textura de um render-target não atravessa contexto de WebGL — aqui ela chega
  vazia. Metal quase não tem difusa: sem nada para refletir, ele não tem nada.
  A correção é trocar o `envMap` (nunca `null`, que mudaria `USE_ENVMAP` e
  recompilaria ~2 150 programas por face);
* **as três faces viam ambientes diferentes.** O `RoomEnvironment` é uma
  CAIXA, com painéis emissivos em posições fixas. Sob a mesma exposição, a
  lateral do motorista olhava para uma parede e a do passageiro para outra —
  "esse lado está muito bom, mas esse está um pouco estourado". A correção é
  girar o ambiente pelo azimute da face (`scene.environmentRotation` **e**
  `material.envMapRotation`, senão metade do baú fica fora de fase com a
  outra).

E uma coisa que NÃO se faz: cravar `envMapIntensity` igual em todo material. Foi
tentado "para as três responderem igual" e o frame preto fosco da traseira, que
tem ganho baixo por autoria, passou a refletir a sala e virou CINZA. O ganho por
material é parte do modelo; um retrato do modelo não o reescreve.

Calibrado por medida, com a MEDIANA da chapa (a média era puxada por varões e
fechos que cruzam a área da traseira):

| | mediana (motorista/passageiro/traseira) | estourado | veredito |
|---|---|---|---|
| chave 1,15 · env 0,85 | 218 / — / 170 (média) | 0 % | "muito escuros" |
| chave 1,55 · env 1,35 · exp 1,3 | 241 / — / 215 (média) | 0 % | "estourado; fita branca" |
| sem direcional · gradiente uniforme | 209 / 209 / 209 | 0 % | metal preto (gradiente LDR não renderiza) |
| **RoomEnvironment girado + envMap trocado** | **234 / 238 / 239** | **0 %** | ✓ |

O último aparo é o único empírico do arquivo: a folha da porta tem albedo mais
alto que a chapa do corpo e ficava em 247 ("muito esbranquiçada"). A 247 ela
está no OMBRO do ACES, onde a curva quase não anda — cortar 14 % da exposição
moveu UM nível, e foi preciso cortar ~metade (`EXPOSURE_TRIM.rear = 0,52`).

### 13.5 A porta: 2 932 ms → 0,9 ms no clique

`models.setTrailerDoors()` delega a `setTrailerDims({})` — a sequência
destrutiva de oito passos — porque recortar um vão reescreve o corpo branco
inteiro. Não dá para deixá-la barata sem reescrever a geometria paramétrica, e
não foi isso que se pediu: *"prefiro que tenha um loading do que ele travar"*.

O que mudou é **o que acontece antes** e **o que sai do caminho**:

* `setDoorsFor()` recompõe o 2D e avisa o inspetor **antes** de chamar a
  geometria — a porta aparece no desenho no quadro do clique;
* o recorte é coalescido e adiado 60 ms (`setDoorsApplier`, injetado por
  studio.ts como o de medidas), tempo de o estado ocupado PINTAR;
* o indicador mora no **inspetor**, não na pílula: `#cab-switching` (z 9) e o véu
  do viewport ficam atrás de `#editor-modal` (z 9999), ou seja eram invisíveis
  exatamente na tela do botão. Os controles de porta desabilitam junto — um
  segundo clique enfileirava outro recorte de três segundos;
* `refreshSnapshots()` virou assíncrona, cede um quadro **antes** de cada face
  (com o `await` no fim do laço a primeira face dividia tarefa com o recorte) e
  troca `toDataURL` por `toBlob` + object URL;
* `measurePaintable()` só roda enquanto o retrato não mediu — eram três
  varreduras de ~2 150 malhas por rebuild para produzir um número descartado.

| | antes | depois |
|---|---|---|
| bloqueio no clique | 2 932 ms | **0,9 ms** |
| maior quadro sem pintar | 2 932 ms | **987 ms** (o recorte, com indicador) |
| `attachOverlays` | 136 ms | **2,7 ms** |
| `refreshSnapshots` síncrono | 723 ms | **1,1 ms** |

Os ~700 ms que sobram são `rig.set()` + `buildLiveryPanels()`, e ficam.

### 13.6 Motorista e Passageiro, nunca esquerda e direita

Esquerda e direita dependem de onde quem fala está: de frente para o caminhão a
lateral do motorista está à direita de quem olha; de dentro da cabine, à
esquerda. Um pintor que recebe "logo na lateral esquerda" tem 50 % de chance de
aplicar do lado errado, e errar isso custa uma película. As **chaves internas
continuam `left`/`right`** — elas nomeiam SIDE_L/SIDE_R, a `uv1` e as três telas
do fabric. O que muda é rótulo: `SIDE_LABEL` (vehicle/livery.ts), `FACE_LABEL`
(ui/livery-measures.ts, cópia porque aquele arquivo não pode importar este) e o
HTML de `core/template.ts`.

### 13.7 A bancada

`checks-livery-registro.mjs` (NOVO) decide tudo isto por retângulo e por
milissegundo: caixa do palco contra `snap.box`, razão contra razão, recuo do
frame em mm, histograma de luminância da chapa, bloqueio no clique e **maior
quadro sem pintar** — que é o único número honesto de "trava?", porque o usuário
não sente a soma do trabalho, sente o intervalo em que a tela não responde.
