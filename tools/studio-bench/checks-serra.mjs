/* RETRATOS DO CENÁRIO `serra`, nas mesmas poses das fotos do relato.
   ===========================================================================
   O que esta sequência responde, e nenhuma outra ferramenta responde: como o
   cenário fica NO APP — com o rig de luz, a bruma, o `bindMaterials()` do
   manifesto e o atravessar ligados. Um render do Blender mostra a geometria;
   só isto mostra o produto.

   As poses são as das quatro capturas do relato:
     · `a-traseira`   atrás do implemento, olhando para a frente do caminhão
     · `b-frontal`    à frente da cabine, olhando para trás
     · `c-alta`       de cima e de trás, que é onde o buraco branco aparecia
     · `d-rasante`    lente baixa e perto, que é onde o atravessar tem de agir

   As armadilhas de câmera desta bancada estão anotadas em `checks-fotos-0811` e
   valem aqui: `toDataURL()` dá branco e `controls.enabled = false` NÃO congela a
   pose (o `update()` reimpõe `minDistance` e a mira). A pose é reescrita a cada
   quadro e conferida.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-serra.mjs --shot /tmp/serra.png
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
await B.frame(); await B.frame();

const THREE = S.THREE;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

/* ---- trocar para o cenário `serra` e esperar a malha e as texturas ---- */
const alvo = S.catalog.getEnvironment('serra');
if (!alvo) { out.push(['!! serra no manifesto', false]); return out; }
await S.environment.applyEnvironment(alvo);
out.push(['serra aplicado', true]);
for (let i = 0; i < 60; i++) await B.frame();

const st = S.lighting.getSeeThrough ? S.lighting.getSeeThrough() : null;
out.push(['atravessar', st ? JSON.stringify({
  solidos: st.solidos, grupos: st.grupos, plantas: st.plantas, alvo: st.alvo,
}) : '(não exposto)']);

/* ---- contagem de triângulos e draw calls, medida no renderer ----
   Total do último quadro do laço, com o passe de sombra DENTRO: `scene.ts`
   desligou o zeramento automático do three em 2026-08-15 justamente porque ele
   rodava depois de `shadowMap.render()` e escondia esse passe. */
const r = S.renderer.info.render;
out.push(['render por quadro', `${r.triangles} triângulos, ${r.calls} draw calls`]);

/* ---- as poses ---- */
S.controls.enabled = false;
const orbit = { min: S.controls.minDistance, max: S.controls.maxDistance };
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;
S.lighting.applyPreset('ensolarado', { animate: false });

async function shot(tag, eye, tgt, fov) {
  const cam = S.camera;
  const E = new THREE.Vector3(...eye);
  const T = new THREE.Vector3(...tgt);
  for (let i = 0; i < 26; i++) {
    S.controls.target.copy(T);
    cam.position.copy(E);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.near = 0.1;
    cam.far = 6000;
    cam.updateProjectionMatrix();
    cam.lookAt(T);
    cam.updateMatrixWorld(true);
    S.lighting.invalidate(2);
    await B.frame();
  }
  const off = cam.position.distanceTo(E);
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  const rr = S.renderer.info.render;
  out.push([`  ${tag} pose`,
    `${off < 0.05 ? 'ok' : 'ESCAPOU'} · ${rr.triangles} tri · ${rr.calls} calls`]);
}

/* A FRENTE DA CABINE APONTA PARA +Z do three (azimute 0). O corredor foi
   construído ao longo de −Z, então "olhar para a frente do caminhão" é olhar
   para −Z — foi medido no Blender (audit_view.py) e confere com as fotos:
   face de rocha à esquerda, defensa e vale à direita. */
await shot('a-traseira', [0, 9.0, 36], [0, 2.0, -34], 32);
await shot('b-frontal', [0, 8.0, -34], [0, 2.0, 34], 32);
await shot('c-alta', [16, 17, 34], [0, 2.0, -26], 36);
await shot('d-rasante', [11, 2.2, 16], [0, 2.2, -6], 44);
await shot('e-lateral', [26, 5.0, 6], [0, 2.2, 2], 34);

S.controls.minDistance = orbit.min;
S.controls.maxDistance = orbit.max;
S.controls.enabled = true;
return out;
