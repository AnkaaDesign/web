/* SEGUNDA VOLTA — o que a primeira mediu e não explicou (2026-08-22).
   ===========================================================================
   A primeira volta (`checks-scania-0822.mjs`) devolveu três números que não
   fecham com a foto, e esta bancada existe para fechá-los:

     1. os DOIS flancos têm 400 calotas cada, nas mesmas 8 colunas — e o dono
        diz que um lado está errado e o outro certo. A única diferença entre a
        foto dele e a minha é a PORTA lateral. Aqui ela entra, e os dois
        flancos são medidos de novo.
     2. os nove `REPEAT_skirt` da saia (fita 3M e lanternas) vieram com
        **0 instâncias** — e a fita aparece na tela. Ou a fita desenhada é a
        casca ORIGINAL (e então o espaçamento é o do bake, não o do passo), ou
        a contagem é lida errada. Este arquivo mede as duas coisas.
     3. o trilho de topo: quantas das seis peças `dressTopRail()` de fato
        tratou, e o histograma de cada uma.

   Mais a placa (a nossa e a de fábrica) e o console da página.

       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks diag/checks-scania2-0822.mjs */

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
for (let i = 0; i < 16; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;
const cab = S.state.cab;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();

function boxLocal(o) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const a = o.geometry?.attributes?.position;
  if (!a) return null;
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).applyMatrix4(toLocal);
    b.expandByPoint(v);
  }
  return b.isEmpty() ? null : b;
}
const cx = (b) => (b ? `${mm(b.min.x)}…${mm(b.max.x)} · ${mm(b.min.y)}…${mm(b.max.y)}`
  + ` · ${mm(b.min.z)}…${mm(b.max.z)}` : '—');

/* ================================================ 1. A FITA, DE VERDADE */
/* Toda malha (instanciada ou não) cujo material seja da saia, com a caixa de
   cada CASCA — e não só a da malha: uma casca colapsada tem caixa de tamanho
   zero, que é como se prova que ela saiu de cena. */
const porMaterial = new Map();
t.traverse((o) => {
  if (!o.isMesh && !o.isInstancedMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const nome = mats.map((m) => m?.name || '?').join('+');
  if (!/Faixa-3M/i.test(nome)) return;
  const b = boxLocal(o);
  const e = porMaterial.get(nome) || [];
  e.push({ o, b });
  porMaterial.set(nome, e);
});
for (const [nome, lista] of porMaterial) {
  out.push([`1 · malhas com ${nome}`, String(lista.length)]);
  for (const { o, b } of lista) {
    out.push([`1 · ${o.name || '(anon)'}`,
      `${o.isInstancedMesh ? `INSTANCED count=${o.count}` : 'mesh'}`
      + ` · vis ${o.visible} · ${cx(b)}`]);
  }
}
/* Os SEGMENTOS de fita, achados por componente conexa em z sobre TODA a
   geometria de Faixa-3M visível — é isso que o olho vê, e é isso que tem de
   estar a passo. */
for (const lado of [1, -1]) {
  const zs = [];
  t.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!/Faixa-3M/i.test(mats.map((m) => m?.name || '').join('+'))) return;
    if (!o.visible) return;
    const a = o.geometry?.attributes?.position;
    if (!a) return;
    const inst = o.isInstancedMesh ? o.count : 1;
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) o.getMatrixAt(k, m);
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i);
        if (o.isInstancedMesh) v.applyMatrix4(m);
        v.applyMatrix4(o.matrixWorld).applyMatrix4(toLocal);
        if (Math.sign(v.x) !== lado || Math.abs(v.x) < 0.9) continue;
        zs.push(v.z);
      }
    }
  });
  zs.sort((a, b) => a - b);
  const seg = [];
  for (const z of zs) {
    const u = seg[seg.length - 1];
    if (u && z - u.z1 < 0.02) u.z1 = Math.max(u.z1, z);
    else seg.push({ z0: z, z1: z });
  }
  out.push([`1 · fita flanco ${lado > 0 ? '+x' : '-x'}`, `${seg.length} segmentos`]);
  out.push([`1 · fita ${lado > 0 ? '+x' : '-x'} spans`,
    seg.map((s) => `${mm(s.z0)}→${mm(s.z1)}`).join(' ')]);
  const vaos = [];
  for (let i = 1; i < seg.length; i++) vaos.push(seg[i].z0 - seg[i - 1].z1);
  out.push([`1 · fita ${lado > 0 ? '+x' : '-x'} vãos`, vaos.map((v) => mm(v)).join(' ')]);
}

/* os REPEAT internos */
const reps = [];
t.traverse((o) => { if (o.isInstancedMesh && /^REPEAT/.test(o.name || '')) reps.push(o); });
out.push(['1 · REPEAT no implemento', String(reps.length)]);
for (const r of reps) {
  const mats = Array.isArray(r.material) ? r.material : [r.material];
  out.push([`1 · ${r.name} [${mats.map((m) => m?.name || '?').join('+')}]`,
    `count ${r.count} · vis ${r.visible}`]);
}

/* ============================================== 2. A PORTA E OS REBITES */
function censoRebites(rotulo) {
  for (const lado of ['SIDE_L', 'SIDE_R']) {
    const riv = t.getObjectByName(lado + '_RIVETS');
    const buracos = S.state.trailerRig?.body?.getDoorHoles(lado === 'SIDE_R' ? 'right' : 'left') ?? [];
    out.push([`2 · ${rotulo} ${lado}`, riv
      ? `${riv.userData.rivets} calotas · vãos ${buracos.length
        ? buracos.map((h) => `${mm(h.z0)}…${mm(h.z1)}`).join(' ') : '—'}`
      : `AUSENTE · vãos ${buracos.length}`]);
  }
  const g = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  out.push([`2 · ${rotulo} grade`, g
    ? `${g.seamsFromFront.length} emendas · ${g.rivetRowsFromBottom.length} fileiras` : '—']);
}
censoRebites('sem porta');

