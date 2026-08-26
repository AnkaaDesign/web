/* O PORTÃO DA TROCA DE TANQUE, ESTEPE E LETREIRO — 2026-08-22.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-tanque-estepe-0822.mjs

   Três pedidos, no mesmo caminhão (Scania P 360, `scania_p_6x2r`):

     1. *"troque os tanques de gasolina … pelo VOlvo VM que é melhor desenhado,
        mas faça com que ele seja de inox, e também remova o texto Volvo dele"*
     2. *"troque o estepe do scania para usar uma roda / pneu da própria
        lateral, pois o estepe está muito diferente"*
     3. *"atualize esse adesivo da scania, para ser da cor dos cavalos
        basculantes, um cinza claro"*

   Cada linha `★` é um portão: `true` passa, `false` reprova. As demais são
   medidas, e as `foto-*` vão para `tools/studio-bench/shots/`. */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
await B.until(() => !!S.state.cab?.getObjectByName('TS_TANQUE_VM_D'), 120000);
for (let i = 0; i < 30; i++) await B.frame();

const cab = S.state.cab;
cab.updateWorldMatrix(true, true);
/* ⚠️ NO LOCAL DA CABINE, que é o espaço CRU do rip — é nele que os números
   medidos no `.glb` (e citados em `truck-tanks.ts`) foram tomados. Em mundo a
   cabine já carrega `orientYaw`, e o sinal de x troca de lado. */
const toCab = new THREE.Matrix4().copy(cab.matrixWorld).invert();

function caixaCab(o) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  o.updateWorldMatrix(true, true);
  o.traverse((n) => {
    if (!n.isMesh || !n.visible || !n.geometry?.attributes?.position) return;
    const a = n.geometry.attributes.position;
    m.multiplyMatrices(toCab, n.matrixWorld);
    for (let i = 0; i < a.count; i++) b.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(m));
  });
  return b.isEmpty() ? null : b;
}

/* ══════════════ 1. O TANQUE ESTÁ NO LUGAR DO ANTIGO ══════════════
   O envelope do tanque velho, medido no arquivo (`tanques_0_*`, lado a lado):

     E   x −1,237…−0,422 · y 0,225…0,964 · z 1,257…2,265
     D   x  0,426… 1,238 · y 0,233…0,972 · z 1,705…2,712

   O portão é que o tanque novo caiba nesse envelope com folga de 20 mm — é
   isso que garante que ARLA, reservatório de ar, estepe e as quebras do
   corrido da proteção lateral continuem onde estavam. */
const VELHO = {
  D: { xOut: 1.238, yTop: 0.972, z0: 1.705, z1: 2.712 },
  E: { xOut: -1.237, yTop: 0.964, z0: 1.257, z1: 2.265 },
};
/* ⚠️ A COTA VERTICAL NÃO É MAIS A DO TANQUE DE FÁBRICA. *"coloque ambos tanque
   e esse outro menor na mesma altura"* — a régua passou a ser o TOPO DO TANQUE
   DE ARLA (`chassis_p19`, `plastico_arla`), medido em y 0,895. As duas caixas
   não têm a mesma altura (658 contra 593 mm), então só uma borda pode casar, e
   a escolhida é a de cima: é por ela que as duas peças se prendem à mesma
   longarina, e é o degrau de cima que aparece na foto. Ver `ARLA_RE`. */
const ARLA_TOPO = 0.895;
/* O piso de altura livre: a ferragem do tanque que o Scania já trazia descia a
   y 0,225. O tanque novo não pode passar disso. */
