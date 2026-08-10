# Porta lateral do implemento — continuação

Continue o trabalho da porta lateral do Truck Studio. Leia este arquivo inteiro
antes de mexer em qualquer coisa: ele tem o estado, as medidas já levantadas e a
lista de defeitos abertos. **Não re-derive o que já está medido aqui** e **não
invente geometria** — foi o que quebrou as três primeiras tentativas.

## Regra que já custou caro

Toda peça sai do implemento, extraída em runtime. Nada de asset novo, nada de
caixa desenhada à mão "com o tamanho que parece certo". Quando algo faltar, ache
no modelo; se não existir no modelo, diga que não existe em vez de inventar.

E: **as medidas do rip da Ibiporã NÃO são as do nosso `trailer.glb`.** O rip
serve para descobrir *o que existe e onde fica*; o tamanho para o casamento tem
de sair do NOSSO bake. Essa confusão é a causa direta dos defeitos 1 e 2 abaixo.

## Arquivos

- `web/src/pages/tools/truck-studio/engine/vehicle/trailer-door.ts` — medidas,
  tabela de peças (`DOOR_PARTS`), layout (`layoutDoor`), marco/borracha
  (`doorFrameGeometry`), faixas lisas (`LEAF_FLAT_BANDS`).
- `.../trailer-geometry.ts` — recorte do vão, folha, extração do kit
  (`extractDoorKit`, `orientGeometry`), instanciação (`rebuildParts`,
  `rebuildJambs`).
- `.../livery-structure.ts` — cadastro de portas, clamps, `addDoor`.
- `.../livery.ts` — `measurePaintable()` (o véu cinza do editor).
- `web/tools/trailer-bench/` — **bancada headless**: `node
  tools/trailer-bench/shoot-door.mjs` sobe o `trailer.glb` num three.js sem
  navegador, monta a porta com o código de verdade e cospe diagnóstico + PNGs em
  `shots-porta/`. **Use sempre**: "uma medida que não vira imagem não prova
  aparência."
- `web/tools/trailer-bench/PORTA-TRASEIRA-DIREITA.md` — inventário completo da
  porta traseira direita em coordenadas da porta. É a fonte do kit.
- `trailer-door.test.ts` — 23 testes; mantenha verdes.

**ARQUIVOS ESPELHADOS.** `trailer-door.ts`, `trailer-geometry.ts` e
`livery-layers.ts` têm cópia idêntica em `truck-studio-desktop/src/studio/`.
Copie depois de cada mudança.

## O modelo original

`C:\Users\Kennedy\Downloads\3d_Ripper_Pro_v108\Downloads\IbiporImplementosRodovirios\01- Frigorfico.Gancheiro.Sobrechassi\0fdc925d055346d293d6cd22f86dba4a.gltf`

2 935 nós, **1 material só** — a identidade do material está no NOME DO NÓ
(`stitch_result_stitch all_<material>_0`). Nós úteis: `#porta-lateral` 2472,
`#porta-traseira-esquerda` 2684, `#porta-traseira-direita` 2927,
`borracha-porta-lateral-01…04` 2285–2294, `estrutura-principal-*` (o marco).

**A subárvore da porta não contém o marco nem a borracha** — eles ficam fora
dela. Ignorar isso é o erro original.

### Seção da porta lateral (x contra a crista da pele em −1,2995)

    marco    metal-estrutura-principal-padrao  −1,2935…−1,2284   6,0 … 71,1 mm
    borracha borracha-preta                    −1,2950…−1,2234   4,5 … 76,1 mm
    folha    Cor_padrao_branco, FRISADA (2354) −1,2944…−1,2883   5,1 … 11,2 mm
    forro    Cor_padrao_branco, liso 2,3 mm    −1,2304…−1,2280  69,1 … 71,5 mm

Não existe rebaixo: tudo entre 4,5 e 6,0 mm atrás da crista. A faixa escura das
fotos é o MARCO + a BORRACHA, não sombra.

Em Z, da borda da folha: vão −94,4 · marco −94,4…−15,7 · borracha −36,6…+6,2 ·
folha 870 mm.

### Faixas lisas da folha (nó 2354, altura 2350,0 mm, do pé)

    0,0 …  281,2      776,0 …  917,2      1465,0 … 1606,2      2101,0 … 2350,0

Mesmo perfil de friso da parede (53,0 mm), com três segmentos de 35,2 mm
trocados por faixa lisa. **As guias do varão ficam CENTRADAS nas duas faixas do
meio.**

## O que já está feito e verificado

- Kit de 19 famílias portado da traseira direita por giro de −90° em Y
  (det +1). 17 instanciam.
