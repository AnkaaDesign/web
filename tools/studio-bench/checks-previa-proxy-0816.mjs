/* A PRÉVIA DO CRIADOR DE VÍDEO, MEDIDA NO CENÁRIO DO RELATO — 2026-08-16.
   ===========================================================================
   Segunda passagem por *"o preview está muito travado […] fica tipo flicando"*,
   depois de o dono reportar *"tinha parado de bugar, mas voltou por algum
   motivo"*.

   ⚠️ O "POR ALGUM MOTIVO" É A PARTE INFORMATIVA. Um defeito que vai e volta sem
   o código mudar depende de ESTADO — e o estado, aqui, é a ESCALA DE RENDER no
   instante em que se aperta ▶. A primeira tentativa de conserto congelava o
   controlador de qualidade com `markBusy()`, o que tirava da prévia a única
   válvula que a mantinha fluida: com a escala em 1,0 no clique, ela ficava em
   1,0 o percurso inteiro. O argumento completo está no § O MODO PROXY DA PRÉVIA,
   em `engine/scene/timeline.ts`.

   ⚠️ E ESTA BANCADA MEDE NO CENÁRIO CERTO. As telas do dono mostram o ESTÚDIO —
   sala cinza, piso polido —, e é lá que mora a SEGUNDA RENDERIZAÇÃO COMPLETA da
   cena (`floor-reflection.ts`), que o diagnóstico da máquina dele mede em 4,6 ms
   de um quadro de 16,2 ms. A primeira medição rodou no distrito e deu 60 fps
   cravados: ela mediu outra coisa.

   ⚠️⚠️ O QUE ESTA MÁQUINA **NÃO** CONSEGUE PROVAR. Aqui o laço fica travado em
   vsync (16,6 ms) com folga em qualquer configuração, então nenhum número de
   tempo daqui refuta ou confirma o engasgo do dono. O que os portões abaixo
   provam é o MECANISMO: que o proxy está de fato ligado DURANTE a reprodução,
   que ele derruba as duas coisas certas, e que devolve exatamente o que pegou.

   ⚠️ E `frameSplit` NÃO VALE DURANTE A PRÉVIA: `markBusy()` põe o laço numa
   janela ocupada, e a repartição só é atualizada fora dela. Os números de
   repartição impressos aqui são os de ANTES — estão no relatório para não
   parecerem medição do que não são.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-previa-proxy-0816.mjs
*/
const out = [];
const B = window.__bench;
const q = (s) => document.querySelector(s);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 480000);
const S = window.__studio;
await B.until(() => !!(S.state?.trailer || S.state?.cab), 240000);
for (let i = 0; i < 20; i++) await B.frame();

/* ⚠️ O CENÁRIO DO RELATO. As telas do dono mostram o ESTÚDIO — sala cinza, piso
   polido —, e é lá que mora a SEGUNDA PASSADA DE CENA do reflexo. A medição
   anterior rodou no distrito e deu 60 fps cravados: ela mediu outra coisa. */
out.push(['entrou no cenário Estúdio', await B.enterStudio()]);
for (let i = 0; i < 30; i++) await B.frame();
out.push(['reflexo do piso ligado', S.cyclorama?.isFloorReflectionOn?.() ?? 'n/d']);

const TL = S.timeline; const cam = S.camera; const controls = S.controls;
TL.clearTimeline();
document.getElementById('btn-rec').click(); await B.frame();
q('.ts-shotmenu__item[data-m="percurso"]').click(); await B.frame();
q('#ts-recmenu .ts-shotgo').click(); await B.frame(); await B.frame();

const foco = controls.target.clone();
const r0 = cam.position.distanceTo(controls.target);
const pose = (az, el, r) => {
  const a = az * Math.PI / 180, e = el * Math.PI / 180, ce = Math.cos(e);
  controls.target.copy(foco);
  cam.position.set(foco.x + Math.sin(a)*ce*r, foco.y + Math.sin(e)*r, foco.z + Math.cos(a)*ce*r);
};
for (const [az, el, r] of [[20,14,r0], [110,24,r0*0.85], [200,12,r0*1.05], [300,20,r0*0.9]]) {
  pose(az, el, r); await B.frame(); await B.frame();
  q('.ts-tl__add').click(); await B.frame();
}
for (const sel of document.querySelectorAll('.ts-tl__conn .ts-tl__selin')) {
  sel.value = '4'; sel.dispatchEvent(new Event('change', { bubbles: true }));
}
await B.frame();

