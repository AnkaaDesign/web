#!/usr/bin/env node
/* AS VARIANTES DO IMPLEMENTO — cinco produtos a partir de dois bakes.
   ===========================================================================
   *"crie agora as variações que possuímos de implementos: refrigerado
   gancheiro semirreboque, refrigerado gancheiro sobrechassi, refrigerado
   paleteiro semirreboque, refrigerado paleteiro sobrechassi, isotérmico
   sobrechassi (…) o que muda neles basicamente é o frame metálico superior (…)
   e o isotérmico em vez de chapas é formado por uma fibra contínua"*
   — Kennedy, 2026-09-29.

   Existem DOIS bakes do mesmo autor (a plaqueta Ibiporã está nos dois):

       trailer_v2.glb                           semirreboque frigorífico PALETEIRO
       sobrechassi_frigorifico_gancheiro.glb    sobrechassi  frigorífico GANCHEIRO

   e este script produz os outros quatro trocando peças ENTRE eles:

       semirreboque_frigorifico_gancheiro_v1.glb   semirreboque + perfil do gancheiro
       sobrechassi_frigorifico_paleteiro_v1.glb    sobrechassi  + perfil do paleteiro
       sobrechassi_isotermico_paleteiro_v1.glb     sobrechassi  + perfil do paleteiro
                                                   + pele de FIBRA contínua
       sobrechassi_isotermico_gancheiro_v1.glb     sobrechassi  + pele de FIBRA contínua

   O QUE DIFERE ENTRE OS DOIS, MEDIDO — e é UMA peça
   ---------------------------------------------------------------------------
   O censo malha a malha dos dois bakes (nome, material, triângulos, caixa) e o
   corte de seção a meio baú dizem a mesma coisa: no canto de cima do flanco os
   dois implementos têm as MESMAS peças na MESMA cota em relação ao teto — a
   cantoneira 50 × 60 em barras de 3 m (−65…−5 mm do teto nos dois), a travessa
   dianteira de 2 485 × 70 × 50, o portal traseiro de 2 610 × 12 × 102 — e
   diferem numa só, o PERFIL EXTERNO SUPERIOR:

       paleteiro  banda galvanizada de 210 mm, três nervuras, peça única
                  `metal-galvanizado-mantido`, 26 × 210 × 14 580 mm
                  (teto −207,5 … +2,6 mm)
       gancheiro  perfil em Z de 103 mm com aba acima do teto, em barras de 3 m
                  com os rebites MODELADOS (rebaixos de 2 mm)
                  `metal-estrutura-principal-padrao`, 65 × 103 × 3 000 mm
                  (teto −78 … +25 mm)

   A peça existe nas duas LATERAIS e na TESTEIRA (a banda de 2 490 mm no
   paleteiro, o Z de 2 535 mm no gancheiro). É ela que se troca.

   E TRÊS COISAS EM VOLTA DELA TROCAM JUNTO, porque são função do perfil:

   1. A FITA 3M HORIZONTAL DE TOPO (quatro, 300 mm, nas pontas do flanco). Mora
      NA FACE do perfil: chata em x 1,3035 sobre a banda, inclinada sobre a
      rampa do Z. A cota é a mesma nos dois (teto −78 … −28 mm), a forma não.
   2. A LARGURA DO TETO. A chapa do teto do paleteiro corre até |x| 1,295 (a
      banda a cobre por cima); a do gancheiro para em 1,241, DENTRO da aba do Z.
      E a borda da frente idem: paleteiro 42 mm à frente da pele, gancheiro
      rente a ela.
   3. OS FRISOS DO ALTO DA CHAPA. A banda de 210 mm desce 130 mm mais que o Z.
      No paleteiro a última fileira de friso fica 9 mm ABAIXO da banda e a chapa
      acima dela é lisa (o arremate de ~60 mm); no gancheiro a última fileira
      fica 35 mm abaixo do Z. Trocar só o perfil deixaria, no semirreboque
      gancheiro, um VÃO de 79 mm entre o topo da chapa (4,012) e o pé do Z
      (4,091) — dá para ver o forro por ele — e, no sobrechassi paleteiro, os
      dois frisos de cima ATRAVESSANDO a banda (a crista está 3,8 mm fora da face
      interna dela). A conta, dos dois lados, dá 2 fileiras (1,96 × o passo de
      53 mm): o semirreboque GANHA duas, o sobrechassi PERDE duas. É a mesma
      operação que `TrailerBody` faz quando o baú muda de altura — empilhar a
      unidade do friso —, feita aqui uma vez, no asset.

   O que NÃO troca: portas traseiras, testeira, travas, fita vertical de canto
   (quem a ancora é `fixCornerTape()`, na régua do semirreboque, nos dois),
   trilho de piso, rodagem, sub-chassi. Nada disso é função do arranjo de carga.

   A GANCHEIRA (os trilhos de gancho sob o teto: 139 peças, ~500 mil triângulos,
   29 % do sobrechassi) SAI do paleteiro e do isotérmico — paleteiro é
   justamente o baú SEM gancho. Ela NÃO é acrescentada ao semirreboque
   gancheiro: é peça de DENTRO, o bake `_v2` do semirreboque tirou o kit interno
   de propósito, e de fora o gancheiro se lê pelo perfil.

   O ISOTÉRMICO
   ---------------------------------------------------------------------------
   Na API ele é `INSULATED` — "Isotérmico (Isoplastic)": painel de FIBRA
   contínuo, não chapa frisada. É uma CARROCERIA, com os dois arranjos e com
   Thermo King (*"deve ter isotérmico paleteiro e gancheiro, e o isotérmico deve
   ter thermo king também"* — a 1ª versão fazia um só, sem máquina de frio, e
   saiu). As folhas frisadas de 1 m dos dois flancos saem e entra UM painel liso
   por flanco, de ponta a ponta, no PLANO LISO da chapa que ele substitui
   (as duas faces da parte plana — é contra ela que os quadros foram
   modelados; na crista, a 1ª versão engolia a perna do Z, a cantoneira e a
   banda: "a chapa está sangrando sobre os frames"). Todo o resto é o do frigorífico do mesmo
   arranjo. No manifesto: `skin: "fibra"` (sem emenda nem rebite inventados em
   `buildLiveryPanels()`), `railSkirt` e `railRelief` (a saia e o relevo da
   chapa que saiu — a régua do trilho de piso, que sem eles descia e ia para
   dentro do painel; a receita imprime os dois valores).

   COMO O SCRIPT TRABALHA
   ---------------------------------------------------------------------------
   Tudo é medido nos PRÓPRIOS arquivos, nunca escrito à mão: a RÉGUA de cada
   bake (`regua()`) é a cota do teto, o centro e as pontas da pele, as fileiras
   de friso. Uma peça transplantada é levada do referencial do doador ao do alvo
   por ÂNCORA:

       y   teto do doador   → teto do alvo            (as peças moram no teto)
       x   centro do doador → centro do alvo          (o sobrechassi está 4 mm
                                                        fora de centro)
       z   'traseira'  ponta traseira da pele → a do alvo
           'dianteira' ponta dianteira da pele → a do alvo
           'vao'       a pele inteira → a pele inteira (a banda é UMA extrusão
                        de 14,58 m: esticar uma extrusão no próprio eixo é exato)

   O Z do gancheiro NÃO estica: ele tem rebite a cada ~97 mm, e esticá-lo 1,74×
   daria rebite a cada 170. Ele é LADRILHADO com as barras de fábrica — e a conta
   fecha sem corte: 2 580 + 4 × 3 000 = 14 580 mm, exatamente a pele do
   semirreboque. É também a paginação que o próprio autor usou nas cantoneiras
   50 × 60 do semirreboque (2 580 na traseira à direita, na dianteira à
   esquerda), então as emendas do Z caem EM CIMA das emendas da cantoneira.
   O lado esquerdo do sobrechassi é o direito GIRADO 180° (a matriz dos nós tem
   −0,01 em x e em z), então a barra de 2 580 do lado direito vira a do
   esquerdo por rotação — sem espelho, sem inverter enrolamento.

   Cada seleção tem PORTÃO DE CONTAGEM (a mesma doutrina de
   `graft-materials.mjs`): se o bake mudar e uma seleção pegar uma peça a mais ou
   a menos, a receita inteira é recusada antes de gravar. Uma troca que pega a
   peça errada passa calada; uma que não roda, não.

   SAÍDA E COMPRESSÃO
   ---------------------------------------------------------------------------
   O script grava um GLB CRU (sem Draco) e roda a receita da §6 do
   `ARCHITECTURE.md` por cima — `dedup --materials false`, `prune
   --keep-attributes false --keep-leaves true` e `draco` com
   16/12/14 edgebreaker. As texturas já são WebP; o passo `webp` não entra.

   `_v1` no nome, desde o primeiro: `/studio-assets/v1/` sai com `immutable` e
   `--delete` é proibido lá (ver `api/docs/DEPLOYMENT-studio-assets.md`). Um
   re-bake destes arquivos ganha `_v2`, nunca sobrescreve.

   USO
       node tools/implement-bake/variants.mjs                 # as quatro
       node tools/implement-bake/variants.mjs --only isotermico-gancheiro
       node tools/implement-bake/variants.mjs --dry           # só mede e relata
       node tools/implement-bake/variants.mjs --raw           # não comprime

   Precisa de `@gltf-transform/core`, `/extensions` e `draco3dgltf`. O web não
   os tem como dependência (as outras bancadas usam a CLI por `npx`); o script
   os acha no cache do `npx` — rode `npx @gltf-transform/cli --version` uma vez
   se ele disser que não achou. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');
const VEH = path.join(WEB, 'public', 'models', 'vehicles');
const ARGV = process.argv.slice(2);
const DRY = ARGV.includes('--dry');
const RAW = ARGV.includes('--raw');
const ONLY = (() => { const i = ARGV.indexOf('--only'); return i >= 0 ? ARGV[i + 1] : null; })();

/* ---------------------------------------------------------------------------
   gltf-transform — do node_modules se houver, senão do cache do npx
--------------------------------------------------------------------------- */
function acharModulos() {
  const cands = [path.join(WEB, 'node_modules')];
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) {
    for (const d of fs.readdirSync(npx)) cands.push(path.join(npx, d, 'node_modules'));
  }
  for (const nm of cands) {
    const ok = ['@gltf-transform/core', '@gltf-transform/extensions', 'draco3dgltf']
      .every((p) => fs.existsSync(path.join(nm, p, 'package.json')));
    if (ok) return nm;
  }
  throw new Error('@gltf-transform/core + /extensions + draco3dgltf não encontrados.'
    + ' Rode `npx @gltf-transform/cli --version` uma vez para popular o cache do npx.');
}
const NM = acharModulos();
const req = createRequire(path.join(NM, 'x.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const draco3d = req('draco3dgltf');
const CLI = path.join(NM, '@gltf-transform', 'cli', 'bin', 'cli.js');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

/* ---------------------------------------------------------------------------
   Álgebra mínima — matrizes 4×4 em COLUNA, como o glTF
--------------------------------------------------------------------------- */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
    o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  }
  return o;
}
const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const S = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
/** 180° em torno do eixo vertical que passa por x = cx, z = 0. */
const giroY180 = (cx) => mul(T(cx, 0, 0), mul(S(-1, 1, -1), T(-cx, 0, 0)));
const aplica = (M, p) => [0, 1, 2].map((r) => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]);
const det3 = (M) => M[0] * (M[5] * M[10] - M[9] * M[6])
  - M[4] * (M[1] * M[10] - M[9] * M[2]) + M[8] * (M[1] * M[6] - M[5] * M[2]);
