#!/usr/bin/env node
/* DEDUP DE CARGAS — compartilha os buffers de geometria byte a byte idênticos
   de um .glb Draco, SEM descomprimir nada.
   ===========================================================================

   POR QUE ISTO EXISTE, E NÃO `gltf-transform dedup`
   ---------------------------------------------------------------------------
   `gltf-transform dedup --materials false` é a receita registrada em
   `GARGALO-2026-08-15.md` §6.5, e ela funciona — mas MEDIDA neste acervo ela
   custa caro:

       trailer.glb  21,5 MB  →  trailer.dedup.glb  60,6 MB      (2,8× MAIOR)
       ext: KHR_draco_mesh_compression, …        →   ext: (sem Draco)
       aviso da ferramenta: "Decoded KHR_draco_mesh_compression.
                             Further compression will be lossy."

   O modelo de dados do gltf-transform não guarda a carga Draco: ele DESCOMPRIME
   na leitura para poder comparar acessores, e escreve sem compressão. Recompor
   com `gltf-transform draco` reencoda — e reencodar é justamente o que
   `tools/glb-texopt/texopt.py` documenta como a chance de trocar a grade por
   primitiva do Draco (segura) pela grade de cena inteira do `quantize`
   (proibida neste acervo, §6.5).

   Esta ferramenta faz a MESMA dedução sem esse risco, porque trabalha no nível
   do CONTÊINER — a mesma doutrina do `texopt.py`:

     1. duas primitivas cuja CARGA DRACO é byte a byte idêntica são a mesma
        malha, necessariamente: mesmos vértices, mesma ordem, mesma grade;
     2. então a segunda pode simplesmente APONTAR para o bufferView da primeira,
        e os acessores dela (que declaram `count`/`min`/`max` do mesmo dado)
        para os acessores da primeira;
     3. o BIN é reescrito mantendo só os bufferViews ainda referenciados.

   Nenhum vértice é lido, nenhum decodificador é carregado, nenhum byte de
   geometria muda. O que muda é quantas VEZES cada carga aparece no arquivo.

   O QUE ISSO DEVOLVE EM RUNTIME, e este é o ponto — não é só download
   ---------------------------------------------------------------------------
   O `GLTFLoader` do three tem um cache de primitiva por arquivo, e a chave dele
   para uma primitiva Draco é (loaders/GLTFLoader.js, `createPrimitiveKey`):

       'draco:' + ext.bufferView + ':' + ext.indices + ':' + attrs

   Ou seja: duas primitivas que passem a apontar para o mesmo bufferView viram
   **UMA `BufferGeometry`**, decodificada UMA vez e subida para a GPU UMA vez.
   As 104 cópias da mesma peça de inox deixam de ser 104 decodificações e 104
   buffers de vértice.

   ⚠️⚠️ E É EXATAMENTE POR ISSO QUE ELE NÃO PODE SER APLICADO NO `trailer.glb`
   ANTES DE UM CONSERTO EM `vehicle/trailer-assembly.ts`.
   ---------------------------------------------------------------------------
   Compartilhar a `BufferGeometry` é o ganho E é o perigo, porque este engine
   ESCREVE dentro da geometria carregada, por malha:

     · `trailer-assembly.ts` `resize()` — para cada peça, lê `piece.base` (a
       cópia pristina), aplica a `matrixWorld` DAQUELA malha, deforma e escreve
       de volta com `pos.setXYZ(...)`. Duas malhas na mesma geometria têm
       matrizes de mundo DIFERENTES; a segunda escrita sobrescreve a primeira e
       as duas passam a renderizar a deformação de uma só.
     · `trailer-assembly.ts`, mesmo laço — a casca de um conjunto instanciado é
       COLAPSADA num ponto (`for (const i of part.idx) pos.setXYZ(i, x0,y0,z0)`).
       Se essa geometria for compartilhada com uma peça que NÃO virou conjunto,
       a peça inteira some.
     · `trailer-bake-fixes.ts` `editVerts()` — mesma escrita, mesmo risco.
     · `vehicle/halo.ts` — `geometry.setAttribute('haloCor'|'haloRaio', …)` por
       malha: num compartilhamento, o halo de uma lanterna passa a valer para
       todas as irmãs.

   O engine JÁ tem o padrão da correção, e ele está em `vehicle/models.ts:3357`:

       const g = (geomUsers.get(g0) || 1) > 1 ? g0.clone() : g0;
       if (g !== g0) mesh.geometry = g;

   — um mapa de "quantas malhas usam esta geometria" e um clone-na-escrita. É
   isso que falta nos quatro pontos acima. **Enquanto não existir, este script
   é medição, não deploy**, e é por isso que ele NUNCA escreve por cima do
   original: a saída é sempre um arquivo novo, informado à mão.

   USO
   ---------------------------------------------------------------------------
       node tools/studio-assets/dedup-cargas.mjs ENTRADA.glb --relatorio
       node tools/studio-assets/dedup-cargas.mjs ENTRADA.glb SAIDA.glb

   `--relatorio` não escreve nada: lista as famílias repetidas com a caixa
   envolvente de MUNDO de cada uma (é o que diz se a família está sob o piso, e
   portanto se `trailer-assembly.ts` a toca ou a pula).

   VALIDAÇÃO OBRIGATÓRIA depois de escrever, e ela é de três números:

       node tools/studio-bench/glbstat.mjs ENTRADA.glb SAIDA.glb

   primitivas, triângulos e materiais têm de sair IDÊNTICOS. Se qualquer um dos
   três mudar, a transformação está errada — não troque o arquivo. */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function lerGlb(caminho) {
  const buf = readFileSync(caminho);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('não é GLB: ' + caminho);
  const total = buf.readUInt32LE(8);
  let off = 12; let json = null; let bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const tipo = buf.readUInt32LE(off + 4);
    const dados = buf.subarray(off + 8, off + 8 + len);
    if (tipo === CHUNK_JSON) json = JSON.parse(dados.toString('utf8'));
    else if (tipo === CHUNK_BIN) bin = dados;
    off = off + 8 + len;
    off = off + ((4 - (off % 4)) % 4);
  }
  if (!json) throw new Error('sem chunk JSON');
  return { json, bin, bytes: buf.length };
}

