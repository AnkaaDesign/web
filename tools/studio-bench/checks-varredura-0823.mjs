/* ▶▶ A VARREDURA GERAL DE SOBREPOSIÇÃO — TUDO contra TUDO, na cena montada.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-varredura-0823.mjs

   ⚠️ ESTE PORTÃO EXISTE POR UM ERRO DE MÉTODO, e o §43.10 o registra por
   extenso: a frente do chassi foi feita em DEZ levas, cada uma disparada por
   uma FOTO do dono, e a mesma família de defeito — peça dentro de peça —
   voltou cinco vezes com outro nome. O que faltou nunca foi geometria: foi
   **medir tudo de uma vez, ordenar por profundidade e consertar de cima para
   baixo**.

   O que ele mede, nas DEZ configurações de rígido: cada FAMÍLIA DE PEÇA POSTA
   EM RUNTIME contra a árvore da CABINE **e** contra a do IMPLEMENTO, mais o
   implemento inteiro contra a cabine inteira. Sai ordenado por profundidade,
   com peça, flanco e faixa de z.

   ═══════════════════════════════════════════════════════════════════════════
   QUATRO CONSERTOS EM RELAÇÃO A `sobreposicoes()` DE `checks-chassis-0823.mjs`,
   que é de onde este motor veio. Os dois primeiros são FALSOS NEGATIVOS — o
   modo de falhar mais caro que existe, e o §43.8 já registra um.

   1. **`InstancedMesh` era medida no lugar errado — e é ELA que colide.**
      A varredura antiga usava `o.matrixWorld` e nada mais. Numa `InstancedMesh`
      isso põe TODA a geometria na pose do NÓ, e nenhuma instância está lá: as
      estações da proteção lateral nascem de `setMatrixAt(i, T(0,0,dz))` com o
      nó na ponta traseira do trecho, então as 7 estações reais ficam
      espalhadas por 8 metros e a varredura media todas empilhadas na ponta.
      O suporte mais fundo da grade (`ESTACAO__metal-preto`, 135 mm para dentro
      da face) é justamente a peça que entra no tanque — e era medido num lugar
      em que não existe. Aqui cada instância é um desenhável.

   2. **`fundo` ZERA em geometria alinhada com eixo.** Ele é o máximo, sobre os
      pares de triângulo que se cruzam, da menor aresta da caixa de interseção
      DAS DUAS CAIXAS DE TRIÂNGULO. Quando um dos triângulos é plano e paralelo
      a um plano coordenado — uma chapa, uma face de caixa, o flanco de um
      tanque — essa caixa tem aresta ZERO naquele eixo, e o par inteiro sai com
      `fundo = 0`. Medido na cena de teste deste arquivo: uma barra de 50 mm
      atravessando uma chapa de ponta a ponta dá `fundo` 0. Ou seja o critério
      "< 5 mm" podia estar verde com um buraco na peça.

      Entra `prof`: a caixa que contém os SEGMENTOS DE CRUZAMENTO de verdade
      (interseção triângulo-triângulo resolvida, não a caixa dela), e a MENOR
      aresta dessa caixa. Numa peça que só encosta ela é uma lasca; numa barra
      enfiada numa chapa ela é a espessura do que entrou. O portão reprova por
      `fundo` (continuidade com o número do §43) **e** por `prof`.

   3. **A FUSÃO RENOMEIA.** `applyMerge()` funde o implemento POR MATERIAL e
      esconde os originais: a barra da grade deixa de ser
      `BARRA__metal-galvanizado-mantido_D` e passa a ser
      `FUSAO__BARRA__metal-galvanizado-mantido__b3`, filha de `FUSAO` e não de
      `TS_PROTECAO_LATERAL`. Uma varredura que agrupe por NÓ perde a peça, e
      uma que ignore `visible` mede a cópia escondida — que está na pose de
      ANTES da fusão. Aqui o grupo sai do NOME do que está VISÍVEL.

   4. **Três pares escolhidos a dedo.** Ver acima.

   O TETO É 5 mm, e é o critério de pronto do handoff. */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

/** Teto de profundidade: acima disto é DEFEITO. */
const TETO = 0.005;

/**
 * ▶▶ OS ENCAIXES ASSUMIDOS — o que passa dos 5 mm de propósito.
 *
 * ⚠️ ELES SÃO UMA LISTA, E NÃO UM TETO MAIOR. A tentação, com um portão que
 * acusa 97 pares, é subir o critério até ele ficar verde; isso apaga o defeito
 * junto com o encaixe. Aqui cada par que passa dos 5 mm está NOMEADO, com a
 * profundidade medida e o motivo — e com um TETO PRÓPRIO, que é o que
 * transforma a lista num portão de regressão em vez de numa anistia: se um
 * deles piorar, o portão cai.
 *
 * O critério para entrar aqui é duplo e os dois valem: a peça está montada
 * assim POR PROJETO **e** o cruzamento mora entre as longarinas, sob o baú, com
 * as duas peças pretas. Nenhum deles aparece no flanco — o achado mais externo
 * da tabela inteira está em |x| 458 mm.
 */
