#!/usr/bin/env node
/* CENSO DO ACERVO — quanto cada arquivo custa em fio, em chamada e em VRAM.
   ===========================================================================

   POR QUE ISTO EXISTE, E POR QUE NÃO É O `bench.mjs`
   ---------------------------------------------------------------------------
   `tools/studio-bench/bench.mjs` mede a cena VIVA: sobe um Chromium, carrega o
   estúdio, e conta o que o renderizador de fato submete. É a medição certa para
   tempo de quadro — e é cara, é frágil (já vazou browser órfão) e só enxerga a
   combinação de cenário + cavalo + implemento que foi pedida naquela execução.

   Este censo é o outro lado: lê os ARQUIVOS, todos eles, sem navegador. É o que
   responde "onde estão os 1 087 MB de textura" — pergunta que a cena viva
   responde só para a cena que estiver carregada, e que o dono precisa
   respondida para o acervo INTEIRO, porque o acervo inteiro é o que ele publica.

   O que ele soma e o que ele NÃO soma
   ---------------------------------------------------------------------------
   Ele soma o CUSTO DECLARADO de cada arquivo: se todas as imagens daquele .glb
   subissem para a GPU, quanto seria. Isso é um TETO por arquivo, não a VRAM de
   uma cena — numa cena real o cavalo é um só, e o three descarta o que nenhum
   material referencia. O teto é o número certo para decidir O QUE COMPRIMIR,
   porque comprimir é uma decisão por ARQUIVO e não por cena.

   ⚠️ A CONTA DE VRAM, escrita por extenso para ninguém ter de adivinhar:

       bytes_na_gpu = largura · altura · 4 · 1,3333

   O `· 4` é RGBA8 — o three sobe tudo como RGBA8 por padrão em WebGL2, mesmo um
   JPEG sem alfa, mesmo um mapa de rugosidade que só usa um canal. Não há
   economia por canal: a economia por canal exigiria formatos comprimidos, que é
   exatamente o que o KTX2 traz.

   O `· 1,3333` é a cadeia de mipmaps: 1 + 1/4 + 1/16 + … = 4/3. Ela é gerada
   para toda textura com `generateMipmaps` (o padrão), e é obrigatória — sem ela
   o chão a 30 m vira ruído cintilante.

   Quando o formato MUDA essa conta:

     · `.hdr` (RGBE) — carregado pelo `RGBELoader` como `HalfFloatType`, ou seja
       RGBA de 16 bits: **8 bytes por texel**, o dobro. E o `.hdr` do céu não
       gera mipmap (é fonte do PMREM), então NÃO leva o 4/3. A conta é
       `w · h · 8`. O PMREM assado a partir dele é um custo À PARTE, que este
       censo não estima porque depende do tamanho escolhido em runtime.
     · KTX2/UASTC transcodificado para **BC7** — 1 byte por texel (bloco 4×4 em
       16 bytes), COM mipmap: `w · h · 1 · 1,3333`. É 1/4 da conta de cima, e é
       de onde sai o "341,3 → 85,3 MB" registrado em `core/quality.ts`.
     · KTX2/ETC1S transcodificado para **BC1** — 0,5 byte por texel. Não use:
       `core/quality.ts` mede que numa UHD 630 o ETC1S é mandado para BC7 do
       mesmo jeito, perdendo qualidade sem ganhar memória.

   O que o número NÃO inclui, e por isso a soma do relatório é maior que a soma
   daqui: os ALVOS DE RENDER. O mapa de sombra 3072² (RGBA8 + D24 = 72 MB) e o
   alvo do reflexo do piso (96,7 MB) não são arquivo nenhum — nascem em runtime.

   USO
   ---------------------------------------------------------------------------
       node tools/studio-assets/censo.mjs                 # o acervo de CENA
       node tools/studio-assets/censo.mjs --tudo          # inclui o que é DOM
       node tools/studio-assets/censo.mjs --raiz public/models/vehicles
       node tools/studio-assets/censo.mjs --tsv > censo.tsv
       node tools/studio-assets/censo.mjs --imagens        # detalha imagem a imagem
       node tools/studio-assets/censo.mjs --cena distrito-industrial+volvo_fh_2021_4x2

   ⚠️ CENA ≠ ACERVO, e por padrão o censo mostra só o que vira TEXTURA DE GL.
   `public/renders/`, `public/brands/`, `public/messages/`, `public/branding/`,
   `public/icons/` e `public/ghs/` são imagens de DOM — entram numa `<img>`, o
   navegador as decodifica e as descarta, e nenhuma delas ocupa VRAM de cena.
   São 900+ arquivos; contá-las na mesma soma que os mapas de chão daria um
   total de 6,7 GB que não descreve máquina nenhuma. `--tudo` mostra as duas
   colunas separadas, para quem quiser auditar o DOWNLOAD em vez da VRAM.

   ⚠️ Ele NÃO escreve nada. É leitura pura; pode rodar em cima do acervo de
   produção sem cerimônia. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
// (readdirSync também é usado por cena(), para as chapas do livery)
import { analyze } from '../studio-bench/glbstat.mjs';

const RAIZ_REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/* ------------------------------------------------------------------ *
 * Leitura de cabeçalho de imagem SOLTA (fora de .glb)
 *
 * Os mesmos quatro formatos que `glbstat.mjs` reconhece dentro do contêiner,
 * mais o `.hdr`, que só aparece solto. A duplicação é deliberada e pequena:
 * `glbstat.mjs` lê de um `Buffer` já fatiado do chunk BIN e é a ferramenta que
 * o resto do bench importa; aqui a entrada é um caminho de arquivo. Fundir as
 * duas obrigaria a exportar o parser e a versionar essa fronteira por um ganho
 * de vinte linhas.
 * ------------------------------------------------------------------ */