/* A porta do MOTORISTA — `right` (ver SIDE_LABEL em livery.ts). */
let portaOk = 'não tentada';
try {
  if (S.measures?.addDoor) {
    S.measures.addDoor('right');
    portaOk = 'measures.addDoor(right)';
  } else if (S.models?.setTrailerDoors) {
    S.models.setTrailerDoors('right', [{ position: 3.0, width: 1.2, height: 2.1 }]);
    portaOk = 'models.setTrailerDoors(right)';
  }
} catch (e) { portaOk = 'ERRO ' + (e && e.message); }
out.push(['2 · porta', portaOk]);
await B.until(() => (S.state.trailerRig?.body?.getDoorHoles('right') ?? []).length > 0, 60000);
for (let i = 0; i < 40; i++) await B.frame();
censoRebites('com porta');

/* ==================================================== 3. TRILHO DE TOPO */
const perfil = S.state.trailerRig?.profile;
const tetoY = perfil ? perfil.roofY : 0;
/* Do mundo para a raiz: a mesma conta de `cotaNaRaiz`. */
const tetoR = (() => {
  const v = new THREE.Vector3(0, tetoY, 0).applyMatrix4(toLocal);
  return v.y;
})();
const trilhos = [];
t.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  if (/^(TRAILER_|PLACA_|FILETE_)/.test(o.name || '')) return;
  const b = boxLocal(o);
  if (!b) return;
  if (b.max.z - b.min.z < 0.5) return;
  const c = (b.min.x + b.max.x) / 2;
  if (Math.abs(c) < 0.9) return;
  if (b.max.y < tetoR - 0.06) return;
  const h = b.max.y - b.min.y;
  if (h < 0.05 || h > 0.30) return;
  trilhos.push({ o, b, sgn: c > 0 ? 1 : -1 });
});
out.push(['3 · teto na raiz', mm(tetoR)]);
out.push(['3 · peças de trilho', String(trilhos.length)]);
for (const p2 of trilhos) {
  const fora = p2.sgn > 0 ? p2.b.max.x : p2.b.min.x;
  const hist = new Map();
  const a = p2.o.geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i).applyMatrix4(p2.o.matrixWorld).applyMatrix4(toLocal);
    const d = (fora - v.x) * p2.sgn;
    if (d >= -0.0005 && d <= 0.030) {
      const bin = Math.round(d * 10000);
      hist.set(bin, (hist.get(bin) || 0) + 1);
    }
  }
  const picos = [...hist.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  const mats = Array.isArray(p2.o.material) ? p2.o.material : [p2.o.material];
  out.push([`3 · ${p2.o.name || '(anon)'} [${mats.map((m) => m?.name).join('+')}]`,
    `${cx(p2.b)} · picos ` + picos.map(([b2, n]) => `${(b2 / 10).toFixed(1)}mm:${n}`).join(' ')]);
}

/* ====================================================== 4. AS PLACAS */
out.push(['4 · licensePlateInfo', JSON.stringify(S.placa?.info ? S.placa.info() : null)]);
out.push(['4 · sítio do cavalo', JSON.stringify(
  S.placa?.sitio ? S.placa.sitio(S.state.cabDef?.file || '') : null)]);
const grupos = [];
scene.traverse((o) => { if (/^PLACA/.test(o.name || '')) grupos.push(`${o.name}(${o.type},vis=${o.visible})`); });
out.push(['4 · nós PLACA na cena', grupos.join(' · ') || 'nenhum']);
if (cab) {
  const feitas = [];
  cab.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nome = mats.map((m) => m?.name || '').join('+');
    if (!/baseplaca|brasilmercosul|placa/i.test(nome + (o.name || ''))) return;
    const b = new THREE.Box3().setFromObject(o);
    feitas.push(`${o.name}[${nome}] vis=${o.visible} y ${mm(b.min.y)}…${mm(b.max.y)}`
      + ` z ${mm(b.min.z)}…${mm(b.max.z)}`);
  });
  out.push(['4 · placas de fábrica no caminhão', String(feitas.length)]);
  for (const f of feitas) out.push(['4 ·', f]);
}

/* ====================================================== 5. AS FOTOS */
/* ⚠️ A TRASEIRA DO VEÍCULO OLHA PARA +Z EM MUNDO — o `rigGroup` carrega
   `orientYaw = π`. A primeira volta usou azimute 0 para "frente" e fotografou
   as portas traseiras. */
const raw = renderer.domElement;
const bMundo = new THREE.Box3().setFromObject(t);
const alvo0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo0.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
tira('s2-porta-motorista', 7, -90, 2, V(0, -0.3, 0));
tira('s2-porta-passageiro', 7, 90, 2, V(0, -0.3, 0));
tira('s2-traseira', 11, 8, 4, V(0, -0.8, 0));
tira('s2-traseira-perto', 7, 0, -2, V(0, -1.4, 0));
tira('s2-trilho-topo', 5, -70, 22, V(0, 1.0, -2.0));
tira('s2-frente-cabine', 11, 200, 12, null);
tira('s2-tk-frente', 6, 190, 30, V(0, 1.2, -3.2));

return out;
