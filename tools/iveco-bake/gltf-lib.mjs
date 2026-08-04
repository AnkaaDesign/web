/* Leitor mínimo de glTF 2.0 para o extract do Iveco S-Way.
   ---------------------------------------------------------------------------
   O arquivo de origem (Iveco_S_Way_2021_cavalo.gltf, 73 MB) traz 873 buffers
   embutidos como data: URI, um por bufferView. Nada aqui depende de biblioteca
   externa de propósito: o bake precisa rodar com o node do projeto e mais nada.

   REGRA DA CASA: nenhuma medida sai de accessor.min/max. Essas rips declaram
   limites errados; tudo que vira número neste diretório é lido do atributo
   POSITION, vértice a vértice, através das matrizes reais dos nós. */
import fs from 'node:fs';

export function load(path) {
  const g = JSON.parse(fs.readFileSync(path, 'utf8'));
  g.__bufCache = new Map();
  return g;
}

export function buffer(g, i) {
  let b = g.__bufCache.get(i);
  if (!b) {
    const uri = g.buffers[i].uri;
    if (!uri || !uri.startsWith('data:')) throw new Error('buffer ' + i + ' não é data: URI');
    b = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
    g.__bufCache.set(i, b);
  }
  return b;
}

export const COMP = {
  5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
  5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4],
};
export const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Devolve os dados do accessor densamente empacotados, no tipo original. */
export function readAccessor(g, i) {
  const a = g.accessors[i];
  const [Ctor, sz] = COMP[a.componentType];
  const n = NUM[a.type];
  if (a.bufferView == null) return new Ctor(a.count * n);
  const bv = g.bufferViews[a.bufferView];
  const buf = buffer(g, bv.buffer);
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride || sz * n;
  const out = new Ctor(a.count * n);
  for (let e = 0; e < a.count; e++) {
    const view = new Ctor(buf.buffer, buf.byteOffset + off + e * stride, n);
    out.set(view, e * n);
  }
  return out;
}

export function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

/** a·b, ambas column-major (a convenção do glTF). */
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

export function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Uma entrada por primitiva, com a caixa em MUNDO medida vértice a vértice. */
export function walkMeshes(g) {
  const out = [];
  const walk = (ni, parent) => {
    const n = g.nodes[ni];
    const m = mul(parent, trs(n));
    if (n.mesh != null) {
      const me = g.meshes[n.mesh];
      for (const [pi, pr] of me.primitives.entries()) {
        const mode = pr.mode ?? 4;
        const pos = readAccessor(g, pr.attributes.POSITION);
        const count = g.accessors[pr.attributes.POSITION].count;
        const box = { min: [1e30, 1e30, 1e30], max: [-1e30, -1e30, -1e30] };
        for (let v = 0; v < count; v++) {
          const p = xform(m, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
          for (let k = 0; k < 3; k++) {
            if (p[k] < box.min[k]) box.min[k] = p[k];
            if (p[k] > box.max[k]) box.max[k] = p[k];
          }
        }
        out.push({
          node: ni, prim: pi, mode,
          name: n.name || me.name || '',
          mat: pr.material != null ? (g.materials[pr.material].name || String(pr.material)) : '(none)',
          box, matrix: m,
        });
      }
    }
    for (const c of n.children || []) walk(c, m);
  };
  for (const ni of g.scenes[g.scene ?? 0].nodes) walk(ni, ident());
  return out;
}

/* ---------------- escrita ---------------- */

/** Empacota {json, chunks} num .glb de buffer único. */
export function writeGLB(path, json, binChunks) {
  let total = 0;
  for (const c of binChunks) total += c.byteLength + ((4 - (c.byteLength % 4)) % 4);
  const bin = Buffer.alloc(total);
  let off = 0;
  for (const c of binChunks) {
    Buffer.from(c.buffer, c.byteOffset, c.byteLength).copy(bin, off);
    off += c.byteLength + ((4 - (c.byteLength % 4)) % 4);
  }
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length + binPad, 8);
  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonBuf.length + jsonPad, 0);
  jsonHdr.writeUInt32LE(0x4e4f534a, 4);
  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(bin.length + binPad, 0);
  binHdr.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path, Buffer.concat([
    header, jsonHdr, jsonBuf, Buffer.alloc(jsonPad, 0x20),
    binHdr, bin, Buffer.alloc(binPad, 0),
  ]));
}
