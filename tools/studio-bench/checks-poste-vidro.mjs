/* SONDA DO VIDRO DA LUMINÁRIA — onde ele está contra onde a luminária está.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-poste-vidro.mjs

   O RELATO: *"a luz do poste, a posicao dela, oque seria o vidro, nao esta batendo
   corretamente como deveria, a angulacao"*.

   POR QUE UMA SONDA E NÃO UMA TRAVA. Há pelo menos quatro causas possíveis e elas
   só se separam medindo:

     a) o vidro está no lugar certo mas com YAW errado (a conta de `rotation.y` em
        `rebuildSiteLenses()` não é a mesma de `placeLamp()`);
     b) o `outreach` medido é a MÉDIA dos vértices além do corte, e a média inclui
        o tubo do braço — então o vidro nasceria alguns centímetros para dentro;
     c) o `lensY` é o MENOR y da região cortada, que pode ser o tubo e não a face
        de baixo da luminária;
     d) a luminária deste set é INCLINADA e o vidro é uma caixa horizontal.

   Então: mede-se a caixa de mundo da LUMINÁRIA (os vértices do mastro além de 60 %
   do alcance, que é o mesmo recorte que `medirLuminaria()` usa) e a caixa de mundo
   do VIDRO, e reporta-se a diferença de centro, de tamanho e de ângulo. */
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
const THREE = S.THREE;
const L = S.lighting;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const gr = (rad) => Math.round((rad * 180 / Math.PI) * 10) / 10;

L.setHourOfDay(21, { animate: false });
for (let i = 0; i < 8; i++) await B.frame();

/* ---------- os mastros e as luminárias deles ---------- */
const mastros = [];
S.scene.traverse((o) => {
  if (o.isMesh && /^mast_/i.test(o.name || '')) mastros.push(o);
});
out.push(['mastros na cena', mastros.length]);

/** A caixa de MUNDO da luminária: vértices além de 60 % do alcance do braço. */
function caixaLuminaria(mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.getAttribute('position');
  if (!bb || !pos) return null;
  const ax = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
  const az = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
  const eixoX = ax >= az;
  const alcanceMax = eixoX ? bb.max.x : bb.max.z;
  if (alcanceMax < 0.5) return null;
  const corte = alcanceMax * 0.6;
  const cx = new THREE.Box3();
  cx.makeEmpty();
  const v = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const a = eixoX ? pos.getX(i) : pos.getZ(i);
    if (a < corte) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    cx.expandByPoint(v);
    n++;
  }
  return n ? { cx, eixoX, n, alcanceMax, corte } : null;
}

/* ---------- os vidros ---------- */
const grupo = [];
S.scene.traverse((o) => { if (o.name === 'ts-lamp-site-lenses') grupo.push(o); });
const vidros = grupo.length ? grupo[0].children.slice() : [];
out.push(['vidros de cenário', vidros.length]);

const info = L.getEnvironmentObjects ? L.getEnvironmentObjects() : null;
if (info && info.lampSiteGeo) {
  out.push(['geometria medida do set', JSON.stringify(info.lampSiteGeo)]);
}

const cxV = new THREE.Box3();
const cV = new THREE.Vector3(), cM = new THREE.Vector3();
const tamV = new THREE.Vector3(), tamM = new THREE.Vector3();
const eixo = new THREE.Vector3();