/** Inversa-transposta da parte 3×3 — a matriz das NORMAIS. */
function normalDe(M) {
  const a = M[0], b = M[4], c = M[8], d = M[1], e = M[5], f = M[9], g = M[2], h = M[6], i = M[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), K = a * e - b * d;
  const det = a * A + b * B + c * C;
  /* (M⁻¹)ᵀ = cof / det, e o cofator já é a transposta da adjunta. */
  return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, H / det, K / det];
}
const aplicaN = (N, n) => {
  const o = [N[0] * n[0] + N[1] * n[1] + N[2] * n[2], N[3] * n[0] + N[4] * n[1] + N[5] * n[2],
    N[6] * n[0] + N[7] * n[1] + N[8] * n[2]];
  const l = Math.hypot(o[0], o[1], o[2]) || 1;
  return [o[0] / l, o[1] / l, o[2] / l];
};

/* ---------------------------------------------------------------------------
   O censo — cada (nó, primitiva) com a caixa em MUNDO do arquivo
--------------------------------------------------------------------------- */
function censo(doc) {
  const itens = [];
  const walk = (node, P) => {
    const M = mul(P, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          const w = aplica(M, pos.getElement(i, v));
          for (let r = 0; r < 3; r++) { if (w[r] < mn[r]) mn[r] = w[r]; if (w[r] > mx[r]) mx[r] = w[r]; }
        }
        const idx = prim.getIndices();
        itens.push({
          node, mesh, prim, M, min: mn, max: mx,
          mat: prim.getMaterial()?.getName() ?? '',
          nome: node.getName(),
          tris: (idx ? idx.getCount() : pos.getCount()) / 3,
        });
      }
    }
    for (const c of node.listChildren()) walk(c, M);
  };
  for (const s of doc.getRoot().listScenes()) for (const n of s.listChildren()) walk(n, I4());
  return itens;
}
const tam = (it, r) => it.max[r] - it.min[r];

/* ---------------------------------------------------------------------------
   A RÉGUA de um bake — medida nele, nunca escrita
--------------------------------------------------------------------------- */
const BRANCO_RE = /^Cor_padrao_branco\(metalBranco\)$/;
const TETO_RE = /^teto-externo/i;
const ROW_GAP = 0.02;        // o mesmo de `trailer-geometry.ts`
const PASSO = 0.053;         // NOMINAL_PITCH de lá

/** Fileiras de friso de uma primitiva, em Y de MUNDO — a mesma leitura de
 *  `findRows()` (`trailer-geometry.ts`): o y antes de cada salto > 20 mm, e só a
 *  corrente cujo vão bate com o passo (±10 %). */
function fileiras(it) {
  const pos = it.prim.getAttribute('POSITION');
  const ys = new Set(); const v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) ys.add(Math.round(aplica(it.M, pos.getElement(i, v))[1] * 1e4) / 1e4);
  const s = [...ys].sort((a, b) => a - b);
  const marks = [];
  for (let i = 0; i < s.length - 1; i++) if (s[i + 1] - s[i] > ROW_GAP) marks.push(s[i]);
  const keep = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const d = marks[i + 1] - marks[i];
    if (Math.abs(d - PASSO) < PASSO * 0.10) { if (!keep.length) keep.push(marks[i]); keep.push(marks[i + 1]); }
  }
  return { rows: keep, topo: s[s.length - 1], base: s[0] };
}