function escreverGlb(caminho, json, bin) {
  const txt = Buffer.from(JSON.stringify(json), 'utf8');
  const padJson = (4 - (txt.length % 4)) % 4;
  const padBin = (4 - (bin.length % 4)) % 4;
  const lenJson = txt.length + padJson;
  const lenBin = bin.length + padBin;
  const total = 12 + 8 + lenJson + (bin.length ? 8 + lenBin : 0);
  const out = Buffer.alloc(total);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(lenJson, 12);
  out.writeUInt32LE(CHUNK_JSON, 16);
  txt.copy(out, 20);
  out.fill(0x20, 20 + txt.length, 20 + lenJson);          // JSON se preenche com ESPAÇO
  if (bin.length) {
    const p = 20 + lenJson;
    out.writeUInt32LE(lenBin, p);
    out.writeUInt32LE(CHUNK_BIN, p + 4);
    bin.copy(out, p + 8);
    out.fill(0, p + 8 + bin.length, p + 8 + lenBin);      // BIN se preenche com ZERO
  }
  writeFileSync(caminho, out);
  return total;
}

/** Assinatura de uma primitiva Draco: o hash da carga + a forma dos acessores.
 *  Só primitivas com carga Draco entram — uma primitiva não comprimida tem os
 *  atributos espalhados por vários bufferViews e a dedução dela é outro
 *  problema, que este acervo não tem. */
