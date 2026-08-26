/* O REFERENCIAL DAS CORREÇÕES DE BAKE — e as cinco pendências, medidas no app.
   ===========================================================================
   Esta sonda existe por causa de UMA suspeita, e ela é estrutural:

     `TrailerBody` mede em espaço de MUNDO (`collect()` aplica `matrixWorld`),
     e `trailer-bake-fixes.ts` mede em espaço da RAIZ (`toLocal · matrixWorld`).
     Os dois diferem pela translação que `groundAndCenter()` escreve em
     `root.position` — e é justamente `floorY`/`roofY`/`row0` que atravessa a
     fronteira, como número solto.

   Se a translação for zero, nada acontece e a suspeita morre aqui. Se não for,
   toda correção que compara caixa local com limiar de mundo está deslocada por
   ela — em silêncio, e por implemento, porque o assentamento do semirreboque
   (pelos pneus) e o do sobrechassi (pelo datum de montagem) não são o mesmo.

   Ela mede os dois implementos: o padrão, e o sobrechassi depois de UMA troca
   de chassi (⚠️ a bancada trava passando de ~10 min quando encadeia várias).

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-referencial-0820.mjs > /tmp/ref-0820.txt */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 20; i++) await B.frame();
const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);
const mm = (v) => +(v * 1000).toFixed(1);
const vis = (o) => { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; };
const nomeMat = (o) => (Array.isArray(o.material) ? o.material : [o.material])
  .map((m) => m?.name || '?').join('+');

/**
 * A MATRIZ DE CONSTRUÇÃO — e ela é a chave desta sonda.
 *
 * `TrailerBody.profile` (`floorY`, `roofY`, `z0`, `row0`) é medido em MUNDO no
 * construtor, que roda ANTES de `placeTrailer()`. Depois disso o implemento é
 * girado 180° e levado 9,6 m adiante, então o `matrixWorld` de AGORA não é o
 * mesmo mundo em que aqueles números foram escritos. `state.trailerBase.pos`
 * guarda exatamente a pose daquele instante (e a rotação era zero), então é ela
 * que reconstrói o referencial. Medir no `matrixWorld` corrente e comparar com
 * `floorY` é o erro que esta sonda existe para não cometer.
 */
let M_CONSTR = new THREE.Matrix4();
function atualizaMatrizDeConstrucao() {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const base = S.state.trailerBase?.pos;
  const daConstrucao = new THREE.Matrix4().makeTranslation(
    base ? base.x : 0, base ? base.y : 0, base ? base.z : 0);
  /* mundo_de_construção = T_base · (matrixWorld_atual da raiz)⁻¹ · matrixWorld */
  M_CONSTR = daConstrucao.multiply(new THREE.Matrix4().copy(t.matrixWorld).invert());
}

/** Caixa por VÉRTICE, no MUNDO DE CONSTRUÇÃO. */
function caixaMundo(o) {
  const p = o.geometry?.attributes?.position;
  if (!p) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4().multiplyMatrices(M_CONSTR, o.matrixWorld);
  for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  return b;
}

/* O CONSOLE DA PÁGINA, capturado — é onde as correções de bake dizem o que
   fizeram, e a bancada não o encaminha. */
const CONSOLE = [];
for (const nivel of ['info', 'warn', 'error']) {
  const orig = console[nivel].bind(console);
  console[nivel] = (...a) => {
    const t = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (/\[bake\]|\[livery\]|\[baú\]/.test(t)) CONSOLE.push(`${nivel}: ${t}`);
    orig(...a);
  };
}

