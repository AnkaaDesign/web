/* VISTAS ORTOGRÁFICAS — Scania R 2016 6x2 + semirreboque 14,50 m.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-ortografico.mjs --vistas lados
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-ortografico.mjs --vistas frente-tras

   Quatro faces: lateral esquerda, lateral direita, traseira, frontal. Duas
   por rodada — PNG de 7680 px com alfa estoura o retorno do CDP com quatro.

   ORTOGRÁFICO DE VERDADE NÃO PASSA PELA CAPTURA DO ESTÚDIO: `captureViewport`
   copia a câmera de perspectiva da tela. Então a projeção é uma teleobjetiva
   de 0,4° a ~600 m: a diferença de escala entre a face da frente e a do fundo
   do veículo (2,6 m de profundidade) é 2,6/600 = 0,4 % — abaixo de um pixel
   na borda do quadro. `near`/`far` apertados em volta do assunto para o
   z-buffer não perder precisão a essa distância.

   ENQUADRAMENTO COMUM: as quatro vistas usam o MESMO chão e o MESMO topo, e as
   duas laterais a mesma faixa em Z (as duas portas a mesma em X). É isso que
   deixa as imagens alinhadas no PDF só por empilhar — nada é recentrado pela
   silhueta, que não é simétrica.

   LUZ NEUTRA: todo o rig de catálogo apagado. Quatro direcionais IGUAIS nas
   diagonais (45°, 135°, 225°, 315°, a 40° de elevação) + céu — cada face recebe
   exatamente duas delas, com o mesmo ângulo. Frente = trás, esquerda = direita,
   por construção.

   `--luz` escala a intensidade toda. O branco de fábrica da cabine estourava em
   255 com a luz dos guias; o padrão aqui é medido para o branco ficar abaixo
   do corte. */
const out = [];
const B = window.__bench;
const ARGV = window.__benchArgv || [];
const arg = (n, d) => { const i = ARGV.indexOf('--' + n); return i >= 0 ? ARGV[i + 1] : d; };
const VISTAS = arg('vistas', 'lados');
const LUZ = Number(arg('luz', '1.2'));
const EXPO = Number(arg('expo', '1.2'));
const TOM = arg('tom', 'linear');
/* CONTRASTE DE FORMA (comparado ao exemplo do dono, 28/09): com céu + ambiente
   dando a maior parte da luz, a cabine saía "lavada" — luz que vem de todo lado
   ilumina toda curva igual. O peso passa para as direcionais; céu e ambiente
   ficam como preenchimento. */
const CEU_K = Number(arg('ceu', '0.06')), AMB_K = Number(arg('amb', '0.20')), DIR_K = Number(arg('dir', '1.7'));
/* frente mais forte que trás: modela a cabine (face × flanco) sem quebrar a
   simetria esquerda/direita, que é o que o dono exige. */
const TRAS_K = Number(arg('tras', '1')), ELEV = Number(arg('elev', '50'));
/* inox/cromo reflete o ambiente com este ganho — escuro demais com o ambiente
   baixo; o galvanizado (fosco) NÃO entra, ele estava certo. */
const INOX_K = Number(arg('inox', '7'));
let expoBase = 0;
const TK = arg('tk', 'on') === 'on';
/* `--comprimento` só quando pedido: no rígido o estúdio já aplica o baú padrão
   do chassi (4x2 7,50 · 6x2 8,50 · 8x2 9,50). */
const COMPR = arg('comprimento', null) === null ? null : Number(arg('comprimento'));

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 10; i++) await B.frame();
const THREE = S.THREE;
const M = S.models?.state || S.state;

/* ---------- 1 · o conjunto ---------- */
const escolha = { manufacturerId: arg('fabricante', 'scania'), modelId: arg('modelo', 'scania-r-2016'), chassisId: arg('chassi', '6x2') };
const ARQ = arg('arquivo', 'scania_r_2016_6x2.glb');
await S.applyChoice({ envId: 'estudio', colorId: null, finishId: null, trim: null, ...escolha },
  { curtain: false });
await B.until(() => (M.cabDef?.file || '').includes(ARQ), 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
out.push(['escolha', { cab: M.cabDef?.file, implemento: M.implement?.id }]);
const RIGIDO = M.implement?.kind === 'sobrechassi';
if (COMPR !== null && Math.abs((S.trailerDims?.length || 0) - COMPR) > 0.005) {
  /* ⚠️ O PADRÃO DO CHASSI VOLTA: o estúdio aplica `BAU_PADRAO` (bitruck 9,50)
     num passe assíncrono DEPOIS da escolha, e um `setTrailerDims` cedo demais
     devolvia 8,50 e voltava a 9,50 quadros depois. Reaplica até ficar. */
  for (let tent = 0; tent < 8; tent++) {
    for (let i = 0; i < 20; i++) await B.frame();
    if (Math.abs(S.trailerDims.length - COMPR) < 0.005) {
      let firme = true;
      for (let i = 0; i < 30; i++) { await B.frame(); if (Math.abs(S.trailerDims.length - COMPR) > 0.005) { firme = false; break; } }
      if (firme) break;
    }
    await S.setTrailerDims({ length: COMPR, height: S.trailerDims.height });
  }
  for (let i = 0; i < 30; i++) await B.frame();
}
out.push(['bau', { ...S.trailerDims }]);
try { S.trim.set('thermoking', { visible: TK }); } catch (e) { out.push(['tk-erro', String(e)]); }
S.models.setVehicleView('both');
for (let i = 0; i < 20; i++) await B.frame();

/* ---------- 1b · a carreta NIVELADA ----------
   O conjunto sai do estúdio com o baú inclinado 0,55° (o pino-rei assenta
   abaixo da altura de rodagem traseira): numa vista ortográfica de 7680 px a
   borda de cima desce 43 px de ponta a ponta, e cada perfil comprido vira uma
   ESCADA de degraus de ~100 px — o serrilhado que o antisserrilhado não tira,
   porque não é borda torta, é borda quase reta. Gira o grupo do implemento em
   torno do contato do último eixo com o chão (as rodas não saem do chão) até a
   borda de cima da chapa lateral ficar horizontal. */
function inclinacaoDoBau() {
  let lado = null;
  M.trailer.traverse((o) => { if (!lado && o.isMesh && /^SIDE_[LR]$/.test(o.name)) lado = o; });
  if (!lado) return 0;
  lado.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(lado, true);
  const p = lado.geometry.attributes.position, v = new THREE.Vector3();
  let yF = -Infinity, yT = -Infinity;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(lado.matrixWorld);
    if (v.z > b.max.z - 0.4) yF = Math.max(yF, v.y);
    if (v.z < b.min.z + 0.4) yT = Math.max(yT, v.y);
  }
  return Math.atan2(yF - yT, (b.max.z - 0.2) - (b.min.z + 0.2));   // + = sobe para +Z
}
/* DIAGNÓSTICO de inclinação por conjunto: regressão da ALTURA MÁXIMA por fatia
   de 25 cm ao longo do comprimento, em graus (+ = sobe para +Z). */