const ASSUMIDOS = [
  { /* §25.2: as longarinas do sub-chassi estão em |x| 0,374…0,439, A CAVALO
       sobre a alma de 0,425. Um sobrechassi ABRAÇA a longarina do caminhão e é
       aparafusado nela; as 11…16 manchas discretas são as estações de
       parafuso. Fechar isso move `frameTopY`, o piso, o teto e o balanço. */
    a: /^FUSAO__metal-preto__b[23]$/,
    b: /^(chassis_p\d+|truck_p\d+|chs_base_0_p\d+)$/,
    /* ⚠️ E COM TETO DE |x|. O que autoriza este encaixe não é o par de nomes —
       é ONDE ele mora: entre as longarinas, sob o baú. O mesmo par de peças
       cruzando no FLANCO seria defeito, e a regra tem de dizer isso. */
    xMax: 0.60,
    teto: 0.115, porque: 'sobrechassi a cavalo na longarina (§25.2)' },
  { /* O berço do tanque do VM contra a longarina do Scania: é ali que ele se
       prende (§41). */
    a: /^TANK_[RL]_\d+$/, b: /^chassis_p12$/,
    teto: 0.040, porque: 'berço do tanque do VM na longarina (§41)' },
  { /* §35: o braço do para-barro NASCE onde a estrutura acaba. */
    a: /^TS_CHASSI_BARRA_/, b: /^chassis_p12$/,
    teto: 0.030, porque: 'o braço do para-barro nasce NA estrutura (§35)' },
  { /* O para-barro de FÁBRICA do Scania — rip contra rip, e contra o tanque
       novo, que é o que este motor põe no lugar do de fábrica. */
    a: /^t_paralama_0_p[0-9]+$/, b: /^(chassis_p\d+|TANK_[RL]_\d+|wheel_)/,
    /* Inclui o cubo cromado da roda do VM raspando o para-lama de FÁBRICA do
       Scania: `prof` 2 mm de penetração real contra `fundo` 6 (a superfície é
       curva, e é aí que `fundo` exagera). A roda do VM é 26 mm maior em
       diâmetro que a de fábrica — §36 — e o arco é do rip. */
    teto: 0.030, porque: 'para-barro de fábrica do Scania × roda do VM (rip, §36)' },
  { /* ⚠️ PENDENTE, e assumido com número em vez de escondido. A TAMPA DE PONTA
       do corrido dianteiro raspa a SAIA DA CABINE do VM (`chs_base_0_p3`) em
       11 mm, a |x| 1 175 — 76 mm dentro da face da grade, no VM 6x2 e 4x2. A
       saia não entra em `truckObstacles()` nem na lista da estação, e por isso
       o recuo de ponta não a alcança; achar por que é o próximo passo desta
       frente. O teto de 20 mm é o que impede a coisa de piorar em silêncio. */
    a: /^FUSAO__metal-galvanizado-mantido__b\d+$/, b: /^chs_base_0_p3$/,
    teto: 0.020, porque: '⚠ PENDENTE — tampa de ponta × saia da cabine do VM' },
  { /* ▶ O ARCO DO 2º DIRECIONAL × O EQUIPAMENTO DE FLANCO DA CABINE.
       Medido depois de §45.2 (corte em z) e §45.3 (coroa sob a mesa): o que
       sobra é a PERNA DE DENTRO do arco, em |x| 468…905 e y 760…940, contra a
       caixa de bateria, o silencioso e os reservatórios do VM e contra o
       `truck_p4` do VW. Fundo máximo 64 mm.

       É o argumento de §43.9 com o número certo: **o casco de um para-lama
       nasce na longarina** (vai de |x| 600 a 1 235, porque é assim que ele se
       prende) e os três rígidos guardam equipamento exatamente nessa faixa.
       Fechar exigiria um arco mais estreito que o pneu. Fica sob o caminhão,
       atrás da roda e atrás da própria caixa — e o teto de 70 mm é o que
       impede que piore em silêncio. */
    a: /^t_paralama_0_p\d+$/,
    b: /^(chs_base_0_p\d+|truck_p\d+|chassis_p\d+)$/,
    xMax: 0.95,
    teto: 0.070, porque: 'perna de dentro do arco × equipamento de flanco (§45.4)' },
  { /* ⚠️ PENDENTE, e assumido com número em vez de escondido. A TAMPA DE PONTA
       do corrido raspa, nas duas bordas da baia do tandem do VW, uma aba de
       `truck_p4` que está em |x| 1 181…1 199 e y 814…958 — 30 a 32 mm, ou seja
       70 mm para dentro da face da grade, entre as duas barras.

       Ela não entra em `truckObstacles()` nem no raio da baia, e a razão é a de
       sempre neste caminhão: **`truck_p4` é UMA malha com o VW inteiro dentro**,
       e nenhuma peneira por nome ou por componente a alcança. O caminho é o de
       §41 — isolar por componente conexo dentro de um volume, como
       `swapSpareWheel()` faz no Scania — e é o próximo passo desta frente.
       O teto de 40 mm é o que impede que piore em silêncio. */
    a: /^FUSAO__metal-galvanizado-mantido__b\d+$/, b: /^truck_p4$/,
    teto: 0.040, porque: '⚠ PENDENTE — tampa de ponta × aba do `truck_p4` (VW)' },
  { /* A testeira do sobrechassi contra a traseira da cabine do VW. */
    a: /^FUSAO__metal-(estrutura-principal-padrao|galvanizado-polido)__b[23]$/,
    b: /^truck_p4$/,
    teto: 0.035, porque: 'testeira do sobrechassi na traseira da cabine' },
];
/** Este par está assumido? Devolve o teto dele, ou `null`. */
function assumido(a, b, x) {
  for (const r of ASSUMIDOS) {
    if (!((r.a.test(a) && r.b.test(b)) || (r.a.test(b) && r.b.test(a)))) continue;
    if (r.xMax !== undefined && Math.abs(x) > r.xMax) continue;
    return r;
  }
  return null;
}
/** Abaixo disto nem se relata — é ruído de triangulação. */
const PISO_RELATO = 0.001;
/** Folga do teste de separação: dois triângulos que se aproximam menos que
 *  isto contam como SEPARADOS, e é o que impede que contato de montagem
 *  (chapa apoiada em chapa) vire achado. */
const FOLGA = 0.002;

