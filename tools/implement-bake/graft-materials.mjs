#!/usr/bin/env node
/* ENXERTO DE MATERIAL — devolve ao sobrechassi os nomes que o export perdeu.
   ===========================================================================
   Irmão de `rename-material.mjs`, e pela mesma razão dele: o engine do Truck
   Studio despacha ACABAMENTO POR NOME DE MATERIAL (`applyTrailerFinish`,
   `splitTrailerHardware`, `TRAILER_STRUCT_METAL_RE`, `BOX_SHELL_RE`, …). Um
   implemento cujas peças chegam com o nome certo herda acabamento, inox, tinta
   e ferragem **sem uma linha de código nova** — é o que a §24 do
   `ARCHITECTURE.md` registra como a razão de `materialize.mjs` existir.

   `materialize.mjs` reconstruiu 17 materiais a partir do NOME DA MALHA
   (`${nó}_${material}_${índice}`, convenção do FBX2glTF). O que ele não podia
   reconstruir é o que o export já tinha fundido antes: no `trailer.glb` a
   ferragem da porta se divide em `metal-pouco-polido`, `suporte-varao-preto`,
   `engate-femea-preto`, `cano-ar-preto` e `registro-corpo-laranja`; no
   sobrechassi TODAS chegam como `metal-pouco-polido`, porque foi assim que o
   nome da malha saiu. O nome não sobreviveu, mas a GEOMETRIA sim — peça por
   peça, com a mesma cota em milímetros.

   Então é ela que serve de assinatura. Cada enxerto aqui casa por
   **material de origem + tamanho da caixa do acessor**, confere a contagem
   contra o que foi MEDIDO na bancada (`checks-sobrechassi-0819.mjs`) e
   **recusa a gravação inteira** se a contagem não bater: um enxerto que pegue
   uma peça a mais é pior que um que não rode, porque ele passa calado.

   POR QUE NO ASSET, E NÃO EM `trailer-bake-fixes.ts`. Aquele arquivo corrige o
   que o bake tem de ERRADO — vértice fora do lugar, peça a mais. Aqui não há
   nada errado com a peça: falta o NOME dela, e o nome é identidade de material,
   não geometria. Além disso o material de destino **não existe** no
   sobrechassi: inventá-lo em código seria escolher uma cor à mão, enquanto o
   doador (`semirreboque_frigorifico_paleteiro.glb`) traz o material real, com
   os fatores que o rip mediu.

   O QUE ELE TOCA: **só o chunk JSON**, mais um `append` no fim do BIN quando um
   material doador traz textura. Nenhum `bufferView` existente muda de offset,
   então a geometria Draco passa intacta — a mesma garantia de
   `rename-material.mjs`.

       node tools/implement-bake/graft-materials.mjs            # aplica
       node tools/implement-bake/graft-materials.mjs --dry      # só relata
       node tools/implement-bake/graft-materials.mjs --only quadro-da-testeira
                                                    # UMA linha (pelo `id`)
*/
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VEH = resolve(HERE, '..', '..', 'public', 'models', 'vehicles');
const DRY = process.argv.includes('--dry');
/** `--only <material>` roda UMA linha da lista. Existe porque a ferramenta não
 *  é idempotente: numa segunda passada as primitivas já enxertadas não têm mais
 *  o material de origem e a contagem reprova a lista inteira. */
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null; })();
/** A chave de `--only`: o `id` da linha quando ela tem um, senão o material.
 *  Ela existe porque DUAS linhas podem enxertar o MESMO material em peças
 *  diferentes (o quadro de baixo do flanco e os retornos dele na testeira), e
 *  `--only <material>` rodaria as duas — inclusive a que já foi aplicada, que
 *  então acha zero origens e reprova a gravação inteira. */
const chaveDe = (e) => e.id || e.material;

const DOADOR = join(VEH, 'semirreboque_frigorifico_paleteiro.glb');
const ALVO = join(VEH, 'sobrechassi_frigorifico_gancheiro.glb');