let dentro = null;
async function medir(rotulo) {
  TL.seekTimelinePreview(0);
  await new Promise((r) => setTimeout(r, 200));
  TL.playTimelinePreview();
  const dts = []; const splits = []; const calls = [];
  await new Promise((res) => {
    let last = performance.now(); let n = 0;
    const step = () => {
      const now = performance.now();
      dts.push(now - last); last = now;
      if (n === 40) {
        /* ⚠️ MEDIDO DENTRO DA REPRODUÇÃO. A primeira versão perguntou DEPOIS do
           `pause()`, que já tinha restaurado tudo — e leu `false` de um proxy
           que estivera ligado o percurso inteiro. */
        dentro = {
          proxy: TL.isPreviewProxyOn?.(),
          reflexoCaiu: TL.previewDroppedReflection?.(),
          reflexoLigado: S.cyclorama.isFloorReflectionOn(),
          escala: S.quality.renderScale,
          fps: Math.round(TL.previewFps?.() ?? 0),
        };
      }
      if (n % 10 === 0) {
        const st = S.quality.stats();
        splits.push(st.frameSplit); calls.push(st.calls);
      }
      if (++n >= 160) { res(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  TL.pauseTimelinePreview();
  dts.shift(); dts.shift();
  const s = dts.slice().sort((a,b)=>a-b);
  const p = (f) => Math.round(s[Math.floor(s.length*f)]*10)/10;
  const med = (arr, k) => { const v = arr.map((x)=>x[k]).filter((x)=>x>0).sort((a,b)=>a-b); return v.length ? Math.round(v[Math.floor(v.length/2)]*10)/10 : 0; };
  out.push([rotulo,
    `mediana ${p(0.5)} ms · p95 ${p(0.95)} ms · pior ${Math.round(s[s.length-1])} ms`
    + ` · >25ms: ${dts.filter((d)=>d>25).length}/${dts.length}`]);
  out.push([rotulo + ' — repartição',
    `parede ${med(splits,'parede')} · fora ${med(splits,'fora')} · laço ${med(splits,'laco')}`
    + ` · ganchos ${med(splits,'ganchos')} · submissão ${med(splits,'submissao')}`
    + ` · calls ${Math.round(calls.reduce((a,b)=>a+b,0)/calls.length)}`]);
}

const escalaAntes = S.quality.renderScale;
const reflexoAntes = S.cyclorama.isFloorReflectionOn();
await medir('A · como está hoje');
out.push(['DENTRO da prévia', JSON.stringify(dentro)]);
out.push(['★ o proxy estava LIGADO durante a reprodução', dentro?.proxy === true]);
out.push(['★ o reflexo do piso saiu de cena', dentro?.reflexoLigado === false]);
out.push(['★ a escala de render caiu', dentro?.escala <= 0.71]);
out.push(['★ a prévia mede a própria taxa', (dentro?.fps ?? 0) > 10]);
out.push(['★ e TUDO voltou ao pausar',
  S.quality.renderScale === escalaAntes && S.cyclorama.isFloorReflectionOn() === reflexoAntes]);
out.push(['escala antes / depois', `${escalaAntes} / ${S.quality.renderScale}`]);

/* B · sem o reflexo, à força */
S.cyclorama.setFloorReflection(false);
await B.frame();
await medir('B · reflexo DESLIGADO à força');
S.cyclorama.setFloorReflection(true);
await B.frame();

/* C · reflexo em 1/4 de lado */
S.cyclorama.setFloorReflectionScale(0.25);
await B.frame(); await B.frame();
await medir('C · reflexo a 1/4 de lado');
S.cyclorama.setFloorReflectionScale(1);
await B.frame();

out.push(['nível de qualidade durante', S.quality.info().level]);
return out;