/* ══════════════════════ triângulo × triângulo ══════════════════════ */
function separa(ex, ey, ez, A, Bt) {
  const n2 = ex * ex + ey * ey + ez * ez;
  if (n2 < 1e-16) return false;
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let i = 0; i < 9; i += 3) {
    const p = ex * A[i] + ey * A[i + 1] + ez * A[i + 2];
    if (p < a0) a0 = p; if (p > a1) a1 = p;
    const q = ex * Bt[i] + ey * Bt[i + 1] + ez * Bt[i + 2];
    if (q < b0) b0 = q; if (q > b1) b1 = q;
  }
  const tol = FOLGA * Math.sqrt(n2);
  return a1 < b0 + tol || b1 < a0 + tol;
}
function cruzam(A, Bt) {
  const u = [A[3] - A[0], A[4] - A[1], A[5] - A[2],
    A[6] - A[3], A[7] - A[4], A[8] - A[5],
    A[0] - A[6], A[1] - A[7], A[2] - A[8]];
  const v = [Bt[3] - Bt[0], Bt[4] - Bt[1], Bt[5] - Bt[2],
    Bt[6] - Bt[3], Bt[7] - Bt[4], Bt[8] - Bt[5],
    Bt[0] - Bt[6], Bt[1] - Bt[7], Bt[2] - Bt[8]];
  const cr = (a, i, b, j) => [
    a[i + 1] * b[j + 2] - a[i + 2] * b[j + 1],
    a[i + 2] * b[j] - a[i] * b[j + 2],
    a[i] * b[j + 1] - a[i + 1] * b[j],
  ];
  let n = cr(u, 0, u, 3);
  if (separa(n[0], n[1], n[2], A, Bt)) return false;
  n = cr(v, 0, v, 3);
  if (separa(n[0], n[1], n[2], A, Bt)) return false;
  for (let i = 0; i < 9; i += 3) {
    for (let j = 0; j < 9; j += 3) {
      n = cr(u, i, v, j);
      if (separa(n[0], n[1], n[2], A, Bt)) return false;
    }
  }
  return true;
}

/**
 * O SEGMENTO DE CRUZAMENTO de dois triângulos que já se sabe cruzados.
 *
 * ⚠️ É o que salva o portão do falso negativo do item 2 do cabeçalho. A caixa
 * de dois triângulos não diz ONDE eles se encontram; o segmento diz. A conta é
 * a clássica: cada triângulo é cortado pelo PLANO do outro (um segmento cada,
 * os dois sobre a reta de interseção dos planos), e o cruzamento é a
 * sobreposição dos dois ao longo de `nA × nB`.
 *
 * Escreve `[x0,y0,z0,x1,y1,z1]` em `saida` e a devolve; `null` quando os
 * planos são paralelos — um par coplanar não descreve penetração nenhuma.
 */
function segmento(A, Bt, saida) {
  const ax = A[3] - A[0], ay = A[4] - A[1], az = A[5] - A[2];
  const bx = A[6] - A[0], by = A[7] - A[1], bz = A[8] - A[2];
  const nax = ay * bz - az * by, nay = az * bx - ax * bz, naz = ax * by - ay * bx;
  const cx = Bt[3] - Bt[0], cy = Bt[4] - Bt[1], cz = Bt[5] - Bt[2];
  const dx = Bt[6] - Bt[0], dy = Bt[7] - Bt[1], dz = Bt[8] - Bt[2];
  const nbx = cy * dz - cz * dy, nby = cz * dx - cx * dz, nbz = cx * dy - cy * dx;
  const ex = nay * nbz - naz * nby, ey = naz * nbx - nax * nbz, ez = nax * nby - nay * nbx;
  if (ex * ex + ey * ey + ez * ez < 1e-20) return null;

  /** Os pontos em que o triângulo `T` corta o plano (n, p). No máximo dois. */
  const corta = (T, nx, ny, nz, px, py, pz) => {
    const d = [
      nx * (T[0] - px) + ny * (T[1] - py) + nz * (T[2] - pz),
      nx * (T[3] - px) + ny * (T[4] - py) + nz * (T[5] - pz),
      nx * (T[6] - px) + ny * (T[7] - py) + nz * (T[8] - pz),
    ];
    const ps = [];
    for (let k = 0; k < 3; k++) {
      const j = (k + 1) % 3;
      const s = d[k], t = d[j];
      if ((s > 0 && t > 0) || (s < 0 && t < 0) || s === t) continue;
      const u = s / (s - t);
      ps.push([T[k * 3] + u * (T[j * 3] - T[k * 3]),
        T[k * 3 + 1] + u * (T[j * 3 + 1] - T[k * 3 + 1]),
        T[k * 3 + 2] + u * (T[j * 3 + 2] - T[k * 3 + 2])]);
    }
    return ps.length >= 2 ? ps : null;
  };
  const pa = corta(A, nbx, nby, nbz, Bt[0], Bt[1], Bt[2]);
  const pb = corta(Bt, nax, nay, naz, A[0], A[1], A[2]);
  if (!pa || !pb) return null;
  const w = (p) => ex * p[0] + ey * p[1] + ez * p[2];
  pa.sort((p, q) => w(p) - w(q));
  pb.sort((p, q) => w(p) - w(q));
  const A0 = pa[0], A1 = pa[pa.length - 1];
  const w0 = Math.max(w(A0), w(pb[0]));
  const w1 = Math.min(w(A1), w(pb[pb.length - 1]));
  if (w1 < w0) return null;
  const den = w(A1) - w(A0);
  const t0 = Math.abs(den) > 1e-20 ? (w0 - w(A0)) / den : 0;
  const t1 = Math.abs(den) > 1e-20 ? (w1 - w(A0)) / den : 0;
  for (let k = 0; k < 3; k++) {
    saida[k] = A0[k] + t0 * (A1[k] - A0[k]);
    saida[3 + k] = A0[k] + t1 * (A1[k] - A0[k]);
  }
  return saida;
}