function dimsHdr(buf) {
  /* Radiance .hdr: cabeçalho ASCII terminado por linha em branco, e a linha
     seguinte é a resolução — `-Y <alt> +X <larg>`. */
  const txt = buf.toString('latin1', 0, Math.min(buf.length, 4096));
  const m = /[-+]Y\s+(\d+)\s+[-+]X\s+(\d+)/.exec(txt);
  if (!m) return null;
  return { w: Number(m[2]), h: Number(m[1]) };
}

function dimsPng(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function dimsJpg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function dimsWebp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const c = buf.toString('ascii', 12, 16);
  if (c === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
  if (c === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  if (c === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

function dimsKtx2(buf) {
  /* KTX 2.0 — o cabeçalho, campo a campo, porque errar um offset aqui devolve
     um número plausível e ERRADO (foi o que aconteceu na primeira versão desta
     função: ela lia `supercompressionScheme` e reportava "2 níveis de mipmap"):

        0  identificador, 12 bytes
       12  vkFormat              u32   (0 = formato do Basis, transcodificado)
       16  typeSize              u32
       20  pixelWidth            u32
       24  pixelHeight           u32
       28  pixelDepth            u32
       32  layerCount            u32
       36  faceCount             u32
       40  levelCount            u32   ← a cadeia de mipmaps veio no arquivo?
       44  supercompressionScheme u32  (0 nenhuma, 1 BasisLZ, 2 Zstandard)

     `levelCount` é o que importa conferir: sem a cadeia dentro do arquivo o
     transcodificador entrega só o nível 0 e o chão volta a cintilar. */
  if (buf.length < 48 || buf[0] !== 0xab || buf[1] !== 0x4b) return null;
  return {
    w: buf.readUInt32LE(20), h: buf.readUInt32LE(24),
    vkFormat: buf.readUInt32LE(12),
    niveis: buf.readUInt32LE(40),
    superc: buf.readUInt32LE(44),
  };
}

/** Dimensões + formato de uma imagem solta. `null` se não for imagem conhecida. */
export function lerImagem(caminho) {
  const buf = readFileSync(caminho);
  const ext = extname(caminho).toLowerCase();
  let d = null; let fmt = '?';
  if ((d = dimsPng(buf))) fmt = 'png';
  else if ((d = dimsWebp(buf))) fmt = 'webp';
  else if ((d = dimsJpg(buf))) fmt = 'jpg';
  else if ((d = dimsKtx2(buf))) fmt = 'ktx2';
  else if (ext === '.hdr' && (d = dimsHdr(buf))) fmt = 'hdr';
  if (!d) return null;
  return { ...d, fmt, bytes: buf.length, vram: vramDe(fmt, d.w, d.h) };
}

/** A conta de VRAM, num lugar só. Ver o bloco do topo. */
export function vramDe(fmt, w, h) {
  if (!w || !h) return 0;
  if (fmt === 'hdr') return w * h * 8;          // RGBA16F, sem mipmap (fonte do PMREM)
  if (fmt === 'ktx2') return w * h * 1 * 4 / 3; // UASTC → BC7: 1 B/texel, com mipmap
  return w * h * 4 * 4 / 3;                     // RGBA8 + mipmap
}

/* ------------------------------------------------------------------ *
 * Varredura
 * ------------------------------------------------------------------ */

const EXT_MALHA = new Set(['.glb', '.gltf']);
const EXT_IMG = new Set(['.png', '.jpg', '.jpeg', '.webp', '.hdr', '.ktx2']);

/* Diretórios cujas imagens NUNCA viram textura de WebGL — ver o aviso do topo.
   A lista é de PREFIXOS relativos a `public/`, e é curta de propósito: o que
   não estiver aqui conta como cena, que é o lado seguro de errar (um arquivo
   novo aparece na conta e alguém pergunta o que é, em vez de sumir dela). */
const DOM_APENAS = ['renders/', 'brands/', 'branding/', 'messages/', 'icons/', 'ghs/',
  /* As chapas do editor de plotagem — DOM/canvas 2D, nunca `THREE.Texture`.
     Ver o bloco longo em `cena()`, que explica por que elas parecem cena e não
     são: `models/vehicles/` inteiro é geometria, MENOS este subdiretório. */
  'models/vehicles/panels/'];
const ehDom = (rel) => DOM_APENAS.some((d) => rel.startsWith('public/' + d));

function* andar(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { yield* andar(p); continue; }
    yield { caminho: p, bytes: st.size };
  }
}

const MB = (n) => (n / 1048576).toFixed(1);
const N = (n) => n.toLocaleString('pt-BR');

function main() {
  const argv = process.argv.slice(2);
  const tsv = argv.includes('--tsv');
  const detalhe = argv.includes('--imagens');
  const iR = argv.indexOf('--raiz');
  const raiz = iR >= 0 ? argv[iR + 1] : join(RAIZ_REPO, 'public');

  const iC = argv.indexOf('--cena');
  if (iC >= 0) { cena(argv[iC + 1], join(RAIZ_REPO, 'public')); return; }

  const malhas = []; const imagens = []; const outros = [];
  for (const f of andar(raiz)) {
    const ext = extname(f.caminho).toLowerCase();
    /* Os `.bak-*` são cópia de segurança, não acervo servido. Contá-los
       inflaria o total com bytes que nenhum navegador pede. */
    if (/\.bak(-|$)/.test(basename(f.caminho))) { outros.push(f); continue; }
    if (EXT_MALHA.has(ext)) malhas.push(f);
    else if (EXT_IMG.has(ext)) imagens.push(f);
    else outros.push(f);
  }

  /* ---- malhas ---- */
  const linhas = [];
  for (const m of malhas) {
    let r;
    try { r = analyze(m.caminho); } catch (e) { console.error(`ERRO ${m.caminho}: ${e.message}`); continue; }
    linhas.push({ rel: relative(RAIZ_REPO, m.caminho), ...r });
  }
  linhas.sort((a, b) => b.vram - a.vram);

  if (tsv) {
    console.log(['arquivo', 'bytes', 'prims', 'tris', 'materiais', 'nos', 'instGPU', 'imgs', 'vram_bytes'].join('\t'));
    for (const l of linhas)
      console.log([l.rel, l.bytes, l.prims, l.tris, l.materials, l.nodes, l.gpuInstances, l.imgs.length, Math.round(l.vram)].join('\t'));
  } else {
    console.log('\n╔═══ MALHAS ═══════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('arquivo'.padEnd(46) + 'fio'.padStart(8) + 'prims'.padStart(7) + 'triâng.'.padStart(12)
      + 'mat'.padStart(5) + 'nós'.padStart(7) + 'instGPU'.padStart(9) + 'imgs'.padStart(6) + 'VRAM'.padStart(9));
    for (const l of linhas)
      console.log(l.rel.padEnd(46) + (MB(l.bytes) + 'M').padStart(8) + String(l.prims).padStart(7)
        + N(l.tris).padStart(12) + String(l.materials).padStart(5) + String(l.nodes).padStart(7)
        + String(l.gpuInstances).padStart(9) + String(l.imgs.length).padStart(6) + (MB(l.vram) + 'M').padStart(9));
  }

  const somaFio = linhas.reduce((a, l) => a + l.bytes, 0);
  const somaTri = linhas.reduce((a, l) => a + l.tris, 0);
  const somaVram = linhas.reduce((a, l) => a + l.vram, 0);
  const somaImgs = linhas.reduce((a, l) => a + l.imgs.length, 0);

  /* ---- imagens soltas ---- */
  const soltas = []; const dom = [];
  for (const f of imagens) {
    const i = lerImagem(f.caminho);
    if (!i) { console.error(`? formato não reconhecido: ${f.caminho}`); continue; }
    const rel = relative(RAIZ_REPO, f.caminho);
    (ehDom(rel) ? dom : soltas).push({ rel, ...i });
  }
  soltas.sort((a, b) => b.vram - a.vram);

  if (!tsv) {
    console.log('\n╔═══ IMAGENS SOLTAS (>= 1 MB de VRAM) ═════════════════════════════════════════════════════════════╗');
    console.log('arquivo'.padEnd(52) + 'fmt'.padStart(6) + 'dims'.padStart(12) + 'fio'.padStart(9) + 'VRAM'.padStart(9));
    for (const s of soltas) {
      if (s.vram < 1048576) continue;
      console.log(s.rel.padEnd(52) + s.fmt.padStart(6) + `${s.w}x${s.h}`.padStart(12)
        + (MB(s.bytes) + 'M').padStart(9) + (MB(s.vram) + 'M').padStart(9));
    }
  } else {
    console.log('\narquivo\tfmt\tw\th\tbytes\tvram_bytes');
    for (const s of soltas) console.log([s.rel, s.fmt, s.w, s.h, s.bytes, Math.round(s.vram)].join('\t'));
  }

  const somaFioImg = soltas.reduce((a, s) => a + s.bytes, 0);
  const somaVramImg = soltas.reduce((a, s) => a + s.vram, 0);

  /* ---- onde estão os 2048² ---- */
  const grandes = [];
  for (const l of linhas) for (const i of l.imgs) if (i.w >= 2048 || i.h >= 2048) grandes.push({ onde: l.rel, ...i });
  for (const s of soltas) if (s.w >= 2048 || s.h >= 2048) grandes.push({ onde: '(solta)', name: s.rel, ...s });
  grandes.sort((a, b) => b.vram - a.vram);

  if (!tsv) {
    console.log(`\n╔═══ AS IMAGENS >= 2048 — ${grandes.length} arquivos, ${MB(grandes.reduce((a, g) => a + g.vram, 0))} MB de VRAM ═══╗`);
    if (detalhe) {
      for (const g of grandes)
        console.log(`  ${MB(g.vram).padStart(6)}M  ${`${g.w}x${g.h}`.padStart(10)} ${g.fmt.padEnd(6)} ${(g.name || '').slice(0, 40).padEnd(42)} ${g.onde}`);
    } else {
      const porArq = new Map();
      for (const g of grandes) {
        const e = porArq.get(g.onde) || { n: 0, vram: 0 };
        e.n++; e.vram += g.vram; porArq.set(g.onde, e);
      }
      for (const [k, v] of [...porArq.entries()].sort((a, b) => b[1].vram - a[1].vram))
        console.log(`  ${MB(v.vram).padStart(7)}M  ${String(v.n).padStart(3)} img  ${k}`);
      console.log('  (--imagens para listar uma a uma)');
    }
  }

  const somaFioDom = dom.reduce((a, s) => a + s.bytes, 0);

  console.log('\n╔═══ SOMA ════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log(`  malhas:         ${String(linhas.length).padStart(4)} arquivos · ${MB(somaFio).padStart(8)} MB no fio · ${N(somaTri).padStart(12)} triângulos · ${somaImgs} imagens · ${MB(somaVram).padStart(8)} MB de VRAM`);
  console.log(`  texturas soltas:${String(soltas.length).padStart(4)} arquivos · ${MB(somaFioImg).padStart(8)} MB no fio${' '.repeat(41)}${MB(somaVramImg).padStart(8)} MB de VRAM`);
  console.log(`  ACERVO DE CENA: ${String(linhas.length + soltas.length).padStart(4)} arquivos · ${MB(somaFio + somaFioImg).padStart(8)} MB no fio${' '.repeat(41)}${MB(somaVram + somaVramImg).padStart(8)} MB de VRAM`);
  console.log(`  (fora da conta: ${String(dom.length).padStart(4)} imagens de DOM · ${MB(somaFioDom)} MB no fio · 0 de VRAM — cartões, logos, ícones)`);
  console.log('\n  ⚠️ A VRAM acima é o TETO do acervo inteiro, não a de uma cena: numa cena');
  console.log('     há UM cavalo, UM cenário e UM implemento. Use --cena para a conta de UMA.');
  console.log('     E ela NÃO inclui os alvos de render (sombra 3072² = 72 MB, reflexo do');
  console.log('     piso = 96,7 MB), que não são arquivo — nascem em runtime.');
}

/* ------------------------------------------------------------------ *
 * `--cena` — a conta de UMA cena, que é a que casa com a §1.3 do
 * GARGALO-2026-08-15.md ("~1 087 MB em 160 texturas")
 *
 * O bench mede a cena quente varrendo os materiais VIVOS. Aqui a mesma conta
 * sai dos arquivos: cenário + cavalo + implemento + os 16 mapas de chão + o par
 * de HDR. Bate com o bench dentro da margem de o bench não ver o que nenhum
 * material referencia — e serve para responder "e se eu trocar o cavalo?" sem
 * subir navegador.
 * ------------------------------------------------------------------ */

function cena(spec, raizPublic) {
  const [cenario, cavalo] = spec.split('+');
  const partes = [];
  const imagens = [];        // uma linha por IMAGEM, para a fila de trabalho
  const add = (rel, rotulo) => {
    const p = join(raizPublic, rel);
    try { statSync(p); } catch { console.error(`  (ausente) ${rel}`); return; }
    if (rel.endsWith('.glb')) {
      const r = analyze(p);
      partes.push({ rotulo, rel, bytes: r.bytes, imgs: r.imgs.length, vram: r.vram });
      for (const i of r.imgs) imagens.push({ nome: i.name || '(sem nome)', onde: basename(rel), ...i });
    } else {
      const i = lerImagem(p);
      if (i) {
        partes.push({ rotulo, rel, bytes: i.bytes, imgs: 1, vram: i.vram });
        imagens.push({ nome: basename(rel), onde: rotulo, ...i });
      }
    }
  };
  add(`environments/${cenario}/set.glb`, 'cenário');
  add(`environments/${cenario}/sky.hdr`, 'céu dia');
  add(`environments/${cenario}/sky-night.hdr`, 'céu noite');
  if (cavalo) add(`models/trucks/${cavalo}.glb`, 'cavalo');
  add('models/vehicles/trailer.glb', 'implemento');
  add('models/vehicles/thermoking.glb', 'TK');
  add('models/vehicles/wheel_fh16.glb', 'roda');
  for (const fam of ['asphalt', 'concrete', 'grass', 'gravel'])
    for (const mapa of ['diff', 'nor', 'rough', 'ao'])
      for (const ext of ['.webp', '.jpg'])
        try { statSync(join(raizPublic, `textures/${fam}_${mapa}${ext}`)); add(`textures/${fam}_${mapa}${ext}`, 'chão'); } catch { /* a outra extensão */ }
  /* ⚠️ `models/vehicles/panels/*.png` NÃO ENTRAM NESTA CONTA, e a versão
     anterior deste arquivo as somava — 20 imagens, 168,9 MB, o que teria feito
     delas o segundo maior bloco da cena. Estava errado, e o erro é o MESMO que
     este censo existe para corrigir na §1.3 do GARGALO: contar como VRAM o que
     nunca chega à GPU.

     O que elas são: a arte 2D do EDITOR de plotagem. `vehicle/livery-art.ts`
     as busca por `fetch`, faz `URL.createObjectURL(new Blob(...))` e entrega
     um `<img>`; `vehicle/livery-structure.ts` as compõe num CANVAS 2D, atrás
     da tela do fabric, e na miniatura do cartão. Nenhuma delas vira
     `THREE.Texture`, e o cabeçalho de `livery-structure.ts` diz por quê com
     todas as letras — "ELA NÃO VAI PARA O 3D": faixa refletiva, cantoneira e
     porta já existem como GEOMETRIA no implemento, e chapá-las na textura
     pintaria cada peça duas vezes.

     Quem alimenta a textura do baú é o canvas do fabric com a ARTE DO CLIENTE,
     que é gerado em runtime e portanto não é arquivo nenhum.

     Consequência prática: elas contam para o DOWNLOAD (9,8 MB) e para zero de
     VRAM. Comprimi-las em KTX2 não economizaria um byte de memória de vídeo. */

  console.log(`\n╔═══ CENA  ${spec} ═══╗`);
  console.log('parte'.padEnd(12) + 'arquivo'.padEnd(46) + 'fio'.padStart(9) + 'imgs'.padStart(6) + 'VRAM'.padStart(9));
  for (const p of partes)
    console.log(p.rotulo.padEnd(12) + p.rel.padEnd(46) + (MB(p.bytes) + 'M').padStart(9) + String(p.imgs).padStart(6) + (MB(p.vram) + 'M').padStart(9));
  const grupos = new Map();
  for (const p of partes) {
    const e = grupos.get(p.rotulo) || { bytes: 0, imgs: 0, vram: 0 };
    e.bytes += p.bytes; e.imgs += p.imgs; e.vram += p.vram; grupos.set(p.rotulo, e);
  }
  console.log('  --- por grupo ---');
  for (const [k, v] of [...grupos.entries()].sort((a, b) => b[1].vram - a[1].vram))
    console.log(`    ${k.padEnd(12)} ${(MB(v.bytes) + 'M').padStart(8)} no fio · ${String(v.imgs).padStart(4)} imgs · ${(MB(v.vram) + 'M').padStart(8)} de VRAM`);
  const t = partes.reduce((a, p) => ({ bytes: a.bytes + p.bytes, imgs: a.imgs + p.imgs, vram: a.vram + p.vram }), { bytes: 0, imgs: 0, vram: 0 });
  console.log(`    ${'TOTAL'.padEnd(12)} ${(MB(t.bytes) + 'M').padStart(8)} no fio · ${String(t.imgs).padStart(4)} imgs · ${(MB(t.vram) + 'M').padStart(8)} de VRAM`);
  console.log(`    ${'+ alvos'.padEnd(12)} sombra 3072² 72,0M · reflexo do piso 96,7M  ⇒  ${MB(t.vram + (72 + 96.7) * 1048576)}M na placa`);

  /* A FILA DE TRABALHO — imagem a imagem, da mais cara para a mais barata.
     É esta lista que transforma "1 087 MB" numa ordem de serviço; sem ela o
     número só dá para lamentar. */
  imagens.sort((a, b) => b.vram - a.vram);
  console.log('\n  --- as 25 imagens mais caras desta cena ---');
  console.log('      VRAM         dims  fmt          imagem                                     origem');
  for (const i of imagens.slice(0, 25))
    console.log(`  ${(MB(i.vram) + 'M').padStart(8)} ${`${i.w}x${i.h}`.padStart(12)}  ${i.fmt.padEnd(11)}  ${String(i.nome).slice(0, 42).padEnd(43)}${i.onde}`);
  const q = imagens.filter((i) => i.w >= 2048 && i.h >= 2048);
  console.log(`\n  quadradas >= 2048²: ${q.length} imagens · ${MB(q.reduce((a, i) => a + i.vram, 0))} MB`);
  console.log('  ⚠️ NÃO SÃO 35. O "35 texturas a 2048² = 747 MB" de GARGALO-2026-08-15 §1.3');
  console.log('     conta OBJETOS `THREE.Texture`, e 32 deles são CLONES dos mesmos 16');
  console.log('     arquivos de chão (8 materiais × 4 mapas no distrito-industrial). Clones');
  console.log('     que compartilham `source` e chave de amostragem compartilham UM objeto');
  console.log('     da GL — `WebGLTextures.initTexture()` indexa `_sources.get(source)` por');
  console.log('     `getTextureCacheKey()`, que NÃO inclui `repeat`. Ver o bloco `cloneFor()`');
  console.log('     em scene/set.ts, que já dizia isso.');
}

/* ⚠️ Só roda como PROGRAMA. `lerImagem()`/`vramDe()` são importados por
   `ktx2.mjs`, e sem esta guarda o censo inteiro sairia no meio da saída dele —
   a mesma armadilha que `glbstat.mjs` teve. */
const ehPrograma = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (ehPrograma) main();
