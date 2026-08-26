/* O PORTÃO DA 2ª RODADA DE CHASSI — cota de fábrica, para-lama e SOBREPOSIÇÃO.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-chassis-0823.mjs

   Ele responde a três queixas da mesma foto:

     1. *"o bitruck do volvo está terrível"* — a distância entre os dois eixos
        direcionais era 1 092 mm no VM e 1 050 no VW contra **2 220 / 2 348 de
        ficha de fábrica**. O Scania P do próprio acervo mede 2 215, e é por
        isso que ele era o único que parecia certo. Aqui a cota é CONFERIDA
        contra a ficha, com tolerância de 3 %.
     2. *"baú parece muito grande para um toco"* — o 4x2 derivado herda o quadro
        do 6x2 e o baú de 8,66 m punha o balanço traseiro em 3 754 mm, acima dos
        dois tetos da CONTRAN 882/2021 (3 500 mm e 60 % dos eixos extremos).
     3. *"cuidado com componentes entrando dentro de outros … use algoritmos de
        reconhecimento de sobreposição de peças"* — o portão roda um teste
        TRIÂNGULO A TRIÂNGULO (separação por 11 eixos) entre as peças que o
        motor PENDURA (para-lama, roda, grade, peças de chassi) e a malha do
        caminhão. Caixa envolvente não serve: a caixa de uma roda cruza a de uma
        longarina sem um triângulo encostar no outro.

   ⚠️ E ELE MEDE O QUE ESTÁ NA TELA. As sondas de `tools/chassis-bake/` leem
   `.glb`; metade das peças de um rígido montado (roda do VM, tanque do VM,
   grade lateral, para-lama do 2º direcional) não existe em `.glb` nenhum —
   elas nascem em `loadCab()`/`placeTrailer()`. Só aqui dá para vê-las. */

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

/* ══════════════════════ as cotas de fábrica ══════════════════════
   VM 8x2R: `Ficha-Técnica-VM-8x2R.pdf`, linha `D Distância entre os eixos
   direcionais` = 2 220 mm (igual nos quatro entre-eixos, e igual no 8x4R).
   VW: `Constellation 30.320 8x2`, linha `R Distância entre-eixos: 1º ao 2º`
   = 2 348 mm. Scania: MEDIDO no próprio rip, 2 215 mm. */
const DIRECIONAIS = {
  'volvo-vm-2015': 2.220,
  'vw-constellation': 2.348,
  'scania-p': 2.215,
};
/** Tolerância: 3 % de 2,2 m são 66 mm — mais que a imprecisão de um rip e
 *  muito menos que o erro que se está caçando (1 100 mm). */
const TOL_EIXO = 0.03;

/* ══════════════════════ triângulo × triângulo ══════════════════════ */
const FOLGA = 0.002;
function separa(ex, ey, ez, A, B2) {
  const n2 = ex * ex + ey * ey + ez * ez;
  if (n2 < 1e-16) return false;
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let i = 0; i < 9; i += 3) {
    const p = ex * A[i] + ey * A[i + 1] + ez * A[i + 2];
    if (p < a0) a0 = p; if (p > a1) a1 = p;
    const q = ex * B2[i] + ey * B2[i + 1] + ez * B2[i + 2];
    if (q < b0) b0 = q; if (q > b1) b1 = q;
  }
  const tol = FOLGA * Math.sqrt(n2);
  return a1 < b0 + tol || b1 < a0 + tol;
}
function cruzam(A, B2) {
  const u = [A[3] - A[0], A[4] - A[1], A[5] - A[2],
    A[6] - A[3], A[7] - A[4], A[8] - A[5],
    A[0] - A[6], A[1] - A[7], A[2] - A[8]];
  const v = [B2[3] - B2[0], B2[4] - B2[1], B2[5] - B2[2],
    B2[6] - B2[3], B2[7] - B2[4], B2[8] - B2[5],
    B2[0] - B2[6], B2[1] - B2[7], B2[2] - B2[8]];
  const cr = (a, i, b, j) => [
    a[i + 1] * b[j + 2] - a[i + 2] * b[j + 1],
    a[i + 2] * b[j] - a[i] * b[j + 2],
    a[i] * b[j + 1] - a[i + 1] * b[j],
  ];
  let n = cr(u, 0, u, 3);
  if (separa(n[0], n[1], n[2], A, B2)) return false;
  n = cr(v, 0, v, 3);
  if (separa(n[0], n[1], n[2], A, B2)) return false;
  for (let i = 0; i < 9; i += 3) {
    for (let j = 0; j < 9; j += 3) {
      n = cr(u, i, v, j);
      if (separa(n[0], n[1], n[2], A, B2)) return false;
    }
  }
  return true;
}

