/* NONA VOLTA — o balde CONTRA a soma das origens, com `merge.release()`.
   Se a fusão solta limpa a faixa, o defeito é DA FUSÃO, não da peça. */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) for (const mo of (mk.models || [])) for (const c of (mo.chassis || [])) { if (c.file && c.available !== false) alvos.push({ mk, mo, c }); }
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();
const t = S.state.trailer;
const bM = new THREE.Box3().setFromObject(t);
const alvo0 = bM.getCenter(new THREE.Vector3());
function tira(nome) {
  const a = THREE.MathUtils.degToRad(-72), e = THREE.MathUtils.degToRad(14);
  const al = alvo0.clone(); al.add(new THREE.Vector3(0, 1.25, 1.0));
  controls.target.copy(al);
  camera.position.set(al.x + Math.sin(a) * Math.cos(e) * 2.2, al.y + Math.sin(e) * 2.2, al.z + Math.cos(a) * Math.cos(e) * 2.2);
  camera.lookAt(al); camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
tira('q9-0-fundido');
out.push(['release', String(S.merge?.release ? S.merge.release() : 'sem afordance')]);
for (let i = 0; i < 8; i++) await B.frame();
tira('q9-1-solto');
/* e, solto, quem é que tem o tracinho: esconde as 6 peças do trilho */
const trilhos = [];
t.traverse((o) => { if (o.isMesh && /^estrutura-principal-9[0-5]_/.test(o.name || '')) trilhos.push(o); });
for (const o of trilhos) o.visible = false;
tira('q9-2-solto-sem-trilho');
for (const o of trilhos) o.visible = true;
/* e as 6 peças de arremate */
const arr = [];
t.traverse((o) => { if (o.isMesh && /^estrutura-principal-(1[567]|5[234])_/.test(o.name || '')) arr.push(o); });
for (const o of arr) o.visible = false;
tira('q9-3-solto-sem-arremate');
for (const o of arr) o.visible = true;
out.push(['trilhos/arremates', `${trilhos.length}/${arr.length}`]);
return out;
