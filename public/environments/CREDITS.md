# Truck Studio — créditos e aferições dos cenários (`/environments/`)

Tudo aqui vem do **[Poly Haven](https://polyhaven.com)** e está sob **CC0 1.0 (domínio
público)**. A CC0 **não exige atribuição**; creditamos assim mesmo porque é o certo a fazer
com um acervo mantido por doação. Os md5 de todos os downloads foram conferidos contra o
que `api.polyhaven.com/files/` devolve.

## Arquitetura atual: foto no LONGE, geometria CG no PERTO

A rodada anterior projetava o HDRI no chão até a base do caminhão (`GroundedSkybox` com
raio de 46–55 m). O usuário viu rodando e reprovou: *"now the scenes are blurred close"*.
Está certo — é teto de resolução, não bug. Projetando um equirretangular no plano, uma
linha de texel cobre `Δd = Δθ·(h²+d²)/h` de chão. Para `patio-logistico` (h = 1,2 m, fundo
4096×2048): **0,6 cm/texel a 3 m, 6,5 cm a 10 m, 25 cm a 20 m** — e a carreta tem 16,5 m,
ou seja quase todo o chão que se olha cai na parte ruim da curva. Ir para 8k só divide por
dois e continua perdendo; pior, a projeção achata *tudo* que está abaixo do horizonte
contra o piso, então barranco e muro viram rastro radial.

Divisão nova, que é a padrão de VFX:

| faixa | quem desenha |
|---|---|
| longe (além do anel de mistura) | a fotografia projetada, com o domo **empurrado para 150–160 m**, onde a resolução angular dela é adequada |
| perto (em volta do caminhão) | **geometria CG com PBR de verdade** — difuso **4k** (seção 11) mais **geometria CC0 espalhada** (seções 10 e 12) |
| a emenda | dissolvência radial do disco CG para o piso projetado |

> **Rodada de julho/31.** O usuário aprovou a divisão mas reprovou a metade de perto:
> *"more organic, not too static"* e *"get better lights models for the night mode, these
> one you built bare its not looking good"*. Um plano perfeitamente liso com uma borda
> perfeitamente reta e nada em cima dele lê como CG por mais boa que seja a textura, e os
> postes eram cilindro + caixa + bolota. As respostas são as seções **10** (15 props CC0),
> **11** (difusos 4k) e **12** (autoria por cenário).

---

## 1. Cenários (HDRI + fundo tonemapeado)

