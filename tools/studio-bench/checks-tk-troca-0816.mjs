/* O THERMO KING SAI DO LUGAR AO TROCAR DE CAVALO — a medida da causa.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-tk-troca-0816.mjs

   O RELATO (2026-08-16): *"quando troco o cavalo o thermo king fica errado a
   posição, se eu recarrego fica correta"*.

   "Recarregar conserta" é a parte informativa: um defeito que só existe no
   caminho de TROCA e não no de CARGA depende de algo que a carga ainda não
   construiu e a troca já encontra de pé. Nesta cena existe exatamente uma
   coisa assim — A FUSÃO POR MATERIAL.

   A HIPÓTESE, escrita antes de medir:

     `placeThermoKing()` pergunta a altura da travessa da testeira a
     `measureFrontRailUnderside()`, que varre o implemento procurando ferragem
     na faixa da testeira e devolve o Y DE BAIXO da candidata mais alta. Ela
     PULA MALHA INVISÍVEL (`if (!o.visible) return`) — e a fusão esconde as
     origens e põe no lugar UM balde por material com os triângulos de todas
     elas. Com a fusão de pé a varredura deixa de ver peças e passa a ver um
     balde: `wHi` continua sendo o topo da travessa, mas `wLo` vira o ponto
     MAIS BAIXO de toda a ferragem da testeira — o estrado. A unidade desce, e
     a trava de piso (`Math.max`) a segura com a base no assoalho.

     No boot não há fusão quando `loadCab()` chama `placeThermoKing()`
     (`applyMergeNow()` só roda no fim de `runApply()`); numa troca, há.

   O QUE ESTE ARQUIVO PROVA, em três atos:

     1. MECANISMO — `measureFrontRailUnderside()` reimplementada aqui, medida
        com a fusão SOLTA e com a fusão APLICADA, na mesma pose. Dois números
        diferentes = o defeito está localizado.
     2. SINTOMA — uma troca de cavalo de verdade (`applyChoice`), e o topo do
        Thermo King antes e depois.
     3. CONTROLE — a mesma troca com `merge.release()` ANTES. Se a unidade
        ficar no lugar, a fusão é a causa e não uma coincidência.

   ⚠️ Só LÊ e alterna a fusão pela porta que a bancada já tem
   (`__studio.merge.apply/release`, idempotente por desenho). Não corrige nada. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!(window.__studio?.state?.trailer), 180000);
await B.until(() => !!window.__studio?.state?.tk, 180000);
for (let i = 0; i < 30; i++) await B.frame();

const S = window.__studio;
const THREE = S.THREE;
const mm = (v) => (v * 1000).toFixed(1) + ' mm';

/* ---------------- as duas medidas de `models.ts`, reimplementadas ----------
   Cópias fiéis, de propósito: se elas divergirem do original o teste mente, e
   é por isso que estão escritas por extenso em vez de espiadas por uma porta. */
function bboxInFrame(frame, subject, test) {
  frame.updateWorldMatrix(true, true);
  subject.updateWorldMatrix(true, true);
  const inv = frame.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  subject.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (test && !test(o)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
    }
  });
  return box;
}

const FRONT_RAIL_MAT_RE = /ferragem|estrutura/i;
const FRONT_RAIL_BAND = 0.15;

/** Devolve `{ under, top, nome, vertices }` — ou null, como a original. */
function railUnderside() {
  const trailer = S.state.trailer, rig = S.state.trailerRig, tk = S.state.tk;
  if (!trailer || !rig) return null;
  trailer.updateWorldMatrix(true, true);
  const inv = trailer.matrixWorld.clone().invert();
  const zMin = rig.profile.z1 - FRONT_RAIL_BAND;
  const loc = new THREE.Vector3(), wld = new THREE.Vector3();
  let bestTop = -Infinity, best = null;
  trailer.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (tk && (o === tk || !!tk.getObjectById(o.id))) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && FRONT_RAIL_MAT_RE.test(m.name || ''))) return;
    const pos = o.geometry.attributes.position;
    let n = 0, wLo = Infinity, wHi = -Infinity, xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      wld.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      loc.copy(wld).applyMatrix4(inv);
      if (loc.z < zMin) continue;
      n++;
      if (loc.y < wLo) wLo = loc.y; if (loc.y > wHi) wHi = loc.y;
      if (loc.x < xLo) xLo = loc.x; if (loc.x > xHi) xHi = loc.x;
    }
    if (!n || xLo > -0.5 || xHi < 0.5) return;
    if (wHi > bestTop) {
      bestTop = wHi;
      best = { under: wLo, top: wHi, nome: o.name || '(sem nome)', vertices: n };
    }
  });
  return best;
}

/** Topo do Thermo King e topo do baú, no referencial do implemento. */
function poseTK() {
  const trailer = S.state.trailer, tk = S.state.tk;
  const corpo = S.state.trailerRig?.body?.mesh;
  if (!trailer || !tk || !corpo) return null;
  const b = bboxInFrame(trailer, tk);
  const c = bboxInFrame(trailer, corpo);
  if (b.isEmpty() || c.isEmpty()) return null;
  return {
    tkTop: b.max.y, tkBase: b.min.y,
    teto: c.max.y, piso: c.min.y,
    abaixoDoTeto: c.max.y - b.max.y,
    baseSobreOPiso: b.min.y - c.min.y,
  };
}

