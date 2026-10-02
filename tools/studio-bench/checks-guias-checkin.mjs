/* GUIAS DE FOTO DE CHECK-IN / CHECK-OUT — renders de referência por veículo.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-guias-checkin.mjs --veiculo truck
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-guias-checkin.mjs --veiculo carreta-1550 --tk on

   Veículos (um por rodada — o retorno do CDP não aguenta mais de ~10 imagens):
     toco           Volvo VM 4x2, baú 7,50 m     lente 1×
     truck          Volvo VM 6x2, baú 8,50 m     lente 1×
     bitruck        Volvo VM 8x2, baú 9,50 m     lente 1×
     carreta-1450   só o implemento, 14,50 m     lente 0,5×
     carreta-1550   só o implemento, 15,50 m     lente 0,5×
   `--tk on|off` só vale para carreta (o rígido sai sempre sem unidade de frio).
   `--only <regex>` filtra as poses.

   A CÂMERA É UMA PESSOA DE 1,80 m. O olho fica a ~1,68 m e o celular é
   segurado um pouco abaixo dele: 1,60 m. A pose NÃO sobe a câmera para caber
   o veículo — ela se AFASTA. Para ver o teto a pessoa está EM CIMA do baú, 1 m
   para dentro da borda traseira, olhando para a frente, celular em pé.

   LENTES, no eixo LONGO do quadro (em retrato, o vertical):
     1×   26 mm equiv. → 68°      (a principal de todo celular)
     0,5× 13 mm equiv. → 106°     (a ultra-angular; carreta, pátio sem recuo)

   QUADRO 1600×900 / 900×1600 — o que o app grava (ver
   tools/checkin-guides/poses.mjs). Lateral e 3/4 deitados; frontal, traseira
   e teto em pé.

   CHAPA LISA: o friso é achatado na geometria (ver `alisaFriso`), não no
   desenho — o render é para ser lido como forma, e 46 listras por lateral
   brigam com o que a pessoa tem de alinhar. */
const out = [];
const B = window.__bench;
const ARGV = window.__benchArgv || [];
const arg = (n, d) => { const i = ARGV.indexOf('--' + n); return i >= 0 ? ARGV[i + 1] : d; };

const VEICULOS = {
  toco: { chassisId: '4x2r', bau: 7.50, lente: 68, rigido: true },
  truck: { chassisId: '6x2r', bau: 8.50, lente: 68, rigido: true },
  bitruck: { chassisId: '8x2r', bau: 9.50, lente: 68, rigido: true },
  'carreta-1450': { bau: 14.50, lente: 106, rigido: false },
  'carreta-1550': { bau: 15.50, lente: 106, rigido: false },
};
const NOME = arg('veiculo', 'truck');
const V = VEICULOS[NOME];
if (!V) return [['veiculo-desconhecido', false], ['validos', Object.keys(VEICULOS)]];
const TK = !V.rigido && arg('tk', 'off') === 'on';
const ONLY = arg('only', null);
const TAG = NOME + (V.rigido ? '' : TK ? '-com-tk' : '-sem-tk');

const CAM_Y = 1.60;
const LAND = { w: 1600, h: 900 };
const PORT = { w: 900, h: 1600 };

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

/* ---------- 1 · o veículo ---------- */
const escolha = V.rigido
  ? { manufacturerId: 'volvo', modelId: 'volvo-vm-2015', chassisId: V.chassisId }
  : { manufacturerId: 'volvo', modelId: 'fh-2024', chassisId: null };
if (!V.rigido) {
  /* qualquer cavalo serve — ele sai de cena; só o implemento importa */
  const mk = (S.catalog.catalog?.manufacturers || []).find((m) => m.id === 'volvo');
  const mo = (mk?.models || []).find((m) => !m.rigid && (m.chassis || []).some((c) => c.available !== false));
  escolha.modelId = mo.id;
  escolha.chassisId = mo.chassis.find((c) => c.available !== false).id;
}
await S.applyChoice({ envId: 'estudio', colorId: null, finishId: null, trim: null, ...escolha },
  { curtain: false });
