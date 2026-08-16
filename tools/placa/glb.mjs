/* Leitor de `.glb` com Draco, em Node — só o que a sonda da placa precisa.
   ===========================================================================
   POR QUE NÃO O three. `GLTFLoader` + `DRACOLoader` pedem `Worker`, `fetch` e
   `URL.createObjectURL`; montar essa fachada em Node é mais código do que ler o
   contêiner, que são dois pedaços com cabeçalho de 8 bytes. O decodificador em
   si NÃO é reimplementado: é o mesmo `draco_decoder.js` que o app usa, carregado
   num contexto de `vm` porque o arquivo é um bundle do emscripten que espera
   `self` e faz `module.exports` no fim.

   O QUE ESTE MÓDULO GARANTE, e a sonda depende dos três:

     1. **A hierarquia é percorrida.** Os 49 bakes de cavalo vêm achatados (um nó
        por material, sem filhos), mas o `trailer.glb` tem 5 852 nós em sete
        níveis. Uma sonda que lesse `nodes[]` na ordem do arquivo mediria o
        implemento inteiro na origem.
     2. **`accessor.min/max` continua valendo com Draco.** O glTF exige os dois
        no acessor de POSITION mesmo quando o buffer está comprimido, então a
        CAIXA de cada malha sai de graça — e é ela que descarta 95 % do modelo
        antes de descomprimir qualquer coisa.
     3. **A normal acompanha.** Sem ela não há como saber se um triângulo é a
        face externa do para-choque ou a parede de dentro dele. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const DRACO_JS = require_.resolve('three/examples/jsm/libs/draco/draco_decoder.js');

let dracoP = null;
/** O decodificador Draco do próprio acervo do three, num contexto de `vm`. */
export function draco() {
  if (dracoP) return dracoP;
  const src = fs.readFileSync(DRACO_JS, 'utf8');
  const ctx = {
    module: { exports: {} }, exports: {},
    __filename: DRACO_JS, __dirname: path.dirname(DRACO_JS),
    require: require_, console, process, Buffer,
    TextDecoder, TextEncoder, URL, setTimeout, clearTimeout, performance,
  };
  ctx.self = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: DRACO_JS });
  dracoP = ctx.module.exports({ wasmBinary: fs.readFileSync(DRACO_JS.replace(/\.js$/, '.wasm')) });
  return dracoP;
}

/** `{ json, bin }` de um `.glb`. */
export function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('não é um GLB: ' + file);
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const body = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
    if (len % 4) off += 4 - (len % 4);       // os pedaços são alinhados em 4
  }
  if (!json) throw new Error('GLB sem pedaço JSON: ' + file);
  return { json, bin };
}

const COMP = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(g, bin, i) {
  const a = g.accessors[i];
  if (a.bufferView === undefined) return null;      // Draco: mora na extensão
  const bv = g.bufferViews[a.bufferView];
  const T = COMP[a.componentType], n = NUM[a.type];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride;
  if (stride && stride !== n * T.BYTES_PER_ELEMENT) {
    const out = new T(a.count * n);
    for (let e = 0; e < a.count; e++) {
      out.set(new T(bin.buffer, bin.byteOffset + start + e * stride, n), e * n);
    }
    return out;
  }
  return new T(bin.buffer, bin.byteOffset + start, a.count * n);
}

/** Matriz do nó (column-major, como o glTF), de `matrix` ou do TRS. */
export function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0];
  const q = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Rotação/escala só — o que uma normal sofre. */
