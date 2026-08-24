# `tools/checkin-guides` — os guias de foto de check-in / check-out

Produz, por POSE, duas imagens do implemento **sem cavalo**:

```
public/guias-foto/guia/<pose>.png      desenho de linha, branco pré-multiplicado
public/guias-foto/render/<pose>.png    sombreado, fundo transparente
public/guias-foto/manifest.json        poses, câmeras, regras
```

O `guia` é o que vai fantasmado no visor da câmera; o `render` é o que a
interface mostra ao operador (“é ESTA foto que você tem de tirar”).

```bash
cd web
node tools/checkin-guides/shoot-inv.mjs                # inventário do GLB
node tools/checkin-guides/shoot.mjs                    # o jogo inteiro (14 poses)
node tools/checkin-guides/shoot.mjs --only 'lateral'   # um recorte
node tools/checkin-guides/shoot.mjs --length 9 --tag truck9   # baú curto
node tools/checkin-guides/app/server.mjs               # o app de teste
```

| opção | efeito |
|---|---|
| `--out <dir>` | raiz de saída (padrão `web/public/guias-foto`) |
| `--only <regex>` | filtra por nome de pose |
| `--kind guide\|shaded\|both` | o que gerar |
| `--length <m>` | redimensiona o baú antes (`TrailerRig.set`) |
| `--tag <sufixo>` | sufixo do diretório, para guardar uma leva |

## O problema, e por que ele não é “renderizar o modelo”

O implemento do Truck Studio tem **6,6 milhões de triângulos** e 39 materiais.
Só `inox-ferragem` são 1.155 malhas e 1,56 M de triângulos — dobradiças,
varões, rebites, parafusos. A pele lateral é **chapa frisada**: 46 ondulações de
5,2 mm de relevo, passo 53,00 mm. Nada disso é o pedido, que foi “o SHAPE, sem
friso, sem chapa”.

Três decisões dão conta disso, e nenhuma é um filtro de imagem:

**1. O desenho sai de um BUFFER DE IDENTIDADE, não de um detector de bordas.**
Um Sobel em normais faz o CONTRÁRIO do pedido: a normal do friso gira quase 90°
a cada 26 mm, então o detector devolveria 46 listras por lateral. Aqui cada peça
recebe um número de GRUPO (baú / porta / para-lama / roda / chassi), a cena é
renderizada chapada nesse número e a linha nasce onde o número MUDA. O friso não
produz linha porque os dois lados da ondulação são o mesmo grupo. Um segundo
canal carrega a profundidade em 16 bits sobre 60 m (0,9 mm por passo) e separa
duas peças do mesmo grupo que se sobrepõem — a roda de trás contra a da frente —
com limiar de 50 mm, dez vezes o relevo do friso.

**2. O friso sai da GEOMETRIA, não só do desenho.** `flattenRibs()` manda todo
vértice com |x| ≥ 1,29 para a crista, ±1,3035 — os quatro planos do relevo
(crista 1,30350, vale 1,29830 e as duas faces internas em 1,2975/1,2985, que são
a espessura de 0,80 mm da chapa) caem todos nessa faixa. São as medidas do
cabeçalho de `engine/vehicle/trailer-geometry.ts`, não um chute. Só a malha cuja
caixa encosta nos DOIS lados é achatada: as demais malhas brancas vivem em
espaços locais escalados (há vértices em x ±57) e um filtro por valor de X
sozinho as estragaria.

**3. A ferragem é DESCARTADA por material**, não escondida por opacidade. A
saliência máxima dela sobre a crista é 12 mm — não muda silhueta, só suja o
desenho.

## O que a bancada descobriu, e que nenhuma medida teria pego

**O friso voltou pela sombra.** Com a chapa já plana e a normal escrita à mão,
a parede ainda oscilava 234↔237 num passo de 5,33 px — que a 9,79 mm/px dá
52 mm, o passo do friso. Era **acne de shadow map**: a maior superfície plana da
cena é a que o mapa menos perdoa. Hoje o baú CASTA sombra e não RECEBE; chassi,
rodado e para-lama recebem, porque são escuros e recortados e é ali que a sombra
dá volume. Desligar `shadowMap` zerava a oscilação — foi o teste que fechou o
diagnóstico.

**A traseira saía cortada nos quatro lados.** A distância era contada da mira, e
a mira estava no centro do implemento: 10 m de mira ao centro são 2,7 m de
câmera à porta. Cada correção de escala andava duas vezes e meia o que devia, e
o ajuste oscilava. `aimZ` põe a mira no plano das portas e a alavanca volta a
ser a distância ao assunto.