function regua(itens, rotulo) {
  const teto = itens.filter((it) => TETO_RE.test(it.nome) && BRANCO_RE.test(it.mat));
  if (teto.length !== 1) throw new Error(`[${rotulo}] chapa do teto: ${teto.length} (esperado 1)`);
  const roofY = teto[0].max[1];
  /* A PELE DO FLANCO: branca, fina, alta e FRISADA. É a chapa corrida no
     semirreboque e as folhas de 1 m no sobrechassi; a folha da porta de
     fábrica fica de fora pelo topo (ela para 180 mm abaixo da parede). */
  const finas = itens.filter((it) => BRANCO_RE.test(it.mat) && tam(it, 0) <= 0.012
    && tam(it, 1) > 1.5 && Math.min(Math.abs(it.min[0]), Math.abs(it.max[0])) > 1.2);
  /* Só o PLANO MAIS EXTERNO de cada lado — o forro interno do semirreboque
     (|x| 1,238, topo 4,046) também é branco, fino e alto, e o topo dele
     passaria pelo topo da pele. Mesma regra de `SKIN_PLANE_TOL` no engine. */
  const foraD = Math.max(...finas.map((it) => it.max[0])), foraE = Math.min(...finas.map((it) => it.min[0]));
  const pele = finas.filter((it) => (it.min[0] > 0 ? Math.abs(it.max[0] - foraD) : Math.abs(it.min[0] - foraE)) < 0.004);
  const topoPele = Math.max(...pele.map((it) => it.max[1]));
  const paredes = pele.filter((it) => it.max[1] > topoPele - 0.005);
  if (!paredes.length) throw new Error(`[${rotulo}] pele do flanco não encontrada`);
  const dir = paredes.filter((it) => it.min[0] > 0), esq = paredes.filter((it) => it.max[0] < 0);
  const xD = Math.max(...dir.map((it) => it.max[0])), xE = Math.min(...esq.map((it) => it.min[0]));
  const zMin = Math.min(...paredes.map((it) => it.min[2])), zMax = Math.max(...paredes.map((it) => it.max[2]));
  const f = fileiras(paredes[0]);
  const passo = f.rows.length > 1 ? (f.rows[f.rows.length - 1] - f.rows[0]) / (f.rows.length - 1) : PASSO;
  return {
    rotulo, roofY, cx: (xD + xE) / 2, meia: (xD - xE) / 2, zMin, zMax,
    topoPele, basePele: Math.min(...paredes.map((it) => it.min[1])),
    ultimaFileira: f.rows[f.rows.length - 1], primeiraFileira: f.rows[0], passo,
    tetoMeia: (tam(teto[0], 0)) / 2, tetoFrente: teto[0].max[2],
    paredes, teto: teto[0],
  };
}

/* ---------------------------------------------------------------------------
   SELEÇÕES — cada uma com o seu PORTÃO de contagem
--------------------------------------------------------------------------- */
function portao(lista, esperado, oque) {
  if (lista.length !== esperado) {
    const amostra = lista.slice(0, 8).map((it) => `${it.nome} ${it.mat} y ${it.min[1].toFixed(3)}…${it.max[1].toFixed(3)}`);
    throw new Error(`${oque}: ${lista.length} peças, esperado ${esperado}.\n  ${amostra.join('\n  ')}`);
  }
  return lista;
}

/** A banda do PALETEIRO: galvanizada, no alto, corrida (duas laterais + testeira). */
const perfilPaleteiro = (its, R) => portao(its.filter((it) => /^metal-galvanizado-mantido$/.test(it.mat)
  && it.min[1] >= R.roofY - 0.25 && (tam(it, 2) > 2 || tam(it, 0) > 2)), 3, `[${R.rotulo}] perfil paleteiro`);

/** O Z do GANCHEIRO: estrutural, corrido, com a ABA acima do teto. A aba é o
 *  que o distingue da cantoneira 50 × 60 (que para 5 mm abaixo do teto) e do
 *  portal traseiro (+12 mm). Seis barras + a testeira. */
const perfilGancheiro = (its, R) => portao(its.filter((it) => /^metal-estrutura-principal-padrao$/.test(it.mat)
  && it.max[1] >= R.roofY + 0.020 && (tam(it, 2) > 2 || tam(it, 0) > 2)), 7, `[${R.rotulo}] perfil gancheiro`);

/** A fita 3M HORIZONTAL do alto do flanco — a que mora na face do perfil. */
const fitasDeTopo = (its, R) => portao(its.filter((it) => /faixa.?3m/i.test(it.mat)
  && Math.abs((it.min[0] + it.max[0]) / 2 - R.cx) > 1.29
  && it.min[1] > R.roofY - 0.085 && it.max[1] < R.roofY - 0.02
  && tam(it, 2) > 0.25 && tam(it, 1) < 0.06), 4, `[${R.rotulo}] fitas de topo`);

/** A GANCHEIRA: tubo, gancho e carrinho sob o teto (y entre teto −260 e
 *  teto −90 mm). O montante vertical de 2 380 mm do canto dianteiro é do mesmo
 *  material e fica de fora pelo pé. */
const gancheira = (its, R) => portao(its.filter((it) => /^metal-galvanizado-polido$/.test(it.mat)
  && it.min[1] >= R.roofY - 0.26 && it.max[1] <= R.roofY - 0.09), 139, `[${R.rotulo}] gancheira`);

/* ---------------------------------------------------------------------------
   OPERAÇÕES
--------------------------------------------------------------------------- */

/** Tira UMA primitiva do nó dela. Malha compartilhada é clonada antes, para
 *  não arrancar a peça das instâncias que ficam. */
function remover(doc, it) {
  const users = it.mesh.listParents().filter((p) => p.propertyType === 'Node');
  if (it.mesh.listPrimitives().length === 1) { it.node.setMesh(null); return; }
  let mesh = it.mesh;
  if (users.length > 1) {
    const i = it.mesh.listPrimitives().indexOf(it.prim);
    mesh = it.mesh.clone(); it.node.setMesh(mesh);
    mesh.removePrimitive(mesh.listPrimitives()[i]);
    return;
  }
  mesh.removePrimitive(it.prim);
}

/** Leva uma primitiva do DOADOR para o ALVO, assando `XF · M` nos vértices.
 *  Nasce como nó próprio, filho da cena, com matriz identidade — mundo do
 *  arquivo é espaço da raiz do implemento, que é onde o engine mede tudo. */
