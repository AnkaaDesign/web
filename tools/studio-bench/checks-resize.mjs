/* Investigação: a LINHA HORIZONTAL no painel lateral após mudar a ALTURA.
   ---------------------------------------------------------------------------
   Roda pela bancada com a geometria de verdade:

       node tools/studio-bench/bench.mjs --geometry --checks checks-resize.mjs

   O que ela faz, na ordem: atravessa o seletor, espera o implemento, fotografa
   a lateral esquerda em ortográfica ANTES e DEPOIS de um resize feito pelo
   CAMINHO REAL do editor (`measures.setImplementMeasures`, que passa pelo
   aplicador coalescido), acha as linhas escuras por perfil de intensidade
   linha a linha, e pergunta por RAIO quem mora em cada linha achada. As fotos
   vão para tools/studio-bench/shots/; os vincos e os culpados saem no
   relatório como dados. */
const out = [];
const B = window.__bench;

/* O SELETOR AINDA NÃO EXISTE quando este arquivo começa a rodar — `boot.ts`
   publica `__bench` na linha seguinte ao `mountStudio()`, que é assíncrono.
   Sem esta espera, `settle()` roda antes de haver overlay, devolve `true` por
   VACUIDADE, e o seletor abre depois e fica aberto para sempre: foi o "FALHA
   __studio de pé" com o print mostrando o passo Cenário intocado. A mesma
   espera já está em `checks-estudio.mjs`, com a mesma nota. */
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

/* Atravessa o seletor PREFERINDO os modelos cujo GLB existe em `web/public`
   (scania/volvo/iveco) — o `settleSelector()` padrão clica o primeiro card, e o
   primeiro da grade pode apontar um arquivo que só existe na árvore da API. */
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
/* Sob SwiftShader o primeiro applyChoice é LENTO (cabine + implemento de 31 MB
   + cenário, tudo em rasterizador de software) — o prazo é generoso. */
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame();
await B.frame();

const THREE = S.THREE;
const scene = S.scene;

/* Renderizador PRÓPRIO: a câmera e o canvas do app ficam intactos. */
const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

const panelOf = (name) => S.trailer?.getObjectByName(name) ?? null;

/** Caixa em mundo e direção "para fora" da lateral pedida. */
function frameOf(name) {
  const mesh = panelOf(name);
  if (!mesh) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  const all = new THREE.Box3().setFromObject(S.trailerGroup);
  const cx = (all.min.x + all.max.x) / 2;
  const side = (box.min.x + box.max.x) / 2 > cx ? 1 : -1;
  return { mesh, box, side };
}

/** Ortográfica da janela [y0,y1]×[z0,z1] da lateral, px/m fixo, dataURL. */
function shoot(name, y0, y1, z0, z1, ppm, normals) {
  const f = frameOf(name);
  if (!f) return null;
  const w = z1 - z0, h = y1 - y0;
  const wPx = Math.min(4000, Math.round(w * ppm));
  const hPx = Math.min(4000, Math.round(h * ppm));
  rr.setSize(wPx, hPx, false);
  const skin = f.side > 0 ? f.box.max.x : f.box.min.x;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 9);
  cam.position.set(skin + f.side * 4, (y0 + y1) / 2, (z0 + z1) / 2);
  cam.lookAt(skin, (y0 + y1) / 2, (z0 + z1) / 2);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  if (normals) scene.overrideMaterial = new THREE.MeshNormalMaterial();
  try { rr.render(scene, cam); } finally { scene.overrideMaterial = null; }
  return canvas.toDataURL('image/png');
}