**A mira fugia nos closes.** Recentrar quer dizer “traga a silhueta para o meio
do quadro”, e a silhueta de um close é o veículo inteiro. A carenagem, pedida em
y 3,55 / z +6,55, terminava em y 3,48 / z −0,02 — o meio da carreta. Daí
`travaMira`.

**A chapa lisa saía salpicada de pontos.** Não era friso (a pele já estava
achatada) nem ruído do detector: depois do achatamento, peças que viviam dentro
do vale ficaram COPLANARES com a crista — `plastico-preto` tem caixa em x ±1,304
e `metal-estrutura-principal-padrao` em ±1,308, contra a crista em 1,3035, meio
milímetro de cada lado. O z-buffer escolhia uma ou outra por pixel, o número do
grupo piscava, e cada pisca virava um ponto. Empurrar a pele para fora só troca
quem ganha a disputa; o que separa ponto de desenho é o TAMANHO. Hoje as
componentes conexas de borda com menos de 24 px do buffer supersampleado (6 px
do quadro final) são apagadas ANTES da dilatação — depois dela já teriam
engordado até a espessura da linha e não dariam para distinguir. A menor feição
que o jogo precisa mostrar, o contorno de um fecho de porta, passa de 60 px.

## Simetria — o campo `espelhoDe`

O pedido foi que as fotos parem de ser desconexas: *“o mesmo ângulo de um lado e
do outro deve dar exatamente o mesmo resultado”*. Ajustar cada pose pela própria
silhueta **não** entrega isso: o implemento não é simétrico (caixa de ferramenta
e porta lateral só existem em −X), e dois ajustes independentes devolvem
distâncias diferentes.

Então o lado **esquerdo é resolvido** e o **direito é o espelho aritmético**:
câmera e mira com o X trocado de sinal. Mesma distância, mesma altura, mesmo
FOV — por construção. O par dianteira/traseira usa `mesmaDistanciaQue`: a
traseira herda a distância da dianteira e só recentra. Os azimutes são 60° / 90°
/ 120°, ±30° da perpendicular.

O que **não** é espelhado é a imagem: o guia da lateral direita mostra a
testeira para o outro lado, porque é isso que a pessoa vê ao dar a volta no
veículo.

`shoot.mjs` avisa quando `--only` deixa a pose base de fora — nesse caso o
espelho é ajustado sozinho e a garantia se perde.

## De onde saem os números da câmera

Da amostra de 88 fotos de check-in do servidor (`/srv/files/Clientes/…/Checkin`):

| o quê | medido | onde entra |
|---|---|---|
| quadro | 1600×900 e 900×1600, sem exceção, sem tag EXIF | `w`/`h` |
| fotos por O.S. | laterais 5,6 · traseira 1,4 | 3 poses por lado |
| orientação | lateral paisagem, traseira/frontal retrato | `LAND`/`PORT` |
| enquadramento | baú de x 95 a 1500 (0,88 da largura), teto em 0,21, pneu no chão em 0,63 | `fillW` 0,88 · `cy` 0,44 |
| altura do olho | ver abaixo | `camY` 1,55 |

**A altura fecha por conta.** Câmera NIVELADA a 1,55 m, a 12 m da parede: o
meio-quadro vale 12·tan(20,78°) = 4,55 m, então o quadro cobre de −3,0 m a
+6,1 m. O teto do modelo (4,169 m) cai em 0,21 do topo e o chão (0) em 0,67 — os
dois batem com a foto medida. Ou seja: 1,55 m está certo **e** a foto boa é
feita com o celular nivelado; `cy` 0,44 é só onde o centro da silhueta
(y 2,085 m) cai quando isso acontece.

`fovLongDeg` 68° é a principal de celular (≈26 mm equivalentes) no eixo LONGO do
quadro — em retrato o eixo longo é o vertical, e o cálculo de `vFovFor()` trata
os dois casos.

## O que a bancada NÃO promete

- **A frota varia e o guia é um só.** O modelo é uma carreta de 14,71 m; boa
  parte das fotos é de truck rígido. Use `--length` para uma leva curta.
- **Não há unidade de frio neste GLB** (`thermoking.glb` é outro arquivo). O
  guia de `carenagem` enquadra o canto alto dianteiro do baú, que é onde a
  carenagem mora — serve de mira, não de silhueta da peça.
- **Cabine não tem guia**, por decisão: é serviço no cavalo, que não está na
  cena. As 115 O.S. de “padronização/plotagem/adesivo de cabine” caem em
  “câmera limpa”.
