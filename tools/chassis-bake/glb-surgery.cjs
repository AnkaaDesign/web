/* CIRURGIA DE GLB — remover peça de um rip sem reencodar o que não se tocou.
   ===========================================================================

   POR QUE NÃO BLENDER
   ---------------------------------------------------------------------------
   `tools/wheel-bake/bake_wheel_vm.py` extrai UMA RODA e reexporta tudo pelo
   Blender, e para uma roda isso é certo. Para derivar configurações de eixo de
   um caminhão inteiro, não é — e o número que decide está medido:

       scania_p_8x2r.glb   BIN 29,06 MB
         imagens (57 WEBP)     19,33 MB   ← 67 %
         geometria             9,73 MB

   Passar esse arquivo pelo Blender reencoda as 57 imagens (o exportador
   decodifica e recomprime cada uma) e reencoda as 219 malhas, para mudar
   quatro delas. Dois terços do arquivo mudariam de bytes sem que ninguém
   pedisse, e a perda de qualidade de uma recompressão WEBP não aparece em
   nenhuma medida — só na foto, tarde.

   Aqui a cirurgia é local: **as imagens e as primitivas que não são cortadas
   saem byte a byte idênticas**. Só a primitiva que perde triângulos é
   decodificada, cortada e recodificada — em Draco, com a mesma quantização do
   resto do acervo (posição 16 · normal 12 · UV 14). Há um caminho SEM Draco
   como rede, e ele é glTF válido, mas custa ~3 MB por arquivo.

   O QUE ESTE ARQUIVO PRESSUPÕE — e foi conferido no alvo
   ---------------------------------------------------------------------------
   Medido em `scania_p_8x2r.glb`: 0 animações, 0 skins, 0 câmeras, 0 nós com
   filhos (a cena lista os 256 direto), 0 nós sem malha, 0 malhas com mais de
   uma primitiva, 0 primitivas sem Draco, 1 buffer. `verificaSuporte()` recusa
   um arquivo que não caiba nessas hipóteses, em vez de produzir um GLB torto:
   este módulo é uma faca, não um conversor.

   ⚠️ E LEIA O BLOCO DE `encoder()` ANTES DE MEXER NELE. O módulo do
   codificador é um THENABLE, e pôr o módulo dentro de uma promessa trava o
   processo a 99 % de CPU sem imprimir nada.
*/
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const THREE_DRACO = path.resolve(__dirname, '..', '..', 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco');

/**
 * Carrega um módulo emscripten do Draco num contexto isolado.
 *
 * ⚠️ `__dirname` SÓ VAI PARA QUEM TEM `.wasm` AO LADO, e a assimetria custou
 * uma hora. O decodificador é WASM e usa `__dirname` para achar
 * `draco_decoder.wasm`; sem ele a carga lança `__dirname is not defined`. O
 * codificador é asm.js PURO — não existe `draco_encoder.wasm` na pasta — e com
 * `__dirname` definido a cola do emscripten decide que está em Node, sai
 * procurando o `.wasm` que não existe e **trava sem erro nenhum**: o processo
 * fica vivo, sem CPU, e nada é impresso. Definir o caminho só quando o arquivo
 * existe faz a decisão pela MEDIDA em vez de pelo ambiente.
 */
function carregaModulo(arquivo) {
  const src = fs.readFileSync(path.join(THREE_DRACO, arquivo), 'utf8');
  const wasm = path.join(THREE_DRACO, arquivo.replace(/\.js$/, '.wasm'));
  const temWasm = fs.existsSync(wasm);
  const ctx = {
    require, process, console, Buffer, setTimeout, clearTimeout,
    TextDecoder, TextEncoder, URL, performance,
    module: { exports: {} }, exports: {},
  };
  if (temWasm) {
    ctx.__filename = path.join(THREE_DRACO, arquivo);
    ctx.__dirname = THREE_DRACO;
  }
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: arquivo });
  return ctx;
}

let _dec = null; let _enc = null;

