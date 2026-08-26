/* DIAGNÓSTICO 3 — ONDE AS ESTAÇÕES CAEM, e quanto de balanço sobra na ponta.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-grade-apoio-0824.mjs

   Com o corrido dianteiro avançando sobre o tanque e o ARLA, a pergunta que
   vem junto é a de sempre nesta peça: *"a grade está muito longa, o suporte
   dela fica flutuando"*. `estacoes()` promete balanço de 300 mm nas pontas —
   mas ela SOME com a estação que não acha lugar fora de obstáculo, e o tanque
   ocupa 1,2 m de z.

   Mede, por configuração e por trecho: o z de cada estação (expandindo a
   `InstancedMesh`, que é onde a varredura geral já se enganou uma vez), o vão
   entre elas e o BALANÇO de cada ponta. E mede a folga em |x| entre o montante
   da estação e o equipamento de flanco — que é o número que diz se aquela
   estação PODERIA ter nascido ali. */
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

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c, rot: `${mo.id}/${c.id}` });
    }
  }
}

const v = new THREE.Vector3();
for (const a of alvos) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();

  const cab = S.state.cab, t = S.state.trailer;
  cab.updateWorldMatrix(true, true); t.updateWorldMatrix(true, true);

  /* Os TRECHOS, pela barra e pela tampa (flanco direito). */
  const zs = [];
  /* ⚠️ SEM O TESTE DE `visible`: `applyMerge()` funde a barra em
     `FUSAO__metal-galvanizado-mantido__b3` e deixa o nó original APAGADO na
     cena. É a mesma pegadinha que §45.4 registra — a primeira versão desta
     conta devolvia zero nas dez configurações. */
  t.traverse((o) => {
    if (!o.isMesh || !/^(BARRA__|PONTA__)/.test(o.name || '')) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      if (v.x > 0) zs.push(v.z);
    }
  });
  zs.sort((p, q) => p - q);
  /* ⚠️ O TRECHO É O PAR DE TAMPAS, e não o que a barra desenha: `applyMerge()`
     leva a BARRA para o balde de fusão e o nó `BARRA__` some da árvore do
     implemento. A tampa (`PONTA__`) não funde — ela é uma malha por ponta —, e
     duas tampas seguidas são as duas pontas de um mesmo corrido. */
  const grupos = [];
  for (const z of zs) {
    const u = grupos[grupos.length - 1];
    if (u && z - u.z1 < 0.20) u.z1 = Math.max(u.z1, z);
    else grupos.push({ z0: z, z1: z });
  }
  const trechos = [];
  for (let i = 0; i + 1 < grupos.length; i += 2) {
    trechos.push({ z0: grupos[i].z0, z1: grupos[i + 1].z1, est: [] });
  }

  /* AS ESTAÇÕES, uma a uma — `InstancedMesh` expandida. */
  const est = [];
  t.traverse((o) => {
    if (!o.isMesh || !/^ESTACAO__metal-preto/.test(o.name || '')) return;
    if (!o.isInstancedMesh) return;
    const M = new THREE.Matrix4();
    for (let k = 0; k < o.count; k++) {
      o.getMatrixAt(k, M); M.premultiply(o.matrixWorld);
      const p = new THREE.Vector3().setFromMatrixPosition(M);
      /* Só o flanco direito, e o z da INSTÂNCIA (a geometria já está rezerada
         no nó). */
      const pos = o.geometry.attributes.position;
      let z0 = Infinity, z1 = -Infinity, x = 0;
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 200))) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
        z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); x = Math.max(x, Math.abs(v.x));
        if (v.x < 0) { x = -1; break; }
      }
      if (x > 0) est.push({ z: (z0 + z1) / 2, x });
    }
  });
  est.sort((p, q) => p.z - q.z);
  for (const e of est) {
    const dono = trechos.find((x) => e.z >= x.z0 - 0.10 && e.z <= x.z1 + 0.10);
    if (dono) dono.est.push(e.z);
  }

  const linhas = trechos.map((x, i) => {
    const vao = x.z1 - x.z0;
    if (!x.est.length) return `t${i}: ${mm(x.z0)}…${mm(x.z1)} (${mm(vao)} mm) · SEM ESTAÇÃO`;
    const bal0 = x.est[0] - x.z0, bal1 = x.z1 - x.est[x.est.length - 1];
    const vaos = x.est.slice(1).map((z, k) => mm(z - x.est[k])).join(', ');
    return `t${i}: ${mm(x.z0)}…${mm(x.z1)} (${mm(vao)} mm) · ${x.est.length} estação(ões) em `
      + `${x.est.map(mm).join(', ')} · balanço ${mm(bal0)} / ${mm(bal1)} mm`
      + `${vaos ? ` · vãos ${vaos}` : ''}`;
  });
  out.push([`${a.rot} · trechos e apoios`, '\n        ' + linhas.join('\n        ')]);

  /* A folga em |x| entre o montante da estação e o equipamento de flanco: é o
     número que diz se a estação PODERIA nascer em cima do tanque. */
  let estX = Infinity;
  t.traverse((o) => {
    if (!o.isMesh || !/^ESTACAO__/.test(o.name || '')) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const M = new THREE.Matrix4();
    const n = o.isInstancedMesh ? 1 : 1;
    if (o.isInstancedMesh) { o.getMatrixAt(0, M); M.premultiply(o.matrixWorld); } else M.copy(o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      if (v.y < 0.45 || v.y > 1.00) continue;      // o MONTANTE, entre as barras
      estX = Math.min(estX, Math.abs(v.x));
    }
  });
  let flancoX = 0, quem = '';
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name || '').join(',');
    if (!/^TS_TANQUE|^tanques?(_\d+)?_p\d+$/i.test(o.name || '')
      && !/arla|adblue/i.test(mats) && !/arla|adblue/i.test(o.name || '')) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      if (v.y < 0.45 || v.y > 1.00) continue;
      if (Math.abs(v.x) > flancoX) { flancoX = Math.abs(v.x); quem = o.name; }
    }
  });
  out.push([`${a.rot} · montante da estação × equipamento de flanco`,
    `montante em |x| ${mm(estX)} · flanco em ${mm(flancoX)} (${quem}) · folga ${mm(estX - flancoX)} mm`]);
}

return out;