function inclinacaoDe(malhas) {
  const bins = new Map(), v = new THREE.Vector3();
  for (const o of malhas) {
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const k = Math.round(v.z / 0.25);
      bins.set(k, Math.max(bins.get(k) ?? -Infinity, v.y));
    }
  }
  const xs = [], ys = [];
  for (const [k, y] of bins) { xs.push(k * 0.25); ys.push(y); }
  const n = xs.length; if (n < 4) return null;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return +(Math.atan(num / den) * 180 / Math.PI).toFixed(3);
}
if (arg('diag', null)) {
  const longarinas = [];
  M.cabGroup.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o, true);
    if (b.max.z - b.min.z > 3 && b.max.y < 1.4) longarinas.push(o);
  });
  const lado = []; M.trailer.traverse((o) => { if (o.isMesh && /^SIDE_[LR]$/.test(o.name)) lado.push(o); });
  const baixoImp = []; M.trailerGroup.traverse((o) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o, true); if (b.max.z - b.min.z > 3 && b.max.y < 1.6) baixoImp.push(o); } });
  out.push(['inclinacoes', { longarinasCaminhao: inclinacaoDe(longarinas), nLong: longarinas.length,
    nomesLong: longarinas.slice(0, 6).map((o) => o.name), chapaBau: inclinacaoDe(lado), baseImplemento: inclinacaoDe(baixoImp), nBase: baixoImp.length }]);
}
let nivel = null;
{
  const a0 = inclinacaoDoBau();
  /* pivô: o contato do pneu mais afastado do cavalo */
  const cabZ = new THREE.Box3().setFromObject(M.cabGroup).getCenter(new THREE.Vector3()).z;
  /* No RÍGIDO o baú está parafusado no chassi do caminhão: nivelar só o baú o
     despregaria. Lá gira o conjunto inteiro (os dois grupos), e só se a
     inclinação for de verdade (> 0,05°). */
  /* RÍGIDO (medido no P360, 28/09): as longarinas do caminhão estão retas
     (0,08°) e é o IMPLEMENTO que vem montado torto (0,95°, sobe para trás).
     Gira só o implemento em torno da quina de baixo da FRENTE dele, que é onde
     ele apoia no chassi: a traseira desce e assenta, o caminhão não se mexe. */
  const grupos = [M.trailerGroup];
  let piv = null, dist = -1;
  if (RIGIDO) {
    const bi = new THREE.Box3().setFromObject(M.trailer, true);
    const zFr = Math.abs(bi.min.z - cabZ) < Math.abs(bi.max.z - cabZ) ? bi.min.z : bi.max.z;
    piv = new THREE.Vector3((bi.min.x + bi.max.x) / 2, bi.min.y, zFr);
  } else M.trailerGroup.traverse((o) => {
    if (!o.isMesh || ![].concat(o.material).some((m) => /pneu|tire/i.test(m?.name || ''))) return;
    const b = new THREE.Box3().setFromObject(o, true), c = b.getCenter(new THREE.Vector3());
    if (Math.abs(c.z - cabZ) > dist) { dist = Math.abs(c.z - cabZ); piv = new THREE.Vector3(c.x, b.min.y, c.z); }
  });
  const aplicas = [];
  /* No rígido a inclinação é da SUSPENSÃO do modelo (chassi, baú e para-choque
     sobem juntos, rodas no chão): girar tudo tira a roda da frente do chão e
     girar só o baú abre vão sobre o chassi. Padrão: nivela só o semirreboque. */
  const NIVELAR = arg('nivelar', 'on') === 'on';
  if (NIVELAR && piv && Math.abs(a0) > 0.05 * Math.PI / 180) for (const g of grupos) {
  g.updateMatrixWorld(true);
  const R = new THREE.Matrix4().makeRotationX(a0);   // desfaz: a inclinação é em torno de X
  const m = new THREE.Matrix4().makeTranslation(piv.x, piv.y, piv.z).multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z)).multiply(g.matrixWorld);
  const local = new THREE.Matrix4().copy(g.parent.matrixWorld).invert().multiply(m);
  const n = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), esc: new THREE.Vector3() };
  local.decompose(n.pos, n.quat, n.esc);
  /* `matrix` escrita À MÃO também: o estúdio congela a matriz dos grupos
     (`matrixAutoUpdate = false`), e mexer só em position/quaternion não chega
     ao render — foi o que deixou a primeira tentativa com os mesmos 0,568°. */
  aplicas.push(() => {
    g.position.copy(n.pos); g.quaternion.copy(n.quat); g.scale.copy(n.esc);
    g.matrix.compose(n.pos, n.quat, n.esc);
    g.matrixWorldNeedsUpdate = true;
    g.updateMatrixWorld(true);
  });
  }
  nivel = { aplica: () => aplicas.forEach((f) => f()) };
  nivel.aplica();
  out.push(['nivel', { antesGraus: +(a0 * 180 / Math.PI).toFixed(3), depoisGraus: +(inclinacaoDoBau() * 180 / Math.PI).toFixed(4) }]);
}

