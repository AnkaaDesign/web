/* O PERFIL DE QUALIDADE — que o teto não se mexeu, e que o piso funciona.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-qualidade.mjs

   Duas perguntas, e a PRIMEIRA é a que importa mais:

   1. **O nível Alto é idêntico ao que o estúdio fazia antes do perfil existir?**
      Se não for, o perfil não criou um piso: ele baixou o teto, e teria feito
      exatamente o oposto do que foi pedido. Os valores conferidos são os que
      estavam cravados no código — `min(dpr,2)`, sombra 3072², anisotropia 8,
      reflexo do piso ligado, casca de laranja ligada.

   2. Descer de nível MEXE de verdade nos botões, e voltar DEVOLVE tudo. Um
      perfil que muda um número e não muda o renderer é pior que nenhum: ele
      relata uma economia que não aconteceu.

   E uma terceira, que é a regra inegociável do módulo: **a captura roda sempre
   no teto**, mesmo com a vista em Baixo. */
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
await settle();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!S.trailerRig, 240000);
const Q = S.quality;
const R = S.renderer;
const dpr = window.devicePixelRatio || 1;

/* ---------------- a sonda ---------------- */
const hw = Q.info().hardware;
out.push(['sonda: WebGL2', hw.webgl2]);
out.push(['sonda: adaptador', hw.renderer || '(mascarado — tratado como DESCONHECIDO)']);
out.push(['sonda: rasterizador de software', hw.software ? 'SIM' : 'não']);
out.push(['sonda: núcleos / memória', `${hw.cores} / ${hw.memoryGB || '?'} GB`]);
out.push(['sonda: pixels a preencher', hw.pixels.toLocaleString('pt-BR')]);
out.push(['sonda sugere', Q.info().sugestaoDaSonda]);

/* ---------------- 1. o teto não se mexeu ---------------- */
Q.set('alta');
for (let i = 0; i < 4; i++) await B.frame();
const key = S.lighting.getKeyLight ? S.lighting.getKeyLight() : null;
const shadowSide = key ? key.shadow.mapSize.x : 0;
const p = Q.profile();
const teto = [
  /* O TETO DO DPR, e não o `getPixelRatio()` resultante. Nesta bancada o
     `devicePixelRatio` é 1, então `min(1,2)` e `min(1,1)` dão o mesmo número e a
     comparação do valor efetivo passaria mesmo se o teto tivesse sido quebrado.
     O `cap` é o que o perfil DECIDE, e é independente do monitor. */
  ['teto do pixelRatio', p.pixelRatioCap, 2],
  ['pixelRatio efetivo', R.getPixelRatio(), Math.min(dpr, 2)],
  ['sombra', shadowSide, Math.min(3072, R.capabilities.maxTextureSize)],
  ['anisotropia do veículo', p.anisotropyVehicle,
    Math.min(8, R.capabilities.getMaxAnisotropy())],
  ['reflexo do piso', p.floorReflection, true],
  ['casca de laranja', p.orangePeel, true],
];
for (const [nome, got, want] of teto) {
  out.push([`ALTO = o de sempre · ${nome}`,
    got === want ? `ok (${got})` : `${got} — esperado ${want}  <<< O TETO MUDOU`]);
}

/* ---------------- 2. o piso funciona ---------------- */
Q.set('baixa');
for (let i = 0; i < 6; i++) await B.frame();
const lo = Q.profile();
out.push(['BAIXO · teto do pixelRatio caiu',
  lo.pixelRatioCap === 1 ? 'ok (1)' : `${lo.pixelRatioCap}  <<<`]);
out.push(['BAIXO · pixelRatio efetivo',
  R.getPixelRatio() === Math.min(dpr, 1) ? `ok (${R.getPixelRatio()})` : `${R.getPixelRatio()}  <<<`]);
const loShadow = key ? key.shadow.mapSize.x : 0;
out.push(['BAIXO · sombra caiu', loShadow === 1024 ? 'ok (1024)' : `${loShadow}  <<<`]);
out.push(['BAIXO · reflexo desligado', lo.floorReflection === false ? 'ok' : 'AINDA LIGADO <<<']);
out.push(['BAIXO · casca de laranja desligada', lo.orangePeel === false ? 'ok' : 'AINDA LIGADA <<<']);
/* O uniforme de verdade, e não só o perfil: é ele que o shader lê. `set()` sem
   argumento reaplica, e o gancho de `onQualityChange` já devia ter feito isso. */
const uPeel = S.uniforms?.uPeel?.value;
out.push(['BAIXO · uPeel no shader', uPeel === 0 ? 'ok (0)' : `${uPeel}  <<< não zerou`]);

