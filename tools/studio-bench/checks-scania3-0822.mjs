/* TERCEIRA VOLTA, curta — três perguntas de FATO (2026-08-22).
   ===========================================================================
     A. por que os `REPEAT_skirt` estão com ZERO instância (a fita 3M e as
        lanternas laterais da saia). Lê as tripas do `TrailerAssembly`.
     B. o material da chapa da Ankaa e o das peças em volta dela.
     C. o que `dressTopRail()` reportou, e a linha `[marca]` — o console inteiro.

       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-scania3-0822.mjs */

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
for (let i = 0; i < 24; i++) await B.frame();

const t = S.state.trailer;
const rig = S.state.trailerRig;
const asm = rig?.assembly;

/* ================================================================== A */
out.push(['A · assembly?', String(!!asm)]);
if (asm) {
  out.push(['A · stats', JSON.stringify(asm.stats)]);
  out.push(['A · repeats', String(asm.repeats?.length ?? -1)]);
  out.push(['A · families', String(asm.families?.length ?? -1)]);
  for (const r of (asm.repeats || [])) {
    const mats = Array.isArray(r.mesh.material) ? r.mesh.material : [r.mesh.material];
    out.push([`A · ${r.mesh.name}[${mats.map((m) => m?.name).join('+')}]`,
      `count ${r.mesh.count} · cap ${r.cap} · count0 ${r.count0}`
      + ` · own [${[...r.own].join(',')}] · k0 ${r.k0} · res ${mm(r.res)}`
      + ` · axis ${r.axis} · pitch ${mm(r.pitch)} · y ${r.y} · z ${r.z}`
      + ` · membros ${r.members.length}`
      + ` · FAM base ${mm(r.fam.base)} slots ${r.fam.slots} lo ${r.fam.lo}`
      + ` count ${r.fam.count} at ${mm(r.fam.at)} pitch ${mm(r.fam.pitch)}`
      + ` no grafo ${!!r.mesh.parent}`]);
  }
  /* E o que acontece se `set()` for chamado de novo, com as MESMAS medidas. */
  const d = rig.current;
  asm.set(d.height, d.length);
  out.push(['A · depois de um set() manual',
    (asm.repeats || []).map((r) => `${r.mesh.name}=${r.mesh.count}`).join(' ')]);
}

/* ================================================================== B */
const placa = t.getObjectByName('PLACA_MARCA_ANKAA');
if (!placa) out.push(['B · PLACA_MARCA_ANKAA', 'AUSENTE']);
else {
  const m = Array.isArray(placa.material) ? placa.material[0] : placa.material;
  const b = new THREE.Box3().setFromObject(placa);
  out.push(['B · chapa Ankaa', `mat ${m?.name} · cor ${m?.color?.getHexString?.()}`
    + ` · metal ${m?.metalness} · rough ${m?.roughness} · envInt ${m?.envMapIntensity}`
    + ` · envMap ${!!m?.envMap} · map ${!!m?.map} · vis ${placa.visible}`]);
  const c = b.getCenter(new THREE.Vector3());
  const perto = [];
  t.traverse((o) => {
    if (!o.isMesh || o === placa || !o.geometry?.attributes?.position) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.distanceToPoint(c) > 0.6) return;
    const mm2 = Array.isArray(o.material) ? o.material : [o.material];
    for (const x of mm2) {
      if (!x) continue;
      perto.push(`${x.name} m${(x.metalness ?? 0).toFixed(2)} r${(x.roughness ?? 1).toFixed(2)}`
        + ` env${(x.envMapIntensity ?? 0).toFixed(2)} cor#${x.color?.getHexString?.() || '?'}`);
    }
  });
  out.push(['B · em volta (0,6 m)', [...new Set(perto)].join(' · ') || 'nada']);
}

/* ================================================================== C */
/* o console sai por --verbose; aqui só o que o motor guarda */
out.push(['C · perfil', JSON.stringify(rig ? {
  floorY: +rig.profile.floorY.toFixed(4), roofY: +rig.profile.roofY.toFixed(4),
  pitch: +rig.profile.pitch.toFixed(4), ribCount: rig.profile.ribCount,
  topRailY: rig.profile.topRailY, skirtHeight: +rig.profile.skirtHeight.toFixed(4),
} : null)]);

return out;