function transplantar(alvo, it, XF, nome) {
  const root = alvo.getRoot();
  const buffer = root.listBuffers()[0];
  const matNome = it.prim.getMaterial()?.getName();
  const mat = root.listMaterials().find((m) => m.getName() === matNome);
  if (!mat) throw new Error(`material "${matNome}" não existe no alvo — o transplante o exigiria`);
  const W = mul(XF, it.M);
  const N = normalDe(W);
  const inverte = det3(W) < 0;
  const prim = alvo.createPrimitive().setMaterial(mat);
  for (const sem of it.prim.listSemantics()) {
    const src = it.prim.getAttribute(sem);
    const n = src.getCount(), k = src.getElementSize();
    const out = new Float32Array(n * k);
    const e = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      src.getElement(i, e);
      let o = e;
      if (sem === 'POSITION') o = aplica(W, e);
      else if (sem === 'NORMAL') o = aplicaN(N, e);
      else if (sem === 'TANGENT') {
        const t = [0, 1, 2].map((r) => W[r] * e[0] + W[4 + r] * e[1] + W[8 + r] * e[2]);
        const l = Math.hypot(...t) || 1;
        o = [t[0] / l, t[1] / l, t[2] / l, inverte ? -e[3] : e[3]];
      }
      out.set(o, i * k);
    }
    prim.setAttribute(sem, alvo.createAccessor().setType(src.getType()).setArray(out).setBuffer(buffer)
      .setNormalized(src.getNormalized()));
  }
  const si = it.prim.getIndices();
  const n = si ? si.getCount() : it.prim.getAttribute('POSITION').getCount();
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = si ? si.getScalar(i) : i;
  if (inverte) for (let i = 0; i < n; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  prim.setIndices(alvo.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
  const mesh = alvo.createMesh(nome).addPrimitive(prim);
  const node = alvo.createNode(nome).setMesh(mesh);
  root.listScenes()[0].addChild(node);
  return node;
}

/** Âncoras de transplante: doador D → alvo A. Ver o cabeçalho. */
function ancora(D, A, modo, extra = I4()) {
  const base = T(A.cx - D.cx, A.roofY - D.roofY, 0);
  if (modo === 'traseira') return mul(mul(base, T(0, 0, A.zMin - D.zMin)), extra);
  if (modo === 'dianteira') return mul(mul(base, T(0, 0, A.zMax - D.zMax)), extra);
  if (modo === 'vao') {
    const s = (A.zMax - A.zMin) / (D.zMax - D.zMin);
    return mul(mul(base, mul(T(0, 0, A.zMin), mul(S(1, 1, s), T(0, 0, -D.zMin)))), extra);
  }
  throw new Error('âncora ' + modo);
}

/**
 * Reescreve as fileiras do ALTO da chapa frisada.
 *
 * `n > 0` empilha `n` unidades de friso (as `n` de cima, copiadas) e sobe o
 * arremate; `n < 0` tira as `|n|` de cima e desce o arremate. É o mesmo corte
 * saia / unidade / arremate de `TrailerBody.sliceRibbed()`, feito no asset.
 *
 * Trabalha no espaço LOCAL da malha — as folhas do sobrechassi são UMA malha
 * instanciada 17 vezes, em cm, com escala 0,01 — e por isso exige que o y local
 * só mexa no y do mundo (`M[1] = M[9] = 0` e `M[4] = M[6] = 0`). Toda instância
 * tem de ter o MESMO mapa em y; é conferido.
 */
function refazerFileiras(alvo, it, n, R) {
  const M = it.M;
  /* Relativa à escala: o flanco esquerdo do semirreboque traz 1e-8 de ruído
     de rotação sobre uma escala de 0,01 — 1e-7 m de deriva num deslocamento de
     106 mm, nada. */
  if (Math.abs(M[1]) + Math.abs(M[9]) + Math.abs(M[4]) + Math.abs(M[6]) > 1e-4 * Math.abs(M[5])) {
    throw new Error(`${it.nome}: o y local não é um eixo puro do mundo — a operação não se aplica`);
  }
  const { rows } = fileiras(it);
  const k = Math.abs(n);
  if (rows.length < k + 2) throw new Error(`${it.nome}: ${rows.length} fileiras, não dá para mexer em ${k}`);
  const yB = rows[rows.length - 1], yA = rows[rows.length - 1 - k];
  const D = yB - yA;                                   // mundo
  const lY = (wy) => (wy - M[13]) / M[5];              // mundo → local
  const dL = D / M[5];
  /* A FILEIRA É UM PAR de alturas, não uma: o degrau de 0,9 mm entre o fim do
     arco e o vale (3,9513 e 3,9522 no semirreboque; 2,9125…2,9133 no
     sobrechassi). A tolerância tem de engolir o par e parar antes do arco — cujo
     último vértice fica 4,45 mm abaixo. 1,2 mm cabe entre os dois; a trava logo
     abaixo aborta se um bake futuro puser vértice na zona ambígua. */
  const EPS = 0.0012;
  const buffer = alvo.getRoot().listBuffers()[0];
  const prim = it.prim;
  const pos = prim.getAttribute('POSITION');
  const si = prim.getIndices();
  const nIdx = si.getCount();
  const yw = new Float64Array(pos.getCount());
  const v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) yw[i] = aplica(M, pos.getElement(i, v))[1];
  for (const y of [yA, yB]) {
    const amb = [...yw].filter((w) => Math.abs(w - y) > EPS && Math.abs(w - y) < 3 * EPS);
    if (amb.length) throw new Error(`${it.nome}: ${amb.length} vértices entre ${EPS * 1000} e ${3 * EPS * 1000} mm da fileira ${y.toFixed(4)} — a fronteira da unidade é ambígua`);
  }

  /* Classificação por triângulo — a mesma de `sliceRibbed()`. */
  const faixa = [], acima = [], abaixo = [];
  let cruzam = 0;
  for (let t = 0; t < nIdx; t += 3) {
    const tri = [si.getScalar(t), si.getScalar(t + 1), si.getScalar(t + 2)];
    const ys = tri.map((i) => yw[i]);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo >= yB - EPS) acima.push(tri);
    else if (lo >= yA - EPS && hi <= yB + EPS) faixa.push(tri);
    else if (hi <= yB + EPS) abaixo.push(tri);
    else { cruzam++; abaixo.push(tri); }
  }
  if (cruzam) throw new Error(`${it.nome}: ${cruzam} triângulos atravessam a fileira ${yB.toFixed(4)} — a chapa não é a extrusão que a operação supõe`);

  /* Vértices de saída: (origem, deslocamento local em y). */
  const chave = new Map(); const origem = []; const desloc = [];
  const ref = (i, dy) => {
    const kk = i * 4 + (dy === 0 ? 0 : dy > 0 ? 1 : 2);
    let o = chave.get(kk);
    if (o === undefined) { o = origem.length; chave.set(kk, o); origem.push(i); desloc.push(dy); }
    return o;
  };
  const saida = [];
  if (n > 0) {
    for (const tri of abaixo) saida.push(tri.map((i) => ref(i, 0)));
    for (const tri of faixa) saida.push(tri.map((i) => ref(i, 0)));
    for (const tri of faixa) saida.push(tri.map((i) => ref(i, dL)));
    for (const tri of acima) saida.push(tri.map((i) => ref(i, dL)));
  } else {
    for (const tri of abaixo) saida.push(tri.map((i) => ref(i, 0)));
    for (const tri of acima) saida.push(tri.map((i) => ref(i, -dL)));
  }
  for (const sem of prim.listSemantics()) {
    const src = prim.getAttribute(sem);
    const kk = src.getElementSize();
    const out = new Float32Array(origem.length * kk);
    const e = new Array(kk).fill(0);
    origem.forEach((i, j) => {
      src.getElement(i, e);
      if (sem === 'POSITION') e[1] += desloc[j];
      out.set(e, j * kk);
    });
    prim.setAttribute(sem, alvo.createAccessor().setType(src.getType()).setArray(out).setBuffer(buffer)
      .setNormalized(src.getNormalized()));
  }
  prim.setIndices(alvo.createAccessor().setType('SCALAR').setArray(Uint32Array.from(saida.flat())).setBuffer(buffer));
  return { yA, yB, D, faixa: faixa.length, acima: acima.length, lY };
}

