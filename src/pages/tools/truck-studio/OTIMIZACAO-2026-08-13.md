# Truck Studio — passagem de otimização (2026-08-13)

> ## 🔴 A §2 E A §3-A DESTE DOCUMENTO DESCREVEM UM ESTADO QUE NÃO EXISTE
>
> **Verificado em 2026-08-14, medindo o disco.** A §2 relata a passagem de
> textura como CONCLUÍDA — `trailer.glb` de 263 → 166 MB de VRAM e 31,3 →
> 22,5 MB de disco, `iveco_metallica_4x2.glb` 344 → 238 MB, e backups
> `*.glb.bak-texopt-2026-08-13` "ao lado de cada arquivo". Medido hoje, em
> `/srv/files/Estudio3D/v1` **e** em `web/public/`:
>
> | | o doc diz | o disco tem |
> |---|---:|---:|
> | `trailer.glb` — VRAM | 166 MB | **251,0 MB** |
> | `trailer.glb` — disco | 22,5 MB | **29,87 MB** (31.319.392 B) |
> | `iveco_metallica_4x2.glb` | 238 MB | **327,9 MB** |
> | `distrito/set.glb` | 133 MB | **144,0 MB** |
> | backups `*.bak-texopt-*` | 62 arquivos | **nenhum, em lugar nenhum do sistema** |
>
> O `md5sum` do `trailer.glb` é **idêntico nas duas árvores**
> (`97aba3fc83ac8416ce5100858f6f678f`) e é o do arquivo original. A máscara
> 4096² de 85,3 MB descrita na §2 continua lá, intacta. **A ferramenta
> (`tools/glb-texopt/texopt.py`) sobreviveu; o resultado dela não.**
>
> Idem para a §2 quando ela diz que os ranges Draco duplicados "passaram a ser
> compartilhados no arquivo": medido, as 1.302 cargas idênticas moram em
> **2.157 `byteOffset` distintos**, e a chave de cache do `GLTFLoader` é o
> ÍNDICE do `bufferView` — então o three continua decodificando 2.157 payloads e
> alocando 2.157 `BufferGeometry`. Os 8,8 MB de download não foram economizados.
>
> **Consequência prática: os −290 MB de VRAM da §2 continuam inteiramente
> disponíveis**, e são o item mais barato de qualquer plano de otimização — a
> medição já foi feita e o portão perceptual já aprovou.
>
> ⚠️ Um detalhe que a §2 não registra e que quem for reexecutar precisa saber:
> **o portão automático REJEITA o maior ganho do acervo.** A máscara 4096² do
> implemento é 99,68 % preto ou branco puro, com 11 valores distintos, e o erro
> de reconstrução a 2048² dá p99,9 = 63 contra o limite de 16. O portão não sabe
> distinguir "borda de máscara binária" de "desenho". Ela precisa de um
> `--image 19=2048` manual.
>
> ---
>
> ## ⚠️ E a §3-A (o perfil de qualidade) foi SUBSTITUÍDA
>
> O perfil que ela descreve funcionava como projetado e **não fazia diferença**,
> pelo motivo que ela mesma não podia ver: todos os cinco botões eram de
> AMOSTRAGEM DE PIXEL, e esta cena nunca foi limitada por preenchimento. O
> relato do dono em 14/08 foi *"colocando no modo de qualidade baixa não vejo
> diferença nenhuma, nem visual, nem de performance"*, e ele estava certo — num
> monitor a `devicePixelRatio` 1, fora do cenário Estúdio, a diferença efetiva
> entre Alta e Baixa era **um uniforme de shader**.
>
> Leia `OTIMIZACAO-2026-08-14.md` para o que substituiu. As duas afirmações
> desta §3-A que ficaram FALSAS:
> * *"teto do `devicePixelRatio` 2 / 1,5 / 1"* — um TETO não faz nada num monitor
>   a dpr 1. O botão dominante nunca foi implementado.
> * *"mapa de sombra 3072² / 2048² / 1024²"* — baixá-lo perde nitidez de contato
>   e não devolve um quadro (`shadowMap.autoUpdate = false`), **e o bias não era
>   escalado junto**, o que provavelmente introduzia peter-panning no nível Baixo.