/** O DECODIFICADOR. Devolve promessa — o módulo do decodificador já é assim. */
async function decoder() {
  if (_dec) return _dec;
  const ctx = carregaModulo('draco_decoder.js');
  const f = ctx.module.exports || ctx.DracoDecoderModule;
  _dec = await f();
  return _dec;
}

/**
 * O CODIFICADOR.
 *
 * ⚠️⚠️ NUNCA PONHA O MÓDULO DENTRO DE UMA PROMESSA. Esta função é síncrona de
 * propósito, e a razão custou uma hora de CPU a 99 %.
 *
 * O módulo emscripten do codificador é um THENABLE — ele carrega `.then` no
 * próprio objeto. Resolver uma promessa com um thenable faz o motor chamar o
 * `.then` dele para desembrulhar, e o `.then` do emscripten devolve o próprio
 * módulo: laço infinito. O sintoma é cruel porque o `onModuleLoaded` DISPARA
 * normalmente — o que nunca acontece é o `await` voltar. Medido: 496 s a 99 %
 * de CPU sem uma linha impressa.
 *
 * Isso vale para `new Promise(ok => ...ok(M))`, para `Promise.resolve(M)` e
 * para `return M` de dentro de uma `async function` — os três desembrulham
 * thenable. Por isso aqui não há `async`, não há promessa e o memo é lido e
 * escrito direto. O callback é síncrono (medido: 5 ms), então a checagem
 * abaixo é suficiente e não é uma corrida.
 *
 * O DECODIFICADOR não tem o problema: aquele é WASM, o `.then` some quando ele
 * resolve, e por isso `decoder()` pode ser `async`.
 */
function encoder() {
  if (_enc) return _enc;
  const ctx = carregaModulo('draco_encoder.js');
  ctx.DracoEncoderModule({ onModuleLoaded: (M) => { _enc = M; } });
  if (!_enc) throw new Error('o codificador Draco não chamou onModuleLoaded');
  return _enc;
}

/** O tipo Draco de cada atributo glTF. `TEXCOORD_1` também é `TEX_COORD`: o
 *  que os distingue no arquivo é o ID ÚNICO, não o tipo. */
function tipoDraco(E, nome) {
  if (nome === 'POSITION') return E.POSITION;
  if (nome === 'NORMAL') return E.NORMAL;
  if (nome.startsWith('TEXCOORD')) return E.TEX_COORD;
  return E.GENERIC;
}

/** Quantização por atributo — os mesmos números de `bake_wheel_vm.py`, que é
 *  o que o resto do acervo já usa. */
const quantDe = (nome) => (nome === 'POSITION' ? 16 : nome === 'NORMAL' ? 12
  : nome.startsWith('TEXCOORD') ? 14 : 12);

/**
 * Codifica atributos + índices num payload Draco.
 *
 * ⚠️ O DRACO REORDENA E DEDUPLICA PONTOS: a contagem que entra não é a que
 * sai, e escrever a de entrada no acessor produz um arquivo que carrega e
 * desenha lixo. Daí `SetTrackEncodedProperties(true)`.
 *
 * E daí o ROUND-TRIP obrigatório: decodifica o que acabou de sair e devolve a
 * caixa MEDIDA NO RESULTADO. É a única conferência que pega, de uma vez, id
 * único trocado, contagem errada e quantização que estourou o `min`/`max`.
 */