out.push(['— por poste: luminária × vidro —', '']);
let piorDist = 0, piorAng = 0;
for (const vidro of vidros) {
  vidro.updateMatrixWorld(true);
  cxV.setFromObject(vidro);
  cxV.getCenter(cV);
  cxV.getSize(tamV);

  /* O mastro dono é o mais próximo em planta do EIXO, não do vidro: o braço
     desloca o vidro ~2 m e as torres estão a 27 m uma da outra. */
  let dono = null, d2 = Infinity;
  for (const m of mastros) {
    const p = new THREE.Vector3();
    m.getWorldPosition(p);
    const d = (p.x - cV.x) ** 2 + (p.z - cV.z) ** 2;
    if (d < d2) { d2 = d; dono = m; }
  }
  if (!dono) continue;
  const lum = caixaLuminaria(dono);
  if (!lum) continue;
  lum.cx.getCenter(cM);
  lum.cx.getSize(tamM);

  const pm = new THREE.Vector3();
  dono.getWorldPosition(pm);
  /* O eixo do braço em MUNDO, do jeito que scenery.ts o calcula. */
  eixo.set(lum.eixoX ? 1 : 0, 0, lum.eixoX ? 0 : 1)
    .transformDirection(dono.matrixWorld).setY(0).normalize();

  /* O ângulo que o VIDRO tem, contra o que o BRAÇO tem. `rotation.y` do vidro põe
     o +X local dele em (cos, 0, −sin). */
  const yaw = vidro.rotation.y;
  const dirVidro = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const cosAng = Math.max(-1, Math.min(1, dirVidro.dot(eixo)));
  const ang = Math.acos(Math.abs(cosAng));       // sem sinal: eixo, não seta

  const dxz = Math.hypot(cV.x - cM.x, cV.z - cM.z);
  const dy = cV.y - cM.y;
  piorDist = Math.max(piorDist, dxz);
  piorAng = Math.max(piorAng, ang);

  out.push([`  ${dono.name}`,
    `mastro (${r2(pm.x)}, ${r2(pm.z)}) · braço (${r2(eixo.x)}, ${r2(eixo.z)})`
    + ` · luminária c(${r2(cM.x)}, ${r2(cM.y)}, ${r2(cM.z)}) tam(${r2(tamM.x)}, ${r2(tamM.y)}, ${r2(tamM.z)})`
    + ` · vidro c(${r2(cV.x)}, ${r2(cV.y)}, ${r2(cV.z)}) tam(${r2(tamV.x)}, ${r2(tamV.y)}, ${r2(tamV.z)})`
    + ` · yaw ${gr(yaw)}° · desvio planta ${r3(dxz)} m · Δy ${r3(dy)} m`
    + ` · ângulo vidro×braço ${gr(ang)}°`]);
}
out.push(['pior desvio em planta (m)', r3(piorDist)]);
out.push(['pior ângulo vidro × braço (°)', gr(piorAng)]);
/* 0,05 m e não 0,25: depois do conserto o desvio medido é 0,001 m nos onze
   postes, então a trava pode ser apertada até o ponto em que ela volta a pegar a
   regressão que a motivou (a MÉDIA dos vértices, que dava 0,093 m). */
out.push(['o vidro fica DENTRO da planta da luminária', piorDist < 0.05]);
out.push(['o vidro está alinhado com o braço (< 5°)', gr(piorAng) < 5]);
/* A INCLINAÇÃO. A carcaça deste set é uma cunha de 11,3° e o vidro tem de
   acompanhá-la — um vidro horizontal encosta numa ponta e fica 17 cm no ar na
   outra, que é o relato que abriu esta sonda. A trava lê a caixa: um retângulo de
   0,77 m inclinado 11,3° tem 0,15 m de altura, um horizontal tem 0,04. */
{
  const alturas = [];
  for (const vidro of vidros) {
    cxV.setFromObject(vidro);
    cxV.getSize(tamV);
    alturas.push(tamV.y);
  }
  const menor = Math.min(...alturas);
  out.push(['altura da caixa do vidro (m)', r3(menor)]);
  out.push(['o vidro acompanha a inclinação da luminária', menor > 0.08]);
}

/* ---------- O PERFIL DA LUMINÁRIA, em faixas de altura ----------
   A pergunta que isto responde: a face de baixo é um retângulo (tronco de
   pirâmide) ou a luminária é INCLINADA? A primeira tentativa de medir só o
   quinto de baixo devolveu 0,21 m de comprimento contra 0,87 do conjunto, o que
   só faz sentido se o pedaço mais baixo for uma sobra e não a face. */
{
  const dono = mastros.find((m) => /mast_m_2$/.test(m.name || '')) || mastros[0];
  const lum = dono && caixaLuminaria(dono);
  if (dono && lum) {
    const geo = dono.geometry;
    const pos = geo.getAttribute('position');
    const bb = geo.boundingBox;
    const eixoX = lum.eixoX;
    const alcanceMax = eixoX ? bb.max.x : bb.max.z;
    const corte = alcanceMax * 0.6;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const a = eixoX ? pos.getX(i) : pos.getZ(i);
      if (a < corte) continue;
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    out.push(['— perfil da luminária (local, ' + dono.name + ') —',
      `corte a ≥ ${r3(corte)} · y ${r3(minY)}…${r3(maxY)}`]);
    const NF = 10;
    for (let f = 0; f < NF; f++) {
      const y0 = minY + (maxY - minY) * (f / NF);
      const y1 = minY + (maxY - minY) * ((f + 1) / NF);
      let n = 0, aMin = Infinity, aMax = -Infinity, tMin = Infinity, tMax = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const a = eixoX ? pos.getX(i) : pos.getZ(i);
        const y = pos.getY(i);
        if (a < corte || y < y0 || y > y1) continue;
        const t = eixoX ? pos.getZ(i) : pos.getX(i);
        n++;
        if (a < aMin) aMin = a;
        if (a > aMax) aMax = a;
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
      }
      out.push([`  faixa ${f} (y ${r3(y0)}…${r3(y1)})`,
        n ? `${n} v · a ${r3(aMin)}…${r3(aMax)} (${r3(aMax - aMin)}) · t ${r3(tMin)}…${r3(tMax)} (${r3(tMax - tMin)})`
          : 'vazia']);
    }
  }
}

