/* A NOITE DO DISTRITO — atravessar por objeto, céu de noite, postes e lanternas.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-noite.mjs

   Quatro entregas, e o que trava cada uma:

     1. ATRAVESSAR POR OBJETO INTEIRO. A v1 dissolvia por fragmento num túnel
        cilíndrico e produziu os três defeitos que o dono do produto fotografou:
        transparência PARCIAL como estado permanente, meia árvore, e a faixa da
        pista pontilhando. As travas são, na ordem: nenhum material RASO recebe o
        tratamento (é o que tira a faixa da pista), o veredito é binário por
        objeto, e casca e copa da mesma árvore concordam sempre.
     2. O CÉU TROCA. Peso 0 ao meio-dia, 1 à meia-noite, e o PMREM reassado um
        número FINITO de vezes numa varredura — é o que separa "atravessa liso"
        de "trava a cada evento de ponteiro".
     3. AS LUMINÁRIAS DO SET ACENDEM. Onze vidros, oito refletores, e o refletor
        DENTRO da luminária que ele acende (a trava que pega escala e alcance
        trocados).
     4. AS LANTERNAS DO VEÍCULO ACENDEM ÀS 18:00. Apagadas às 17:45, cheias às
        19:00, e o número de materiais > 0 nos dois veículos. */
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
const L = S.lighting;
const set = scene.getObjectByName('ts-set');
if (!set) return out;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});
scene.updateMatrixWorld(true);

/* ======================= 1. ATRAVESSAR ======================= */
out.push(['— atravessar —', '']);
const st0 = L.getSeeThrough ? L.getSeeThrough() : null;
out.push(['exposto no handle', !!st0]);
if (!st0) return out;
out.push(['  sólidos registrados', st0.solidos]);
out.push(['  grupos de planta', st0.grupos]);
out.push(['  instâncias de planta', st0.plantas]);
out.push(['tem sólido e tem planta', st0.solidos > 0 && st0.plantas > 0]);

/* A TRAVA DA FAIXA DA PISTA. `userData.tsSee` é a marca que
   installSeeThroughOnSet() deixa; um material de CHÃO ou uma demarcação nunca
   pode tê-la. Mede a caixa de cada malha marcada e reprova a que for rasa E
   estiver no nível do solo — que é exatamente o corte do módulo. */
const bx = new THREE.Box3();
const rasas = [];
let marcadas = 0;
const nomesMat = new Set();
set.traverse((o) => {
  if (!o.isMesh || !o.userData || !o.userData.tsSee) return;
  marcadas++;
  const mm = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mm) if (m && m.name) nomesMat.add(m.name);
  bx.setFromObject(o);
  if (bx.isEmpty()) return;
  const h = bx.max.y - bx.min.y;
  if (h < 0.35 && bx.min.y < 0.35) {
    rasas.push(`${o.name || '?'} h=${r2(h)} y0=${r2(bx.min.y)} [${mm.map((m) => m && m.name).join(',')}]`);
  }
});
out.push(['malhas marcadas', marcadas]);
out.push(['  materiais envolvidos', [...nomesMat].sort().join(', ')]);
out.push(['  rasas marcadas (não deveria haver)', rasas.length]);
rasas.slice(0, 6).forEach((r, i) => out.push([`    rasa ${i}`, r]));
out.push(['nenhuma malha RASA atravessa', rasas.length === 0]);
/* E o inverso, que é o defeito relatado pelo nome: a pintura da faixa da pista
   está no material LINE_PAINT, e ele não pode aparecer na lista acima. */
out.push(['LINE_PAINT fora do atravessar', !nomesMat.has('LINE_PAINT')]);
out.push(['ASPHALT_ROAD fora do atravessar', !nomesMat.has('ASPHALT_ROAD')]);
out.push(['GRASS_VERGE fora do atravessar', !nomesMat.has('GRASS_VERGE')]);
/* E o que TEM de estar lá: construção, cerca, vegetação e o mastro. */
out.push(['vegetação atravessa', nomesMat.has('PLANT_BARK') && nomesMat.has('PLANT_LEAF')]);
out.push(['poste atravessa (FENCE_POST)', nomesMat.has('FENCE_POST')]);
out.push(['galpão atravessa (algum DL_*)',
  [...nomesMat].some((n) => /^DL_/.test(n))]);

/* O VEREDITO É BINÁRIO E POR OBJETO. Põe a lente do outro lado de um galpão e
   deixa assentar; depois lê o uniforme de cada material clonado. Nenhum valor
   pode ficar entre 0 e 1 com a câmera parada — foi a transparência parcial
   permanente que reprovou a v1. */
S.controls.enabled = false;
async function pose(eye, tgt, quadros = 26) {
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  L.invalidate(10);
  for (let i = 0; i < quadros; i++) await B.frame();
}

function uniformes() {
  const vals = [];
  set.traverse((o) => {
    if (!o.isMesh || !o.userData || !o.userData.tsSee) return;
    if (o.isInstancedMesh) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) {
      const u = m && m.userData && m.userData.tsSeeU;
      if (u) vals.push({ nome: o.name || '?', v: u.value });
    }
  });
  return vals;
}

/* O AGRUPAMENTO É REIMPLEMENTADO AQUI, de propósito. A bancada não importa o
   `grupoDePrimitivas()` do engine: se importasse, uma regra de pareamento errada
   passaria por estar de acordo consigo mesma — que é exatamente o que aconteceu
   com o pareamento por sufixo `_1` (o protótipo cujo índice É 1 desmonta a
   regra). O que se afirma aqui é a PROPRIEDADE: peças que o glTF põe sob o mesmo
   `Group` de primitivas são o mesmo indivíduo e têm de receber o mesmo veredito.
   Chave por objeto, não por nome. */
function chaveDe(o) {
  const p = o.parent;
  if (!p || !p.isGroup) return o;
  if (p.children.length < 2 || p.children.length > 4) return o;
  if (!p.children.every((c) => c.isInstancedMesh)) return o;
  return p;
}

function atributos() {
  const grupos = [];
  set.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData || !o.userData.tsSee) return;
    const a = o.geometry.getAttribute('aSeeHide');
    if (!a) return;
    grupos.push({ im: o, nome: o.name || '?', chave: chaveDe(o),
      n: o.count, arr: a.array });
  });
  return grupos;
}

/* De dentro do pátio a leste, olhando o caminhão através do galpão MC_03/MC_12. */
await pose([46, 3, -4], [0, 2, 12], 60);
/* DUAS LEITURAS, separadas por quadros: um valor no meio da rampa pode ser
   assentamento lento (some na segunda leitura) ou PISCA (fica). Só a segunda
   leitura vale para a trava — e a diferença entre elas é o diagnóstico. */
