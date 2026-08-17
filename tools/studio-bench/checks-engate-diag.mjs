/* DIAGNÓSTICO DO ENGATE — as ENTRADAS da escolha de furo, no engine.
   ===========================================================================
       STUDIO_BENCH_ASSETS=/srv/files/Estudio3D/v1 \
       node tools/studio-bench/bench.mjs --geometry --checks checks-engate-diag.mjs

   Existe porque a bancada e `tools/trailer-bench/pinprobe.mjs` divergiram, e a
   divergência NÃO era um deslocamento constante — variava de cavalo para
   cavalo, de 39 a 303 mm. Um deslocamento constante teria uma parcela faltando;
   um que varia tem outra GEOMETRIA de um dos lados. Então este arquivo não
   julga nada: ele imprime, lado a lado, tudo o que entra em
   `pickKingpinStation()` no app, para casar linha a linha com o que a sonda
   assume.

   UMA CABINE SÓ, de propósito: a sonda cobre as 47 e o que falta aqui é
   PROFUNDIDADE, não largura. Carregar seis cabines sob SwiftShader custa 50
   minutos e não acrescenta um fato a esta pergunta. */
const out = [];
const B = window.__bench;
const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '—');

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
    cards[0].click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}
await settle();
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.state.trailerRig, 300000)]);
const rig = S.state.trailerRig;
if (!rig) return out;

/* A cabine do caso em disputa. */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const m of (mk.models || [])) {
    for (const c of (m.chassis || [])) {
      if (c.file && c.available !== false) alvos.push({ mk, m, c });
    }
  }
}
const alvo = alvos.find((a) => (a.c.file || '').includes('volvo_fh_2021_4x2'));
if (alvo && (S.state.cabDef?.file || '') !== alvo.c.file) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: alvo.mk.id, modelId: alvo.m.id, chassisId: alvo.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 240000);
  for (let i = 0; i < 8; i++) await B.frame();
}
out.push(['cabine', S.state.cabDef?.file || '—']);

/* ---- o lado IMPLEMENTO, como o app o vê ---- */
const hi = rig.hitch;
const d = rig.current;
const p = rig.profile;
out.push(['medidas do baú (l × a × c)', `${n3(d.width)} × ${n3(d.height)} × ${n3(d.length)}`]);
out.push(['profile floorY / roofY / z1', `${n3(p.floorY)} / ${n3(p.roofY)} / ${n3(p.z1)}`]);
out.push(['roofDelta', n3(rig.roofDelta())]);
out.push(['bandas do perfil da testeira', hi ? hi.frontProfile.length : '—']);
if (hi) {
  out.push(['  1ª banda (y, z)', `${n3(hi.frontProfile[0].y)}, ${n3(hi.frontProfile[0].z)}`]);
  const last = hi.frontProfile[hi.frontProfile.length - 1];
  out.push(['  última banda (y, z)', `${n3(last.y)}, ${n3(last.z)}`]);
  out.push(['dims que o solver usa', hi.dims
    ? `${n3(hi.dims.width)} × ${n3(hi.dims.height)} × ${n3(hi.dims.length)}` : 'AUSENTE']);
  out.push(['groundY / plateBottomY', `${n3(hi.groundY)} / ${n3(hi.kingpin.plateBottomY)}`]);
  out.push(['bogie centerZ / halfSpan', `${n3(hi.bogie.centerZ)} / ${n3(hi.bogie.halfSpan)}`]);
}

/* ---- o THERMO KING ---- */
out.push(['tkDepth', n3(S.state.tkDepth)]);
out.push(['tkSize', S.state.tkSize
  ? `${n3(S.state.tkSize.x)} × ${n3(S.state.tkSize.y)} × ${n3(S.state.tkSize.z)}` : 'AUSENTE']);
out.push(['★ tkHalfWidth passado ao solver',
  S.state.tkSize ? n3(S.state.tkSize.x / 2) : 'undefined → cai na largura do BAÚ']);

/* ---- o lado CAVALO ---- */
const ht = S.state.cabHitch;
out.push(['entrada de hitch.json', ht ? ht.id : 'AUSENTE (engate legado)']);
if (ht) {
  out.push(['perfil largo: bandas', ht.rearProfile ? ht.rearProfile.length : 'AUSENTE']);
  out.push(['★ escada de larguras', ht.rearProfiles
    ? ht.rearProfiles.map((s) => `${s.halfWidth}:${s.profile.length}`).join(' ')
    : 'AUSENTE — a asa volta a contar']);
  /* O z mais traseiro por degrau na altura em que a folga costuma fechar. */
  const at = (prof, y) => {
    if (!prof || !prof.length) return NaN;
    let best = prof[0], bd = Math.abs(prof[0].y - y);
    for (const b of prof) { const dd = Math.abs(b.y - y); if (dd < bd) { best = b; bd = dd; } }
    return best.z;
  };
  for (const y of [1.45, 1.95, 2.95]) {
    const linha = (ht.rearProfiles || []).map((s) => `${s.halfWidth}=${n3(at(s.profile, y))}`).join(' ');
    out.push([`  perfil em y=${y}`, `largo=${n3(at(ht.rearProfile, y))} · ${linha}`]);
  }
}

/* ---- a escolha, refeita aqui com os mesmos argumentos ---- */
out.push(['furo em uso agora', n3(rig.kingpinStationZ)]);
out.push(['furos', (rig.kingpinStations || []).map((s) => `${n3(s.z)}${s.hasPin ? '*' : ''}`).join(' ')]);
const sol = S.state.coupled;
if (sol) {
  out.push(['★ folga resolvida', `${(sol.clearance.gap * 1000).toFixed(0)} mm na altura ${n3(sol.clearance.atY)}`]);
  out.push(['folga exigida', `${(sol.clearance.required * 1000).toFixed(0)} mm`]);
  out.push(['relatos', sol.reports.map((r) => r.kind).join(', ') || 'nenhum']);
}
return out;