function codifica(attrs, idx, E, D) {
  const mesh = new E.Mesh();
  const builder = new E.MeshBuilder();
  builder.AddFacesToMesh(mesh, idx.length / 3, idx);
  const ids = {};
  for (const [nome, a] of Object.entries(attrs)) {
    ids[nome] = builder.AddFloatAttributeToMesh(
      mesh, tipoDraco(E, nome), a.arr.length / a.n, a.n, a.arr);
  }
  const enc = new E.Encoder();
  enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING);
  for (const nome of Object.keys(attrs)) {
    enc.SetAttributeQuantization(tipoDraco(E, nome), quantDe(nome));
  }
  /* Nível 6, como o Blender da casa: o exportador mapeia nível N para
     `SetSpeedOptions(10 − N, 10 − N)`. */
  enc.SetSpeedOptions(4, 4);
  enc.SetTrackEncodedProperties(true);

  const out = new E.DracoInt8Array();
  const len = enc.EncodeMeshToDracoBuffer(mesh, out);
  if (len <= 0) throw new Error('Draco não codificou');
  const bytes = Buffer.alloc(len);
  for (let i = 0; i < len; i++) bytes[i] = out.GetValue(i) & 0xff;
  const nPontos = enc.GetNumberOfEncodedPoints();
  const nFaces = enc.GetNumberOfEncodedFaces();
  E.destroy(out); E.destroy(enc); E.destroy(builder); E.destroy(mesh);

  const buffer = new D.DecoderBuffer();
  buffer.Init(new Int8Array(bytes), bytes.length);
  const dec = new D.Decoder();
  const m2 = new D.Mesh();
  const st = dec.DecodeBufferToMesh(buffer, m2);
  if (!st.ok()) throw new Error('round-trip do Draco falhou: ' + st.error_msg());
  if (m2.num_points() !== nPontos || m2.num_faces() !== nFaces) {
    throw new Error(`round-trip discorda: ${m2.num_points()}/${m2.num_faces()} `
      + `contra ${nPontos}/${nFaces}`);
  }
  const attr = dec.GetAttributeByUniqueId(m2, ids.POSITION);
  const dp = new D.DracoFloat32Array();
  dec.GetAttributeFloatForAllPoints(m2, attr, dp);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nPontos; i++) for (let c = 0; c < 3; c++) {
    const v = dp.GetValue(i * 3 + c);
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
  }
  D.destroy(dp); D.destroy(m2); D.destroy(buffer); D.destroy(dec);
  return { bytes, ids, nPontos, nFaces, min, max };
}

const MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

function lerGlb(p) {
  const buf = fs.readFileSync(p);
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error('não é GLB: ' + p);
  const total = buf.readUInt32LE(8);
  let off = 12, g = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off), tipo = buf.readUInt32LE(off + 4);
    const dados = buf.subarray(off + 8, off + 8 + len);
    if (tipo === CHUNK_JSON) g = JSON.parse(dados.toString('utf8'));
    else if (tipo === CHUNK_BIN) bin = Buffer.from(dados);
    off += 8 + len; off += (4 - (off % 4)) % 4;
  }
  if (!g || !bin) throw new Error('GLB sem JSON ou sem BIN: ' + p);
  return { g, bin };
}

function escreverGlb(p, g, bin) {
  const json = Buffer.from(JSON.stringify(g), 'utf8');
  const padJson = (4 - (json.length % 4)) % 4;
  const padBin = (4 - (bin.length % 4)) % 4;
  const jLen = json.length + padJson, bLen = bin.length + padBin;
  const total = 12 + 8 + jLen + 8 + bLen;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(MAGIC, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jLen, 12); out.writeUInt32LE(CHUNK_JSON, 16);
  json.copy(out, 20); out.fill(0x20, 20 + json.length, 20 + jLen);   // JSON usa espaço
  const o = 20 + jLen;
  out.writeUInt32LE(bLen, o); out.writeUInt32LE(CHUNK_BIN, o + 4);
  bin.copy(out, o + 8); out.fill(0, o + 8 + bin.length, o + 8 + bLen); // BIN usa zero
  fs.writeFileSync(p, out);
  return out.length;
}

