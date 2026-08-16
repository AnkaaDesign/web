/* O ESTÚDIO, FOTOGRAFADO — a bancada de APARÊNCIA do cenário `estudio`.
   ===========================================================================
   O `checks.mjs` ao lado responde perguntas de FATO e roda em qualquer máquina,
   com o caminhão substituído por uma caixa. Este responde a única pergunta que
   uma caixa não responde: *como a cena está?* Chão, reflexo, teto e a relação
   entre eles só existem contra um sujeito de verdade, com material de verdade.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-estudio.mjs

   As duas bandeiras não são opcionais AQUI: sem `--geometry` o sujeito é uma
   caixa cinza e sem `--gpu` o quadro leva minutos no rasterizador de software.

   O ENQUADRAMENTO É O DA FOTO DE REFERÊNCIA, e é ele que torna as fotos
   comparáveis entre rodadas: lateral esquerda quase inteira, câmera na altura
   do peito e um pouco de teto no alto do quadro — porque metade do que se está
   julgando é o teto refletido no chão, e uma pose de catálogo (alta, olhando
   para baixo) não mostra nem o teto nem o reflexo. */
const out = [];
const B = window.__bench;

/* O SELETOR AINDA NÃO EXISTE quando este arquivo começa a rodar: `boot.ts`
   publica `window.__bench` na linha seguinte ao `mountStudio()`, que é
   assíncrono. Sem esta espera o laço abaixo não acha overlay nenhum, devolve
   `true` por vacuidade e o resto do arquivo fica esperando um boot que nunca
   foi disparado — o modo de falha que custou a primeira rodada desta bancada. */
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

/* Prefere os modelos cujo GLB existe em `web/public`: o `settleSelector()`
   padrão clica o primeiro card, e o primeiro da grade pode apontar um arquivo
   que só existe na árvore servida pela API. */
async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 300000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);

const THREE = S.THREE;
const scene = S.scene;
const camera = S.camera;
const controls = S.controls;
const renderer = S.renderer;

out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await B.frame();

/* A CENA PRECISA ASSENTAR ANTES DA FOTO. Trocar de cenário dispara um crossfade
   de rig de 0,8 s (ver lerpRig em scene.ts) e uma recaptura da sonda de reflexo;
   fotografar no meio disso retrata um estado intermediário que não existe para
   o usuário. Um segundo é folgado para os dois. */
await new Promise((r) => setTimeout(r, 1400));

/* ---- a pose da referência ----
   `dist` sai do próprio limite de órbita para a foto acompanhar o rig quando o
   implemento mudar de medidas; az/el são a foto. */
function pose({ az = 104, el = 9, fill = 1.7, ty = 0.42, aim = null } = {}) {
  const rig = scene.getObjectByName('RIG');
  const box = new THREE.Box3().setFromObject(rig);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const d = Math.min(controls.maxDistance, size.length() * fill);
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  const t = new THREE.Vector3(c.x, box.min.y + size.y * ty, c.z);
  camera.position.set(
    t.x + d * Math.cos(e) * Math.sin(a),
    Math.max(0.6, t.y + d * Math.sin(e)),
    t.z + d * Math.cos(e) * Math.cos(a),
  );
  /* `aim` LEVANTA A MIRA sem mexer na câmera, que é a única forma de olhar para
     CIMA aqui: a órbita é definida por (azimute, elevação, distância) em torno
     do alvo, então uma elevação alta põe a câmera no teto olhando para baixo —
     o oposto do que uma foto de teto precisa. Erguer o alvo mantém a câmera na
     altura do peito e inclina a lente. */
  controls.target.set(t.x, aim == null ? t.y : aim, t.z);
  camera.updateProjectionMatrix();
  controls.update();
  return { az, el, dist: +d.toFixed(2), cam: camera.position.toArray().map((n) => +n.toFixed(1)) };
}

/** Um PNG do canvas vivo, já no formato que o driver grava em shots/. */
async function shot(name, opts) {
  const info = pose(opts);
  for (let i = 0; i < 6; i++) await B.frame();
  const canvas = renderer.domElement;
  out.push([name, canvas.toDataURL('image/png')]);
  return info;
}

out.push(['pose lateral', await shot('estudio-lateral', { az: 104, el: 9 })]);
out.push(['pose 3/4', await shot('estudio-tresquartos', { az: 143, el: 11, fill: 1.5 })]);
/* Rente ao chão: é nesta que o reflexo aparece esticado, como na referência. */
out.push(['pose rasante', await shot('estudio-rasante', { az: 96, el: 2.2, fill: 1.35, ty: 0.3 })]);

/* ---- olhando PARA CIMA ----
   O `OrbitControls` limita o ângulo polar em 88,9° — ou seja a câmera nunca pode
   ficar ABAIXO do alvo, e uma mira erguida é empurrada de volta para uma câmera
   erguida. Soltar o limite pelo tempo de uma foto é a única forma de fotografar
   o teto pelo caminho real da cena; ele volta logo em seguida. */
const prevPolar = controls.maxPolarAngle;
controls.maxPolarAngle = Math.PI * 0.995;
out.push(['pose teto', await shot('estudio-teto', { az: 120, el: -30, fill: 1.1, aim: 13 })]);
controls.maxPolarAngle = prevPolar;

/* ---- os números que a foto não dá ---- */
async function fps(label) {
  for (let i = 0; i < 10; i++) await B.frame();
  const t0 = performance.now();
  let frames = 0;
  while (performance.now() - t0 < 1600) { await B.frame(); frames++; }
  out.push([label, +(frames / ((performance.now() - t0) / 1000)).toFixed(1)]);
}

