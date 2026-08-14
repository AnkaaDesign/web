/* O PERFIL DE QUALIDADE — que o teto não se mexeu, e que o piso EXISTE.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-qualidade.mjs

   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO FOI REESCRITO (2026-08-14)

   A versão anterior passava. Ela conferia, uma a uma, que `pixelRatioCap` caía
   de 2 para 1, que a sombra caía de 3072 para 1024, que `uPeel` zerava. **Todos
   os testes passavam, e o seletor não fazia nada** — o relato do dono foi
   literalmente *"colocando no modo de qualidade baixa não vejo diferença
   nenhuma, nem visual, nem de performance"*.

   A lição, e ela governa a forma deste arquivo: **conferir que um NÚMERO DE
   CONFIGURAÇÃO mudou não prova nada.** `pixelRatioCap` caía de 2 para 1 e o
   `devicePixelRatio` desta bancada é 1, então `min(1,2)` e `min(1,1)` são o
   mesmo número — o teste passava lendo o campo do perfil e o renderizador nunca
   se mexia. A sombra caía para 1024 e o passe de sombra nem roda enquanto se
   gira a câmera.

   Então os testes daqui em diante medem **o efeito no renderizador e no
   quadro**, nunca o campo que o pediu:

     · o BUFFER DE DESENHO tem de encolher, em pixels;
     · as CHAMADAS DE DESENHO e os TRIÂNGULOS têm de cair;
     · a CONTAGEM DE INSTÂNCIAS de vegetação tem de cair;
     · o BIAS da sombra tem de acompanhar o lado do mapa.

   Um teste que pergunta ao perfil o que o perfil acabou de dizer é um espelho,
   não uma régua.

   ---------------------------------------------------------------------------
   AS QUATRO PERGUNTAS

   1. **O nível Alto é, valor por valor, o que o estúdio fazia antes do perfil
      existir?** Se não for, o perfil não criou um piso: ele baixou o teto, e
      teria feito o oposto do que foi pedido.
   2. **Descer de nível muda o RENDERIZADOR, e não só a tabela?**
   3. **Voltar devolve tudo?**
   4. **A captura sai sempre no teto**, mesmo com a vista no piso.

   ---------------------------------------------------------------------------
   ⚠️ ESTE ARQUIVO É DEFENSIVO DE PROPÓSITO. Ele roda contra um engine em que
   partes do encanamento (o pool de luz frio, o LOD, o painel) podem ainda não
   estar ligadas. Um `?.` a mais aqui é melhor que uma bancada que morre no
   terceiro teste e não relata os outros trinta. Onde um caminho não existe, o
   teste relata "não ligado" em vez de falhar — mas relata, e em voz alta. */
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

const key = S.lighting.getKeyLight ? S.lighting.getKeyLight() : null;
const stats = () => (S.lighting.getRenderStats ? S.lighting.getRenderStats() : null);

/** Deixa a cena assentar e devolve um retrato do que o RENDERIZADOR está
 *  fazendo — não do que o perfil diz que deveria. */
async function retrato(n = 8) {
  for (let i = 0; i < n; i++) await B.frame();
  const c = R.domElement;
  /* Um quadro forçado: `getRenderStats()` conta o ÚLTIMO desenho, e sob o laço
     sob demanda o último desenho pode ser antigo. O giro garante quadro novo. */
  S.lighting.setTurntable(true);
  for (let i = 0; i < 4; i++) await B.frame();
  const st = stats();
  S.lighting.setTurntable(false);
  return {
    bufW: c.width, bufH: c.height, px: c.width * c.height,
    pixelRatio: R.getPixelRatio(),
    sombra: key ? key.shadow.mapSize.x : 0,
    bias: key ? key.shadow.bias : 0,
    normalBias: key ? key.shadow.normalBias : 0,
    calls: st ? st.calls : 0,
    tris: st ? st.triangles : 0,
    programs: st ? st.programs : 0,
    perfil: Q.profile(),
  };
}

const marca = (nome, ok, detalhe) =>
  out.push([nome, ok ? `ok — ${detalhe}` : `${detalhe}  <<<`]);

