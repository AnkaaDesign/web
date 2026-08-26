/* OS TRÊS RÍGIDOS NO ESTÚDIO DE VERDADE — 2026-08-20.
   ===========================================================================
   Sucessor de `checks-rigido-0818.mjs`, com duas perguntas que aquele não
   fazia porque na rodada dele não havia resposta:

     · A COR É APLICADA? Os três rígidos vêm de bakes brasileiros e nenhum deles
       segue a nomenclatura da SCS. Medido em 2026-08-20, o VM e o P tinham ZERO
       material pintável — escolher cor não mudava nada, e o P ficava no
       verde-água do rip. A prova aqui não é "existe material de tinta" — é
       PIXEL: duas tintas distantes, duas capturas, e a contagem do que mudou.
       Com zero material pintável as duas imagens saem IDÊNTICAS.
     · A CARROCERIA ENCOSTA ONDE DEVE? `measureCabRearWall()` devolvia o
       para-choque dianteiro do Scania P (1,43 m² de carenagem contra uma parede
       repartida em bandas de 0,9 m²) e o baú nascia 1,89 m DENTRO da cabine.
       A prova é a interseção: que área de malha do caminhão cai dentro da caixa
       do baú montado.

   ⚠️ RODE COM GEOMETRIA:
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-rigidos-0820.mjs
   Sem `--geometry` o driver bloqueia `*.glb` e não há caminhão nem carroceria
   para medir — o check sai todo em travessão, sem erro nenhum. */

const out = [];
const B = window.__bench;