function assinar(g, bin, p) {
  const dr = p.extensions && p.extensions.KHR_draco_mesh_compression;
  if (!dr || dr.bufferView === undefined) return null;
  const bv = g.bufferViews[dr.bufferView];
  if (!bv) return null;
  const off = bv.byteOffset || 0;
  const carga = bin.subarray(off, off + bv.byteLength);
  const h = createHash('sha256').update(carga);
  /* A carga sozinha JÁ determina a malha, mas a assinatura carrega também o
     mapa de atributos do Draco e a FORMA dos acessores: são eles que o
     `GLTFLoader` usa para montar a `BufferGeometry`, e repontar duas primitivas
     que discordem em qualquer um deles trocaria a geometria por outra. Custa
     nada e fecha a porta. */
  h.update(JSON.stringify(dr.attributes || {}));
  const forma = (i) => {
    const a = g.accessors[i];
    return a ? [a.componentType, a.type, a.count, a.normalized || false] : null;
  };
  h.update(JSON.stringify(Object.keys(p.attributes || {}).sort().map((k) => [k, forma(p.attributes[k])])));
  h.update(JSON.stringify(p.indices !== undefined ? forma(p.indices) : null));
  h.update(JSON.stringify(p.mode ?? 4));
  return h.digest('hex');
}

/* ------------------------------------------------------------------ *
 * As matrizes de mundo dos nós — para a caixa envolvente do relatório
 * ------------------------------------------------------------------ */

function mulM4(a, b) {           // coluna-maior, como o glTF
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

function trsM4(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** Uma entrada por NÓ COM MALHA: matriz de mundo acumulada da raiz até ele. */
function mundos(g) {
  const out = new Map();          // índice de nó -> matriz
  const cenas = g.scenes || [];
  const raizes = (cenas[g.scene || 0] || { nodes: [] }).nodes || [];
  const anda = (i, pai) => {
    const n = g.nodes[i];
    if (!n) return;
    const m = mulM4(pai, trsM4(n));
    out.set(i, m);
    for (const c of n.children || []) anda(c, m);
  };
  const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of raizes) anda(r, ident);
  return out;
}

function caixaMundo(min, max, m) {
  /* Caixa AABB transformada: os 8 cantos, e a envolvente deles. Não é a caixa
     mínima do sólido girado — é a caixa da caixa, estritamente maior. Para
     decidir "está sob o piso?" isso é o lado CONSERVADOR do erro. */
  let lo = [Infinity, Infinity, Infinity]; let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const p = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
    for (let r = 0; r < 3; r++) {
      const v = m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r];
      if (v < lo[r]) lo[r] = v;
      if (v > hi[r]) hi[r] = v;
    }
  }
  return { lo, hi };
}

/* ------------------------------------------------------------------ *
 * O trabalho
 * ------------------------------------------------------------------ */