- **Não há pose de TETO.** Havia, e estava errada de um jeito que enquadramento
  nenhum conserta: para ver o teto de um baú de 4,17 m a câmera tem de estar
  acima dele, e a pose punha o olho a 5,50 m do chão. Isso não é difícil, é
  impossível — o operador está de pé no pátio. A foto real sai de escada, de
  plataforma ou de mezanino, e qual dos três muda altura, distância e azimute;
  a amostra não decide (a única foto de "pintura teto" das 88 já não existia no
  disco). Até alguém dizer de onde ela é tirada, as 129 O.S. de teto ficam em
  "câmera limpa". Voltar a pose é uma linha em `poses.mjs`.

  **Toda pose que sobrou é alcançável a pé**: `camY` só assume 1,55 m (em pé),
  1,20 m (meio agachado, chassi) e 1,05 m (agachado, rodagem).

## Cobertura da regra descrição → jogo de fotos

Sobre as **4.538 O.S. de produção** do banco: **88,6 % recebem guia** (91,4 %
antes de o teto sair do jogo).

| jogo | O.S. |
|---|---|
| lateral + traseira + frontal | 1.957 |
| lateral | 819 |
| traseira | 640 |
| frontal | 193 |
| carenagem | 169 |
| rodas | 83 |
| chassi | 79 |
| traseira + frontal | 47 |
| lateral + traseira | 30 |

Os 277 restantes são descrições genuinamente mudas — “Outros” (117), “Reparos
Superficiais”, “Pintura Parcial”. Guia nenhum é a resposta certa para elas.

A regra é por palavra-chave sobre o texto **normalizado** (NFD sem acento), e
não por igualdade: o banco escreve a mesma coisa de seis jeitos — “logomarca
padrÃo”, “logomarca padrão”, “pntura da frente e traseira”, “remoÇÃo geral”. A
decomposição NFD também conserta a mojibake, porque “Ã” decompõe em “A” + U+0303.

## As peças

| arquivo | o que é |
|---|---|
| `guide-rig.ts` | a cena three.js, **no navegador**. Carrega `trailer.glb`, monta `TrailerRig` do engine, classifica, achata o friso, resolve a pose e desenha. |
| `poses.mjs` | o jogo de poses e as regras descrição → jogo. Compartilhado com o app (servido como `/regras.mjs`). |
| `shoot.mjs` | o CLI: Playwright, espelhamento, PNG, manifesto. |
| `inv.ts` + `shoot-inv.mjs` | inventário do GLB por material — a base da classificação. |
| `xhist.mjs` | sonda de uma pergunta: sobrou friso na pele? Um X por lado = chapa lisa. |
| `harness.mjs` | servidor + esbuild + Chromium, comum às bancadas. |
| `app/` | o app de teste (ver abaixo). |

## Os dois apps de teste

O guia só significa alguma coisa dentro de um visor de câmera, então o app que
importa é o **`guias_foto/`** — Flutter standalone, na raiz do monorepo, com
câmera, nível de bolha e as poses embutidas como asset. Ver o README de lá.

O app web abaixo continua valendo para o que o celular faz mal: comparar o guia
com o ARQUIVO de fotos de check-in em tela grande.

## O app de teste WEB

```bash
node tools/checkin-guides/app/server.mjs           # http://127.0.0.1:8130
ANKAA_API=https://api.ankaadesign.com.br node tools/checkin-guides/app/server.mjs
```

Ele responde três perguntas, e cada modo existe por uma delas:

1. **A regra acerta?** A lista traz O.S. de produção **de verdade**, da API, com
   os grupos que a regra deduziu já visíveis na linha. Testar contra descrições
   inventadas não valeria nada.
2. **O enquadramento bate com a foto real?** O modo **Sobre a foto** desenha o
   guia por cima das fotos de check-in que aquela mesma O.S. já tem. É a única
   prova honesta da pose.
3. **Como fica no visor?** O modo **Câmera** abre a webcam com o guia por cima e
   o mesmo controle de intensidade que o app tem. (O navegador só libera câmera
   em `localhost` ou HTTPS.)

O servidor faz **proxy** de `/api` porque a API de produção não abre CORS para
outra origem; o token vai e volta no header, nada é guardado no servidor.

## Requisitos

- **Chromium com WebGL2** do cache do Playwright. O `headless_shell` não serve.
  `harness.mjs` acha o `.app` do macOS além dos caminhos de Windows e Linux —
  algo que o `findChromium()` da bancada da porta não fazia, porque nasceu em
  Linux.
- **esbuild**, que vem do vite. Nenhuma dependência nova.
- `models/vehicles/trailer.glb` em `web/public` (ver a nota de sync do
  `studio-assets`).

Sem GPU o backend é `llvmpipe` e cada pose custa 10–20 s; o jogo inteiro sai em
poucos minutos.