/* ---------- 2 · chapa lisa, sem rebite, sem o filete que desprega ---------- */
try { S.merge.release(); } catch { /* sem fusão */ }
{
  const imp = new THREE.Box3().setFromObject(M.trailer);
  const L = imp.max.z - imp.min.z, H = imp.max.y - imp.min.y;
  const cx = (imp.min.x + imp.max.x) / 2;
  const v = new THREE.Vector3();
  const cands = [];
  M.trailer.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    if (b.max.z - b.min.z < L * 0.6 || b.max.y - b.min.y < H * 0.35) return;
    cands.push({ o, b });
  });
  let meia = 0;
  for (const { b } of cands) meia = Math.max(meia, Math.min(Math.abs(b.max.x - cx), Math.abs(b.min.x - cx)) > 0.5
    ? Math.max(Math.abs(b.max.x - cx), Math.abs(b.min.x - cx)) : 0);
  const faixa = 0.012;   // ver checks-guias-checkin.mjs: o vale da carreta fica 8 mm abaixo da crista
  /* ALISA PARA O VALE, NÃO PARA A CRISTA. Na chapa frisada a borda de cima e
     a de baixo são VALE e ficam atrás do perfil metálico do quadro; mandar tudo
     para a crista (1,3064) trazia a chapa para a FRENTE do perfil, e ela cobria
     uma faixa dele de branco — "o branco sangrou no frame". O plano do vale é
     medido: o percentil 1 de |x| dentro da faixa, por malha candidata. */
  const profs = [];
  for (const { o } of cands) {
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 7) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const a = Math.abs(v.x - cx);
      if (a > meia - faixa && a < meia + 0.002) profs.push(a);
    }
  }
  profs.sort((a, b) => a - b);
  const plano = profs[Math.floor(profs.length * 0.01)] ?? meia;
  /* SÓ O MIOLO DA CHAPA. As bordas (junto aos montantes de canto e aos
     perfis de cima e de baixo) já são lisas e ficam ATRÁS do metal, abaixo do
     vale; puxá-las para o plano do vale punha um filete branco dentro do
     montante e do perfil (P360, 28/09). Margem medida no friso: a primeira e a
     última fileira começam a ~12 cm das bordas. */
  let zA = Infinity, zB = -Infinity, yA = Infinity, yB = -Infinity;
  for (const { b } of cands) { zA = Math.min(zA, b.min.z); zB = Math.max(zB, b.max.z); yA = Math.min(yA, b.min.y); yB = Math.max(yB, b.max.y); }
  const MZ = Number(arg('miolo-z', '-5')), MY = Number(arg('miolo-y', '-5'));   // desligado: a caixa alinhada falha com o baú inclinado
  const noMiolo = (w) => w.z > zA + MZ && w.z < zB - MZ && w.y > yA + MY && w.y < yB - MY;
  let movidos = 0;
  let malhas = 0;
  for (const { o } of cands) {
    const pos0 = o.geometry.attributes.position;
    let hit = 0;
    for (let i = 0; i < pos0.count; i++) {
      v.fromBufferAttribute(pos0, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.x - cx) > meia - faixa && Math.abs(v.x - cx) < meia + 0.002) hit++;
    }
    if (hit < 200) continue;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const nm = new THREE.Matrix3().getNormalMatrix(inv).invert().transpose();
    const g = o.geometry.clone();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const dx = v.x - cx;
      if (Math.abs(dx) <= meia - faixa || Math.abs(dx) >= meia + 0.002) continue;
      if (!noMiolo(v)) continue;
      /* SÓ PARA TRÁS: o que está atrás do vale (as bordas enfiadas sob os
         montantes e os perfis) nunca é puxado para a frente — era isso que punha
         o filete branco dentro do metal. */
      if (Math.abs(dx) <= plano + 1e-5) continue;
      movidos++;
      const s = Math.sign(dx);
      v.x = cx + s * plano;
      v.applyMatrix4(inv);
      pos.setXYZ(i, v.x, v.y, v.z);
      if (nor) { n.set(s, 0, 0).applyMatrix3(nm).normalize(); nor.setXYZ(i, n.x, n.y, n.z); }
    }
    pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    o.geometry = g;
    malhas++;
  }
  out.push(['chapa-lisa', { crista: +meia.toFixed(4), plano: +plano.toFixed(4), malhas, miolo: [zA, zB, yA, yB].map((n) => +n.toFixed(2)), movidos: movidos }]);
}
let escondidos = 0;
M.trailerGroup.traverse((o) => {
  const mats = [].concat(o.material || []).map((m) => m?.name || '').join(',');
  if ((o.isMesh && (/RIVET|REBITE/i.test(o.name) || /rebite/i.test(mats))) || /^FILETE_TRILHO_TOPO_/.test(o.name)) {
    o.visible = false; escondidos++;
  }
});
out.push(['rebites-e-filetes-escondidos', escondidos]);
/* os canos de refrigeração do Thermo King desenhados na testeira (pedido do
   dono: não precisa) */
let canos = 0;
M.trailerGroup.traverse((o) => { if (/^TS_TK_LINHA/.test(o.name || '')) { o.visible = false; canos++; } });
/* e as mangueiras do PRÓPRIO modelo da unidade (`refri_*`), que pendem abaixo
   da carcaça: tudo do Thermo King que desce mais de 5 cm abaixo dela. */
if (M.tk) {
  let casca = null;
  M.tk.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => /tk-housing-white/i.test(m?.name || ''))) casca = new THREE.Box3().setFromObject(o, true); });
  if (casca) M.tk.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o, true);
    if (b.min.y < casca.min.y - 0.05) { o.visible = false; canos++; }
  });
}
out.push(['canos-tk-escondidos', canos]);