const u0 = uniformes();
for (let i = 0; i < 40; i++) await B.frame();
let u = uniformes();
out.push(['  parciais na 1ª leitura', u0.filter((e) => e.v > 0.02 && e.v < 0.98).length]);
let meio = u.filter((e) => e.v > 0.02 && e.v < 0.98);
let cheios = u.filter((e) => e.v >= 0.98);
out.push(['através do galpão: escondidos inteiros', cheios.length]);
out.push(['  em meio caminho (não deveria haver)', meio.length]);
meio.slice(0, 5).forEach((e, i) => out.push([`    parcial ${i}`, `${e.nome} = ${r2(e.v)}`]));
out.push(['algo ficou escondido', cheios.length > 0]);
out.push(['nenhum sólido em transparência PARCIAL', meio.length === 0]);
out.push(['  nomes escondidos', cheios.slice(0, 8).map((e) => e.nome).join(', ')]);

/* CASCA E COPA CONCORDAM. Do canteiro, com árvore entre a lente e o caminhão. */
await pose([-13, 2.2, 40], [0, 2, 14], 60);
for (let i = 0; i < 40; i++) await B.frame();
const gs = atributos();
const porBase = new Map();
for (const g of gs) {
  const l = porBase.get(g.chave) || [];
  l.push(g);
  porBase.set(g.chave, l);
}
let divergentes = 0, plantasOcultas = 0, plantasParciais = 0;
for (const [, l] of porBase) {
  if (l.length < 2) continue;
  const n = Math.min(...l.map((g) => g.n));
  for (let i = 0; i < n; i++) {
    const vs = l.map((g) => g.arr[i]);
    if (Math.max(...vs) - Math.min(...vs) > 0.01) divergentes++;
    if (vs[0] >= 0.98) plantasOcultas++;
    else if (vs[0] > 0.02) plantasParciais++;
  }
}
out.push(['grupos de instância', [...porBase.values()]
  .map((l) => l.map((g) => g.nome).join('+')).join(', ')]);
/* E O PLANTIO DE TODAS ELAS. `checks-cenario.mjs` mede posição de instância
   pulando as malhas com sufixo `_1` (para não contar a copa duas vezes) — e era
   justamente esse filtro que escondia `tree_pk_1` e `bush_pk_1`, que NÃO eram
   replantados e ficavam nas posições de fábrica, em cima do asfalto. Aqui a
   conta é por GRUPO, então nenhum protótipo escapa. */
{
  const faixas = [];
  set.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
    const n = o.name || '';
    if (!/^median|^rb_island|^turf_/i.test(n)) return;
    bx.setFromObject(o);
    if (!bx.isEmpty()) faixas.push({ x0: bx.min.x, x1: bx.max.x, z0: bx.min.z, z1: bx.max.z });
  });
  const m4 = new THREE.Matrix4();
  const pw = new THREE.Vector3();
  let total = 0, fora = 0;
  const exemplos = [];
  for (const [, l] of porBase) {
    /* UMA peça por indivíduo: as irmãs compartilham a matriz, e contar as duas
       dobraria o total sem medir nada novo. */
    const malha = l[0].im;
    for (let i = 0; i < malha.count; i++) {
      malha.getMatrixAt(i, m4);
      pw.setFromMatrixPosition(m4);
      malha.localToWorld(pw);
      total++;
      if (!faixas.some((f) => pw.x >= f.x0 && pw.x <= f.x1 && pw.z >= f.z0 && pw.z <= f.z1)) {
        fora++;
        if (exemplos.length < 6) exemplos.push(`${l[0].nome}#${i} @${r1(pw.x)},${r1(pw.z)}`);
      }
    }
  }
  out.push(['instâncias medidas por GRUPO', total]);
  out.push(['  fora de canteiro/grama', fora]);
  exemplos.forEach((e, i) => out.push([`    fora ${i}`, e]));
  out.push(['toda instância de TODO protótipo está em canteiro ou grama',
    total > 0 && fora === 0]);
}
out.push(['pares casca/copa medidos', [...porBase.values()].filter((l) => l.length > 1).length]);
const semPar = [...porBase.values()].filter((l) => l.length < 2).map((l) => l[0].nome);
out.push(['  grupos SEM par', semPar.join(', ') || 'nenhum']);
/* TODO protótipo deste set tem casca E copa — são 16 malhas glTF de duas
   primitivas. Um grupo sozinho significa que o pareamento errou, e foi assim que
   o sufixo `_1` foi pego: `tree_pk_1` (a casca do protótipo 1) virava chave
   `tree_pk` e a copa dele ficava sozinha em `tree_pk_1`. */
out.push(['todo protótipo formou par', semPar.length === 0]);
out.push(['  instâncias com casca ≠ copa', divergentes]);
out.push(['casca e copa sempre concordam', divergentes === 0]);
out.push(['  plantas escondidas inteiras', plantasOcultas]);
out.push(['  plantas em meio caminho (não deveria haver)', plantasParciais]);
out.push(['nenhuma planta em transparência PARCIAL', plantasParciais === 0]);

/* ---- NADA ATRÁS DO CAMINHÃO PODE SUMIR ----
   Relato: *"agora as arvores estao sendo escondidas mesmo atras do caminhao, e
   nao deveria"*. A causa era comparar a profundidade do candidato com o FUNDO da
   caixa do conjunto: olhando ao longo do comprimento, o caminhão tem 19 m de
   profundidade na tela, então tudo dentro desses 19 m que encostasse na silhueta
   sumia — inclusive o que está metros atrás dele. A trava reproduz a pose do
   relato (lente atrás, rua descendo) e mede, para cada objeto escondido, a
   profundidade dele contra a FRENTE do conjunto. */
{
  await pose([0, 4.5, 62], [0, 2.2, 20], 60);
  for (let i = 0; i < 40; i++) await B.frame();
  const cam = new THREE.Vector3();
  S.camera.getWorldPosition(cam);
  /* A frente do conjunto: a distância da lente ao ponto mais próximo da caixa. */
  /* A caixa do conjunto vem do próprio módulo — é EXATAMENTE a que ele julga
     contra, e reconstruí-la aqui por nome de nó já falhou (o nó não se chama
     `ts-vehicle`). */
  const cxa = L.getSeeThrough().alvoCaixa;
  const alvo = new THREE.Box3();
  const temAlvo = !!cxa;
  if (cxa) {
    alvo.min.set(cxa[0], cxa[1], cxa[2]);
    alvo.max.set(cxa[3], cxa[4], cxa[5]);
  }
  out.push(['pose de trás: caixa do conjunto medida', temAlvo]);
  const dirCam = new THREE.Vector3();
  S.camera.getWorldDirection(dirCam);
  const prof = (p) => p.clone().sub(cam).dot(dirCam);
  let frente = Infinity;
  if (temAlvo) {
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(
        (i & 1) ? alvo.max.x : alvo.min.x,
        (i & 2) ? alvo.max.y : alvo.min.y,
        (i & 4) ? alvo.max.z : alvo.min.z);
      frente = Math.min(frente, prof(c));
    }
  }
  out.push(['  frente do conjunto (m da lente)', r1(frente)]);

  /* Toda instância de planta escondida, e a profundidade do canto mais próximo. */
  let atras = 0, ocultas = 0;
  const exemplos = [];
  const m4 = new THREE.Matrix4();
  const pw = new THREE.Vector3();
  set.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData || !o.userData.tsSee) return;
    const a = o.geometry.getAttribute('aSeeHide');
    if (!a) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (let i = 0; i < o.count; i++) {
      if (a.array[i] < 0.5) continue;
      ocultas++;
      o.getMatrixAt(i, m4);
      let dmin = Infinity;
      for (let k = 0; k < 8; k++) {
        pw.set((k & 1) ? bb.max.x : bb.min.x, (k & 2) ? bb.max.y : bb.min.y,
          (k & 4) ? bb.max.z : bb.min.z).applyMatrix4(m4).applyMatrix4(o.matrixWorld);
        dmin = Math.min(dmin, prof(pw));
      }
      if (dmin > frente + 0.1) {
        atras++;
        if (exemplos.length < 6) exemplos.push(`${o.name}#${i} a ${r1(dmin)} m`);
      }
    }
  });
  out.push(['  plantas escondidas nesta pose', ocultas]);
  out.push(['  escondidas ATRÁS da frente do conjunto', atras]);
  exemplos.forEach((e, i) => out.push([`    atrás ${i}`, e]));
  out.push(['nada atrás do conjunto é escondido', atras === 0]);
}