export function analisar(caminho) {
  const { json: g, bin, bytes } = lerGlb(caminho);
  const M = mundos(g);
  const porMesh = new Map();      // índice de malha -> nós que a usam
  (g.nodes || []).forEach((n, i) => {
    if (n.mesh === undefined) return;
    const l = porMesh.get(n.mesh) || []; l.push(i); porMesh.set(n.mesh, l);
  });

  const familias = new Map();     // assinatura -> { n, bytes, mats:Set, caixa, prims:[] }
  let semDraco = 0; let prims = 0;
  (g.meshes || []).forEach((m, mi) => {
    (m.primitives || []).forEach((p, pi) => {
      prims++;
      const sig = assinar(g, bin, p);
      if (!sig) { semDraco++; return; }
      const bv = g.bufferViews[p.extensions.KHR_draco_mesh_compression.bufferView];
      const e = familias.get(sig) || { n: 0, bytes: bv.byteLength, mats: new Set(), lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], prims: [], exemplo: m.name || `mesh${mi}` };
      e.n++;
      e.prims.push({ mesh: mi, prim: pi });
      if (p.material !== undefined) e.mats.add((g.materials[p.material] || {}).name || ('mat' + p.material));
      /* Caixa de mundo: min/max do acessor de POSITION (o glTF os exige mesmo
         em Draco) por cada nó que usa esta malha. */
      const ap = g.accessors[(p.attributes || {}).POSITION];
      if (ap && ap.min && ap.max) {
        for (const ni of porMesh.get(mi) || []) {
          const mm = M.get(ni); if (!mm) continue;
          const c = caixaMundo(ap.min, ap.max, mm);
          for (let r = 0; r < 3; r++) { if (c.lo[r] < e.lo[r]) e.lo[r] = c.lo[r]; if (c.hi[r] > e.hi[r]) e.hi[r] = c.hi[r]; }
        }
      }
      familias.set(sig, e);
    });
  });

  const lista = [...familias.entries()].map(([sig, e]) => ({ sig, ...e })).sort((a, b) => b.n - a.n);
  const dup = lista.reduce((a, e) => a + (e.n - 1), 0);
  const ganho = lista.reduce((a, e) => a + (e.n - 1) * e.bytes, 0);

  /* ⚠️ A PERGUNTA QUE MUDA A CONCLUSÃO INTEIRA: as cargas repetidas estão
     repetidas NO ARQUIVO, ou o arquivo já aponta várias vezes para os MESMOS
     bytes? São coisas diferentes e o glTF permite as duas — um bufferView é um
     par (offset, comprimento), e nada impede 104 bufferViews distintos
     descreverem a MESMA faixa.

     Medido no `trailer.glb`: 2 157 bufferViews Draco, mas só **855 faixas de
     bytes distintas**, somando 7,12 MB. Ou seja: o exportador JÁ escreveu cada
     carga uma vez. Não há 9,15 MB de download para recuperar — o número
     registrado em `OTIMIZACAO-2026-08-14.md` conta payloads repetidos sem
     conferir se as faixas se sobrepõem, e elas se sobrepõem.

     O que sobra — e é maior — está do lado do RUNTIME: a chave de cache de
     primitiva do `GLTFLoader` é o ÍNDICE do bufferView, não a faixa. Índices
     distintos ⇒ 2 157 decodificações Draco e 2 157 buffers de vértice para 855
     formas. É esse o desperdício que este script remove. */
  const faixas = new Set(); let bytesFaixa = 0;
  const vistos = new Set();
  for (const f of lista) for (const pr of f.prims) {
    const p = g.meshes[pr.mesh].primitives[pr.prim];
    const bv = g.bufferViews[p.extensions.KHR_draco_mesh_compression.bufferView];
    const k = `${bv.byteOffset || 0}:${bv.byteLength}`;
    if (!faixas.has(k)) { faixas.add(k); bytesFaixa += bv.byteLength; }
    vistos.add(p.extensions.KHR_draco_mesh_compression.bufferView);
  }

  /* Quanto isso é em GPU. O Draco chega descomprimido: o custo real de VRAM de
     geometria é a soma dos atributos declarados nos acessores (Float32 quase
     tudo) mais o índice, que o `DRACOLoader` devolve em Uint32. */
  const CB = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const bytesGpu = (p) => {
    let b = 0;
    for (const a of Object.values(p.attributes || {})) { const ac = g.accessors[a]; if (ac) b += ac.count * NC[ac.type] * CB[ac.componentType]; }
    if (p.indices !== undefined) { const ac = g.accessors[p.indices]; if (ac) b += ac.count * 4; }
    return b;
  };
  let gpuUnico = 0; let gpuDup = 0;
  for (const f of lista) {
    const b = bytesGpu(g.meshes[f.prims[0].mesh].primitives[f.prims[0].prim]);
    gpuUnico += b; gpuDup += b * (f.n - 1);
  }

  return {
    g, bin, bytes, prims, semDraco, familias: lista, dup, ganho,
    faixas: faixas.size, bytesFaixa, bufferViews: vistos.size,
    gpuUnico, gpuDup,
  };
}