/** Vincos: linhas cujo brilho médio cai bem abaixo da vizinhança. */
function dips(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const x0 = Math.round(c.width * 0.1), x1 = Math.round(c.width * 0.9);
      const rows = [];
      for (let y = 0; y < c.height; y++) {
        let s = 0;
        for (let x = x0; x < x1; x++) {
          const i = (y * c.width + x) * 4;
          s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        }
        rows.push(s / (x1 - x0));
      }
      const found = [];
      for (let y = 2; y < rows.length - 2; y++) {
        const neigh = (rows[y - 2] + rows[y + 2]) / 2;
        if (neigh - rows[y] > 5 && rows[y] < rows[y - 1] && rows[y] <= rows[y + 1]) {
          found.push({ px: y, drop: +(neigh - rows[y]).toFixed(1) });
        }
      }
      resolve(found);
    };
    img.src = dataURL;
  });
}

/** Quem mora numa altura: raio de fora para dentro, três posições de z. */
function whoAt(name, yWorld, zs) {
  const f = frameOf(name);
  if (!f) return null;
  const ray = new THREE.Raycaster();
  const skin = f.side > 0 ? f.box.max.x : f.box.min.x;
  const hits = [];
  for (const z of zs) {
    ray.set(new THREE.Vector3(skin + f.side * 3, yWorld, z),
      new THREE.Vector3(-f.side, 0, 0));
    const hs = ray.intersectObjects([S.trailerGroup], true)
      .filter((h) => h.object.visible && h.object.parent?.visible !== false);
    const top = hs[0];
    if (top) {
      const mat = Array.isArray(top.object.material) ? top.object.material[0] : top.object.material;
      hits.push(`${top.object.name || '(sem nome)'} [${mat?.name || '?'}] x=${top.point.x.toFixed(4)}`);
    } else hits.push('(vazio)');
  }
  return hits;
}

/* ---------------- a matriz ---------------- */

const SIDE = 'SIDE_L';
const fr0 = frameOf(SIDE);
out.push(['painel achado', !!fr0]);
if (fr0) {
  const floor = fr0.box.min.y;
  const zMid = (fr0.box.min.z + fr0.box.max.z) / 2;

  const states = [['fabrica', 0], ['h250', 2.5]];
  for (const [tag, h] of states) {
    if (h) {
      S.measures.setImplementMeasures({ height: h });
      const settled = await B.until(() => {
        const d = S.trailerDims;
        return !!d && Math.abs(d.height - h) < 0.06;
      }, 60000);
      out.push([`${tag}: resize assentou`, settled]);
      await B.frame(); await B.frame();
    }
    const f = frameOf(SIDE);
    const y0 = floor + 0.05, y1 = floor + 1.05;
    const shotUrl = shoot(SIDE, y0, y1, zMid - 1.1, zMid + 1.1, 1400, false);
    out.push([`${tag}-close`, shotUrl]);
    const ds = await dips(shotUrl);
    out.push([`${tag}-vincos`, ds.slice(0, 20)]);
    /* Cada vinco vira uma pergunta por raio. O y do pixel: a imagem cobre
       [y1..y0] de cima para baixo. */
    const hPx = Math.round((y1 - y0) * 1400);
    for (const d of ds.slice(0, 6)) {
      const yW = y1 - (d.px / hPx) * (y1 - y0);
      out.push([`${tag}-vinco@${(yW - floor).toFixed(3)}m`,
        whoAt(SIDE, yW, [zMid - 0.7, zMid, zMid + 0.7])]);
    }
    out.push([`${tag}-normals`, shoot(SIDE, y0, y1, zMid - 1.1, zMid + 1.1, 1400, true)]);
  }

  /* O corte de suspeitos: as mesmas fotos SEM as chapas de livery e SEM as
     sobreposições de arte — quem some junto com o quê é a resposta. */
  const panel = panelOf(SIDE);
  if (panel) {
    for (const child of panel.children) child.visible = false;
    out.push(['h250-sem-arte', shoot(SIDE, floor + 0.05, floor + 1.05, zMid - 1.1, zMid + 1.1, 1400, false)]);
    for (const child of panel.children) child.visible = true;
    panel.visible = false;
    out.push(['h250-sem-chapa', shoot(SIDE, floor + 0.05, floor + 1.05, zMid - 1.1, zMid + 1.1, 1400, false)]);
    panel.visible = true;
  }
}

return out;