/* ---- A SOMBRA SAI COM O OBJETO ----
   Relato: *"a sombra continua no caminhao mesmo quando a arvore esta
   escondida"*. A alavanca é `customDepthMaterial` — e não `castShadow`, que é por
   MALHA e apagaria a sombra de todas as árvores da espécie. */
{
  let comDepth = 0, semDepth = 0, injetado = 0;
  const semNome = [];
  set.traverse((o) => {
    if (!o.isMesh || !o.userData || !o.userData.tsSee) return;
    if (o.customDepthMaterial) {
      comDepth++;
      const dm = o.customDepthMaterial;
      /* A injeção tem de estar lá, e a MÁSCARA também: sem `map`/`alphaTest` a
         copa projeta um cartão retangular sólido (MASK 0,38 no set). */
      const temInj = typeof dm.customProgramCacheKey === 'function'
        && /ts-see/.test(String(dm.customProgramCacheKey.call(dm)));
      const mm = Array.isArray(o.material) ? o.material[0] : o.material;
      const precisaMascara = !!(mm && mm.alphaTest > 0);
      const temMascara = !precisaMascara || (dm.alphaTest > 0 && !!dm.map);
      if (temInj && temMascara) injetado++;
    } else {
      semDepth++;
      if (semNome.length < 6) semNome.push(o.name || '?');
    }
  });
  out.push(['malhas com material de profundidade próprio', comDepth]);
  out.push(['  sem', semDepth]);
  semNome.forEach((n, i) => out.push([`    sem ${i}`, n]));
  out.push(['toda malha que atravessa tem sombra própria', semDepth === 0]);
  out.push(['  com injeção E máscara', injetado]);
  out.push(['a sombra própria carrega injeção e máscara', injetado === comDepth]);
}

/* ======================= 2. O CÉU DE NOITE ======================= */
out.push(['— céu —', '']);
const sb0 = L.getSkyBlend ? L.getSkyBlend() : null;
out.push(['mistura exposta no handle', !!sb0]);
out.push(['par de céus montado', !!(sb0 && sb0.ativo)]);
if (sb0) out.push(['  tamanho do alvo', JSON.stringify(sb0.tamanho)]);

if (sb0 && sb0.ativo) {
  const bakes0 = L.getSkyBlend().bakes;
  L.setHourOfDay(12, { animate: false });
  for (let i = 0; i < 4; i++) await B.frame();
  out.push(['peso a 12:00', r2(L.getSkyBlend().peso)]);
  out.push(['12:00 é céu de dia puro', L.getSkyBlend().peso === 0]);
  L.setHourOfDay(24, { animate: false });
  for (let i = 0; i < 4; i++) await B.frame();
  out.push(['peso a 24:00', r2(L.getSkyBlend().peso)]);
  out.push(['24:00 é céu de noite puro', L.getSkyBlend().peso === 1]);
  L.setHourOfDay(18.2, { animate: false });
  for (let i = 0; i < 4; i++) await B.frame();
  const meioPeso = L.getSkyBlend().peso;
  out.push(['peso a 18:12 (poente)', r2(meioPeso)]);
  /* A CURVA MANTÉM O POENTE SEM LUA — a trava que o cabeçalho de skyblend.ts
     mede (pico 55 633 da lua contra 33 do sol domado do `_puresky`).
     ⚠️ O MECANISMO MUDOU EM 2026-08-24 E O LIMITE FICOU MAIS APERTADO, não mais
     frouxo: o peso saía de `smoothstep(nightness, 0,25…0,95)` e passou a sair da
     ALTITUDE do sol (`skyMixAt()`, banda +10°…−12°), porque `nightness` satura
     às 19:20 e o céu ficava congelado de lá até as 24:00 — ver §47.3 do
     ARCHITECTURE.md. Às 18:12, com o sol ainda a +3,5°, o peso caiu de 0,34 para
     0,21. O teto de 0,35 desta linha continua valendo e agora com folga. */
  out.push(['18:12 ainda é quase todo de dia', meioPeso < 0.35]);

  /* A VARREDURA. Anda o relógio de 12 a 24 em passos de 0,25 h (o passo do
     controle) e conta reassaduras de PMREM: sem limitador seriam 48. */
  const antes = L.getSkyBlend().bakes;
  for (let h = 12; h <= 24; h += 0.25) {
    L.setHourOfDay(h, { animate: false });
    await B.frame();
  }
  /* Folga para a reassadura ATRASADA cair — é ela que garante o estado final. */
  for (let i = 0; i < 40; i++) await B.frame();
  const fim = L.getSkyBlend();
  out.push(['reassaduras de PMREM numa varredura 12→24', fim.bakes - antes]);
  out.push(['  (48 passos de relógio)', '']);
  out.push(['PMREM limitado por taxa (≤ 20)', fim.bakes - antes <= 20]);
  /* A TRAVA QUE IMPORTA não é "quantas", é "a última chegou". O limitador pode
     legitimamente coalescer a varredura inteira em três reassaduras se os
     quadros forem rápidos; o que NUNCA pode acontecer é o reflexo ficar parado
     numa mistura que não é a da tela. `passoAssado` é o passo que está de fato
     no PMREM, e ele tem de bater com o peso que o fundo está mostrando. */
  out.push(['  peso na tela', r2(fim.peso)]);
  out.push(['  passo no PMREM', fim.passoAssado]);
  out.push(['reflexo assentou no peso da tela',
    fim.passoAssado === Math.round(fim.peso * 12)]);
  out.push(['  bakes desde a montagem', fim.bakes - bakes0 >= 0]);
}