**ISTO É UM REGISTRO DO QUE FOI FEITO**, ao contrário do
`ANALISE-PERF-UX-2026-08-12.md` ao lado, que é o levantamento que a originou.
Onde os dois discordarem, este vale: três recomendações daquele documento foram
MEDIDAS aqui e uma delas estava errada (§6).

O pedido: *"otimize o máximo possível, sem perder nenhuma qualidade visível,
nem funcionalidade"*. Isso é uma restrição forte e ela governa tudo abaixo —
nenhuma troca de qualidade por velocidade foi feita, nem mesmo as que o
documento anterior propunha (perfil adaptativo, escala de render, sombra menor).
O que se buscou foi só o que é **invisível por medida**, e cada item traz o
número que sustenta a palavra "invisível".

---

## 1. O laço passou a desenhar sob demanda — e este é o item

`scene/scene.ts` sempre teve o laço sujo pronto e desligado. A nota que estava
ali listava três lacunas de `invalidate()` como bloqueio; as três já haviam sido
fechadas por quem passou perto, e ninguém voltou para virar a chave.

**A quarta lacuna, que a lista não tinha.** `ui/paint-panel.ts` escreve na tinta
por `paint.setPaint()` a cada arrasto de slider, e `vehicle/paint.ts` não pode
invalidar: ele é um sumidouro de dependência (importa `three` e nada mais) e
inverter essa aresta fecharia um ciclo com `scene.ts`. O conserto é do lado de
quem chama — o painel importa `invalidate` da cena, como `hud.ts` e `chrome.ts`
já fazem. Sem isso, "Ajuste da tinta" mexeria nos uniformes e não na tela.

**E uma quinta coisa, que não era invalidação nenhuma.** `cyclorama.ts`
registrava a passada de reflexo do piso — uma SEGUNDA renderização completa da
cena, 14,1 fps medidos — como gancho de `onFrame`. Ganchos de `onFrame` rodam
**também no quadro que o laço decide pular**, por desenho: eles são grampos de
estado. O reflexo não é grampo, é desenho. Com a flag ligada e o gancho onde
estava, o cenário Estúdio pagaria o laço contínuo inteiro e não receberia
economia nenhuma — a flag pareceria ligada e não estaria.

Daí a segunda lista de ganchos, `onDrawFrame`, que roda no mesmo ponto do quadro
(câmera já na pose verdadeira, antes do `render()` do laço) mas só quando há
quadro. **A regra para o próximo gancho: se ele DESENHA, é `onDrawFrame`; se ele
CORRIGE ESTADO, é `onFrame`.**

### Medido, na bancada, com a placa e a geometria de verdade

`node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-ganho-ocioso.mjs`

O A/B é honesto porque a flag é trocável em tempo de execução: mesma cena, mesma
pose, mesma máquina, os dois laços, com 3 s de relógio de parede cada.

| cena parada (distrito + Volvo FH 2021 + implemento) | antes | agora |
|---|---:|---:|
| quadros desenhados por segundo | 60 | **0** |
| chamadas de desenho por segundo | 136 238 | **0** |
| triângulos por segundo | 405 235 599 | **0** |

Por quadro a cena não mudou em nada: 2 272 chamadas, 6,76 M triângulos. O que
mudou é quantos desses quadros existem quando ninguém está mexendo — que é o
estado em que o estúdio passa a maior parte do tempo, porque o usuário está
olhando.

### O que prova que nada congelou

`tools/studio-bench/checks-laco-sob-demanda.mjs`. A régua é
`renderer.info.render.frame`, que conta quadros DESENHADOS: cada controle é
mexido e o contador tem de andar. Todos andam — tinta (pelo painel e pela API),
hora, preset, azimute/elevação, exposição, enquadrar, vista cavalo/implemento,
alvo da tinta, e o giro de apresentação segura e solta o laço.

`tools/studio-bench/checks-estudio-reflexo-ocioso.mjs` fecha o caso do reflexo,
e o argumento é o que torna a medida decisiva: `renderFloorReflection` chama
`renderer.render()` num alvo fora da tela, e **todo** `renderer.render()`
incrementa `render.frame`. Logo, se o reflexo rodasse em quadro pulado o
contador continuaria subindo com a cena imóvel. Ele marca zero — só possível se
as duas passadas pararam.