if (V.rigido) await B.until(() => (M.cabDef?.file || '').includes('volvo_vm_2015_' + V.chassisId), 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
out.push(['escolha', { ...escolha, cab: M.cabDef?.file, implemento: M.implement?.id }]);

/* ---------- 2 · o baú na medida ---------- */
const antes = { ...S.trailerDims };
if (Math.abs((S.trailerDims?.length || 0) - V.bau) > 0.005) {
  await S.setTrailerDims({ length: V.bau, height: S.trailerDims.height });
  for (let i = 0; i < 30; i++) await B.frame();
}
out.push(['bau', { antes, depois: { ...S.trailerDims }, pedido: V.bau }]);

/* ---------- 3 · Thermo King ---------- */
try { S.trim.set('thermoking', { visible: TK }); } catch (e) { out.push(['tk-erro', String(e)]); }
for (let i = 0; i < 10; i++) await B.frame();
out.push(['tk', { pedido: TK, visivel: !!(M.tk && M.tk.visible) }]);

/* ---------- 4 · a frente do veículo, ANTES de esconder o cavalo ---------- */
const bxCab = new THREE.Box3().setFromObject(M.cabGroup);
const bxImp = new THREE.Box3().setFromObject(M.trailerGroup);
const frenteZ = Math.sign(bxCab.getCenter(new THREE.Vector3()).z - bxImp.getCenter(new THREE.Vector3()).z) || 1;
/* frente em +Z (frenteZ=1): Y para cima, a direita do motorista é −X. */
const direitaX = -frenteZ;
if (!V.rigido) S.models.setVehicleView('trailer');
for (let i = 0; i < 20; i++) await B.frame();

/* ---------- 5 · chapa lisa ---------- */
try { S.merge.release(); } catch { /* sem fusão ativa */ }
function alisaFriso() {
  const imp = new THREE.Box3().setFromObject(M.trailer);
  const L = imp.max.z - imp.min.z, H = imp.max.y - imp.min.y;
  const cx = (imp.min.x + imp.max.x) / 2;
  const v = new THREE.Vector3();
  /* candidatos: malhas longas e altas coladas numa das faces laterais */
  const cands = [];
  M.trailer.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    if (b.max.z - b.min.z < L * 0.6 || b.max.y - b.min.y < H * 0.35) return;
    cands.push({ o, b });
  });
  /* a crista é a face mais externa DE CHAPA — medida por lado sobre os
     candidatos, não sobre o implemento (ferragem sai para fora dela). */
  let meia = 0;
  for (const { b } of cands) meia = Math.max(meia, Math.min(Math.abs(b.max.x - cx), Math.abs(b.min.x - cx)) > 0.5
    ? Math.max(Math.abs(b.max.x - cx), Math.abs(b.min.x - cx)) : 0);
  /* 12 mm: o relevo do friso é 5,2 mm, mas a crista MEDIDA varia de asset para
     asset (1,3049 no sobrechassi, 1,3064 no semirreboque, onde o vale fica em
     1,2983) — com 7,5 mm o vale da carreta ficava de fora e as listras
     voltavam. */
  const faixa = 0.012;
  let malhas = 0, vertices = 0;
  for (const { o } of cands) {
    const g0 = o.geometry;
    const pos0 = g0.attributes.position;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const nm = new THREE.Matrix3().getNormalMatrix(inv).invert().transpose();
    let hit = 0;
    for (let i = 0; i < pos0.count; i++) {
      v.fromBufferAttribute(pos0, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.x - cx) > meia - faixa && Math.abs(v.x - cx) < meia + 0.002) hit++;
    }
    if (hit < 200) continue;
    const g = g0.clone();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const dx = v.x - cx;
      if (Math.abs(dx) <= meia - faixa || Math.abs(dx) >= meia + 0.002) continue;
      const s = Math.sign(dx);
      v.x = cx + s * meia;
      v.applyMatrix4(inv);
      pos.setXYZ(i, v.x, v.y, v.z);
      if (nor) {
        n.set(s, 0, 0).applyMatrix3(nm).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      vertices++;
    }
    pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    o.geometry = g;
    malhas++;
  }
  return { meia: +meia.toFixed(4), candidatos: cands.length, malhas, vertices };
}
out.push(['chapa-lisa', alisaFriso()]);
if (arg('fusao', 'off') === 'on') { try { S.merge.apply(); } catch { /* segue sem fusão */ } }
for (let i = 0; i < 20; i++) await B.frame();