/** Recusa um arquivo fora das hipóteses do módulo. Ver o cabeçalho. */
function verificaSuporte(g) {
  const erros = [];
  if ((g.animations || []).length) erros.push('tem animação');
  if ((g.skins || []).length) erros.push('tem skin');
  if (g.buffers.length !== 1) erros.push(`tem ${g.buffers.length} buffers`);
  if (g.nodes.some((n) => n.children && n.children.length)) erros.push('tem nó com filhos');
  if (g.meshes.some((m) => m.primitives.length !== 1)) erros.push('tem malha com ≠1 primitiva');
  if (g.meshes.some((m) => m.primitives.some((p) => !p.extensions
    || !p.extensions.KHR_draco_mesh_compression))) erros.push('tem primitiva sem Draco');
  if (erros.length) throw new Error('GLB fora das hipóteses de glb-surgery: ' + erros.join(' · '));
}

const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/**
 * Decodifica uma primitiva Draco INTEIRA — todos os atributos, não só posição.
 * Devolve os arrays no espaço LOCAL da malha (o nó ainda não foi aplicado).
 */
function decodifica(g, bin, prim, D) {
  const ext = prim.extensions.KHR_draco_mesh_compression;
  const bv = g.bufferViews[ext.bufferView];
  const dados = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const buffer = new D.DecoderBuffer();
  buffer.Init(new Int8Array(dados), dados.length);
  const dec = new D.Decoder();
  const mesh = new D.Mesh();
  const st = dec.DecodeBufferToMesh(buffer, mesh);
  if (!st.ok()) throw new Error('Draco não decodificou: ' + st.error_msg());

  const nv = mesh.num_points(), nf = mesh.num_faces();
  const attrs = {};
  for (const [nome, dracoId] of Object.entries(ext.attributes)) {
    const acc = g.accessors[prim.attributes[nome]];
    const n = NCOMP[acc.type];
    const attr = dec.GetAttributeByUniqueId(mesh, dracoId);
    const dp = new D.DracoFloat32Array();
    dec.GetAttributeFloatForAllPoints(mesh, attr, dp);
    const arr = new Float32Array(nv * n);
    for (let i = 0; i < nv * n; i++) arr[i] = dp.GetValue(i);
    D.destroy(dp);
    attrs[nome] = { arr, n, acessor: prim.attributes[nome] };
  }

  const idx = new Uint32Array(nf * 3);
  const ia = new D.DracoInt32Array();
  for (let f = 0; f < nf; f++) {
    dec.GetFaceFromMesh(mesh, f, ia);
    idx[f * 3] = ia.GetValue(0); idx[f * 3 + 1] = ia.GetValue(1); idx[f * 3 + 2] = ia.GetValue(2);
  }
  D.destroy(ia); D.destroy(mesh); D.destroy(buffer); D.destroy(dec);
  return { attrs, idx, nv, nf };
}


/* --------------------------------------------------------------------------
   O CORTE — reescreve a primitiva sem Draco, com os triângulos que sobraram
   -------------------------------------------------------------------------- */

/** glTF: tipos de componente. */
const FLOAT = 5126, UINT32 = 5125, UINT16 = 5123;
/** glTF: alvos de bufferView. */
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963;

/**
 * Aplica os cortes e devolve o BIN novo.
 *
 * `cortes` é uma lista de `{ malha, attrs, idx }` — o resultado de `recorta()`
 * por malha. Para cada uma:
 *   · escreve POSITION / NORMAL / TEXCOORD_n e os índices em bufferViews novas,
 *     anexadas ao fim do BIN;
 *   · cria acessores novos (com `min`/`max` em POSITION, que o glTF exige);
 *   · aponta a primitiva para eles e **APAGA a extensão Draco dela**.
 *
 * A bufferView Draco antiga fica órfã e some na `poda()`, que é quem repacota.
 *
 * ⚠️ ÍNDICE DE 16 BITS QUANDO CABE. Depois de tirar um eixo, quase toda
 * primitiva cortada fica abaixo de 65 536 vértices, e usar 32 bits ali dobra o
 * tamanho da lista de índices à toa. O corte é medido, não escolhido.
 */