/* ======================= 3. AS LUMINÁRIAS DO SET ======================= */
out.push(['— postes —', '']);
const info = L.getLampInfo ? L.getLampInfo() : null;
out.push(['info de poste no handle', !!info]);
if (info) {
  out.push(['  layout', info.lampLayout && info.lampLayout.layout]);
  out.push(['  luminárias do cenário', info.lampSites]);
  out.push(['  vidros acesos montados', info.lampSiteLenses]);
  out.push(['  geometria medida', JSON.stringify(info.lampSiteGeo)]);
  out.push(['  altura de montagem (m)', r2(info.lampHeight)]);
  out.push(['  compensação E=I/h²', r2(info.lampIntensityScale)]);
  out.push(['layout é o do cenário', info.lampLayout && info.lampLayout.layout === 'set']);
  out.push(['onze luminárias medidas', info.lampSites === 11]);
  out.push(['todas com vidro', info.lampSiteLenses === info.lampSites]);
  out.push(['altura medida ≈ 10 m', info.lampHeight > 9.5 && info.lampHeight < 10.6]);
  /* O VIDRO DENTRO DA LUMINÁRIA, e não acima dela. A luminária deste set tem
     0,336 m de altura (medido: y 9,692…10,028), então a distância do vidro ao
     topo tem de cair nessa ordem de grandeza. Foi assim que apareceu o erro de
     40 cm do mastro enterrado: `lensY` dava 10,09 contra um topo de 10,43. */
  const g = info.lampSiteGeo;
  const folga = g ? info.lampHeight - g.lensY : NaN;
  out.push(['  topo − vidro (m)', r2(folga)]);
  out.push(['vidro dentro da luminária (0,15…0,60 m do topo)',
    folga > 0.15 && folga < 0.6]);
  out.push(['  alcance do braço (m)', g ? r2(g.outreach) : null]);
  out.push(['braço entre 1,5 e 2,6 m', !!g && g.outreach > 1.5 && g.outreach < 2.6]);
}

/* OS BRAÇOS APONTAM PARA A RUA. É o defeito do .glb que scenery.ts conserta:
   quatro dos seis mastros do lado oeste tinham 180° e iluminavam o mato. */
const mastros = [];
set.traverse((o) => {
  if (!o.isMesh || !/^mast_/i.test(o.name || '')) return;
  const p = new THREE.Vector3();
  o.getWorldPosition(p);
  const d = new THREE.Vector3(1, 0, 0).transformDirection(o.matrixWorld);
  mastros.push({ n: o.name, x: r1(p.x), z: r1(p.z), bx: r2(d.x) });
});
mastros.sort((a, b) => a.z - b.z);
out.push(['mastros', mastros.length]);
out.push(['  x de cada um', mastros.map((m) => m.x).join(' ')]);
out.push(['  braço·x de cada um', mastros.map((m) => m.bx).join(' ')]);
const errados = mastros.filter((m) => m.x * m.bx > 0);
out.push(['  braços virados para fora da rua', errados.length]);
out.push(['todo braço aponta para a rua', mastros.length > 0 && errados.length === 0]);

/* O REFLETOR DENTRO DA LUMINÁRIA. Para cada spot ativo, acha o mastro mais
   próximo em planta e mede a distância vertical do spot ao topo dele. */
const spots = [];
scene.traverse((o) => {
  if (o.isSpotLight && o.visible && o.intensity > 0.01) {
    const p = new THREE.Vector3();
    o.getWorldPosition(p);
    spots.push(p);
  }
});
out.push(['refletores acesos (à noite)', spots.length]);

/* NENHUM VIDRO SEM POSTE. Foi o defeito fotografado às 20:00: atravessar uma
   torre apaga o mastro (que recebe a injeção do shader) e deixava o vidro aceso
   flutuando no céu, porque o vidro é geometria do engine e não recebe injeção.
   A trava é geométrica e não depende do vínculo interno: para cada vidro VISÍVEL,
   o mastro sob ele tem de estar visível também — e "visível" para um mastro
   atravessado é `uSeeHide < 0,5`. */
await pose([26, 6.5, 34], [0, 2.2, 12], 60);
for (let i = 0; i < 40; i++) await B.frame();
{
  const lentes = [];
  scene.traverse((o) => {
    if (o.name === 'ts-lamp-site-lenses') {
      for (const c of o.children) {
        const p = new THREE.Vector3();
        c.getWorldPosition(p);
        lentes.push({ vis: c.visible, x: p.x, z: p.z });
      }
    }
  });
  const mastrosVis = [];
  set.traverse((o) => {
    if (!o.isMesh || !/^mast_/i.test(o.name || '')) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    const u = mm[0] && mm[0].userData && mm[0].userData.tsSeeU;
    const p = new THREE.Vector3();
    o.getWorldPosition(p);
    mastrosVis.push({ x: p.x, z: p.z, hide: u ? u.value : 0 });
  });
  let orfas = 0;
  for (const l of lentes) {
    if (!l.vis) continue;
    /* O mastro do vidro é o mais próximo em planta — o braço desloca o vidro
       ~2 m, e as torres estão a 27 m uma da outra. */
    let melhor = null, d2 = Infinity;
    for (const m of mastrosVis) {
      const d = (m.x - l.x) ** 2 + (m.z - l.z) ** 2;
      if (d < d2) { d2 = d; melhor = m; }
    }
    if (melhor && melhor.hide >= 0.5) orfas++;
  }
  out.push(['vidros de luminária em cena', lentes.length]);
  out.push(['  visíveis nesta pose', lentes.filter((l) => l.vis).length]);
  out.push(['  mastros escondidos nesta pose',
    mastrosVis.filter((m) => m.hide >= 0.5).length]);
  out.push(['  vidros ÓRFÃOS (aceso sem poste)', orfas]);
  out.push(['nenhum vidro aceso sem o poste dele', orfas === 0]);
}

