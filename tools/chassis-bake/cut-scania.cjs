/* A FAMÍLIA SCANIA P — toco 4x2, truck 6x2 e traçado 6x4 a partir do bitruck.
   ===========================================================================
       node tools/chassis-bake/cut-scania.cjs --ensaio    # só imprime o plano
       node tools/chassis-bake/cut-scania.cjs             # escreve os 3 GLBs

   O ACERVO tem UM rígido Scania: `scania_p_8x2r.glb`, um bitruck. As outras
   três configurações da família saem dele por RECORTE — e a razão de serem
   arquivos, e não peças escondidas em runtime, é o peso: só a rodagem do eixo
   auxiliar são 688 412 triângulos, e escondê-la ainda a baixaria e a
   decodificaria a cada carga.

   POR QUE O SCANIA E NÃO OS OUTROS DOIS
   ---------------------------------------------------------------------------
   Medido por `tools/trailer-bench/axleprobe.cjs`: o rip do Scania é o mais
   fino do acervo — 256 primitivas viram 8 526 componentes conexos, e cada eixo
   é um conjunto próprio. No Volvo VM os dois eixos traseiros estão soldados
   num componente único de 47 366 triângulos; no VW o eixo direcional está
   fundido com a CABINE. Só aqui os três cortes são recorte.

   O ESPAÇO. As regras abaixo estão no NORMALIZADO de `mounts.json`
   (`forward = +Z`, pneu em `y = 0`), que é onde tudo neste projeto é medido. O
   GLB está no CRU. A conversão é `Xn = −Xg · Yn = Yg − groundY · Zn = −Zg`, e
   ela é exata porque os seis nós que este script corta têm matriz IDENTIDADE
   (conferido: `translation`/`rotation`/`scale` ausentes nos seis).

   A DISCIPLINA. Toda regra é conferida pelo que ela DEIXA, não pelo que leva —
   foi assim que o corte do 2º direcional se provou: sobraram 10 componentes na
   zona do eixo e as 10 são quadro (uma travessa entre as almas, quatro
   reforços longitudinais e quatro parafusos no topo do trilho). O modo `--ensaio`
   existe para essa conferência.
*/
const fs = require('fs');
const path = require('path');
const S = require('./glb-surgery.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const SRC = path.join(WEB, 'public', 'models', 'trucks', 'scania_p_8x2r.glb');
const DEST = path.join(WEB, 'public', 'models', 'trucks');

/** De `mounts.json`, a entrada do Scania P. */
const GROUND_Y = -0.0607;

/** Os eixos, no normalizado, medidos pelo ARO em `axleprobe.cjs`. */
const EIXO = { dir1: 1.6402, dir2: -0.5746, trativo: -4.9318, auxiliar: -6.2880 };
/** O vão do tandem — é ele que o enxerto do diferencial translada. */
const VAO_TANDEM = EIXO.auxiliar - EIXO.trativo;          // −1,3562 m

const mm = (v) => (v * 1000).toFixed(0);

/* ────────────────────────── as regras ────────────────────────── */

/**
 * O 2º EIXO DIRECIONAL — o corte que os TRÊS destinos compartilham.
 *
 * `chassis_p14` são os rebites das duas mãos-de-mola, em z −845 e −587 (par
 * separado por 257,5 mm na alma, |x| 411…437). `chassis_p12` traz a viga
 * (3 128 tri, 1 803 × 266 × 179 mm, centrada) mais feixe, grampo, amortecedor
 * e suportes — e as duas exceções são medidas: `dzMax` deixa os reforços
 * longitudinais da longarina (1 754…1 851 mm) e `travessa` deixa a travessa do
 * quadro, que mora na mesma faixa de z.
 */
const CORTE_DIR2 = {
  nome: '2º eixo direcional',
  nos: [
    /^wheel_f_2_0_/, /^wheel_f_3_0_/,
    /* ⚠️ `p\d+`, E NÃO `p[0-3]`. `t_paralama_0` são OITO malhas — arco
       pintado, arco preto, faixa, suporte, trilho e a CHAPA DO PARA-BARRO —,
       e a primeira versão desta regra levou só as quatro primeiras. As
       sobrantes `p6`/`p7` são a chapa de 2 471 × 562 mm em z −1 250: um
       para-barro de um eixo que não existe mais, pendurado no vazio.
       *"a parte de tras do paralamas do bitruck tambem esta flutuando"* —
       Kennedy. Achado pela bancada, ao ver o construtor da barra de apoio
       oferecer suporte a uma peça que já devia ter saído. */
    /^t_paralama_0_p\d+$/,
    /* ⚠️ A SAIA LATERAL SAI JUNTO, e ela não é do eixo — é do CONJUNTO.
       `saia_lat_0_p0` é um painel de 238 × 758 × 769 mm em |x| 1 263, z
       254…1 023, SÓ DO LADO ESQUERDO, e `_p1` é o estribo cromado embaixo
       dele. No bitruck os dois formam uma carenagem contínua com o para-lama
       do 2º direcional, que começa 147 mm atrás deles. Tirado o eixo, a saia
       fica sozinha: um painel escuro pendurado ao lado do tanque, com 190 mm
       de ar acima — e é exatamente o que o dono fotografou nos três.
       *"a saia do paralama deve ficar apenas no bitruck"* — Kennedy.
       ⚠️ Ela JÁ pendurava no 8x2 (medido: mesmo vão de 190 mm). O que muda
       não é a peça, é o vizinho que a fazia ler como carenagem. */
    /^saia_lat_0_p[01]$/,
  ],
  comps: {
    chassis_p14: (b) => b.zc >= -0.90 && b.zc <= -0.55,
    chassis_p12: (b) => b.zc >= -0.90 && b.zc <= -0.35
      && b.dz <= 0.40
      && !(b.y0 >= 0.70 && b.dx >= 0.60),
  },
};

/**
 * O EIXO AUXILIAR — só para o toco.
 *
 * A faixa é o eixo ± 700 mm, e ela é escolhida no VAZIO: o feixe do trativo
 * acaba em z −5 439 e o suporte dianteiro do auxiliar começa em −5 916, então
 * qualquer corte entre −5,50 e −5,90 separa os dois. −5 588 (= −6 288 + 700)
 * cai nesse vazio com folga dos dois lados.
 *
 * ⚠️ A EXCEÇÃO DA TRAVESSA. Dentro da faixa há uma travessa de quadro de
 * 907 mm centrada em z −5 718 (|x| 5, y 367…569) que NÃO é do eixo: ela liga
 * as duas almas e continua fazendo sentido num 4x2. Mas o CORPO DO EIXO
 * também é largo e centrado (1 425 mm). O que os separa é a distância ao
 * centro do eixo — 570 mm contra 4 mm —, e é essa a régua.
 */
const CORTE_AUX = {
  nome: 'eixo auxiliar',
  nos: [/^wheel_r_0_0_/, /^wheel_r_1_0_/],
  comps: {
    /* ⚠️ E A TRAVESSA DE 907 mm VAI JUNTO NO TOCO. Ela é a mesma peça que o
       6x4 remove por interpenetração, e aqui sai por outro motivo: medida
       depois do primeiro corte (`floatprobe.cjs`), ela ficou a **72 mm de
       qualquer outra coisa** — o suporte dianteiro do auxiliar era quem a
       segurava. Eu a tinha mantido por lê-la como travessa de quadro; a
       sonda desmentiu. */
    chassis_p34: (b) => noEixo(b, EIXO.auxiliar)
      || (Math.abs(b.xc) < 0.10 && b.dx > 0.80 && b.zc < -5.60 && b.zc > -5.85),
    chassis_p35: (b) => noEixo(b, EIXO.auxiliar),
    chassis_p36: (b) => noEixo(b, EIXO.auxiliar),
    chassis_p37: (b) => noEixo(b, EIXO.auxiliar),
    chassis_p14: (b) => noEixo(b, EIXO.auxiliar),
  },
};

/** Meia-faixa do eixo auxiliar. Ver o bloco de `CORTE_AUX`. */
const FAIXA_AUX = 0.70;
/** Até onde uma peça larga e centrada ainda é CORPO DE EIXO e não travessa. */
const CORPO_EIXO = 0.25;

function noEixo(b, z) {
  if (Math.abs(b.zc - z) > FAIXA_AUX) return false;
  const largaCentrada = Math.abs(b.xc) < 0.15 && b.dx > 0.80;
  if (largaCentrada && Math.abs(b.zc - z) > CORPO_EIXO) return false;
  return true;
}

/**
 * O ENXERTO DO DIFERENCIAL — só para o traçado.
 *
 * Um 6x4 tem os DOIS eixos traseiros trativos. O auxiliar deste rip já tem
 * rodagem dupla e bitola igual à do trativo (1 748 mm nos dois, medido); o que
 * falta é o diferencial e a carcaça com trombetas. O doador está no próprio
 * arquivo: as peças CENTRADAS do trativo em `chassis_p34` que não têm gêmeo no
 * auxiliar — exatamente a diferença entre um eixo motriz e um eixo morto.
 *
 * ⚠️ E A TRAVESSA DE 907 mm TEM DE SAIR. Ela mora em z −5 758…−5 679, e duas
 * peças do diferencial transladado caem em −5 887…−5 747 e −5 814…−5 669:
 * 11 mm de interpenetração, em x e y sobrepostos. Num 6x4 real aquele vão é do
 * segundo diferencial de qualquer forma.
 */
const ENXERTO_DIF = {
  nome: 'diferencial do 2º eixo trativo',
  de: 'chassis_p34',
  pega: (b) => Math.abs(b.zc - EIXO.trativo) <= 0.75 && Math.abs(b.xc) < 0.10,
  dz: VAO_TANDEM,
  /* O QUE TEM DE SAIR JUNTO COM O ENXERTO — as duas peças de um eixo MORTO
     que um eixo TRATIVO não tem.

     1. A travessa de 907 mm em z −5 758…−5 679 (|x| 5, y 367…569): duas peças
        do diferencial transladado caem em −5 888…−5 747 e −5 815…−5 669, com
        x e y sobrepostos. São 11 mm de interpenetração, e num 6x4 real aquele
        vão é do segundo diferencial de qualquer forma.

     2. ⚠️ A VIGA MORTA DO EIXO AUXILIAR — `chassis_p35`, 1 412 × 161 × 144 mm
        em z −6 363…−6 219. A carcaça enxertada cai em −6 362…−6 207, ou seja
        EXATAMENTE em cima dela, e como a carcaça é mais alta (514 mm contra
        161) a viga fica ENTERRADA dentro. Não dá z-fighting — nenhuma
        superfície coincide —, mas é geometria morta escondida, e um eixo
        trativo não tem viga morta: quem carrega a carga ali é a carcaça.
        Achado na foto de baixo, não na conta. */
  removeTambem: [
    { malha: 'chassis_p34', pega: (b) => Math.abs(b.xc) < 0.10 && b.dx > 0.80
      && b.zc < -5.60 && b.zc > -5.85 },
    { malha: 'chassis_p35', pega: (b) => Math.abs(b.xc) < 0.12 && b.dx > 1.2
      && Math.abs(b.zc - EIXO.auxiliar) < 0.25 },
  ],
};

/* ────────────────────────── as saídas ────────────────────────── */

const SAIDAS = [
  { arquivo: 'scania_p_6x2r.glb', rotulo: 'truck 6x2', cortes: [CORTE_DIR2], enxerto: null,
    eixos: { steerZ: [EIXO.dir1], driveZ: [EIXO.trativo], liftZ: [EIXO.auxiliar] } },
  { arquivo: 'scania_p_4x2r.glb', rotulo: 'toco 4x2', cortes: [CORTE_DIR2, CORTE_AUX], enxerto: null,
    eixos: { steerZ: [EIXO.dir1], driveZ: [EIXO.trativo], liftZ: [] } },
  { arquivo: 'scania_p_6x4r.glb', rotulo: 'traçado 6x4', cortes: [CORTE_DIR2], enxerto: ENXERTO_DIF,
    eixos: { steerZ: [EIXO.dir1], driveZ: [EIXO.trativo, EIXO.auxiliar], liftZ: [] } },
];

/* ────────────────────────── a cirurgia ────────────────────────── */

/** A caixa de um componente, no espaço NORMALIZADO, com os campos das regras. */
function caixaNorm(cru) {
  const b = {
    x0: -cru.x1, x1: -cru.x0,
    y0: cru.y0 - GROUND_Y, y1: cru.y1 - GROUND_Y,
    z0: -cru.z1, z1: -cru.z0,
  };
  b.dx = b.x1 - b.x0; b.dy = b.y1 - b.y0; b.dz = b.z1 - b.z0;
  b.xc = (b.x0 + b.x1) / 2; b.yc = (b.y0 + b.y1) / 2; b.zc = (b.z0 + b.z1) / 2;
  return b;
}

async function fazer(saida, ensaio) {
  const D = await S.decoder();
  const E = ensaio ? null : S.encoder();
  const { g, bin } = S.lerGlb(SRC);
  S.verificaSuporte(g);

  /* 1. NÓS INTEIROS. */
  const padroes = saida.cortes.flatMap((c) => c.nos);
  const foraNo = new Set();
  g.nodes.forEach((n, i) => { if (padroes.some((re) => re.test(n.name || ''))) foraNo.add(i); });

  /* 2. COMPONENTES, malha a malha. */
  const regras = new Map();
  for (const c of saida.cortes) {
    for (const [malha, pega] of Object.entries(c.comps)) {
      const lista = regras.get(malha) || [];
      lista.push(pega); regras.set(malha, lista);
    }
  }
  const enx = saida.enxerto;
  if (enx) {
    for (const r of enx.removeTambem) {
      const lista = regras.get(r.malha) || [];
      lista.push(r.pega); regras.set(r.malha, lista);
    }
  }
  const nomesTocados = new Set([...regras.keys()]);
  if (enx) nomesTocados.add(enx.de);

  const cortes = [];
  const relato = [];
  for (const nome of nomesTocados) {
    const no = g.nodes.find((n) => n.name === nome);
    if (!no) { relato.push(`  ⚠️ nó ${nome} não existe`); continue; }
    const prim = g.meshes[no.mesh].primitives[0];
    const d = S.decodifica(g, bin, prim, D);
    const pos = d.attrs.POSITION.arr;
    const comps = S.componentes(pos, d.idx);

    const pegas = regras.get(nome) || [];
    const fica = [], sai = [];
    const enxertados = [];
    for (const faces of comps) {
      const b = caixaNorm(S.caixaDeFaces(pos, d.idx, faces));
      if (pegas.some((f) => f(b))) sai.push({ faces, b });
      else fica.push({ faces, b });
      if (enx && nome === enx.de && enx.pega(b)) enxertados.push({ faces, b });
    }

    /* O ENXERTO: clona as faces do doador e translada em Z. Como Zn = −Zg,
       mover −1,356 m no normalizado é +1,356 m no cru. */
    let attrs = d.attrs, idx = d.idx;
    let extraFaces = 0;
    if (enxertados.length) {
      const base = S.recorta(attrs, idx, fica.flatMap((c) => c.faces));
      const clone = S.recorta(attrs, idx, enxertados.flatMap((c) => c.faces));
      const nvB = base.attrs.POSITION.arr.length / 3;
      const nvC = clone.attrs.POSITION.arr.length / 3;
      const juntos = {};
      for (const k of Object.keys(base.attrs)) {
        const a = base.attrs[k], c = clone.attrs[k];
        const arr = new Float32Array(a.arr.length + c.arr.length);
        arr.set(a.arr, 0); arr.set(c.arr, a.arr.length);
        if (k === 'POSITION') {
          for (let i = nvB; i < nvB + nvC; i++) arr[i * 3 + 2] -= enx.dz;   // cru = −normalizado
        }
        juntos[k] = { arr, n: a.n, acessor: a.acessor };
      }
      const idxJ = new Uint32Array(base.idx.length + clone.idx.length);
      idxJ.set(base.idx, 0);
      for (let i = 0; i < clone.idx.length; i++) idxJ[base.idx.length + i] = clone.idx[i] + nvB;
      attrs = juntos; idx = idxJ; extraFaces = clone.idx.length / 3;
      cortes.push({ malha: no.mesh, attrs, idx });
    } else {
      const r = S.recorta(attrs, idx, fica.flatMap((c) => c.faces));
      cortes.push({ malha: no.mesh, attrs: r.attrs, idx: r.idx });
    }

    const triSai = sai.reduce((s, c) => s + c.faces.length, 0);
    relato.push(`  ${nome.padEnd(14)} ${String(comps.length).padStart(4)} comp `
      + `· tira ${String(sai.length).padStart(4)} (${String(triSai).padStart(7)} tri) `
      + `· fica ${String(fica.length).padStart(4)}`
      + (extraFaces ? ` · ENXERTA ${extraFaces} tri` : ''));
    if (ensaio && fica.length && fica.length <= 14) {
      for (const c of fica.sort((a, b) => b.faces.length - a.faces.length).slice(0, 8)) {
        relato.push(`       fica ${String(c.faces.length).padStart(6)} tri  `
          + `${mm(c.b.dx)}×${mm(c.b.dy)}×${mm(c.b.dz)} mm  |x|=${mm(Math.abs(c.b.xc))}  `
          + `y ${mm(c.b.y0)}…${mm(c.b.y1)}  zc=${mm(c.b.zc)}`);
      }
    }
  }

  console.log(`\n══ ${saida.rotulo} → ${saida.arquivo}`);
  console.log(`  nós removidos: ${foraNo.size}`);
  for (const l of relato) console.log(l);

  if (ensaio) return null;

  const bin2 = S.aplicaCorte(g, bin, cortes, E, D);
  const r = S.poda(g, bin2, (n, i) => !foraNo.has(i));
  const destino = path.join(DEST, saida.arquivo);
  const bytes = S.escreverGlb(destino, r.g, r.bin);
  const orig = fs.statSync(SRC).size;
  console.log(`  ESCRITO ${saida.arquivo} — ${(bytes / 1048576).toFixed(2)} MB `
    + `(fonte ${(orig / 1048576).toFixed(2)} MB) · ${r.g.nodes.length} nós · `
    + `${r.g.meshes.length} malhas · ${r.g.accessors.length} acessores`);
  return { arquivo: saida.arquivo, bytes, eixos: saida.eixos };
}

(async () => {
  const ensaio = process.argv.includes('--ensaio');
  const feitos = [];
  for (const s of SAIDAS) feitos.push(await fazer(s, ensaio));
  if (!ensaio) {
    console.log('\n--- eixos para mounts.json ---');
    for (const f of feitos.filter(Boolean)) {
      console.log(`  ${f.arquivo}: ${JSON.stringify(f.eixos)}`);
    }
  }
  process.exit(0);
})();
