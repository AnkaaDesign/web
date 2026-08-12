/* CANTO DIANTEIRO — fotos LARGAS pós-set, baseline limpo para diff.
   ---------------------------------------------------------------------------
   O diff anterior comparava PRÉ-set (originais do bake) com PÓS-set
   (instâncias re-ancoradas) e o ruído da fase das fitas escondia qualquer
   coisa vertical. Aqui: set(base) primeiro, foto, depois cada medida, foto —
   mesmas âncoras de câmera (uv1 da chapa, à prova do giro). O pé da chapa é
   presa ao piso, então QUALQUER diferença vertical no diff é peça divergente.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner-wide.mjs
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
const scene = S.scene;

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

function cornerOf(mesh, u, vv) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  return new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
}

function shoot(tag) {
  const mesh = S.trailer?.getObjectByName('SIDE_L');
  if (!mesh) { out.push([`${tag}-foto`, '(sem SIDE_L)']); return; }
  const c00 = cornerOf(mesh, 0, 0), c10 = cornerOf(mesh, 1, 0), c11 = cornerOf(mesh, 1, 1);
  const uDir = new THREE.Vector3().subVectors(c10, c00).normalize();
  const vDir = new THREE.Vector3().subVectors(c11, c10).normalize();
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
  const up = vDir.clone().negate();
  for (const [ang, dir] of [
    ['diag', new THREE.Vector3().addVectors(nDir, uDir).normalize()],
    ['lado', nDir.clone()],
  ]) {
    const w = 3.2, h = 1.9, ppm = 480;
    /* Pé da chapa (preso ao piso) como âncora: 1,0 m para dentro, janela
       cobrindo de ~0,55 m abaixo do pé a ~1,35 m acima. */
    const centre = c11.clone().addScaledVector(uDir, -0.55).addScaledVector(vDir, -0.40);
    const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
    rr.setSize(wPx, hPx, false);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
    cam.position.copy(centre).addScaledVector(dir, 5);
    cam.up.copy(up);
    cam.lookAt(centre);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
    lamp.position.copy(cam.position);
    lamp.target.position.copy(centre);
    const amb = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(lamp, lamp.target, amb);
    rr.render(scene, cam);
    scene.remove(lamp, lamp.target, amb);
    const cc = document.createElement('canvas');
    cc.width = wPx; cc.height = hPx;
    cc.getContext('2d').drawImage(canvas, 0, 0);
    out.push([`${tag}-w-${ang}`, cc.toDataURL('image/png')]);
  }
}

const base = S.trailerRig.base;

/* Baseline PÓS-set: mesma medida de fábrica, mas com o assembly já resolvido
   (instâncias no lugar das originais). */
S.measures.setImplementMeasures({ height: base.height, length: base.length });
await B.frame(); await B.frame();
shoot('pos-base');

for (const patch of [{ height: 2.2 }, { height: 3.0 }, { length: 16.5 }]) {
  const key = patch.height ? `h${Math.round(patch.height * 100)}` : `L${Math.round(patch.length * 100)}`;
  S.measures.setImplementMeasures(patch);
  await B.until(() => {
    const d = S.trailerDims;
    if (!d) return false;
    return patch.height ? Math.abs(d.height - patch.height) < 0.06
      : Math.abs(d.length - patch.length) < 0.06;
  }, 60000);
  await B.frame(); await B.frame();
  shoot(key);
}

return out;