/** Visível de verdade — `swapTruckWheels()` apaga a rodagem original e
 *  `applyMerge()` apaga TUDO que fundiu. */
function ligado(o, ate) {
  for (let p = o; p && p !== ate.parent; p = p.parent) if (!p.visible) return false;
  return true;
}
function batismo(o, ate) {
  if (o.name) return o.name;
  for (let p = o.parent; p && p !== ate.parent; p = p.parent) {
    if (p.name) return `${p.name}/·`;
  }
  return '(sem nome)';
}

/**
 * A FAMÍLIA a que uma peça pertence, pelo NOME — ver o item 3 do cabeçalho.
 *
 * Ela é o sujeito da varredura, e não o nó: depois de `applyMerge()` a barra
 * da grade não é mais filha de `TS_PROTECAO_LATERAL`, e o NOME é a única coisa
 * que sobrevive à fusão.
 */
function familia(nome) {
  const n = nome.replace(/^FUSAO__/, '');
  if (/^TS_PARALAMA_DIR2|^t_paralama/.test(n)) return 'para-lama-2dir';
  if (/^(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(n)) return 'grade-lateral';
  if (/^TS_TANQUE_VM|^TANK_[RL]/.test(n)) return 'tanque-VM';
  if (/^TS_CHASSI_/.test(n)) return 'pecas-de-chassi';
  if (/^TS_FAIXA_TRASEIRA/.test(n)) return 'faixa-refletiva';
  if (/^VM_WHEEL_SPARE/.test(n)) return 'estepe';
  if (/^VM_WHEEL_/.test(n)) return 'roda-VM';
  if (/^PLACA/.test(n)) return 'placa';
  return null;
}

/** A ÁRVORE ACHATADA EM DESENHÁVEIS — um por malha, e UM POR INSTÂNCIA. */
function achata(raiz, ondeMora) {
  raiz.updateWorldMatrix(true, true);
  const arr = [];
  raiz.traverse((o) => {
    if (!o.isMesh || !ligado(o, raiz)) return;
    const g = o.geometry;
    const pos = g && g.getAttribute && g.getAttribute('position');
    if (!pos || !pos.count) return;
    const idx = g.getIndex();
    const nT = idx ? idx.count / 3 : pos.count / 3;
    if (!nT) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const nome = batismo(o, raiz);
    const fam = familia(nome);
    if (o.isInstancedMesh) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m);
        arr.push({ o, nome, fam, onde: ondeMora, mat: w,
          bb: g.boundingBox.clone().applyMatrix4(w), nT });
      }
    } else {
      arr.push({ o, nome, fam, onde: ondeMora, mat: o.matrixWorld,
        bb: g.boundingBox.clone().applyMatrix4(o.matrixWorld), nT });
    }
  });
  return arr;
}

/** Os triângulos de um desenhável, em MUNDO, cuja caixa toca `caixa`. */
function tris(d, caixa, orc) {
  const g = d.o.geometry;
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const nT = idx ? idx.count / 3 : pos.count / 3;
  const m = d.mat;
  const res = [];
  const p = new THREE.Vector3();
  orc.lidos += nT;
  for (let f = 0; f < nT; f++) {
    const t = new Float64Array(9);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const vi = idx ? idx.getX(f * 3 + k) : f * 3 + k;
      p.fromBufferAttribute(pos, vi).applyMatrix4(m);
      t[k * 3] = p.x; t[k * 3 + 1] = p.y; t[k * 3 + 2] = p.z;
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
    }
    if (x1 < caixa.min.x || x0 > caixa.max.x) continue;
    if (y1 < caixa.min.y || y0 > caixa.max.y) continue;
    if (z1 < caixa.min.z || z0 > caixa.max.z) continue;
    res.push({ t, x0, x1, y0, y1, z0, z1, q: d.nome });
    if (res.length >= orc.porMalha) {
      orc.cortados.push(`${d.nome} (${nT} tri)`);
      break;
    }
  }
  return res;
}

/**
 * OS BLOCOS DE CRUZAMENTO — e é o que torna `prof` uma medida LOCAL.
 *
 * ⚠️ A caixa de TODOS os cruzamentos entre duas peças não mede penetração
 * nenhuma quando o contato é distribuído: o sobrechassi encosta na longarina
 * ao longo de 8,4 m e a caixa sai com 8 443 mm em z. O que interessa é cada
 * MANCHA de cruzamento: os pontos são jogados numa grade de 120 mm, as células
 * vizinhas (26 vizinhos) viram um bloco, e `prof` é a MENOR aresta da caixa do
 * MAIOR bloco — a espessura do que entrou ali.
 *
 * 120 mm é maior que o passo de triangulação destas peças (senão uma mancha se
 * parte em várias) e menor que a menor peça que se quer distinguir.
 */