/**
 * Troca de nível e ESPERA A PARTE FRIA ASSENTAR.
 *
 * ⚠️ Desde 14/08 um ato do usuário dispara a reconstrução sob cortina depois de
 * ~700 ms (ver `setColdApplier()` em core/quality.ts). Medir antes disso lê uma
 * cena em transição, e medir DURANTE lê uma cena meio desmontada — foi o que
 * fez a versão anterior deste arquivo comparar Alta-sem-refletores contra
 * Alta-com-catorze e concluir um ganho de 2,2× que não existia.
 */
async function nivel(l) {
  Q.set(l);
  for (let i = 0; i < 60; i++) await B.frame();      // cobre o debounce
  await B.until(() => !Q.coldPending, 180000);       // e a cortina
  for (let i = 0; i < 20; i++) await B.frame();
}

/* ---------------- 0. a sonda ---------------- */
const info0 = Q.info();
const hw = info0.hardware;
out.push(['sonda: WebGL2', hw.webgl2]);
out.push(['sonda: adaptador', hw.renderer || '(mascarado — tratado como DESCONHECIDO)']);
out.push(['sonda: rasterizador de software', hw.software ? 'SIM' : 'não']);
out.push(['sonda: INTEGRADA reconhecida', hw.integrated ? 'SIM — teto em Média' : 'não']);
out.push(['sonda: família modesta', hw.weakHint ? 'SIM — teto em Baixa' : 'não']);
out.push(['sonda: núcleos / memória', `${hw.cores} / ${hw.memoryGB || '?'} GB`]);
out.push(['sonda: pixels a preencher', (hw.pixels || 0).toLocaleString('pt-BR')]);
out.push(['sonda sugere', info0.sugestaoDaSonda]);
out.push(['devicePixelRatio desta bancada', dpr]);

/* ⚠️ O CASO QUE MOTIVOU A REESCRITA DA SONDA. Uma integrada reconhecida NÃO
   pode abrir em Alta, por mais núcleos e memória que a máquina tenha — uma CPU
   boa não torna uma integrada rápida, só garante que o gargalo será a GPU. A
   versão anterior somava os sinais e um i5 de 10ª com UHD 630 e 16 GB dava
   `+1 ⇒ alta`. */
if (hw.integrated || hw.weakHint) {
  marca('integrada NÃO abre em Alta',
    info0.sugestaoDaSonda !== 'alta',
    `sonda sugeriu ${info0.sugestaoDaSonda}`);
}

/* ---------------- 1. O TETO NÃO SE MEXEU ---------------- */
await nivel('alta');
const alto = await retrato();
const frioAlto = Q.info().frio ? Q.info().frio.pedido : null;