/* ---------------------------------------------------------------------------
   A LISTA. Cada linha é uma MEDIDA, e a coluna `esperado` é o portão.
   As cotas saíram de `tools/studio-bench/checks-sobrechassi-0819.mjs`, que
   despeja malha a malha (nome, material, triângulos, caixa) nos DOIS
   implementos no app de verdade — daí a comparação ser peça contra peça e não
   nome contra nome.
--------------------------------------------------------------------------- */
const ENXERTOS = [
  {
    material: 'suporte-varao-preto',
    de: 'metal-pouco-polido',
    tamanho: [0.038, 0.044, 0.041],
    esperado: 8,
    porque: 'o colar de plástico preto que prende o varão da porta traseira. '
      + 'No semirreboque são 8 (4 varões × 2 alturas) com a MESMA cota de '
      + '38 × 44 × 41 mm. Aqui são OITO no arquivo e só QUATRO na cena: as '
      + 'outras quatro são da porta lateral de fábrica, que `removeBakedSideDoor()` '
      + 'tira antes de qualquer medida. Pintar as oito é o certo — as que somem '
      + 'não custam nada e as que sobrarem num bake futuro já saem pretas.',
  },
  {
    material: 'engate-femea-preto',
    de: 'metal-pouco-polido',
    tamanho: [0.017, 0.079, 0.057],
    esperado: 3,   // duas na traseira (uma por flanco) + a da porta lateral
    porque: 'a fêmea do engate que segura a porta traseira aberta contra o '
      + 'flanco. No semirreboque a peça é DUPLA — um corpo de 16 × 79 × 38 em '
      + 'metal-pouco-polido por dentro e a capa preta de 17 × 79 × 57 por fora. '
      + 'A cota daqui é a da CAPA, então é a capa que está sem o preto.',
  },
  {
    material: 'cano-ar-preto',
    de: 'metal-pouco-polido',
    tamanho: [0.048, 0.300, 0.048],
    esperado: 2,   // uma por mangueira traseira
    porque: 'o cano que sobe do registro traseiro. No semirreboque a peça '
      + 'equivalente mede 49 × 309 × 49 mm e é `cano-ar-preto`.',
  },
  {
    material: 'registro-corpo-laranja',
    de: 'plastico-preto-polido',
    no: /^registro-Mangueida/i,
    esperado: 2,   // uma por mangueira traseira
    porque: 'o registro da mangueira traseira. O do semirreboque é LARANJA '
      + '(`registro-corpo-laranja`), e é a cor que o dono pediu. Aqui a seleção '
      + 'é por NOME DE NÓ e não por cota: as duas peças são espelhadas e o rip '
      + 'não as deixou idênticas (70 × 120 × 104 contra 96 × 120 × 88).',
  },
  {
    material: 'engate-macho-preto',
    de: 'metal-pouco-polido',
    tamanho: [0.054, 0.149, 0.012],
    esperado: 3,   // duas na porta traseira + a da porta lateral de fábrica
    porque: 'o MACHO do engate, na porta traseira — a contraparte da fêmea do '
      + 'flanco. No semirreboque também são duas malhas (39 × 150 × 10 em metal '
      + 'e a capa preta de 54 × 65 × 12); aqui as duas vieram fundidas numa só, '
      + 'com a cota da união. O material vai para a malha inteira e '
      + '`splitEngateHardware()` devolve a metade metálica em tempo de execução, '
      + 'separando as duas CASCAS CONEXAS que o `stitch_all` juntou.',
  },
  {
    id: 'quadro-do-flanco',
    material: 'metal-galvanizado-mantido',
    de: 'Cor_padrao_branco(metalBranco)',
    tamanho: [0.026, 0.140, 8.380],
    esperado: 2,          // uma por flanco (a mesma primitiva, espelhada)
    porque: 'a BANDA DE BAIXO DO FLANCO. É frame, não chapa, e veio na família '
      + 'branca — `fixLowFrameSkin()` já a tirava de lá em tempo de execução, '
      + 'mas só tinha `metal-estrutura-principal-padrao` para pôr no lugar. O '
      + 'perfil equivalente do semirreboque é `metal-galvanizado-mantido`, e é '
      + 'ele que o dono pediu ("o frame metálico da lateral inferior deve ser '
      + 'completamente substituído pelo do semirreboque").',
  },
  {
    id: 'quadro-da-testeira',
    material: 'metal-galvanizado-mantido',
    de: 'Cor_padrao_branco(metalBranco)',
    tamanho: [0.026, 0.140, 0.300],
    esperado: 2,          // um retorno por canto dianteiro
    porque: 'OS RETORNOS DO QUADRO DE BAIXO NA TESTEIRA — a mesma seção de '
      + '26 × 140 mm da banda do flanco, com 300 mm de comprimento em vez de '
      + '8 380, nos dois cantos dianteiros (|x| 1,09 · z 4,244). A linha acima '
      + 'os perdeu porque casa por COTA e a cota deles é outra.\n\n'
      + '⚠️ E o preço de os ter perdido não foi cosmético: eles eram as ÚNICAS '
      + 'malhas brancas ABAIXO da linha da chapa do flanco (que começa em '
      + 'piso +82,5 mm), então `body.min.y` — o `floorY` de TODO o engine — '
      + 'descia 82,5 mm com eles. Medido: com os dois brancos, o trilho de '
      + 'piso lê `piso 0…+210` contra os `−82,5…+127,5` do semirreboque, a '
      + 'fileira de fita 3M lê `+30,6` contra `−51,9`, as travessas do piso '
      + 'leem `+82,8`, e a fita vertical de canto — ancorada no piso — sobrava '
      + 'por baixo do quadro, pendurada sobre o chassi do caminhão. É a foto '
      + 'de 2026-08-20 10:34. Uma linha de enxerto que faltava movia a régua '
      + 'do implemento inteiro.',
  },
  {
    id: 'suporte-da-escada',
    material: 'metal-pouco-polido',
    de: 'Cor_padrao_branco(metalBranco)',
    tamanho: [0.170, 0.0508, 0.055],
    esperado: 3,          // um por altura de fixação da escada da testeira
    porque: 'OS SUPORTES EM U DA ESCADA DA TESTEIRA — três, em piso +29, '
      + '+1 563 e +2 623 mm, no plano da escada (z 4,279, x 1,153). *"essa '
      + 'parte que segura a escada na frente está branca, deveria ser metálica '
      + 'igual à própria escada"* (2026-08-20). Eles vieram na família BRANCA, '
      + 'então saem pintados de lataria — e a escada que eles seguram (dois '
      + 'montantes de 17,9 × 2 645 × 30,9 e nove degraus de 145 × 17,9 × 30,9) '
      + 'é `metal-pouco-polido`. É o mesmo conjunto e é o mesmo material.\n\n'
      + 'E tirá-los do branco conserta duas coisas de uma vez: eles também '
      + 'entravam na decomposição em cascas de `TrailerBody` e no recorte da '
      + 'chapa de livery, onde nunca foram lataria.',
  },
];

