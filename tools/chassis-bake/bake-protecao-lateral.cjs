/* A PROTEÇÃO LATERAL DO SEMIRREBOQUE, extraída para virar peça de implemento.
   ===========================================================================
       node tools/chassis-bake/bake-protecao-lateral.cjs

   POR QUE EXTRAIR, E NÃO DESENHAR
   ---------------------------------------------------------------------------
   Eu desenhei esta peça DUAS vezes antes de fazer o certo, e as duas foram
   recusadas pelo mesmo motivo:

     1ª — três lâminas de 90 mm tiradas das COTAS do VW. *"você criou uma nova,
          totalmente diferente"*.
     2ª — duas barras de 32 × 100 tiradas das MEDIDAS do semirreboque.
          *"ainda está uma peça inventada"*.

   A segunda tinha os números certos e mesmo assim estava errada, e a lição é a
   mesma que `porta_kit_v1.glb` e `wheel_vm_v1.glb` já registram nesta base:
   **reproduzir a medida de uma peça não é a peça.** O que faz a grade parecer
   o que é não são as duas barras — são os suportes, os montantes, os parafusos
   e as tampas de ponta que vêm com elas.

   O QUE ELE LEVA — medido em `semirreboque_frigorifico_paleteiro.glb`
   ---------------------------------------------------------------------------
       metal-galvanizado-mantido   32 × 100 × 3 250/3 380  |x| 1 275   BARRAS
       metal-preto                 90 × 250 ×    65        |x| 1 214   SUPORTE
       metal-preto                 35 × 580 ×    57        |x| 1 214   MONTANTE
       inox-ferragem               10 ×  10 ×    10        |x| 1 259   PARAFUSOS
       plastico-preto             100 × 101 ×   149        |x| 1 253   TAMPAS
       inox-ferragem               26 ×  95 ×     4        |x| 1 229   chapinhas

   ⚠️ POR QUE UM ESCRITOR DE GLB PRÓPRIO, e não `glb-surgery.poda()`
   ---------------------------------------------------------------------------
   Aquela faca pressupõe o que os rips de CAMINHÃO são: nó plano, uma primitiva
   por malha, tudo Draco. O implemento não é nada disso — tem nó com filhos e
   malha com mais de uma primitiva —, e `verificaSuporte()` o recusa, que é o
   comportamento certo dela. Aqui a saída é um arquivo NOVO e pequeno, então
   sai mais barato montá-lo do zero do que ensinar a faca a andar num grafo.

   ⚠️ E O ASSET NÃO CARREGA MATERIAL DE VERDADE — só o NOME.
   Os quatro materiais da peça (`metal-galvanizado-mantido`, `metal-preto`,
   `inox-ferragem`, `plastico-preto`) EXISTEM no sobrechassi, com esses mesmos
   nomes. Ligar por nome em runtime faz a grade herdar a tinta, o acabamento da
   frota e o molhado do implemento que a recebe — e é o que impede que ela seja
   a única peça que não muda quando chove.

   O REFERENCIAL DE SAÍDA
   ---------------------------------------------------------------------------
   Um lado só (o de x positivo; o outro é espelho, e espelhar é do runtime).
     · x = 0 na FACE EXTERNA das barras;
     · y = 0 no SOLO. As cotas da grade são de solo por natureza (a borda
       inferior a 510 mm é o que a norma limita), e é o solo que as leva
       intactas de um baú a outro. Quem as converte para o referencial do
       implemento é o runtime, que sabe a que altura o baú assentou;
     · z = 0 na ponta TRASEIRA do trecho, crescendo para a frente.
*/
const path = require('path');
const fs = require('fs');
const S = require('./glb-surgery.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const SRC = path.join(WEB, 'public', 'models', 'vehicles', 'semirreboque_frigorifico_paleteiro.glb');
/* ⚠️ `_v2`, E O `_v1` FICA. A árvore servida sai com `Cache-Control: immutable`
   — sobrescrever um asset já publicado entrega bytes novos sob um nome velho
   para quem tem o antigo em cache. Mesma regra do `vw_titan_6x2r.glb` (§43.4).
   A v2 acrescenta o BRAÇO, a MÃO-FRANCESA e os GRAMPOS: a ferragem que prende
   a grade no chassi e que a v1 deixou de fora por causa da janela em x. */
const DST = path.join(WEB, 'public', 'models', 'vehicles', 'protecao_lateral_v2.glb');

/** A janela em que a GRADE PROPRIAMENTE DITA vive, medida. */
const FAIXA = { xMin: 1.19, xMax: 1.31, yMin: 0.45, yMax: 1.30, zMin: -1.60, zMax: 2.05 };
/**
 * ▶▶ A JANELA DA FERRAGEM QUE SEGURA A GRADE — e ela não estava aqui.
 *
 * *"adicione os suportes delas, porque atualmente estão flutuando sem suporte;
 * analise o modelo de semirreboque para pegar o modelo do suporte de lá"* —
 * Kennedy, 2026-08-23.
 *
 * ⚠️ A v1 DEIXOU O SUPORTE DE FORA POR CAUSA DE UM NÚMERO. `FAIXA.xMin` era
 * 1,19 — a grade e nada mais —, e o que prende a grade no caminhão mora TODO
 * para dentro disso. Medido em `semirreboque_frigorifico_paleteiro.glb`, cada
 * uma das 6 estações (3 por flanco) tem, além do suporte e do montante:
 *
 *     BRAÇO     850 × 50 × 58   |x|  374…1 224   y 840…890   Metal-preto_0_247…252
 *     MÃO-FRANCESA 397 × 248 × 45 |x| 854…1 251  y 626…874   Metal-preto_0_265…270
 *     GRAMPO ×2  99 ×  80 × 60   |x| 379…478 e 480…579  y 890…970  …_271…282
 *
 * O braço é uma barra horizontal que sai da longarina e vai até o montante; a
 * mão-francesa é a diagonal que a escora por baixo; os grampos são o par de
 * chapas que abraça a longarina (que no semirreboque está em |x| 477…483, e é
 * por isso que há um de cada lado dela). Sem os três a grade fica pendurada no
 * ar — que é literalmente a queixa.
 */
const FAIXA_FERRAGEM = { xMin: 0.33, xMax: 1.26, yMin: 0.55, yMax: 1.05,
  dzMax: 0.12, minTris: 100 };
/** Vão em z acima do qual a peça é CORRIDO DO IMPLEMENTO e não da grade. O
 *  perímetro inferior do baú (26 × 210 × 14 580 mm em |x| 1 294, y 1 309) mora
 *  na mesma janela e não é grade — 4 m o exclui com folga, e a barra mais
 *  longa da grade tem 3 380. */
const CORRIDO_DO_BAU = 4.0;
/** Nós que moram na mesma janela e NÃO são da grade. */
const FORA_RE = /pneu|Caixa-ferrmantas/i;
const MIN_TRIS = 2;
/** Meia-janela em z que uma estação ocupa, em torno do suporte. Medida: o
 *  montante tem 57 mm de vão, os parafusos ficam a ±80 e as chapinhas a ±90. */
/* ⚠️ 240 mm, NÃO 140. A estação NÃO é um suporte: é um PAR de chapas a 150 mm
   uma da outra (a vizinhança impressa mostra 90×250 e 35×580 em dz=0 E em
   dz=-150). Com a janela em 140 a segunda chapa ficava de fora por 10 mm, e
   com ela ia embora o MONTANTE de 35×580 que liga a barra de baixo à de cima —
   *"está faltando as partes laterais que seguram uma grade na outra"*. O passo
   é 1 250 mm, então 240 continua longe de invadir a estação vizinha. */
const JANELA_ESTACAO = 0.24;
/** O piso do implemento de origem, de `TrailerBody.profile` — ver §30. */
const FLOOR_Y = 1.391857;

const mm = (v) => (v * 1000).toFixed(0);

/* ---- álgebra mínima de mat4 column-major, como o glTF guarda ---- */
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
      + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function trs(t, r, s) {
  const m = ident();
  if (r) {
    const [x, y, z, w] = r;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    m[0] = 1 - (y * y2 + z * z2); m[1] = x * y2 + w * z2; m[2] = x * z2 - w * y2;
    m[4] = x * y2 - w * z2; m[5] = 1 - (x * x2 + z * z2); m[6] = y * z2 + w * x2;
    m[8] = x * z2 + w * y2; m[9] = y * z2 - w * x2; m[10] = 1 - (x * x2 + y * y2);
  }
  if (s) { for (let c = 0; c < 3; c++) for (let r2 = 0; r2 < 3; r2++) m[c * 4 + r2] *= s[c]; }
  if (t) { m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; }
  return m;
}
const ponto = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
/** Normal: só a parte 3×3, e sem escala não-uniforme não precisa da inversa
 *  transposta — o implemento não tem nó espelhado nesta região (conferido). */
const direcao = (m, x, y, z) => {
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z];
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

/* ---- escritor de GLB mínimo ---- */
const FLOAT = 5126, UINT32 = 5125;
function escreve(destino, familias, E, D) {
  const g = {
    asset: { version: '2.0', generator: 'tools/chassis-bake/bake-protecao-lateral.cjs' },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [],
    accessors: [], bufferViews: [], buffers: [],
  };
  const blocos = []; let off = 0;
  const anexa = (buf, alvo, stride) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) { blocos.push(Buffer.alloc(pad)); off += pad; }
    const bv = { buffer: 0, byteOffset: off, byteLength: buf.length };
    if (stride !== undefined) bv.byteStride = stride;
    if (alvo !== undefined) bv.target = alvo;
    g.bufferViews.push(bv); blocos.push(buf); off += buf.length;
    return g.bufferViews.length - 1;
  };
  for (const [nome, f] of familias) {
    /* DRACO. Sem ele o asset sai com 2,1 MB, e ele carrega junto com TODO
       implemento — a parafusaria sozinha são 8 × 2 178 triângulos. Os acessores
       de uma primitiva Draco não têm `bufferView`: quem carrega os dados é o
       payload da extensão. */
    const attrs = {
      POSITION: { arr: Float32Array.from(f.pos), n: 3 },
      NORMAL: { arr: Float32Array.from(f.nrm), n: 3 },
      TEXCOORD_0: { arr: Float32Array.from(f.uv), n: 2 },
    };
    const c = S.codifica(attrs, Uint32Array.from(f.idx), E, D);
    const bv = anexa(c.bytes);
    const acc = {};
    for (const [attr, a] of Object.entries(attrs)) {
      const d = { componentType: FLOAT, count: c.nPontos, type: a.n === 3 ? 'VEC3' : 'VEC2' };
      if (attr === 'POSITION') { d.min = c.min; d.max = c.max; }
      g.accessors.push(d); acc[attr] = g.accessors.length - 1;
    }
    g.accessors.push({ componentType: UINT32, count: c.nFaces * 3, type: 'SCALAR' });
    const iAcc = g.accessors.length - 1;

    g.materials.push({
      name: nome,
      pbrMetallicRoughness: {
        baseColorFactor: f.cor, metallicFactor: f.metal, roughnessFactor: f.rug,
      },
    });
    g.meshes.push({ name: nome, primitives: [{
      attributes: acc, indices: iAcc, mode: 4, material: g.materials.length - 1,
      extensions: { KHR_draco_mesh_compression: { bufferView: bv, attributes: c.ids } },
    }] });
    g.nodes.push({ name: nome, mesh: g.meshes.length - 1 });
    g.scenes[0].nodes.push(g.nodes.length - 1);
  }
  g.extensionsUsed = ['KHR_draco_mesh_compression'];
  g.extensionsRequired = ['KHR_draco_mesh_compression'];
  const bin = Buffer.concat(blocos);
  g.buffers.push({ byteLength: bin.length });
  return S.escreverGlb(destino, g, bin);
}