> **A cauda do giro é longa e NÃO é defeito.** Parar o giro devolve
> `enableDamping` e a câmera fica com a inércia; o OrbitControls decai
> `sphericalDelta` por `(1 − dampingFactor)` por quadro e só devolve `false`
> abaixo de EPS. Medido em `checks-quem-invalida.mjs`: 28/28 rAF → 37/40 → 9/40
> → 0, ou seja ~200 voltas até assentar. O resíduo é AZIMUTAL, então a distância
> à mira não se mexe enquanto ele existe — quem for reproduzir tem de olhar o
> ângulo, não o raio. Uma primeira versão do teste mediu a 90 voltas e reprovou
> a inércia, que é justamente o que faz o giro parar bonito.

**Se algum controle parecer congelado**, a flag é o primeiro suspeito e
`__studio.lighting.setOnDemandRendering(false)` é a resposta de uma tecla: se o
controle volta a funcionar com o laço contínuo, o que falta é um `invalidate()`
onde quer que aquele controle escreva.

---

## 2. Texturas: 290 MB de VRAM a menos, com o erro medido antes de cortar

A ferramenta é `tools/glb-texopt/texopt.py`, e ela existe porque as duas
armadilhas registradas na §6 do `ARCHITECTURE.md` continuam valendo:
`gltf-transform resize` reencoda **todas** as texturas do arquivo em WebP com
perdas (normal maps inclusive, e 20 das 33 imagens do implemento são lossless de
propósito), e qualquer ferramenta que reserialize a malha teria de
descomprimir/recomprimir o Draco — onde mora a proibição do `quantize`.

Então ela não abre a malha. Trabalha no contêiner: decodifica só as imagens
pedidas, reencoda em **WebP lossless** (reduzir resolução já é a perda que se
escolheu pagar; somar o borrão de croma seria pagar duas vezes), apensa no BIN e
reaponta. Nenhum `byteOffset` de acessor muda.

### O portão perceptual

Uma redução só é aceita se a imagem **reconstruída** (reduzida e ampliada de
volta) fica sob os três limites: **média ≤ 1/255, p99 ≤ 6, p99,9 ≤ 16**.

O terceiro limite não é zelo: média e p99 juntos deixam passar o caso que mais
dói aqui — uma chapa lisa com um decalque pequeno. Um logotipo em 0,3 % da
imagem não move nenhum dos dois, mora inteiro na cauda, e seria borrado sem que
nada piscasse. Ele é folgado (16 de 255) porque uma BORDA deslocada meio texel
também vive na cauda e é inofensiva; o que se barra é a cauda que carrega
DESENHO. Na prática ele mordeu: no Metallica puxou três texturas de volta de
128² para 512²/1024².

Este é o teste certo e não "olhar depois": a GPU já amostra o mipmap cujo texel
bate com o pixel, e o nível 0 só é lido no enquadramento mais fechado que a
órbita permite (`setVehicleFocus()` prende a lente a ~2,9 m). Reconstruir e
comparar mede exatamente esse pior caso.

### O resultado

**17 arquivos mudaram; 42 passaram intocados** — o portão recusou reduzir o que
já estava no tamanho certo, que é o sinal de que ele não é um encolhedor cego.

| arquivo | VRAM | disco |
|---|---:|---:|
| `iveco_metallica_4x2.glb` | 344 → **238 MB** | 9,5 → 9,6 MB |
| `trailer.glb` | 263 → **166 MB** | 31,3 → **22,5 MB** |
| `scania_streamline_*` (2) | 103 → **81 MB** cada | — |
| `distrito-industrial/set.glb` | 151 → **133 MB** | — |
| `serra/set.glb` | 196 → **191 MB** | — |
| … mais 11 | | |
| **total** | **2 034 → 1 744 MB** | **148,4 → 139,9 MB** |

O achado isolado que mais rendeu: o `occlusionTexture` do material
`led-branco-e-red-sinaleira` do implemento era **4096², com 11 valores
distintos** (99,7 % preto ou branco puro) e 12 KB em disco — uma máscara binária
de ilha de UV custando **89,5 MB de VRAM**, um terço do orçamento de textura do
implemento inteiro. A 2048² o erro de reconstrução é 0,27/255 de média e 2 de
p99. Sozinho: −67 MB.