function medir(rotulo) {
  const t = S.state.trailer;
  const rig = S.state.trailerRig;
  t.updateWorldMatrix(true, true);
  atualizaMatrizDeConstrucao();
  const p = rig.profile;
  const base = S.state.trailerBase?.pos;
  out.push([`${rotulo} · POSE DE CONSTRUÇÃO (trailerBase.pos)`,
    base ? `x ${r4(base.x)} · y ${r4(base.y)} · z ${r4(base.z)}` : '(ausente)']);

  /* ---- 1. A TRANSLAÇÃO DA RAIZ, que é a pergunta ---- */
  const tr = new THREE.Vector3().setFromMatrixPosition(t.matrixWorld);
  const esc = new THREE.Vector3().setFromMatrixScale(t.matrixWorld);
  const quat = new THREE.Quaternion().setFromRotationMatrix(t.matrixWorld);
  out.push([`${rotulo} · implemento`, S.state.implement?.id || '-']);
  out.push([`${rotulo} · RAIZ translação (mundo − local)`,
    `x ${r4(tr.x)} · y ${r4(tr.y)} · z ${r4(tr.z)} · escala ${r4(esc.x)} · giro ${r4(2 * Math.acos(Math.min(1, Math.abs(quat.w))) * 180 / Math.PI)}°`]);
  out.push([`${rotulo} · perfil (MUNDO)`, JSON.stringify({
    floorY: r4(p.floorY), roofY: r4(p.roofY), z0: r4(p.z0), z1: r4(p.z1),
    row0: r4(p.floorY + p.skirtHeight), pitch: r4(p.pitch), ribCount: p.ribCount,
    topRailY: p.topRailY === null ? null : r4(p.topRailY),
  })]);

  /* ---- 2. AS FITAS VERTICAIS e OS MONTANTES, em mundo ---- */
  const fitas = [], montes = [], trilhos = [], peles = [], rebites = [];
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !vis(o)) return;
    const nm = nomeMat(o);
    const b = caixaMundo(o);
    if (!b) return;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    if (/faixa.?3m/i.test(nm) && d[1] > d[0] && d[1] > d[2]) {
      fitas.push({ b, d, plano: d[0] < 0.005 ? 'flanco' : d[2] < 0.005 ? 'face' : 'dobrada' });
    }
    if (/metal-estrutura-principal-padrao|metal-galvanizado-mantido/i.test(nm)
      && d[1] > 2.0 && d[0] < 0.15 && d[2] < 0.15
      && Math.abs((b.min.x + b.max.x) / 2) > 1.0) montes.push({ b, d });
    if (/^metal-galvanizado-mantido$/i.test(nm) && d[2] > 1 && d[0] < 0.06
      && d[1] < 0.30 && b.min.y < p.floorY + 0.30) trilhos.push({ b, d });
    if (/^(SIDE_L|SIDE_R)$/.test(o.name)) peles.push({ nome: o.name, b });
    if (/rebite/i.test(nm) || /rebite/i.test(o.name || '')) rebites.push(o);
  });

  for (const f of fitas.sort((a, c) => a.b.min.y - c.b.min.y)) {
    const lado = (f.b.min.x + f.b.max.x) / 2 > 0 ? 1 : -1;
    const cz = (f.b.min.z + f.b.max.z) / 2, cx = (f.b.min.x + f.b.max.x) / 2;
    let m = null, dist = Infinity;
    for (const q of montes) {
      if (((q.b.min.x + q.b.max.x) / 2 > 0 ? 1 : -1) !== lado) continue;
      const dz = Math.abs((q.b.min.z + q.b.max.z) / 2 - cz);
      if (dz < dist) { dist = dz; m = q; }
    }
    out.push([`${rotulo} · fita ${f.plano}`,
      `x ${r4(cx)} z ${r4(cz)} y ${r4(f.b.min.y)}…${r4(f.b.max.y)}`
      + ` · base_do_piso ${mm(f.b.min.y - p.floorY)} · topo_do_teto ${mm(f.b.max.y - p.roofY)}`
      + (m ? ` · montante dz ${mm((m.b.min.z + m.b.max.z) / 2 - cz)} dx ${mm((m.b.min.x + m.b.max.x) / 2 - cx)}`
        + ` · montante y ${r4(m.b.min.y)}…${r4(m.b.max.y)}` : ' · SEM MONTANTE')]);
  }

  /* ---- 3. O TRILHO DE PISO contra a CHAPA DE LIVERY (que já tem o remonte) ---- */
  for (const sgn of [1, -1]) {
    const lado = sgn > 0 ? 'direita' : 'esquerda';
    let tx = -Infinity, ty = null;
    for (const r of trilhos) {
      if (sgn > 0 ? r.b.max.x <= 0 : r.b.min.x >= 0) continue;
      const o2 = sgn > 0 ? r.b.max.x : -r.b.min.x;
      if (o2 > tx) { tx = o2; ty = [r4(r.b.min.y), r4(r.b.max.y)]; }
    }
    /* A pele NA FAIXA DO TRILHO — é o plano que o perfil tem de cobrir, e é
       nele que `applyPlateLap()` já somou até 2,2 mm. */
    let px = -Infinity;
    for (const s of peles) {
      const pos = s.b;
      if (sgn > 0 ? pos.max.x <= 0 : pos.min.x >= 0) continue;
      const o2 = sgn > 0 ? pos.max.x : -pos.min.x;
      if (o2 > px) px = o2;
    }
    /* …e o x máximo da chapa RESTRITO à faixa de altura do trilho. */
    let pxFaixa = -Infinity;
    const v = new THREE.Vector3();
    for (const s of peles) {
      const o = t.getObjectByName(s.nome);
      const at = o?.geometry?.attributes?.position;
      if (!at) continue;
      const mC = new THREE.Matrix4().multiplyMatrices(M_CONSTR, o.matrixWorld);
      for (let i = 0; i < at.count; i++) {
        v.fromBufferAttribute(at, i).applyMatrix4(mC);
        if (v.y < p.floorY - 0.10 || v.y > p.floorY + 0.14) continue;
        const o2 = sgn * v.x;
        if (o2 > pxFaixa) pxFaixa = o2;
      }
    }
    out.push([`${rotulo} · trilho ${lado}`,
      `trilho_x ${r4(tx)} · chapa_x(máx) ${r4(px)} · chapa_x(faixa do trilho) ${r4(pxFaixa)}`
      + ` · SOBRESSAI ${mm(tx - pxFaixa)} mm · y ${JSON.stringify(ty)}`
      + ` · pé_do_piso ${ty ? mm(ty[0] - p.floorY) : '-'} · topo ${ty ? mm(ty[1] - p.floorY) : '-'}`]);
  }

  /* ---- 4. OS REBITES: a fase de cada FILEIRA contra `row0` ----
     A calota é uma semiesfera de 9 mm apontada para ±x: em y ela é SIMÉTRICA
     em torno da fileira, então o centro de cada aglomerado é a altura da
     fileira. A moda do histograma não serve — o anel do equador tem tantos
     vértices quanto o polo, e ela oscila entre os dois. */
  const row0 = p.floorY + p.skirtHeight;
  const alturas = [];
  for (const o of rebites) {
    const at = o.geometry?.attributes?.position;
    if (!at) continue;
    const v = new THREE.Vector3();
    const mC = new THREE.Matrix4().multiplyMatrices(M_CONSTR, o.matrixWorld);
    const ys = [];
    for (let i = 0; i < at.count; i++) {
      v.fromBufferAttribute(at, i).applyMatrix4(mC);
      ys.push(v.y);
    }
    ys.sort((a, c) => a - c);
    let ini = 0;
    for (let i = 1; i <= ys.length; i++) {
      if (i === ys.length || ys[i] - ys[i - 1] > 0.004) {
        if (i - ini > 8) alturas.push((ys[ini] + ys[i - 1]) / 2);
        ini = i;
      }
    }
  }
  alturas.sort((a, c) => a - c);
  const fases = alturas.map((y) => +((((y - row0) % p.pitch) + p.pitch) % p.pitch * 1000).toFixed(1));
  out.push([`${rotulo} · rebites`, `${rebites.length} malha(s) · ${alturas.length} fileira(s)`
    + ` · row0 ${r4(row0)} · rowPhase previsto ${mm(0.0467 - p.pitch / 2)} mm`
    + ` · FASES MEDIDAS ${JSON.stringify(fases.slice(0, 12))}`
    + ` · y das 6 primeiras ${JSON.stringify(alturas.slice(0, 6).map(r4))}`]);

  /* ---- 4z. O PERFIL DA MESA DA LONGARINA, célula a célula ----
     *"a parte da frente do chassi é mais baixa, o implemento deve ficar
     levemente inclinado"*. `mounts.json` traz `frameTopY` como UM número (o
     percentil 90 sobre a faixa inteira); se a mesa cair para a frente, esse
     número é a média de uma rampa. Aqui ela sai célula a célula. */
  if (S.state.cab) {
    const cab = S.state.cab;
    cab.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    const cel = new Map();
    cab.traverse((o) => {
      const at = o.isMesh && o.geometry?.attributes?.position;
      if (!at) return;
      for (let i = 0; i < at.count; i++) {
        v.fromBufferAttribute(at, i).applyMatrix4(o.matrixWorld);
        const ax = Math.abs(v.x);
        if (ax < 0.25 || ax > 0.55) continue;            // a faixa da longarina
        const k = Math.round(v.z / 0.25);
        const e = cel.get(k);
        if (!e) cel.set(k, [v.y]); else e.push(v.y);
      }
    });
    const linhas = [];
    for (const [k, ys] of [...cel.entries()].sort((a, c) => a[0] - c[0])) {
      ys.sort((a, c) => a - c);
      const p90 = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.9))];
      linhas.push(`z ${(k * 0.25).toFixed(2)} → topo ${r4(p90)} (${ys.length} v)`);
    }
    out.push([`${rotulo} · mesa da longarina`, linhas.join(' · ')]);
  }

  /* ---- 4a. O ENGATE de duas cores e os TUBOS embutidos, no app ----
     Duas perguntas que só o app responde, porque só nele rodam a fusão por
     material (`vehicle/merge.ts`), o acabamento e a tinta — os três suspeitos
     de reescrever `mesh.material` depois de `splitEngateHardware()`. */
  {
    const eng = [];
    let tubos = 0;
    t.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const nm = nomeMat(o);
      if (/engate-(femea|macho)-preto/i.test(nm)) {
        eng.push(`${nm} · array ${Array.isArray(o.material)} · grupos ${o.geometry.groups.length}`);
      }
      if (!/metal-pouco-polido/i.test(nm)) return;
      const b = caixaMundo(o);
      if (!b) return;
      const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
      if (dy > 2.0 && dx < 0.04 && dz < 0.04) tubos++;
    });
    out.push([`${rotulo} · engate dividido`, eng.length ? eng.join(' | ') : '(nenhuma malha de engate)']);
    out.push([`${rotulo} · tubos embutidos restantes`, String(tubos)]);
  }

  /* ---- 4b. INVENTÁRIO da faixa do trilho: que material existe ali ---- */
  {
    const inv = new Map();
    t.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position || !vis(o)) return;
      const b = caixaMundo(o);
      if (!b) return;
      if (b.min.y > p.floorY + 0.14 || b.max.y < p.floorY - 0.10) return;
      if (b.max.z - b.min.z < 1) return;
      const k = `${nomeMat(o)} ${mm(b.max.x - b.min.x)}×${mm(b.max.y - b.min.y)}×${mm(b.max.z - b.min.z)}`;
      const e = inv.get(k) || { n: 0, x: -Infinity, y: null };
      e.n++;
      e.x = Math.max(e.x, Math.abs(b.min.x), Math.abs(b.max.x));
      e.y = [r4(b.min.y), r4(b.max.y)];
      inv.set(k, e);
    });
    for (const [k, e] of [...inv.entries()].sort((a, c) => c[1].x - a[1].x).slice(0, 12)) {
      out.push([`${rotulo} · faixa do trilho`, `${k} · n${e.n} · |x|máx ${r4(e.x)} · y ${JSON.stringify(e.y)}`
        + ` · do piso ${mm(e.y[0] - p.floorY)}…${mm(e.y[1] - p.floorY)}`]);
    }
  }

  /* ---- 5. O PERFIL DO FRISO, dobrado pelo passo, na CHAPA DE LIVERY ---- */
  for (const s of peles) {
    const o = t.getObjectByName(s.nome);
    const at = o?.geometry?.attributes?.position;
    const nr = o?.geometry?.attributes?.normal;
    if (!at || !nr) continue;
    const sgn = s.nome === 'SIDE_R' ? 1 : -1;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const bal = new Map();
    const mC = new THREE.Matrix4().multiplyMatrices(M_CONSTR, o.matrixWorld);
    const n3 = new THREE.Matrix3().getNormalMatrix(mC);
    for (let i = 0; i < at.count; i++) {
      n.fromBufferAttribute(nr, i).applyMatrix3(n3);
      if (Math.abs(n.x) < 0.7) continue;
      v.fromBufferAttribute(at, i).applyMatrix4(mC);
      if (sgn * v.x < 0.5) continue;
      if (v.y < row0 || v.y > row0 + p.pitch * (p.ribCount - 1)) continue;
      const fase = Math.round(((((v.y - row0) % p.pitch) + p.pitch) % p.pitch) * 2000) / 2000;
      const d = sgn * v.x;
      if (!(d <= (bal.get(fase) ?? -Infinity))) bal.set(fase, d);
    }
    const dobras = [...bal.entries()].sort((a, c) => a[0] - c[0]);
    const crest = Math.max(...dobras.map((x) => x[1]));
    const naCrista = dobras.filter((x) => crest - x[1] < 0.0003).map((x) => mm(x[0]));
    out.push([`${rotulo} · perfil ${s.nome}`,
      `crista_x ${r4(crest)} · FASE DA CRISTA ${naCrista.length ? ((Math.min(...naCrista) + Math.max(...naCrista)) / 2).toFixed(1) : '-'} mm`
      + ` · dobras ${JSON.stringify(dobras.map((x) => [mm(x[0]), r4(x[1])]))}`]);
  }
}