const CEL_BLOCO = 0.12;
function blocos(pts) {
  const n = pts.length / 3;
  if (!n) return { prof: 0, reg: [0, 0, 0], n: 0 };
  const cel = new Map();
  for (let i = 0; i < n; i++) {
    const a = Math.floor(pts[i * 3] / CEL_BLOCO);
    const b = Math.floor(pts[i * 3 + 1] / CEL_BLOCO);
    const c = Math.floor(pts[i * 3 + 2] / CEL_BLOCO);
    const k = `${a},${b},${c}`;
    let v = cel.get(k);
    if (!v) { v = { a, b, c, i: [] }; cel.set(k, v); }
    v.i.push(i);
  }
  const pai = new Map();
  const acha = (k) => { while (pai.get(k) !== k) { pai.set(k, pai.get(pai.get(k))); k = pai.get(k); } return k; };
  for (const k of cel.keys()) pai.set(k, k);
  for (const [k, v] of cel) {
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
      if (!da && !db && !dc) continue;
      const k2 = `${v.a + da},${v.b + db},${v.c + dc}`;
      if (!cel.has(k2)) continue;
      const r1 = acha(k), r2 = acha(k2);
      if (r1 !== r2) pai.set(r1, r2);
    }
  }
  const grupos = new Map();
  for (const [k, v] of cel) {
    const r = acha(k);
    let g = grupos.get(r);
    if (!g) { g = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 }; grupos.set(r, g); }
    for (const i of v.i) {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x;
      if (y < g.y0) g.y0 = y; if (y > g.y1) g.y1 = y;
      if (z < g.z0) g.z0 = z; if (z > g.z1) g.z1 = z;
      g.n++;
    }
  }
  let prof = 0, reg = [0, 0, 0];
  for (const g of grupos.values()) {
    const r = [g.x1 - g.x0, g.y1 - g.y0, g.z1 - g.z0];
    const p = Math.min(r[0], r[1], r[2]);
    if (p > prof) { prof = p; reg = r; }
  }
  return { prof, reg, n: grupos.size };
}

/** O CRUZAMENTO ENTRE DOIS CONJUNTOS DE DESENHÁVEIS. */
function cruzaConjuntos(meus, outros, N, orc) {
  if (!meus.length || !outros.length) return [];
  const cxM = new THREE.Box3();
  for (const d of meus) cxM.union(d.bb);
  if (cxM.isEmpty()) return [];
  const cands = outros.filter((d) => d.bb.intersectsBox(cxM));
  if (!cands.length) return [];
  const cxC = new THREE.Box3();
  for (const d of cands) cxC.union(d.bb);
  const zona = cxM.clone().intersect(cxC);
  if (zona.isEmpty()) return [];

  const CEL = 0.08;
  const lista = [];
  for (const d of meus) for (const t of tris(d, zona, orc)) lista.push(t);
  if (!lista.length) return [];
  const balde = new Map();
  lista.forEach((tr, i) => {
    for (let a = Math.floor(tr.x0 / CEL); a <= Math.floor(tr.x1 / CEL); a++) {
      for (let b = Math.floor(tr.y0 / CEL); b <= Math.floor(tr.y1 / CEL); b++) {
        for (let c = Math.floor(tr.z0 / CEL); c <= Math.floor(tr.z1 / CEL); c++) {
          const k = `${a},${b},${c}`;
          let v = balde.get(k);
          if (!v) { v = []; balde.set(k, v); }
          v.push(i);
        }
      }
    }
  });

  const achados = new Map();
  const seg = new Float64Array(6);
  const q = new THREE.Vector3();
  for (const d of cands) {
    if (!d.bb.intersectsBox(zona)) continue;
    for (const tr of tris(d, zona, orc)) {
      const vistos = new Set();
      for (let a = Math.floor(tr.x0 / CEL); a <= Math.floor(tr.x1 / CEL); a++) {
        for (let b = Math.floor(tr.y0 / CEL); b <= Math.floor(tr.y1 / CEL); b++) {
          for (let c = Math.floor(tr.z0 / CEL); c <= Math.floor(tr.z1 / CEL); c++) {
            const cel = balde.get(`${a},${b},${c}`);
            if (!cel) continue;
            for (const i of cel) {
              if (vistos.has(i)) continue;
              vistos.add(i);
              const me = lista[i];
              if (tr.x1 < me.x0 || me.x1 < tr.x0) continue;
              if (tr.y1 < me.y0 || me.y1 < tr.y0) continue;
              if (tr.z1 < me.z0 || me.z1 < tr.z0) continue;
              if (!cruzam(me.t, tr.t)) continue;
              const ix0 = Math.max(tr.x0, me.x0), ix1 = Math.min(tr.x1, me.x1);
              const iy0 = Math.max(tr.y0, me.y0), iy1 = Math.min(tr.y1, me.y1);
              const iz0 = Math.max(tr.z0, me.z0), iz1 = Math.min(tr.z1, me.z1);
              /* ⚠️ O LADO ENTRA NA CHAVE. Sem ele os dois flancos viram um par
                 só e a região passa a ter 2,4 m de largura — a mesma armadilha
                 que §43.6 registra ("a união dos dois lados dava sempre 2,1 m
                 e mascarou o defeito"). */
              const meio = new THREE.Vector3((ix0 + ix1) / 2, (iy0 + iy1) / 2, (iz0 + iz1) / 2)
                .applyMatrix4(N);
              const lado = meio.x >= 0 ? 'D' : 'E';
              const chave = `${me.q}▸${tr.q}|${lado}`;
              let e = achados.get(chave);
              if (!e) {
                e = { minha: me.q, dele: tr.q, dono: d, n: 0, fundo: 0, lado, pts: [],
                  px: [Infinity, -Infinity], py: [Infinity, -Infinity], pz: [Infinity, -Infinity],
                  cx: [Infinity, -Infinity], cy: [Infinity, -Infinity], cz: [Infinity, -Infinity] };
                achados.set(chave, e);
              }
              e.n++;
              e.fundo = Math.max(e.fundo, Math.min(ix1 - ix0, iy1 - iy0, iz1 - iz0));
              /* ▶ O SEGMENTO DE VERDADE, e é ele que dá `prof`. */
              const s = segmento(me.t, tr.t, seg);
              const pontos = s ? [[s[0], s[1], s[2]], [s[3], s[4], s[5]]]
                : [[(ix0 + ix1) / 2, (iy0 + iy1) / 2, (iz0 + iz1) / 2]];
              for (const p of pontos) {
                if (p[0] < e.px[0]) e.px[0] = p[0]; if (p[0] > e.px[1]) e.px[1] = p[0];
                if (p[1] < e.py[0]) e.py[0] = p[1]; if (p[1] > e.py[1]) e.py[1] = p[1];
                if (p[2] < e.pz[0]) e.pz[0] = p[2]; if (p[2] > e.pz[1]) e.pz[1] = p[2];
                q.set(p[0], p[1], p[2]).applyMatrix4(N);
                if (e.pts.length < 12000) e.pts.push(q.x, q.y, q.z);
                if (q.x < e.cx[0]) e.cx[0] = q.x; if (q.x > e.cx[1]) e.cx[1] = q.x;
                if (q.y < e.cy[0]) e.cy[0] = q.y; if (q.y > e.cy[1]) e.cy[1] = q.y;
                if (q.z < e.cz[0]) e.cz[0] = q.z; if (q.z > e.cz[1]) e.cz[1] = q.z;
              }
            }
          }
        }
      }
    }
  }
  return [...achados.values()]
    .map((e) => {
      const b = blocos(e.pts);
      return {
        minha: e.minha, dele: e.dele, dono: e.dono, n: e.n, fundo: e.fundo,
        prof: b.prof, reg: b.reg, blocos: b.n, lado: e.lado,
        x: (e.cx[0] + e.cx[1]) / 2, y: (e.cy[0] + e.cy[1]) / 2,
        z0: e.cz[0], z1: e.cz[1],
      };
    })
    .filter((e) => Math.max(e.fundo, e.prof) >= PISO_RELATO)
    .sort((a, b) => Math.max(b.fundo, b.prof) - Math.max(a.fundo, a.prof));
}