export function xformDir(m, x, y, z) {
  const v = [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}

/** Todo nó COM malha, com a matriz de mundo já acumulada. */
export function walkNodes(g) {
  const out = [];
  const visit = (i, m) => {
    const n = g.nodes[i];
    const wm = mul(m, nodeMatrix(n));
    if (n.mesh !== undefined) out.push({ index: i, node: n, matrix: wm });
    for (const c of n.children || []) visit(c, wm);
  };
  for (const i of g.scenes[g.scene ?? 0].nodes) visit(i, ident());
  return out;
}

/** Caixa de um nó, de `accessor.min/max` — sem descomprimir nada. */
export function boxOf(g, entry) {
  const mesh = g.meshes[entry.node.mesh];
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const p of mesh.primitives) {
    const a = g.accessors[p.attributes.POSITION];
    if (!a || !a.min) continue;
    for (let i = 0; i < 8; i++) {
      const c = xform(entry.matrix,
        i & 1 ? a.max[0] : a.min[0], i & 2 ? a.max[1] : a.min[1], i & 4 ? a.max[2] : a.min[2]);
      for (let k = 0; k < 3; k++) {
        if (c[k] < box.min[k]) box.min[k] = c[k];
        if (c[k] > box.max[k]) box.max[k] = c[k];
      }
    }
  }
  return box;
}

/** Nome do material da primeira primitiva — é como os bakes se identificam. */
export function materialOf(g, entry) {
  const prim = g.meshes[entry.node.mesh].primitives[0];
  return (g.materials?.[prim?.material] || {}).name || '';
}

/** Posições, normais e índices de um nó, já no espaço do ARQUIVO. */
export async function geometryOf(g, bin, entry) {
  const d = await draco();
  const mesh = g.meshes[entry.node.mesh];
  const m = entry.matrix;
  const pos = [], nrm = [], idx = [];
  for (const p of mesh.primitives) {
    let P, N, I;
    const ext = p.extensions?.KHR_draco_mesh_compression;
    if (ext) {
      const bv = g.bufferViews[ext.bufferView];
      const bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      const buf = new d.DecoderBuffer();
      buf.Init(new Int8Array(bytes), bytes.length);
      const dec = new d.Decoder();
      const geo = new d.Mesh();
      const st = dec.DecodeBufferToMesh(buf, geo);
      if (!st.ok()) { d.destroy(geo); d.destroy(dec); d.destroy(buf); continue; }
      const grab = (id) => {
        const at = dec.GetAttributeByUniqueId(geo, id);
        const arr = new d.DracoFloat32Array();
        dec.GetAttributeFloatForAllPoints(geo, at, arr);
        const o = new Float32Array(arr.size());
        for (let i = 0; i < o.length; i++) o[i] = arr.GetValue(i);
        d.destroy(arr);
        return o;
      };
      P = grab(ext.attributes.POSITION);
      if (ext.attributes.NORMAL !== undefined) N = grab(ext.attributes.NORMAL);
      const nf = geo.num_faces();
      I = new Uint32Array(nf * 3);
      const ia = new d.DracoInt32Array();
      for (let f = 0; f < nf; f++) {
        dec.GetFaceFromMesh(geo, f, ia);
        I[f * 3] = ia.GetValue(0); I[f * 3 + 1] = ia.GetValue(1); I[f * 3 + 2] = ia.GetValue(2);
      }
      d.destroy(ia); d.destroy(geo); d.destroy(dec); d.destroy(buf);
    } else {
      P = readAccessor(g, bin, p.attributes.POSITION);
      if (p.attributes.NORMAL !== undefined) N = readAccessor(g, bin, p.attributes.NORMAL);
      I = p.indices !== undefined ? readAccessor(g, bin, p.indices) : null;
      if (!I) { I = new Uint32Array(P.length / 3); for (let i = 0; i < I.length; i++) I[i] = i; }
    }
    const base = pos.length / 3;
    for (let i = 0; i < P.length; i += 3) {
      const v = xform(m, P[i], P[i + 1], P[i + 2]);
      pos.push(v[0], v[1], v[2]);
    }
    if (N) {
      for (let i = 0; i < N.length; i += 3) {
        const v = xformDir(m, N[i], N[i + 1], N[i + 2]);
        nrm.push(v[0], v[1], v[2]);
      }
    }
    for (let i = 0; i < I.length; i++) idx.push(base + I[i]);
  }
  return {
    pos: new Float32Array(pos),
    nrm: nrm.length ? new Float32Array(nrm) : null,
    idx: new Uint32Array(idx),
  };
}
