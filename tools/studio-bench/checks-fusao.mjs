/* O PORTÃO DA FUSÃO POR MATERIAL — pixel a pixel, antes e depois, na mesma pose.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-fusao.mjs

   POR QUE ELE EXISTE SEPARADO DE `checks-aceitacao.mjs`.

   Aquele arquivo compara os TRÊS NÍVEIS entre si, e essa régua é cega para esta
   mudança: a fusão está ligada nos três níveis, então ela some da diferença
   entre eles. O que precisa ser provado aqui é outra coisa, e é a única trava
   que o documento do gargalo escreveu com todas as letras:

   ┌──────────────────────────────────────────────────────────────────────────┐
   │ A fusão por material não pode mudar a imagem. Nem um pouco.              │
   │ Ela não tira um triângulo: 6,51 M antes, 6,51 M depois. A única coisa    │
   │ que muda é QUANTAS VEZES a CPU pede à placa para desenhá-los.            │
   │                                                                          │
   │ Uma fusão que muda a imagem é uma fusão errada.                          │
   └──────────────────────────────────────────────────────────────────────────┘

   Então o método é: mesma pose, mesma câmera, mesma luz, mesmo mapa de sombra.
   Render com `merge.release()`, lê o buffer. Render com `merge.apply()`, lê de
   novo. Compara. E repete em TRÊS poses, porque um defeito de enrolamento
   (determinante negativo) só aparece do lado de onde a face virou.

   ⚠️ A LEITURA É DO VIEWPORT, NÃO DA CAPTURA — mesma razão de
   `checks-aceitacao.mjs`: `scene/capture.ts` roda no TETO do perfil, e uma foto
   tirada por ele não é o que o usuário vê.

   ⚠️ E O CICLO É APLICA→SOLTA→APLICA. Um "solta" que não devolve tudo é o mesmo
   defeito de imagem, adiado para o primeiro resize do baú. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!(window.__studio?.state?.trailer || window.__studio?.state?.cab), 120000);
for (let i = 0; i < 30; i++) await B.frame();
await B.until(() => !!window.__studio?.renderer, 60000);

const S = window.__studio;
const R = S.renderer, THREE = S.THREE, gl = R.getContext();
const scene = S.scene, camera = S.camera, Q = S.quality;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

Q.set('alta');
for (let i = 0; i < 12; i++) await B.frame();

out.push(['cena', JSON.stringify(S.choice)]);
if (!S.merge) {
  out.push(['★ FUSÃO', 'AUSENTE — `window.__studio.merge` não foi publicado. Nada a medir.']);
  return out;
}

/* ---------------------------------------------------------------------------
   O RETRATO DO QUE FICOU DE FORA, E POR QUEM. É a leitura que responde "por que
   só N malhas entraram?" com nome de dono, e não com um número solto. */
const info0 = S.merge.info();
out.push(['modo', String(info0.modo)]);
out.push(['origens → baldes',
  `${info0.origens} → ${info0.baldes} · ${info0.poupadas} chamadas poupadas · ` +
  `${info0.ms} ms de construção · ${(info0.triangulos / 1e6).toFixed(2)} M tri assados`]);
