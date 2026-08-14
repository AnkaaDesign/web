/* NADA PLANTADO EM PAVIMENTO — a trava do *"as arvores estao no meio da
   rotatoria"*.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-rotatoria.mjs

   O relato, nas palavras do dono do produto: *"as arvores estao no meio da
   rotatoria, deveriam estar no grama proximo a cerca"*.

   A CAUSA ERA A CAIXA ENVOLVENTE. `scenery.ts` sorteava o plantio dentro do
   `Box3` da faixa de grama, e duas faixas deste set não são retângulos cheios:
   `turf_e_tail` e `turf_w_tail` fecham o corredor a sul do balão com o bordo
   norte no ARCO do disco, e ainda por cima nascem na cota da grama SOB o
   `yard_tail` de concreto — geometria que não aparece e mesmo assim pesava no
   sorteio. Ver o bloco O CHÃO QUE EXISTE, E NÃO A CAIXA DELE, lá.

   ESTA TRAVA NÃO PERGUNTA PELA CAIXA, E É ESSE O PONTO. Ela desce um raio de
   5 m de altura sobre cada tronco e olha em que MATERIAL ele bate primeiro:
   grama passa, asfalto/concreto/meio-fio reprova. É a mesma pergunta que a foto
   responde, feita de um jeito que não depende de nenhuma decisão do módulo que
   está sendo verificado — nem do nome da faixa, nem da caixa, nem da grelha. */
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

const env = S.catalog.getEnvironment('distrito-industrial');
if (env) await S.environment.applyEnvironment(env);
out.push(['set na cena', await B.until(() => !!S.scene.getObjectByName('ts-set'), 180000)]);
await B.frame(); await B.frame();

const THREE = S.THREE;
const set = S.scene.getObjectByName('ts-set');
if (!set) return out;
S.scene.updateMatrixWorld(true);
S.lighting.applyPreset('ensolarado', { animate: false });
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

/* ---------- o chão, separado em GRAMA e PAVIMENTO pelo material ---------- */
const DURO = /CONCRETE|ASPHALT|KERB|PAVER|LINE_PAINT/i;
const box = new THREE.Box3();
const chao = [];
set.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  const nome = mat?.name || '';
  const duro = DURO.test(nome);
  const grama = /^GRASS_/i.test(nome);
  if (!duro && !grama) return;
  box.setFromObject(o);
  if (box.isEmpty() || box.max.y - box.min.y > 1.5) return;   // não é laje
  chao.push({ mesh: o, duro, mat: nome, nome: o.name });
});
out.push(['lajes de chão', `${chao.filter((c) => c.duro).length} duras + ${chao.filter((c) => !c.duro).length} de grama`]);

/* ---------- o balão, medido nas malhas dele ---------- */
const rbPave = set.getObjectByName('rb_pave');
const rbIlha = set.getObjectByName('rb_island');
let CX = 0, CZ = 0, RO = 0, RI = 0;
if (rbPave && rbIlha) {
  const bp = new THREE.Box3().setFromObject(rbPave);
  const bi = new THREE.Box3().setFromObject(rbIlha);
  CX = (bp.min.x + bp.max.x) / 2; CZ = (bp.min.z + bp.max.z) / 2;
  RO = (bp.max.x - bp.min.x) / 2;
  RI = (bi.max.x - bi.min.x) / 2;
  out.push(['balão', `centro x ${CX.toFixed(2)} · z ${CZ.toFixed(2)} · R ${RO.toFixed(1)} m · ilha R ${RI.toFixed(1)} m`]);
}

/* ---------- cada tronco, e o que há debaixo dele ---------- */
const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const m4 = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const baixo = new THREE.Vector3(0, -1, 0);
const origem = new THREE.Vector3();
const alvos = chao.map((c) => c.mesh);
const porMesh = new Map(chao.map((c) => [c.mesh, c]));