function aplicaCorte(g, bin, cortes, E, D) {
  const blocos = [bin];
  let off = bin.length;
  const anexa = (buf, alvo, stride) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) { blocos.push(Buffer.alloc(pad)); off += pad; }
    const bv = { buffer: 0, byteOffset: off, byteLength: buf.length };
    if (stride !== undefined) bv.byteStride = stride;
    if (alvo !== undefined) bv.target = alvo;
    g.bufferViews.push(bv);
    blocos.push(buf); off += buf.length;
    return g.bufferViews.length - 1;
  };
  const novoAcessor = (a) => { g.accessors.push(a); return g.accessors.length - 1; };
  const tipoDe = (n) => (n === 3 ? 'VEC3' : n === 2 ? 'VEC2' : 'VEC4');

  for (const { malha, attrs, idx } of cortes) {
    const prim = g.meshes[malha].primitives[0];

    if (E && D) {
      /* CAMINHO DRACO. Os acessores de uma primitiva Draco NÃO têm
         `bufferView` — quem carrega os dados é o payload da extensão, e é
         assim que o arquivo de origem já faz. */
      const c = codifica(attrs, idx, E, D);
      const bv = anexa(c.bytes);
      const dracoAttrs = {};
      for (const [nome, a] of Object.entries(attrs)) {
        const acc = { componentType: FLOAT, count: c.nPontos, type: tipoDe(a.n) };
        if (nome === 'POSITION') { acc.min = c.min; acc.max = c.max; }
        prim.attributes[nome] = novoAcessor(acc);
        dracoAttrs[nome] = c.ids[nome];
      }
      prim.indices = novoAcessor({ componentType: UINT32, count: c.nFaces * 3, type: 'SCALAR' });
      prim.extensions = prim.extensions || {};
      prim.extensions.KHR_draco_mesh_compression = { bufferView: bv, attributes: dracoAttrs };
      continue;
    }

    /* CAMINHO SEM DRACO — a rede, e glTF válido: a extensão é POR PRIMITIVA e
       um arquivo pode misturar as duas formas. Custa alguns MB. */
    const nv = attrs.POSITION.arr.length / 3;
    for (const [nome, a] of Object.entries(attrs)) {
      const buf = Buffer.from(Buffer.from(a.arr.buffer, a.arr.byteOffset, a.arr.byteLength));
      const bv = anexa(buf, ARRAY_BUFFER, a.n * 4);
      const acc = { bufferView: bv, componentType: FLOAT, count: nv, type: tipoDe(a.n) };
      if (nome === 'POSITION') {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < nv; i++) for (let c2 = 0; c2 < 3; c2++) {
          const v = a.arr[i * 3 + c2];
          if (v < min[c2]) min[c2] = v;
          if (v > max[c2]) max[c2] = v;
        }
        acc.min = min; acc.max = max;
      }
      prim.attributes[nome] = novoAcessor(acc);
    }
    const curto = nv < 65536;
    const arr = curto ? Uint16Array.from(idx) : Uint32Array.from(idx);
    const bvI = anexa(Buffer.from(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)),
      ELEMENT_ARRAY_BUFFER);
    prim.indices = novoAcessor({ bufferView: bvI, componentType: curto ? UINT16 : UINT32,
      count: idx.length, type: 'SCALAR' });
    delete prim.extensions.KHR_draco_mesh_compression;
    if (!Object.keys(prim.extensions).length) delete prim.extensions;
  }

  /* `KHR_draco_mesh_compression` sai das listas de extensão se NENHUMA
     primitiva o usa mais — senão um leitor estrito recusa o arquivo por exigir
     uma extensão que ele não vai encontrar. */
  const aindaUsa = g.meshes.some((m) => m.primitives.some(
    (p) => p.extensions && p.extensions.KHR_draco_mesh_compression));
  if (!aindaUsa) {
    for (const chave of ['extensionsRequired', 'extensionsUsed']) {
      if (g[chave]) g[chave] = g[chave].filter((e) => e !== 'KHR_draco_mesh_compression');
    }
  }
  return Buffer.concat(blocos);
}

