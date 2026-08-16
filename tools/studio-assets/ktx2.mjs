#!/usr/bin/env node
/* GERADOR DAS VARIANTES `@ktx2` DOS CONJUNTOS DE CHÃO — UASTC, não ETC1S.
   ===========================================================================

   O QUE ISTO RESOLVE, E POR QUE É O ÚNICO ITEM QUE A CPU NÃO ALCANÇA
   ---------------------------------------------------------------------------
   Os 16 mapas de `public/textures/` são 2048² em WebP/JPG. Na GPU eles não são
   WebP nem JPG: são RGBA8 descomprimido, com mipmap. Medido pelo censo:

       16 × (2048 · 2048 · 4 · 1,3333) = 341,3 MB

   É o maior bloco isolado da cena — maior que o implemento inteiro (158,7 MB) e
   maior que o cenário (127,1 MB). Numa integrada de memória compartilhada isso
   não aparece como "20 fps": aparece como engasgo de meio segundo a cada
   movimento de câmera, e às vezes como PERDA DE CONTEXTO. Nenhum conserto de
   chamada de desenho toca nisso, e nenhum ajuste de amostragem também: só menos
   bytes conserta.

   POR QUE UASTC E NÃO ETC1S — a decisão já está medida em `core/quality.ts`
   ---------------------------------------------------------------------------
   * UASTC/BC7 a 2048²: erro de 0,11 a 5,80. Resize a 1024²: erro de 0,66 a
     13,11. O PIOR CASO do UASTC é menos da metade do pior caso do resize, e por
     1/4 da VRAM. Comprimir é melhor que encolher, e por margem larga.
   * ETC1S **não economiza um byte numa UHD 630**: sem ASTC e sem ETC2, a tabela
     de prioridades do `KTX2Loader` manda o ETC1S para BC7 do mesmo jeito. Ele
     só perderia qualidade sem ganhar memória.

   O QUE ESTA FERRAMENTA ESCOLHE, e por quê
   ---------------------------------------------------------------------------
   * `isUASTC: true` — ver acima.
   * `generateMipmap: true` — OBRIGATÓRIO. Sem a cadeia dentro do arquivo, o
     `KTX2Loader` entrega só o nível 0, `generateMipmaps` fica desligado numa
     textura comprimida (o three não sabe gerar mip de bloco) e o chão a 30 m
     volta a cintilar. Confira com `censo.mjs`: `niveis` tem de ser 12 num 2048².
   * `needSupercompression: true` (Zstandard) — é **de graça**: zstd é
     desfeito na carga, o dado na GPU é idêntico, e o `KTX2Loader` do three já
     traz o decodificador embutido (`three/examples/jsm/libs/zstddec.module.js`,
     importado por ele). Só o DOWNLOAD encolhe.
   * espaço de cor: `_diff` é sRGB, todo o resto é linear. Isto vai gravado no
     DFD do KTX2 e o `KTX2Loader` define `texture.colorSpace` a partir dele —
     ou seja, marcar errado aqui clareia ou escurece o chão inteiro, e
     `loadTex()` em `scene/set.ts` não tem como corrigir depois.
   * `enableRDO: false` — RDO encolheria mais o download em troca de erro, e o
     erro é justamente o eixo em que esta escolha ganhou do resize. Quem quiser
     o degrau mais barato deve mudar a RESOLUÇÃO, não o RDO.

   ⚠️ O DOWNLOAD SOBE, E SOBE MAIS DO QUE A PRIMEIRA CONTA SUGERIA. Medido
   nesta execução: os 16 mapas passam de **22,20 MB** (WebP/JPG) para
   **68,98 MB** em UASTC+zstd — **3,1×** —, enquanto a VRAM cai de **341,33 MB**
   para **85,33 MB** (−256,00 MB, 4,0× menos).

   Isso é intencional e é o negócio que se está fechando: 4× menos VRAM e ZERO
   decodificação de JPEG/WebP na thread principal (o bloco BC7 vai direto para
   a GL), por 3× de bytes na rede — uma vez, porque a árvore é servida sob
   `/studio-assets/v1` com `Cache-Control: immutable`.

   ⚠️ MAS A TENSÃO É REAL E TEM DE SER DITA: a variante só é pedida nos níveis
   **Médio e Baixo**, que são exatamente as máquinas modestas — e máquina
   modesta costuma vir com rede modesta. Se o dono julgar que 47 MB a mais no
   primeiro carregamento não paga, há dois botões, nesta ordem de preferência:

     1. **UASTC a 1024²** — `core/quality.ts` mede 17,9 MB de download (MENOS
        que hoje) e 21,3 MB de VRAM. É a única linha do relatório que ganha nos
        dois eixos. O preço é pagar o erro do resize, que é o que se estava
        evitando.
     2. **`enableRDO: true`** — encolhe o zstd em troca de erro. Mexer aqui é
        mexer no eixo em que esta escolha ganhou do resize; se for para pagar
        erro, pague na resolução, que é medida arquivo a arquivo.

   ⚠️⚠️ A ORDEM DE DEPLOY É INVERTIDA E DERRUBA O ESTÚDIO SE FOR IGNORADA.
   Estes arquivos são SOLTOS (não vão dentro de `.glb`), então eles não têm o
   problema do `extensionsRequired`. Mas a variante `@ktx2` só pode ser
   declarada no manifesto DEPOIS que `scene/set.ts` souber carregar `.ktx2` —
   senão `loadTex()` entrega os bytes do KTX2 a um `THREE.TextureLoader`, que
   vai tentar decodificá-los como imagem, falhar, e o chão fica sem mapa.
   Para KTX2 DENTRO de `.glb` é pior: `KHR_texture_basisu` entra em
   `extensionsRequired` e o `GLTFLoader` LANÇA. **Código primeiro, assets
   depois, manifesto por último.**

   NOME DE ARQUIVO — a composição das duas regras
   ---------------------------------------------------------------------------
       textures/asphalt_diff.webp  →  textures/asphalt_diff@ktx2.ktx2

   O sufixo `@ktx2` antes da extensão é a convenção de variante que `@1k` já
   usa (`groundTexUrl()` em `scene/set.ts`); a extensão `.ktx2` é o que o
   carregador precisa. As duas regras se compõem, e o resultado é auto-descrito
   numa listagem de diretório: dá para ver de relance que `asphalt_diff` tem
   três formas e qual é qual.

   DEPENDÊNCIAS
   ---------------------------------------------------------------------------
   * `ktx2-encoder` (npm) — empacota o `basis_encoder.wasm` do BinomialLLC, o
     MESMO codec do `basis_transcoder.wasm` que o `KTX2Loader` usa no navegador.
     Não está no `package.json` do web de propósito: é ferramenta de acervo, não
     dependência de build. Instale onde for rodar:
         npm i --no-save ktx2-encoder
   * ImageMagick (`magick`) — só para decodificar WebP/JPG em RGBA cru. O
     encoder em Node não traz decodificador de imagem.

   USO
   ---------------------------------------------------------------------------
       node tools/studio-assets/ktx2.mjs --listar
       node tools/studio-assets/ktx2.mjs --saida /tmp/ktx2
       node tools/studio-assets/ktx2.mjs --variante @ktx2-1k --saida /tmp/ktx2
       node tools/studio-assets/ktx2.mjs --saida public/textures --publicar

   Sem `--publicar` a saída vai para o diretório indicado com o nome final, para
   conferência antes de qualquer coisa entrar em `public/`.

   E o erro de reconstrução, que é o número com o qual se ESCOLHE a variante:

       node tools/studio-assets/erro-ktx2.mjs public/textures '@ktx2' '@ktx2-1k'
   */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';
