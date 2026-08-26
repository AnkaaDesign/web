/* O PERFIL DO FRISO, CRU — o único jeito de saber onde é a PARTE LISA.
   ===========================================================================
   `RIB_FLAT_CENTER = 0,0467` foi medido em 2026-08-11 com a régua "recuada mais
   de 2,5 mm da crista". Essa régua tem um viés que só aparece quando o friso é
   ASSIMÉTRICO: ela mede a largura da faixa que passa de um limiar, e o centro
   dela não é o centro do PLATÔ. O dono aponta o resultado com print — *"os
   rebites estão na parte elevada dos frisos em vez de centralizada na parte
   lisa"*.

   Aqui não há limiar: a sonda imprime o perfil INTEIRO, faixa de 0,5 mm por
   faixa de 0,5 mm, ao longo de dois passos. O centro do platô sai da leitura.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-perfil-0819.mjs > /tmp/perfil-0819.txt */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 20; i++) await B.frame();
const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);
const t = S.state.trailer;
const rig = S.state.trailerRig;
const p = rig.profile;

out.push(['implemento', S.state.implement?.id || '-']);
out.push(['perfil', JSON.stringify({
  floorY: r4(p.floorY), skirtHeight: r4(p.skirtHeight), pitch: r4(p.pitch),
  ribCount: p.ribCount, row0: r4(p.floorY + p.skirtHeight),
})]);

let panel = null;
t.traverse((o) => { if (o.isMesh && o.name === 'SIDE_R') panel = o; });
if (!panel) { out.push(['★', 'SIDE_R não existe']); return out; }

t.updateWorldMatrix(true, true);
const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
const m = new THREE.Matrix4().multiplyMatrices(inv, panel.matrixWorld);
const pos = panel.geometry.attributes.position;
const nor = panel.geometry.attributes.normal;
const v = new THREE.Vector3();

/* Duas amostras: uma no meio da chapa (longe de emenda) e outra sobre a
   emenda, para ver se o remonte muda a leitura. */
const row0 = p.floorY + p.skirtHeight;
const y0 = row0 + 10 * p.pitch, y1 = y0 + 2 * p.pitch;
const BIN = 0.0005;
const outer = new Map();
const conta = new Map();
for (let i = 0; i < pos.count; i++) {
  if (nor && Math.abs(nor.getX(i)) < 0.7) continue;
  v.fromBufferAttribute(pos, i).applyMatrix4(m);
  if (v.y < y0 || v.y > y1) continue;
  if (v.z < -3 || v.z > -2) continue;          // um metro de chapa, sem emenda
  const b = Math.round(v.y / BIN);
  if (!(v.x <= (outer.get(b) ?? -Infinity))) outer.set(b, v.x);
  conta.set(b, (conta.get(b) || 0) + 1);
}
const bins = [...outer.entries()].sort((a, b) => a[0] - b[0]);
const crest = Math.max(...bins.map((e) => e[1]));
const fundo = Math.min(...bins.map((e) => e[1]));
out.push(['janela', JSON.stringify({ y0: r4(y0), y1: r4(y1), crest: r4(crest), fundo: r4(fundo),
  relevo_mm: +((crest - fundo) * 1000).toFixed(2), bins: bins.length })]);

/* O perfil, linha a linha: y relativo ao passo, profundidade em mm sob a crista. */
const linhas = bins.map(([b, x]) => {
  const y = b * BIN;
  const fase = ((y - row0) % p.pitch + p.pitch) % p.pitch;
  const prof = (crest - x) * 1000;
  return `${r4(y)}  fase ${(fase * 1000).toFixed(1).padStart(6)} mm  `
    + `sob a crista ${prof.toFixed(2).padStart(6)} mm  ${'#'.repeat(Math.round(prof * 3))}`;
});
out.push(['perfil cru (SIDE_R, z -3..-2)', '\n' + linhas.join('\n')]);

/* E o PLATÔ: as faixas dentro de 0,5 mm do ponto mais fundo. */
const plato = bins.filter(([, x]) => (x - fundo) < 0.0005).map(([b]) => b * BIN);
if (plato.length) {
  const fases = plato.map((y) => ((y - row0) % p.pitch + p.pitch) % p.pitch).sort((a, b) => a - b);
  out.push(['platô (fase, mm)', JSON.stringify({
    de: +(fases[0] * 1000).toFixed(1),
    ate: +(fases[fases.length - 1] * 1000).toFixed(1),
    centro: +(((fases[0] + fases[fases.length - 1]) / 2) * 1000).toFixed(1),
    largura: +((fases[fases.length - 1] - fases[0]) * 1000).toFixed(1),
    n: fases.length,
  })]);
}
out.push(['RIB_FLAT_CENTER em uso (mm)', 46.7]);

/* Onde as calotas estão, na mesma fase. */
let riv = null;
panel.traverse((o) => { if (o.isMesh && /_RIVETS$/.test(o.name)) riv = o; });
if (riv) {
  const mr = new THREE.Matrix4().multiplyMatrices(inv, riv.matrixWorld);
  const rp = riv.geometry.attributes.position;
  const ys = new Set();
  for (let i = 0; i < rp.count; i++) {
    v.fromBufferAttribute(rp, i).applyMatrix4(mr);
    if (v.y >= y0 - 0.02 && v.y <= y1 + 0.02) ys.add(Math.round(v.y * 10000) / 10000);
  }
  const l = [...ys].sort((a, b) => a - b);
  const cl = [];
  let cur = [l[0]];
  for (let i = 1; i < l.length; i++) {
    if (l[i] - l[i - 1] < 0.01) cur.push(l[i]); else { cl.push(cur); cur = [l[i]]; }
  }
  cl.push(cur);
  out.push(['calotas (centro y, fase mm)', JSON.stringify(cl.map((c) => {
    const y = (c[0] + c[c.length - 1]) / 2;
    return [r4(y), +((((y - row0) % p.pitch + p.pitch) % p.pitch) * 1000).toFixed(1)];
  }))]);
}

return out;
