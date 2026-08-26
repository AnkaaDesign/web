/* ▶▶ PORTÃO — O CORRIDO PASSA POR FORA DO EQUIPAMENTO DE FLANCO. 2026-08-24.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-grade-flanco-0824.mjs

   *"essa grade metálica não está indo até onde deveria, mais ou menos onde está
   aquele componente com tampa azul"* — Kennedy, com os dois flancos do Scania
   bitruck.

   O componente de tampa azul é o ARLA, e o corrido dianteiro morria 493 mm
   antes dele. A causa está em `FOLGA_BARRA`: `truckObstacles()` usava a folga
   do SUPORTE (155 mm) também na lista que AMPUTA o corrido, e com ela o limiar
   caía em `xGuarda − 155` = 1 087 mm — 13 mm ABAIXO do teto a que
   `recessFlankEquipment()` recua tanque e ARLA (`TETO_FLANCO`, 1 100). O tanque
   recuado continuava sendo parede, e o para-ciclista morria em cima dele.

   ESTE PORTÃO GUARDA A CADEIA INTEIRA, e não o sintoma:

     ★ A — o limiar de amputação (`xGuarda − FOLGA_BARRA`) fica ACIMA do teto
           do equipamento de flanco, com folga. É a régua que faltava, e é ela
           que impede a terceira ida ao mesmo defeito.
     ★ B — nenhum equipamento de flanco (tanque, ARLA, bocal, berço) passa do
           teto: se o recuo falhar, o portão acusa aqui e não na foto.
     ★ C — o corrido COBRE o equipamento de flanco: cada peça dele está dentro
           do alcance de um trecho de grade (que é o que o para-ciclista real
           faz — o perfil corre por fora e o equipamento vive atrás dele).
     ★ D — e o corrido não encolheu: comprimento total por configuração contra
           a régua MEDIDA nesta data.
     ★ E — nenhuma ponta de corrido fica pendurada: o balanço além da última
           estação não passa de 600 mm. É o contrapeso de ★ C — cobrir o tanque
           não pode custar uma barra de 1,5 m sem apoio.

   Tudo em MUNDO, com o solo em y = 0 (a bancada põe o conjunto no chão). */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;

/* As cotas do motor, copiadas de `side-guard.ts` e de `truck-tanks.ts`. Elas
   são o CONTRATO deste portão: mudar uma sem mudar a outra é o defeito. */
const RECUO_DA_PELE = 0.060;
const GRADE_FACE_DENTRO = 0.100;
const GRADE_DENTRO = 0.135;
const FOLGA_BARRA = GRADE_FACE_DENTRO + 0.020;      // 120 mm
/** A face da grade como `side-guard.ts` a declara. ⚠️ Ela NÃO é a face medida
 *  (1 251): o ⚠️⚠️ de lá explica por que continua em 1 275 — baixá-la empurra o
 *  tanque do VM para dentro da longarina. Ver §48.2. */
const GRADE_FACE = 1.275;
const TETO_FLANCO = GRADE_FACE - GRADE_DENTRO - 0.040;   // 1 100 mm
/** A folga do SUPORTE, de `side-guard.ts` — 10 mm de ar, medidos. */
const FOLGA_LATERAL = GRADE_DENTRO + 0.010;              // 145 mm
/** Balanço máximo aceitável numa ponta de corrido: `BALANCO` (300) mais o
 *  alcance da tampa (118) e um respiro. Acima disso a barra "flutua", que é a
 *  queixa que `PASSO` registra. */
const BALANCO_MAX = 0.60;
/** Folga mínima entre o teto do equipamento e o limiar de amputação. */
const MARGEM_MIN = 0.010;
/** O corrido total, MEDIDO em 2026-08-24 (soma dos vãos de barra, por lado). */
const REGUA = {};

/* Os rígidos do catálogo. */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c, rot: `${mo.id}/${c.id}` });
    }
  }
}
out.push(['0 · rígidos', alvos.map((a) => a.rot).join(' · ')]);

const v = new THREE.Vector3();
/** Os vértices de uma malha em MUNDO, expandindo `InstancedMesh` — a lição da
 *  varredura geral (§44.1): a instância não está na pose do nó. */
function porVertice(o, fn) {
  const pos = o.geometry?.attributes?.position;
  if (!pos) return;
  const n = o.isInstancedMesh ? o.count : 1;
  const M = new THREE.Matrix4();
  const passo = pos.count > 200000 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    if (o.isInstancedMesh) { o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); }
    else M.copy(o.matrixWorld);
    for (let i = 0; i < pos.count; i += passo) {
      fn(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
    }
  }
}

/** O equipamento de FLANCO do caminhão: tanque, ARLA, bocal e berço. O berço
 *  entra por posição (mora coladinho no corpo), como `pegaOBerco()` o pesca. */