/* ---------- 2b · as cores de verdade ----------
   Branco de frota não é #ffffff. A pintura da cabine (`*_plain_grey`) vinha
   #eef1f5 — branco AZULADO, e é por isso que tudo lia frio. Pedido do dono:
   cabine, testeira e traseira num cinza puxado para o amarelo; a lateral do
   baú mais cinza que amarela. A chapa branca é UMA malha para o corpo inteiro
   (`TRAILER_BODY` carrega lateral, testeira e porta), então a separação é por
   FACE: cor por vértice, lateral onde a normal aponta para ±X. */
const COR = {
  cabine: new THREE.Color('#faf8f0'),
  faces: new THREE.Color('#faf8f3'),     // testeira, portas traseiras, teto
  lateral: new THREE.Color('#f8f7f4'),
  /* NEUTRO e com ganho: a carcaça tem textura própria que escurece a cor
     aplicada (saía ~152 contra ~220 da porta). A fibra da testeira é quente; o
     Thermo King é branco neutro. Cor linear > 1 = compensa a textura. */
  tk: new THREE.Color().setRGB(1, 1, 1).multiplyScalar(Number(arg('tk-ganho', '2.1'))),
};
const tintas = [];
M.cabGroup.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of [].concat(o.material)) if (m && /plain_grey/i.test(m.name || '')) tintas.push(m);
});
/* ⚠️ A LATARIA DA CABINE É A DEMÃO DO ESTÚDIO (`S.paint`, um shader próprio),
   não o `material.color` dos `*_plain_grey` — trocar só a cor do material
   deixava a porta em 201,200,197 (neutro) com o creme pedido. A porta certa é
   a mesma do seletor de cor: `setPaint({ finish, color })`. */
const pintaCabine = () => {
  try {
    S.paint.setPaint({ finish: 'solid', color: '#' + COR.cabine.getHexString(THREE.SRGBColorSpace), flakeColor: null, pearlFlip: null });
  } catch (e) { out.push(['pintura-erro', String(e)]); }
};
pintaCabine();
const tinge = () => { for (const m of tintas) m.color.copy(COR.cabine); };
tinge();
let corpo = 0;
{
  const vN = new THREE.Vector3();
  const feitos = new Map();
  M.trailerGroup.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.normal) return;
    const mats = [].concat(o.material);
    if (mats.some((m) => m && /tk-housing-white/i.test(m.name || ''))) {
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => (/tk-housing-white/i.test(m?.name || '') ? Object.assign(m.clone(), { color: COR.tk.clone() }) : m))
        : Object.assign(o.material.clone(), { color: COR.tk.clone() });
      return;
    }
    if (!mats.some((m) => m && /Cor_padrao_branco|metalBranco/i.test(m.name || ''))) return;
    const g = o.geometry.clone();
    const nor = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    const cor = new Float32Array(nor.count * 3);
    for (let i = 0; i < nor.count; i++) {
      vN.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      const c = Math.abs(vN.x) > 0.7 ? COR.lateral : COR.faces;
      cor[i * 3] = c.r; cor[i * 3 + 1] = c.g; cor[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    o.geometry = g;
    o.material = Array.isArray(o.material) ? o.material.map((m) => {
      if (!m || !/Cor_padrao_branco|metalBranco/i.test(m.name || '')) return m;
      if (!feitos.has(m)) { const c = m.clone(); c.vertexColors = true; c.color.set(0xffffff); feitos.set(m, c); }
      return feitos.get(m);
    }) : (() => {
      const m = o.material;
      if (!feitos.has(m)) { const c = m.clone(); c.vertexColors = true; c.color.set(0xffffff); feitos.set(m, c); }
      return feitos.get(m);
    })();
    corpo++;
  });
}
out.push(['cores', { tintasCabine: tintas.length, malhasCorpo: corpo }]);
/* TUDO QUE É QUADRO VIRA GALVANIZADO (pedido do dono, 28/09). Medido por
   raio na própria vista: os montantes de canto e o quadro da traseira são
   `metal-estrutura-principal-padrao` (metal de rugosidade 1: sem ambiente
   forte ele só escurece), a moldura larga em volta das portas é
   `borracha-preta`, e a ferragem é `inox-ferragem*`. O de referência — os
   perfis de cima e de baixo, que ficaram bons — é `metal-galvanizado-mantido`. */
let galv = null;
M.trailerGroup.traverse((o) => {
  if (galv || !o.isMesh) return;
  for (const m of [].concat(o.material)) if (m && m.name === 'metal-galvanizado-mantido') { galv = m; break; }
});
let trocados = 0;
if (galv && arg('galvaniza', 'on') === 'on') {
  /* SÓ O QUADRO. A borracha da porta fica preta e a ferragem fica inox (com o
     ganho de reflexo de `INOX_K`, mais clara que o galvanizado): na rodada que
     trocou as cinco famílias a traseira virou um cinza só — borracha, quadro e
     dobradiça iguais. */
  const RE = /^metal-estrutura-principal-padrao/;
  M.trailerGroup.traverse((o) => {
    if (!o.isMesh) return;
    const troca = (m) => (m && RE.test(m.name || '') ? (trocados++, galv) : m);
    o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
  });
}
out.push(['galvanizado', { referencia: !!galv, trocados }]);
let inox = 0;
{
  const vistos = new Set();
  for (const r of [M.cabGroup, M.trailerGroup]) r.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || vistos.has(m)) continue;
      const n = m.name || '';
      if (/inox|chrome|cromo|pouco-polido|aro-rodas/i.test(n) && !/galvaniz|estrutura-principal/i.test(n)) {
        m.envMapIntensity = INOX_K; vistos.add(m); inox++;
      }
    }
  });
}
out.push(['inox', inox]);

/* ---------- 3 · luz neutra e ambiente liso ---------- */
const tetoEstudio = S.scene.getObjectByName('ts-teto');
if (tetoEstudio) tetoEstudio.visible = false;
const luzesRig = [];
S.scene.traverse((o) => { if (o.isLight) luzesRig.push(o); });
const apaga = () => { for (const l of luzesRig) { l.intensity = 0; l.castShadow = false; } };
apaga();

