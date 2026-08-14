/* O LAÇO SOB DEMANDA — a prova de que ligar a flag não congelou nada.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-laco-sob-demanda.mjs

   `ON_DEMAND_RENDERING` passou a `true` em 2026-08-13. A auditoria que
   autorizou a virada foi ESTÁTICA — varrer os 59 módulos atrás de mutação que
   não invalida —, e uma auditoria estática erra de um jeito específico e caro:
   ela não vê o controle que mexe num uniforme por um caminho que ninguém
   documentou. O sintoma seria um controle que não faz nada, e o lugar de achar
   isso é aqui, não no cliente.

   A FORMA DE PERGUNTAR. `renderer.info.render.frame` conta quadros DESENHADOS,
   não quadros de `requestAnimationFrame`. Então:

     · cena parada  ⇒  o contador tem de PARAR (é a economia inteira);
     · mexer num controle  ⇒  o contador tem de ANDAR (é a correção inteira).

   Cada verificação abaixo é um par desses. Uma que ande com a cena parada é uma
   invalidação sobrando (custa bateria); uma que NÃO ande depois do controle é
   uma invalidação faltando (quebra o controle), e é a que importa.

   O `--geometry` não é opcional nesta bancada: com a caixa de `boot.ts` no
   lugar do implemento, metade dos controles testados aqui não tem em que pegar.
*/
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

/* Atravessa o seletor escolhendo o primeiro card habilitado de cada passo. */
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

/* O IMPLEMENTO DE VERDADE — e este é, sozinho, o teste do `trailer.glb`
   reescrito pelo `tools/glb-texopt`. Se a compactação do BIN tivesse
   escorregado um `byteOffset`, o Draco não decodificaria e isto nunca ficaria
   pronto. */
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);

const L = S.lighting;
const frames = () => S.renderer.info.render.frame;

/** Quantos quadros DESENHADOS em n voltas do rAF. */
async function drawnOver(n) {
  const a = frames();
  for (let i = 0; i < n; i++) await B.frame();
  return frames() - a;
}

/** Mexe em algo e conta se a tela respondeu. `B.frame()` já dá duas voltas. */
async function reactsTo(label, fn) {
  await drawnOver(6);                    // deixa a cena assentar e parar
  const a = frames();
  try { fn(); } catch (e) { out.push([label, 'ERRO: ' + e.message]); return; }
  for (let i = 0; i < 4; i++) await B.frame();
  const n = frames() - a;
  out.push([label, n > 0 ? `ok (${n} quadros)` : 'NÃO DESENHOU  <<< invalidação faltando']);
}

/* ---------------- 1. a economia ---------------- */
out.push(['laço sob demanda ligado', L.isOnDemandRendering()]);
/* Doze voltas do rAF com ninguém tocando em nada. `invalidate()` marca três
   quadros, e a órbita ainda pode estar assentando o damping na primeira volta,
   então a régua é "parou", não "zero desde já". */
await drawnOver(14);
const ocioso = await drawnOver(12);
out.push(['quadros desenhados com a cena parada (12 rAF)',
  ocioso === 0 ? '0 — parou' : `${ocioso}  <<< algo invalida sozinho`]);

/* ---------------- 2. os controles ---------------- */
/* A QUARTA LACUNA, a que a nota antiga não listava: o painel "Ajuste da tinta"
   escreve por `paint.setPaint()`, e `vehicle/paint.ts` não pode invalidar
   (sumidouro de dependência). Quem invalida é `ui/paint-panel.ts`. Este é o
   teste dessa correção — e ele bate no MESMO ponto que o painel bate. */
await reactsTo('tinta: setPaint + invalidate (a 4ª lacuna)', () => {
  S.paint.setPaint({ gloss: Math.random() * 0.5 + 0.4 });
  L.invalidate();
});
/* E a prova de que o painel de verdade também responde: arrastar o slider
   dispara `input`, que é o caminho que o usuário usa. */
const slider = document.querySelector('#paint-panel .ts-pp-range');
if (slider) {
  await reactsTo('tinta: arrastar o slider do painel', () => {
    slider.value = String(Number(slider.value) + Number(slider.step || 0.01));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
} else {
  out.push(['tinta: arrastar o slider do painel', 'painel não construído']);
}

await reactsTo('luz: hora do dia', () => L.setHourOfDay(20, { animate: false }));
await reactsTo('luz: preset', () => L.applyPreset('nublado', { animate: false }));
await reactsTo('luz: azimute/elevação', () => L.setLightParams({ az: 1.2, el: 0.6 }));
await reactsTo('luz: exposição base', () => L.setExposureBase(1.2));
/* `frameAll()` mede uma LISTA de grupos — chamá-la sem argumento é um erro de
   chamada, não um controle quebrado. Os dois grupos do veículo é o que
   `frameVisible()` passa. */
await reactsTo('câmera: enquadrar',
  () => L.frameAll([S.cabGroup, S.trailerGroup]));
await reactsTo('vista: só o implemento', () => S.models.setVehicleView('trailer'));
await reactsTo('vista: conjunto', () => S.models.setVehicleView('both'));
if (S.models.setPaintTarget) {
  await reactsTo('tinta: alvo (cavalo/implemento)',
    () => S.models.setPaintTarget(S.state.paintTarget === 'both' ? 'cab' : 'both'));
}

/* ---------------- 3. o giro segura o laço ---------------- */
await drawnOver(6);
L.setTurntable(true);
const girando = await drawnOver(8);
L.setTurntable(false);
out.push(['giro de apresentação segura o laço',
  girando >= 6 ? `ok (${girando}/8)` : `${girando}/8  <<< wantsFrame não pegou`]);
/* O SOLTAR NÃO É IMEDIATO, E NÃO DEVE SER — e a cauda é LONGA.
   ---------------------------------------------------------------------------
   Parar o giro devolve `enableDamping`, e a câmera ainda carrega a inércia:
   o OrbitControls decai `sphericalDelta` por `(1 - dampingFactor)` a cada
   `update()` e só devolve `false` quando o movimento cai sob EPS (1e-6 em
   distância ao quadrado). MEDIDO aqui, com `checks-quem-invalida.mjs`, a
   descida é gradual e chega a ~200 voltas do rAF:

       logo após parar   28 quadros / 28 rAF
       mais tarde        28 / 28
       bem mais tarde    37 / 40
       e depois disso     9 / 40        <- já caindo
       controls.update() passa a devolver false

   Ou seja ela CONVERGE, que é o que este teste tem de provar; o que ela não faz
   é convergir depressa. A versão anterior deste teste media a 90 voltas e
   reprovava a INÉRCIA — que é justamente o que faz o giro parar bonito em vez
   de travar de uma vez. O resíduo é AZIMUTAL, e é por isso que a distância à
   mira não se mexe enquanto ele existe: quem quiser reproduzir tem de olhar o
   ângulo, não o raio. */
await drawnOver(130);
const depois = await drawnOver(12);
out.push(['e solta quando a inércia acaba',
  depois === 0 ? '0 — parou' : `${depois}  <<< o damping não converge`]);

/* ---------------- 4. o retrato do custo ---------------- */
const st = L.getRenderStats();
out.push(['chamadas de desenho por quadro', st.calls]);
out.push(['triângulos por quadro', st.triangles.toLocaleString('pt-BR')]);
out.push(['geometrias na GPU', st.geometries]);
out.push(['texturas na GPU', st.textures]);
out.push(['programas compilados', st.programs]);

return out;