/* ---------- 5b · luz de GUIA, não de catálogo ----------
   O render é para ser LIDO no pátio, na tela do celular, ao sol: sombra
   projetada no chão vira uma segunda silhueta, e a lateral do lado da sombra
   saía cinza-médio. Sombra desligada e uma luz de céu branca por cima do rig —
   a forma continua vindo do sombreamento das faces. */
const LUZ = Number(arg('luz', '1.1'));
/* O TETO DO ESTÚDIO (grelha, painéis e spots pendurados) entra no recorte:
   com o baú de 7,50 m os cabos dos spots cruzavam o quadro como duas linhas
   saindo dos cantos traseiros do teto. Guia não tem estúdio — some. */
const tetoEstudio = S.scene.getObjectByName('ts-teto');
if (tetoEstudio) tetoEstudio.visible = false;
out.push(['teto-estudio-escondido', !!tetoEstudio]);
S.scene.traverse((o) => { if (o.isLight && o.castShadow) o.castShadow = false; });
const ceu = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, LUZ);
ceu.name = 'guia-ceu';
S.scene.add(ceu);

/* AMBIENTE NEUTRO. O mapa de ambiente do estúdio é o ciclorama com a grelha
   de spots do teto: o inox (trilhos, cantoneiras, ferragem da porta) espelhava
   faixas e pontos de luz que não existem no pátio e sujavam o guia. Troca por
   um degradê vertical LISO — branco em cima, cinza-claro embaixo, sem nenhuma
   feição: o metal continua lendo como metal (claro em cima, escuro embaixo),
   mas não reflete desenho nenhum, e é simétrico por construção. */
const cenaAmb = new THREE.Scene();
{
  const geo = new THREE.SphereGeometry(50, 64, 32);
  const cor = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) / 50 + 1) / 2));   // 0 embaixo, 1 em cima
    const v = 0.55 + 0.45 * Math.pow(t, 0.8);
    cor.push(v, v, v);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  cenaAmb.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
}
const pmrem = new THREE.PMREMGenerator(S.renderer);
const ambNeutro = pmrem.fromScene(cenaAmb, 0.04).texture;
const ambiente = () => {
  S.scene.environment = ambNeutro;
  if ('environmentIntensity' in S.scene) S.scene.environmentIntensity = 1.0;
  if (S.scene.environmentRotation) S.scene.environmentRotation.set(0, 0, 0);
};
ambiente();

/* SEM REBITES. As fileiras de rebite das laterais (`SIDE_*_RIVETS`,
   `RIVET_LOW_*`, `TRAILER_TOPRAIL_RIVETS_*`, material `livery-rebite`) liam
   como linhas pontilhadas verticais em toda a chapa — exatamente o ruído que a
   chapa lisa existe para tirar. */
let rebites = 0;
M.trailerGroup.traverse((o) => {
  const mats = [].concat(o.material || []).map((m) => m?.name || '').join(',');
  if (o.isMesh && (/RIVET|REBITE/i.test(o.name) || /rebite/i.test(mats))) { o.visible = false; rebites++; }
});
out.push(['rebites-escondidos', rebites]);

/* VEÍCULO TODO BRANCO (`--bau-branco on`) — a variante de onde sai a MÁSCARA.
   Trilho, cantoneira, quadro e ferragem da porta, lanterna e faixa refletiva
   são escuros ou cromados, e na máscara tirada da foto eles se misturam com o
   fundo. Aqui tudo que pertence ao baú (malha do implemento acima do pé da
   chapa lateral, mais a unidade de frio) ganha um branco FOSCO único — sem
   metal, sem reflexo, sem cor. Chassi, rodado e para-choque ficam como são. */
const BAU_BRANCO = arg('bau-branco', 'off') === 'on';
if (BAU_BRANCO) {
  let pe = Infinity;
  M.trailer.traverse((o) => {
    if (o.isMesh && /^(SIDE_[LR]|TRAILER_BODY)$/.test(o.name)) pe = Math.min(pe, new THREE.Box3().setFromObject(o, true).min.y);
  });
  const branco = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6, metalness: 0 });
  let n = 0;
  const pinta = (raiz, todo) => raiz && raiz.traverse((o) => {
    if (!o.isMesh) return;
    if (!todo && new THREE.Box3().setFromObject(o, true).min.y < pe - 0.14) return;
    o.material = Array.isArray(o.material) ? o.material.map(() => branco) : branco;
    n++;
  });
  /* O VEÍCULO INTEIRO, não só o baú (pedido do dono, 28/09): cabine, grade,
     para-choque, chassi, pneu e VIDRO também têm preto que funde com o fundo e
     come a borda da máscara. Vidro vira opaco — a máscara é de silhueta. */
  pinta(M.trailerGroup, true);
  pinta(M.cabGroup, true);
  if (TK) pinta(M.tk, true);
  out.push(['bau-branco', { peDaChapa: +pe.toFixed(3), malhas: n }]);
}