/* Remapeamentos de material INTEIRO — todas as primitivas de um material vão
   para outro que JÁ existe no alvo. */
const REMAPEAR = [
  {
    de: 'metal-claro',
    para: 'inox-ferragem',
    porque: 'o manípulo da porta traseira (3 peças por lado: 247 × 124 × 42, '
      + '271 × 110 × 37 e 134 × 58 × 35 mm). No semirreboque as três são '
      + '`inox-ferragem`; aqui vieram como `metal-claro` — que no OUTRO bake é '
      + 'a folha da caixa de cozinha, e por isso `BOX_SHELL_RE` em models.ts as '
      + 'pinta de #3b3b3d fosco. É a "textura errada do batente" do relato: '
      + 'ferragem de inox saindo com a tinta de uma caixa de ferramentas.',
  },
];

/* ------------------------------------------------------------------ glb */
function lerGLB(caminho) {
  const buf = readFileSync(caminho);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(caminho + ': não é glb');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), tipo = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (tipo === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (tipo === 0x004e4942) bin = Buffer.from(chunk);
    off += 8 + len;
  }
  if (!json || !bin) throw new Error(caminho + ': chunk faltando');
  return { json, bin };
}

function gravarGLB(caminho, json, bin) {
  const jb = Buffer.from(JSON.stringify(json), 'utf8');
  const jpad = (4 - (jb.length % 4)) % 4;
  const bpad = (4 - (bin.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jb, Buffer.alloc(jpad, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(bpad, 0)]);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonChunk.length, 12); out.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(out, 20);
  const o = 20 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, o); out.writeUInt32LE(0x004e4942, o + 4);
  binChunk.copy(out, o + 8);
  writeFileSync(caminho, out);
  return total;
}

