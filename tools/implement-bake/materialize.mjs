#!/usr/bin/env node
/* MATERIALIZAR UM IMPLEMENTO — devolver ao bake os materiais que o export perdeu.
   ===========================================================================

   O DEFEITO, MEDIDO
   ---------------------------------------------------------------------------
   O `.gltf` do sobrechassi gancheiro chegou com **UM material para 1 147
   primitivas**: `metal-pouco-polido`, baseColor 0,8 branco, sem uma única
   textura declarada (`"textures": []`, `"images": []`). Não é "textura errada":
   é a IDENTIDADE DE MATERIAL inteira apagada no caminho. Por isso a peça preta
   aparece metálica, a borracha aparece metálica, a lente da lanterna aparece
   metálica — todas são a MESMA superfície branca.

   O que sobreviveu é o NOME DA MALHA. O exportador (FBX2glTF) batiza cada malha
   `${nó}_${material}_${índice}`, e essa string é a única cópia da atribuição
   original que restou no arquivo:

       stitch_result_stitch all_Cor_padrao_branco(metalBranco)_0
       borracha-porta-lateral-01_borracha-preta_0
       lanterna-pequena-cantos-redondo(leds)-003_lanterna-pequena-...(VERMELHO)_0

   Este script lê esse sufixo, reagrupa as primitivas por ele e reatribui um
   material de verdade a cada grupo.

   POR QUE O MATERIAL VEM DO `trailer.glb` E NÃO DAS PNG QUE VIERAM JUNTO
   ---------------------------------------------------------------------------
   A pasta do modelo traz 16 conjuntos PBR em PNG (65 arquivos, 25 MB). Eles NÃO
   são usados aqui, e a decisão é do dono: *"use as texturas da nossa, para não
   precisar analisar a textura bagunçada que ela tem"*.

   E há um motivo técnico que a confirma: os dois modelos são do MESMO autor e
   compartilham o vocabulário de material — 14 dos 17 nomes batem letra por letra
   com os do `trailer.glb` (`Cor_padrao_branco(metalBranco)`, `borracha-preta`,
   `metal-estrutura-principal-padrao`, `Faixa-3M`, `platico-branco` com o mesmo
   erro de digitação…). Copiar o material do doador não é aproximação: é
   restaurar a MESMA definição que o outro implemento já usa, com as mesmas
   texturas WebP já otimizadas, já servidas e já verificadas em foto.

   Ganha-se com isso a coisa que importa mais que a aparência: `applyTrailerFinish()`
   em `engine/vehicle/models.ts` despacha **por nome de material**. Um implemento
   cujos materiais se chamam como os do `trailer.glb` entra no acabamento, na
   divisão da ferragem (`splitTrailerHardware()`), na fita retrorrefletiva, nas
   lanternas e na pintura SEM UMA LINHA DE CÓDIGO NOVA. Qualquer outro nome cai
   no ramo genérico e o implemento nasce mudo para o engine inteiro.

   AS TRÊS EXCEÇÕES DO MAPA (`ALIAS`), e o porquê de cada uma
   ---------------------------------------------------------------------------
   1. `parafusos` → `inox-ferragem`. São 346 primitivas / 122,8 k triângulos —
      a parafusaria. No `trailer.glb` ela JÁ chega assim: os nós continuam se
      chamando `stitch_result_stitch_all_parafusos_0` (857 deles) mas o material
      é `inox-ferragem`. Manter `parafusos` como material próprio criaria um
      nome que `TRAILER_STRUCT_METAL_RE` e `STAINLESS_FAMILY_RE` não conhecem, e
      a parafusaria nasceria fora da divisão por vão em Z — ou seja, fora do
      inox. O alias não inventa nada: reproduz a decisão do outro bake.
   2. `Metal-preto` → `metal-preto`. Só o caixa-alta. As regras do engine são
      `/i`, mas o `_meta.json`, os relatórios da bancada e o `censo.mjs` agrupam
      por string crua — duas grafias do mesmo material seriam duas linhas.
   3. `logo-chapas-metal` → material NOVO, com a textura DA PASTA DE ORIGEM.
      É a única em que a PNG que veio junto é a resposta certa, e a razão é que
      ela não é acabamento: é IDENTIDADE. São as 4 plaquetas da marca do
      fabricante (Ibiporã Implementos Rodoviários) na saia lateral. O
      `trailer.glb` não tem contraparte — lá as plaquetas ficaram sem material
      próprio —, então não há o que copiar. Mapear para `metal-claro` apagaria a
      marca do implemento.

   O QUE MAIS ESTE PASSO CONSERTA, e por que cabe aqui
   ---------------------------------------------------------------------------
   · **TIRA DE TRIÂNGULOS — as 1 147 primitivas vêm em `mode: 5`.** Este é o
     defeito mais caro do arquivo e o menos visível: nenhum outro asset do
     acervo é assim (`trailer.glb`, os 40 cavalos e o `thermoking.glb` são todos
     `mode: 4`, TRIANGLES, com índice de 16 bits). Uma tira custa três coisas:

       1. **O Draco não a comprime.** `gltf-transform draco` pula toda primitiva
          que não seja TRIANGLES — medido: 17,10 MB → 17,17 MB, ou seja o passo
          mais eficaz da receita da §6 vira nada.
       2. **Os triângulos DEGENERADOS.** Uma tira só emenda dois trechos
          repetindo vértice, e cada emenda dessas é um triângulo de área zero
          com normal indefinida. O `GLTFLoader` do three converte a tira em
          lista no carregamento (`toTrianglesDrawMode()`) e **mantém os
          degenerados** — eles chegam à GPU, e é de sombreado indefinido em
          sliver que nascem as costuras e o cintilar que o relato chama de
          z-fighting.
       3. **A conta de triângulo mente por 3×.** Numa tira de N índices saem
          N−2 triângulos, não N/3. Os "0,93 M triângulos" que a leitura ingênua
          dá são na verdade ~2,79 M submetidos por quadro.

     Aqui a tira vira lista, o degenerado é DESCARTADO e o índice volta para
     16 bits quando cabe (`< 65 536` vértices, que é o caso de toda malha
     deste arquivo) — o mesmo formato do resto do acervo.
   · **6 101 buffers.** O arquivo tem UM buffer por bufferView, cada um numa URI
     `data:` base64. É o que faz 88,5 MB de geometria ocuparem 121,3 MB de
     arquivo (+37 %) e o que obriga o carregador a 6 101 decodificações base64
     antes do primeiro triângulo. A saída é um GLB com UM chunk BIN.
   · **O nome com ESPAÇO.** `stitch_result_stitch all` aqui, `stitch_result_stitch_all`
     no `trailer.glb`. Nenhuma regra do engine casa esse prefixo hoje, mas os dois
     implementos passam pelas MESMAS sondas (`tools/trailer-bench/`), e uma sonda
     que separa por nome de nó teria de conhecer duas grafias do mesmo prefixo
     para sempre. Normalizado aqui, uma vez.

   O QUE ESTE PASSO NÃO FAZ, DE PROPÓSITO
   ---------------------------------------------------------------------------
   Não comprime. A saída é um GLB grande e sem perdas, para a receita da §6 do
   `ARCHITECTURE.md` rodar em cima dela — `dedup --materials false`, `prune`,
   `webp --lossless`, `draco`. Rodar Draco aqui dentro duplicaria a receita e
   perderia as duas armadilhas que o §6 documenta (`dedup` funde material por
   padrão e derruba os nomes de que tudo acima depende; `quantize` NUNCA).

   Não move, não gira e não reescala nada. O engine assenta o implemento em
   `groundAndCenter()` e mede tudo em espaço de mundo depois disso; mexer na pose
   aqui só criaria uma segunda verdade sobre onde o zero fica.

   USO
   ---------------------------------------------------------------------------
       node tools/implement-bake/materialize.mjs \
         --src   "~/Downloads/glb-extract/02- Frigorfico.Gancheiro.Sobrechassi/0fdc925d055346d293d6cd22f86dba4a.gltf" \
         --donor public/models/vehicles/trailer.glb \
         --out   /tmp/sobrechassi_frigorifico_gancheiro.raw.glb

       --dry            só o relatório; não escreve nada
       --texdir <dir>   pasta das PNG de origem (padrão: a do --src)
*/
import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ *
 * O MAPA. Nome que sai do nome da malha  →  nome no `trailer.glb`.
 * Um nome ausente daqui é copiado como está (é o caso dos 14 que batem).
 * ------------------------------------------------------------------ */