/* ======================= 4. AS LANTERNAS DO VEÍCULO ======================= */
out.push(['— lanternas do veículo —', '']);
const vl = L.getVehicleLights ? L.getVehicleLights() : null;
out.push(['exposto no handle', !!vl]);
if (vl) {
  out.push(['  materiais de lâmpada achados', vl.materiais]);
  out.push(['  raízes', vl.raizes.join(' | ')]);
  out.push(['achou lâmpada nos dois veículos', vl.raizes.length >= 2]);
  out.push(['achou material de lâmpada', vl.materiais > 0]);

  const ler = async (h) => {
    L.setHourOfDay(h, { animate: false });
    for (let i = 0; i < 4; i++) await B.frame();
    return L.getVehicleLights();
  };
  const a1745 = await ler(17.75);
  const a1800 = await ler(18.0);
  const a1830 = await ler(18.5);
  const a1900 = await ler(19.0);
  out.push(['nível 17:45', r2(a1745.nivel)]);
  out.push(['nível 18:00', r2(a1800.nivel)]);
  out.push(['nível 18:30', r2(a1830.nivel)]);
  out.push(['nível 19:00', r2(a1900.nivel)]);
  out.push(['apagadas às 17:45', a1745.nivel === 0]);
  out.push(['acendendo às 18:30', a1830.nivel > 0.4 && a1830.nivel < 1]);
  out.push(['cheias às 19:00', a1900.nivel === 1]);
  out.push(['  acesas às 19:00', a1900.acesas]);
  out.push(['toda lâmpada acesa às 19:00', a1900.acesas === a1900.materiais]);

  /* O FAROL FRONTAL. Relato: *"falta a luz frontal"*. A causa era a lente branca
     do FH (`f_light_chs_mat_0004_lights_w`) chegar SEM `emissiveFactor`, então a
     regra da declaração do bake não a achava. A trava é nominal de propósito —
     é o material que faltava, e ele tem de estar aceso. */
  /* A lista vem do MÓDULO, e não de uma varredura da cena: `emissiveIntensity`
     nasce em 1 em todo `MeshStandardMaterial`, então varrer a cena por
     "intensity > 0" acusa metade do caminhão — foi o que a primeira versão desta
     trava fez, e ela reprovou o painel de instrumentos que o bake já acende
     sozinho desde sempre. O que se quer afirmar é o que NÓS registramos. */
  const nomes = [...new Set(a1900.nomes)].sort();
  out.push(['materiais acesos às 19:00', nomes.join(', ')]);
  out.push(['a lente do farol dianteiro acende',
    nomes.some((n) => /f_light|farol|faror|_lights_w/i.test(n))]);
  out.push(['a lanterna traseira do cavalo acende',
    nomes.some((n) => /r_light|r_bumper|rear/i.test(n))]);
  out.push(['a lanterna do implemento acende',
    nomes.some((n) => /lanterna|sinaleira|led-/i.test(n))]);
  out.push(['nenhum material de INTERIOR acende',
    !nomes.some((n) => /interior|dashboard|_gps|button|intlight/i.test(n))]);
  out.push(['nenhum SUPORTE de farol acende',
    !nomes.some((n) => /galvanized|plain_grey/i.test(n))]);
  /* ⚠️ A TRAVA "nenhum material com pisca no nome acende" FOI RETIRADA, e a razão
     é o defeito que ela mascarava. Medido no `trailer.glb`: o material
     `lanterna-pisca-quadrado(LEDs)` é usado por DEZ peças chamadas
     `lanterna-lateral-chassis(leds)-001…010` (x ±1,30 · y 1,28, sob o frame) —
     são as lanternas de POSIÇÃO da lateral, e quem autorou reusou nelas o
     material do pisca quadrado. A trava por nome de material as mantinha
     apagadas, que é o relato *"na lateral possui 4 lanternas em cada lateral"*.

     O que se afirma agora é o veredito POR PEÇA, que é a regra nova: o pisca de
     verdade (`lanterna-pisca-circular`, peças `-D`/`-E`, na frente) continua
     apagado, e as dez de posição acendem. */
  out.push(['as lanternas de POSIÇÃO da lateral acendem',
    nomes.some((n) => /lanterna-pisca-quadrado/i.test(n))]);
  /* ⚠️ ESTA TRAVA FOI INVERTIDA, e a inversão é o relato *"essa da frontal do
     implemento nao acende"*. Medido no `trailer.glb`, na face dianteira
     (z local 7,25): `lanterna-pisca-circular-E` em x 1,12…1,21 e `-D` em
     x −1,21…−1,12, y 1,32…1,41 — uma redonda de 9 cm em cada quina inferior da
     FRENTE do baú. Um semirreboque **não tem seta dianteira**: aquilo é lanterna
     de POSIÇÃO, e quem autorou reusou a peça do pisca circular. */
  out.push(['a lanterna redonda da FRENTE do implemento acende',
    nomes.some((n) => /pisca-circular/i.test(n))]);
  {
    const d = (a1900.detalhe || {})['lanterna-pisca-circular'] || '';
    out.push(['  lanterna da frente do implemento', d]);
    out.push(['ela é ÂMBAR (lente âmbar, posição dianteira)', /cor ff8f16/.test(d)]);
  }
  out.push(['nenhum blinker de cavalo com farol ao lado acende',
    !nomes.some((n) => /truck_mat_\d+_pisca/i.test(n))]);
  out.push(['nenhuma luz de FREIO ou RÉ acende',
    !nomes.some((n) => /brake|freio|reverse|marcha.?re|backup/i.test(n))]);
  out.push(['a lanterna VERMELHA do implemento acende',
    nomes.some((n) => /vermelho|VERMELHO|sinaleira/i.test(n))]);
  /* AS DELIMITADORAS DO RUFO. Relato: *"essa da traseira do implemento tambem
     esta pior"* — as seis ovais do rufo saíam BRANCAS porque `INTERNA_RE` casava
     "interna" e as classificava como luz de carga. Medido, elas estão em
     x ±1,21 e y 4,04: quina superior EXTERNA, ou seja delimitadoras laterais. */
  out.push(['as delimitadoras do rufo acendem',
    nomes.some((n) => /lanterna-interna-lente/i.test(n))]);
  {
    const d = (a1900.detalhe || {})['lanterna-interna-lente'] || '';
    out.push(['  delimitadora do rufo', d]);
    out.push(['as delimitadoras do rufo são ÂMBAR, não brancas',
      /cor ff8f16/.test(d)]);
  }

  /* AS CORES, que é o que o dono do produto especificou: vermelho atrás, âmbar na
     lateral, branco na frente. A cor sai da POSIÇÃO da peça na raiz dela, então a
     trava lê `zRel` junto com a cor e reprova a combinação impossível. */
  out.push(['— cor por posição —', '']);
  let corErrada = 0;
  for (const [n, d] of Object.entries(a1900.detalhe || {})) {
    out.push([`  ${n}`, d]);
    const mz = /zRel ([\d.]+)/.exec(d);
    const mc = /cor ([0-9a-f]{6})/.exec(d);
    if (!mz || !mc) continue;
    const z = parseFloat(mz[1]);
    const c = mc[1];
    const vermelho = /^ff1608$/.test(c);
    const ambar = /^ff8f16$/.test(c);
    const branco = /^fff4e2$/.test(c);
    /* O NOME manda quando declara cor (ver corDoNome), então a trava só reprova
       quem NÃO declara — senão ela reprovaria a regra que a corrige. */
    const declara = /vermelho|red|laranja|ambar|amarel|branco|white|interna/i.test(n);
    if (declara) continue;
    if (z > 0.8 && !vermelho && !branco) corErrada++;       // branco = farol
    if (z > 0.2 && z < 0.8 && !ambar && !branco) corErrada++;
  }
  out.push(['  combinações posição/cor impossíveis', corErrada]);
  out.push(['a cor de toda lâmpada bate com a posição dela', corErrada === 0]);
  out.push(['há lâmpada VERMELHA (traseira)',
    Object.values(a1900.detalhe || {}).some((d) => /cor ff1608/.test(d))]);
  out.push(['há lâmpada ÂMBAR (lateral)',
    Object.values(a1900.detalhe || {}).some((d) => /cor ff8f16/.test(d))]);
  out.push(['há lâmpada BRANCA (frente)',
    Object.values(a1900.detalhe || {}).some((d) => /cor fff4e2/.test(d))]);

  /* ======= OS FEIXES: as lâmpadas emitindo luz de verdade =======
     Pedido: *"quero que elas realmente emitam luz"*. Quatro vagas dentro do pool
     fixo de lamps.ts (que passou de 8 para 12) — ver vehicle/beams.ts e a nota
     sobre NUM_SPOT_LIGHTS ser chave de cache de programa. */
  out.push(['— feixes do veículo —', '']);
  const fb = L.getVehicleBeams ? L.getVehicleBeams() : null;
  out.push(['exposto no handle', !!fb]);
  if (fb) {
    out.push(['  reservados / criados', fb.reservados + ' / ' + fb.criados]);
    out.push(['as 4 vagas do veículo existem no pool', fb.criados === fb.reservados]);
    out.push(['  acesos às 19:00', fb.acesos]);
    /* SEIS vagas, e com um implemento engatado as seis acendem: 2 faróis, 2 na
       cauda e 2 na traseira do CAVALO contra a parede do baú (relato *"a da
       traseira do cavalo nao afeta o implemento"*). Sem implemento as duas
       últimas ficam apagadas de propósito — ver beams.ts. */
    out.push(['os 6 feixes acendem às 19:00 (com implemento)', fb.acesos === 6]);
    out.push(['os 6 feixes estão na cena às 19:00',
      fb.detalhe.every((d) => d.visivel)]);
    /* ⚠️ ESTA TRAVA PEDIA O CONTRÁRIO ATÉ 2026-08-12, e a premissa dela estava
       factualmente errada. Ela exigia `alvo[1] > 0.3` — mirar a PAREDE dianteira
       do baú, na altura da lanterna. Medido no comboio real: as lanternas
       traseiras do cavalo ficam em z 5,12…5,20 e a parede dianteira do baú em
       z 2,71, ou seja **2,6 m À FRENTE da fonte**. Uma carreta engatada avança
       por cima do cavalo; não há parede atrás daquelas lâmpadas, há CHÃO a 0,74 m
       abaixo. Com o alvo na horizontal o cone acertava o trem de pouso a
       centímetros (relato *"muito focal"*) e o resto caía longe (*"no chao, ela
       muito longe de onde deveria estar"*). Ver o bloco TRASEIRA DO CAVALO em
       vehicle/beams.ts. */
    out.push(['a traseira do cavalo mira o CHÃO atrás dela, não uma parede',
      fb.detalhe[4].alvo[1] < 0.05 && fb.detalhe[4].alvo[2] > fb.detalhe[4].pos[2]]);
    fb.detalhe.forEach((d, i) => out.push([`  feixe ${i}`,
      `${d.cor} · int ${d.intensidade} · pos ${d.pos.join(',')} → ${d.alvo.join(',')}`]));
    /* O FAROL APONTA PARA A FRENTE E A LANTERNA PARA TRÁS. +Z é a traseira no
       mundo (ver a convenção do engate), então o alvo do farol tem de estar em z
       MENOR que a fonte e o da lanterna em z MAIOR. É a trava que pega o sinal
       trocado, que é o erro fácil deste arquivo. */
    /* ⚠️ O FEIXE NASCE NA ALTURA DE UM FAROL. Esta é a trava do defeito mais
       grave da rodada de 2026-08-12: `getVehicleLightSpans()` dava ao feixe a
       altura da lâmpada mais DIANTEIRA, e em ~20 dos 49 bakes essa lâmpada é o
       QUEBRA-SOL. Medido no Scania R 2009, os dois faróis nasciam em y = 2,98 m —
       o feixe saía do teto da cabine. 1,70 é o teto da janela de farol usada por
       `promoverFarolGeometrico()`; nos 23 bakes que declaram farol o centro medido
       vai de 0,58 a 1,26 m. */
    out.push(['o farol nasce na altura de um FAROL, não do quebra-sol',
      fb.detalhe.slice(0, 2).every((d) => d.pos[1] > 0.2 && d.pos[1] < 1.7)]);
    out.push(['o farol aponta para a FRENTE (−z)',
      fb.detalhe.slice(0, 2).every((d) => d.alvo[2] < d.pos[2] - 1)]);
    out.push(['a lanterna traseira aponta para TRÁS (+z)',
      fb.detalhe.slice(2, 4).every((d) => d.alvo[2] > d.pos[2] + 1)]);
    /* Os QUATRO PRIMEIROS miram o chão; o par 4/5 (traseira do cavalo) mira a
       PAREDE do baú de propósito — ver a trava logo acima e beams.ts. */
    out.push(['farol e cauda miram o CHÃO (y = 0)',
      fb.detalhe.slice(0, 4).every((d) => d.alvo[1] === 0 && d.pos[1] > 0.2)]);
    out.push(['o farol é branco e a lanterna é vermelha',
      fb.detalhe[0].cor === 'fff4e2' && fb.detalhe[2].cor === 'ff1608']);
    const a1745b = (L.setHourOfDay(17.75, { animate: false }),
      await B.frame(), await B.frame(), L.getVehicleBeams());
    out.push(['os feixes ficam apagados às 17:45', a1745b.acesos === 0]);
    L.setHourOfDay(19.0, { animate: false });
    for (let i = 0; i < 4; i++) await B.frame();
  }

  /* ======= A FITA REFLETIVA ======= */
  out.push(['— fita refletiva —', '']);
  const rr = L.getRetroreflective ? L.getRetroreflective() : null;
  out.push(['exposto no handle', !!rr]);
  if (rr) {
    out.push(['  materiais de fita injetados', rr.materiais]);
    out.push(['  lóbulo', `k ${rr.k} · ganho ${rr.ganho} · base ${rr.base}`]);
    out.push(['a fita 3M recebeu a retrorreflexão', rr.materiais >= 2]);
  }

  /* ======= A CAPA DO FAROL =======
     Relato: *"tem o feixe de luz, mas nao sai da frontal"*. O feixe estava certo
     (medido: nasce em z −0,82, a face dianteira do conjunto); quem estava apagada
     era a LENTE, atrás de `cabin_mat_0006_glass_ex` — uma malha SÓ com para-brisa,
     janela e capa de farol. Ver vehicle/headlight-cover.ts. */
  /* ======= O HALO =======
     Relato de 2026-08-12: *"essa lanterna do implemento nao emite luz, ela
     deveria mostrar um pouco da luz ao redor dela, sutil"*. Ver vehicle/halo.ts.

     ⚠️ A TRAVA DO TETO É A QUE IMPORTA. A primeira versão agrupava vértices numa
     grade e devolveu **98 sítios** num comboio, muitos sobrepostos — e
     `AdditiveBlending` soma, então três halos âmbar no mesmo pixel dão BRANCO.
     Foi o relato *"as luzes parecem estar flutuando"*. Um comboio inteiro tem
     ~30 lanternas; acima de 70 sítios alguma coisa está multiplicando. */
  out.push(['— halo —', '']);
  const ha = L.getLampHalos ? L.getLampHalos() : null;
  out.push(['exposto no handle', !!ha]);
  if (ha) {
    out.push(['  sítios / desenhados', ha.sitios + ' / ' + ha.desenhados]);
    out.push(['o halo está na cena', !!ha.naCena]);
    out.push(['há halo em número de lanterna (8…70)',
      ha.sitios >= 8 && ha.sitios <= 70]);
    out.push(['o halo acende junto com a lâmpada às 19:00', ha.nivel > 0.9]);

    /* ======= A TRAVA DO "LUZ FLUTUANDO" =======
       É a mais importante deste bloco, e a única que pega o defeito SEM olhar a
       foto. Cada halo tem de estar EM CIMA de geometria de lâmpada. O defeito de
       2026-08-12 era exatamente o contrário: o halo ia para o centro da CAIXA do
       nó, e o nó `cabin_p9` do Scania S mede y 0,50…3,40 (junta a lanterna do
       para-choque com a delimitadora do teto), então o centro dela é y = 1,95 m —
       uma luz boiando na frente do para-brisa.

       A medida é a distância de cada halo ao VÉRTICE de lâmpada mais próximo. */
    const vl2 = L.getVehicleLights();
    const pontos = [];
    const _v = new THREE.Vector3();
    const _m = new THREE.Matrix4();
    S.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      if (!mm.some((m) => m && m.name && vl2.nomes.includes(m.name))) return;
      const pos = o.geometry.getAttribute('position');
      if (!pos) return;
      const nInst = o.isInstancedMesh ? Math.min(o.count, 40) : 1;
      const passo = Math.max(1, Math.ceil((pos.count * nInst) / 3000));
      for (let i = 0; i < nInst; i++) {
        _m.copy(o.matrixWorld);
        if (o.isInstancedMesh) {
          const loc = new THREE.Matrix4();
          o.getMatrixAt(i, loc);
          _m.multiply(loc);
        }
        for (let v = 0; v < pos.count; v += passo) {
          _v.fromBufferAttribute(pos, v).applyMatrix4(_m);
          pontos.push(_v.x, _v.y, _v.z);
        }
      }
    });
    let pior = 0, piorOnde = '';
    for (const h of ha.posicoes) {
      let d2 = Infinity;
      for (let i = 0; i < pontos.length; i += 3) {
        const dx = pontos[i] - h.p[0], dy = pontos[i + 1] - h.p[1], dz = pontos[i + 2] - h.p[2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < d2) d2 = d;
      }
      const d = Math.sqrt(d2);
      if (d > pior) { pior = d; piorOnde = h.p.join(',') + ' de ' + (h.de || '?'); }
    }
    /* ======= COBERTURA: TODA LANTERNA REGISTRADA TEM HALO =======
       O relato *"continua faltando luzes nas lanternas dos cavalos"* só se mede
       assim: um material que o motor ACENDE e que não produz sítio nenhum é uma
       lanterna que brilha e não derrama. A exceção legítima são os bakes fundidos
       (um material cobrindo o caminhão inteiro), onde a geometria não diz onde a
       lâmpada está — mas o Volvo desta bancada não é um deles, então aqui a
       cobertura tem de ser total. */
    const porDe = new Map();
    for (const h of ha.posicoes) porDe.set(h.de, (porDe.get(h.de) || 0) + 1);
    const semHalo = vl2.nomes.filter((n) => !porDe.has(n));
    [...porDe.entries()].sort().forEach(([n, c]) => out.push([`  halos de ${n}`, c]));
    out.push(['  materiais de lâmpada SEM halo', semHalo.join(', ') || 'nenhum']);
    out.push(['toda lanterna registrada tem halo', semHalo.length === 0]);

    out.push(['  vértices de lâmpada amostrados', pontos.length / 3]);
    out.push(['  halo mais distante de uma lâmpada',
      Math.round(pior * 1000) / 1000 + ' m em ' + piorOnde]);
    /* 12 cm: um halo nasce no centróide de uma peça, então ele cai DENTRO da
       lâmpada; a folga cobre a amostragem de vértices e nada mais. */
    /* Os cinco piores, para o conserto não depender de adivinhação. */
    const dist = ha.posicoes.map((h) => {
      let d2 = Infinity;
      for (let i = 0; i < pontos.length; i += 3) {
        const dx = pontos[i] - h.p[0], dy = pontos[i + 1] - h.p[1], dz = pontos[i + 2] - h.p[2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < d2) d2 = d;
      }
      return { d: Math.sqrt(d2), h };
    }).sort((a, b) => b.d - a.d).slice(0, 5);
    dist.forEach((x) => out.push([`  pior ${Math.round(x.d * 1000) / 1000} m`,
      `${x.h.p.join(',')} · r ${(x.h.r || []).join('x')} · ${x.h.de || '?'}`]));

    /* ======= O HALO ACOMPANHA A LANTERNA =======
       Relato: *"o halo das lanternas principais esta muito sutil"*. Ele não
       estava fraco, estava PEQUENO: o raio saía da segunda maior medida do
       aglomerado, que numa lanterna de 0,50 x 0,13 m é a altura — halo menor que
       a lente. A trava é sobre a razão, não sobre o valor: a lanterna traseira do
       cavalo tem meio metro de lente, e o halo dela tem de ser mais largo que
       alto E mais largo que os das delimitadoras de 5 cm. */
    const larguras = ha.posicoes.map((h) => (h.r || [0, 0])[0]);
    out.push(['  halo mais largo / mais estreito',
      `${Math.max(...larguras)} / ${Math.min(...larguras)}`]);
    out.push(['o halo tem larguras DIFERENTES (acompanha a lente)',
      Math.max(...larguras) > Math.min(...larguras) * 1.8]);
    /* A régua é sobre a MAIOR lanterna, não sobre todas: o rufo do implemento tem
       delimitadoras de 5 cm que continuam — e devem continuar — com halo pequeno.
       O que o pedido cobra é que a lente de meio metro ganhe derrame à altura. */
    const tras = ha.posicoes.filter((h) => /r_bumper|r_light|painel-curva/i.test(h.de || ''));
    const maior = tras.length ? Math.max(...tras.map((h) => (h.r || [0])[0])) : 0;
    out.push(['  halo mais largo entre as principais', maior]);
    out.push(['a lanterna principal ganha halo largo (> 35 cm)', maior > 0.35]);
    out.push(['nenhum halo flutua (todos a menos de 12 cm de uma lâmpada)',
      ha.posicoes.length > 0 && pior < 0.12]);
  }

  out.push(['— capa do farol —', '']);
  const hc = L.getHeadlightCover ? L.getHeadlightCover() : null;
  out.push(['exposto no handle', !!hc]);
  if (hc) {
    hc.capas.forEach((c) => out.push([`  ${c.raiz} · ${c.mat}`,
      `nível ${c.nivel} · caixa ${c.caixa.join(',')}`]));
    out.push(['achou a capa exterior do cavalo', hc.capas.length >= 1]);
    out.push(['a capa clareia às 19:00', hc.capas.every((c) => c.nivel === 1)]);
    /* A CAIXA TEM DE SER A DO FAROL, não a do para-brisa: se ela subisse até a
       altura do vidro dianteiro, a correção clarearia a cabine inteira. O farol do
       FH vai a y 1,23; o para-brisa começa em ~1,8. */
    out.push(['a caixa da capa não alcança o para-brisa',
      hc.capas.every((c) => c.caixa[4] < 1.6)]);
  }
}

