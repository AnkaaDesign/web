# `tools/placa` — a placa de licenciamento do Truck Studio

> ⚠️ **"Placa" aqui é a placa do veículo** (Mercosul, 400 × 130 mm). Nesta base a
> palavra já significa outras duas coisas: a **chapa** da carroceria do
> implemento (`PLATE_PITCH`, `plateSeams()` em `vehicle/models.ts`) e o **prato**
> da quinta roda (`fifthWheel.plateTopY` em `hitch.json`). Nada aqui tem a ver
> com nenhuma das duas.

Três peças, e elas rodam em ordem:

| arquivo | o que faz |
|---|---|
| `build.py` | prepara a ARTE: recorta o PNG de origem, preenche os cantos e deriva o normal map do relevo dos caracteres |
| `probe.mjs` | mede ONDE a placa cabe em cada um dos 49 cavalos e escreve `models/vehicles/plates.json` |
| `contato.py` | monta a folha de contato das 49 fotos que a bancada tira |

O lado do implemento **não** está aqui: ele é paramétrico e a traseira anda a
cada redimensionamento, então a posição é medida em runtime, no porta-placa sob
a lanterna. Ver `engine/vehicle/license-plate.ts`.

## A arte

```bash
python3 tools/placa/build.py
```

Entra `tools/placa/fonte.png` (a arte como o cliente a entregou) e saem dois
arquivos em `public/models/vehicles/`:

```
placa_mercosul_ankaa.webp       1024 × 333   ~178 kB   cor (sRGB)
placa_mercosul_ankaa_nor.webp    512 × 166    ~13 kB   normal map do relevo
```

O cabeçalho de `build.py` explica as três coisas que a arte crua não podia dar:
ela vem com um halo de sombra (o corpo da placa ocupa `x 64…2107 · y 51…649` dos
2172 × 724 do PNG), os cantos são arredondados no ALFA (e a malha já os
arredonda, então duas arredondadas deixariam franja), e os caracteres de uma
placa brasileira são ESTAMPADOS — sem relevo a peça lê como adesivo.

## Onde a placa cabe em cada cavalo

```bash
node tools/placa/probe.mjs             # mede e reescreve o manifesto
node tools/placa/probe.mjs --dry       # mede e imprime, sem escrever
node tools/placa/probe.mjs --só volvo  # filtra por nome de arquivo
node tools/placa/probe.mjs --mapa volvo_fh_2021_4x2.glb   # o z-buffer em texto
```

Roda em ~10 s para os 49. O relatório sai assim:

```
volvo_fh_2021_4x2.glb    y=0.400 rms= 1.7mm res=  6.0mm inc=  -0.5° vão=  9mm   cabin_p1 [...]
daf_xf_105_4x2.glb       y=0.415 rms=14.4mm res= 28.3mm inc=  11.8° vão= 45mm AUTORADA
```

`vão` é o afastamento entre a chapa e a superfície **no contorno** da placa, e é
ele que dá a profundidade do berço no engine. Mediana da frota: 10 mm.

Uma medida errada se corrige em `AUTORADOS`, dentro do próprio `probe.mjs` — uma
altura, com o motivo escrito ao lado. **Não edite `plates.json` à mão:** a
próxima corrida da sonda apaga a correção em silêncio.

## A conferência

```bash
DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-placa-0816.mjs        # o portão
DISPLAY= STUDIO_BENCH_GPU_ARGS='...' \
  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-placa-frota-0816.mjs  # os 49
python3 tools/placa/contato.py
```

O primeiro prova as propriedades (sítio, tamanho, material, fusão, resize) e
fotografa seis chassis. O segundo carrega os 49 e fotografa cada um; o terceiro
monta `shots/placa-folha-de-contato.png`, que é o que se OLHA.

## Publicar

Os dois `.webp` e o `plates.json` são assets novos em `public/models/vehicles/`,
ou seja entram na árvore que a **API** serve sob `/studio-assets/v1/`. Sem o
rsync do runbook (`api/docs/DEPLOYMENT-studio-assets.md`) o código novo sobe e
pede três arquivos que não existem no servidor — e o modo de falhar é silencioso
por desenho: a placa some e o console avisa. São arquivos NOVOS, então não há o
risco de sobrescrita imutável que queimou `wheel_fh16.glb`.