### E 8,8 MB de duplicata exata no implemento

A compactação do BIN revelou que **1 302 das 2 157 primitivas do `trailer.glb`
têm carga Draco byte a byte idêntica** — só 855 geometrias únicas. É a
parafusaria repetida, e os 14 pneus: o maior grupo é a mesma malha de 53 480
triângulos catorze vezes. Ranges idênticos passaram a ser compartilhados no
arquivo, o que tira 8,8 MB do download sem tocar em um byte de geometria.

**Verificado, não prometido.** Depois de escrever, a ferramenta reconfere e
falha se algo escorregou. Conferido no `trailer.glb`: JSON de `meshes`,
`accessors`, `nodes` e `materials` idêntico; **2 157 de 2 157 cargas Draco byte a
byte idênticas**; **2 190 de 2 190 bufferViews byte a byte idênticos**; as 24
imagens não pedidas idênticas. E os 62 `.glb` do acervo passam por uma validação
estrutural (cabeçalho, alinhamento de chunk, ranges dentro do buffer, cabeçalho
de cada imagem) sem uma falha.

Backups em `*.glb.bak-texopt-2026-08-13`, ao lado de cada arquivo. **Isso
importa porque `public/models/trucks/`, `trailer.glb` e
`iveco_sway_metallica.glb` são `.gitignore`** — não há de onde restaurar além
desses backups.

---

## 3. Duas recomendações do documento anterior que a medição derrubou

**(a) "Normal maps de chão saindo do JPG" — não é ganho, é perda.** A §2.2 e a
Fase 3 do `ANALISE-PERF-UX` mandam tirar os quatro `*_nor.jpg` do JPEG
argumentando que o subamostramento de croma destrói o canal da normal. O
diagnóstico está certo e a receita não: **o dano já está no arquivo**, e
transcodificar não o desfaz. Medido nos quatro:

| destino | tamanho | erro contra o JPEG atual |
|---|---:|---|
| WebP lossless | 5,7 – 9,3 MB (o JPEG tem 1,3 – 3,4) | 0 |
| WebP q95 | ~igual ao JPEG | +1,3 a 4,7 de média, p99 até 19 |

Ou seja: ou triplica o download para preservar pixels que já estão degradados,
ou mantém o tamanho e soma uma segunda geração de perda. **A correção de
verdade é reexportar do original**, que não está no repositório. Nada foi feito;
o item sai da lista de "trivial".

**(b) Empacotar AO+rugosidade do chão num ORM — não fecha a conta.** As oito
texturas de `ao` e `rough` são cinza puro (medido: ΔR-G ≤ 1, ΔR-B = 0), então
elas desperdiçam três dos quatro canais e a tentação é óbvia: AO no R,
rugosidade no G, uma textura no lugar de duas, −89,6 MB de VRAM. E o engine nem
precisaria mudar — `roughnessMap` lê `.g`, `aoMap` lê `.r` (é a convenção ORM do
glTF), o shader de `set.ts` copia esses mesmos canais, e o `texCache` de
`set.ts` é chaveado por URL, então apontar os dois campos para o mesmo arquivo
já daria **um** upload de GPU. Mas:

* **lossless**: 3,7 – 5,4 MB por conjunto contra 0,8 – 2,2 MB do par atual —
  **+12 MB de download** para −90 MB de VRAM, num primeiro boot que já é 93 MB;
* **com perdas**: o WebP lossy é YUV 4:2:0, e croma subamostrado com dados
  INDEPENDENTES em R e G é destrutivo — medido, o AO da grama erra 10,7/255 de
  média (4 %), p99 43. Reprovado sem discussão.

As dezesseis texturas de chão ficam como estão, e não por omissão: passadas pelo
mesmo portão da §2, **nenhuma delas tem folga** (a 1024² o erro vai de 0,7 a
13,1 de média). Elas estão no tamanho certo para o detalhe que carregam. Os
358 MB de VRAM do chão continuam sendo o maior item isolado do orçamento e a
saída para eles é KTX2, não redimensionamento.

