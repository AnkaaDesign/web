/* O PORTÃO DA RODADA DE 2026-08-22 — as onze queixas, medidas depois do conserto.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-scania-fix-0822.mjs

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
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;
const cab = S.state.cab;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();
const cx = (b) => (b ? `${mm(b.min.x)}…${mm(b.max.x)} · ${mm(b.min.y)}…${mm(b.max.y)}`
  + ` · ${mm(b.min.z)}…${mm(b.max.z)}` : '—');
function boxLocal(o) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  o.updateWorldMatrix(true, true);
  o.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    const a = n.geometry.attributes.position;
    const inst = n.isInstancedMesh ? n.count : 1;
    const m = new THREE.Matrix4();
    for (let k = 0; k < inst; k++) {
      if (n.isInstancedMesh) n.getMatrixAt(k, m);
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i);
        if (n.isInstancedMesh) v.applyMatrix4(m);
        v.applyMatrix4(n.matrixWorld).applyMatrix4(toLocal);
        b.expandByPoint(v);
      }
    }
  });
  return b.isEmpty() ? null : b;
}

/* ══════════════ 1. A FITA — espaçamento ══════════════ */
for (const lado of [1, -1]) {
  const zs = [];
  t.traverse((o) => {
    if ((!o.isMesh && !o.isInstancedMesh) || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!/Faixa-3M/i.test(mats.map((m) => m?.name || '').join('+'))) return;
    const a = o.geometry?.attributes?.position;
    if (!a) return;
    const inst = o.isInstancedMesh ? o.count : 1;
    const m = new THREE.Matrix4(); const v = new THREE.Vector3();
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) o.getMatrixAt(k, m);
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i);
        if (o.isInstancedMesh) v.applyMatrix4(m);
        v.applyMatrix4(o.matrixWorld).applyMatrix4(toLocal);
        if (Math.sign(v.x) !== lado || Math.abs(v.x) < 0.9) continue;
        if (v.y > 0.6) continue;                 // só a fileira da saia
        zs.push(v.z);
      }
    }
  });
  zs.sort((a, b) => a - b);
  const seg = [];
  for (const z of zs) {
    const u = seg[seg.length - 1];
    if (u && z - u < 0.02) continue;
    seg.push(z);
  }
  const vaos = [];
  for (let i = 1; i < seg.length; i++) vaos.push(seg[i] - seg[i - 1]);
  const passos = vaos.filter((v) => v > 0.05);
  out.push([`1 · fita ${lado > 0 ? '+x' : '-x'} vãos`, vaos.map(mm).join(' ')]);
  const pior = passos.length ? Math.max(...passos) : 0;
  out.push([`1 · fita ${lado > 0 ? '+x' : '-x'} maior vão entre peças`, mm(pior)]);
  out.push([`★ 1 · fita ${lado > 0 ? '+x' : '-x'} sem buraco maior que 700 mm`,
    passos.length > 0 && pior <= 0.70]);
}

/* ══════════════ 2. OS REBITES (a porta entra no FIM, ver §11) ══════════════ */
const rivN = (k) => t.getObjectByName(k + '_RIVETS')?.userData?.rivets ?? 0;
const perfil = S.state.trailerRig?.profile;
out.push(['2 · rebites sem porta', `SIDE_L ${rivN('SIDE_L')} · SIDE_R ${rivN('SIDE_R')}`]);
const semPorta = rivN('SIDE_R');