/* ======= AS LANTERNAS PELA INTENSIDADE DA CENA =======
   Pedido: *"quando a intensidade da luz da cena do studio estiver abaixo de 20%
   tambem deve acender as lanternas"*. É a segunda rampa de `rig.vehLights`, por
   MÁXIMO com a do relógio — ver resolveRig() em scene.ts. */
out.push(['— luzes pela chave da cena —', '']);
{
  L.setHourOfDay(12, { animate: false });
  /* O cursor do HUD anda de 15 % a 250 %; 0,15 é o fim do curso. */
  const nivelEm = async (b) => {
    L.setLightParams({ brightness: b });
    for (let i = 0; i < 8; i++) await B.frame();
    return L.getVehicleLights().nivel;
  };
  const n100 = await nivelEm(1.0);
  const n30 = await nivelEm(0.30);
  const n18 = await nivelEm(0.18);
  const n15 = await nivelEm(0.15);
  out.push(['  nível a 100 % / 30 % / 18 % / 15 %',
    [n100, n30, n18, n15].map((v) => Math.round(v * 100) / 100).join(' · ')]);
  out.push(['ao MEIO-DIA com a chave cheia, apagadas', n100 < 0.02]);
  out.push(['ainda apagadas a 30 %', n30 < 0.02]);
  out.push(['acendendo abaixo de 20 %', n18 > 0.3]);
  out.push(['a pleno no fim do curso (15 %)', n15 > 0.95]);
  L.setLightParams({ brightness: 1.0 });
  L.setHourOfDay(19, { animate: false });
  for (let i = 0; i < 6; i++) await B.frame();
}

