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

> ✅ **CASO FECHADO EM 2026-08-10, e esta seção inteira é histórica.** O HDR próprio FOI
> assado. Reconferido no manifesto em 2026-08-13: `distrito-industrial` aponta para
> `environments/distrito-industrial/sky.hdr` + `sky-night.hdr`, e `serra` reusa esse mesmo
> par. `environments/rodovia/sky.hdr` (5,5 MB) **só aparece em texto de nota** — está
> órfão e pode ser apagado. O `hdriNote` do manifesto registra a troca e por quê (o plate
> antigo tinha o sol a 45,4° — meio-dia — contra um estúdio que abre às 17:45, e uma linha
> de árvores sem escala; o novo é um `_puresky`).

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

> **⚠️ ESTES NÚMEROS SÃO DE 2026-08-03 E CADUCARAM.** Medido em 2026-08-12/13:
> `distrito-industrial/set.glb` é **18,1 MB** e traz **36 imagens** (~133 MB de VRAM);
> `serra/set.glb`, que entrou no lugar do `armazem`, é **12,0 MB** com **66 imagens**
> (~191 MB). O alvo de 35 MB por cenário continua batido, mas com folga bem menor do que
> este parágrafo comemora — e a frase "o set não carrega textura nenhuma" continua
> verdadeira só para o **chão** (que vem dos conjuntos compartilhados), não para o arquivo.
> É essa mudança de premissa que reabre a §6.

---

## 6. Pipeline de asset (`gltf-transform`)

A urgência de **KTX2 tornou-se sem efeito** e a linha *"KTX2 não é opcional"* foi removida
daqui. O motivo é §2: os sets viajam sem textura, então a pressão de memória de GPU que
justificava KTX2 nunca chegou. **Não existe `KTX2Loader` no projeto** e não há razão atual
para adicionar um. Só `/vendor/draco/` é vendorizado (`config/assets.ts` →
`dracoDecoderDir: "/vendor/draco/"`).

> **⚠️ A PREMISSA ACIMA CAIU — e a conclusão volta a estar em aberto.** Era verdade em
> 2026-08-03. Hoje os sets TRAZEM textura (ver a nota no fim da §5) e a pressão de VRAM
> chegou: medida em 2026-08-13, a cena de referência fica em **~857 MB** depois de uma
> passagem de redimensionamento que já tirou 290 MB do acervo — e **358 MB disso são os
> dezesseis mapas 2048² de chão**, que foram passados por um portão de erro medido e **não
> têm folga nenhuma** para reduzir. Empacotá-los em ORM também não fecha a conta (as duas
> medições estão em `OTIMIZACAO-2026-08-13.md` §3). Ou seja: para o maior item isolado do
> orçamento, KTX2 deixou de ser "sem efeito" e passou a ser a **única** saída conhecida.
> O que NÃO mudou é o cuidado: UASTC é quase sem perdas, ETC1S não é, e qualquer passo
> novo tem de respeitar as armadilhas registradas logo abaixo (nada de `quantize`, nada de
> `resize`, nada de `dedup` sem `--materials false`).

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

> Esta rejeição por caixa **deixou de existir** em §11.5: com a grelha, cada
> célula tem um dono só e "sortear na grama" não tem como cair no canteiro. O
> parágrafo fica porque a sobreposição das caixas continua sendo verdade — ela é
> a razão de a caixa não servir para nada disto.

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

### 11.5 A caixa envolvente não é a faixa — as árvores da rotatória

> Relato: *"as arvores estao no meio da rotatoria, deveriam estar no grama
> proximo a cerca"*. Data: 2026-08-13.

O plantio sorteava dentro do `Box3` da faixa, e um `Box3` só diz a verdade sobre
a malha quando a malha é um **retângulo cheio**. Duas malhas deste set não são:

| | medida |
|---|---|
| `turf_e_tail` / `turf_w_tail` | caixa x −28,6…10,4 · z 105…133 · **936 m² úteis cada** |
| bordo norte real das duas | o **arco sul** do balão (R 19 m, centro x −9,12 · z 105) — mais de metade da caixa é a rotatória |
| cota delas | +1 cm (grama) **sob** o `yard_tail` de betão a +7 cm — geometria que nunca aparece |
| peso no sorteio | **5,2 %** da área "de grama", as duas juntas |

E são **duas** porque `add_slab` emitia o rabo do corredor também para as bandas
leste e oeste da turfa, que nunca encostam nele: duas lajes idênticas e
coincidentes, 680 vértices cada. O gerador foi corrigido junto
(`build_industrial_park.py`), mas a correção que vale para o `.glb` em disco é a
do engine.

Resultado medido pela bancada, **antes**: 29 plantas em pavimento, **21 delas
dentro do disco de 19 m** — incluindo três `tree_pk_5` de 13 m a 9,7…11,0 m do
centro, ou seja na pista circulatória.

**A faixa passou a ser a malha, amostrada numa grelha de 60 cm.** Uma passada
rasteriza os triângulos de cada faixa (cota da grama + dono da célula), outra faz
o mesmo com o pavimento (materiais `CONCRETE|ASPHALT|KERB|PAVER|LINE_PAINT`, e só
lajes de menos de 1,5 m de espessura, ou o campo entraria na conta por causa de
um pico a 400 m). Uma célula é plantável se **a grama daquela faixa a cobre**, se
**nada duro está por cima dela** e se ela está a `INSET` de qualquer célula que
falhe as duas primeiras — o recuo do meio-fio deixou de ser um encolhimento da
caixa e passou a ser um recuo do contorno de verdade.

Três consequências que são o motivo de a grelha valer o que custa:

1. a **área** passou a ser a plantável de facto (36 345 m²), não a das caixas —
   uma faixa côncava deixou de pedir mais árvores do que tem chão para elas;
2. o **sorteio deixou de ser rejeitado**: sorteia-se uma célula e um ponto dentro
   dela, e cada tentativa acerta. Saíram o laço de oito tentativas e a rejeição
   por caixa de canteiro do ⚠️ de §11.2;
3. uma faixa que fica **sem célula nenhuma deixa de ser faixa** — é como as duas
   `turf_*_tail` soterradas somem, sem que nenhum nome seja citado em código.

**Depois:** 9 faixas → 7, nenhuma planta sobre pavimento, nenhuma dentro do
balão fora da ilha, as mesmas 530 instâncias e a mesma curadoria de canteiro
(§11.2 continua a passar). Custo: **46 ms** por carga de cenário, uma vez.

`tools/studio-bench/checks-rotatoria.mjs` é a trava, e ela **não pergunta pela
caixa**: desce um raio de 5 m de altura sobre cada tronco e olha em que material
ele bate primeiro. É a mesma pergunta que a foto responde, feita de um jeito que
não depende de nenhuma decisão do módulo verificado.

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

---

## 14. A rodada de 2026-08-13 — a pintura que apagava a própria definição

Nove pedidos numa sessão, e um DEFEITO que apareceu no meio deles e era maior
que todos: **com "pintar o implemento com a cor do cavalo" ligado, todo recorte
de geometria destruía as chapas de livery e não recriava nenhuma.**

### 14.1 O defeito raiz, e por que ele era invisível na leitura

O relato foi modesto — *"adicionei uma segunda porta, ela foi adicionada no
modelo 3d, mas não atualizou no livery"* —, e a bancada
(`checks-porta2-diag-0813.mjs`) mostrou o tamanho real:

```
  102ms  retrato#1 / 0 vãos / 1 malha SIDE_L / ocioso
  555ms  retrato#2 / 0 vãos / 1 malha SIDE_L / ocioso
  — clique "+ Adicionar porta" —
 3142ms  retrato#2 / 1 vão  / 0 malhas SIDE_L / ocioso      ← as chapas SUMIRAM
 + "[livery] nenhuma malha do corpo branco" e "[paint] front wall not found"
```

**A causa é circular, e é isso que a torna invisível numa revisão de código:**
`trailerPanelMeshes()` reconhece a carroceria pelo MATERIAL branco de fábrica, e
`setPaintTarget('both')` troca esse material por `carpaint` em todas elas. A
partir daí nada no arquivo consegue mais reconhecer a carroceria — inclusive as
três funções que precisam reconhecê-la para RECRIAR as chapas
(`bodyPanelPred`, `buildLiveryPanels`, `buildFrontWallOverlay`). **A pintura
apagava a definição de "o que é carroceria".**

O estrago ia muito além da porta: sem chapa não há arte no baú, não há retrato
para o editor (o palco congela na última foto), não há parede dianteira
pintável, e `bboxOfMatching(bodyPanelPred)` devolve caixa VAZIA — que é o que o
engate e a montagem do Thermo King leem.

**A resposta NÃO é casar também por `carpaint`**: aquele material está
igualmente no teto e na carcaça do Thermo King, e incluí-los na carroceria
devolveria a caixa grande demais — o defeito que o cabeçalho de `bodyPanelPred`
já registra ter custado 0,83 m no engate. O que identifica a carroceria é o que
ela ERA, e isso já estava guardado: `factoryMaterials()` lê `userData.origMat`
(escrito por `setPaintTarget` antes de trocar) e `trimOrigMat` (idem em
`vehicle/trim.ts`), nessa ordem. Trava: `checks-pintura-chapa-0813.mjs`.

### 14.2 A cor da FACE ganha da cor do cavalo

*"selecionei pintar da mesma cor do cavalo nas laterais, e na frente e traseira
selecionei a cor preta"*. As duas camadas são independentes e se empilham — a
CHAPA (o material do 3D, vale para o implemento inteiro) e o FUNDO (o
`backgroundColor` de UMA tela do fabric, que vira textura e é desenhado por
cima). O que estava errado era `setBackgroundsForPaint()`, apagado: ligar a
caixa LIMPAVA o fundo das quatro telas. Fazia sentido quando `DEFAULT_BG` era
branco; com ele transparente não há nada a limpar — só o que o usuário escolheu,
e isso é para manter.

A interface passou a dizer a pilha em vez de um valor: duas linhas da MESMA
forma (pastilha · nome · estado), que é a do card de Configurações
(`.ts-cfg__row`) — o estúdio inteiro tem um jeito só de dizer "isto tem uma cor".

### 14.3 O texto mole no baú era resolução, e a lateral era a pior das quatro

*"o texto que eu coloco pelo próprio livery fica tão ruim a qualidade"*. É
magnificação pura: a lateral estava a 2048 px / 14 655 mm = **140 px/m**, uma
letra de 40 cm virava 56 px de textura e aparecia com ~130 px na tela. E o número
denuncia a origem: a traseira sempre esteve a **377 px/m** — a lateral, que é a
face grande e a que se olha de perto, tinha a pior resolução do conjunto por
herança dos tamanhos literais de `core/template.ts`, que vinham de medir uma
FOTO que nem existe mais.

Lateral 140 → **280 px/m**, traseira e testeira 377 → **566**. O teto de textura
subiu de 4 096 para 8 192 px e passou a ser **sondado** (`probeHardware()
.maxTextureSize`), senão ele mordia no primeiro baú e rebaixava a densidade de
volta.

### 14.4 O floco metálico da FOTO é escolhido com o pixel da FOTO

*"no render em qualidade máxima os flakes metálicos ficam muito grandes"*. O
shader escolhe a oitava do floco — e quanto dele é desenhado DISCRETO em vez de
dissolvido em rugosidade — a partir de `fwidth()`, que mede o pixel do BUFFER em
curso. A captura "Alta" desenha 7680 px de aresta, então o mesmo floco de 3,3 mm
passa de sub-pixel (invisível, virou brilho) a ~4 px (visível, e grande). Não é
o floco que cresceu: é a resolução que finalmente o resolveu.

`uPxScale` multiplica o pixel de referência pela razão de resolução, e a captura
o liga e desliga em volta dos 16 ladrilhos. Com 1 (a tela) nada muda, byte a
byte. Chave de programa v5 → v6.

### 14.5 O TETO virou uma face de livery

*"deve adicionar um livery para o teto"*. Ele é a face mais SIMPLES das cinco,
não a mais complexa: sem porta, sem fita refletiva, sem cantoneira, sem
para-choque — `defaultLayers()` sai cedo e a pilha estrutural fica vazia.

**Ele não é RECORTADO**, e é a única da lista que não é: `TrailerBody.rebuild()`
já escreve os triângulos do teto num buffer próprio (`TRAILER_ROOF`), justamente
para o teto poder trocar de material sozinho. O que faltava era `uv1`, e é o que
`tagRoofLiveryUV()` faz — no mesmo passo em que as outras quatro são recortadas,
porque a geometria dele é reescrita a cada medida.

Duas consequências que valem registro:

* **`u` e `v` do teto saem do plano XZ**; `y` não entra em nada. Fixada a
  leitura "de cima, traseira à esquerda", `v` está determinado e não é escolha:
  com a lente em −Y e o +Z à direita da tela, o para-cima é o +X, e como `v`
  cresce para baixo ele corre de `max.x` para `min.x`;
* **a sobreposição de arte precisou de limpeza**. As quatro chapas são malhas
  novas a cada recorte; o teto SOBREVIVE, e sem `userData.liveryOverlay` + a
  remoção no topo de `makeLiveryOverlay()` cada mudança de medida penduraria mais
  uma cópia translúcida coplanar — o teto escurecendo a cada centímetro digitado.

### 14.6 O Thermo King virou camada, e Configurações encolheu

*"em vez de ter a configuração de teto e thermo king em configurações, devem
estar em liveries"* · *"no livery da frontal, o thermo king deve ser uma camada
como a base"*. O teto virou face (a cor dele é o Fundo dela); o Thermo King
virou uma linha fixa na lista de camadas da TESTEIRA, que é a única face em que
ele aparece. A diferença de mecanismo (o Fundo é textura, ele é uma demão do 3D)
é nossa e não do usuário — para quem desenha, as duas são "coisas que têm cor
nesta face".

**A capacidade continua inteira em `vehicle/trim.ts`** (`paintable: true` nas
duas): o que saiu do card foi a PERGUNTA, não a resposta. `TRIM_PAINT_KEYS`
segue descrevendo o motor e o card passou a filtrar com `CARD_PAINT_KEYS`.
Paralamas fica — ele não é superfície plotável e não teria para onde ir.

### 14.7 Arrastar o painel, e o zoom que não era onde se pensava

O palco ganhou arrasto: o botão esquerdo MOVE a vista quando não há objeto sob o
cursor (perguntado ao próprio fabric, `findTarget`), ⇧ + arrastar continua sendo
o laço de seleção, e um clique seco no vazio seleciona a camada Fundo. A decisão
mora em `takes()` (ui/livery-editor.ts) e o clique-no-vazio em `end()`, porque o
palco ENGOLE o `pointerdown` e o fabric nunca vê o gesto.

E o zoom: `FOCUS_MIN_F` subiu duas vezes sem resolver o relato porque **não era
ele que governava**. `minDistance` é uma esfera em volta da MIRA, e a mira pode
ser arrastada `FOCUS_PAN_F · r`; quem segura a lente longe da LATARIA é
`FOCUS_SKIN`, a expulsão da caixa, que estava em 0,45 m. Os dois subiram
(1,00 · r e 1,50 m) e a bancada `checks-zoom-0813.mjs` mede o que importa —
folga mínima medida em oito azimutes, com a mira no pior lugar possível.

## 15. 2026-08-14 — o teto sem chapa no card, e a assimetria que o produziu

*"o teto do implemento no card do livery está transparente, mas quando abro o
modal do livery ele fica branco como deveria"*.

A chapa que aparece atrás da arte é a MESMA variável nos dois lugares
(`--ts-implement`), mas o CSS a entrega por caminhos diferentes:

```
  palco   .stage-panel .canvas-container            → sempre
  card    .ts-panel.ts-pw-ready .ts-panel__media canvas → só com a classe
```

Quem liga `.ts-pw-ready` é `publishWindow()` (vehicle/livery.ts), e ela só roda
quando a face TEM uma janela. As outras quatro ganham a delas por um de dois
caminhos — a foto de degradação medida ou o retrato ortográfico. **O teto não
tem nenhum dos dois, e por construção**: não tem foto (a prancha do cliente
nunca desenhou o teto) e não é `SnapshotKey` — `livery-snapshot.ts` fotografa as
quatro CHAPAS RECORTADAS, e o teto é malha do corpo paramétrico
(`tagRoofLiveryUV`). Ou seja, a face que §14.6 acabou de criar caiu no único
buraco que a arquitetura do painel tinha, e o palco não denunciou porque a regra
dele não depende da classe.

A correção é uma **janela sintética** — a chapa inteira, sem moldura vazada a
encaixar —, recalculada a cada rebuild a partir de `PANEL_MM.roof`, porque a
razão do teto muda com o comprimento do baú. De quebra ela conserta um segundo
sintoma que ninguém tinha relatado ainda: `sizePreviewCanvas()` também se
guardava em `windows[key]`, então o buffer da miniatura do teto ficava no
600 × 106 literal do template enquanto a tela do fabric seguia a chapa medida —
a arte saía esticada na razão entre as duas.

E `PANEL_IMAGE.roof` virou `null` em vez de um caminho para um arquivo que nunca
existiu: as outras quatro apontam para fotos que EXISTIRAM e podem voltar (o 404
delas é estado de pacote), o teto não tem para onde voltar, e um `url()`
garantidamente perdido a cada publicação não é degradação — é request jogado
fora.

Trava: `checks-teto-card-0814.mjs`, que compara os DOIS lados na mesma sessão —
"o card está branco" isolado passaria com o palco quebrado do mesmo jeito.

**A bancada também mudou**, e vale para qualquer investigação futura: ela forçava
`DISPLAY=:1` no navegador. Fora da estação que tem um X naquele número o ANGLE
responde `Could not create a WebGL context … BindToCurrentSequence failed`, com o
VENDOR da placa no meio — um erro que manda procurar defeito no hardware quando
o que falta é a tela, e que aparecia ATÉ no caminho SwiftShader, onde nenhum dos
dois é necessário. Agora o `:1` só é chutado com `--gpu`, e o console da página
é impresso quando o boot falha (a mensagem mandava olhá-lo e não havia por onde).

## 16. A rodada de 2026-08-16 — a patola, e quatro defeitos do editor de plotagem

Sete pedidos numa captura só. Todos medidos na bancada antes de virarem código,
e todos com trava: `checks-patola-0816.mjs`, `checks-livery-0816.mjs`,
`checks-tk-adesivo-0816.mjs`.

### 16.1 A patola desce quando o implemento está sozinho

*"quando estiver apenas o implemento sendo mostrado, o suporte do implemento
fique tocando no chão — mas não a frente da caixa, e sim o suporte mecânico
abaixado"*.

As duas metades importam, e a segunda decide o desenho: **o baú não se mexe**.
Baixar o nariz do conjunto até o pé encostar seria outra pose do produto inteiro
— outra altura de carga, outro ângulo de teto, outro enquadramento. O que ele
pediu é a manivela sendo girada.

`trailer-rig.ts` declara `landingGear: null` com a nota "não existe nó de patola
neste GLB", e está certo quanto ao NOME: o bake é um `stitch_result_stitch_all`
de 5 852 nós anônimos. Mas a geometria existe e é **telescópica de verdade** —
duas malhas por perna, medidas no referencial da raiz:

```
  tubo EXTERNO  esq. y 0,303 … 1,110  (leva a caixa da manivela)   fica
  tubo EXTERNO  dir. y 0,300 … 1,072                               fica
  tubo INTERNO  esq. y 0,282 … 0,878                               DESCE
  tubo INTERNO  dir. y 0,2815… 0,915                               DESCE
```

Os internos estão inteiros DENTRO dos externos: fotografados sozinhos são um tubo
de 63 cm com sapata no pé; montados, só a sapata aparece. Com a rodagem do FH16
o plano de contato fica em y = −0,045, ou seja **326 mm de curso** — e descer os
dois internos por 326 mm deixa 252 mm de tubo ainda encaixado no externo, que é a
pose de um conjunto estacionado.

**As pernas são achadas por FÍSICA, não por nome de nó** (`vehicle/landing-gear.ts`):
a patola sustenta a DIANTEIRA, logo vive à frente da rodagem; dela, a malha mais
baixa DE CADA LADO que não toque o chão e seja alta o bastante para ser perna; e
as duas têm de formar par (espelhadas, mesmo z, mesmo pé).

⚠️ **Duas cláusulas foram aprendidas falhando na bancada, e as duas ficam:**

* **"à frente da rodagem"** — sem ela, as duas malhas mais baixas do implemento
  depois dos pneus são os **lameiros do bogie** (`x 0,758 / −1,114 · z −3,526`),
  que também vêm aos pares e também descem meio metro. E "o fim da rodagem" se
  acha sozinho, sem regexp: **o que toca o chão é pneu**, por construção —
  `groundAndCenter()` assentou o implemento por eles.
* **"uma por lado", e não "as duas mais baixas"** — a diferença é de 18 mm. O
  tubo interno da direita começa em 0,2815 e o externo em 0,300; um re-bake que
  invertesse essa ordem por um milímetro escolheria os dois tubos EXTERNOS, que
  passam no teste de espelho e desceriam a perna inteira para fora do mancal.

⚠️ **E a peça fica FORA DA FUSÃO POR MATERIAL.** As duas pernas são
`metal-preto`, o mesmo material de 577 outras primitivas; fundidas, os vértices
ficam assados na pose do instante da fusão dentro de um balde que atravessa o
implemento, e mover um pedaço de balde é impossível. A exclusão
(`LANDING_GEAR_MERGE_EXCLUSIONS`, casada pelo grupo `PATOLA`) custa **duas
chamadas** — 1 994 → 1 992 poupadas, medido —, porque o balde continua existindo
com dois membros a menos.

A trava mede as duas metades do pedido: o pé encosta **e** a caixa envolvente
das quatro chapas não se move (0 mm). E repete o ciclo com a fusão montada,
porque é nesse estado que o app roda.

#### 16.1.1 A sapata, e o teste que media no espaço errado

Segundo pedido, depois de ver a patola descida: *"na peça que segura o
implemento que vai no chão, deve ter uma superfície de uns 2 cm, mais larga que
o suporte em si, na parte que toca o chão"*. Medido antes de mexer:

```
  tubo, a 400–600 mm do pé      102 × 100 mm
  FLANGE de fábrica             existe — 7,7 mm de espessura,
                                avançando 69 mm além do tubo (⇒ 240 mm)
```

Ou seja a sapata de fábrica EXISTE e já é bem mais larga que o tubo. O que não
existe é uma sapata que se VEJA: 7,7 mm assentados no plano de contato somem
contra qualquer piso. A chapa gerada pende dela — 20 mm além em cada lado
(280 mm) e 14 mm de espessura —, reusa o material da perna (para herdar o
acabamento e a sonda de reflexo já aplicados ao `metal-preto`) e as duas viram
UMA malha. A largura sai da FLANGE e não do tubo, e é a única leitura do pedido
que produz algo visível: 2 cm a mais que os 100 mm do tubo dariam 140 mm, que
nasce escondido debaixo dos 240 da flange.

⚠️⚠️ **E AQUI O TESTE MENTIU, que é a lição mais cara desta rodada.** A primeira
versão calculava a queda em espaço LOCAL DA RAIZ — *pé local menos chão local* —
e a bancada, medindo no MESMO espaço, declarou `erro contra o chão: 0 mm`. O
relato pegou o que ela não pegou: *"a sapata só aparece quando NÃO está somente
o implemento"*. Medido de novo, agora em MUNDO, com só o implemento em cena:

```
  face de baixo da sapata   y de mundo  −0,0483
  pneus tocam               y de mundo  +0,0062
  ⇒ a chapa nascia 54,5 mm ENTERRADA no piso
```

A causa é a INCLINAÇÃO DE ENGATE: `placeTrailer()` gira o implemento sobre o
contato dos pneus para o pino descer sobre a quinta roda (~0,36°), e a patola
fica ~8,6 m à frente do bogie — 8,6 · tg 0,36° = 54 mm. **No referencial da raiz
essa inclinação não existe**, então lá o pé encostava perfeitamente num chão que
não é o chão. Um teste no referencial errado não é um teste fraco; é um carimbo.

A queda passou a ser resolvida em mundo e **recalculada a cada aplicação** (a
inclinação muda com a cabine e com todo `setTrailerDims()`, então um número
gravado na construção estaria certo até a primeira troca de caminhão), e
`placeTrailer()` — que é quem escreve a pose — reaplica no fim. A conversão de
volta para local divide por `matrixWorld.elements[5]`, a componente y do eixo Y
local, que carrega junto a escala da raiz. ⚠️ Nada de `transformDirection()`
aqui: ela NORMALIZA, e queda é distância — foi assim que a primeira medição na
bancada devolveu 10 mm em vez de 301.

### 16.2 A cor do Thermo King não recarregava o livery

*"quando aplico uma cor no Thermo King, não recarrega o livery — a cor é aplicada
ao modelo 3D mas não reflete no livery"*.

Exato, e a causa é a mesma de `scheduleRepaintSnapshot()` (§13) por outra porta:
desde que o painel do editor virou uma FOTOGRAFIA do baú, toda peça que aparece
na foto é conteúdo do editor — e a unidade aparece inteira na testeira.
`vehicle/trim.ts` já avisava (`onTrimChanged`); faltava ligar.

Duas decisões: **só a testeira** (as outras três peças não entram em retrato
nenhum — o teto não é fotografado e para-lama e caixa ficam abaixo da margem
inferior do quadro), e **debounced em 200 ms**. Para isso `takeFaceSnapshots()`
ganhou um filtro `only` e `onTrimChanged` passou a informar QUAL peça mudou.

⚠️ **E o token de refotografia virou um POR FACE.** Um contador só bastava
enquanto toda refotografia pedia as quatro; com uma que pede só a testeira, um
arrasto de medida em voo seria descartado pela troca de cor que chegasse 200 ms
depois — três faces perdidas, e o palco com o retrato de uma medida que não
existe mais.

### 16.3 As duas linhas do Fundo acendiam juntas

*"a opção de cor customizada e pintar igual ao cavalo selecionadas juntas, e não
deveria — isso acontece até nas laterais"*.

O CSS já dizia a regra certa desde §14 ("o anel verde marca qual das duas está
mandando NESTA face — nunca as duas ao mesmo tempo") e o seletor a contradizia:
`#bg-row-cab:has(.bg-check:checked)` acende sempre que a caixa está marcada, e a
caixa é uma decisão sobre o BAÚ INTEIRO — ela fica marcada inclusive nas faces
que têm cor própria e portanto IGNORAM a tinta do cavalo.

A pilha continua sendo pilha (a de baixo sobrepõe a de cima; §14.5 registra o
pedido que a criou). O que mudou é o que a forma diz: `syncBackground()` decide
quem manda, o anel marca o vencedor, e o perdedor recebe `.is-muted` com o
estado trocado para "sobreposta aqui".

⚠️ **O checkbox NÃO é desmarcado.** Desmarcá-lo "para ficar coerente" desligaria
a tinta das outras três faces por causa desta — que é exatamente o defeito de
`setBackgroundsForPaint()`, apagado em §14.5.

De quebra, a dica do Thermo King deixou de prometer o que não cumpria. "Sem cor
própria a carcaça acompanha o baú" é meia verdade: ela acompanha a **tinta** do
implemento, e o Fundo da face é PLOTAGEM sobre a chapa — não alcança a máquina.
Quem pinta a testeira de preto e vê a carcaça continuar branca agora lê por quê.

### 16.4 Clicar no Thermo King não selecionava a camada dele

Ele já ERA uma linha fixa da lista de camadas (§14.7), mas o palco não sabia: a
unidade não é objeto do fabric, é um pedaço da FOTOGRAFIA, e todo clique na foto
caía na regra "clicar no caminhão seleciona o Fundo".

`FaceSnapshot` ganhou `tk` — o retângulo da unidade **projetado pela mesma câmera
ortográfica que fez a imagem**, nas mesmas frações de `box`. Em registro por
construção; qualquer segunda conta divergiria na primeira medida digitada. É a
única medida deste arquivo que usa `Box3.setFromObject()` de propósito: ela é
alvo de CLIQUE, e os ~17 mm que a inclinação de engate acrescenta são folga do
lado certo.

### 16.5 Selecionar uma camada exigia mira

*"por conta de poder trocar o nome da camada, tenho que clicar numa área muito
pequena para poder selecionar"*.

O nome é um `<input readonly>` com `flex: 1` — quase a largura inteira da linha —
e o clique nele era descartado (`if (ev.target === name) return`). Sobravam o
punho, o ícone e a folga entre os botões.

`preventDefault()` no `mousedown` **enquanto** `readonly` tira o foco e o cursor
de texto sem tirar o `click` nem o `dblclick`: a linha recebe o clique, e o duplo
clique continua abrindo a edição (e agora pede o foco explicitamente, porque o
`mousedown` o recusou). O CSS acompanha — `cursor: inherit` com `readonly`,
`cursor: text` sem.

Junto: `#bg-row-cab`, `#bg-row-face` e `#tk-row` ganharam `cursor: pointer` e
`user-select: none`. As três são controles inteiros desde §14.5 — clicar em
qualquer ponto da linha abre o seletor —, e continuavam desenhando um cursor de
texto porque são `<div>` com `<span>`.

⚠️ **E o conserto do nome nasceu com um defeito próprio, que só a MEDIÇÃO pegou.**
As duas regras novas eram `.lyr-name[readonly]` e `.lyr-name:not([readonly])` —
sem o `input.` na frente. As camadas FIXAS (Fundo e Thermo King) usam
`.lyr-name .lyr-name--fixed` num `<span>`, que nunca tem `readonly`: o
`:not([readonly])` casava justamente elas e lhes dava `cursor: text`. O relato
seguinte foi o mesmo do primeiro (*"passo o mouse por cima do texto da camada e
continua cursor text"*), e `checks-cursor-camada-0816.mjs` — que lê o `cursor`
COMPUTADO de cada peça da linha — mostrou em uma linha qual das três mentia.

#### 16.5.1 A linha sobreposta ainda lia como ligada

*"cor do cavalo continuar selecionada, mesmo quando eu pinto de uma cor
diferente"*. Apagar a linha não bastou: o que continuava dizendo "ligado AQUI"
era o TIQUE verde ao lado de uma linha apagada — sinal contraditório. Agora o
tique perde o acento (fica cinza: ligado, sem mandar) e o nome é RISCADO, que é
a convenção de quem já resolveu este problema — as ferramentas de desenvolvedor
do navegador riscam a declaração de CSS que outra sobrepôs. A linha continua
clicável: desligar a tinta do cavalo com uma face pintada por cima é uma decisão
legítima, e desabilitá-la a esconderia.

#### 16.5.2 O Thermo King não tinha a linha "Cor do cavalo"

*"o Thermo King está faltando essa opção pintar da cor do cavalo"*. A seção dele
tinha uma linha só, enquanto o Fundo tinha a pilha de duas — e a carcaça SEGUE a
tinta do implemento (`followsBody` em `vehicle/trim.ts`), então a linha de cima
descreve um estado que existe. Ela não implementa nada: escreve no
`#paint-trailer` e despacha o `change` dele, para que o caminho continue sendo UM
(`bindTrailerPaint()`, que troca o material, refotografa e escreve o status) e os
dois controles não possam discordar. `setSpecialEdition()` esconde as duas.

### 16.6 O halo branco dos adesivos do Thermo King

*"as bordas ficam brancas, fica estranho"*. Medido em `thermoking.glb`, imagem 3
(`tk_logo`, 1024², RGBA):

```
  alfa == 0    67,4% dos texels   RGB médio ali = (254,4  254,5  254,4)
  alfa == 255  29,2%              RGB médio ali = ( 26,4   62,8   69,4)
```

Dois terços da imagem são BRANCOS e invisíveis. Isso é legal no arquivo e fatal
na GPU: **a filtragem e o mipmap fazem a média de RGB e de ALFA separadamente**.
A média entre o preto do glifo (a=255) e o branco do vazio (a=0) devolve RGB
claro com alfa intermediário, e o `alphaTest = 0.5` que `auditTransparency()`
aplica ao decalque deixa passar justamente a orla onde o alfa ainda é > 0,5.
Nenhum ajuste de filtro, anisotropia ou `alphaTest` conserta: o dado está errado
antes de chegar ao amostrador.

O conserto é de ASSET — `tools/glb-texopt/sangra_alfa.py`, mesma doutrina de
contêiner de `texopt.py` (o BIN só cresce no fim, nenhum offset muda, e o que não
foi tocado é conferido byte a byte). O **canal alfa não é tocado**; o que muda é
o RGB dos texels invisíveis, que passa a ser o do texel visível mais próximo.

⚠️ **Duas escolhas não óbvias, as duas medidas:**

* **a semente é `alfa ≥ 250`, não `alfa > 0`.** O texel de meia cobertura deste
  bake não carrega o ciano com meio alfa — ele carrega uma cor JÁ MISTURADA com o
  branco (medido na linha 512: `(205,236,249,128)` entre um vazio `(255,251,255,7)`
  e o ciano `(33,162,222,252)`). Semeando a partir dele, a média do vazio caía só
  de 254 para 211 e o halo continuava. Com semente opaca ela cai para 69,5.
* **vizinho mais próximo, não média dos vizinhos.** As duas dão a mesma média de
  cor; a média escreve um DEGRADÊ por todo o vazio e degradê é o que o PNG
  comprime pior — `tk_logo` 74 → **184 KB** contra 74 → **83 KB**. O mosaico
  comprime como o branco chapado que substituiu, e o arquivo inteiro sai MENOR
  do que entrou.

Medido na placa, com a carcaça pintada de escuro (no branco de fábrica o halo é
invisível por construção — ele É branco): **269 → 0 pixels claros-e-neutros** na
janela do emblema, com o ciano do logo intacto. Backup em
`thermoking.glb.bak-sangra-2026-08-16`.

---

## 17. A rodada de 2026-08-16 (tarde) — o modo livre virou um CRIADOR DE VÍDEO

O pedido, por inteiro:

> *"em vez de ter modo livre, o modo livre deve ser um criador de vídeo […] irei
> posicionar a câmera onde quero que comece, selecionarei o tempo, por exemplo
> 2s, então posicionarei a câmera no segundo ponto e direi que aquele será o
> segundo ponto, colocarei um timer novamente, e assim por diante […] **porque
> assim a câmera será suave, não rígida já que manualmente não conseguimos
> deixar ela suave**"*

E, na mesma rodada, mais quatro: o seletor de tempo virou um `<select>` de 1 a
8 s, o cartão perdeu a fileira de botões (o ✕ subiu para o canto), a prévia
parou de piscar, o vídeo parou de sair com artefato — e o **modo cinemático foi
removido**, *"já que esse substitui"*.

### 17.1 O diagnóstico do dono estava certo, e é ele que decide o desenho

O modo `livre` amostrava a órbita à mão (`capturePath()`) e reamostrava o
caminho para 60 fps por interpolação (`poseAt()`). Ou seja: ele reproduzia com
fidelidade **até o tremor da mão**. Não há filtro que conserte isso, porque o
tremor não é ruído sobre o sinal — ele *é* o sinal que foi colhido.

A troca é de natureza: em vez de suavizar um caminho amostrado, o percurso é
**resolvido** a partir de poucos pontos autorados. O usuário dá os PONTOS; a
máquina dá o CAMINHO.

### 17.2 Três arquivos novos, e a divisão entre eles é o que os torna testáveis

| arquivo | o que é | por que separado |
|---|---|---|
| `scene/timeline-curve.ts` | PCHIP, base de Hermite, desembrulho de ângulo | **não importa nada.** `scene/scene.ts` constrói um `WebGLRenderer` no tempo de import, então tudo que o alcança é impossível de carregar sob vitest. Aqui moram as funções puras, e `timeline-curve.test.ts` prova as duas propriedades que produzem vídeo errado **em silêncio** |
| `scene/timeline.ts` | o modelo (chaves), o percurso e o reprodutor | precisa da câmera; não tem uma linha de DOM |
| `ui/timeline.ts` + `.css` | o dock de três faixas | só DOM; fala com `chrome.ts` por *callback*, nunca por import (o ciclo mataria o boot) |

Os três — prévia, régua e gravação — consomem a **mesma** `place(t)`. É isso que
faz a prévia ser uma promessa em vez de uma aproximação.

### 17.3 A curva é PCHIP, e as duas candidatas descartadas explicam por quê

* **`smootherstep` por trecho** (o que o modo cinemático fazia): C¹ de graça, mas
  a câmera **para em todo ponto marcado**. Quem marca seis pontos para descrever
  *um* movimento recebe seis movimentos com cinco paradinhas.
* **Catmull-Rom**: a resposta clássica, e ela **ultrapassa** — a tangente
  automática num ponto de inflexão joga o valor para fora do intervalo dos
  vizinhos. Numa câmera isso é passar do outro lado do ponto e voltar; no eixo do
  RAIO, é entrar na zona de expulsão da carroceria.
* **PCHIP (Fritsch–Carlson)**, que ficou: tangente por média harmônica ponderada,
  zerada em todo extremo local. A propriedade que ela compra vale por uma dúzia
  de guardas:

      TODO VALOR INTERMEDIÁRIO FICA ENTRE OS DOIS VIZINHOS.

  Como toda chave nasce de uma pose que o laço vivo já validou (`minDistance`,
  `maxPolarAngle`, a coleira da mira), **um caminho que não sai do intervalo das
  chaves não viola nenhuma daquelas guardas** — e não é preciso aparar no meio,
  que é o que produz a "dobra" que um percurso keyframado não pode ter.

  Medido na bancada com o ponto do meio colado no `minDistance`: guarda 9,61 m ·
  menor raio do percurso **9,80 m** · folga até a lataria **4,49 m**.

As pontas ganham tangente **zero à força** — é o que dá partida e chegada macias
sem nenhum controle na interface. E a **pausa** não é um campo: marcar o mesmo
ponto duas vezes dá um trecho chato, e a mesma regra de Fritsch–Carlson que
impede a ultrapassagem para a câmera nele, de graça.

### 17.4 O azimute é desembrulhado, e isso não é detalhe

`atan2` devolve (−π, π]. Duas chaves a 170° e a −170° estão a 20° uma da outra, e
interpolar os números crus varreria **340° pelo lado errado** — uma volta inteira
ao contrário, num vídeo que só se descobre errado depois de esperar o render.
`unwrapAngles()` garante o arco menor entre pontos consecutivos.

### 17.5 A interface: três faixas, e a câmera é a fonte da verdade

1. **a barra** — o que o percurso é, a lente, prévia e gravar;
2. **a régua** — proporcional no tempo, e ela *é* o cabeçote: arrastar move a
   câmera quadro a quadro;
3. **a tira** — um storyboard com miniatura de verdade (`poseThumbnail()`, em
   `scene/capture.ts`, que reusa o trio sRGB/RGBA8/`isXRRenderTarget` que aquele
   arquivo descobriu medindo — sem ele o resolve falha e o retrato sai **preto em
   silêncio**).

Não existe editor de pose: enquadre com o mouse → ＋ marca; clique na miniatura →
a câmera volta lá; ✕ → o ponto sai. O `.ts-tlmode` no root recolhe HUD, cards e
badges pela **mesma lista** do modo limpo em `core/studio.css` — mas por uma
classe PRÓPRIA, senão fechar o criador desfaria um modo limpo que o usuário tinha
ligado à mão.

### 17.6 A prévia engasgava — e a primeira tentativa de conserto errou

Relato: *"o preview está muito travado, muito mesmo, fica tipo flicando"*. A
prévia não é cara de calcular (sete cúbicas e dois vetores), e o que se cortou na
primeira passagem foi desperdício real: ela **escrevia no DOM cinco vezes por
quadro** dentro de um dock com `backdrop-filter`. Isso ficou (nada é escrito sem
mudar; ARIA e relógio a 10 Hz; o vidro sai de cena enquanto a prévia toca).

⚠️ **Mas o diagnóstico estava errado, e a correção piorou o caso.** Ver §21 — o
relato voltou, e a causa é outra.

### 17.7 O artefato do vídeo tinha nome, e era o gancho de quadro

Relato: *"às vezes o vídeo sai com um artefato"*. O "às vezes" era a pista.

A prévia escreve a pose de dentro de um `onFrame` — e **`renderOfflineFrame()`
também roda os `onFrame`**, porque é o mesmo laço avaliado fora do tempo real.
Um motorista vivo ali dentro reescreveria a pose que `record.ts` acabou de
escrever, DEPOIS de `place()` e ANTES do `render()`. E o motorista mais fácil de
deixar vivo não é a prévia: é o **voo de 0,45 s** que um clique na miniatura
dispara — o gesto natural é "deixa eu ver este ponto… pronto, gravar".

Conserto: `suspendTimelineDrivers(true)` no começo de **toda** gravação, solto no
`finally`. `checks-percurso-video-0816.mjs` reproduz a janela de propósito
(dispara o voo e grava no quadro seguinte) e julga o `.mp4` **fora do
navegador**, com ffprobe/ffmpeg — o `chrome-headless-shell` não decodifica H.264
para canvas e relata "preto" para arquivos perfeitos, armadilha em que o
`checks-gravacao.mjs` cai desde sempre.

### 17.8 O modo cinemático saiu, e ~520 linhas com ele

> *"remova o modo cinemático, não será necessário, já que esse substitui"*

Ele era um percurso autorado — pontos de câmera, tempo entre eles, aceleração nas
pontas, zoom de lente. É exatamente o que o criador faz, com uma diferença que
decide: **a decupagem estava cravada no código**. Manter os dois seria manter
duas implementações do mesmo conceito, e a que ninguém pode ajustar é a que
envelhece. O que ele sabia — interpolação esférica e nunca cartesiana, zoom por
LENTE porque as guardas tornam o close-up mecanicamente impossível, o
assentamento de dois estágios antes do primeiro quadro — está herdado e
documentado em `timeline.ts` e no ramo do percurso em `record.ts`.

`RecordMode` passou de três membros para dois; `RecordProgress.shot` e a fase
`gravando` do caminho offline saíram junto.

### 17.9 O que ficou provado

* `engine/scene/timeline-curve.test.ts` — 21 portões, sem navegador: não
  ultrapassa, arco menor, a pausa para de verdade, passa pelos pontos, C¹ nas
  emendas, o cursor retrocede.
* `tools/studio-bench/checks-percurso-0816.mjs` — o caminho do painel até o dock,
  a interface sumindo, as miniaturas não-pretas, o select de 1 a 8 s, o ✕ no
  canto, as guardas da cena em 600 amostras do percurso, a prévia movendo a
  câmera, e o fechamento devolvendo a lente de fábrica.
* `tools/studio-bench/checks-percurso-video-0816.mjs` — o `.mp4` de verdade:
  120 quadros, 60/1, 2,000 s, luminância média 84/255 e a câmera andando entre os
  instantes, com um voo em curso na largada.

---

## 18. A rodada de 2026-08-16 (noite) — quatro defeitos do card de Configurações

> *"quando configurações está aberto a parte lateral de todos os cards ficam
> cortados, além disso parece ter um background em todos juntos, não deveria, e
> todos os cards têm um border green no hover, exceto a iluminação, e o paralamas
> está faltando ter a opção de pintar da cor do cavalo também, como todos os
> outros itens"*

Quatro queixas, **três** causas — as duas primeiras são o mesmo defeito visto de
dois ângulos.

### 18.1 Os cards cortados e a "laje" são a mesma linha de CSS

`#ts-panels` tem `overflow-y: auto` para que a pilha role em vez de vazar por
cima dos view controls. E aí entra a regra que ninguém lembra:

> **um eixo que deixa de ser `visible` tira o `visible` do outro.**

Ou seja, `overflow-x` passa a `auto` e clipa no eixo horizontal. O que é cortado
ali não é conteúdo — os cards têm exatamente a largura da caixa — é a **SOMBRA**.
`--ts-glass-shadow` alcança ~6 px para os lados e ~18 px para baixo, e é ela que
faz cada card ler como uma lâmina flutuando sobre o render.

Cortada, ela vira o contrário: as bordas viram um corte reto de cima a baixo, as
sombras dos cinco cards se emendam nos vãos de 10 px e a coluna passa a ler como
**uma laje escura** com os cards recortados dentro. Daí as duas frases do relato.

⚠️ **Sempre esteve assim** — `overflow: auto` clipa mesmo sem ter o que rolar. O
que mudou com o card aberto foi o TAMANHO: 587 → **826 px** medidos na bancada,
quase a tela inteira.

Conserto: acolchoar por dentro e recuar o deslocamento pelo mesmo tanto, para o
card não sair do lugar um pixel.

    right  6 + padding-right   8 = 14 px da borda   (era right: 14)
    bottom 0 + padding-bottom 14 = 14 px do rodapé  (era bottom: 14)

### 18.2 O HUD era o único a acender em branco

`.ts-panel:hover` e `.ts-cfg:hover` acendem em `--accent`; `#ts-hud:hover` acendia
em branco a 20 %. Duas gramáticas para o mesmo gesto, em duas colunas visíveis ao
mesmo tempo. Agora os três acendem igual — e o par de NOITE continua sendo uma
linha própria, porque é ela que impede a regra de noite (1,1,0) de vencer a de
hover (1,1,0) pela ordem de fonte.

### 18.3 O para-lama passou a seguir a tinta do cavalo — e isso destapou dois buracos

`SPECS.fenders.followsBody` era `false`. A razão histórica era boa ("sem cor
escolhida, nada muda", e o para-lama nunca fora pintado junto com o baú) mas era
descrição do bake, não decisão de produto: na oficina ele é pintado com a cor da
frota como qualquer outra chapa. Virou `true`, e o card de Configurações ganhou a
linha **"Cor do cavalo"** — que não implementa nada, escreve no `#paint-trailer` e
despacha o `change` dele, exatamente como a linha do Thermo King faz. Um caminho,
três superfícies.

Ligar o `followsBody` destapou dois defeitos do motor:

* **ninguém guardava o material de fábrica dele.** Teto e Thermo King estão em
  `trailerPanelMeshes()`, então `setPaintTarget('both')` os pinta *e* grava
  `origMat` de graça. O para-lama não é tocado por aquele laço — quem o veste é o
  `applyTrim()`. Sem um terceiro slot (`trimFactoryMat`, capturado **antes** de
  qualquer escrita) a tinta entrava e não saía.
* **⚠️ vestir a tinta APAGAVA A IDENTIDADE DA PEÇA.** `fenders` e `thermoking`
  casam por MATERIAL, e a primeira coisa que este módulo faz com uma malha casada
  é trocar o material dela. A partir daí `spec.match()` devolve false e a peça
  deixa de existir para `meshesOf()`: **o laço que tiraria a cor não encontra mais
  nada para tirar.** Era um defeito ANTERIOR — tirar a cor própria do para-lama
  nunca o despintou — e só não gritava porque `followsBody: false` o mantinha
  fora do caminho da tinta do baú. Fechado por `userData.trimKey`, escrito no
  primeiro encontro: identidade, não cache. Um re-bake cria malhas novas, sem
  carimbo, que voltam a ser casadas pelo material.

### 18.4 O que ficou provado

`tools/studio-bench/checks-configuracoes-0816.mjs`: a folga de 8 px dos dois lados
do scroller (com o card ainda a 14 px da borda do render), o hover do HUD em
`--accent`, a linha "Cor do cavalo" nascendo espelhada e acionando a decisão
única, e as quatro transições do para-lama — veste a tinta do baú, volta ao de
fábrica, a cor própria ganha dela, e tirar a cor própria devolve a peça.

⚠️ O conjunto da bancada **não tem material `paralamas`** (52 materiais no
implemento, nenhum casa), então o portão 4 exercita o mecanismo num para-lama
sintético. Vale registrar como pergunta em aberto: nesta cópia dos assets a linha
"Paralamas" do card não tem o que pintar.

---

## 19. A rodada de 2026-08-16 (noite) — a PLACA DE LICENCIAMENTO nos 50

O pedido: *"crie uma placa 3D com essa imagem, e adicione em todos os modelos 3D
do meu truck studio, todos os cavalos e o implemento, garanta que ira cobrir
todos os modelos, achar todos os locais que sao necessarios para estarem
corretamente posicionados"*.

⚠️ **"PLACA" JÁ ERA DUAS OUTRAS COISAS AQUI**, e confundi-las custa caro. A
**chapa** da carroceria do implemento (`PLATE_PITCH`, `plateSeams()`,
`PlateGrid`, §9.7) e o **prato** da quinta roda (`fifthWheel.plateTopY` em
`hitch.json`). Esta seção é sobre a placa do DETRAN, padrão Mercosul,
400 × 130 mm. O módulo se chama `vehicle/license-plate.ts` por isso.

| arquivo | papel |
|---|---|
| `tools/placa/build.py` | prepara a arte: recorte, cantos e o normal map do relevo |
| `tools/placa/probe.mjs` | mede o sítio nos 49 cavalos → `models/vehicles/plates.json` |
| `tools/placa/contato.py` | monta a folha de contato das 49 fotos |
| `engine/vehicle/license-plate.ts` | a geometria, o material e as duas montagens |
| `tools/studio-bench/checks-placa-0816.mjs` | o portão |
| `tools/studio-bench/checks-placa-frota-0816.mjs` | a cobertura, chassi a chassi |

### 19.1 As duas metades são diferentes, e por quê

|  | onde a posição sai | por quê |
|---|---|---|
| 49 cavalos | `models/vehicles/plates.json` | o `.glb` não muda em runtime |
| implemento | MEDIDA a cada rebuild | ele é PARAMÉTRICO |

É a mesma divisão que `hitch.json` já faz — o lado do cavalo congelado com o
`sha256` dos bytes, `implements: {}` porque o baú anda a cada medida digitada.
Uma posição de traseira congelada estaria errada no primeiro redimensionamento e
errada **em silêncio**.

### 19.2 A sonda: z-buffer e ajuste de plano

Cinco decisões, e as cinco vieram de uma tentativa que falhou antes:

1. **A orientação sai das RODAS, não de `hitch.json`.** Dois dos 49 arquivos
   (`scania_r_2016_6x2t`, `vw_titan_6x2_tl`) não têm entrada lá. O eixo
   direcional é a frente por definição, e os bakes nomeiam `wheel_f_*` /
   `wheel_r_*`. Conferido contra os 47 que têm entrada: bate em 47 de 47.
2. **A superfície sai de um Z-BUFFER, não de vértices.** Amostrar vértice não
   responde "o que uma placa encostada aqui tocaria": um painel plano de meio
   metro quadrado tem QUATRO vértices. A primeira versão da sonda reprovou os 49
   por "cobertura < 50 %". Rasterizar cada triângulo dianteiro numa grade de
   5 mm transforma a pergunta numa leitura.
3. **O sítio sai de um AJUSTE DE PLANO.** Para-choque de caminhão não é
   vertical: medido, ele cai de 1° (Scania S 2024e) a 27° (DAF XG) dentro da
   própria pegada. Mínimos quadrados devolvem posição e inclinação de uma vez, e
   o resíduo separa o painel da grade.
4. **O critério é `rms`, não o resíduo máximo.** Um rebite estoura o máximo e não
   atrapalha placa nenhuma. Com `rms ≤ 8 mm` o passe estrito acha sítio em
   **46 de 49** (as três variantes do XF 105 caem em `AUTORADOS`); com
   `res ≤ 15 mm` sozinho ele perdia sete.
5. **A altura preferida é 0,45 m dentro da BANDA MAIS BAIXA**, e não "a mais
   baixa que passa" (no FH 2021 isso punha a borda de baixo rente ao fundo do
   para-choque) nem "a de menor resíduo" (essa sobe para o radiador em metade da
   frota).

**Validação independente que não foi encomendada:** o `vw_titan_6x2_tl` é o único
bake do acervo que já traz um nó `placa_p0` — e a sonda, que não lê nome nenhum,
parou exatamente em cima dele (`y = 0,750`, `rms 1,9 mm`).

### 19.3 O `vão`, e por que a placa tem um BERÇO

Nenhum para-choque é um plano de 400 × 130 mm. Medido nos 49, o afastamento
entre a chapa e a superfície **no contorno** da placa tem mediana de 10 mm, mas
sete modelos passam de 29 mm — e o DAF XF 105 não tem 130 mm planos em ponto
nenhum da dianteira (a face externa do para-choque mede 70 mm e logo acima
começa a grade de palhetas com passo de 10,5 cm; é o único MODELO em
`AUTORADOS`, e entra com as três variantes de eixo).

Encostar a placa no ponto mais saliente e deixar o resto no ar dá uma placa
FLUTUANDO. Então ela ganha o que um caminhão de verdade tem: uma bandeja rasa e
escura atrás dela, com a profundidade que aquele modelo pediu. Onde o vão é de
3 mm o berço é um aro; onde é de 45 mm ele é o suporte que aquele para-choque
exigiria de fato.

⚠️ **O vão é medido na BORDA, não na pegada inteira** — a diferença chega a 30 mm.
Um furo de parafuso no meio do para-choque fica ATRÁS da placa e ninguém o vê;
deixá-lo mandar transformava o aro de 7 mm do FH 2021 numa caixa de 41 mm.

### 19.4 Ela reflete, e isso não é efeito

Placa Mercosul brasileira é película retrorrefletiva com caracteres estampados
por cima. `vehicle/retroreflect.ts` (§12.5) já implementa esse lóbulo, e a última
linha do shader de lá multiplica o retorno pelo **albedo do fragmento**. Numa
placa isso é fisicamente certo de graça: o fundo branco devolve, os caracteres
pretos não. Por isso o material se chama `placa-retrorrefletiva` — o nome CASA
`FITA_RE` de lá, e a injeção acontece sem uma linha nova de GLSL.

⚠️ **O nome do material é FUNCIONAL.** Renomeá-lo para algo que não case
`/retro.?reflet/i` apaga a retrorreflexão sem erro nenhum, e o sintoma é uma
placa que some à noite.

### 19.5 No implemento ela vai no PORTA-PLACA, não no para-choque

A primeira versão pôs a placa no para-choque traseiro, centrada. O Kennedy
corrigiu com uma captura: *"no implemento a placa vai essa placa a direita da
imagem, em baixo da lanterna traseira, nao no parachoque"*. E o bake dá razão a
ele — o porta-placa EXISTE:

```
painel    x −1,167…−0,705   y 0,913…1,098   z −7,273…−7,213     462 × 185 mm
lanterna  x −1,206…−0,648   y 1,089…1,254   z −7,328…−7,266
```

Um painel raso encostado por baixo na lanterna, alinhado com ela em x, em que uma
placa de 400 × 130 mm cabe com 23 mm de folga de cada lado. É a única peça da
traseira cujas medidas só fazem sentido como porta-placa.

⚠️ **Achado por GEOMETRIA, não por nome.** O nó se chama
`stitch_result_stitch_all_plastico-preto_0_7`, e o `_7` é o índice de um export
que o próximo re-bake renumera em silêncio — a mesma armadilha do cabeçalho de
`landing-gear.ts`. A regra é a definição da peça: *é o painel raso que fica
abaixo da lanterna traseira, alinhado com ela em x, e grande o bastante para uma
placa*.

⚠️ **E o lado é o da DIREITA DO VEÍCULO** — que é o lado direito de quem olha a
traseira, porque olhar a traseira é encarar a mesma direção para a qual o veículo
aponta. Com a frente em `+z` e o topo em `+y`, a direita é `frente × topo = −x`.
O bake nomeia lados de forma inconsistente (`PARABARRO-E` está em `x < 0` e
`registro-MangueidaTraseira-E` em `x > 0`), então nome de nó não decide isto.

### 19.6 O defeito que o porta-placa revelou — `HEAVY_VERTS` e `REAR_TAIL`

Montada a placa, o portão da bancada reprovou o redimensionamento: **o
porta-placa não acompanhava a traseira.** Num baú alongado em 2 m, a lanterna ia
para `z −9,328` e o painel — com a placa nele — ficava em `−7,273`, ou seja 2 m
dentro do veículo. É defeito ANTERIOR a esta rodada, e ele tinha **duas** causas
independentes, as duas em `trailer-assembly.ts`:

| constante | era | é | o que ficava para trás |
|---|---|---|---|
| `REAR_TAIL` | 0,25 | **0,28** | o painel erra a faixa por **17 mm** |
| `HEAVY_VERTS` | 50 000 | **56 000** | a chapa furada tem 53 533 vértices |

O `REAR_TAIL` antigo foi calibrado na peça mais dianteira que alguém tinha
olhado, a tampa da lanterna (`z0 + 215 mm`). Abaixo da lanterna há mais conjunto,
e ele passava despercebido porque também mora sob o piso. As oito malhas na
janela entre 250 e 275 mm são todas traseira sem dúvida: os quatro painéis
porta-placa, as duas mãos-francesas do quadro e os dois parafusos delas. 0,28 cai
no meio do vazio — a próxima malha para cima é a prateleira do quadro em
`z0 + 304 mm`, ou seja há 24 mm de folga.

O `HEAVY_VERTS` partia o painel em dois: ele vem em DUAS malhas coincidentes — a
chapa furada (53 533 vértices, e é a furação que a engorda) e o fundo (16 069).
Com o corte em 50 000 só o fundo recuava. O acervo sob o piso não tem nada entre
58 763 e os monstros que o filtro existe para pular: para-lama 58 763 ·
**porta-placa 53 533** · pneus 44 593.

⚠️ **O que ainda NÃO está consertado**, e fica registrado: a prateleira
`Metal-preto_0_20/_0_21` (13 mm de espessura, `z máx −7,176`) continua parada,
porque erra `REAR_GRIP` por 4 mm no outro extremo. É uma chapa fina escondida sob
o quadro; consertá-la pede rever a regra, não esticar mais a faixa — esticar até
0,31 varreria junto as lanternas laterais, que são da SAIA e têm de ficar.

### 19.7 Custo, e o que ficou provado

**Duas chamadas de desenho por placa** — a arte e o casco escuro são dois
materiais na mesma geometria —, quatro no conjunto engatado, de 552. A peça sai
da fusão pelo mesmo motivo da patola (§16.1): um balde assa os vértices na pose
do instante, e a placa do implemento anda o resize inteiro.

⚠️ Mas a exclusão que DISPARA não é a de nome. `merge.ts` testa as estruturais
antes das de dono, e a primeira é `Array.isArray(o.material)` — medido,
`mergeInfo().excluidas` traz `"material em array": 1`, que é a placa. A regra
`^PLACA$` fica como REDE: no dia em que alguém unificar os dois materiais num
atlas, a proteção estrutural evapora sem erro nenhum e é ela que segura a peça.

`checks-placa-0816.mjs` prova sete propriedades: o manifesto com 49, a posição
local igual ao manifesto, o porta-placa achado fora do eixo e na altura certa, a
arte decodificada (uma textura 404 dá uma chapa branca que passa despercebida em
toda verificação geométrica), o resize acompanhando a lanterna **peça a peça**, a
sobrevivência à fusão, e a troca de cavalo repondo a placa nos seis fabricantes.
`checks-placa-frota-0816.mjs` carrega os 47 que têm card e fotografa cada um.

⚠️ **ELE NÃO CABE NUMA CORRIDA SÓ**, e isso custou duas tentativas mortas pelo
prazo sem uma linha de relatório (a bancada só imprime no fim). São ~50 s por
cabine; rode com `--marca`, um fabricante por vez — o filtro chega pela linha de
comando via `window.__benchArgv`, que é um gancho novo de `bench.mjs`. E dois
chassis são "Em breve": o card deles nasce `disabled`, `applyChoice()` não entra,
e mandá-los para o laço custava 300 s de espera CADA. Eles continuam no
manifesto, e o portão verifica isso estaticamente.

**O resultado:** 47 de 47 carregaram com a placa no sítio do manifesto, zero
falhas. `tools/placa/contato.py` monta a folha de contato; nela 40 dos 47
quadros mostram a placa e 7 a perderam pela borda — o estúdio recusa câmera
colada (`minDistance` é uma esfera de ~1 raio do rig em volta da mira, mais a
expulsão de corpo), então o enquadramento apertado nem sempre fecha. Todos os
sete são cobertos por um irmão do mesmo modelo ou pelo portão 8.

⚠️ **Um portão desta rodada PASSOU EM FALSO na primeira escrita**, e vale o
registro: ele comparava a placa com a lanterna lendo `getWorldPosition()` dos
nós — que devolve a ORIGEM do nó, não a geometria — e concluía "andaram o mesmo:
0 mm" quando nenhuma das duas tinha andado. Quem responde é a caixa por VÉRTICE.

---

## 20. 2026-08-16 — a marca d'água do vídeo (substituída no mesmo dia — ver §22)

> *"adicione uma marca d'água com a logo ankaa no vídeo gerado, no canto inferior
> direito"*

### 19.1 As duas respostas óbvias não servem, e a razão é a mesma dos outros blocos

**Um `<img>` posicionado por CSS** não funciona: *overlay de DOM nunca é composto
no canvas*. É a mesma propriedade que `ui/chrome.ts` registra como **vantagem** da
pílula de gravação ("ela pode dizer o que quiser sem sujar o arquivo") — aqui ela
é o obstáculo. O gravador constrói cada `VideoFrame` a partir do canvas do
renderizador e de mais nada.

**Compor num canvas 2D intermediário** é o caminho que o cabeçalho de
`scene/record.ts` já recusa por escrito para o caso geral: uma cópia de quadro
inteiro por quadro, mais um segundo canvas, a 1080p60 — para carimbar um
retângulo de 137 px.

Sobra a certa: **um quadrilátero ortográfico desenhado no MESMO buffer, depois da
cena**. Duas triângulos por quadro.

### 19.2 `onOverlay` — a terceira lista de ganchos

As duas que existiam correm **antes** do `renderer.render()`, que é exatamente o
que um carimbo não pode fazer:

| gancho | o que é | quando roda |
|---|---|---|
| `onFrame` | corrige ESTADO (grampos, expulsão, bruma) | sempre, até em quadro pulado |
| `onDrawFrame` | DESENHA para alvo próprio (reflexo do piso) | antes da cena, para o piso o ler no mesmo quadro |
| `onOverlay` | compõe POR CIMA do quadro pronto | depois do `render()` |

Chamado nos **dois** sítios de desenho (o laço vivo e `renderOfflineFrame`),
porque as duas gravações possíveis passam cada uma por um: o caminho offline
desenha à mão, e a reserva em tempo real lê o canvas que o laço compôs. Uma marca
que só existisse num dos dois faria alguns vídeos saírem sem ela — e o usuário não
teria como saber qual caminho a máquina dele pegou, porque isso é uma descoberta
de runtime.

⚠️ **Quem entra ali é responsável pelo `autoClear`.** Um segundo `render()` com a
bandeira ligada — que é o padrão — **limpa o buffer e joga fora a cena que acabou
de ser desenhada**, sem erro nenhum. O assinante guarda e devolve.

### 19.3 As decisões do carimbo

* **`toneMapped: false`.** O renderizador sai em ACESFilmic, que escurece e
  dessatura tudo que passa por ele. Um logo tone-mapeado sairia com o verde da
  marca lavado **e diferente em cada cenário**, porque a exposição muda com a hora
  do dia.
* **O tamanho sai da ALTURA do quadro** (5,5 %), nunca da largura, e a folga
  também (3 %). Ancorar na largura pareceria natural e erraria em 21:9: o mesmo
  vídeo ganharia um logo 40 % maior só por ser mais largo.
* **Mipmap + anisotropia.** O PNG tem 875 px e é desenhado com ~137: sem mipmap a
  minificação amostra um texel a cada seis e o contorno vira serrilha
  **piscante**, que num vídeo é o pior tipo de artefato.
* **Opacidade 0,85.** Uma marca d'água é assinatura, não selo.
* **Falhar não cancela nada.** Quatro minutos de render perdidos por um PNG de
  40 KB que não respondeu seria a pior troca possível: o vídeo sai sem a marca e a
  ressalva de `degraded` diz.

### 19.4 Onde ela NÃO aparece, e é decisão

O viewport vivo (ninguém trabalha com um logo grudado no canto), a **foto**
(`capture.ts` renderiza para alvo próprio e nunca chama o gancho — e um carimbo
num recorte transparente destruiria o que aquele modo entrega) e a **prévia** do
criador (ela existe para decidir o movimento da câmera).

⚠️ E o `/branding/logo.png` é servido pelo **WEB**, como o decodificador Draco e
as fontes — não pela árvore do studio. `BRAND_LOGO` é absoluto e **não passa por
`assetUrl()`**; prefixá-lo com `STUDIO_BASE` daria um 404 mudo. A bancada precisou
ganhar `/branding/` na lista de diretórios servidos, senão toda gravação saía com
a ressalva e o caminho de degradação passava por certo.

### 19.5 O que ficou provado

`checks-percurso-video-0816.mjs` mede o **pixel**: com a marca desligada, o canto
inferior direito tem **0** pixels do verde da marca; com ela ligada, **706 de
3 640** (a caixa exata do logotipo). E confere que a bandeira foi solta no fim —
ligada por engano ela carimbaria o estúdio inteiro, inclusive a próxima foto, até
alguém recarregar a página.

---

## 21. 2026-08-16 — a prévia, de novo: o "por algum motivo" tinha nome

> *"tinha parado de bugar durante o preview, mas voltou por algum motivo,
> ultrathink para uma própria análise e garanta que irá fazer funcionar como
> esperado, suave"*

**"Por algum motivo" é a parte informativa.** Um defeito que vai e volta sem o
código mudar depende de ESTADO — e o estado, aqui, é a **escala de render no
instante em que se aperta ▶**.

### 20.1 O que a primeira tentativa (§17.6) errou

1. **Ela culpou o flash de realocação.** A hipótese era que o controlador de
   qualidade, vendo quadros caros, trocava a escala e o `setSize()` limpava o
   drawing buffer — um quadro em branco por degrau. **É falso, e o próprio
   `scene.ts` prova**: aquele defeito existiu, foi relatado ("está dando umas
   piscadas às vezes") e **já foi consertado** — `flushPendingScale()` aplica a
   escala no TOPO do quadro, antes do `render()`, justamente para que realocação
   e desenho caiam no mesmo quadro. Não havia flash a evitar.

2. **E, pior, ela tirou a única válvula que ajudava.** `markBusy()` congela o
   controlador — e o controlador é exatamente quem abaixa a resolução quando o
   quadro não cabe no orçamento. A prévia virou **a única interação do estúdio
   sem adaptação**: com a escala em 1,0 no clique, ficava em 1,0 o percurso
   inteiro; com a escala já baixa (porque o usuário tinha acabado de orbitar numa
   cena pesada), ficava lisa. É esse o "por algum motivo".

3. **E o corte do reflexo estava condicionado à medida errada.**
   `floorReflectionCost()` devolve ms de **submissão**, e o próprio
   `floor-reflection.ts` avisa por escrito que a conclusão antiga não pode ser
   copiada para a cena fundida: depois do `merge`, a submissão deixou de dominar
   e o que sobrou é **preenchimento**, que aquele número não mede. Um limiar
   sobre a grandeza errada é um botão que às vezes liga.

### 20.2 A resposta: um MODO PROXY, imediato e determinístico

Toda ferramenta de vídeo tem uma prévia mais barata que o render final, e pela
mesma razão: o que se decide olhando uma prévia de câmera é o **movimento**.
Resolução e reflexo não mudam essa decisão; a fluidez muda.

Enquanto a prévia toca — e voltando exatamente como estava ao pausar:

* **o reflexo do piso sai, sem limiar nenhum.** É uma segunda renderização
  completa da cena, e o diagnóstico do próprio estúdio na máquina do dono o mede
  em **4,6 ms de um quadro de 16,2 ms — 29 %**;
* **a escala de render cai para 0,70 no primeiro quadro.** Não adianta esperar o
  controlador: `SCALE_COOLDOWN_DOWN` é 900 ms **por degrau**, então ele levaria
  ~2 s para chegar onde este corte chega imediatamente — e uma prévia de 4 s
  teria metade dela travada antes de o socorro chegar. O preenchimento segue a
  escala **ao quadrado**.

⚠️ E o controlador **continua congelado**, agora pelo motivo certo — que não é o
flash: no nível Alta o piso da faixa dele é `0,80`, ou seja **acima** do que o
proxy já aplicou (ele não tem nada melhor a oferecer sem descer de NÍVEL); e
descer de nível no meio de um movimento **liga o LOD** (`lodMinPx` é 0 no Alta e
positivo abaixo), fazendo centenas de peças pequenas aparecerem e sumirem — *isto*
sim seria visto como "flicando".

A escala não é persistida (`setScale` só avisa ouvintes), então mexer nela não
deixa rastro na sessão; a restauração é **guardada, não recalculada**, e só
devolve se o valor ainda for o nosso — alguém pode tê-la fixado pelo console no
meio.

### 20.3 A resposta de produto: dizer o número

Enquanto a prévia toca, o relógio mostra **`1,2 s / 4 s · 60 fps`** e a nota do pé
troca de assunto abaixo de 50 fps:

> *"A prévia está a 24 fps nesta máquina — o VÍDEO sai a 60, liso: ele é desenhado
> quadro a quadro, fora do tempo real."*

⚠️ **É a resposta à pergunta que o usuário tem e não faz.** "A prévia está
travada" quase sempre quer dizer *"o vídeo vai sair assim?"* — e a resposta é
**não**, categoricamente. Sem essa linha, a pessoa desiste de um percurso que
estava certo.

### 20.4 O que a bancada prova, e o que ela não pode provar

`checks-previa-proxy-0816.mjs` mede **no cenário do relato** (Estúdio, com o piso
polido — a primeira medição rodou no distrito e por isso deu 60 fps cravados e não
disse nada). Ela prova o MECANISMO, **dentro** da reprodução: o proxy ligado, o
reflexo fora, a escala em 0,70, a taxa sendo medida, e tudo devolvido ao pausar.

⚠️ O que ela **não** pode provar: aqui o laço fica travado em vsync (16,6 ms) com
folga em qualquer configuração, então nenhum tempo daqui refuta ou confirma o
engasgo do dono. E `frameSplit` **não vale durante a prévia** — `markBusy()` põe o
laço numa janela ocupada e a repartição só é atualizada fora dela.

---

## 22. 2026-08-16 — a marca d'água saiu, entrou uma VINHETA de encerramento

> *"remova a marca d'água durante o vídeo, e coloque ao final esse vídeo, de
> forma sutil, suave a transição, mas a animação está demorando muito iniciar,
> então corte o início do vídeo"*

A troca é boa e vale dizer por quê: **um carimbo no canto pesa em todo quadro e
nunca é o assunto; uma vinheta no fim pesa em nenhum e é o assunto por sete
segundos.** `scene/watermark.ts` foi apagado inteiro (era o §20); nasceu `scene/outro.ts`.

### 21.1 O asset: cortado, sem áudio, e em DOIS contêineres

O original tinha 10 s e **os 2,2 s iniciais eram fundo vazio** (medido: o
primeiro pixel verde aparece em 2,375 s). O arquivo shipado começa em 2,2 s —
sobram ~0,2 s de fundo limpo, que é exatamente onde a dissolvência pousa. Áudio
removido: o gravador não tem trilha.

⚠️ **São dois arquivos, e o WebM vem primeiro.** Não é redundância: um `<video>`
com **H.264 derruba o processo de GPU** no `chrome-headless-shell` — medido, com
`isContextLost() === true` logo depois do `load()`. VP9 não. O mesmo par existe
do outro lado do estúdio (o gravador), pela mesma doutrina. E o VP9 pesa 295 KB
contra 1,5 MB.

### 21.2 O quadro tem de nascer NO CANVAS DO RENDERIZADOR

`openOfflineEncoder()` amarra um `mb.CanvasSource` a `renderer.domElement`: toda
a pipeline pende daquele canvas. Então a vinheta é desenhada **como cena** — um
quadrilátero ortográfico de tela cheia com a textura do `<video>`, pelo gancho
`onOverlay` que a marca d'água havia introduzido.

**Dois relógios, porque são duas naturezas:**

| caminho | quem avança a vinheta | por quê |
|---|---|---|
| offline | `currentTime` (busca) | o vídeo é montado FORA do tempo real; um `play()` sairia acelerado ou arrastado conforme a máquina |
| reserva | `play()` | o `MediaRecorder` carimba pelo relógio de parede — tocar é a única forma de sair na velocidade certa |

E a ordem no laço offline é contrato: **buscar (assíncrono) → desenhar → `add()`**.
Um `await` entre o desenho e a captura dá vídeo preto.

### 21.3 Três defeitos encontrados medindo, e nenhum deles lançava

Esta rodada foi um estudo de caso de falha silenciosa. Os três produziam um MP4
que **abre, tem a duração certa e está errado**:

1. **Contexto WebGL perdido → 240 quadros pretos em 44 KB.** Causado pelo
   `<video>` H.264 no headless, mas a causa é secundária: quando o contexto cai,
   `renderer.render()` **sai na primeira linha sem erro**, o laço continua e o
   arquivo é entregue como sucesso. O gravador não tinha guarda nenhuma.
   Agora tem: `contextLost()` antes de abrir o codificador e a cada 30 quadros,
   com uma mensagem que diz o que houve e o que fazer.
2. **A carga da vinheta estava DENTRO da preparação**, depois de
   `pinCeilingProfile()`, dos 1080p forçados e do `stopLoop()` — uma espera de
   REDE com o estúdio preparado e parado. Foi para junto da sondagem de codec,
   que é o bloco documentado como "antes de qualquer mutação".
3. **`VideoTexture` congelada.** Ela delega a atualização ao
   `requestVideoFrameCallback`, que só dispara quando o vídeo **apresenta** um
   quadro — e o laço offline nunca apresenta. A vinheta saía como sete segundos
   de fundo parado. ⚠️ E a resposta óbvia (trocar por uma `Texture` comum e
   marcar `needsUpdate` na mão) sai **pior**: o `WebGLTextures` só passa o
   elemento direto ao `texImage2D` quando `isVideoTexture` é verdadeiro; no
   caminho comum ele lê `image.width`, que num `<video>` é 0, e sobe uma textura
   vazia — a vinheta saiu PRETA. A combinação certa é a classe `VideoTexture`
   (pelo upload) com `needsUpdate` marcado à mão (pelo gatilho).

### 21.4 E um quarto, na bancada — que também era invisível

Com o servidor da bancada sem `Accept-Ranges`, o `<video>` reportava
`readyState 4`, a duração certa e **`seekable` VAZIO**: todo `currentTime = t`
era aparado para 0 em silêncio e o fecho saía congelado. Um navegador só habilita
busca em mídia quando o servidor anuncia range — ter o arquivo inteiro em memória
não basta. `bench.mjs` ganhou requisições parciais (206) e o tipo MIME de `.mp4`
e `.webm`; um tipo errado é pior que um arquivo ausente, porque passa por
meio-certo.

### 21.5 O que ficou provado

`checks-percurso-video-0816.mjs`: o arquivo mede **percurso + vinheta** (2 +
7,792 = 9,8 s, 588 quadros), e a vinheta é **buscável** — o portão que faltava
quando ela saiu congelada. O conteúdo é julgado fora, com ffmpeg: quadro 110 é a
cena, 135 é a dissolvência (o caminhão sumindo enquanto a estrela entra), 165 em
diante é a animação correndo até o logotipo montado.

## 23. 2026-08-16 — o Thermo King caía ao trocar de cavalo, e a culpa era da fusão

> *"quando troco o cavalo o thermo king fica errado a posição, se eu recarrego
> fica correta"*

**"Se eu recarrego fica correta" é a metade informativa do relato**, e ela sozinha
já elimina quase tudo. Um defeito que existe no caminho de TROCA e não no de
CARGA não pode ser uma conta errada — a mesma função roda nos dois. Ele depende
de alguma coisa que a carga ainda não construiu e que a troca já encontra de pé.
Nesta cena existe exatamente uma coisa assim, e ela é nova: a **fusão por
material** de `vehicle/merge.ts` (§ da rodada de 15/08).

### 23.1 A fusão apaga a identidade da PEÇA, e essa medida vivia dela

`placeThermoKing()` não usa um recuo fixo desde 16/08: ele pergunta onde está a
travessa metálica que fecha o topo da testeira, e `measureFrontRailUnderside()`
responde varrendo o implemento e devolvendo **a face de BAIXO da candidata de
topo mais alto**. Toda a regra pressupõe uma coisa que ninguém escreveu:

> **uma malha é uma peça.**

`merge.ts` assa os triângulos de centenas de peças do mesmo material numa malha
só e esconde as origens (`.visible = false`) — e `measureFrontRailUnderside()`
**pula malha invisível**. Com a fusão de pé ela deixa de ver peças e passa a ver
um balde. O topo continua certo, porque a travessa é a peça mais alta do balde;
a face de baixo vira o ponto mais baixo de TODA a ferragem da testeira, que é o
estrado.

Medido na bancada (`checks-tk-troca-0816.mjs`, Scania R 2009 4x2):

| | face de baixo | topo | malha vencedora |
|---|---|---|---|
| fusão **solta** | **4 093,9 mm** | 4 163,8 mm | `stitch_result_…_estrutura-principal_0_12` · 344 vért. |
| fusão **aplicada** | **1 539,0 mm** | 4 163,9 mm | `FUSAO__inox-ferragem__b3` · 1 920 vért. |

**−2 554,9 mm**, e o topo idêntico nas duas — a assinatura exata de "é a mesma
travessa, medida por um objeto que virou outra coisa".

Na tela: a unidade caía de **38,0 mm** abaixo do teto para **719,9 mm**, com a
base parando em **−0,0 mm** sobre o piso. Não foi coincidência: é a trava de
piso do próprio `placeThermoKing()` (`Math.max(wantTop, sideBox.min.y + altura)`)
segurando a queda, porque a unidade é produto físico e não encolhe. O sintoma que
se vê na captura do relato — a unidade assentada no assoalho, com um vão enorme
até o teto — é essa trava trabalhando.

### 23.2 Por que a carga escapava

`applyMergeNow()` roda no **fim** de `runApply()` (fase "Agrupando chamadas de
desenho…"). `models.loadCab()` termina em `placeTrailer()` → `placeThermoKing()`,
e ele roda **antes**. No boot não há fusão nesse instante; numa troca, há — ela
ficou de pé desde a aplicação anterior. Uma linha de tempo, dois estados.

### 23.3 O conserto: o TERCEIRO ponto da fusão

O bloco A FUSÃO POR MATERIAL de `studio.ts` dizia **"NÃO HÁ UM TERCEIRO PONTO"** e
nomeava um risco só — trocar `mesh.material` de uma malha fora das exclusões, que
não aparece. Faltava a outra metade, e é ela que custou este defeito. A regra
completa é:

> **com a fusão de pé, não se troca material NEM se mede peça.**

`runApply()` passou a **soltar** a fusão no topo, quando há cabine nova. Não
refaz: quem refaz é o ponto 1, no fim da mesma função — então isto não é uma
segunda fusão, é a mesma, adiada até depois da medição. Custo: uma escrita de
`.visible` em ~2 000 malhas, e o download seguinte roda sob a cortina.

Não solta numa troca só de CENÁRIO: ali `loadCab()` nem é chamado, nada do
implemento é medido, e soltar pagaria uma refusão por nada.

⚠️ **O `catch` também refaz.** Ele existe para deixar a cena anterior de pé
("meio aplicada é pior do que velha") — e sem isso a deixaria de pé **sem
fusão**, com as ~2 000 chamadas de volta e a imagem idêntica, ou seja um quadro
14,9× mais caro em silêncio até a próxima troca que desse certo.

### 23.4 E o cinto, na própria medida

`measureFrontRailUnderside()` passou a **recusar balde** (`userData.tsMergeBand`,
o mesmo contrato por `userData` que `material-setup.ts` usa para não importar
`merge.ts`). Quem medir com a fusão de pé recebe `null` — a degradação
DOCUMENTADA, que devolve o recuo fixo de `topGap` — mais um aviso no console, em
vez de um número plausível e errado por dois metros e meio. O erro de 155 mm do
`topGap` é uma coisa que se vê; o de 2 554,9 mm passa por conserto.

### 23.5 O que ficou provado

`checks-tk-troca-0816.mjs` roda em três atos e cada um responde uma pergunta
diferente: **mecanismo** (a mesma travessa medida nos dois estados),
**sintoma** (uma troca de cavalo de verdade, por `applyChoice`) e **controle** (a
mesma troca com a fusão solta antes). Antes do conserto: −2 554,9 mm · a unidade
desceu 681,9 mm · com a fusão solta, 0,0 mm. Depois: a troca deixa a unidade em
**38,0 mm abaixo do teto, 0,0 mm de desvio contra o boot**.

O ato 1 continua acusando os −2 554,9 mm de propósito — ele mede o mecanismo com
uma reimplementação local, e é isso que documenta *por que* a fusão sai de pé em
vez de deixar a regra parecer arbitrária.

---

## 24. 2026-08-18 — o SEGUNDO implemento, e o que ele quebrou por ser o segundo

Chegou o **sobrechassi frigorífico gancheiro** (`~/Downloads/glb.zip`), com dois
caminhões rígidos junto — Scania P360 e Volvo VM 2015. O relato do dono foi
*"vem completamente quebrada, muitas texturas erradas, a peça preta só tem a
parte metálica, provavelmente tem z-fighting, e a porta lateral é terrível"*.

Ele estava certo nas quatro, e as quatro tinham causas **diferentes**. Este
capítulo separa uma da outra, porque a lição da rodada é que "o modelo está
quebrado" era quatro defeitos empilhados e três deles não estavam no modelo.

### 24.1 O arquivo: um material para 1 147 primitivas

O `.gltf` de 121,3 MB declara `materials: 1`, `textures: 0`, `images: 0`. Não é
"textura errada": é a atribuição de material inteira apagada no export. Tudo
vira a mesma superfície branca — e daí saem, de uma vez, "as texturas estão
erradas", "a peça preta só tem a parte metálica" e "vem quebrada".

A identidade sobreviveu no **nome da malha**: o FBX2glTF batiza
`${nó}_${material}_${índice}`, e é dali que `tools/implement-bake/materialize.mjs`
reagrupa. **14 dos 17 nomes batem letra por letra com os do semirreboque**,
inclusive o erro de digitação `platico-branco` — os dois baús são do mesmo
fabricante (a plaqueta Ibiporã está nos dois). Por isso o material vem do
`trailer.glb` e não das 65 PNG que vieram na pasta: o engine despacha **por nome
de material** (`applyTrailerFinish`, `splitTrailerHardware`,
`TRAILER_STRUCT_METAL_RE`, `WHITE_RE`, `FITA_RE`, `DOOR_FRAME_MAT_RE`), então
nomes iguais fazem o implemento novo herdar acabamento, inox, fita
retrorrefletiva, lanternas e pintura **sem uma linha de código**.

### 24.2 GOTCHA — `mode: 5`, e é ele que apagava o Draco

**As 1 147 primitivas vêm em TRIANGLE_STRIP.** Nenhum outro asset do acervo é
assim. Três consequências, todas silenciosas:

1. `gltf-transform draco` **pula tira** — a linha era `17,10 MB → 17,17 MB`, com
   o aviso `Skipping Draco compression of 292 non-TRIANGLES primitives`. Depois
   do destrip o mesmo comando faz **17,0 → 8,8 MB**.
2. **1 042 797 dos 2 792 053 triângulos eram DEGENERADOS** de emenda de tira —
   37 % de área zero, com normal indefinida. O `GLTFLoader` converte tira em
   lista no carregamento (`toTrianglesDrawMode()`) e **mantém o degenerado**.
3. A conta ingênua `count / 3` mente por 3× (numa tira saem N−2 triângulos).

**E a inversão de enrolamento dos ímpares NÃO aparece em foto**: todo material
do `trailer.glb` é `doubleSided`, então expandir a tira sem trocar dois vértices
deixa metade das faces do avesso sem um buraco sequer na imagem. Quem pega é
`tools/implement-bake/winding.mjs`, comparando a normal geométrica com a
declarada: certo dá **99,85 %**, errado daria ~50 %.

Cadeia completa: **121,3 → 107,6 (materializado) → 33,8 (dedup) → 17,1 (prune)
→ 17,0 (webp) → 8,79 MB (Draco)**.

### 24.3 O catálogo de implementos — `vehicle/implements.ts` (NOVO)

`loadTrailer()` sabia o nome do arquivo. Passou a perguntar ao catálogo, que
sai de `models/vehicles/implements.json` com **padrão em código**: enquanto a
árvore servida não tiver o manifesto, `implementsOf(null)` devolve o
semirreboque de sempre apontando para `trailer.glb` — o nome ANTIGO, ainda
servido. Sem esse padrão, um deploy do web sem o deploy da árvore deixaria o
estúdio sem implemento, com 404 mudo.

O que o implemento DECLARA, e por que cada campo existe:

- **`has`** — rodagem, patola, pino-rei, placa, Thermo King. O sobrechassi não
  tem os três primeiros: quem roda é o caminhão. Chamar as funções assim mesmo
  não quebra (todas degradam), mas gasta 646 kB de download da roda e, no caso
  da patola, **inventa uma que o produto não tem**.
- **`stainlessTopRail`** — ver §24.5.
- **`sillMaterial`** — ver §24.6.

`state.implement` é o implemento **em cena**, não o escolhido. Os dois divergem
entre `setImplement()` e o `loadTrailer()` que a orquestração dispara depois, e
nessa janela toda medida é da geometria velha.

**Sem pino-rei não há engate, e o caminho legado também não serve.**
`placeTrailer()` ganhou um `return` no topo para isso: o ramo legado lê
`trailerMeta.kingpin` e desce para `LEGACY_TRAILER_FRONT_Z` — uma constante
medida no semirreboque, que plantaria o sobrechassi 2,65 m à frente do cavalo
sem um aviso. Ele fica na pose de carga até o contrato de montagem sobre chassi
rígido existir.

### 24.4 A lateral é feita de FOLHAS, e era isso que matava o baú paramétrico

A bancada nova (`tools/trailer-bench/implprobe.ts` + `shoot-impl.mjs`) mediu:
**67 cascas, ZERO frisadas**. Um baú com zero chapa frisada não redimensiona em
altura, não recorta painel de livery e não ganha rebite — tudo em silêncio,
porque `buildTrailerRig()` engole a exceção de propósito.

A causa: o flanco do sobrechassi são **17 folhas de 1,000 m** (5 108 triângulos
cada, dx 6 mm, y 1,049…3,779, passo de z 0,958 m com 42 mm de remonte). São
folhas de verdade — é o que o produto tem —, e nenhuma atravessa 90 % do vão
sozinha, que é o teste de `RIBBED`.

`mergeSkinSheets()` une as folhas de um lado ANTES da classificação. Dois
filtros carregam a função:

- **espessura** (`SHEET_THICK`, 60 mm contra os 6 mm medidos): separa folha de
  pele de membro estrutural;
- **plano mais externo** (`SKIN_PLANE_TOL`, 3 mm): separa a parede da FOLHA DA
  PORTA, que passa em todos os outros testes. Ela fica 5 mm recuada, e os
  frisos dela estão em OUTRA FASE — deixá-la entrar dá vãos de ~26 mm no
  conjunto de Y, `findRows()` não fecha corrente e **o flanco com porta perde o
  friso, só ele**. Foi exatamente o que a bancada mostrou na 1ª tentativa:
  `right` frisada, `left` não.

Depois: **2 frisadas, 48 frisos a 53,00 mm** — o mesmo passo do semirreboque.
Uma casca que já atravessa o vão sai intacta, então o semirreboque não muda:
63 cascas, 2 frisadas, medido antes e depois.

### 24.5 O trilho de topo NÃO é da família do inox — e foi surpresa

No semirreboque os dois perfis corridos de arremate da lateral (topo em
y 3,961…4,171, base em 1,309…1,519, os dois de 14,58 m) são
`metal-galvanizado-mantido`. No sobrechassi os dois equivalentes são
`metal-estrutura-principal-padrao`, em segmentos de 3,00 m — topo em
y 2,948…3,051 e base em 0,214…0,309.

Ou seja: `STAINLESS_FAMILY_RE` não alcança nenhum dos dois, e uma marca de
"trilho de topo em inox" que só olhasse aquela família não faria nada.
`TOP_RAIL_EXTRA_RE` é consultada **só** quando o implemento declara
`stainlessTopRail`, e ainda assim só para peça longa que more no teto
(`TOP_RAIL_BAND`, 0,25 m abaixo do teto branco). A distribuição das peças
longas é bimodal com 2,64 m de vazio entre as duas alturas, então o corte é
folgado.

**GOTCHA — `!TRAILER_STAINLESS_RE` no ramo estrutural de `applyTrailerFinish()`.**
O truque das âncoras (`^inox-ferragem$`, `^metal-pouco-polido$`) já impedia o
clone `…__polido` de voltar para o ramo do galvanizado. Mas `galvanizado` e
`estrutura-principal` **não têm âncora** — nunca precisaram, porque nenhum dos
dois era clonado. Passaram a ser. Sem a guarda, o clone cairia no ramo
estrutural, levaria o piso de rugosidade 0,62 e **a marca não faria nada**, sem
erro, sem aviso, e com o log dizendo que funcionou.

### 24.6 `measureSill()` casava um nome que este bake não tem

O batente inferior da porta sai do topo do perfil corrido da saia, e o filtro
era `metal-galvanizado-mantido` — o nome **no semirreboque**. O sobrechassi não
tem esse material: o perfil dele é `metal-preto`, medido a **115 mm acima do
piso** (contra 127,5 do semirreboque — a mesma peça, outro nome e outra tinta).

Sem a declaração, `measureSill()` avisa e devolve a linha do piso: a porta nasce
**dentro da cantoneira**, que é o defeito 4 do `PORTA-LATERAL-HANDOFF.md` de
volta. Com ela: batente a **122,5 mm** (115 + `SILL_CLEARANCE`).

O valor chega por `TrailerBodyOptions`, não por import: `trailer-geometry.ts` é
**arquivo espelhado** com o `truck-studio-desktop` e depende só de `three` —
ele não pode perguntar ao catálogo. Quem sabe o implemento é quem responde.

### 24.7 O z-fighting era real, e metade dele não era z-fighting

O A/B da bancada (`rasante` × `rasante-cru`, mesmo enquadramento com o corpo
paramétrico escondido) mostrou a cintilação **no bake**, não no código. Medido,
são duas coisas diferentes:

1. **A costura do remonte.** As folhas vizinhas se sobrepõem 42 mm e ficam **no
   mesmo plano em X até a quarta casa**. Duas superfícies exatamente coplanares
   empatam no z-buffer em qualquer distância — não é falta de precisão. O
   conserto é físico: um remonte de verdade não é coplanar, a folha de cima
   monta SOBRE a de baixo e fica saliente pela espessura da chapa. `SHEET_LAP`
   (0,8 mm, a espessura medida) alterna as folhas em Z, e a costura passa a ler
   como chapeamento montado — que é o que ela é.
2. **O resto era ALIASING, não empate.** A mesma foto a `ss=3` sai limpa. É
   geometria sub-pixel: há peças com densidade patológica neste bake — duas
   tiras de `metal-preto` de **17 396 triângulos cada** para um perfil de
   15 × 55 mm × 8,26 m, e `plastico-preto` com 209 k triângulos em 16 peças.
   O conserto disso é decimação dirigida, **não** um truque de profundidade, e
   está EM ABERTO.

O `?ss=` da bancada existe para essa distinção e só para ela: cintilação que
some com mais pixel é malha, cintilação que fica é plano.

### 24.8 O que ficou provado, e o que ficou em aberto

Provado: 82 testes verdes; `tsc` limpo; o semirreboque mede **63 cascas / 2
frisadas / 53,4 mm** antes e depois; o sobrechassi passou de **0 para 2 cascas
frisadas** e ganhou a porta lateral paramétrica inteira (18 peças, batente a
122,5 mm).

Em aberto, e nesta ordem:

- os dois **rígidos** (P360 e VM 2015) não estão no catálogo — sem eles o
  sobrechassi não tem em que montar. O P360 tem **2,9 M triângulos**, 9× o
  `volvo_fh_2021_4x2`: vai precisar de orçamento antes de entrar;
- **rebite e emenda** no sobrechassi: `addPlateRivets()`/`applyPlateLap()` são
  ancorados na régua do semirreboque e ainda não foram medidos neste baú;
- a **porta lateral assada** continua na cena junto com a paramétrica — quem
  monta a nova ainda não esconde a velha;
- a **decimação** das peças super-tesseladas (§24.7);
- o `logo-chapas-metal` (as plaquetas Ibiporã) não casa `TRAILER_DECAL_RE` e
  portanto não leva o `polygonOffset` de decalque.

---

## 25. 2026-08-18 (noite) — os dois RÍGIDOS, e a carroceria que se aparafusa

O §24 deixou o sobrechassi lendo certo e sem em que montar. Esta rodada põe os
dois caminhões de carroceria no catálogo — **Volvo VM 6x2** e **Scania P 8x2
bitruck** — e fecha a montagem.

### 25.1 O primeiro resultado da bancada foi a carroceria em cima do capô

`tools/trailer-bench/mountprobe.ts` carrega caminhão e carroceria na mesma cena
e assenta um no outro. A primeira execução pôs a carroceria de z −9,81 a −1,18,
ou seja **à frente do caminhão inteiro**. A causa é uma convenção, e ela não
está escrita em nenhum dos dois arquivos:

> `hitch.json` declara `axes.forward: "+Z"` como o espaço NORMALIZADO e traz
> `orientYaw: π` para cada cavalo — **no GLB cru eles apontam para −Z**. O
> IMPLEMENTO não passa por isso: a testeira dele é o MAIOR z e continua sendo.

Medido no VM cru: eixo direcional em z −1,85, ponta do quadro em +7,25. Sem o
giro, "atrás da cabine" é +Z no caminhão e −Z no implemento, e os dois se
afastam. Com o giro, os dois andam para −Z e a montagem fecha.

### 25.2 `frameTopY` é um percentil, e a foto é quem o fecha

A mesa da longarina não sai de `max` nem de `median`, e as duas tentativas
estão registradas porque cada uma falha de um jeito diferente:

- **máximo por célula** → desenha uma RAMPA de 200 mm em 8 m no VM. Longarina
  reta não faz rampa: o que estava sendo medido eram travessa, suporte de
  para-lama e berço de eixo, que passam pela janela e sobem para a traseira.
- **faces horizontais ponderadas por ÁREA** (a medida "certa") → devolve oito
  planos entre 0,75 e 1,15 sem nenhum dominante. A mesa deste rip não é uma
  superfície contínua.

O que a medição SALVOU foi a janela: **a alma da longarina dos dois caminhões
está em |x| = 0,425** — 8,6 m² de face lateral no VM e 10,0 m² no P. Isso é a
assinatura do perfil, não coincidência, e é ela que fixa a faixa de amostragem.

Então `frameTopY` é o **percentil 90 do máximo por célula de 250 mm** naquela
faixa, e a bancada desenha quatro lâminas coloridas nas alturas candidatas para
a foto decidir. VM **1,189**; P **1,037**.

**A CONFERÊNCIA QUE FECHOU:** as duas longarinas do SUB-CHASSI da carroceria
estão em |x| 0,374…0,439 — a cavalo sobre a alma de 0,425. Os dois lados da
montagem falam do mesmo objeto, e isso não entra na conta: entra na confiança.

### 25.3 GOTCHA — o datum da carroceria não é o ponto mais baixo

`groundAndCenter()` assenta o implemento pelo ponto mais baixo, que num
semirreboque é o pneu. No sobrechassi são **as duas mangueiras traseiras, 800 mm
abaixo do sub-chassi** — assentar por elas põe a carroceria 0,8 m alta, e a
montagem, o Thermo King e o livery herdam o erro.

`measureMountDatum()` acha o fundo do sub-chassi por FORMA e não por nome: um
membro do sub-chassi ATRAVESSA o baú, uma mangueira não. Medido: as longarinas
auxiliares têm 8,450 m de vão em Z contra 8,63 m de baú; as mangueiras, 0,334 m.
O corte em metade do comprimento cai num vazio de 8,1 m. O fundo delas é
y = 0,001 — o zero do arquivo, que é onde o modelador o pôs.

### 25.4 O implemento SEGUE O CHASSI — não há seletor

Um rígido não engata semirreboque e um cavalo não leva carroceria. Não é
preferência: é o que o veículo é. `ModelDef.rigid` (novo, default `false`) é a
única coisa do catálogo que muda QUAL implemento carrega, e `studio.ts` troca a
escolha antes de decidir `needTrailer`.

`setCurrentImplement()` **não recarrega nada** de propósito: a troca tem de
acontecer dentro da orquestração que solta a fusão, baixa a cortina e refaz
`applyMergeNow()` — recarregar de fora deixaria a fusão do implemento ANTIGO de
pé sobre malhas que não existem mais (§23).

### 25.5 Três estados de módulo vazavam, e um deles era invisível

`loadTrailer()` rodava **uma vez por página** e por isso não tinha desmonte.
Passando a rodar por troca de chassi, três coisas passaram a vazar:

1. **A patola** (`patola`, estado de módulo em `landing-gear.ts`) e **a placa**
   (`placaTrailer`/`portaPlaca`, em `license-plate.ts`) ficariam apontando para
   malhas descartadas — `forgetLandingGear()` e `detachTrailerPlate()` são
   novos e existem só para isso.
2. **Os painéis de livery**, que têm material PRÓPRIO por painel. Liberados
   ANTES do `disposeTree()` da raiz, senão ficam órfãos.
3. **`livery.attachOverlays()` estava sob `if (first)`** — o mais silencioso dos
   três. A plotagem sumiria no primeiro clique num chassi rígido, sem erro
   nenhum, porque as sobreposições continuariam penduradas em chapas que já
   foram descartadas. Virou `if (needTrailer)`.

E o `*_meta.json` passou a ser recarregado junto: ele é DO IMPLEMENTO, e deixar
o do semirreboque de pé manteria um pino-rei que este baú não tem — que o ramo
legado de `placeTrailer()` leria.

### 25.6 O que ficou medido

| | Volvo VM 6x2 | Scania P 8x2 |
| --- | --- | --- |
| mesa da longarina | 1,189 m | 1,037 m |
| traseira da cabine | z +1,033 | z +0,688 |
| quadro útil atrás da cabine | 8,280 m | 9,368 m |
| piso da carroceria | 1,189 m | 1,037 m |
| teto | 4,25 m | 4,10 m |
| balanço além da ponta do quadro | 499 mm | −588 mm (sobra quadro) |

A folga cabine→testeira é 150 mm nos dois (`defaults.cabGap`), e a carroceria
não gira nem inclina: ela é solidária ao quadro.

### 25.7 Em aberto

- O **P360 tem 2,9 M triângulos** (9× o `volvo_fh_2021_4x2`) e 30,7 MB. Entra,
  mas precisa de orçamento antes de virar rotina.
- **Sem card próprio**: os dois caem no placeholder de silhueta do seletor até
  `tools/studio-render/shoot.mjs` fotografá-los.
- O nome comercial do Scania saiu do arquivo de origem (`p360`); se o modelo for
  outro, é o campo `name` do `brands.json` que muda.
- `mounts.json` não tem `fingerprint` como o `hitch.json` — se o bake do
  caminhão for refeito, nada acusa que as medidas envelheceram.

---

## 26. 2026-08-18 (madrugada) — a PORTA VIROU ASSET, e o resto das correções do bake

Com o sobrechassi montado no VM, o dono fotografou o conjunto no app e listou
oito defeitos. Este capítulo cobre os que foram fechados; os que ficaram estão
no fim, com a medida de cada um.

O enunciado dele é a chave de tudo: *"as únicas diferenças entre eles são a
frente que tem um vão menor já que o Thermo King é menor, a lateral o frame de
cima que é menor e inox, e a traseira que tem apenas 2 varões em vez de 4; o
resto é exatamente igual"*. Ou seja — **o que diverge é o BAKE, não o produto**,
e a régua certa é o implemento antigo.

### 26.1 A porta de fábrica estava 7,7 mm FORA DE FASE

Medido: as fileiras de friso da folha ficam em `0,7480 + k·53 mm` e as da parede
em `0,3693 + k·53`. **7,7 mm de defasagem** (máx. 26,3). Isso explica duas
coisas de uma vez: a peça lê errado na imagem (a onda dela não continua a da
parede) **e** ela não pode entrar na união da parede — fora de fase, quebra a
corrente de `findRows()` e o flanco inteiro perde o friso.

`removeBakedSideDoor()` tira as **110 malhas** da porta e `fillSheetGaps()`
fecha o vão de 994 mm **clonando uma folha da própria parede** — a única forma
de manter a fase. Porta volta a ser sob demanda, como no semirreboque.

**GOTCHA — o plano da pele é POR FLANCO.** O baú não é simétrico em X: a pele
direita está em +1,309 e a esquerda em −1,299. Com um `skin` global de 1,309,
TODA folha da parede esquerda aparece "recuada 10 mm" e passa por folha de
porta: a primeira versão marcou 8 janelas e removeu **346 malhas** — o flanco
inteiro, com fita, lanterna e parafusaria junto.

### 26.2 A PORTA VIROU UM ASSET, e é a mudança estrutural da rodada

`extractDoorKit()` monta a porta lateral com as peças da porta TRASEIRA do
próprio implemento. No semirreboque isso dá **21 famílias**. No sobrechassi dá
**15**: faltam `VARAO`, `ENCAIXE` (e o par de topo), `SUPORTE_GUIA`,
`SUPORTE_TALA` e as duas `BORRACHA_H` — porque **a traseira dele tem 2 varões e
a do semirreboque tem 4**. Metade da ferragem não existe naquele arquivo, e
afrouxar tolerância não resolve: não há o que casar.

A decisão é a do dono, e é a mais simples: **a porta é UMA SÓ**. Ela sai do bake
antigo uma vez (`tools/trailer-bench/kitexport.ts`), vira
`models/vehicles/porta_kit_v1.glb` (2,5 MB) e o engine a carrega como já carrega
a roda do FH16 e o Thermo King — asset opcional, degradação em silêncio para o
kit local se faltar.

O sobrechassi passou a montar **27 peças** de porta, idênticas às do
semirreboque — incluindo o `SUPORTE_GUIA`, que é `suporte-varao-preto`: a peça
de plástico preto que segura o varão, exatamente a que o dono apontou.

⚠️ `porta_kit_v1` segue a regra da roda: **asset publicado sob
`Cache-Control: immutable` não se sobrescreve**. Kit novo é `porta_kit_v2.glb`.

### 26.3 A marca do fabricante saiu; a da Ankaa entrou

O bake traz a marca da **Ibiporã** em duas famílias, e as duas foram medidas:
4 plaquetas de flanco (material exclusivo, saem por nome) e **a chapa de recorte
da traseira** — 700 × 170 × 20 mm com **5 084 triângulos**, as letras vazadas.
Esta última divide material com a gancheira inteira, então nome não serve: a
assinatura é DENSIDADE + chapa larga + linha de centro + traseira, a mesma
doutrina de `removeBoxNameplate()`.

**GOTCHA — densidade sozinha não basta.** Sem o piso de aresta ≥ 350 mm, a
ferragem do fecho traseiro (fina, centrada, na traseira e com 11 492 triângulos
num bloco de 92 mm) entrava junto: 17 malhas em vez de 5.

A chapa da Ankaa (810 × 230 × 54 mm, 1 548 triângulos) viaja no MESMO asset do
kit e `attachBrandPlate()` a põe no sítio de onde a outra saiu, reescalada
UNIFORMEMENTE para a largura dele (700/810 = 0,864).

### 26.4 GOTCHA — o Thermo King pequeno seria esticado de volta ao tamanho do grande

`placeThermoKing()` escala a unidade uniformemente até `dims.w` do manifesto — e
o manifesto é **do asset, não do implemento**. Com o `thermoking_meta.json` da
unidade grande (1,996 m), a pequena (1,654 m, medida) seria esticada 21 % para
cima: a troca de asset não mudaria **nada** na imagem, que é o oposto exato do
pedido. O nome do meta passou a sair do nome do `.glb`
(`X.glb` → `X_meta.json`).

E a unidade pequena **não segue a convenção** do `thermoking.glb` (grelha em +Z,
face de montagem rente em z = 0, altura centrada): a dela nasce em y = 0 e a
profundidade é centrada. Isso não é problema — `placeThermoKing()` posiciona
pela CAIXA MEDIDA, nunca pela origem do nó.

### 26.5 O frame de baixo, a régua do rebite e a fita de canto — a rodada de fecho

Três correções, e as três saíram do MESMO método: fotografar os dois
implementos na **mesma vista relativa** (`shoot-impl.mjs`, vistas `rel-*`,
ancoradas na caixa do baú em coordenadas normalizadas e com a distância dada em
alturas de baú). Comparar por coordenada absoluta compara lugares diferentes —
14,7 m contra 8,4 m de baú.

**1. A banda de baixo do flanco é FRAME, e veio branca.** No semirreboque ela é
`metal-galvanizado-mantido` (y 1,309…1,519 em |x| 1,281…1,307) e SOBRESSAI
3,5 mm da pele, com a fita 3M colada nela. No sobrechassi a mesma banda é
`Cor_padrao_branco(metalBranco)` (0,167…0,307 em |x| 1,271…1,297) e o quadro de
verdade fica atrás dela. `fixLowFrameSkin()` troca só o MATERIAL — 2 malhas — e
a separação chapa/frame volta a existir.

**2. A margem do rebite era a altura do perfil DO SEMIRREBOQUE.** `yMax − 0,20`
é uma constante, e 200 mm é o perfil de arremate dele (3,961…4,171 = 210 mm). O
do sobrechassi tem 103 mm, e a diferença saía como ~97 mm de parede pelada no
alto do flanco. `measureTopRail()` mede a face de baixo do perfil por célula ao
longo do flanco e publica `profile.topRailY`; a coluna de rebites para AÍ.

**3. A fita vertical de canto parava embaixo do quadro.** Medido:

| | topo da fita de cima | base da fita de baixo |
| --- | --- | --- |
| semirreboque | 4,141 = teto − **28 mm** | 1,340 = piso − **52 mm** |
| sobrechassi (antes) | 2,948 = teto − 78 mm | 0,247 = piso + 80 mm |

As duas do semirreboque ATRAVESSAM o perfil de arremate; as do sobrechassi
encostavam por baixo dele. `fixCornerTape()` reancora as quatro pela régua do
semirreboque — translação em Y, nenhum vértice novo. A DOBRA do canto (os 36 mm
em dx que o semirreboque tem) o bake do sobrechassi não tem, e forjá-la seria
inventar peça.

**GOTCHA — a testeira da fita é a DA FITA.** Medir o maior z de toda malha põe a
régua na ponta das mangueiras (4,338 contra 4,194 do baú) e, com 120 mm de
banda, nenhuma fita entra: a primeira versão moveu ZERO peças sem um erro
sequer.

**GOTCHA — `frameMaterial` e `sillMaterial` são DOIS.** No semirreboque o mesmo
`metal-galvanizado-mantido` faz o perfil de cima e o de baixo. No sobrechassi o
de cima é `metal-estrutura-principal-padrao` — mas esse nome cobre o esqueleto
inteiro (montante de canto, marco de porta, arco de teto), e a mediana por
célula de `measureSill()` sobe com os montantes: o batente saiu a **250,5 mm**
do piso contra os 127,5 do semirreboque. O perfil de baixo dele é `metal-preto`,
a 115 mm.

E a carcaça da unidade pequena entrou no conjunto de pintura:
`tools/implement-bake/rename-material.mjs` renomeou `refri_mat_0007_cor_7` para
`tk-housing-white`, que é o que `TK_PAINT_SUB` procura. Só o chunk JSON é
reescrito — a geometria Draco passa intacta.

### 26.6 O que ficou EM ABERTO, com a medida de cada um

- **Fita 3M vertical no inox da fronteira com a frente.** Medido: os dois bakes
  têm a mesma família (tiras de 300 × 50 mm) e **nenhum dos dois tem a
  vertical** — no semirreboque ela também não está assada. Ou seja, ela precisa
  ser GERADA, como os rebites são. Diferença de altura da faixa baixa medida:
  nosso `piso −52…−2 mm`, novo `piso +30…+80 mm`.
- **Rebite ASSADO no próprio perfil de arremate.** A coluna de rebites da chapa
  já sobe até o perfil (§26.5). O que nenhum dos dois GERA é o rebite de fixação
  do próprio perfil — no semirreboque ele é assado, no sobrechassi também, e as
  duas malharias não coincidem. Portá-lo seria gerar, e a régua ainda não foi
  medida.
- **A DOBRA da fita de canto.** O semirreboque tem a fita dobrada sobre a quina
  (36 mm em X e 36 em Z); o sobrechassi tem a mesma fita chata na face. A
  posição já está certa (§26.5); a dobra é geometria que o bake não tem.

## 27. 2026-08-19 — o sobrechassi pela régua do semirreboque, peça a peça

O dono voltou com oito prints e uma frase que organiza todos: *"você estava
atualizando o sobrechassi para ter as mesmas correções que o semirreboque tem"*.
Esta rodada é isso — e o método mudou, porque o que sobrou depois da §26 não se
acha lendo código.

### 27.1 O instrumento: censo de malha nos DOIS implementos, no app de verdade

`tools/studio-bench/checks-sobrechassi-0819.mjs` despeja, malha a malha, **nome
do nó + material + triângulos + caixa no referencial da raiz**, para o
semirreboque e para o sobrechassi, dentro do estúdio montado. São 2 274 e 1 094
linhas. Comparadas por COTA — não por nome —, elas resolveram seis dos oito
pontos sozinhas, porque as peças dos dois bakes são as mesmas em milímetros:

| peça | cota (mm) | semirreboque | sobrechassi |
| --- | --- | --- | --- |
| colar do varão | 38 × 44 × 41 | `suporte-varao-preto` | `metal-pouco-polido` |
| capa do engate fêmea | 17 × 79 × 57 | `engate-femea-preto` | `metal-pouco-polido` |
| cano do registro | 49 × 309 × 49 | `cano-ar-preto` | `metal-pouco-polido` |
| manípulo da porta | 247 × 124 × 42 (+2) | `inox-ferragem` | `metal-claro` |
| registro traseiro | 70 × 120 × 104 | `registro-corpo-laranja` | `plastico-preto-polido` |
| trilho de piso | 26 × 210/140 × corrido | `metal-galvanizado-mantido` | branco |

Ou seja: **o export do sobrechassi fundiu meia dúzia de materiais em
`metal-pouco-polido`**, e é essa fusão — não uma diferença de produto — que o
dono vinha apontando print a print desde 2026-08-18. `materialize.mjs`
reconstruiu 17 materiais a partir do nome da malha (§24); estes seis não tinham
como sair de lá, porque o nome já vinha fundido na origem.

### 27.2 A correção mora no ASSET: `tools/implement-bake/graft-materials.mjs`

O engine despacha acabamento por NOME DE MATERIAL. Devolver o nome certo faz o
sobrechassi herdar inox, galvanizado, borracha e tinta **sem uma linha de código
nova** — é a razão de `materialize.mjs` existir, aplicada até o fim.

A ferramenta copia o material REAL do doador (`semirreboque_…_paleteiro.glb`),
com textura e tudo, e reatribui as primitivas do alvo por **assinatura de
tamanho**. Três decisões que valem registro:

- **A cota é a do ESPAÇO DA RAIZ, não a do acessor.** O rip está em centímetros
  e o nó `stitch_result_stitch_all` gira 180° em torno de `(1,0,1)/√2`, o que
  **troca X e Z**. A primeira execução casou zero peças.
- **A comparação é com as cotas ORDENADAS.** As instâncias não compartilham
  orientação: o mesmo colar sai 41 × 44 × 38 numa e 38 × 44 × 41 noutra.
- **O portão é a contagem de INSTÂNCIAS**, e ele recusa a gravação inteira
  quando não bate. O colar dá 8 e não 4: quatro são da porta lateral de fábrica,
  que `removeBakedSideDoor()` tira antes de qualquer medida.

Só o chunk JSON é reescrito, mais um `append` no fim do BIN para a textura do
galvanizado — nenhum `bufferView` muda de offset e a geometria Draco passa
intacta, a mesma garantia de `rename-material.mjs`.

⚠️ **A ferramenta não é idempotente por construção**: rodá-la de novo sobre o
arquivo já corrigido acha ZERO primitivas com o material de origem e reprova.
É o comportamento certo — o backup `…bak-graft-2026-08-19` é o ponto de partida
para uma segunda passada.

### 27.3 GOTCHA — `metal-claro` é a folha da CAIXA DE COZINHA no outro bake

O manípulo da porta traseira do sobrechassi vinha como `metal-claro`, e
`BOX_SHELL_RE` (models.ts) pinta esse nome com `#3b3b3d` fosco: é a folha da
caixa de ferramentas do semirreboque. Ou seja a ferragem de inox saía com a
tinta de uma caixa de ferramentas — o *"a textura desse batente está errada"* do
relato, e um defeito que nenhuma leitura de `trailer-bake-fixes.ts` acharia,
porque o erro está a duas famílias de distância.

### 27.4 O TRILHO DE PISO: os 70 mm que faltavam, e os 5 mm que os tornam visíveis

Medido, e a coincidência é a prova de que é a mesma peça:

| | pé (do piso) | topo (do piso) | face |
| --- | --- | --- | --- |
| semirreboque | −82,5 mm | **+127,5 mm** | 0,5 mm à frente da pele |
| sobrechassi | −82,5 mm | **+57,5 mm** | 4,4 mm ATRÁS da pele |

`fixLowFrameRail()` sobe os vértices da metade superior da seção até fechar os
210 mm — o perfil de 140 mm vira um de 210 com a dobra de cima intacta, que é
como um perfil mais alto é feito de verdade; escalar a seção em 1,5× engordaria
as dobras, que têm raio de fábrica e não de proporção.

**E o degrau em X não é cosmético: sem ele a correção seria invisível.** A pele
começa no piso; um perfil que sobe 70 mm mas mora 4,4 mm ATRÁS dela some atrás
da chapa. A translação é POR FLANCO (§26.1: pele direita 1,3105, esquerda
1,3024) e a **fita 3M horizontal anda junto**, com o mesmo deslocamento — ela
está hoje 0,9 mm para dentro da face do perfil, e é assim que ela aparece.

A altura sai do PÉ MEDIDO do próprio perfil, não de `floorY`: os dois pés já
coincidem, e ancorar ali tira da conta uma medida (`profile.floorY`) que muda
com qualquer coisa que mexa na decomposição de cascas.

### 27.5 O THERMO KING estava montado de costas

`thermoking.glb` sai com a face de montagem em z = 0 e a grelha em +Z.
`thermoking_p360.glb` está **exatamente ao contrário**, e a medida prova: a
chapa de fundo da carcaça tem **0,881 m² de face virada para +Z** concentrados
em z = 0,201, enquanto z = −0,456 é a grelha.

`placeThermoKing()` encostava `bbox.min.z` na testeira, ou seja **a grelha**, e
jogava os 912 mm de profundidade inteiros para a frente. O que o dono viu como
"peças flutuando" à frente da carcaça era o EVAPORADOR, que deveria estar dentro
do baú.

Duas coisas entram no `*_meta.json`, porque as duas são propriedade do ASSET:

```json
"mount": { "yawDeg": 180, "z": 0.201 }
```

`yawDeg` gira a unidade para a convenção do arquivo antigo. `z` é a cota do
**plano que encosta na parede** — e ela não coincide com o extremo da caixa
justamente porque há 255 mm de evaporador atravessando a testeira. Sobram 657 mm
para fora, que é a profundidade real de um T-800R. Sem o bloco, o comportamento
é o de sempre (`bbox.min.z` na parede), que é o que a unidade grande precisa.

### 27.6 GOTCHA — a montagem lia a caixa do implemento ANTERIOR

`placeTrailer()` resolvia a montagem com `state.trailerBox`, que é a caixa em
espaço de MUNDO congelada na pose de carga. A pose que `solveRigidMount()`
devolve é ABSOLUTA (`applyRootPose()` faz `position.set()`, não soma), então as
duas só fecham enquanto a caixa tiver sido medida com a raiz na origem **e
pertencer ao implemento que está em cena**.

Uma caixa do implemento anterior planta a carroceria a `frenteAntiga −
frenteNova` da cabine — **3,2 m** no par semirreboque→sobrechassi (7,233 contra
4,307), que é exatamente o que a primeira foto do dono mostra: o quadro do VM
nu, com a carroceria metros atrás. E não há erro nenhum no console: o relatório
de montagem imprime folga de 150 mm, porque o erro mora ENTRE a medida e a
escrita, não em nenhuma das duas.

A caixa passou a ser medida **no referencial da própria carroceria**
(`bboxInFrame(t, t, bodyPanelPred(t))`), como `placeThermoKing()` já fazia: o
resultado deixa de depender de onde o implemento está e de quando a caixa foi
tirada. O datum vai junto (`trailerMountDatum − trailerBase.pos.y`), e
`solveRigidMount()` passou a receber `centerX` — devolver `x = 0` jogava fora o
centramento de `groundAndCenter()`, 4 mm num baú que não é simétrico.

### 27.7 O rebite: a hipótese óbvia estava errada, e a medida disse qual era

*"o rebite não está na posição correta"*. A hipótese natural — cabeça em cima da
crista em vez do rebaixo — foi MEDIDA e reprovada
(`tools/studio-bench/checks-friso-0819.mjs`): o centro das faixas lisas do
painel sai em 1,741 · 1,7945 · 1,848 · 1,9015 · 1,955 e os rebites em 1,741 ·
1,794 · 1,847 · 1,901 · 1,954. **Casa em 0,5 mm.**

O que sobrou foi o deslocamento em Z: a dobra da emenda fica em `k + 0,175` e a
coluna em `k + 0,187` — os 12 mm de "sobre a borda que cavalga"
(`checks-emenda-0819.mjs`; e o painel NÃO está espelhado, a linha z da matriz
painel→implemento é `[0,0,1,0]`). A 12 mm a coluna deixa de ler como o rebite
DAQUELA emenda: a dobra desenha uma linha e a coluna desenha outra, paralela.
`RIVET_FROM_SEAM` passou a ser **zero**; a calota tem 18 mm de base e o degrau
2,2 mm, então centrada na dobra ela apoia metade em cada chapa, que é o que uma
cabeça de emenda faz.

### 27.8 O que ficou EM ABERTO

- **Os "caninhos" da saia do SEMIRREBOQUE.** O print mostra três barras
  verticais claras (~130 mm de altura, y 1,12…1,25) sobre a faixa preta do
  chassi, e o dono pediu para removê-las. A varredura de raios daquela faixa
  (`checks-friso-0819.mjs`, janela `saia-media`) devolve `metal-preto` de ponta
  a ponta e nenhuma peça fina e clara: as barras são quase certamente uma FACE
  do próprio esqueleto preto pegando o céu (o material é `metalness 1`), e não
  uma peça a mais. Remover "a peça" exigiria saber qual, e a medida ainda não
  diz. **É a única das oito que continua sem identificação, e ela é do
  SEMIRREBOQUE — não entra no "trazer o sobrechassi para a régua".**
- A dobra da fita de canto (§26.6) continua sem geometria no bake do
  sobrechassi.
- O rebite ASSADO do próprio perfil de arremate (§26.6).


## 28. 2026-08-19 (segunda volta) — o que a primeira rodada mostrou errado

O dono aplicou a §27 e voltou com oito prints. Metade é confirmação de que a
correção pegou (o Thermo King virou, a carroceria encostou na cabine, a
mangueira ficou uma só); a outra metade é o que a §27 mostrou **errado**, e três
delas só apareceram porque a anterior consertou o que as escondia.

### 28.1 O REBITE: a hipótese medida estava certa e a conclusão estava errada

A §27.7 mediu que a fileira de rebites cai no centro da faixa a 5,3 mm sob a
crista, e concluiu que a altura estava certa. Estava — para aquela definição de
"faixa lisa". O dono é explícito: *"os rebites estão na parte elevada dos frisos
em vez de centralizada na parte lisa"*.

O perfil cru, faixa de 0,5 mm por faixa de 0,5 mm ao longo de dois passos
(`tools/studio-bench/checks-perfil-0819.mjs`), resolve a ambiguidade:

```
fase  0…8 mm     5,3 mm sob a crista      ┐
fase  9…31 mm    0…2 mm  (arco, pico em 19,9)   ← 22 mm de CRISTA CHATA
fase 31…62 mm    5,3 mm sob a crista      ┘     ← 31 mm de PLANO RECUADO
```

Ou seja: o perfil tem **31 mm de plano recuado e 22 mm de crista chata**, e é a
CRISTA que aparece na imagem como a faixa larga e uniforme entre dois vincos —
o plano recuado é que lê como o "friso". `RIB_FLAT_CENTER = 46,7 mm` aponta para
o meio do plano recuado; o rebite tem de ir no meio da crista, meio passo acima.

Medido na foto do dono para fechar (coluna de rebite contra a parede vizinha,
passo de 26,8 px = 53,4 mm): a calota está **26,9 mm** — meio passo exato —
acima do centro da faixa uniforme.

`measureValeRows()` passou a usar `RIB_FLAT_CENTER − pitch/2`, e a cabeça a
assentar em `crest` em vez de `crest − 5,3 mm`; o escalar da calota caiu de 0,58
para 0,29 (5,2 → 2,6 mm de protuberância), porque apoiada na crista ela não
precisa mais atravessar o rebaixo inteiro. **`RIB_FLAT_CENTER` não muda**: ela é
a régua da ferragem da porta traseira, aprovada em foto em 2026-08-12, e o que
se corrigiu é qual das duas faixas leva o rebite.

⚠️ E `RIVET_FROM_SEAM` VOLTOU A 12 mm. A §27 o tinha zerado lendo a queixa como
"deslocado da emenda"; a frase inteira era *"…e não estão na parte remontada das
chapas"*. Eram dois defeitos e o deslocamento não era um deles — um rebite de
emenda atravessa a aba, e a aba fica à frente da dobra.

### 28.2 A ferragem de duas cores que o `stitch_all` fundiu

Pintar a fêmea do engate de preto (§27.2) deixou a peça INTEIRA preta, e o dono
recusou: *"ela tem uma parte preta, mas tem uma parte metálica também"*. No
semirreboque cada engate são DUAS malhas — corpo em `metal-pouco-polido` e capa
em `engate-femea-preto` / `engate-macho-preto`. No sobrechassi o `stitch_all` da
origem juntou cada par numa primitiva só, com a cota da UNIÃO das duas caixas.

Nenhum enxerto de material resolve isso: ele pinta primitivas inteiras, e aqui
meia primitiva é preta. O que separa é a TOPOLOGIA — as duas eram objetos
distintos, então continuam sendo cascas conexas distintas dentro do mesmo
buffer. `splitFusedBlackCap()` acha as componentes, compara a caixa de cada uma
com a cota MEDIDA no semirreboque (17 × 79 × 57 e 54 × 65 × 12 para as capas),
reordena o índice em dois grupos contíguos e devolve `material` em array.
Nenhum vértice se move; reordenar índice não é deformar.

### 28.3 O THERMO KING tem um VÃO, e é nele que ele se centra

A §27.5 virou a unidade e a encostou pelo plano de montagem — certo — mas
continuou pendurando-a pelo TOPO, na travessa de arremate. O sobrechassi tem um
RECORTE de fábrica na testeira e a unidade nascia 220 mm abaixo dele, com a
abertura aparecendo inteira por cima.

O vão é medido (`measureTkRecess()`): duas travessas horizontais de
`metal-estrutura-principal-padrao` com 1,25 m de largura e 28 mm de altura, em
y 2,462…2,490 e 2,858…2,886, e o vão é o que fica entre elas — **1,25 × 0,37 m,
centro em (0,005 · 2,674)**. O que se centra nele é a CARCAÇA
(`tk-housing-white`), não a caixa inteira: a caixa inclui o evaporador, que
atravessa a parede e vive dentro do baú.

O semirreboque não tem recorte — a unidade dele é aparafusada na chapa —, então
`measureTkRecess()` devolve `null` lá e a regra da travessa continua valendo.

### 28.4 GOTCHA — `cabRearZ` é o menor z da MALHA, e a carroceria não encosta nele

*"precisa encontrar o ponto e angulação correta pra cada um dos 3 modelos de
chassi pra não ficar esse vão em nenhum deles"*. O vão é de ~350 mm e a causa é
o manifesto: `mounts.json` traz `cabRearZ` como o menor z do modelo, que no
Volvo VM é a **chaminé e o suporte do para-lama**, 200 mm atrás da parede. Some
os 150 mm de folga e o resultado é o que a foto mostra.

`measureCabRearWall()` mede a parede por ÁREA — histograma de área de triângulo
virada para −Z, por banda de 20 mm em z, restrito ao que está 300 mm acima da
mesa da longarina (abaixo é chassi, tanque e escapamento). A resposta é a banda
de maior área; sem 0,6 m² em nenhuma banda ela devolve `null` e o manifesto
volta a valer. É a mesma técnica que achou o plano de montagem do Thermo King
pequeno, e ela cobre os três chassis sem uma linha por modelo.

### 28.5 A fita vertical de canto: agora em Z também

A §26.5 reancorou as quatro fitas em Y. O dono pediu a outra metade: *"deveria
ficar no centro do frame metálico entre a lateral e a frente"*. O montante de
canto mede 73 × 2 850 × 70 mm em |x| 1,267, z ±4,21; a fita de flanco estava em
z 4,145…4,195 — encostada na borda dele. `fixCornerTape()` passou a centrá-la no
montante mais próximo, e só quando ele está a menos de 300 mm: uma fita que não
seja de canto não pode ser puxada meio metro para achar um.

### 28.6 Em aberto, desta volta — **e a lista vale mais que o capítulo**

⚠️ **A PASSAGEM COMPLETA ESTÁ EM
`tools/trailer-bench/HANDOFF-SOBRECHASSI-2026-08-19.md`** — os 16 pedidos, o que
foi feito, o que continua quebrado com diagnóstico e próximo passo de cada um,
as medidas já feitas para não remedir, e a ordem sugerida. Este capítulo é o
registro; aquele arquivo é o plano.

O dono conferiu no fim da sessão e listou cinco que continuam:

1. **rebite** — melhor, mas ainda não 100% centrado na parte lisa;
2. **engate (fêmea e macho)** — saem TODOS pretos; o centro é metálico e o
   semirreboque tem isso;
3. **frame metálico inferior** — a parte branca sobrepõe em partes
   (**diagnóstico fechado: `RAIL_PROUD` de 0,5 mm é menor que o remonte de
   `PLATE_T` = 2,2 mm que `applyPlateLap()` aplica DEPOIS; a §26.5 mediu 3,5 mm
   no semirreboque**);
4. **fitas refletivas verticais** — ainda mal posicionadas;
5. **os "caninhos"** — continuam, e agora com a contagem: **2 numa lateral, 3 na
   outra e 2 na frente** (a família `lanterna-lateral-chassis`, `metal-preto`
   17 × 45 × 110 mm, tem exatamente essa distribuição — falta confirmar).

E a régua, dita por ele: *"tudo está correto no semirreboque, então você tem uma
referência"*.

### 28.7 O resto do que ficou em aberto

- **"o frame metálico inferior não está correto ainda"**. Medido depois da
  §27.4, o trilho do sobrechassi tem os mesmos 210 mm do semirreboque, com o pé
  em piso −82,5 mm e a face 0,5 mm à frente da pele. Falta saber o que ainda
  diverge: as duas fotos comparativas estão em
  `tools/trailer-bench/shots-implemento/rel-base-meio.png` (rode a bancada com
  cada `.glb`), e a diferença que sobra é de SEÇÃO — o perfil do semirreboque
  tem um degrau a meia altura que o do sobrechassi não tem.
- **Os "caninhos"** (§27.8) continuam sem identificação.
- **A "angulação"** do pedido de 28.4: a carroceria continua sem inclinação. Um
  sobrechassi é aparafusado no quadro e não gira; se o pedido for outro, ele
  precisa de uma medida antes de virar código.

## 29. 2026-08-20 — as cinco que sobraram, e o par de erros que se cancelava

A §28 fechou com cinco pendências e uma régua: *"tudo está correto no
semirreboque, então você tem uma referência"*. Esta rodada mediu as duas peças
com o MESMO instrumento e fechou as cinco. Três delas tinham a mesma causa —
uma medida tomada num referencial e aplicada em outro — e é isso que vale o
capítulo.

### 29.1 O instrumento: uma sonda que roda os DOIS implementos em segundos

`tools/trailer-bench/medir-0820.mjs` sobe só o implemento num Chromium, aplica
as correções de bake **na ordem do app** e despeja JSON: componentes conexas da
ferragem, o perfil do friso dobrado pelo passo, o inventário do que mora na
linha do piso, o trilho contra a pele por flanco, e toda fita vertical com o
delta para o montante dela. Roda em ~20 s por implemento, contra os ~7 min da
bancada com `--geometry`, e não deixa Chromium órfão.

Ela tem dois modos que a `implprobe` não tem e que resolveram duas das cinco:

- **`?foto=1`** fotografa nos enquadramentos DAS FOTOS DO DONO, com uma família
  pintada de magenta — é a prova visual antes de remover peça;
- **varredura de raios da faixa preta**, que é o que finalmente identificou os
  "caninhos": uma grade de raios pela mesma câmera da elevação diz, pixel a
  pixel, qual malha está ali.

⚠️ E ela chama `markShared()` antes do rig, como `buildTrailerRig()` faz. Sem
isso uma correção de vértice sobre geometria compartilhada roda DUAS vezes (os
dois trilhos de piso são o mesmo molde) e o perfil sai com 280 mm em vez de 210
— o defeito conhecido do `shoot-impl.mjs`.

### 29.2 A CAUSA COMUM: `TrailerBody` mede em MUNDO, o resto mede na RAIZ

`collect()` aplica `matrixWorld` a cada vértice, então `floorY`, `roofY`, `z0`,
`z1` e `valeInfo.row0` são cotas de MUNDO. `trailer-bake-fixes.ts` e a sopa de
`buildLiveryPanels()` medem no espaço da RAIZ (`toLocal · matrixWorld`). Entre
os dois há a translação que `groundAndCenter()` escreve em `root.position`, e
ela é **por implemento**: medida no app via `state.trailerBase.pos`, vale
**+20 mm no semirreboque e −1 mm no sobrechassi**.

Vinte milímetros não derrubam nada sozinhos — e é por isso que isto sobreviveu
tanto tempo. O que eles fizeram foi **calibrar uma constante errada**: ver 29.3.

### 29.3 O REBITE: a constante estava errada e o referencial também

`RIB_FLAT_CENTER = 46,7 mm` descreve, segundo o comentário dela, o centro da
faixa lisa medido a partir de `row0`. Medido de novo, dobrando a pele pelo
passo (a pele é uma extrusão: os vértices dela existem só nas QUEBRAS do
perfil, então a dobra não é uma amostragem — é a seção):

```
              crista        platô recuado    relevo
semirreboque  fase 40,0     fase 13,3        5,3 mm
sobrechassi   fase 40,0     fase 13,5        5,3 mm
```

O centro do platô é **13,3**, não 46,7. A constante estava 33,4 mm fora — e
ainda assim o semirreboque saía certo, porque os 46,7 eram escritos numa cota
de MUNDO e lidos numa sopa de RAIZ: 46,7 + 20 = 66,7 ≡ **13,3**. Dois erros
que se cancelavam num implemento e não no outro, onde a mesma conta dá
46,7 − 1 = **45,7**, que é a CRISTA.

Daí as três frases do dono encaixarem exatamente:

| estado | semirreboque | sobrechassi | o que ele disse |
| --- | --- | --- | --- |
| antes da §28 | 13,3 (platô) | 45,7 (crista) | *"na parte elevada em vez de centralizada na parte lisa"* |
| depois da §28 | 40,0 (crista) | 19,2 (platô, 5,7 mm alto) | *"melhores mas ainda não 100 % centralizados"* |
| agora | **13,2** | **13,8** | — |

`measureValeRows()` não tem mais constante nem `row0`: `measureRibProfile()`
dobra a sopa pelo passo, acha a CRISTA (que é um argmax, estatística forte) e
põe a fileira meio passo acima dela, no platô. A profundidade da calota é a do
platô, medida. Os dois implementos passam a cair no mesmo lugar do mesmo
perfil, e o semirreboque volta a exatamente onde estava quando foi aprovado.

⚠️ **`RIB_FLAT_CENTER` continua existindo e continua 46,7**, porque
`raiseDoorCatches()` ainda a usa e ela foi CALIBRADA EM FOTO no semirreboque
COM os 20 mm dentro. Tirar um dos dois erros sem o outro moveria uma peça
aprovada. O preço, anotado: no sobrechassi a ferragem da porta traseira assenta
na crista (fase 45,7) enquanto o rebite assenta no platô — e o comentário
daquela função promete que os dois ficam no mesmo plano. É a próxima da fila, e
ela precisa de `flatPhase` publicado por `TrailerBody`, não de uma constante.

⚠️ E o escalar da calota voltou a **0,58** (5,2 mm). Ele e `r.d` andam juntos:
com a cabeça no platô, os 0,29 da §28 a deixariam 2,7 mm ATRÁS da linha do
friso.

### 29.4 O ENGATE: não havia topologia para separar

A §28.2 apostou que as duas peças fundidas continuariam sendo cascas conexas
distintas. `componentesConexas()` devolve **1** nas seis malhas: o `stitch_all`
soldou os vértices. E havia um segundo defeito calado — `caixaDeTris()` media a
componente no espaço LOCAL da geometria (o rip está em centímetros e o nó gira
180° trocando X e Z) contra uma régua em metros no espaço da raiz, e o erro
saía como 7 821 mm.

O que separa é a REGIÃO, e ela sai de uma subtração: o eixo em que a UNIÃO é
mais larga que o METAL é o eixo do corte, a ±metal/2 do centro. Fêmea: ±19 mm
no eixo de 57 (o metal tem 38). Macho: ±19,5 no de 54 (o metal tem 39). Nenhum
número escolhido — os dois saem da malha metálica DO SEMIRREBOQUE. O eixo é
descoberto por assinatura ordenada, e não fixado: as instâncias não
compartilham orientação.

Provado: o grupo da capa do macho sai com **54 × 65 × 12 mm**, que é a caixa da
capa do doador ao milímetro. E a foto lado a lado dos dois implementos, no
mesmo enquadramento relativo, mostra a mesma peça.

⚠️ `vehicle/merge.ts` PULA malha com `material` em array (`MOTIVOS.arrayDeMaterial`),
então a divisão sobrevive à fusão, ao acabamento e à tinta — medido no app:
`array true · grupos 2`. Era a terceira hipótese do handoff, e ela está morta.

### 29.5 Os "CANINHOS": sete tubos de 20 × 20 mm, e a varredura de raios que os achou

A contagem do dono — *"2 em uma lateral, 3 em outra e 2 na frente"* — fecha
exata com uma família que NÃO é a que a §28 suspeitava. Não são as lanternas de
chassi (aquelas são oito e simétricas, e são peça legítima): são sete tubos
quadrados de `metal-pouco-polido`, **20 × 2 946,5 × 20 mm**, embutidos na
parede (|x| ≈ 1,25 contra 1,31 da pele) e visíveis só abaixo do perfil de piso.

Eles aparecem como BARRAS CLARAS na faixa preta porque são polidos e pegam o
céu — e foi assim que a varredura de raios os encontrou, com ZERO ocorrências
no semirreboque.

`removeStrayConduits()` os tira por FORMA, com dois portões RELATIVOS ao baú
que existem por causa do VARÃO DA PORTA (esbelto e quadrado igual): altura de
90 % da parede e |x| acima de 60 % da meia-largura. Medido: tubo 2 946,5 mm e
|x| 1,13…1,27; varão 2 480 mm e |x| 0,11…0,13. A escada da testeira
(17,9 × 2 645 × 30,9) escapa pelo teste de "quadrado em planta".

### 29.6 O TRILHO DE PISO: `RAIL_PROUD` tinha de ser maior que `PLATE_T`

`RAIL_PROUD` valia 0,5 mm, e 0,5 era o número certo pela medida errada: comparava
o perfil com a crista CRUA do friso. A chapa que aparece na cena é a de livery,
e `applyPlateLap()` a empurra para fora em até `PLATE_T` = 2,2 mm — depois desta
correção já ter rodado. Resultado: a chapa 1,7 mm à frente do perfil onde o
envelope do remonte está cheio, que é "sobrepondo ele EM PARTES".

Medido com o mesmo instrumento nos dois:

```
semirreboque  trilho |x| 1,3066 · crista 1,3037  →  +2,9 mm
sobrechassi   trilho |x| 1,3078 · crista 1,3101  →  −2,2 mm
```

`RAIL_PROUD = 0,0029` reproduz o padrão ouro, que cobre o remonte com 0,7 mm de
folga. **A relação com `PLATE_T` é o contrato, não o valor.**

### 29.7 AS FITAS VERTICAIS: eram DUAS réguas e DOIS cantos, não um de cada

Duas coisas erradas ao mesmo tempo:

1. `fixCornerTape()` filtrava por `f.b.max.z >= frontZ − 120 mm`, e isso é meio
   baú: as OITO fitas do canto TRASEIRO nunca foram tocadas.
2. A régua era UMA, e são duas — a fita da face de flanco e a da face
   dianteira/traseira têm âncoras diferentes no semirreboque:

```
de FLANCO   base 51,9 mm sob o piso · topo 28,0 mm sob o teto
de FACE     base 70,0 mm sob o piso · topo 16,9 mm sob o teto
```

E no padrão ouro TODA fita vertical é centrada no montante do canto dela, cada
uma no seu eixo: a de flanco em Z (erro medido de 0,15 mm), a de face em X
(3,0 mm). A versão anterior centrava só a de flanco.

Depois da correção as doze do sobrechassi batem com as doze do semirreboque nas
quatro âncoras, com erro de décimos de milímetro.

### 29.8 O que ficou provado, e como reproduzir

```bash
node tools/trailer-bench/medir-0820.mjs                    # os dois, ~40 s
node tools/studio-bench/bench.mjs --gpu --geometry \
     --checks checks-referencial-0820.mjs                  # no app, uma troca de chassi
```

| medida | semirreboque | sobrechassi |
| --- | --- | --- |
| fase do rebite (platô) | 13,2 mm | 13,8 mm |
| fase da crista | 40,0 mm | 40,0 mm |
| trilho de piso | +2,9 mm da pele · 210 mm | +2,9 mm · 210 mm |
| fita de flanco | piso −51,9 / teto −28,0 | idem |
| fita de face | piso −70,0 / teto −16,9 | idem |
| engate dividido | (já vinha) | `array true · grupos 2` |
| tubos embutidos | 0 | 7 removidos |

### 29.9 Em aberto

- **`raiseDoorCatches()`** — ver o ⚠️ da 29.3.
- **A SEÇÃO do trilho** (§28.7): o perfil do semirreboque tem um degrau a meia
  altura que o do sobrechassi não tem. É geometria que o bake não traz.
- **A "angulação"** (§28.7): continua precisando de uma medida antes de virar
  código.
- **A escada da testeira** do sobrechassi está em `metal-pouco-polido`; a do
  semirreboque, em `inox-ferragem`. Uma linha a mais em `graft-materials.mjs`.

## 30. 2026-08-20 (tarde) — duas chapinhas de 300 mm moviam a régua do implemento

O dono voltou com quatro fotos e três queixas: o registro, a mangueira, e *"o
frame metálico da parte de baixo na lateral e na parte frontal … tanto a faixa
quanto o frame metálico estão errados"*. As duas últimas eram **a mesma coisa**,
e a causa é a menor deste front inteiro.

### 30.1 A CAUSA: `floorY` é o menor y do BRANCO, e duas peças brancas sobravam

Medido, malha branca por malha branca, nos dois implementos:

```
semirreboque   a chapa do flanco começa em floorY               (nada abaixo)
sobrechassi    a chapa do flanco começa em floorY + 82,5 mm
               e a ÚNICA coisa branca abaixo dela são DUAS
               chapinhas de 300 × 140 × 26 mm em z 4,244, |x| 1,09
```

São os **retornos do quadro de baixo nos cantos dianteiros** — a mesma seção de
26 × 140 mm da banda do flanco, com 300 mm de comprimento em vez de 8 380.
`graft-materials.mjs` casa por COTA, e a linha do quadro pede `26 × 140 ×
8,380`: os dois retornos ficaram brancos.

E `body.min.y` é o mínimo sobre TODA malha branca. Duas peças de 300 mm
puxavam o `floorY` — a régua de todo o engine — **82,5 mm para baixo**. Com ela
baixa, tudo o que se mede "do piso" no sobrechassi lia 82,5 mm a mais:

| medida (do piso) | semirreboque | sobrechassi ANTES | depois |
| --- | --- | --- | --- |
| trilho de piso | −82,5…+127,5 | **0…+210** | −82,5…+127,5 |
| fileira de fita 3M do flanco | −51,9…−1,9 | **+30,6…+80,6** | −51,9…−1,9 |
| fileira de fita 3M da face | −70…−20 | **+19,4…+69,4** | −63,1…−13,1 |
| travessas do piso (topo) | +31,7 | **+114,5** | +32,0 |
| altura do corpo branco | 2 740 mm | **2 822,5 mm** | 2 740 mm |

A última linha é a prova: com os dois retornos fora da família branca, os dois
baús passam a ter **exatamente 2 740 mm** de corpo. São o mesmo produto.

E a fita vertical de canto, ancorada em `floorY − 51,9`, caía 82,5 mm ABAIXO do
quadro — pendurada sobre o chassi do caminhão. É a foto de 10:34, e é a mesma
causa que o "frame metálico errado".

**O conserto é uma linha de enxerto** (`--only quadro-da-testeira`), e ela
também devolve à testeira o retorno galvanizado que a foto do dono cobra.
`graft-materials.mjs` ganhou `id` por linha para que `--only` alcance UMA delas
— duas linhas podem enxertar o mesmo material em peças diferentes, e sem o `id`
a segunda passada reprovava a primeira.

⚠️ E `fixLowFrameRail()` passou a subir também os RETORNOS: sem isso o quadro
ficaria com um degrau de 70 mm na esquina (210 mm no flanco, 140 na testeira).

### 30.2 A FITA VERTICAL: a âncora é a FILEIRA, não o piso

Mesmo com o `floorY` certo, ancorar a fita vertical numa constante contada do
piso é frágil — é a régua que acabou de se mostrar diferente entre bakes. A
âncora certa estava medida o tempo todo:

```
semirreboque  flanco  fileira −51,9…−1,9  ·  fita vertical base −51,9
              face    fileira −70,0…−20,0 ·  fita vertical base −70,0
```

A base da fita vertical **é a mesma linha** da base da fileira horizontal, nas
duas faces — o que faz sentido, é a mesma fita dobrando a esquina.
`fixCornerTape()` passou a medir a fileira e ancorar nela; as constantes de
piso viraram rede, e só entram quando não há fileira.

### 30.3 O REGISTRO: aqui a topologia SOBROU

*"o registro apenas deve ser laranja, não tudo, tem uma parte marrom"*. No
doador o registro são DUAS malhas — `registro-tubo-marrom` (o tubo) e
`registro-corpo-laranja` (o corpo com o manípulo). No sobrechassi o `stitch_all`
as fundiu, e o enxerto só podia pintar a primitiva inteira de laranja.

Ao contrário do engate (§29.4), **as componentes conexas sobreviveram** — e
batem com as do doador ao micrômetro:

```
doador   tubo   1 376 tris · caixa local 7053,1 × 7002,2 × 11917,4
         corpo    372 tris ·             2692,2 × 1673,1 × 10066,8
alvo     3 componentes: 1 400 → 7053,0 × 7002,4 × 11917,4   (o tubo)
                          372 → 2691,9 × 1672,8 × 10066,8
                          256 → 4679,1 × 4365,2 ×  3999,7
```

`fixRegistroAndHose()` separa por componente, e o tubo é o MAIOR — pelo número
de triângulos E pela caixa. Exigir os dois critérios é o que torna a regra
auto-verificável e livre de unidade; se discordarem, a peça não é a que se
pensava e a função sai sem pintar.

⚠️ Ela **não faz nada num bake que já traga `registro-tubo-marrom`**. Sem essa
porta o semirreboque também seria dividido — o corpo laranja dele também tem
três componentes — e a maior levaria marrom numa peça que já está certa.

### 30.4 A MANGUEIRA era `metal-pouco-polido`

`metalness: 1`, `roughness: 1` — e é por isso que ela descia reluzindo como um
tubo cromado. No doador o cano da mesma montagem
(`cano-Mangueida+registro-Traseira-E`) é `cano-ar-preto`, que o sobrechassi já
tem. Uma reatribuição, na mesma função do registro porque é a mesma montagem.

### 30.5 O que ficou provado

```bash
node tools/implement-bake/graft-materials.mjs --dry --only quadro-da-testeira
node tools/trailer-bench/medir-0820.mjs
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-referencial-0820.mjs
```

| medida | semirreboque | sobrechassi |
| --- | --- | --- |
| corpo branco | 2 740 mm | **2 740 mm** |
| trilho de piso | −82,5…+127,5 · +2,9 mm da pele | **idem** |
| fileira 3M do flanco | −51,9…−1,9 | **idem** |
| base da fita vertical | −51,9 / −70,0 | −51,9 / −63,1 |
| topo da fita vertical | 2 448,9 / 2 460,0 | **idem** |
| fase do rebite | 13,2 mm | 13,8 mm |
| registro | tubo marrom + corpo laranja | **idem** |
| mangueira | `cano-ar-preto` | **idem** |

### 30.6 Em aberto

- **`raiseDoorCatches()` RECUSA no sobrechassi** (*"de fábrica em 206 mm, fora
  da 1ª faixa lisa (113 mm)"*) — e recusar é o caminho seguro, ela não move
  nada. Com a fase corrigida (13,3 em vez de 46,7) a peça de fábrica cairia a
  19,5 mm da faixa e a correção passaria a rodar. É a §29.9, agora com número.
- **`stretchFrontHeader()`: "frame da testeira: não encontrado"** — de antes
  desta rodada, e sem queixa associada.

## 31. 2026-08-20 (fim de tarde) — o branco que vazava, a fita no poste errado, e a ferragem que não estava em friso nenhum

Quatro apontamentos do dono em duas levas, e três deles tinham a mesma forma:
uma régua fixa onde a peça pede uma régua MEDIDA.

### 31.1 O TRILHO cortava o primeiro friso

*"parte do branco está vazando no frame metálico inferior na lateral"*. Não era
o remonte nem a saliência: com o `floorY` consertado na §30, forçar os 210 mm
do semirreboque põe o topo do perfil em `floorY + 127,5` enquanto a primeira
fileira de friso está em `floorY + 120,2` — **o perfil entra 7,3 mm dentro do
primeiro friso**, e o que se vê é a crista dele aflorando na aresta.

A altura não é a invariante; a FOLGA ATÉ O FRISO é:

```
semirreboque  row0 floorY+175,3 · topo do trilho floorY+127,5 → 47,8 mm
sobrechassi   row0 floorY+120,2 · topo alvo      floorY+ 72,4 → 47,8 mm (155 mm de perfil)
```

`RAIL_TOP_UNDER_ROW0 = 0,0478` substituiu `RAIL_HEIGHT` como alvo do topo.
Aplicada ao semirreboque ela devolve exatamente o topo que ele já tem — o teste
de que é a régua dele. As duas saias são diferentes (175 contra 120 mm), então
um perfil de altura fixa não podia servir aos dois.

### 31.2 A FITA estava centrada num poste que ninguém vê

Os montantes de canto são ANINHADOS, e a versão anterior escolhia por Z MAIS
PRÓXIMO — que no canto dianteiro do sobrechassi é o de DENTRO:

```
estrutura-principal-02   87 × 2850 × 87   face |x| 1,3016   z 4,1622…4,2492
estrutura-principal-03   65 × 2850 × 65   face |x| 1,3116   z 4,1942…4,2592
crista da pele 1,3101 · fita 1,3119
```

A fita está colada no **-03**, cuja face aflora na pele; o -02 fica 8,5 mm para
dentro e é invisível. `POST_FACE_TOL` filtra os candidatos pela FACE antes de
desempatar pelo Z. No semirreboque os dois montantes do canto compartilham o
centro em z (−7,4421 e −7,44225), então lá a régua nova e a antiga dão a mesma
resposta — que é o teste de que ela não mexe no padrão ouro.

### 31.3 A ESTAÇÃO DE ENCOSTO: uma sobrava, a outra não estava em friso nenhum

Cada porta que abre 270° tem no flanco uma estação de encosto (borracha
37 × 28 × 28 + a fêmea do engate, 100 mm atrás). Medido:

```
semirreboque  UMA por flanco, z −6,51/−6,41
sobrechassi   a mesma em z −3,29/−3,19  +  uma no flanco esquerdo em z +2,23/+2,33
```

A segunda é a da PORTA LATERAL DE FÁBRICA, que já saiu. Ela mora a mais de um
metro do vão — fora do retângulo que `removeBakedSideDoor()` varre — e por isso
sobrevivia. `removeSideDoorCatches()` fica com a estação mais à trás e tira as
outras; num bake com uma estação só não remove nada.

E a que fica estava a cavalo do friso. A grade das faixas lisas, medida:

```
topo do quadro  piso + 72,4      faixa #1  piso + 77,6 (metade atrás do quadro)
faixa #2        piso +130,6      faixa #3  piso +183,6  ← o alvo
peça de fábrica piso +200/+205 — 16 a 21 mm acima do centro da faixa
```

`seatFlankCatches()` assenta o CONJUNTO (a borracha e a fêmea andam juntas, com
os 5 mm de desencontro que a peça tem de fábrica) na faixa mais próxima, com
teto de meio passo. ⚠️ Ela é local ao implemento e NÃO substitui
`raiseDoorCatches()`: aquela régua foi calibrada em foto no semirreboque com o
erro de referencial dentro (§29.3), e corrigi-la moveria a peça aprovada 19 mm.

### 31.4 Por que os dois primeiros frisos não tinham rebite

`measureValeRows()` começava a coluna em `yMin + 0,14`, e os 140 mm eram a
altura do trilho DO SEMIRREBOQUE contada do pé do painel. O trilho não tem
altura fixa (31.1) e a saia de cada baú é outra: no sobrechassi a régua velha
punha a primeira fileira em `floorY + 140`, que é acima da faixa #2.

A régua nova é o topo do quadro mais o raio da calota
(`row0 − RAIL_TOP_UNDER_ROW0 + RIVET_DOME_R`). No semirreboque devolve
`floorY + 136,5` contra os `+140` de antes — a MESMA primeira fileira. No
sobrechassi devolve `+81,4`, e a coluna passa de 96 para **100 fileiras**.

### 31.5 A INCLINAÇÃO: medida, e ainda NÃO implementada

*"a parte da frente do chassi é mais baixa, o implemento deve ficar levemente
inclinado"*. `solveRigidMount()` já devolve `pitchX` (hoje zero) e
`applyRootPose()` já o escreve — a via existe. O que falta é o NÚMERO, e
`tools/studio-bench/checks-mesa-0820.mjs` mostra por quê:

```
faixa |x| 0,25…0,55 (a de `mounts.json`)   VM 16,0 mm/m · resíduo RMS 46 mm
alma  |x| 0,405…0,445                      VM 28,0 mm/m · resíduo RMS 20 mm
                                            Scania P  4,7 mm/m · resíduo RMS 51 mm
```

A rampa EXISTE e sobe para a traseira nos três chassis — o dono está certo. Mas
os dois rígidos discordam por 6×, e o resíduo do ajuste é da ordem de metade do
sinal: a janela ainda pega travessa, tanque e berço de eixo junto com a mesa.
Inclinar a carroceria mexe no vão da cabine, na altura do teto, no Thermo King
e no recorte da livery; fazê-lo sobre um ajuste com 50 mm de resíduo é trocar um
defeito visível por três invisíveis. **A próxima rodada começa por isolar a mesa
— o mesmo caminho que `frameTopY` percorreu em 2026-08-18: percentil por célula
MAIS conferência em foto, com a bancada desenhando lâminas nas alturas
candidatas.**

### 31.6 O que ficou provado

| medida | semirreboque | sobrechassi |
| --- | --- | --- |
| topo do trilho abaixo do 1º friso | 47,8 mm | **47,8 mm** |
| fita vertical, montante escolhido | o mesmo de antes | o que aflora na pele |
| estação de encosto | 1 por flanco | 1 por flanco (2 removidas) |
| fileiras de rebite | 90 (45/lado) | **100** (50/lado), era 96 |
| fase do rebite | 13,2 mm | 13,8 mm |

## 32. 2026-08-20 (noite) — A INCLINAÇÃO, medida pelo VÃO

### 32.1 A mesa não se deixa medir pelo topo; o vão sim

Três tentativas, e as duas primeiras falharam pela mesma razão:

```
percentil do y na faixa |x| 0,25…0,55   VM 16,0 mm/m · RMS 46 mm · P discorda 6×
percentil do y na alma  |x| 0,405…0,445 VM 28,0 mm/m · RMS 20 mm · P 4,7 mm/m
área de face virada para +y             VM 14,1 mm/m · RMS 62 mm · P não encontra a mesa
```

A malha de chassi de um rip traz travessa, tanque e berço de eixo na mesma faixa
de x, e qualquer estatística sobre "o mais alto ali" muda de peça a cada célula.

O que mede é o **VÃO**: raios para baixo, do fundo da carroceria até a primeira
coisa do caminhão, ao longo da pegada. O perfil dele É a cunha, e no VM ele é
uma reta com **0,1 mm de resíduo** — 200 mm de vão na frente contra 6 mm atrás.
A inclinação sai por **Theil–Sen** sobre os pares (a mediana das inclinações
par a par, que o raio perdido numa travessa não arrasta):

```
volvo-vm-2015-6x2r   27,63 mm/m = 1,583°
scania-p-8x2r        15,91 mm/m = 0,911°
```

⚠️ E o sinal só fecha com o referencial certo: medido no espaço LOCAL da
cabine a mesa SOBE com +z, porque `orientYaw = π` e o local é o cru do GLB, em
que o caminhão aponta para −Z. Em espaço NORMALIZADO — que é o de
`mounts.json` — ela CAI para a frente, e `frameSlope` é NEGATIVA.

### 32.2 O pivô é a traseira

`Rx(θ)` leva (0, y, z) a `y·cosθ − z·sinθ`, então a inclinação do fundo é
`−sinθ`; igualá-la a `frameSlope` dá `θ = asin(−frameSlope)`.

E girar em torno da origem enterraria ou levantaria a carroceria inteira. Hoje
ela ENCOSTA no quadro na ponta de trás (6 mm de vão) e abre para a frente, então
o pivô é `body.rearZ`: o contato de trás não se mexe e o nariz desce os 232 mm
que fecham a cunha. `roofY` passa a ser medido com a inclinação — o ponto mais
alto de um baú de nariz para baixo é a TRASEIRA, e é ele que a câmera enquadra.

**Provado**: com a inclinação, o vão do VM passa de `200…6 mm` (cunha) para
**0…8 mm ao longo de todo o comprimento**. `frameSlope` ausente = zero = o
comportamento de antes, que é o que um manifesto ainda não medido deve fazer.

### 32.3 A chaminé do Thermo King

A unidade pequena traz um tubo de escape de 74 × 301 × 76 mm
(`refri_mat_0001_crome_1`) que sobe **140 mm acima da linha do teto** — a única
coisa que passa do teto num sobrechassi. Sai por `removeStack` no
`thermoking_p360_meta.json`, e a busca é por FORMA sobre o material (tubo
esbelto) para que um re-bake que renomeie o material não leve a carenagem junto.

### 32.4 Em aberto desta leva, com a medida de cada um

- **Ainda há algo 139,6 mm acima do teto**: `refri_p0_3`
  (`refri_mat_0006_plastic_hard_`, 1 200 × 1 213 × 615 mm). É a carenagem
  traseira da unidade INTEIRA, e o que passa do teto é uma parte dela — provável
  segunda peça do mesmo escape. Separar pede o mesmo caminho do registro (§30.3):
  componentes conexas com assinatura.
- **"o Thermo King está afastado"** — `placeThermoKing()` encosta o plano de
  montagem medido (§27.5/§28.3); falta medir de quanto ele está afastado e
  contra o quê.
- **Os rebites que flutuam acima do TK** — as colunas terminam em z +3,215, a
  979 mm da testeira; falta identificar qual coluna ele vê.
- **Os dois cabos até o fundo do baú** — é geometria NOVA, e este arquivo se
  recusa a inventar peça. Precisa de decisão antes de virar código.
- **O suporte branco da escada** — não é `platico-branco` nem lataria; provável
  `metal-estrutura-principal-padrao` (metalness 1) espelhando o céu. Falta o
  raio no pixel para condená-lo.

## 33. 2026-08-20 (2ª rodada) — a testeira, a chaminé, o trilho de topo e o que a régua desmentiu

Sete correções na mesma tarde, e o fio que as costura é o de sempre neste
arquivo: **medir num referencial que não é o da peça**. Duas delas já tinham
sido dadas como feitas em §32 e não estavam.

### 33.1 A chapa de livery da TESTEIRA: 170 mm de chapa numa parede de 2 490

*"olhe como está o livery da frontal, totalmente errado"* — Kennedy, com print.
E era: a testeira saía com **24 triângulos e 170 mm de largura** numa parede de
2 490.

`buildLiveryPanels()` recorta cada chapa por uma FATIA: pega tudo o que está a
menos de N milímetros da parede. A fatia da frente e a de trás usavam
`box.max.z` / `box.min.z` — a caixa envolvente do implemento. **E a caixa não é
a parede.** Medido:

```
parede da frente (na PELE)   4,194 m      caixa   4,252 m     58 mm de erro
parede de trás   (na PELE)  -4,186 m      caixa  -4,259 m     73 mm de erro
```

O que estica a caixa para além da parede é a ferragem — no gancheiro, a
gancheira e os fechos passam da chapa. Com a fatia ancorada 58 mm à frente da
parede real, quase nada da testeira entrava nela, e o que entrava eram as
sobras. Daí 24 triângulos.

A correção mede as duas paredes **na pele**, não na caixa: só entram na conta
os vértices que estão no flanco (`|v.x − cxPele| ≥ meiaPele − LIVERY_SKIN_SIDE`),
porque a pele é o único elemento que vai de parede a parede e não tem ferragem
pendurada. A testeira passou de **24 → 480 triângulos, 170 → 2 490 mm**.

> ⚠️ Depois do enxerto do suporte da escada (§33.2) ela caiu para **96
> triângulos** e a profundidade de 159,8 para 104,6 mm — e isso é ACERTO, não
> regressão: os três suportes brancos deixaram de ser família branca e saíram
> do recorte, levando junto os 55 mm que eles projetavam.

### 33.2 O suporte da escada era branco porque o export o pintou de branco

*"essa parte que segura a escada na frente está branca, deveria ser metálica
igual à própria escada"*. §32 deixou isto em aberto com um palpite errado
("provável `metal-estrutura-principal-padrao` espelhando o céu").

Não era iluminação: eram **três malhas de 170 × 50,8 × 55 mm** que o
`stitch_all` fundiu na família branca, como já tinha acontecido com os retornos
do quadro da testeira em §30. Entrada nova no
`tools/implement-bake/graft-materials.mjs` — `suporte-da-escada`, assinatura de
tamanho, portão de 3 instâncias, destino `metal-pouco-polido`. Enxertado e
conferido: `3/3 instância(s)`, e `floorY`/`roofY` intactos (1,0489 / 3,8258 no
referencial da sonda), que é o teste que importa depois de §30.

### 33.3 A chaminé do Thermo King — o `y` do buffer não é o `y` da unidade

§32.3 declarou esta remoção pronta. Ela **nunca removeu nada**, e o dono
reportou duas vezes. As duas vezes eu conferi o portão (`removeStack: true` no
`thermoking_p360_meta.json`) e a ordem de chamada (`attachThermoKing()` roda
depois de `buildTrailerRig()`, então o teto paramétrico existe) — os dois
certos. O defeito estava na comparação.

`thermoking_p360.glb` veio de FBX e **o nó carrega a rotação da conversão**.
Ordenar as componentes conexas por `pos.getY()` ordena por um eixo do *buffer*
que não é o vertical da unidade montada: a peça mais alta do arquivo não é a
peça mais alta na tela. Agora as alturas saem em espaço da UNIDADE:

```ts
const m4 = new THREE.Matrix4().multiplyMatrices(tk.matrixWorld.clone().invert(),
                                                o.matrixWorld);
```

E a busca virou **global**, sobre as componentes de todas as malhas. O escape
são DUAS peças sobrepostas — um tubo cromado (`refri_p0_1`, malha inteira, uma
componente) dentro de um tubo plástico (1 das 10 componentes de `refri_p0_3`, a
carenagem). Qualquer regra *por malha* pega uma e deixa a outra, que é
exatamente o que o dono viu: o cano continuava lá depois de "removido".

O corte é o **maior salto no topo**: 144 mm entre o escape e o resto da
carcaça, contra 9 mm entre as vizinhas seguintes. 228 triângulos em 2 malhas.
Verificado por índice: `refri_p0_1` fica com **0 triângulos** e `refri_p0_3`
passa a terminar **129 mm abaixo** do teto (era +140).

> **⚠️ ARMADILHA DE VERIFICAÇÃO, e ela custou duas rodadas.**
> `checks-tk-0820.mjs` continuou reportando o cano DEPOIS de ele sair, por dois
> motivos que se somam. (a) A caixa da checagem varre
> `geometry.attributes.position` INTEIRO — tirar triângulos do índice **não
> apaga vértice nenhum**, então a caixa não encolhe. (b) A bancada **não
> encaminha o console da página**, então a linha `[tk] chaminé removida` era
> invisível. **Uma remoção por índice só se verifica por índice** (a listagem
> "por componente" da mesma checagem, que percorre `getIndex()`), e a checagem
> agora captura `console.info` antes de trocar de chassi.

### 33.4 A folga da cabine — `cabGap` 0,15 → 0,25 m

*"afaste um pouco o implemento da cabine"*. Um número só, em
`mounts.json/defaults`, e vale para os dois rígidos porque é convenção de
montagem e não propriedade do chassi: entre a parede da cabine e a testeira tem
de caber o basculamento.

**O custo é real e está pago de propósito.** `dz = (cabRearZ − cabGap) −
body.frontZ`: afastar da cabine empurra a carroceria para −z e **piora o
balanço traseiro**, de 213 para 313 mm além da ponta do quadro. A alternativa
seria encurtar o baú, que não é desenho meu.

### 33.5 A chapa da Ankaa — mesmo nome de material, instância crua

*"essa placa com Ankaa deveria estar com a mesma textura de inox em volta
dele"*: ela saía BRANCA FOSCA entre cantoneiras que espelham o mato e o
asfalto. E **não era cor errada** — `porta_kit_v1.glb` já declara
`inox-ferragem` (baseColor 0,64/0,67/0,69, roughness 0,3).

O que muda é a INSTÂNCIA. O kit é um asset à parte (`loadDoorKit()`), então o
`THREE.Material` que sai dele é objeto novo, e tudo o que o estúdio faz com o
inox depois da carga (envMap, `envMapIntensity`, o escovado) foi aplicado nos
materiais **do implemento**. O do kit nunca passou por lá: fica um PBR nu, que
sem reflexo nenhum lê como tinta branca. Duas peças coladas, mesmo nome de
material, acabamentos diferentes.

> **⚠️ E NÃO SE CASA PELO NOME EXATO.** A primeira versão casava, e avisou *"não
> há inox-ferragem no implemento"* num implemento com 59 malhas de inox:
> `splitStainlessHardware()` roda muito antes e **quebra a família** —
> `inox-ferragem` vira `inox-ferragem__caixa`, `__polido` e companhia. Casa-se a
> FAMÍLIA (`^inox-ferragem(__|$)`), e entre os irmãos ganha **o mais perto do
> sítio**: o pedido é *"o inox EM VOLTA dele"*, e herdar o da caixa de cozinha
> seria acertar a família e errar o acabamento. Sai `inox-ferragem__polido`, a
> 213 mm do sítio.

Ver §33.9 — a sonda de vizinhança depois desmentiu o enunciado do pedido.

### 33.6 Um friso acima

*"suba um friso essas peças"*, sobre a estação de encosto que §31 tinha
assentado. São duas decisões separadas e agora o código as separa: o
**assentamento** acerta a FASE (a peça no centro da parte lisa, não montada na
crista) e continua com o teto de meio passo; a **altura** em que a estação mora
é escolha do dono, e entra como `SOBE_FRISOS = 1`.

O degrau é `pitch`, não um número em milímetros — assim, em qualquer bake e com
qualquer passo, a peça continua centrada na faixa lisa, só que na de cima.
Medido: assentamento −73 mm + passo 113 mm = **+40 mm**.

### 33.7 O trilho de topo: rebites assados e o filete da junta

*"nesse frame metálico lateral superior, crie um filete, levemente elevado
entre ele e a parte branca, de 5x8 mm, e feche os buracões que são para rebite,
já que os rebites devem ser gerados sob demanda mais tarde de acordo com o
tamanho do implemento"*.

**O porquê do pedido está na comparação com o semirreboque**, e é ela que dá a
régua. Na mesma faixa do topo, os dois implementos têm peças que não se
parecem:

```
semirreboque   26 × 210 × 14580 mm     412 tri   uma peça,  LISA
sobrechassi    65 × 103 ×  3000 mm   3 004 tri   seis peças, FURADAS
```

Mil por cento mais triângulo para a mesma tira de metal, e o excedente é furo:
o bake trouxe **os rebites modelados na chapa**. Isso briga com
`addPlateRivets()`, que gera a rebitagem sob demanda a partir do tamanho do
implemento — furo assado é furo no passo do desenhista, não no do baú que o
estúdio monta.

> **⚠️ NÃO SÃO BURACOS VAZADOS, e a sonda topológica mentiu por isso.** A
> primeira medição contou arestas de borda (aresta usada por UM triângulo só) e
> devolveu **zero** nas seis peças — de onde eu concluí, errado, que não havia
> furo nenhum no implemento. São **rebaixos fechados**: furo com fundo. O que
> os denuncia é o histograma de profundidade a partir da face de fora:
>
> ```
> 0 mm:   12 vértices   (os cantos do perfil)
> 6 mm: 1454 vértices   ← a FACE, e as bordas dos rebaixos
> 8 mm: 1454 vértices   ← o FUNDO dos rebaixos
> ```
>
> Dois picos **gêmeos**: cada furo é um anel na face e o mesmo anel 2 mm mais
> fundo. E é essa gemelaridade que dá o algoritmo — fechar é levar o fundo até
> a face. Os triângulos da parede do furo ficam coplanares e somem, **sem mexer
> em contagem de vértice, em índice, em UV nem na caixa envolvente** (o fundo
> anda para FORA, e para dentro do que a caixa já continha). Verificado: o bin
> de 8 mm desaparece e o de 6 mm passa a somar os dois (1454+1454 → 2920), nas
> seis peças, 8 196 vértices.

> **⚠️ O par tem de ser ordenado por PROFUNDIDADE, não por contagem.** Em duas
> das seis peças o fundo tem mais vértices que a face (1170 contra 1166).
> Pegar "o maior pico" como face e "o segundo" como fundo inverteria o par
> nessas duas e empurraria a face para DENTRO — afundando a chapa inteira em
> vez de fechar o furo.

**O filete**: um por flanco, correndo toda a extensão do trilho daquele lado,
centrado na face de BAIXO do perfil externo (é ali que a chapa branca começa).
**8 mm de altura**, 4 para cada lado da costura, e **3 mm de saliência**
(nasceu com 5; *"deixe essa fita que você adicionou levemente mais fino, a
altura ficou boa"*), medidos a partir do ponto mais externo do trilho, com meio
milímetro cravado para não haver fresta.

**A posição da chamada é decisão, não acaso.** O filete acrescenta milímetros
salientes ao flanco, e no meio da construção isso seria uma mentira para toda
régua que mede o baú pela sua peça mais externa — `groundAndCenter()`,
`measureTopRail()`, a medida da pele em `buildLiveryPanels()`. Ele entra
**depois de `tagRoofLiveryUV()`**, quando já não há quem meça. O fechamento dos
rebaixos poderia rodar muito antes (não mexe em caixa envolvente nenhuma), mas
as duas coisas saem da **mesma medição das mesmas peças** e separá-las seria
responder duas vezes à pergunta cara — "onde está o trilho de topo". Daí uma
função só, `dressTopRail()`, atrás de `topRailDressing` no catálogo.

Quem é o trilho se decide por **forma e cota, nunca por material**:
`metal-estrutura-principal-padrao` é o material de meia estrutura do
sobrechassi, e no semirreboque a mesma peça é `metal-galvanizado-mantido`. O
que é próprio dela é ser corrida (> 0,5 m de z), morar no flanco (|x| > 0,9 m)
e encostar no teto. Casam 12 peças; **6 têm rebaixo** (os perfis externos de
65 × 103) e 6 não (os de 50 × 60, caixas fechadas de 68 triângulos).

### 33.8 O relevo some, a marca fica — as normais são metade do trabalho

Fechado o rebaixo, o dono voltou: *"ainda está as marcações dos rebites nesse
frame superior"*. E estava mesmo, com o relevo já em zero.

**Levar o fundo até a face apaga o RELEVO e não apaga a MARCA.** Os triângulos
que formavam a parede do furo ficam coplanares com a chapa mas continuam com a
normal apontando **para o lado**, e o sombreamento os desenha como anéis
escuros, idênticos a um furo, num plano perfeitamente liso. Passei uma volta
inteira procurando relevo que já não existia porque a sonda media posição e
não normal.

A sonda agora conta as duas coisas (`normais_noPlano` / `normais_tortas`), e a
correção reescreve as normais dos vértices que **estão no plano da face e ainda
não olham para fora**: 12 636 normais nas seis peças, `tortas` de volta a zero.

> **⚠️ NÃO SE USA `computeVertexNormals()`.** Ele faz média por vértice e o
> perfil é uma caixa: as quinas viveriam suaves, e um trilho de topo com quina
> redonda é um defeito maior que o anel. O teste de quem entra no laço é a
> **normal atual**, não a posição sozinha — os vértices de quina são duplicados
> no bake com normal própria e por isso ficam de fora.

### 33.9 A chapa da Ankaa: o que está em volta dela NÃO é inox

Depois de a chapa herdar `inox-ferragem__polido` (§33.5), veio *"a textura da
placa Ankaa continua diferente do restante"*. A sonda de vizinhança respondeu, e
a resposta muda o enunciado do pedido:

```
PLACA          inox-ferragem__polido      metal 1 · rough 0,30 · envInt 1,00
quem emoldura  metal-galvanizado-polido   metal 1 · rough 1,00 · envInt 1,00
```

Quem cerca a chapa é **galvanizado polido, `roughness` 1 — metal FOSCO**, de
outra família. O inox (`roughness` 0,3, espelhado) são as cantoneiras das
pontas. Ou seja: "a mesma textura de inox em volta dele" e "a mesma textura de
quem a emoldura" são **duas peças diferentes**, e a chapa não pode ter as duas.
Ficou com o inox, que é o que o pedido diz; a bancada confirma `MESMA
INSTÂNCIA` com a vizinha de inox.

> **⚠️ E A CAIXA DA MALHA NÃO RESPONDE ESSA PERGUNTA.** A primeira sonda
> ordenou as vizinhas por distância de caixa e deu tudo empatado em 0 mm:
> depois da fusão, `FUSAO__inox-ferragem__polido` é UMA malha com todo o inox
> do implemento, de ponta a ponta, e a caixa dela contém a traseira inteira.
> Quem responde é o **triângulo** mais próximo — e, em malha de material em
> array, o **grupo** a que ele pertence.

### 33.10 O que esta leva fechou de §32.4, e o que continua aberto

FECHADO: a chapa de livery da testeira · o suporte branco da escada · a
chaminé do Thermo King · a inclinação (já em §32, agora conferida com o
`cabGap` novo) · o filete e os rebaixos do trilho de topo.

ABERTO, com a medida de cada um:

- **"o Thermo King continua afastado do implemento"** — NÃO resolvido, e **não
  é distância de caixa**: a caixa da unidade já ENCOSTA na testeira (z
  3,996…4,607 contra a parede em 4,194; 657 mm para fora, topo a 4 mm do teto).
  Falta ver o quadro que o dono vê — a bancada de foto (`checks-tkfoto-0820.mjs`)
  estourou os 10 min duas vezes e não produziu print.
- **Os rebites que flutuam acima do TK** — não identificados. Os únicos rebites
  do modelo são `SIDE_L/R_RIVETS`, em x ±1,3034 e z até +3,215 — **979 mm atrás
  da testeira** —, e **não existe fileira de testeira**. Ou é outra peça, ou é
  a ponta da fileira lateral aparecendo por trás da unidade.
- **Os dois cabos do TK até o fundo do baú** — é geometria NOVA. Pendente de
  decisão do dono.
- **`raiseDoorCatches()`** — continua RECUSANDO no sobrechassi (de fábrica em
  206 mm, fora da 1ª faixa lisa de 113 mm). No-op seguro, registrado em §29.9 e
  §30.6.

---

## 34. 2026-08-20 (3ª rodada) — os TRÊS rígidos: a cor que não pintava e o para-choque que virou parede

*"analise os novos modelos do volvo, scania e o volkswagen para garantir que as
cores serão aplicadas a elas corretamente, além disso analise a fundo
posicionamento do implemento [n]eles, o volvo está bom, mas atualmente o vw está
desabilitado e o scania está terrível"* — Kennedy, com print do Scania P de
cabine verde-água engolida pelo baú.

Três defeitos e uma ausência, e nenhum dos três aparecia num diff:

| | antes | depois |
|---|---|---|
| Volvo VM · tinta | **0 materiais** — a cor não fazia nada | `vm_cab`, 38,2 m² (15,5 %) |
| Scania P · tinta | **0 materiais** — ficava no verde-água do rip | `pintura`, 31,7 m² (9,6 %) |
| Scania P · parede da cabine | **z 2,78** (o para-choque) | **z 0,82** (a parede) |
| Scania P · testeira | **1,89 m DENTRO da cabine** | 71 mm atrás dela |
| Scania P · balanço traseiro | 2 700 mm de quadro nu | 740 mm |
| VW Constellation | `available: false` | no catálogo, com montagem medida |

### 34.1 ⚠️ A COR NÃO ERA APLICADA EM DOIS DOS TRÊS, e o console não mentia

`isPaintableMaterial()` (`vehicle/material-setup.ts`) decide por três caminhos:
a lista autorada, o nome (`carpaint|plain_grey`) e a **assinatura de shader da
SCS** — clearcoat ≥ 0,9 · rugosidade 0,089 ± 0,02 · metalicidade 0,15 ou 0,55.
Os três caminhos foram medidos contra o rebanho de rips da SCS em 2026-08-09, e
**os três rígidos não são rips da SCS**: são bakes brasileiros, exportados de
Blender por outra mão.

Medido nos três `.glb`, material a material:

| | material da lataria | rugosidade | metalicidade | clearcoat | pintava? |
|---|---|---|---|---|---|
| Volvo VM | `cabin_mat_0001_vm_cab_0` | 0,161 | 0,18 | 0,75 | **não** |
| Scania P | `cabin_mat_0000_pintura_0` | 0,125 | 0,10 | 0,65 | **não** |
| VW Titan | `clima_mat_0002_color` | 0,089 | 0,15 | 1,00 | sim |

O VW passava **por acaso** — é o único cujo exportador reproduziu a assinatura.
E o Scania guarda a prova de que a cor nunca chegava: o `baseColorFactor` do
`pintura` é **[0, 0,30, 0,30]**, o verde-água do caminhão de origem. Era ele que
estava no print, não uma cor escolhida.

**A correção é DADO, não código.** `chassis[].paintMaterials` no `brands.json`
existe para isto desde 2026-08-09 e é exclusivo quando declarado. Três listas de
uma entrada cada:

- `volvo-vm-2015/6x2r` → `["vm_cab"]`
- `scania-p/8x2r` → `["pintura"]`
- `vw-constellation/6x2-tl` → `["clima_mat_0002_color"]`

> **O casamento é por SUBSTRING**, e no Scania isso é a vantagem: `pintura` pega
> os cinco materiais que o bake batizou assim — casca da cabine, para-choque,
> para-lama traseiro, painel interno e o `treco` —, que é exatamente o conjunto
> que estava verde-água no print. Uma lista de nomes completos pegaria um.

> **⚠️ Mexer no limiar da assinatura NÃO era a saída.** Afrouxar clearcoat para
> ≥ 0,65 e rugosidade para ±0,04 alcançaria o VM e o P, e alcançaria junto
> `cabin_mat_0001_pretobrilhoso_1` — 110 m² de plástico preto no Scania, quatro
> vezes a área da lataria. A assinatura é uma medição de um bake específico; o
> lugar de descrever OUTRO bake é o manifesto dele.

### 34.2 ⚠️ "A MAIOR BANDA VIRADA PARA TRÁS" NÃO É A PAREDE DA CABINE

`measureCabRearWall()` (`vehicle/mounting.ts`, §28) existe porque o `cabRearZ`
do manifesto é o menor z da malha, e no VM a chaminé passa 167 mm atrás da
parede. Ela monta um histograma de ÁREA por banda de 20 mm em z, sobre triângulo
virado para −Z e acima de `frameTopY + 0,30`, e devolvia **a banda de maior
área**. No Scania P a banda campeã é esta:

```
z 2,78 · 1,4329 m² · parachoque_0_p2 [parachoque_0_mat_0002_plastic_hard_54] = 1,41
```

**O para-choque dianteiro.** Duas coisas erravam juntas, e cada uma sozinha já
bastava:

**1. O triângulo entrava INTEIRO se UM vértice passasse do limiar.** A banda de z
é escolhida pelo CENTRÓIDE; o corte em y era por vértice (`a.y < yLim && b.y <
yLim && c.y < yLim`). A carenagem do para-choque do P sobe até y 1,29 no cru e o
limiar é 1,2766 — ela encosta **13 mm** acima dele e entrou com 1,43 m² inteiros.
Os dois cortes agora olham para o centróide, que é a mesma pergunta feita do
mesmo jeito.

**2. A parede da cabine é REPARTIDA, e a régua era um argmax.** A do Scania P
ocupa **220 mm de z** (0,80…1,04) em bandas de 0,89 · 0,54 · 0,29 · 0,41 · 0,42
· 0,73 · 0,53 · 0,52 m² — 4,3 m² no total, nenhuma banda isolada maior que o
para-choque. E à frente dela um caminhão tem outras superfícies grandes viradas
para trás que não são parede nenhuma: face interna do para-brisa, painel,
carenagem do capô.

A régua nova é uma frase: **a parede traseira é a superfície do tamanho de
parede mais ATRÁS**. As bandas viram GRUPOS (vizinhas, com até três bandas
vazias entre elas, e as de menos de 0,06 m² fora do agrupamento para um fio de
área não costurar a parede ao capô); o grupo escolhido é o mais traseiro que
junte `minArea`; o z devolvido é a banda de maior área DENTRO dele.

Medida nas quatro combinações possíveis, para mostrar que qualquer uma das duas
correções já bastaria e que nenhuma mexe em quem estava certo:

| régua | Volvo VM | Scania P | VW Titan |
|---|---|---|---|
| vértice + argmax (a de ontem) | 1,20 | **2,78** ✗ | 1,30 |
| centróide + argmax | 1,20 | **0,82** | 1,30 |
| vértice + grupo traseiro | 1,20 | **0,82** | 1,30 |
| **centróide + grupo traseiro** (a de hoje) | **1,20** | **0,82** | **1,30** |

### 34.3 O TERCEIRO RÍGIDO — e o primeiro sem nó de chassi

`vw_titan_6x2_tl.glb` estava desligado com `unavailableReason: "rigido"` desde
antes de existir montagem de sobrechassi. Ligá-lo é uma entrada em `mounts.json`
— e medi-la exigiu uma sonda nova, porque `mountprobe.ts` filtra o quadro por
`/chassis|chs_base/` **e este bake não tem nó nenhum com esse nome**: cabine e
quadro estão fundidos em `truck_p4` (392 k vértices) e `truck_p5` (142 k), os
dois indo de ponta a ponta do caminhão.

`tools/trailer-bench/chassiprobe.ts` mede tudo por FAIXA DE X e por NORMAL, sem
depender de nome de nó, e importa `measureCabRearWall()`/`solveRigidMount()` do
engine em vez de recopiá-los — uma sonda que reimplementa a regra prova a
reimplementação. Ela roda os três de uma vez (`shoot-chassi.mjs`), e é a
comparação lado a lado que torna o defeito legível: **a mesma função, o mesmo
implemento, e um resultado 1,96 m diferente**.

> **⚠️ E os quatro rodados do VW são UM NÓ SÓ** (`wheel_f_0_0_f_tire_p0` cobre
> z −2,14…5,78 no cru). A caixa desse nó devolve o centro do caminhão em vez de
> um eixo — contar eixo por nó é ler a fusão, não a rodagem. Os eixos saem de um
> histograma de vértice de pneu em z: **1,6302 · −4,0272 · −5,2815**.

**`frameTopY` do VW não é o percentil, é o percentil CORRIGIDO PELO VÃO.** Com a
carroceria assentada no p90 (1,2937) e sem inclinação, o vão medido por raio sai
uma reta limpa — 53 mm no eixo traseiro, 113 mm na dianteira, 8,3 mm/m. É o
mesmo perfil de cunha do VM (§32), só que menor. Descontado o vão no pivô (a
traseira do baú): **frameTopY 1,2466 · frameSlope −0,0083**. Conferido depois:
vão final **8…10 mm** ao longo de todo o quadro.

`cabRearZ` é a traseira da CASCA DA CABINE (`clima_p2` — que é também a peça que
recebe tinta), **0,9225**. A caixa por nome daria 0,3727 por causa de
`interior_anim_p1`, 116 vértices de painel que se esticam 550 mm para trás da
cabine e não são cabine nenhuma.

> **O id do chassi continua `6x2-tl`**, apesar de o caminhão não ser cavalo:
> essa string é a chave do card em `public/renders/renders.json`
> (`vw/vw-constellation/6x2-tl`), e renomeá-la trocaria o card por um
> placeholder.

### 34.4 ⚠️ A FOLGA NÃO É A PERGUNTA — a INTERSEÇÃO é

A folga de 250 mm (`mounts.json/defaults.cabGap`) é medida contra a PAREDE, e a
parede não é o ponto mais atrás da cabine: no VM a chaminé passa 167 mm dela e
no VW a casca desce 378 mm atrás dela. Nos dois casos não há encontro nenhum —
o que passa é ESTREITO, e o baú tem 2,6 m de largura.

Então o portão não é distância, é **que área de malha do caminhão cai dentro da
caixa do baú montado**. Medido depois da correção:

| | interseção total | acima do piso + 150 mm |
|---|---|---|
| Volvo VM | 0,048 m² | 0,000 |
| Scania P | 5,993 m² | **0,000** |
| VW Titan | 0,001 m² | 0,000 |

> **⚠️ E O TOTAL SOZINHO REPROVA O CERTO.** Os 5,99 m² do Scania são o para-lama
> do 2º eixo direcional (`t_paralama_0_p1/p3`): o topo dele fica 58 mm acima da
> linha do piso, em |x| ≤ 1,23, e a saia do baú desce até |x| = 1,31 — ele está
> **atrás da saia**, escondido, que é onde um para-lama fica num caminhão de
> verdade. Um baú que engole a cabine não faz isso; ele a atravessa metro acima
> do piso. Daí o portão ser medido 150 mm acima do piso.

### 34.5 O portão no app: PIXEL, e não contagem de material

`tools/studio-bench/checks-rigidos-0820.mjs` roda os três no estúdio de verdade.

> **⚠️ A COR NÃO MORA NO `material.color`.** `applyChoice()` a manda para o
> uniforme compartilhado de `vehicle/paint.ts` (`setPaint({ color })`) e o
> `color` do material continua sendo o do bake. Um portão que lesse o material
> de volta responderia "não mudou" para o caso CERTO.

O que prova é pixel: duas tintas distantes (`#d81b24` e `#1049b8`), duas
capturas com a câmera parada, e a contagem do que mudou. Com zero material
pintável as duas imagens saem **idênticas** — que era o estado do VM e do P.

```
volvo-vm · PIXELS que mudam de cor → 49 352 de 2 304 000 (2,14 %)
scania-p · PIXELS que mudam de cor → 43 599 de 2 304 000 (1,89 %)
vw-titan · PIXELS que mudam de cor → 53 092 de 2 304 000 (2,30 %)
```

Os três passam os sete portões: virou sobrechassi · montagem reconhecida · sem
engate · uma raiz só · a cor chega na tela · cobertura ≥ 8 % da malha · cabine
fora do baú. E a volta ao cavalo mecânico continua engatando com uma raiz só,
que é o ato que pega vazamento de estado de módulo (§25).

### 34.6 A placa dianteira dos dois rígidos de 18/08 não existia

`plates.json` tinha 49 cavalos e nenhum dos dois rígidos novos — eles entraram
no catálogo dois dias depois da última corrida da sonda, e um caminhão sem
entrada ali fica **sem placa dianteira**, calado. `node tools/placa/probe.mjs`
mede os dois sem exceção autorada:

```
volvo_vm_2015_6x2r.glb   y=0,410  rms 1,4 mm  vão  9 mm   chs_base_0_p16 [cabin_mat_0001_vm_cab_0]
scania_p_8x2r.glb        y=0,420  rms 1,2 mm  vão 14 mm   parachoque_0_p8 [parachoque_0_mat_0008_baseplaca_60]
```

O do Scania cai em `baseplaca` — o berço de placa do próprio bake, que é o
melhor sinal possível de que a sonda achou o sítio certo.

> A mesma corrida **removeu 6 entradas**: `daf_xf_105_6x4`, `man_tgx_6x4`,
> `mercedes_actros2014_6x4`, `volvo_fh16_2012_6x4a`, `volvo_fh_2021_6x4` e
> `volvo_fh_2024_6x4`. A sonda gera a partir do CATÁLOGO, e nenhum desses
> chassis está no `brands.json` de hoje — são órfãos de uma poda anterior. As 45
> entradas que sobraram saíram **byte a byte iguais** às de antes.

### 34.7 O que fica aberto

- **Card de seletor**: `renders.json` não tem nenhuma cor para `volvo-vm-2015`
  nem para `scania-p`, e só `neutro` para o VW. Os três caem no placeholder até
  alguém rodar `tools/studio-render/shoot.mjs`.
- **`scania_r_2016_6x2t`** continua desligado com `unavailableReason: "rigido"`.
  Ele é o quarto rígido do acervo e não foi medido nesta leva.
- **`mounts.json` continua sem `fingerprint`** (§25): um re-bake de caminhão
  envelhece as três entradas sem avisar.
- **O balanço traseiro é o que o baú de 8,51 m dá**: −313 mm no VM (a carroceria
  passa da ponta do quadro), +740 mm no Scania P, +247 mm no VW. Com um só
  comprimento de implemento não há como os três ficarem iguais — encurtar o baú
  é decisão de produto.

---

## 35. 2026-08-20 (4ª rodada) — as peças dos três rígidos, e o rabo de chassi-cabine

Onze queixas do dono sobre os três rígidos, em duas levas, todas sobre PEÇA e
não sobre régua. Elas são a razão de existir `vehicle/cab-bake-fixes.ts` — a
contraparte de `trailer-bake-fixes.ts` para o lado CAMINHÃO.

`trailer-bake-fixes.ts` é grande porque o baú é paramétrico e quase toda
correção lá é uma RÉGUA, que vale em qualquer bake. Um caminhão é um rip
fechado: o que se conserta nele é sempre **uma peça daquele arquivo**. Daí a
forma ser uma TABELA por arquivo, com a medida e a foto do dono em cada linha.

> **⚠️ E ELA RODA ANTES DE TUDO.** Logo depois de `setupCommon()`, e a ordem é
> contrato: antes de `measureCabRearWall()`/`findRigid()`, porque esconder ou
> mover peça muda o que a montagem mede; e antes de `applyMerge()`, porque
> depois da fusão a malha de origem já está escondida e o material é de um balde
> inteiro — a mesma regra de §23.

### 35.1 O que saiu, o que desceu, o que mudou de acabamento

| caminhão | peça | medida | o quê |
|---|---|---|---|
| Volvo VM | adesivo `5001` | 34 vértices, na quina traseira da cabine | escondido |
| Volvo VM | limpador de para-brisa | material é cópia do plástico da cabine, UV em região CLARA do atlas | sem mapa, preto fosco, rugosidade 0,55 |
| Scania P | para-lama do 2º eixo | topo em y 1,2056 contra coroa de pneu em 0,992 — **214 mm de vão** | as 8 malhas do grupo descem 110 mm |
| Scania P | placa de fábrica dianteira | 2 malhas coplanares (arte + base) sob a Mercosul | escondidas |
| Scania P | para-lama do 1º eixo | saía preto ao lado do 2º, que é `pintura` | entra na lista de tinta |
| VW Titan | 2º par de limpadores | y 2,167…2,286 num vidro que vai de 1,87 a 2,58 | escondido |
| VW Titan | placa de fábrica | moldura VERMELHA em volta da Mercosul | escondida (dianteira e traseira, mesma malha) |
| VW Titan | aro, cubo e porcas | metalicidade **ZERO** e rugosidade 0,269 — parâmetro de plástico | aço: 0,85/0,30 e 0,80/0,38 |

> **⚠️ O PARA-LAMA DESCE COMO GRUPO.** `t_paralama_0` são oito malhas — arco
> pintado, arco preto, faixa, suporte, trilho e para-barro. Descer só o arco
> abriria 160 mm entre ele e o para-barro, que continua pendurado onde estava.

> **⚠️ E O NOME DO PARA-LAMA DIANTEIRO VAI INTEIRO na lista de tinta.** O
> casamento de `paintMaterials` é por SUBSTRING: `plastic_hard` sozinho pegaria
> mais oito materiais do Scania, entre eles os **110 m²** de plástico preto da
> cabine (`cabin_mat_0001_pretobrilhoso_1`), quatro vezes a área da lataria.

### 35.2 O VIDRO não é tabela por arquivo — é a régua da frota

*"todos os vidros desses 3 modelos devem ser escurecidos, para baterem com o
padrão dos outros cavalos"*. Lidos os 51 `.glb` de `models/trucks/` direto do
chunk JSON, filtrando vidro EXTERNO (`glass_ex`/`glass_color`/`windshield`, sem
`_int` e sem espelho):

```
α 0,800 · rugosidade 0,040   → 56 materiais   ← a frota inteira
α 0,350 · rugosidade 0,200   → 12 materiais   ← SÓ o Scania P e o Volvo VM
α 1,000 · rugosidade 0,122   →  2 materiais   ← OPACOS (vidro do volante do DAF)
```

Ou seja 0,35 não é "o vidro deste modelo": é o outlier de dois bakes da mesma
procedência, e com ele o vidro deixa passar 65 % do que está atrás — que é a
foto do dono com o banco nítido. `normalizeExteriorGlass()` traz quem estiver
fora para 0,80/0,040. **O VW já estava no padrão** e sai da função sem uma
linha de log, como 46 dos 49 cavalos.

> **⚠️ SÓ MEXE EM QUEM É `transparent`.** Os dois OPACOS acima são vidro de
> instrumento com textura própria; forçá-los a α 0,80 abriria buraco na cabine.

> **⚠️ E A COR É LINEAR.** `baseColorFactor` do glTF está em espaço LINEAR e é
> assim que o `GLTFLoader` deixa `material.color`. `setHex(0x1a1a1a)` seria lido
> como sRGB e daria 0,0091 linear — um vidro dez vezes mais escuro que o da
> frota. `setRGB()` escreve no espaço de trabalho, que é o linear.

### 35.3 ⚠️⚠️ "O IMPLEMENTO ESTÁ MUITO BAIXO" — duas correções minhas, as duas erradas

Este item vale registrar inteiro, porque **errei duas vezes seguidas e a segunda
vez foi por confiar numa medida mal recortada**.

**PRIMEIRA TENTATIVA — cortei o chassi.** O vão da carroceria até a mesa da
longarina era de 7…16 mm no Scania e 8…10 mm no VW, então concluí que o que
cortava a plaqueta Ankaa da travessa traseira estava ATRÁS dela (numa vista de
trás, atrás é NA FRENTE da câmera) e podei o kit de traseira do chassi. Resposta:

> *"porque diabos você cortou a parte traseira do scania?"* e, em seguida,
> *"pedi para ajustar a ALTURA do implemento sobre o chassi dos trucks"*.

Remover geometria do caminhão para resolver um enquadramento é trocar um defeito
por uma mutilação. Revertido por inteiro.

**SEGUNDA TENTATIVA — levantei a carroceria 25…85 mm.** Medi a interferência com
um CAMPO DE ALTURA em (x, z) e levantei `frameTopY` até zerá-la. Resposta:

> *"tem um espaço entre o implemento e o truck vw"*.

E ele estava certo de novo. **O campo de altura tinha dois defeitos de
recorte**, e cada um sozinho já inventava interferência:

1. **CÉLULA DE 100 mm.** As longarinas auxiliares da carroceria estão em
   |x| 0,374…0,439; uma peça do caminhão em x 0,485 — 46 mm ao LADO delas — caía
   na mesma coluna e virava "interferência".
2. **O FUNDO ERA "a malha mais baixa da coluna".** A carroceria pendura suporte,
   mangueira e travessa curta abaixo do piso, e nenhum deles é o que ela APOIA
   no quadro. Os 80 mm que o VW pediu eram um suporte de 100 cm² do caminhão
   tocando um suporte da carroceria.

**A RÉGUA CERTA JÁ EXISTIA**, e é a de `measureMountDatum()`: o que apoia é o
membro que ATRAVESSA a carroceria — as duas longarinas auxiliares têm 8,45 m de
vão em z contra 8,63 m de baú, e as mangueiras 0,33 m; o corte em metade do
comprimento cai num vazio de 8,1 m. Com célula de 50 mm e o fundo restrito a
esses membros, medido nas cotas ORIGINAIS:

```
Volvo VM   0 mm        Scania P   0 mm (um toque de 11 mm sobre 0,001 m²)
VW Titan   0 mm
```

**Nada do caminhão encosta no sub-chassi.** As cotas voltaram para 1,1890 /
1,0373 / 1,2466 e é onde ficam.

> **⚠️ E A MEDIDA DO VÃO É CEGA PARA INTERFERÊNCIA**, o que continua valendo e é
> o motivo de as duas medidas existirem: o raio de `medeVao()` nasce 20 mm acima
> do fundo da carroceria e desce; se houver peça ACIMA desse ponto, o raio nasce
> dentro dela e o primeiro acerto é a próxima coisa abaixo. O vão diz se a
> carroceria assenta; o campo de altura diz se ela cabe. Nenhuma substitui a
> outra — e o campo de altura só vale com o recorte certo.

**O que sobra em aberto**: a plaqueta traseira do baú continua sendo cruzada
pelo rabo de chassi-cabine em vista traseira baixa. Não é altura e não se
resolve cortando o caminhão; fica registrado como pendência de produto.

### 35.4 A sonda que separou "é do caminhão" de "é do implemento"

Nenhuma medida respondeu tão rápido quanto uma cor chapada: `?tingeTruck=1` em
`chassiprobe.ts` pinta o CAMINHÃO INTEIRO de magenta e deixa a carroceria como
está. Na primeira foto de trás ficou evidente que tudo que cortava a plaqueta
era magenta — e a hipótese de altura caiu na mesma imagem.

`?destaca=<regex>` faz o inverso e serve para achar peça: chapa magenta em quem
casar `nome-do-nó[nome-do-material]` e devolve a caixa de cada uma. Foi ela que
identificou o adesivo `5001` (34 vértices), o segundo par de limpadores do VW e
a placa de fábrica de moldura vermelha — três peças que nome nenhum entregava.

### 35.5 O que fica aberto desta leva

- **`scania_r_2016_6x2t`** continua desligado com `unavailableReason: "rigido"`.
- **Cards de seletor**: `renders.json` não tem cor nenhuma para os três rígidos.

---

## 36. 2026-08-20 (5ª rodada) — a roda do VM nos outros dois rígidos

*"troca todas as rodas dos 3 modelos de sobrechassi para usar as rodas desse
volvo, que são as melhores desenhadas [...] enquanto dos outros são muito mal
feitas, garanta de posicionar corretamente e redimensionar também"* — Kennedy,
com foto da dianteira do VM.

O caminho já existia e é o de `vehicle/wheels.ts`, que troca a rodagem do
IMPLEMENTO pela roda do FH16 desde 2026-08-10: um asset NORMALIZADO mais um
módulo que mede a roda de destino e instancia. O que esta leva acrescenta é o
irmão do lado CAMINHÃO — `tools/wheel-bake/bake_wheel_vm.py` +
`vehicle/truck-wheels.ts` + `models/vehicles/wheel_vm_v1.glb` (1,4 MB).

### 36.1 O asset — extração por NÓ, não por recorte

`bake_wheel.py` recorta faces por posição porque no FH16 as rodas chegam
mescladas por material. No VM não: cada roda é um conjunto de nós próprios
(`wheel_f_0_0_f_{disc,hub,nuts,tire}_pN`), então a extração é um `pick()` por
nome e o que sobra do irmão é só a NORMALIZAÇÃO — cubo na origem, eixo em +X,
face externa para +X, diâmetro do pneu exatamente 1,0.

Medido: dianteira Ø 1,055 largura 0,308 (avulsa) · traseira Ø 1,056 largura
0,611 (dupla).

> **⚠️ O CRITÉRIO DE LADO DO IRMÃO NÃO SERVE AQUI.** Lá a face externa é "onde o
> disco está". No rodado DUPLO do VM o `r_disc` é uma malha só com os aros das
> DUAS rodas, e o centro dele cai a **4 mm** do centro do pneu — o teste vira
> ruído. E o cubo, o outro candidato, é o cubo DO EIXO e mora entre os dois
> pneus. O que não é ambíguo é o SINAL DE X na origem: as peças escolhidas são
> as da roda esquerda, e numa roda esquerda a face externa olha para −X. O giro
> é incondicional, e o que falha alto é a verificação de que o lado é esse.

> **⚠️ E A CONFERÊNCIA FINAL PRECISOU MUDAR JUNTO.** O irmão exige que o aro
> alcance a face externa do pneu; medido nesta roda o flanco sai **24 mm por
> fora** da aba do aro, que é o que um pneu faz. O critério passa a ser "o aro
> está na metade EXTERNA" — montado ao contrário ele estaria inteiro do outro
> lado, a meia largura de rodado de distância.

### 36.2 ⚠️⚠️ QUEM DIZ ONDE ESTÁ O EIXO É O ARO, NUNCA O PNEU

A primeira versão agrupava as rodas cortando os vértices de PNEU por vão em z,
como o irmão faz. **Isso não pode funcionar: os pneus de um tandem se tocam.**
Medido no VM — eixos a 1,296 m, pneu de 1,056 m, as duas rodas ocupam z
−5,32…−4,26 e −4,02…−2,97 e o vão entre elas é de **240 mm**, menor que qualquer
banda que ainda separe eixo de eixo.

O resultado: o tandem virava UM grupo, com "diâmetro" 1,70 m — a média entre a
altura real e os 2,35 m dos dois juntos — e largura de roda avulsa, ou seja
classificado como AVULSO. Sai uma roda de trator, e foi exatamente o relato:

> *"as rodas do chassi estão gigantes"* e *"você pegou apenas a roda dianteira,
> então as rodas que têm um rebaixo e não os parafusos para fora sumiram"*.

**Duas queixas, um defeito.** O aro não tem esse problema: ele tem ~0,62 m e dois
aros de um tandem ficam a 630…680 mm um do outro. Então o eixo sai do ARO
(`_disc`, o único nome que os três rips compartilham) e o pneu é atribuído ao
eixo mais próximo — atribuição sempre correta, não por sorte: um vértice de pneu
está no máximo a um raio (0,53 m) do eixo dele, e o par de eixos mais apertado
dos três está a 1,254 m, meia distância 0,627 m.

Depois da correção, medido: **Scania 8 conjuntos** (2 avulsos Ø 0,992 + 2 duplos
Ø 1,018) e **VW 6** (1 avulso Ø 1,013 + 2 duplos Ø 1,012).

### 36.3 ⚠️ Por que agrupar por VÉRTICE, e não por malha

Nenhuma das três estruturas de nó é igual:

| | rodagem |
|---|---|
| Volvo VM | um nó por peça POR RODA — 7 nós × 6 rodas |
| Scania P | um nó por peça por roda, pneu repartido em 3 materiais |
| VW Titan | **TODOS os pneus num nó só** (z −2,14 a 5,78) e os aros em dois |

Um agrupador que lesse malha acertaria dois e entregaria uma roda gigante no VW.
Agrupando por (eixo, lado) sobre VÉRTICE, nenhuma estrutura de nó importa — e o
rodado duplo sai como um grupo por construção, sem banda de tolerância entre
pneus geminados.

### 36.4 ⚠️⚠️ O `envMapIntensity` DA BORRACHA — o mesmo erro, a mesma frase

A primeira versão de `tuneVmWheelMaterials()` baixava o ambiente do pneu para
0,30, copiando o que `TRAILER_RUBBER_RE` faz no implemento. O relato voltou como
*"a roda está muito preta, deve ser levemente acinzentada"* — e **a mesma frase
já estava registrada nesta base**, em 2026-08-11, sobre a roda do FH16: *"o pneu
continua muito preto, enquanto o do Volvo é levemente acinzentado"*. O bloco de
`FH16_WHEEL_RE` em `models.ts` traz a conclusão daquele dia por extenso:

> os dois pneus são O MESMO ASSET e a MESMA textura; o que mudava era o
> ambiente, 1,35 no cavalo contra 0,30 no implemento. Num dielétrico o ambiente
> é quase toda a luz que ele recebe, então 4,5× menos ambiente é a diferença
> entre borracha e SILHUETA PRETA.

A regra da borracha do implemento é um remendo para material que MENTE sobre si;
aplicá-la a material certo só estraga. Medido nas duas texturas em luminância
linear, com o mesmo teste do cabeçalho de `bake_wheel.py`:

```
goodyear_fuelmaxlhs_diffuse (VM)    p50 0,0299    ← MAIS CLARA
trail70_colspec (FH16)              p50 0,0212
```

A borracha do VM não é preta por textura; era preta por falta de ambiente.

O que sobra do pedido original — *"os pneus estão brilhando muito"* — é a
RUGOSIDADE: 0,198 no rasto e 0,133 no flanco, com verniz de 0,18 por cima, um
lóbulo apertado devolvendo o céu inteiro. Vai para **0,60 sem verniz**, e o
ambiente fica em 1,35.

O resto do acabamento, medido no rip: porcas `white_crome` com metalicidade
**ZERO** e cubo idem — cromados pelo nome e plástico pelo número, e é o número
que o renderizador lê. Vão para 0,90/0,22 e 0,85/0,28, contra a referência de
aço da própria frota (`steel_clean`, 0,85/0,20), que é o aro e já lia certo.

### 36.5 ⚠️ O DOADOR NÃO SE TROCA

> *"até mesmo o do volvo, que deveria ser a referência, não deveria ter trocado
> ela"* — Kennedy.

A roda vem do próprio Volvo VM. Trocá-la pela cópia dela mesma só acrescenta
risco — uma medida errada de eixo estraga justamente o caminhão que É a
referência — sem mudar um pixel. `WHEEL_DONOR_RE` pula o VM.

### 36.6 O ESTEPE NÃO É RODA DE RODAGEM

O Scania traz um estepe DEITADO sob o chassi, com material de pneu como qualquer
outro; trocá-lo pelo molde o poria de pé no meio do quadro. O que o separa não é
o nome — é que **uma roda de rodagem toca o chão**: o critério é a cota do ponto
mais baixo do grupo contra o raio dele, e um pneu de rodagem fica entre 0 e
52 mm do solo (o tandem do Scania flutua 52 mm no próprio arquivo) contra os
mais de 300 mm do estepe.

> Ele CONTINUA com o aro de fábrica, e agora destoa dos outros — está registrado
> como pendência, não como acerto.

### 36.7 `_v1` desde o primeiro dia

`/studio-assets/v1/` sai da API com `Cache-Control: immutable`. Sobrescrever um
`.glb` publicado prende a versão errada no navegador de quem abriu o estúdio
naquela janela — foi o que aconteceu com `wheel_fh16.glb`, que está QUEIMADO e
por isso o do implemento se chama `_v2`. O da roda dos rígidos nasce `_v1` e
toda bake seguinte ganha o próximo sufixo.

### 36.8 O ESTEPE, e a borracha do doador

Três queixas depois da primeira leva de rodas, e as três são acabamento medido:

**⚠️ O ESTEPE DO SCANIA ESTAVA COM MATERIAL DE COURO DO INTERIOR.**
*"o estepe está metálico"*. A roda guardada usa
`chassis_mat_0015_leather_fine_c_14` — rugosidade **0,098** e verniz de 0,09: um
pneu com acabamento de estofado devolve o céu como cromo. Duas coisas erradas e
as duas medidas: rugosidade para 0,60, e o ALBEDO à metade —
`baseColorFactor` 0,2186 × uma textura de p50 **0,2629** dá **0,0578** em
luminância linear, quase o dobro dos 0,0299 da borracha da frota; 0,1135 linear
põe o produto em 0,0298.

> O `map` FICA (o desenho da banda é dele), e o aro está na MESMA malha e no
> MESMO material — escurece junto, que é o que um estepe é.

**⚠️ O ESTEPE DO VM: só a rugosidade.** *"o estepe do volvo também está
diferente"*. `step_0_mat_0001_tyre_front_109` vem em rugosidade **0,097**,
metade da dos pneus de rodagem. O albedo já estava certo e por isso não se
tocou nele: medido, `tyre_front` tem p50 **0,0360** contra 0,0299 do resto.
O aro (`rim_9inch`) vinha com metalicidade ZERO e foi para 0,85/0,22, a
referência de aço do próprio VM.

**⚠️ E OS PNEUS DE RODAGEM DO VM.** *"os pneus no volvo estão muito
brilhosos"*. Ele é o DOADOR e não passa pela troca (`WHEEL_DONOR_RE`), então
sem uma linha própria seria o único dos três com a borracha antiga — os mesmos
dois materiais que o asset carrega, mas com os números do rip. Recebem em
`cab-bake-fixes.ts` exatamente os mesmos valores que `tuneVmWheelMaterials()`
aplica no asset. **O ambiente continua em 1,35 nos dois lugares.**

### 36.9 ⚠️ O CHÃO DE UM RIP É UM PLANO, E OS EIXOS DELE NÃO CONCORDAM

*"a roda da frente do truck não está tocando o chão"* — e o defeito é do
arquivo, não da troca: a roda velha já flutuava. Medido, o ponto de contato de
cada eixo no espaço cru:

```
VW Titan   dianteiro +0,0776   traseiros −0,0036 e +0,0133   → 81 mm de disparate
Scania P   dianteiros −0,060   traseiros −0,009               → 52 mm
```

Assentar cada roda no PRÓPRIO mínimo perpetuaria isso. O chão do veículo é um
plano só — o mais baixo dos contatos, o mesmo critério de `groundY` em
`mounts.json`, que é o que põe o caminhão no piso do cenário. Cada roda mantém o
SEU diâmetro (0,992 na direção, 1,018 na tração, medidos) e toca esse plano.

> **⚠️ E NÃO É O CENTRO DA CAIXA.** A primeira versão punha o cubo no meio da
> caixa do grupo e o raio novo saía da MÉDIA das duas extensões radiais — com
> uma caixa mais alta que longa isso levanta a roda do chão. O que tem de
> coincidir é o CONTATO; a sobra vai para o topo, que é onde ninguém mede nada.

## 37. 2026-08-21 — a PROTEÇÃO LATERAL do semirreboque nos Scania rígidos

Rodada curta e inteiramente documentada **no cabeçalho de
`engine/vehicle/side-guard.ts`**, que é onde ela precisa ser lida: a peça é
extraída do semirreboque (`tools/chassis-bake/bake-protecao-lateral.cjs` →
`public/models/vehicles/protecao_lateral_v1.glb`) e montada como filha da RAIZ
DO IMPLEMENTO, não do chassi — é assim que ela herda a inclinação da mesa da
longarina, a posição, o comprimento e o acabamento sem uma linha de conversão.

Fica aqui só o que aquele arquivo não tem como dizer, porque não é dele:

> **⚠️ `tsc --noEmit -p tsconfig.json` NÃO CHECA NADA NESTE REPOSITÓRIO.** O
> `tsconfig.json` da raiz tem `"files": []` e só referências, então o comando
> sai com sucesso sem abrir um arquivo sequer. **O comando certo é `npx tsc
> -b`**, e ele acusa 5 erros pré-existentes (fora do estúdio). A confusão
> deixou três `ReferenceError` chegarem ao navegador do dono numa sessão só.

## 38. 2026-08-22 — as onze da foto: o rebite que a porta comia, a grade sem apoio, a fita que nunca era montada

Onze queixas numa leva só, e o que as une não é tema — é **estado que ninguém
mediu**. Sete das onze são coisas que o motor sabia fazer e não fazia: um
conjunto que nasce vazio, uma peça que outro dono reescreve, um manifesto que
não foi regerado depois de um bake novo. O portão desta rodada é
`tools/studio-bench/checks-scania-fix-0822.mjs` — 21 `★`, todos verdes.

### 38.1 ⚠️⚠️ O CONJUNTO REPETIDO NASCIA VAZIO — e a fita do bake ficava no lugar

*"as faixas refletivas também não possuem um espaçamento perfeito entre si"*.

`TrailerAssembly` monta cada conjunto repetido (fita 3M, lanternas laterais,
rebites da ferragem inferior) como um `InstancedMesh` com **`count = 0`** — o
bloco de `buildRepeats()` explica por quê: o three entrega a capacidade inteira
em matriz IDENTIDADE, e uma fileira de fita empilhada na origem aparece como
uma lasca no asfalto. Quem preenche é `set()`. E `set()` só era chamado por
`TrailerRig.set()`, ou seja **pelo primeiro arraste do controle de medida**.

Até lá o conjunto ficava num estado que o motor nunca produz: instâncias vazias
E as cascas de origem ainda de pé. Medido no boot limpo do gancheiro sobre o
Scania P:

```
REPEAT_skirt_14 [Faixa-3M]   count 0   own 0…13   cap 42
REPEAT_skirt_3  [lanternas]  count 0   (×7)
RIVET_LOW_L/R                count 0
fam.count                    1         ← `set()` nunca escreveu
```

e o que a tela mostrava era a fita **do bake**, com os buracos do bake:

```
flanco −x   … 300 | 256 | 300 | 1368 | 300 | 256 …   ← duas peças faltando
os dois     … 300 | 550 …                            ← a peça de canto traseiro
```

Um `set()` manual na mesma sessão devolvia `count 14` e o passo de 556 mm
certinho — ou seja não faltava régua, faltava a chamada.

**O conserto é uma linha, e o argumento é a invariante:** o construtor termina
com `this.set(ref.baseHeight, ref.baseLength)`. Nas medidas de fábrica isso é a
IDENTIDADE para tudo que não é conjunto repetido (`ky = kz = 1`, `dRoof =
dzRear = 0`, cada vértice mapeia em si mesmo); o único efeito é colapsar as
cascas que viraram instância e preencher as instâncias. **O estado de boot passa
a ser o mesmo estado que o motor produz para essas medidas.**

Sobra a peça de canto traseiro, 550 mm em vez de 256 — e ela **é assim no
semirreboque também**, que é o padrão ouro. Não se mexe.

### 38.2 ⚠️ UMA PORTA COMIA UMA COLUNA INTEIRA DE REBITES

*"os rebites aqui não estão corretos, enquanto do outro lado estão"*, com uma
foto de cada flanco.

Medido, os dois flancos são idênticos ao milímetro — 8 emendas nos mesmos z,
50 fileiras nos mesmos y, 400 calotas cada. O que difere entre as duas fotos é
a PORTA lateral. E com ela:

```
sem porta   SIDE_L 400 · SIDE_R 400
com porta   SIDE_L 400 · SIDE_R 350     ← uma coluna inteira a menos
```

`seamHitsDoor()` peneirava EMENDAS, e o argumento escrito nela era "ou a coluna
inteira cai sobre a porta ou nenhum rebite dela encosta nela". Isso é falso: uma
porta de serviço tem 2,29 m de vão e a parede do gancheiro tem 2,78 m, então a
coluna atravessa a porta e sobra parede acima dela.

A regra certa é a que o pedido de 2026-08-12 já dizia — **o que não pode ter
rebite é a PORTA**, não a emenda dela. Um rebite é um ponto e o vão é um
retângulo: `rivetHitsDoor(y, z, holes)`, com a margem da moldura nos quatro
lados. `getDoorHoles()` sempre devolveu `y0/y1`; só ninguém os lia.

### 38.3 ⚠️ A GRADE COM SUPORTE FORA DA BARRA, E 3,7 m SEM APOIO

*"a grade está muito longa, o suporte dela fica flutuando"*.

Dois defeitos na mesma conta (`n = floor(vao/PASSO) + 1`, corrida centrada):

1. **num corrido MENOR que o passo a margem saía NEGATIVA.** O corrido traseiro
   do 6x2 tem 973 mm e o `Math.max(2, …)` forçava duas estações a 1 250 mm:
   `margem = (973 − 1250)/2 = −138,5 mm`. Uma estação 138 mm ANTES do começo da
   barra e outra 138 mm depois do fim dela.
2. **a estação que caía em obstáculo era APAGADA.** No corrido dianteiro de
   4 362 mm sobravam duas, a 3 750 mm uma da outra.

A régua nova é a de um para-ciclista de verdade — **balanço limitado nas duas
pontas e vão nunca maior que o passo** —, e a estação que cai no tanque **anda**
até meio passo em vez de sumir. Medido depois:

```
traseiro   barra −4 177…−3 204   2 estações   vãos 322      balanço 372
dianteiro  barra   −531… 3 831   4 estações   vãos 940/1931/890   balanço 399
```

O vão de 1 931 mm é o tanque mais o ARLA: ali não há onde parafusar, e a barra
passa por cima sem apoio — que é o que o caminhão real faz.

### 38.4 ⚠️⚠️ DOIS DONOS DA MESMA MALHA — o log dizia que encolheu e a tela dizia que não

*"essa placa scania já pedi dezenas de vezes para diminuir seu tamanho, já que
está tocando na grade lateral, e continua grande demais"*.

Três defeitos empilhados, e o terceiro é o que anulava os outros dois.

**(a) O LETREIRO NÃO É A ABA.** `medeChassi()` pede altura > 150 mm para
reconhecer um para-barro; `lameiro_0_p1` — as letras SCANIA em relevo, malha
própria — tem **92**. Então a chapa encolhia e as letras não:

```
aba (a 62 %)          |x| até 1 105 mm
letreiro (intocado)   |x| até 1 205 mm
face interna da grade      1 116 mm     ← o letreiro está DENTRO dela
```

Agora `medeChassi()` devolve as **solidárias**: o que mora inteiro dentro da
caixa da aba e é menor que ela viaja com ela, na mesma âncora e na mesma escala.

**(b) A RÉGUA DE FOLGA ERA A BARRA, E O QUE COLIDE É O SUPORTE.**
`guardInnerX()` media só `BARRA__*` e devolvia 1 206; o conjunto montado ocupa
**1 116…1 251**, porque a ESTAÇÃO entra 90 mm mais para dentro. Passou a medir o
kit inteiro.

**(c) ⚠️⚠️ E `stretchRigidFrame()` DESFAZIA TUDO, a cada `placeTrailer()`.**
Este é o achado da rodada e vale o parágrafo inteiro. O laço do rabo escreve
`base → mundo → base` para todo vértice atrás do plano de corte **sem `if`** —
inclusive quando o deslocamento é zero. É o que o torna idempotente, e é também
o que apaga qualquer outra reforma nos MESMOS vértices. A aba mora em z −7 153
contra um corte em −7 005: ela é rabo.

O rastro medido, com o console a par:

```
[grade] aba lameiro_0_p0 a 61 % — meia-largura de 1230 para 1104
[DEBUG]  logo após escrever: 1104
[DEBUG]  fim de placeTrailer:  1104
[quadro] … 19 malhas …
[DEBUG]  fim de placeTrailer:  1230      ← restaurada da base pristina do rabo
```

O log afirmava o conserto e a tela mostrava o defeito — o pior par possível, e
a razão de "dezenas de vezes".

**A regra que sai disto: quem reformar uma peça que o rabo cobre tem de reformar
a base do rabo junto.** Não é composição de transformações no tempo (isso
acumularia): é um dono escrevendo no snapshot do outro, uma vez, com o mesmo
mapa que ele acabou de aplicar aos vértices vivos. `chassis-tail.ts` passou a
exportar `tailBaseFor()` para isso, e `chassis-parts.ts` guarda uma cópia
pristina DAQUELA base (`tsAbaTailBase`) para que um segundo encolhimento não
componha sobre o primeiro.

### 38.5 A PLACA TRASEIRA DO RÍGIDO — e as três derivadas sem placa nenhuma

*"a placa traseira precisa ser substituída pela nossa"*.

Duas coisas, e a primeira era invisível: **`plates.json` não tinha sítio para
`scania_p_6x2r`, `_4x2r` nem `_6x4r`.** O manifesto foi gerado em 2026-08-20 e
as três derivadas nasceram em 21/08, então elas rodavam SEM PLACA DIANTEIRA, com
o aviso `[placa] sem sítio para …` no console. `tools/placa/probe.mjs` regerado.

⚠️ E as três entraram em `AUTORADOS`, com a altura do bitruck: medidas soltas
elas caem em 0,450 contra os 0,420 do 8x2, não porque a chapa mudou (o recorte
de `cut-scania.cjs` só REMOVE eixo) mas porque o que o 2º direcional ocupava no
z-buffer some e a banda contínua sobe. Trinta milímetros de diferença na MESMA
peça é o que um manifesto tem de não deixar acontecer.

A de trás é nova: `attachRigidRearPlate()`. Num cavalo mecânico a traseira é do
IMPLEMENTO e já tem placa; num rígido a carroceria é aparafusada e a placa é do
CHASSI. O sítio **não vai para o manifesto** — a sonda rasteriza a DIANTEIRA, e
a traseira de um rígido não é um para-choque plano. A régua é outra e é
auto-adaptativa: **a placa nova vai exatamente onde a de fábrica está, e a de
fábrica some no mesmo ato.** Sem placa de fábrica (o Volvo VM não tem), o sítio
sai da LUZ DE PLACA, que por norma ilumina a placa a menos de 100 mm dela.

> **⚠️ E ELA É MONTADA ANTES DO PRIMEIRO `placeTrailer()`.** Montada depois,
> nascia já no lugar que `stretchRigidFrame()` produziu e levava o deslocamento
> OUTRA VEZ na passada seguinte — medido, **740 mm à frente do porta-placa**.
> Montada antes, ela é só mais uma peça do rabo e acompanha por construção. É a
> mesma armadilha de §38.4, vista do outro lado.

### 38.6 O PRETO DO SCANIA — uma régua de FROTA, medida no padrão ouro

*"tem algumas partes do scania que estão extremamente pretas, mas não costuma
ser tão preta, costumam ter um leve acinzentado"*.

Irmã de `normalizeExteriorGlass()`, e pela mesma razão: o defeito não é de uma
peça, é da PROCEDÊNCIA do rip. Censo dos 51 `.glb`, material OPACO SEM TEXTURA
abaixo de 0,03 de luminância linear:

```
scania_p_{4,6,6,8}x…r    41 materiais cada
volvo_vm_2015_6x2r       14
vw_titan_6x2_tl           4
os 46 cavalos aprovados   0 a 4 — e sempre para-sol, espelho ou painel
```

Medido no Scania: `cabin_mat_0001_pretobrilhoso_1` **106,8 m² em 0,0071**,
`parachoque_0_mat_0002_plastic_hard` em **0,0001**, os espelhos em **0,0002**.

> **⚠️ 0,0001 NÃO É UMA MEDIDA DE NADA.** Nenhum material real devolve um décimo
> de milésimo da luz que recebe: o carvão fica em 0,02 e o veludo preto, que é o
> piso do mundo físico, em 0,01. Fator zerado é o exportador escrevendo "aqui ia
> uma textura".

A régua saiu do FH16, que é bake da SCS e é a referência da frota — e lá o preto
externo não está no fator, está no ATLAS. Medido em luminância linear sobre os
`.webp` extraídos do próprio `.glb`:

```
cabin_mat_0000_plastic_base   48,8 m²   textura p50 0,0331 × fator 0,873 = 0,0289
cabin_mat_0009_chassis_base   47,5 m²   textura p50 0,0319 × fator 1,000 = 0,0319
```

Os dois maiores materiais externos do caminhão de referência, os dois em
**0,029…0,032 linear** — que em sRGB de 8 bits é `#32`, o "leve acinzentado" do
relato. `normalizeBlackPlastic()` é um PISO nesse valor, e um piso é idempotente
e seguro para o acervo: quem já está acima não é tocado, o que inclui os 46
cavalos aprovados.

⚠️ Fica de fora, e cada exclusão tem motivo medido: quem tem TEXTURA (a cor mora
no mapa), quem é TRANSPARENTE (vidro tem dono), **METAL** (`baseColor` de um
metal é o F0 — levantá-lo transforma cromo escuro em alumínio), **TELA
DESLIGADA** (`*_screen_off` em 0,0109 é preto de propósito) e a **RODA** (régua
própria em `truck-wheels.ts`, e a rodagem destes três é trocada).

### 38.7 O TRILHO DE TOPO: o furo some, o rebite volta — e a receita é medida

*"esse frame metálico superior ainda mostra os furos dos rebites, mas não mostra
os rebites em si, e deveria, mas deveria ser in runtime já que deve seguir de
acordo com o tamanho do baú"*.

`dressTopRail()` (§33.7) fecha os rebaixos modelados; faltava a outra metade. E
a informação de ONDE cada rebite ia **morre quando o rebaixo fecha** — os
vértices ficam coplanares com a face e indistinguíveis dela. Então ela é medida
ali, antes, e guardada como RECEITA (não como posições, que o resize invalida):

```
fileira    y 2 958,0 mm — 10,0 mm acima do pé do trilho (2 948,0)
passo      102 mm — 84 furos por flanco em 8,38 m
Ø do furo  4,6 mm → cabeça de rebite pop de ~9 mm
```

`addTopRailRivets()` a reproduz no comprimento corrente, ancorada na DIANTEIRA
(esticar acrescenta rebite atrás e não desloca os que já existem), em geometria
FUNDIDA e com material próprio — as duas decisões de `addPlateRivets()`, pelos
mesmos motivos.

> **⚠️ ELA NÃO INVENTA REBITE.** Sem receita na raiz — ou seja, num bake cujo
> trilho não trazia rebaixo — devolve 0 e não cria nada. O semirreboque é
> exatamente esse caso: o trilho dele tem 412 triângulos e é LISO, e é o padrão
> aprovado. O portão confere isso.

### 38.8 O TUBO E A FIAÇÃO DO THERMO KING

*"preciso que termine esse tubo e fiação do thermo king que deve ir do thermo
king até embaixo do implemento"*.

O asset já traz quatro linhas descendo da carcaça — duas mangueiras e dois
eletrodutos — e as quatro **param em y ≈ 0**, o pé da caixa da unidade:

```
x  332…606   y 0…504   z 154…172     mangueira
x  362…629   y 5…502   z 154…172     mangueira
x −414…−395  y 51…406  z 154…161     eletroduto
x −426…−407  y 52…406  z 154…161     eletroduto
```

`routeThermoKingLines()` acha cada ponta por COMPONENTE CONEXA (as quatro moram
num material só, junto com o painel de comando e as grades), mede a SEÇÃO dela
nos 25 mm finais e desce um `TubeGeometry` sobre uma Catmull-Rom em quatro
pontos: um palmo abaixo já encostando na parede, rente ao piso ainda na parede,
e dobrada para dentro abaixo do assoalho. Nada aqui é cota do Scania nem do
gancheiro — a ponta sai da própria linha, a parede da caixa do corpo branco e o
piso do perfil do baú.

⚠️ Geometria NOVA neste arquivo, que é o de correção de bake, e a exceção segue
o argumento de `chassis-parts.ts`: o que falta o veículo real tem, e não dá para
assar no `.glb` porque o percurso depende do BAÚ — e `/studio-assets/v1/` é
imutável por contrato de cache.

### 38.9 O TETO ENTROU NO LIVERY, E O FRAME COM ELE

*"a visão superior possui um frame metálico, mas não aparece no livery do
teto"*.

O card do teto era a janela sintética de `roofWindow()` — uma chapa branca lisa.
O comentário que explicava isso dizia que o teto "não tem como ser fotografado
porque é malha do corpo paramétrico e não chapa recortada", e **isso não era
verdade**: o que `snapFace()` pede de um painel é uma CAIXA e uma MATRIZ, e a
malha do teto tem as duas. O que faltava era a base de câmera de uma face
HORIZONTAL.

`addLiveryUV()` já fixava o quadro: `u = (z − minZ)/spanZ` e `v = (max.x −
x)/spanX`, ou seja o comprimento em +Z e o "para cima da tela" em +X. A base sai
daí sem escolha nenhuma — `out = u × up = (0,0,1) × (1,0,0) = (0,1,0)`, a lente
apontando para baixo.

⚠️ **A segunda dimensão de uma face é a que não é `u` nem a normal.** Em pé isso
é o y; deitado é o x. Medir a "altura" do teto no y dele daria **2 mm** e a foto
sairia numa tira de dois pixels.

⚠️ **E as margens do teto não são "para baixo", são PARA OS LADOS** — é o que
traz o frame para dentro do quadro. A chapa vai a |x| 1 245 e o trilho ocupa
1 245…1 310; 80 mm de margem mostram o frame inteiro e param 15 mm depois dele.
Razão de aspecto do retrato: **3,22** contra 3,38 da chapa nua.

### 38.10 "SÓ O IMPLEMENTO" NÃO EXISTE PARA UM SOBRECHASSI

*"nas configurações não faz sentido nesse caso ter apenas o implemento, ou ele
ficaria flutuando"* — e é literal. Um semirreboque fica de pé sozinho (tem
patola e bogie, e `vehicle/landing-gear.ts` existe para descer as pernas 301 mm
quando o cavalo sai); um sobrechassi é aparafusado na mesa da longarina e sem o
caminhão paira a 1 037 mm do chão. Pior: a proteção lateral é filha do
implemento e flutua junto.

O gate mora em `setVehicleView()` **e** em `applyVehicleView()`, não só no card:
a vista sobrevive à troca de veículo, então quem estava em "só o implemento" com
um semirreboque e escolhe um rígido entraria flutuando sem ter clicado em nada.
No card a opção fica DESABILITADA com o motivo no `title`, e não some — um
controle que muda de tamanho conforme o veículo faz o usuário procurar o botão.

### 38.11 A CHAPA DA ANKAA: a terceira volta, e o meio-termo é a resposta

*"a chapa com a logo da empresa continua com uma textura diferente da esperada,
inox, igual as partes metálicas ao redor dela"* — terceira vez.

A §33.5 deu a ela o `inox-ferragem__polido` do implemento (m1 · r0,30) e a §33.9
registrou que quem a emoldura NÃO é inox. Registrar não era a resposta: o pedido
é de IGUALDADE com o metal em volta. Medidos os quatro candidatos estruturais a
menos de 0,6 m do sítio:

```
metal-estrutura-principal-padrao   m1 · r1,00   longarina — FOSCA
metal-pouco-polido                 m1 · r1,00   idem
metal-galvanizado-mantido          m1 · r0,62   SATINADA  ← escovado
inox-ferragem__polido              m1 · r0,30   ESPELHO
```

Os dois extremos já foram tentados e os dois falham pelo mesmo motivo, invertido:
sob a carroceria não há luz para espalhar, então **fosco lê como chapa preta e o
logotipo some**, e **espelho plano virado para trás reflete a sombra do próprio
veículo, e sombra não tem textura**. Uma placa de identificação é AÇO INOX
ESCOVADO, e escovado é uma FAIXA de rugosidade. A busca passou a preferir o
satinado (0,35…0,75) e só cai na distância pura quando não há nenhum por perto.

### 38.12 O que ficou medido, e como reproduzir

```
node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
     --checks checks-scania-fix-0822.mjs
```

21 portões, todos verdes, incluindo três de REGRESSÃO no semirreboque (§38.1
mudou o boot dos dois implementos): 10 de 10 conjuntos repetidos com instância,
630 rebites de emenda, e o trilho liso dele **sem** rebite gerado.

As sondas da investigação, que é o que fica: `checks-scania-0822.mjs` (o censo
de onze frentes), `checks-scania2-0822.mjs` (a fita segmento a segmento e a
porta) e `checks-scania3-0822.mjs` (as tripas do `TrailerAssembly` — foi ela que
mostrou `fam.count = 1` e fechou §38.1).

### 38.13 Em aberto

* **a peça de canto traseiro da fita 3M** deixa 550 mm de vão contra os 256 do
  passo. É assim no semirreboque também — é o bake, não a régua — e mexer nisso
  é decisão de produto, não conserto.
* **um vão de porta de 2,29 m numa parede de 2,78** deixa 7 rebites de 50 na
  coluna dela. Está certo (há uma porta ali), mas se o dono quiser a coluna
  cheia, o caminho é a porta ser mais baixa, não o rebite atravessar a folha.
* **o balanço da grade sai 399 mm** contra os 300 declarados: a caixa medida
  inclui a tampa de ponta, que fica 44 mm além do fim da barra, e a barra começa
  77 mm depois do datum do asset. É medida contra medida, não folga a mais.
* **`RAIL_HEIGHT` em `trailer-bake-fixes.ts` não é lida por ninguém** — um dos 5
  erros que `npx tsc -b` acusa, e o único deles dentro do estúdio.

## 39. 2026-08-22 (2ª leva) — o que sobreviveu ao conserto, e o tracinho que ainda não caiu

Sete queixas novas sobre a mesma rodada. Seis fecharam com portão; a sétima —
o tracinho do trilho de topo — **continua aberta**, e o que esta seção deixa é
a LISTA DE ELIMINAÇÃO, que vale mais que um palpite.

Portão: `tools/studio-bench/checks-scania-fix2-0822.mjs`, 12 `★`, todos verdes,
com um de REGRESSÃO no semirreboque.

### 39.1 ⚠️⚠️ O TRACINHO DO TRILHO — quatro metades consertadas, e ele fica

Ver o bloco **1.5** de `dressTopRail()` em `trailer-bake-fixes.ts`: ele carrega
a lista inteira e é onde o próximo trabalho começa. Em resumo, o que foi
consertado e MEDIDO nesta rodada:

* **profundidade** — um pico só, 6,0 mm: o rebaixo está no plano da chapa;
* **normais** — a peneira `cos > 0,9` saiu (deixava 25° passar num ESPELHO);
  16 356 vértices no plano da face, todos com cosseno **1,00000**;
* **UV** — o material tem `roughnessMap`, e o rebaixo era uma ILHA de UV. Agora
  ele recebe o CAMPO AFIM da própria chapa, ajustado por mínimos quadrados nos
  cantos. Foi a hipótese mais promissora e não bastou;
* **z-fighting** — afundar o rebaixo 0,4 mm atrás da face não mudou nada, o que
  prova que ele é FURO e o fundo o preenche sem sobreposição.

E o que a bancada eliminou, cada um com quadro guardado:

```
q9-2  fusão SOLTA + as 6 peças escondidas ...... faixa LIMPA
q9-1  fusão SOLTA, tudo visível ................ tracinho
q6-a1 material BÁSICO (sem luz, sem normal) .... LIMPA
q6-a3 difuso puro (metal 0, rugosidade 1) ...... LIMPA
q8-3  sem `roughnessMap` ....................... tracinho, mais fraco
q8-2  sem o filete ............................. tracinho
q8-1  sem os rebites gerados ................... tracinho
```

⇒ é das próprias `estrutura-principal-90…95`, é **especular** (só existe com
metalicidade 1) e não é nenhuma das quatro metades acima. Foi tentado e
REVERTIDO baixar o brilho do perfil para os 0,62 do semirreboque: o tracinho
sobrevive, e escurecer peça aprovada sem consertar o defeito é troca ruim.

> **O próximo passo é bissecção POR FAIXA DE TRIÂNGULO**, com a fusão solta,
> dentro de uma malha de 3 004 triângulos. O afordance já existe:
> `window.__studio.merge.release()`.

### 39.2 A CHAPA DA ANKAA — o material, provado por quatro renders

*"ainda está fosca / cinza"*, terceira vez. O experimento
(`checks-scania6-0822.mjs`) separou material de geometria:

```
(a) como está ................................. cinza fosco
(b) inox m1/r0,28/env1,6, normais REFEITAS .... inox
(c) inox m1/r0,28/env1,6, normais ORIGINAIS ... inox   (igual a b)
(d) material de hoje, normais REFEITAS ........ cinza   (igual a a)
```

(b) ≡ (c) e (a) ≡ (d): **a normal não decide nada, o material decide tudo.**
Uma chapa PLANA na sombra da carroceria não tem curvatura para varrer o
ambiente — ela devolve uma direção só. A chapa passou a ter INSTÂNCIA PRÓPRIA,
clonada da família estrutural mais próxima (herda o cubemap, o acabamento e a
molhagem) com `roughness 0,28` e `envMapIntensity 1,6`.

### 39.3 O TETO NÃO TEM EMENDA DE CHAPA

*"por que tem rebites no teto no livery?"* — `plateLayers()` peneirava por
`isEndFace()`, que cobre só `rear` e `front`. O teto caía no desenho das
laterais e ganhava as oito colunas de emenda com os rebites. Um teto de baú
frigorífico é capa ÚNICA; o 3D sempre soube (`buildLiveryPanels` nem chama
`addPlateRivets()` lá) e era o 2D que inventava.

### 39.4 O CORTE DO RETRATO — `M_TOP` virou MEDIDA

*"está cortando mais do que deveria no topo"*. `M_TOP` era 1 cm fixo, que é a
medida do PADRÃO OURO virada constante:

```
semirreboque   coroa acima da chapa =  5,1 mm
sobrechassi    coroa acima da chapa = 72,1 mm
```

Agora ela é medida por vértice na pegada do flanco (`coroaAcimaDaChapa`), com
piso no 1 cm antigo — o semirreboque não muda, medido — e teto de 12 cm.

E **a janela publicada deixou de mentir**: era `{x:0,y:0,w:1,h:1}` ("a chapa é a
foto inteira"), e a foto tem margens por construção. Agora é `snap.box`, que é
"onde a chapa cai dentro do fundo" medido pela MESMA câmera, com `exata: true`
para `canvasRect()` não corrigir por cima de uma medida.

### 39.5 O TUBO DO THERMO KING — nasce na carcaça e ganha braçadeiras

*"não está conectado corretamente"* + *"nem estão indo até embaixo"* + *"a outra
fiação precisa de seguradores"*. Três consertos:

* o percurso nasce na **barriga da carcaça**, não na ponta do coto (os cotos do
  asset descem 534 mm antes de acabar, e o vão entre a carcaça branca e o começo
  deles lê como "não chega");
* ele desce **na vertical do próprio bocal**. Antes mergulhava para dentro a
  partir de `piso + 220` perseguindo a CAIXA do corpo branco (4 252) em vez da
  PELE (4 194): de meia altura para baixo o tubo passava a ser desenhado DENTRO
  do baú e sumia. Só dobra para dentro DEPOIS do piso;
* **braçadeiras a cada 600 mm** no trecho reto.

### 39.6 A BARRA DO PARA-BARRO — dois braços, tubulares, medidos

*"encurte e corrija; está muito quadrada e atravessando uma parte do chassi"*.
Era um bloco de ponta a ponta (2 480 mm) que cruzava SEIS malhas de chassi.
Agora são **dois braços**, um por lobo, tubo de Ø 44 mm, e cada um NASCE no |x|
em que a estrutura do caminhão acaba dentro da faixa de y e z dele — medido, não
arbitrado. Eles entram como SOLIDÁRIOS da aba, então encolhem com ela e escrevem
na base pristina do rabo (§38.4); o laço `kb` antigo, que escalava sobre x = 0,
saiu.

### 39.7 Em aberto

* **o tracinho do trilho** — §39.1, com a lista de eliminação;
* **a arte da TRASEIRA lê mais lavada que a da LATERAL** (relato de 2026-08-22,
  com print do 137 Pescados). NÃO INVESTIGADA. O material da sobreposição é o
  MESMO nas cinco faces (`makeLiveryOverlay`: `metalness 0,1`, `roughness 0,55`,
  `transparent`), então a diferença não está nele — a primeira medida a fazer é
  amostrar o MESMO pixel de arte nas duas faces sob a mesma luz e comparar, e
  olhar `envMapIntensity` e o cubemap que cada face recebeu de
  `refreshVehicleReflection()`.

---

## 40. A 3ª leva do Scania P — o que quatro rodadas de conserto não viram

Portão: `node tools/studio-bench/bench.mjs --gpu --geometry --verbose --checks
checks-scania-fix3-0822.mjs` → **12 ★, todos verdes**, com o portão da 2ª leva
(`checks-scania-fix2-0822.mjs`, 12 ★) rodado atrás sem regressão. `npx tsc -b`
limpo.

Quatro relatos, e os quatro tinham a mesma forma de erro: **uma medida certa
lida no referencial errado**. É a terceira vez neste arquivo (§38.4 do rabo do
chassi, §39 do `M_TOP`), e já dá para escrever a regra: *quem guarda uma medida
para outra função reproduzir guarda o VALOR RESOLVIDO, nunca os dois termos de
uma subtração* — porque a outra função vai reconstruí-la a partir da caixa que
ela tem à mão, e essa nunca é a mesma.

### 40.1 O tracinho do trilho — a quinta tentativa não consertou, APAGOU

Quatro rodadas mexeram no rebaixo do rebite e ele ficou: profundidade (um pico
só, 6,0 mm), normais (16 356 vértices em cos 1,00000), UV (campo afim da chapa
por mínimos quadrados), z-fighting (afundar 0,4 mm não muda pixel). A lista
inteira está no bloco 1.5 de `dressTopRail()` e vale como registro do que NÃO
adianta.

O que faltava era não desenhar. **Todo triângulo cujos três vértices caem dentro
de algum rebaixo sai do índice** — cirurgia só de índice, nenhum vértice se
move, nenhum atributo muda de tamanho, a caixa envolvente não se altera.
Medido: **14 784 triângulos** em 6 das 12 peças. As fotos de antes e depois no
mesmo enquadramento (`shots/ANTES-cirurgia-trilho.png` × `q7-0-como-esta.png`)
mostram a linha tracejada sumir.

**E isto SÓ é seguro porque o rebaixo é um APLIQUE, não uma abertura** — e essa
era a medida que já estava na mesa sem ser lida: afundar o fundo 0,4 mm não
mudou pixel nenhum na rodada anterior. Se fosse furo, afundar teria aberto uma
cova. Como é aplique sobre chapa cheia, o que está atrás dele é chapa.

### 40.2 O rebite: PASSO E MARGEM, não a lista de furos

> *"vou cravar o rebite em cima de cada furo: isso não adianta, desde que siga
> até mesmo quando o tamanho do frame metálico mudar"*

Guardar a fração de cada furo faz a fileira acompanhar o esticamento — mas
acompanha ESTICANDO: 84 rebites num baú de 6,9 m dão passo de 82 mm e num de
9,9 m dão 118 mm. **Rebite não estica; quem estica é a chapa, e um baú mais
longo leva MAIS rebites.** Com os furos apagados nada precisa mais ser casado,
então a receita virou `passo` (mediana dos vãos, não média — um furo perdido
pela peneira dobra um vão e leva a média junto) e `margem` (a média das duas
folgas de ponta). Medido: **136 rebites a 6 880 mm · 165 a 8 380 · 194 a
9 880**, passo real 102,4/102,6/102,8 contra 102,4 medido.

### 40.3 …e ele estava FLUTUANDO 10 mm fora da chapa

> *"e agora o frame superior tem uma linha seguindo os rebites"*

`addTopRailRivets()` remontava o x da calota por `fora − face`, e os dois termos
vinham de referenciais diferentes: `face` foi medida contra a caixa DE UMA PEÇA
do trilho, e `fora` era a caixa UNIDA do flanco, que engorda com o filete e com
o que mais encoste no perfil. Medido: calota em |x| 1 306,6…1 308,8 contra a
chapa em 1 296,5.

Conserto: guardar o **x absoluto da chapa**, e obtê-lo pela **moda do x dos
vértices da peça** em caixas de meio milímetro — 2 918 votos contra 28 no
segundo lugar. A moda não tem como errar porque não depende de nenhum outro
termo. ⚠️ E ela revelou de brinde que **o bake é assimétrico**: a chapa do
flanco −x está em 1 296,5 e a do +x em 1 304,5. Reconstruir por subtração dava
certo num lado e errado no outro, que é o pior jeito de um erro se esconder.

A cota da fileira mudou pelo mesmo motivo: era `fy`, uma FRAÇÃO da altura, e
virou `queda`, a distância RÍGIDA do topo do perfil até a fileira (93 mm). O
perfil não muda de seção quando o baú cresce; só sobe.

### 40.4 O filete era um espelho de 8 metros

Esconder as duas malhas `FILETE_` mudava **zero pixel** — e isso não quer dizer
que ele não apareça: quer dizer que quem o desenha é o BALDE (§23). Com
`S.merge.release()` antes, esconder o filete muda uma faixa de **4 px de altura
por 1 152 de largura**. É ele.

A causa é forma somada a acabamento: uma `BoxGeometry` de face PLANA, 8 mm de
altura por 8,4 m, virada para fora, no material do trilho — metalicidade 1,
rugosidade 0,30. Um espelho plano daquele tamanho devolve a mesma coisa em toda
a extensão. Redondo foi tentado e é PIOR (medido no mesmo pixel: 179/146/173
contra 93/123/155 — a curva sempre acha um ângulo que aponta para o céu). Fica
a face plana, que é a forma que o pedido de §33.7 descreve, com 2×6 mm em vez
de 3×8 e **uma cópia do material com +0,25 de rugosidade**. Depois: 93/93/94,
contra 89-90 do trilho ao lado.

A mesma medida vale para a cabeça do rebite, e pelo mesmo motivo — mais a
FLECHA: uma calota de Ø 11 com 2,2 mm sobe 22 %, a normal do topo abre uns 45°,
e num material de metalicidade 1 ela reflete o CÉU enquanto a chapa reflete o
pátio. A 8 m o passo de 102 mm cai em sete pixels e uma fileira de pontos
sub-pixel de altíssimo contraste **não lê como pontos, lê como linha**. Ø 9,4
com 0,9 mm (flecha de 9,5 %, normal a 21°) aparece pelo relevo.

### 40.5 A grade: o que acaba antes do baú é o CONJUNTO

> *"essa grade lateral metálica está indo muito para trás, ela deve acabar
> antes do baú"*

`MARGEM_TRAS` recuava o DATUM do corrido 60 mm da parede, e a conta parecia
fechar (trecho em −4 199 contra baú em −4 259). Atrás do datum ainda moram a
tampa de ponta e o corpo dela: o conjunto ia a **−4 295, 36 mm ATRÁS da
parede**. O recuo da tampa passou a entrar na conta do começo do corrido, e ele
é **medido no asset** (118 mm) em vez de constante. Agora: grade em −4 179,
**80 mm de folga**.

### 40.6 A arte da traseira: o material era o mesmo, e o problema era esse

> *"a logo que coloquei na traseira parece muito mais lavada, opaca e
> esbranquiçada que a da lateral"* · *"a traseira ainda está mais opaca que a
> lateral, continuo esperando por essa atualização"*

A leitura de código dizia "a sobreposição é o mesmo material nas cinco faces,
então não é ele" — certa e irrelevante. As cinco eram iguais ENTRE SI e
diferentes DA CHAPA que vestem:

| | metalness | roughness | envMapIntensity |
|---|---|---|---|
| chapa | 0,05 | **1,00** | 1,35 |
| sobreposição | 0,10 | **0,55** | 1,00 |

Rugosidade 0,55 num dielétrico é um espelho borrado: soma ao pigmento um
reflexo do ambiente que **cresce com o ângulo de visada** (Fresnel). De frente
quase não aparece; de esguelha vira véu branco. É exatamente a diferença entre
as duas fotos do dono — a lateral ele olha quase de frente, a traseira de
canto. A chapa em volta não denuncia porque ela é rugosidade 1: não tem véu
para somar. E a direcional de sombra da cena está em x −200, ou seja bate quase
de frente num flanco e de raspão na traseira, onde o difuso é fraco e o véu
domina.

A sobreposição passa a **herdar o acabamento da chapa**. Medido com o mesmo
pigmento nas duas faces, de frente e a 55°:

```
             saturação    0°      55°
antigo   SIDE_R          0,539   0,664
         REAR            0,694   0,590
novo     SIDE_R          0,730   0,701
         REAR            0,805   0,772
```

**+35 % de saturação na lateral e a leitura estável com o ângulo** (Δ ≤ 0,033
contra 0,125 do antigo). ⚠️ As calotas de rebite herdam o acabamento DA CHAPA,
não o do hospedeiro delas: a arte corre por cima das cabeças (2026-08-12) e ali
o hospedeiro é metal polido — copiar o dele faria a mesma logo brilhar no
rebite e não brilhar na chapa.

### 40.7 Armadilhas da bancada que custaram três rodadas de foto

- **`controls.update()` gruda a câmera na `minDistance` do orbit.** Toda foto
  "de 0,4 m" saía de ~4 m, e aí uma calota de 11 mm cai em meio pixel e vira
  fita. Foto de perto afrouxa `minDistance`/`maxDistance` e devolve depois.
- **E o `camera.near` corta a parede inteira.** A 0,4 m o quadro mostrava o
  INTERIOR do baú (os ganchos) e parecia que os rebites tinham virado pinos.
  Mexe-se nos dois limites, não em um.
- **Ampliar um recorte de 40 px em 10× por vizinho mais próximo mente.** Duas
  imagens que diferiam em 125 pixels pareciam "com fita" e "sem fita". O que
  decide é `ImageChops.difference().getbbox()`, não o olho no zoom.


---

## 41. 2026-08-22 (4ª leva) — o TANQUE do VM no Scania P, o estepe e o letreiro preto

Três pedidos, o mesmo caminhão, e os três com a mesma forma: **uma peça do rip
do Scania P é pior que a peça equivalente de outro rip do acervo**, e a saída é
transplantar em vez de consertar.

> *"troque os tanques de gasolina do modelo do Scania p360 pelo VOlvo VM que é
> melhor desenhado, mas faça com que ele seja de inox, e também remova o texto
> Volvo dele"*
> *"troque o estepe do scania para usar uma roda / pneu da própria lateral,
> pois o estepe está muito diferente"*
> *"atualize esse adesivo da scania, para ser da cor dos cavalos basculantes,
> um cinza claro"*

Portão: `tools/studio-bench/checks-tanque-estepe-0822.mjs` — **20 ★ verdes**.

### 41.1 O tanque: um asset novo, e três armadilhas medidas

`tools/tank-bake/bake_tank_vm.py` → `public/models/vehicles/tank_vm_v1.glb`
(675 kB, dois nós `TANK_R`/`TANK_L`), consumido por
`engine/vehicle/truck-tanks.ts`. É o terceiro asset desta família, depois de
`wheel_fh16_v2.glb` e `wheel_vm_v1.glb`, e segue o mesmo contrato: **o asset só
carrega geometria normalizada e nome de material; o acabamento e a colocação
moram no motor.**

O que o Scania tinha: um cilindro de revolução liso com duas cintas
(`tanques_0_p3`, `crome`, 0,683 × 0,702 × 0,986 m). O que o VM tem: seção
retangular arredondada, nervura, tampa de enchimento, respiro e cintas com braço
de fixação.

**⚠️ O TEXTO "VOLVO" NÃO ESTÁ EM TEXTURA — é relevo.** O mapa de normais da
casca (`plastic_n`, 512²) é só pedra batida. O letreiro são **101 partes soltas
por lado, 1 685 vértices, numa faixa de 53 mm de altura**, pousadas sobre a
casca (a face de trás delas coincide com a superfície). Apagar as partes não
abre buraco. O critério do bake é por forma e sítio — nenhuma dimensão acima de
120 mm e a menos de 50 mm da face externa —, e o script **aborta** se deixar de
casar exatamente 101 partes ou se a faixa passar de 80 mm de altura.

**⚠️ O TANQUE DO VM VEM EMPINADO NO RIP, 1,86° de um lado e 1,34° do outro.**
Não é o caminhão inclinado: as seis rodas do VM tocam y 0,000. É a peça. Ela foi
transplantada tal e qual na primeira rodada e a queixa voltou em quinze minutos
(*"o tanque de gasolina ficou muito inclinado"*). O nivelamento é feito **no
bake**, antes do datum, girando em torno do eixo lateral até a linha entre os
centros de seção das duas TAMPAS ficar horizontal — e não pela pele de cima, que
carrega a tampa de enchimento e faria o ajuste seguir o bico. Residual medido:
0,12° e 0,08°. Não pode ser corrigido no motor: lá a colocação é **translação
pura**, e é isso que elimina o sinal em que se erra.

**⚠️ O TANQUE É ENCOLHIDO EM z, DE PROPÓSITO.** O do VM tem 1,344 m e o buraco
do Scania 1,008 — 336 mm de sobra. Escala uniforme deixaria a seção em 0,54 ×
0,49 contra 0,68 × 0,70 (tanque de caminhonete num bitruck). 1:1 crescendo para
trás **não cabe**: os dois reservatórios de ar do flanco esquerdo começam em
z 2,275 e o tanque acaba em 2,265 — **10 mm de vão** —, e para a frente há
tubulação cruzando em 1,175…1,375. Então a seção sai 1:1 e só o comprimento é
ajustado, com **o mesmo fator nos dois lados** (0,750). O preço, dito por
inteiro: a tampa de enchimento vira uma elipse de 67 mm vista de cima. O ganho:
o tanque novo ocupa exatamente o envelope do velho, e ARLA, reservatório de ar,
estepe e as quebras do corrido da proteção lateral não precisam saber de nada —
`truckObstacles()` relê a malha visível e reencontra tudo onde estava.

O INOX: **num metal a cor-base é a refletância.** O rip entrega a casca em
metalicidade 0 / rugosidade 0,196 / base 0,1033 linear (plástico cinza). Subir
só a metalicidade daria um tanque de CHUMBO, mais escuro que o plástico de que
se partiu. O par é 0,90 / 0,25 com base **0,56 linear** (aço/inox polido). E o
mapa de normais fica, mas em **25 % de força**: num metal de rugosidade 0,25
cada grão de pedra vira ponto de brilho, e o tanque inteiro cintilaria como
purpurina.

**⚠️ E O EXPORTADOR MENTE SOBRE O NOME.** Blender escreve o nome do OBJETO no nó
e o do DADO DE MALHA na malha glTF, e o `GLTFLoader` batiza os `Mesh` pelo
segundo: o asset saiu com malhas chamadas `tanque_0_p2.001`, ou seja o tanque
NOVO respondia ao mesmo `^tanques?_\d+_p\d+$` com que o motor acha o VELHO. Hoje
isso só confundiria um portão; no dia em que a troca rodar duas vezes sobre a
mesma cabine, ela esconderia o próprio tanque que acabou de pendurar. O bake
agora batiza os dois.

### 41.2 O estepe: recorte por COMPONENTE CONEXO, não por malha nem por caixa

`swapSpareWheel()`, em `truck-wheels.ts`. Foi a troca da rodagem (§36) que criou
a queixa: com as seis rodas virando alumínio do VM, o estepe passou a ser a
única roda de aço chapado preto do caminhão.

Ele **não** cai em `swapTruckWheels()`, e não por descuido: aquela função exclui
o estepe de propósito (uma roda de rodagem toca o chão) e procura sob
`^wheel_[fr]_`, e o estepe do Scania mora dentro de `chassis_*`, deitado sob o
quadro, com o material de COURO DO INTERIOR.

**Esconder não é `visible = false`.** Medido, ele está repartido em quatro
malhas e três atravessam o caminhão inteiro:

| malha | do estepe | da malha |
|---|---|---|
| `chassis_p23` | 14 628 faces | 14 628 (é o pneu inteiro) |
| `chassis_p18` | 50 418 | 80 719 |
| `chassis_p15` | 16 042 | 54 409 |
| `chassis_p22` |  2 774 | 51 439 |

E uma CAIXA também não serve: o **berço** que segura o estepe cruza o miolo do
aro e sumiria com ele. O que separa os dois é topologia — o estepe é um sólido
de revolução, o berço entra e sai do cilindro dele. Critério: **cai fora o
componente conexo que cabe INTEIRO no cilindro**, com 20 mm de folga. Medido:
7 706 componentes, 83 862 faces, exatamente as quatro malhas acima e nada além.
`chassis_p12` (o berço) não aparece na lista, que é o resultado certo.

**⚠️ POR ISSO ELE RODA DEPOIS DE `markShared()`** — é a única peça desta leva que
ESCREVE índice dentro da malha do caminhão, e os rips de rígido dividem
`BufferGeometry` entre malhas (256 nós para 219 malhas no Scania). É a razão de
não morar dentro de `attachVmWheels()`.

O diâmetro é o da DIREÇÃO (0,992 medido), não o do próprio estepe (1,083) —
*"da própria lateral"* é literalmente esse número, e por isso
`swapTruckWheels()` passou a devolver `SwapRodagem { postas, direcao }`: quem
precisa da medida roda depois, com a rodagem original já invisível, e não teria
mais como medir.

A face bonita aponta para **baixo**: o estepe deitado só é visto de baixo ou num
três-quartos rasante, e é lá que a calota, o cubo e as porcas precisam aparecer
para ele ler como "a roda da própria lateral".

### 41.3 O letreiro SCANIA: metal certo, cor de buraco negro

Uma linha em `cab-bake-fixes.ts`. `sc_logo_0_mat_0000_brushed_metal_104` vinha
com metalicidade 0,85 e rugosidade 0,20 — **as duas já na régua da frota** — e
cor-base **0,0014 linear**. Num metal a cor-base é a refletância: a letra
devolvia 0,1 % do céu, um buraco preto sobre a grade preta.

Não é caso isolado — o rip guarda o tom no FATOR e deixou toda a família
`brushed_metal` do Scania entre 0,0004 e 0,1087, enquanto o `steel_clean` do VM
guarda o tom numa TEXTURA (p50 0,3025 em luminância linear). E
`normalizeBlackPlastic()` não alcança isso **de propósito**: ela pula
metalicidade > 0,5, porque levantar um metal ao piso de plástico (0,030)
continuaria preto.

0,55 linear é a refletância de aço/cromo polido, e é a mesma régua que o inox do
tanque usa. **A régua de inox desta base é uma só.**

### 41.4 A altura: só uma borda pode casar

> *"coloque ambos tanque e esse outro menor na mesma altura"*

O tanque de combustível e o de ARLA **não têm a mesma altura** — 658 mm contra
593. O que o rip entregava era o FUNDO alinhado (306 contra 302 mm) e o TOPO em
degrau de 69 mm, e é o degrau de cima que aparece na foto: a borda de baixo
recorta contra a sombra do asfalto e a de cima contra a saia clara do baú.

A régua passou a ser o **topo do tanque de ARLA**, medido em runtime pelo
material (`/arla|adblue/i`), com conferência de tamanho para não casar um selo.
Escolha do topo e não do fundo: é por cima que as duas peças se prendem à mesma
longarina, e alinhar por baixo empurraria o ARLA 65 mm para cima, para dentro de
um vão que não foi medido.

**Quem desce é o nosso tanque, não o ARLA.** O corpo do ARLA é uma malha
dedicada (`chassis_p19`), mas o berço e os suportes estão fundidos em
`chassis_p15`/`p18`, que atravessam o caminhão: movê-lo custaria a cirurgia por
componente conexo de §41.2, com o risco de deixar um suporte para trás.

O que autoriza a descida é medição, não gosto: com o topo em 895 o fundo do
tanque cai para y 238 mm — e a ferragem das cintas do tanque que o Scania já
trazia descia a **225**. Não há regressão de altura livre, e a faixa abaixo dos
dois flancos foi varrida e está vazia. O portão passou a ter as duas linhas: o
topo na régua do ARLA e o fundo acima do piso do rip.

De quebra a régua conserta uma assimetria que estava no arquivo — os tanques de
fábrica tinham topos a 964 (esquerdo) e 972 (direito), e agora os dois lados
saem em 895 exatos.

### 41.5 A faixa refletiva traseira: a do VM nos três, e o defeito invisível de dia

> *"a faixa refletiva da traseira deve ser do volvo, em todos, inclusive do Scania"*

Os três rígidos têm faixa traseira, e as três são diferentes:

| | nó | vértices | tamanho | textura |
|---|---|---|---|---|
| Volvo VM | `chassis_p4` | 100 | 2,124 × 0,099 | `faixas_refletivas` 1024² **com alfa** |
| Scania P | `chassis_p38` | 150 | 2,389 × 0,109 | `refletivas` 4096×256 |
| VW Titan | `truck_p56` | 18 | 2,568 × 0,115 | `faixa` 1024×256 |

A do VM é a única com atlas de fita de verdade — microprisma, "APROVADO
DENATRAN" e a marca 3M, e num arquivo com alfa —, e é a que o dono escolheu.
Asset: `tools/chassis-bake/bake_faixa_vm.py` → `faixa_refletiva_vm_v1.glb`,
normalizado com **largura 1,0**, centrado em x, base em y = 0 e face de trás em
z = 0. A escala é a largura que o motor mede na faixa nativa, e ela é UNIFORME
porque a razão altura/largura das três é 0,0466 / 0,0456 / 0,0448 — 4 % de
espalho.

**⚠️ O ganho maior é invisível de dia.** `retroreflect.ts` injeta o termo de
retrorreflexão por NOME DE MATERIAL (`FITA_RE`), e **nenhum** dos três nomes de
rip casa: `faixas_refletivas`, `refletivas` e `faixa.002` passam batido porque o
`reflet` deles não vem precedido de `retro`. Ou seja, a fita do BAÚ acendia no
farol e a faixa traseira do CAMINHÃO não — na mesma foto, a 30 cm de distância.
O asset sai batizado `Faixa-3M-traseira`, que casa, e `setupCommon()` faz a
injeção ao carregá-lo.

**⚠️ Nome não basta para achar a nativa.** No Scania o mesmo `/faixa/i` casa
`cabin_mat_0006_faixas112_5`, que é o RÓTULO do tanque de ARLA. O nome é só o
primeiro peneiro; quem decide é a FORMA (chapa ≥ 1,5 m de largura, ≤ 0,25 de
altura, ≤ 0,06 de espessura) e o SÍTIO (a mais traseira). O rótulo sai pela
largura: 75 mm contra 1 500.

**⚠️ E a geometria do clone é própria.** A faixa mora no RABO, e o rabo é
escrito: `stretchRigidFrame()` reescreve as posições a cada arraste do controle
de comprimento. `markShared()` não protege aqui porque ele conta usuários DENTRO
da cabine e a raiz do asset está fora dela. São 100 vértices — clonar a
geometria custa nada e fecha a porta. Pelo mesmo motivo a montagem é ANTES do
primeiro `placeTrailer()`, no slot de `attachRigidRearPlate()`.

Portão: `checks-tanque-estepe-0822.mjs` §7, nos três caminhões — **36 ★**.

### 41.6 A faixa afundava na barra — e a peça é uma chapa sem espessura

> *"a faixa do scania esta errado"*

A causa não era textura: era **inclinação**. As três barras traseiras são
rakeadas, cada uma com um ângulo próprio, medido por mínimos quadrados sobre a
face:

| | rake da barra |
|---|---|
| Volvo VM | 1,62° |
| VW Titan | 2,61° |
| Scania P | 1,47° |

A primeira versão levava a faixa do VM **com o rake dela embutido** e a ancorava
pela borda de baixo, na cota do ponto mais avançado da nativa. No Scania isso
põe o topo da faixa 2,6 mm ATRÁS da chapa da barra, e o renderizador come dois
terços dela: sobravam duas tirinhas — a de cima e a de baixo — com preto no
meio. Foi exatamente o que a captura mostrou.

O conserto tem duas metades, e as duas são necessárias:

1. **o molde sai VERTICAL do bake** — `bake_faixa_vm.py` mede o rake e o zera
   (1,623° → 0,0001°);
2. **o motor mede o rake da faixa NATIVA e o aplica**, assentando a placa 3 mm
   à frente do plano dela.

Assim a faixa acompanha a barra de cada caminhão em vez de impor a do VM, e fica
com um afastamento UNIFORME — que é o que uma fita colada sobre uma barra
realmente tem, e é folga de sobra para o z-buffer.

**⚠️ E A PEÇA É UMA CHAPA SEM ESPESSURA.** Isso custou duas tentativas de
conserto. Medido: a caixa da faixa tem 2,9 mm em z e o **rake sozinho já vale
2,9 mm** — ou seja a espessura é ~0 e todo o espalho longitudinal É a
inclinação. A 1ª tentativa mediu o rake por `min(y)` de duas fatias de borda e
sobrou 0,326° (nas bordas a chapa dobra, e o vértice mais avançado da fatia é o
da dobra). A 2ª tentou selecionar "a face da frente" por uma fração da
espessura — e como a espessura é a própria inclinação, isso selecionou o **terço
de baixo da chapa** e o resíduo foi a 3,232°. Numa chapa plana o ajuste certo é
por mínimos quadrados sobre a chapa INTEIRA.

---

## 42. 2026-08-22 (5ª leva) — bitruck, truck e toco para o VM e o VW

> *"preciso que o vw e volvo tenham os chassi bitruck, truck e toco"*

Portão: `tools/studio-bench/bench.mjs --gpu --geometry --checks
checks-chassis-config-0822.mjs` — **39 ★**, as dez configurações de rígido do
acervo carregadas uma a uma no motor, com foto de cada.

Quatro arquivos novos, derivados por `tools/chassis-bake/cut-chassi.cjs`:

| | derivado de | operação |
|---|---|---|
| `volvo_vm_2015_4x2r.glb` | 6x2 | tira o eixo auxiliar |
| `volvo_vm_2015_8x2r.glb` | 6x2 | recua a fila de equipamento e enxerta o 2º direcional |
| `vw_titan_4x2_tl.glb` | 6x2 | tira o eixo auxiliar |
| `vw_titan_8x2_tl.glb` | 6x2 | idem, por componente |

### 42.1 A sonda mentiu, e por quê

A primeira sonda de eixo foi escrita em Blender e disse que **o VW não tinha
nenhum componente na faixa do eixo auxiliar** — o que é falso. `transform_apply`
só achata a matriz do OBJETO; ler `v.co` depois dele dá coordenadas locais num
arquivo e coordenadas de mundo em outro, conforme o rip tenha ou não pai.

Medido depois, no glTF cru: **189 dos 228 nós do Scania, 123 dos 139 do VM e 39
dos 55 do VW carregam `translation`/`rotation`/`scale`**. `cut-scania.cjs` pôde
ignorar isso porque os SEIS nós que ele corta estão na identidade — exceção, não
regra.

Daí `tools/chassis-bake/probe-eixo.cjs`: ela roda no MESMO decodificador e no
MESMO referencial do cortador, compõe a matriz de mundo subindo a árvore e só
então converte para o normalizado. **Sonda e cirurgia não podem estar em
processos que discordam de onde as coisas estão.**

### 42.2 O toco: por que a janela é ASSIMÉTRICA

O Scania tem suspensão A AR no tandem — cada eixo é independente e tirar o
auxiliar é tirar o conjunto dele. **O VM e o VW têm feixe com BALANCIM**: os dois
eixos dividem um molejo que pivota num suporte central.

Medido no VM, as três peças de apoio estão em z −4 197 (suporte central),
−4 789 (o eixo) e −5 457 (mão-de-mola traseira). Uma banda **simétrica** de
±620 mm em torno do eixo faz exatamente o contrário do que se quer: tira o
suporte central — que o eixo trativo vai herdar como apoio traseiro — e deixa
pendurada a mão-de-mola do eixo que saiu. A janela é `[−5,60 · −4,45]`: começa
depois do suporte e acaba depois da mão-de-mola.

**⚠️ E altura não basta.** A 2ª versão da regra tirava só o que estivesse abaixo
de y 0,87, e no render sobrou a chapa de fixação e o PINO da mão-de-mola, no
nível da alma, com nada pendurado. O que separa ferragem de EIXO de ferragem de
QUADRO nessa janela não é a altura, é o **|x|**: travessa é larga e CENTRADA
(|x| ≤ 10 mm), mão-de-mola e rebite moram na FACE da longarina (|x| 0,44…0,53).

**⚠️ E as rodas têm de sair do ARQUIVO.** `swapTruckWheels()` MEDE a rodagem
original para saber onde pôr a roda nova: um pneu esquecido faz o toco nascer
com três eixos, agora com a roda do VM. No VM as rodas são nós (saem por
`poda`); no VW são COMPONENTES de quatro malhas compartilhadas e saem pela mesma
janela.

### 42.3 O bitruck: não há vão, e não há baia para esticar

**O 6x2 não tem espaço para um 2º direcional.** Medido na faixa da roda
(|x| 0,80…1,30), o flanco direito do VM é equipamento contínuo de Zn 1,012 a
−2,560: DPF, tanque, caixa de bateria e estepe. O do VW, de 1,124 a −3,5.

E não dá para abrir espaço esticando o quadro: a varredura por baia limpa
(`probe-eixo.cjs --limpo`) acha **uma só** janela de 100 mm em todo o VM sem
componente inteiro dentro, e ela fica no balanço traseiro.

O que salva é a aritmética da FILA. No VM:

    DPF 0,545 + tanque 1,418 + bateria/estepe 0,936 = 2,899 m
    vão de 0,190 a −2,925 (pneu do trativo)          = 3,115 m

Cabe, com 350 mm de folga. Então ninguém corta nada: **a fila recua**. A fila
fica com 35 mm entre peça e peça e 114 mm para a roda do trativo:

    eixo novo  1,285…0,225   (pneu de 1,06 m centrado em Zn 0,755)
    DPF        0,190…−0,355  (recuou 822 mm)
    tanque    −0,405…−1,823  (recuou 593)
    bateria   −1,875…−2,811  (recuou 252)

**⚠️ A DIFERENÇA DE FORMA ENTRE OS DOIS.** No VM as três peças da fila são NÓS
PRÓPRIOS e recuam por translação de nó — e a rodagem do eixo novo são os 14 nós
do 1º direcional CLONADOS com deslocamento, apontando para a MESMA malha: o
bitruck não paga um triângulo a mais de roda. No VW cabine e quadro estão
fundidos em `truck_p4`/`truck_p5` e o equipamento é COMPONENTE — quem recua é o
vértice (180 componentes, 62 030 tri, 826 mm em bloco para preservar o
espaçamento), e a rodagem e a suspensão são clonadas por componente.

**⚠️ QUEM NÃO PODE RECUAR SÃO AS LONGARINAS.** Elas são componentes de
`truck_p4` e o centro delas (−2,3) cai dentro da janela: mover a longarina de um
caminhão 826 mm seria cômico e silencioso. O corte é por três testes juntos —
peça CURTA (< 1,5 m), ABAIXO da mesa e FORA do miolo.

⚠️ A translação de um nó é **no espaço do PAI**, e no VM 123 de 139 nós têm
matriz. Somar o delta direto em `translation` só estaria certo se o pai
estivesse na identidade. O delta é de MUNDO e vira local pela inversa da matriz
do pai, tratado como DIREÇÃO (w = 0).

### 42.4 O que ficou de fora, e por quê

**O 2º eixo direcional do VM não tem para-lama.** O arco do dianteiro dele é
parte da CASCA DA CABINE (`cabin_p0`/`cabin_p3`) e não existe como componente
isolável — procurado com quatro filtros de forma diferentes, o que aparece na
faixa são emblemas e a carenagem inteira. No VW o para-lama veio junto no clone
da suspensão, porque lá ele é componente de `truck_p4`. Um arco procedural em
`chassis-parts.ts` resolveria; é trabalho de autoria de geometria, não de
recorte, e não foi feito.

**As mangueiras de 6 mm do eixo auxiliar do VW** sobrevivem ao corte do toco: são
componentes longos, o centro delas cai fora da janela, e o critério de peça
longa (que protege a longarina) as protege junto. Medem 6 mm e ficam sob o
quadro.

---

## 43. 2026-08-23 — a cota de fábrica dos eixos, o para-lama do 2º direcional e a sonda de sobreposição

> *"veja só, o bitruck do volvo está terrível … toco também não me parece muito
> correto já que a segunda roda está muito ao centro, baú parece muito grande
> para um toco … o VW precisa remover a grade lateral, que na verdade pertence
> ao implemento, então está ficando duplicada … preciso do Volvo e VW 100 %
> perfeitos, bem estruturados como o Scania me parece visualmente estar"*

Quatro defeitos, uma causa comum em três deles: **§42 desenhou o bitruck com o
vão que sobrava em vez da cota que a ficha manda.**

### 43.1 A cota que faltava — 2 220 mm, e ela é de fábrica

| | 1º↔2º direcional | fonte |
|---|---|---|
| Volvo VM 8x2R | **2 220 mm** | `Ficha-Técnica-VM-8x2R.pdf`, linha `D`, igual nos quatro entre-eixos (4 800 · 5 150 · 5 900 · 6 700) e igual na ficha do 8x4R |
| VW Constellation 30.320 8x2 | **2 348 mm** | `Especificações Técnicas`, linha `R Distância entre-eixos: 1º ao 2º` |
| Scania P 8x2 (o rip do acervo) | **2 215 mm** | medido |

O §42 pôs **1 092 mm** no VM e **1 050** no VW — metade. Não é imprecisão de
rip: o número saiu do vão que sobrava depois de recuar a fila de equipamento, e
**vão disponível não é cota de projeto**. É por isso que o Scania era o único
dos três que o dono olhava e achava certo: ele é bitruck de fábrica e já vinha
com 2 215.

A ficha do VM também fecha por soma, o que prova que as letras estão lidas
certas: `G = B + A + E + F` → `1 320 + 4 800 + 1 224 + 2 371 = 9 715` ✓, nas
quatro variantes.

**E a cota certa REDUZ a cirurgia.** Com o eixo em Zn −372,5 abre um vão de
1 164 mm entre os dois pneus dianteiros, e é exatamente ali que o caminhão real
leva o silencioso de um lado e a caixa de bateria do outro — os dois JÁ ESTÃO
lá no rip. O §42 recuava o DPF 822 mm e deixava a caixa de bateria parada, e o
resultado era a caixa dentro do pneu novo. Agora anda só o que o pneu (e o
para-barro) desalojam: tanques e estepe no VM; tanque e um reservatório de ar
no VW.

### 43.2 O para-lama do 2º direcional vem do SCANIA

A 1ª tentativa clonou o arco do 1º direcional do VM (`cabin_p0` + `chs_base_0_p7`)
2 220 mm para trás. Funciona e está errado: aquele arco é PEDAÇO DA CASCA DA
CABINE, e solto no meio do quadro atravessa o que estiver lá — a sonda de
sobreposição achou seis interseções novas, a maior de 151 × 195 × 95 mm contra a
caixa de bateria. *"em vez de usar o para-lamas da cabine para a segunda roda,
deve usar o da segunda roda do Scania mesmo, ficará melhor."*

`tools/chassis-bake/rip-paralama.cjs` extrai `t_paralama_0_p0…p7` do
`scania_p_8x2r.glb` para `models/vehicles/paralama_dir2_v1.glb` (0,34 MB,
51 736 tri, 4 materiais), com a origem no CENTRO DO EIXO.
`vehicle/front-fender.ts` o monta MEDINDO o pneu que está na tela:

    sy = sz = Ø(alvo) / Ø(doador)                    o arco acompanha o pneu
    sx      = meiaBitola(alvo) / meiaBitola(doador)  e a bitola

Duas escalas, não uma: escalar `x` junto com `y`/`z` poria o arco 55 mm para
fora do pneu no VM (bitola menor) e 27 mm para dentro no VW (maior). A escala
não-uniforme é legítima aqui porque `orientYaw = π` é `diag(−1, 1, −1)` e duas
diagonais comutam — a função **recusa** qualquer `orientYaw` que não seja ±π.

⚠️ **O acabamento é PRETO DE CHASSI, não tinta.** A 1ª versão pôs
`ts_paralama_pintura` em `chassis[].paintMaterials`; sem cor escolhida a peça
trazia o verde-água de fábrica do rip do Scania para dentro de outro caminhão.
*"o para-lamas deve seguir a cor dos outros do chassi, preto, não um preto puro
pra não ficar estranho."* O valor sai medido: `chassis_mat_0000_Cinza_7` do VM é
`[0,00545 · 0,00576 · 0,00545]` linear — `tuneFenderMaterials()` usa 0,0100, o
dobro, que é o que compensa a peça não ter mapa de sujeira por cima.

### 43.3 O baú do toco — CONTRAN 882/2021, e onde a regra tem de morar

O 4x2 derivado herda o quadro do 6x2. Com o baú de fábrica (8,38 m) a traseira
caía a **4 050 mm** do eixo trativo do VM: 550 acima do teto absoluto de 3,50 m
e 846 acima dos 60 % dos eixos extremos. O eixo ficava a 49 % do comprimento da
carroceria contra 67 % de um VM 4x2 de catálogo — a queixa, em número.

⚠️ **A regra mora em `placeTrailer()`, e não em `setTrailerDims()`.** A 1ª
versão cortava `TrailerDims.length` contra `cabRearZ − cabGap` e errava por
846 mm, porque `length` é o comprimento PARAMÉTRICO do corpo branco e a norma
mede a TRASEIRA DO CONJUNTO: a caixa do implemento tem 9 229 mm contra 7 481 de
`length` (o Thermo King avança sobre a cabine, as mangueiras penduram atrás).
O portão continuava acusando 4 050 mm com o corte já aplicado. Em
`placeTrailer()` existe `bb`, a caixa das CHAPAS, e `bb.min.z + dzBau` é
literalmente a traseira montada.

⚠️ **E a regra é de MÃO DUPLA.** Cortar sem devolver fazia o bitruck seguinte
herdar o corte do toco — medido na bancada: o VW inteiro ficou em 7 481 mm
depois de passar pelo VM 4x2. Ela recorre uma vez (`setTrailerDims()` chama
`placeTrailer()` de volta) e o guarda `cortandoBau` é o que impede a recursão.

Resultado nas dez configurações: só os dois tocos derivados são cortados
(VM 8 380 → 7 520; VW 8 380 → 8 341). O do Scania já cabia, e é por isso que ele
nunca pareceu errado.

### 43.4 A grade lateral do VW estava DUPLICADA — e os suportes ficaram

O VW é o único dos três rígidos cujo rip traz para-ciclista ASSADO. Conferido
com a mesma varredura nos três (componente com vão em z > 1,2 m na faixa
|x| 1,00…1,45 e y 0,40…1,15): VM zero, Scania zero, **VW dez** — dois corridos
por lado, partidos pelo tandem, que é a mesma forma que `side-guard.ts`
constrói a partir do implemento.

CONFERIDO NA FOTO ANTES DE CORTAR: na régua do print do flanco (0,1212 px/mm,
tirada do vão 1º direcional → trativo) a grade bege começa em Zn −235 e acaba em
−2 916; as cotas medidas são −260 e −2 950. 25 e 34 mm de erro de leitura de
pixel — é a mesma peça.

⚠️ **E os suportes não saíram na primeira passada.** *"você removeu as grades,
mas não removeu os suportes"* — mais oito componentes, chapa de 277 mm de altura
e quase sem espessura, nas pontas traseiras de cada corrido. Removida a grade,
eles seguravam o ar.

⚠️ **O 6x2 não pode ser sobrescrito** — ele já está servido com
`Cache-Control: immutable`. A saída limpa é um arquivo NOVO,
`vw_titan_6x2r.glb`; o rip continua na árvore como fonte das quatro derivações.

### 43.5 O tanque recua para a grade passar POR FORA

*"esses tanques, até mesmo do Scania, deveriam estar mais recuados, porque a
grade lateral deve passar sobre eles"*, com a foto do baú Ibiporã: o corrido é
CONTÍNUO da cabine ao tandem e o tanque vive atrás dele.

Com a face da grade em |x| 1 275 (2 600 mm de largura legal menos os 60 mm de
`RECUO_DA_PELE`), medido:

| tanque | face | recuo | era obstáculo? |
|---|---|---|---|
| VM | 1 168 | 107 mm | sim, com `FOLGA_LATERAL` = 120 |
| VW | 1 112 | 163 mm | nunca |
| Scania | 1 204 | 71 mm | sim |

Duas correções, cada uma na sua causa: `FOLGA_LATERAL` cai de 120 para **95 mm**
(a espessura medida do suporte é 90; os 30 mm de respiro a mais custavam o
corrido inteiro) e `swapTruckTanks()` ganha um **teto de |x| 1 150** para a face
externa — recuar o tanque do Scania por régua de obstáculo seria esconder a
causa. Depois disso o portão diz *"nada — o corrido pode ser contínuo"* nos
sete rígidos de VM e Scania.

### 43.6 A sonda de sobreposição — `probe-sobreposicao.cjs`

> *"cuidado com componentes entrando dentro de outros … use algoritmos de
> reconhecimento de sobreposição de peças"*

Caixa envolvente não responde: a caixa de uma roda cruza a de uma longarina sem
um triângulo encostar no outro, e uma chapa fina que atravessa um cilindro dá
duas caixas que mal se tocam. A sonda testa **triângulo contra triângulo**,
separação por 11 eixos, com peneira por grade uniforme de 250 mm.

⚠️ **O número absoluto não serve para nada.** Um rip é feito de peças que se
atravessam de propósito — parafuso enterrado na chapa, mão-de-mola dentro da
longarina. Medido no `volvo_vm_2015_6x2r.glb` intacto: **1 121 pares** só na
zona do chassi. Por isso o modo que importa é `--base`: roda a mesma varredura
no arquivo de ORIGEM, casa peça com peça por ASSINATURA
(`nó | nº de triângulos | dx×dy×dz`, invariante por translação de propósito) e
imprime só o que é NOVO.

Foi ela que achou, no VM: o escapamento 132 × 523 × 122 mm dentro do tanque
recuado (o tanque passou de 1 350 para 1 550 mm de recuo), o arco de cabine
dentro da caixa de bateria (que virou o para-lama do Scania) e, no fim,
**8 mm** de caixa de bateria dentro do pneu novo. A correção dessa última
mostrou o valor do método: mandar a caixa 60 mm para a frente devolveu OUTRA
sobreposição do mesmo tamanho contra o compartimento do motor — a peça está
encaixada com 12 mm de sobra no total, e 10 mm é o que zera o lado do pneu.
O olho não mostraria nenhum dos dois.

⚠️ **E ela não vê metade do caminhão.** Roda do VM, tanque do VM, grade lateral
e para-lama do 2º direcional nascem em `loadCab()`/`placeTrailer()` e não estão
em `.glb` nenhum. Quem as mede é o portão de bancada
(`checks-chassis-0823.mjs`), que refaz o mesmo teste no que está NA TELA e
reporta a PROFUNDIDADE da penetração (a menor aresta da caixa de interseção),
por flanco e em espaço normalizado. A união dos dois lados dava sempre 2,1 m de
largura e mascarou o defeito na primeira leitura.

### 43.7 O portão

    node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-chassis-0823.mjs

Nas dez configurações de rígido: a cota entre direcionais contra a ficha (±3 %),
o balanço traseiro contra a CONTRAN 882/2021, a existência do para-lama no 2º
direcional, a sobreposição dele com o caminhão (< 40 mm de fundo), quem parte o
corrido da grade, e duas fotos por configuração — flanco e trem dianteiro.

### 43.8 A 2ª leva do mesmo dia — o que a foto do dono mostrou depois

> *"ainda tem muitos itens sobrepondo outros … os suportes da grade do VW
> continuam lá, até uma FACE da grade … o para-lamas do bitruck do VW e Volvo
> estão ao contrário, além de estarem tocando outros itens do chassi … precisa
> recuar um pouco o tanque e esse elemento ao lado dele, para que a grade cubra
> o segundo elemento ao lado do tanque"*

Cinco defeitos, três deles introduzidos por §43.2–43.5 e dois que o portão não
via porque **ele próprio estava errado**.

**⚠️ O PARA-LAMA NASCIA ESPELHADO, e a álgebra diz por quê.** A montagem escrevia
`matrix = N⁻¹ · T(pose) · S`, o que aplica `N⁻¹` também aos VÉRTICES do asset —
e `N⁻¹` carrega a meia-volta de `orientYaw = π`. O asset JÁ está no cru do
glTF, o mesmo espaço da cabine que o recebe: o que precisa mudar de referencial
é só a COTA. O sintoma na foto é inconfundível porque um arco é quase simétrico
e o PARA-BARRO não é — ele nascia na frente da roda, e a ponta do arco entrava
na caixa de bateria e na grade. Corrigido, `N⁻¹` vai no PONTO e a matriz se
compõe sem rotação.

**⚠️ E ELE NASCIA LARGO DEMAIS.** A escala em x saía da MEIA-BITOLA medida em
runtime, e a varredura de roda apanha pneu, aro, cubo e PORCA — a porca é a peça
mais externa da roda, e o mínimo de |x| entre elas muda de rip para rip. Medido:
1 355 mm de meia-largura no VW, **mais largo que o próprio baú** (1 335). A
régua passa a ser a FACE EXTERNA DO PNEU, medida na faixa BAIXA (5 % a 35 % do
diâmetro acima do contato), onde só existe banda de rodagem. Com ela o arco cai
em 1 211 no VM, 1 241 no Scania e 1 301 no VW — dentro do baú nos três.

**⚠️ A GRADE DO VW TEM DOIS NÍVEIS, e o corte só pegou um.** A régua de §43.4
pedia `y0` entre 0,50 e 0,60: isso apanha as chapas da barra de BAIXO
(y 506…689) e deixa as da barra de CIMA (y 922…1 099) inteiras no arquivo — a
fita cinza contínua logo acima da barra branca do implemento, que é literalmente
o que a foto mostra. A assinatura que basta não tem altura nenhuma: chapa no
FLANCO (|x| > 1,10), LONGA (> 1,2 m) e FINA (< 50 mm). Varrido o caminhão
inteiro, nada além do para-ciclista casa os três. De 10 componentes para 20.

**⚠️ O PORTÃO APLICAVA A INVERSA DUAS VEZES.** A checagem "quem parte o corrido"
compunha `N · cab.matrixWorld⁻¹ · mesh.matrixWorld`, e `N` já carrega
`cab.matrixWorld⁻¹`. Com a inversa dobrada as coordenadas saíam de outro mundo e
ele respondia *"nada"* com o ARLA do Scania a 53 mm além do limite, bem na foto
que o dono mandou. É o modo de falhar mais caro que existe — o portão afirmando
o conserto que a tela desmente —, e é a segunda vez neste motor
(§37–§40 registra a primeira).

**⚠️ TANQUE DE DOIS FLANCOS NÃO ANDA POR TRANSLAÇÃO DE NÓ.** O recuo do tanque do
VM (|x| 1 204, contra os 1 180 que a grade aceita) foi escrito primeiro como uma
translação do nó — e `tanque_0_p2` é UM nó com os DOIS flancos dentro
(x −1 197…1 204). Transladar 54 mm põe um lado em 1 150 e o outro em **1 258**:
a bancada mediu o defeito PIORANDO. O que aperta os dois lados é escrever o
VÉRTICE, cada um na direção do próprio centro — e por isso `recessFlankEquipment()`
roda depois de `markShared()`, como o estepe: sem a posse da geometria o aperto
vazaria para as malhas irmãs.

**O ARLA do Scania recua com o bocal.** O corpo (`chassis_p19`, |x| 1 233) e o
bocal (`chassis_p21`, 1 239) amputavam 670 mm do corrido dianteiro — a foto
mostra a grade morrendo exatamente onde a caixinha de tampa azul começa. O recuo
é em X e não em Z porque o berço e os suportes dele estão fundidos em
`chassis_p15`/`chassis_p18`, que atravessam o caminhão inteiro: empurrá-lo para
trás deixaria o berço no lugar. O bocal é achado por FORMA (nó CURTO, que
ENCOSTA na caixa do corpo e passa do teto), não por nome.

**E arco de roda não amputa corrido.** `truckObstacles()` marca tudo que chega a
menos de `FOLGA_LATERAL` do plano da grade, e nessa lista entram cabeças de
parafuso de 16 mm — no Scania, cinco delas, três milímetros além do limite.
Amputar 670 mm de corrido por causa de um parafuso é o oposto do que a peça real
faz. Duas peneiras novas, e as duas só valem para a PONTA (o suporte continua
desviando de tudo, porque ele desce do baú e atravessaria): `AMPUTA_MIN` de
150 mm (o suporte mede 250 e cabe entre duas estações) e a marca `arco`, que
isenta o para-lama — o corrido já é partido na roda por `FOLGA_RODA`.

**O layout que sobra**, medido peça a peça no flanco de cada bitruck:

| | flanco direito | flanco esquerdo |
|---|---|---|
| VM | DPF 991…468 · tanque −1 362…−2 701 · estepe −5 400…−6 336 | bateria/reservatórios 1 053…155 · tanque −1 436…−2 780 |
| VW | caixa 941…619 · reservatórios 459…−193 · estepe −2 026…−2 987 | secador 824…375 · tanque −1 560…−2 869 |
| Scania | reservatórios e caixa de bateria (do rip) | tanque −1 816…−2 794 · ARLA −1 447…−1 803 |

Nos três a leitura é a mesma e é a de um caminhão de verdade: **o que é de ar e
de escapamento fica entre os dois direcionais, o combustível fica no meio do
entre-eixos, e o estepe vai para onde sobra vão.** O vão entre os dois
direcionais — 1 164 mm no VM, 1 335 no VW — existe justamente porque a cota de
2 220/2 348 mm foi respeitada; com os 1 092 de §42 não havia onde pôr nada.

### 43.9 A 3ª leva — a grade tem 135 mm de profundidade, e ninguém tinha medido

> *"veja, um monte de itens sobrepondo outros … diminua o tamanho do tanque do
> Scania e do Volvo e recue um pouco para não tocar nas grades metálicas
> laterais … aqui no VW está ainda pior"*

Sete correções, e a raiz de quase todas é a mesma: **as folgas da grade eram
chute, e a peça nunca tinha sido medida.**

**⚠️ O CONJUNTO DA GRADE OCUPA 135 mm PARA DENTRO DA PRÓPRIA FACE.** Medido em
`protecao_lateral_v1.glb`, com x = 0 na face externa: `PONTA__` 0…100,
`BARRA__` 13…45, `ESTACAO__inox` 54…87 e **`ESTACAO__metal-preto` 45…135**. Com
a face em |x| 1 275, a grade É **1 140…1 275** — e o teto do equipamento estava
em 1 150, ou seja **10 mm DENTRO dela**. Daí a foto: o tanque do VM com o
corrido embutido nele. As duas constantes passam a sair da mesma medida
exportada (`GRADE_DENTRO`), porque separadas elas divergem:

| | antes | agora |
|---|---|---|
| `FOLGA_LATERAL` (o que é obstáculo) | 0,095 (chute) | `GRADE_DENTRO + 0,020` = 0,155 |
| `TETO_FLANCO` (para onde o obstáculo vai) | 1,150 (chute) | `1,275 − GRADE_DENTRO − 0,040` = **1,100** |

⚠️ **E 40 mm, NÃO 20.** Com o teto em 1 120 — exatamente o limiar de obstáculo —
o tanque recuado caía EM CIMA do limite (o teste é estrito) e voltava a ser
obstáculo: o corrido do Scania encurtava 700 mm e deixava tanque e ARLA de fora,
que é o defeito que o recuo existe para tirar. O teto tem de ficar ABAIXO do
limiar, não em cima dele.

**⚠️ TODA RÉGUA TIRADA DA RODA ERRA, e esta é a terceira.** A largura do arco
saiu da meia-bitola (1 355 mm no VW), depois da "face externa do pneu na faixa
baixa" (1 308 no VM, 1 393 no VW) — e nas duas o que estava medindo era o
**DISCO** da roda montada, cujo cubo cromado chega a 1 300 mm. A roda é um
conjunto e cada rip a monta com uma saliência diferente. A régua que não erra é
a **peça vizinha**: a barra da grade ocupa 1 243…1 275, então o arco acaba em
**1 235**. Hoje o teto governa nos três; a conta do pneu fica de piso para o
caminhão de bitola estreita que ainda não existe no catálogo.

**⚠️ O VÃO DA RODA NÃO É O PNEU, É A CAIXA DE RODA.** `FOLGA_RODA` (620 mm) foi
dimensionado para um pneu de 510 de raio; o para-lama do 2º direcional tem 1,4 m
e chega a ±730. A ponta do corrido nascia 110 mm DENTRO do arco — o montante
branco atravessando o para-lama na foto do VW. E como só o corrido MAIS
DIANTEIRO tem a ponta aparada, o defeito sobrevivia em todos os outros.
`wheelBayReach()` mede o vão POR EIXO, por vértice, nas malhas de arco.

**⚠️ E O ARCO VOLTA A AMPUTAR.** A rodada anterior isentou os arcos da
amputação com o argumento de que o corrido já é partido na roda. Não era
suficiente — ver acima. A isenção some; quem separa parafuso de parede continua
sendo `AMPUTA_MIN` (150 mm contra os 250 do suporte).

**⚠️ O PORTÃO SÓ OLHAVA UMA ÁRVORE.** `sobreposicoes()` varria a CABINE, e a
grade lateral é filha do IMPLEMENTO: o para-lama atravessando o montante passou
por dois portões verdes. Agora ele cruza as duas árvores nos dois sentidos —
**grade × caminhão** e **para-lama × implemento**.

**E o tanque encolhe 10 %**, ancorado no TOPO. Medido no VM: 619 mm de altura
contra 500 mm de vão da grade (barras em y 510…610 e 910…1 010) — ele
transbordava 105 mm por baixo, e é isso que fazia a grade parecer embutida.
A âncora é o topo porque é por cima que ele se prende à longarina.

**O gusset da caixa de roda do VW são DOIS**, e não um: além do de Zn −340 (que
o pneu novo ocupa) sai o de **−1 231**, onde o portão media 35 mm de chapa
dentro do arco — a maior sobreposição que restava no VW.

**O que sobra, medido e assumido:**

| | o quê | fundo |
|---|---|---|
| VM | arco × caixa de bateria e suportes de flanco | 11 mm |
| VM | topo do arco × estrutura do fundo do baú | 10 mm |
| VW | barra transversal do arco × `truck_p4` | 16 mm |
| VW | grade × um suporte em Zn −3 400 | 5 mm |
| Scania | — | 0 |

São todos ENCAIXE, não peça dentro de peça: ficam sob o caminhão, atrás da
grade, e na mesma ordem de grandeza dos **1 121 pares de triângulos cruzados
que o próprio rip do VM já tem** na zona do chassi. O arco é largo por
construção (o casco vai de |x| 600 a 1 235, porque um para-lama nasce na
longarina e vai até fora do pneu) e o VM tem caixa de bateria e suporte
exatamente nessa faixa: fechar esses 11 mm exigiria um arco menor que o pneu.

### 43.10 O ESTADO DESTA FRENTE — o que está fechado, o que não está, e o método que faltou

⚠️ **A LIÇÃO DESTA RODADA NÃO É GEOMÉTRICA, É DE MÉTODO.** Ela foi feita em dez
levas, cada uma disparada por uma FOTO do dono, e cada leva consertou o que
aquela foto mostrava. O resultado é que a mesma família de defeito — peça dentro
de peça — voltou cinco vezes com outro nome: tanque dentro da grade, para-lama
dentro do montante, arco dentro da caixa de bateria, gusset dentro do arco,
grade dentro do tanque outra vez. *"você teve 10 requisições para fazer tudo que
precisava e ignorou em todas"* — Kennedy, e está certo.

O que deveria ter sido feito na PRIMEIRA leva, e é o que a próxima tem de fazer
antes de tocar em qualquer cota: **uma varredura de sobreposição de TUDO contra
TUDO, no que está na tela, com a lista ordenada por profundidade — e só então
consertar, de cima para baixo.** As duas sondas existem
(`tools/chassis-bake/probe-sobreposicao.cjs` para `.glb` e a função
`sobreposicoes()` de `checks-chassis-0823.mjs` para a cena montada); o que nunca
foi feito é rodá-las sobre o conjunto INTEIRO. Elas hoje comparam só três pares
escolhidos a dedo (para-lama × cabine, para-lama × implemento, grade × cabine),
e foi por isso que cada foto nova achou algo que o portão verde não via.

#### Fechado, com número

| | medido |
|---|---|
| cota entre direcionais | VM 2 220 · VW 2 348 · Scania 2 215 mm, contra ficha, ±3 % |
| balanço traseiro (CONTRAN 882/2021) | dentro do teto nas 10 configurações |
| grade lateral duplicada no VW | 20 componentes de corrido + 8 de suporte, cortados |
| para-lama do 2º direcional | existe no VM e no VW, orientado, preto de chassi, 1 235 mm de meia-largura |
| grade × caminhão | 0 no Scania e no VM · 5 mm no VW |
| para-lama × implemento | 0 no VW · 10 mm no VM |
| o que parte o corrido | nada no VM · no Scania só o que está fora de qualquer corrido |

#### NÃO fechado, e assumido

| | fundo | por quê |
|---|---|---|
| VM · arco × caixa de bateria e suportes de flanco | 11 mm | o casco do arco vai de \|x\| 600 a 1 235 (um para-lama nasce na longarina) e o VM tem caixa de bateria exatamente nessa faixa — fechar exigiria arco menor que o pneu |
| VM · topo do arco × estrutura do fundo do baú | 10 mm | o arco sobe 95 mm acima da mesa da longarina, como o do rip; é assim que um para-lama se prende |
| VW · barra transversal do arco × `truck_p4` | 16 mm | a barra do para-barro do Scania atravessa o caminhão inteiro em y 783; em outro chassi ela sempre encontra algo |
| VW · grade × suporte em Zn −3 400 | 5 mm | — |

#### O QUE FALTA — em ordem de prioridade

1. **A VARREDURA GERAL, primeiro.** Um portão novo que teste, na cena montada e
   por triângulo, cada grupo POSTO EM RUNTIME (`TS_PARALAMA_DIR2`,
   `TS_PROTECAO_LATERAL`, `TS_TANQUE_VM_*`, `TS_CHASSI_PECAS`, `VM_WHEEL_*`,
   `TS_ESTEPE`, a placa) contra a cabine E contra o implemento, e ainda o
   implemento contra a cabine. Sair com a lista ordenada por profundidade, com
   flanco e z. **Sem isso, qualquer conserto continua sendo reação a foto.**
2. Consertar o que ela achar, de cima para baixo, com teto de 5 mm — e só então
   dizer que está pronto.
3. **Pendências conhecidas que a varredura vai reencontrar:** as abas de
   para-barro dianteiras do VW penduram baixo (é do rip, aparece igual no 6x2);
   o entre-eixos dos bitrucks continua o do rip (5 341 no VM, 5 653 no VW)
   contra 5 900 de catálogo — mover o tandem é cirurgia de suspensão inteira;
   `caixa de ferramentas` e `tanque de água` não existem em rip nenhum dos três.
4. O `probe-sobreposicao.cjs` fica CEGO em malha recortada (`truck_p4`
   reindexado dá 542 falsos positivos no diff `--base`): para o VW, quem vale é
   o portão de bancada. Resolver isso — casar peça por CENTROIDE além da
   assinatura — tornaria o diff de `.glb` utilizável no VW também.

## 44. 2026-08-23 (2ª frente) — A VARREDURA GERAL, e os cinco defeitos que dez fotos não acharam

> *"ainda tem muita coisa horrível nos modelos de sobrechassi, muito item
> sobrepondo outros, atravessando, muita coisa estranha … também coloque as
> grades laterais do implemento mais para cima, e adicione os suportes delas,
> porque atualmente estão flutuando sem suporte; analise o modelo de
> semirreboque para pegar o modelo do suporte de lá"* — Kennedy, 2026-08-23.

O §43.10 fecha com uma acusação de método: dez levas, cada uma disparada por
uma FOTO, e a mesma família de defeito voltando cinco vezes. Esta rodada começa
pelo instrumento que faltava, e só depois toca em cota.

### 44.1 O portão — `checks-varredura-0823.mjs`

    node tools/studio-bench/bench.mjs --gpu --geometry \
         --checks checks-varredura-0823.mjs

Cada FAMÍLIA de peça posta em runtime contra a árvore da CABINE **e** contra a
do IMPLEMENTO, mais o implemento inteiro contra a cabine, nas dez
configurações. Saída ordenada por profundidade, com peça, flanco e faixa de z.
Custo medido: **4 a 6 s e 5 a 8 M de triângulos por configuração**.

Ele nasceu de `sobreposicoes()` (§43.6) e conserta quatro coisas. As duas
primeiras são FALSOS NEGATIVOS — o modo de falhar mais caro que existe, e o
§43.8 já registra um.

**⚠️ 1. `InstancedMesh` era medida no lugar errado — e é ELA que colide.**
A varredura antiga usava `o.matrixWorld` e nada mais. Numa `InstancedMesh` isso
põe TODA a geometria na pose do NÓ, e nenhuma instância está lá: as estações da
proteção lateral nascem de `setMatrixAt(i, T(0,0,dz))` com o nó na ponta
traseira do trecho, então as sete estações reais ficam espalhadas por oito
metros e a varredura media todas empilhadas na ponta. `ESTACAO__metal-preto` é
a peça que entra 135 mm para dentro da face da grade — justamente a que encosta
no tanque — e era medida num lugar em que não existe.

**⚠️ 2. `fundo` ZERA em geometria alinhada com eixo.** `fundo` é o máximo, sobre
os pares de triângulo que se cruzam, da menor aresta da interseção das duas
CAIXAS DE TRIÂNGULO. Quando um dos triângulos é plano e paralelo a um plano
coordenado — uma chapa, a face de uma caixa, o flanco de um tanque — essa caixa
tem aresta ZERO naquele eixo e o par inteiro sai com `fundo = 0`. Medido na
cena de teste do próprio arquivo: **uma barra de 50 mm atravessando uma chapa
de ponta a ponta dá `fundo` 0**. O critério "< 5 mm" podia estar verde com um
buraco na peça.

Entra `prof`: os SEGMENTOS DE CRUZAMENTO resolvidos de verdade (interseção
triângulo-triângulo, não a caixa dela), agrupados em manchas por uma grade de
120 mm, e a MENOR aresta da maior mancha. Na mesma cena de teste ela devolve
**34 mm**, que é 10 / cos 25° + 50 · tan 25° — a espessura que a barra
atravessa. O portão reprova por `fundo` **e** por `prof`.

⚠️ **E `prof` tem de ser LOCAL.** A primeira versão usava a caixa de TODOS os
cruzamentos entre duas peças, e o sobrechassi encosta na longarina ao longo de
8,4 m: saía 8 443 mm em z, que não mede penetração nenhuma. O agrupamento em
manchas é o que transforma isso em "a espessura do que entrou ALI".

**⚠️ 3. A FUSÃO RENOMEIA.** `applyMerge()` funde o implemento POR MATERIAL e
esconde os originais: a barra da grade deixa de ser
`BARRA__metal-galvanizado-mantido_D` e vira `FUSAO__…__b3`, filha de `FUSAO` e
não de `TS_PROTECAO_LATERAL`. Uma varredura que agrupe por NÓ perde a peça; uma
que ignore `visible` mede a cópia escondida, que está na pose de ANTES da
fusão. O grupo passa a sair do NOME do que está VISÍVEL.

**4. Três pares escolhidos a dedo** viraram a varredura inteira.

**⚠️ E O PORTÃO SE CONFERE ANTES DE MEDIR.** §43.8 registra a inversa aplicada
duas vezes com o portão dizendo "nada" e o defeito na foto. Aqui há uma cena de
teste com resposta conhecida — uma chapa girada 25° e uma barra em
`InstancedMesh` de três instâncias, com o nó a 1,5 m e só a do meio
atravessando — e cinco estrelas sobre ela, entre elas *"a leitura pela matriz
do NÓ (o jeito antigo) NÃO acharia"*.

**O que a primeira passada mediu: 138 pares ≥ 5 mm nas dez configurações.**

### 44.2 O para-lama do 2º direcional NÃO CABE — e a saída é CORTÁ-LO

A varredura pôs no topo da tabela, com folga, o arco do 2º direcional: mancha
de **481 × 293 × 178 mm** contra a caixa de bateria do VM e **543 × 316 × 162**
contra o chassi do VW. Não é imprecisão de cota: **não cabe um para-lama de
1 450 mm no vão que sobra entre os dois direcionais.**

| | vão livre à frente do eixo | meia-peça |
|---|---|---|
| VM 8x2R | 526 mm (a caixa de bateria começa em Zn 154) | 726 mm |

Três saídas, e duas são piores:

- **encolher o arco em z** — o fator seria 0,73 e o para-lama sairia MENOR que
  o pneu que cobre. E no VW não resolveria: lá o que atravessa é um tubo
  longitudinal a 834 mm de solo que corre o chassi inteiro na altura em que o
  arco desce, e nenhum encurtamento em z tira a peça de cima dele;
- **empurrar o equipamento** — a caixa de bateria teria de andar 190 mm e
  entraria na baia do 1º direcional. §43.1 já registra que o vão entre os dois
  direcionais é o da ficha e que é ali que o caminhão real leva esse
  equipamento;
- **CORTAR O PARA-LAMA**, que é o que uma implementadora faz. É a faca de §39
  (apagar triângulos do ÍNDICE, sem tocar em vértice), e o recorte fica
  escondido atrás da peça que o causou.

`aparaParaLama()` em `front-fender.ts` roda o mesmo teste triângulo × triângulo
do portão com **folga NEGATIVA de 6 mm** — o que passa a menos de 6 mm de
qualquer peça do caminhão cai — e depois derruba o ANEL DE VIZINHOS (as faces
que compartilham vértice), que é o que afasta a borda do corte em vez de
deixá-la rente.

⚠️ **A RODA NÃO ENTRA NA CONTA.** O arco existe para cobrir o pneu; se o pneu
contasse como obstáculo não sobraria para-lama nenhum.

⚠️ **A GEOMETRIA É CLONADA ANTES DE ESCREVER.** `asset.clone(true)` divide o
`BufferGeometry` com o asset e o asset é reusado no caminhão seguinte: cortar
no molde deixaria o VW com o recorte do VM.

⚠️ **E SÃO DUAS PASSADAS, porque quando o arco é montado o baú ainda não
existe.** `attachSecondSteerFender()` roda em `loadCab()` e é `placeTrailer()`
— depois — quem assenta o implemento. A primeira apara só vê o caminhão, e o
que sobra é o TOPO do arco contra a estrutura do fundo do baú: medido,
**122…125 mm** no VM. `trimFenderAgainstImplement()` é a segunda, mora no
caminho do assentamento e é MEMOIZADA pelo par (cabine, implemento, cota) —
`placeTrailer()` recorre a cada quadro de um arraste de comprimento.

Resultado: as dez manchas de para-lama do VM e do VW, de 122 a 178 mm,
**desaparecem da tabela**.

### 44.3 A TAMPA DE PONTA ultrapassava o corrido — e era ela na roda

Segunda maior família da primeira passada: **55, 56 e 63 mm de grade dentro do
cubo da roda traseira** do VM, 62 no VW. A leitura óbvia seria "o vão da roda
está curto", e ela está errada — o que entrava na roda não era a barra.

Duas coisas se somavam, e as duas são de DATUM:

1. **A barra não começa no datum do asset.** Ela começa `BARRA_DESDE` (77 mm) à
   frente dele, e `m.scale.z` leva esse offset junto: com o grupo em `t.z0` o
   corrido inteiro nascia **77 · k** mm adiantado — 77 mm num trecho de 3,4 m e
   195 num de 8,5.
2. **`recuoTampa` só descontava o começo do PRIMEIRO trecho.** Nas pontas que
   morrem numa RODA o conjunto continuava passando 118 mm além do fim do
   corrido. A ponta não é a barra: é a barra mais a tampa, que fica
   `PONTA_ALEM` (44 mm) além dela e ainda tem 74 mm de corpo.

Agora a barra ocupa exatamente `t.z0…t.z1` e TODO limite de trecho recua
`recuoTampa` para dentro. As quatro manchas de roda somem.

### 44.4 A BAIA DA RODA É REDONDA — e foi preciso errar duas vezes para achar isso

`wheelBayReach()` é a terceira régua desta cota, e as duas primeiras erraram por
medirem uma PEÇA em vez de medirem o ESPAÇO:

1. **`FOLGA_RODA` fixo, 620 mm** — dimensionado para o pneu, e o para-lama do 2º
   direcional tem 1,4 m (§43.9);
2. **só as malhas de ARCO, por nome** — funciona no VM e no Scania e é CEGA no
   VW, cujo rip é uma malha só (`truck_p4`, 186 k triângulos com o caminhão
   inteiro dentro): lá o para-barro de fábrica não tem nome próprio.

A terceira tentativa — "tudo que estiver no corredor a menos de um metro de um
eixo" — parecia a mais geral e **encurtou a grade pela metade**: o estribo e a
saia da cabine entram nessa conta, o vão de cada baia ia ao teto de 950 mm e o
VW ficava com dois tocos de 1,1 m num flanco de 8,5.

O que separa a roda do estribo não é o nome nem a distância em z: é a FORMA.
Roda, aro, cubo e para-barro moram num DISCO em torno do eixo; estribo, saia e
caixa de bateria são compridos em z e longe do centro dele. **A régua é o raio
no plano (y, z) a partir do centro do eixo** — `RAIO_BAIA` 820 mm, `EIXO_Y`
520 —, e ela é a mesma em qualquer rip, com nome ou sem.

⚠️ **E o corredor é o da BARRA, não o do SUPORTE.** `GRADE_DENTRO` (135 mm) é a
profundidade do conjunto; quem passa na baia é só a barra e a tampa, que vão a
100 mm. Medir a baia com os 135 punha coisa a |x| 1 130 — 110 mm dentro da
barra, longe de tocá-la — a partir o corrido.

### 44.5 A GRADE ESTAVA FLUTUANDO PORQUE A FERRAGEM DELA NUNCA FOI EXTRAÍDA

*"adicione os suportes delas … analise o modelo de semirreboque para pegar o
modelo do suporte de lá"*. Estava lá o tempo todo. Medido em
`semirreboque_frigorifico_paleteiro.glb`, cada uma das SEIS estações (três por
flanco) tem, além do suporte e do montante que a v1 levou:

| peça | cota | |x| | y | nós |
|---|---|---|---|---|
| **BRAÇO** | 850 × 50 × 58 | 374…1 224 | 840…890 | `Metal-preto_0_247…252` |
| **MÃO-FRANCESA** | 397 × 248 × 45 | 854…1 251 | 626…874 | `…_265…270` |
| **GRAMPO** ×2 | 99 × 80 × 60 | 379…478 e 480…579 | 890…970 | `…_271…282` |

⚠️ **A v1 as perdeu por causa de UM NÚMERO**: `FAIXA.xMin` era 1,19 — a grade e
nada mais —, e o que prende a grade no caminhão mora TODO para dentro disso. O
braço nasce em 374.

`protecao_lateral_v2.glb` (110 kB, 8 malhas) as traz. ⚠️ **É `_v2` e o `_v1`
fica**: a árvore servida sai com `Cache-Control: immutable`, a mesma regra do
`vw_titan_6x2r.glb` (§43.4).

Em runtime a ferragem LADRILHA com a estação, mas **nem toda estação a recebe**:
o braço atravessa de |x| 374 a 1 224 e onde houver tanque, bateria, estepe ou
silencioso ele não passa. `truckArmObstacles()` é a lista dele, e ela é
diferente da de `truckObstacles()` — aquela varre a faixa da grade (|x| além de
1 120) e esta varre o VÃO DE BAIXO DO CAMINHÃO (|x| 620…1 200 na altura de
780…990). Medido: **3 de 4 estações por lado no Scania, 1 de 3 no VW.**

⚠️ **A PONTA DO BRAÇO PARA NA FACE EXTERNA DA LONGARINA, e não no eixo dela.**
No semirreboque o par de grampos ABRAÇA a viga porque ali ela é uma alma solta
no meio do vão. Num rígido o sobrechassi está SENTADO na longarina do caminhão:
um braço que atravesse o |x| dela entra no chassi — a varredura mediu **47 mm
dentro de `chassis_p3`** na primeira montagem. Quem manda é a mais externa das
duas longarinas, e o grampo estica em y até morder a face de baixo do
sobrechassi (×0,79 no VM, ×3,81 no VW).

⚠️ **`truckArmObstacles()` varre por TRIÂNGULO, e é a exceção à regra desta
base.** Em toda outra varredura daqui o vértice é a unidade certa; aqui não,
porque `truck_p4` tem triângulos GRANDES e uma chapa cujos três vértices caem
FORA da faixa ainda a atravessa pelo meio — medido, 40 mm de braço dentro de
uma dessas chapas, com a varredura por vértice dizendo que ali não havia nada.

⚠️ **E O MONTANTE PRECISA DE LISTA PRÓPRIA.** §38 registra que usar a faixa
inteira (510…1090) fazia o ESTEPE amputar o corrido. Só que com a faixa do
suporte (840…1090) o MONTANTE — a peça mais baixa da estação — atravessava o
que houvesse entre 510 e 840: 35 mm dentro de `truck_p5` no VW 4x2. São **duas
listas com dois donos**: a do SUPORTE decide o que amputa o CORRIDO, a da
ESTAÇÃO decide onde cabe um APOIO.

### 44.6 ⚠️ A GRADE NUNCA RECEBEU O MATERIAL DO IMPLEMENTO — e a fusão denunciou

O cabeçalho de `side-guard.ts` diz, desde §37, que os quatro materiais da peça
existem no sobrechassi com os mesmos nomes e que ligar por NOME é o que a faz
herdar tinta, molhado e régua de frota. **Não estava ligando.** O asset batiza
material E malha de `PAPEL__material` (`BARRA__metal-galvanizado-mantido`) e o
sobrechassi tem o nome CURTO (`metal-galvanizado-mantido`): a busca usava o
nome inteiro e nunca casava, então a grade ficava com o material STUB do
arquivo — fora da tinta, fora da frota e SECA na chuva.

O que denunciou não foi a cor (o bake gravou os valores medidos no stub, e por
isso ela parecia certa): foi a FUSÃO. `applyMerge()` funde por material, e a
grade aparecia na cena como um balde só dela, `FUSAO__BARRA__metal-…`. Depois
do conserto ela entra em `FUSAO__metal-galvanizado-mantido__b3`, junto com o
resto do galvanizado do baú — que é onde ela sempre deveria ter estado.

### 44.7 A sonda de `.glb` deixou de ser cega em malha recortada

`probe-sobreposicao.cjs --base` casava peça com peça por assinatura
(`nó | nº de triângulos | dx×dy×dz`). A assinatura é invariante por TRANSLAÇÃO
de propósito — mover um tanque 1 350 mm não pode transformá-lo numa peça nova —
e por isso é sensível a RECORTE: `cut-chassi.cjs` reindexa `truck_p4` e nenhum
componente dele casa.

O CENTROIDE é o complemento exato: invariante a recorte (tirar 3 % das faces de
uma chapa não move o centro dela) e sensível a translação. Casa-se primeiro por
assinatura; o que sobrar procura, DENTRO DO MESMO NÓ, o componente da base com
o centroide mais próximo (≤ 60 mm, tamanho dentro de 30 %), guloso e sem
reutilizar base. Medido em `vw_titan_6x2r.glb` contra a fonte:

| | por assinatura | por centroide | órfãs | pares novos |
|---|---|---|---|---|
| só assinatura | 2 058 | 0 | **7** | 121 |
| com centroide | 2 058 | **7** | **0** | 118 |

E no par 8x2 × 6x2 (que não é derivação — o 8x2 tem um eixo a mais): 1 967 por
assinatura, **109 por centroide**, 47 órfãs contra 156.

### 44.8 O QUE SOBRA — medido, e assumido com número

Depois de tudo: **97 pares ≥ 5 mm** contra os 138 da primeira passada, e a
tabela mudou de dono. As dez manchas de 122…178 mm sumiram, e — o número que
importa — **o achado mais externo que sobrou está em |x| 458 mm**. Nenhum
cruzamento ≥ 5 mm mora no flanco: TODOS estão entre as longarinas, acima das
rodas e sob o baú, com as duas peças pretas. O que ficou é uma família só, em
TODAS as dez configurações, inclusive no Scania que o dono sempre considerou
certo:

| | mancha | onde |
|---|---|---|
| VW | `FUSAO__metal-preto__b3 ▸ truck_p4` **103 mm** (11 manchas) | \|x\| 412…420 · y 1 266 |
| Scania | `… ▸ chassis_p12` **84 / 65 mm** (13…15 manchas) | \|x\| 255…302 · y 981 |
| VM | `… ▸ chassis_p3` **35 / 34 mm** (15…16 manchas) | \|x\| 388…389 · y 1 082 |

**É A MONTAGEM DO SOBRECHASSI, e ela é assim por projeto.** §25.2 mediu a alma
da longarina dos dois caminhões em |x| 0,425 e as duas longarinas do
sub-chassi em **0,374…0,439 — a cavalo sobre ela**. Um sobrechassi é um perfil
que ABRAÇA a longarina do caminhão e é aparafusado nela; as 11 a 16 manchas
discretas são as estações de parafuso. Fechar isso não é ajustar uma cota: é
mudar como a carroceria assenta, o que move `frameTopY`, o piso, o teto e o
balanço — as cinco cotas que §25 e §29–§33 fecharam por medida.

Além disso ela é INVISÍVEL: mora entre as longarinas (|x| ≤ 435), acima das
rodas e sob o baú, com as duas peças pretas. Fica assumida, com o número.

O resto do que sobra, tudo abaixo de 40 mm e tudo do rip ou de encaixe:

| | mancha | veredito |
|---|---|---|
| Scania · `TANK_R/L_2 ▸ chassis_p12` | 29…30 mm | o berço do tanque do VM contra a longarina do Scania — o tanque é preso ali |
| Scania · `TS_CHASSI_BARRA_0_* ▸ chassis_p12` | 23 mm | o braço do para-barro nasce NA estrutura, por construção (§35) |
| Scania · `t_paralama_0_p4/p5 ▸ TANK_L_1` | 7…10 mm | o para-barro de FÁBRICA do Scania contra o tanque novo |
| VW · `FUSAO__metal-estrutura-principal-padrao__b3 ▸ truck_p4` | 25…26 mm | a testeira do sobrechassi contra a traseira da cabine |

#### As quatro pendências de §43.10, decididas

| | §43.10 dizia | agora |
|---|---|---|
| VM · arco × caixa de bateria | 11 mm, "encaixe" | **era 178 mm** de mancha e não 11 — `fundo` não sabia medir. CORTADO |
| VM · topo do arco × fundo do baú | 10 mm, "encaixe" | **era 125 mm**. CORTADO na 2ª apara |
| VW · barra do arco × `truck_p4` | 16 mm, "encaixe" | **era 162 mm**. CORTADO |
| VW · grade × suporte em Zn −3 400 | 5 mm | some com o recuo da tampa |

Nenhuma das quatro era encaixe. As três primeiras eram a mesma peça sem lugar,
e a medida que as chamava de encaixe era a que zera em chapa alinhada com eixo.

### 44.9 ⚠️ O PORTÃO DISTINGUE DEFEITO DE ENCAIXE — por LISTA, e não por teto

Com 97 pares acusados, a tentação é subir o critério até o portão ficar verde.
Isso apaga o defeito junto com o encaixe, e é como a frente inteira chegou aqui.

`ASSUMIDOS`, em `checks-varredura-0823.mjs`, é o contrário disso: cada par que
passa dos 5 mm **está nomeado**, com o motivo e com um **teto próprio**. Um par
assumido sai marcado `≈` em vez de `✖`; se ele PIORAR além do teto, o portão
cai. É o que transforma "eu decidi que isso é encaixe" numa afirmação
verificável a cada rodada em vez de numa anistia.

⚠️ **E o encaixe tem TETO DE |x|.** O que autoriza o sobrechassi a cruzar a
longarina não é o par de nomes: é ONDE ele cruza. A mesma dupla de peças se
encontrando no FLANCO seria defeito, e a regra diz isso — `xMax: 0.60`.

Duas estrelas novas fecham o critério de pronto:

    ★ nenhuma sobreposição ≥ 5 mm fora dos encaixes assumidos
    ★ nada ≥ 5 mm no FLANCO (|x| > 900 mm)

### 44.10 A GRADE "MAIS PARA CIMA" — o que a norma deixa, e o que resolve de fato

O pedido tem duas metades e só uma é de cota.

A grade está em **510…610 e 910…1 010 mm de solo**, que são as cotas do
semirreboque de origem, e a CONTRAN 805/1995 limita a borda INFERIOR a 550 mm.
Sobem 40 mm de folga legal — e com a inclinação do implemento (±67 mm sobre
8,4 m de baú) o ponto mais baixo do corrido já está em 449 mm no VM. Subir a
peça o suficiente para fechar o vão que a foto mostra levaria a borda de baixo
a 618 mm, fora da norma, e o topo da estação para dentro da barriga do baú.

**O que a foto mostrava não era altura: era falta de ferragem.** Entre o topo
da estação (1 090) e a barriga do baú há de 230 a 440 mm, e no semirreboque
esse mesmo vão tem 219 mm e é vazio também — quem faz a peça parecer presa lá é
o BRAÇO, e é ele que §44.5 traz. Com o braço, a mão-francesa e o grampo
mordendo a longarina do sobrechassi, a grade deixa de ler como pendurada.

A cota fica onde está, e o motivo é a norma. Se o dono ainda quiser subi-la,
os 40 mm de folga legal estão disponíveis num único número.


## 45. 2026-08-23 (3ª frente) — os quatro consertos que a foto do dono cobrou, e um deles era meu

> *"continua terrível … o VW está sem a grade lateral no implemento, fora que
> os suportes da antiga grade que era ligada no chassi ainda está mostrando …
> para-lamas está com uma parte transparente agora … para-lamas encostando na
> caixa com a tara de peso … suporte da antiga grade atravessando o estepe"* —
> Kennedy, 2026-08-23.

Cinco queixas. Duas são regressões do §44, e as duas ensinam a mesma coisa:
**um conserto medido pode piorar o que se vê.** O portão daquela rodada ficou
verde nas dez configurações enquanto produzia as duas.

### 45.1 ⚠️ O VW FICOU SEM GRADE — e a culpa é de generalizar uma regra de ponta

§43.8 escreveu: *"o corrido mais dianteiro recua até a face traseira do
primeiro obstáculo, e só ele"*. §44 achou isso acanhado e generalizou: se uma
extremidade livre dentro de uma peça é colisão numa ponta, é colisão em todas.

A generalização está certa em geometria e errada neste acervo, porque a lista de
obstáculos não é confiável no VW: **`truck_p4` é UMA malha com o caminhão
inteiro dentro**, e `truckObstacles()` devolve ali

    -4148…-3848 · -2948…-1548 · -1348…252 · 252…952 · 1652…3752 · 3652…6252

— o chassi quase todo. Recuando TODA ponta contra essa lista, cada trecho é
comido até morrer em `TRECHO_MIN`: medido, o VW 8x2 saiu de dois corridos para
**um de 713 mm num flanco de 8,5 m**. Um caminhão sem para-ciclista, e o portão
de varredura mais verde do que nunca — porque grade que não existe não cruza
nada.

⚠️ **É a terceira vez nesta frente que uma medida melhora e a foto piora.** A
lição não é "não generalize": é que **um portão que só conta sobreposição não
sabe dizer que a peça sumiu.** O portão passou a medir também o COMPRIMENTO do
corrido, e a reprovar quando a grade cobre menos do que o vão livre permite.

A regra voltou a ser a de §43.8, com o motivo agora escrito.

### 45.2 ⚠️ O PARA-LAMA FICOU TRANSPARENTE — recortar casca por triângulo abre buraco

§44.2 resolveu "o arco não cabe entre os direcionais" recortando, por triângulo,
tudo que passasse a menos de 6 mm de qualquer peça. A medida ficou perfeita: as
manchas de 122…178 mm sumiram da tabela.

E o arco ficou **furado**. Ele é uma CASCA DE UMA FACE SÓ: apagar triângulos do
MEIO dela não encurta a peça, abre um vão por onde se vê o outro flanco. Medido,
a apara tirava 1 271 triângulos na 1ª passada e 1 426 na 2ª, e **730 deles saíam
do PARA-BARRO — 21 % da peça**. Trocar uma sobreposição que ninguém vê por um
furo que todo mundo vê é um mau negócio.

O que uma implementadora faz num para-lama que não cabe é **cortá-lo no
comprimento**: um corte reto, que deixa uma borda igual à que a peça já tem
embaixo. `cortaEmZ()` faz isso — um PLANO em z, e nada mais — e `frenteLivre()`
mede onde ele cai:

| | arco vai a | peça mais próxima adiante | corte |
|---|---|---|---|
| VM 8x2R | Zn 362 | 240 | **240** (piso) |
| VW 8x2 | Zn −13 | −130 | **−131** (piso) |

⚠️ **O PISO É O PNEU.** `PISO_COBERTURA` (58 % do diâmetro à frente do eixo)
impede que o arco fique menor que a roda que ele cobre; quando ele manda, o que
sobra de sobreposição fica REGISTRADO em vez de escondido.

⚠️ **E A BUSCA SÓ COMEÇA ALÉM DO PISO.** A primeira versão procurava obstáculo a
partir do EIXO e achava o próprio eixo — *"a peça mais próxima adiante está a
1 mm"*. Dentro do piso estão o eixo, o feixe e o cubo, que é o que o arco existe
para cobrir.

⚠️ **E A INVERSA ERROU DE NOVO — 4ª vez nesta frente.** `N` leva do LOCAL DA
CABINE ao normalizado e a caixa da peça está em MUNDO; usar `N` cru punha o arco
em Zn −2 566 num caminhão em que ele acaba em −13. Quem faz mundo → normalizado
é `N · cab.matrixWorld⁻¹`, o mesmo par que `medePneu()` compõe. Ver §43.8.

### 45.3 As LÂMINAS da grade de fábrica do VW — a terceira leva do mesmo corte

§43.4 tirou os 20 componentes de corrido; §43.8 tirou os 8 de ponta. Faltavam as
**lâminas de apoio**, que `vwSuporteDaGrade()` não pega porque pede `dy` entre
250 e 320 mm e elas são mais altas:

    35 × 245 × 33 mm   |x| 963…998   y 846…1 092   Zn −2 013 e −1 525
    13 × 344 × 34 mm   |x| 586…849   y 832…1 179   Zn −2 047 e −1 479

`vwLaminaDaGrade()` as tira por quatro testes e nenhum de nome: chapa FINA
(< 50 mm), ALTA (200…400), CURTA em z (< 60) e que SOBE acima da mesa (topo além
de 1,05 m). E ela mora em `truck_p4`, não em `truck_p5` — o corte antigo só
olhava uma malha.

### 45.4 A COROA DO ARCO DESCE — e o portão ganha uma estrela que faltava

O corte em z não alcança o que cruza no MEIO do arco: no VM sobravam
**122…125 mm de coroa dentro das travessas do sobrechassi** (mancha
628 × 122 × 254 em y 1 210). Cortar ali seria o erro de §45.2 outra vez.

O que resolve sem furar a casca é BAIXAR a peça, e há precedente medido:
`cab-bake-fixes.ts` já desce 110 mm o para-lama do 2º direcional do PRÓPRIO
Scania pelo mesmo motivo (§34). A descida é medida e limitada dos dois lados —
para quando a coroa fica 20 mm sob a mesa da longarina, e nunca deixa menos que
85 mm de ar sobre a coroa do pneu.

Medido depois das três correções (corte em z, coroa sob a mesa, sem apara por
triângulo), o que sobra do arco é a **PERNA DE DENTRO**, em |x| 468…905 e
y 760…940, contra a caixa de bateria e o silencioso: **fundo máximo 64 mm**,
contra 178 antes. É o argumento de §43.9 com o número certo — o casco de um
para-lama nasce na longarina e os três rígidos guardam equipamento exatamente
nessa faixa. Fica sob o caminhão, atrás da roda e atrás da própria caixa.

⚠️ **E O PORTÃO GANHOU A ESTRELA QUE FALTAVA.** Um portão que só conta
sobreposição não sabe dizer que a peça SUMIU: durante a regressão de §45.1 ele
ficou MAIS verde, porque grade que não existe não cruza nada. Agora ele mede
também o ALCANCE DO CORRIDO e reprova abaixo de 2 000 mm:

    scania 6 138…7 837 · VM 6 162…8 011 · VW 5 754…6 954 mm

⚠️ E a medida sai do NÓ, não do nome da malha: depois que o material da grade
passou a resolver certo (§44.6), a barra funde em
`FUSAO__metal-galvanizado-mantido__b3` e o prefixo `BARRA__` some da cena — a
primeira versão desta conta devolvia **0 mm nas dez configurações**.

### 45.5 O que NÃO saiu, e por quê — o estepe do VW é UM componente só

*"suporte da antiga grade atravessando o estepe"*. Medido: o estepe do VW é
`truck_p4`, **um componente conexo de 953 × 326 × 961 mm** que já traz o berço e
as lâminas dentro. Separá-los por componente é impossível — é o mesmo problema
que §41 resolveu no Scania com `swapSpareWheel()`, isolando por **componente
dentro de um CILINDRO** e depois de `markShared()`. O VW precisa do mesmo
tratamento, e é o próximo passo desta frente: sem ele, cortar a lâmina corta o
estepe junto.

As demais chapas que aparecem no vão entre a grade e o baú foram medidas e
**não são da grade**: `truck_p4 37 × 509 × 42` em |x| 401…442, nos dois
direcionais, é braço de suspensão — mora ENTRE as longarinas e só se vê porque o
rip do VW é cru e o vão do sobrechassi é alto.

## 46. 2026-08-23 (4ª frente) — o BERÇO do ARLA ficou para trás do tanque

> *"esse componente com tampa azul foi reduzido, mas o suporte dele nao,
> corrija isso"* — Kennedy, 2026-08-23, com a foto do flanco do Scania P.

O componente de tampa azul é o tanque de ARLA. §43.5 o recuou para dentro do
plano da grade (é isso que faz o corrido passar POR FORA dele), e o recuo levou
o corpo e o bocal — mas **não o berço**. Medido na bancada, o degrau era de
**123 mm**: corpo em |x| 1 094 e ferragem em 1 217, com as duas chapas de topo
e as duas tiras de inox penduradas no vazio.

### 46.1 Por que o berço não entrava — a pesca de vizinhança recusa malha longa

`recessFlankEquipment()` acha o que anda junto com o tanque por CONTATO: nó que
encosta na caixa do corpo, passa do teto de flanco e é **malha CURTA** (menos de
1,5 vez o vão do corpo em z). O último teste existe para não engolir a malha do
caminhão inteiro — e é exatamente onde o berço mora:

    chassis_p15   576…1 217 × 273…900 × 1 352…1 441   chapa de topo, frente
    chassis_p15   576…1 217 × 278…900 × 1 572…1 672   chapa de topo, trás
    chassis_p15  1 190…1 216 × 415…474 × 1 363…1 666   barra externa
    chassis_p18  1 200…1 211 × 422…468 × 1 356…1 673   duas tiras de inox

`chassis_p15` tem 54 409 faces e atravessa o caminhão; `chassis_p18`, 80 719.
Nenhuma das duas passa pelo teste, e nunca ia passar.

A saída é a mesma do estepe (§41.2): **componente conexo**. `componentes()`
saiu de `truck-wheels.ts` para ser compartilhada, e a pesca ganhou uma segunda
perna, que roda só para o ARLA.

### 46.2 O critério tem DUAS pernas, e a segunda é que carrega o peso

1. o componente **cabe inteiro** na região do ARLA — a caixa do corpo com
   120 mm de folga em y e z, e |x| ≥ 250 para que nenhuma TRAVESSA (que cruza a
   linha de centro) caiba nela;
2. e ele **passa do teto de flanco** (1 100 mm).

⚠️ **A segunda perna não é redundante, e a razão é topológica.** A
`componentes()` do runtime une por ÍNDICE e não solda por posição, ao contrário
da `glb-surgery.cjs` que as sondas usam: a mesma chapa que a sonda estática
mostra como UM componente de 452 faces chega ao motor em **90 fragmentos**,
porque o rip parte o vértice em toda quina viva. Medido no motor, a região
sozinha devolve **316 componentes** — rebite de longarina, abraçadeira de
chicote, presilha de tanque. Com as duas pernas sobram exatamente as peças da
tabela acima: 30 fragmentos em `chassis_p15` e 13 em `chassis_p18`, 913
vértices.

⚠️ **E a pesca não encosta no que é NOSSO.** `TS_TANQUE_VM` tem um componente a
|x| 1 098 — dois milímetros do teto — dentro da região. Ele já nasce colocado
por `swapTruckTanks()`; deixá-lo elegível seria arrancar um pedaço do tanque
novo no dia em que o teto virasse 1 099. A pesca pula tudo sob o prefixo `TS_`.

### 46.3 ⚠️ E O MAPA MUDOU: o ARLA não RECUA, ele fica mais RASO

Esta é a parte que não estava no pedido e que a medida obrigou. O recuo antigo
era uma TRANSLAÇÃO (`x' = |x| − 139`), e ela só era inofensiva enquanto movia
uma peça solta. Com o berço junto, translação é impossível: **o conjunto começa
na longarina**. A face interna das chapas de topo está em |x| 576 e a alma da
longarina ocupa 341…578 — dois milímetros. Empurrar 139 mm para dentro enfia a
peça inteira dentro da alma.

E, medido, a translação antiga JÁ FAZIA ISSO com o corpo: ele saía do rip em
655…1 233 e ficava em **516**…1 094, ou seja 62 mm dentro da longarina. Não se
via, e por isso durou.

O mapa novo é uma reta ancorada na FACE INTERNA:

    x' = dentro + (|x| − dentro) · s        s = (teto − dentro) / (fora − dentro)

Com `dentro` 576 e `fora` 1 239 (o bocal), `s = 0,791`. O que ele faz é o que
um implementador faria com um tanque que não cabe atrás da grade: **um tanque
mais raso**, não um tanque empurrado para dentro do chassi.

⚠️ **E a altura NÃO é tocada** (`ky = 1`). O topo do ARLA é a régua de altura
dos dois tanques de combustível desde §41.4: encolher a seção dele em y moveria
o tanque do VM junto, no carregamento seguinte.

O preço, dito por inteiro: a profundidade do ARLA cai de 552 para 436 mm. É a
dimensão que ninguém vê — o que se olha de fora é a seção y × z (593 × 300 mm),
e ela sai intacta. Depois do conserto, corpo em 1 095 e ferragem em 1 083: o
mesmo degrau de 10 mm que o rip tinha entre as duas.

### 46.4 Por que a pesca por componente é SÓ do ARLA

Ela é generalizável e foi medida nos três rips antes de ficar onde ficou:

    Scania (ARLA)   6 componentes — as peças da tabela, e nada mais
    VM (tanque)     0 — o tanque é um NÓ e traz os 85 componentes da ferragem
                        dele dentro
    VW (tanque)     2 de `truck_p4` — e são SAIA DE CABINE (y 518…1 233), não
                        berço

No VW elas entrariam no mapa do grupo `tanque`, que encolhe em y ancorado no
topo: a saia subiria 72 mm. Por isso a segunda perna da pesca só roda para o
ARLA, com o número acima como motivo. O portão conta as malhas que cada grupo
moveu, lendo o relato do próprio motor, e reprova se o VM ou o VW passarem a
mover alguma.

### 46.5 O portão — `checks-arla-berco-0823.mjs`

Nas dez configurações de rígido, e cada estrela é uma maneira medida de o
conserto regredir:

    ★ corpo e ferragem no mesmo plano (20 mm)      o degrau da foto
    ★ o conjunto cabe no teto de flanco (1 100)    o motivo de o recuo existir
    ★ a face interna não entra na longarina (570)  o defeito invisível de §46.3
    ★ a altura do ARLA está intacta (593 × 300)    a régua de §41.4
    ★ o topo do tanque ainda é o topo do ARLA      idem, do outro lado
    ★ sem ARLA, o motor não mexe em nada por ele   o decalque `vm_arla` do VM

Verde nas dez, e as quatro do Scania com o mesmo relato do motor:

    arla: 5 malha(s) · 9 194 vértices · profundidade × 0,791 ancorada na face
    interna |x| 576 · altura intacta · face |x| 1 239 → 1 100 mm
    · berço chassis_p15: 30 componente(s) · chassis_p18: 13 componente(s)

⚠️ **E UMA ESTRELA NASCEU ERRADA, pelo motivo que ela mesma existe para pegar.**
A 1ª versão comparava a CAIXA do tanque de combustível com a caixa do ARLA e
reprovava por 17 mm. O motor estava certo: o datum de `tank_vm_v1.glb` é o topo
da CASCA e a ferragem das cintas passa dele (o contrato de `moldeValido()`
aceita até 50 mm). A régua certa é o `at.y` que `swapTruckTanks()` compôs — o
DATUM, não o envelope. Caixa contra caixa é a maneira mais fácil de reprovar um
motor correto.

A varredura geral (`checks-varredura-0823.mjs`) foi rodada depois do conserto:
os 13 pares que ela reprova são os da 3ª frente (o sobrechassi a cavalo na
longarina de §44.8, os para-lamas do §45.4) e **nenhum deles envolve
`chassis_p19`/`chassis_p21`** — o conserto não acrescentou cruzamento. Ela não
teria como flagrar o defeito de §46.3 de qualquer jeito: aquele portão cruza
peça POSTA EM RUNTIME contra a cabine, e ARLA-dentro-da-longarina é cabine
contra cabine.

---

## 47. 2026-08-24 — o céu que parava às 19:00, e o degrau de HDR que nunca existiu

O pedido tinha duas metades, e a segunda explica a primeira:

> *"você disse que tem outros pontos para melhorar a performance, por exemplo
> mudar o hdri para menos qualidade, também as texturas do chão… aplique as
> melhorias necessárias para as qualidades média e baixa"* e *"preciso que você
> mude de forma suave o hdri durante a transição depois das 19:00 — a ideia de
> mudar o hdri depois das 19 é ele mudar para uma versão noturna do hdri, ache
> uma que encaixe bem"*.

### 47.1 A auditoria dos degraus de ASSET: um estava vivo, o outro estava morto

`ColdProfile` tem dois botões que não são código, são ARQUIVO — `groundVariant`
e `hdrVariant` —, e os dois passam pela mesma peneira: `coldProfile()` só emite
o sufixo quando o MANIFESTO declara que o arquivo existe. Medidos na bancada, um
nível de cada vez, olhando **a textura que de fato ficou ligada** e não o campo
do perfil:

| degrau | Alta | Média | Baixa | veredito |
|---|---|---|---|---|
| chão (`groundVariant`) | 2048² crua | 2048² **comprimida** | 1024² **comprimida** | **já estava no ar** desde 15/08 |
| céu (`hdrVariant`) | 2048×1024 | 2048×1024 | **2048×1024** | ⚠️ **MORTO** — a tabela pedia `@1k` no Baixo e ele nunca desceu |

O chão estava certo: a suspeita do pedido era razoável e a medida a desmentiu.
O céu, não. `hdrVariant: '@1k'` estava escrito na tabela do nível Baixo desde
**2026-08-14** e foi INERTE por dez dias, por dois motivos somados:

1. `environments.json` declarava `["@ktx2", "@ktx2-1k"]` — nunca `@1k`;
2. os arquivos `sky@1k.hdr` / `sky-night@1k.hdr` não existiam.

Então `hdrVariant()` devolvia `''` nos três níveis e **o Baixo carregava os
mesmos 75,5 MB de céu do Alto** — na máquina que menos tem memória.

> ⚠️ **A LIÇÃO, e ela já tinha acontecido uma vez neste mesmo par de campos.**
> `groundVariant` passou por este buraco entre 14 e 15/08 e por isso a peneira
> existe. O que faltou foi a consequência: **um degrau de asset não está pronto
> quando a tabela o escreve; está pronto quando o arquivo sobe E o manifesto o
> declara.** A peneira não errou — ela degradou em silêncio, que é o que ela
> existe para fazer. Quem tem de gritar é um PORTÃO, e agora existe um.

### 47.2 O que foi feito, e por que o Médio entrou junto

Entraram `public/environments/distrito-industrial/sky@1k.hdr` e
`sky-night@1k.hdr` — os arquivos 1k que o próprio Poly Haven publica, mesma
proveniência e md5 citável dos 2k (ver CREDITS.md §1.0) —, `@1k` entrou em
`textureVariants`, e **o Médio passou a pedi-lo também**, revertendo o `''` da
versão anterior. Três razões, em ordem de peso:

* o alvo de mistura de `scene/skyblend.ts` é alocado **no tamanho da FONTE**, então
  a variante leva junto 16,8 MB de meio-float **e** o PMREM de 25 MB — é o único
  botão da tabela que devolve memória em TRÊS lugares de uma vez;
* o pico de assadura do PMREM é **o engasgo do arrasto do relógio**, e ele escala
  com a ÁREA: os picos de 10-40 ms viram 3-10 ms. No Médio, que já tinha descido
  de 12 para 8 passos, era o que faltava;
* o que se perde é a nitidez de um CÉU visto atrás de um caminhão.

**E a iluminação não muda — medido, não afirmado.** `tools/env-build/hdri_stats.py`
é novo e existe porque a §1.0 do CREDITS.md afirmava três medidas "reproduzíveis"
cujo leitor não estava no repositório:

```
                         2048×1024   1024×512
média sólida (dia)         0,71701    0,71700     −0,001 %
média sólida (noite)       0,30995    0,30970     −0,08 %
coluna da fonte em u        0,5815     0,5805
pico (sol domado / lua)    33,0/55 633  19,6/36 416
```

A luz que o PMREM devolve é a mesma a menos de um décimo de por cento. O pico cai
porque quatro texels viram um, e a lua continua um disco branco estourado depois
do tonemap.

> ⚠️ **`'@1k'` SAIU da união de `ColdProfile.groundVariant` na mesma rodada, e
> isso é obrigatório, não arrumação.** `setAvailableVariants()` guarda UMA lista
> para os DOIS consumidores. Como o manifesto agora declara `@1k` para liberar o
> HDR, um nível que escolhesse `groundVariant: '@1k'` passaria pela peneira e
> pediria 16 arquivos que **não existem** — 16 404 mudos e o chão sem textura.
> O enum é a única trava que impede isso. O valor já era morto de qualquer forma:
> a própria tabela mede que `@ktx2-1k` o domina nos dois eixos.

### 47.3 O céu não tinha transição depois das 19:00 — ele tinha um degrau antes

`scene/skyblend.ts` recebia `nightness` e aplicava `smoothstep(n, 0,25…0,95)`.
**As duas saturações se somavam:**

```
nightness satura no sol a −14°   ⇒  19:20
a curva satura em n = 0,95       ⇒  18:55
```

O controle de hora anda de 0,25 em 0,25 sobre 06:00–24:00, ou seja 72 paradas.
Medido na bancada, de 17:00 a 24:00:

| | antes | agora |
|---|---|---|
| paradas em que o céu muda | **5** | **11** |
| maior salto entre paradas vizinhas | **0,363** | **0,156** |
| peso às 19:00 | **1,000** | 0,556 |
| quanto da travessia acontece DEPOIS das 19:00 | **0,000** | **0,444** |
| peso às 18:00 (a trava da lua) | 0,083 | **0,038** |

Ou seja: de 19:00 a 24:00 o céu era **bit-a-bit o mesmo** — 20 paradas mortas —
e a travessia inteira cabia em 5. O relato está certo por inteiro: depois das
19:00 não havia transição nenhuma, e a de antes era um degrau.

**O conserto é a ENTRADA, não a curva.** `nightness` é um campo saturado: ele
existe para atravessar as duas faces de preset e não tem nada a dizer sobre o sol
a −40°. O peso passou a sair da ALTITUDE, com banda própria (`skyMixAt()`), e
viaja como `rig.skyMix`, campo do rig pelo mesmo motivo que `golden` e
`vehLights`: atravessa `lerpRig()`, então um `setTimeOfDay('noite')` — que SALTA a
hora — vira crossfade de 0,8 s em vez de estalo.

### 47.3-a ⚠️ A PRIMEIRA BANDA ESTAVA ERRADA, e a foto do dono é que mostrou

A banda saiu como **+12°…−30°**, espalhando a travessia até as 20:15. Reprovada
na foto, com uma frase que diz exatamente o que aconteceu:

> *"mesmo estando escuro ainda mostra nuvens, por isso pedi outra hdri, um
> realmente de noite"*

E a leitura dele estava meio certa e meio errada, de um jeito que só o render
separa. **O plate de noite NÃO tem nuvem nenhuma** — renderizado sozinho a
`mix = 1` é céu azul-escuro limpo, com lua e estrelas. As nuvens eram do plate de
**DIA**, e a banda larga deixava **44 % dele no ar às 19:00**.

> ⚠️⚠️ **A LIÇÃO, e ela é sobre o ACOPLAMENTO do par:** neste acervo **não existe
> plate de crepúsculo**. O lado "dia" é um POENTE ESTÁTICO — sol sempre a +4,7°,
> cúmulo sempre aceso por baixo. Logo **todo peso residual do lado de dia é
> literalmente uma foto de poente sobreposta à noite**, e ele não desbota sozinho:
> `applyRig()` escala os DOIS lados pelo mesmo `backgroundIntensity`, então
> escurecer deixa a nuvem mais escura, nunca ausente. Não há janela em que "meio a
> meio" leia como crepúsculo — leia como poente com estrela. **A travessia tem de
> ACABAR quando a noite começa; o que se pode espalhar é só o caminho até lá.**

A banda final é **+10°…−12°** — a travessia acaba às 19:15, e às 19:00 já são
98,8 % de plate de noite:

| banda | 18:00 | 18:30 | 19:00 | veredito |
|---|---|---|---|---|
| `n` 0,25…0,95 (a original) | 0,083 | 0,770 | 1,000 | a noite chega, mas num degrau |
| +12°…−30° (a 1ª tentativa) | 0,038 | 0,252 | **0,556** | ⚠️ 44 % de poente às 19:00 |
| **+10°…−12°** | **0,049** | 0,552 | **0,988** | **as duas coisas ao mesmo tempo** |
| +6°…−34° | 0,000 | 0,100 | 0,370 | pior: a noite só chega às 20:00 |

### 47.3-b E A SUAVIDADE NÃO VEM DA BANDA — VEM DO PASSO DO CONTROLE

É o alvo que a 1ª tentativa errou. A travessia tem de caber entre o sol a +10°
(17:50) e a −12° (19:15): **uma hora e vinte**, e alargar isso põe poente dentro
da noite. Com o passo de **0,25 h** que `ui/hud.ts` oferecia, essa janela são
**quatro paradas** — e quatro paradas para ir de 0 a 1 são saltos de 0,25, faça-se
a curva que se fizer.

O passo passou a ser **5 minutos** (`1/12`), e a mesma janela virou dezesseis
paradas. `formatHour()` já resolvia fração de hora em minutos, e 18 h ÷ (1/12) dá
216 passos exatos. Medido sobre a varredura inteira, o maior salto de mistura
entre paradas vizinhas:

```
curva original, passo 0,25 h    0,363
curva original, passo 5 min     0,129
banda nova,     passo 5 min     0,100      ← 3,6× melhor que o estado original
```

> ⚠️ **AS DUAS COLUNAS ANDAM EM SENTIDOS OPOSTOS, e quem mexer na banda tem de
> olhar as duas:** uma banda mais larga melhora o salto e paga em NUVEM.

> ⚠️ **A TRAVA DA LUA NÃO PODE AFROUXAR, e o número novo é MELHOR que o velho.**
> O pico do plate de noite é 55 633 (a lua, três texels) contra 33 do sol domado
> do `_puresky`. Qualquer peso não desprezível antes de o poente ceder crava um
> ponto branco num céu laranja — era o `0,25` da curva antiga que segurava isso,
> e é o `+10°` da banda nova agora. Às 18:00: **0,049 contra 0,083.** Apertou.

> ⚠️ **NÃO SE ALARGA `nightnessAt()` PARA CONSEGUIR ISSO.** Já foi considerado e
> é pior: levar `NIGHT_ALT` de −14° para −30° atrasaria JUNTO a face `noite` do
> preset, os postes, as estrelas, a névoa e o `timeOfDay` — às 19:00 a cena
> inteira ficaria 58 % de noite, regredindo tudo que já estava certo. **São dois
> crepúsculos porque são duas perguntas:** "quando a LUZ vira noite" (19:20) e
> "quando o CÉU acaba de virar" (20:10).

### 47.4 O plate de noite foi reavaliado — e o que já estava lá ganhou

O pedido mandava *"ache uma que encaixe bem"*. Foram medidas as **61 HDRIs de
noite** do acervo Poly Haven e renderizadas as finalistas na faixa que a câmera
de um veículo de fato enxerga (−26°…+9° em torno do horizonte, centrada na
fonte). Só entram as `_puresky`: o cenário traz o próprio chão, então um plate
com TERRENO na metade de baixo está fora por construção — o que elimina
`rogland_*`, `moonlit_golf` e `satara_night_*` de saída.

| plate | céu (mediana sup.) | fonte | energia na fonte | veredito |
|---|---|---|---|---|
| **kloppenheim_02_puresky** (o de hoje) | 0,128 | lua a **17,1°** | 48 % | **fica** — lua e estrelas DENTRO da faixa da câmera |
| qwantani_moon_noon_puresky | 0,193 | lua a 60,6° | 82 % | céu limpo, mas a lua sai do quadro: fundo sem leitura |
| qwantani_moonrise_puresky | 0,243 | lua a 13,9° | 63 % | lava o céu — lê como hora azul, não como noite |
| qwantani_night_puresky | 0,477 | — | 1,5 % | poluição luminosa; claro demais |
| kloppenheim_07_puresky | 0,298 | — | 0,4 % | noite encoberta, sem lua — contradiz o preset `noite claro` |

**O plate que já estava lá venceu**, e a razão é a que só o render mostra: a lua
dele está a 17°, ou seja DENTRO da faixa que a lente de uma foto de veículo
enquadra, e o `qwantani_moon_noon` — melhor em quase toda métrica isolada —
manda a lua para 60° e deixa o fundo sem nada. Vale registrar o que a auditoria
derrubou: a hipótese de que o plate estava errado. **O defeito era 100 % a
curva.** Trocar o arquivo teria mascarado isso e custado a lua.

### 47.5 ⚠️ O Portão 1 de `checks-aceitacao.mjs` está medindo a coisa errada

Não é regressão desta rodada, e é preciso registrar porque ele **reprova uma cena
sã**: `alta 211 · média 214 · baixa 214`. A leitura óbvia — "os níveis baixos
apagam peça" — está INVERTIDA, porque quem tem MENOS malhas é o Alto e nenhum
botão do perfil acrescenta geometria.

Medindo `alta` OUTRA VEZ no fim da corrida ela também dá **214**. O eixo não é o
NÍVEL, é a ORDEM: `alta` é o primeiro da lista e, com a sessão já em `alta`, não
passa cortina nenhuma — ele mede a PRIMEIRA CARGA; os outros dois medem uma cena
RECONSTRUÍDA. E o diagnóstico nominal
(`checks-diag-censo-primeira-carga-0824.mjs`) fecha a conta:

```
APARECERAM depois da cortina   FUSAO__Faixa-3M__b0 · FUSAO__borracha-preta__b0 ·
                               FUSAO__plastico-preto__b0 · …__b1
SUMIRAM depois da cortina      FUSAO__lanterna-pisca-quadrado(LEDs)__b2 · …__b2
DEIXARAM de estar escondidas   nenhuma
PASSARAM a estar escondidas    nenhuma
```

São **baldes de fusão** (`__b0`/`__b1`/`__b2`), não peças: a fusão fecha em 52
baldes numa carga e 55 na outra. Malhas escondidas: **2 149 nas duas**.
Triângulos: **idênticos**. Nenhuma peça do veículo some, nunca.

### 47.5-a A MESMA não-determinância aparece em `checks-noite.mjs`

Mesmo mecanismo, outro portão, e vale registrar porque ele **oscila entre
execuções**: `lanterna-pisca-circular` some do registro de `vehicle/lights.ts` em
algumas cargas (`a lanterna redonda da FRENTE do implemento acende` reprova, e o
detalhe sai vazio) e está lá em outras — na mesma máquina, no mesmo código.

⚠️ **CONFERIDO QUE NÃO É DESTA RODADA**, e o teste foi direto: com o passo do
controle de hora revertido para 0,25 h, a reprovação é **idêntica**. As únicas
outras linhas desta rodada são duas constantes de banda de céu e comentários, que
não têm como alcançar o registro de lâmpadas do veículo.

A explicação que fecha com §47.5 é a fusão: o censo nominal mostra
`FUSAO__lanterna-pisca-circular__b1` numa carga e `__b2` noutra. O registro de
lâmpadas é montado na montagem do veículo e o número de baldes varia entre cargas
(52 × 55) — **o registro e a fusão estão numa corrida.** Não é regressão, é
dívida antiga que só agora tem nome e reprodução.

> **A conclusão é sobre a RÉGUA.** `core/quality.ts` sempre exigiu `mergeVehicle`
> igual nos três níveis *justamente* para a contagem de malhas visíveis servir de
> invariante. O que a medição mostra é que ela **não serve**: o número de baldes
> não é determinístico entre cargas, então a contagem varia sem que a imagem
> varie. As réguas que ficaram estáveis nas quatro medições são o TOTAL DE
> TRIÂNGULOS e a CONTAGEM DE ESCONDIDAS. **Deixado como está, de propósito** — o
> portão é de outra rodada e consertá-lo é escolha de quem o desenhou; o que esta
> seção garante é que ninguém perca meio dia atrás de "peça apagada" outra vez.

### 47.6 Como reproduzir

```
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-ceu-0824.mjs
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-censo-primeira-carga-0824.mjs
python tools/env-build/hdri_stats.py public/environments/distrito-industrial/sky*.hdr
```

O primeiro é o portão: continuidade (varrida no passo REAL do controle, 5 min),
**o teto de poente dentro da noite**, trava da lua e monotonicidade, mais a prova
de que o `@1k` e o `@ktx2` de fato descem — medida no TAMANHO da textura ligada,
nunca no campo do perfil.

E há um terceiro, que não é portão e sim OLHO:

```
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-ceu-fotos-0824.mjs
```

Ele fotografa o céu às 17:45, 18:15, 18:30, 19:00, 19:30, 21:00 e 23:00 com um
enquadramento alto, e existe porque **o defeito de §47.3-a apareceu numa foto e
não num número** — o portão da época media a travessia e a aprovava, porque estava
exigindo a coisa errada. Números provam que a curva é contínua; só a foto prova
que não há nuvem de poente dentro da noite.

## 48. 2026-08-24 — a grade morria em cima do tanque: 24 mm de régua desalinhada

> *"essa grade metálica não está indo até onde deveria, mais ou menos onde está
> aquele componente com tampa azul … desse lado também, isso no scania bitruck"*
> — Kennedy, 2026-08-24, com os dois flancos do Scania 8x2.

O componente de tampa azul é o ARLA — o mesmo do §46. Ele estava lá, recuado e
com o berço junto; o que não estava era a GRADE, que morria 493 mm antes dele e
deixava o vão inteiro até o 2º direcional sem para-ciclista.

Medido na bancada, o corrido dianteiro ia de −350 a **1 813** em z do
implemento, contra uma baia do 2º direcional que só começa em **2 425**.

### 48.1 A causa: UMA folga fazendo DOIS serviços

`truckObstacles()` devolve as faixas de z em que o caminhão tem geometria perto
do plano da grade, e o corte era `xGuarda − FOLGA_LATERAL` nas DUAS listas que
ela alimenta — a que AMPUTA o corrido e a que decide onde cabe uma ESTAÇÃO.
`FOLGA_LATERAL` é 155 mm (`GRADE_DENTRO` 135 + 20 de ar), que é a espessura do
SUPORTE. Só que quem corre no plano do tanque não é o suporte:

| peça da grade (medida na cena) | ocupa em \|x\| | profundidade |
|---|---|---|
| `BARRA__metal-galvanizado` | 1 210…1 242 | 32 mm |
| `PONTA__plastico-preto` (a tampa) | 1 154…1 255 | 88 mm |
| `ESTACAO__metal-preto` (o suporte) | 1 112…1 210 | 130 mm |

A barra e a tampa passam **por fora** de um tanque recuado; o suporte é que
cairia dentro dele. Com uma folga só, o tanque virava parede para as duas
coisas — e o corrido morria em cima dele.

A separação já existia meio caminho andado: `GRADE_FACE_DENTRO` (100 mm) foi
criada em §43.9 exatamente para medir a baia da roda pela BARRA em vez de pelo
suporte. Agora ela também gera `FOLGA_BARRA` (120 mm), e `truckObstacles()`
recebe a folga do CHAMADOR:

    lista que AMPUTA o corrido   → FOLGA_BARRA    (100 + 20)
    lista que bloqueia SUPORTE   → FOLGA_LATERAL  (135 + 20)

### 48.2 …e a causa da causa: `GRADE_FACE` diz 1 275 onde a peça está em 1 251

Com a folga certa o corrido chegou ao ARLA, e apareceu o segundo defeito da
mesma família: **1 499 mm de balanço** na ponta dianteira, contra os 300 que
`BALANCO` promete. Nenhuma estação cabia sobre o tanque.

`truck-tanks.ts` recua o equipamento de flanco até `TETO_FLANCO`, e o comentário
dele sempre disse a coisa certa — *"as duas saem da MESMA medida e têm de andar
juntas"*. Não andavam, por 24 mm:

    GRADE_FACE (constante)                  1 275 mm
    a face MEDIDA (skinX 1 311 − 60)        1 251 mm
    TETO_FLANCO = 1 275 − 135 − 40          1 100 mm
    limiar do SUPORTE = 1 251 − 155         1 096 mm   ← 4 mm ABAIXO do teto

O equipamento recuado parava 4 mm acima do limiar e continuava bloqueando
estação. E o número 1 275 não vinha de lugar nenhum: o comentário dizia
"2 600 ÷ 2 − `RECUO_DA_PELE`", que dá 1 240; 1 275 é a meia-largura do
SEMIRREBOQUE menos o recuo. Quem fixa a face é `attachSideGuard()`, com
`xAlvo = skinX − RECUO_DA_PELE`, e a pele do sobrechassi está em 1 311.

Com `GRADE_FACE` = 1 251, `TETO_FLANCO` vai a **1 076** e o montante da estação
(1 112) passa com **36 mm de ar** — medidos, não arbitrados.

### 48.3 A tentativa que foi REVERTIDA, e por quê

O primeiro conserto do balanço foi baixar `GRADE_FACE` para a face medida
(1 251), o que leva `TETO_FLANCO` de 1 100 para 1 076. Funcionou — 3 estações e
417 mm de balanço — e **quebrou duas outras coisas**, medidas pela varredura
geral:

    TANK_R_2 ▸ chassis_p12    30 → 54 mm de penetração (encaixe assumido: 40)
    MAO__metal-preto ▸ chassis_p15 / p21 / p19    28 / 27 / 20 mm — NOVOS

A primeira é a armadilha que §46 registra pelo outro lado: `TS_TANQUE_VM` é
POSTO com a face externa no teto, não encolhido, então **o teto mais baixo
empurra o conjunto inteiro — berço junto — para dentro da longarina**.

A segunda é uma cegueira antiga que só apareceu quando a estação passou a caber
sobre o tanque: `truckArmObstacles()` varria a faixa do BRAÇO (780…990 mm) e a
MÃO-FRANCESA mora 214 mm abaixo dele (626…874). Desde que a ferragem passou a
SUBIR com a barriga (§46), a janela varrida começava em 1 050 e a mão inteira
ficava fora dela.

O conserto que ficou não toca no tanque: **quem cedeu os 10 mm foi
`FOLGA_LATERAL`**, de 155 para 145, do lado da GRADE — que é quem tem ar
sobrando (o montante está em 1 112 e o teto do equipamento em 1 100, ou seja
12 mm reais, não 20). E `BRACO_FAIXA_Y` desceu para 560…990, para a varredura
enxergar a mão.

### 48.4 O resultado, nas dez configurações

    Scania 8x2   corrido dianteiro  −350…1 813 → −350…2 113   (+300 mm)
                 estações no trecho      2 → 3
                 balanço da ponta   1 499 → 417 mm
    Scania 6x2/4x2/6x4  balanço 417/399, vãos 1 088/1 213/988 (teto 1 250)
    VM (3)       folga do montante ao tanque 28 mm; a mão-francesa SAIU de
                 dentro do tanque (46 mm de penetração, dois flancos)
    VW (3)       o 4x2 saiu de 2 defeitos para 0 — o grampo da grade batia na
                 travessa do implemento em |x| 600

⚠️ A varredura geral (`checks-varredura-0823.mjs`) foi rodada ANTES e DEPOIS
de cada passo: **12 falhas no baseline, 5 no fim das duas frentes** — sete a
menos, nenhuma nova. E o que sobra é UMA coisa só, em duas configurações: o
para-lama do 2º direcional contra o implemento (`t_paralama ▸
FUSAO__metal-preto__b3`, 26 mm no Scania 8x2 e 124 no VM 8x2), que é a pendência
de §45 e não tem relação com a grade. Sem o baseline essa comparação não valeria
nada: o portão nunca esteve verde.

### 48.5 O portão novo guarda a CADEIA, não o sintoma

`checks-grade-flanco-0824.mjs`, nas dez configurações:

    ★ A  o limiar de amputação (xGuarda − FOLGA_BARRA) fica ACIMA do teto do
         equipamento de flanco — é a régua que faltava, e é ela que impede a
         terceira ida ao mesmo defeito
    ★ B  nenhum tanque, ARLA, bocal ou berço passa do teto
    ★ C  o corrido COBRE o equipamento de flanco (fora das baias de roda)
    ★ D  e o corrido não encolheu, contra a régua medida nesta data

⚠️ `GRADE_FACE` é constante porque `recessFlankEquipment()` roda no
carregamento da CABINE, quando o implemento ainda não existe e não há o que
medir. Se entrar um implemento mais estreito que o sobrechassi, ela tem de
descer junto — e é ★ A que avisa.

### 48.6 O que ficou pendente

O **VW continua com 1 283 e 1 503 mm de balanço** na ponta traseira do corrido
dianteiro. Não é o tanque (o dele está em |x| 1 000, folgado): é o rip, que é
UMA malha só (`truck_p4`) e cuja lista de obstáculos cobre o chassi quase todo —
o mesmo problema que §45.1 registra. Fica para uma frente própria; mexer nele
pela foto é exatamente o erro de método do §43.10.

## 48-B. O SUPORTE, na régua do modelo do dono

> *"olhe esse modelo 3D, é assim que deveria ser o suporte que segura essa grade
> no implemento, literalmente desse jeito; eu diminuí o comprimento da barra
> horizontal que conecta no implemento porque aqui está muito estranha"* —
> Kennedy, 2026-08-24, com `scene.glb`.

O arquivo é a própria grade, seis papéis, e a comparação peça a peça contra
`protecao_lateral_v2.glb` diz tudo em três linhas:

| peça | no v2 | no modelo do dono |
|---|---|---|
| `BRACO__` | −930…−80 (**850 mm**) | −446…−38 (**408 mm**) |
| `MAO__` | −449…−52 (397 mm) | −449…−52 (a MESMA) |
| `GRAMPO__` ×2 | −925…−419 | **não existem** |

Ou seja: **o braço termina onde a mão termina** — 446 contra 449 — e o par de
grampos sai. A consola é um TRIÂNGULO, não uma barra atravessando o vão.

### 48-B.1 O que o motor fazia, e por que ficava estranho

§46 mandou o braço morrer na estrutura do implemento (`pontaTravessa`, medida em
|x| 638 no Scania). Está certo para um implemento cujo flanco é estrutura de
cima a baixo — o semirreboque, de onde a peça veio. No sobrechassi isso põe o
braço **164 mm além da mão-francesa que deveria escorá-lo**, e ainda monta os
dois grampos, que no original abraçam a alma de uma longarina solta e aqui não
abraçam nada. Medido na cena: `GRAMPO__inox-ferragem` em |x| 553…1 047 — meio
metro de barra pendurada no ar por cima do tanque.

### 48-B.2 O conserto, com o asset que já existe

Nada de asset novo: as três mudanças são de régua, e ficam em `side-guard.ts`.

    alvo do braço   Math.max(pontaTravessa, xAlvo + MAO_PONTA_DENTRO_X)
                    — o braço nunca passa da mão (|x| cresce para fora, então
                      o maior é o mais curto)
    grampos         só quando NÃO há `pontaTravessa` — o caminho de volta, em
                    que o braço mira a longarina e há alma para abraçar
    mão-francesa    estica pelo mesmo alvo (`kMao`), para o dia em que a
                    estrutura do implemento venha mais para fora que ela

E `BRACO_ESCALA` desceu para 0,42: a conta agora fecha em **0,434**, que são os
369 mm de braço do modelo (408 no arquivo do dono, cuja ponta de fora está
42 mm mais para dentro que a do asset).

Medido depois, no Scania 8x2, contra o arquivo do dono convertido para a cena:

    BRACO   |x| 806…1 175   (modelo: 805…1 213)
    MAO     |x| 805…1 202   (modelo: 802…1 199)
    GRAMPO  ausente          (modelo: ausente)

⚠️ **A ferragem passou a faltar em metade das estações do Scania** (2 de 4,
contra 3 de 3 antes) — e isso é a régua funcionando, não um defeito: com
`BRACO_FAIXA_Y` enxergando a mão-francesa (§48.3), a estação que nasce em cima
do tanque fica só com suporte e montante, porque a diagonal cairia dentro da
chapa. É o que o implementador faz.

### 48.7 Como reproduzir

```
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-grade-flanco-0824.mjs
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-varredura-0823.mjs
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-grade-apoio-0824.mjs
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-suporte-0824.mjs
```

O primeiro é o portão; o segundo é o baseline de sobreposição (cinco falhas
conhecidas, todas do para-lama de §45); o terceiro mede onde cada estação caiu e quanto de
balanço sobrou em cada ponta; o quarto mede a consola contra o modelo do dono e
tira as duas fotos do ângulo da queixa.

## 49. 2026-08-24 — o caminhão esticado: flanco, tandem e o comprimento do baú

> *"agora no truck, mova os tanques para próximo da cabine, e as rodas e estepe
> também mas apenas um pouco"* · *"o bitruck agora o conjunto de rodas e estepe
> deve mover 40 cm para trás, o truck 30 cm para frente"* · *"o toco não precisa
> de nenhuma mudança de roda, este, cuidado com isso"* · *"defina as medidas
> padrões do implemento para: bitruck 9,50, truck 8,50 e toco 7,50"* — Kennedy,
> 2026-08-24.

A causa de tudo é uma só, e está no bake: **os quatro rígidos do Scania saem do
mesmo arquivo**. O 8x2 é o rip; o 6x4, o 6x2 e o 4x2 são recortes dele
(`cut-scania.cjs`), e a cirurgia só APAGA. O entre-eixos continua o do bitruck em
todos — 6 572 mm do direcional ao trativo no 6x2 —, e o equipamento de flanco
continua onde estava. Medido no 6x2 (Zn, frente positiva):

    traseira da cabine        688
    ————— 1 945 mm de NADA —————
    tanques + ARLA        −1 257 … −2 712
    estepe                −2 897 … −3 889
    eixo trativo          −4 932

### 49.1 O avanço do flanco — a conta se protege sozinha

`recessFlankEquipment()` ganhou um `dz`: o conjunto (tanques nossos, ARLA, bocal
e berço) anda para a frente até ficar a `FOLGA_CABINE` da cabine. O limite é o
que vier primeiro — a traseira da cabine ou a baia do direcional MAIS TRASEIRO —,
e é essa segunda parcela que faz o **bitruck não andar**: lá o 2º direcional está
em Zn −575, dentro do vão, e a conta dá −617 mm. No VM e no VW ela fica abaixo de
`AVANCO_MIN` e também não anda. Nenhum número por caminhão.

`FOLGA_CABINE` é 900 mm, e os primeiros 400 eram demais: *"os itens foram muito
para frente … volte um pouco para trás, cerca de 50 cm"*. O número é do olho do
dono e está numa constante, não diluído numa conta.

### 49.2 O berço, DE NOVO — e a ordem da pesca é o que importa

O tanque de fábrica está invisível desde `swapTruckTanks()`, então o grupo
'tanque' nem chega a existir em `recessFlankEquipment()`: a ferragem dele nunca
tinha sido tocada, e enquanto o tanque novo nascia em cima dela ninguém via. Com
o avanço, ficou órfã. A pesca é a de `pegaOBerco()` (§46), com a região tirada da
caixa do tanque NOVO na posição ANTIGA.

⚠️ **E ela roda DEPOIS do laço dos alvos.** A região do tanque encosta na do
ARLA e `tomados` marca a MALHA inteira: pescando primeiro, o berço do ARLA
entrava ali, andava em z e **não recebia o recuo em x do grupo dele** — o degrau
de 123 mm do §46 voltava, agora por cima do tanque grande. *"corrija o suporte do
mini tanque com tampa azul, porque atualmente está sobre o tanque grande"*.
Quem pesca primeiro é o dono da peça.

### 49.3 O conjunto traseiro — `rear-bogie.ts`, e a régua é a PUREZA DO NÓ

    8x2 bitruck   −400 mm (recua)
    6x2 / 6x4     +300 mm (avança)
    4x2 toco         0    — ordem direta do dono

Para cada malha conta-se quantos vértices caem na janela do conjunto (os eixos
traseiros ± 950 mm, mais a caixa do estepe); passando de 98 %, o nó anda inteiro.
Medido no 6x2: `chassis_p34` 99,9 % (suspensão) e `chassis_p36/p37` 100 % andam;
`chassis_p14` 45 % e `chassis_p12` 12 % (longarina) ficam.

⚠️ **POR NÓ, e não por componente conexo** — aqui a unidade de §46 é a errada:
`chassis_p14` devolve centenas de componentes de 19 mm em |x| 408…440, que é a
REBITAGEM DA ALMA (railX 425), e todos cabem na janela. Quem move a rebitagem da
longarina move o caminhão.

⚠️ **E `axles.driveZ`/`liftZ` andam junto.** Elas são a régua da grade lateral,
do para-barro e do teto de balanço da CONTRAN 882/2021; mover a geometria e
deixar os números é o defeito clássico desta base — tudo continua "certo" e nada
bate. `findRigid()` devolve objeto NOVO a cada carga, então a soma não acumula.

### 49.4 Dois erros que a foto pegou antes do portão

1. **A rodagem traseira inteira sumiu.** A primeira versão subia "até o último
   ancestral abaixo da cabine" para não desmontar a roda que `swapTruckWheels()`
   pendura — e o rip do Scania pendura tudo sob um nó `Scene`: o que subiu foi o
   CAMINHÃO INTEIRO. A régua passou a ser nominal e curta: sobe-se só enquanto o
   ancestral for kit nosso (`VM_WHEEL_*`, `TS_*`).
2. **E sumiu de novo.** `updateMatrix()` antes de decompor RECOMPÕE a matriz a
   partir de `position`/`quaternion`/`scale` — que nestes nós são identidade,
   porque `freezeMatrices()` assou a pose na `matrix`. As rodas não sumiram:
   foram todas para o centro do caminhão. Decompõe-se a matriz CORRENTE.

### 49.5 O comprimento padrão do baú, por configuração

`BAU_PADRAO` em `models.ts`: 9,50 / 8,50 / 8,50 / 7,50. Ele é o ALVO, não um
teto — o baú de fábrica deste implemento tem 8,66 m e o bitruck pede 9,50, ou
seja o corpo CRESCE. Aplica-se uma vez por (chassi × implemento), antes do teto
legal, e a regra de mão dupla da CONTRAN passou a devolver o baú até ESTE número
em vez do comprimento do asset — senão o padrão se desfazia no quadro seguinte.
