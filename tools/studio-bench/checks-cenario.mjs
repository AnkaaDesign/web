/* ARRANJO DO CENÁRIO — plantio, postes e o túnel de transparência.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-cenario.mjs

   O que trava, e por que cada um:

     · ÁRVORE SÓ EM CANTEIRO OU GRAMA. O estado anterior tinha instâncias em
       cima do asfalto e do pátio; a trava mede a posição de CADA instância
       contra as faixas plantáveis lidas do próprio set.
     · POSTE SEM VÃO. O set entregue tem um buraco de 130 m em z, exatamente
       onde o caminhão fica. A trava é o maior intervalo entre postes vizinhos.
     · O TÚNEL EXISTE E É SUAVE. Fotografa com uma construção entre a lente e o
       veículo, que é a única prova que interessa. */
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
const scene = S.scene;
const set = scene.getObjectByName('ts-set');
if (!set) return out;
const r1 = (v) => Math.round(v * 10) / 10;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});
scene.updateMatrixWorld(true);

/* ---------- as faixas plantáveis, medidas como o módulo as lê ---------- */
const box = new THREE.Box3();
const faixas = [];
set.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
  const n = o.name || '';
  const canteiro = /^median|^rb_island/i.test(n);
  if (!canteiro && !/^turf_/i.test(n)) return;
  box.setFromObject(o);
  if (box.isEmpty()) return;
  faixas.push({ n, canteiro, x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z });
});
out.push(['faixas plantáveis', faixas.map((f) => f.n).join(', ') || 'nenhuma']);
out.push(['há faixa plantável', faixas.length > 0]);

/* ---------- toda instância de planta, contra as faixas ---------- */
const m4 = new THREE.Matrix4();
const p = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
let plantas = 0, fora = 0, enterradas = 0;
const exemplos = [];
set.traverse((o) => {
  if (!o.isInstancedMesh) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!mat || !/^PLANT_/.test(mat.name || '')) return;
  /* Só a CASCA: casca e folha compartilham a matriz, contar as duas dobraria. */
  if (/_1$/.test(o.name || '')) return;
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, m4);
    p.setFromMatrixPosition(m4);
    o.localToWorld(p);
    plantas++;
    const ok = faixas.some((f) => p.x >= f.x0 && p.x <= f.x1 && p.z >= f.z0 && p.z <= f.z1);
    if (!ok) {
      fora++;
      if (exemplos.length < 6) exemplos.push(`${o.name}#${i} @${r1(p.x)},${r1(p.z)}`);
    }
    /* O PÉ, e não a origem da instância: a origem do modelo não é a base dele
       (é isso que `matrizDe()` compensa com −peY·s), então medir `p.y` mediria o
       deslocamento da compensação e não onde a árvore encosta. */
    m4.decompose(_p, _q, _s);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const pe = p.y + o.geometry.boundingBox.min.y * _s.y;
    if (pe < -0.35 || pe > 0.35) enterradas++;
  }
});
out.push(['instâncias de planta', plantas]);
out.push(['  fora de canteiro/grama', fora]);
exemplos.forEach((e, i) => out.push([`    fora ${i}`, e]));
out.push(['toda planta está em canteiro ou grama', plantas > 0 && fora === 0]);
out.push(['  com o pé fora do chão (±0,35 m)', enterradas]);
out.push(['toda planta com o pé no chão', enterradas === 0]);

/* ---------- os postes ---------- */
const ctr = new THREE.Vector3();
const postes = [];
set.traverse((o) => {
  if (!o.isMesh || !/^mast_/i.test(o.name || '')) return;
  box.setFromObject(o);
  if (box.isEmpty()) return;
  box.getCenter(ctr);
  postes.push({ n: o.name, x: r1(ctr.x), z: r1(ctr.z) });
});
postes.sort((a, b) => a.z - b.z);
out.push(['postes', postes.length]);
out.push(['  linhas de x', [...new Set(postes.map((q) => q.x))].join(', ')]);
let maiorVao = 0;
for (let i = 1; i < postes.length; i++) {
  maiorVao = Math.max(maiorVao, postes[i].z - postes[i - 1].z);
}
out.push(['  maior vão entre postes vizinhos (m)', r1(maiorVao)]);
/* 60 m é generoso: dois passos de uma via iluminada. O vão de fábrica era 128. */
out.push(['nenhum vão maior que 60 m', postes.length > 1 && maiorVao <= 60]);
out.push(['  z de cada poste', postes.map((q) => q.z).join(' ')]);
out.push(['  postes alternam os lados',
  postes.every((q, i) => i === 0 || q.x !== postes[i - 1].x)]);

/* ---------- o túnel ---------- */
const st = S.lighting.getSeeThrough ? S.lighting.getSeeThrough() : null;
out.push(['o túnel está exposto no handle', !!st]);
if (st) out.push(['  estado', JSON.stringify({ amount: r1(st.amount), radius: r1(st.radius) })]);

/* Foto: câmera baixa, do outro lado de um galpão. `controls` desligado para a
   pose ser a pedida (o `update()` reimpõe as restrições de órbita). */
S.controls.enabled = false;
async function pose(nome, eye, tgt) {
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(10);
  for (let i = 0; i < 10; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([nome, await toURL(res.blob)]);
}

S.lighting.applyPreset('ensolarado', { animate: false });
/* De dentro do pátio a leste, olhando o caminhão através do galpão MC_03/MC_12. */
await pose('t1_atraves_do_galpao', [46, 3, -4], [0, 2, 12]);
/* Do canteiro, com árvore e poste entre a lente e o caminhão. */
await pose('t2_atraves_da_arvore', [-13, 2.2, 40], [0, 2, 14]);
/* Vista geral do arranjo. */
await pose('t3_arranjo_geral', [70, 34, 96], [0, 0, 6]);

S.controls.enabled = true;
return out;
