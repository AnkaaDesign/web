/* O PORTÃO DAS CONFIGURAÇÕES DE CHASSI — 2026-08-22.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-chassis-config-0822.mjs

   > *"preciso que o vw e volvo tenham os chassi bitruck, truck e toco"*

   Ele carrega TODA configuração de rígido do catálogo e mede a mesma coisa em
   cada uma: quantos conjuntos de roda `swapTruckWheels()` colocou, e onde.
   É o portão certo porque é o que o defeito produziria — um toco derivado com
   o pneu do eixo auxiliar esquecido no arquivo nasce com TRÊS eixos, agora com
   a roda do VM, e passa despercebido em qualquer conferência de contagem de
   triângulo.

   A régua por configuração (conjuntos de roda, contando cada lado):

       4x2 toco      2 avulsos (direção) + 2 duplos (tração)      = 4
       6x2 truck     2 avulsos + 4 duplos                          = 6
       6x4 traçado   2 avulsos + 4 duplos                          = 6
       8x2 bitruck   4 avulsos + 4 duplos                          = 8

   ⚠️ E ELE CONFERE A MONTAGEM, não só a rodagem: um chassi derivado sem entrada
   em `mounts.json` cai no ramo LEGADO de `loadCab()`, que assenta por caixa
   envolvente — o caminhão aparece, a carroceria monta, e tudo fica 100 mm fora
   do lugar sem um único aviso. `state.cabMount` existir é o portão disso. */

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

/** O que se espera de cada `axles.config`. */
const REGUA = {
  '4x2': { avulsos: 2, duplos: 2 },
  '6x2': { avulsos: 2, duplos: 4 },
  '6x4': { avulsos: 2, duplos: 4 },
  '8x2': { avulsos: 4, duplos: 4 },
};

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
out.push(['0 · rígidos no catálogo', alvos.map((a) => `${a.mo.id}/${a.c.id}`).join(' · ')]);

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
  out.push([`★ ${rot} · tem entrada em mounts.json`, !!mount]);
  if (!mount) continue;
  const cfg = mount.axles?.config || '?';
  out.push([`${rot} · config`, `${cfg} · steer ${(mount.axles.steerZ || []).map(mm).join(',')}`
    + ` · drive ${(mount.axles.driveZ || []).map(mm).join(',')}`
    + ` · lift ${(mount.axles.liftZ || []).map(mm).join(',') || '—'}`]);
  out.push([`★ ${rot} · o id do chassi combina com o config`,
    a.c.id.replace(/[^0-9x]/g, '').startsWith(cfg)]);

  /* A RODAGEM QUE O MOTOR COLOCOU. Os nós são batizados por
     `swapTruckWheels()`; o doador da roda (o próprio VM 6x2) não passa pela
     troca e por isso é medido pela rodagem ORIGINAL, que continua visível. */
  let avulsos = 0, duplos = 0, orig = 0;
  cab.traverse((o) => {
    if (/^VM_WHEEL_SINGLE_/.test(o.name || '')) avulsos++;
    else if (/^VM_WHEEL_DUAL_/.test(o.name || '')) duplos++;
  });
  const doador = /volvo_vm_2015_6x2r\.glb$/.test(a.c.file);
  if (doador) {
    /* No doador conta-se o PNEU original visível, por eixo e lado. */
    const eixos = new Set();
    cab.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const m = /^wheel_([fr])_(\d+)_/.exec(o.name || '');
      if (m) eixos.add(`${m[1]}${m[2]}`);
    });
    orig = eixos.size;
  }
  const esperado = REGUA[cfg];
  out.push([`${rot} · conjuntos de roda`, doador
    ? `${orig} nós de roda originais (doador, não troca)`
    : `${avulsos} avulso(s) + ${duplos} duplo(s)`]);
  if (!doador && esperado) {
    out.push([`★ ${rot} · rodagem bate com ${cfg} (${esperado.avulsos}+${esperado.duplos})`,
      avulsos === esperado.avulsos && duplos === esperado.duplos]);
  }

  /* A CARROCERIA MONTOU. */
  out.push([`★ ${rot} · implemento montado`, !!S.state.trailer && !!S.state.trailerRig]);

  /* FOTO do flanco, na régua de sempre. */
  const bb = new THREE.Box3().setFromObject(cab);
  const c = bb.getCenter(new THREE.Vector3());
  const t = S.state.trailer ? new THREE.Box3().setFromObject(S.state.trailer) : bb;
  const tudo = bb.clone().union(t);
  const ct = tudo.getCenter(new THREE.Vector3());
  const larg = tudo.max.z - tudo.min.z;
  controls.target.copy(ct);
  camera.position.set(ct.x + Math.max(20, larg * 1.4), ct.y + 1.5, ct.z);
  camera.lookAt(ct);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([`foto-${a.mo.id}-${a.c.id}`, raw.toDataURL('image/png')]);
}

return out;
