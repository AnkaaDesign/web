# Truck Studio — passagem de bastão: a noite e as luzes

> **PARA QUE SERVE ESTE ARQUIVO.** A sessão de 2026-08-11/12 entregou a noite do
> `distrito-industrial` (céu, postes, câmera que atravessa) e ficou devendo parte
> das luzes do veículo. Este documento é o estado real: o que está pronto e
> verificado, o que foi tentado e **falhou** (com a medição que explica por quê), e
> o que falta — inclusive os defeitos novos que o dono do produto reportou depois.
>
> Leia inteiro antes de mexer. Metade do tempo daquela sessão foi gasto refazendo
> tentativas que já haviam falhado por um motivo medido, e cada um desses motivos
> está registrado abaixo.
>
> ## ⚠️ ATUALIZAÇÃO DE 2026-08-12 (tarde) — A FILA DA §4 FOI EXECUTADA
>
> **4.1, 4.2, 4.3, 4.4, 4.5 e 4.7-vidro estão FEITOS e verificados na bancada.**
> A §4 abaixo fica como REGISTRO do diagnóstico — as causas apontadas nela estavam
> certas em 4.1 e 4.2, e **erradas em 4.3**: o conserto proposto lá (clonar
> material por grupo de posição) é impossível, porque nos bakes de cavalo há **uma
> primitiva por material** e não existem grupos. Ver `ARCHITECTURE.md` §12, que é
> o documento vivo desta parte.
>
> O que mudou, em uma linha cada:
>
> | item | estado |
> |---|---|
> | 4.1 lanternas da lateral | **FEITO** — quem decide "é pisca?" é a PEÇA, não o material |
> | 4.2 delimitadoras do rufo | **FEITO** — `interna` saiu do `INTERNA_RE`; as seis saem âmbar |
> | 4.3 traseira do cavalo | **FEITO por outro caminho** — cor POR FRAGMENTO, no shader |
> | 4.4 fita refletiva | **FEITO** — `vehicle/retroreflect.ts`, lóbulo no ângulo de observação |
> | 4.5 emitir luz | **FEITO** — pool de `lamps.ts` 8 → 12, `vehicle/beams.ts` |
> | 4.6 farol dianteiro | **melhorado, não fechado** — o FEIXE não passa pela capa; a LENTE continua atrás dela |
> | 4.7 vidro do poste | **FEITO** — a luminária é uma cunha de 11,3°; o vidro era horizontal |
>
> Bancadas: `checks-noite.mjs`, `checks-cenario.mjs` e `checks-poste-vidro.mjs`
> (nova) — todas verdes.

**Nada está commitado.** Tudo é working tree em `repos/web`.

---

## 0. Como rodar e como medir

```bash
cd ~/Documents/repositories/web
npx tsc -p tsconfig.app.json --noEmit          # tipos (NÃO use tsconfig.json)

# a bancada — sobe o engine num Chromium de verdade e mede
node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-noite.mjs
```

⚠️ **SEMPRE do diretório `web/`.** Um comando composto que rodou com o cwd em
`tools/studio-bench/shots` falhou em silêncio e **duas rodadas de bancada mediram
código que nunca foi escrito**. Depois de editar por script, confira com `grep`.

⚠️ **`tsc` limpo não garante bundle.** Uma crase de citação em comentário dentro de
template string de GLSL fecha o literal. Aconteceu **três vezes** nesta base. O
`tsc` acusa `TS1005`, mas se você só olhar o log da bancada vai medir o binário
velho.

### As bancadas que existem

| arquivo | o que trava |
|---|---|
| `checks-noite.mjs` | **146 travas** — atravessar, céu, postes, luzes do veículo, + 10 fotos |
| `checks-cenario.mjs` | plantio e postes do cenário |
| `checks-set-sombra-chuva.mjs` | sombra e molhagem do cenário |
| `checks-estudio.mjs` | o ciclorama |
| `checks-quem-desenha.mjs` | **SONDA** — raycast na pose da foto, diz qual material desenha cada pixel e a PILHA de acertos |
| `checks-farol.mjs` | **SONDA** — estado de cada lâmpada (emissivo, intensidade, escala, pico do mapa) |
| `checks-poste-vidro.mjs` | **SONDA** — vidro × luminária de cada poste, e o PERFIL da carcaça por faixa de altura |

**As duas sondas são a ferramenta mais importante deste trabalho.** Três rodadas de
conserto do farol falharam por dedução; a sonda respondeu em uma. Antes de mudar
número, rode a sonda.