const bxVeic = new THREE.Box3().setFromObject(M.cabGroup).union(new THREE.Box3().setFromObject(M.trailerGroup));
const C = bxVeic.getCenter(new THREE.Vector3());
/* ⚠️ CADA LUZ DIRETO NA CENA, nunca num Group: no recorte transparente
   `isolateVehicle()` (scene/capture.ts) esconde todo filho da cena que não
   seja luz nem o RIG. Um Group de luzes some na hora da foto e o render sai só
   com o mapa de ambiente — foi o que deu média 94,4 com `--luz` 0 e com 5. */
const nossas = { add: (o) => S.scene.add(o) };
/* LUZ NEUTRA (branca): o tom quente mora na COR das superfícies (2b), não na
   luz — luz amarela tingiria a lateral junto, e ela tem de ler mais cinza. */
const QUENTE = 0xffffff, CEU = 0xffffff, CHAO = 0xd0d0d0;
nossas.add(new THREE.HemisphereLight(CEU, CHAO, CEU_K * LUZ));
const diagonais = [];
for (const az of [45, 135, 225, 315]) {
  const a = az * Math.PI / 180, el = ELEV * Math.PI / 180;
  /* az 0 = +Z; a frente do conjunto é −Z (frenteZ −1), então 135/225 são as da frente */
  const daFrente = Math.cos(a) * (new THREE.Box3().setFromObject(M.cabGroup).getCenter(new THREE.Vector3()).z - C.z) > 0;
  const d = new THREE.DirectionalLight(QUENTE, DIR_K * LUZ * (daFrente ? 1 : TRAS_K));
  d.position.set(C.x + Math.sin(a) * Math.cos(el) * 60, C.y + Math.sin(el) * 60, C.z + Math.cos(a) * Math.cos(el) * 60);
  d.target.position.copy(C);
  d.castShadow = false;
  nossas.add(d); nossas.add(d.target);
  diagonais.push([d, d.intensity]);
}
/* LUZ DE LATERAL, relativa à CÂMERA (e por isso espelhada de um lado para o
   outro): uma principal do lado da câmera puxada para a frente e alta, e um
   preenchimento fraco puxado para trás. Com as quatro diagonais iguais a face
   que olha para a frente e a que olha para trás recebiam a mesma luz, e a
   cabine perdia toda a modelagem — o "sem sombra" comparado ao exemplo. */
const KEY_K = Number(arg('key', '2.95')), FILL_K = Number(arg('fill', '0.3'));
const chave = new THREE.DirectionalLight(0xffffff, 0), preenche = new THREE.DirectionalLight(0xffffff, 0);
for (const l of [chave, preenche]) { l.castShadow = false; nossas.add(l); nossas.add(l.target); }
function luzDaVista(lateral, dirCam) {
  for (const [d, i] of diagonais) d.intensity = lateral ? 0 : i;
  chave.intensity = lateral ? KEY_K * LUZ : 0;
  preenche.intensity = lateral ? FILL_K * LUZ : 0;
  if (!lateral) return;
  const frente = new THREE.Vector3(0, 0, frenteZ), up = new THREE.Vector3(0, 1, 0);
  const pos = (aFrente, elev) => {
    const a = aFrente * Math.PI / 180, e = elev * Math.PI / 180;
    return new THREE.Vector3().addScaledVector(dirCam, Math.cos(a) * Math.cos(e))
      .addScaledVector(frente, Math.sin(a) * Math.cos(e)).addScaledVector(up, Math.sin(e)).multiplyScalar(60).add(C);
  };
  chave.position.copy(pos(Number(arg('key-az', '38')), Number(arg('key-el', '50'))));
  preenche.position.copy(pos(-50, 15));
  for (const l of [chave, preenche]) { l.target.position.copy(C); l.target.updateMatrixWorld(); }
}

const cenaAmb = new THREE.Scene();
{
  const geo = new THREE.SphereGeometry(50, 64, 32);
  const cor = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) / 50 + 1) / 2));
    const v = 0.50 + 0.40 * Math.pow(t, 0.8);
    cor.push(v, v, v);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  cenaAmb.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
}
const ambNeutro = new THREE.PMREMGenerator(S.renderer).fromScene(cenaAmb, 0.04).texture;
const ambiente = () => {
  S.scene.environment = ambNeutro;
  if ('environmentIntensity' in S.scene) S.scene.environmentIntensity = AMB_K * LUZ;
  if (S.scene.environmentRotation) S.scene.environmentRotation.set(0, 0, 0);
};
ambiente();
for (let i = 0; i < 20; i++) await B.frame();

{
  const bt = M.tk ? new THREE.Box3().setFromObject(M.tk, true) : null;
  let frente = null;
  M.trailer.traverse((o) => { if (o.isMesh && o.name === 'FRONT') frente = new THREE.Box3().setFromObject(o, true); });
  const corpo = new THREE.Box3().setFromObject(M.trailer, true);
  out.push(['tk-posicao', bt && { tkZ: [+bt.min.z.toFixed(3), +bt.max.z.toFixed(3)], tkY: [+bt.min.y.toFixed(3), +bt.max.y.toFixed(3)],
    frenteZ: frente && [+frente.min.z.toFixed(3), +frente.max.z.toFixed(3)], corpoZ: [+corpo.min.z.toFixed(3), +corpo.max.z.toFixed(3)],
    tkDepth: M.tkDepth, mountOff: M.tkMountOffZ, tkParent: M.tk?.parent?.name || M.tk?.parent?.type }]);
}
/* ---------- 3b · o Thermo King mais rente ----------
   A unidade vem encostada na testeira (traseira dela em z = face da parede) e
   avança os 0,451 m reais do SLX. No exemplo do dono ela avança ~0,22 m, e a
   0,45 m ela "fica longe da frente". Recua para dentro da parede — a frontal
   não muda, só a espessura que aparece nas laterais. */
