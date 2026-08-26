/* ▶▶ PORTÃO — O CONJUNTO DO ESTEPE ANDA INTEIRO, NAS QUATRO CONFIGURAÇÕES.
   ===========================================================================
   *"garanta que não irá mover novamente componentes que são um conjunto
   separadamente para não quebrar mais as coisas"* — Kennedy, 2026-08-25.

   A régua é o TOCO, que não anda: lá o conjunto está intacto e mediu-se, com
   `componentesSoldados()`, quais peças o formam. As seis ASSINATURAS abaixo são
   dessa medição — tamanhos de componente SOLDADO, que sobrevivem tanto ao rip
   (8x2) quanto ao recorte (6x2/6x4/4x2).

   O portão pergunta duas coisas por configuração:

     A · cada assinatura está na cota NOVA (mesma posição RELATIVA ao centro do
         estepe que ela tem no toco, ±6 mm) — ou seja, andou junto;
     B · e NÃO está na cota VELHA (a mesma relativa, deslocada de −dz).

   B é o que a foto acusava: o miolo do berço na cota nova e as tiras da mesma
   peça na velha.

   ⚠️ A CONTA É EM POSIÇÃO RELATIVA, e não em "cabe na laje nova / cabe na laje
   velha". As duas lajes se SOBREPÕEM (a laje tem 1 192 mm e o passo é 300 ou
   400), e um teste de contenção acusava o amortecedor `chassis_p36`, que mora
   na borda de trás e nunca teve nada a ver com o estepe.

   E o mesmo portão cobre OS RESERVATÓRIOS DE AR: eles têm de estar inteiros
   (as quatro peças soldadas na mesma cota) e encostados no tanque DO PRÓPRIO
   FLANCO, com a folga que `truck-tanks.ts` promete. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
/* O RELATO DO PRÓPRIO MOTOR. `rear-bogie.ts` e `truck-tanks.ts` dizem, em
   `console.info`, quantas peças acharam e se fecharam por falta — e um portão
   que só olha a geometria não distingue "não precisava andar" de "desistiu". */
const relato = [];
const infoOriginal = console.info.bind(console);
console.info = (...a) => { relato.push(a.map((x) => String(x)).join(' ')); infoOriginal(...a); };
const acha = (m, c) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      if (mo.id === m) for (const ch of (mo.chassis || [])) if (ch.id === c) return { mk, mo, c: ch };
  return null;
};
/* A MESMA solda do motor (`truck-wheels.ts`) e da cirurgia (`glb-surgery.cjs`):
   grade de 0,5 mm. Duas grades dariam duas listas de peças. */
const SOLDA = 5e-4;
function compsSoldados(px, idx, nVert) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let v = 0; v < nVert; v++) {
    const x = px[v * 3], y = px[v * 3 + 1], z = px[v * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  let g = SOLDA, nx, ny, nz;
  for (;;) {
    nx = Math.floor((x1 - x0) / g) + 2; ny = Math.floor((y1 - y0) / g) + 2; nz = Math.floor((z1 - z0) / g) + 2;
    if (nx * ny * nz <= Number.MAX_SAFE_INTEGER) break;
    g *= 2;
  }
  const celula = new Map(), rep = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) {
    const k = (Math.round((px[v * 3] - x0) / g) * ny + Math.round((px[v * 3 + 1] - y0) / g)) * nz
      + Math.round((px[v * 3 + 2] - z0) / g);
    const r = celula.get(k);
    if (r === undefined) { celula.set(k, v); rep[v] = v; } else rep[v] = r;
  }
  const pai = new Int32Array(rep);
  const raiz = (i) => { let r = i; while (pai[r] !== r) r = pai[r]; while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; } return r; };
  const une = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai[ra] = rb; };
  for (let q = 0; q < idx.count; q += 3) { une(rep[idx.getX(q)], rep[idx.getX(q + 1)]); une(rep[idx.getX(q + 1)], rep[idx.getX(q + 2)]); }
  const saida = new Int32Array(nVert);
  for (let v = 0; v < nVert; v++) saida[v] = raiz(rep[v]);
  return saida;
}
/* As MESMAS constantes de `rear-bogie.ts`. Se elas mudarem lá e não aqui, o
   portão passa a medir outra coisa — por isso vêm anotadas com o nome. */
/* As MESMAS constantes de `rear-bogie.ts`. */
const LAJE = { x: 0.16, yBaixo: 0.10, yAlto: 0.42, z: 0.10 };
/** Onde cada peça do conjunto mora, RELATIVA ao centro do estepe — medido no
 *  TOCO, que é onde ele está intacto (mm). */
