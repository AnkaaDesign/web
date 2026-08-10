# Bancada do implemento — pixel, sem abrir o app

`tools/studio-render/` fotografa o **cavalo** para os cards do seletor e não
carrega implemento nenhum. Esta bancada é a contraparte: sobe o `trailer.glb`
num three.js headless, roda **o código de verdade** (`swapTrailerWheels()`,
importado de `engine/vehicle/`, não uma cópia) e devolve PNG + diagnóstico.

Ela existe porque a troca de rodagem foi entregue verificada por medida e por
build — e chegou **quebrada na tela**: a roda saiu montada ao contrário, com o
disco enterrado para dentro do rodado. Todos os números batiam; nenhum deles
olhava para o resultado. Uma medida que não vira imagem não prova aparência.

## Rodar

```bash
node tools/trailer-bench/shoot.mjs        # rodagem: diagnóstico + A/B em shots/
```

Serve três origens numa porta só (a página, o bundle esbuild do `probe.ts` e a
árvore de `/srv/studio-assets/v1` direto do disco, mais `/vendor/draco/`), abre
o Chromium do Playwright que já está em `~/.cache/ms-playwright/chromium-1223/`
e lê o canvas de volta. Mesma origem para tudo — sem isso o `GLTFLoader` falha
por CORS e o `toDataURL()` lança por canvas contaminado.

**Os aliases do esbuild são obrigatórios.** O `probe.ts` mora fora de `web/`, e o
esbuild resolve `three` a partir do ARQUIVO que importa, não do
`absWorkingDir` — daí os aliases explícitos para `three` e `three/addons`.

O A/B enquadra **a mesma caixa** nos dois lados e só alterna a visibilidade.
Fotografar a roda nova num enquadramento e a velha noutro compara duas fotos.

## `probe.ts` — a rodagem

Carrega implemento + `wheel_fh16.glb`, roda `setupCommon()` e
`swapTrailerWheels()`, reproduz o que `applyTrailerFinish()` faria com a
borracha (senão a comparação mente para os dois lados) e despeja, por malha,
atributos, materiais e caixas. Foi esse despejo que mostrou o disco em
x ≤ +0,045 contra o pneu em +0,386 — a roda ao contrário.

## `doorprobe.ts` / `shoot-door.mjs` — a porta lateral

```bash
node tools/trailer-bench/shoot-door.mjs   # diagnóstico + 5 PNGs em shots-porta/
```

Sobe só o `TrailerBody` (sem `TrailerAssembly`, sem engate — nada disso tem a ver
com porta), cadastra a porta de fábrica (0,87 × 2,35 m, a 4,00 m da testeira) e
mede.

**Ela achou seis defeitos que nenhuma medida teria achado**, e vale registrar os
seis porque quase nenhum é visível num diff:

1. **Fresta no passo do friso.** O rasante mostrou um tracejado escuro dos dois
   lados da porta, a cada 53 mm. Não era z-fighting: a moldura entrava 1 mm na
   parede, e uma caixa de face reta contra chapa ONDULADA só toca as cristas —
   em cada vale sobrava a fresta de 5,2 mm do relevo. Resolvido de vez quando a
   moldura saliente deu lugar ao batente RECUADO: ele não encosta na chapa.
2. **A moldura desenhada como contorno de 1 px.** As duas faces em X do `box()`
   estavam com o ENROLAMENTO invertido. O three descarta por enrolamento, não
   pela normal declarada — então a face de 58 mm virada para a câmera era
   *culled* e sobrava a silhueta do sólido. Quem separou "a peça não existe" de
   "a peça existe e não é desenhada" foi o disparo `sonda-cores`, que chapa uma
   cor por família: a moldura saiu magenta **em contorno**, e isso é geometria,
   não iluminação. É por causa deste defeito que o batente de hoje é
   `DoubleSide` com normal escrita à mão.
3. **Dobradiças contadas pelo eixo errado.** `hingeCount` comparava `z1 - z0` —
   a LARGURA — com 1,20 m, numa decisão que é da ALTURA. Uma porta de 2,10 × 1,10
   saía com três dobradiças em vez de quatro, e o número era plausível.
4. **A porta nascendo dentro da cantoneira inferior.** Ela era ancorada em
   `floorY`; o perfil galvanizado da saia sobe 127,5 mm ACIMA daquela linha. O
   levantamento `faixa_baixa_lateral` é o que mostrou isso por material, e o
   batente passou a ser MEDIDO (`measureSill`, mediana por célula de 250 mm ao
   longo do baú, para não confundir o perfil corrido com um montante de canto).