/* ══════════════════════ o portão se confere ══════════════════════
   §43.8 registra a inversa aplicada DUAS VEZES, com o portão dizendo "nada" e
   o defeito na foto. A cena de teste exercita exatamente o que este motor
   conserta: uma CHAPA girada 25° e uma BARRA em `InstancedMesh` de três
   instâncias, com o NÓ a 1,5 m e só a do meio atravessando. */
{
  const cena = (dz) => {
    const raizA = new THREE.Group();
    const chapa = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.40, 0.010),
      new THREE.MeshBasicMaterial());
    chapa.name = 'CHAPA';
    chapa.rotation.x = 25 * Math.PI / 180;
    chapa.position.z = dz;
    raizA.add(chapa);
    raizA.updateWorldMatrix(true, true);

    const raizB = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.30);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 3);
    im.name = 'BARRA_TESTE';
    im.position.z = 1.5;
    const m = new THREE.Matrix4();
    im.setMatrixAt(0, m.makeTranslation(0, 0, -3.0));
    im.setMatrixAt(1, m.makeTranslation(0, 0, -1.5));
    im.setMatrixAt(2, m.makeTranslation(0, 0, 3.0));
    im.instanceMatrix.needsUpdate = true;
    raizB.add(im);
    raizB.updateWorldMatrix(true, true);
    return [achata(raizA, 'A'), achata(raizB, 'B')];
  };
  const orc = { lidos: 0, porMalha: 200000, cortados: [] };
  const [fa, fb] = cena(0);
  const r = cruzaConjuntos(fa, fb, new THREE.Matrix4(), orc);
  const [fa2, fb2] = cena(1.0);
  const r2 = cruzaConjuntos(fa2, fb2, new THREE.Matrix4(), orc);
  const centro = r[0] ? Math.hypot(r[0].x, r[0].y, (r[0].z0 + r[0].z1) / 2) : 99;
  /* A barra tem 50 mm de lado; a chapa, 10 mm girada 25°, corta esses 50 mm
     num vão de 10/cos25 + 50·tan25 = 34 mm. É esse número que `prof` tem de
     devolver — e é o que `fundo` não sabe medir. */
  out.push(['sanidade do motor de varredura',
    `atravessando: ${r.length} par(es) · fundo ${r[0] ? mm(r[0].fundo) : '—'} mm`
    + ` · prof ${r[0] ? mm(r[0].prof) : '—'} mm (esperado ~34)`
    + ` · região ${r[0] ? `${mm(r[0].reg[0])}×${mm(r[0].reg[1])}×${mm(r[0].reg[2])}` : '—'}`
    + ` · centro a ${mm(centro)} mm da origem · afastado 1 m: ${r2.length} par(es)`]);
  out.push(['★ o motor acha a barra que atravessa a chapa (e ela é INSTANCIADA)',
    r.length === 1 && centro < 0.030]);
  out.push(['★ …e mede a penetração de verdade (prof 34 ± 3 mm)',
    !!r[0] && Math.abs(r[0].prof - 0.034) < 0.003]);
  out.push(['★ …e `fundo` sozinho NÃO a veria (é por isso que `prof` existe)',
    !!r[0] && r[0].fundo < 0.001]);
  out.push(['★ …e não inventa cruzamento onde não há', r2.length === 0]);
  {
    const [fa3, fb3] = cena(0);
    const semInst = [{ ...fb3[0], mat: fb3[0].o.matrixWorld,
      bb: fb3[0].o.geometry.boundingBox.clone().applyMatrix4(fb3[0].o.matrixWorld) }];
    const r3 = cruzaConjuntos(fa3, semInst, new THREE.Matrix4(), orc);
    out.push(['★ …e a leitura pela matriz do NÓ (o jeito antigo) NÃO acharia',
      r3.length === 0]);
  }
}

/* ══════════════════════ a varredura ══════════════════════ */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}

/** A tabela global, para o resumo ordenado do fim. */
const tabela = [];

