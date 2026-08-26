# Bancada de bake do IMPLEMENTO — como um `.gltf` de fornecedor vira asset

`tools/wheel-bake/` cuida da roda, `tools/glb-texopt/` cuida de textura já dentro
do arquivo. Esta pasta cuida do caso que apareceu em 2026-08-18: **um implemento
inteiro chega com a atribuição de material apagada e a geometria em tira de
triângulos.**

## O caso que a criou — `02- Frigorfico.Gancheiro.Sobrechassi`

Baixado em 2026-08-18, 121,3 MB de `.gltf` + 65 PNG ao lado. Medido:

| o que o arquivo diz | o que ele deveria dizer |
| --- | --- |
| `materials: 1` (`metal-pouco-polido`, branco 0,8) | 17 materiais |
| `textures: 0`, `images: 0` | 13 texturas |
| `mode: 5` (TRIANGLE_STRIP) em 1 147/1 147 primitivas | `mode: 4`, como todo o resto do acervo |
| índice em `UNSIGNED_INT` | `UNSIGNED_SHORT` (nenhuma malha passa de 65 536 v) |
| 6 101 buffers, um por bufferView, em URI `data:` base64 | um chunk BIN |
| 2 792 053 triângulos submetidos | 1 749 256 — **1 042 797 eram degenerados de emenda de tira** |

O relato do dono — *"vem completamente quebrada, muitas texturas erradas, a peça
preta só tem a parte metálica, provavelmente tem z-fighting"* — é **um** defeito
visto de quatro ângulos: sem material, tudo é a mesma superfície branca; e o
sliver de área zero da tira sombreia indefinido, que é o cintilar que parece
z-fighting e não é.

## Rodar

```bash
# 1. materializar (materiais do doador + tira → lista + um BIN só)
node tools/implement-bake/materialize.mjs \
  --src   "~/Downloads/glb-extract/02- Frigorfico.Gancheiro.Sobrechassi/0fdc925d055346d293d6cd22f86dba4a.gltf" \
  --donor public/models/vehicles/trailer.glb \
  --out   /tmp/sobrechassi.raw.glb

# 2. a receita da §6 do ARCHITECTURE.md — nesta ordem, com estas flags
npx @gltf-transform/cli dedup /tmp/sobrechassi.raw.glb /tmp/a.glb --materials false
npx @gltf-transform/cli prune /tmp/a.glb /tmp/b.glb --keep-attributes false --keep-leaves true
npx @gltf-transform/cli webp  /tmp/b.glb /tmp/c.glb --slots "*" --lossless
npx @gltf-transform/cli draco /tmp/c.glb public/models/vehicles/<nome>.glb \
    --method edgebreaker --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14
```

Medido no sobrechassi: **121,3 MB → 107,6 (materializado) → 33,8 (dedup) →
17,1 (prune) → 17,0 (webp) → 8,79 MB (Draco)**. 13,8× menor que a origem.

**O passo 1 é o que faz o passo 2 valer.** Antes do destrip a linha do Draco era
`17,10 MB → 17,17 MB` com o aviso `Skipping Draco compression of 292
non-TRIANGLES primitives`: o Draco pula tira, então o passo mais eficaz da
receita virava nada. Depois, o mesmo comando faz 17,0 → 8,8.

## Por que os materiais vêm do `trailer.glb`

Os dois implementos são do mesmo autor e compartilham o vocabulário de material:
14 dos 17 nomes batem letra por letra, inclusive o erro de digitação de
`platico-branco`. E o engine inteiro despacha **por nome de material** —
`applyTrailerFinish()`, `splitTrailerHardware()`, `TRAILER_STRUCT_METAL_RE`,
`FITA_RE`, `WHITE_RE`, `DOOR_FRAME_MAT_RE`. Um implemento cujos materiais se
chamam como os do `trailer.glb` herda acabamento, ferragem de inox, fita
retrorrefletiva, lanternas e pintura sem uma linha de código nova.

As três exceções do mapa estão comentadas no cabeçalho de `materialize.mjs`;
a que importa é `parafusos → inox-ferragem`, que **reproduz** a decisão que o
`trailer.glb` já traz (lá os nós continuam `..._parafusos_0` e o material é
`inox-ferragem`), e não uma escolha nova.

⚠️ **O script FALHA em vez de inventar.** Um nome de material que não existe no
doador nem em `FROM_SOURCE` sai magenta, com `exitCode = 1` e a contagem do que
ficaria sem material. Um material branco genérico é exatamente o defeito que
esta bancada existe para tirar; ele não pode voltar por omissão.

## Passo 3 (2026-08-19) — `graft-materials.mjs`, o que o passo 1 não podia saber

`materialize.mjs` reconstrói material a partir do NOME DA MALHA
(`${nó}_${material}_${índice}`, convenção do FBX2glTF). O que ele não alcança é o
que o export já tinha fundido ANTES de nomear: no `trailer.glb` a ferragem da
porta se divide em `metal-pouco-polido`, `suporte-varao-preto`,
`engate-femea-preto`, `cano-ar-preto` e `registro-corpo-laranja`; no sobrechassi
as cinco chegam como `metal-pouco-polido`, porque foi assim que o nome da malha
saiu. O nome não sobreviveu — a GEOMETRIA sobreviveu, peça por peça, na mesma
cota em milímetros.

```bash
node tools/implement-bake/graft-materials.mjs --dry   # relata e não grava
node tools/implement-bake/graft-materials.mjs         # aplica (+ backup .bak-graft-*)
```

Ele casa por **material de origem + cota da caixa no espaço da RAIZ**, confere a
contagem de INSTÂNCIAS contra o que a bancada mediu
(`tools/studio-bench/checks-sobrechassi-0819.mjs`) e **recusa a gravação inteira**
se uma contagem não bater. Toca só o chunk JSON, mais um `append` no fim do BIN
quando o material doador traz textura — nenhum `bufferView` muda de offset e o
Draco passa intacto.

⚠️ **Ele NÃO é idempotente**, de propósito: numa segunda passada as primitivas já
não têm o material de origem, a contagem dá zero e ele reprova. Para repetir,
volte o `.bak-graft-*` primeiro.

## Convenção de nome de arquivo

Três eixos, nesta ordem, separados por `_`:

```
<montagem>_<carroceria>_<arranjo de carga>.glb
   │            │              └── gancheiro | paleteiro | (nada, na carga seca)
   │            └── frigorifico | carga_seca
   └── semirreboque | sobrechassi
```

- `sobrechassi_frigorifico_gancheiro.glb` — o desta rodada
- `semirreboque_frigorifico_paleteiro.glb` — o `trailer.glb` de hoje, quando for
  renomeado (o arquivo velho **fica no servidor**: a árvore sai com
  `Cache-Control: immutable` e `--delete` é proibido nela)

## Verificação

- `tools/implement-bake/winding.mjs` (ver o cabeçalho): concordância entre a
  normal geométrica e a declarada. **Se a inversão de enrolamento dos ímpares da
  tira estivesse errada, ~50 % dos triângulos discordariam.** Medido no
  sobrechassi: **99,85 % concordam**, 0,15 % (2 571) são do rip de origem.
- Foto: `tools/implement-bake/shoot.mjs <glb> <dir>` sobe o
  `chromium_headless_shell` do Playwright com SwiftShader, carrega o GLB com o
  `GLTFLoader` de verdade (Draco incluído) e devolve cinco enquadramentos.
  Ele NÃO roda o engine — é o retrato do ARQUIVO, não da cena.
