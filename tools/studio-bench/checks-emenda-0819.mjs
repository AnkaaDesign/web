/* A EMENDA E A COLUNA DE REBITES, EM COORDENADA — 2026-08-19.
   ===========================================================================
   `addPlateRivets()` põe a coluna em `sSeam + 12 mm`, ou seja 12 mm À FRENTE da
   emenda, sobre a aba que cavalga. A análise de pixel da foto do dono mede o
   contrário: a coluna aparece ~17 mm ATRÁS da linha (a traseira do baú está à
   direita na foto, e é onde os rebites caem).

   Ou a leitura da foto está errada, ou o espaço do PAINEL está espelhado em
   relação ao do implemento — e nesse caso o sinal de `+0,012` vira `−0,012` na
   imagem sem que nada no código mude de nome. Esta sonda decide: imprime, no
   referencial do IMPLEMENTO, o z de cada emenda (pela grade publicada) e o z de
   cada coluna de rebite (pela malha `_RIVETS`), e a diferença entre os dois.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-emenda-0819.mjs > /tmp/emenda-0819.txt */

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

out.push(['implemento', S.state.implement?.id || '-']);

/* A grade publicada, que é o que o editor 2D desenha. */
const grade = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
out.push(['plateGrid', grade ? JSON.stringify(grade) : '(não exposto)']);

t.updateWorldMatrix(true, true);
const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();

for (const nome of ['SIDE_R', 'SIDE_L']) {
  let panel = null;
  t.traverse((o) => { if (o.isMesh && o.name === nome) panel = o; });
  if (!panel) { out.push([nome, 'não existe']); continue; }

  /* Caixa do painel no referencial do IMPLEMENTO, e a matriz painel→implemento
     — é o sinal dela que responde a pergunta. */
  const m = new THREE.Matrix4().multiplyMatrices(inv, panel.matrixWorld);
  const e = m.elements;
  out.push([nome + ' matriz painel->implemento (linha z)',
    JSON.stringify([r4(e[2]), r4(e[6]), r4(e[10]), r4(e[14])])]);

  /* As DOBRAS da emenda, medidas na própria chapa: um degrau em X de ~2,2 mm
     concentrado em 1,8 mm de z. Aqui a busca é simples — o histograma do x mais
     externo por faixa de 1 mm de z, numa altura só. */
  const pos = panel.geometry.attributes.position;
  const v = new THREE.Vector3();
  const sgn = nome === 'SIDE_R' ? 1 : -1;
  const porZ = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    const b = Math.round(v.z / 0.001);
    const d = sgn * v.x;
    if (!(d <= (porZ.get(b) ?? -Infinity))) porZ.set(b, d);
  }
  const bins = [...porZ.entries()].sort((a, b) => a[0] - b[0]);
  /* O degrau: onde o x mais externo cai mais de 1,5 mm entre faixas vizinhas. */
  const degraus = [];
  for (let i = 1; i < bins.length; i++) {
    const dz = bins[i][0] - bins[i - 1][0];
    if (dz > 3) continue;
    const dd = bins[i][1] - bins[i - 1][1];
    if (Math.abs(dd) > 0.0015) degraus.push([r4(bins[i][0] * 0.001), r4(dd)]);
  }
  out.push([nome + ' degraus (z, salto em x)', JSON.stringify(degraus.slice(0, 24))]);

  let riv = null;
  panel.traverse((o) => { if (o.isMesh && /_RIVETS$/.test(o.name)) riv = o; });
  if (!riv) { out.push([nome + ' rebites', 'sem malha _RIVETS']); continue; }
  const mr = new THREE.Matrix4().multiplyMatrices(inv, riv.matrixWorld);
  const rp = riv.geometry.attributes.position;
  const zs = new Set();
  for (let i = 0; i < rp.count; i++) {
    v.fromBufferAttribute(rp, i).applyMatrix4(mr);
    zs.add(Math.round(v.z * 1000) / 1000);
  }
  const lista = [...zs].sort((a, b) => a - b);
  const cols = [];
  let cur = [lista[0]];
  for (let i = 1; i < lista.length; i++) {
    if (lista[i] - lista[i - 1] < 0.030) cur.push(lista[i]);
    else { cols.push(cur); cur = [lista[i]]; }
  }
  cols.push(cur);
  const centros = cols.map((c) => r4((c[0] + c[c.length - 1]) / 2));
  out.push([nome + ' colunas de rebite (z no implemento)', JSON.stringify(centros)]);
}

return out;