Fotos saem em `tools/studio-bench/shots/`.

---

## 1. O que está PRONTO e verificado

### 1.1 A câmera atravessa em vez de desviar — `scene/seethrough.ts` (NOVO)

`applyAvoidance()` em `scene.ts` está **desligado** (`setCameraObstacles` entrega
lista vazia; o maquinário está inteiro e o cabeçalho diz como religar). Quem tapa o
produto fica transparente.

Decisão **por objeto, binária, na CPU**: silhueta em NDC do objeto encostando na do
veículo **E** o objeto à frente do ponto mais próximo do veículo. O shader recebe um
número por objeto (uniforme para malha comum, `InstancedBufferAttribute` para
instância) e o objeto totalmente escondido é cortado no vértice.

Números: `ALTURA_MIN 0.35` · `FOLGA_NDC 0.045` · `HISTERESE_NDC 0.05` ·
`HISTERESE_W 1.5 m` · `TAU_ENTRA 0.10 s` · `TAU_SAI 0.26 s`.

### 1.2 Arranjo do cenário — `scene/scenery.ts` (NOVO)

Vão entre postes **128 m → 27,2 m**. Árvores em canteiro (alameda, passo 14 m) e
grama (por área). **593** instâncias plantadas, todas em canteiro/grama, pé no chão.
Braço dos postes apontando para a rua.

### 1.3 Céu de noite por dissolvência — `scene/skyblend.ts` (NOVO)

Par `kloppenheim_06_puresky` (dia) + `kloppenheim_02_puresky` (noite), CC0, mesma
série — medido: lua a 5,0° do sol em azimute, luminância média 43 % da de dia, pico
55 633 contra 33. Fundo atravessa liso quadro a quadro; PMREM reassado por taxa
(110 ms, passos de 1/12). `hdriNight` no manifesto e em `catalog.ts`.

### 1.4 Luminárias do cenário acendem — `scene/lamps.ts`

O `set.glb` **não tem um único material emissivo** e as 11 torres usam `FENCE_POST`
(o mourão do alambrado): elas nunca acenderam. Agora `layout: 'set'` — o cenário é
dono do fixture, o engine é dono da luz, com medidas tiradas da geometria. 8
refletores nas torres mais próximas, vidro aceso nas 11.

**Feixe aberto e reforçado a pedido:** ângulo `0.85 → 1.05 rad`.
⚠️ **Abrir ESCURECE** — a `SpotLight` espalha a mesma intensidade por mais área; a
razão de ângulo sólido é 1,478. Ganho = 1,478 (empatar) × 1,2 = **`LAMP_BEAM_GAIN
1.77`**, num `getLampBeamGain()` separado de `getLampIntensityScale()` (aquele é
física de altura, este é composição).

### 1.5 Luzes do veículo às 18:00 — `vehicle/lights.ts` (NOVO)

Nível no rig (`RIG_BASE.vehLights`), `smoothstep(hora, 18.0, 18.6)`. Chamado de
`setupCommon()`. Registrar também **APAGA** — os 49 bakes chegam com
`emissiveIntensity 1` e emissivo 0,35, então as lanternas brilhavam ao meio-dia.

**A cor é autorada, o mapa é máscara** (ver §3.1 para por que). Ordem: farol/interna
→ branco; o **NOME** quando declara UMA cor; senão a **POSIÇÃO** (`zRel` na raiz:
> 0,80 → vermelho, < 0,20 → branco, meio → âmbar).

Cores: `COR_TRAS 0xff1608` · `COR_LADO 0xff8f16` · `COR_FRENTE 0xfff4e2`.
Níveis: `PICO 2.2` · `PICO_FAROL 40.0`.

Verificado nas fotos: traseiras do implemento **vermelhas**, traseira do cavalo
**vermelha**, laterais **âmbar**.

---

## 2. Arquivos

**Novos:** `scene/seethrough.ts` · `scene/scenery.ts` · `scene/skyblend.ts` ·
`vehicle/lights.ts` · `public/environments/distrito-industrial/sky-night.hdr` ·
`tools/studio-bench/checks-noite.mjs` · `checks-quem-desenha.mjs` · `checks-farol.mjs`

**Alterados:** `scene/scene.ts` · `scene/set.ts` · `scene/lamps.ts` ·
`scene/environment.ts` · `scene/presets.ts` (campo `vehLights`) ·
`catalog/catalog.ts` (campo `hdriNight`) · `vehicle/material-setup.ts` (chama
`registerVehicleLights`) · `public/environments/environments.json` ·
`public/environments/CREDITS.md` · `ARCHITECTURE.md` (§10 documenta a rodada)

