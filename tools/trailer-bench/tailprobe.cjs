/* O RABO DO QUADRO — onde a longarina pode ser cortada, e onde ela acaba.
   ---------------------------------------------------------------------------
       node tools/trailer-bench/tailprobe.cjs            # os três rígidos
       node tools/trailer-bench/tailprobe.cjs volvo      # um só (casa por id)

   POR QUE ESTA SONDA EXISTE
   ---------------------------------------------------------------------------
   O baú do sobrechassi cresce e o quadro do caminhão não. Medido com o
   gancheiro de fábrica (8,510 m de corpo branco), a traseira do baú cai a
   −313 mm da ponta do quadro no Volvo VM (o baú PASSA), +247 mm no VW e
   +740 mm no Scania (sobra quadro nu). Não existe comprimento de baú que
   sirva aos três — o comprimento em que ΔZ = 0 é 8,196 / 8,742 / 9,250 m —,
   então quem tem de seguir a medida é o QUADRO.

   Para esticar ou encurtar o balanço traseiro sem deformar travessa, berço de
   eixo, tanque ou cabine, é preciso saber TRÊS coisas por caminhão, e nenhuma
   delas está em `mounts.json`:

       railEndZ      onde a longarina realmente acaba
       tailEndZ      o plano mais traseiro do cacho
       cutZ + bays   onde o corte é limpo, e quanto ele absorve

   `tailEndZ` é o PLANO MAIS TRASEIRO, e não "a face do para-choque", porque
   nem sempre é o para-choque quem está atrás: no VM e no Scania é a fita
   refletiva colada nele, mas no VW a LANTERNA passa 15 mm atrás do
   para-choque. Quem tem de casar com a traseira do baú é o que o olho vê
   primeiro, e é este número.

   ⚠️ E A PRIMEIRA DELAS DESMENTE O MANIFESTO. `frameEndZ` NÃO é a ponta do
   quadro em nenhum dos três: é a face da FITA REFLETIVA do para-choque no VM
   e no Scania, e a LANTERNA no VW. A longarina acaba 89 / 173 / 50 mm antes.
   Todo relatório de balanço traseiro de hoje mede contra a coisa errada, e
   ancorar o kit traseiro por `frameEndZ` seria circular — o kit substitui
   justamente a peça que define aquele número.

   O MÉTODO
   ---------------------------------------------------------------------------
   1. Lê o GLB em espaço normalizado (`glb-node.cjs`).
   2. Recorta a REGIÃO DO RABO: tudo com z abaixo do último eixo. É o que
      torna a conta viável — o Scania inteiro tem 2,9 M de triângulos.
   3. Decompõe em COMPONENTES CONEXOS, soldando por posição a 0,5 mm. Nome de
      nó não responde "que peça é esta": no VW o caminhão inteiro está em
      `truck_p4`/`truck_p5`, e é por isso que `mountprobe.ts` (que filtra o
      quadro por /chassis|chs_base/) não acha nada lá.
   4. Classifica como LONGARINA todo componente com vão em z > 4 m e centro em
      |x| ∈ [0,20 ; 0,75]. Casa nos três e não depende de nome de nó.
   5. Varre planos de corte de 5 em 5 mm. Um plano é SEGURO quando toda
      componente NÃO-longarina que o cruza é PRISMÁTICA ali — nenhum vértice a
      menos de `PRISM_TOL` do plano. Uma quad que atravessa o plano acompanha
      a translação sem artefato; um vértice em cima dele, não.
   6. Agrupa planos seguros em JANELAS. A baia de cada janela é
      [maior z1 do que está inteiramente atrás , menor z0 do que está à
      frente], e a largura dela é a CAPACIDADE DE ENCURTAMENTO.

   O que sai daqui vai para o bloco `tail` de `mounts.json`, carimbado com
   `measuredBy`, como `frameTopY` e `cabRearZ` já são. Fazer este censo em
   runtime custaria segundos por troca de caminhão para medir algo que nunca
   muda.
*/
const path = require('path');
const fs = require('fs');
const { loadNormalized } = require('./glb-node.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const MOUNTS = path.join(WEB, 'public', 'models', 'vehicles', 'mounts.json');

/** Grade de solda, em metros — a mesma de `trailer-assembly.ts`. 0,5 mm é fino
 *  para separar peças e grosso para fechar a costura do exportador. */
const WELD = 5e-4;

/** Vão em z acima do qual um componente é LONGARINA. A mais curta dos três
 *  (VW) mede 9,62 m; a maior travessa do rabo mede 0,30. */
const RAIL_SPAN = 4.0;

/** Faixa de |x| da alma. `mounts.json` declara `railX = 0,425` nos três, e o
 *  histograma de face vertical confirma (0,425 / 0,4225 / 0,4325). */
const RAIL_X = [0.20, 0.75];

/** Quão perto do plano de corte um vértice pode estar sem tornar o plano
 *  inseguro. 100 mm: abaixo disso a peça está sendo cortada no meio de uma
 *  transição de seção, e transladar metade dela deforma. */
const PRISM_TOL = 0.10;

/** Passo da varredura do plano. */
const STEP = 0.005;

/** Componente menor que isto é respingo de malha e não entra na decisão. */
const MIN_TRIS = 4;

/** Largura mínima de uma janela para ela servir de plano de corte. Uma janela
 *  de largura zero é um plano isolado achado pela amostragem de 5 mm: corte
 *  ali depende de a geometria não se mexer um milímetro. */
const MIN_WIN = 0.05;

const mm = (v) => (v * 1000).toFixed(1);

/** Componentes conexos de uma primitiva, soldando vértices por posição. */
function components(pos, idx) {
  const key = new Map();
  const rep = new Int32Array(pos.length / 3);
  for (let v = 0; v < rep.length; v++) {
    const k = `${Math.round(pos[v * 3] / WELD)},${Math.round(pos[v * 3 + 1] / WELD)},${Math.round(pos[v * 3 + 2] / WELD)}`;
    let r = key.get(k);
    if (r === undefined) { r = v; key.set(k, v); }
    rep[v] = r;
  }
  const parent = new Int32Array(rep);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const tri = idx && idx.length ? idx : null;
  const n = tri ? tri.length : rep.length;
  for (let i = 0; i + 2 < n; i += 3) {
    const a = tri ? tri[i] : i, b = tri ? tri[i + 1] : i + 1, c = tri ? tri[i + 2] : i + 2;
    union(rep[a], rep[b]); union(rep[a], rep[c]);
  }
  const groups = new Map();
  for (let i = 0; i + 2 < n; i += 3) {
    const a = tri ? tri[i] : i;
    const r = find(rep[a]);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(tri ? tri[i] : i, tri ? tri[i + 1] : i + 1, tri ? tri[i + 2] : i + 2);
  }
  return [...groups.values()];
}

function boxOf(pos, verts) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const v of verts) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
  }
  return b;
}