export function deduplicar(caminho, saida) {
  const r = analisar(caminho);
  const g = r.g; const bin = r.bin;

  /* 1) canoniza: cada família aponta para a PRIMEIRA primitiva dela. */
  let repontadas = 0;
  for (const fam of r.familias) {
    if (fam.n < 2) continue;
    const [primeiro, ...resto] = fam.prims;
    const canon = g.meshes[primeiro.mesh].primitives[primeiro.prim];
    for (const alvo of resto) {
      const p = g.meshes[alvo.mesh].primitives[alvo.prim];
      /* O MATERIAL NÃO É TOCADO — nunca. É a razão de `--materials false` no
         gltf-transform, e aqui ela é estrutural: este laço só mexe em
         `attributes`, `indices` e na extensão Draco. `applyTrailerFinish()`
         despacha pelo NOME do material e continua vendo o mesmo nome. */
      p.attributes = { ...canon.attributes };
      if (canon.indices !== undefined) p.indices = canon.indices;
      else delete p.indices;
      p.extensions.KHR_draco_mesh_compression = {
        bufferView: canon.extensions.KHR_draco_mesh_compression.bufferView,
        attributes: { ...canon.extensions.KHR_draco_mesh_compression.attributes },
      };
      repontadas++;
    }
  }

  /* 2) reescreve o BIN só com os bufferViews ainda referenciados.
     A varredura é do JSON INTEIRO, não de uma lista fixa de donos: qualquer
     objeto com a chave `bufferView` conta (acessores, imagens, a extensão
     Draco, `EXT_meshopt_compression` se um dia entrar). Uma lista fixa
     esqueceria um dono novo e o arquivo sairia com uma referência pendurada. */
  const donos = [];
  const varrer = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) varrer(x); return; }
    if (typeof o.bufferView === 'number') donos.push(o);
    for (const k of Object.keys(o)) if (k !== 'bufferView') varrer(o[k]);
  };
  varrer(g.meshes); varrer(g.accessors); varrer(g.images); varrer(g.extensions); varrer(g.extensionsUsed);

  const usados = [...new Set(donos.map((d) => d.bufferView))].sort((a, b) => a - b);
  const novoIdx = new Map();
  const pedacos = []; let cursor = 0;
  for (const i of usados) {
    const bv = g.bufferViews[i];
    const off = bv.byteOffset || 0;
    const dado = bin.subarray(off, off + bv.byteLength);
    /* Alinhamento de 4 bytes: o glTF exige que `byteOffset` de um bufferView
       usado por acessor seja múltiplo do tamanho do componente, e 4 cobre todos
       os tipos que aparecem aqui. Sem isto o arquivo passa no nosso leitor e
       falha no validador de outra pessoa. */
    const pad = (4 - (cursor % 4)) % 4;
    if (pad) { pedacos.push(Buffer.alloc(pad)); cursor += pad; }
    novoIdx.set(i, novoIdx.size);
    pedacos.push(dado);
    bv.byteOffset = cursor;
    cursor += dado.length;
  }
  const binNovo = Buffer.concat(pedacos);
  g.bufferViews = usados.map((i) => g.bufferViews[i]);
  for (const d of donos) d.bufferView = novoIdx.get(d.bufferView);
  g.buffers = [{ byteLength: binNovo.length }];
  for (const bv of g.bufferViews) bv.buffer = 0;

  const total = escreverGlb(saida, g, binNovo);
  return { repontadas, antes: r.bytes, depois: total, familias: r.familias };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