/* ---------------- 3. e volta ---------------- */
Q.set('alta');
for (let i = 0; i < 6; i++) await B.frame();
out.push(['volta ao ALTO · pixelRatio',
  R.getPixelRatio() === Math.min(dpr, 2) ? 'ok' : `${R.getPixelRatio()}  <<<`]);
out.push(['volta ao ALTO · sombra',
  (key ? key.shadow.mapSize.x : 0) === Math.min(3072, R.capabilities.maxTextureSize)
    ? 'ok' : `${key && key.shadow.mapSize.x}  <<<`]);
out.push(['volta ao ALTO · uPeel volta',
  (S.uniforms?.uPeel?.value ?? 0) > 0 ? 'ok' : 'ficou 0  <<<']);

/* ---------------- 4. a captura ignora o nível ---------------- */
/* A regra inegociável: a imagem BAIXADA sai no teto mesmo com a vista no piso.
   A captura renderiza em ladrilhos para um alvo próprio, que tem o próprio
   viewport e não passa por `setPixelRatio` — então o teste é que o alvo da
   captura não encolhe com o nível. Medido pelo tamanho que ela pede. */
/* A RESOLUÇÃO já obedece por construção (alvo próprio, sem `setPixelRatio`).
   O MAPA DE SOMBRA era a brecha: ele é global do renderizador, e no nível Baixo
   a foto sairia com 1024² — visível no contato do pneu com o chão, que é
   exatamente onde o olho procura. `captureViewport` levanta e devolve.
   O teste espia o mapa DURANTE a captura, que é o único momento em que a
   diferença existe. */
Q.set('baixa');
for (let i = 0; i < 6; i++) await B.frame();
const antes = key.shadow.mapSize.x;
/* ESPIÃO NA ESCRITA, e não amostragem por temporizador. `captureViewport()` é
   BLOQUEANTE — o mosaico roda inteiro na thread principal, e o cabeçalho dela
   diz isso —, então nenhum `setInterval` dispara enquanto ela trabalha: a
   primeira versão deste teste amostrava 1024 porque só conseguia ler ANTES e
   DEPOIS. Envolver o `set` do Vector2 registra a escrita no instante em que ela
   acontece, o que funciona em código bloqueante. */
let durante = antes;
const mapSize = key.shadow.mapSize;
const setOrig = mapSize.set.bind(mapSize);
mapSize.set = (x, y) => { if (x > durante) durante = x; return setOrig(x, y); };
let capturou = false;
try {
  await S.capture.captureViewport({ quality: 'low' });
  capturou = true;
} catch (e) { out.push(['captura', 'ERRO: ' + e.message]); }
mapSize.set = setOrig;
out.push(['BAIXO · mapa de sombra da vista', antes === 1024 ? 'ok (1024)' : `${antes} <<<`]);
out.push(['BAIXO · mapa de sombra DURANTE a captura',
  !capturou ? 'captura falhou'
    : durante >= 3072 ? `ok (${durante} — teto)`
      : `${durante}  <<< a foto saiu degradada`]);
out.push(['e devolvido depois da captura',
  key.shadow.mapSize.x === 1024 ? 'ok (1024)' : `${key.shadow.mapSize.x}  <<< vazou`]);
Q.set('auto');
out.push(['modo devolvido ao automático', Q.mode === 'auto']);
out.push(['nível efetivo em automático', Q.level]);

/* ---------------- 5. o medidor SÓ AMOSTRA EM QUADRO DESENHADO ----------------
   E com o laço sob demanda isso quer dizer: só enquanto alguém está mexendo.
   Não é defeito, é a consequência correta de duas decisões que se encontram —
   um quadro pulado custa ~0 ms e alimentá-lo ao medidor faria a média despencar
   com a cena parada, concluindo que a máquina é um foguete justamente quando
   ela não está fazendo nada.
   Então: com a cena imóvel o medidor fica em 0 (nenhuma amostra), e é preciso
   PRODUZIR quadros para ele ter o que medir. O giro de apresentação é a forma
   mais limpa de fazer isso na bancada. */
out.push(['medidor com a cena parada', Q.info().msPorQuadro === 0
  ? '0 — sem amostra, como esperado' : `${Q.info().msPorQuadro} ms`]);
S.lighting.setTurntable(true);
for (let i = 0; i < 60; i++) await B.frame();
S.lighting.setTurntable(false);
const ms = Q.info().msPorQuadro;
out.push(['medidor depois de 120 quadros girando',
  ms > 0 ? `${ms} ms por quadro` : '0  <<< o medidor não recebeu amostra']);
out.push(['e o nível continua', Q.level]);

return out;