const ASSINATURAS = [
  ['cesta',            'chassis_p18', [555, 169, 555], [[1, 164, -2]]],
  ['tirante',          'chassis_p12', [578,  55,  54], [[111, 331, 3]]],
  ['suporte',          'chassis_p12', [412, 241,  85], [[-12, 367, -103], [-12, 364, 111]]],
  ['chapa do estepe',  'chassis_p12', [319,  10, 151], [[28, 253, 2]]],
  ['prato do guincho', 'chassis_p12', [ 10, 102, 101], [[102, 331, 3]]],
  ['orelha da alma',   'chassis_p12', [121, 239, 147], [[-119, 369, 4]]],
];
/** Tolerância da caixa e da posição, em mm. O rip e o recorte quantizam
 *  diferente; 6 mm cobre isso e não cobre um passo de 300. */
const TOL = 6;
/** As quatro peças soldadas dos dois reservatórios de ar, medidas no 6x2. */
const RESERVA = [[393, 275, 274], [393, 275, 275], [210, 275, 274], [210, 265, 256]];
/** …e a folga que `FOLGA_RESERVA` promete entre eles e o tanque do flanco. */
const FOLGA_RESERVA = 100;

async function mede(chassi) {
  const alvo = acha('scania-p', chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: alvo.mk.id,
    modelId: alvo.mo.id, chassisId: alvo.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  const cab = S.state.cab, mount = S.state.cabMount;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const v = new THREE.Vector3();
  /* ⚠️ O TESTE DE "É NOSSO" É NO ANCESTRAL, e nunca no nome da malha: as malhas
     dentro do kit da roda se chamam `wheel_f_0_0_f_disc_p0001` (o nome do
     ASSET) e só o NÓ se chama `VM_WHEEL_SPARE`. Testando o nome da malha, o
     próprio estepe entrava no censo como se fosse peça de chassi. */
  const nosso = (o) => {
    for (let p = o; p; p = p.parent) if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return true;
    return false;
  };
  /* ⚠️ O TANQUE SE ACHA PELO NOME DA MALHA, e não pelo do nó: `swapTruckTanks()`
     pendura o molde num nó `TS_TANQUE_VM_*` e as malhas dentro dele se chamam
     `TANK_L_1`, `TANK_R_2`… — `getObjectByName('TANK_L')` não acha nada. */
  const caixaDoNo = (prefixo) => {
    const b = new THREE.Box3();
    cab.traverse((n) => {
      if (!n.isMesh || !n.visible || !(n.name || '').startsWith(prefixo)) return;
      const pos = n.geometry?.attributes?.position;
      if (!pos) return;
      const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(n.matrixWorld);
      for (let i = 0; i < pos.count; i += 3) b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
    });
    return b.isEmpty() ? null : b;
  };
  const cxE = caixaDoNo('VM_WHEEL_SPARE');
  const centro = cxE.getCenter(new THREE.Vector3());
  const laje = new THREE.Box3(
    new THREE.Vector3(cxE.min.x - LAJE.x, cxE.min.y - LAJE.yBaixo, cxE.min.z - LAJE.z),
    new THREE.Vector3(cxE.max.x + LAJE.x, cxE.max.y + LAJE.yAlto, cxE.max.z + LAJE.z));
  /* A região varrida cobre a laje na cota NOVA e na VELHA. */
  const dz = { '4x2r': 0, '6x2r': +0.30, '6x4r': +0.30, '8x2r': -0.40 }[chassi];
  const varre = laje.clone().union(laje.clone().translate(new THREE.Vector3(0, 0, -dz)));
  const itens = [];
  const reservas = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry || nosso(o)) return;
    const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
    if (!pos || !idx || pos.count > 260000) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const bb = o.geometry.boundingBox, cx = new THREE.Box3();
    for (let k = 0; k < 8; k++) {
      cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
        k & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
    }
    const olhaEstepe = cx.intersectsBox(varre);
    /* Os reservatórios não são nó nenhum: são componentes dentro de uma malha
       de chassi. Procura-se por FORMA, e não por assinatura fixa — a assinatura
       medida no 6x2 não vale no 8x2, que é o rip e solda diferente. */
    const olhaReserva = o.name === 'chassis_p29';
    if (!olhaEstepe && !olhaReserva) return;
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = compsSoldados(px, idx, pos.count);
    const caixas = new Map();
    for (let q = 0; q < idx.count; q += 3) {
      const r = pai[idx.getX(q)];
      let b = caixas.get(r);
      if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
      b.n++;
      for (let k = 0; k < 3; k++) { const i = idx.getX(q + k); b.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])); }
    }
    for (const b of caixas.values()) {
      const d = b.box.getSize(new THREE.Vector3());
      const it = { nome: o.name, d, faces: b.n, box: b.box,
        rel: b.box.getCenter(new THREE.Vector3()).sub(centro),
        rot: `${mm(d.x)}×${mm(d.y)}×${mm(d.z)}` };
      if (olhaEstepe && b.box.intersectsBox(varre)) itens.push(it);
      /* CORPO: cheio nos três eixos e no flanco — a mesma régua de
         `RESERVA_DIM`/`RESERVA_X` de `truck-tanks.ts`. Chapa e travessa não
         passam, e é isso que separa o reservatório do resto do chassi. */
      if (olhaReserva && Math.min(d.x, d.y, d.z) >= 0.15 && Math.max(d.x, d.y, d.z) <= 0.50
        && Math.max(Math.abs(b.box.min.x), Math.abs(b.box.max.x)) >= 0.90) reservas.push(it);
    }
  });
  const meu = relato.splice(0, relato.length);
  return { itens, reservas, dz, cxE, centro, caixaDoNo, relato: meu };
}
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const casaCaixa = (it, [x, y, z]) => perto(it.d.x * 1000, x, TOL)
  && perto(it.d.y * 1000, y, TOL) && perto(it.d.z * 1000, z, TOL);

