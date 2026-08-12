/* OS CONJUNTOS INSTANCIADOS DO IMPLEMENTO — nenhum desenha antes da hora.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-instancias.mjs

   POR QUE EXISTE. Um `InstancedMesh` recém-construído NÃO é invisível: desde a
   r155 o construtor termina pondo IDENTIDADE em toda instância alocada
   (three.core.js:25663 na r179 em disco). `TrailerAssembly` aloca com folga de
   3× e só escreve as matrizes em `set()`, que só roda num resize — então, pela
   premissa errada de que "nasce zerada", a CAPACIDADE INTEIRA de todo conjunto
   ficava desenhada empilhada na origem da malha. E como a matriz local ali é
   `inv(root.matrixWorld)`, essa origem cai no chão assim que o conjunto é
   posicionado: 342 instâncias em (0, −0,024, 10,442) — fita `Faixa-3M`, suporte
   preto e lente de lanterna sobrepostos, 24 mm abaixo do piso, na linha de
   centro do caminhão. Era a "lasca no chão" do relato, que sumia sozinha ao
   mexer na medida e voltava no boot seguinte.

   O QUE ELA TRAVA, e são duas coisas diferentes:

     1. NENHUMA instância em identidade no boot — a causa, medida na fonte.
     2. NENHUMA malha do veículo chapada e encostada no piso — o sintoma, medido
        por caixa de mundo, que pegaria o mesmo estrago vindo por outro caminho.

   E uma terceira que é o contrapeso das duas: depois de um resize os conjuntos
   TÊM de encher. Um conserto que só escondesse a fita apagaria a saia inteira e
   passaria nos dois primeiros itens. */
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
    const local = cards.find((c) => /volvo/i.test(c.dataset.id || ''));
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
const scene = S.scene;
const r3 = (v) => Math.round(v * 1000) / 1000;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

const repeats = [];
scene.updateMatrixWorld(true);
scene.traverse((o) => {
  if (o.isInstancedMesh && /^(REPEAT_|RIVET_)/.test(o.name || '')) repeats.push(o);
});
out.push(['conjuntos instanciados encontrados', repeats.length]);
out.push(['há conjuntos para verificar', repeats.length > 0]);

const I = new THREE.Matrix4();
const m = new THREE.Matrix4();
const identidades = () => {
  let n = 0;
  for (const im of repeats) {
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      if (m.elements.every((v, k) => Math.abs(v - I.elements[k]) < 1e-9)) n++;
    }
  }
  return n;
};

/* ---------- 1. a causa ---------- */
const idBoot = identidades();
out.push(['instâncias desenhadas em identidade no boot', idBoot]);
out.push(['nenhuma instância em identidade no boot', idBoot === 0]);
out.push(['contagem somada dos conjuntos no boot',
  repeats.reduce((s, o) => s + o.count, 0)]);

/* ---------- 2. o sintoma, por caixa de mundo ---------- */
const noSet = (o) => { for (let p = o; p; p = p.parent) if (p.name === 'ts-set') return false; return true; };
function chaoSujo() {
  const box = new THREE.Box3(); const size = new THREE.Vector3(); const ctr = new THREE.Vector3();
  const achados = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const desenha = o.isMesh || o.isInstancedMesh || o.isLine || o.isPoints || o.isSprite;
    if (!desenha || !o.visible || !noSet(o)) return;
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
    if (o.isInstancedMesh) { if (o.count === 0) return; o.boundingBox = null; }
    box.setFromObject(o);
    if (box.isEmpty() || !isFinite(box.min.y)) return;
    box.getSize(size); box.getCenter(ctr);
    if (box.min.y > 0.08 || size.y > 0.25 || size.x > 60 || size.z > 60) return;
    achados.push(`${o.name || o.type} @${[r3(ctr.x), r3(ctr.y), r3(ctr.z)].join(',')}`);
  });
  return achados;
}
const sujo = chaoSujo();
out.push(['malhas do veículo chapadas no piso', sujo.length ? sujo.join(' · ') : 'nenhuma']);
out.push(['o chão sob o implemento está limpo', sujo.length === 0]);

/* A FOTO, na MESMA pose com que a lasca foi flagrada. */
S.lighting.setVehicleFocus(null);
async function pose(nome) {
  S.camera.position.set(5.2, 1.15, 15.4);
  S.controls.target.set(0, 0.0, 10.4);
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(8);
  for (let i = 0; i < 4; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([nome, await toURL(res.blob)]);
}
await pose('i_chao_no_boot');

/* ---------- 3. o contrapeso: o resize TEM de encher os conjuntos ---------- */
const dims = S.trailerDims;
S.setTrailerDims({ height: dims.height, length: dims.length - 0.5 }, { frame: false });
await B.frame(); await B.frame();
S.setTrailerDims({ height: dims.height, length: dims.length }, { frame: false });
await B.frame(); await B.frame();

const somaDepois = repeats.reduce((s, o) => s + o.count, 0);
out.push(['contagem somada depois do resize', somaDepois]);
out.push(['os conjuntos enchem no resize', somaDepois > 0]);
out.push(['nenhuma instância em identidade depois do resize', identidades() === 0]);

const fita = repeats.filter((o) => /Faixa-3M/i.test((o.material && o.material.name) || ''));
out.push(['a fita refletiva instanciada existe e tem instâncias',
  fita.length > 0 && fita.every((o) => o.count > 0)]);
out.push(['  fita: contagem por conjunto',
  fita.map((o) => `${o.name}=${o.count}/${o.instanceMatrix.count}`).join(' ')]);

const sujoDepois = chaoSujo();
out.push(['o chão continua limpo depois do resize', sujoDepois.length === 0]);
await pose('ii_chao_depois_do_resize');

return out;
