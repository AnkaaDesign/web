/* SONDA DA FRENTE — os três relatos de 2026-08-12 (tarde).
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-frontal.mjs

   OS RELATOS:
     1. *"tem o feixe de luz, mas nao sai da frontal"*
     2. *"essa da frontal do implemento nao acende"*
     3. *"a da traseira do cavalo nao afeta o implemento"*

   O que separa as hipóteses de (1) é saber se o problema é o FEIXE (mal
   posicionado) ou a LENTE (apagada atrás da capa de vidro). Então: posição do
   feixe contra a caixa do cavalo, E a pilha de acertos no pixel do farol.

   Para (2): quais materiais existem na FACE DIANTEIRA do implemento e quais
   deles o registro acendeu — é a lista que diz qual lanterna ficou de fora.

   Para (3): onde estão os feixes e o que existe entre a traseira do cavalo e a
   frente do implemento. */
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
const THREE = S.THREE;
const L = S.lighting;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

L.setHourOfDay(23, { animate: false });
for (let i = 0; i < 10; i++) await B.frame();

/* ---------------- as raízes e as caixas ---------------- */
const raizes = [];
S.scene.traverse((o) => {
  if (o.userData && o.userData.tsVehicleRoot) raizes.push(o);
});
/* Sem marca própria, cai no que o registro conhece. */
const vl = L.getVehicleLights();
out.push(['raízes registradas', vl.raizes.join(' | ')]);
out.push(['materiais acesos', vl.nomes.length]);

const cx = new THREE.Box3();
const cxs = [];
S.scene.traverse((o) => {
  if (!o.isGroup && !o.isObject3D) return;
  if (!/^(cab|truck|trailer|implement|veh)/i.test(o.name || '')) return;
  if (o.parent !== S.scene && !(o.parent && o.parent.parent === S.scene)) return;
  cx.makeEmpty();
  cx.expandByObject(o);
  if (!cx.isEmpty()) {
    cxs.push({ nome: o.name, min: cx.min.clone(), max: cx.max.clone() });
  }
});
for (const c of cxs) {
  out.push([`  caixa ${c.nome}`,
    `x ${r2(c.min.x)}…${r2(c.max.x)} · y ${r2(c.min.y)}…${r2(c.max.y)} · z ${r2(c.min.z)}…${r2(c.max.z)}`]);
}

/* ---------------- (1) e (3): os feixes ---------------- */
const fb = L.getVehicleBeams ? L.getVehicleBeams() : null;
out.push(['— feixes —', '']);
if (fb) {
  fb.detalhe.forEach((d, i) => out.push([`  feixe ${i}`,
    `${d.cor} · int ${d.intensidade} · pos ${d.pos.join(',')} → alvo ${d.alvo.join(',')} · vis ${d.visivel}`]));
}

/* ---------------- (2): TUDO que existe na frente do implemento ----------------
   O implemento é a raiz de maior z. A "face dianteira" dele é o MENOR z da raiz.
   Lista-se todo material a menos de 0,6 m dessa face, aceso ou não. */
out.push(['— materiais na FACE DIANTEIRA do implemento —', '']);
{
  /* Acha a raiz do implemento: a que tem mais malhas (2 151 contra ~85). */
  let impl = null, maisMalhas = 0;
  for (const c of S.scene.children) {
    let n = 0;
    c.traverse((o) => { if (o.isMesh) n++; });
    if (n > maisMalhas) { maisMalhas = n; impl = c; }
  }
  if (impl) {
    out.push(['raiz do implemento', (impl.name || '(sem nome)') + ' · ' + maisMalhas + ' malhas']);
    cx.makeEmpty();
    cx.expandByObject(impl);
    const zFrente = cx.min.z;
    out.push(['  face dianteira (z de mundo)', r2(zFrente)]);
    const perto = new Map();
    const cxm = new THREE.Box3();
    impl.traverse((o) => {
      const mesh = o;
      if (!mesh.isMesh || !mesh.geometry) return;
      cxm.makeEmpty();
      cxm.expandByObject(mesh);
      if (cxm.isEmpty()) return;
      if (cxm.min.z > zFrente + 0.6) return;
      const mm = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mm) {
        if (!m) continue;
        const k = m.name || '(sem nome)';
        const e = perto.get(k) || {
          n: 0, aceso: vl.nomes.includes(k),
          emi: m.emissiveIntensity === undefined ? '-' : r2(m.emissiveIntensity),
          transp: !!m.transparent, opac: r2(m.opacity === undefined ? 1 : m.opacity),
          temMapa: !!m.map, nós: new Set(),
          y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity,
        };
        e.n++;
        e.nós.add(mesh.name || '?');
        e.y0 = Math.min(e.y0, cxm.min.y); e.y1 = Math.max(e.y1, cxm.max.y);
        e.x0 = Math.min(e.x0, cxm.min.x); e.x1 = Math.max(e.x1, cxm.max.x);
        perto.set(k, e);
      }
    });
    for (const [k, e] of [...perto].sort((a, b) => b[1].n - a[1].n)) {
      out.push([`  ${e.aceso ? 'ACESO ' : '      '}${k}`,
        `${e.n} malhas · emiInt ${e.emi} · transp ${e.transp}/${e.opac} · mapa ${e.temMapa}`
        + ` · x ${r2(e.x0)}…${r2(e.x1)} · y ${r2(e.y0)}…${r2(e.y1)}`
        + ` · nós ${[...e.nós].slice(0, 3).join(',')}`]);
    }
  }
}

/* ---------------- (1): a pilha de acertos no pixel do FAROL ---------------- */
out.push(['— quem desenha o pixel do farol —', '']);
{
  const cxa = L.getSeeThrough().alvoCaixa;
  if (cxa) {
    const cxm = (cxa[0] + cxa[3]) / 2;
    S.controls.target.set(cxm, 1.0, cxa[2] + 1.0);
    S.camera.position.set(cxm + 3.0, 1.3, cxa[2] - 6.5);
    S.camera.lookAt(cxm, 1.0, cxa[2] + 1.0);
    S.camera.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const achados = new Map();
    for (let gx = -0.6; gx <= 0.6; gx += 0.1) {
      for (let gy = -0.7; gy <= 0.0; gy += 0.1) {
        rc.setFromCamera(new THREE.Vector2(gx, gy), S.camera);
        const hits = rc.intersectObject(S.scene, true);
        for (let i = 0; i < Math.min(hits.length, 3); i++) {
          const h = hits[i];
          const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
          if (!m) continue;
          const chave = (m.name || '?') + ' @' + i;
          const reg = achados.get(chave) || {
            n: 0, nome: m.name || '?', ordem: i, malha: h.object.name || '?',
            opac: r2(m.opacity === undefined ? 1 : m.opacity),
            emi: m.emissiveIntensity === undefined ? '-' : r2(m.emissiveIntensity),
          };
          reg.n++;
          achados.set(chave, reg);
        }
      }
    }
    [...achados.values()].sort((a, b) => b.n - a.n).slice(0, 14).forEach((r) => {
      out.push([`  ordem ${r.ordem} · ${r.nome}`,
        `${r.n} raios · malha ${r.malha} · opac ${r.opac} · emiInt ${r.emi}`]);
    });
  }
}
return out;