/* ══════════════ 3. A PROTEÇÃO LATERAL ══════════════ */
const guarda = t.getObjectByName('TS_PROTECAO_LATERAL');
let piorBalanco = 0, semEstacao = 0, trechos = 0, estacoesTotal = 0;
if (guarda) {
  for (const g of guarda.children) {
    if (!/_D$/.test(g.name)) continue;                  // um lado basta
    trechos++;
    const barras = g.children.filter((c) => /^BARRA__/.test(c.name));
    const est = g.children.filter((c) => c.isInstancedMesh);
    const bb = new THREE.Box3();
    for (const b of barras) {
      const cb = boxLocal(b);
      if (cb) bb.union(cb);
    }
    const zs = [];
    if (est.length) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < est[0].count; i++) {
        est[0].getMatrixAt(i, m);
        zs.push(g.position.z + m.elements[14]);
      }
      estacoesTotal += est[0].count;
    }
    zs.sort((a, b) => a - b);
    if (!zs.length) { semEstacao++; continue; }
    const bal = Math.max(zs[0] - bb.min.z, bb.max.z - zs[zs.length - 1]);
    piorBalanco = Math.max(piorBalanco, bal);
    const vaos = [];
    for (let i = 1; i < zs.length; i++) vaos.push(zs[i] - zs[i - 1]);
    out.push([`3 · ${g.name} barra ${mm(bb.min.z)}…${mm(bb.max.z)}`,
      `${zs.length} estações em ${zs.map(mm).join('/')} · balanço ${mm(bal)}`
      + ` · vãos ${vaos.map(mm).join('/')}`]);
    out.push([`★ 3 · ${g.name} · toda estação DENTRO da barra`,
      zs.every((z) => z >= bb.min.z - 0.001 && z <= bb.max.z + 0.001)]);
  }
}
out.push(['3 · resumo', `${trechos} trecho(s) · ${estacoesTotal} estações · pior balanço `
  + `${mm(piorBalanco)} · ${semEstacao} sem estação`]);
out.push(['★ 3 · nenhum corrido sem apoio', semEstacao === 0]);

/* ══════════════ 4. A ABA DO PARA-BARRO E A GRADE ══════════════ */
let abaMax = 0, letreiroMax = 0;
cab?.traverse((o) => {
  if (!o.isMesh || !/lameiro/i.test(o.name || '')) return;
  const b = boxLocal(o);
  if (!b) return;
  const m = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
  if (/_p0$/.test(o.name)) abaMax = Math.max(abaMax, m);
  else letreiroMax = Math.max(letreiroMax, m);
});
const gb = guarda ? boxLocal(guarda) : null;
const grade = gb ? Math.min(Math.abs(gb.min.x), Math.abs(gb.max.x)) : 0;
out.push(['4 · aba / letreiro / face interna da grade',
  `${mm(abaMax)} / ${mm(letreiroMax)} / ${mm(grade)}`]);
out.push(['★ 4 · a aba não entra na grade', abaMax > 0 && abaMax < grade]);
out.push(['★ 4 · o LETREIRO não entra na grade', letreiroMax > 0 && letreiroMax < grade]);

/* ══════════════ 5. AS PLACAS ══════════════ */
const info = S.placa?.info ? S.placa.info() : null;
out.push(['5 · placas', JSON.stringify(info && {
  cavalo: !!info.cavalo, traseira: !!info.rigidoTraseira, implemento: !!info.implemento,
})]);
out.push(['★ 5 · o rígido tem placa na FRENTE', !!info?.cavalo]);
out.push(['★ 5 · o rígido tem a NOSSA placa ATRÁS', !!info?.rigidoTraseira]);
let fabricaVisivel = 0;
cab?.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const mats = (Array.isArray(o.material) ? o.material : [o.material])
    .map((m) => m?.name || '').join('+');
  if (/brasilmercosul|baseplaca/i.test(mats)) fabricaVisivel++;
});
out.push(['★ 5 · nenhuma placa de fábrica visível', fabricaVisivel === 0]);

/* ══════════════ 6. O PRETO DA CABINE ══════════════ */
let piores = [];
cab?.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.material) return;
  for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
    if (!m?.color || m.transparent || m.map) continue;
    if ((m.metalness ?? 0) > 0.5) continue;
    const l = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
    if (l < 0.02 && !piores.some((x) => x.n === m.name)) piores.push({ n: m.name, l });
  }
});
piores = piores.sort((a, b) => a.l - b.l);
out.push(['6 · materiais opacos < 0,02 linear',
  piores.length ? piores.map((x) => `${x.n} ${x.l.toFixed(4)}`).join(' · ') : 'nenhum']);
/* Os que sobram são teias legítimas: tela desligada e afins. */
/* O que pode continuar preto, e por quê:
     `*screen_off`/`display`  painel APAGADO — preto de propósito;
     `roda-*`                 a régua da roda é outra (truck-wheels.ts) e ela é
                              aplicada DEPOIS desta, então nunca passa por aqui;
     `placa-berco`            o berço da placa é a sombra atrás dela, e ele é
                              nosso: nasce escuro por desenho (license-plate.ts). */
out.push(['★ 6 · nada de lataria abaixo de 0,02 linear',
  piores.every((x) => /screen|display|lcd|black_0|^roda-|placa-berco/i.test(x.n))]);