/* ------------------------------------------------------- índice de nós */
/** Para cada malha, os nomes dos nós que a instanciam — é o que faz o relatório
 *  dizer QUAL peça mudou, e não só "primitiva 3 da malha 71". */
function nosPorMalha(json) {
  const mapa = new Map();
  (json.nodes || []).forEach((n) => {
    if (typeof n.mesh !== 'number') return;
    const l = mapa.get(n.mesh) || [];
    l.push(n.name || '(sem nome)');
    mapa.set(n.mesh, l);
  });
  return mapa;
}

/* ------------------------------------------------------- espaço da RAIZ
   ⚠️ AS COTAS DO ACESSOR NÃO SÃO AS DA BANCADA, e a diferença é de duas
   ordens: este rip está em CENTÍMETROS (a raiz `*.fbx` tem `scale 0.01`) e o
   nó `stitch_result_stitch_all` carrega um giro de 180° em torno de (1,0,1)/√2,
   que TROCA X E Z. Uma mangueira de 33,2 × 83,0 × 4,6 no acessor é 4,6 × 83,0 ×
   33,2 cm na raiz — comparar cota de acessor com cota de bancada casaria zero
   peças, que foi exatamente o que a primeira execução fez.

   Então a assinatura é calculada onde a bancada mediu: os 8 cantos da caixa do
   acessor, levados pela cadeia de nós até a raiz. As rotações deste arquivo são
   múltiplos de 90° em torno dos eixos, então a caixa transformada é EXATA e não
   a caixa-de-caixa-girada que o resto do engine evita. */