const ALIAS = {
  parafusos: 'inox-ferragem',
  'Metal-preto': 'metal-preto',
};

/** Materiais que não existem no doador e nascem aqui, com textura da origem.
 *  `tex` casa o FIM do nome do arquivo, depois do hash de 32 caracteres. */
const FROM_SOURCE = {
  'logo-chapas-metal': {
    baseColor: 'RGB_logo-chapas_BaseColor.png',
    normal: 'N_logo-chapas_Normal.png',
    metallicRoughness: null,   // as PNG vêm separadas; ver a nota em texture()
    factors: { metallicFactor: 0.1, roughnessFactor: 0.45 },
  },
};

/* ------------------------------------------------------------------ *
 * Leitura de contêiner — GLB e glTF, sem dependência externa.
 * ------------------------------------------------------------------ */
function readGLB(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(20);
  fs.readSync(fd, head, 0, 20, 0);
  if (head.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: não é GLB`);
  const jsonLen = head.readUInt32LE(12);
  const jsonBuf = Buffer.alloc(jsonLen);
  fs.readSync(fd, jsonBuf, 0, jsonLen, 20);
  let bin = Buffer.alloc(0);
  const binHead = Buffer.alloc(8);
  const got = fs.readSync(fd, binHead, 0, 8, 20 + jsonLen);
  if (got === 8 && binHead.readUInt32LE(4) === 0x004e4942) {
    const binLen = binHead.readUInt32LE(0);
    bin = Buffer.alloc(binLen);
    fs.readSync(fd, bin, 0, binLen, 20 + jsonLen + 8);
  }
  fs.closeSync(fd);
  return { json: JSON.parse(jsonBuf.toString('utf8')), bin };
}

/** Resolve um glTF de URIs `data:` num par (json, um único BIN).
 *  Reescreve `bufferViews[].buffer` para 0 e recalcula os offsets. */
function readGLTFFlat(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parts = [];
  let off = 0;
  const bufOff = (json.buffers || []).map((b) => {
    if (!b.uri) throw new Error('buffer sem uri e sem chunk BIN');
    const comma = b.uri.indexOf(',');
    const bytes = Buffer.from(b.uri.slice(comma + 1), 'base64');
    const at = off;
    parts.push(bytes);
    off += bytes.length;
    /* Alinhamento de 4 exigido pelo glTF para todo bufferView com `target`;
       barato aqui e obrigatório para os acessores de índice de 32 bits. */
    const pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    return at;
  });
  for (const v of json.bufferViews || []) {
    v.byteOffset = bufOff[v.buffer] + (v.byteOffset || 0);
    v.buffer = 0;
  }
  const bin = Buffer.concat(parts);
  json.buffers = [{ byteLength: bin.length }];
  return { json, bin };
}

function writeGLB(file, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonLen = jsonBuf.length + jsonPad;
  const binLen = bin.length + binPad;
  const total = 12 + 8 + jsonLen + (binLen ? 8 + binLen : 0);
  const out = Buffer.alloc(total);
  let p = 0;
  out.writeUInt32LE(0x46546c67, p); p += 4;
  out.writeUInt32LE(2, p); p += 4;
  out.writeUInt32LE(total, p); p += 4;
  out.writeUInt32LE(jsonLen, p); p += 4;
  out.writeUInt32LE(0x4e4f534a, p); p += 4;
  jsonBuf.copy(out, p); p += jsonBuf.length;
  out.fill(0x20, p, p + jsonPad); p += jsonPad;          // JSON pad = espaço
  if (binLen) {
    out.writeUInt32LE(binLen, p); p += 4;
    out.writeUInt32LE(0x004e4942, p); p += 4;
    bin.copy(out, p); p += bin.length;
    out.fill(0x00, p, p + binPad);                        // BIN pad = zero
  }
  fs.writeFileSync(file, out);
  return total;
}

/* ------------------------------------------------------------------ *
 * TIRA → LISTA.
 *
 * `mode 5` (TRIANGLE_STRIP): o triângulo k é (k, k+1, k+2) com o enrolamento
 * INVERTIDO nos ímpares — trocar não é opcional, é o que mantém a face virada
 * para o mesmo lado (o three descarta por enrolamento, não pela normal
 * declarada; ver o defeito 2 do `PORTA-LATERAL-HANDOFF.md`).
 * `mode 6` (TRIANGLE_FAN): o triângulo k é (0, k+1, k+2), sem inversão.
 *
 * O degenerado — dois índices iguais no mesmo triângulo — é a emenda entre
 * trechos de tira e sai fora. Ele não desenha nada e custa uma primitiva por
 * quadro, mais uma normal indefinida no vértice compartilhado.
 * ------------------------------------------------------------------ */
const IDX_BYTES = { 5121: 1, 5123: 2, 5125: 4 };

function readIndices(json, bin, accIndex) {
  const a = json.accessors[accIndex];
  const v = json.bufferViews[a.bufferView];
  const size = IDX_BYTES[a.componentType];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const stride = v.byteStride || size;
  const out = new Uint32Array(a.count);
  for (let i = 0; i < a.count; i++) {
    const at = start + i * stride;
    out[i] = size === 1 ? bin.readUInt8(at) : size === 2 ? bin.readUInt16LE(at) : bin.readUInt32LE(at);
  }
  return out;
}

function expand(idx, mode) {
  const tri = [];
  if (mode === 5) {
    for (let k = 0; k + 2 < idx.length; k++) {
      const a = idx[k], b = idx[k + 1], c = idx[k + 2];
      if (a === b || b === c || a === c) continue;          // emenda da tira
      if (k & 1) tri.push(a, c, b); else tri.push(a, b, c); // enrolamento
    }
  } else if (mode === 6) {
    for (let k = 1; k + 1 < idx.length; k++) {
      const a = idx[0], b = idx[k], c = idx[k + 1];
      if (a === b || b === c || a === c) continue;
      tri.push(a, b, c);
    }
  }
  return tri;
}

/* ------------------------------------------------------------------ *
 * O nome de material que sobrou no nome da malha.
 * ------------------------------------------------------------------ */
/** `${dono}_${material}_${n}` — o dono é este nó ou um ancestral dele.
 *  Um `_gltfNode_N` sintético pode estar no meio, daí a subida pela cadeia. */
function materialFromName(meshName, nodeName, ancestorNames) {
  const nm = (meshName || '').replace(/_\d+$/, '');
  const owners = [nodeName, ...ancestorNames]
    .filter(Boolean)
    .filter((o) => nm.startsWith(o + '_'))
    .sort((a, b) => b.length - a.length);
  if (owners.length) return nm.slice(owners[0].length + 1);
  const m = nm.match(/^.*_([^_]+)$/);
  return m ? m[1] : nm;
}

/* ------------------------------------------------------------------ *
 * Cópia de material do doador, arrastando textura/sampler/imagem.
 * ------------------------------------------------------------------ */
function makeMaterialCopier(donor, out, outBinParts, outBinLen) {
  const imgMap = new Map();      // índice de imagem no doador → no destino
  const texMap = new Map();
  const smpMap = new Map();
  const state = { len: outBinLen };

  const copySampler = (i) => {
    if (i == null) return undefined;
    if (smpMap.has(i)) return smpMap.get(i);
    out.samplers ||= [];
    out.samplers.push(structuredClone(donor.json.samplers[i]));
    const j = out.samplers.length - 1;
    smpMap.set(i, j);
    return j;
  };

  const copyImage = (i) => {
    if (imgMap.has(i)) return imgMap.get(i);
    const src = donor.json.images[i];
    const v = donor.json.bufferViews[src.bufferView];
    const bytes = donor.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const at = state.len;
    outBinParts.push(bytes);
    state.len += bytes.length;
    const pad = (4 - (state.len % 4)) % 4;
    if (pad) { outBinParts.push(Buffer.alloc(pad)); state.len += pad; }
    out.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.length });
    out.images ||= [];
    out.images.push({ bufferView: out.bufferViews.length - 1, mimeType: src.mimeType });
    const j = out.images.length - 1;
    imgMap.set(i, j);
    return j;
  };

  const copyTexture = (i) => {
    if (texMap.has(i)) return texMap.get(i);
    const src = donor.json.textures[i];
    out.textures ||= [];
    out.textures.push({ source: copyImage(src.source), ...(src.sampler != null ? { sampler: copySampler(src.sampler) } : {}) });
    const j = out.textures.length - 1;
    texMap.set(i, j);
    return j;
  };

  const remapRef = (ref) => {
    if (!ref) return ref;
    const c = structuredClone(ref);
    c.index = copyTexture(ref.index);
    return c;
  };

  return {
    state,
    copy(name) {
      const src = donor.json.materials.find((m) => m.name === name);
      if (!src) return null;
      const m = structuredClone(src);
      const p = m.pbrMetallicRoughness;
      if (p) {
        if (p.baseColorTexture) p.baseColorTexture = remapRef(p.baseColorTexture);
        if (p.metallicRoughnessTexture) p.metallicRoughnessTexture = remapRef(p.metallicRoughnessTexture);
      }
      if (m.normalTexture) m.normalTexture = remapRef(m.normalTexture);
      if (m.occlusionTexture) m.occlusionTexture = remapRef(m.occlusionTexture);
      if (m.emissiveTexture) m.emissiveTexture = remapRef(m.emissiveTexture);
      return m;
    },
    /** PNG crua da pasta de origem — só para `FROM_SOURCE`. */
    fromFile(file) {
      const bytes = fs.readFileSync(file);
      const at = state.len;
      outBinParts.push(bytes);
      state.len += bytes.length;
      const pad = (4 - (state.len % 4)) % 4;
      if (pad) { outBinParts.push(Buffer.alloc(pad)); state.len += pad; }
      out.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.length });
      out.images ||= [];
      out.images.push({ bufferView: out.bufferViews.length - 1, mimeType: 'image/png' });
      out.samplers ||= [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
      out.textures ||= [];
      out.textures.push({ source: out.images.length - 1, sampler: 0 });
      return out.textures.length - 1;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Programa
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes(k);

const srcPath = arg('--src');
const donorPath = arg('--donor', 'public/models/vehicles/trailer.glb');
const outPath = arg('--out');
const texDir = arg('--texdir') || (srcPath && path.dirname(srcPath));
if (!srcPath || (!outPath && !has('--dry'))) {
  console.error('uso: materialize.mjs --src <gltf|glb> --out <glb> [--donor <glb>] [--texdir <dir>] [--dry]');
  process.exit(2);
}

const src = srcPath.toLowerCase().endsWith('.glb') ? readGLB(srcPath) : readGLTFFlat(srcPath);
const donor = readGLB(donorPath);
const g = src.json;
const nodes = g.nodes || [], meshes = g.meshes || [];

/* O BIN de saída começa no BIN da origem; o destrip e as texturas anexam nele. */
const outBinParts = [src.bin];
let binLen = src.bin.length;
{ const pad = (4 - (binLen % 4)) % 4; if (pad) { outBinParts.push(Buffer.alloc(pad)); binLen += pad; } }

/* ---------------- 0) tira → lista ---------------- */
const strip = { prims: 0, before: 0, after: 0, degenerate: 0, shrunk: 0 };
const destripped = new Map();          // acessor de índice antigo → novo
for (const mesh of meshes) {
  for (const prim of mesh.primitives || []) {
    const mode = prim.mode ?? 4;
    if (mode !== 5 && mode !== 6) continue;
    if (prim.indices == null) {
      /* Sem índice, a tira é a ordem dos vértices. Não acontece neste arquivo;
         recusar é melhor que expandir errado em silêncio. */
      throw new Error(`primitiva mode ${mode} sem índices em "${mesh.name}" — não previsto`);
    }
    strip.prims++;
    let target = destripped.get(prim.indices);
    if (target === undefined) {
      const idx = readIndices(g, src.bin, prim.indices);
      const tri = expand(idx, mode);
      const raw = mode === 5 ? Math.max(0, idx.length - 2) : Math.max(0, idx.length - 2);
      strip.before += raw;
      strip.after += tri.length / 3;
      strip.degenerate += raw - tri.length / 3;
      let max = 0;
      for (const v of tri) if (v > max) max = v;
      const short = max < 65536;
      if (short) strip.shrunk++;
      const bytes = Buffer.alloc(tri.length * (short ? 2 : 4));
      for (let i = 0; i < tri.length; i++) {
        if (short) bytes.writeUInt16LE(tri[i], i * 2); else bytes.writeUInt32LE(tri[i], i * 4);
      }
      const at = binLen;
      outBinParts.push(bytes); binLen += bytes.length;
      const pad = (4 - (binLen % 4)) % 4;
      if (pad) { outBinParts.push(Buffer.alloc(pad)); binLen += pad; }
      g.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.length, target: 34963 });
      g.accessors.push({
        bufferView: g.bufferViews.length - 1,
        componentType: short ? 5123 : 5125,
        count: tri.length,
        type: 'SCALAR',
      });
      target = g.accessors.length - 1;
      destripped.set(prim.indices, target);
    }
    prim.indices = target;
    delete prim.mode;                   // 4 é o padrão do glTF
  }
}

/* Cadeia de ancestrais por nó — o dono do nome pode estar acima. */
const parent = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
const ancestorsOf = (i) => {
  const a = []; let k = parent[i], guard = 0;
  while (k >= 0 && guard++ < 64) { a.push(nodes[k].name); k = parent[k]; }
  return a;
};

/* 1) agrupar primitivas pelo material que o nome carrega */
const groups = new Map();     // nome de origem → { prims:[{mesh,prim}], tris }
nodes.forEach((n, i) => {
  if (n.mesh == null) return;
  const mesh = meshes[n.mesh];
  const anc = ancestorsOf(i);
  for (const prim of mesh.primitives || []) {
    const name = materialFromName(mesh.name, n.name, anc);
    let rec = groups.get(name);
    if (!rec) { rec = { prims: [], tris: 0 }; groups.set(name, rec); }
    rec.prims.push(prim);
    const c = prim.indices != null ? g.accessors[prim.indices].count
                                   : g.accessors[prim.attributes.POSITION].count;
    rec.tris += c / 3;
  }
});

/* 2) montar a tabela de materiais do destino */
g.materials = [];
g.textures = undefined; g.images = undefined; g.samplers = undefined;
const copier = makeMaterialCopier(donor, g, outBinParts, binLen);

const report = [];
const ordered = [...groups.entries()].sort((a, b) => b[1].tris - a[1].tris);
for (const [srcName, rec] of ordered) {
  const target = ALIAS[srcName] || srcName;
  let mat = copier.copy(target);
  let origin = 'doador';
  if (!mat && FROM_SOURCE[srcName]) {
    const spec = FROM_SOURCE[srcName];
    const find = (suffix) => {
      if (!suffix) return null;
      const hit = fs.readdirSync(texDir).find((f) => f.endsWith(suffix));
      return hit ? path.join(texDir, hit) : null;
    };
    const baseFile = find(spec.baseColor);
    const nrmFile = find(spec.normal);
    if (!baseFile) throw new Error(`${srcName}: textura ${spec.baseColor} não encontrada em ${texDir}`);
    mat = {
      name: target,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: copier.fromFile(baseFile) },
        ...spec.factors,
      },
      ...(nrmFile ? { normalTexture: { index: copier.fromFile(nrmFile) } } : {}),
    };
    origin = 'origem (PNG)';
  }
  if (!mat) {
    /* Nunca inventar em silêncio: um material que não existe no doador e não
       está declarado em FROM_SOURCE é um nome que ninguém previu, e o ramo
       genérico do engine o trataria como chapa branca — exatamente o defeito
       que este script existe para tirar. */
    console.error(`\n  ✗ SEM MAPA: "${srcName}" (alvo "${target}") — nem no doador nem em FROM_SOURCE.`);
    console.error(`    ${rec.prims.length} primitivas, ${Math.round(rec.tris)} triângulos ficariam sem material.`);
    process.exitCode = 1;
    mat = { name: target, doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 0, 1, 1] } };
    origin = 'FALTANDO (magenta)';
  }
  mat.name = target;
  g.materials.push(mat);
  const index = g.materials.length - 1;
  for (const prim of rec.prims) prim.material = index;
  report.push({ srcName, target, origin, prims: rec.prims.length, tris: Math.round(rec.tris) });
}

/* 3) normalizar o prefixo de nó do exportador */
let renamed = 0;
for (const n of nodes) {
  if (n.name && n.name.includes('stitch_result_stitch all')) {
    n.name = n.name.replace(/stitch_result_stitch all/g, 'stitch_result_stitch_all');
    renamed++;
  }
}
for (const m of meshes) {
  if (m.name && m.name.includes('stitch_result_stitch all')) {
    m.name = m.name.replace(/stitch_result_stitch all/g, 'stitch_result_stitch_all');
  }
}

/* 4) extensões declaradas: só as que os materiais copiados de fato usam */
const used = new Set();
const scan = (o) => {
  if (!o || typeof o !== 'object') return;
  if (o.extensions) for (const k of Object.keys(o.extensions)) used.add(k);
  for (const v of Object.values(o)) scan(v);
};
g.materials.forEach(scan);
g.extensionsUsed = [...used];
delete g.extensionsRequired;

g.asset = { version: '2.0', generator: 'ankaa implement-bake/materialize.mjs' };

/* ------------------------------------------------------------------ *
 * Relatório — sempre, mesmo em --dry.
 * ------------------------------------------------------------------ */
console.log(`\nORIGEM  ${srcPath}`);
console.log(`DOADOR  ${donorPath}`);
console.log(`\n  ${'material (origem)'.padEnd(44)} ${'→ destino'.padEnd(36)} ${'prims'.padStart(6)} ${'ktris'.padStart(7)}  de`);
for (const r of report) {
  console.log(`  ${r.srcName.padEnd(44)} → ${r.target.padEnd(34)} ${String(r.prims).padStart(6)} ${(r.tris / 1000).toFixed(1).padStart(7)}  ${r.origin}`);
}
console.log(`\n  ${report.length} materiais · ${report.reduce((a, r) => a + r.prims, 0)} primitivas · ` +
            `${(report.reduce((a, r) => a + r.tris, 0) / 1e6).toFixed(2)} M triângulos`);
console.log(`  imagens copiadas: ${(g.images || []).length} · texturas: ${(g.textures || []).length}`);
console.log(`  nós renomeados (espaço → sublinhado): ${renamed}`);
if (strip.prims) {
  console.log(`  tira → lista: ${strip.prims} primitivas · ${Math.round(strip.before).toLocaleString('pt-BR')} → ` +
              `${Math.round(strip.after).toLocaleString('pt-BR')} triângulos ` +
              `(${Math.round(strip.degenerate).toLocaleString('pt-BR')} degenerados fora) · ` +
              `${strip.shrunk}/${destripped.size} índices em 16 bits`);
}

if (has('--dry')) { console.log('\n  --dry: nada escrito.\n'); process.exit(process.exitCode || 0); }

const bin = Buffer.concat(outBinParts);
const bytes = writeGLB(outPath, g, bin);
console.log(`\n  ESCRITO ${outPath}  ${(bytes / 1048576).toFixed(1)} MB` +
            `  (origem ${(fs.statSync(srcPath).size / 1048576).toFixed(1)} MB)\n`);
