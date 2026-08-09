# `wheel_fh16.glb` — a roda do implemento

Assa uma roda do **Volvo FH16 2012** e a normaliza para `engine/vehicle/wheels.ts`
instanciar nas 14 posições de rodagem do implemento.

## Por quê

Medido no `trailer.glb`: a rodagem original são 14 nós reusando a mesma malha —
`pneu-corpo` 44 593 v, `pneu-lateral` 2 240 v e `aro-rodas` 18 948 v, ~**920 k
vértices**, quase um quinto do arquivo.

E o que lê como falso é **o pneu**, não o aro. (A primeira versão deste
documento dizia o contrário, lendo o manifesto: `aro-rodas` não declara textura
nenhuma e a malha nem traz `TEXCOORD_0`. O render desmentiu — o aro original sai
como uma roda de aço branca perfeitamente aceitável.)

O mapa de cor-base de `pneu-corpo` é 1024² com **13 KB**, e o tamanho já contava
a história. Em luminância linear:

| mapa | p10 | p50 | p90 | pixels < 0,02 |
|---|---|---|---|---|
| `pneu-corpo` (implemento) | 0,012 | 0,741 | 0,741 | **16,3 %** |
| `trail70_colspec` (FH16) | 0,083 | 0,157 | 0,204 | **0,0 %** |

Um histograma de dois valores: os 16,3 % em preto quase puro **são** a ilha de
UV do pneu — mancha chapada, sem banda, sem desenho de flanco —, e o 0,741 é
fundo de UV que ninguém amostra. O do FH16 tem distribuição real em torno de
0,16 linear (≈ sRGB 0,44), com contraste de banda.

O FH16 traz disco, cubo, porcas e pneu como quatro peças, cada uma com cor e
normal próprios. O ganho de ~920 k vértices é consequência, não motivo.

## Como rodar

```bash
~/blender-sdk/blender -b --factory-startup --python bake_wheel.py -- \
    /srv/studio-assets/v1/models/trucks/volvo_fh16_2012_4x2.glb \
    /srv/studio-assets/v1/models/vehicles/wheel_fh16.glb
```

Blender é um build portátil em `~/blender-sdk` (4.5.12 LTS), sem root — mesmo
padrão do `~/flutter-sdk`. Saída medida: **646 KB**, Draco + WebP.

`inspect_wheel.py` é o passo anterior: lista onde as rodas estão no GLB de
origem, agrupando faces por posição. É de onde saem as constantes `DUAL` e
`SINGLE` de `bake_wheel.py`, e é o que se roda de novo se algum dia a fonte
mudar de modelo.

```bash
~/blender-sdk/blender -b --factory-startup --python inspect_wheel.py -- <glb>
```

## O que o asset promete

Dois nós, e o contrato inteiro de `swapTrailerWheels()` está neles:

| nó | o que é | vai onde |
|---|---|---|
| `WHEEL_DUAL` | conjunto traseiro (`rdisc` + `rhub` + porcas + par de pneus) | 6 posições de rodado duplo |
| `WHEEL_SINGLE` | conjunto dianteiro (`fdisc` + `fhub` + porcas + 1 pneu) | 2 estepes |

Os dois saem com **centro do cubo na origem**, **eixo em +X com a face externa
para +X** e **diâmetro do pneu exatamente 1,0**. É isso que permite ao engine
não conhecer a geometria: a escala é o diâmetro que ele mede no implemento e a
orientação sai de um `setFromUnitVectors`.

Os materiais são renomeados no bake porque `applyTrailerFinish()` despacha por
NOME — mas o sufixo `-fh16` existe para essa função **não** encostar neles:
`FH16_WHEEL_RE` os deixa passar intocados, com o `envMapIntensity` 1.35 que
`setupCommon()` põe, que é exatamente o que o cavalo mostra na roda idêntica.

> A primeira versão fez o contrário e explicou o contrário: batizou o pneu de
> `pneu-fh16` **para** casar `^pneu` em `TRAILER_RUBBER_RE` e levar env 0.3.
> Esse corte é remendo para material errado — a borracha do rip do implemento,
> que espelha o céu como plástico polido — e aplicá-lo a material CERTO só
> escurece. Medido na bancada, na mesma cena e no mesmo enquadramento:
>
> | `envMapIntensity` | luminância média da borracha | fração quase preta |
> |---|---|---|
> | 1.35 (o valor do cavalo) | 52,9 | 0,8 % |
> | 0.30 (o corte de borracha) | 33,7 | 14,8 % |
> | — pneu original do implemento | 18,1 | 59,4 % |
>
> Foi o relato "o pneu continua muito preto, o do Volvo é levemente
> acinzentado": o mesmo asset, a mesma textura, 4,5× menos ambiente.

