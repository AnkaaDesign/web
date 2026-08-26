/* LEITOR DE GLB EM NODE PURO — sem three, sem Chromium, com Draco.
   ---------------------------------------------------------------------------
   A bancada de `medir-0820.mjs` sobe um Chromium e serve `public/` só para ter
   um `GLTFLoader`. Para MEDIR isso é caro demais: o Scania P tem 2,9 M de
   triângulos e a pergunta ("onde acaba a longarina?") não precisa de WebGL nem
   de canvas. Este arquivo lê o GLB direto — JSON + BIN + `KHR_draco_mesh_
   compression` pelo decodificador que já mora em `node_modules/three` — e
   devolve as posições JÁ NO ESPAÇO NORMALIZADO de `models/vehicles/mounts.json`.

   `loadNormalized(file, mount)` aplica, nesta ordem:
     · a matriz de mundo do nó (composta pela cadeia de pais);
     · `centerX` e `groundY` do manifesto (subtraídos);
     · `orientYaw` (os rips da frota apontam para −Z; π leva forward para +Z).

   Ou seja: o que sai daqui pode ser comparado direto com `frameTopY`,
   `cabRearZ`, `frameEndZ` e as cotas de eixo do manifesto, sem conversão.
   Quem quiser o espaço CRU passa `{}` como `mount`.

   Devolve UMA entrada por PRIMITIVA, não por nó — é a primitiva que carrega o
   material, e num rip fundido (o `truck_p4` do VW tem cabine e quadro juntos)
   é ela que precisa ser decomposta por componente conexo depois. Ver
   `tailprobe.cjs`, que faz exatamente isso.
*/
/* Leitor de GLB em Node, com Draco. Devolve peças com POSITION em espaço
   NORMALIZADO de mounts.json (forward=+Z, orientYaw aplicado, groundY subtraido). */
const fs = require('fs'), vm = require('vm'), path = require('path');
const WEB = '/home/kennedy/Documents/repositories/web';
const DRACO_JS = path.join(WEB, 'node_modules/three/examples/jsm/libs/draco/draco_decoder.js');

let _draco = null;
async function draco() {
  if (_draco) return _draco;
  const src = fs.readFileSync(DRACO_JS, 'utf8');
  const sm = { exports: {} };
  const ctx = { module: sm, exports: sm.exports, require, __filename: DRACO_JS,
    __dirname: path.dirname(DRACO_JS), process, console, Buffer, setTimeout, clearTimeout,
    TextDecoder, TextEncoder, URL, performance };
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'draco_decoder.js' });
  _draco = await sm.exports();
  return _draco;
}

function readGlb(p) {
  const buf = fs.readFileSync(p);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('não é GLB: ' + p);
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len; off += (4 - (off % 4)) % 4;
  }
  return { json, bin };
}

/* ---- matrizes 4x4 column-major (como glTF) ---- */
const ident = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) { // a*b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function trs(t, r, s) {
  const [x, y, z, w] = r || [0,0,0,1];
  const x2 = x+x, y2 = y+y, z2 = z+z;
  const xx = x*x2, xy = x*y2, xz = x*z2, yy = y*y2, yz = y*z2, zz = z*z2;
  const wx = w*x2, wy = w*y2, wz = w*z2;
  const sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
  const m = [
    (1-(yy+zz))*sx, (xy+wz)*sx, (xz-wy)*sx, 0,
    (xy-wz)*sy, (1-(xx+zz))*sy, (yz+wx)*sy, 0,
    (xz+wy)*sz, (yz-wx)*sz, (1-(xx+yy))*sz, 0,
    t ? t[0] : 0, t ? t[1] : 0, t ? t[2] : 0, 1];
  return m;
}
const applyM = (m, x, y, z) => [
  m[0]*x + m[4]*y + m[8]*z + m[12],
  m[1]*x + m[5]*y + m[9]*z + m[13],
  m[2]*x + m[6]*y + m[10]*z + m[14]];

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(g, bin, i) {
  const a = g.accessors[i];
  const n = NCOMP[a.type], TA = COMP[a.componentType];
  const out = new Float32Array(a.count * n);
  if (a.bufferView === undefined) return out;
  const bv = g.bufferViews[a.bufferView];
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride || n * TA.BYTES_PER_ELEMENT;
  for (let k = 0; k < a.count; k++) {
    const o = base + k * stride;
    for (let c = 0; c < n; c++) {
      let v;
      const off = o + c * TA.BYTES_PER_ELEMENT;
      switch (a.componentType) {
        case 5126: v = bin.readFloatLE(off); break;
        case 5125: v = bin.readUInt32LE(off); break;
        case 5123: v = bin.readUInt16LE(off); break;
        case 5122: v = bin.readInt16LE(off); break;
        case 5121: v = bin.readUInt8(off); break;
        case 5120: v = bin.readInt8(off); break;
      }
      out[k * n + c] = v;
    }
  }
  return out;
}