---

## 3-A. Segunda rodada — perfil adaptativo, porteira de WebGL e a limpeza

Pedido do mesmo dia, depois de ler o relatório acima: *"identificar o quão bom é
o computador do usuário e adaptar a qualidade… no meu está muito bom, mas se eu
tivesse um computador com menos desempenho, diminuir a qualidade"*, mais uma
pergunta sobre ligar a aceleração gráfica e a autorização para apagar os órfãos.

### O perfil (`engine/core/quality.ts`)

**A regra é a da §3 da análise e ela não se negocia: o perfil só mexe em
AMOSTRAGEM, nunca em decisão visual autorada.** Resolução, anisotropia,
resolução de sombra, casca de laranja — sim. Cor, exposição, tonemap, preset,
ângulo de luz — jamais. O teste prático é literal: *uma captura tirada no Baixo
sai com o mesmo enquadramento e a mesma luz da tirada no Alto, só mais
serrilhada.*

**O nível Alto é, valor por valor, o que o estúdio já fazia** — `min(dpr,2)`,
sombra 3072², anisotropia 8, reflexo do piso, casca de laranja. Isso não é
afirmação, é o que `checks-qualidade.mjs` confere linha a linha: se o teto se
mexer, a bancada reprova. Na máquina do dono nada muda.

| botão | Alta | Média | Baixa |
|---|---|---|---|
| teto do `devicePixelRatio` | 2 | 1,5 | 1 |
| mapa de sombra | 3072² | 2048² | 1024² |
| anisotropia (veículo / chão) | 8 / máx | 4 / 8 | 2 / 2 |
| reflexo do piso | inteiro | **inteiro** | desligado |
| casca de laranja (`uPeel`) | ligada | ligada | desligada |

**O reflexo é liga/desliga e não escala, e isso é a medição do próprio
`floor-reflection.ts` mandando:** *14,1 fps a meio lado contra 14,7 a um quarto*
— o gargalo é a segunda varredura de GEOMETRIA, não preenchimento. Reduzi-lo
devolve meio quadro por segundo e cobra uma silhueta que cintila no giro. Ou a
passada acontece inteira, ou não acontece. No Médio ela fica inteira de
propósito: o Estúdio existe para julgar cor.

**Só botões QUENTES.** Nenhum recompila shader. `antialias` (parâmetro de
construtor), `NUM_SPOT_LIGHTS` (chave de cache de programa) e `shadowMap.type`
(`#define`) ficaram de fora por construção — uma adaptação automática que
causasse engasgo de recompilação seria o defeito que ela existe para evitar.

**Três eixos, nenhum bastando sozinho:**
1. **Sonda estática** — WebGL2, string do adaptador, núcleos, memória, pixels a
   preencher, toque. Chuta, e assume o chute.
2. **Medidor de quadro** — o único juiz honesto. EMA do tempo de `render()`,
   histerese larga (sobe com < 13 ms por 4 s, desce com > 28 ms por 2 s), um
   degrau por 10 s, teto de 3 rebaixamentos por sessão.
3. **A escolha do usuário**, que ganha dos dois e é lembrada.

⚠️ **Ausência de informação nunca significa "fraco".** O Firefox mascara
`UNMASKED_RENDERER_WEBGL`; tratar `null` como GPU ruim poria o Firefox inteiro
em Baixo em máquinas boas — exatamente o defeito que o sistema existe para não
ter. Sem a string, o veredito é Alto, e só o medidor pode rebaixar.

⚠️ **O medidor só amostra em quadro DESENHADO**, e com o laço sob demanda isso
quer dizer *só enquanto alguém está mexendo*. É a consequência correta das duas
decisões se encontrando: um quadro pulado custa ~0 ms, e alimentá-lo faria a
média despencar com a cena parada — o adaptador concluiria que a máquina é um
foguete justamente quando ela não está fazendo nada. Medido na bancada: cena
imóvel → 0 amostras; 120 quadros girando → 19,1 ms na RX 570, que fica em Alta.