const teto = [
  ['escala de render', alto.perfil.renderScale, 1],
  ['teto do pixelRatio', alto.perfil.pixelRatioCap, 2],
  ['pixelRatio efetivo', alto.pixelRatio, Math.min(dpr, 2)],
  ['sombra', alto.sombra, Math.min(3072, R.capabilities.maxTextureSize)],
  ['anisotropia do veículo', alto.perfil.anisotropyVehicle,
    Math.min(8, R.capabilities.getMaxAnisotropy())],
  ['reflexo do piso', alto.perfil.floorReflection, 'full'],
  ['casca de laranja', alto.perfil.orangePeel, true],
  ['oitavas de floco', alto.perfil.flakeOctaves, 2],
  ['vegetação', alto.perfil.vegetation, 1],
  ['amostras do corredor', alto.perfil.seeThroughSamples, 8],
  ['LOD desligado', alto.perfil.lodMinPx, 0],
  ['sonda de reflexo', alto.perfil.probeSize, 256],
];
for (const [nome, got, want] of teto) {
  out.push([`ALTO = o de sempre · ${nome}`,
    got === want ? `ok (${got})` : `${got} — esperado ${want}  <<< O TETO MUDOU`]);
}
if (frioAlto) {
  /* ⚠️ ESTE BLOCO LIA A COISA ERRADA E PASSAVA MENTINDO (corrigido 14/08).
     `Q.info().frio.pedido` é o que o NÍVEL pede; o que está no ar é
     `frio.aplicado`. Como o pool de refletores e o filtro de sombra são FRIOS,
     um `set('alta')` no meio da sessão muda o pedido e NÃO muda o aplicado —
     então este teste dizia "ok (14)" com a cena rodando a ZERO refletores.

     Isso não é hipótese: medido nesta bancada, com a sonda pondo o boot em
     'baixa', `set('alta')` deixou `pedido: 14` e `aplicado: 0`, com zero
     SpotLight na cena. Um A/B de desempenho feito em cima disso comparou
     HEAD-sem-luz contra versões-com-luz e atribuiu 2,2× de ganho ao código
     errado.

     A régua honesta é o APLICADO, e a contagem de `SpotLight` de verdade
     confere se até ele está dizendo a verdade. */
  const frioAplicado = Q.info().frio ? Q.info().frio.aplicado : null;
  const spotsVivos = (() => {
    let n = 0;
    S.scene.traverse((o) => {
      if (!o.isSpotLight) return;
      let v = o.visible, p = o.parent;
      while (v && p) { v = p.visible; p = p.parent; }
      if (v) n++;
    });
    return n;
  })();
  out.push(['ALTO = o de sempre · MSAA (aplicado)',
    frioAplicado && frioAplicado.antialias === true ? 'ok (ligado)' : 'DESLIGADO  <<<']);
  out.push(['ALTO = o de sempre · pool de spots (APLICADO)',
    frioAplicado && frioAplicado.spotPool === 14
      ? 'ok (14)'
      : `${frioAplicado && frioAplicado.spotPool} — pedido ${frioAlto.spotPool}`
        + `  <<< FRIO PENDENTE: a medida abaixo NÃO é o nível Alto`]);
  out.push(['SpotLights de fato na cena', spotsVivos]);
  out.push(['ALTO = o de sempre · filtro de sombra (aplicado)',
    frioAplicado && frioAplicado.shadowType === 'pcf' ? 'ok (pcf)' : `${frioAplicado && frioAplicado.shadowType}  <<<`]);
} else {
  out.push(['perfil FRIO', 'não exposto no handle — não pude conferir o teto frio']);
}
out.push(['ALTO · buffer de desenho', `${alto.bufW}×${alto.bufH} = ${alto.px.toLocaleString('pt-BR')} px`]);
out.push(['ALTO · chamadas / triângulos',
  `${alto.calls.toLocaleString('pt-BR')} / ${alto.tris.toLocaleString('pt-BR')}`]);

/* ---------------- 2. O PISO EXISTE — e este é O teste ---------------- */
await nivel('baixa');
const baixo = await retrato();

/* ⚠️ **O TESTE QUE A VERSÃO ANTERIOR NÃO TINHA, E QUE TERIA PEGO O DEFEITO.**
   Ele não pergunta ao perfil: mede o canvas. Num monitor a dpr 1 o sistema
   antigo devolvia exatamente o mesmo buffer nos três níveis, e nenhum teste
   daquele arquivo reprovava. */
marca('BAIXO · o BUFFER DE DESENHO encolheu de verdade',
  baixo.px < alto.px * 0.75,
  `${alto.bufW}×${alto.bufH} → ${baixo.bufW}×${baixo.bufH}`
  + ` (${Math.round((baixo.px / alto.px) * 100)} % dos pixels)`);

marca('BAIXO · escala de render aplicada',
  Math.abs(baixo.perfil.renderScale - 0.65) < 0.2,
  `renderScale = ${baixo.perfil.renderScale}`);

/* ⚠️ O BIAS TEM DE ACOMPANHAR O LADO DO MAPA. Este é o bug que a auditoria
   achou: metros por texel tem dois fatores — `(2·meia-caixa)/lado` — e só o
   numerador era compensado. Baixar o mapa sem escalar o bias põe o `normalBias`
   abaixo de meio texel, e a sombra vaza por baixo do próprio objeto
   (peter-panning). O nível Baixo vinha com a sombra descolada do pneu. */
if (key && alto.sombra && baixo.sombra) {
  const razaoMapa = alto.sombra / baixo.sombra;
  const razaoBias = baixo.normalBias / alto.normalBias;
  marca('BAIXO · o bias da sombra acompanhou o mapa',
    Math.abs(razaoBias - razaoMapa) < 0.05 * razaoMapa,
    `mapa ${alto.sombra}→${baixo.sombra} (×${razaoMapa.toFixed(2)}),`
    + ` normalBias ×${razaoBias.toFixed(2)}`);
}