const PISO_LIVRE = 0.225;
{
  const c = new THREE.Box3();
  const v6 = new THREE.Vector3();
  const m6 = new THREE.Matrix4();
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => /arla|adblue/i.test(m?.name || ''))) return;
    const a = o.geometry.attributes.position;
    m6.multiplyMatrices(toCab, o.matrixWorld);
    for (let i = 0; i < a.count; i++) c.expandByPoint(v6.fromBufferAttribute(a, i).applyMatrix4(m6));
  });
  out.push(['0 · tanque de ARLA (a régua)', c.isEmpty() ? '—'
    : `topo ${mm(c.max.y)} · fundo ${mm(c.min.y)} · altura ${mm(c.max.y - c.min.y)}`]);
  out.push(['★ 0 · o ARLA continua onde estava (topo 895 ±10 mm)',
    !c.isEmpty() && Math.abs(c.max.y - ARLA_TOPO) <= 0.010]);
}
for (const lado of ['D', 'E']) {
  const no = cab.getObjectByName(`TS_TANQUE_VM_${lado}`);
  out.push([`1 · tanque ${lado} existe`, !!no]);
  if (!no) { out.push([`★ 1 · tanque ${lado} montado`, false]); continue; }
  const b = caixaCab(no);
  const v = VELHO[lado];
  const foraNovo = lado === 'D' ? b.max.x : b.min.x;
  out.push([`1 · tanque ${lado} caixa`,
    `x ${mm(b.min.x)}…${mm(b.max.x)} · y ${mm(b.min.y)}…${mm(b.max.y)} · z ${mm(b.min.z)}…${mm(b.max.z)}`]);
  out.push([`1 · tanque ${lado} face externa`, `${mm(foraNovo)} (o velho: ${mm(v.xOut)})`]);
  out.push([`★ 1 · tanque ${lado} na face externa do velho (±20 mm)`,
    Math.abs(foraNovo - v.xOut) <= 0.020]);
  /* O topo da CASCA, e não o do envelope: a ferragem das cintas passa 19 mm por
     cima do datum e é ela que dá `b.max.y`. */
  out.push([`★ 1 · tanque ${lado} com o topo do ARLA (casca, ±20 mm)`,
    Math.abs((b.max.y - 0.019) - ARLA_TOPO) <= 0.020]);
  out.push([`★ 1 · tanque ${lado} não desce abaixo do piso do rip (y ${mm(PISO_LIVRE)})`,
    b.min.y >= PISO_LIVRE]);
  out.push([`★ 1 · tanque ${lado} dentro do vão em z do velho (folga 20 mm)`,
    b.min.z >= v.z0 - 0.020 && b.max.z <= v.z1 + 0.020]);
  /* A SEÇÃO É 1:1 — é ela que o dono vê de perfil, e é o que o encolhimento em
     z existe para preservar. O tanque do VM tem 0,718 × 0,677 de casca. */
  out.push([`1 · tanque ${lado} seção`, `${mm(b.max.x - b.min.x)} × ${mm(b.max.y - b.min.y)}`]);
  out.push([`★ 1 · tanque ${lado} com a seção do VM (largura ≥ 700 mm)`,
    (b.max.x - b.min.x) >= 0.700]);
}

/* Os DOIS lados na mesma cota — a assimetria de 8 mm que o rip tinha some. */
{
  const alturas = ['D', 'E'].map((l) => {
    const no = cab.getObjectByName(`TS_TANQUE_VM_${l}`);
    return no ? caixaCab(no).max.y : null;
  }).filter((x) => x !== null);
  out.push(['1 · topo dos dois lados', alturas.map(mm).join(' · ')]);
  out.push(['★ 1 · os dois tanques na MESMA altura (±2 mm)',
    alturas.length === 2 && Math.abs(alturas[0] - alturas[1]) <= 0.002]);
}

/* ══════════════ 2. O TANQUE VELHO SUMIU ══════════════
   ⚠️ A VARREDURA PULA A SUBÁRVORE `TS_TANQUE_VM_*`, e isso não é zelo: na
   primeira rodada o asset saiu do Blender com as malhas ainda chamadas
   `tanque_0_p2.001` (o exportador escreve o nome do OBJETO no nó e o do DADO na
   malha, e o `GLTFLoader` batiza pelo segundo), então o tanque NOVO respondia
   ao mesmo `^tanques?_\d+_p\d+$` do VELHO e este portão reprovava contando os
   dois que acabara de pendurar. O bake agora batiza também o dado de malha —
   mas o portão não pode depender disso para não voltar a mentir. */
