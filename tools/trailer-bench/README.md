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

## `implprobe.ts` / `shoot-impl.mjs` — o IMPLEMENTO NOVO

```bash
node tools/trailer-bench/shoot-impl.mjs                                   # o sobrechassi
node tools/trailer-bench/shoot-impl.mjs semirreboque_frigorifico_paleteiro.glb
SS=3 node tools/trailer-bench/shoot-impl.mjs                              # superamostrado
```

As outras duas bancadas medem UM implemento conhecido. Esta responde a pergunta
que só aparece quando chega um bake novo: **`TrailerBody` sabe ler este baú?**

Ela existe porque `TrailerBody` é dirigido por MEDIDA e não por nome de peça —
decompõe o branco em cascas conexas e classifica cada uma. Isso é o que o torna
portável entre bakes, e é também o que faz a falha ser **silenciosa** quando ele
não é: um baú em que nenhuma casca vira `RIBBED` não lança erro (o
`buildTrailerRig()` engole a exceção de propósito) e o usuário descobre no
primeiro arrasto do controle de altura.

O `sillMaterial` sai do próprio `models/vehicles/implements.json` — a bancada
julga o que o app vai montar, não uma variante escrita à mão.

**Foi ela que achou os quatro defeitos da rodada de 2026-08-18** (todos em
`ARCHITECTURE.md` §24), e nenhum deles aparecia num diff:

1. `0 cascas frisadas` no sobrechassi — a lateral dele são 17 folhas de 1 m e
   nenhuma atravessa 90 % do vão sozinha.
2. A folha da PORTA entrando na união da parede e matando o friso **de um lado
   só** (os frisos dela estão em outra fase).
3. `batente_mm: 8` — `measureSill()` casava `metal-galvanizado-mantido`, que
   este bake não tem, e a porta nascia dentro da cantoneira.
4. O par `rasante` × `rasante-cru`: o A/B com o corpo paramétrico escondido
   provou que a cintilação era do BAKE. E o `?ss=3` separou o que era empate de
   z-buffer (a costura coplanar do remonte) do que era **aliasing** de malha
   sub-pixel — que some com mais pixel e não se conserta com profundidade.

## `medir-0820.ts` / `medir-0820.mjs` — a MEDIDA, sem canvas e sem chassi

```bash
node tools/trailer-bench/medir-0820.mjs                    # os DOIS implementos
node tools/trailer-bench/medir-0820.mjs <arquivo.glb>      # um só
FOTO=1 ALVO='^metal-preto$' COTA='17,45,110' \
  node tools/trailer-bench/medir-0820.mjs                  # + fotos, com a família em magenta
```

Irmã do `shoot-impl.mjs`, com outra pergunta. Aquele responde **"o baú
paramétrico sabe ler este bake?"**; este responde **"esta peça está no mesmo
lugar nos dois implementos?"**, que é a pergunta de toda rodada em que o
semirreboque é o padrão ouro.

Ela sobe só o implemento, aplica as correções de bake **na ordem do app** e
grava um JSON por implemento em `medidas-0820/` (ignorado pelo git). ~20 s por
implemento, contra os ~7 min da bancada com `--geometry`.

O que sai:

| chave | responde |
| --- | --- |
| `A_engate` / `A_depois` | componentes conexas de cada ferragem fundida, e os grupos de índice depois da divisão |
| `B_perfil` | o perfil do friso DOBRA A DOBRA, dobrado pelo passo — e a fase da crista |
| `C_baixo` / `C_polidos_na_faixa` / `C_esbeltos_restantes` | o que mora na linha do piso, por família e nominalmente |
| `D_trilho` | a face do trilho contra a da pele, POR FLANCO, **antes e depois** da correção |
| `E_antes` / `E_fitas` | toda fita vertical com o delta para o montante dela, antes e depois |
| `varredura_da_faixa` | raycast da elevação do flanco: qual malha aparece em cada coluna de pixel |

**Três armadilhas que ela existe para não cair** (as três custaram meia sessão
em 2026-08-20; ver `ARCHITECTURE.md` §29):

1. **MUNDO contra RAIZ.** `TrailerBody.profile` mede em mundo e as caixas de
   malha saem no espaço da raiz. A sonda mede TUDO em mundo. Misturar os dois
   põe o montante de canto 717 mm abaixo do piso do baú, sem erro nenhum.
2. **A pele é uma EXTRUSÃO.** Ela não tem vértice entre os dois planos de corte
   — 55 038 vértices no flanco e ZERO na janela central de z. Quem separa o
   flanco da testeira é a NORMAL, não uma janela em z.
3. **`markShared()` antes de tudo.** Sem ela a correção de vértice roda duas
   vezes na geometria compartilhada.

E `FOTO=1` fotografa nos enquadramentos DAS FOTOS DO DONO (`friso`,
`canto-frente`, `canto-traseiro`, `engate-femea`, `banda-*`), em dois passes —
como está e com a família alvo em magenta. É a prova visual antes de remover
peça: foi ela que absolveu as lanternas laterais de chassi e condenou os sete
tubos embutidos.