/** Edita vértices de uma primitiva em coordenadas de MUNDO (`fn` recebe e
 *  devolve [x,y,z] de mundo). Só para malha de uma instância — confere. */
function editarMundo(alvo, it, fn) {
  const users = it.mesh.listParents().filter((p) => p.propertyType === 'Node');
  if (users.length > 1) throw new Error(`${it.nome}: malha compartilhada — editar em mundo não se aplica`);
  const inv = inverter(it.M);
  const pos = it.prim.getAttribute('POSITION');
  const out = new Float32Array(pos.getCount() * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) out.set(aplica(inv, fn(aplica(it.M, pos.getElement(i, v)))), i * 3);
  it.prim.setAttribute('POSITION', alvo.createAccessor().setType('VEC3').setArray(out)
    .setBuffer(alvo.getRoot().listBuffers()[0]));
}
function inverter(m) {
  /* Afim: [R t] → [R⁻¹ −R⁻¹t]. */
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
  const D2 = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, K = a * e - b * d;
  const det = a * A + b * D2 + c * G;
  const r = [A / det, D2 / det, G / det, 0, B / det, E / det, H / det, 0, C / det, F / det, K / det, 0, 0, 0, 0, 1];
  const t = aplica(r, [m[12], m[13], m[14]]);
  r[12] = -t[0]; r[13] = -t[1]; r[14] = -t[2];
  return r;
}

/**
 * Uma chapa lisa em caixa — o painel de fibra (e as chapas da testeira fechada,
 * quando uma receita pede testeira sem Thermo King).
 *
 * A UV é a PROJEÇÃO POR FACE EM CENTÍMETROS — a mesma regra do bake: na folha
 * frisada a face grande tem `u = z local em cm` (as folhas estão em cm, escala
 * 0,01), ou seja UMA repetição do mapa por centímetro. O mapa de
 * rugosidade/metalicidade do branco (`Cor_padrao_branco`, 1024², `REPEAT`) é
 * uma nuvem suave (verde 0,55…0,79, média 0,64): numa repetição por
 * centímetro ela some na distância de visão e o branco lê UNIFORME.
 *
 * ⚠️ A PRIMEIRA VERSÃO AJUSTAVA a UV por mínimos quadrados sobre os vértices da
 * folha e deu ao painel **0,7 repetição ao longo de 8,4 m** (e 114 na altura):
 * as faces de ponta da folha (que projetam em x/y) dominaram o ajuste e
 * inverteram os eixos. A nuvem ficou esticada por metros e virou faixas
 * verticais de brilho diferente e um tom azulado de céu — *"a chapa do
 * isotérmico parece estar sangrando"*, Kennedy, 2026-09-29. Por isso aqui não
 * se ajusta nada: a densidade é a do bake, escrita.
 */
