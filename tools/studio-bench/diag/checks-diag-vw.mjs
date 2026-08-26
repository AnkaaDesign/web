/* DIAGNÓSTICO DA REGRESSÃO — o VW ficou SEM grade, e é preciso saber por quê
   antes de mexer. Imprime, para os três VW e o VM 8x2, tudo que decide o
   corrido: trechos, baias, as DUAS listas de obstáculo e o veredito da
   ferragem. Não conserta nada. */
const out = [];
const B = window.__bench;
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

const linhas = [];
const orig = console.info;
console.info = (...a) => { linhas.push(a.map(String).join(' ')); orig(...a); };

for (const id of ['vw-constellation/8x2-tl', 'vw-constellation/6x2-tl',
  'vw-constellation/4x2-tl', 'volvo-vm-2015/8x2r']) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) {
    for (const md of (m.models || [])) {
      for (const ch of (md.chassis || [])) {
        if (`${md.id}/${ch.id}` === id) { mk = m; mo = md; c = ch; }
      }
    }
  }
  if (!c) { out.push([`★ acha ${id}`, false]); continue; }
  linhas.length = 0;
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id,
    modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null },
  { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  for (const l of linhas) {
    if (/\[grade\]|\[para-lama\]/.test(l)) out.push([`${id} · log`, l.slice(0, 620)]);
  }
  const grade = S.state.trailer?.getObjectByName('TS_PROTECAO_LATERAL');
  let malhas = 0, visiveis = 0;
  grade?.traverse((o) => { if (o.isMesh) { malhas++; if (o.visible) visiveis++; } });
  out.push([`${id} · nó da grade`, grade ? `${malhas} malha(s), ${visiveis} visível(eis)` : 'NÃO EXISTE']);
  /* E o para-lama: quantos triângulos sobraram depois da apara. */
  const pl = S.state.cab?.getObjectByName('TS_PARALAMA_DIR2');
  if (pl) {
    const por = [];
    pl.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const i = o.geometry.getIndex();
      por.push(`${o.name}:${i ? i.count / 3 : o.geometry.getAttribute('position').count / 3}`);
    });
    out.push([`${id} · para-lama (tri por malha)`, por.join(' · ')]);
  }
}
console.info = orig;
return out;