---

## 3. O que FALHOU — não repita

### 3.1 Tirar a cor da lâmpada do albedo. Três tentativas, três falhas.

⚠️ **`emissiveTexture` É O PRÓPRIO `baseColorTexture`.** Medido no FH 2021: md5
idêntico, 462 146 bytes. O mapa não é máscara de lâmpada — é um **atlas** com lente,
refletor cromado e carcaça na mesma imagem, e às vezes é só uma **paleta** (a malha
do farol amostra o UV 0,99/0,005, um cinza chapado de **0,073 linear**).

Tentado e descartado:

1. **expansão de saturação** (`mix(vec3(L), c, 1.9)`) — deixou o vermelho vermelho e
   o âmbar do cavalo laranja puro;
2. **supressão de neutro** em 0,30 e 0,08 — 0,30 apagou o farol (branco é neutro!),
   0,08 não alcançou a faixa "branca" da ré, que na verdade é levemente **creme**
   (saturação ~0,15);
3. **normalizar pelo pico COLORIDO** do mapa — subiu a escala 4× e deixou a faixa
   creme MAIS clara do que antes.

**A saída foi parar de inferir:** o mapa entra só pela **luminância**
(`totalEmissiveRadiance = emissive * lum(mapa)`; o uniforme `emissive` do three já
vem com `emissiveIntensity` multiplicado) e a cor vem de `mat.emissive`, escrito por
nós. Isso está funcionando — **não volte a mexer no albedo.**

### 3.2 Subir o nível do farol. 2,2 → 8 → 40, zero diferença visível.

⚠️ **O TONEMAP RODA ANTES DA MISTURA.** A lâmpada já sai do shader saturada em 1,0;
a capa de vidro então mistura `0,8 × vidro-escuro + 0,2 × 1,0 ≈ 0,25` — cinza escuro
**para qualquer nível de lâmpada**.

### 3.3 Sobreposição aditiva do farol. Retirada.

Tentativa: tirar a lâmpada do passe opaco e desenhá-la depois da capa
(`AdditiveBlending`, `renderOrder` acima do 20 do vidro). **Não mudou a foto e
trouxe duas falhas de bancada.** Saiu — entregar mistura não validada em 49 chassis
é pior que não entregar.

### 3.4 `castShadow` para a sombra do que atravessa.

⚠️ **É POR MALHA.** As 593 plantas são 12 `InstancedMesh`; apagar a bandeira de um
apagaria a sombra da espécie inteira. A alavanca certa é
`Object3D.customDepthMaterial` com a mesma injeção — e ela **tem de carregar `map` +
`alphaTest` + `side`**, senão a copa projeta um cartão retangular sólido
(`PLANT_LEAF` e `FENCE_WIRE` são `alphaMode: MASK` 0,38). Isso está implementado e
funcionando.

### 3.5 Pareamento casca/copa pelo sufixo `_1`. Ambíguo.

`tree_pk_1` é o protótipo 1, não a copa de `tree_pk`. Quatro dos dez protótipos
nunca formavam par ⇒ **nunca eram replantados**, ficavam em cima do asfalto. O par é
**estrutural** (irmãos sob o `Group` de primitivas do GLTFLoader) —
`grupoDePrimitivas()` em `scenery.ts`, usada pelos dois módulos.

### 3.6 Classificar posição em `setupCommon()`.

⚠️ **As matrizes de mundo ainda são identidade ali** (roda antes do engate), então
`Box3.setFromObject()` devolve a caixa **LOCAL**. E no espaço local do implemento
**+z é a FRENTE** — as portas ficam no menor z. As lanternas traseiras saíram com
`zRel 0,02` e foram pintadas de branco. Hoje a cor é resolvida na primeira escrita,
dentro de `applyRig()`, uma vez por raiz.

---

## 4. A FILA — EXECUTADA em 2026-08-12 (registro do diagnóstico)

> ⚠️ Isto já foi feito. Fica como registro de COMO cada causa foi achada. Onde o
> conserto proposto aqui não foi o adotado, há uma nota dizendo por quê. O estado
> atual está em `ARCHITECTURE.md` §12.

### 4.1 As 4 (5) lanternas de posição por lateral, abaixo do frame ⚠️ CAUSA JÁ ACHADA

