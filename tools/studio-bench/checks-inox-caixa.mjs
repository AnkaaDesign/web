/* Os RETRATOS de 2026-08-12b: a ferragem em inox e a caixa de cozinha escura.

   O que estas fotos existem para responder — e são perguntas de APARÊNCIA, que
   é justamente o que nenhuma medida deste repositório alcança:

     i1  a traseira      dobradiça, varão, trava e a chapa da marca leem como
                         INOX e não como chapa branca fosca?
     i2  a lateral       a ferragem da porta lateral acompanha? (ela vem de
                         `extractDoorKit()`, que guarda a referência do material
                         ANTES de `applyTrailerFinish` rodar — é o ponto exato
                         em que a divisão de materiais pode falhar em silêncio)
     i3  o flanco        o trilho de 14,5 m continua ACETINADO? A divisão existe
                         para não levá-lo junto, e esta foto é a contraprova.
     c1  a caixa         a folha ficou cinza escuro (não preto puro) e a
                         ferragem dela quase preta, como na foto de catálogo?
     c2  a caixa, perto  a plaqueta da marca do fabricante sumiu?

   As armadilhas de câmera desta bancada estão anotadas em `checks-fotos-0811` e
   valem aqui: `toDataURL()` dá branco, e `controls.enabled = false` NÃO congela
   a pose (o `update()` reimpõe `minDistance` e a mira). A pose é reescrita a
   cada quadro e conferida.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-inox-caixa.mjs
*/
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const root = S.trailer;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

/* ---------------------------------------------------------------- inventário
   Antes das fotos, o FATO: quem ficou com cada material. Uma foto bonita com a
   divisão errada é o pior resultado possível — ela passa. */
{
  const byName = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      const e = byName.get(m.name) || { n: 0, met: m.metalness, rug: m.roughness, hex: null };
      if (m.color && !e.hex) e.hex = '#' + m.color.getHexString();
      e.n++; e.met = m.metalness; e.rug = m.roughness;
      byName.set(m.name, e);
    }
  });
  for (const name of ['inox-ferragem', 'inox-ferragem__polido', 'inox-ferragem__caixa',
    'metal-pouco-polido', 'metal-pouco-polido__polido', 'metal-pouco-polido__caixa',
    'plastico-cinza-polido', 'metal-claro', 'caixa-estrutura-preta']) {
    const e = byName.get(name);
    out.push([`mat ${name}`, e
      ? `${e.n} malhas · met ${e.met} · rug ${e.rug} · ${e.hex}`
      : '(ausente)']);
  }
}

S.controls.enabled = false;
const orbit = { min: S.controls.minDistance, max: S.controls.maxDistance };
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;
S.lighting.applyPreset('ensolarado', { animate: false });

function at(x, y, z) {
  root.updateWorldMatrix(true, true);
  return new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
}

async function shot(tag, look, dir, dist, frame) {
  const cam = S.camera;
  const d = new THREE.Vector3(...dir).normalize();
  const tgt = at(...look);
  const eye = at(look[0] + d.x * dist, look[1] + d.y * dist, look[2] + d.z * dist);
  const fov = 2 * Math.atan((frame / 2) / dist) * 180 / Math.PI;
  for (let i = 0; i < 30; i++) {
    S.controls.target.copy(tgt);
    cam.position.copy(eye);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.lookAt(tgt);
    cam.updateMatrixWorld(true);
    S.lighting.invalidate(2);
    await B.frame();
  }
  const off = cam.position.distanceTo(eye);
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  out.push([`  ${tag} pose`, `${off < 0.02 ? 'ok' : 'ESCAPOU'} · desvio ${Math.round(off * 1000)} mm`]);
}

const dims = S.trailerDims;
const zBack = -dims.length / 2;

/* 1 · a traseira inteira: dobradiças, varões, travas e a chapa da marca. */
await shot('i1-traseira', [0, 1.9, zBack], [0, 0.10, -1], 5.4, 3.4);
/* 1b · perto da coluna de dobradiça, que é onde o inox tem de se ver. */
await shot('i1b-dobradica', [0.62, 2.1, zBack - 0.05], [0.35, 0.05, -1], 1.6, 1.1);

/* 2 · o flanco, com o trilho de 14,5 m em ângulo rasante — a contraprova. */
await shot('i3-trilho', [1.30, 1.75, 0], [1, 0.05, 0.45], 6.0, 4.0);

/* 3 · a porta lateral, que é o "inclusive da lateral" do pedido. */
{
  const spec = [{ position: dims.length / 2 - 0.45, width: 0.9, height: 2.35 }];
  S.models.setTrailerDoors('left', spec);
  await B.until(() => S.trailerRig.body.getDoorHoles('left').length === 1, 60000);
  for (let i = 0; i < 10; i++) await B.frame();
  const h = S.trailerRig.body.getDoorHoles('left')[0];
  const zc = (h.z0 + h.z1) / 2, yc = (h.y0 + h.y1) / 2;
  await shot('i2-porta-lateral', [-1.30, yc, zc], [-1, 0.10, 0.05], 3.4, 2.4);
}

/* 4 · a caixa de cozinha. O bake a põe no flanco ESQUERDO, x −1,32…−0,66,
   y 0,47…1,13, z 1,89…3,05 no referencial do bake de fábrica — em coordenadas
   do implemento vivo ela segue o piso, então a mira sai da própria caixa. */
{
  const b = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let box = false;
    for (let n = o; n; n = n.parent) {
      if (/caixa-ferrmantas/i.test(n.name || '')) { box = true; break; }
      if (n === root) break;
    }
    if (!box) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    b.union(tmp);
  });
  if (b.isEmpty()) {
    out.push(['caixa localizada', 'NÃO — nenhum nó `caixa-ferrmantas`']);
  } else {
    const inv = root.matrixWorld.clone().invert();
    const c = b.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    const s = b.getSize(new THREE.Vector3());
    out.push(['caixa localizada',
      `centro ${[c.x, c.y, c.z].map((v) => v.toFixed(3)).join(' / ')} · `
      + `${(s.x * 1000) | 0} × ${(s.y * 1000) | 0} × ${(s.z * 1000) | 0} mm`]);
    const sx = c.x < 0 ? -1 : 1;
    await shot('c1-caixa', [sx * 1.34, c.y, c.z], [sx, 0.12, 0.10], 2.4, 1.9);
    /* Perto do canto onde a plaqueta morava (pé da folha, ponta traseira). */
    await shot('c2-caixa-plaqueta', [sx * 1.30, c.y - s.y / 4, c.z - s.z / 3],
      [sx, 0.05, -0.10], 1.0, 0.7);
  }
}

S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;
return out;