let velhasVisiveis = 0, velhasTotal = 0;
const sobrando = [];
cab.traverse((o) => {
  if (!o.isMesh || !/^tanques?_\d+_p\d+$/i.test(o.name || '')) return;
  for (let k = o; k; k = k.parent) if (/^TS_TANQUE_VM_/.test(k.name || '')) return;
  velhasTotal++;
  if (o.visible) { velhasVisiveis++; sobrando.push(o.name); }
});
out.push(['2 · malhas de tanque do rip', `${velhasVisiveis} visíveis de ${velhasTotal}`]);
if (sobrando.length) out.push(['2 · quem sobrou', sobrando.join(' · ')]);
out.push(['★ 2 · nenhuma malha do tanque original ficou visível',
  velhasTotal > 0 && velhasVisiveis === 0]);

/* ══════════════ 2b. O TANQUE NOVO ESTÁ NIVELADO ══════════════
   *"o tanque de gasolina ficou muito inclinado"* — o tanque do VM vem 1,3…2,1°
   empinado no rip e é o BAKE que o endireita. O portão mede o resultado onde
   ele importa: no caminhão. Critério: a diferença de altura entre a tampa da
   frente e a de trás, em fatias de 8 % do comprimento. */
for (const lado of ['D', 'E']) {
  const no = cab.getObjectByName(`TS_TANQUE_VM_${lado}`);
  if (!no) continue;
  const b = caixaCab(no);
  const fatia = (b.max.z - b.min.z) * 0.08;
  const v4 = new THREE.Vector3();
  const m5 = new THREE.Matrix4();
  let f0 = Infinity, f1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  no.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    const a = n.geometry.attributes.position;
    m5.multiplyMatrices(toCab, n.matrixWorld);
    for (let i = 0; i < a.count; i++) {
      v4.fromBufferAttribute(a, i).applyMatrix4(m5);
      if (v4.z <= b.min.z + fatia) { f0 = Math.min(f0, v4.y); f1 = Math.max(f1, v4.y); }
      else if (v4.z >= b.max.z - fatia) { r0 = Math.min(r0, v4.y); r1 = Math.max(r1, v4.y); }
    }
  });
  const dz = (b.max.z - b.min.z) * 0.92;
  const grau = Math.atan2(((r0 + r1) - (f0 + f1)) / 2, dz) * 180 / Math.PI;
  out.push([`2b · tanque ${lado} inclinação`, `${grau.toFixed(2)}°`]);
  out.push([`★ 2b · tanque ${lado} nivelado (menos de 0,3°)`, Math.abs(grau) < 0.3]);
}

/* ══════════════ 3. O INOX E O TEXTO VOLVO ══════════════
   O texto não é textura: é relevo, e ele é apagado no bake. O portão possível
   aqui é que o asset NÃO carregue nenhum material com "volvo" no nome e que a
   casca esteja com os números do inox. O relevo em si é conferido pelo próprio
   `bake_tank_vm.py`, que aborta se o critério deixar de casar 101 partes. */
const matsTanque = new Map();
for (const lado of ['D', 'E']) {
  const no = cab.getObjectByName(`TS_TANQUE_VM_${lado}`);
  no?.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m?.name) matsTanque.set(m.name, m);
    }
  });
}
out.push(['3 · materiais do tanque', [...matsTanque.keys()].sort().join(' · ') || '—']);
const inox = [...matsTanque.entries()].find(([n]) => /^tanque-inox-vm/.test(n))?.[1];
out.push(['3 · inox', inox
  ? `base ${inox.color.r.toFixed(3)} · m ${inox.metalness.toFixed(2)} · r ${inox.roughness.toFixed(2)}`
  + ` · normal ${inox.normalScale ? inox.normalScale.x.toFixed(2) : '—'}`
  : '—']);
out.push(['★ 3 · a casca do tanque é metal claro (m ≥ 0,85 e base ≥ 0,50)',
  !!inox && inox.metalness >= 0.85 && inox.color.r >= 0.50]);
out.push(['★ 3 · nenhum material do tanque cita Volvo',
  [...matsTanque.keys()].every((n) => !/volvo/i.test(n))]);