## Duas armadilhas que já custaram uma rodada

1. **O rip entrega as rodas mescladas por MATERIAL e sem solda.**
   `wheel_f_0_0_ftire_p0` é uma malha só com os pneus dos dois eixos e dos dois
   lados, e separar por partes soltas devolve **5409 cacos**, não 4 rodas. Por
   isso o recorte é por POSIÇÃO: uma roda é um sólido de revolução em torno do
   eixo lateral, logo é identificada pelo par (x do eixo, y longitudinal).

2. **Não recorte com os operadores de edit-mode.** Marcar `polygon.select` em
   modo objeto e chamar `mesh.select_mode(type='FACE')` **recalcula** a seleção
   de face a partir da de vértice, que vem do importador com tudo marcado — a
   máscara é jogada fora e o objeto inteiro some. Foi o que deixou o `rdisc` com
   0 faces enquanto as outras três peças passavam. O recorte é por `bmesh`.

   E `src.copy()` preserva o PAI; o importador glTF pendura tudo num nó de
   conversão Y-up→Z-up, então comparar `polygon.center` (local) com números
   medidos em mundo compara referenciais diferentes. O script achata a matriz de
   mundo antes de recortar.

3. **`rotation_euler` não faz nada num objeto vindo do glTF.** O importador
   deixa `rotation_mode = 'QUATERNION'`, e nesse modo o Blender lê
   `rotation_quaternion` — a atribuição some sem uma linha de erro, e o
   `transform_apply` seguinte aplica só a escala. Foi assim que a roda saiu
   **montada ao contrário**: o disco enterrado para dentro do rodado e, de fora,
   o vazio do aro. O script agora força `rotation_mode = 'XYZ'`.

   E não decide mais o lado por raciocínio de sinal: **a face externa é onde o
   disco está**, medido comparando o centróide do disco com o do pneu. No fim
   confere que a borda do disco alcança a face externa do pneu e **aborta o bake**
   se não alcançar — era essa conferência que faltava para o defeito não ter
   chegado à tela.

## Conferência

`verify_place.py` repete em Python a conta de `swapTrailerWheels()` — medida por
vértice, agrupamento do rodado duplo, escala pelo diâmetro, recuo do cubo pelo
avanço do pneu — e compara a caixa do pneu novo com a do original. Verificado no
bake corrente:

```
14 pneus → 8 conjuntos (6 duplos + 2 avulsos)
face externa   0,0 mm de erro nos 8  (é o que a conta alinha)
face interna  12 a 21 mm de folga    (o duplo do FH16 é 2x315 mm contra
                                      2x343 mm do implemento — a folga fica
                                      escondida entre as rodas e o chassi)
Ø 1,0749 m · estepes detectados no eixo Y, deitados
```

```bash
~/blender-sdk/blender -b --factory-startup --python verify_place.py -- \
    /srv/studio-assets/v1/models/vehicles/trailer.glb wheel_fh16.glb
```

## Onde o arquivo mora

`STUDIO_ASSETS_ROOT` é `/srv/studio-assets` (**não** `.../v1`), então o destino é
`/srv/studio-assets/v1/models/vehicles/wheel_fh16.glb`. O acervo espelhado fica
em `/srv/files/Estudio3D/v1/models/vehicles/`; ponha nos dois, senão a próxima
sincronização apaga.

Acrescentar arquivo NOVO em `v1/` é seguro. **Sobrescrever não é**: a API serve
essa árvore com `Cache-Control: public, max-age=31536000, immutable`, e o
cliente não volta a checar por um ano.

> ⚠️ **`wheel_fh16.glb` está QUEIMADO. Não reaproveite esse nome.** A primeira
> bake saiu com a roda montada ao contrário e ficou servida por uma hora antes
> de ser corrigida — e a correção foi publicada por cima do mesmo arquivo, que é
> exatamente o que este parágrafo proíbe. Quem abriu o estúdio naquela janela
> ficou com a roda torta colada no URL, sem cache-buster para puxar. O nome em
> uso é **`wheel_fh16_v2.glb`** (`WHEEL_ASSET` em `engine/vehicle/models.ts`), e
> a próxima bake ganha o próximo sufixo.

O destino, então, é `/srv/studio-assets/v1/models/vehicles/wheel_fh16_v2.glb` —
e a mesma cópia em `/srv/files/Estudio3D/v1/models/vehicles/`.
