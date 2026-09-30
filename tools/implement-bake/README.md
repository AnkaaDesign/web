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

## Passo 4 (2026-09-29) — `variants.mjs`: as VARIANTES, trocando peças entre os dois bakes

Seis produtos, dois bakes. Os quatro que faltavam saem de uma troca de peças:

| arquivo | base | o que muda |
| --- | --- | --- |
| `semirreboque_frigorifico_gancheiro_v1.glb` | `trailer_v2.glb` | perfil superior do gancheiro (Z), +2 fileiras de friso, teto estreito |
| `sobrechassi_frigorifico_paleteiro_v1.glb` | `sobrechassi_frigorifico_gancheiro.glb` | perfil superior do paleteiro (banda), −2 fileiras, teto largo, sem gancheira |
| `sobrechassi_isotermico_paleteiro_v1.glb` | `sobrechassi_frigorifico_gancheiro.glb` | banda do paleteiro, pele de FIBRA contínua, sem gancheira, com Thermo King |
| `sobrechassi_isotermico_gancheiro_v1.glb` | `sobrechassi_frigorifico_gancheiro.glb` | pele de FIBRA contínua; Z, gancheira e Thermo King ficam |

```bash
node tools/implement-bake/variants.mjs --dry            # mede, confere os portões, não grava
node tools/implement-bake/variants.mjs                  # as três, já na receita da §6
node tools/implement-bake/variants.mjs --only isotermico-paleteiro
```

**O que difere entre gancheiro e paleteiro é UMA peça**, medida por censo e por
corte de seção: o PERFIL EXTERNO SUPERIOR (duas laterais + testeira). Banda
galvanizada de 210 mm com três nervuras no paleteiro; Z de 103 mm em barras de
3 m com rebite modelado no gancheiro. Todo o resto do canto de cima — cantoneira
50 × 60, travessa dianteira, portal traseiro — é a mesma peça na mesma cota em
relação ao teto. Três coisas trocam junto porque são função do perfil: as 4 fitas
3M horizontais que moram NA face dele, a largura e a borda dianteira do teto, e
as fileiras de friso do alto da chapa (a banda desce 130 mm mais que o Z: 2
fileiras de 53 mm). O porquê de cada número está no cabeçalho do script.

Tudo é medido nos próprios arquivos (`regua()`), cada seleção tem portão de
contagem, e o Z do gancheiro é LADRILHADO com as barras de fábrica em vez de
esticado — 2 580 + 4 × 3 000 fecha os 14 580 mm do semirreboque sem corte.

⚠️ **O engine precisou de duas marcas novas no `implements.json`**, e sem elas
as variantes carregam mas saem erradas em silêncio:

- `topRailMaterial` — o perfil de CIMA passou a ter material diferente do de
  baixo. Sem ela `measureTopRail()` não acha o perfil novo e a coluna de rebites
  para no lugar errado (122 mm abaixo do Z, ou por cima da banda).
- `skin: "fibra"` — no isotérmico. Sem ela `buildLiveryPanels()` inventa a
  grade de emendas de 1 m, o remonte e os rebites da chapa corrida em cima do
  painel liso.
- `railSkirt` — no isotérmico: a saia da chapa que saiu (a linha "saia da
  chapa" do relatório do script). Sem friso, o trilho de piso perde a régua e
  desce ~120 mm, e os rebites da ferragem inferior ficam no painel liso.

⚠️ **A UV do painel de fibra é a do bake, escrita, não ajustada**: 100 UV por
metro, projeção por face. Um ajuste por mínimos quadrados sobre a folha frisada
(1ª versão) esticou o mapa por metros e o painel saiu com faixas de brilho.

E as marcas se dividem em DUAS famílias: as do PERFIL (`stainlessTopRail`,
`topRailDressing`, `topRailMaterial`) vêm de quem DOOU o perfil; as do CORPO
(porta de fábrica, trilho de piso, mangueira, fita de canto, pino, rodagem)
vêm da BASE. Ver os `_note` de cada entrada.

Verificação no engine: `tools/studio-bench/checks-variantes-0929.mjs`.

## Convenção de nome de arquivo

Três eixos, nesta ordem, separados por `_`:

```
<montagem>_<carroceria>_<arranjo de carga>[_vN].glb
   │            │              └── gancheiro | paleteiro | (nada, na carga seca e no isotérmico)
   │            └── frigorifico | isotermico | carga_seca
   └── semirreboque | sobrechassi
```

- `sobrechassi_frigorifico_gancheiro.glb` — o desta rodada
- `semirreboque_frigorifico_paleteiro.glb` — o nome que o paleteiro terá **no
  próximo bake**. O arquivo velho fica no servidor de qualquer forma: a árvore
  sai com `Cache-Control: immutable` e `--delete` é proibido nela.

> ⚠️ **O `semirreboque_frigorifico_paleteiro.glb` QUE EXISTE NO DISCO NÃO É O
> IMPLEMENTO SERVIDO** — 2026-08-26. Ele é cópia byte a byte do `trailer.glb`
> PRÉ-`_v2`, e é nele que estas bancadas medem: `graft-materials.mjs` o usa como
> doador de material e `tools/chassis-bake/bake-protecao-lateral.cjs` extrai a
> grade dele. Continua servindo para as duas coisas — o bake `_v2` mexeu no
> TETO (46 cintas de rebite), no kit interno e no rasgo do evaporador, e em mais
> nada: mesmos 38 materiais, mesma caixa fora o topo.
>
> **O que o app carrega é `trailer_v2.glb`**, e quem manda nisso é
> `models/vehicles/implements.json`. Se um dia estas bancadas passarem a medir
> teto ou interior, troque o doador — e aí o nome de convenção deixa de ser uma
> promessa e vira o bake de verdade.

## Verificação

- `tools/implement-bake/winding.mjs` (ver o cabeçalho): concordância entre a
  normal geométrica e a declarada. **Se a inversão de enrolamento dos ímpares da
  tira estivesse errada, ~50 % dos triângulos discordariam.** Medido no
  sobrechassi: **99,85 % concordam**, 0,15 % (2 571) são do rip de origem.
- Foto: `tools/implement-bake/shoot.mjs <glb> <dir>` sobe o
  `chromium_headless_shell` do Playwright com SwiftShader, carrega o GLB com o
  `GLTFLoader` de verdade (Draco incluído) e devolve cinco enquadramentos.
  Ele NÃO roda o engine — é o retrato do ARQUIVO, não da cena.