/* LUZ SIMÉTRICA. O rig de catálogo tem a principal em +X (3,3, alta e
   dianteira) e o preenchimento em −X (0,9): o lado do motorista saía 12–15
   níveis mais escuro que o do carona na mesma pose — medido em 28/09 sobre os
   pixels do veículo (lateral 159 × 174). Um guia tem de ser igual dos dois
   lados, então a principal vai para o PLANO DE SIMETRIA (x = centro, mesma
   altura e mesmo recuo) e o preenchimento ganha um gêmeo espelhado. */
const cxVeiculo = new THREE.Box3().setFromObject(M.trailer).getCenter(new THREE.Vector3()).x;
const direcionais = [];
S.scene.traverse((o) => { if (o.isDirectionalLight && o.intensity > 0) direcionais.push(o); });
direcionais.sort((a, b) => b.intensity - a.intensity);
const [principal, preench] = direcionais;
function simetriza() {
  if (principal) {
    principal.position.x = cxVeiculo;
    principal.target.position.x = cxVeiculo;
    principal.target.updateMatrixWorld();
  }
}
simetriza();
let gemeo = null;
if (preench) {
  gemeo = preench.clone();
  gemeo.castShadow = false;
  gemeo.position.x = 2 * cxVeiculo - preench.position.x;
  gemeo.target = new THREE.Object3D();
  gemeo.target.position.copy(preench.target.position);
  gemeo.target.position.x = 2 * cxVeiculo - preench.target.position.x;
  preench.parent.add(gemeo); S.scene.add(gemeo.target);
}
for (let i = 0; i < 10; i++) await B.frame();

/* ---------- 5c · o filete do trilho de topo ----------
   `FILETE_TRILHO_TOPO_L/R` NÃO acompanha o baú quando ele ENCOLHE (8,66 → 7,50
   no toco): sai dos cantos traseiros do teto como duas linhas compridas para
   trás, e a caixa da geometria não acusa (achado escondendo nó a nó e contando
   pixel acima do teto — 309 → 0 sem os dois). Defeito do redimensionamento do
   estúdio; aqui o filete de 1 cm só sai do guia, em todos os veículos, para o
   jogo ser igual entre eles. */
let filetes = 0;
M.trailerGroup.traverse((o) => { if (/^FILETE_TRILHO_TOPO_/.test(o.name)) { o.visible = false; filetes++; } });
out.push(['filetes-escondidos', filetes]);

/* ---------- 6 · a câmera, sem aparo ---------- */
S.controls.minDistance = 0.01;
S.controls.maxDistance = 1e6;
S.controls.enabled = false;
S.controls.update = () => false;

/* Pontos do que aparece: vértices amostrados das malhas VISÍVEIS. */
function visivel(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function amostra(raizes, alvo = 60000) {
  const ms = [];
  let tot = 0;
  for (const r of raizes) r && r.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position && visivel(o)) {
      ms.push(o); tot += o.geometry.attributes.position.count;
    }
  });
  const passo = Math.max(1, Math.floor(tot / alvo));
  const pts = [];
  const v = new THREE.Vector3();
  for (const o of ms) {
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += passo) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
    /* os cantos da caixa da malha garantem as pontas mesmo com passo grande */
    const b = new THREE.Box3().setFromObject(o);
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      if (b.max.x - b.min.x < 0.6 && b.max.z - b.min.z < 0.6) pts.push(new THREE.Vector3(x, y, z));
    }
  }
  return pts;
}
const raizes = V.rigido ? [M.cabGroup, M.trailerGroup] : [M.trailerGroup];
const PTS = amostra(raizes);
const box = new THREE.Box3().setFromPoints(PTS);
const C = box.getCenter(new THREE.Vector3());
const boxImp = new THREE.Box3().setFromObject(M.trailer);   // o baú, sem cabine
out.push(['caixa', { min: box.min.toArray().map((n) => +n.toFixed(3)), max: box.max.toArray().map((n) => +n.toFixed(3)),
  frenteZ, direitaX, pontos: PTS.length }]);