(async () => {
  const D = await S.decoder();
  const { g, bin } = S.lerGlb(SRC);

  /* Matrizes de mundo, com a cadeia de pais — o implemento TEM nó com filhos. */
  const pai = new Array(g.nodes.length).fill(-1);
  g.nodes.forEach((n, i) => (n.children || []).forEach((c) => { pai[c] = i; }));
  const local = g.nodes.map((n) => (n.matrix ? n.matrix.slice() : trs(n.translation, n.rotation, n.scale)));
  const mundo = new Array(g.nodes.length).fill(null);
  const W = (i) => {
    if (mundo[i]) return mundo[i];
    mundo[i] = pai[i] < 0 ? local[i] : mul(W(pai[i]), local[i]);
    return mundo[i];
  };

  const familias = new Map();
  const estacoes = [];
  const candidatos = [];
  let temPontaPositiva = false;
  let achados = 0, tris = 0;
  const cx = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  const formas = new Map();

  for (let ni = 0; ni < g.nodes.length; ni++) {
    const no = g.nodes[ni];
    if (no.mesh === undefined) continue;
    if (FORA_RE.test(no.name || '')) continue;
    const M = W(ni);
    for (const prim of g.meshes[no.mesh].primitives) {
      if (!prim.extensions || !prim.extensions.KHR_draco_mesh_compression) continue;
      const acc = g.accessors[prim.attributes.POSITION];
      /* ⚠️ SEM PRÉ-PENEIRA. Havia uma, por caixa do ACESSOR mais a translação
         do nó, e ela é aproximada por construção: a caixa é LOCAL e somar só a
         translação erra assim que o nó tem rotação ou escala. Ela custou duas
         rodadas — primeiro descartando as tampas de ponta, depois continuando a
         descartá-las mesmo com 2 m de margem. Decodificar as 2 157 primitivas
         custa ~40 s e decide certo; a peneira custava 3 s e decidia errado. */
      const d = S.decodifica(g, bin, prim, D);
      const pl = d.attrs.POSITION.arr;
      /* Para o espaço de MUNDO antes de decidir — as regras são de lá. */
      const pw = new Float32Array(pl.length);
      for (let i = 0; i < pl.length / 3; i++) {
        const p = ponto(M, pl[i * 3], pl[i * 3 + 1], pl[i * 3 + 2]);
        pw[i * 3] = p[0]; pw[i * 3 + 1] = p[1]; pw[i * 3 + 2] = p[2];
      }
      const matNome = prim.material !== undefined
        ? (g.materials[prim.material].name || `mat${prim.material}`) : 'sem-material';
      for (const faces of S.componentes(pw, d.idx)) {
        if (faces.length < MIN_TRIS) continue;
        const b = S.caixaDeFaces(pw, d.idx, faces);
        const xc = (b.x0 + b.x1) / 2;
        /* ⚠️ ESPELHAR TUDO DOBROU A GRADE — DUAS VEZES.
           A primeira versão descartava `xc < 0` e ficava sem a tampa de ponta,
           que só existe no lado negativo. Troquei por "espelha tudo": a barra,
           que existe nos DOIS lados, virou duas cópias — *"você adicionou uma
           segunda grade"*. Tentei então casar os pares por FORMA + cota e
           espelhar só o ímpar; falhou também, porque os dois flancos do
           semirreboque não estão alinhados em z (o casamento errava por mais
           de 5 mm) e quase tudo passou como "sem par" — *"continuam 2 grades
           uma na frente da outra"*.

           A regra que vale: o lado positivo é a VERDADE para tudo que a grade
           tem nos dois flancos, e o espelho é EXCEÇÃO para o que só existe no
           negativo — hoje, a tampa de plástico. Nada de heurística de par:
           quem decide é o PAPEL, que é uma propriedade da peça e não uma
           coincidência de medida. */
        const ax = Math.abs(xc);
        let papelPre = null;
        if (ax >= FAIXA.xMin && ax <= FAIXA.xMax) {
          papelPre = matNome === 'plastico-preto' ? 'PONTA'
            : (b.z1 - b.z0) > 0.8 ? 'BARRA' : 'ESTACAO';
        } else if (ax >= FAIXA_FERRAGEM.xMin && ax < FAIXA.xMin) {
          /* ▶ A FERRAGEM. Três formas, e a régua é o VÃO EM X, que é o que as
             separa sem ambiguidade: o braço tem 850 mm, a mão-francesa 397 e o
             grampo 99. Tudo o mais que mora nesta janela — o tanque, a borracha
             do berço, as travessas — é grosso em z (> 120 mm) ou atravessa a
             linha de centro, e cai fora antes de chegar aqui. */
          if (faces.length < FAIXA_FERRAGEM.minTris) continue;
          if (b.y0 < FAIXA_FERRAGEM.yMin || b.y1 > FAIXA_FERRAGEM.yMax) continue;
          if ((b.z1 - b.z0) > FAIXA_FERRAGEM.dzMax) continue;
          if (Math.max(Math.abs(b.x0), Math.abs(b.x1)) > FAIXA_FERRAGEM.xMax) continue;
          if (!/metal-preto|inox|ferragem|parafuso/i.test(matNome)) continue;
          const dxc = b.x1 - b.x0;
          papelPre = dxc > 0.60 ? 'BRACO' : dxc > 0.25 ? 'MAO' : 'GRAMPO';
        }
        if (!papelPre) continue;
        if (xc < 0 && papelPre !== 'PONTA') continue;
        if (xc > 0 && papelPre === 'PONTA') temPontaPositiva = true;
        candidatos.push({ xc, papelPre, b, faces, prim, d, pw, M, matNome });

      }
    }
  }

  /* Segunda passada: só agora se sabe se a tampa existe do lado positivo. */
  for (const c of candidatos) {
    const { xc, papelPre, b, faces, prim, d, pw, M, matNome } = c;
    {
      {
        /* Espelha a tampa SÓ se ela não existir do lado bom. */
        if (xc < 0 && temPontaPositiva) continue;
        const espelhar = xc < 0;
        if (b.y1 < FAIXA.yMin || b.y0 > FAIXA.yMax) continue;
        if (b.z0 < FAIXA.zMin || b.z1 > FAIXA.zMax) continue;
        if ((b.z1 - b.z0) > CORRIDO_DO_BAU) continue;

        /* O PAPEL da peça decide o nome da malha de saída, e é ele que o
           runtime usa para saber o que ESTICA e o que LADRILHA:
             · BARRA   — vão em z > 0,8 m: é o corrido, e ele se estica;
             · ESTACAO — o resto: suporte, montante, parafuso, tampa. Repete.
           É o mesmo critério de `RIGID_Z_MAX` em `trailer-assembly.ts` — o VÃO
           EM Z, medido, e não o nome nem o material. */
        /* Três papéis, e o terceiro é a TAMPA. O `plastico-preto` da janela
           são as tampas de ponta das barras (100 × 101 × 149 nas duas alturas)
           mais o painel de 93 × 333 que fecha o vão entre elas. Elas moram na
           PONTA do corrido, longe de qualquer suporte, e por isso a primeira
           versão deste bake as perdeu: a estação canônica é uma janela em
           torno de um suporte, e ali não há nenhum.
           *"aqui no implemento semirreboque possui uma peça de plástico, que
           está faltando nesse"* — Kennedy. */
        /* ⚠️ O PAPEL JÁ FOI DECIDIDO NO PRÉ-FILTRO, e recalculá-lo aqui pela
           regra antiga transformaria o braço (dz 58 mm) em ESTACAO e o poria
           na janela do suporte com o nome errado. */
        const papel = papelPre;
        const chave = `${papel}__${matNome}`;
        estacoes.push({ papel, zc: (b.z0 + b.z1) / 2, dx: b.x1 - b.x0, dy: b.y1 - b.y0,
          z0: b.z0, z1: b.z1, chave, faces, prim, d, M, pw, matNome });
        achados++; tris += faces.length;
        const k2 = `${mm(b.x1 - b.x0)}×${mm(b.y1 - b.y0)}×${mm(b.z1 - b.z0)}`;
        formas.set(k2, (formas.get(k2) || 0) + 1);
        /* ⚠️ A CAIXA-DATUM É SÓ DA GRADE. O braço vai a |x| 374 e o corrido de
           barra a −1 511 em z; deixar a ferragem entrar aqui moveria o x = 0
           (que é a FACE EXTERNA) e o comprimento de origem, que é o que o
           runtime usa para esticar a barra. */
        if (papel === 'BARRA' || papel === 'ESTACAO' || papel === 'PONTA') {
          const bx0 = espelhar ? -b.x1 : b.x0, bx1 = espelhar ? -b.x0 : b.x1;
          cx.x0 = Math.min(cx.x0, bx0); cx.x1 = Math.max(cx.x1, bx1);
          cx.y0 = Math.min(cx.y0, b.y0); cx.y1 = Math.max(cx.y1, b.y1);
          cx.z0 = Math.min(cx.z0, b.z0); cx.z1 = Math.max(cx.z1, b.z1);
        }
      }
    }
  }

  console.log(`achados ${achados} componentes · ${tris.toLocaleString('pt-BR')} triângulos · `
    + `${familias.size} materiais`);
  console.log(`caixa em MUNDO: x ${mm(cx.x0)}…${mm(cx.x1)} · y ${mm(cx.y0)}…${mm(cx.y1)} · z ${mm(cx.z0)}…${mm(cx.z1)}`);
  console.log('formas:', [...formas].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([k, v]) => `${v}× ${k}`).join(' · '));
  if (!achados) { console.error('nada achado.'); process.exit(1); }

  /* ───── A ESTAÇÃO CANÔNICA ─────
     As estações do implemento não estão a passo constante (o corrido dele
     acomoda o trem de pouso e o bogie), então não adianta levar todas: leva-se
     UMA, e o runtime a ladrilha no passo que o baú pedir. A escolhida é a
     mais COMPLETA — a que tem mais componentes —, porque uma estação a que
     falte o parafuso vira a estação de todas depois de ladrilhada. */
  /* A estação se define pelo SUPORTE — a chapa preta de 90 × 250 × 65 que
     desce da estrutura até as barras. Clusterizar por proximidade encadeava:
     a parafusaria fica a 50 mm de distância uma da outra ao longo de 300 mm e
     puxava a estação de ponta inteira, tampa plástica junto. Ancorar no
     suporte é determinístico e pega o que uma estação é. */
  const suportes = estacoes.filter((e) => e.papel === 'ESTACAO'
    && Math.abs(e.dx - 0.090) < 0.02 && Math.abs(e.dy - 0.250) < 0.03)
    .map((e) => e.zc).sort((a, b) => a - b);
  if (!suportes.length) { console.error('nenhum suporte 90×250×65 achado.'); process.exit(1); }
  /* O do MEIO: as pontas trazem arremate que não se repete. */
  const zEstacao = suportes[Math.floor(suportes.length / 2)];
  const vaos = suportes.slice(1).map((z, k) => z - suportes[k]).filter((v) => v > 0.40)
    .sort((a, b) => a - b);
  const passo = vaos.length ? vaos[0] : 1.25;
  const vizinhanca = estacoes.filter((e) => e.papel === 'ESTACAO'
    && Math.abs(e.zc - zEstacao) <= 0.60).sort((a, b) => a.zc - b.zc);
  console.log('  vizinhanca do suporte (+-600 mm):');
  for (const e of vizinhanca) {
    console.log(`    dz=${String(mm(e.zc - zEstacao)).padStart(6)}  ${mm(e.dx)}x${mm(e.dy)}  ${e.matNome}`);
  }
  /* A ferragem viaja com a estação: ela É a estação, vista de dentro. */
  const DA_ESTACAO = new Set(['ESTACAO', 'BRACO', 'MAO', 'GRAMPO']);
  const janela = estacoes.filter((e) => DA_ESTACAO.has(e.papel)
    && Math.abs(e.zc - zEstacao) <= JANELA_ESTACAO);
  for (const e of janela.filter((x) => x.papel !== 'ESTACAO')) {
    console.log(`    ferragem ${e.papel}: ${mm(e.dx)}×${mm(e.dy)} em dz=${mm(e.zc - zEstacao)}`
      + ` · ${e.matNome}`);
  }
  console.log(`suportes em z ${suportes.map(mm).join(', ')} · estação em ${mm(zEstacao)} `
    + `com ${janela.length} componentes · passo ${mm(passo)} mm`);

  /* A TAMPA: a do extremo DIANTEIRO do corrido de origem, rezerada na própria
     ponta. O runtime a põe nas duas pontas de cada corrido, espelhando em z
     para a de trás. */
  const tampas = estacoes.filter((e) => e.papel === 'PONTA');
  const zTampa = tampas.length ? Math.max(...tampas.map((e) => e.zc)) : 0;
  const daPonta = tampas.filter((e) => Math.abs(e.zc - zTampa) <= 0.25);
  for (const e of tampas) console.log(`    tampa dz=${mm(e.zc)} ${mm(e.dx)}x${mm(e.dy)}`);
  console.log(`tampas: ${tampas.length} componentes · a da ponta em z ${mm(zTampa)} `
    + `com ${daPonta.length}`);

  const escolhidos = estacoes.filter((e) => e.papel === 'BARRA'
    || janela.includes(e) || daPonta.includes(e));
  for (const e of escolhidos) {
    let f = familias.get(e.chave);
    if (!f) {
      const pm = (g.materials[e.prim.material] || {}).pbrMetallicRoughness || {};
      f = { pos: [], nrm: [], uv: [], idx: [],
        cor: pm.baseColorFactor || [0.8, 0.8, 0.8, 1],
        metal: pm.metallicFactor ?? 1, rug: pm.roughnessFactor ?? 0.5 };
      familias.set(e.chave, f);
    }
    /* A ESTAÇÃO é rezerada no PRÓPRIO centro, para o runtime a instanciar em
       qualquer z. A BARRA fica onde está: o datum dela é a ponta do corrido. */
    const dzE = DA_ESTACAO.has(e.papel) ? -zEstacao : e.papel === 'PONTA' ? -zTampa : 0;
    const nrm = e.d.attrs.NORMAL ? e.d.attrs.NORMAL.arr : null;
    const uv = e.d.attrs.TEXCOORD_0 ? e.d.attrs.TEXCOORD_0.arr : null;
    const mapa = new Map();
    for (const face of e.faces) {
      for (let k = 0; k < 3; k++) {
        const v = e.d.idx[face * 3 + k];
        let m2 = mapa.get(v);
        if (m2 === undefined) {
          m2 = f.pos.length / 3;
          mapa.set(v, m2);
          f.pos.push(e.pw[v * 3], e.pw[v * 3 + 1], e.pw[v * 3 + 2] + dzE);
          const n = nrm ? direcao(e.M, nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) : [0, 1, 0];
          f.nrm.push(n[0], n[1], n[2]);
          f.uv.push(uv ? uv[v * 2] : 0, uv ? uv[v * 2 + 1] : 0);
        }
        f.idx.push(m2);
      }
    }
  }
  console.log(`levados ${escolhidos.length} de ${estacoes.length} componentes `
    + `(${familias.size} malhas: ${[...familias.keys()].join(', ')})`);

  /* DATUM: x na face externa, y no PISO do implemento, z na ponta traseira. */
  /* ⚠️ O DATUM EM Y É O SOLO, e não o piso do baú de origem.
     Ancorar no piso parece certo e não é: o semirreboque tem o piso a
     1 392 mm e o sobrechassi a 1 151, então uma peça presa ao piso desce
     241 mm ao mudar de implemento — *"está muito baixo a grade"*. As cotas da
     grade são de SOLO por natureza (a borda inferior a 510 mm é o que a
     CONTRAN 805/1995 limita a 550), e é o solo que as carrega intactas para
     qualquer baú. Quem converte solo → local do implemento é o runtime, que
     sabe a que altura o baú assentou. */
  const dx = -cx.x1, dy = 0;
  for (const [chave, f] of familias) {
    /* ⚠️ SÓ A BARRA ANDA EM Z. A estação já foi rezerada no próprio centro, e
       somar o datum do corrido nela a jogaria para fora da peça. */
    const dzF = chave.startsWith('BARRA') ? -cx.z0 : 0;   // ESTACAO e PONTA já rezeradas
    for (let i = 0; i < f.pos.length / 3; i++) {
      f.pos[i * 3] += dx; f.pos[i * 3 + 1] += dy; f.pos[i * 3 + 2] += dzF;
    }
  }

  const bytes = escreve(DST, familias, S.encoder(), D);
  const meta = {
    _nota: 'Extraído de semirreboque_frigorifico_paleteiro.glb por '
      + 'tools/chassis-bake/bake-protecao-lateral.cjs. UM LADO (x positivo); o outro é '
      + 'espelho, feito em runtime. O material carrega só o NOME — quem o resolve é o '
      + 'implemento que recebe a peça, e é assim que ela herda tinta e acabamento.',
    origem: 'models/vehicles/semirreboque_frigorifico_paleteiro.glb',
    datum: { x: 'face externa das barras', y: 'SOLO', z: '0 na ponta traseira' },
    comprimento: +(cx.z1 - cx.z0).toFixed(4),
    /* ⚠️ O RUNTIME ESTICA A BARRA, NÃO A CAIXA. Desde que a tampa de ponta
       entrou na extração, a caixa ficou ~194 mm mais longa que a barra; usar
       `comprimento` como `COMPRIMENTO_ORIGEM` deixaria todo corrido curto. */
    comprimentoBarra: +(() => {
      let z0 = Infinity, z1 = -Infinity;
      for (const e of estacoes) {
        if (e.papel !== 'BARRA') continue;
        z0 = Math.min(z0, e.z0); z1 = Math.max(z1, e.z1);
      }
      return Number.isFinite(z0) ? z1 - z0 : cx.z1 - cx.z0;
    })().toFixed(4),
    /* Onde a barra começa, contado do datum — o runtime encosta a tampa AQUI. */
    barraDesde: +(() => {
      let z0 = Infinity;
      for (const e of estacoes) if (e.papel === 'BARRA') z0 = Math.min(z0, e.z0);
      return Number.isFinite(z0) ? z0 - cx.z0 : 0;
    })().toFixed(4),
    /* Cotas relativas ao PISO — é assim que elas viajam para outro baú. */
    barraBaixa: [0.510, 0.610], barraAlta: [0.910, 1.010],
    malhas: [...familias.keys()],
    passoEstacao: +passo.toFixed(4),
    componentes: achados, triangulos: tris, medidoEm: '2026-08-21',
  };
  fs.writeFileSync(DST.replace(/\.glb$/, '_meta.json'), JSON.stringify(meta, null, 2));
  console.log(`\nESCRITO ${path.relative(WEB, DST)} — ${(bytes / 1024).toFixed(0)} kB`);
  console.log(`malhas: ${meta.malhas.join(' · ')}`);
  console.log(`comprimento do trecho de origem: ${mm(meta.comprimento)} mm · `
    + `>>> BARRA = ${mm(meta.comprimentoBarra)} mm, desde ${mm(meta.barraDesde)} mm do datum`);
  process.exit(0);
})().catch((e) => { console.error('FALHOU:', e.message, e.stack); process.exit(1); });