function mult(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
function aplicar(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
/** Matriz de mundo de cada nó, uma vez por arquivo. */
function matrizesDeNo(json) {
  const pai = new Map();
  (json.nodes || []).forEach((n, i) => {
    for (const c of (n.children || [])) pai.set(c, i);
  });
  const cache = new Map();
  const de = (i) => {
    if (cache.has(i)) return cache.get(i);
    const local = trs(json.nodes[i]);
    const p = pai.get(i);
    const m = p === undefined ? local : mult(de(p), local);
    cache.set(i, m);
    return m;
  };
  (json.nodes || []).forEach((_, i) => de(i));
  return cache;
}

/** Tamanho da caixa de uma primitiva NO ESPAÇO DA RAIZ, em metros. O min/max do
 *  acessor de POSITION é obrigatório no glTF — inclusive sob Draco —, e é por
 *  isso que esta ferramenta não precisa de um decodificador. */
function tamanhoDe(json, prim, m) {
  const i = prim.attributes?.POSITION;
  if (i === undefined) return null;
  const a = json.accessors[i];
  if (!a?.min || !a?.max) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k++) {
    const p = aplicar(m, [
      (k & 1) ? a.max[0] : a.min[0],
      (k & 2) ? a.max[1] : a.min[1],
      (k & 4) ? a.max[2] : a.min[2],
    ]);
    for (let d = 0; d < 3; d++) {
      if (p[d] < lo[d]) lo[d] = p[d];
      if (p[d] > hi[d]) hi[d] = p[d];
    }
  }
  return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
}

const TOL = 0.0015;
/* ⚠️ A COMPARAÇÃO É COM AS COTAS ORDENADAS, e não eixo a eixo. As instâncias
   deste rip não compartilham orientação — o mesmo colar de varão aparece como
   41 × 44 × 38 numa instância e 38 × 44 × 41 noutra, porque cada nó traz o
   próprio giro de 90°. Comparar eixo a eixo casaria metade das peças e o portão
   de contagem reprovaria a lista inteira. Ordenar torna a assinatura invariante
   à orientação, que é o que "esta peça tem 38 × 41 × 44 mm" quer dizer. */
const ord3 = (t) => [...t].sort((a, b) => a - b);
const casa = (t, alvo) => {
  if (!t) return false;
  const a = ord3(t), b = ord3(alvo);
  return a.every((v, k) => Math.abs(v - b[k]) <= TOL);
};

/* --------------------------------------------------------------- copiar */
/**
 * Traz um material do doador para o alvo, com textura e tudo.
 *
 * O `append` no fim do BIN é o que mantém a promessa do cabeçalho: nenhum
 * `bufferView` existente muda de offset, então o Draco de todas as 292 malhas
 * continua exatamente onde estava. O `buffer.byteLength` é reescrito, que é a
 * única coisa que o leitor confere.
 */
function copiarMaterial(alvo, doador, nome, bins) {
  const src = (doador.json.materials || []).find((m) => m.name === nome);
  if (!src) throw new Error('material ' + nome + ' não existe no doador');
  const mat = JSON.parse(JSON.stringify(src));

  /* O alvo já tem UM sampler, idêntico ao do doador (magFilter 9729,
     minFilter 9987, wrap 10497/10497 — os dois saíram do mesmo pipeline).
     Reusá-lo evita uma entrada duplicada por textura copiada. */
  const sampler0 = (alvo.json.samplers || []).length ? 0 : undefined;
  /* A forma da textura no ALVO manda: ele declara `EXT_texture_webp` e põe a
     imagem em `extensions`, enquanto o doador usa `source` direto com
     `mimeType: image/webp`. Escrever a forma do doador dentro do alvo
     funcionaria no three, mas deixaria o arquivo com duas convenções. */
  const usaExt = !!(alvo.json.extensionsUsed || []).includes('EXT_texture_webp');

  const copiarTextura = (ref) => {
    if (!ref || typeof ref.index !== 'number') return ref;
    const tex = doador.json.textures[ref.index];
    const isrc = tex.extensions?.EXT_texture_webp?.source ?? tex.source;
    const img = doador.json.images[isrc];
    const bv = doador.json.bufferViews[img.bufferView];
    const bytes = doador.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const pad = (4 - (bins.tamanho % 4)) % 4;
    if (pad) { bins.pedacos.push(Buffer.alloc(pad, 0)); bins.tamanho += pad; }
    const off = bins.tamanho;
    bins.pedacos.push(Buffer.from(bytes));
    bins.tamanho += bytes.length;
    alvo.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length });
    const iBV = alvo.json.bufferViews.length - 1;
    alvo.json.images.push({ mimeType: img.mimeType || 'image/webp', bufferView: iBV });
    const iImg = alvo.json.images.length - 1;
    const nova = usaExt
      ? { extensions: { EXT_texture_webp: { source: iImg } }, ...(sampler0 !== undefined ? { sampler: sampler0 } : {}) }
      : { source: iImg, ...(sampler0 !== undefined ? { sampler: sampler0 } : {}) };
    alvo.json.textures.push(nova);
    return { ...ref, index: alvo.json.textures.length - 1 };
  };

  const p = mat.pbrMetallicRoughness;
  if (p) {
    if (p.baseColorTexture) p.baseColorTexture = copiarTextura(p.baseColorTexture);
    if (p.metallicRoughnessTexture) p.metallicRoughnessTexture = copiarTextura(p.metallicRoughnessTexture);
  }
  if (mat.normalTexture) mat.normalTexture = copiarTextura(mat.normalTexture);
  if (mat.occlusionTexture) mat.occlusionTexture = copiarTextura(mat.occlusionTexture);
  if (mat.emissiveTexture) mat.emissiveTexture = copiarTextura(mat.emissiveTexture);

  alvo.json.materials.push(mat);
  return alvo.json.materials.length - 1;
}

/* ------------------------------------------------------------------ main */
const doador = lerGLB(DOADOR);
const alvo = lerGLB(ALVO);
const nomes = alvo.json.materials.map((m) => m.name);
const idxDe = (n) => nomes.indexOf(n);
const porMalha = nosPorMalha(alvo.json);
const matNo = matrizesDeNo(alvo.json);
/** A primeira instância de cada malha — é dela que sai a cadeia de nós para a
 *  assinatura. Malhas espelhadas dão a MESMA cota, então qualquer instância
 *  serve. */
const primeiraInst = new Map();
(alvo.json.nodes || []).forEach((n, i) => {
  if (typeof n.mesh === 'number' && !primeiraInst.has(n.mesh)) primeiraInst.set(n.mesh, i);
});
const bins = { pedacos: [alvo.bin], tamanho: alvo.bin.length };

