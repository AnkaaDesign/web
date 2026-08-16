/* QUANTO DO PAINEL SOBRA, POR ALTURA DE CÂMERA. (2026-08-16)
   ===========================================================================
   O relato: *"às vezes ainda acontece do branco das lâmpadas sumirem"*, com o
   fundo em BRANCO e a câmera alta.

   A hipótese a testar é geométrica: um painel é um bloco horizontal, e a face
   de baixo dele — a que carrega quase toda a área acesa — encolhe com o SENO da
   elevação. Subir a câmera não apaga nada; ela só faz o painel virar de perfil.
   O que sobra de perfil é o FLANCO, e é ele que este check conta.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-teto-altura-0816.mjs

   Mede, por altura: quantos pixels do TERÇO DE CIMA do quadro passam de 140 de
   luminância (o painel aceso), e qual a maior corrida vertical deles (a
   espessura da faixa branca, em px).

   ⚠️ `claros` SOBE com a altura e isso NÃO é o painel melhorando: com o fundo
   em Branco a parede passa de 140 sozinha, e quanto mais alta a câmera mais
   parede entra no terço de cima. Quem responde a pergunta é `faixaPx` — a
   espessura da faixa branca —, e é ela que caiu de 31 px (câmera a 4 m) para
   20 px (a 8 m). Para julgar o extremo, use as FOTOS.

   O QUE ELE MEDIU, e virou conserto em `scene/ceiling.ts`:
     · a face de baixo do painel (3,35 m) empata com o flanco (0,26 m) a
       θ = 4,4° de elevação; abaixo disso só o flanco sustenta o painel;
     · com a câmera a 10,7 m o painel está 1,6 m acima dela, ou seja θ ≈ 3° —
       o painel está de perfil, e nenhum ajuste de emissivo muda isso;
     · flanco 0,26 → 0,50 m devolveu +24 % de pixel aceso na pose que dói;
     · e a laje, que a θ → 0 ocupa o alto do quadro, saiu de 4/255 (preto
       absoluto) para ~78 ao lado de cada barra, pela mancha do
       `buildSpillTexture()`. */
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 300000);
const S = window.__studio;
if (!S) return [['sem __studio', false]];
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);
out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await new Promise((r) => setTimeout(r, 3000));

const THREE = S.THREE;
const scene = S.scene;
const camera = S.camera;
const controls = S.controls;
const renderer = S.renderer;

/* O FUNDO DO RELATO. Ele importa duas vezes: baixa a exposição (0,88) e sobe o
   albedo da sala (3,80), ou seja é o pior caso para um emissivo fixo. */
S.lighting.setStudioParams({ backdrop: 'branco' });
await new Promise((r) => setTimeout(r, 1200));

const gl = renderer.getContext();
const W = renderer.domElement.width, H = renderer.domElement.height;
const px = new Uint8Array(W * H * 4);

function medir() {
  renderer.render(scene, camera);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const teto = Math.round(H * 0.34);
  let claros = 0, maiorCorrida = 0;
  for (let x = 0; x < W; x += 2) {
    let corrida = 0;
    for (let y = 0; y < teto; y++) {
      const i = ((H - 1 - y) * W + x) * 4;
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      if (l > 140) { claros++; corrida++; if (corrida > maiorCorrida) maiorCorrida = corrida; }
      else corrida = 0;
    }
  }
  return { claros, faixaPx: maiorCorrida };
}

const base = S.lighting.getCameraPose();
const t = controls.target;
const dist = Math.min(controls.maxDistance, 40);
const az = THREE.MathUtils.degToRad(base.azimuthDeg);

const tabela = [];
for (const camY of [4, 6, 8, 9.5, 11, 12.5, 14]) {
  t.y = 2.0;
  const dy = camY - t.y;
  const flat = Math.sqrt(Math.max(1, dist * dist - dy * dy));
  camera.position.set(t.x + Math.sin(az) * flat, camY, t.z + Math.cos(az) * flat);
  camera.lookAt(t);
  camera.updateMatrixWorld(true);
  controls.update();
  S.lighting.invalidate();
  await B.frame();
  await new Promise((r) => setTimeout(r, 350));
  const m = medir();
  tabela.push({ camY, elevDeg: +(Math.atan2(dy, flat) * 180 / Math.PI).toFixed(1), ...m });
}
out.push(['painel aceso no terço de cima, por altura de câmera', tabela]);
out.push(['viewport', { W, H }]);

/* E as fotos das alturas que doem. */
for (const camY of [10.2, 10.8, 11.4, 12.0]) {
  t.y = 2.0;
  const dy = camY - t.y;
  const flat = Math.sqrt(Math.max(1, dist * dist - dy * dy));
  camera.position.set(t.x + Math.sin(az) * flat, camY, t.z + Math.cos(az) * flat);
  camera.lookAt(t); controls.update(); S.lighting.invalidate();
  await B.frame();
  await new Promise((r) => setTimeout(r, 700));
  await B.frame();
  const r = await B.captureViewport({ quality: 'baixa', background: 'cena' });
  const blob = r && r.blob ? r.blob : r;
  if (blob instanceof Blob) {
    out.push(['0816-teto-' + String(camY).replace('.', '_'), await new Promise((ok) => {
      const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob);
    })]);
  }
}

return out;
