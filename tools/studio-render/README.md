# `tools/studio-render` — os renders de card do Truck Studio

Produz **uma imagem por combinação** de `marca × modelo × chassi × cor`:

```
renders/trucks/<manufacturerId>/<modelId>/<chassisId>/<colorId>.webp   960 × 600
renders/trucks/<manufacturerId>/<modelId>/<chassisId>/neutro.webp      (sem cor escolhida)
renders/renders.json                                                   (o manifesto)
```

É esse manifesto que `engine/catalog/renders.ts` consulta **antes** de montar
qualquer URL de card — sem ele, todo card cai no placeholder de silhueta.

```bash
cd web
node tools/studio-render/shoot.mjs --dry            # só lista a matriz
node tools/studio-render/shoot.mjs --neutral        # um render por chassi (50)
node tools/studio-render/shoot.mjs                  # a matriz inteira
node tools/studio-render/shoot.mjs --only 'iveco/'  # uma marca
```

| opção | efeito |
|---|---|
| `--out <dir>` | raiz de saída (padrão: `$STUDIO_ASSETS_ROOT/v1/renders`) |
| `--only <regex>` | filtra por `<marca>/<modelo>/<chassi>` |
| `--neutral` | só os neutros |
| `--limit <n>` | para depois de n imagens — para conferir enquadramento |
| `--force` | refaz o que já existe (o padrão é **pular**) |
| `--jobs <n>` | abas em paralelo (padrão: núcleos − 2, teto 3) |
| `--dry` | lista e sai |

Retomável: sem `--force`, o que já está no disco não é refeito. Interromper e
recomeçar custa só os `load()` das geometrias.

## As três peças

| arquivo | o que é |
|---|---|
| `rig.ts` | a cena three.js, **no navegador**. Reusa `paint.ts`, `material-setup.ts`, `coupling.ts`, `view.ts` e `presets.ts` do engine. |
| `serve.mjs` | empacota o `rig.ts` com esbuild e serve página + assets + decoder Draco **na mesma origem**. |
| `matrix.mjs` | deriva a lista de trabalho de `brands.json` + `GET /studio/colors`. |
| `shoot.mjs` | o CLI: Playwright, fila, gravação, manifesto. |

## Decisões que não são óbvias

**Por que um navegador.** O shader de tinta é GLSL rodando sob three.js. O que
valida uma cor é a mesma pilha que o cliente vê; renderizar por outro caminho
seria uma segunda implementação da tinta, e a divergência apareceria
exatamente onde ninguém olha — no card.

**Por que uma cena própria, e não um print do estúdio.** O estúdio monta um
pátio inteiro (carreta engatada, cenário, céu, clima, HUD). Um card precisa do
cavalo. Dirigir o app por 823 combinações também obrigaria a passar pelo
seletor, pela cortina e pelo engate a cada troca.

**O que NÃO é reimplementado aqui.** A tinta, o preparo de material, a
normalização por `hitch.json` e a pose do card saem todos do engine, por
import. Foi para isso que `vehicle/material-setup.ts` foi extraído de
`models.ts` — ver o cabeçalho de lá.

**Fundo transparente.** É o contrato declarado em `catalog/renders.ts`: o halo
e a sombra elíptica sob o card são do `selector.css`. Por isso também **não há
sombra de chão** no render — ela empilharia com a do CSS, e a 46° de elevação
saía pela borda do quadro. O mapa de sombra continua ligado: a auto-sombra
(cabine sobre chassi, defletor sobre tanque) é o que dá volume.

**A pose sai das fotos de catálogo, medida.** `CARD_VIEW_DIR` é **az 38° ·
el 3,5°** — frente quase inteira, lateral encurtada, do teto só uma fresta.
Era az 52° · el 8,1°, e com o quadro cheio (88 % da altura) isso punha a
câmera a 3,1 m do chão, acima da metade de uma cabine de 4 m: olhando para o
capô. A 3,5° ela cai para ~2,4 m, altura de janela de motorista. A derivação
está no comentário de `scene/view.ts`.

**Três softboxes + um estúdio que a lataria reflete.** Uma luz direcional
deixa no verniz um realce PONTUAL; o que se vê numa foto de estúdio é uma
FAIXA — o reflexo do painel, esticado ao longo da carroceria. São três
`RectAreaLight` (topo, lado da câmera, kicker traseiro) postas no referencial
do VEÍCULO, então o realce cai no mesmo lugar da lataria nas 50 geometrias.
E o ambiente refletido não é o `RoomEnvironment` do three: aquilo é uma caixa
branca, e uma caixa branca aparece na lataria como cinza uniforme. O
`makeStudioEnvironment()` monta chão preto + paredes escuras + os mesmos três
painéis — o chão escuro é o que cria a **linha de horizonte** no meio da porta,
que é a leitura de "chapa polida" em vez de "plástico".

**Edição especial não passa pelo motor de tinta.** `paintMaterials: []` no
`brands.json` do S-Way 480 Metallica. Sem isso, `makePaintMaterial()` preserva
o `map` de origem e o three multiplica a película M72 pela cor escolhida: os
adesivos aparecem, em tons de vermelho, sobre um caminhão vermelho.

**Enquadramento pela SILHUETA, não pela caixa envolvente.** A caixa é 3D:
num corpo comprido visto a 38° de azimute, os cantos extremos caem muito além
da silhueta, e o excesso cresce com o comprimento — um 6x4 sairia menor que o
4x2 do mesmo modelo. Medido: caixa a 88 % da altura entregava caminhão a 66 %,
com mais de 6 % de diferença entre chassis do mesmo modelo. Medindo a silhueta
(3 renders a 1/4 de resolução, uma vez por geometria), as 50 geometrias ficam
em **0,877–0,887 de altura, centro em 0,498–0,501 × 0,475–0,482** — a régua
comum que torna um card comparável com o vizinho.

**A matriz não é o produto cartesiano.** `matrix.mjs` aplica as mesmas três
regras do engine: a paleta é a da montadora (`colorsFor`), uma edição especial
não tem passo de cor (`specialEdition` — o S-Way 480 Metallica mantém a
película M72), e um chassi "Em breve" ganha o neutro e nenhuma cor.

## Depois de rodar

A árvore de saída é servida pela API sob `STUDIO_ASSETS_ROOT`. Um `v1/` vivo
**nunca** é sobrescrito no lugar (`Cache-Control: immutable` — o cliente não
revalida): renderize para um diretório novo e troque, ou publique em `v2/`.

## Requisitos

- **Chromium com WebGL2.** Achado por `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, ou
  pelo build mais novo em `~/.cache/ms-playwright`. O `headless_shell` do
  Playwright **não** serve: vem sem a pilha de GPU.
- **esbuild**, que vem do vite — nenhuma dependência nova no `package.json`.
- Nada mais. O WebP com alfa é codificado pelo próprio Chromium.

Sem GPU o backend é `llvmpipe` (software) e cada imagem custa ~2 s depois de a
geometria estar carregada; a matriz inteira roda em dezenas de minutos. Numa
máquina com GPU exposta ao headless, é uma fração disso.