const cam = S.camera;
function prepara(q, fovLong) {
  cam.aspect = q.w / q.h;
  /* fov do three é VERTICAL; em paisagem o eixo longo é o horizontal */
  const tl = Math.tan(fovLong * Math.PI / 360);
  cam.fov = q.w >= q.h ? 2 * Math.atan(tl / cam.aspect) * 180 / Math.PI : fovLong;
  cam.updateProjectionMatrix();
}
function extensao() {
  cam.updateMatrixWorld(true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const p = new THREE.Vector3();
  for (const q of PTS) {
    p.copy(q).project(cam);
    if (p.z > 1) continue;
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  return { x0, x1, y0, y1 };
}
/* Pose de chão: câmera a CAM_Y, olhando para `alvo`, recuando pela direção
   horizontal `az` (graus, 0 = de frente para a testeira/cabine, 90 = lado
   esquerdo). Distância por bisseção até a silhueta encher `fillW`/`fillH`;
   a mira horizontal é recentrada para a silhueta ficar no meio. */
function poseChao(az, alvo, fillW, fillH, travaX = false) {
  const a = az * Math.PI / 180;
  /* azimute no referencial do VEÍCULO → mundo */
  const dir = new THREE.Vector3(Math.sin(a) * -direitaX, 0, Math.cos(a) * frenteZ).normalize();
  /* CELULAR NIVELADO: a mira fica na altura da câmera. Inclinar para centrar
     encheria o quadro, mas cada pessoa inclina diferente e a foto deixa de se
     sobrepor à de check-in — nivelado é a única instrução reproduzível. */
  const mira = new THREE.Vector3(alvo.x, CAM_Y, alvo.z);
  let d = 10;
  for (let it = 0; it < 8; it++) {
    let lo = 1, hi = 80;
    for (let k = 0; k < 40; k++) {
      d = (lo + hi) / 2;
      cam.position.set(mira.x + dir.x * d, CAM_Y, mira.z + dir.z * d);
      cam.lookAt(mira);
      const e = extensao();
      const w = (e.x1 - e.x0) / 2, h = Math.max(-e.y0, e.y1);
      if (w > fillW || h > fillH || !Number.isFinite(w)) lo = d; else hi = d;
    }
    d = hi;
    cam.position.set(mira.x + dir.x * d, CAM_Y, mira.z + dir.z * d);
    cam.lookAt(mira);
    const e = extensao();
    const off = travaX ? 0 : (e.x0 + e.x1) / 2;
    if (Math.abs(off) < 0.004) break;
    /* desloca a mira no eixo DIREITO da câmera: câmera e mira andam juntas,
       então a silhueta anda exatamente o erro medido */
    const meiaLarg = d * Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
    const dirCam = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    mira.addScaledVector(dirCam, off * meiaLarg);
  }
  const e = extensao();
  return { d: +d.toFixed(2), cam: cam.position.toArray().map((n) => +n.toFixed(2)),
    mira: mira.toArray().map((n) => +n.toFixed(2)),
    ext: [e.x0, e.x1, e.y0, e.y1].map((n) => +n.toFixed(3)) };
}
/* Teto: em pé sobre o baú, 1 m para dentro da borda traseira, olhando para a
   frente e para baixo. A inclinação põe a borda dianteira do teto a 18 % do
   topo do quadro. */
function poseTeto() {
  const tetoY = boxImp.max.y;
  const zTras = frenteZ > 0 ? boxImp.min.z : boxImp.max.z;
  const zFrente = frenteZ > 0 ? boxImp.max.z : boxImp.min.z;
  const cx = (boxImp.min.x + boxImp.max.x) / 2;
  cam.position.set(cx, tetoY + CAM_Y, zTras + frenteZ * 1.0);
  const borda = new THREE.Vector3(cx, tetoY, zFrente);
  let lo = -89, hi = 0, pitch = -30;
  for (let k = 0; k < 40; k++) {
    pitch = (lo + hi) / 2;
    const p = pitch * Math.PI / 180;
    const alvo = cam.position.clone().add(new THREE.Vector3(0, Math.sin(p), Math.cos(p) * frenteZ));
    cam.lookAt(alvo);
    cam.updateMatrixWorld(true);
    const y = borda.clone().project(cam).y;
    if (y < 0.64) hi = pitch; else lo = pitch;
  }
  return { pitch: +pitch.toFixed(1), cam: cam.position.toArray().map((n) => +n.toFixed(2)), tetoY: +tetoY.toFixed(3) };
}

/* ---------- 7 · as poses ---------- */
const alvoCentro = new THREE.Vector3(C.x, (box.min.y + box.max.y) / 2, C.z);
const zTras = frenteZ > 0 ? box.min.z : box.max.z;
const zFrente = frenteZ > 0 ? box.max.z : box.min.z;
const POSES = [
  { nome: 'lateral-esquerda', q: LAND, f: () => poseChao(90, alvoCentro, 0.90, 0.86) },
  { nome: 'lateral-direita', q: LAND, f: () => poseChao(-90, alvoCentro, 0.90, 0.86) },
  { nome: 'tres-quartos-dianteira-esquerda', q: LAND, f: () => poseChao(40, alvoCentro, 0.90, 0.86) },
  { nome: 'tres-quartos-dianteira-direita', q: LAND, f: () => poseChao(-40, alvoCentro, 0.90, 0.86) },
  { nome: 'tres-quartos-traseira-esquerda', q: LAND, f: () => poseChao(140, alvoCentro, 0.90, 0.86) },
  { nome: 'tres-quartos-traseira-direita', q: LAND, f: () => poseChao(-140, alvoCentro, 0.90, 0.86) },
  { nome: 'traseira', q: PORT, f: () => poseChao(180, new THREE.Vector3(C.x, (box.min.y + box.max.y) / 2, zTras), 0.88, 0.90, true) },
  ...(V.rigido ? [] : [
    { nome: 'frontal', q: PORT, f: () => poseChao(0, new THREE.Vector3(C.x, (box.min.y + box.max.y) / 2, zFrente), 0.88, 0.90, true) },
  ]),
  { nome: 'teto', q: PORT, f: () => poseTeto() },
];

async function foto(p) {
  prepara(p.q, V.lente);
  const info = p.f();
  for (let i = 0; i < 12; i++) await B.frame();
  prepara(p.q, V.lente); p.f();             // reafirma depois dos quadros
  simetriza();
  ambiente();
  if (gemeo && preench) { gemeo.intensity = preench.intensity; gemeo.position.x = 2 * cxVeiculo - preench.position.x; }
  /* QUALIDADE: captura no preset ALTO (aresta longa 7680, em ladrilhos) e
     reduz para 2× o quadro do app (3200×1800 / 1800×3200) — a redução de
     2,4:1 é o antisserrilhado. `--qualidade medium` volta ao passe único. */
  const cap = await B.captureViewport({ quality: arg('qualidade', 'high'), background: 'recorte' });
  const bmp = await createImageBitmap(cap.blob);
  const cv = document.createElement('canvas');
  const ESC = Number(arg('escala', '2'));
  cv.width = p.q.w * ESC; cv.height = p.q.h * ESC;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  /* redução em DOIS passos: drawImage de 7680 direto para 3200 amostra
     poucos texels por pixel e serrilha a linha fina do inox */
  const meio = new OffscreenCanvas(Math.round(bmp.width / 1.5), Math.round(bmp.height / 1.5));
  const gm = meio.getContext('2d'); gm.imageSmoothingQuality = 'high';
  gm.drawImage(bmp, 0, 0, meio.width, meio.height);
  g.drawImage(meio, 0, 0, cv.width, cv.height);
  meio.width = 1; meio.height = 1;
  out.push([`${p.nome}-info`, { ...info, fov: +cam.fov.toFixed(1), src: [cap.width, cap.height] }]);
  const url = cv.toDataURL('image/webp', 0.96);
  bmp.close(); cv.width = 1; cv.height = 1;
  out.push([`guia-${TAG}-${p.nome}`, url]);
}

for (const p of POSES) {
  if (ONLY && !new RegExp(ONLY).test(p.nome)) continue;
  await foto(p);
}
return out;