for (const chassi of ['4x2r', '6x2r', '6x4r', '8x2r']) {
  const M = await mede(chassi);
  const doMotor = (marca) => M.relato.filter((l) => l.includes(marca)).join(' ⏎ ');
  out.push([`${chassi} · varredura`, `${M.itens.length} peça(s) soldada(s) na vizinhança do estepe`
    + ` · passo ${mm(M.dz)} mm`]);
  for (const [nome, malha, caixa, poses] of ASSINATURAS) {
    const iguais = M.itens.filter((it) => it.nome === malha && casaCaixa(it, caixa));
    const naNova = poses.filter((p) => iguais.some((it) => perto(it.rel.x * 1000, p[0], TOL)
      && perto(it.rel.y * 1000, p[1], TOL) && perto(it.rel.z * 1000, p[2], TOL))).length;
    /* ⚠️ No TOCO o passo é ZERO, então "cota velha" É a cota nova — perguntar
       as duas ali reprovaria o caminhão que serve de régua. */
    const naVelha = M.dz === 0 ? 0 : poses.filter((p) => iguais.some((it) => perto(it.rel.x * 1000, p[0], TOL)
      && perto(it.rel.y * 1000, p[1], TOL) && perto(it.rel.z * 1000, p[2] - M.dz * 1000, TOL))).length;
    out.push([`${chassi} · ${nome} anda junto`
      + ` [nova ${naNova}/${poses.length} · velha ${naVelha}`
      + ` · @ ${iguais.map((it) => `${mm(it.rel.x)},${mm(it.rel.y)},${mm(it.rel.z)}`).join(' | ') || '—'}]`,
      naNova === poses.length && naVelha === 0]);
  }
  out.push([`${chassi} · o motor não fechou por falta [${doMotor('conjunto do estepe') || 'sem relato'}]`,
    !M.relato.some((l) => l.includes('conjunto do estepe') && l.includes('NADA ANDOU'))]);

  /* ▶ OS RESERVATÓRIOS DE AR. */
  const zs = M.reservas.map((it) => it.box.max.z);
  const espalha = zs.length ? Math.max(...zs) - Math.min(...zs) : 0;
  out.push([`${chassi} · reservatórios numa cota só`
    + ` [${M.reservas.length} corpo(s) · espalhamento ${mm(espalha)} mm`
    + ` · ${M.reservas.map((it) => it.rot).join(' ')}]`,
    M.reservas.length >= 2 && espalha <= 0.020]);
  out.push([`${chassi} · reservatórios: o motor não fechou por falta`
    + ` [${doMotor('reservatórios de ar') || 'sem relato'}]`,
    !M.relato.some((l) => l.includes('reservatórios de ar') && l.includes('NADA ANDOU'))]);
  if (M.reservas.length) {
    const juntas = new THREE.Box3();
    for (const it of M.reservas) juntas.union(it.box);
    const lado = juntas.getCenter(new THREE.Vector3()).x >= 0 ? 'TANK_L' : 'TANK_R';
    const tanque = M.caixaDoNo(lado);
    /* Zn cresce para a FRENTE: a traseira do tanque é o `min.z`, a frente do
       grupo de reservatórios é o `max.z`. */
    const vao = tanque ? (tanque.min.z - juntas.max.z) * 1000 : null;
    /* ⚠️ SÓ ONDE O FLANCO AVANÇOU. No toco e no bitruck o conjunto não anda
       (`bruto < AVANCO_MIN`), e ali os reservatórios estão na cota de fábrica —
       cobrar 100 mm deles seria cobrar uma promessa que ninguém fez. */
    const avancou = M.relato.some((l) => /\[flanco\].*avanço \d/.test(l));
    out.push([`${chassi} · reservatórios encostam no tanque do flanco`
      + ` [vão ${vao === null ? '—' : vao.toFixed(0)} mm até ${lado}`
      + ` · ${avancou ? `alvo ${FOLGA_RESERVA}` : 'sem avanço de flanco: cota de fábrica'}]`,
      !avancou || (vao !== null && vao >= 0 && vao <= FOLGA_RESERVA + 40)]);
  }
}
console.info = infoOriginal;
return out;