async function decodePrim(g, bin, prim, D) {
  const ext = prim.extensions && prim.extensions.KHR_draco_mesh_compression;
  if (!ext) {
    const pos = readAccessor(g, bin, prim.attributes.POSITION);
    let idx = null;
    if (prim.indices !== undefined) {
      const a = g.accessors[prim.indices];
      idx = new Uint32Array(a.count);
      const arr = readAccessor(g, bin, prim.indices);
      for (let i = 0; i < a.count; i++) idx[i] = arr[i];
    }
    return { pos, idx };
  }
  const bv = g.bufferViews[ext.bufferView];
  const data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const buffer = new D.DecoderBuffer();
  buffer.Init(new Int8Array(data), data.length);
  const dec = new D.Decoder();
  const type = dec.GetEncodedGeometryType(buffer);
  if (type !== D.TRIANGULAR_MESH) { D.destroy(buffer); D.destroy(dec); return { pos: new Float32Array(0), idx: null }; }
  const mesh = new D.Mesh();
  const st = dec.DecodeBufferToMesh(buffer, mesh);
  if (!st.ok()) { D.destroy(mesh); D.destroy(buffer); D.destroy(dec); return { pos: new Float32Array(0), idx: null }; }
  const id = dec.GetAttributeId(mesh, D.POSITION);
  const attr = dec.GetAttribute(mesh, id);
  const nv = mesh.num_points();
  const dp = new D.DracoFloat32Array();
  dec.GetAttributeFloatForAllPoints(mesh, attr, dp);
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) pos[i] = dp.GetValue(i);
  D.destroy(dp);
  const nf = mesh.num_faces();
  const idx = new Uint32Array(nf * 3);
  const ia = new D.DracoInt32Array();
  for (let f = 0; f < nf; f++) {
    dec.GetFaceFromMesh(mesh, f, ia);
    idx[f*3] = ia.GetValue(0); idx[f*3+1] = ia.GetValue(1); idx[f*3+2] = ia.GetValue(2);
  }
  D.destroy(ia); D.destroy(mesh); D.destroy(buffer); D.destroy(dec);
  return { pos, idx };
}

/** Carrega o GLB e devolve peças com posições no espaço NORMALIZADO. */
async function loadNormalized(file, mount) {
  const { json: g, bin } = readGlb(file);
  const D = await draco();
  const parentOf = new Array(g.nodes.length).fill(-1);
  g.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parentOf[c] = i; }));
  const local = g.nodes.map((n) => n.matrix ? n.matrix.slice() : trs(n.translation, n.rotation, n.scale));
  const world = new Array(g.nodes.length).fill(null);
  const W = (i) => {
    if (world[i]) return world[i];
    world[i] = parentOf[i] < 0 ? local[i] : mul(W(parentOf[i]), local[i]);
    return world[i];
  };
  const yaw = mount.orientYaw || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const cx = mount.centerX || 0, gy = mount.groundY || 0;
  const pieces = [];
  for (let ni = 0; ni < g.nodes.length; ni++) {
    const n = g.nodes[ni];
    if (n.mesh === undefined) continue;
    const m = W(ni);
    const mesh = g.meshes[n.mesh];
    for (let pi = 0; pi < mesh.primitives.length; pi++) {
      const prim = mesh.primitives[pi];
      const { pos, idx } = await decodePrim(g, bin, prim, D);
      if (!pos.length) continue;
      const out = new Float32Array(pos.length);
      for (let v = 0; v < pos.length / 3; v++) {
        const [wx, wy, wz] = applyM(m, pos[v*3], pos[v*3+1], pos[v*3+2]);
        const dx = wx - cx;
        out[v*3] = dx * cos + wz * sin;
        out[v*3+1] = wy - gy;
        out[v*3+2] = -dx * sin + wz * cos;
      }
      pieces.push({
        node: n.name || `node${ni}`, nodeIndex: ni,
        mesh: mesh.name || `mesh${n.mesh}`, prim: pi,
        mat: prim.material !== undefined ? (g.materials[prim.material].name || `mat${prim.material}`) : '',
        pos: out, idx,
      });
    }
  }
  return { g, pieces };
}

module.exports = { loadNormalized, readGlb };
