/* SONDA DE RAIO + CLOSE-UPS — "que peça é ESTA, na foto?" (2026-08-19)
   ===========================================================================
   O censo diz o que EXISTE e onde; não diz o que APARECE. Esta sonda varre uma
   JANELA do modelo com raios e imprime um mapa de caracteres — o mesmo
   enquadramento da foto do dono, só que rotulado —, e tira close-ups com a
   câmera posta à mão nas mesmas regiões, para comparar lado a lado.

   ⚠️ A JANELA TEM DE EXCLUIR AS CHAPAS GRANDES. `SIDE_L`/`SIDE_R` têm 170 mil
   triângulos cada; uma janela que as inclua faz cada célula testar centenas de
   milhares de triângulos e a varredura não termina. Por isso os recortes de
   flanco param abaixo do piso do baú.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-scan-0819.mjs > /tmp/scan-0819.txt */

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

const vis = (o) => {
  for (let n = o; n; n = n.parent) if (n.visible === false) return false;
  return true;
};

function catalogar(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const lista = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const b = new THREE.Box3();
    for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    lista.push({
      o, b,
      nome: o.name || '(sem nome)',
      mat: mats.map((x) => x?.name || '?').join('+'),
      fusao: /^FUSAO__/.test(o.name || ''),
      vis: vis(o),
      tris: Math.round((o.geometry.index ? o.geometry.index.count : p.count) / 3),
    });
  });
  return lista;
}

function varrer(root, lista, cfg) {
  const { eixo, sentido, h0, h1, v0, v1, cols, rows, origem, so, maxTris = 60000 } = cfg;
  root.updateWorldMatrix(true, true);
  const toWorld = root.matrixWorld;
  const dir = eixo === 'x'
    ? new THREE.Vector3(-sentido, 0, 0)
    : new THREE.Vector3(0, 0, -sentido);
  const dirW = dir.clone().transformDirection(toWorld).normalize();

  const cand = lista.filter((c) => {
    if (so === 'vis' && !c.vis) return false;
    if (so === 'orig' && c.fusao) return false;
    if (c.tris > maxTris) return false;
    const b = c.b;
    if (b.max.y < v0 - 0.02 || b.min.y > v1 + 0.02) return false;
    if (eixo === 'x') return !(b.max.z < h0 - 0.02 || b.min.z > h1 + 0.02);
    return !(b.max.x < h0 - 0.02 || b.min.x > h1 + 0.02);
  });
  const objs = cand.map((c) => c.o);
  const porObj = new Map(cand.map((c) => [c.o, c]));

  const rc = new THREE.Raycaster();
  rc.far = 60;
  const o3 = new THREE.Vector3();
  const chaves = [];
  const conta = new Map();
  for (let r = 0; r < rows; r++) {
    const y = v1 - (v1 - v0) * (r + 0.5) / rows;
    const linha = [];
    for (let c = 0; c < cols; c++) {
      const h = h0 + (h1 - h0) * (c + 0.5) / cols;
      if (eixo === 'x') o3.set(sentido * origem, y, h);
      else o3.set(h, y, sentido * origem);
      rc.set(o3.clone().applyMatrix4(toWorld), dirW);
      const hits = rc.intersectObjects(objs, false);
      if (!hits.length) { linha.push(null); continue; }
      const c0 = porObj.get(hits[0].object);
      const chave = so === 'vis' ? c0.mat : (c0.nome + ' [' + c0.mat + ']');
      let e = conta.get(chave);
      if (!e) {
        e = { n: 0, hMin: Infinity, hMax: -Infinity, vMin: Infinity, vMax: -Infinity };
        conta.set(chave, e);
      }
      e.n++;
      if (h < e.hMin) e.hMin = h;
      if (h > e.hMax) e.hMax = h;
      if (y < e.vMin) e.vMin = y;
      if (y > e.vMax) e.vMax = y;
      linha.push(chave);
    }
    chaves.push(linha);
  }
  const ord = [...conta.entries()].sort((a, b) => b[1].n - a[1].n);
  const ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+*#@%$&';
  const cod = new Map(ord.map(([k], i) => [k, ALFA[i] || '?']));
  const mapa = chaves.map((l) => l.map((k) => (k === null ? '.' : cod.get(k))).join(''));
  const legenda = ord.map(([k, e]) => `${cod.get(k)} ${String(e.n).padStart(5)}  `
    + `h[${e.hMin.toFixed(3)},${e.hMax.toFixed(3)}] v[${e.vMin.toFixed(3)},${e.vMax.toFixed(3)}]  ${k}`);
  return { mapa, legenda, cols, rows, h0, h1, v0, v1 };
}

function relatar(nome, res) {
  out.push([nome + ' janela', `h[${res.h0},${res.h1}] v[${res.v0},${res.v1}] ${res.cols}x${res.rows}`]);
  out.push([nome + ' legenda', '\n' + res.legenda.join('\n')]);
  out.push([nome + ' mapa', '\n' + res.mapa.join('\n')]);
}

/* ---------------------------------------------------------------- câmera */
S.lighting.suspendAvoidance?.(true);
async function olharPara(alvoLocal, dirLocal, dist) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const alvo = new THREE.Vector3(...alvoLocal).applyMatrix4(t.matrixWorld);
  const d = new THREE.Vector3(...dirLocal).transformDirection(t.matrixWorld).normalize();
  S.camera.position.copy(alvo.clone().addScaledVector(d, dist));
  S.camera.lookAt(alvo);
  S.controls.target.copy(alvo);
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate?.(6);
  for (let i = 0; i < 6; i++) await B.frame();
}
async function foto(nome) {
  const r = await B.captureViewport({ quality: 'high' });
  const blob = r?.blob;
  if (!blob) return;
  const url = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => res('');
    fr.readAsDataURL(blob);
  });
  if (url) out.push([nome, url]);
}