import { lerImagem } from './censo.mjs';

const RAIZ_REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const DIR_TEX = join(RAIZ_REPO, 'public/textures');

/* Os 16 mapas dos quatro conjuntos de chão. `metallic_nor` e `pearl_nor` NÃO
   entram: são os normal maps do preview 2D do cadastro de Tinta
   (`PAINT_TEXTURE_ASSETS` em src/config/assets.ts), consumidos por uma tela em
   produção que não tem nada a ver com o estúdio e não desenha em WebGL. */
const FAMILIAS = ['asphalt', 'concrete', 'grass', 'gravel'];
const MAPAS = ['diff', 'nor', 'rough', 'ao'];

/** Como cada tipo de mapa é codificado. O que muda entre eles é SÓ o espaço de
 *  cor — e errar isso não é sutil: um `_rough` marcado como sRGB vira um chão
 *  visivelmente mais liso, porque a rugosidade sai pela curva errada. */
function opcoesPara(mapa) {
  const cor = mapa === 'diff';
  return {
    isUASTC: true,
    generateMipmap: true,
    isKTX2File: true,
    needSupercompression: true,
    uastcLDRQualityLevel: 2,          // 0-3; 2 é o joelho da curva erro×tempo
    enableRDO: false,
    isPerceptual: cor,
    isSetKTX2SRGBTransferFunc: cor,
    isNormalMap: false,               // ver o bloco do topo
    isYFlip: false,
    enableDebug: false,
  };
}