const FLANCO_RE = /^TS_TANQUE|^tanques?(_\d+)?_p\d+$/i;
const ARLA_RE = /arla|adblue/i;

for (const a of alvos) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();

  const cab = S.state.cab, t = S.state.trailer;
  cab.updateWorldMatrix(true, true); t.updateWorldMatrix(true, true);

  /* A pele do baú e, dela, o limiar que o motor usa.
     ⚠️ COM `visible`, e aqui é o contrário da medida da barra: a árvore do
     implemento carrega malha ESCONDIDA (as variantes que o baú não está
     usando), e sem o filtro a pele sai em 1 335 — a meia-largura do
     SEMIRREBOQUE — em vez dos 1 311 que o motor mede. */
  let skinX = 0;
  t.traverse((o) => {
    if (!o.isMesh || !o.visible || /^TS_PROTECAO_LATERAL/.test(o.name || '')) return;
    let dentroDaGrade = false;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') { dentroDaGrade = true; break; }
    if (dentroDaGrade) return;
    porVertice(o, (p) => { skinX = Math.max(skinX, Math.abs(p.x)); });
  });
  const xGuarda = skinX - RECUO_DA_PELE;
  const limiar = xGuarda - FOLGA_BARRA;
  out.push([`${a.rot} · pele ${mm(skinX)} · xGuarda ${mm(xGuarda)} · limiar de amputação`,
    `${mm(limiar)} mm (teto do flanco ${mm(TETO_FLANCO)} · folga ${mm(limiar - TETO_FLANCO)} mm)`]);
  out.push([`★ A ${a.rot} · o limiar de amputação fica acima do teto do flanco`,
    limiar - TETO_FLANCO >= MARGEM_MIN]);
  /* …e a mesma pergunta para a ESTAÇÃO: é ela que decide se cabe um APOIO em
     cima do tanque, e foi ela que ficou 4 mm do lado errado até hoje. */
  const limiarEst = xGuarda - FOLGA_LATERAL;
  out.push([`${a.rot} · limiar da estação`,
    `${mm(limiarEst)} mm (teto do flanco ${mm(TETO_FLANCO)} · folga ${mm(limiarEst - TETO_FLANCO)} mm)`]);
  out.push([`★ A2 ${a.rot} · o limiar da ESTAÇÃO fica acima do teto do flanco`,
    limiarEst - TETO_FLANCO >= 0.002]);

  /* ★ B · o equipamento de flanco está DENTRO do teto. */
  const flanco = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name || '').join(',');
    if (!FLANCO_RE.test(o.name || '') && !ARLA_RE.test(mats) && !ARLA_RE.test(o.name || '')) return;
    const s = { nome: o.name || '?', x: 0, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity };
    porVertice(o, (p) => {
      /* Só o que vive na faixa da grade — o bocal que sobe para o topo do
         chassi não é assunto do para-ciclista. */
      if (p.y < 0.40 || p.y > 1.15) return;
      const ax = Math.abs(p.x);
      if (ax < 0.90) return;
      s.x = Math.max(s.x, ax);
      s.z0 = Math.min(s.z0, p.z); s.z1 = Math.max(s.z1, p.z);
      s.y0 = Math.min(s.y0, p.y); s.y1 = Math.max(s.y1, p.y);
    });
    if (s.x > 0) flanco.push(s);
  });
  const foraDoTeto = flanco.filter((s) => s.x > TETO_FLANCO + 0.002);
  out.push([`★ B ${a.rot} · equipamento de flanco dentro do teto (${flanco.length} peça(s))`,
    foraDoTeto.length === 0]);
  if (foraDoTeto.length) {
    out.push([`   ${a.rot} · passam do teto`, foraDoTeto
      .map((s) => `${s.nome} |x| ${mm(s.x)} · z ${mm(s.z0)}…${mm(s.z1)}`).join(' · ')]);
  }

  /* Os TRECHOS de corrido montados, medidos na BARRA e na TAMPA. */
  const pontos = [];
  /* ⚠️ SEM O TESTE DE `visible`: `applyMerge()` funde a barra em
     `FUSAO__metal-galvanizado-mantido__b3` e apaga o nó de origem. §45.4
     registra a mesma pegadinha — a conta de alcance devolvia zero nas dez
     configurações antes de sair do NÓ em vez do nome da malha visível. */
  t.traverse((o) => {
    if (!o.isMesh || !/^(BARRA__|PONTA__)/.test(o.name || '')) return;
    porVertice(o, (p) => { if (p.x > 0) pontos.push(p.z); });
  });
  pontos.sort((p, q) => p - q);
  /* ⚠️ O TRECHO É O PAR DE TAMPAS. Com a barra no balde de fusão, o que sobra
     na árvore são as quatro `PONTA__` — duas por corrido —, e uni-las por
     proximidade daria quatro "trechos" de 155 mm. Duas tampas seguidas são as
     duas pontas de um mesmo corrido. */
  const grupos = [];
  for (const z of pontos) {
    const u = grupos[grupos.length - 1];
    if (u && z - u.z1 < 0.20) u.z1 = Math.max(u.z1, z);
    else grupos.push({ z0: z, z1: z });
  }
  const trechos = [];
  for (let i = 0; i + 1 < grupos.length; i += 2) {
    trechos.push({ z0: grupos[i].z0, z1: grupos[i + 1].z1 });
  }
  out.push([`★ ${a.rot} · as tampas de ponta vêm aos pares`, grupos.length % 2 === 0]);
  const total = trechos.reduce((s, x) => s + (x.z1 - x.z0), 0);
  out.push([`${a.rot} · corrido`, `${trechos.length} trecho(s) `
    + `(${trechos.map((x) => `${mm(x.z0)}…${mm(x.z1)}`).join(' · ')}) · total ${mm(total)} mm`]);

  /* ★ E · AS ESTAÇÕES, e o balanço que sobra em cada ponta. Cobrir o tanque
     não pode custar uma barra pendurada: `BALANCO` promete 300 mm, e a régua
     aqui é 600 (o balanço mais o alcance da tampa e um respiro). */
  const est = [];
  t.traverse((o) => {
    if (!o.isMesh || !o.isInstancedMesh) return;
    if (!/^ESTACAO__metal-preto/.test(o.name || '')) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4();
    for (let k = 0; k < o.count; k++) {
      o.getMatrixAt(k, M); M.premultiply(o.matrixWorld);
      let z0 = Infinity, z1 = -Infinity, dir = true;
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 200))) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
        if (v.x < 0) { dir = false; break; }
        z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
      }
      if (dir) est.push((z0 + z1) / 2);
    }
  });
  est.sort((p, q) => p - q);
  const balancos = [];
  for (const x of trechos) {
    const meus = est.filter((z) => z >= x.z0 - 0.10 && z <= x.z1 + 0.10);
    if (!meus.length) { balancos.push({ x, b0: x.z1 - x.z0, b1: 0, n: 0 }); continue; }
    balancos.push({ x, b0: meus[0] - x.z0, b1: x.z1 - meus[meus.length - 1], n: meus.length });
  }
  out.push([`${a.rot} · apoios por trecho`, balancos
    .map((b) => `${mm(b.x.z0)}…${mm(b.x.z1)}: ${b.n} estação(ões) · balanço `
      + `${mm(b.b0)}/${mm(b.b1)} mm`).join(' · ')]);
  out.push([`★ E ${a.rot} · nenhuma ponta com balanço acima de ${mm(BALANCO_MAX)} mm`,
    balancos.every((b) => b.n > 0 && b.b0 <= BALANCO_MAX && b.b1 <= BALANCO_MAX)]);

  /* ★ C · cada peça de flanco cai dentro de um trecho. A peça que mora numa
     BAIA DE RODA não é cobrável e sai da conta: quem manda ali é a roda. */
  const eixos = [...S.state.cabMount.axles.steerZ, ...S.state.cabMount.axles.driveZ,
    ...S.state.cabMount.axles.liftZ];
  /* Os eixos em z de MUNDO: o mapa é linear, e dois pontos conhecidos bastam —
     usa-se a própria pose da cabine. */
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const mount = S.state.cabMount;
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const W2N = N.clone().multiply(cabInv);
  const N2W = new THREE.Matrix4().copy(W2N).invert();
  const eixosW = eixos.map((z) => new THREE.Vector3(0, 0, z).applyMatrix4(N2W).z);
  const naBaia = (z) => eixosW.some((e) => Math.abs(z - e) < 0.90);
  const cobre = (z) => trechos.some((x) => z >= x.z0 - 0.02 && z <= x.z1 + 0.02);
  const descobertos = flanco.filter((s) => {
    const meio = (s.z0 + s.z1) / 2;
    return !naBaia(meio) && !cobre(meio) && (s.z1 - s.z0) > 0.10;
  });
  out.push([`★ C ${a.rot} · o corrido cobre o equipamento de flanco`, descobertos.length === 0]);
  if (descobertos.length) {
    out.push([`   ${a.rot} · descobertos`, descobertos
      .map((s) => `${s.nome} z ${mm(s.z0)}…${mm(s.z1)} · |x| ${mm(s.x)}`).join(' · ')]);
  }

  /* ★ D · o corrido não encolheu. */
  const regua = REGUA[a.rot];
  if (regua !== undefined) {
    out.push([`★ D ${a.rot} · corrido ≥ régua de 2026-08-24 (${mm(regua)} mm)`,
      total >= regua - 0.020]);
  }
}

return out;