out.push(['excluídas, por dono',
  Object.entries(info0.excluidas).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`).join(' · ') || '(nenhuma)']);
out.push(['armadilhas encontradas no acervo',
  Object.entries(info0.armadilhas).map(([k, v]) => `${k}: ${v}`).join(' · ')]);
out.push(['sombra', `corte ${info0.sombra.minM} m · ${info0.sombra.emissores} de ${info0.baldes} baldes emitem`]);

/* ---------------------------------------------------------------------------
   POSES. Três, e em torno do conjunto: um erro de enrolamento vira a face de
   UM lado, então uma pose só pode passar por cima dele. */
const alvo = S.controls.target.clone();
const p0 = camera.position.clone();
const raio = p0.distanceTo(alvo);
const poses = [0, 2.1, 4.2].map((a) => {
  const ang = Math.atan2(p0.z - alvo.z, p0.x - alvo.x) + a;
  return new THREE.Vector3(
    alvo.x + Math.cos(ang) * raio,
    p0.y,
    alvo.z + Math.sin(ang) * raio,
  );
});
function porPose(p) {
  camera.position.copy(p);
  S.controls.target.copy(alvo);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true);
}

const GRADE_W = 480, GRADE_H = 300;
function lerViewport(p) {
  porPose(p);
  /* O mapa de sombra é REASSADO nos dois lados da comparação: a fusão troca o
     conjunto de objetos que o passe de sombra desenha, e comparar contra um mapa
     escrito pelo estado anterior compararia a sombra errada com a certa. */
  R.shadowMap.needsUpdate = true;
  R.render(scene, camera);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sctx = src.getContext('2d');
  const img = sctx.createImageData(w, h);
  img.data.set(buf);
  sctx.putImageData(img, 0, 0);
  const dst = document.createElement('canvas');
  dst.width = GRADE_W; dst.height = GRADE_H;
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.translate(0, GRADE_H);
  dctx.scale(1, -1);
  dctx.drawImage(src, 0, 0, GRADE_W, GRADE_H);
  return { px: dctx.getImageData(0, 0, GRADE_W, GRADE_H).data, url: dst.toDataURL('image/png') };
}

function difere(a, b) {
  let soma = 0, fortes = 0, muitoFortes = 0, pior = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
    const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
    const d = Math.abs(la - lb);
    soma += d;
    if (d > pior) pior = d;
    if (d > 12) fortes++;
    if (d > 48) muitoFortes++;
  }
  return {
    media: +(soma / n).toFixed(3),
    fortes: +(fortes / n * 100).toFixed(3),
    muitoFortes: +(muitoFortes / n * 100).toFixed(3),
    pior: Math.round(pior),
  };
}

function conta() {
  R.info.autoReset = false;
  R.shadowMap.needsUpdate = true;
  R.info.reset();
  R.render(scene, camera);
  const r = { calls: R.info.render.calls, tris: R.info.render.triangles };
  /* ⚠️ Sai daqui com `autoReset` em FALSE, e de propósito: `scene/scene.ts` é o
     dono dessa chave desde 2026-08-15 e zera à mão no laço. Restaurar `true`
     "por educação" devolveria o painel de Configurações à mentira de esconder o
     passe de sombra — o defeito que este arquivo existe para medir. */
  return r;
}

function ms(n = 20) {
  for (let i = 0; i < 3; i++) R.render(scene, camera);
  gl.finish();
  const t = performance.now();
  for (let i = 0; i < n; i++) R.render(scene, camera);
  gl.finish();
  return (performance.now() - t) / n;
}

/* ---------------------------------------------------------------------------
   A CORRIDA — E O ERRO DE MÉTODO QUE ELA CORRIGE.

   ⚠️ A PRIMEIRA VERSÃO DESTE ARQUIVO fotografou as três poses com a fusão
   SOLTA, depois as três com ela APLICADA, e reprovou com 5,34 % dos pixels
   diferentes. A imagem denunciou o erro: o que mudava entre as duas fotos era
   uma ÁRVORE — `scene/seethrough.ts` dissolve o que entra no corredor entre a
   câmera e o veículo, e mover a câmera 2,1 rad e voltar deixa o fade num ponto
   diferente da rampa. Zero disso tem a ver com a fusão.

   O conserto é o mesmo princípio de `checks-gargalo.mjs`: comparação
   INTERCALADA e no MESMO instante da cena. Por pose: assenta a cena com o laço
   de verdade (o fade precisa de quadros para chegar ao fim), e só então solta,
   fotografa, aplica e fotografa de novo — **sem um único `requestAnimationFrame`
   entre as duas fotos**. `R.render()` direto não avança relógio, não roda
   `onDrawFrame`, não mexe no fade e não move uma folha. A única coisa que muda
   entre os dois buffers é a fusão, que é a definição do experimento. */
function parDePose(p) {
  porPose(p);
  /* Quarenta quadros do laço de verdade: o corredor de transparência é uma
     rampa temporal, e fotografar no meio dela é fotografar um estado que não é
     de ninguém. */
  return (async () => {
    for (let i = 0; i < 40; i++) await B.frame();
    porPose(p);
    S.merge.release();
    const a = lerViewport(p);
    const inf = S.merge.apply();
    const b = lerViewport(p);
    return { a, b, inf };
  })();
}

const pares = [];
for (const p of poses) pares.push(await parDePose(p));
const sem = pares.map((x) => x.a);
const com = pares.map((x) => x.b);
const infoDepois = pares[pares.length - 1].inf;

/* Contagem e tempo na pose 1, no mesmo esquema intercalado. */
porPose(poses[0]);
for (let i = 0; i < 12; i++) await B.frame();
porPose(poses[0]);
S.merge.release();
const semConta = conta();
const semMs = +med([ms(), ms(), ms()]).toFixed(2);
S.merge.apply();
const comConta = conta();
const comMs = +med([ms(), ms(), ms()]).toFixed(2);

out.push(['★ CHAMADAS (passe principal + sombra, contador consertado)',
  `${semConta.calls} → ${comConta.calls} (−${semConta.calls - comConta.calls}, ` +
  `${(semConta.calls / Math.max(1, comConta.calls)).toFixed(1)}×)`]);
out.push(['★ TRIÂNGULOS — a coluna que fecha o argumento',
  `${(semConta.tris / 1e6).toFixed(3)} M → ${(comConta.tris / 1e6).toFixed(3)} M · ` +
  (Math.abs(semConta.tris - comConta.tris) <= semConta.tris * 0.0001
    ? 'IDÊNTICOS ✔'
    : `⚠️ MUDARAM em ${semConta.tris - comConta.tris} — a fusão perdeu ou duplicou geometria`)]);
out.push(['★ QUADRO', `${semMs} ms → ${comMs} ms (${(semMs / Math.max(0.01, comMs)).toFixed(1)}×)`]);
out.push(['construção', `${infoDepois?.ms ?? '?'} ms, uma vez, sob a cortina`]);

let piorMedia = 0, piorForte = 0;
for (let i = 0; i < poses.length; i++) {
  const d = difere(sem[i].px, com[i].px);
  piorMedia = Math.max(piorMedia, d.media);
  piorForte = Math.max(piorForte, d.fortes);
  out.push([`pose ${i + 1}`,
    `ΔL médio ${d.media}/255 · ${d.fortes} % acima de 12 · ${d.muitoFortes} % acima de 48 · pior pixel ${d.pior}`]);
}

/* O LIMIAR, e ele é frouxo de propósito num ponto e apertado no outro.
   Frouxo no ΔL médio: a fusão reordena a submissão dentro do mesmo material, e
   com `depthWrite` ligado e z-buffer de 24 bits isso pode trocar o vencedor de
   um empate exato de profundidade em algumas dezenas de pixels — ruído, não
   geometria. Apertado na CAUDA: 0,15 % dos pixels acima de 12 já é uma peça
   inteira com a face virada ou faltando, que é o defeito que este portão existe
   para pegar. */
out.push(['★ PORTÃO · a imagem não mudou',
  piorForte <= 0.15
    ? `PASSOU — pior pose: ΔL médio ${piorMedia}, ${piorForte} % dos pixels acima de 12`
    : `FALHOU — ${piorForte} % dos pixels acima de 12 na pior pose. ` +
      'É o padrão de "peça virada / faltando", não de reamostragem. Olhe as imagens.']);

/* ---------------------------------------------------------------------------
   O CICLO. Soltar tem de devolver EXATAMENTE a imagem de origem, e aplicar de
   novo tem de devolver EXATAMENTE a fundida — senão o primeiro resize do baú
   deixa o caminhão com um pedaço a menos e ninguém liga uma coisa à outra. */
porPose(poses[0]);
for (let i = 0; i < 40; i++) await B.frame();
porPose(poses[0]);
/* Mesmo princípio: as quatro fotos do ciclo saem sem um rAF entre elas. */
S.merge.release();
const cicloA = lerViewport(poses[0]);
S.merge.apply();
const cicloB = lerViewport(poses[0]);
S.merge.release();
const voltou = lerViewport(poses[0]);
S.merge.apply();
const reaplicou = lerViewport(poses[0]);
const dVolta = difere(cicloA.px, voltou.px);
const dRe = difere(cicloB.px, reaplicou.px);
out.push(['★ PORTÃO · o ciclo aplica→solta→aplica é estável',
  (dVolta.fortes <= 0.15 && dRe.fortes <= 0.15)
    ? `PASSOU — solta ${dVolta.fortes} % · reaplica ${dRe.fortes} %`
    : `FALHOU — solta ${dVolta.fortes} % · reaplica ${dRe.fortes} %`]);

/* ---------------------------------------------------------------------------
   O CENSO VISÍVEL — o número que `checks-aceitacao.mjs` usa como régua. Aqui ele
   serve para dizer o que a fusão fez com a contagem, que MUDA de propósito
   (2 000 malhas viram 20) e por isso não pode ser lida como "sumiu peça". */
function censo() {
  const rig = scene.getObjectByName('RIG');
  let malhas = 0;
  rig?.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, v = true;
    while (p && p !== scene) { if (!p.visible) { v = false; break; } p = p.parent; }
    if (v) malhas++;
  });
  return malhas;
}
out.push(['malhas visíveis do veículo, com a fusão de pé', String(censo())]);

/* VRAM — a fusão duplica vértices, e as origens têm o lado GPU descartado para
   compensar. Este é o número que diz se a compensação de fato aconteceu. */
out.push(['renderer.info',
  `${R.info.memory.geometries} geometrias · ${R.info.memory.textures} texturas · ${R.info.programs?.length} programas`]);

out.push(['viewport-sem-fusao', sem[0].url]);
out.push(['viewport-com-fusao', com[0].url]);
out.push(['viewport-sem-fusao-pose3', sem[2].url]);
out.push(['viewport-com-fusao-pose3', com[2].url]);

return out;