/** Decodifica WebP/JPG/PNG em RGBA cru, opcionalmente reamostrando para `lado`.
 *  O encoder em Node não traz decodificador de imagem.
 *
 *  ⚠️ O FILTRO DA REAMOSTRAGEM É `Lanczos`, o padrão do ImageMagick para
 *  redução, e é o mesmo que o `--report` do `texopt.py` usa para medir o erro do
 *  resize. Trocar de filtro aqui mudaria o número que a Tarefa 3 compara com os
 *  0,66–13,11 registrados em `core/quality.ts` — e a comparação é o ponto. */
function decodificador(caminho, lado) {
  return async () => {
    const args = [caminho];
    if (lado) args.push('-filter', 'Lanczos', '-resize', `${lado}x${lado}!`);
    args.push('-depth', '8', 'RGBA:-');
    const raw = execFileSync('magick', args, { maxBuffer: 1 << 30 });
    let [w, h] = execFileSync('identify', ['-format', '%w %h', caminho])
      .toString().trim().split(/\s+/).map(Number);
    if (lado) { w = lado; h = lado; }
    if (raw.length !== w * h * 4)
      throw new Error(`decodificação inconsistente em ${basename(caminho)}: `
        + `${raw.length} bytes para ${w}×${h} (esperado ${w * h * 4})`);
    return { data: new Uint8Array(raw), width: w, height: h };
  };
}

/* AS DUAS VARIANTES, e por que são DUAS e não uma
   ---------------------------------------------------------------------------
   `@ktx2`     2048², UASTC/BC7 — 68,98 MB de fio, 85,33 MB de VRAM.
   `@ktx2-1k`  1024², UASTC/BC7 — o degrau do nível BAIXO.

   A de 1024² existe porque a de 2048², sozinha, é um mau negócio para a máquina
   que mais precisa dela: ela troca 341,3 → 85,3 MB de VRAM mas SOBE o download
   de 22,2 para 69,0 MB, e quem pede a variante é justamente quem tem rede
   modesta. A de 1024² é a única linha do relatório que **domina o estado atual
   nos DOIS eixos** — menos download E menos VRAM.

   ⚠️ O NOME É `@ktx2-1k` E NÃO `@1k@ktx2`. `groundVariant()` devolve UM sufixo,
   não uma composição, e `setAvailableVariants()` compara a string inteira; um
   sufixo composto obrigaria os dois a virarem gramática. O hífen também não
   colide com `@1k`, que já existe e é OUTRA COISA (o `hdrVariant`, que resize
   sem comprimir). Ler a lista de um diretório é o teste: `grass_nor.jpg`,
   `grass_nor@ktx2.ktx2`, `grass_nor@ktx2-1k.ktx2` — três formas, cada uma se
   explicando. */
const VARIANTES = {
  '@ktx2': { lado: 0 },        // 0 = resolução de origem
  '@ktx2-1k': { lado: 1024 },
};

/** Os arquivos que existem, com a origem e o destino de cada um. */
export function alvos(variante = '@ktx2') {
  const out = [];
  const v = VARIANTES[variante];
  if (!v) throw new Error(`variante desconhecida: ${variante} (só ${Object.keys(VARIANTES).join(', ')})`);
  for (const fam of FAMILIAS) for (const mapa of MAPAS) {
    for (const ext of ['.webp', '.jpg', '.png']) {
      const p = join(DIR_TEX, `${fam}_${mapa}${ext}`);
      if (!existsSync(p)) continue;
      out.push({ fam, mapa, origem: p, nome: `${fam}_${mapa}${variante}.ktx2`, lado: v.lado });
      break;
    }
  }
  return out;
}

const MB = (n) => (n / 1048576).toFixed(2);

