/* O CURSOR SOBRE O NOME DA CAMADA — medido, não suposto.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-cursor-camada-0816.mjs

   Relato de 2026-08-16, DEPOIS do conserto: *"quando passo o mouse por cima do
   texto da camada continua cursor text em vez de pointer"*. Este arquivo lê o
   `cursor` COMPUTADO de cada peça da linha e diz qual delas está mentindo. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio?.trailerRig, 240000);
const S = window.__studio;
const quadros = async (n) => { for (let i = 0; i < n; i++) await B.frame(); };
await quadros(20);

document.querySelector('.preview-card[data-surface="front"]')?.click();
await quadros(8);
document.querySelector('.tool[data-act="text"]')?.click();
await quadros(8);

const cur = (el) => (el ? getComputedStyle(el).cursor : '(ausente)');
const linhaObj = document.querySelector('#layer-list .layer-row:not(.layer-row--bg):not(.layer-row--fixed)');
const linhaBg = document.querySelector('#layer-list .layer-row--bg');
const linhaTk = document.querySelector('#layer-list .layer-row--fixed');

out.push(['a linha de OBJETO existe', !!linhaObj]);
if (linhaObj) {
  const campo = linhaObj.querySelector('input.lyr-name');
  out.push(['linha de objeto', cur(linhaObj)]);
  out.push(['  punho (.lyr-grip)', cur(linhaObj.querySelector('.lyr-grip'))]);
  out.push(['  ícone (.lyr-icon)', cur(linhaObj.querySelector('.lyr-icon'))]);
  out.push(['  NOME (input.lyr-name)', cur(campo)]);
  out.push(['  o input tem o atributo readonly?', campo?.hasAttribute('readonly')]);
  out.push(['  olho (.lyr-btn)', cur(linhaObj.querySelector('.lyr-btn'))]);
}
if (linhaBg) {
  out.push(['linha FUNDO', cur(linhaBg)]);
  out.push(['  nome (span.lyr-name--fixed)', cur(linhaBg.querySelector('.lyr-name--fixed'))]);
  out.push(['  estado (.lyr-meta)', cur(linhaBg.querySelector('.lyr-meta'))]);
  out.push(['  pastilha (.lyr-swatch)', cur(linhaBg.querySelector('.lyr-swatch'))]);
}
if (linhaTk) {
  out.push(['linha THERMO KING', cur(linhaTk)]);
  out.push(['  nome', cur(linhaTk.querySelector('.lyr-name--fixed'))]);
}

/* E o que o navegador diria de fato no ponto do cursor: quem recebe o evento no
   meio do texto do nome. `elementFromPoint` é a mesma pergunta que o hit-test
   faz para escolher o cursor. */
if (linhaObj) {
  const campo = linhaObj.querySelector('input.lyr-name');
  const r = campo.getBoundingClientRect();
  const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  out.push(['quem está sob o meio do nome', alvo ? `${alvo.tagName}.${alvo.className}` : 'nada']);
  out.push(['cursor DESSE elemento', cur(alvo)]);
}

/* As três linhas do inspetor, que foram o outro relato de cursor. */
for (const id of ['bg-row-cab', 'bg-row-face', 'tk-row']) {
  const el = document.getElementById(id);
  out.push([`#${id}`, cur(el)]);
  if (el) {
    out.push([`  #${id} .bg-name`, cur(el.querySelector('.bg-name'))]);
    out.push([`  #${id} .bg-val`, cur(el.querySelector('.bg-val'))]);
    out.push([`  #${id} .bg-chip`, cur(el.querySelector('.bg-chip'))]);
  }
}

return out;