const MB = (n) => (n / 1048576).toFixed(2);
const ehPrograma = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (ehPrograma) {
  const args = process.argv.slice(2);
  const entrada = args.find((a) => !a.startsWith('--'));
  if (!entrada) {
    console.log('uso: dedup-cargas.mjs ENTRADA.glb [SAIDA.glb] [--relatorio] [--piso Y]');
    process.exit(1);
  }
  const iPiso = args.indexOf('--piso');
  const piso = iPiso >= 0 ? Number(args[iPiso + 1]) : 1.28;

  if (args.includes('--relatorio')) {
    const r = analisar(entrada);
    console.log(`\n═══ ${basename(entrada)} — ${MB(r.bytes)} MB`);
    console.log(`  primitivas: ${r.prims}   com carga Draco: ${r.prims - r.semDraco}   famílias: ${r.familias.length}`);
    console.log(`  primitivas que poderiam apontar para uma carga já existente: ${r.dup}`
      + ` (${(r.dup / (r.prims - r.semDraco) * 100).toFixed(0)} %)`);
    console.log(`  bufferViews Draco: ${r.bufferViews}   FAIXAS DE BYTES distintas: ${r.faixas} (${MB(r.bytesFaixa)} MB)`);
    if (r.faixas < r.bufferViews) {
      console.log(`  ⚠️ o arquivo JÁ compartilha os bytes: ${MB(r.ganho)} MB de "carga duplicada" são`);
      console.log('     bufferViews distintos apontando para a MESMA faixa. Não há esse download a recuperar.');
    } else {
      console.log(`  bytes que saem do arquivo: ${MB(r.ganho)} MB`);
    }
    console.log(`  O QUE SAI DE VERDADE — geometria descomprimida na GPU:`);
    console.log(`     hoje  ${MB(r.gpuUnico + r.gpuDup).padStart(7)} MB em ${r.prims - r.semDraco} buffers de vértice`);
    console.log(`     após  ${MB(r.gpuUnico).padStart(7)} MB em ${r.familias.length} buffers`
      + `   ⇒ −${MB(r.gpuDup)} MB e −${r.dup} decodificações Draco`);
    console.log(`\n  --- as famílias repetidas, com a caixa de MUNDO (piso em y=${piso} m) ---`);
    console.log('  cópias   kB/cópia      y-min      y-max  toda sob o piso?  materiais');
    let sobPiso = 0; let acima = 0;
    for (const f of r.familias) {
      if (f.n < 2) continue;
      const sob = f.hi[1] <= piso;
      if (sob) sobPiso += f.n - 1; else acima += f.n - 1;
      if (f.n < 5) continue;
      console.log(`  ${String(f.n).padStart(5)}× ${(f.bytes / 1024).toFixed(1).padStart(10)}`
        + ` ${f.lo[1].toFixed(3).padStart(10)} ${f.hi[1].toFixed(3).padStart(10)}`
        + `  ${(sob ? 'SIM' : 'não').padStart(15)}  ${[...f.mats].join(',').slice(0, 34)}`);
    }
    console.log(`\n  cópias redundantes SOB o piso (o assembly nunca as toca): ${sobPiso}`);
    console.log(`  cópias redundantes ACIMA do piso (o assembly ESCREVE nelas): ${acima}`);
    console.log('\n  ⚠️ Ver o bloco do topo: acima do piso, compartilhar geometria quebra');
    console.log('     `trailer-assembly.ts` `resize()` enquanto ele não clonar-na-escrita.');
  } else {
    const saida = args.filter((a) => !a.startsWith('--'))[1];
    if (!saida) { console.log('falta o arquivo de SAÍDA (nunca sobrescrevo a entrada)'); process.exit(1); }
    const r = deduplicar(entrada, saida);
    console.log(`${basename(entrada)} ${MB(r.antes)} MB → ${basename(saida)} ${MB(r.depois)} MB`
      + `   (${r.repontadas} primitivas repontadas, −${MB(r.antes - r.depois)} MB)`);
    console.log('valide agora:  node tools/studio-bench/glbstat.mjs ' + entrada + ' ' + saida);
  }
}
