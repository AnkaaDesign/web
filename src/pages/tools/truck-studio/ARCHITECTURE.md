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