let falhou = false;
const relato = [];

/* ---- 1. os enxertos, por assinatura ---- */
for (const e of ENXERTOS) {
  if (ONLY && chaveDe(e) !== ONLY) continue;
  const origem = idxDe(e.de);
  if (origem < 0) {
    console.error('!!', e.material, '— material de origem', e.de, 'não existe no alvo');
    falhou = true; continue;
  }
  const achados = [];
  alvo.json.meshes.forEach((m, im) => {
    m.primitives.forEach((pr, ip) => {
      if (pr.material !== origem) return;
      if (e.no) {
        const ns = porMalha.get(im) || [];
        if (!ns.some((n) => e.no.test(n))) return;
      }
      if (e.tamanho) {
        const no = primeiraInst.get(im);
        if (no === undefined) return;
        const t = tamanhoDe(alvo.json, pr, matNo.get(no));
        if (!casa(t, e.tamanho)) return;
      }
      achados.push({ im, ip, pr, nos: porMalha.get(im) || [] });
    });
  });
  const inst = achados.reduce((a, c) => a + c.nos.length, 0);
  /* O PORTÃO É A CONTAGEM DE INSTÂNCIAS, não de primitivas: o `dedup` da
     receita §6 funde peças idênticas numa malha só, então "quantas primitivas"
     é um detalhe do compressor e "quantas peças na cena" é o que foi medido. */
  const ok = inst === e.esperado;
  relato.push(`${ok ? 'ok  ' : 'FALHA'} ${chaveDe(e).padEnd(28)} `
    + `${inst}/${e.esperado} instância(s), ${achados.length} primitiva(s)`
    + (achados.length ? '  <- ' + [...new Set(achados.flatMap((a) => a.nos))].slice(0, 4).join(', ') : ''));
  if (!ok) { falhou = true; continue; }
  if (DRY) continue;
  let destino = idxDe(e.material);
  if (destino < 0) {
    destino = copiarMaterial(alvo, doador, e.material, bins);
    nomes.push(e.material);
  }
  for (const a of achados) a.pr.material = destino;
}

/* ---- 2. os remapeamentos, material inteiro ---- */
for (const r of REMAPEAR) {
  if (ONLY) continue;
  const de = idxDe(r.de), para = idxDe(r.para);
  if (de < 0 || para < 0) {
    console.error('!!', r.de, '->', r.para, '— um dos dois não existe no alvo');
    falhou = true; continue;
  }
  let n = 0;
  const nos = new Set();
  alvo.json.meshes.forEach((m, im) => {
    m.primitives.forEach((pr) => {
      if (pr.material !== de) return;
      n++;
      for (const x of (porMalha.get(im) || [])) nos.add(x);
      if (!DRY) pr.material = para;
    });
  });
  relato.push(`ok   ${(r.de + ' -> ' + r.para).padEnd(28)} ${n} primitiva(s)`
    + `  <- ${[...nos].slice(0, 3).join(', ')}`);
}

console.log('\n' + relato.join('\n') + '\n');
for (const e of ENXERTOS) { if (ONLY && chaveDe(e) !== ONLY) continue; console.log('·', chaveDe(e), '—', e.porque); }
for (const r of REMAPEAR) { if (ONLY) continue; console.log('·', r.de, '->', r.para, '—', r.porque); }

if (falhou) {
  console.error('\nNADA FOI GRAVADO. Uma contagem não bateu — e uma contagem que'
    + ' não bate significa que a assinatura pegou peça a mais (ou a menos) do que'
    + ' foi medido. Remeça na bancada antes de afrouxar a tolerância.');
  process.exit(1);
}
if (DRY) { console.log('\n(--dry: nada gravado)'); process.exit(0); }

const bak = ALVO + '.bak-graft-2026-08-19';
if (!existsSync(bak)) copyFileSync(ALVO, bak);
alvo.bin = Buffer.concat(bins.pedacos);
alvo.json.buffers[0].byteLength = alvo.bin.length;
const total = gravarGLB(ALVO, alvo.json, alvo.bin);
console.log('\ngravado', ALVO, '—', (total / 1048576).toFixed(2), 'MB',
  '· backup em', bak.split('/').pop());