/* ======================= AS FOTOS ======================= */
out.push(['— fotos —', '']);
async function foto(nome, h, eye, tgt) {
  L.setHourOfDay(h, { animate: false });
  await pose(eye, tgt, 14);
  for (let i = 0; i < 22; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([nome, await toURL(res.blob)]);
}
L.applyPreset('ensolarado', { animate: false });
/* Três-quartos de trás, a rua descendo — é onde a fileira de postes aparece. */
const OLHO = [26, 6.5, 34], MIRA = [0, 2.2, 12];
await foto('n1_1745_abertura', 17.75, OLHO, MIRA);
await foto('n2_1830_acendendo', 18.5, OLHO, MIRA);
await foto('n3_2000_noite', 20.0, OLHO, MIRA);
await foto('n4_2400_meia_noite', 24.0, OLHO, MIRA);
/* De perto, atrás: é a foto que mostra lanterna traseira e placa. */
await foto('n5_2100_traseira', 21.0, [-4, 2.2, 45], [0, 2.0, 30]);
/* A LATERAL do implemento e a TRASEIRA do cavalo, as duas que o dono do produto
   apontou. Poses tiradas da caixa do conjunto, não a olho. */
{
  const c = L.getSeeThrough().alvoCaixa;
  if (c) {
    const meio = (c[2] + c[5]) / 2;
    await foto('n9_2100_lateral_implemento', 21.0,
      [c[3] + 5.5, 1.6, meio + 2.0], [c[3] - 0.4, 1.5, meio]);
    /* A traseira do cavalo fica onde o implemento começa — ~4 m depois da frente. */
    await foto('n10_2100_tras_cavalo', 21.0,
      [c[3] + 4.2, 1.5, c[2] + 1.2], [c[3] - 0.8, 1.2, c[2] + 4.6]);
  }
}
/* À FRENTE do cavalo — e a pose sai da caixa do conjunto, não de números
   cravados: a primeira tentativa foi a olho e enquadrou a lateral da carreta. O
   cavalo fica na ponta de MENOR z (ver o engate), então a lente vai uns metros
   antes dela, na altura do para-brisa. */
{
  const c = L.getSeeThrough().alvoCaixa;
  if (c) {
    const cxm = (c[0] + c[3]) / 2;
    await foto('n7_2100_frente', 21.0,
      [cxm + 3.2, 2.2, c[2] - 7.0], [cxm, 1.7, c[2] + 1.0]);
    /* E a traseira bem de perto, para a cor da lanterna. */
    await foto('n8_2100_lanterna', 21.0,
      [cxm + 1.4, 1.4, c[5] + 4.2], [cxm + 0.4, 1.15, c[5]]);
    /* A POÇA DO FAROL no asfalto — e a `n7` NÃO serve para isto, o que só ficou
       claro olhando: ela põe a lente na FRENTE do caminhão olhando para trás,
       então o feixe cai atrás da câmera e a foto mostra um farol aceso sobre um
       chão escuro. Esta olha de lado e de cima, com a mira no chão a ~16 m à
       frente, que é onde `beams.ts` manda o cone (alvo em z0 − 22 m). */
    await foto('n11_2100_farol_no_chao', 21.0,
      [cxm + 5.5, 2.6, c[2] - 30.0], [cxm, 0.5, c[2] - 8.0]);
  }
}
/* E a que mostra o atravessar à noite, do outro lado do galpão. */
await foto('n6_2100_atraves', 21.0, [46, 3, -4], [0, 2, 12]);

L.setHourOfDay(17.75, { animate: false });
S.controls.enabled = true;
return out;