- Dobradiça na TRASEIRA, varão na DIANTEIRA. Passo 682,05 mm, corrida centrada.
- Mão da peça derivada por peça em `extractDoorKit` (de qual porta traseira ela
  veio), não por espelho global.
- Marco + borracha + fundo de vedação fechando o vão; vão assentando sobre o
  perfil da lateral.
- Faixas lisas aplicadas no plano do VALE, com normal do painel.
- Medida padrão da porta: 1,20 × 2,10 m.

## DEFEITOS ABERTOS — resolva todos

### 1. Quatro famílias não são encontradas no nosso bake
`shoot-door.mjs` avisa: `peças não encontradas: SUPORTE_TALA, ENCAIXE,
BORRACHA_H, ALAVANCA`.

Causa: os `size` em `DOOR_PARTS` vieram do RIP e o nosso `trailer.glb` tem
dimensões diferentes (o varão, por exemplo, é 2480 no rip e 2490 aqui), fora dos
4 mm de `PART_TOL`.

Conserto: acrescente ao `doorprobe.ts` um dump das peças do NOSSO bake por
material (`metal-estrutura-principal-padrao`, `borracha-preta`,
`metal-pouco-polido`) na região das portas traseiras (z ≈ −7,4), agrupadas por
tamanho, e corrija os quatro `size`. As peças que procuramos, pelo rip:

- `SUPORTE_TALA` — macho da dobradiça soldado ao marco, 25 × 114 × 46, no Z do
  pino, nas MESMAS alturas da tala (passo 682,05).
- `ENCAIXE` — recebe o macho do varão, 101 × 37 × 44, no Z do varão, ~60 mm
  além de cada ponta da folha.
- `BORRACHA_H` — travessa de vedação, 1100 × 48 × 78, extrusão (estica em Z).
- `ALAVANCA` — 54 × 150 × 12. Nunca foi encontrada, desde a primeira versão.

### 2. A borracha tem de ficar POR BAIXO da ferragem
Hoje a vedação é desenhada no mesmo plano das dobradiças e do varão. No
implemento ela passa por trás deles. Ajuste a profundidade relativa (a borracha
está a `SEAL_FRONT` = 4,5 mm da crista; a ferragem, a `w` da face da folha) para
que a ferragem sempre a cubra.

### 3. O "preto" não bate com a borracha
O anel de caixas (`doorFrameGeometry`, variável `seal`) hoje é FUNDO — existe só
para garantir o vão fechado. Ele ainda aparece e não coincide com o perfil
extraído. Ou alinhe os dois exatamente, ou elimine o anel assim que
`BORRACHA_V`/`BORRACHA_H` estiverem entrando (defeito 1).

### 4. `FRAME_WIDTH` está desafinado de propósito
Está 40 mm contra 78,7 medidos, para compensar o marco renderizar CLARO no nosso
bake enquanto no original é escuro. É a única medida inventada que sobrou.
Decida: ou escurece o material do marco e volta aos 78,7, ou mantém e registra.

### 5. Editor de livery quebra ao adicionar porta
Ao cadastrar uma porta, o wrapper do editor fica ~2,6× mais alto que o painel,
com o desenho da chapa só no terço de cima e o resto tomado pelo véu cinza.
`PANEL_MM` continua certo (1465,6 × 277,7 cm), então o erro está entre
`measurePanel`/`syncSurfaceAspect`/`measurePaintable` e o CSS — não na
composição. Há um `console.warn` novo em `measurePaintable()` que nomeia a peça
responsável pelo véu: abra o editor, adicione a porta e leia
`[livery] painel right: só N% é pintável…`.

### 6. `MIN_DOOR_HEIGHT` divergente no formulário React
`implement-measure-form.tsx` tem `Math.max(50, …)` na altura de porta; o engine
já clampa em 90 cm (o mínimo da geometria). Suba o formulário.

### 7. `VARAO` e `ANEL` avisam sentido indeterminado
`extractDoorKit` não consegue dizer de qual porta traseira essas duas vieram
(estão a 115 mm do centro do baú no eixo de profundidade). Hoje caem num
palpite. Para peças de seção quadrada é inofensivo — confirme no render e, se
aparecer torto, use outro critério.

## Como trabalhar

1. Rode `node tools/trailer-bench/shoot-door.mjs` e OLHE os PNGs em
   `shots-porta/` antes e depois de cada mudança. `pintado-3-4.png` é o melhor
   enquadramento (branco sobre branco esconde defeito).
2. Mantenha `npx tsc -b` e `npx vitest run src/pages/tools` verdes.
3. Espelhe os três arquivos no `truck-studio-desktop`.
4. Só diga que está pronto depois de ver a imagem.