/* ---------- e a foto, de perto ---------- */
/* O MAIS PRÓXIMO DA ORIGEM, e não o do meio da lista: a lista vem ordenada por z
   ao longo de 272 m de rua, então o "do meio" caía a 66 m do veículo. */
let alvo = null, dAlvo = Infinity;
for (const v of vidros) {
  const p = new THREE.Vector3();
  v.getWorldPosition(p);
  const d = p.x * p.x + p.z * p.z;
  if (d < dAlvo) { dAlvo = d; alvo = v; }
}
/* ⚠️ NÃO DÁ PARA POSAR E DEPOIS RODAR QUADROS, e isto custou três rodadas desta
   sonda até ser medido em vez de deduzido. O laço do estúdio reancora a ÓRBITA no
   veículo a cada quadro — medido: `controls.target` volta para (0,33, 2,30, 5,88)
   e `maxDistance` vale 43,4 m —, e `OrbitControls.update()` roda no laço sem
   consultar `enabled` (na r179 o `enabled` só governa os manipuladores de evento).
   O resultado medido: um pedido de câmera em (9,53, 9,75, −65,8), a 72 m do
   veículo, virava (5,96, 6,90, −36,93) no quadro seguinte — o teto da órbita. Por
   isso as poses de `checks-noite.mjs` funcionam: todas ficam DENTRO da caixa de
   órbita do veículo, e a luminária do meio da rua não fica.

   A saída é a ordem: assentar a luz PRIMEIRO, posar por último e capturar sem um
   único quadro no meio — `captureViewport()` chama `stopLoop()` e renderiza com a
   câmera como ela está, então ninguém tem chance de reancorar. */
async function close(nome, olho, mira) {
  L.invalidate(6);
  for (let i = 0; i < 16; i++) await B.frame();
  S.controls.target.set(mira[0], mira[1], mira[2]);
  S.camera.position.set(olho[0], olho[1], olho[2]);
  S.camera.lookAt(mira[0], mira[1], mira[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([`  ${nome} câmera na captura`,
    [S.camera.position.x, S.camera.position.y, S.camera.position.z].map(r2).join(',')]);
  out.push([nome, await new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(res.blob);
  })]);
}
if (alvo) {
  const p = new THREE.Vector3();
  alvo.getWorldPosition(p);
  S.controls.enabled = false;
  /* DE LADO, na altura da luminária: é a vista que separa "o vidro está sob a
     luminária" de "o vidro está pendurado ao lado dela". 2,2 m de distância. */
  await close('p1_lado', [p.x, p.y + 0.05, p.z + 2.2], [p.x, p.y - 0.05, p.z]);
  /* DE BAIXO E DE LADO, que é como a câmera do estúdio vê um poste da rua. */
  await close('p2_debaixo', [p.x + 1.6, p.y - 1.9, p.z + 1.6], [p.x, p.y, p.z]);
  /* AO LONGO DO BRAÇO, olhando para o mastro: mostra a largura do vidro contra a
     largura da carcaça, que é a medida que `lensT` teria dado e não deu. */
  const dirM = new THREE.Vector3(p.x < 0 ? 1 : -1, 0, 0);
  await close('p3_ao_longo_do_braco',
    [p.x + dirM.x * 2.4, p.y + 0.25, p.z], [p.x - dirM.x * 0.5, p.y - 0.1, p.z]);
  S.controls.enabled = true;
}
return out;