/* alvo: a unidade avança ~0,25 m (o exemplo). O recuo sai da profundidade
   medida — 0,451 no SLX do semirreboque → 0,20; o P360 do rígido é outro. */
const TK_SALIENCIA = Number(arg('tk-saliencia', '0.25'));
/* no RÍGIDO o P360 fica sobre a cabine e recuar o enterra no baú — zero. */
const TK_RECUO = arg('tk-recuo', null) !== null ? Number(arg('tk-recuo')) : (RIGIDO ? 0 : Math.max(0, (M.tkDepth || 0) - TK_SALIENCIA));
let tkNoLugar = () => {};
if (M.tk && TK_RECUO > 0) {
  const t = M.tk;
  t.updateMatrixWorld(true);
  const w = t.matrixWorld.clone();
  const passo = new THREE.Matrix4().makeTranslation(0, 0, -frenteZTk() * TK_RECUO);
  const local = new THREE.Matrix4().copy(t.parent.matrixWorld).invert().multiply(passo.multiply(w));
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Vector3();
  local.decompose(P, Q, E);
  tkNoLugar = () => { t.position.copy(P); t.quaternion.copy(Q); t.scale.copy(E); t.matrix.compose(P, Q, E); t.matrixWorldNeedsUpdate = true; t.updateMatrixWorld(true); };
  tkNoLugar();
  out.push(['tk-recuo', { m: TK_RECUO, z: new THREE.Box3().setFromObject(t, true).min.z.toFixed(3) }]);
}
function frenteZTk() {
  const cz = new THREE.Box3().setFromObject(M.cabGroup).getCenter(new THREE.Vector3()).z;
  const tz = new THREE.Box3().setFromObject(M.trailer).getCenter(new THREE.Vector3()).z;
  return Math.sign(cz - tz) || 1;
}

/* ---------- 4 · o enquadramento comum ---------- */
S.controls.minDistance = 0.01; S.controls.maxDistance = 1e6;
S.controls.enabled = false; S.controls.update = () => false;

function visivel(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
const caixa = new THREE.Box3();
for (const r of [M.cabGroup, M.trailerGroup]) r.traverse((o) => {
  if (o.isMesh && visivel(o)) caixa.union(new THREE.Box3().setFromObject(o, true));
});
const bxCab = new THREE.Box3().setFromObject(M.cabGroup);
const frenteZ = Math.sign(bxCab.getCenter(new THREE.Vector3()).z - caixa.getCenter(new THREE.Vector3()).z) || 1;
const direitaX = -frenteZ;   // frente em +Z → a direita do motorista é −X
const MARGEM = 0.25;
const y0 = Math.min(0, caixa.min.y) - 0.05, y1 = caixa.max.y + MARGEM;
const alturaM = y1 - y0, yc = (y0 + y1) / 2;
const cx = (caixa.min.x + caixa.max.x) / 2, cz = (caixa.min.z + caixa.max.z) / 2;
const largLado = (caixa.max.z - caixa.min.z) + 2 * MARGEM;
const largFace = (caixa.max.x - caixa.min.x) + 2 * MARGEM;
out.push(['caixa', { min: caixa.min.toArray().map((n) => +n.toFixed(3)), max: caixa.max.toArray().map((n) => +n.toFixed(3)), frenteZ }]);

const FOV = 0.4;
const cam = S.camera;
function vista(dir, largura) {
  const D = (alturaM / 2) / Math.tan(FOV * Math.PI / 360);
  cam.fov = FOV;
  cam.aspect = largura / alturaM;
  cam.near = D - 40; cam.far = D + 40;
  cam.position.set(cx + dir.x * D, yc, cz + dir.z * D);
  cam.up.set(0, 1, 0);
  cam.lookAt(cx, yc, cz);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return { D: +D.toFixed(1), larguraM: +largura.toFixed(3), alturaM: +alturaM.toFixed(3) };
}
const VISTAS_DEF = {
  'lateral-esquerda': { dir: new THREE.Vector3(-direitaX, 0, 0), larg: largLado },
  'lateral-direita': { dir: new THREE.Vector3(direitaX, 0, 0), larg: largLado },
  frontal: { dir: new THREE.Vector3(0, 0, frenteZ), larg: largFace },
  traseira: { dir: new THREE.Vector3(0, 0, -frenteZ), larg: largFace },
};
const QUAIS = VISTAS === 'lados' ? ['lateral-esquerda', 'lateral-direita']
  : VISTAS === 'frente-tras' ? ['traseira', 'frontal'] : VISTAS.split(',');

/* FRONTAL E TRASEIRA SÓ COM O IMPLEMENTO: a cabine entra apenas nas laterais.
   O quadro vertical continua o comum (mesmo chão, mesmo topo) para o PDF. */
const semCabine = (nome) => !RIGIDO && (nome === 'frontal' || nome === 'traseira');
/* RÍGIDO nas faces: cabine e chassi são UM grupo. Some o que está à frente da
   testeira e acima de 1,25 m (a cabine); fica o que é chassi — longarina, roda,
   para-choque, para-lama. */
const cabineDoRigido = [];
if (RIGIDO) {
  const bi = new THREE.Box3().setFromObject(M.trailer, true);
  const zTest = frenteZ < 0 ? bi.min.z : bi.max.z;
  M.cabGroup.traverse((o) => {
    if (!o.isMesh) return;
    const c = new THREE.Box3().setFromObject(o, true).getCenter(new THREE.Vector3());
    /* por NOME, não por altura: com corte em 1,25 m sobravam grade, farol e
       para-choque da cabine. Chassi = `chassis*` + rodas; o resto à frente da
       testeira é cabine. */
    if ((c.z - zTest) * frenteZ > 0 && !/^(chassis|wheel_)/i.test(o.name || '')) cabineDoRigido.push(o);
  });
  out.push(['cabine-do-rigido', cabineDoRigido.length]);
  if (arg('diag-paralama', null)) {
    const l = [];
    M.cabGroup.traverse((o) => { if (o.isMesh && /paralama|fender|mudguard/i.test(o.name + ' ' + [].concat(o.material).map((m) => m?.name).join(','))) {
      const b = new THREE.Box3().setFromObject(o, true);
      l.push(`${o.name} | ${[].concat(o.material).map((m) => m?.name).join(',')} | z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)} x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}`);
    } });
    out.push(['paralamas', l, zTest]);
  }
  if (arg('diag', null)) {
    const nomes = new Map();
    M.cabGroup.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o, true), c = b.getCenter(new THREE.Vector3());
      if ((c.z - zTest) * frenteZ <= 0) return;
      const k = (o.name || '?').replace(/_p\d+.*$/, '').replace(/\d+$/, '');
      const e = nomes.get(k) || { n: 0, y0: 9, y1: -9 }; e.n++; e.y0 = Math.min(e.y0, b.min.y); e.y1 = Math.max(e.y1, b.max.y); nomes.set(k, e);
    });
    out.push(['frente-grupos', [...nomes.entries()].map(([k, e]) => `${k} n${e.n} y${e.y0.toFixed(2)}-${e.y1.toFixed(2)}`)]);
  }
}
/* CORTE SECO (pedido do dono, 28/09): esconder peça por peça deixava a
   frente do chassi "estranha" (radiador e motor soltos). Nas faces do rígido um
   PLANO DE CORTE na testeira corta cabine e chassi rente — só nos materiais do
   grupo da cabine, então o Thermo King (do implemento) fica inteiro. */
