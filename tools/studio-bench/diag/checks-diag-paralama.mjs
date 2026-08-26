/* DIAGNÓSTICO — quem é `chs_base_0_p12/p13/p4` e o que o para-lama faz ali.
   ===========================================================================
   A varredura geral acusou manchas de 178 mm entre `t_paralama_0_p*` e três
   nós do chassi do VM. Antes de mover uma cota, é preciso saber SE a peça
   entrou de verdade ou se o nó é um saco de coisas que atravessa o caminhão
   inteiro. Este arquivo não conserta nada: ele mede caixas e tira fotos com o
   resto do caminhão apagado. */

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

const ALVOS = [
  ['volvo-vm-2015', '8x2r', 'volvo'],
  ['vw-constellation', '8x2-tl', 'vw'],
  ['scania-p', '8x2r', 'scania'],
];

for (const [modelId, chassisId, tag] of ALVOS) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) {
    for (const md of (m.models || [])) {
      for (const ch of (md.chassis || [])) {
        if (md.id === modelId && ch.id === chassisId) { mk = m; mo = md; c = ch; }
      }
    }
  }
  if (!c) { out.push([`★ acha ${modelId}/${chassisId}`, false]); continue; }
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: mk.id, modelId: mo.id, chassisId: c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  const cab = S.state.cab;
  const imp = S.state.trailer;
  const mount = S.state.cabMount;
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  const Ninv = new THREE.Matrix4().copy(N).invert();

  /* ── as caixas, em normalizado, das peças que a varredura nomeou ── */
  const cx = (o) => {
    const bb = new THREE.Box3().setFromObject(o);
    const cs = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) cs.push(new THREE.Vector3(x, y, z).applyMatrix4(N));
    }
    const f = (k) => [Math.min(...cs.map((p) => p[k])), Math.max(...cs.map((p) => p[k]))];
    return { x: f('x'), y: f('y'), z: f('z') };
  };
  const conta = (o) => {
    let t = 0;
    o.traverse((m) => { if (m.isMesh && m.geometry) {
      const g = m.geometry; const i = g.getIndex();
      t += i ? i.count / 3 : g.getAttribute('position').count / 3;
    } });
    return t;
  };
  const NOMES = /^(chs_base_0_p(4|12|13)|chassis_p(0|3|4|14|18|19|21)|truck_p4|saia_lat_0_p0)$/;
  const linhas = [];
  cab.traverse((o) => {
    if (!o.isMesh || !NOMES.test(o.name || '') || !o.visible) return;
    const b = cx(o);
    linhas.push(`${o.name}: x ${mm(b.x[0])}…${mm(b.x[1])} y ${mm(b.y[0])}…${mm(b.y[1])}`
      + ` z ${mm(b.z[0])}…${mm(b.z[1])} (${conta(o)} tri)`);
  });
  out.push([`${tag} · peças acusadas`, linhas.join(' · ') || 'nenhuma']);

  const pl = cab.getObjectByName('TS_PARALAMA_DIR2');
  if (pl) {
    const partes = [];
    pl.traverse((o) => {
      if (!o.isMesh) return;
      const b = cx(o);
      partes.push(`${o.name}: x ${mm(b.x[0])}…${mm(b.x[1])} y ${mm(b.y[0])}…${mm(b.y[1])}`
        + ` z ${mm(b.z[0])}…${mm(b.z[1])}`);
    });
    out.push([`${tag} · para-lama por parte`, partes.join(' · ')]);
  }

  /* ── as fotos: só o para-lama e as peças acusadas, o resto apagado ── */
  const escondidos = [];
  const soEstes = (re, tambemImp) => {
    escondidos.length = 0;
    for (const raiz of [cab, imp]) {
      raiz.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        let guarda = false;
        for (let p = o; p && p !== raiz.parent; p = p.parent) {
          if (re.test(p.name || '')) { guarda = true; break; }
        }
        if (raiz === imp && tambemImp) guarda = guarda || true;
        if (!guarda) { o.visible = false; escondidos.push(o); }
      });
    }
  };
  const devolve = () => { for (const o of escondidos) o.visible = true; escondidos.length = 0; };

  const foto = (nome, alvoN, dist, alturaN) => {
    const alvo = new THREE.Vector3(alvoN[0], alvoN[1], alvoN[2]).applyMatrix4(Ninv);
    controls.target.copy(alvo);
    const olho = new THREE.Vector3(dist[0], dist[1], dist[2]).applyMatrix4(Ninv);
    camera.position.copy(olho);
    camera.lookAt(alvo);
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
    renderer.render(scene, camera);
    out.push([nome, raw.toDataURL('image/png')]);
  };

  const steer = mount.axles.steerZ || [];
  const z2 = steer.length >= 2 ? Math.min(...steer) : (mount.axles.driveZ[0] || 0);

  /* 1 · o trem dianteiro de fora, perto */
  foto(`diag-${tag}-1-frente`, [0, 0.9, z2], [5.0, 1.2, z2 + 0.6]);
  /* 2 · o mesmo, de baixo */
  foto(`diag-${tag}-2-baixo`, [0, 0.6, z2], [3.2, -0.35, z2 + 1.0]);
  /* 3 · só o para-lama e as peças acusadas */
  soEstes(/TS_PARALAMA_DIR2|^chs_base_0_p(4|12|13)$|^truck_p4$|^chassis_p(14|18|19|21)$/);
  foto(`diag-${tag}-3-isolado`, [0, 0.9, z2], [4.0, 1.1, z2 + 0.5]);
  foto(`diag-${tag}-4-isolado-topo`, [0, 0.9, z2], [2.2, 3.2, z2 + 0.3]);
  devolve();
  /* 5 · a grade e o que estiver por perto dela, no tandem */
  const zt = mount.axles.driveZ.length ? mount.axles.driveZ[mount.axles.driveZ.length - 1] : -4;
  foto(`diag-${tag}-5-tandem`, [0, 0.8, zt], [4.5, 0.9, zt - 0.4]);
  foto(`diag-${tag}-6-meio`, [0, 0.8, (z2 + zt) / 2], [6.5, 1.0, (z2 + zt) / 2]);
}

return out;