/* ══════════════ 4. O ESTEPE ══════════════
   O estepe do rip mede Ø 1,083 × 0,285 e o centro dele está em
   (−0,647 · 0,475 · 3,393) no espaço da cabine. O novo tem de estar no MESMO
   sítio e com o diâmetro da DIREÇÃO (0,992 medido), não com o do próprio
   estepe — foi o *"usar uma roda / pneu da própria lateral"*. */
const estepe = cab.getObjectByName('VM_WHEEL_SPARE');
out.push(['4 · estepe novo existe', !!estepe]);
if (estepe) {
  const b = caixaCab(estepe);
  const c = b.getCenter(new THREE.Vector3());
  const d = b.getSize(new THREE.Vector3());
  out.push(['4 · estepe caixa', `x ${mm(b.min.x)}…${mm(b.max.x)} · y ${mm(b.min.y)}…${mm(b.max.y)}`
    + ` · z ${mm(b.min.z)}…${mm(b.max.z)}`]);
  out.push(['4 · estepe centro', `${mm(c.x)} · ${mm(c.y)} · ${mm(c.z)}`]);
  out.push(['4 · estepe Ø × espessura', `${mm(Math.max(d.x, d.z))} × ${mm(d.y)}`]);
  out.push(['★ 4 · estepe no sítio do original (±60 mm nos três eixos)',
    Math.abs(c.x - (-0.647)) <= 0.060 && Math.abs(c.y - 0.475) <= 0.060
    && Math.abs(c.z - 3.393) <= 0.060]);
  out.push(['★ 4 · estepe deitado (espessura menor que meio diâmetro)',
    d.y < Math.max(d.x, d.z) / 2]);
  /* Ø da direção 0,992 contra 1,083 do estepe do rip: a janela separa os dois. */
  out.push(['★ 4 · estepe com o diâmetro da direção, não o do rip',
    Math.abs(Math.max(d.x, d.z) - 0.992) <= 0.040]);
  const rodaMats = new Set();
  estepe.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m?.name) rodaMats.add(m.name);
    }
  });
  out.push(['4 · materiais do estepe', [...rodaMats].sort().join(' · ')]);
  out.push(['★ 4 · o estepe é a MESMA roda da rodagem (materiais -vm)',
    rodaMats.size > 0 && [...rodaMats].every((n) => /-vm/.test(n))]);
}

/* O ORIGINAL FOI RECORTADO, e não só escondido: o pneu é uma malha inteira
   (some por `visible`), mas o aro está fundido em `chassis_p15/p18/p22`, que
   atravessam o caminhão. O portão é que ESSAS TRÊS continuem visíveis (ou seja
   o chassi não foi apagado junto) e que nenhum triângulo delas sobre dentro do
   cilindro do estepe. */
const CIL = { x: -0.647, y: 0.475, z: 3.393, raio: 0.541, meia: 0.143 };
let dentroSobrando = 0;
let chassiVivo = 0;
const v3 = new THREE.Vector3();
const m4 = new THREE.Matrix4();
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  if (/^VM_WHEEL_/.test(o.name || '')) return;                 // a roda nova mora lá
  if (o.parent && /^VM_WHEEL_/.test(o.parent.name || '')) return;
  if (/^chassis_p(15|18|22)$/.test(o.name || '')) chassiVivo++;
  const a = o.geometry.attributes.position;
  m4.multiplyMatrices(toCab, o.matrixWorld);
  for (let i = 0; i < a.count; i++) {
    v3.fromBufferAttribute(a, i).applyMatrix4(m4);
    if (Math.abs(v3.y - CIL.y) > CIL.meia) continue;
    const dx = v3.x - CIL.x, dz = v3.z - CIL.z;
    if (dx * dx + dz * dz <= CIL.raio * CIL.raio) { dentroSobrando++; return; }
  }
});
out.push(['4 · malhas com vértice sobrando no cilindro do estepe', String(dentroSobrando)]);
out.push(['4 · chassis_p15/18/22 ainda visíveis', String(chassiVivo)]);
out.push(['★ 4 · o chassi NÃO foi apagado junto com o aro', chassiVivo === 3]);

