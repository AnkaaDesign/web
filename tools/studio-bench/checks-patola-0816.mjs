/* A TRAVA DE ACEITAÇÃO DA PATOLA — pé no chão, e o baú parado.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-patola-0816.mjs

   O pedido tinha DUAS metades e as duas são travadas aqui:

     1. com a vista em "só o implemento", o pé da patola TOCA o plano de contato
        dos pneus (ver `vehicle/landing-gear.ts`);
     2. **o baú NÃO SE MEXE** — nem a testeira, nem a altura, nem o engate. Era o
        "mas não a frente da caixa" do relato, e é a metade que uma implementação
        preguiçosa (baixar o nariz do conjunto) quebraria sem quebrar a primeira.

   E uma terceira, que não foi pedida e sem a qual a funcionalidade não existe no
   nível de qualidade em que o app roda: a patola tem de continuar descendo COM A
   FUSÃO POR MATERIAL DE PÉ. Uma malha fundida tem os vértices assados na pose do
   instante da fusão; se a exclusão falhar, a peça congela no ar e nada avisa. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio?.state?.trailer, 180000);
for (let i = 0; i < 30; i++) await B.frame();

const S = window.__studio;
const THREE = S.THREE;
const raiz = S.state.trailer;
if (!raiz) { out.push(['⚠️ ABORTADO', 'sem implemento carregado']); return out; }
if (!S.patola) {
  out.push(['⚠️ ABORTADO', 'este build não publica `__studio.patola`']);
  return out;
}

/* ---------------- as medidas, POR VÉRTICE e EM ESPAÇO DE MUNDO --------------
   ⚠️ MUNDO, E NÃO O REFERENCIAL DA RAIZ — e esta linha é o conserto do teste,
   não do produto. A primeira versão media as duas alturas no espaço da raiz e
   declarava "erro contra o chão: 0 mm" com a chapa 54,5 mm ENTERRADA no piso.

   O motivo é que a raiz é INCLINADA por `placeTrailer()` (o pino descendo sobre
   a quinta roda, ~0,36°) e a patola fica ~8,6 m à frente do bogie. No espaço da
   raiz essa inclinação não existe: lá o pé encosta perfeitamente num chão que
   não é o chão. Um teste no referencial errado não é um teste fraco — é um
   carimbo.

   `chao` também passou a ser SÓ OS PNEUS, e não "o resto do implemento": depois
   que a sapata desce, ela empata com o ponto mais baixo do conjunto, e medir o
   chão pelo mínimo geral compararia a peça consigo mesma. */
const vv = new THREE.Vector3();
function medir() {
  raiz.updateWorldMatrix(true, true);
  let chao = Infinity, pe = Infinity;
  const bau = new THREE.Box3();
  raiz.traverse((no) => {
    const o = no;
    if (!o.isMesh) return;
    const pos = o.geometry?.getAttribute('position');
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    const naPatola = !!o.parent && o.parent.name === 'PATOLA';
    const ePneu = /pneu|tire/i.test(o.name || '');
    /* As chapas do baú são o "não a frente da caixa" do pedido: se ELAS se
       moverem, a implementação está errada mesmo que o pé encoste. */
    const eChapa = /^(SIDE_L|SIDE_R|REAR|FRONT)$/.test(o.name);
    if (!naPatola && !ePneu && !eChapa) return;
    for (let i = 0; i < pos.count; i++) {
      vv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (ePneu && vv.y < chao) chao = vv.y;
      if (naPatola && vv.y < pe) pe = vv.y;
      if (eChapa) bau.expandByPoint(vv);
    }
  });
  return { chao, pe, bau: bau.isEmpty() ? null : bau.clone() };
}

const info0 = S.patola.info();
out.push(['patola reconhecida', info0.achada === true]);
out.push(['malhas na patola (2 pernas + a sapata)', info0.malhas]);
out.push(['curso, em mm', +(info0.curso * 1000).toFixed(0)]);

