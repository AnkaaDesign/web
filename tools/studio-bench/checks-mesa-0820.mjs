/* A MESA DA LONGARINA CAI PARA A FRENTE? — a medida antes do código.
   ===========================================================================
   *"veja o vão entre o chassi do truck e o implemento, precisa corrigir isso,
   já que a parte da frente do chassi é mais baixa, o implemento deve ficar
   levemente inclinado"* — Kennedy, 2026-08-20.

   `mounts.json` traz `frameTopY` como UM número — o percentil 90 do máximo por
   célula de 250 mm na faixa da longarina (|x| 0,25…0,55). Se a mesa for uma
   RAMPA, esse número é a média dela, e a carroceria assenta nivelada sobre um
   quadro que não é.

   Esta sonda não conclui: ela mede a mesa CÉLULA A CÉLULA no referencial do
   próprio caminhão e ajusta uma reta na zona de carroceria. O que ela precisa
   provar antes de virar código é que a rampa EXISTE e que ela é limpa — a
   faixa da longarina também pega travessa, tanque e berço de eixo, e uma reta
   ajustada sobre isso é uma reta sobre ruído.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-mesa-0820.mjs > /tmp/mesa.txt */

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
for (let i = 0; i < 16; i++) await B.frame();
const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}

/**
 * A MESA, por ÁREA DE FACE VIRADA PARA CIMA — e não pelo percentil do y.
 *
 * ⚠️ O percentil não isola a mesa. A janela da longarina pega travessa, tanque,
 * berço de eixo e suporte de para-lama na mesma faixa de x, e o p90 do y de uma
 * célula é o topo do que estiver mais alto ali — que muda de peça a cada
 * célula. Medido assim, os dois rígidos discordam por 6× e o resíduo do ajuste
 * fica na ordem de metade do sinal.
 *
 * O que a mesa TEM e as outras peças não é uma FACE HORIZONTAL GRANDE virada
 * para cima. Então a régua é área: por célula de 250 mm, o histograma da área
 * de triângulo com normal em +y por banda de 5 mm em y, e a resposta é a banda
 * de maior área. É a mesma técnica de `measureCabRearWall()` em
 * `vehicle/mounting.ts`, que achou a parede da cabine onde o mínimo de z só
 * achava a chaminé.
 */