O dono do produto: *"na lateral possui 4 lanternas em cada lateral, abaixo frame
metalico, nao sobre ele como sao as faixas refletivas"*.

**Elas existem no `trailer.glb` e eu as excluí por engano.** Levantado com um dump
dos nós:

```
#lanterna-lateral × 10        x = ±128 (laterais), y = 128 (BAIXO, sob o frame)
                              z = 417, 132, −151, …            5 por lado
  ├─ lanterna-lateral-chassis(corpo)  → material `plastico-preto`
  ├─ lanterna-lateral-chassis(leds)   → material `lanterna-pisca-quadrado(LEDs)`  ← AQUI
  └─ lanterna-lateral-chassis(vidro)  → material `vidro-lanternas-pisca`
```

⚠️ **O material chama `lanterna-pisca-quadrado(LEDs)` mas a PEÇA é
`lanterna-lateral-chassis`.** Meu `INTERMITENTE_RE` (`/pisca|blinker|…/`) o excluiu
como pisca. Ele é reusado pelas lanternas de posição da lateral.

Os piscas de verdade são outros nós:
`lanterna-pisca-circular-D/E` em `z = 724` (a frente), material
`lanterna-pisca-circular`.

**O conserto:** decidir "é intermitente?" pelo nome da **PEÇA/NÓ**, não pelo nome do
material. Precisa de um mapa nó → material na varredura (hoje `registerVehicleLights`
já tem as malhas por material em `malhasDe`, então o nome do nó está a um passo).

### 4.2 As lanternas do topo estão brancas e deveriam ser âmbar/vermelhas ⚠️ CAUSA JÁ ACHADA

O dono do produto, sobre a traseira do implemento vista de cima: *"essa da traseira
do implemento tambem esta pior"* — as lanternas ovais do rufo estão **brancas**.

```
lanternas-internas × 6        x = ±121, y = 403 (ALTO, no rufo)
                              z = −619 … 595 (todo o comprimento)
  └─ material `lanterna-interna-lente`
```

⚠️ **"interna" ali significa EMBUTIDA, não "de dentro do baú".** Meu `INTERNA_RE`
(`/interna|interior|cargo|bau/`) as classificou como luz de carga e pintou de
**branco**. Elas são as delimitadoras do rufo: **âmbar na lateral, vermelha na
traseira**.

**O conserto:** tirar `interna` do `INTERNA_RE` (ou trocar por um teste de estar
DENTRO da caixa do baú) e deixar a regra de posição decidir.

### 4.3 A lanterna traseira do cavalo ficou PIOR ⚠️ CAUSA PROVÁVEL

*"essa lanterna traseira do cavalo agora esta pior"* — nas fotos ela aparece
**branca/estourada** sobre os para-lamas do Volvo.

Hipótese medida: um material serve lâmpadas nos **dois extremos** do cavalo, e a cor
é escolhida pela posição **média** das malhas dele — `decals_mat_0006_lights` deu
`zRel 0,08` (frente → branco) mas desenha lâmpada na traseira também.

**O conserto proposto era:** classificar por **MALHA**, não por material, clonando
o material por grupo de posição.

⚠️ **E ELE É IMPOSSÍVEL — a hipótese acima estava errada.** Medido depois, no
acervo inteiro: nos bakes de cavalo a geometria vem **FUNDIDA POR MATERIAL**, uma
primitiva por material. `decals_mat_0006_lights` do FH 2021 é UMA malha; o
`cabin_mat_0006_color` do MAN TGX é UMA malha que vai de z −3,06 a 3,84 — o
caminhão inteiro — e é o ÚNICO material emissivo externo daquele arquivo. **Não há
grupos de posição para clonar.** 37 dos 57 bakes têm ao menos um material de luz
espalhado por mais de 30 % do comprimento.

**O conserto adotado:** a cor é resolvida **POR FRAGMENTO**, no shader, a partir
da posição de mundo do pixel e da distância dele às duas faces da raiz, em metros.
É a única granularidade que a geometria do acervo admite. Ver `ARCHITECTURE.md`
§12.1 e §12.2.

### 4.4 As faixas refletivas têm de REFLETIR a luz

*"preciso que as faixas refletivas realmente reflitam as luzes"*.

Hoje `Faixa-3M` é um material comum e o brilho dela depende só do ambiente. Fita
retrorrefletiva devolve a luz **na direção de onde ela veio** — o que a torna
brilhante quando a fonte está perto do eixo da câmera, e apagada de lado. Isso não é
`emissive`; é um BRDF.