/* Vegetação: a CONTAGEM DE INSTÂNCIAS, não o campo do perfil. */
const contaPlantas = () => {
  let n = 0;
  S.scene.traverse((o) => { if (o.isInstancedMesh && /^PLANT_/i.test(o.material?.name || '')) n += o.count; });
  return n;
};
Q.set('alta'); await B.frame(); await B.frame();
const plantasAlto = contaPlantas();
Q.set('baixa'); await B.frame(); await B.frame();
const plantasBaixo = contaPlantas();
if (plantasAlto > 0) {
  marca('BAIXO · a vegetação ralou de verdade',
    plantasBaixo < plantasAlto * 0.6,
    `${plantasAlto} → ${plantasBaixo} plantas`);
} else {
  out.push(['vegetação', 'nenhuma InstancedMesh PLANT_ encontrada — cenário sem vegetação?']);
}

/* Os uniformes de verdade, que é o que o shader lê. */
out.push(['BAIXO · uPeel no shader',
  (S.uniforms?.uPeel?.value ?? -1) === 0 ? 'ok (0)' : `${S.uniforms?.uPeel?.value}  <<< não zerou`]);
out.push(['BAIXO · reflexo do piso', baixo.perfil.floorReflection === 'off'
  ? 'ok (off)' : `${baixo.perfil.floorReflection}  <<<`]);
out.push(['BAIXO · sombra', `${baixo.sombra} (2048 é o alvo — 1024 era perda sem ganho)`]);
out.push(['BAIXO · chamadas / triângulos',
  `${baixo.calls.toLocaleString('pt-BR')} / ${baixo.tris.toLocaleString('pt-BR')}`]);
marca('BAIXO · as chamadas de desenho caíram',
  baixo.calls < alto.calls,
  `${alto.calls.toLocaleString('pt-BR')} → ${baixo.calls.toLocaleString('pt-BR')}`
  + ` (${alto.calls ? Math.round((1 - baixo.calls / alto.calls) * 100) : 0} % a menos)`);

/* ---------------- 3. E VOLTA ---------------- */
await nivel('alta');
const volta = await retrato();
marca('volta ao ALTO · buffer devolvido',
  volta.px === alto.px, `${volta.bufW}×${volta.bufH}`);
marca('volta ao ALTO · sombra devolvida',
  volta.sombra === alto.sombra, `${volta.sombra}`);
marca('volta ao ALTO · bias devolvido',
  Math.abs(volta.normalBias - alto.normalBias) < 1e-9, `${volta.normalBias}`);
out.push(['volta ao ALTO · uPeel volta',
  (S.uniforms?.uPeel?.value ?? 0) > 0 ? 'ok' : 'ficou 0  <<<']);
marca('volta ao ALTO · vegetação devolvida',
  contaPlantas() === plantasAlto, `${contaPlantas()} / ${plantasAlto}`);

/* ---------------- 4. A CAPTURA IGNORA O NÍVEL ---------------- */
/* A regra inegociável: a imagem BAIXADA sai no teto mesmo com a vista no piso.
   A resolução já obedece por construção (alvo próprio, sem `setPixelRatio`); o
   MAPA DE SOMBRA era a brecha, porque é global do renderizador.

   ESPIÃO NA ESCRITA, e não amostragem por temporizador: `captureViewport()` é
   BLOQUEANTE — o mosaico roda inteiro na thread principal —, então nenhum
   `setInterval` dispara enquanto ela trabalha. A primeira versão deste teste
   lia só ANTES e DEPOIS e por isso nunca via o levantamento. */
Q.set('baixa');
for (let i = 0; i < 6; i++) await B.frame();
const antes = key ? key.shadow.mapSize.x : 0;
let durante = antes;
let pxScaleDurante = null;
if (key) {
  const mapSize = key.shadow.mapSize;
  const setOrig = mapSize.set.bind(mapSize);
  mapSize.set = (x, y) => { if (x > durante) durante = x; return setOrig(x, y); };
  let capturou = false;
  try {
    await S.capture.captureViewport({ quality: 'low' });
    capturou = true;
  } catch (e) { out.push(['captura', 'ERRO: ' + e.message]); }
  mapSize.set = setOrig;
  out.push(['BAIXO · mapa de sombra da vista', `${antes}`]);
  out.push(['BAIXO · mapa de sombra DURANTE a captura',
    !capturou ? 'captura falhou'
      : durante >= 3072 ? `ok (${durante} — teto)`
        : `${durante}  <<< a foto saiu degradada`]);
  out.push(['e devolvido depois da captura',
    key.shadow.mapSize.x === antes ? `ok (${antes})` : `${key.shadow.mapSize.x}  <<< vazou`]);
}