pose({ az: 104, el: 9 });
await fps('fps na pose lateral · com reflexo');
/* O A/B do orçamento: o mesmo quadro, sem a segunda passada. Sem esta linha o
   custo do reflexo seria uma opinião. */
const cyc = S.cyclorama;
if (cyc?.setFloorReflection) {
  cyc.setFloorReflection(false);
  await fps('fps na pose lateral · sem reflexo');
  cyc.setFloorReflection(true);
  await B.frame();

  /* O ALVO CRU, LIDO ANTES DO A/B DE RESOLUÇÃO. Trocar a escala DESCARTA o alvo,
     e ler depois disso devolvia sempre "ausente" — um diagnóstico que mentia
     justamente na pergunta que ele existe para responder. */
  const rt = cyc.floorReflectionTarget?.();
  if (rt) {
    const w = Math.min(rt.width, 640);
    const h = Math.round(rt.height * (w / rt.width));
    const buf = new Float32Array(rt.width * rt.height * 4);
    try {
      renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
      const cv = document.createElement('canvas');
      cv.width = rt.width; cv.height = rt.height;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(rt.width, rt.height);
      let sum = 0;
      for (let i = 0; i < rt.width * rt.height; i++) {
        /* O alvo é LINEAR; para olhar, converte-se para sRGB. Virado na
           vertical porque o buffer da GL começa embaixo. */
        const y = rt.height - 1 - Math.floor(i / rt.width);
        const o = (y * rt.width + (i % rt.width)) * 4;
        for (let c = 0; c < 3; c++) {
          const v = Math.max(0, Math.min(1, buf[i * 4 + c]));
          img.data[o + c] = Math.round(255 * (v <= 0.0031308
            ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
        }
        img.data[o + 3] = 255;
        sum += buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2];
      }
      ctx.putImageData(img, 0, 0);
      const small = document.createElement('canvas');
      small.width = w; small.height = h;
      small.getContext('2d').drawImage(cv, 0, 0, w, h);
      out.push(['alvo do reflexo', small.toDataURL('image/png')]);
      out.push(['alvo do reflexo: radiância média por canal',
        +(sum / (rt.width * rt.height * 3)).toFixed(4)]);
    } catch (e) {
      out.push(['alvo do reflexo', 'ERRO ' + e.message]);
    }
  } else {
    out.push(['alvo do reflexo', 'AUSENTE — a passada nunca rodou']);
  }

  /* O A/B DE RESOLUÇÃO responde de onde vem o custo: se cair para 1/4 do lado
     não devolver fps, o gargalo é a segunda varredura de geometria e mexer em
     resolução é perder qualidade de graça. */
  cyc.setFloorReflectionScale(0.25);
  await fps('fps na pose lateral · reflexo a 1/4 de lado');
  cyc.setFloorReflectionScale(0.5);
}
/* Números do ÚLTIMO quadro desenhado pelo laço — `scene/scene.ts` é quem zera
   o contador (à mão, desde 2026-08-15). ⚠️ `calls` mudou de significado nessa
   data: agora inclui o passe de SOMBRA e a passada do reflexo do piso, ou seja
   tudo que o quadro submete. Um salto de ~2 200 para ~3 800 aqui não é
   regressão — é o número que sempre foi verdade e que ninguém via. */
out.push(['desenho', {
  tris: renderer.info.render.triangles,
  calls: renderer.info.render.calls,
  texturas: renderer.info.memory.textures,
  geometrias: renderer.info.memory.geometries,
}]);

/* ---- o piso, em luminância ----
   "Bem claro" é uma leitura, e uma leitura se mede. Lê o canvas vivo em três
   alturas da metade inferior do quadro (perto, meio e junto ao pé da parede) e
   devolve a mediana de cada faixa. */
pose({ az: 96, el: 2.2, fill: 1.35, ty: 0.3 });
for (let i = 0; i < 6; i++) await B.frame();
{
  const c = renderer.domElement;
  const cv = document.createElement('canvas');
  cv.width = c.width; cv.height = c.height;
  cv.getContext('2d').drawImage(c, 0, 0);
  const ctx = cv.getContext('2d');
  const band = (fy) => {
    const y = Math.round(c.height * fy);
    const d = ctx.getImageData(0, y, c.width, 1).data;
    const lum = [];
    for (let x = 0; x < c.width; x++) {
      lum.push(0.2126 * d[x * 4] + 0.7152 * d[x * 4 + 1] + 0.0722 * d[x * 4 + 2]);
    }
    lum.sort((a, b) => a - b);
    return Math.round(lum[lum.length >> 1]);
  };
  out.push(['piso: luminância mediana (0,62 / 0,78 / 0,95 da altura)',
    [band(0.62), band(0.78), band(0.95)]]);
  out.push(['fundo: luminância mediana (0,18 da altura)', band(0.18)]);
}

const shell = scene.getObjectByName('ciclorama-shell');
const room = shell ? new THREE.Box3().setFromObject(shell) : null;
out.push(['caixa da sala', room ? [room.min.toArray().map((n) => +n.toFixed(1)),
  room.max.toArray().map((n) => +n.toFixed(1))] : null]);
const ceil = scene.getObjectByName('ts-teto');
out.push(['teto presente', !!ceil]);
if (ceil) {
  const cb = new THREE.Box3().setFromObject(ceil);
  out.push(['caixa do teto', [cb.min.toArray().map((n) => +n.toFixed(1)),
    cb.max.toArray().map((n) => +n.toFixed(1))]]);
}

document.getElementById('loading')?.classList.add('hide');
document.getElementById('ts-selector')?.classList.add('hidden');
return out;