/* ══════════════ 5. O LETREIRO SCANIA ══════════════ */
let letreiro = null;
cab.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
    if (m?.name === 'sc_logo_0_mat_0000_brushed_metal_104') letreiro = m;
  }
});
out.push(['5 · letreiro SCANIA', letreiro
  ? `base ${letreiro.color.r.toFixed(4)} · m ${letreiro.metalness.toFixed(2)}`
  + ` · r ${letreiro.roughness.toFixed(2)}`
  : '—']);
out.push(['★ 5 · o letreiro deixou de ser preto (base ≥ 0,50 linear)',
  !!letreiro && letreiro.color.r >= 0.50]);
out.push(['★ 5 · e continua metal na régua da frota (m ≥ 0,80)',
  !!letreiro && letreiro.metalness >= 0.80]);

/* ══════════════ 6. AS FOTOS ══════════════
   ⚠️ A FRENTE DO CAMINHÃO SAI DE MEDIÇÃO, não de sinal escrito à mão. O rig
   carrega o `orientYaw` do manifesto e o eixo z do MUNDO não é o do rip: na
   primeira rodada a foto "da grade" saiu da traseira do baú. O vetor que aponta
   para a frente é o que vai do centro do IMPLEMENTO para o centro da CABINE. */
const bbCab = new THREE.Box3().setFromObject(cab);
const cc = bbCab.getCenter(new THREE.Vector3());
const ct = new THREE.Box3().setFromObject(S.state.trailer).getCenter(new THREE.Vector3());
const frente = Math.sign(cc.z - ct.z) || 1;
function foto(nome, pos, mira) {
  controls.target.copy(mira);
  camera.position.copy(pos);
  camera.lookAt(mira);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}

/* O tanque é peça de FLANCO: a câmera vai para o lado, na altura dele. */
const tankNo = cab.getObjectByName('TS_TANQUE_VM_D') || cab.getObjectByName('TS_TANQUE_VM_E');
if (tankNo) {
  const bt = new THREE.Box3().setFromObject(tankNo);
  const ct2 = bt.getCenter(new THREE.Vector3());
  const sx = Math.sign(ct2.x) || 1;
  foto('foto-tanque-flanco',
    new THREE.Vector3(ct2.x + sx * 6, ct2.y + 0.5, ct2.z), ct2);
  foto('foto-tanque-tres-quartos',
    new THREE.Vector3(ct2.x + sx * 4.5, ct2.y + 2.0, ct2.z + frente * 4), ct2);
}

/* O ESTEPE só é visto DE BAIXO — é para lá que a face bonita dele aponta, e é
   o único ângulo em que a proteção lateral não fica na frente. */
if (estepe) {
  const be = new THREE.Box3().setFromObject(estepe);
  const ce = be.getCenter(new THREE.Vector3());
  const sx = Math.sign(ce.x) || 1;
  foto('foto-estepe-de-baixo',
    new THREE.Vector3(ce.x + sx * 1.4, ce.y - 2.6, ce.z + 1.4), ce);
  foto('foto-estepe-rasante',
    new THREE.Vector3(ce.x + sx * 4.0, ce.y - 0.30, ce.z + 1.2), ce);
}

/* A GRADE, de frente e na altura do letreiro. */
const zFrente = frente > 0 ? bbCab.max.z : bbCab.min.z;
foto('foto-grade-scania',
  new THREE.Vector3(cc.x, 1.35, zFrente + frente * 7),
  new THREE.Vector3(cc.x, 1.35, zFrente));
foto('foto-conjunto',
  new THREE.Vector3(cc.x + 16, cc.y + 3, cc.z - frente * 9),
  new THREE.Vector3(cc.x, cc.y, ct.z));

/* ══════════════ 7. A FAIXA REFLETIVA TRASEIRA, NOS TRÊS ══════════════
   *"a faixa refletiva da traseira deve ser do volvo, em todos, inclusive do
   Scania"*. O portão mede três coisas por caminhão: que a nossa entrou, que a
   nativa saiu, e que o material dela casa `FITA_RE` de `retroreflect.ts` — que
   é o ganho invisível de dia (nenhuma das três faixas de rip retrorreflete). */
