/* DIAGNÓSTICO — O VÃO VAZIO DO TRUCK 6x2: onde está cada coisa em z.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-truck-vao-0824.mjs

   *"agora no truck, mova os tanques para próximo da cabine, e as rodas e
   estepe também mas apenas um pouco"* — Kennedy, 2026-08-24.

   O 6x2 deste acervo é o 8x2 com o 2º direcional REMOVIDO (`cut-scania.cjs`), e
   o entre-eixos ficou o do bitruck: 6 572 mm do direcional ao trativo, contra
   ~4 800…5 200 de um truck de fábrica. O vão que sobrou é o buraco da foto.

   Mede, em Zn (espaço normalizado do caminhão, que é onde `mounts.json` fala):
   traseira da cabine, eixos, tanques, ARLA, estepe, caixa de bateria e o que
   mais vive no flanco — e o VÃO LIVRE entre cada par de vizinhos. */
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

const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
  return null;
};

for (const [modelo, chassi] of [['scania-p', '6x2r'], ['scania-p', '8x2r']]) {
  const a = acha(modelo, chassi);
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  const rot = `${modelo}/${chassi}`;

  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();

  out.push([`${rot} · eixos (Zn)`, `steer ${(mount.axles.steerZ || []).map(mm).join(', ')}`
    + ` · drive ${(mount.axles.driveZ || []).map(mm).join(', ')}`
    + ` · lift ${(mount.axles.liftZ || []).map(mm).join(', ') || '—'}`
    + ` · entre-eixos steer→drive ${mm(mount.axles.steerZ[0] - mount.axles.driveZ[0])}`
    + ` · cabRearZ ${mm(mount.cabRearZ)} · frameEndZ ${mm(mount.frameEndZ)}`]);

  /* O QUE VIVE NO FLANCO, por nó, com a caixa em Zn. Só o que está fora da
     longarina (|x| > 500) e na faixa de altura do equipamento (300…1 100). */
  const nos = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    L2N.copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const passo = pos.count > 150000 ? 3 : 1;
    let s = null;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      const ax = Math.abs(v.x);
      if (ax < 0.40 || v.y < 0.10 || v.y > 1.60) continue;
      if (!s) { s = { z0: Infinity, z1: -Infinity, x: 0, y0: Infinity, y1: -Infinity, n: 0 }; }
      s.n++; s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
      s.x = Math.max(s.x, ax);
    }
    if (s && s.n > 30) nos.set(o.name || '?', s);
  });
  /* ⚠️ SÓ O VÃO, e não a cabine inteira: entre a traseira da cabine
     (`cabRearZ`) e o eixo trativo. O que está à frente disso é para-choque,
     farol e degrau, e enche o relatório. E só o que CABE no vão — malha de
     caminhão inteiro (`chassis_p15`, que vai de −3 932 a 3 056) não é peça de
     flanco, é a lição de sempre desta base. */
  const zA = mount.axles.driveZ[0] - 0.9, zB = mount.cabRearZ + 0.3;
  const lista = [...nos]
    .filter(([, s]) => s.z1 < zB && s.z0 > zA - 0.6 && (s.z1 - s.z0) < 3.0)
    .sort((p, q) => q[1].z0 - p[1].z0);
  out.push([`${rot} · o que vive no VÃO (cabine ${mm(zB)} → trativo ${mm(zA)})`,
    '\n        ' + lista.slice(0, 26)
      .map(([n, s]) => `${n}: Zn ${mm(s.z0)}…${mm(s.z1)} · |x| até ${mm(s.x)} · y ${mm(s.y0)}…${mm(s.y1)} · ${s.n} pts`)
      .join('\n        ')]);

  /* O VÃO LIVRE entre a traseira da cabine e o primeiro equipamento, e entre
     os equipamentos — que é o buraco que a foto mostra. */
  const grupos = [];
  const marca = (nome, re) => {
    let z0 = Infinity, z1 = -Infinity;
    for (const [n, s] of nos) if (re.test(n)) { z0 = Math.min(z0, s.z0); z1 = Math.max(z1, s.z1); }
    if (isFinite(z0)) grupos.push({ nome, z0, z1 });
  };
  marca('TANQUE (nosso)', /^TS_TANQUE/);
  marca('ARLA (corpo)', /^chassis_p19$/);
  marca('estepe', /estepe|spare|pneu_reserva/i);
  marca('caixa de bateria', /bateria|battery/i);
  marca('escapamento', /escap|silenc|muffler/i);
  marca('estepe (roda solta)', /^wheel_f_0_0_f_disc/);
  grupos.sort((p, q) => q.z0 - p.z0);
  out.push([`${rot} · grupos e vãos`, '\n        '
    + grupos.map((g, i) => {
      const prox = grupos[i + 1];
      return `${g.nome}: Zn ${mm(g.z0)}…${mm(g.z1)}`
        + (prox ? ` · vão até ${prox.nome}: ${mm(g.z1 - prox.z0)} mm` : '');
    }).join('\n        ')
    + `\n        cabine (cabRearZ ${mm(mount.cabRearZ)}) → primeiro grupo: `
    + `${grupos.length ? mm(mount.cabRearZ - grupos[0].z0) : '—'} mm`]);
}

return out;