for (const a of alvos) {
  const rot = `${a.mo.id}/${a.c.id}`;
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  const cab = S.state.cab;
  const imp = S.state.trailer;
  const mount = S.state.cabMount;
  if (!mount || !cab || !imp) { out.push([`★ ${rot} · tem cabine, implemento e mounts`, false]); continue; }

  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());

  const t0 = performance.now();
  const fCab = achata(cab, 'cabine');
  const fImp = achata(imp, 'implemento');
  const tudo = [...fCab, ...fImp];
  const orc = { lidos: 0, porMalha: 400000, cortados: [] };

  const familias = [...new Set(tudo.map((d) => d.fam).filter(Boolean))].sort();
  out.push([`${rot} · árvore`, `cabine ${fCab.length} desenháveis / `
    + `${(fCab.reduce((s, d) => s + d.nT, 0) / 1000).toFixed(0)} k tri · implemento `
    + `${fImp.length} / ${(fImp.reduce((s, d) => s + d.nT, 0) / 1000).toFixed(0)} k tri `
    + `· famílias de runtime na tela: ${familias.join(' · ') || 'NENHUMA'}`]);

  /* ── as COTAS que a foto discute ──
     ⚠️ A BARRIGA É MEDIDA POR VÉRTICE, e não por caixa de malha: a caixa de
     uma malha que atravessa o implemento inteiro (o perímetro inferior tem
     14,5 m) toca o flanco e o centro ao mesmo tempo, e o `min.y` dela é o do
     centro. É a mesma armadilha que `truckObstacles()` documenta. */
  {
    const menorY = (lista, x0, x1, filtro) => {
      let y = Infinity;
      const v = new THREE.Vector3();
      for (const d of lista) {
        if (filtro && !filtro(d)) continue;
        const pos = d.o.geometry.getAttribute('position');
        const L2N = new THREE.Matrix4().copy(N).multiply(d.mat);
        const passo = pos.count > 60000 ? 4 : 1;
        for (let i = 0; i < pos.count; i += passo) {
          v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
          const ax = Math.abs(v.x);
          if (ax < x0 || ax > x1) continue;
          if (v.y < y) y = v.y;
        }
      }
      return y;
    };
    const faixaY = (lista, re) => {
      let y0 = Infinity, y1 = -Infinity, xf = 0, xd = Infinity;
      const v = new THREE.Vector3();
      for (const d of lista) {
        if (!re.test(d.nome.replace(/^FUSAO__/, ''))) continue;
        const pos = d.o.geometry.getAttribute('position');
        const L2N = new THREE.Matrix4().copy(N).multiply(d.mat);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
          if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
          const ax = Math.abs(v.x);
          if (ax > xf) xf = ax; if (ax < xd) xd = ax;
        }
      }
      return { y0, y1, xf, xd };
    };
    const barra = faixaY(fImp, /^BARRA__/);
    const est = faixaY(fImp, /^ESTACAO__/);
    const daGrade = (d) => /^(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(d.nome.replace(/^FUSAO__/, ''));
    const barriga = menorY(fImp, 1.00, 1.32, (d) => !daGrade(d));
    const subchassi = menorY(fImp, 0.30, 0.62, (d) => !daGrade(d));
    /* ▶▶ E O COMPRIMENTO DA GRADE, que é a estrela que faltava.
       ⚠️ UM PORTÃO QUE SÓ CONTA SOBREPOSIÇÃO NÃO SABE DIZER QUE A PEÇA SUMIU.
       §45.1: uma regra de recuo generalizada comeu o corrido do VW até sobrar
       713 mm num flanco de 8,5 m — e este portão ficou MAIS verde, porque grade
       que não existe não cruza nada. O contrapeso é medir o que a peça COBRE. */
    /* ⚠️ A MEDIDA SAI DO NÓ, e não do nome da malha. Depois que o material da
       grade passou a resolver certo (§44.6), a barra funde em
       `FUSAO__metal-galvanizado-mantido__b3` e o prefixo `BARRA__` some da
       cena: a primeira versão desta conta devolvia 0 mm nas dez configurações.
       `Box3.setFromObject` no nó `TS_PROTECAO_LATERAL` ignora visibilidade e é
       o envelope do conjunto, que é o que se quer. */
    let corrido = 0;
    const noGrade = imp.getObjectByName('TS_PROTECAO_LATERAL');
    if (noGrade) {
      const bb = new THREE.Box3().setFromObject(noGrade);
      if (!bb.isEmpty()) {
        const cs = [];
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) {
          for (const z of [bb.min.z, bb.max.z]) cs.push(new THREE.Vector3(x, y, z).applyMatrix4(N));
        }
        corrido = Math.max(...cs.map((p) => p.z)) - Math.min(...cs.map((p) => p.z));
      }
    }
    out.push([`${rot} · alcance do corrido`, `${mm(corrido)} mm de barra (envelope em z)`]);
    out.push([`★ ${rot} · a grade cobre pelo menos 2 000 mm de flanco`, corrido >= 2.0]);
    out.push([`${rot} · cotas da grade`,
      `barra y ${mm(barra.y0)}…${mm(barra.y1)} |x| ${mm(barra.xd)}…${mm(barra.xf)} · `
      + `estação y ${mm(est.y0)}…${mm(est.y1)} |x| ${mm(est.xd)}…${mm(est.xf)} · `
      + `barriga do flanco ${mm(barriga)} (vão até a estação ${mm(barriga - est.y1)}) · `
      + `sobrechassi desce a ${mm(subchassi)} · mesa da longarina ${mm(mount.frameTopY)}`]);
  }

  /* ── 1. cada FAMÍLIA de runtime contra as duas árvores ── */
  const achadosDaVez = [];
  for (const f of familias) {
    const meus = tudo.filter((d) => d.fam === f);
    const outros = tudo.filter((d) => d.fam !== f);
    for (const r of cruzaConjuntos(meus, outros, N, orc)) {
      achadosDaVez.push({ ...r, grupo: f, contra: r.dono.onde });
    }
  }
  /* ── 2. o IMPLEMENTO contra a CABINE, tirado o que já foi medido ── */
  {
    const meus = fImp.filter((d) => !d.fam);
    const outros = fCab.filter((d) => !d.fam);
    for (const r of cruzaConjuntos(meus, outros, N, orc)) {
      achadosDaVez.push({ ...r, grupo: '(implemento)', contra: 'cabine' });
    }
  }

  /* Um par entre duas famílias aparece duas vezes; fica o mais fundo. */
  const unico = new Map();
  for (const r of achadosDaVez) {
    const k = [r.minha, r.dele].sort().join('▸') + '|' + r.lado;
    const e = unico.get(k);
    const p = Math.max(r.fundo, r.prof);
    if (!e || p > Math.max(e.fundo, e.prof)) unico.set(k, r);
  }
  const achados = [...unico.values()]
    .sort((x, y) => Math.max(y.fundo, y.prof) - Math.max(x.fundo, x.prof));
  const dt = performance.now() - t0;

  const pior1 = (r) => Math.max(r.fundo, r.prof);
  const grave = (r) => {
    const p = pior1(r);
    if (p < TETO) return false;
    const enc = assumido(r.minha, r.dele, r.x);
    return !enc || p >= enc.teto;
  };
  const graves = achados.filter(grave);
  const encaixes = achados.filter((r) => pior1(r) >= TETO && !grave(r));
  out.push([`${rot} · varredura`, `${achados.length} par(es) ≥ 1 mm · `
    + `${graves.length} DEFEITO(S) · ${encaixes.length} encaixe(s) assumido(s) · `
    + `${(orc.lidos / 1e6).toFixed(1)} M tri lidos · `
    + `${(dt / 1000).toFixed(1)} s`
    + (orc.cortados.length ? ` · ⚠ ORÇAMENTO ESTOURADO em ${orc.cortados.length}: `
      + `${[...new Set(orc.cortados)].slice(0, 4).join(', ')}` : '')]);
  out.push([`★ ${rot} · nenhuma malha estourou o orçamento da varredura`, !orc.cortados.length]);

  for (const r of achados.slice(0, 28)) {
    const enc = pior1(r) >= TETO ? assumido(r.minha, r.dele, r.x) : null;
    out.push([`${rot} · ${grave(r) ? '✖' : enc ? '≈' : '·'} ${r.minha} ▸ ${r.dele} /${r.lado}`,
      `prof ${mm(r.prof)} · fundo ${mm(r.fundo)} mm · mancha `
      + `${mm(r.reg[0])}×${mm(r.reg[1])}×${mm(r.reg[2])} (${r.blocos} bloco/s)`
      + ` · x ${mm(r.x)} y ${mm(r.y)} z ${mm(r.z0)}…${mm(r.z1)} · ${r.n} tri`
      + ` · [${r.grupo} × ${r.contra}]${enc ? ` · ENCAIXE: ${enc.porque} (teto ${mm(enc.teto)})` : ''}`]);
    tabela.push({ rot, ...r });
  }
  if (achados.length > 28) {
    out.push([`${rot} · …`, `mais ${achados.length - 28} par(es) abaixo de `
      + `${mm(Math.max(achados[28].fundo, achados[28].prof))} mm`]);
  }

  out.push([`★ ${rot} · nenhuma sobreposição ≥ ${mm(TETO)} mm fora dos encaixes assumidos`,
    graves.length === 0]);
  /* ⚠️ E NADA NO FLANCO. O critério de "está pronto" desta frente não é só o
     número: é que o que sobra esteja ENTRE AS LONGARINAS, invisível. */
  /* Os encaixes assumidos saem daqui pelo mesmo motivo por que saem da conta de
     defeito: eles já foram julgados, com número e teto. O que sobra é o que a
     próxima foto vai mostrar. */
  const noFlanco = achados.filter((r) => grave(r) && Math.abs(r.x) > 0.90);
  out.push([`${rot} · o achado mais externo`, achados.filter((r) => pior1(r) >= TETO).length
    ? `|x| ${mm(Math.max(...achados.filter((r) => pior1(r) >= TETO).map((r) => Math.abs(r.x))))} mm`
    : 'não há']);
  out.push([`★ ${rot} · nada ≥ ${mm(TETO)} mm no FLANCO (|x| > 900 mm)`, noFlanco.length === 0]);
}