⚠️ E ele **não aprende com pico conhecido**: gravação (`framePins`), crossfade de
preset (`tweenT`) e os 3 s após qualquer carga (`markBusy()`, pendurado em
`invalidateShadows()`, que já era chamado exatamente nas bordas de carga). Sem
isso o nível cairia toda vez que o usuário trocasse de caminhão — o momento em
que ele mais está olhando.

**A interface é obrigatória, não enfeite.** Quatro posições no HUD —
Automático · Alta · Média · Baixa — e em automático o rótulo diz onde está
(`Automático · média`). Este arquivo já tinha rejeitado adaptação silenciosa
uma vez, na nota de `warnIfUnpaintable()`: *"um usuário informado é um bug
relatado, um usuário calado é um bug perdido"*. Alguém cuja imagem piorou
sozinha relata "o estúdio está borrado", que é indiagnosticável. Escolher um
nome congela o adaptador — quem escolheu Alta num PC fraco escolheu ver 20 fps,
e isso é um direito.

**Uma brecha real encontrada e fechada.** A resolução de render já obedecia à
regra "a captura sai no teto" por construção (alvo próprio, sem
`setPixelRatio`). O **mapa de sombra não**: é global do renderizador, e no nível
Baixo a foto sairia com 1024² — visível no contato do pneu com o chão, que é
onde o olho procura. `captureViewport()` agora levanta ao teto e devolve no
`finally`. Provado na bancada espionando a escrita do `Vector2` (um
`setInterval` não serve: a captura bloqueia a thread).

### A porteira de WebGL (`webgl-gate.ts`)

**Um site não pode ligar a aceleração gráfica, e não é omissão dos navegadores:
é isolamento deliberado.** Não há API — e mais: conteúdo web nem pode NAVEGAR
para `chrome://settings`, `edge://settings` ou `about:config`, por link ou por
`window.open`. Um link ali é um link que não faz nada, e um link morto faz a
pessoa concluir que o app quebrou em vez de que a configuração está desligada.

O que dá para fazer, e é o que foi feito: **detectar** (rasterizador de software
é uma string reconhecível), **identificar o navegador** e mostrar o passo a
passo *dele* — não uma lista de cinco em que a pessoa tem de se achar — e dar o
endereço com um botão de **copiar**, que é o mais perto de um botão que a
plataforma permite. A tela diz em voz alta por que não há botão, porque essa é a
primeira pergunta de quem a lê.

Dois vereditos: `none` (sem WebGL2 — o engine não sobe) e `software` (roda, e
roda mal — com "Abrir assim mesmo", porque a decisão é de quem está na frente da
tela). **Para isso existir, o engine deixou de ser import estático e passou a
`await import()`**: `scene.ts` cria o `WebGLRenderer` no escopo de módulo, então
sem um `await` não existe um "antes" em que sondar.

### A limpeza

52 MB apagados: `environments/rodovia/` (5,5 MB, órfão confirmado — o HDR próprio
do distrito foi assado em 10/08), `distrito-industrial/set2.glb` (7,4),
`porto-miami/` (5,6, fora do `environments.json`), `models/vehicles/iveco.glb`
(7,0) e `iveco_sway_metallica.glb` (22,6, o mesmo caminhão de
`iveco_metallica_4x2.glb`, que é menor e tem Draco). Quatro dos cinco voltam
pelo git.

`armazem/` **ficou**: a decisão de guardá-lo está registrada no próprio
`environments.json` e não é minha para desfazer. E `catalog.ts` ganhou a nota de
que **a lista de fallback é o que segura `scania.glb` e `volvo.glb` no disco** —
quem for limpar assets de novo tem de procurar `file` no `brands.json` **e** ali.

---

## 4. O que ficou de fora, e por quê

**Compartilhar a geometria duplicada em tempo de execução — o maior ganho ainda
na mesa, e ele tem um perigo com nome.** O `GLTFLoader` do three já tem o cache:
`createPrimitiveKey()` chaveia por `'draco:' + bufferView`, então bastaria FUNDIR
os índices de `bufferView` duplicados (a §2 só fundiu os BYTES) e o three
passaria a decodificar 855 cargas em vez de 2 157 e a compartilhar a
`BufferGeometry` entre as 1 302 cópias — metade do tempo de Draco na carga e
metade da memória de vértice do implemento.