/** Triângulos de um objeto, em MUNDO, dentro de uma caixa. */
function trisEm(o, caixa, limite = 400000) {
  const g = o.geometry;
  const pos = g.getAttribute('position');
  if (!pos) return [];
  const idx = g.getIndex();
  const nT = idx ? idx.count / 3 : pos.count / 3;
  const m = o.matrixWorld;
  const out2 = [];
  const p = new THREE.Vector3();
  const t = new Float64Array(9);
  for (let f = 0; f < nT && out2.length < limite; f++) {
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
    out2.push({ t: t.slice(), x0, x1, y0, y1, z0, z1 });
  }
  return out2;
}

/** Visível de verdade — `swapTruckWheels()` apaga a rodagem original. */
function ligado(o, ate) {
  for (let p = o; p && p !== ate.parent; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * Sobreposição entre uma PEÇA PENDURADA e o resto do caminhão.
 *
 * `alvo` é a raiz da peça; tudo que não estiver sob ela e não for roda entra
 * como candidato. Devolve as piores caixas de interseção.
 */
function sobreposicoes(cab, alvo, ignora, N, contra) {
  /* `contra` é a árvore em que se procura; `cab` continua sendo quem define
     visibilidade e o filtro "está sob o alvo". Sem ele a checagem só via o
     CAMINHÃO — e a grade lateral é filha do IMPLEMENTO, que é outra árvore.
     Foi por isso que o para-lama do VW atravessando o montante da grade passou
     por dois portões verdes. */
  const arvore = contra || cab;
  const caixa = new THREE.Box3().setFromObject(alvo);
  if (caixa.isEmpty()) return [];
  const meus = [];
  alvo.traverse((o) => {
    if (o.isMesh && ligado(o, alvo)) meus.push(...trisEm(o, caixa, 80000));
  });
  if (!meus.length) return [];
  /* Grade sobre os triângulos da peça — 100 mm é maior que quase todo
     triângulo dela e pequeno o bastante para peneirar. */
  const CEL = 0.1;
  const balde = new Map();
  meus.forEach((tr, i) => {
    for (let a = Math.floor(tr.x0 / CEL); a <= Math.floor(tr.x1 / CEL); a++) {
      for (let b2 = Math.floor(tr.y0 / CEL); b2 <= Math.floor(tr.y1 / CEL); b2++) {
        for (let c = Math.floor(tr.z0 / CEL); c <= Math.floor(tr.z1 / CEL); c++) {
          const k = `${a},${b2},${c}`;
          if (!balde.has(k)) balde.set(k, []);
          balde.get(k).push(i);
        }
      }
    }
  });
  const achados = new Map();
  arvore.traverse((o) => {
    if (!o.isMesh || !ligado(o, arvore)) return;
    for (let p = o; p; p = p.parent) if (p === alvo) return;
    const nome = o.name || '(sem nome)';
    if (ignora && ignora.test(nome)) return;
    let ancestralIgnorado = false;
    for (let p = o; p && p !== arvore.parent; p = p.parent) {
      if (ignora && ignora.test(p.name || '')) ancestralIgnorado = true;
    }
    if (ancestralIgnorado) return;
    for (const tr of trisEm(o, caixa, 200000)) {
      const vistos = new Set();
      for (let a = Math.floor(tr.x0 / CEL); a <= Math.floor(tr.x1 / CEL); a++) {
        for (let b2 = Math.floor(tr.y0 / CEL); b2 <= Math.floor(tr.y1 / CEL); b2++) {
          for (let c = Math.floor(tr.z0 / CEL); c <= Math.floor(tr.z1 / CEL); c++) {
            for (const i of (balde.get(`${a},${b2},${c}`) || [])) {
              if (vistos.has(i)) continue;
              vistos.add(i);
              const me = meus[i];
              if (tr.x1 < me.x0 || me.x1 < tr.x0) continue;
              if (tr.y1 < me.y0 || me.y1 < tr.y0) continue;
              if (tr.z1 < me.z0 || me.z1 < tr.z0) continue;
              if (!cruzam(me.t, tr.t)) continue;
              /* ⚠️ A CAIXA DE INTERSEÇÃO VAI PARA O NORMALIZADO, e por lado.
                 Em mundo ela é ilegível (o conjunto está a 12 m da origem e
                 girado), e a UNIÃO dos dois flancos dá sempre 2,1 m de largura
                 — foi o que mascarou o defeito na 1ª leitura. */
              const q = new THREE.Vector3(
                (Math.max(tr.x0, me.x0) + Math.min(tr.x1, me.x1)) / 2,
                (Math.max(tr.y0, me.y0) + Math.min(tr.y1, me.y1)) / 2,
                (Math.max(tr.z0, me.z0) + Math.min(tr.z1, me.z1)) / 2).applyMatrix4(N);
              const lado = q.x >= 0 ? 'D' : 'E';
              const chave = nome + '|' + lado;
              const e = achados.get(chave)
                || { nome, lado, n: 0, cx: [Infinity, -Infinity], cy: [Infinity, -Infinity], cz: [Infinity, -Infinity] };
              e.n++;
              const dxi = Math.min(tr.x1, me.x1) - Math.max(tr.x0, me.x0);
              const dyi = Math.min(tr.y1, me.y1) - Math.max(tr.y0, me.y0);
              const dzi = Math.min(tr.z1, me.z1) - Math.max(tr.z0, me.z0);
              e.fundo = Math.max(e.fundo || 0, Math.min(dxi, dyi, dzi));
              e.cx[0] = Math.min(e.cx[0], q.x); e.cx[1] = Math.max(e.cx[1], q.x);
              e.cy[0] = Math.min(e.cy[0], q.y); e.cy[1] = Math.max(e.cy[1], q.y);
              e.cz[0] = Math.min(e.cz[0], q.z); e.cz[1] = Math.max(e.cz[1], q.z);
              achados.set(chave, e);
            }
          }
        }
      }
    }
  });
  return [...achados.values()]
    .map((e) => ({
      nome: e.nome, lado: e.lado, n: e.n, fundo: e.fundo || 0,
      x: (e.cx[0] + e.cx[1]) / 2, y: (e.cy[0] + e.cy[1]) / 2,
      z0: e.cz[0], z1: e.cz[1],
    }))
    .sort((a, b) => b.fundo - a.fundo);
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
  const mount = S.state.cabMount;
  if (!mount) { out.push([`★ ${rot} · tem mounts.json`, false]); continue; }
  const steer = mount.axles.steerZ || [];
  const eixos = [...steer, ...mount.axles.driveZ, ...mount.axles.liftZ];
  const ultimo = Math.min(...eixos);
  const vao = Math.max(...eixos) - ultimo;

  /* 1 · A COTA ENTRE OS DIRECIONAIS. */
  if (steer.length >= 2) {
    const d = Math.max(...steer) - Math.min(...steer);
    const esperado = DIRECIONAIS[a.mo.id];
    out.push([`${rot} · entre direcionais`, `${mm(d)} mm (ficha ${mm(esperado)})`]);
    out.push([`★ ${rot} · a cota entre direcionais bate com a ficha (±3 %)`,
      !!esperado && Math.abs(d - esperado) / esperado <= TOL_EIXO]);
  }

  /* 2 · O BALANÇO TRASEIRO, CONTRAN 882/2021. */
  const bb = new THREE.Box3().setFromObject(S.state.trailer);
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  /* ⚠️ A TRASEIRA VEM MEDIDA DO MOTOR, e não da caixa do implemento. A caixa
     inclui o Thermo King (que avança sobre a cabine) e as mangueiras
     traseiras: 9 229 mm contra 7 481 de baú no VM. `state.bodyZ` é a caixa das
     CHAPAS, escrita por `placeTrailer()` no momento do assentamento — é o que
     a norma mede. */
  const bauTras = S.state.bodyZ ? S.state.bodyZ.traseira : NaN;
  out.push([`★ ${rot} · o motor mediu a traseira do baú`, Number.isFinite(bauTras)]);
  const balanco = ultimo - bauTras;
  const teto = Math.min(3.50, 0.60 * vao);
  const dims = S.trailerDims;
  out.push([`${rot} · baú`, `comprimento ${mm(dims?.length)} mm (fábrica`
    + ` ${mm(S.state.trailerRig?.base?.length)}) · chapas em z ${mm(bauTras)}…`
    + `${mm(S.state.bodyZ?.frente)}`]);
  out.push([`${rot} · balanço traseiro`,
    `${mm(balanco)} mm · teto ${mm(teto)} (60 % de ${mm(vao)} · máx 3 500)`]);
  out.push([`★ ${rot} · balanço traseiro dentro da CONTRAN 882/2021`, balanco <= teto + 0.02]);

  /* 3 · SOBREPOSIÇÃO das peças penduradas. */
  const IGNORA = /wheel|tire|pneu|rim|VM_WHEEL|TS_PARALAMA|lameiro|paralama/i;
  const paralama = cab.getObjectByName('TS_PARALAMA_DIR2');
  if (steer.length >= 2) {
    out.push([`★ ${rot} · o 2º direcional tem para-lama`,
      !!paralama || /scania/.test(a.mo.id)]);
  }
  if (paralama) {
    /* As cotas da peça montada, no normalizado — sem elas "o arco encosta na
       grade" é uma foto sem número. */
    {
      const bp = new THREE.Box3().setFromObject(paralama);
      const cs = [];
      for (const x of [bp.min.x, bp.max.x]) for (const y of [bp.min.y, bp.max.y]) {
        for (const z of [bp.min.z, bp.max.z]) cs.push(new THREE.Vector3(x, y, z).applyMatrix4(N));
      }
      const gx = Math.max(...cs.map((p2) => Math.abs(p2.x)));
      const gy = Math.max(...cs.map((p2) => p2.y));
      const bbI = new THREE.Box3().setFromObject(S.state.trailer);
      const faceGrade = Math.max(Math.abs(bbI.min.x), Math.abs(bbI.max.x)) - 0.060;
      out.push([`${rot} · para-lama montado`, `meia-largura ${mm(gx)} mm · topo ${mm(gy)}`
        + ` · face da grade ${mm(faceGrade)} · mesa da longarina ${mm(mount.frameTopY)}`]);
      out.push([`★ ${rot} · o para-lama é mais estreito que a grade`, gx < faceGrade - 0.030]);
      /* De onde saiu a escala: a MESMA varredura de `medePneu()`, para o
         portão poder dizer qual malha está esticando o arco. */
      {
        const alvoZ = Math.min(...steer);
        const cabInv2 = new THREE.Matrix4().copy(cab.matrixWorld).invert();
        const L2N2 = new THREE.Matrix4();
        const v2 = new THREE.Vector3();
        let ry0 = Infinity, ry1 = -Infinity;
        const rodas = [];
        cab.traverse((o) => {
          if (!o.isMesh || !o.geometry?.attributes?.position || !ligado(o, cab)) return;
          let roda = false;
          for (let pp = o; pp && pp !== cab.parent; pp = pp.parent) {
            if (/wheel|tire|pneu|rim|aro|VM_WHEEL/i.test(pp.name || '')) { roda = true; break; }
          }
          if (!roda) return;
          rodas.push(o);
          L2N2.copy(N).multiply(cabInv2).multiply(o.matrixWorld);
          const pz = o.geometry.attributes.position;
          for (let i = 0; i < pz.count; i++) {
            v2.fromBufferAttribute(pz, i).applyMatrix4(L2N2);
            if (Math.abs(v2.z - alvoZ) > 0.70 || Math.abs(v2.x) < 0.55) continue;
            if (v2.y < ry0) ry0 = v2.y; if (v2.y > ry1) ry1 = v2.y;
          }
        });
        const D2 = ry1 - ry0;
        let fo = 0, quem = '?';
        for (const o of rodas) {
          L2N2.copy(N).multiply(cabInv2).multiply(o.matrixWorld);
          const pz = o.geometry.attributes.position;
          for (let i = 0; i < pz.count; i++) {
            v2.fromBufferAttribute(pz, i).applyMatrix4(L2N2);
            if (Math.abs(v2.z - alvoZ) > 0.70 || Math.abs(v2.x) < 0.55) continue;
            if (v2.y < ry0 + D2 * 0.05 || v2.y > ry0 + D2 * 0.35) continue;
            if (Math.abs(v2.x) > fo) { fo = Math.abs(v2.x); quem = o.name || '?'; }
          }
        }
        out.push([`${rot} · régua do arco`, `pneu Ø ${mm(D2)} · face externa ${mm(fo)}`
          + ` (a malha mais externa na faixa baixa é ${quem})`]);
      }
    }
    const sobre = sobreposicoes(cab, paralama, IGNORA, N, cab);
    const pior = sobre[0];
    out.push([`${rot} · para-lama × caminhão`, sobre.length
      ? sobre.slice(0, 5).map((s) => `${s.nome}/${s.lado} fundo ${mm(s.fundo)} mm`
        + ` @ x ${mm(s.x)} y ${mm(s.y)} z ${mm(s.z0)}…${mm(s.z1)} (${s.n} tri)`).join(' · ')
      : 'nenhuma sobreposição']);
    /* ⚠️ O TETO NÃO É ZERO. Um para-lama encosta no suporte que o segura por
       construção; o que não pode é ENTRAR em equipamento. `fundo` é a MENOR
       aresta da caixa de interseção — a profundidade real da penetração —, e
       40 mm nela é encaixe. */
    out.push([`★ ${rot} · o para-lama não entra em nada (< 40 mm de fundo)`,
      !pior || pior.fundo < 0.040]);
    /* ⚠️ E CONTRA O IMPLEMENTO TAMBÉM. A grade lateral é filha do baú: a
       varredura acima, restrita à árvore da cabine, nunca a viu — e é
       justamente ela que o para-lama do VW atravessava na foto. */
    const contraBau = sobreposicoes(cab, paralama, null, N, S.state.trailer);
    const piorB = contraBau[0];
    out.push([`${rot} · para-lama × implemento`, contraBau.length
      ? contraBau.slice(0, 4).map((s2) => `${s2.nome}/${s2.lado} fundo ${mm(s2.fundo)} mm`
        + ` @ x ${mm(s2.x)} z ${mm(s2.z0)}…${mm(s2.z1)} (${s2.n} tri)`).join(' · ')
      : 'nenhuma sobreposição']);
    out.push([`★ ${rot} · o para-lama não entra no implemento (< 20 mm)`,
      !piorB || piorB.fundo < 0.020]);
  }

  /* 3c · A GRADE LATERAL × O CAMINHÃO — a checagem que faltava.
     A grade é filha do IMPLEMENTO; a varredura de `sobreposicoes()` só olhava
     a árvore da CABINE, e por isso o para-lama do VW atravessando o montante e
     o tanque do VM embutido no corrido passaram por dois portões verdes.
     Medido no asset: o conjunto da grade ocupa 135 mm para dentro da própria
     face, ou seja |x| 1 140…1 275 — nada do caminhão pode entrar aí. */
  {
    const grade = S.state.trailer?.getObjectByName('TS_PROTECAO_LATERAL');
    out.push([`★ ${rot} · a grade lateral existe`, !!grade]);
    if (grade) {
      const sobre = sobreposicoes(cab, grade, /wheel|tire|pneu|rim|VM_WHEEL/i, N, cab);
      const pior = sobre[0];
      out.push([`${rot} · grade × caminhão`, sobre.length
        ? sobre.slice(0, 5).map((s2) => `${s2.nome}/${s2.lado} fundo ${mm(s2.fundo)} mm`
          + ` @ x ${mm(s2.x)} z ${mm(s2.z0)}…${mm(s2.z1)} (${s2.n} tri)`).join(' · ')
        : 'nenhuma sobreposição']);
      out.push([`★ ${rot} · nada do caminhão entra na grade (< 20 mm)`,
        !pior || pior.fundo < 0.020]);
    }
  }

  /* 3b · QUEM PARTE O CORRIDO DA GRADE.
     `truckObstacles()` marca como obstáculo tudo que estiver a menos de 95 mm
     por dentro do plano da grade, na faixa de altura do SUPORTE. Aqui o mesmo
     teste é refeito só para NOMEAR os culpados — sem isso, "a grade está
     curta" é uma foto sem diagnóstico. */
  {
    const bbImp = new THREE.Box3().setFromObject(S.state.trailer);
    const xGuarda = Math.max(Math.abs(bbImp.min.x), Math.abs(bbImp.max.x)) - 0.060;
    const limite = xGuarda - 0.095;
    /* ⚠️ `N` JÁ CARREGA `cab.matrixWorld⁻¹` — multiplicar por ela de novo era o
       defeito desta checagem: com a inversa aplicada duas vezes as coordenadas
       saíam de outro mundo e a varredura devolvia "nada" com o ARLA do Scania
       a 53 mm além do limite, bem na foto. `N` leva de MUNDO ao normalizado. */
    const L2N = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const quem = new Map();
    cab.traverse((node) => {
      const o = node;
      if (!o.isMesh || !o.geometry || !ligado(o, cab)) return;
      /* Arco de roda não conta: ele NÃO amputa o corrido (`AMPUTA_MIN` /
         `ARCO_RE` em `side-guard.ts`) — o corrido já é partido na roda. */
      if (/wheel|tire|pneu|rim|VM_WHEEL|paralama|lameiro/i.test(o.name || '')) return;
      const pos = o.geometry.getAttribute('position');
      if (!pos) return;
      L2N.copy(N).multiply(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
        if (v.y < 0.81 || v.y > 1.12) continue;
        if (Math.abs(v.x) < limite) continue;
        if (v.z > mount.cabRearZ || v.z < ultimo) continue;
        const e = quem.get(o.name || '?') || { n: 0, x: 0, z0: Infinity, z1: -Infinity };
        e.n++; e.x = Math.max(e.x, Math.abs(v.x));
        e.z0 = Math.min(e.z0, v.z); e.z1 = Math.max(e.z1, v.z);
        quem.set(o.name || '?', e);
      }
    });
    const lista = [...quem.entries()].sort((a, b) => b[1].x - a[1].x).slice(0, 5);
    out.push([`${rot} · o que parte o corrido (|x| > ${mm(limite)})`, lista.length
      ? lista.map(([n, e]) => `${n} |x| ${mm(e.x)} z ${mm(e.z0)}…${mm(e.z1)} (${e.n} v)`).join(' · ')
      : 'nada — o corrido pode ser contínuo']);
  }

  /* 4 · FOTO do flanco e do trem dianteiro. */
  const cbb = new THREE.Box3().setFromObject(cab);
  const tudo = cbb.clone().union(bb);
  const ct = tudo.getCenter(new THREE.Vector3());
  const larg = tudo.max.z - tudo.min.z;
  controls.target.copy(ct);
  camera.position.set(ct.x + Math.max(20, larg * 1.4), ct.y + 1.5, ct.z);
  camera.lookAt(ct);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([`foto-${a.mo.id}-${a.c.id}`, raw.toDataURL('image/png')]);

  /* O trem dianteiro de perto — é onde mora o defeito desta rodada. */
  const frenteZ = Math.max(...eixos);
  const alvo = new THREE.Vector3(0, 1.0, (frenteZ + Math.min(...steer)) / 2)
    .applyMatrix4(new THREE.Matrix4().copy(N).invert());
  controls.target.copy(alvo);
  camera.position.set(alvo.x + 8.5, alvo.y + 0.6, alvo.z);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([`zoom-${a.mo.id}-${a.c.id}`, raw.toDataURL('image/png')]);
}

return out;