**Caminho sugerido:** injeção no shader de `Faixa-3M` somando um termo
`pow(max(dot(N, V), 0), k)` modulado pela luz mais próxima (as luminárias do cenário
já estão em `lampUnits`, com posição e cor). Não use `emissive` chapado — ela
brilharia sem fonte, e é justamente o que a distingue de uma lanterna.

### 4.5 As lâmpadas têm de EMITIR luz de verdade

*"quero que elas realmente emitam luz"* — hoje é só emissivo (a peça brilha, mas não
ilumina o que está em volta).

⚠️ **A RESTRIÇÃO QUE GOVERNA ISSO:** `NUM_SPOT_LIGHTS` (e `NUM_POINT_LIGHTS`) fazem
parte da **chave de cache de programa** de todo material da cena. É por isso que
`lamps.ts` mantém um **pool FIXO de 8** `SpotLight` e que `warmLightPrograms()` em
`scene.ts` pré-compila as duas configurações (0 e 8) atrás da cortina de
carregamento — decisão do Kennedy: *"prefiro ter um pouco mais de tempo de
carregamento no início do que ter esse travamento na mudança do slider"*.

**Então acrescentar luz ao veículo NÃO é criar `SpotLight` avulsa.** Dois caminhos:

1. **Crescer o pool de `lamps.ts`** para um número fixo maior (ex.: 8 cenário + 4
   veículo = 12) e reservar as 4 últimas para o veículo, atualizando
   `warmLightPrograms()`. Mantém o invariante de contagem fixa.
2. **Fake barato e sem luz nova:** um sprite/quad aditivo de halo por lanterna
   (`AdditiveBlending`, sempre virado para a câmera) mais uma mancha no chão. Não
   ilumina de verdade, mas lê como luz — e é o que a maioria dos configuradores faz.

O (2) é muito mais barato e provavelmente suficiente para foto de produto. Vale
perguntar ao dono do produto qual dos dois ele quer antes de implementar.

### 4.6 O farol dianteiro — AINDA APAGADO, diagnóstico completo

A lâmpada **está acesa**: no raycast ela é o acerto **[1]**, atrás de
`cabin_mat_0006_glass_ex` (opacidade **0,8**, cor 0,1, `depthWrite: false`,
`renderOrder: 20` — os dois últimos postos por `material-setup.ts`).

```
[0] cabin_mat_0006_glass_ex     @ cabin_p7   68 raios · opacidade 0.8 BLEND
[1] f_light_chs_mat_0000_lights @ f_light_chs_p0  72 raios · emiInt 40 · branco
```

⚠️ **A capa é UMA MALHA SÓ (`cabin_p7`) com para-brisa, janela e capa de farol no
mesmo material** — não há como clareá-la por malha.

As duas saídas, e as duas são decisão do dono do produto:

- **baixar a opacidade de `glass_ex`** — o para-brisa fica mais transparente à
  noite (pode até ficar melhor: o FH tem interior modelado com painel emissivo),
  mas muda o visual **de dia** dos 49 chassis;
- **editar o asset** para a capa do farol ter material próprio.

### 4.7 Pendências de gosto, para o Kennedy julgar

- A **lua** do plate de noite é um ponto muito brilhante (pico 55 633). Lê como lua
  atrás de nuvem; pode ser demais.
- O **vidro da luminária** do poste satura para branco (emissivo 3 × `lampColor`
  sódio). Um farolete real estoura assim numa foto, mas pode querer mais âmbar.

---

## 5. Convenções e armadilhas do domínio (para não redescobrir)

- **+Z é a traseira no MUNDO**, mas no espaço **local do implemento +z é a FRENTE**
  (as portas ficam no menor z). Ver §3.6.
- `InstancedMesh` **nasce em IDENTIDADE, não zerado** (three r155+). Se você alocar
  capacidade e não escrever as matrizes, tudo aparece empilhado na origem local.
- `Material.clone()` **não copia** `onBeforeCompile` nem `customProgramCacheKey`.
- `surfaceOf()` em `set.ts` devolve `'built'` para todo material cujo nome não casa
  a lista de chão — foi assim que `LINE_PAINT` (a pintura da faixa da pista) entrou
  no atravessar e ficou pontilhando.
- O manifesto (`environments.json`) é lido por uma **lista branca** em
  `catalog.ts`: campo que não esteja lá **evapora em silêncio**.
- O serviço em produção lê **`.env.production`**, não `.env`.