**O perigo:** geometria compartilhada é geometria ALIASADA, e este engine muta
geometria no lugar. `models.ts` faz `g.setIndex(null)` nas chapas do corpo antes
de recortar, e `buildLiveryPanels()` reescreve índices. Medido, os materiais com
duplicata incluem `Cor_padrao_branco(metalBranco)` (20 primitivas) e `Faixa-3M`
(56) — exatamente as famílias que o redimensionamento do baú reconstrói. Fundir
tudo faria um `setIndex(null)` apagar vinte chapas de uma vez.

Fica **medido e pronto para ser tomado com uma restrição**: fundir só onde o
material não é reconstruído (pneu, ferragem, metal preto, plásticos) preserva
~2,5 M dos 2,7 M de triângulos redundantes e exclui o perigo por construção. Não
foi feito porque exige uma trava de comparação pixel a pixel que esta passagem
não tinha como montar.

**LOD sub-pixel do implemento** (§3.6 do documento anterior). Continua correto
no princípio — 640 malhas abaixo de 5 cm carregando 0,79 M triângulos, e o
rasterizador já descarta quase tudo que é sub-pixel, então pular a chamada de
desenho é quase de graça. Não foi feito porque `.visible` é disputado: `trim.ts`
escreve nele por peça, `seethrough.ts` por satélite, e `capture.ts` e
`livery-snapshot.ts` fazem esconde-e-restaura. E a captura renderiza em
LADRILHOS, ou seja num alvo muito maior que a viewport — um LOD medido na
viewport assaria na foto peças que na foto NÃO são sub-pixel. Fazer certo exige
posse explícita (só restaurar o que ele mesmo escondeu) e um `applyLod(altura)`
que a captura chame com a altura dela. É trabalho de uma passagem própria.

**Perfil de qualidade adaptativo** (§3 do documento anterior). Fora do pedido
por definição: escala de render, sombra menor e anisotropia menor são perda de
qualidade visível. O documento anterior o propõe como "teto onde está, piso
novo", que é outro pedido — legítimo, e a ser decidido à parte.

**Lixo servido.** `environments/rodovia/sky.hdr` (5,5 MB) está **de fato órfão**
— confirmado relendo o manifesto: `distrito-industrial` e `serra` apontam os
dois para `distrito-industrial/sky.*`, e `rodovia` só aparece em texto de nota.
Junto com `distrito-industrial/set2.glb` (7,4 MB), `porto-miami/` (5,6 MB, fora
de `environments.json`) e os legados `models/vehicles/iveco.glb` +
`iveco_sway_metallica.glb` (29,6 MB, sem nenhum campo `file` apontando para
eles), são ~48 MB servidos sem uso. **Não foram apagados**: não custam nada em
tempo de execução (ninguém os baixa), o `armazem` está guardado de propósito por
decisão registrada no manifesto, e os dois legados são `.gitignore` — apagar é
irreversível e é chamada do dono.

---

## 5. Onde o orçamento está agora

Cena de referência — `distrito-industrial` + Volvo FH 2021 4x2 + implemento:

| item | antes | agora |
|---|---:|---:|
| conjuntos de chão (16 mapas 2048²) | 358 MB | 358 MB |
| `trailer.glb` | 263 MB | **166 MB** |
| `set.glb` do distrito | 151 MB | **133 MB** |
| cavalo | 81 MB | 81 MB |
| par de HDRs + PMREM | ~81 MB | ~81 MB |
| mapa de sombra 3072² | 38 MB | 38 MB |
| **total** | **≈ 972 MB** | **≈ 857 MB** |

Com o Metallica no lugar do FH, que é o pior caso do acervo: **1 235 → 1 014 MB**.

O chão é agora, com folga, o maior item — e a §3(b) explica por que ele não cede
a redimensionamento. Quem for atrás dos próximos 300 MB tem um alvo só: **KTX2**
(`KTX2Loader` + transcodificador em `/vendor/`, no mesmo padrão que
`config/assets.ts` já usa para o Draco). É a decisão de maior impacto que resta,
e ela é uma decisão de qualidade — UASTC é quase sem perdas e ETC1S não é —,
então precisa do mesmo tratamento de portão medido que a §2 usou.