const UV_POR_METRO = 100;
function caixa(alvo, nome, mn, mx, mat) {
  const buffer = alvo.getRoot().listBuffers()[0];
  const P = [], Nn = [], U = [], idx = [];
  /* `eixos`: os dois eixos de mundo que a face projeta em (u, v). */
  const face = (n, eixos, cantos) => {
    const b = P.length / 3;
    for (const c of cantos) {
      P.push(...c); Nn.push(...n);
      U.push(c[eixos[0]] * UV_POR_METRO, c[eixos[1]] * UV_POR_METRO);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx;
  face([1, 0, 0], [2, 1], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]);
  face([-1, 0, 0], [2, 1], [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]]);
  face([0, 1, 0], [0, 2], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]);
  face([0, -1, 0], [0, 2], [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]]);
  face([0, 0, 1], [0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]);
  face([0, 0, -1], [0, 1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]);
  const prim = alvo.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', alvo.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
    .setAttribute('NORMAL', alvo.createAccessor().setType('VEC3').setArray(new Float32Array(Nn)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', alvo.createAccessor().setType('VEC2').setArray(new Float32Array(U)).setBuffer(buffer))
    .setIndices(alvo.createAccessor().setType('SCALAR').setArray(Uint32Array.from(idx)).setBuffer(buffer));
  const node = alvo.createNode(nome).setMesh(alvo.createMesh(nome).addPrimitive(prim));
  alvo.getRoot().listScenes()[0].addChild(node);
  return node;
}

/* ---------------------------------------------------------------------------
   OS PASSOS DAS RECEITAS
--------------------------------------------------------------------------- */

/** Tira o perfil de topo do alvo e põe o do doador, com as fitas dele. */
function trocarPerfil(alvo, itsA, A, doador, itsD, D, perfil, log) {
  /* 1. SAI o do alvo — o que ele tiver. */
  const tipoAlvo = itsA.some((it) => /^metal-galvanizado-mantido$/.test(it.mat)
    && it.min[1] >= A.roofY - 0.25 && tam(it, 2) > 2) ? 'paleteiro' : 'gancheiro';
  if (tipoAlvo === perfil) throw new Error(`o alvo já é ${perfil}`);
  const velhos = tipoAlvo === 'paleteiro' ? perfilPaleteiro(itsA, A) : perfilGancheiro(itsA, A);
  const fitasVelhas = fitasDeTopo(itsA, A);
  for (const it of [...velhos, ...fitasVelhas]) remover(alvo, it);
  log.push(`perfil ${tipoAlvo} removido: ${velhos.length} peças + ${fitasVelhas.length} fitas de topo`);

  /* 2. ENTRA o do doador. */
  const pecas = perfil === 'paleteiro' ? perfilPaleteiro(itsD, D) : perfilGancheiro(itsD, D);
  const frente = pecas.filter((it) => tam(it, 0) > 2);
  const lados = pecas.filter((it) => tam(it, 2) > 2);
  portao(frente, 1, 'perfil da testeira');
  transplantar(alvo, frente[0], ancora(D, A, 'dianteira'), `perfil-topo-${perfil}_testeira`);
  if (perfil === 'paleteiro') {
    /* Extrusão única de ponta a ponta: estica no próprio eixo. */
    for (const it of lados) {
      const lado = it.min[0] > D.cx ? 'D' : 'E';
      transplantar(alvo, it, ancora(D, A, 'vao'), `perfil-topo-paleteiro_${lado}`);
    }
    log.push(`banda paleteiro: 2 laterais esticadas ${((A.zMax - A.zMin) / (D.zMax - D.zMin)).toFixed(4)}× em z + testeira`);
  } else {
    /* LADRILHADO com as barras de fábrica — ver o cabeçalho. Cada lado é uma
       fila de (barra, girada?) da traseira para a frente. */
    const dir = lados.filter((it) => it.min[0] > D.cx).sort((a, b) => a.min[2] - b.min[2]);
    const esq = lados.filter((it) => it.max[0] < D.cx).sort((a, b) => a.min[2] - b.min[2]);
    portao(dir, 3, 'barras do Z à direita'); portao(esq, 3, 'barras do Z à esquerda');
    const L = A.zMax - A.zMin;
    const nomeLen = (it) => Math.round(tam(it, 2) * 1000);
    const meio = (lista) => lista.find((it) => Math.abs(tam(it, 2) - 3.0) < 0.002);
    const curta = dir.find((it) => Math.abs(tam(it, 2) - 2.58) < 0.002);
    if (!meio(dir) || !meio(esq) || !curta) throw new Error('barras de 3 000 e de 2 580 mm não encontradas no doador');
    const nMeio = Math.round((L - tam(curta, 2)) / 3.0);
    const sobra = L - tam(curta, 2) - nMeio * 3.0;
    if (Math.abs(sobra) > 0.004) throw new Error(`o Z não fecha sem corte: sobra ${(sobra * 1000).toFixed(1)} mm`);
    /* Direita: a curta na TRASEIRA (como no doador), depois as de 3 m.
       Esquerda: as de 3 m e a curta, girada, na DIANTEIRA — a paginação das
       cantoneiras 50 × 60 do próprio semirreboque. */
    const filaD = [{ it: curta, gira: false }, ...Array(nMeio).fill({ it: meio(dir), gira: false })];
    const filaE = [...Array(nMeio).fill({ it: meio(esq), gira: false }), { it: curta, gira: true }];
    for (const [lado, fila] of [['D', filaD], ['E', filaE]]) {
      let z = A.zMin;
      fila.forEach(({ it, gira }, k) => {
        /* A barra vai para a origem em z, (gira), e desce até o cursor. */
        const G = gira ? giroY180(D.cx) : I4();
        const pz = gira ? -it.max[2] : it.min[2];            // o z mínimo depois do giro
        const XF = mul(T(A.cx - D.cx, A.roofY - D.roofY, z - pz), G);
        transplantar(alvo, it, XF, `perfil-topo-gancheiro_${lado}${String(k + 1).padStart(2, '0')}`);
        z += tam(it, 2);
      });
      log.push(`Z gancheiro ${lado}: ${fila.map(({ it, gira }) => nomeLen(it) + (gira ? '↻' : '')).join(' + ')} = ${((z - A.zMin) * 1000).toFixed(0)} mm (pele ${(L * 1000).toFixed(0)})`);
    }
  }
  /* 3. As fitas 3M de topo do DOADOR, pela ponta a que pertencem. */
  for (const it of fitasDeTopo(itsD, D)) {
    const tras = (it.min[2] + it.max[2]) / 2 < (D.zMin + D.zMax) / 2;
    const lado = it.min[0] > D.cx ? 'D' : 'E';
    transplantar(alvo, it, ancora(D, A, tras ? 'traseira' : 'dianteira'),
      `fita-topo-${perfil}_${lado}${tras ? 'T' : 'F'}`);
  }
  log.push('fitas de topo do doador: 4');
}

/** A chapa do teto na largura e na borda dianteira do perfil novo — as duas
 *  RELATIVAS, medidas no doador. */
function ajustarTeto(alvo, A, D, log) {
  const meia = D.tetoMeia;
  const frente = A.zMax + (D.tetoFrente - D.zMax);
  const it = A.teto;
  const x0 = A.cx - A.tetoMeia, x1 = A.cx + A.tetoMeia;
  editarMundo(alvo, it, ([x, y, z]) => [
    Math.abs(x - x1) < 0.02 ? A.cx + meia : Math.abs(x - x0) < 0.02 ? A.cx - meia : x,
    y,
    Math.abs(z - A.tetoFrente) < 0.02 ? frente : z,
  ]);
  log.push(`teto: meia-largura ${(A.tetoMeia * 1000).toFixed(1)} → ${(meia * 1000).toFixed(1)} mm · borda dianteira ${A.tetoFrente.toFixed(4)} → ${frente.toFixed(4)}`);
}

/** Quantas fileiras de friso o topo da chapa ganha (+) ou perde (−) para que a
 *  distância da última fileira ao pé do perfil novo seja a do DOADOR. */
function fileirasParaPerfil(A, D, perfil, itsD) {
  const pecas = perfil === 'paleteiro' ? perfilPaleteiro(itsD, D) : perfilGancheiro(itsD, D);
  const peD = Math.min(...pecas.filter((it) => tam(it, 2) > 2).map((it) => it.min[1]));
  const folgaD = peD - D.ultimaFileira;                 // doador: fileira → pé do perfil
  const peA = peD - D.roofY + A.roofY;                   // o pé do perfil novo, no alvo
  const alvoFileira = peA - folgaD;
  return { n: Math.round((alvoFileira - A.ultimaFileira) / A.passo), folgaD, peA };
}

/* ---------------------------------------------------------------------------
   AS RECEITAS
--------------------------------------------------------------------------- */
const SEMI = 'trailer_v2.glb';
const SOBRE = 'sobrechassi_frigorifico_gancheiro.glb';

const RECEITAS = [
  {
    id: 'semirreboque-gancheiro',
    saida: 'semirreboque_frigorifico_gancheiro_v1.glb',
    base: SEMI, doador: SOBRE, perfil: 'gancheiro',
  },
  {
    id: 'sobrechassi-paleteiro',
    saida: 'sobrechassi_frigorifico_paleteiro_v1.glb',
    base: SOBRE, doador: SEMI, perfil: 'paleteiro', semGancheira: true,
  },
  /* O ISOTÉRMICO É UMA CARROCERIA, e tem os dois arranjos — *"deve ter
     isotérmico paleteiro e gancheiro, e o isotérmico deve ter thermo king
     também"*, Kennedy, 2026-09-29. A primeira versão fazia UM isotérmico sem
     máquina de frio e com a testeira fechada; isso saiu. O que faz o
     isotérmico é a PELE (fibra contínua): perfil, gancheira, testeira,
     evaporador e Thermo King seguem o frigorífico do mesmo arranjo. */
  {
    id: 'isotermico-paleteiro',
    saida: 'sobrechassi_isotermico_paleteiro_v1.glb',
    base: SOBRE, doador: SEMI, perfil: 'paleteiro', semGancheira: true, fibra: true,
  },
  {
    id: 'isotermico-gancheiro',
    saida: 'sobrechassi_isotermico_gancheiro_v1.glb',
    /* A base JÁ É gancheira: não há perfil a trocar, só a pele. */
    base: SOBRE, doador: SEMI, perfil: 'gancheiro', fibra: true,
  },
];

/* ---------------------------------------------------------------------------
   O isotérmico: pele de fibra
--------------------------------------------------------------------------- */

/** Troca as folhas frisadas por UM painel liso por flanco. */
function peleDeFibra(alvo, its, A, topo, log) {
  const branco = alvo.getRoot().listMaterials().find((m) => BRANCO_RE.test(m.getName()));
  /* ▶▶ O PAINEL MORA NO PLANO LISO DA CHAPA, não na crista do friso.
     ------------------------------------------------------------------------
     *"ainda está errado os frames metálicos do isotérmico, a chapa está
     sangrando sobre eles"* — Kennedy, 2026-09-29, com print do canto traseiro.
     A 1ª versão pôs a face de fora na CRISTA (x 1,3075 à direita) e a de dentro
     no vale interno: 6 mm de casca. Só que os quadros foram modelados contra a
     parte LISA da chapa — o arremate de cima e a saia de baixo, no plano do
     VALE (1,3024) —, e o corte de seção mostrou o painel ENGOLINDO a perna do
     perfil Z (1,3020…1,3044) e a da cantoneira 50 × 60 inteiras, e a parte de
     baixo da banda do paleteiro (face interna 1,3037). A chapa lisa entre
     frisos é o que o painel substitui; ele ocupa as mesmas duas faces dela,
     medidas aqui no arremate de cima (a faixa lisa acima da última fileira). */
  const lados = { D: A.paredes.filter((it) => it.min[0] > A.cx), E: A.paredes.filter((it) => it.max[0] < A.cx) };
  const n = A.paredes.length;
  const planos = {};
  for (const [lado, lista] of Object.entries(lados)) {
    const sgn = lado === 'D' ? 1 : -1;
    let fora = -Infinity, dentro = Infinity, crista = -Infinity;
    const v = [0, 0, 0];
    for (const it of lista) {
      const pos = it.prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) {
        const w = aplica(it.M, pos.getElement(i, v));
        crista = Math.max(crista, (w[0] - A.cx) * sgn);
        if (w[1] < A.ultimaFileira + 0.005) continue;           // só o arremate liso
        const d = (w[0] - A.cx) * sgn;
        if (d > fora) fora = d;
        if (d < dentro) dentro = d;
      }
    }
    if (!(fora > dentro) || fora - dentro > 0.003) {
      throw new Error(`painel ${lado}: plano liso da chapa não medido (${dentro}…${fora})`);
    }
    planos[lado] = { sgn, fora, dentro, relevo: crista - fora };
  }
  for (const it of A.paredes) remover(alvo, it);
  for (const [lado, { sgn, fora, dentro }] of Object.entries(planos)) {
    const xa = A.cx + sgn * (sgn > 0 ? dentro : fora), xb = A.cx + sgn * (sgn > 0 ? fora : dentro);
    caixa(alvo, `painel-fibra_${lado}`, [xa, A.basePele, A.zMin], [xb, topo, A.zMax], branco);
    log.push(`painel de fibra ${lado}: plano liso da chapa x ${xa.toFixed(4)}…${xb.toFixed(4)} (${((fora - dentro) * 1000).toFixed(1)} mm) · y ${A.basePele.toFixed(3)}…${topo.toFixed(3)} · z ${A.zMin.toFixed(3)}…${A.zMax.toFixed(3)}`);
  }
  log.push(`${n} folhas frisadas removidas`);
  /* O RELEVO DA CHAPA (vale → crista) — a outra metade da régua do trilho de
     piso. Ver `railRelief` no `implements.json` e `fixLowFrameRail()`. */
  log.push(`relevo da chapa (parte lisa → crista): ${Object.entries(planos).map(([l, p]) => `${l} ${(p.relevo * 1000).toFixed(1)} mm`).join(' · ')}`);
  return planos;
}