| id | asset | autor | arquivos |
|---|---|---|---|
| `rodovia` | [Rural Asphalt Road](https://polyhaven.com/a/rural_asphalt_road) | Alexander Scholten | `hdr` 2k (5,75 MB) + `tonemapped` 8k reduzido a 4k (2,36 MB) |
| `patio-logistico` | [Freight Station](https://polyhaven.com/a/freight_station) | Sergej Majboroda | `hdr` 2k (6,50 MB) + `tonemapped` 8k reduzido a 4k (1,82 MB) |
| `urbano` | [Wide Street 01](https://polyhaven.com/a/wide_street_01) | Sergej Majboroda | `hdr` 2k (5,83 MB) + `tonemapped` 8k reduzido a 4k (1,96 MB) |

> **Cenários descartados.** `estrada-rural` ([Flower Road](https://polyhaven.com/a/flower_road),
> Greg Zaal) saiu porque os três eram rurais. `urban_street_04` (a rua de Londres) foi
> auditado e **reprovado**: o tripé estava sobre uma **ilha de tráfego** — placa azul a
> ~5 m da origem, carro estacionado a ~8 m — e projetando a pegada de 16,5 × 2,55 m não há
> rotação em que a carreta não atravesse a ilha ou um carro (testadas as duas que alinham a
> rua ao eixo Z, 318° e 138°). `wide_street_01` tem 25 m de pista livre e passa folgado.

**Resolução do fundo: 4k, e de propósito.** O único LDR pronto que o Poly Haven oferece é
um `tonemapped` **8192×4096** — não existe variante de 16k, e tonemapear o `.hdr` 16k eu
mesmo daria 715 MB de VRAM por cenário, inviável. Entre 8k e 4k a decisão mudou quando a
arquitetura mudou: com o domo a 150 m a foto só carrega o campo distante, onde 4k já dá
~0,088°/texel (≈ 2 px de tela a 1080p/45°). Os bytes foram para os PBR 2k, que é o que o
olho realmente encosta. Para subir para 8k basta reencodar o `tonemapped` original.

**JPG e não WebP no fundo.** Medimos na faixa de céu limpo o desvio-padrão da 2ª derivada
ao longo de uma coluna (o grão do sensor, que é o que dissimula degrau em gradiente): fonte
0,87–1,30; jpg q88 0,71–1,17; **webp q88 0,44–0,97**. O WebP tem erro máximo menor porque
*alisa* — derruba o grão em até 50 %. Erro médio maior + gradiente mais liso é a definição
de "prestes a bandear". Gravado em **q92 4:4:4**: sem subamostragem de croma, que cortaria
a resolução de cor pela metade justamente no chão.

### Miniaturas (`thumb.webp`, 640×360, webp q82)

Render da própria cena: raio traçado contra a geometria do `GroundedSkybox` a partir da
câmera padrão que o `frameAll()` monta (15,1 m de distância, 4,8 m de altura, FOV 45°
vertical), já com o `envRotation` final. O card mostra o que o estúdio vai desenhar.

---

## 2. Conjuntos PBR de chão (`/textures/`, **2k**)

| conjunto | asset Poly Haven | autor | tile real | por que este |
|---|---|---|---|---|
| `asphalt` | [Asphalt 04](https://polyhaven.com/a/asphalt_04) | Rob Tuytel | **4,04 m** | ver audição abaixo |
| `grass` | [Leafy Grass](https://polyhaven.com/a/leafy_grass) | Rob Tuytel | **2,00 m** | idem |
| `gravel` | [Gravelly Sand](https://polyhaven.com/a/gravelly_sand) | Dario Barresi | **2,48 m** | pó claro, igual ao terrapleno do pátio |
| `dirt` | [Brown Mud Dry](https://polyhaven.com/a/brown_mud_dry) | Rob Tuytel | **1,30 m** | terra com pedrisco |
| `concrete` | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | Rob Tuytel | **2,00 m** | pátio pavimentado |

Cinco mapas por conjunto: `_diff` (albedo sRGB), `_rough`, `_nor` (**nor_gl** — o `nor_dx`
do Poly Haven tem o verde invertido e estufaria o relevo ao contrário), `_ao`, `_disp`.

> `asphalt`, `grass` e `gravel` ganharam depois um **difuso 4k** ao lado do 2k, em
> `<set>_diff_4k.webp` — ver **seção 11**. Os nomes 2k desta seção continuam valendo e são
> os que a pista procedural de 340 m usa; o 4k é só para o disco de perto.

### Audição — e por que o asfalto trocou

Montei cada candidato **ladrilhado 4×4 e iluminado** (diffuse × AO × N·L com o normal map),
que é a única forma de ver o defeito que importa: repetição.

- **asfalto:** `asphalt_02` (o que estava aqui antes) tem uma trinca vertical forte que
  vira listra a cada tile — inaceitável em 26 m de disco. `aerial_asphalt_01` tem um
  desenho de trincas em espiral que repete ainda mais. **`asphalt_04` é liso, fino e
  praticamente não mostra costura.** Trocado.
- **grama:** auditados `leafy_grass`, `aerial_grass_rock`, `grass_path_2`, `sparse_grass`,
  `brown_mud_leaves_01`, `forrest_ground_01`, `grass_path_3`. Achado honesto: **o Poly
  Haven não tem uma grama verde de gramado ladrilhável.** O acervo é chão de mata, musgo
  sobre rocha e capim seco. `aerial_grass_rock` e `grass_path_2` repetem de forma óbvia
  (manchas grandes de baixa frequência ladrilham mal por definição). **`leafy_grass` foi o
  escolhido**: alta frequência, contraste macro baixo, costura invisível no 4×4 — e o tom
  cáqui dele é justamente o que o `tint` corrige para o verde da foto (seção 4).
- **terra/pedrisco:** `brown_mud_dry` tem detalhe bom e repete pouco; `rocks_ground_02`
  tem pedras grandes que repetem muito (descartado); `gravelly_sand` é quase sem estrutura
  mas por isso mesmo ladrilha invisível — virou o material do pátio.

### Normais em **JPEG**, o resto em WebP

`_diff` q88, `_rough` q88 (cinza), `_ao` q85 (cinza), `_disp` q85 (cinza) — todos WebP.
**`_nor` ficou em JPEG 4:4:4 q90**, e isso não é descuido: **WebP com perda é sempre
4:2:0**. Num normal map a crominância *é* a direção da normal, então a subamostragem de
croma destrói o sinal. Medido contra a fonte:

| | webp q96 | **jpg 4:4:4 q90** |
|---|---|---|
| `dirt_nor` | rmse 13,13 / máx 135 | **rmse 7,63 / máx 66** |
| `gravel_nor` | rmse 5,34 | rmse 5,15 |
| `concrete_nor` | rmse 1,76 | rmse 1,88 |

Subir o WebP de q92 para q96 quase não mexeu no `dirt_nor` (13,18 → 13,13), o que confirma
que o erro é do 4:2:0 e não da quantização. O custo é ~1 MB no total dos cinco.

### `macro_noise.webp` (512×512, cinza)

Gerado aqui com numpy, não baixado. Três oitavas de ruído **limitado em banda** (anéis
estreitos no espectro, `ifft2` real) nas frequências 2, 4 e 8 ciclos por tile — ruído
limitado em banda é periódico por construção, então ladrilha exato: a diferença na costura
topo/base é 0,0035 contra 0,0031 entre linhas vizinhas internas (razão 1,11 ≈ perfeito).
Média 0,500, σ 0,115, recortado em [0,18 – 0,79] para nunca zerar o albedo. G2 multiplica
isto sobre o albedo a ~1/40 da frequência de detalhe: um tile de 4 m repetido em 26 m de
raio dá 13 repetições visíveis, e é isto que as quebra.

---

## 3. `grounded.height` — verificado, e um valor foi corrigido

`height` é a altura real de captura e **define a escala do mundo**: errar puxa cada feição
da foto para a distância errada, o que é uma segunda fonte independente do borrão. Método
de dois ângulos sobre objeto de tamanho conhecido (base a β abaixo do horizonte, topo a γ),
que **não depende da distância**:

```
tudo abaixo do horizonte:  H = h·(1 − tan γ / tan β)      d = h / tan β
cruzando o horizonte:      H = h·(1 + tan γ / tan β)
```

Convenção: **D** = coluna da imagem em graus (0° = borda esquerda), **E** = elevação.

### `rodovia` → **h = 2,1 m** (dois padrões alemães concordando)

1. **Largura da banqueta.** Cortes perpendiculares à pista (D 90 e D 270) dão,
   simetricamente dos dois lados, borda do asfalto em E ≈ −29,5° e borda da grama em
   E ≈ −22°. Logo banqueta = `h·(1/tan22° − 1/tan29,5°) = 0,708·h` → **1,49 m** em h = 2,1,
   contra o *Bankett* padrão de **1,50 m**. Pista = `3,53·h` = 7,4 m (perfil RQ 11).
2. **Marco delineador + guard-rail.** Duas alturas fixadas por norma na mesma distância:
   *Leitpfosten* 1,00 m com topo em E = −2,70°, *Schutzplanke* 0,75 m com topo em
   E = −3,245°. A diferença de 0,25 m em 0,545° dá d = 26,3 m e **h = 2,24 m**.

Os dois batem em 7 %. A placa "Vorfahrt gewähren" dá uma terceira leitura (2,4–2,6 m) mas
é a menos confiável — o tamanho normativo dela tem três variantes e o triângulo subtende só
1,08°. **2,1** é o consenso das duas medidas ancoradas em norma.

### `patio-logistico` → **h = 1,2 m** — ⚠️ **corrigido de 1,7**

Na primeira rodada eu recortei o vagão curto demais e li como beiral o que era estrutura
interna. Recortado de novo até o céu, o vagão coberto em D ≈ 138 dá **três** feições:

| feição | E medido | altura acima do trilho (vagão coberto 11-217) |
|---|---|---|
| longarina (base da caixa) | −0,25° | 1,06 m |
| beiral (topo da lateral) | +5,25° | 4,16 m |
| cumeeira do teto | +6,34° | 4,69 m |

Das duas primeiras: `d = 3,10/(tan5,25° + tan0,25°) = 32,2 m` e **h = 1,20 m**. A terceira
serve de prova: com esse d e h a cumeeira deveria cair em +6,18°, medi +6,34° — 0,16° de
erro. Confirmação independente: a 32 m um vagão de 14,7 m subtende 25,9°, e no panorama ele
ocupa ≈ 27°.

**Consequência:** toda distância que eu havia publicado para o pátio encolhe 30 %. O
terrapleno nu vai de **7,8 m a 32 m** (não 11–45), os vagões estão a **32 m** (não 57), e
por isso `lamps.spacing/offset` do pátio foram reescalados por 0,706.

### `urbano` → **h = 2,25 m**

1. **Furgão estacionado** em D 98–104: teto em −0,467°, contato do pneu em −2,353°; classe
   Kangoo/Dokker tem 1,81 m de teto → d = 54,9 m e **h = 2,26 m**.
2. **Carro branco** em D 60–71 (Mégane/Fluence, teto 1,48 m): teto −0,96°, pneu −3,55° →
   h = 2,03 m. A diferença se explica sozinha na foto: esse carro está **estacionado atrás
   de meio-fio e faixa de grama**, num nível ~0,2 m acima da pista; corrigindo, dá 2,23 m.
3. Conferência no olho: com a caixa de 16,5 × 2,55 × 4,0 m, em h = 1,7 os carros
   estacionados ficam **do tamanho do caminhão**; em h = 2,25 ficam do tamanho de carro.

Majboroda subiu o mastro acima do teto dos carros nesta panorâmica de rua e não na do
pátio — coerente com o que cada foto precisa mostrar.

---

## 4. `nearGround` — e o `tint`, que é o número que decide a emenda

`grounded.radius` voltou para **150 / 150 / 160 m**: o piso plano do `GroundedSkybox` é
exato até `radius/1,5`, ou seja 100–107 m, o que cobre com folga tudo que na foto é chão de
verdade (linha de árvores da `rodovia` a 67 m, pórtico do pátio a ~86 m, blocos de
apartamento do `urbano` a 100–160 m, medidos pela elevação da base). O horizonte é pintado
no raio.

O disco CG tem de cobrir exatamente a faixa em que a projeção fica ruim, e **parar antes**
do que a foto tem de interessante perto do meio-campo:

| cenário | material / verge | opaco até | dissolve até | por quê |
|---|---|---|---|---|
| `rodovia` | `asphalt` / `grass` | 26 m | 44 m | o cruzamento em T está a 30 m e a sebe a 46 m; o disco entrega o chão liso e devolve a foto antes da sebe |
| `patio-logistico` | `gravel` / — | 18 m | 32 m | a linha de mato que marca a borda do terrapleno está a 8–18 m e os vagões a 32 m: o disco cobre só o que borra |
| `urbano` | `asphalt` / — | 22 m | 38 m | pista de 25 m de largura; 22 m de asfalto CG ainda é pista dos dois lados |

`repeat` é o **tamanho físico real do tile** (4,04 / 2,48 / 4,04 m), não um número redondo —
usar outra coisa estica o detalhe e denuncia a escala. `verge` é `null` no pátio (não tem
acostamento) e no `urbano` (avenida tem meio-fio, não grama).

### Como o `tint` foi obtido

`tint` entra como `material.color`, que no three **multiplica** o `map` em espaço linear.
Então o valor certo não é a cor da foto: é a razão que leva o albedo da textura até o
albedo real da superfície fotografada. Multiplicar pela cor crua da foto escureceria o chão
umas duas vezes, porque a cor da foto já contém a iluminação que o renderer vai aplicar de
novo.

Recuperei o **albedo real** de cada superfície, o que também serve de prova de sanidade:

```
display do JPG  →  inverte sRGB e ACES  →  radiância × exposição do Poly Haven
albedo = π · radiância / irradiância horizontal integrada do próprio .hdr
tint   = albedo_real / albedo_da_textura        (tudo em linear, depois de volta para sRGB)
```

| cenário | faixa amostrada | albedo real medido | albedo da textura | **tint** |
|---|---|---|---|---|
| `rodovia` verge | 26–44 m, D 60–130 | 0,146 / 0,192 / 0,087 (lum 0,175) | `grass` 0,324 / 0,239 / 0,109 | **#b3e8e7** |
| `rodovia` pista | 6–22 m, D 170–195 + 345–360 | 0,234 / 0,241 / 0,220 | `asphalt` 0,243 / 0,228 / 0,215 | #fbffff |
| `urbano` | 22–38 m, D 130–190 | 0,168 / 0,181 / 0,187 (lum 0,179) | `asphalt` idem | **#d9e6f0** |
| `patio-logistico` | 18–32 m, D 40–150 | 0,416 / 0,318 / 0,213 (lum 0,331) | `gravel` 0,294 / 0,163 / 0,077 | **#ffffff** (ver abaixo) |

Duas coisas valem reparo:

- **O `asphalt_04` já está certo sozinho.** O albedo real da pista da `rodovia`
  (0,234/0,241/0,220) bate com o da textura (0,243/0,228/0,215) a menos de 5 %, e o tint
  sai #fbffff — praticamente branco. Isso valida ao mesmo tempo a escolha da textura e todo
  o método de recuperação de albedo acima.
- **O pátio não tem correção possível por multiplicação.** O terrapleno fotografado é pó
  claro, albedo ~0,33; a textura mais clara disponível (`gravelly_sand`) tem 0,18. O tint
  precisaria ser ~1,8×, e um multiplicador não passa de #ffffff. Então o tint fica neutro e
  a diferença foi fechada onde ela cabe: **`envIntensity` do pátio subiu de 1,10 para
  1,25**. Se a emenda ainda aparecer clara demais ali, mexer em `envIntensity`, nunca no
  tint.

Como `tint` é único por cenário e na `rodovia` o anel de mistura cai quase todo sobre
grama, o valor publicado é o da **grama**. Se G2 puder aplicar tint por material, o da
pista está na tabela (#fbffff, isto é: não mexer).

---

## 5. `shadowCatcher` e `lamps`

**`shadowCatcher.size`** (44 / 40 / 44 → ±22, ±20, ±22 m) fica dentro da câmera de sombra
do `key`, que cobre ±24 m. **`opacity`** é blend em espaço de exibição, então vale
`1 − (chão na sombra / chão no sol)`:

| | fração difusa `E_céu/E_total` do `.hdr` | limite físico | **adotado** |
|---|---|---|---|
| `rodovia` (meio-dia parcialmente nublado) | 0,196 | 0,75 | **0,48** |
| `patio-logistico` (pôr do sol velado) | 0,969 | 0,02 | **0,18** |
| `urbano` (meio-dia limpo) | 0,136 | 0,81 | **0,55** |

O ancoramento empírico veio do `wide_street_01`, que tem sombra grande de árvore sobre o
mesmo asfalto: em D 250–340, E −14°…−6°, `p5/p95 = 0,456` → opacidade **0,54** contra 0,81
do cálculo físico. A diferença é a luz que ricocheteia do asfalto ensolarado em volta, que
a integral só-do-céu ignora e que existe igual embaixo de um caminhão; o fator 0,67 foi
propagado para a `rodovia`. O pátio é caso à parte: com o sol a 9,4° e velado ele responde
por 3 % da luz do chão e **a foto não tem sombra projetada nenhuma** — 0,18 entrega contato
sem inventar um sol que a foto não tem.

**`lamps`.** O poço de postes é **fixo em 8 unidades** e no `roadside` o `count` é **por
lado** (`n = min(count·2, 8)`), com vão total `(n−1)·spacing` e passo de fileira `2·spacing`.
O exemplo do contrato (`spacing 26, count 8`) daria 182 m de fila.

| cenário | arranjo | valores | resultado |
|---|---|---|---|
| `rodovia` | `roadside` | spacing 20, offset 5,2, count 2 | 4 postes em z = ±10 e ±30. `offset 5,2` é a borda externa da banqueta medida na foto; o braço avança 1,5 m e põe a luminária em 3,7 m, sobre a borda do asfalto. Passo por fileira 40 m. |
| `urbano` | `roadside` | spacing 16, offset 11,0, count 2 | 4 postes em z = ±8 e ±24. `offset 11` cai na linha de meio-fio medida (10,6 m de um lado, 14,2 m do outro). Passo 32 m. |
| `patio-logistico` | `yard` | spacing 14, offset 8,0, count 6 | elipse de perímetro com semi-largura 8 m e semi-profundidade 14 m — a medida do terrapleno nu **com o h corrigido para 1,2** (≈ 15 × 28 m). |

Todos os presets usados acendem os postes à noite (`ensolarado.noite` herda `NIGHT_CLEAR`,
`lampIntensity 95`; `dourado.noite` usa 70).

---

## 6. `envRotation` — derivação (a primeira versão tinha erro de sinal)

Verificado no fonte do three 0.179.1, não suposto. `equirectUv()` amostra
`u = atan2(dir.z, dir.x)/2π + 0.5`, logo a coluna de mundo de uma direção é
`D₀ = deg(atan2(z, x)) + 180` e **+Z é a coluna 270**. Em `WebGLBackground.js` o uniforme é
montado com `_e1.y *= −1` ("accommodate left-handed frame"), então a matriz é `R_y(−θ)` e:

```
a coluna D da imagem APARECE na coluna de mundo  D − θ
alinhar um eixo da foto ao eixo +Z:              θ = D_eixo − 270
```

**O erro:** a versão anterior escrevia o azimute do `key` como `90° − keyAz`.
`scene.js` monta `key.position = (sin az, ·, cos az)`, cuja coluna de mundo é `270 − keyAz`
— 180° de diferença. Refeito:

| cenário | eixo na foto (D) | θ candidatos | sol aparece em | coluna do `key` | Δ | **escolhido** |
|---|---|---|---|---|---|---|
| `rodovia` | pista em 0 / 180 | 90° / **270°** | 126,1° / **306,1°** | 232 (`ensolarado`) | 106° / **74°** | **4,7124 rad** |
| `patio-logistico` | eixo maior do pátio em 90 / 270 | 0° / **180°** | 215,9° / **35,9°** | 345 (`dourado`) | 129° / **51°** | **3,1416 rad** |
| `urbano` | avenida em 133 / 313 | 223° / **43°** | 353,1° / **173,1°** | 232 (`ensolarado`) | 121° / **59°** | **0,7505 rad** |

Cada eixo foi medido varrendo o azimute atrás de até onde a superfície da pista alcança
(`rodovia` 0/180; `urbano` 133/313, com 166 m de asfalto contínuo nessas colunas). O pátio
não tem pista — usei o **eixo maior do terrapleno** (colunas 90/270) para a carreta deitar
ao longo dele e não atravessada. Bônus do pátio: com θ = 180° o sol cai a 12,5° da direção
para onde a câmera padrão olha, ou seja **a carreta nasce em contraluz contra o céu
dourado**.

O Δ residual não some por rotação, porque alinhar a pista já gasta o grau de liberdade.
Zerar exigiria `keyAz`/`keyEl` por cenário, que o manifesto não tem. Os valores exatos, se
alguém quiser fechar isso, são `keyAz = 270 − D_sol + θ`:

| cenário | `keyAz` ideal | `keyEl` ideal (elevação do sol na foto) |
|---|---|---|
| `rodovia` | 323,9° | 45,4° |
| `patio-logistico` | 234,1° | 9,4° |
| `urbano` | 96,9° | 53,0° |

## 7. `exposure`, `envIntensity`, `backgroundBlur`

`toneMappingExposure = rig.exposure · envDef.exposure`. Calibração: tonemapeei o próprio
`.hdr` com a mesma curva ACES + sRGB do `WebGLRenderer` e procurei a exposição que faz a
faixa de chão (E −8°…−20°) bater com o mesmo trecho do JPG de referência do Poly Haven.

| cenário | exposição total só-IBL | `rig.exposure` | quociente | **adotado** |
|---|---|---|---|---|
| `rodovia` | 1,572 | 1,05 | 1,498 | **1,05** (70 %) |
| `patio-logistico` | 1,275 | 1,15 | 1,109 | **0,90** (81 %) |
| `urbano` | 1,578 | 1,05 | 1,503 | **1,05** (70 %) |

O adotado fica em 70–80 % do calibrado porque a calibração supõe que o HDRI é a *única*
luz e o rig ainda soma `key` (3,1), `rim`, `hemi` e `ambient` por cima.

`envIntensity`: 1,0 / **1,25** / 1,0 — o pátio subiu de 1,10 pelo motivo da seção 4 (nenhum
albedo de pedrisco disponível chega perto do pó claro fotografado).

`backgroundBlur`: **0 nos três, obrigatoriamente**. Com a cúpula ativa ela *é* o fundo e
`scene.background` fica nulo, então `backgroundBlurriness` não tem em que agir.

---

## 8. Armadilhas para quem integra

1. **`MeshBasicMaterial` da cúpula passa pelo tone mapping.** `scene.background` não passa
   (o three faz `toneMapped = colorSpace !== sRGB`), mas a cúpula é malha comum. Com
   `backgroundImage`, que já vem tonemapeado, é preciso
   **`skybox.material.toneMapped = false`**, senão ACES roda duas vezes.
2. **`scene.background = null` enquanto a cúpula existe**, ou o céu é desenhado duas vezes.
3. **Sinal da rotação da malha.** Verificado só do lado do `environment`
   (`environmentRotation.y = θ` ⇒ coluna `C` aparece em `C − θ`). Do lado da malha há um
   espelho no meio — o construtor do `GroundedSkybox` faz `geometry.scale(1, 1, −1)`, e
   conjugar rotação em Y por espelho em Z inverte o sinal. É plausível que
   `mesh.rotation.y` precise ser **−envRotation**. Testar girando 90° e conferindo se o
   para-brisa reflete o mesmo prédio que aparece atrás dele.
4. **`radius` 150 não é licença para afastar a câmera.** `controls.maxDistance` tem de ser
   escolhido pelo assunto (uma carreta de 16 m), não pelo domo.
5. **Postes fora do piso plano** ficam enterrados na cúpula; `spacing` é o mais fácil de errar.
6. **O glTF empacotado do Poly Haven PERDE o recorte alfa.** Ver seção 10 — é a armadilha
   mais cara desta rodada e não dá erro nenhum, só entrega retângulos verdes opacos.

## 9. Reproduzir

```bash
curl -s 'https://api.polyhaven.com/info/<id>'  | jq          # autor, hora, clima, dimensions
curl -s 'https://api.polyhaven.com/files/<id>' | jq '.tonemapped'
curl -s 'https://api.polyhaven.com/files/<id>' | jq '.Diffuse["2k"].jpg'
# destinos relativos a web/public/
magick <id>.jpg -filter Lanczos -resize 4096x2048! -quality 92 -sampling-factor 4:4:4 \
       -strip environments/<id>/sky.jpg
magick <map>_2k.jpg -define webp:method=6 -quality 88 -strip textures/<set>_<map>.webp
magick <nor_gl>_2k.jpg -quality 90 -sampling-factor 4:4:4 -strip textures/<set>_nor.jpg

# props (seção 10) — o .gltf vem com .bin e texturas SOLTOS, em "include"
curl -s 'https://api.polyhaven.com/files/<id>' | jq '.gltf["1k"].gltf.include'
npx @gltf-transform/cli copy in.gltf a.glb --vertex-layout separate
npx @gltf-transform/cli prune a.glb b.glb
npx @gltf-transform/cli weld b.glb c.glb && npx @gltf-transform/cli simplify c.glb d.glb --ratio R --error E
npx @gltf-transform/cli webp d.glb e.glb --slots baseColorTexture --formats '*' --quality 88
npx @gltf-transform/cli dedup e.glb f.glb && npx @gltf-transform/cli join f.glb g.glb
npx @gltf-transform/cli draco g.glb props/<id>.glb --quantize-position 14 --quantize-normal 10
npx @gltf-transform/cli validate props/<id>.glb
```

As aferições da seção 3 precisam só do JPG tonemapeado: os ângulos saem de
`E = (0,5 − (linha + 0,5)/altura)·180` e `D = (coluna + 0,5)/largura·360`.

A vista de planta da seção 12 sai da mesma foto: para cada `(x, z)` do chão, amostrar o
equirretangular em `D = deg(atan2(z, x)) + 180 + deg(envRotation)` e
`E = −atan2(h, hypot(x, z))`. É a única forma honesta de decidir contagem de scatter — de
dentro do panorama não dá para julgar largura de banqueta.

---

## 10. Props CC0 (`/models/props/`, 11 MB)

Quinze modelos, todos **Poly Haven / CC0**, um `.glb` autossuficiente por prop, catálogo em
`props/props.json`. Todos os md5 conferidos contra `api.polyhaven.com/files/`.

| prop | asset Poly Haven | autor | altura real | tri | bytes |
|---|---|---|---|---|---|
| `street_lamp_01` | [Street Lamp 01](https://polyhaven.com/a/street_lamp_01) | Josh Dean | 3,871 m | 30 610 | 673 K |
| `street_lamp_02` | [Street Lamp 02](https://polyhaven.com/a/street_lamp_02) | Josh Dean | 1,675 m | 20 338 | 673 K |
| `grass_medium_01` | [Grass Medium 01](https://polyhaven.com/a/grass_medium_01) | Rob Tuytel, Rico Cilliers | 0,354 m | 2 488 | 1 235 K |
| `grass_medium_02` | [Grass Medium 02](https://polyhaven.com/a/grass_medium_02) | Rico Cilliers | 0,345 m | 3 593 | 307 K |
| `grass_bermuda_01` | [Grass Bermuda 01](https://polyhaven.com/a/grass_bermuda_01) | Rico Cilliers | 0,152 m | 498 | 682 K |
| `stone_01` | [Stone 01](https://polyhaven.com/a/stone_01) | Dario Barresi, Rico Cilliers | 0,071 m | 700 | 323 K |
| `rock_moss_set_02` | [Rock Moss Set 02](https://polyhaven.com/a/rock_moss_set_02) | Kless Gyzen | 0,525 m | 1 200 | 245 K |
| `weed_plant_02` | [Weed Plant 02](https://polyhaven.com/a/weed_plant_02) | Rob Tuytel, Rico Cilliers | 0,055 m | 3 694 | 265 K |
| `dandelion_01` | [Dandelion 01](https://polyhaven.com/a/dandelion_01) | Rob Tuytel, Rico Cilliers | 0,106 m | 5 260 | 271 K |
| `old_tyre` | [Old Tyre](https://polyhaven.com/a/old_tyre) | MP | 0,165 m | 2 880 | 255 K |
| `trashbag` | [Trashbag](https://polyhaven.com/a/trashbag) | Benny Weimer | 0,575 m | 4 482 | 256 K |
| `concrete_road_barrier` | [Concrete Road Barrier](https://polyhaven.com/a/concrete_road_barrier) | Amal Kumar | 0,831 m | 8 998 | 914 K |
| `modular_chainlink_fence` | [Modular Chainlink Fence](https://polyhaven.com/a/modular_chainlink_fence) | James Ray Cock, Amal Kumar | 2,523 m | 4 162 | 1 951 K |
| `modular_electricity_poles` | [Modular Electricity Poles](https://polyhaven.com/a/modular_electricity_poles) | James Ray Cock | 6,130 m | 16 955 | 2 179 K |
| `fire_hydrant` | [Fire Hydrant](https://polyhaven.com/a/fire_hydrant) | Gonçalo Felício | 0,799 m | 13 038 | 724 K |

### ⚠️ O glTF empacotado do Poly Haven descarta o alfa — e sem aviso

Todo prop de folhagem tem um mapa **`Alpha`** no acervo, mas o `.gltf` de 1k entrega o
albedo em **JPEG**, e JPEG não tem canal alfa. O material continua marcado `MASK`/`BLEND`,
o alfa vira 1 em todo lugar e o recorte some. Medido nos mapas de alfa baixados à parte:

| prop | média do mapa alfa | o que aconteceria sem ele |
|---|---|---|
| `grass_bermuda_01` | **0,066** | 21 cartões viram 21 retângulos verdes sólidos |
| `grass_medium_02` | 0,101 | idem |
| `grass_medium_01` | 0,179 | idem |
| `modular_chainlink_fence` (wire) | 0,158 | o alambrado vira uma chapa opaca |
| `dandelion_01` | 0,491 | folhas quadradas |
| `weed_plant_02` | 0,511 | folhas quadradas |
| `street_lamp_0*` (opacity) | 0,84 / 0,80 | o vidro da luminária vira bloco opaco tapando a lâmpada |

Corrigido baixando o `Alpha`/`opacity` 1k separado, recompondo no canal A do albedo e
gravando **WebP** (`EXT_texture_webp`, nativo no GLTFLoader do three) — é o único formato
que segura alfa a um tamanho decente. `stone_01` também tem um mapa `Mask`, mas ele é
máscara de material e **não** de opacidade (o material é opaco): não aplicar.

### Decisões de conversão

- **`BLEND` → `MASK`.** `grass_medium_01/02` vinham `BLEND`. Numa `InstancedMesh` de 280
  instâncias não existe ordenação por instância, então `BLEND` é garantia de artefato de
  camada. Cortes: 0,30 (bermuda), 0,35 (grass_medium), 0,40 (ervas e alambrado).
- **Tudo já vem assentado.** XZ centrado na pegada, base em `y = 0`, e **toda transformação
  de nó gravada nos vértices** — os kits do Poly Haven vêm dispostos como página de
  catálogo (variante *a* em x=0, *b* em x=−1, …) e essa disposição foi jogada fora. Logo
  *instanciar cada mesh do GLB com a mesma matriz está sempre certo*. Exceção única:
  `street_lamp_02` é de **parede** (`mount: "wall"`, `baseOffset: −0,395`).
- **Touceira = agrupamento, não clone.** Cada prop de grama junta 3–6 variantes do kit
  dentro de ~0,18 m e com rotações diferentes, então **uma** instância já é um tufo
  irregular. Isso vale mais contra o "static" do que qualquer variação por instância.
- **`street_lamp_0*_bulb` ganhou `emissiveFactor` (1,0 / 0,72 / 0,40 — sódio).** Duas
  razões: a lente tem de ler como *acesa*, e sem isso o material da lâmpada fica idêntico
  ao do corpo, o `dedup`/`join` funde os dois e **a engine perde o handle do modo noite**
  (aconteceu de verdade na primeira compilação: caiu de 3 primitivas para 2).
  `props.json` publica `lightAnchor: [0, 3,264, 0]` — o centroide da lente, que é de onde
  o `SpotLight` tem de sair.
- **Eixo de fila.** `concrete_road_barrier` e `modular_chainlink_fence` foram girados 90°
  para o **eixo longo ficar em +Z**, que é a direção em que uma fila de `roadside` corre;
  assim a instância sem rotação já deita na fila. `props.json` traz `runAxis: "z"` e o
  `pitch` de repetição (1,545 m e **0,934 m** — o passo do alambrado é o painel, não a
  caixa envolvente, que é maior porque o mourão sobra atrás).
- **`old_tyre` foi deitado** (−90° em X): pneu largado em pátio fica de lado, e em pé ele
  se equilibraria numa linha de contato.
- Kits reduzidos a uma peça útil: `modular_electricity_poles` → só o `preset_02` montado
  (13 nós, 6,13 m); `modular_chainlink_fence` → um painel + um mourão; `fire_hydrant` → só
  a variante `aged`.
- **Texturas:** baseColor em **WebP q88** (precisa de alfa), normal e ARM em **JPEG 4:4:4
  q90** — em normal map a crominância *é* a direção, e num ARM a crominância *é* a
  separação rugosidade/metalicidade. 1024 px nos props grandes, 512 px em seixo, pneu,
  saco e ervas. Geometria em **Draco** (o decoder já está em `/vendor/draco/`).

### Descartados, com motivo

- **`coast_rocks_01` / `_03` / `_05`** — o contrato pedia, mas medindo a geometria eles têm
  **59,5 × 3,3 × 42,5 m**, **21,1 × 3,2 × 28,3 m** e **4,0 × 1,3 × 3,7 m**: são formações
  costeiras inteiras, não seixos, com 680 k–813 k triângulos e 19–23 MB de `.bin` cada. Na
  escala `[0,4 – 0,9]` do exemplo do contrato dariam pedras de 8 a 24 m. Substituídos por
  `stone_01` (seixo real de 15 cm) e `rock_moss_set_02` (matacão de 1,2 m), que cobrem as
  duas escalas que os cenários realmente pedem por 0,57 MB somados.
- **`rock_moss_set_01`, `boulder_01`, `metal_trash_can`, `plastic_bottle_gallon`,
  `rusted_wheel_rim_*`, `celandine_01`, `nettle_plant`, `dry_branches_medium_01`,
  `concrete_road_barrier_02`** — sem uso em nenhum dos três panoramas; não vale byte.

---

## 11. Difusos 4k do chão perto (`/textures/<set>_diff_4k.webp`)

A faixa de perto é onde a câmera fica a 3 m, então o difuso subiu para 4k. **Só o difuso, e
só em `asphalt`, `grass` e `gravel`** — os outros mapas do conjunto e os conjuntos `dirt` e
`concrete` continuam em 2k sob os nomes antigos. Convivem: mesmo espaço UV, mesmo
ladrilhamento, misturar resoluções não muda nada além de detalhe.

O número que decidiu: comparei cada candidato contra o JPEG 4k original do Poly Haven.

| | rmse vs. fonte 4k | tamanho |
|---|---|---|
| 2k atual, esticado para cobrir a mesma área | **0,0375 – 0,0550** | (já pago) |
| 4k webp q80 | 0,0155 – 0,0201 | 4,3–5,3 MB |
| **4k webp q84 (adotado)** | **0,0128 – 0,0172** | **5,1–5,9 MB** |
| 4k webp q88 | 0,0100 – 0,0140 | 6,1–6,8 MB |

O 2k erra de 3 a 4 vezes mais que o pior 4k. Passar de q84 para q88 custa 5 MB para corrigir
um erro que já está bem abaixo do buraco que o 2k deixa — não compensa. Total: **16,5 MB**,
`env/` fecha em 71 MB.

**Normal 4k ficou de fora de propósito.** Os três normais 4k dariam 32 MB — mais que os
difusos — e compram o que menos aparece: com tile de 4,04 m o normal 2k já entrega ~2 mm por
texel, e relevo é sinal de baixa frequência. O olho lê detalhe no albedo.

Cada `nearGround` do manifesto agora traz o caminho explícito em **`maps`** (e `vergeMaps`
quando há banqueta), justamente para não sobrar dúvida sobre qual arquivo é o 4k:

```jsonc
"maps": { "diff": "/textures/asphalt_diff_4k.webp",   // 4096²
          "rough": "/textures/asphalt_rough.webp",     // 2048², inalterado
          "normal": "/textures/asphalt_nor.jpg",
          "ao": "/textures/asphalt_ao.webp",
          "disp": "/textures/asphalt_disp.webp" }
```

O `tint` da seção 4 continua valendo: `leafy_grass` e `asphalt_04` são os mesmos assets, só
que em mais pixels — o albedo médio não mudou.

---

## 12. Autoria por cenário: `edgeNoise`, `wear`, `undulation`, `scatter`, `roadside`

Tudo abaixo saiu da **vista de planta** de cada panorama (reprojeção ortográfica do próprio
equirretangular sobre o plano do chão, com a `grounded.height` da seção 3 e a `envRotation`
da seção 6 já aplicadas). Contagem de scatter chutada de dentro do panorama sai errada; de
cima, não.

### `rodovia` — banqueta de grama contínua

Planta: asfalto de meia-largura 3,7 m; **acostamento de saibro claro de 1,5 m** até 5,2 m;
daí em diante **grama verde CONTÍNUA** dos dois lados — capim alto e ervoso de um lado, prado
ceifado do outro — com moitas a 7–12 m. A pista faz curva dentro do disco.

| campo | valor | de onde |
|---|---|---|
| `edgeNoise` | 1,1 m / 8,5 m | a grama invade praticamente toda a largura do acostamento de 1,49 m em alguns trechos; ±1,1 m fica dentro do que a foto mostra |
| `wear` | 0,55 | o acostamento de saibro é real e derrama sobre o asfalto; há trilha de roda escura |
| `undulation` | 0,05 m / 16 m | estrada rural com banqueta de terra é ondulada de leve |
| `lamps.model` | `street_lamp_01` ×1,35 (→5,2 m) | a foto **não tem poste nenhum** — é estrada de campo. O poste existe porque o modo noite precisa dele, não porque a foto pede |

Scatter (930 instâncias, ~1,82 M tri com os postes e as luminárias): `grass_bermuda_01` 420
(prado rasteiro, 498 tri — é o mais barato do acervo e é ele que carrega a densidade),
`grass_medium_01` 280 (capim alto), `grass_medium_02` 70 na *edge* (capim seco na margem do
saibro), `weed_plant_02` 44 na *edge*, `dandelion_01` 26 (fim de primavera alemã: o mato está
florido), `stone_01` 90 na *edge* (saibro derramado). `roadside`: uma fila de
`modular_electricity_poles` a 8,5 m, passo 30 m, **de um lado só**.

**Sem pedra na banqueta.** A foto não tem nenhuma. O único mineral visível é o saibro.

### `patio-logistico` — pó nu, e nem um fio de grama verde

Planta: pista de pó compactado de ~9–10 m de largura; a partir de ~8 m dos dois lados,
**mato seco de tom oliva**, irregular. Pedrisco claro espalhado por todo o terrapleno.

Medida do rasgo da borda pó/mato (mediana da distância por coluna, menos a tendência local
de 10°): mediana **8,40 m**, resíduo **sd 1,43 m** num setor e **2,89 m** no outro. Daí sai
`edgeNoise.amplitude = 2,2 m` — é medido, não estimado.

| campo | valor |
|---|---|
| `edgeNoise` | 2,2 m / 9,0 m |
| `wear` | **0,70** — o maior dos três; pátio de carga é desgaste puro |
| `undulation` | 0,09 m / 11 m — terrapleno compactado é irregular de verdade |
| `lamps.model` | `street_lamp_01` ×1,25 (→4,8 m), altura plausível de luminária de pátio |

Scatter (224 instâncias, ~1,23 M tri): `stone_01` 120 (o pedrisco claro do panorama),
`grass_medium_02` 46 — **só a touceira SECA** —, `weed_plant_02` 34, `rock_moss_set_02` 8,
`old_tyre` 7, `trashbag` 5, `concrete_road_barrier` 4 solto.

**`grass_medium_01`, `grass_bermuda_01` e `dandelion_01` estão deliberadamente ausentes.**
Grama verde brotando em baia de carga é exatamente o erro que esta rodada tinha de evitar.

`roadside`: fila de blocos a 12,5 m (passo 3,2 m) de um lado, **alambrado a 15,0 m com passo
0,934 m** (o passo exato do módulo) do outro, e postes de energia a 15,5 m passo 26 m — os
postes aparecem na borda do pátio na própria foto.

### `urbano` — o "orgânico" aqui é desgaste, não vegetação

Planta: asfalto limpo; **meio-fio medido a 11,6 m de um lado e ~13 m do outro**; além dele
calçada, canteiro com árvores em covas e carros estacionados. Na pista há trilha de roda
polida e costura de tapa-buraco bem visíveis. **Não cresce nada.**

| campo | valor |
|---|---|
| `edgeNoise` | 0,35 m / 12 m — meio-fio de avenida é reto; só o suficiente para a borda CG não ser uma reta matemática |
| `wear` | **0,62** — é a feição dominante do chão nesta foto |
| `undulation` | 0,03 m / 20 m — avenida conservada é plana |
| `lamps.model` | `street_lamp_01` ×1,50 (→5,8 m) |

Scatter: **40 instâncias no total** — `stone_01` 38 e `trashbag` 2. Nada de grama, nada de
erva, nada de dente-de-leão. `roadside`: só `fire_hydrant` a 11,6 m, passo 52 m. **Sem poste
de energia**: avenida urbana tem cabo enterrado e a foto não mostra nenhum perto da câmera.

**Achado que vale registrar:** o disco CG de 22 m **cobre** o meio-fio fotografado a 11,6 m.
Encolher o raio para preservá-lo não dá — a carreta tem 16,5 m e ficaria com as pontas fora
do chão CG. A compensação é geometria: a fila de hidrantes a 11,6 m e os postes de luz em
`offset 11,0` (medido na seção 5) recolocam a leitura da linha de meio-fio como objeto de
verdade, em vez de como pintura.

### Ressalva honesta sobre o modelo de poste

`street_lamp_01` é um **poste ornamentado de ferro fundido de 3,87 m**; `street_lamp_02` é
uma **lanterna de parede** (não fica em pé sozinha — daí `mount: "wall"`). Os postes que
aparecem no panorama do `urbano` são de braço curvo, ~10 m, modernos. Não existe equivalente
CC0 no Poly Haven. O `modelScale` de 1,25–1,50 sobe a luminária para 4,8–5,8 m sem deformar
o modelo — ninguém sabe o tamanho absoluto de um poste, o que se lê é a proporção. **Esticar
até 8–10 m (×2,2) engrossaria o fuste** e ficaria pior que o poste curto. Se um dia entrar um
poste rodoviário CC0 de verdade, é trocar `lamps.model` e refazer o `modelScale`.