5. **O vão aberto para dentro do baú.** A folha recuava 25 mm e o vão era só
   12 mm maior que ela, "para a folha tapar a vista". Tapa até
   atan(12/25) = 25,6° fora da normal — abaixo de qualquer volta de câmera do
   estúdio. De frente não se via porta nenhuma (uma fresta de 12 mm entre duas
   chapas de espessura zero não sombreia), e de lado via-se o interior. O
   conserto é `jambGeometry()`: o vão volta aos 94,5 mm medidos e o BATENTE, a
   73 mm de profundidade, o fecha — 12 quadriláteros, 24 triângulos por porta.
6. **A ferragem descolada da folha.** As saliências de `OUT_*` foram medidas
   contra a crista da pele num implemento cuja folha está 5,1 mm atrás dela. Com
   a folha a 25 mm, sobravam 17 mm de ar entre a dobradiça e a porta que ela
   parafusa — que é exatamente a leitura de "a porta está virada para dentro".
   Voltando `LEAF_INSET` à medida, as duas famílias de números voltam a ser
   consistentes por construção.

Ela também mede três coisas que o olho não julga:

| o quê | como | resultado |
|---|---|---|
| batente completo | conta triângulos e mede a profundidade contra a crista | **marco + borracha, medidos**, material do GLB |
| âncora dianteira | alonga 1 m e sobe 32 cm, relê o Z do batente | `[2,345 · 3,215]` = o esperado, **invariante** |
| passo da dobradiça | `trailer-door.test.ts`, três alturas de porta | **687,9 mm fixo**, contagem 4 / 3 / 4 |

Uma armadilha da própria sonda fica registrada no arquivo, porque devolve
resultado plausível em vez de erro: uma janela de medição no MEIO da porta vem
vazia — a chapa lateral é extrusão pura em Z e só tem vértice nos dois anéis das
pontas. A outra, `folga_folha_parede`, foi REMOVIDA: ela pressupunha folha e
parede na mesma faixa de Y/Z, o que deixou de valer quando o vão passou a ser
recortado, e continuava reprovando com um número que não apontava defeito nenhum.

Os disparos `pintado-*` existem porque **branco sobre branco é o pior caso de
leitura**: com `metalness = 1` num ambiente de sala branca, galvanizado e tinta
branca devolvem quase a mesma luminância. No estúdio o baú é pintado e a folha
vai junto (ela É a chapa) enquanto moldura e ferragem não — julgar a porta só em
branco é julgar o caso em que ela menos aparece.

`shoot-door.mjs` deriva todos os caminhos (raiz do repo, esbuild, Playwright,
Chromium) em vez de escrevê-los, e por isso roda em Windows e em Linux sem
edição. O `shoot.mjs` ao lado ainda tem `/home/kennedy/...` no corpo.

## `tkprobe.ts` — o Thermo King

Não tira foto: mede. Reproduz as duas formas de resolver a pose da unidade — a
antiga, em mundo com `Box3` de nó girado, e a atual, por vértice no referencial
do implemento — sob as inclinações que o engate aplica (`pitchX`, derivada da
altura da quinta roda, ou seja **do chassi do cavalo**).

Medido com `orientYaw = 0`, que é o que o solver devolve para o implemento:

| inclinação | ANTIGO (local) | ATUAL (local) |
|---|---|---|
| 0,000° | z 7,2330 | z 7,2330 |
| 0,661° | z 7,2500 | z 7,2330 |
| 1,400° | z 7,2722 | z 7,2330 |

O encosto traseiro da unidade andava 17 mm a 0,661° e 39 mm a 1,4°, e o valor
mudava com o cavalo escolhido. A leitura da travessa em mundo derivava muito
mais (5,2939 → 5,1160, **178 mm**); no eixo Y isso quase se cancelava contra a
caixa das chapas, o que é pior que não cancelar — escondia o defeito.

A coluna ATUAL é **invariante nas cinco inclinações**, que é a garantia pedida:
a unidade acompanha o implemento por construção, não por alguém se lembrar de
reposicioná-la.

## O que ela não faz

Não sobe o estúdio — sem cenário, sem HUD, sem seletor, sem engate. É luz de
sala (`RoomEnvironment`) mais uma direcional. Serve para **geometria e
material**; para julgar iluminação de cenário, é o app.