async function main() {
  const argv = process.argv.slice(2);
  const iV = argv.indexOf('--variante');
  const variante = iV >= 0 ? argv[iV + 1] : '@ktx2';
  const lista = alvos(variante);

  if (argv.includes('--listar') || !argv.includes('--saida')) {
    let fio = 0; let vram = 0;
    console.log('origem'.padEnd(28) + 'dims'.padStart(12) + 'fio'.padStart(10) + 'VRAM hoje'.padStart(12) + '   destino');
    for (const a of lista) {
      const i = lerImagem(a.origem);
      fio += i.bytes; vram += i.vram;
      console.log(basename(a.origem).padEnd(28) + `${i.w}x${i.h}`.padStart(12)
        + (MB(i.bytes) + 'M').padStart(10) + (MB(i.vram) + 'M').padStart(12) + '   ' + a.nome);
    }
    console.log(`\n  ${lista.length} arquivos · ${MB(fio)} MB no fio · ${MB(vram)} MB de VRAM`);
    console.log(`  em UASTC/BC7 a 2048² a VRAM vira ~${MB(vram / 4)} MB (1 byte/texel em vez de 4)`);
    if (!argv.includes('--saida')) console.log('\n  (use --saida DIR para gerar)');
    if (!argv.includes('--saida')) return;
  }

  const iS = argv.indexOf('--saida');
  const dirSaida = argv[iS + 1];
  if (!dirSaida) { console.error('--saida precisa de um diretório'); process.exit(1); }
  mkdirSync(dirSaida, { recursive: true });

  const publicar = argv.includes('--publicar');
  if (publicar && dirSaida.includes('/public/')) {
    console.log('⚠️ ESCREVENDO EM public/. Os arquivos são NOVOS (sufixo @ktx2), então');
    console.log('   nenhum original é sobrescrito — mas confira antes de declarar a');
    console.log('   variante no manifesto. Ver a ordem de deploy no topo deste arquivo.\n');
  }

  const { encodeToKTX2 } = await import('ktx2-encoder');
  let fioAntes = 0; let fioDepois = 0; let vramAntes = 0; let vramDepois = 0;
  for (const a of lista) {
    const destino = join(dirSaida, a.nome);
    const antes = lerImagem(a.origem);
    if (existsSync(destino) && statSync(destino).mtimeMs > statSync(a.origem).mtimeMs) {
      const j = lerImagem(destino);
      console.log(`  = ${a.nome.padEnd(28)} já existe e é mais novo que a origem — pulado`);
      fioAntes += antes.bytes; fioDepois += j.bytes; vramAntes += antes.vram; vramDepois += j.vram;
      continue;
    }
    const t0 = Date.now();
    const bytes = await encodeToKTX2(new Uint8Array(readFileSync(a.origem)), {
      ...opcoesPara(a.mapa),
      imageDecoder: decodificador(a.origem, a.lado),
    });
    writeFileSync(destino, bytes);
    const depois = lerImagem(destino);
    /* A CONFERÊNCIA QUE NÃO PODE FALTAR: dimensões esperadas e a cadeia de
       mipmaps dentro do arquivo. Um KTX2 de um nível só passa despercebido até
       alguém olhar o chão a 30 m. */
    const alvoW = a.lado || antes.w; const alvoH = a.lado || antes.h;
    const nMip = Math.log2(Math.max(alvoW, alvoH)) + 1;
    const ok = depois.w === alvoW && depois.h === alvoH && depois.niveis === nMip;
    console.log(`  ${ok ? '✓' : '✗'} ${a.nome.padEnd(28)} ${depois.w}x${depois.h} `
      + `${depois.niveis} níveis  superc=${depois.superc}  `
      + `${MB(antes.bytes)}M → ${MB(depois.bytes)}M no fio · `
      + `${MB(antes.vram)}M → ${MB(depois.vram)}M de VRAM  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (!ok) console.log(`     ⚠️ esperado ${alvoW}x${alvoH} com ${nMip} níveis — NÃO PUBLIQUE este arquivo`);
    fioAntes += antes.bytes; fioDepois += depois.bytes;
    vramAntes += antes.vram; vramDepois += depois.vram;
  }

  console.log(`\n  fio:  ${MB(fioAntes)} MB → ${MB(fioDepois)} MB  (${(fioDepois / fioAntes).toFixed(1)}×)`);
  console.log(`  VRAM: ${MB(vramAntes)} MB → ${MB(vramDepois)} MB  (−${MB(vramAntes - vramDepois)} MB, ${(vramAntes / vramDepois).toFixed(1)}× menos)`);
  console.log('\n  PRÓXIMO PASSO, nesta ordem: (1) registrar o KTX2Loader em scene/set.ts;');
  console.log('  (2) publicar estes arquivos; (3) só então declarar "@ktx2" em');
  console.log('  environments.json, que é o que libera setAvailableVariants().');
}

const ehPrograma = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (ehPrograma) main().catch((e) => { console.error(e); process.exit(1); });
