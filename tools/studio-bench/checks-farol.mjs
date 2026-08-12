/* SONDA DO FAROL — o que de fato desenha o pixel do farol, e com que valor.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-farol.mjs

   POR QUE UMA SONDA E NÃO UMA TRAVA. O farol do FH continuou apagado depois de o
   material da lente entrar no registro, e a bancada dizia "acende" — porque a
   trava lia o REGISTRO, não a tela. Registro não é brilho. As três hipóteses que
   restaram só se separam medindo o pixel:

     a) o material aceso está lá, mas o UV daquela malha cai numa parte ESCURA do
        atlas (o atlas é o albedo reusado, então o housing é escuro);
     b) há um vidro de cobertura opaco a 80 % na frente, e o brilho chega a 20 %;
     c) a malha que desenha o pixel é outra, de outro material.

   Então: raycast no pixel do farol, lista TODOS os acertos em ordem de
   profundidade com material, emissivo e intensidade, e amostra o albedo no UV do
   acerto. */
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
const THREE = S.THREE;
const L = S.lighting;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

L.setHourOfDay(21, { animate: false });
for (let i = 0; i < 8; i++) await B.frame();

const vl = L.getVehicleLights();
out.push(['nível das luzes', r2(vl.nivel)]);
out.push(['materiais registrados', vl.nomes.join(', ')]);

/* O valor EFETIVO de cada lâmpada: emissivo x intensidade. */
const alvos = new Map();
S.scene.traverse((o) => {
  if (!o.isMesh) return;
  const mm = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mm) {
    if (!m || !m.name || !vl.nomes.includes(m.name)) continue;
    if (alvos.has(m.name)) continue;
    alvos.set(m.name, {
      emissive: m.emissive.getHexString(),
      intensidade: r2(m.emissiveIntensity),
      temMapaEmi: !!m.emissiveMap,
      mapaEmiEhAlbedo: m.emissiveMap === m.map,
      /* A INJEÇÃO ESTÁ VIVA? É a pergunta decisiva: com os números certos e sem a
         injeção, o resultado é exatamente o creme que a foto mostra. */
      injetado: typeof m.customProgramCacheKey === 'function'
        && /ts-lamp/.test(String(m.customProgramCacheKey())),
      tipo: m.type,
      malha: o.name || '?',
    });
  }
});
for (const [n, v] of alvos) out.push([`  ${n}`, JSON.stringify(v)]);
out.push(['— escala e pico medido do mapa —', '']);
for (const [n, d] of Object.entries(vl.detalhe || {})) out.push([`  ${n}`, d]);

/* ---------- o pixel do farol ----------
   A pose sai da caixa do conjunto, e o alvo é a quina dianteira: o cavalo fica na
   ponta de MENOR z (ver o engate). */
const cxa = L.getSeeThrough().alvoCaixa;
out.push(['caixa do conjunto', cxa ? cxa.map(r2).join(' ') : 'nenhuma']);
if (!cxa) return out;
const cxm = (cxa[0] + cxa[3]) / 2;

S.controls.enabled = false;
S.camera.position.set(cxm + 3.0, 1.3, cxa[2] - 6.5);
S.camera.lookAt(cxm, 1.0, cxa[2] + 1.0);
S.camera.updateMatrixWorld(true);
S.camera.updateProjectionMatrix();
L.invalidate(6);
for (let i = 0; i < 12; i++) await B.frame();

/* Varre uma grade na metade de baixo do quadro e reporta, para cada acerto, a
   pilha de materiais. É a grade que acha o farol sem eu adivinhar o pixel. */
const rc = new THREE.Raycaster();
const achados = new Map();
for (let gx = -0.6; gx <= 0.6; gx += 0.1) {
  for (let gy = -0.7; gy <= 0.0; gy += 0.1) {
    rc.setFromCamera(new THREE.Vector2(gx, gy), S.camera);
    const hits = rc.intersectObject(S.scene, true);
    for (let i = 0; i < Math.min(hits.length, 4); i++) {
      const h = hits[i];
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (!m) continue;
      const chave = (m.name || '?') + ' @' + i;
      const reg = achados.get(chave) || { n: 0, nome: m.name || '?', ordem: i };
      reg.n++;
      achados.set(chave, reg);
    }
  }
}
const lista = [...achados.values()].sort((a, b) => b.n - a.n).slice(0, 22);
out.push(['— pilha de materiais na frente do cavalo —', '']);
lista.forEach((r) => out.push([`  ordem ${r.ordem} · ${r.nome}`, r.n + ' raios']));

/* E o albedo NO UV do acerto, para o material do farol: é o teste da hipótese (a). */
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
function amostrar(tex, u, v) {
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  canvas.width = img.width; canvas.height = img.height;
  try { ctx.drawImage(img, 0, 0); } catch (_) { return null; }
  const x = Math.min(img.width - 1, Math.max(0, Math.round(u * img.width)));
  /* `flipY` das texturas do glTF: v = 0 é a base, e o canvas cresce para baixo. */
  const y = Math.min(img.height - 1, Math.max(0, Math.round((1 - v) * img.height)));
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}

out.push(['— albedo no UV do acerto —', '']);
for (let gx = -0.6; gx <= 0.6; gx += 0.05) {
  for (let gy = -0.7; gy <= 0.0; gy += 0.05) {
    rc.setFromCamera(new THREE.Vector2(gx, gy), S.camera);
    const hits = rc.intersectObject(S.scene, true);
    for (const h of hits.slice(0, 3)) {
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (!m || !/f_light|_lights_w|farol/i.test(m.name || '')) continue;
      if (!h.uv) continue;
      const px = amostrar(m.emissiveMap || m.map, h.uv.x, h.uv.y);
      out.push([`  ${m.name} uv ${r3(h.uv.x)},${r3(h.uv.y)}`,
        `albedo ${px ? px.join(',') : '?'} · emiInt ${r2(m.emissiveIntensity)}`
        + ` · em ${(gx).toFixed(2)},${(gy).toFixed(2)}`]);
      gy = 99; gx = 99;                    // um exemplo basta
      break;
    }
  }
}

S.controls.enabled = true;
return out;