/**
 * PORTÃO: nenhuma peça metálica ENGOLIDA pelo painel.
 *
 * Uma peça de quadro que encosta na pele e cruza a área do painel (em y e z)
 * tem de ter a face de fora À FRENTE da face de fora do painel. Se a face dela
 * cai DENTRO da espessura do painel (ou a menos de 0,3 mm à frente), ela some
 * ou disputa profundidade com ele — o "sangrando sobre os frames".
 * Recusa a gravação e nomeia as peças.
 */
function portaoEngolidas(itsNovos, A, planos, topo) {
  const METAL = /estrutura|galvanizado|inox|pouco-polido|metal-preto|faixa/i;
  const ruins = [];
  for (const it of itsNovos) {
    if (!METAL.test(it.mat)) continue;
    if (it.max[1] < A.basePele || it.min[1] > topo) continue;
    if (it.max[2] < A.zMin || it.min[2] > A.zMax) continue;
    for (const { sgn, fora, dentro } of Object.values(planos)) {
      const lo = (sgn > 0 ? it.min[0] : -it.max[0]) - A.cx * sgn;
      const hi = (sgn > 0 ? it.max[0] : -it.min[0]) - A.cx * sgn;
      /* O que reprova é a face de fora COPLANAR com a do painel (±0,2…0,3 mm):
         aí as duas disputam profundidade e a peça aparece e some — o
         "sangrando". Atrás dela (inclusive encostada, como o marco da porta de
         fábrica e os montantes internos, que já ficavam 0,3 mm atrás da parte
         lisa da chapa) ou na frente dela: ok. */
      if (hi > fora - 0.0002 && hi <= fora + 0.0003) {
        ruins.push(`${it.nome} (${it.mat}) x ${lo.toFixed(4)}…${hi.toFixed(4)} contra o painel ${dentro.toFixed(4)}…${fora.toFixed(4)}`);
      }
    }
  }
  return ruins;
}

/** Fecha a janela do Thermo King: as duas chapas furadas da testeira viram
 *  chapas inteiras, as seis travessas do vão e o evaporador saem.
 *
 *  ⚠️ NENHUMA RECEITA USA HOJE. Ela nasceu para o isotérmico sem máquina de
 *  frio, e o dono corrigiu: o isotérmico TEM Thermo King. Fica pela CARGA SECA
 *  (baú sem frio), que é a próxima receita pedida — os portões dela (2 chapas,
 *  6 travessas, 1 evaporador) foram medidos e passaram no sobrechassi. */
function testeiraFechada(alvo, its, A, log) {
  const branco = alvo.getRoot().listMaterials().find((m) => BRANCO_RE.test(m.getName()));
  /* As chapas da testeira: brancas, finas em z, quase a largura do baú, na
     frente. A de fora e a de dentro (forro) — as duas furadas. */
  const chapas = portao(its.filter((it) => BRANCO_RE.test(it.mat) && tam(it, 2) < 0.01 && tam(it, 0) > 2.3
    && tam(it, 1) > 2.2 && it.min[2] > A.zMax - 0.1), 2, 'chapas da testeira');
  for (const it of chapas) {
    remover(alvo, it);
    caixa(alvo, `testeira-fechada_${it.min[2] > A.zMax + 0.03 ? 'externa' : 'forro'}`, it.min, it.max, branco);
  }
  /* O vão: as travessas estruturais que o contornam — duas horizontais em
     cima (139, 141), duas embaixo (136, 140) e duas verticais (135, 138) —,
     todas com ~110 mm de fundo em z: elas atravessam as duas chapas. */
  const cxT = A.cx;
  const vao = its.filter((it) => /^metal-estrutura-principal-padrao$/.test(it.mat)
    && it.min[2] > A.zMax - 0.06 && it.max[2] < A.zMax + 0.07 && tam(it, 2) > 0.09
    && it.min[1] > A.roofY - 0.60 && it.max[1] < A.roofY - 0.10
    && Math.abs((it.min[0] + it.max[0]) / 2 - cxT) < 0.70
    && (tam(it, 0) > 1.0 || tam(it, 1) > 0.3));
  portao(vao, 6, 'travessas do vão do Thermo King');
  for (const it of vao) remover(alvo, it);
  /* O evaporador: a caixa branca interna encostada na testeira, sob o teto. */
  const evap = portao(its.filter((it) => BRANCO_RE.test(it.mat) && it.min[2] > A.zMax - 0.6
    && it.max[2] < A.zMax && it.min[1] > A.roofY - 0.4 && tam(it, 0) > 1.0 && tam(it, 0) < 1.5
    && tam(it, 1) > 0.15), 1, 'evaporador');
  for (const it of evap) remover(alvo, it);
  log.push(`testeira fechada: 2 chapas inteiras · ${vao.length} travessas do vão e o evaporador (${evap[0].tris} tri) removidos`);
}