const mm = (v) => (v === null || v === undefined ? '—' : `${(v * 1000).toFixed(0)} mm`);
const m = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(3)} m`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
/* ⚠️ `window.__studio` NASCE DEPOIS DO `mountStudio()`, e não no tempo de
   import de `boot.ts`. Capturá-lo no topo do check pega `undefined`. */
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 240000);
for (let i = 0; i < 20; i++) await B.frame();

const THREE = S.THREE;

/* ⚠️ AS CAIXAS SÃO MEDIDAS NO LOCAL DO `RIG`, NÃO EM MUNDO — o conjunto pende
   de um grupo com `yaw = π`, e em mundo os sinais de x e z estão invertidos em
   relação ao eixo do veículo. A nota longa está em `checks-rigido-0818.mjs`. */
const paraRig = () => {
  const rig = S.state.trailerGroup?.parent;
  if (!rig) return null;
  rig.updateWorldMatrix(true, true);
  return new THREE.Matrix4().copy(rig.matrixWorld).invert();
};

function caixa(root, keep) {
  if (!root) return null;
  const inv = paraRig();
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (keep && !keep(o)) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (inv) v.applyMatrix4(inv);
      b.expandByPoint(v);
    }
  });
  return b.isEmpty() ? null : b;
}

const matsDe = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
const branco = (o) => matsDe(o).some((x) => /cor_padrao_branco|metalbranco/i.test(x.name || ''));
const caixaBau = () => caixa(S.state.trailer, branco);
const caixaCab = () => caixa(S.state.cab);

/**
 * A INTERSEÇÃO: que área do CAMINHÃO cai dentro da caixa do baú montado.
 *
 * A folga de 250 mm é medida contra a PAREDE, e a parede não é o ponto mais
 * atrás da cabine — a chaminé do VM passa 167 mm dela e não encosta em nada,
 * porque é estreita. O que decide não é a distância, é a interseção.
 *
 * ⚠️ E O TOTAL SOZINHO REPROVA O CERTO. O para-lama do 2º eixo direcional do
 * Scania P entra com 5,99 m² e é BENIGNO: o topo dele fica 58 mm acima da linha
 * do piso, em |x| ≤ 1,23, e a saia do baú desce até |x| = 1,31 — ele está
 * ATRÁS da saia, escondido, que é onde um para-lama fica num caminhão de
 * verdade. Um baú que engole a cabine não faz isso: ele a atravessa metro
 * acima do piso.
 *
 * Então o portão é `alto` — a mesma interseção medida 150 mm acima do piso do
 * baú. Nessa faixa não existe para-lama nenhum, e o que sobrar é cabine.
 */
function intersecao() {
  const t = S.state.trailer, cab = S.state.cab;
  const bau = caixaBau();
  if (!t || !cab || !bau) return null;
  const inv = paraRig();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  const meiaLargura = (bau.max.x - bau.min.x) / 2;
  /* 150 mm acima do piso do baú: acima da crista de qualquer para-lama e bem
     abaixo de qualquer parte de cabine que estivesse dentro do baú. */
  const linhaAlta = bau.min.y + 0.15;
  const porPeca = new Map();
  let alto = 0;
  cab.updateWorldMatrix(true, true);
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const nome = (o.name || '') + matsDe(o).map((x) => x.name || '').join('+');
    if (/tire|pneu|wheel/i.test(nome)) return;
    const p = o.geometry.attributes.position;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
      if (inv) { a.applyMatrix4(inv); b.applyMatrix4(inv); c.applyMatrix4(inv); }
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      if (Math.abs(cx) > meiaLargura) continue;
      if (cy < bau.min.y || cy > bau.max.y) continue;
      if (cz < bau.min.z || cz > bau.max.z) continue;
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      const ar = nn.length() / 2;
      const tag = o.name || '(sem nome)';
      porPeca.set(tag, (porPeca.get(tag) || 0) + ar);
      if (cy > linhaAlta) alto += ar;
    }
  });
  const total = [...porPeca.values()].reduce((s, x) => s + x, 0);
  return {
    total, alto,
    quem: [...porPeca.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([n2, ar]) => `${n2}=${ar.toFixed(2)}m²`).join(' · '),
  };
}

/* ------------------------------------------------------------------ tinta */

/**
 * QUEM É TINTA, e quanta lataria isso cobre.
 *
 * ⚠️ A COR NÃO MORA NO `material.color`. `applyChoice()` a manda para o
 * UNIFORME COMPARTILHADO de `vehicle/paint.ts` (`setPaint({ color })`), e o
 * `color` do material continua sendo o do bake. Ler o material de volta
 * responderia sempre "não mudou" e seria um portão que reprova o certo.
 *
 * O que este censo mede é a outra metade: QUANTOS materiais viraram tinta e
 * QUANTA área eles cobrem. A cor em si é provada por PIXEL, em `mudaDeCor()`.
 */
function censoDeTinta() {
  const cab = S.state.cab;
  if (!cab) return null;
  const ehTinta = (mat) => !!S.paint?.isPaintMaterial?.(mat);
  const vistos = new Map();
  let areaTinta = 0, areaTotal = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  cab.updateWorldMatrix(true, true);
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : p.count;
    let area = 0;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      area += nn.length() / 2;
    }
    areaTotal += area;
    if (matsDe(o).some(ehTinta)) {
      areaTinta += area;
      for (const mat of matsDe(o)) if (ehTinta(mat)) vistos.set(mat.name || '?', mat);
    }
  });
  return {
    materiais: vistos.size,
    nomes: [...vistos.keys()].join(', ') || '—',
    areaTinta, areaTotal,
    fracao: areaTotal > 0 ? areaTinta / areaTotal : 0,
  };
}

/** Os pixels de uma captura, para o diferencial abaixo. */
async function pixels() {
  const r = await B.captureViewport({ quality: 'low' });
  if (!r?.blob) return null;
  const bmp = await createImageBitmap(r.blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, cv.width, cv.height);
}

/**
 * ★ A PROVA DE QUE A COR CHEGA NA TELA.
 *
 * Duas tintas muito distantes, duas capturas, e a contagem de pixels que
 * mudaram. É o único portão que não pode passar por acidente: se nenhum
 * material da cabine é tinta, as duas imagens são idênticas e a contagem é
 * ZERO — que é exatamente o estado em que o VM e o Scania P estavam.
 *
 * A câmera não se mexe entre as duas, então qualquer pixel diferente é tinta.
 */
async function mudaDeCor() {
  if (!S.paint?.setPaint) return null;
  const antes = S.paint.getPaintParams ? { ...S.paint.getPaintParams() } : null;
  S.paint.setPaint({ finish: 'solid', color: '#d81b24', flakeColor: null, pearlFlip: null });
  S.lighting?.invalidate?.();
  for (let i = 0; i < 8; i++) await B.frame();
  const A = await pixels();
  S.paint.setPaint({ finish: 'solid', color: '#1049b8', flakeColor: null, pearlFlip: null });
  S.lighting?.invalidate?.();
  for (let i = 0; i < 8; i++) await B.frame();
  const Bx = await pixels();
  if (antes) S.paint.setPaint({ finish: antes.finish, color: antes.color });
  S.lighting?.invalidate?.();
  for (let i = 0; i < 4; i++) await B.frame();
  if (!A || !Bx || A.data.length !== Bx.data.length) return null;
  let mudou = 0, opacos = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i + 3] < 8) continue;
    opacos++;
    const d = Math.abs(A.data[i] - Bx.data[i])
      + Math.abs(A.data[i + 1] - Bx.data[i + 1])
      + Math.abs(A.data[i + 2] - Bx.data[i + 2]);
    if (d > 24) mudou++;
  }
  return { mudou, opacos, fracao: opacos ? mudou / opacos : 0 };
}

/* ----------------------------------------------------------------- troca */

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const acharChassi = (file) => alvos.find((a) => a.c.file.endsWith(file));

async function trocarPara(a, colorId) {
  const ok = await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: colorId ?? null, finishId: null, trim: null,
  }, { curtain: false });
  if (!ok) return false;
  const chegou = await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 16; i++) await B.frame();
  return chegou;
}

async function foto() {
  const r = await B.captureViewport({ quality: 'low' });
  const blob = r?.blob;
  if (!blob) return '(sem captura)';
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => res('(falha ao ler o blob)');
    fr.readAsDataURL(blob);
  });
}

async function ato(rotulo, arquivo) {
  out.push([`—— ${rotulo} ——`, arquivo]);
  const a = acharChassi(arquivo);
  if (!a) { out.push(['★ ' + rotulo, 'NÃO ESTÁ NO CATÁLOGO — ato pulado']); return; }

  out.push([`${rotulo} · carregou`, String(await trocarPara(a, null))]);

  const impl = S.state.implement;
  const mount = S.state.cabMount;
  const bau = caixaBau();
  const cab = caixaCab();
  const inter = intersecao();
  const tinta = censoDeTinta();
  const diff = await mudaDeCor();

  out.push([`${rotulo} · implemento`, impl ? `${impl.id} (${impl.kind})` : '—']);
  out.push([`${rotulo} · montagem`, mount ? mount.id : '—']);
  out.push([`${rotulo} · engate`, S.state.coupled ? 'engatado' : 'sem engate']);
  out.push([`${rotulo} · raízes no grupo`, String((S.state.trailerGroup?.children || []).length)]);
  out.push([`${rotulo} · piso do baú`, m(bau?.min.y)]);
  out.push([`${rotulo} · teto do baú`, m(bau?.max.y)]);
  /* ⚠️ `S.state.cab` é o GLB INTEIRO — cabine E quadro. `cab.min.z` é a ponta
     do chassi, não a traseira da cabine, então "folga cabine→testeira" medida
     assim dá o comprimento do caminhão com o sinal trocado. Quem responde à
     pergunta é a INTERSEÇÃO acima; aqui fica só o que a caixa do caminhão
     realmente diz. */
  if (cab && bau) {
    out.push([`${rotulo} · testeira do baú (z)`, m(bau.max.z)]);
    out.push([`${rotulo} · teto acima do caminhão`, mm(bau.max.y - cab.max.y)]);
  }
  if (bau) out.push([`${rotulo} · comprimento do baú`, m(bau.max.z - bau.min.z)]);
  out.push([`${rotulo} · INTERSEÇÃO cabine×baú`,
    inter ? `${inter.total.toFixed(3)} m² (acima do piso+150 mm: ${inter.alto.toFixed(3)} m²) · ${inter.quem}` : '—']);
  out.push([`${rotulo} · TINTA materiais`, tinta ? String(tinta.materiais) : '—']);
  out.push([`${rotulo} · TINTA nomes`, tinta ? tinta.nomes : '—']);
  out.push([`${rotulo} · TINTA cobertura`,
    tinta ? `${tinta.areaTinta.toFixed(1)} m² de ${tinta.areaTotal.toFixed(1)} (${(tinta.fracao * 100).toFixed(1)}%)` : '—']);
  out.push([`${rotulo} · PIXELS que mudam de cor`,
    diff ? `${diff.mudou} de ${diff.opacos} (${(diff.fracao * 100).toFixed(2)}%)` : '—']);

  out.push([`★ ${rotulo} · virou sobrechassi`, String(/sobrechassi/.test(impl?.kind || ''))]);
  out.push([`★ ${rotulo} · montagem reconhecida`, String(!!mount)]);
  out.push([`★ ${rotulo} · sem engate`, String(!S.state.coupled)]);
  out.push([`★ ${rotulo} · uma raiz só`, String((S.state.trailerGroup?.children || []).length === 1)]);
  out.push([`★ ${rotulo} · A COR CHEGA NA TELA`, String(!!diff && diff.mudou > 0)]);
  out.push([`★ ${rotulo} · cobertura ≥ 8% da malha`, String(!!tinta && tinta.fracao >= 0.08)]);
  out.push([`★ ${rotulo} · cabine fora do baú (< 0,1 m² acima do piso+150 mm)`,
    String(!!inter && inter.alto < 0.1)]);
  out.push([`foto-${rotulo}`, await foto()]);
}

out.push(['—— BOOT ——', S.state.cabDef?.file || '?']);

await ato('volvo-vm', 'volvo_vm_2015_6x2r.glb');
await ato('scania-p', 'scania_p_8x2r.glb');
await ato('vw-titan', 'vw_titan_6x2_tl.glb');

/* A VOLTA — sem ela o teste não pega o vazamento de estado: um implemento do
   modelo anterior sobrevivendo no grupo aparece como DUAS raízes aqui. */
out.push(['—— A VOLTA ——', 'de volta ao cavalo mecânico']);
const cavalo = alvos.find((a) => !a.mo.rigid && a.c.file.includes('trucks/'));
if (!cavalo) {
  out.push(['★ volta', 'nenhum cavalo no catálogo — ato pulado']);
} else {
  out.push(['volta · para', cavalo.c.file.split('/').pop()]);
  out.push(['volta · carregou', String(await trocarPara(cavalo, null))]);
  out.push(['★ volta · virou semirreboque', String(/semirreboque/.test(S.state.implement?.kind || ''))]);
  out.push(['★ volta · engatou', String(!!S.state.coupled)]);
  out.push(['★ volta · uma raiz só', String((S.state.trailerGroup?.children || []).length === 1)]);
  out.push(['foto-volta', await foto()]);
}

return out;