function medeMesa(rotulo) {
  const cab = S.state.cab;
  if (!cab) { out.push([`${rotulo}`, 'sem cabine']); return; }
  cab.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  /** por célula de z: Map(banda de 5 mm em y → área acumulada) */
  const cel = new Map();
  cab.traverse((o) => {
    const at = o.isMesh && o.geometry?.attributes?.position;
    if (!at) return;
    const idx = o.geometry.getIndex();
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const nTri = idx ? idx.count / 3 : at.count / 3;
    for (let t = 0; t < nTri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(at, i0).applyMatrix4(m);
      b.fromBufferAttribute(at, i1).applyMatrix4(m);
      c.fromBufferAttribute(at, i2).applyMatrix4(m);
      const cx = (a.x + b.x + c.x) / 3;
      const ax = Math.abs(cx);
      if (ax < 0.30 || ax > 0.52) continue;             // a faixa da longarina
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      const area2 = nn.length();
      if (area2 < 1e-9) continue;
      if (nn.y / area2 < 0.9) continue;                 // virada para CIMA
      const cy = (a.y + b.y + c.y) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      const k = Math.round(cz / 0.25);
      let h = cel.get(k);
      if (!h) { h = new Map(); cel.set(k, h); }
      const yb = Math.round(cy / 0.005);
      h.set(yb, (h.get(yb) || 0) + area2 / 2);
    }
  });
  const cells = [];
  for (const [k, h] of cel) {
    let melhorY = 0, melhorA = 0, total = 0;
    for (const [yb, ar] of h) { total += ar; if (ar > melhorA) { melhorA = ar; melhorY = yb * 0.005; } }
    /* 0,02 m² por célula é o que uma mesa de 250 × 100 mm dá; abaixo disso o
       que houver ali é aba de travessa, não mesa. */
    if (melhorA >= 0.02) cells.push({ z: k * 0.25, y: melhorY, a: melhorA, tot: total });
  }
  cells.sort((x, y2) => x.z - y2.z);
  if (cells.length < 6) { out.push([`${rotulo}`, `poucas células (${cells.length})`]); return; }

  const med = [...cells].map((x) => x.y).sort((x, y2) => x - y2)[cells.length >> 1];
  const bons = cells.filter((x) => Math.abs(x.y - med) < 0.15);
  const n = bons.length;
  const sz = bons.reduce((s2, x) => s2 + x.z, 0) / n;
  const sy = bons.reduce((s2, x) => s2 + x.y, 0) / n;
  let num = 0, den = 0;
  for (const x of bons) { num += (x.z - sz) * (x.y - sy); den += (x.z - sz) ** 2; }
  const inc = den > 0 ? num / den : 0;
  let res = 0;
  for (const x of bons) res += ((x.y - sy) - inc * (x.z - sz)) ** 2;
  const rms = Math.sqrt(res / n);

  out.push([`${rotulo} · mesa`, `${n}/${cells.length} células · mediana ${r4(med)}`
    + ` · z ${r4(bons[0].z)}…${r4(bons[n - 1].z)}`
    + ` · INCLINAÇÃO ${(inc * 1000).toFixed(1)} mm/m = ${(Math.atan(inc) * 180 / Math.PI).toFixed(3)}°`
    + ` · resíduo RMS ${(rms * 1000).toFixed(1)} mm`]);
  out.push([`${rotulo} · células`,
    bons.map((x) => `${x.z.toFixed(2)}:${r4(x.y)}(${x.a.toFixed(3)})`).join(' ')]);
}

/**
 * O VÃO, medido por RAIO — que é o que o dono vê.
 *
 * Em vez de ajustar uma reta na mesa (que a malha de chassi não entrega limpa
 * nos dois rígidos), esta mede a distância do FUNDO DA CARROCERIA até a
 * primeira coisa do CAMINHÃO abaixo dela, ao longo do comprimento. O perfil
 * dessa distância É a cunha: se ela cresce para a frente, a carroceria está
 * nivelada sobre um quadro que não é, e a inclinação que fecha o vão é a
 * inclinação dele.
 */
