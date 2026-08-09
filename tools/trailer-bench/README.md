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