/* ══════════════ 7. O TRILHO DE TOPO ══════════════ */
const rivTrilho = ['TRAILER_TOPRAIL_RIVETS_L', 'TRAILER_TOPRAIL_RIVETS_R']
  .map((n) => t.getObjectByName(n)).filter(Boolean);
out.push(['7 · rebites do trilho', rivTrilho.length
  ? rivTrilho.map((o) => `${o.name} ${cx(boxLocal(o))}`).join(' · ') : 'AUSENTES']);
out.push(['★ 7 · o trilho de topo tem rebite nos dois flancos', rivTrilho.length === 2]);

/* ══════════════ 8. AS LINHAS DO THERMO KING ══════════════ */
const linhasTk = [];
t.traverse((o) => { if (/^TS_TK_LINHA_/.test(o.name || '')) linhasTk.push(o); });
const piso = perfil ? (() => {
  const b = boxLocal(t.getObjectByName('SIDE_L') || t);
  return b ? b.min.y : 0;
})() : 0;
out.push(['8 · linhas do TK', linhasTk.length
  ? linhasTk.map((o) => `${o.name} ${cx(boxLocal(o))}`).join(' · ') : 'AUSENTES']);
out.push(['★ 8 · as linhas do TK chegam abaixo do piso',
  linhasTk.length > 0 && linhasTk.every((o) => {
    const b = boxLocal(o);
    return !!b && b.min.y < piso;
  })]);

/* ══════════════ 9. O TETO NO LIVERY ══════════════ */
await B.until(() => !!(S.livery?.hasSnapshot && S.livery.hasSnapshot('roof')), 120000);
const snapTeto = S.livery?.getSnapshot ? S.livery.getSnapshot('roof') : null;
out.push(['9 · retrato do teto', snapTeto
  ? `ar ${snapTeto.ar?.toFixed(3)} · área pintável u ${snapTeto.paint?.u0?.toFixed(3)}…`
    + `${snapTeto.paint?.u1?.toFixed(3)} · v ${snapTeto.paint?.v0?.toFixed(3)}…`
    + `${snapTeto.paint?.v1?.toFixed(3)}` : 'AUSENTE']);
out.push(['★ 9 · o teto tem retrato', !!snapTeto]);
/* E ele MOSTRA o frame: a área pintável tem de ser MENOR que o quadro, porque o
   trilho de topo come as duas bordas em v. */
/* O QUADRO É MAIOR QUE A CHAPA — é isso que traz o frame para dentro dele. A
   chapa do teto mede 2 482 mm em x e o retrato leva 80 mm de margem de cada
   lado (`M_BOTTOM.roof`), que é onde o trilho de topo mora (|x| 1 245…1 310).
   A razão de aspecto do retrato prova a margem sem depender do scan de alfa:
   8 440 / 2 642 = 3,19, contra 8 380 / 2 482 = 3,38 da chapa nua. */
out.push(['★ 9 · o quadro do teto é mais largo que a chapa (o frame cabe nele)',
  !!snapTeto && snapTeto.ar > 3.10 && snapTeto.ar < 3.30]);
/* E o frame é DETECTADO como ferragem em pelo menos uma das bordas em v — a
   outra cai na fileira mais externa do recorte e o scan de `measurePaintRect()`
   para antes dela. Ver a nota de `COVER_RUN` em `livery-snapshot.ts`. */
out.push(['★ 9 · o frame come borda da área pintável',
  !!snapTeto && (snapTeto.paint.v0 > 0.01 || snapTeto.paint.v1 < 0.99)]);
if (snapTeto?.bg) {
  const dataUrl = await fetch(snapTeto.bg).then((r) => r.blob()).then((b) => new Promise((res) => {
    const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b);
  })).catch(() => null);
  if (dataUrl) out.push(['foto-teto-livery', dataUrl]);
}

/* ══════════════ 10. "EM CENA" ══════════════ */
const vista = S.models.setVehicleView('trailer');
out.push(['10 · setVehicleView("trailer") devolveu', vista]);
out.push(['★ 10 · "só o implemento" recusado num sobrechassi', vista === 'both']);
S.models.setVehicleView('both');
for (let i = 0; i < 6; i++) await B.frame();

