/* OITAVA VOLTA — o último discriminante do tracinho do trilho.
   Quatro quadros do MESMO enquadramento, mudando UMA coisa de cada vez, e todos
   sobre o que a tela desenha de verdade (o BALDE), não sobre a origem. */
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
/* o balde do trilho */
let balde = null;
t.traverse((o) => { if (!balde && /^FUSAO__metal-estrutura-principal-padrao__polido/.test(o.name || '')) balde = o; });
out.push(['balde', balde ? balde.name : 'AUSENTE']);
const mat = balde && (Array.isArray(balde.material) ? balde.material[0] : balde.material);
out.push(['uv no balde', balde ? String(!!balde.geometry.getAttribute('uv')) : '—']);
out.push(['mapas', mat ? `rough ${!!mat.roughnessMap} map ${!!mat.map} normal ${!!mat.normalMap} ao ${!!mat.aoMap} metal ${!!mat.metalnessMap}` : '—']);
tira('q8-0-como-esta');
/* 1) sem o rebite gerado */
const riv = []; t.traverse((o) => { if (/^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) riv.push(o); });
for (const o of riv) o.visible = false;
tira('q8-1-sem-rebite');
for (const o of riv) o.visible = true;
/* 2) sem o filete */
const fil = []; t.traverse((o) => { if (/^FILETE_/.test(o.name || '')) fil.push(o); });
for (const o of fil) o.visible = false;
tira('q8-2-sem-filete');
for (const o of fil) o.visible = true;
/* 3) sem roughnessMap */
if (mat) { const rm = mat.roughnessMap; mat.roughnessMap = null; mat.needsUpdate = true; tira('q8-3-sem-roughmap'); mat.roughnessMap = rm; mat.needsUpdate = true; }
/* 4) sem envMap (metal sem ambiente vira preto — só para ver a silhueta) */
if (mat) { const em = mat.envMap; const rr = mat.roughness; mat.roughness = 1; mat.metalness = 0; mat.needsUpdate = true; tira('q8-4-difuso-no-balde'); mat.roughness = rr; mat.metalness = 1; mat.envMap = em; mat.needsUpdate = true; }
/* 5) SÓ este balde escondido */
if (balde) { balde.visible = false; tira('q8-5-sem-o-balde'); balde.visible = true; }
return out;
