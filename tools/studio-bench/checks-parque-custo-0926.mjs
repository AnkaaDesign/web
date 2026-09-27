/* QUANTO CUSTA O CHÃO — A/B do detalhe de superfície (ground-detail.ts).
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-parque-custo-0926.mjs

   Mede o tempo de GPU de `renderer.render()` em três poses de chão, 40
   quadros cada, depois de 10 de aquecimento. ⚠️ `gl.finish()` NÃO bloqueia
   sob ANGLE (media 0,4 ms numa cena de 2 M de triângulos): quem sincroniza é
   um `readPixels` de um pixel, que tem de esperar o quadro inteiro. Roda igual na
   árvore de antes e na de depois; a diferença é o custo do detalhe e da malha
   nova. */
const B = window.__bench;
const out = [];
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => {
  const g = S.scene.getObjectByName('ts-set');
  return !!g && g.children.length > 0;
}, 180000);
/* O CONJUNTO FICA DE FORA: na árvore de antes os modelos de caminhão não
   existem (são gitignorados), e o A/B tem de medir o mesmo mundo. */
const rig = S.scene.getObjectByName('RIG');
if (rig) rig.visible = false;
S.lighting.setVehicleFocus(null);
if (S.lighting.setInteriorBounds) S.lighting.setInteriorBounds(null);
S.lighting.applyPreset('ensolarado', { animate: false });
if (S.quality && S.quality.set) S.quality.set('alta');
for (let i = 0; i < 20; i++) await B.frame();
const gl = S.renderer.getContext();
const px = new Uint8Array(4);
const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
const sz = new S.THREE.Vector2();
S.renderer.getDrawingBufferSize(sz);
out.push(['buffer', sz.x + 'x' + sz.y]);

async function mede(nome, eye, tgt) {
  S.camera.position.set(...eye);
  S.controls.target.set(...tgt);
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(8);
  for (let i = 0; i < 6; i++) await B.frame();
  for (let i = 0; i < 10; i++) S.renderer.render(S.scene, S.camera);
  sync();
  const ts = [];
  for (let i = 0; i < 40; i++) {
    const t0 = performance.now();
    S.renderer.render(S.scene, S.camera);
    sync();
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  out.push([nome + ' ms (mediana, p90)', [+ts[20].toFixed(2), +ts[36].toFixed(2)]]);
}

await mede('heroi', [19, 3.2, 27], [-1, 1.3, 8]);
await mede('rasante', [6.0, 1.5, -2], [3, 0, -80]);
await mede('alto', [22, 20, 34], [0, 0, 0]);
return out;
