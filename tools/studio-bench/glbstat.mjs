#!/usr/bin/env node
/* Analisador de GLB — lê o chunk JSON e reporta o que custa em runtime.
   Não descomprime Draco: os `accessor.count` continuam declarados. */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('não é GLB: ' + path);
  const total = buf.readUInt32LE(8);
  let off = 12; let json = null; let bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len + ((4 - (len % 4)) % 4) * 0;
    off = off + ((4 - (off % 4)) % 4);
  }
  return { json, bin, bytes: buf.length };
}

function imgInfo(bytes) {
  // PNG
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47)
    return { fmt: 'png', w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  // JPEG
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { fmt: 'jpg', h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7) };
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    return { fmt: 'jpg', w: 0, h: 0 };
  }
  // WebP
  if (bytes.length > 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const c = bytes.toString('ascii', 12, 16);
    if (c === 'VP8X') return { fmt: 'webp-x', w: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), h: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (c === 'VP8L') { const b = bytes.readUInt32LE(21); return { fmt: 'webp-ll', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    if (c === 'VP8 ') return { fmt: 'webp-lossy', w: bytes.readUInt16LE(26) & 0x3fff, h: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (bytes.length > 12 && bytes.toString('ascii', 8, 12) === 'KTX2') return { fmt: 'ktx2', w: 0, h: 0 };
  if (bytes.length > 12 && bytes[0] === 0xab && bytes[1] === 0x4b) return { fmt: 'ktx2', w: bytes.readUInt32LE(20), h: bytes.readUInt32LE(24) };
  return { fmt: '?', w: 0, h: 0 };
}

export function analyze(path) {
  const { json: g, bin, bytes } = readGlb(path);
  const acc = g.accessors || [];
  const meshes = g.meshes || [];
  const nodes = g.nodes || [];

  let prims = 0, tris = 0;
  const byMat = new Map();
  const geoSig = new Map();     // assinatura de acessores -> quantas vezes
  const primSizes = [];

  // contagem de instâncias por mesh (quantos nós apontam para cada mesh)
  const meshUse = new Array(meshes.length).fill(0);
  let gpuInstances = 0;
  for (const n of nodes) {
    if (n.mesh !== undefined) {
      let mult = 1;
      const ext = n.extensions && n.extensions.EXT_mesh_gpu_instancing;
      if (ext && ext.attributes) {
        const a = Object.values(ext.attributes)[0];
        mult = acc[a] ? acc[a].count : 1;
        gpuInstances += mult;
      }
      meshUse[n.mesh] += mult;
    }
  }

  meshes.forEach((m, mi) => {
    const uses = Math.max(meshUse[mi], 0);
    for (const p of m.primitives || []) {
      const idx = p.indices !== undefined ? acc[p.indices] : null;
      const pos = p.attributes && p.attributes.POSITION !== undefined ? acc[p.attributes.POSITION] : null;
      const t = idx ? Math.floor(idx.count / 3) : (pos ? Math.floor(pos.count / 3) : 0);
      const drawn = uses || 1;
      prims += drawn;
      tris += t * drawn;
      primSizes.push(t);
      const mn = p.material !== undefined ? (g.materials[p.material].name || ('mat' + p.material)) : '(sem material)';
      const e = byMat.get(mn) || { prims: 0, tris: 0, meshes: 0 };
      e.prims += drawn; e.tris += t * drawn; e.meshes++;
      byMat.set(mn, e);
      // assinatura de geometria: índices + atributos (mesmos acessores = mesma geometria)
      const sig = JSON.stringify([p.indices, p.attributes]);
      geoSig.set(sig, (geoSig.get(sig) || 0) + 1);
    }
  });

  // imagens
  const imgs = [];
  let vram = 0;
  for (const im of g.images || []) {
    if (im.bufferView === undefined) continue;
    const bv = g.bufferViews[im.bufferView];
    const off = bv.byteOffset || 0;
    const data = bin.subarray(off, off + bv.byteLength);
    const info = imgInfo(data);
    const mem = info.w * info.h * 4 * 1.3333;
    vram += mem;
    imgs.push({ name: im.name || '', ...info, bytes: bv.byteLength, vram: mem });
  }

  const uniqueGeo = geoSig.size;
  const dupPrims = prims - uniqueGeo;

  return {
    file: basename(path), bytes,
    prims, tris, meshes: meshes.length, nodes: nodes.length,
    materials: (g.materials || []).length,
    gpuInstances,
    uniqueGeo, dupPrims,
    byMat: [...byMat.entries()].sort((a, b) => b[1].prims - a[1].prims),
    imgs, vram,
    primSizes: primSizes.sort((a, b) => a - b),
    extensions: g.extensionsUsed || [],
  };
}

/* ---------------------------------------------------------------------------
   A ASSINATURA POR CARGA — quantas primitivas deste arquivo são a MESMA PEÇA

   POR QUE `uniqueGeo` acima NÃO responde isso. Aquela assinatura compara
   ACESSORES: dois `primitives` que apontem para os mesmos índices de acessor
   são a mesma geometria, e num arquivo já deduplicado isso é a resposta certa.
   Num arquivo CRU, cada cópia da peça tem acessores próprios — e a assinatura
   por acessor devolve "2 157 geometrias únicas", que é verdade e é inútil.

   O que este bloco compara são os BYTES DA CARGA DRACO. Duas primitivas cuja
   carga é byte a byte idêntica são, necessariamente, a mesma malha: mesmos
   vértices, mesma ordem, mesmos índices, mesma grade de quantização. É a
   condição EXATA que `gltf-transform dedup` exige para fundir, então este
   número não é uma estimativa do ganho — é o ganho.

   ⚠️ É um LIMITE INFERIOR de "peças repetidas". Duas cópias da mesma peça
   exportadas em passes diferentes do CAD podem ter a mesma FORMA e cargas
   Draco diferentes (ordem de vértice trocada, semente do encoder diferente),
   e essas este método não vê — só uma comparação de posições descomprimidas
   veria, que é o que a bancada de navegador faz em `checks-gargalo.mjs`
   ("2 146 malhas → 806 formas ÚNICAS"). Os dois números medem coisas
   diferentes e os dois são úteis: este mede o que o `dedup` colhe HOJE; o da
   bancada mede o que uma reautoria do bake poderia colher.

   Para uma primitiva NÃO comprimida a carga é a concatenação dos bufferViews
   dos atributos + índices, e o raciocínio é o mesmo. */
export function cargas(path) {
  const { json: g, bin } = readGlb(path);
  const bvs = g.bufferViews || [];
  const acc = g.accessors || [];
  const fatia = (i) => {
    const bv = bvs[i];
    if (!bv) return null;
    const off = bv.byteOffset || 0;
    return bin.subarray(off, off + bv.byteLength);
  };

  const porHash = new Map();   // hash -> { n, bytes, mats:Set, exemplo }
  let semCarga = 0;
  (g.meshes || []).forEach((m, mi) => {
    for (const p of m.primitives || []) {
      const dr = p.extensions && p.extensions.KHR_draco_mesh_compression;
      const partes = [];
      if (dr) {
        const f = fatia(dr.bufferView);
        if (f) partes.push(f);
      } else {
        for (const a of Object.values(p.attributes || {}))
          if (acc[a] && acc[a].bufferView !== undefined) { const f = fatia(acc[a].bufferView); if (f) partes.push(f); }
        if (p.indices !== undefined && acc[p.indices] && acc[p.indices].bufferView !== undefined) {
          const f = fatia(acc[p.indices].bufferView); if (f) partes.push(f);
        }
      }
      if (!partes.length) { semCarga++; continue; }
      const h = createHash('sha1');
      for (const f of partes) h.update(f);
      const chave = h.digest('hex');
      const tam = partes.reduce((a, f) => a + f.length, 0);
      const e = porHash.get(chave) || { n: 0, bytes: tam, mats: new Set(), exemplo: m.name || `mesh${mi}` };
      e.n++;
      if (p.material !== undefined) e.mats.add((g.materials[p.material] || {}).name || ('mat' + p.material));
      porHash.set(chave, e);
    }
  });

  const fam = [...porHash.values()].sort((a, b) => b.n - a.n);
  const total = fam.reduce((a, e) => a + e.n, 0);
  const desperdicio = fam.reduce((a, e) => a + (e.n - 1) * e.bytes, 0);
  return { total, unicas: fam.length, repetidas: total - fam.length, desperdicio, familias: fam, semCarga };
}

const mb = (n) => (n / 1048576).toFixed(1);

/* ⚠️ SÓ RODA COMO PROGRAMA, NUNCA COMO IMPORT.
   Este bloco era `if (process.argv[2])`, e isso o disparava também quando outro
   módulo fazia `import { analyze }` daqui — a ferramenta importadora recebia,
   no meio da própria saída, uma tentativa de abrir os argumentos DELA como se
   fossem caminhos de .glb. `tools/studio-assets/censo.mjs` foi quem esbarrou.
   A guarda compara o caminho do módulo com o script que o node executou. */
const ehPrograma = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (ehPrograma && process.argv[2]) {
  const args = process.argv.slice(2);
  const querCargas = args.includes('--cargas');
  for (const p of args.filter((a) => !a.startsWith('--'))) {
    if (querCargas) {
      let c; let r0;
      try { c = cargas(p); r0 = analyze(p); } catch (e) { console.log(p, 'ERRO', e.message); continue; }
      console.log(`\n═══ ${basename(p)} — cargas de geometria`);
      console.log(`  primitivas: ${c.total}   cargas ÚNICAS: ${c.unicas}   repetem uma carga que já existe: ${c.repetidas}`
        + ` (${(c.repetidas / c.total * 100).toFixed(0)} %)`);
      console.log(`  bytes duplicados no arquivo: ${mb(c.desperdicio)} MB  ← o que o \`dedup\` colhe`);
      if (!(r0.extensions || []).includes('KHR_draco_mesh_compression'))
        console.log('  ⚠️ ARQUIVO SEM DRACO — os números acima NÃO significam nada aqui. Sem a\n'
          + '     carga Draco, a assinatura vira a concatenação dos bufferViews de atributo,\n'
          + '     que num layout intercalado é o MESMO bufferView para primitivas diferentes.\n'
          + '     Este modo só responde por arquivos comprimidos.');
      if (c.semCarga) console.log(`  ⚠️ ${c.semCarga} primitivas sem carga identificável (ignoradas)`);
      console.log('  --- as famílias maiores ---');
      for (const f of c.familias.filter((f) => f.n > 1).slice(0, 12))
        console.log(`    ${String(f.n).padStart(4)}×  ${(f.bytes / 1024).toFixed(1).padStart(8)} kB/cópia  ${((f.n - 1) * f.bytes / 1024).toFixed(0).padStart(7)} kB desperdiçados`
          + `  mats: ${[...f.mats].join(',').slice(0, 40).padEnd(42)} ex.: ${f.exemplo}`);
      continue;
    }
    let r;
    try { r = analyze(p); } catch (e) { console.log(p, 'ERRO', e.message); continue; }
    console.log(`\n═══ ${r.file}  (${mb(r.bytes)} MB no fio)`);
    console.log(`  primitivas desenhadas: ${r.prims}   triângulos: ${r.tris.toLocaleString('pt-BR')}`);
    console.log(`  malhas: ${r.meshes}  nós: ${r.nodes}  materiais: ${r.materials}  instâncias GPU: ${r.gpuInstances}`);
    console.log(`  geometrias únicas: ${r.uniqueGeo}   primitivas que REPETEM geometria: ${r.dupPrims}`);
    console.log(`  imagens: ${r.imgs.length}   VRAM est.: ${mb(r.vram)} MB`);
    console.log(`  ext: ${r.extensions.join(', ')}`);
    const fmts = {};
    for (const i of r.imgs) fmts[i.fmt] = (fmts[i.fmt] || 0) + 1;
    console.log(`  formatos: ${JSON.stringify(fmts)}`);
    const big = r.imgs.filter((i) => i.w >= 2048).sort((a, b) => b.vram - a.vram);
    if (big.length) console.log(`  imagens >=2048: ${big.map((i) => `${i.w}x${i.h} ${i.fmt} (${mb(i.vram)}MB)`).join(', ')}`);
    console.log('  --- top materiais por primitiva ---');
    for (const [n, e] of r.byMat.slice(0, 10))
      console.log(`    ${n.padEnd(34)} ${String(e.prims).padStart(5)} prims  ${e.tris.toLocaleString('pt-BR').padStart(12)} tri`);
    const s = r.primSizes; const n = s.length;
    if (n) {
      const q = (f) => s[Math.min(n - 1, Math.floor(n * f))];
      console.log(`  --- distribuição de tri/primitiva: p10=${q(0.1)} p50=${q(0.5)} p90=${q(0.9)} max=${s[n - 1]}`);
      let cum = 0; let i = 0;
      const half = r.tris / 2;
      for (i = n - 1; i >= 0; i--) { cum += s[i]; if (cum >= half) break; }
      console.log(`      ${n - i} das ${n} primitivas (${((n - i) / n * 100).toFixed(0)}%) carregam metade dos triângulos`);
    }
  }
}