/* ---------------- 0. A SAPATA, a chapa que se vê ----------------
   *"na peça que segura o implemento que vai no chão, deve ter uma superfície de
   uns 2 cm mais larga que o suporte em si, na parte que toca o chão"*.

   MEDIDO no `.glb`: o tubo tem 102 × 100 mm e JÁ EXISTE uma flange de fábrica —
   7,7 mm de espessura, avançando 69 mm além do tubo (240 mm no total). Ela é
   larga e é fina demais para aparecer: assentada no plano de contato, some
   contra qualquer piso. A chapa gerada pende dela, 20 mm além em cada lado
   (280 mm) e 14 mm de espessura. Aqui se confere a largura nos DOIS eixos e que
   ela pende ABAIXO da flange — é ela que encosta. */
const grupo = raiz.getObjectByName('PATOLA');
const sapata = grupo?.children.find((o) => /SAPATA/.test(o.name || ''));
out.push(['0 · a sapata existe', !!sapata]);
if (grupo && sapata) {
  const caixaDe = (o) => {
    const pos = o.geometry?.getAttribute('position');
    o.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().multiplyMatrices(
      raiz.matrixWorld.clone().invert(), o.matrixWorld);
    const b = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
    return b;
  };
  /* A perna da direita e a metade DIREITA da chapa (ela é uma malha só, com as
     duas chapas dentro — por isso a comparação é por lado). */
  const pernaD = grupo.children.find((o) => o !== sapata && caixaDe(o).min.x > 0);
  const bp = caixaDe(pernaD);
  const posS = sapata.geometry.getAttribute('position');
  const mS = new THREE.Matrix4().multiplyMatrices(
    raiz.matrixWorld.clone().invert(), sapata.matrixWorld);
  const vS = new THREE.Vector3();
  let sx0 = Infinity, sx1 = -Infinity, sz0 = Infinity, sz1 = -Infinity;
  let sy0 = Infinity, sy1 = -Infinity;
  for (let i = 0; i < posS.count; i++) {
    vS.fromBufferAttribute(posS, i).applyMatrix4(mS);
    if (vS.y < sy0) sy0 = vS.y; if (vS.y > sy1) sy1 = vS.y;
    if (vS.x <= 0) continue;                       // só a chapa da DIREITA
    if (vS.x < sx0) sx0 = vS.x; if (vS.x > sx1) sx1 = vS.x;
    if (vS.z < sz0) sz0 = vS.z; if (vS.z > sz1) sz1 = vS.z;
  }
  const abaX = ((sx1 - sx0) - (bp.max.x - bp.min.x)) * 1000 / 2;
  const abaZ = ((sz1 - sz0) - (bp.max.z - bp.min.z)) * 1000 / 2;
  out.push(['0 · tubo, em mm', `${((bp.max.x - bp.min.x) * 1000).toFixed(0)} × ${((bp.max.z - bp.min.z) * 1000).toFixed(0)}`]);
  out.push(['0 · sapata, em mm', `${((sx1 - sx0) * 1000).toFixed(0)} × ${((sz1 - sz0) * 1000).toFixed(0)}`]);
  out.push(['0 · aba por lado, em mm', `x ${abaX.toFixed(1)} · z ${abaZ.toFixed(1)}`]);
  out.push(['0 · a aba é de ~2 cm nos dois eixos',
    Math.abs(abaX - 20) < 0.5 && Math.abs(abaZ - 20) < 0.5]);
  out.push(['0 · espessura, em mm', +((sy1 - sy0) * 1000).toFixed(1)]);
  out.push(['0 · ela pende ABAIXO do tubo (nada de plano coincidente)',
    sy1 < bp.min.y - 1e-5 && sy0 < bp.min.y]);
}