/* ══════════════════════ o resumo, ordenado por profundidade ══════════════════════ */
const pior = (r) => Math.max(r.fundo, r.prof);
tabela.sort((a, b) => pior(b) - pior(a));
const feios = tabela.filter((r) => pior(r) >= TETO);
const defeitos = feios.filter((r) => {
  const e = assumido(r.minha, r.dele, r.x);
  return !e || pior(r) >= e.teto;
});
out.push(['══ TABELA GERAL ══', `${feios.length} par(es) ≥ ${mm(TETO)} mm em `
  + `${alvos.length} configurações · ${defeitos.length} DEFEITO(S) · `
  + `${feios.length - defeitos.length} encaixe(s) assumido(s) · mais externo `
  + `|x| ${feios.length ? mm(Math.max(...feios.map((r) => Math.abs(r.x)))) : '—'} mm`]);
out.push(['★ nenhum DEFEITO em nenhuma das dez configurações', defeitos.length === 0]);
for (const [i, r] of feios.slice(0, 80).entries()) {
  out.push([`#${String(i + 1).padStart(2, '0')} ${mm(pior(r))} mm · ${r.rot}`,
    `${r.minha} ▸ ${r.dele} /${r.lado} · prof ${mm(r.prof)} fundo ${mm(r.fundo)}`
    + ` · mancha ${mm(r.reg[0])}×${mm(r.reg[1])}×${mm(r.reg[2])} (${r.blocos} bl.)`
    + ` · x ${mm(r.x)} y ${mm(r.y)} z ${mm(r.z0)}…${mm(r.z1)}`]);
}

return out;