/* ---------------------------------------------------------------------------
   main
--------------------------------------------------------------------------- */
async function rodar(rc) {
  const log = [];
  const alvo = await io.read(path.join(VEH, rc.base));
  const doador = await io.read(path.join(VEH, rc.doador));
  const itsA = censo(alvo), itsD = censo(doador);
  const A = regua(itsA, rc.base), D = regua(itsD, rc.doador);
  log.push(`régua alvo  ${rc.base}: teto ${A.roofY.toFixed(4)} · cx ${A.cx.toFixed(4)} · pele z ${A.zMin.toFixed(4)}…${A.zMax.toFixed(4)} · topo da pele ${A.topoPele.toFixed(4)} · última fileira ${A.ultimaFileira.toFixed(4)} · passo ${(A.passo * 1000).toFixed(2)} mm`);
  log.push(`régua doador ${rc.doador}: teto ${D.roofY.toFixed(4)} · cx ${D.cx.toFixed(4)} · pele z ${D.zMin.toFixed(4)}…${D.zMax.toFixed(4)} · última fileira ${D.ultimaFileira.toFixed(4)}`);

  /* O perfil que a base JÁ TEM não se troca — é o isotérmico gancheiro, que é
     o sobrechassi gancheiro com outra pele. */
  const perfilBase = itsA.some((it) => /^metal-galvanizado-mantido$/.test(it.mat)
    && it.min[1] >= A.roofY - 0.25 && tam(it, 2) > 2) ? 'paleteiro' : 'gancheiro';
  const troca = perfilBase !== rc.perfil;
  const fil = troca ? fileirasParaPerfil(A, D, rc.perfil, itsD) : { n: 0 };
  if (troca) {
    log.push(`fileiras de friso: ${fil.n > 0 ? '+' : ''}${fil.n} (pé do perfil novo em ${fil.peA.toFixed(4)}; no doador a última fileira fica ${(fil.folgaD * 1000).toFixed(1)} mm abaixo dele)`);
    trocarPerfil(alvo, itsA, A, doador, itsD, D, rc.perfil, log);
    ajustarTeto(alvo, A, D, log);
  } else {
    log.push(`perfil ${rc.perfil}: já é o da base — fica`);
  }
  /* A SAIA DA CHAPA — a régua do trilho de piso quando não há friso. Ver
     `railSkirt` no `implements.json` e `fixLowFrameRail()`. */
  log.push(`saia da chapa (1ª fileira − pé da pele): ${((A.primeiraFileira - A.basePele) * 1000).toFixed(1)} mm`);

  let topoPele = A.topoPele;
  let planosFibra = null;
  if (rc.fibra) {
    topoPele = A.topoPele + fil.n * A.passo;
    planosFibra = peleDeFibra(alvo, itsA, A, topoPele, log);
  } else if (fil.n) {
    /* A operação é por MALHA: as 17 folhas do sobrechassi são uma malha só. */
    const feitas = new Set();
    for (const it of A.paredes) {
      if (feitas.has(it.mesh)) continue;
      const irmas = A.paredes.filter((o) => o.mesh === it.mesh);
      if (irmas.some((o) => Math.abs(o.M[5] - it.M[5]) > 1e-6 * Math.abs(it.M[5]) || Math.abs(o.M[13] - it.M[13]) > 1e-6)) {
        throw new Error(`${it.nome}: instâncias com mapas de y diferentes`);
      }
      feitas.add(it.mesh);
      const r = refazerFileiras(alvo, it, fil.n, A);
      topoPele = A.topoPele + Math.sign(fil.n) * r.D;
      log.push(`chapa "${it.nome}" (${irmas.length} instância${irmas.length > 1 ? 's' : ''}): ${fil.n > 0 ? 'empilhadas' : 'tiradas'} ${Math.abs(fil.n)} fileiras ${r.yA.toFixed(4)}…${r.yB.toFixed(4)} (${(r.D * 1000).toFixed(1)} mm) · ${r.faixa} tri na faixa, ${r.acima} no arremate`);
    }
    log.push(`topo da pele ${A.topoPele.toFixed(4)} → ${topoPele.toFixed(4)}`);
  }
  if (rc.semGancheira) {
    const g = gancheira(itsA, A);
    const tris = g.reduce((s, it) => s + it.tris, 0);
    for (const it of g) remover(alvo, it);
    log.push(`gancheira removida: ${g.length} peças, ${tris} triângulos`);
  }
  if (rc.semThermoKing) testeiraFechada(alvo, itsA, A, log);
  if (planosFibra) {
    /* O INVERSO, e informativo: o que ficava entre o vale e a CRISTA do friso
       — escondido pelas ondas da chapa — e que o painel liso agora expõe. Foi
       o caso da fileira de rebites da ferragem inferior (consertada no
       engine, `lowerRivets()`). Aqui só se lista. */
    const crista = Object.values(planosFibra).map((p) => p.fora + 0.0052);
    const expostas = censo(alvo).filter((it) => /estrutura|galvanizado|inox|pouco-polido|metal-preto/i.test(it.mat)
      && it.max[1] > A.basePele && it.min[1] < topoPele && it.max[2] > A.zMin && it.min[2] < A.zMax
      && Object.values(planosFibra).some(({ sgn, fora }, i) => {
        const hi = (sgn > 0 ? it.max[0] : -it.min[0]) - A.cx * sgn;
        return hi > fora + 0.0003 && hi < crista[i] && tam(it, 0) < 0.03;
      }));
    log.push(`peças entre o vale e a crista (antes escondidas pelos frisos): ${expostas.length}`
      + (expostas.length ? ' — ' + [...new Set(expostas.map((it) => `${it.nome.replace(/_\d+$/, '')} [${it.mat}] y ${it.min[1].toFixed(2)}`))].slice(0, 8).join(' · ') : ''));
    const ruins = portaoEngolidas(censo(alvo), A, planosFibra, topoPele);
    if (ruins.length) throw new Error(`o painel de fibra engole ${ruins.length} peça(s) de quadro:\n  ${ruins.slice(0, 12).join('\n  ')}`);
    log.push('portão: nenhuma peça de quadro engolida pelo painel');
  }
  return { alvo, log };
}

function cli(args) {
  execFileSync(process.execPath, [CLI, ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
}

for (const rc of RECEITAS) {
  if (ONLY && rc.id !== ONLY) continue;
  console.log(`\n▶ ${rc.id} → ${rc.saida}`);
  const { alvo, log } = await rodar(rc);
  for (const l of log) console.log('  ·', l);
  if (DRY) { console.log('  (--dry: nada gravado)'); continue; }
  /* CRU: sem Draco. A receita da §6 comprime por cima. */
  for (const e of alvo.getRoot().listExtensionsUsed()) {
    if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'variante-'));
  const cru = path.join(tmp, 'cru.glb');
  await io.write(cru, alvo);
  const destino = path.join(VEH, rc.saida);
  if (RAW) {
    fs.copyFileSync(cru, destino);
  } else {
    cli(['dedup', cru, path.join(tmp, 'a.glb'), '--materials', 'false']);
    cli(['prune', path.join(tmp, 'a.glb'), path.join(tmp, 'b.glb'), '--keep-attributes', 'false', '--keep-leaves', 'true']);
    cli(['draco', path.join(tmp, 'b.glb'), destino, '--method', 'edgebreaker',
      '--quantize-position', '16', '--quantize-normal', '12', '--quantize-texcoord', '14']);
  }
  const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(2);
  console.log(`  ✓ ${destino} — cru ${mb(cru)} MB → ${mb(destino)} MB`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
