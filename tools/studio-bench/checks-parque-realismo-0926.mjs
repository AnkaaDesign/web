/* O CHÃO DO DISTRITO, PELA QUEIXA DE 26/09 — padrão, planura, faixa sem
   desgaste e meio-fio "quadradinho".
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-parque-realismo-0926.mjs

   Só fotografa. As poses são as que a queixa descreve: a rua rasante (onde a
   planura e o ritmo do ladrilho se leem), o meio-fio de perto (onde a quina
   viva se lê), a faixa de perto e o pátio. Mais a vista do app, que é o juiz.

   Prefixo por argumento (`--tag antes`), para comparar antes/depois lado a lado. */
const B = window.__bench;
const out = [];
const argv = window.__benchArgv || [];
const tag = argv.includes('--tag') ? argv[argv.indexOf('--tag') + 1] : 'x';
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;

const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
out.push(['seletor', await B.settleSelector()]);
out.push(['__studio pronto', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;

/* O distrito JÁ é o cenário padrão da primeira visita; reaplicá-lo pendurava a
   bancada. Só aplica se outro cenário estiver de pé. */
const temSet = () => {
  const g = S.scene.getObjectByName('ts-set');
  return !!g && g.children.length > 0;
};
if (!temSet()) {
  const env = S.catalog.getEnvironment('distrito-industrial');
  if (env) await S.environment.applyEnvironment(env);
}
out.push(['set na cena', await B.until(temSet, 180000)]);
const rig = S.scene.getObjectByName('RIG');
if (rig) {
  const bx = new S.THREE.Box3().setFromObject(rig);
  out.push(['caixa do conjunto', [bx.min.toArray().map((v) => +v.toFixed(2)),
    bx.max.toArray().map((v) => +v.toFixed(2))]]);
}
S.lighting.setVehicleFocus(null);
if (S.lighting.setInteriorBounds) S.lighting.setInteriorBounds(null);
S.lighting.applyPreset('ensolarado', { animate: false });

async function pose(name, eye, tgt, fov, preset) {
  if (only && !only.includes(name.split('_')[0])) return;
  S.lighting.applyPreset(preset || 'ensolarado', { animate: false });
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.controls.target.set(tgt[0], tgt[1], tgt[2]);
  if (fov) { S.camera.fov = fov; }
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(8);
  for (let i = 0; i < 6; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([tag + '_' + name, await toURL(res.blob)]);
}

/* O CONJUNTO VAI DE z -0,9 A 17,2 (three), x ±1,5 — medido acima. */
/* Vista do app: câmera a leste-sudeste, olhando o conjunto e o oeste. */
await pose('a_hero', [19, 3.2, 27], [-1, 1.3, 8], 45);
/* A rua A rasante, à frente da cabine, fugindo para o portão. */
await pose('b_rua_rasante', [6.0, 1.5, -2], [3, 0, -80], 45);
/* O meio-fio leste de perto, correndo junto à sarjeta. */
await pose('c_meiofio_perto', [11.8, 0.7, 4], [9.9, 0.0, -8], 45);
/* A faixa tracejada do eixo, de perto. */
await pose('d_faixa_perto', [4.8, 1.25, 2], [3.25, 0, -9], 45);
/* O pátio leste, rasante longo. */
await pose('e_patio', [16, 2.0, 10], [45, 0.2, 35], 45);
/* A guia do canteiro central com a grama. */
await pose('f_canteiro', [-1.8, 1.1, -2], [-3.9, 0.05, -14], 45);
/* De cima, meio alto: o tabuleiro inteiro. */
await pose('g_alto', [22, 20, 34], [0, 0, 0], 50);
/* A boca da via interna leste (y 27..35 blender = z -35..-27). */
await pose('h_boca', [16, 2.2, -16], [8, 0, -32], 50);
/* O pneu no chão: a pegada tem de encostar (truck_pad no build). */
await pose('i_rodas', [-4.6, 0.55, 13.0], [-1.3, 0.3, 13.0], 40);
/* O vão do vão: estacionamento pintado no pátio leste (vagas de 11 a 16 m). */
await pose('j_vagas', [14.5, 1.6, 30], [12.5, 0.0, 44], 50);
/* Sol baixo e rasante: é onde sulco, recalque e degrau de placa aparecem. */
await pose('l_sol_baixo', [5.5, 1.4, -1], [2.5, 0, -60], 45, 'dourado');
await pose('m_patio_sol_baixo', [16, 1.6, 12], [40, 0.1, 40], 45, 'dourado');
/* Chuva: o detalhe tem de conviver com a molhagem (rugosidade e poça). */
await pose('o_chuva', [19, 3.2, 27], [-1, 1.3, 8], 45, 'chuvoso');
/* A emenda da guia reta com o arco da boca da transversal (x 10,4 · y -30). */
await pose('n_junta_boca', [11.9, 1.3, 26.6], [10.1, 0.0, 30.6], 45);
/* O perfil da pedra, a um palmo: boleado, face inclinada, junta em V. */
await pose('k_pedra', [10.95, 0.32, 0.6], [10.15, 0.06, -2.6], 45);

return out;