/**
 * Componentes conexos de uma malha, soldando vértices por posição.
 *
 * Mesma grade de 0,5 mm de `trailer-assembly.ts` e chave NUMÉRICA pela mesma
 * razão: um `Map` de strings sobre 1,5 M de vértices custa centenas de MB.
 */
const WELD = 5e-4, GRID = 65536;
function componentes(pos, idx) {
  const nv = pos.length / 3;
  const chave = new Map();
  const rep = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const ix = Math.round(pos[v * 3] / WELD) + GRID / 2;
    const iy = Math.round(pos[v * 3 + 1] / WELD) + GRID / 2;
    const iz = Math.round(pos[v * 3 + 2] / WELD) + GRID / 2;
    const k = (ix * GRID + iy) * GRID + iz;
    let r = chave.get(k);
    if (r === undefined) { r = v; chave.set(k, v); }
    rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const acha = (a) => { while (pai[a] !== a) { pai[a] = pai[pai[a]]; a = pai[a]; } return a; };
  const une = (a, b) => { const ra = acha(a), rb = acha(b); if (ra !== rb) pai[ra] = rb; };
  for (let i = 0; i < idx.length; i += 3) {
    une(rep[idx[i]], rep[idx[i + 1]]); une(rep[idx[i]], rep[idx[i + 2]]);
  }
  const grupos = new Map();
  for (let f = 0; f < idx.length / 3; f++) {
    const r = acha(rep[idx[f * 3]]);
    let g = grupos.get(r);
    if (!g) { g = []; grupos.set(r, g); }
    g.push(f);
  }
  return [...grupos.values()];
}

/** A caixa de um conjunto de faces. */
function caixaDeFaces(pos, idx, faces) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const f of faces) {
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
    }
  }
  return b;
}

/**
 * Reconstrói atributos e índices a partir de um subconjunto de FACES,
 * compactando os vértices (o Draco deduplica de novo, mas passar 70 k vértices
 * para descrever 300 faces custa memória e tempo à toa).
 */
function recorta(attrs, idx, faces) {
  const mapa = new Map();
  const novoIdx = new Uint32Array(faces.length * 3);
  let n = 0;
  faces.forEach((f, i) => {
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      let m = mapa.get(v);
      if (m === undefined) { m = n++; mapa.set(v, m); }
      novoIdx[i * 3 + k] = m;
    }
  });
  const novos = {};
  for (const [nome, a] of Object.entries(attrs)) {
    const arr = new Float32Array(n * a.n);
    for (const [velho, novo] of mapa) {
      for (let c = 0; c < a.n; c++) arr[novo * a.n + c] = a.arr[velho * a.n + c];
    }
    novos[nome] = { arr, n: a.n, acessor: a.acessor };
  }
  return { attrs: novos, idx: novoIdx, nv: n };
}

/**
 * PODA: mantém só os nós pedidos e recolhe o que ficou sem dono.
 *
 * O que é recolhido: malhas que nenhum nó referencia, os acessores delas e as
 * `bufferViews` de Draco. O que NÃO é: materiais, texturas, amostradores e
 * imagens. Isso é deliberado — o grafo de material do glTF tem referência de
 * textura espalhada por meia dúzia de extensões (`KHR_materials_clearcoat`,
 * `_specular`, `EXT_texture_webp`…), e recolher errado ali apaga a lataria de
 * um caminhão. Uma imagem órfã custa bytes e não custa correção; a poda de
 * material fica para quando houver medida que a justifique.
 *
 * As `bufferViews` de imagem são preservadas SEMPRE, e é por isso que a poda
 * pode ser cega ao resto: só as imagens apontam para bufferView fora da
 * geometria.
 */