async function medir(id, rig) {
  const file = path.join(WEB, 'public', rig.sourceFile);
  const { pieces } = await loadNormalized(file, rig);

  const lastAxle = Math.min(
    ...[...(rig.axles?.driveZ || []), ...(rig.axles?.liftZ || []), ...(rig.axles?.steerZ || [])],
  );
  /* A região do rabo, com folga de meio metro à frente do último eixo: é o que
     torna a decomposição viável no Scania. */
  const tailMax = lastAxle + 0.5;

  const comps = [];
  for (const p of pieces) {
    /* Peneira barata por primitiva ANTES de decompor: se nada dela entra na
       região do rabo, não há o que soldar. */
    let any = false;
    for (let v = 0; v < p.pos.length / 3 && !any; v++) if (p.pos[v * 3 + 2] < tailMax) any = true;
    if (!any) continue;
    for (const g of components(p.pos, p.idx)) {
      if (g.length / 3 < MIN_TRIS) continue;
      const b = boxOf(p.pos, g);
      if (b.z0 > tailMax) continue;
      comps.push({ node: p.node, mat: p.mat, tris: g.length / 3, verts: g, pos: p.pos, b });
    }
  }

  const isRail = (c) => (c.b.z1 - c.b.z0) > RAIL_SPAN
    && Math.abs((c.b.x0 + c.b.x1) / 2) >= RAIL_X[0]
    && Math.abs((c.b.x0 + c.b.x1) / 2) <= RAIL_X[1];
  const rails = comps.filter(isRail);
  const others = comps.filter((c) => !isRail(c));

  const railEndZ = rails.length ? Math.min(...rails.map((c) => c.b.z0)) : NaN;
  const bumperFaceZ = Math.min(...comps.map((c) => c.b.z0));

  /* A varredura. Um plano é seguro quando nenhuma componente não-longarina o
     cruza com vértice perto dele. */
  const safe = [];
  for (let z = railEndZ + STEP; z < tailMax; z += STEP) {
    let ok = true;
    for (const c of others) {
      if (c.b.z0 >= z || c.b.z1 <= z) continue;      // não cruza
      for (const v of c.verts) {
        if (Math.abs(c.pos[v * 3 + 2] - z) < PRISM_TOL) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (ok) safe.push(z);
  }

  /* Janelas contíguas de planos seguros. */
  const wins = [];
  for (const z of safe) {
    const w = wins[wins.length - 1];
    if (w && z - w.z1 <= STEP * 1.5) w.z1 = z;
    else wins.push({ z0: z, z1: z });
  }

  /* A BAIA de cada janela: até onde ela pode fechar sem que a peça de trás
     encoste na de frente. */
  for (const w of wins) {
    const zc = (w.z0 + w.z1) / 2;
    let atras = -Infinity, frente = Infinity;
    for (const c of others) {
      if (c.b.z1 <= zc && c.b.z1 > atras) atras = c.b.z1;
      if (c.b.z0 >= zc && c.b.z0 < frente) frente = c.b.z0;
    }
    w.atras = atras; w.frente = frente;
    w.bay = Number.isFinite(atras) && Number.isFinite(frente) ? frente - atras : w.z1 - w.z0;
  }
  wins.sort((a, b) => a.z0 - b.z0);          // da traseira para a frente
  const usable = wins.filter((w) => w.bay > 0.05);

  /* ⚠️ DUAS JANELAS PODEM SER A MESMA BAIA. No Scania a varredura acha quatro
     janelas seguras, mas duas delas caem entre as MESMAS duas peças — o vão é
     um só e cabe uma vez. Somar as janelas contaria 668 mm duas vezes e
     prometeria um encurtamento que a geometria não tem. A baia é identificada
     pelo par (peça de trás, peça da frente), não pela janela. */
  const bays = [];
  for (const w of usable) {
    const igual = bays.find((b) => Math.abs(b.atras - w.atras) < 1e-6 && Math.abs(b.frente - w.frente) < 1e-6);
    if (igual) { igual.wins.push(w); continue; }
    bays.push({ atras: w.atras, frente: w.frente, bay: w.bay, wins: [w] });
  }

  /* ⚠️ UMA JANELA DE LARGURA ZERO NÃO É PLANO DE CORTE. A varredura de 5 mm
     acha planos isolados onde a folga é exatamente de uma amostra; cortar ali
     depende de a geometria não se mexer um milímetro. O corte tem de nascer no
     MEIO de uma janela com margem — é a mesma razão de `REAR_TAIL` ser
     escolhido no meio do vazio e não no limite. */
  /* Cada baia contribui com UM plano de corte: o meio da janela mais LARGA
     dela. Uma baia cuja melhor janela não tem margem não vira plano — ela
     existe na geometria mas não se pode cortar ali com segurança. */
  for (const b of bays) {
    const j = [...b.wins].sort((x, y) => (y.z1 - y.z0) - (x.z1 - x.z0))[0];
    b.firme = (j.z1 - j.z0) >= MIN_WIN;
    b.z = (j.z0 + j.z1) / 2;
    b.win = j;
  }
  const cortaveis = bays.filter((b) => b.firme);
  const cutZ = cortaveis.length ? cortaveis[0].z : NaN;

  return {
    id, file: rig.sourceFile, lastAxle, railEndZ, tailEndZ: bumperFaceZ, cutZ,
    wins: usable, bays, cortaveis,
    capacidade: cortaveis.reduce((s, b) => s + b.bay, 0),
    comps: comps.length, rails: rails.length,
  };
}

(async () => {
  const man = JSON.parse(fs.readFileSync(MOUNTS, 'utf8'));
  const filtro = process.argv[2];
  const alvos = Object.entries(man.rigids).filter(([id]) => !filtro || id.includes(filtro));
  const out = {};
  for (const [id, rig] of alvos) {
    const r = await medir(id, rig);
    out[id] = {
      railEndZ: +r.railEndZ.toFixed(4),
      tailEndZ: +r.tailEndZ.toFixed(4),
      cutZ: +r.cutZ.toFixed(4),
      bays: r.cortaveis.map((b) => ({ z: +b.z.toFixed(4), cap: +b.bay.toFixed(4) })),
    };
    console.log(`\n── ${id}  (${r.comps} componentes no rabo, ${r.rails} longarina(s))`);
    console.log(`   último eixo ......... ${mm(r.lastAxle)} mm`);
    console.log(`   frameEndZ (manifesto)  ${mm(rig.frameEndZ)} mm`);
    console.log(`   tailEndZ ............ ${mm(r.tailEndZ)} mm   (o plano mais traseiro do cacho)`);
    console.log(`   railEndZ ............ ${mm(r.railEndZ)} mm   ⚠️ ${mm(r.railEndZ - rig.frameEndZ)} mm à frente de frameEndZ`);
    console.log(`   cutZ ................ ${mm(r.cutZ)} mm`);
    for (const b of r.bays) {
      const j = b.wins.map((w) => `${mm(w.z0)}…${mm(w.z1)}`).join('  +  ');
      const marca = b.firme ? `corta em ${mm(b.z)}` : 'SEM MARGEM — não vira plano';
      console.log(`     baia ${mm(b.bay)} mm   ${marca}   janela(s) ${j}`);
    }
    console.log(`   capacidade de encurtamento (só baias cortáveis): ${mm(r.capacidade)} mm`);
  }
  console.log('\n--- para mounts.json ---\n' + JSON.stringify(out, null, 2));
})();