const plantas = [];
set.traverse((o) => {
  if (!o.isInstancedMesh || !o.geometry) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!/BARK/i.test(mat?.name || '')) return;            // um ponto por indivíduo
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, m4);
    m4.decompose(_p, _q, _s);
    plantas.push({ especie: (o.parent?.name || o.name), p: _p.clone().applyMatrix4(o.matrixWorld) });
  }
});
out.push(['plantas na cena', plantas.length]);

let emDuro = 0, semChao = 0, noBalao = 0, naIlha = 0;
const culpados = [];
for (const pl of plantas) {
  origem.set(pl.p.x, 5, pl.p.z);
  ray.set(origem, baixo);
  const hit = ray.intersectObjects(alvos, false)[0];
  const info = hit ? porMesh.get(hit.object) : null;
  const r = RO ? Math.hypot(pl.p.x - CX, pl.p.z - CZ) : Infinity;
  if (r <= RI) naIlha++;
  else if (r <= RO) noBalao++;
  if (!info) { semChao++; culpados.push({ ...pl, onde: 'sem chão debaixo', r }); continue; }
  if (info.duro) { emDuro++; culpados.push({ ...pl, onde: `${info.nome} (${info.mat})`, r }); }
}

out.push(['plantas sobre pavimento', emDuro === 0 ? 'nenhuma' : `${emDuro} — DEFEITO`]);
out.push(['plantas sem chão debaixo', semChao === 0 ? 'nenhuma' : `${semChao} — DEFEITO`]);
out.push(['plantas dentro do balão, fora da ilha', noBalao === 0 ? 'nenhuma' : `${noBalao} — DEFEITO`]);
out.push(['plantas na ilha central', `${naIlha}`]);
out.push(['NADA EM PAVIMENTO', emDuro === 0 && semChao === 0 && noBalao === 0]);
for (const c of culpados.slice(0, 30)) {
  out.push([`  intruso ${c.especie}`,
    `x ${c.p.x.toFixed(1)} · z ${c.p.z.toFixed(1)} · ${c.r < 1e6 ? `${c.r.toFixed(1)} m do centro do balão` : '—'} · sobre ${c.onde}`]);
}

/* ---------- as fotos ---------- */
S.controls.enabled = false;
S.controls.minDistance = 0;
S.controls.maxDistance = Infinity;
/* Os dois hooks que prendem lente e mira ao veículo e ao pátio — ver o mesmo
   bloco em `checks-canteiro.mjs`, onde eles custaram uma foto do baú. */
S.lighting.setVehicleFocus(null);
S.lighting.setInteriorBounds(null);

const cam = S.camera;
async function foto(tag, eye, alvo, fov) {
  for (let i = 0; i < 24; i++) {
    S.controls.target.copy(alvo);
    cam.position.copy(eye);
    cam.up.set(0, 1, 0);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.lookAt(alvo);
    cam.updateMatrixWorld(true);
    S.lighting.invalidate(2);
    await B.frame();
  }
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag, await toURL(res.blob)]);
  const dLente = cam.position.distanceTo(eye);
  const dMira = S.controls.target.distanceTo(alvo);
  out.push([`  ${tag} pose`, dLente < 0.02 && dMira < 0.02 ? 'ok'
    : `ESCAPOU · lente ${Math.round(dLente * 1000)} mm · mira ${Math.round(dMira * 1000)} mm`]);
}

const V = THREE.Vector3;
/* 1 · DE CIMA DO BALÃO, a prumo: é a foto que não deixa dúvida sobre em que
   superfície o tronco está. */
await foto('1 balao de cima',
  new V(CX, 95, CZ + 0.01), new V(CX, 0, CZ), 55);
/* 2 · o enquadramento do relato: da via, olhando o retorno. */
await foto('2 do asfalto para o balao',
  new V(3.25, 6, CZ - 95), new V(CX, 3, CZ), 42);
/* 3 · a grama junto à cerca, que é onde o dono do produto disse que a árvore
   deveria estar. A cerca deste set está em z = 133…150 a sul do pátio. */
await foto('3 a grama junto a cerca',
  new V(CX + 30, 8, CZ + 8), new V(CX + 5, 2, CZ + 38), 50);

return out;