/* ══════════════ AS FOTOS ══════════════ */
/* ⚠️ A TRASEIRA DO VEÍCULO OLHA PARA +Z EM MUNDO (`orientYaw = π` no rig). */
const raw = renderer.domElement;
const bMundo = new THREE.Box3().setFromObject(t);
const alvo0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo0.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
tira('fix-perfil', 15, -90, 5, null);
tira('fix-flanco-perto', 6.5, -90, 3, V(0, -0.3, 0));
tira('fix-grade', 6.5, -78, -6, V(0, -1.3, 1.5));
tira('fix-grade-tras', 6.5, -78, -6, V(0, -1.3, -2.5));
tira('fix-traseira', 10, 6, 3, V(0, -0.7, 0));
tira('fix-traseira-baixa', 7, 2, -3, V(0, -1.3, 0));
tira('fix-frente', 12, 205, 10, null);
tira('fix-frente-perto', 7, 215, 6, V(0, 0.2, 2.0));
tira('fix-tk', 5.0, 200, 14, V(0, 0.6, -3.2));
tira('fix-trilho', 4.5, -68, 20, V(0, 1.0, 1.5));
tira('fix-topo', 12, 0, 89, null);

/* ══════════════ 11. A PORTA — depois das fotos ══════════════ */
if (S.measures?.addDoor) S.measures.addDoor('right');
await B.until(() => (S.state.trailerRig?.body?.getDoorHoles('right') ?? []).length > 0, 60000);
for (let i = 0; i < 40; i++) await B.frame();
const buraco = (S.state.trailerRig?.body?.getDoorHoles('right') ?? [])[0];
const comPorta = rivN('SIDE_R');
out.push(['11 · vão da porta', buraco
  ? `y ${mm(buraco.y0)}…${mm(buraco.y1)} · z ${mm(buraco.z0)}…${mm(buraco.z1)}` : '—']);
out.push(['11 · rebites com porta', `SIDE_L ${rivN('SIDE_L')} · SIDE_R ${comPorta}`]);
const linhas = perfil ? Math.round((2.936 - 0.321) / perfil.pitch) + 1 : 0;
out.push(['11 · a coluna tem', `${linhas} fileiras`]);
out.push(['11 · a porta comeu', `${semPorta - comPorta} rebite(s)`]);
out.push(['★ 11 · a porta NÃO come a coluna inteira',
  semPorta - comPorta > 0 && semPorta - comPorta < linhas - 3]);
tira('fix-porta', 7, -90, 3, V(0, -0.3, 0));

/* ══════════════ 12. O SEMIRREBOQUE NÃO REGREDIU ══════════════
   `TrailerAssembly` passou a assentar na medida de fábrica dentro do próprio
   construtor, e isso muda o estado de BOOT dos dois implementos — não só do
   sobrechassi. O padrão ouro tem de continuar padrão ouro. */
const semi = alvos.find((a) => /volvo_fh16_2012_4x2|_4x2\.glb$/.test(a.c.file));
if (semi) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: semi.mk.id, modelId: semi.mo.id, chassisId: semi.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.implement?.id || '').includes('semirreboque'), 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  const t2 = S.state.trailer;
  const reps = [];
  t2.traverse((o) => { if (o.isInstancedMesh && /^REPEAT/.test(o.name || '')) reps.push(o); });
  out.push(['12 · implemento', S.state.implement?.id || '—']);
  out.push(['12 · REPEAT com instância',
    `${reps.filter((r) => r.count > 0).length} de ${reps.length}`]);
  out.push(['★ 12 · nenhum conjunto repetido vazio no boot',
    reps.length > 0 && reps.every((r) => r.count > 0)]);
  const riv2 = t2.getObjectByName('SIDE_L_RIVETS')?.userData?.rivets ?? 0;
  out.push(['12 · rebites de emenda no semirreboque', String(riv2)]);
  out.push(['★ 12 · o semirreboque continua com rebite de emenda', riv2 > 100]);
  const trilho2 = ['TRAILER_TOPRAIL_RIVETS_L', 'TRAILER_TOPRAIL_RIVETS_R']
    .map((n) => t2.getObjectByName(n)).filter(Boolean);
  out.push(['★ 12 · o trilho LISO do semirreboque NÃO ganhou rebite',
    trilho2.length === 0]);
  const b2 = new THREE.Box3().setFromObject(t2);
  const al2 = b2.getCenter(new THREE.Vector3());
  controls.target.copy(al2);
  camera.position.set(al2.x - 18, al2.y + 2, al2.z);
  camera.lookAt(al2);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push(['fix-semirreboque', raw.toDataURL('image/png')]);
}

return out;