const cortePlano = new THREE.Plane();
const materiaisCabine = new Set();
if (RIGIDO) {
  /* a face da TESTEIRA (malha FRONT), não a caixa do implemento: o
     sobrechassi avança sob a cabine e a caixa punha o corte no meio dela */
  let bi = null;
  M.trailer.traverse((o) => { if (!bi && o.isMesh && o.name === 'FRONT') bi = new THREE.Box3().setFromObject(o, true); });
  if (!bi) bi = new THREE.Box3().setFromObject(M.trailer, true);
  const zTest = frenteZ < 0 ? bi.min.z : bi.max.z;
  out.push(['corte-z', +zTest.toFixed(3)]);
  /* mantém o lado de TRÁS da testeira: normal apontando para a traseira */
  cortePlano.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, -frenteZ), new THREE.Vector3(0, 0, zTest + (-frenteZ) * Number(arg('corte-folga', '0.005'))));
  M.cabGroup.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) materiaisCabine.add(m); });
  S.renderer.localClippingEnabled = true;
}
/* PARA-LAMA DO 2º EIXO DIRECIONAL (bitruck, `t_paralama_*`) em PRETO
   (pedido do dono): a peça pintada saía branca como a cabine. */
const pretoParalama = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.45, metalness: 0 });
let paralamasPretos = 0;
M.cabGroup.traverse((o) => {
  if (!o.isMesh || !/^t_paralama/i.test(o.name || '')) return;
  const troca = (m) => (m && /pintura|plastic_hard/i.test(m.name || '') ? (paralamasPretos++, pretoParalama) : m);
  o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
});
out.push(['paralama-2-eixo-preto', paralamasPretos]);
const mostraCabineRigido = (sim) => {
  for (const m of materiaisCabine) { m.clippingPlanes = sim ? null : [cortePlano]; m.clipShadows = false; m.needsUpdate = true; }
};
/* --anim i0,i1,N: quadros i0..i1-1 de N do vídeo ORTOGRÁFICO → 3D.
   Dolly-zoom: a largura do quadro no plano do centro fica FIXA enquanto a lente
   abre de 0,4° a 38° (em escala log, que é como o olho lê a perspectiva
   surgindo) e a câmera se aproxima na mesma medida; junto, o azimute gira da
   lateral para um 3/4 dianteiro e o olho sobe um pouco. Quadro 0 = a lateral
   ortográfica que está no PNG. */
const ANIM = arg('anim', null);
if (ANIM) {
  const [i0, i1, N] = ANIM.split(',').map(Number);
  const ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const HOLD0 = 0.16, HOLD1 = 0.12;                    // fração parada no começo e no fim
  const LARG = largLado * 1.02, ASP = 16 / 9;
  const lateralDir = new THREE.Vector3(-direitaX, 0, 0); // motorista
  const frenteDir = new THREE.Vector3(0, 0, frenteZ);
  mostraCabineRigido(true); M.cabGroup.visible = true;
  for (let k = i0; k < i1; k++) {
    const u = ease((k / (N - 1) - HOLD0) / (1 - HOLD0 - HOLD1));
    const fov = Math.exp(Math.log(0.4) + (Math.log(38) - Math.log(0.4)) * u);   // vertical
    const az = (1 - u) * 90 + u * 38;                                             // graus a partir da frente
    const a = az * Math.PI / 180;
    const dir = new THREE.Vector3().addScaledVector(frenteDir, Math.cos(a)).addScaledVector(lateralDir, Math.sin(a));
    const alvo = new THREE.Vector3(cx, yc, cz);
    const hf = (LARG / ASP);                                                      // altura do quadro no alvo
    const D = (hf / 2) / Math.tan(fov * Math.PI / 360) * (1 + 0.12 * u);          // um respiro no 3D
    const eye = yc + u * 0.6;
    cam.fov = fov; cam.aspect = ASP;
    cam.near = Math.max(0.05, D - 40); cam.far = D + 40;
    cam.position.copy(alvo).addScaledVector(dir, D); cam.position.y = eye + (yc - yc);
    cam.up.set(0, 1, 0); cam.lookAt(alvo); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    for (let f = 0; f < 3; f++) await B.frame();
    apaga(); ambiente(); tinge(); nivel?.aplica(); tkNoLugar();
    cam.fov = fov; cam.aspect = ASP; cam.near = Math.max(0.05, D - 40); cam.far = D + 40;
    cam.position.copy(alvo).addScaledVector(dir, D); cam.position.y = eye; cam.lookAt(alvo);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    luzDaVista(true, dir);
    if (!expoBase) expoBase = S.renderer.toneMappingExposure;
    S.renderer.toneMappingExposure = expoBase * EXPO;
    const TM = TOM === 'linear' ? THREE.LinearToneMapping : THREE.NeutralToneMapping;
    if (S.renderer.toneMapping !== TM) { S.renderer.toneMapping = TM; S.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) if (m) m.needsUpdate = true; }); }
    const cap = await B.captureViewport({ quality: 'medium', background: 'recorte' });
    const bmp = await createImageBitmap(cap.blob);
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, 1920, 1080);
    bmp.close();
    out.push([`anim-${String(k).padStart(4, '0')}`, cv.toDataURL('image/webp', 0.9)]);
    cv.width = 1; cv.height = 1;
  }
  return out;
}