medir('SEMIRREBOQUE');
out.push(['SEMIRREBOQUE · console do bake', CONSOLE.splice(0).join('\n      ')]);

/* ---- A TROCA: um chassi rígido traz o sobrechassi (ver §25.4) ---- */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const rigido = alvos.find((a) => (a.c.implement || a.c.implementId || '').includes('sobrechassi'))
  || alvos.find((a) => /vm|_p_|scania_p/i.test(a.c.file) && /6x2|8x2/i.test(a.c.id || ''))
  || alvos.find((a) => /rigido|rígido/i.test(`${a.mo.id} ${a.c.id}`));
out.push(['chassis disponíveis', JSON.stringify(alvos.map((a) => `${a.mo.id}/${a.c.id}`))]);
if (!rigido) {
  out.push(['★ TROCA', 'nenhum chassi rígido encontrado no catálogo']);
  return out;
}
out.push(['troca para', `${rigido.mk.id} / ${rigido.mo.id} / ${rigido.c.id}`]);
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: rigido.mk.id, modelId: rigido.mo.id, chassisId: rigido.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === rigido.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 24; i++) await B.frame();

medir('SOBRECHASSI');
out.push(['SOBRECHASSI · console do bake', CONSOLE.splice(0).join('\n      ')]);
return out;