function poda(g, bin, manterNo) {
  const nosVelhos = g.nodes;
  const manter = nosVelhos.map((n, i) => manterNo(n, i));

  const malhaUsada = new Set();
  nosVelhos.forEach((n, i) => { if (manter[i] && n.mesh !== undefined) malhaUsada.add(n.mesh); });

  /* bufferViews a preservar: as das imagens (sempre) e as Draco das malhas
     vivas. */
  const bvVivo = new Set();
  for (const im of (g.images || [])) if (im.bufferView !== undefined) bvVivo.add(im.bufferView);
  const accVivo = new Set();
  for (const mi of malhaUsada) {
    for (const p of g.meshes[mi].primitives) {
      if (p.indices !== undefined) accVivo.add(p.indices);
      for (const a of Object.values(p.attributes)) accVivo.add(a);
      const ext = p.extensions && p.extensions.KHR_draco_mesh_compression;
      if (ext) bvVivo.add(ext.bufferView);
    }
  }
  for (const ai of accVivo) {
    const a = g.accessors[ai];
    if (a.bufferView !== undefined) bvVivo.add(a.bufferView);
  }

  /* Remapeamentos, na ordem original para o diff do arquivo ficar legível. */
  const remap = (viva) => {
    const m = new Map(); let n = 0;
    for (const i of [...viva].sort((a, b) => a - b)) m.set(i, n++);
    return m;
  };
  const mBv = remap(bvVivo), mAcc = remap(accVivo), mMalha = remap(malhaUsada);

  /* O BIN novo: as bufferViews vivas, na ordem nova, alinhadas a 4 bytes. */
  const pedacos = []; let off = 0;
  const bvNovo = [];
  for (const [velho] of [...mBv].sort((a, b) => a[1] - b[1])) {
    const v = g.bufferViews[velho];
    const dados = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const pad = (4 - (off % 4)) % 4;
    if (pad) { pedacos.push(Buffer.alloc(pad)); off += pad; }
    pedacos.push(dados);
    const novo = { buffer: 0, byteOffset: off, byteLength: v.byteLength };
    if (v.byteStride !== undefined) novo.byteStride = v.byteStride;
    if (v.target !== undefined) novo.target = v.target;
    bvNovo.push(novo);
    off += v.byteLength;
  }
  const binNovo = Buffer.concat(pedacos);

  const accNovo = [...mAcc].sort((a, b) => a[1] - b[1]).map(([velho]) => {
    const a = { ...g.accessors[velho] };
    if (a.bufferView !== undefined) a.bufferView = mBv.get(a.bufferView);
    return a;
  });

  const malhasNovas = [...mMalha].sort((a, b) => a[1] - b[1]).map(([velho]) => {
    const m = JSON.parse(JSON.stringify(g.meshes[velho]));
    for (const p of m.primitives) {
      if (p.indices !== undefined) p.indices = mAcc.get(p.indices);
      for (const k of Object.keys(p.attributes)) p.attributes[k] = mAcc.get(p.attributes[k]);
      const ext = p.extensions && p.extensions.KHR_draco_mesh_compression;
      if (ext) ext.bufferView = mBv.get(ext.bufferView);
    }
    return m;
  });

  const nosNovos = [];
  const mNo = new Map();
  nosVelhos.forEach((n, i) => {
    if (!manter[i]) return;
    mNo.set(i, nosNovos.length);
    const novo = { ...n };
    novo.mesh = mMalha.get(n.mesh);
    nosNovos.push(novo);
  });

  const g2 = { ...g };
  g2.nodes = nosNovos;
  g2.meshes = malhasNovas;
  g2.accessors = accNovo;
  g2.bufferViews = bvNovo;
  g2.buffers = [{ byteLength: binNovo.length }];
  g2.scenes = g.scenes.map((s) => ({
    ...s, nodes: (s.nodes || []).filter((i) => mNo.has(i)).map((i) => mNo.get(i)),
  }));
  if (g.images) g2.images = g.images.map((im) => (im.bufferView === undefined
    ? im : { ...im, bufferView: mBv.get(im.bufferView) }));

  return { g: g2, bin: binNovo, removidos: manter.filter((v) => !v).length };
}

module.exports = {
  decoder, encoder, lerGlb, escreverGlb, verificaSuporte,
  decodifica, codifica, aplicaCorte, componentes, caixaDeFaces, recorta, poda,
};