/* ---------------- 1. RECOLHIDA: conjunto ---------------- */
S.models.setVehicleView('both');
for (let i = 0; i < 4; i++) await B.frame();
const a = medir();
out.push(['recolhida — folga do pé até o chão, em mm', +((a.pe - a.chao) * 1000).toFixed(1)]);
out.push(['recolhida — a patola NÃO toca o chão', a.pe - a.chao > 0.05]);

/* ---------------- 2. DESCIDA: só o implemento ---------------- */
S.models.setVehicleView('trailer');
for (let i = 0; i < 6; i++) await B.frame();
const b = medir();
out.push(['descida — erro contra o chão, em mm', +((b.pe - b.chao) * 1000).toFixed(1)]);
out.push(['descida — o pé TOCA o chão (±5 mm)', Math.abs(b.pe - b.chao) < 0.005]);

/* ---------------- 3. O BAÚ NÃO SE MEXEU ---------------- */
if (a.bau && b.bau) {
  const d = ['min', 'max'].flatMap((k) => ['x', 'y', 'z'].map((e) => Math.abs(a.bau[k][e] - b.bau[k][e])));
  const pior = Math.max(...d);
  out.push(['baú — maior deslocamento da caixa das chapas, em mm', +(pior * 1000).toFixed(3)]);
  out.push(['baú PARADO (< 0,1 mm)', pior < 1e-4]);
} else {
  out.push(['⚠️ sem chapas recortadas para medir o baú', false]);
}

/* ---------------- 4. E COM A FUSÃO DE PÉ ---------------- */
const fus = S.merge.apply();
if (!fus) {
  out.push(['⚠️ fusão indisponível', false]);
} else {
  const motivos = Object.keys(fus.excluidas || {});
  out.push(['a fusão declara a exclusão da patola',
    motivos.some((m) => /patola/i.test(m))]);
  out.push(['exclusões declaradas', motivos]);
  /* O ciclo INTEIRO com a fusão montada: recolher, descer, medir. Se as pernas
     tivessem entrado num balde, o `.position` do grupo mudaria e a GEOMETRIA
     ficaria onde estava — e a medida por vértice pega isso, porque ela lê a
     malha e não o nó. */
  S.models.setVehicleView('both');
  for (let i = 0; i < 4; i++) await B.frame();
  const c = medir();
  S.models.setVehicleView('trailer');
  for (let i = 0; i < 4; i++) await B.frame();
  const e = medir();
  out.push(['fundida — folga recolhida, em mm', +((c.pe - c.chao) * 1000).toFixed(1)]);
  out.push(['fundida — erro descida, em mm', +((e.pe - e.chao) * 1000).toFixed(1)]);
  out.push(['fundida — a patola ainda desce', Math.abs(e.pe - e.chao) < 0.005 && c.pe - c.chao > 0.05]);
}

/* ---------------- 5. A FOTO ---------------- */
const R = S.renderer, cena = S.scene;
const ar = R.domElement.width / R.domElement.height;
const eixoX = new THREE.Vector3(1, 0, 0).transformDirection(raiz.matrixWorld);
const eixoY = new THREE.Vector3(0, 1, 0).transformDirection(raiz.matrixWorld);
function foto(centroLocal, meiaA) {
  const c = centroLocal.clone().applyMatrix4(raiz.matrixWorld);
  const cam = new THREE.OrthographicCamera(-meiaA * ar, meiaA * ar, meiaA, -meiaA, 0.01, 60);
  cam.position.copy(c).addScaledVector(eixoX, 9);
  cam.up.copy(eixoY);
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  /* ⚠️ `toDataURL` na MESMA tarefa síncrona do `render()` — depois de um `await`
     o buffer volta limpo. */
  R.render(cena, cam);
  return R.domElement.toDataURL('image/png');
}
out.push(['patola-descida', foto(new THREE.Vector3(0, 0.62, 3.15), 0.9)]);
/* E o PÉ de perto, que é onde a sapata se julga. */
out.push(['patola-sapata', foto(new THREE.Vector3(0.605, 0.02, 3.19), 0.13)]);

return out;
