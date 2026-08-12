/* O CHÃO DO DISTRITO, fotografado onde a queixa vive.
   ===========================================================================
   Existe porque "a grama esta padronizada" e "as pocas sao repetitivas" ja
   foram perseguidas varias vezes por ajuste de numero no manifesto, sem nunca
   se olhar um quadro do MOTOR — e as duas sao periodicidade, que so aparece
   quando se ve muitos ladrilhos de uma vez. Nenhum enquadramento do app mostra
   isso: a orbita e curta e o chao entra de esguelha.

   As poses sao RASANTES e LONGAS de proposito. Periodicidade se le no
   escorco: a mesma mancha, do mesmo tamanho, em intervalos iguais fugindo
   para o horizonte. Uma vista de cima mostra a textura e esconde o ritmo.

   Solta `setVehicleFocus(null)` antes de posar: a orbita do estudio prende a
   camera a ~31 m do caminhao e nao deixa chegar a um enquadramento de chao. */
const B = window.__bench;
const out = [];

const toURL = (blob) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.readAsDataURL(blob);
});

out.push(['seletor', await B.settleSelector()]);
/* `__bench` aparece no tempo de import do boot; `__studio` so depois de os
   modelos carregarem. Esperar por ELE, e nao pelo seletor, e a diferenca entre
   ler o handle e ler `undefined`. */
out.push(['__studio pronto', await B.until(() => !!window.__studio, 300000)]);
const S = window.__studio;
B.standIn();

const env = S.catalog.getEnvironment('distrito-industrial');
out.push(['cenario existe', !!env]);
if (env) {
  await S.environment.applyEnvironment(env);
  out.push(['set na cena',
    await B.until(() => !!S.scene.getObjectByName('ts-set'), 180000)]);
}

S.lighting.setVehicleFocus(null);

async function pose(name, eye, tgt, preset) {
  if (preset) {
    try { S.lighting.applyPreset(preset, { animate: false }); } catch (e) { /* noop */ }
  }
  S.camera.position.set(eye[0], eye[1], eye[2]);
  S.controls.target.set(tgt[0], tgt[1], tgt[2]);
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate(8);
  for (let i = 0; i < 4; i++) await B.frame();
  const res = await B.captureViewport({ quality: 'low', background: 'cena' });
  out.push([name, await toURL(res.blob)]);
  out.push([name + ' px', res.width + 'x' + res.height]);
}

/* 1. O CANTEIRO CENTRAL, rasante. E a grama que a orbita do app realmente
      mostra: corre entre as duas pistas, de x -14,4 a -3,9. */
await pose('a_grama_canteiro', [9, 3.2, 34], [-9, 0.2, -46], 'ensolarado');

/* 2. A FAIXA DE GRAMA OESTE, 41 x 236 m — a maior superficie continua de
      grama de dentro da cerca, e onde um ladrilho de 4 m repete 60 vezes. */
await pose('b_grama_faixa', [-92, 6.0, 62], [-132, 0.2, -40]);

/* 3. O PATIO DE CONCRETO, mesma pergunta para GROUND_CONCRETE. */
await pose('c_patio_concreto', [30, 3.0, 30], [70, 0.2, -30]);

/* 4. A RUA MOLHADA — as pocas. Rasante ao longo da pista do caminhao
      (road_a, x -3,25 a 9,75), que e onde a mascara de poca e aplicada. */
await pose('d_pocas_rua', [7, 2.2, 40], [3, 0.1, -60], 'chuvoso');

/* 5. As mesmas pocas de um pouco mais alto, para contar as repeticoes. */
await pose('e_pocas_alto', [16, 9.0, 34], [0, 0.1, -70]);

return out;