function medeVao(rotulo) {
  const t = S.state.trailer, cab = S.state.cab;
  if (!t || !cab) { out.push([rotulo, 'sem conjunto']); return; }
  t.updateWorldMatrix(true, true);
  cab.updateWorldMatrix(true, true);
  const p = S.state.trailerRig.profile;
  /* O FUNDO DA CARROCERIA é o sub-chassi dela, não o piso do baú: é ele que
     assenta na mesa. `measureMountDatum()` o define, e aqui basta a caixa das
     malhas do implemento abaixo do piso. */
  /* ⚠️ O FUNDO É POR CÉLULA, e não um número só. Com a carroceria INCLINADA um
     plano horizontal em `min(y)` deixa de ser paralelo ao fundo dela: os raios
     de uma ponta nascem dentro da estrutura e os da outra a metros de
     distância, e o "vão" que sai é a inclinação, não a folga. Medir o fundo em
     cada célula de z tira a pose da conta — é a mesma doutrina de
     `solveRigidMount()`, que mede no referencial da peça e não na pose. */
  const v = new THREE.Vector3();
  const fundoDe = new Map();
  t.traverse((o) => {
    const at = o.isMesh && o.geometry?.attributes?.position;
    if (!at) return;
    for (let i = 0; i < at.count; i += 3) {
      v.fromBufferAttribute(at, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.x) > 0.6) continue;
      const k = Math.round(v.z / 0.25);
      const e = fundoDe.get(k);
      if (e === undefined || v.y < e) fundoDe.set(k, v.y);
    }
  });
  const rc = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, -1, 0);
  const linhas = [];
  const pts = [];
  const cx = new THREE.Vector3(0, 0, p.z0).applyMatrix4(t.matrixWorld);
  const cy2 = new THREE.Vector3(0, 0, p.z1).applyMatrix4(t.matrixWorld);
  const zA = Math.min(cx.z, cy2.z), zB = Math.max(cx.z, cy2.z);
  const invCab = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  for (let k = Math.ceil((zA + 0.2) / 0.25); k <= Math.floor((zB - 0.2) / 0.25); k++) {
    const z = k * 0.25;
    const f = fundoDe.get(k);
    if (f === undefined) continue;
    for (const sx of [0.42, -0.42]) {
      rc.set(new THREE.Vector3(sx, f + 0.02, z), dir);
      const hit = rc.intersectObject(cab, true)[0];
      if (!hit) continue;
      const vao = (f + 0.02) - hit.point.y;
      if (vao > 0.6) continue;                       // não é a mesa, é o chão
      const pl = hit.point.clone().applyMatrix4(invCab);
      linhas.push(`${z.toFixed(2)}:${(vao * 1000).toFixed(0)}`);
      pts.push({ z, v: vao, lz: pl.z, ly: pl.y });
      break;
    }
  }
  if (pts.length < 4) { out.push([rotulo, `poucos raios (${pts.length})`]); return; }
  const n = pts.length;
  const sz = pts.reduce((a, c) => a + c.z, 0) / n;
  const sv = pts.reduce((a, c) => a + c.v, 0) / n;
  let num = 0, den = 0;
  for (const c of pts) { num += (c.z - sz) * (c.v - sv); den += (c.z - sz) ** 2; }
  const inc = den > 0 ? num / den : 0;
  let res = 0;
  for (const c of pts) res += ((c.v - sv) - inc * (c.z - sz)) ** 2;
  /* E a INCLINAÇÃO DA MESA no referencial da cabine, por Theil–Sen: a mediana
     das inclinações par a par. Um ajuste de mínimos quadrados é arrastado pelo
     raio que bate numa travessa; a mediana não é. */
  const decl = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dz = pts[j].lz - pts[i].lz;
      if (Math.abs(dz) < 0.5) continue;
      decl.push((pts[j].ly - pts[i].ly) / dz);
    }
  }
  decl.sort((x, y2) => x - y2);
  const incCab = decl.length ? decl[decl.length >> 1] : 0;
  out.push([`${rotulo} · MESA na cabine`,
    `Theil–Sen ${(incCab * 1000).toFixed(2)} mm/m = ${(Math.atan(incCab) * 180 / Math.PI).toFixed(3)}°`
    + ` · ${decl.length} pares · z_cab ${pts[0].lz.toFixed(2)}…${pts[pts.length - 1].lz.toFixed(2)}`
    + ` · y_cab ${pts[0].ly.toFixed(3)}…${pts[pts.length - 1].ly.toFixed(3)}`]);

  const vmin = Math.min(...pts.map((c) => c.v));
  const vmax = Math.max(...pts.map((c) => c.v));
  out.push([`${rotulo} · VÃO`, `${n} raios · vão ${(vmin * 1000).toFixed(0)}…${(vmax * 1000).toFixed(0)} mm`
    + ` · vão médio ${(sv * 1000).toFixed(0)} mm`
    + ` · variação ${(inc * 1000).toFixed(1)} mm/m = ${(Math.atan(inc) * 180 / Math.PI).toFixed(3)}°`
    + ` · resíduo ${(Math.sqrt(res / n) * 1000).toFixed(1)} mm`]);
  out.push([`${rotulo} · perfil do vão`, linhas.join(' ')]);
}

medeMesa(`${S.state.cabDef?.file || '?'}`);
medeVao(`${S.state.cabDef?.file || '?'}`);

for (const alvo of alvos.filter((a) => /vm_2015_6x2r|scania_p/i.test(a.c.file)).slice(0, 2)) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: alvo.mk.id, modelId: alvo.mo.id, chassisId: alvo.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 16; i++) await B.frame();
  medeMesa(alvo.c.file);
  medeVao(alvo.c.file);
}
return out;