/* ================= ATO 1 — SEMIRREBOQUE ================================= */
{
  const t = S.state.trailer;
  const lista = catalogar(t);
  out.push(['ato1 implemento', S.state.implement?.id || '-']);
  /* Os "caninhos": a faixa preta logo abaixo do trilho de piso. O topo da
     janela para em 1,335 — o piso do baú é 1,392, então SIDE_L/R ficam fora. */
  relatar('SEMI-saia-orig', varrer(t, lista, {
    eixo: 'x', sentido: 1, h0: -7.5, h1: 7.3, v0: 0.95, v1: 1.335,
    cols: 148, rows: 16, origem: 4, so: 'orig',
  }));
  relatar('SEMI-saia-baixa-orig', varrer(t, lista, {
    eixo: 'x', sentido: 1, h0: -7.5, h1: 7.3, v0: 0.50, v1: 0.95,
    cols: 148, rows: 14, origem: 4, so: 'orig',
  }));
  /* A ferragem que prende a porta na lateral. */
  relatar('SEMI-engate-lateral-orig', varrer(t, lista, {
    eixo: 'x', sentido: 1, h0: -6.60, h1: -6.20, v0: 1.55, v1: 1.72,
    cols: 60, rows: 26, origem: 4, so: 'orig',
  }));

  await olharPara([1.30, 1.25, 1.60], [1, 0.10, 0.25], 3.2);
  await foto('SEMI-foto-saia');
  await olharPara([1.30, 2.10, 4.20], [1, 0.02, 0.10], 1.4);
  await foto('SEMI-foto-emenda');
  await olharPara([1.30, 1.63, -6.41], [1, 0.05, 0.20], 1.2);
  await foto('SEMI-foto-engate');
}

/* ================= ATO 2 — SOBRECHASSI ================================== */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
async function trocar(a) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 16; i++) await B.frame();
}
const achar = (f) => alvos.find((a) => a.c.file.endsWith(f));

/* A MONTAGEM, em quatro trocas seguidas — a foto do dono mostra a carroceria
   3,2 m atrás da cabine e a primeira rodada da bancada não reproduziu. */
function frenteDoBau() {
  const st = S.state;
  if (!st.trailer || !st.trailerGroup) return null;
  const rig = st.trailerGroup.parent;
  rig?.updateWorldMatrix(true, true);
  const inv = rig ? new THREE.Matrix4().copy(rig.matrixWorld).invert() : new THREE.Matrix4();
  const v = new THREE.Vector3();
  let maxZ = -Infinity, minZ = Infinity;
  st.trailer.updateWorldMatrix(true, true);
  st.trailer.traverse((o) => {
    if (!o.isMesh || !vis(o) || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((x) => /cor_padrao_branco|metalbranco/i.test(x?.name || ''))) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (v.z > maxZ) maxZ = v.z;
      if (v.z < minZ) minZ = v.z;
    }
  });
  return { frente: +maxZ.toFixed(3), tras: +minZ.toFixed(3),
    caixa: st.trailerBox ? +st.trailerBox.max.z.toFixed(3) : null,
    pos: +st.trailer.position.z.toFixed(3) };
}

const vm = achar('volvo_vm_2015_6x2r.glb');
const p8 = achar('scania_p_8x2r.glb');
const cavalo = alvos.find((a) => !a.mo.rigid && a.c.file.includes('trucks/'));
const seq = [['VM', vm], ['P', p8], ['VM2', vm], ['cavalo', cavalo], ['VM3', vm]];
for (const [rot, a] of seq) {
  if (!a) { out.push(['montagem ' + rot, 'fora do catálogo']); continue; }
  await trocar(a);
  out.push(['montagem ' + rot, JSON.stringify(frenteDoBau()) + ' impl=' + S.state.implement?.id]);
}

if (S.state.implement?.kind === 'sobrechassi') {
  const t = S.state.trailer;
  const lista = catalogar(t);
  relatar('SOBRE-traseira-orig', varrer(t, lista, {
    eixo: 'z', sentido: -1, h0: -0.55, h1: 0.55, v0: 0.30, v1: 0.80,
    cols: 110, rows: 50, origem: 9, so: 'orig',
  }));
  relatar('SOBRE-saia-orig', varrer(t, lista, {
    eixo: 'x', sentido: 1, h0: -4.30, h1: 4.30, v0: 0.02, v1: 0.32,
    cols: 130, rows: 14, origem: 4, so: 'orig',
  }));

  await olharPara([1.30, 0.25, 0.00], [1, 0.10, 0.25], 3.2);
  await foto('SOBRE-foto-saia');
  await olharPara([0.00, 0.62, -4.30], [0.05, 0.05, -1], 1.6);
  await foto('SOBRE-foto-traseira-pe');
  await olharPara([0.00, 2.05, -4.30], [0.05, 0.05, -1], 1.2);
  await foto('SOBRE-foto-varao');
  await olharPara([0.00, 2.40, 4.60], [0.55, 0.15, 1], 4.0);
  await foto('SOBRE-foto-tk');
  await olharPara([1.10, 0.00, -4.00], [0.8, 0.05, -1], 3.0);
  await foto('SOBRE-foto-mangueira');
}

return out;