const FITA_RE = /faixa.?3m|retro.?reflet|reflective.?tape|conspicuity/i;
const NATIVA_RE = /reflet|faixa/i;
function conferirFaixa(rotulo, cabAtual) {
  const no = cabAtual.getObjectByName('TS_FAIXA_TRASEIRA');
  out.push([`7 · ${rotulo} · faixa do VM montada`, !!no]);
  out.push([`★ 7 · ${rotulo} · faixa do VM montada`, !!no]);
  if (!no) return;
  const b = new THREE.Box3();
  const vv = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(cabAtual.matrixWorld).invert();
  const mm2 = new THREE.Matrix4();
  let mats = new Set();
  no.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    for (const m of (Array.isArray(n.material) ? n.material : [n.material])) {
      if (m?.name) mats.add(m.name);
    }
    const a = n.geometry.attributes.position;
    mm2.multiplyMatrices(inv, n.matrixWorld);
    for (let i = 0; i < a.count; i++) b.expandByPoint(vv.fromBufferAttribute(a, i).applyMatrix4(mm2));
  });
  const dd = b.getSize(new THREE.Vector3());
  out.push([`7 · ${rotulo} · faixa`, `${mm(dd.x)} × ${mm(dd.y)} × ${mm(dd.z)} · ${[...mats].join(' · ')}`]);
  out.push([`★ 7 · ${rotulo} · a faixa é retrorrefletiva (o nome casa FITA_RE)`,
    [...mats].length > 0 && [...mats].every((n2) => FITA_RE.test(n2))]);
  out.push([`★ 7 · ${rotulo} · largura de faixa traseira (1,5…3,2 m)`,
    dd.x >= 1.5 && dd.x <= 3.2]);
  /* A NATIVA SAIU: nenhuma chapa larga/fina sob `NATIVA_RE` continua visível
     fora da nossa subárvore. */
  let nativaViva = 0;
  cabAtual.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    for (let k = o; k; k = k.parent) if (/^TS_FAIXA_TRASEIRA/.test(k.name || '')) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!ms.some((m) => NATIVA_RE.test(m?.name || ''))) return;
    const bb = new THREE.Box3();
    mm2.multiplyMatrices(inv, o.matrixWorld);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) bb.expandByPoint(vv.fromBufferAttribute(a, i).applyMatrix4(mm2));
    const s2 = bb.getSize(new THREE.Vector3());
    if (s2.x >= 1.5 && s2.x <= 3.2 && s2.y <= 0.25 && s2.z <= 0.06) nativaViva++;
  });
  out.push([`★ 7 · ${rotulo} · a faixa nativa saiu`, nativaViva === 0]);
}
conferirFaixa('scania', cab);

for (const alvo of ['volvo_vm_2015_6x2r', 'vw_titan_6x2_tl']) {
  const a = alvos.find((x) => x.c.file.includes(alvo));
  if (!a) { out.push([`7 · ${alvo}`, 'não está no catálogo']); continue; }
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '').includes(alvo), 300000);
  await B.until(() => !!S.state.cab?.getObjectByName('TS_FAIXA_TRASEIRA'), 120000);
  for (let i = 0; i < 25; i++) await B.frame();
  const c2 = S.state.cab;
  c2.updateWorldMatrix(true, true);
  conferirFaixa(alvo.replace(/_.*/, ''), c2);
  const bb2 = new THREE.Box3().setFromObject(c2);
  const cc2 = bb2.getCenter(new THREE.Vector3());
  const t2 = S.state.trailer ? new THREE.Box3().setFromObject(S.state.trailer).getCenter(new THREE.Vector3()) : cc2;
  const fr = Math.sign(cc2.z - t2.z) || 1;
  const zTras = fr > 0 ? bb2.min.z : bb2.max.z;
  foto(`foto-faixa-${alvo.replace(/_.*/, '')}`,
    new THREE.Vector3(cc2.x + 1.2, 0.75, zTras - fr * 5),
    new THREE.Vector3(cc2.x, 0.6, zTras));
}

return out;