out.push(['cena', JSON.stringify(S.choice)]);
if (!S.merge) { out.push(['★', 'sem `__studio.merge` — nada a medir']); return out; }

/* =====================  ATO 1 — O MECANISMO  ============================= */
out.push(['—— ATO 1 ——', 'a travessa, medida nos dois estados']);

S.merge.release();
for (let i = 0; i < 6; i++) await B.frame();
const solto = railUnderside();
const infoSolto = S.merge.info();
out.push(['fusão SOLTA · modo', String(infoSolto.modo)]);
out.push(['fusão SOLTA · travessa',
  solto ? `sob = ${mm(solto.under)} · topo = ${mm(solto.top)} · malha "${solto.nome}" · ${solto.vertices} vért.`
        : 'NÃO ENCONTRADA']);

S.merge.apply();
for (let i = 0; i < 6; i++) await B.frame();
const fundido = railUnderside();
const infoFund = S.merge.info();
out.push(['fusão APLICADA · modo', String(infoFund.modo)]);
out.push(['fusão APLICADA · origens → baldes',
  `${infoFund.origens} → ${infoFund.baldes}`]);
out.push(['fusão APLICADA · travessa',
  fundido ? `sob = ${mm(fundido.under)} · topo = ${mm(fundido.top)} · malha "${fundido.nome}" · ${fundido.vertices} vért.`
          : 'NÃO ENCONTRADA']);

if (solto && fundido) {
  const d = fundido.under - solto.under;
  out.push(['★ DIFERENÇA NA ALTURA DE ENCOSTO', mm(d)]);
  out.push(['★ VEREDITO DO MECANISMO', Math.abs(d) < 0.001
    ? 'a fusão NÃO muda a medida — hipótese REFUTADA'
    : 'a fusão MUDA a medida — é ela que desloca a unidade']);
}

/* =====================  ATO 2 — O SINTOMA  =============================== */
out.push(['—— ATO 2 ——', 'uma troca de cavalo de verdade, com a fusão de pé']);

const antes = poseTK();
out.push(['antes · TK abaixo do teto', antes ? mm(antes.abaixoDoTeto) : '—']);
out.push(['antes · base sobre o piso', antes ? mm(antes.baseSobreOPiso) : '—']);

/* Outro chassi, do MESMO acervo. O primeiro que não seja o corrente e não seja
   "Em breve" — um card `disabled` não tem por onde entrar em applyChoice(). */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const m of (mk.models || [])) {
    for (const c of (m.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, m, c });
    }
  }
}
const atual = S.state.cabDef?.file || '';
const outro = alvos.find((a) => a.c.file !== atual);
const terceiro = alvos.find((a) => a.c.file !== atual && a.c.file !== outro?.c.file);

async function trocarPara(a) {
  const ok = await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.m.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  if (!ok) return false;
  const chegou = await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 180000);
  for (let i = 0; i < 10; i++) await B.frame();
  return chegou;
}

if (!outro) {
  out.push(['★', 'não há um segundo chassi carregável — ato 2 pulado']);
} else {
  out.push(['trocando para', outro.c.file.split('/').pop()]);
  const foi = await trocarPara(outro);
  out.push(['carregou', String(foi)]);
  const depois = poseTK();
  out.push(['depois · TK abaixo do teto', depois ? mm(depois.abaixoDoTeto) : '—']);
  out.push(['depois · base sobre o piso', depois ? mm(depois.baseSobreOPiso) : '—']);
  if (antes && depois) {
    const d = depois.abaixoDoTeto - antes.abaixoDoTeto;
    out.push(['★ A UNIDADE DESCEU', mm(d)]);
    out.push(['★ VEREDITO DO SINTOMA', Math.abs(d) < 0.005
      ? 'a unidade FICOU no lugar — não reproduzido'
      : 'REPRODUZIDO: a troca de cavalo move o Thermo King']);
  }
}

/* =====================  ATO 3 — O CONTROLE  ============================== */
out.push(['—— ATO 3 ——', 'a mesma troca, com a fusão SOLTA antes']);

if (!terceiro) {
  out.push(['★', 'não há um terceiro chassi — ato 3 pulado']);
} else {
  const base = poseTK();
  S.merge.release();
  for (let i = 0; i < 6; i++) await B.frame();
  out.push(['trocando para', terceiro.c.file.split('/').pop()]);
  const foi = await trocarPara(terceiro);
  out.push(['carregou', String(foi)]);
  const ctrl = poseTK();
  out.push(['controle · TK abaixo do teto', ctrl ? mm(ctrl.abaixoDoTeto) : '—']);
  if (base && ctrl && antes) {
    const d = ctrl.abaixoDoTeto - antes.abaixoDoTeto;
    out.push(['★ DESVIO CONTRA O BOOT', mm(d)]);
    out.push(['★ VEREDITO DO CONTROLE', Math.abs(d) < 0.005
      ? 'com a fusão solta a troca NÃO move a unidade — CAUSA CONFIRMADA'
      : 'ainda se move com a fusão solta — há uma segunda causa']);
  }
}

return out;