/* ⚠️ NOVO, e ele existe por causa da escala de render. `capture.ts` ancora o
   tamanho do floco metálico dividindo pela altura do buffer — e o buffer passou
   a carregar a escala. Sem desfazê-la, uma máquina em Baixo baixaria uma foto
   com o floco de granulação diferente da de uma máquina em Alto, o que é a
   violação direta de "a imagem baixada é o produto". */
if (S.paintPixelScale) {
  out.push(['escala de pixel da tinta depois da captura',
    S.paintPixelScale() === 1 ? 'ok (1 — devolvida)' : `${S.paintPixelScale()}  <<< vazou`]);
}

/* ---------------- 5. O MEDIDOR, E A RÉGUA NOVA ---------------- */
/* Com o laço sob demanda, o medidor só amostra enquanto alguém está mexendo —
   um quadro pulado custa ~0 ms e alimentá-lo faria a média despencar com a cena
   parada. Então: parado, zero; girando, um número.

   ⚠️ A RÉGUA MUDOU. Era o tempo de SUBMISSÃO do `render()`, que numa máquina
   limitada por CPU não vê nada do que domina, e com o laço preso ao vsync não
   vê a espera do swap. Agora é o tempo de PAREDE entre dois quadros DESENHADOS
   CONSECUTIVOS. Os dois canais continuam expostos, e a comparação entre eles é
   o que diz onde está o gargalo. */
Q.set('auto');
for (let i = 0; i < 4; i++) await B.frame();
/* ⚠️ ESTE VALOR NÃO É MAIS ZERO, e a mudança é deliberada. Até 14/08 o medidor
   saía na primeira linha quando o modo não era `auto`, então congelar um nível
   parava a medição — e quem congela "Baixa" para comparar com "Alta" é
   exatamente quem precisa do número. Medir e adaptar foram separados: a régua
   roda sempre, só a adaptação obedece ao modo.

   Consequência para esta linha: o EMA SOBREVIVE aos testes anteriores, então o
   que se lê aqui é o resto deles, não uma amostra nova. O que continua valendo
   é que nenhum quadro PULADO entra na conta — é isso que `lastDrawnAt = 0` no
   laço garante, e é o que o teste de giro abaixo exercita. */
out.push(['medidor: leitura herdada dos testes acima',
  `${Q.info().msPorQuadro} ms (o EMA persiste por desenho, não zera com a cena parada)`]);
S.lighting.setTurntable(true);
for (let i = 0; i < 90; i++) await B.frame();
S.lighting.setTurntable(false);
const fim = Q.info();
out.push(['medidor: ms de PAREDE por quadro', fim.msPorQuadro || '0  <<< sem amostra']);
out.push(['medidor: ms de SUBMISSÃO', fim.msDeSubmissao ?? '(não exposto)']);
out.push(['medidor: fps', fim.fps || '—']);
if (fim.msPorQuadro && fim.msDeSubmissao != null) {
  const razao = fim.msDeSubmissao / fim.msPorQuadro;
  out.push(['onde está o gargalo', razao > 0.6
    ? `submissão é ${Math.round(razao * 100)} % da parede — limitado por GPU/submissão`
    : `submissão é só ${Math.round(razao * 100)} % da parede — limitado por CPU fora do render, ou vsync`]);
}
out.push(['escala de render corrente', fim.escalaDeRender]);
out.push(['faixa do nível', fim.faixaDaEscala
  ? `${fim.faixaDaEscala.min}–${fim.faixaDaEscala.max}, alvo ${fim.faixaDaEscala.targetMs} ms`
  : '(não exposta)']);
out.push(['modo devolvido ao automático', Q.mode === 'auto']);
out.push(['nível efetivo em automático', Q.level]);
out.push(['mudança fria pendente', fim.frioPendente ? 'SIM' : 'não']);

return out;