/* --sonda: dispara raios nos pontos (NDC) de cada vista e diz malha/material */
const SONDA = arg('sonda', null);
if (SONDA) {
  const rc = new THREE.Raycaster();
  const alvos = [];
  for (const r of [M.cabGroup, M.trailerGroup]) r.traverse((o) => { if (o.isMesh && visivel(o)) alvos.push(o); });
  for (const nome of QUAIS) {
    const def = VISTAS_DEF[nome];
    M.cabGroup.visible = !(!RIGIDO && (nome === 'frontal' || nome === 'traseira'));
    mostraCabineRigido(!(RIGIDO && (nome === 'frontal' || nome === 'traseira')));
    vista(def.dir, def.larg);
    const res = [];
    for (const par of SONDA.split(';')) {
      const [x, y] = par.split(',').map(Number);           // pixel normalizado 0..1 (y de cima)
      rc.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), cam);
      rc.near = cam.near; rc.far = cam.far;
      const hit = rc.intersectObjects(alvos.filter((o) => visivel(o)), false)[0];
      res.push(hit ? `${par} → ${hit.object.name} | ${[].concat(hit.object.material)[hit.face?.materialIndex ?? 0]?.name || [].concat(hit.object.material)[0]?.name}` : `${par} → nada`);
    }
    out.push([`sonda-${nome}`, res]);
  }
  return out;
}

for (const nome of QUAIS) {
  const def = VISTAS_DEF[nome];
  M.cabGroup.visible = !semCabine(nome);
  mostraCabineRigido(!(RIGIDO && (nome === 'frontal' || nome === 'traseira')));
  const info = vista(def.dir, def.larg);
  for (let i = 0; i < 12; i++) await B.frame();
  apaga(); ambiente(); tinge(); nivel?.aplica(); tkNoLugar(); vista(def.dir, def.larg);
  luzDaVista(nome.startsWith('lateral'), def.dir);
  /* EXPOSIÇÃO: o ACES do estúdio comprime o alto — subir só as luzes levava a
     lateral de 182 a 190 com 23 % mais luz. A exposição do tone mapping é que
     levanta o branco sem estourar (o ACES encosta em 255 assintoticamente). */
  if (!expoBase) expoBase = S.renderer.toneMappingExposure;
  S.renderer.toneMappingExposure = expoBase * EXPO;
  /* ⚠️ NEUTRAL, NÃO ACES. O ACES do estúdio é o motivo do "lavado": ele
     dessatura o alto e tem teto em ~241 — o creme da cabine voltava neutro
     (porta 203,202,200 com albedo #fbf6e8) e subir a exposição só achatava as
     curvas contra esse teto. O Neutral (Khronos PBR) preserva matiz e
     saturação e deixa o branco chegar a branco. */
  const TM = TOM === 'linear' ? THREE.LinearToneMapping : THREE.NeutralToneMapping;
  if (S.renderer.toneMapping !== TM) {
    S.renderer.toneMapping = TM;
    S.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) if (m) m.needsUpdate = true; });
  }   // o rig reacende a cada quadro
  /* SUPERAMOSTRAGEM 2×: o preset "alta" é esticado (lateral 15360, faces
     7680) e a imagem é reduzida à metade — 4 amostras por pixel POR CIMA do
     MSAA 4× do estúdio. Lateral sai 7680; face sai 3840 de altura (ainda o
     dobro de px/m da lateral). */
  const pres = S.capture.CAPTURE_PRESETS?.high;
  const edge0 = pres?.edge, tiles0 = pres?.tiles;
  const lateral = !semCabine(nome);
  if (pres && arg('qualidade', 'high') === 'high') { pres.edge = lateral ? 15360 : 7680; pres.tiles = lateral ? 8 : 4; }
  const cap = await B.captureViewport({ quality: arg('qualidade', 'high'), background: 'recorte' });
  if (pres) { pres.edge = edge0; pres.tiles = tiles0; }
  const bmp = await createImageBitmap(cap.blob);
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width / 2); cv.height = Math.round(bmp.height / 2);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  /* o branco da cabine: fração de pixel do veículo que bate no teto (≥ 250) */
  const dados = g.getImageData(0, 0, cv.width, cv.height).data;
  let tot = 0, est = 0, soma = 0;
  for (let i = 0; i < dados.length; i += 16) {
    if (dados[i + 3] < 200) continue;
    const l = 0.2126 * dados[i] + 0.7152 * dados[i + 1] + 0.0722 * dados[i + 2];
    tot++; soma += l; if (l >= 250) est++;
  }
  out.push([`${nome}-info`, { ...info, px: [cv.width, cv.height], pxPorM: +(cv.width / def.larg).toFixed(1),
    expo: +S.renderer.toneMappingExposure.toFixed(3), lumMedia: +(soma / tot).toFixed(1), estouro: +(est / tot * 100).toFixed(2) }]);
  const url = cv.toDataURL('image/png');
  bmp.close(); cv.width = 1; cv.height = 1;
  out.push([`orto-${nome}`, url]);
}
return out;
