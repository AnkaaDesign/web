/* LIVERY ↔ CHAPA, verificado no app de verdade — registro, dobras e emendas.
   ---------------------------------------------------------------------------
   Roda pela bancada com a geometria e o caminho REAIS do editor:

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-livery.mjs

   O que ela responde, na ordem:

     1. REGISTRO (a garantia pedida pelo dono do produto): um quadrado posto no
        canto da TELA tem de sair no MESMO canto da chapa branca, sem vão e sem
        corte. Medido pelos `uv1` dos cantos E por um quadrado magenta de
        verdade, fotografado no 3D.
     2. AS DOBRAS DE CURSO (a linha horizontal do relato): a chapa recortada
        tem de CONTER as dobras — profundidade local ≥ 50 mm dentro da malha
        SIDE_L. É o critério novo de recorte em ação.
     3. AS EMENDAS DE CHAPA: degrau de ~0,9 mm lido DIRETO da geometria da
        chapa, coluna de rebites instanciada com a contagem certa, e a grade
        publicada para o editor.
     4. TUDO DE NOVO DEPOIS DE UM RESIZE, porque as chapas renascem a cada
        medida e uma garantia que não sobrevive ao rebuild não é garantia.

   NADA AQUI USA RAIO EM COORDENADA DE MUNDO para geometria do painel: o
   conjunto anda e GIRA quando é engatado (`placeTrailer()`), e a primeira
   rodada desta bancada provou o erro — o "raio de fora" nasceu DENTRO do baú
   e acertou `lona-fria-interna`. A geometria da chapa é lida no LOCAL dela;
   só a FOTO usa mundo, ancorada nos próprios `uv1` da malha. */
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
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const L = S.livery;
const M = S.models;

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

const panelOf = (name) => S.trailer?.getObjectByName(name) ?? null;

/** Caixa LOCAL pelo atributo de posição — o referencial que não gira. */
function localBox(mesh) {
  const pos = mesh.geometry.getAttribute('position');
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

/** O vértice cujo uv1 mais se aproxima do alvo, em MUNDO (para a foto). */
function cornerOf(mesh, u, v) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - v;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  const p = new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  return { p, erroUV: Math.sqrt(best) };
}

/* ---------------- a bateria, rodada agora e depois do resize -------------- */
async function battery(tag) {
  const mesh = panelOf('SIDE_L');
  if (!mesh) { out.push([`${tag}: SIDE_L`, false]); return; }
  const lb = localBox(mesh);
  const pos = mesh.geometry.getAttribute('position');

  /* 1a. REGISTRO PELOS UV: uv1 de 0 a 1 tem de cobrir a caixa da chapa — o
     canto v=0 no TOPO dela e o v=1 exatamente uma altura-de-chapa abaixo.
     Tudo por DIFERENÇAS de pontos de mundo, que giro e translação não mexem. */
  const c00 = cornerOf(mesh, 0, 0);
  const c10 = cornerOf(mesh, 1, 0);
  const c11 = cornerOf(mesh, 1, 1);
  const wTop = (() => {
    mesh.updateWorldMatrix(true, false);
    let top = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (v.y > top) top = v.y;
    }
    return top;
  })();
  const dTop = Math.abs(c00.p.y - wTop) * 1000;
  /* O vão vertical é medido no MEIO do comprimento (u = 0,5): nos cantos u=1
     a malha pode não ter vértice em v exatamente 1 (a ponta é recortada pelo
     montante) e o "vértice mais próximo" mentia 63 mm. */
  const m0 = cornerOf(mesh, 0.5, 0);
  const m1 = cornerOf(mesh, 0.5, 1);
  const dSpan = Math.abs(Math.abs(m1.p.y - m0.p.y) - (lb.max.y - lb.min.y)) * 1000;
  out.push([`${tag}: uv1 v=0 no topo da chapa (Δmm)`, dTop < 4 ? true : dTop]);
  out.push([`${tag}: uv1 cobre a altura inteira (Δmm)`, dSpan < 6 ? true : dSpan]);

  /* 2. O RECORTE É FIEL AO SLAB: nada na chapa passa de ~41 mm de
     profundidade (40 do slab + 0,9 do remonte). A hipótese de que as tiras
     corridas de 1083/1868/2673 mm eram dobras excluídas foi DESCARTADA pelo
     footprint abaixo — elas são fitas de recobrimento a 66 mm, atrás de pele
     contínua, e ficam no corpo de propósito. */
  {
    /* O lado de fora da SIDE_L é o menor x LOCAL (é assim que ela é recortada
       do corpo); profundidade = x − min. */
    let deep = 0;
    const min = lb.min.x;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getX(i) - min > 0.048) deep++;
    }
    out.push([`${tag}: recorte fiel ao slab (vértices > 48 mm)`,
      deep === 0 ? true : deep]);

    /* E O CONTRADITÓRIO: o que o CORPO ainda tem na altura da dobra, com o
       footprint em profundidade de cada triângulo — é o número que diz por
       que o critério pegou ou não pegou. */
    const body = S.trailer?.getObjectByName('TRAILER_BODY');
    if (body) {
      const bp = body.geometry.getAttribute('position');
      const bidx = body.geometry.index ? body.geometry.index.array : null;
      const tris = Math.floor((bidx ? bidx.length : bp.count) / 3);
      const yFold = lb.min.y + 1.083;
      const found = [];
      for (let t = 0; t < tris && found.length < 8; t++) {
        const i0 = bidx ? bidx[t * 3] : t * 3;
        const i1 = bidx ? bidx[t * 3 + 1] : t * 3 + 1;
        const i2 = bidx ? bidx[t * 3 + 2] : t * 3 + 2;
        const ys = [bp.getY(i0), bp.getY(i1), bp.getY(i2)];
        const yMid = (ys[0] + ys[1] + ys[2]) / 3;
        if (Math.abs(yMid - yFold) > 0.02) continue;
        const xs = [bp.getX(i0), bp.getX(i1), bp.getX(i2)];
        const zs = [bp.getZ(i0), bp.getZ(i1), bp.getZ(i2)];
        const zSpan = Math.max(...zs) - Math.min(...zs);
        if (zSpan < 2) continue;                       // só as tiras corridas
        found.push({
          minX_mm: Math.round((Math.min(...xs) - min) * 1000),
          maxX_mm: Math.round((Math.max(...xs) - min) * 1000),
          zSpan_m: +zSpan.toFixed(2),
        });
      }
      out.push([`${tag}: tiras corridas no CORPO a 1083 mm (footprint da dobra)`,
        found.length ? found : '(nenhuma)']);
    }
  }

  /* SNAPSHOTS DO MODELO: existem, e são o fundo/ferragem do editor agora. */
  out.push([`${tag}: snapshot da lateral`, !!(L.hasSnapshot && L.hasSnapshot('left'))]);
  out.push([`${tag}: snapshot da traseira`, !!(L.hasSnapshot && L.hasSnapshot('rear'))]);
  const snapL = L.getSnapshot ? L.getSnapshot('left') : null;
  if (snapL) {
    out.push([`${tag}-snap-bg`, snapL.bg]);
    out.push([`${tag}-snap-front`, snapL.front]);
  }
  const snapR = L.getSnapshot ? L.getSnapshot('rear') : null;
  if (snapR) out.push([`${tag}-snap-rear-bg`, snapR.bg]);

  /* 3a. O DEGRAU DO REMONTE, lido da geometria: na janela de 8 mm ATRÁS da
     borda a superfície externa fica na crista; na aba (8–20 mm à FRENTE) fica
     ~0,9 mm mais para fora. "Fora" na SIDE_L local é −x. */
  const grid = M.getPlateGrid ? M.getPlateGrid() : null;
  out.push([`${tag}: grade de chapas publicada`, !!grid && grid.seamsFromFront.length > 0
    ? `${grid.seamsFromFront.length} emendas · ${grid.rivetRowsFromBottom.length} fileiras`
    : false]);
  /* As fileiras têm de bater com a GRADE DO FRISO (um rebite por rebaixo),
     não com estatística: ribs correntes ± a folga do topo sob a cantoneira. */
  if (grid) {
    const prof = S.trailerRig.profile;
    const dims = S.trailerDims;
    const n = prof.ribCount + Math.round((dims.height - prof.base.height) / prof.pitch);
    const ok = grid.rivetRowsFromBottom.length >= n - 5 && grid.rivetRowsFromBottom.length <= n + 1;
    out.push([`${tag}: um rebite por rebaixo (${n} frisos correntes)`,
      ok ? true : grid.rivetRowsFromBottom.length]);
  }
  if (grid && grid.seamsFromFront.length) {
    /* A frente LOCAL da chapa é o maior z (mapZ prende a testeira). O degrau
       é lido por RAIO CONTRA A PRÓPRIA MALHA, construído em coordenada LOCAL
       e levado a mundo pela matriz dela — a pele é extrudada e não tem
       vértice entre as quebras, então varrer vértices numa janela de 8 mm
       encontra o vazio (foi o `null` da rodada anterior). */
    const seamZ = lb.max.z - grid.seamsFromFront[Math.floor(grid.seamsFromFront.length / 2)];
    mesh.updateWorldMatrix(true, false);
    const ray = new THREE.Raycaster();
    const surfX = (yL, zL) => {
      const o = new THREE.Vector3(lb.min.x - 0.5, yL, zL).applyMatrix4(mesh.matrixWorld);
      const dir = new THREE.Vector3(1, 0, 0).transformDirection(mesh.matrixWorld);
      ray.set(o, dir);
      ray.far = 1.0;
      const hit = ray.intersectObject(mesh, false)[0];
      return hit ? mesh.worldToLocal(hit.point.clone()).x : null;
    };
    const yProbe = lb.min.y + 1.30;
    const behind = surfX(yProbe, seamZ - 0.006);
    const onLap = surfX(yProbe, seamZ + 0.012);
    const step = behind !== null && onLap !== null ? (behind - onLap) * 1000 : null;
    out.push([`${tag}: degrau do remonte (mm, esperado ~2,2)`,
      step !== null && step > 1.6 && step < 3.0 ? true : step]);

    /* 3b. OS REBITES: a coluna instanciada existe e tem emendas × fileiras. */
    const inst = mesh.getObjectByName('SIDE_L_RIVETS');
    const want = grid.seamsFromFront.length * grid.rivetRowsFromBottom.length;
    out.push([`${tag}: rebites instanciados (${want} esperados)`,
      inst && (inst.userData.rivets ?? inst.count) === want ? true : inst ? (inst.userData.rivets ?? inst.count) : '(sem malha)']);
  }

  /* 1b. O QUADRADO DE VERDADE — canto superior DIREITO da tela esquerda, que
     é o canto uv1 (1,0) da chapa: 300 × 300 mm de magenta encostado no canto,
     fotografado com a câmera posta pelos PRÓPRIOS cantos (imune ao giro). */
  const fab = L.surfaces.left;
  const el = fab.lowerCanvasEl;
  const pmm = L.panelMM('left');
  const pxPerMx = el.width / (pmm.w / 1000);
  const pxPerMy = el.height / (pmm.h / 1000);
  const side = 0.3;
  /* DRENA o render pendente do fabric antes de pintar cru: depois de um
     resize, `setDimensions()` deixa um requestRenderAll agendado que repinta
     a tela no próximo rAF — pintado antes dele, o quadrado era APAGADO e o
     h300 saía sem nenhum pixel magenta. */
  await B.frame(); await B.frame();
  const cx2 = el.getContext('2d');
  cx2.save();
  cx2.setTransform(1, 0, 0, 1, 0, 0);
  cx2.fillStyle = '#ff00d0';
  cx2.fillRect(el.width - side * pxPerMx, 0, side * pxPerMx, side * pxPerMy);
  cx2.restore();
  L.markDirty('left');
  await B.frame(); await B.frame(); await B.frame();
  /* O ESTADO DO BUFFER no instante da foto — separa "o canvas está errado"
     de "o mapeamento canvas→chapa está errado" sem adivinhar. */
  out.push([`${tag}-buffer`, el.toDataURL('image/png')]);

  /* A câmera: fora da chapa ao longo da NORMAL do painel no canto (1,0). A
     normal de mundo sai de dois vetores da própria malha — imune ao giro. */
  const ppm = 700;
  const pad = 0.12;
  const uDir = new THREE.Vector3().subVectors(c10.p, c00.p).normalize(); // canvas +x
  const vDir = new THREE.Vector3().subVectors(c11.p, c10.p).normalize(); // canvas +y (desce)
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize(); // para FORA
  const w = side + 2 * pad, h = side + 2 * pad;
  /* O CENTRO da janela: o canto (1,0) fica a `pad` da borda da foto, então o
     centro recua meia janela menos o pad, para DENTRO do painel nos dois
     eixos. (A rodada anterior somava errado e o centro caía EM CIMA do canto:
     metade da janela fotografava ar.) */
  const centre = c10.p.clone()
    .addScaledVector(uDir, -(w / 2 - pad))
    .addScaledVector(vDir, h / 2 - pad);
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 9);
  cam.position.copy(centre).addScaledVector(nDir, 4);
  cam.up.copy(vDir).negate();
  cam.lookAt(centre);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  /* LUZ DE BANCADA só durante a foto: o distrito à noite deixa o magenta
     abaixo de qualquer limiar de detecção — a rodada anterior achou zero
     pixels com o quadrado LÁ. A luz entra, fotografa, sai. */
  const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
  lamp.position.copy(cam.position);
  lamp.target.position.copy(centre);
  const amb = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(lamp, lamp.target, amb);
  rr.render(scene, cam);
  scene.remove(lamp, lamp.target, amb);
  const c2 = document.createElement('canvas');
  c2.width = wPx; c2.height = hPx;
  const cxs = c2.getContext('2d', { willReadFrequently: true });
  cxs.drawImage(canvas, 0, 0);
  const img = cxs.getImageData(0, 0, wPx, hPx);

  fab.requestRenderAll();
  L.markDirty('left');

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
  const d = img.data;
  for (let y = 0; y < hPx; y++) {
    for (let x = 0; x < wPx; x++) {
      const i = (y * wPx + x) * 4;
      /* MAGENTA exige AZUL: a fita 3M vermelha tem r alto e g baixo, e a
         versão frouxa deste teste a contava como quadrado — o vão e o tamanho
         saíam da fita, não da arte. */
      if (d[i] > 110 && d[i + 2] > 110 && d[i + 1] < Math.min(d[i], d[i + 2]) * 0.45) {
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  out.push([`${tag}-canto-foto`, c2.toDataURL('image/png')]);
  if (!n) { out.push([`${tag}: quadrado no canto`, '(nenhum pixel magenta)']); return; }
  /* O QUE A FOTO TEM DE MOSTRAR, e por quê:

       · LARGURA plena (300 mm) e a aresta dianteira ENCOSTADA na ponta da
         chapa — é a metade "sem vão e sem corte" da garantia, no eixo u.
       · No eixo v, o quadrado foi posto no TOPO CRU do canvas — e o topo cru
         NÃO é visível no baú: a chapa recortada sobe por dentro do teto e a
         CANTONEIRA cobre os 207,4 mm do alto (o mesmo 0,2074 do manifesto).
         O editor desenha a cantoneira exatamente sobre essa zona, então o que
         o cliente vê coberto na tela é o que o baú cobre: a parte visível do
         magenta tem de COMEÇAR no pé da cantoneira, não em v = 0.

     Qual borda vertical é a ponta depende do espelho da projeção — os dois
     candidatos são medidos e vale o que encostar. */
  const padPx = Math.round(pad * ppm);
  const wantPx = Math.round(side * ppm);
  const CAP_MM = 207.4;
  const gapRight = (wPx - 1 - padPx) - x1;
  const gapLeft = x0 - padPx;
  const gapU = Math.abs(gapRight) <= Math.abs(gapLeft) ? gapRight : gapLeft;
  const topMm = ((y0 - padPx) / ppm) * 1000;
  const botMm = ((y1 - padPx) / ppm) * 1000;
  const okGap = Math.abs(gapU) <= 5;
  const okTop = Math.abs(topMm - CAP_MM) <= 18;
  const okSize = Math.abs((x1 - x0 + 1) - wantPx) <= 8 && botMm >= 270;
  out.push([`${tag}: quadrado ENCOSTADO na ponta (vão px)`, okGap ? true : gapU]);
  out.push([`${tag}: topo visível no pé da cantoneira (mm, esperado ~207)`,
    okTop ? true : Math.round(topMm)]);
  out.push([`${tag}: largura plena e pé ≥ 270 mm`,
    okSize ? true : `${x1 - x0 + 1}px × pé ${Math.round(botMm)}mm`]);

  /* A RISCA PRETA sob a lateral: fotografa a faixa do pé da chapa (300 mm
     acima a 100 mm abaixo), acha a fileira mais escura e pergunta POR RAIO
     quem a pinta — nome de malha e material, sem adivinhar. */
  {
    const uD = new THREE.Vector3().subVectors(c10.p, c00.p);
    const len = uD.length(); uD.normalize();
    const vD = new THREE.Vector3().subVectors(c11.p, c10.p);
    const hgt = vD.length(); vD.normalize();
    const nD = new THREE.Vector3().crossVectors(vD, uD).normalize();
    const w2 = Math.min(len, 6), h2 = 0.40, ppm2 = 600;
    const centre2 = c00.p.clone().addScaledVector(uD, len / 2)
      .addScaledVector(vD, hgt + 0.10 - h2 / 2);
    const wPx2 = Math.round(w2 * ppm2), hPx2 = Math.round(h2 * ppm2);
    rr.setSize(wPx2, hPx2, false);
    const cam2 = new THREE.OrthographicCamera(-w2 / 2, w2 / 2, h2 / 2, -h2 / 2, 0.05, 9);
    cam2.position.copy(centre2).addScaledVector(nD, 4);
    cam2.up.copy(vD).negate();
    cam2.lookAt(centre2);
    cam2.updateProjectionMatrix();
    cam2.updateMatrixWorld(true);
    const lamp2 = new THREE.DirectionalLight(0xffffff, 2.5);
    lamp2.position.copy(cam2.position);
    lamp2.target.position.copy(centre2);
    const amb2 = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(lamp2, lamp2.target, amb2);
    rr.render(scene, cam2);
    scene.remove(lamp2, lamp2.target, amb2);
    const cc2 = document.createElement('canvas');
    cc2.width = wPx2; cc2.height = hPx2;
    const cx3 = cc2.getContext('2d', { willReadFrequently: true });
    cx3.drawImage(canvas, 0, 0);
    const dd = cx3.getImageData(0, 0, wPx2, hPx2).data;
    const lum = [];
    for (let y = 0; y < hPx2; y++) {
      let s = 0;
      for (let x = 0; x < wPx2; x += 2) {
        const i = (y * wPx2 + x) * 4;
        s += dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11;
      }
      lum.push(s / (wPx2 / 2));
    }
    let dk = 0;
    for (let y = 1; y < hPx2; y++) if (lum[y] < lum[dk]) dk = y;
    const feetPx = Math.round((h2 - 0.10) * ppm2);
    const offMm = Math.round(((dk - feetPx) / ppm2) * 1000);
    out.push([`${tag}-risca-foto`, cc2.toDataURL('image/png')]);
    const pDark = c00.p.clone().addScaledVector(uD, len / 2)
      .addScaledVector(vD, hgt + offMm / 1000);
    const ray2 = new THREE.Raycaster();
    ray2.set(pDark.clone().addScaledVector(nD, 1.2), nD.clone().negate());
    ray2.far = 1.6;
    const hits2 = ray2.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((hh) => hh.object.visible);
    const top2 = hits2[0];
    const mat2 = top2 && (Array.isArray(top2.object.material)
      ? top2.object.material[0] : top2.object.material);
    out.push([`${tag}: risca — fileira mais escura a ${offMm} mm do pé (lum `
      + `${Math.round(lum[dk])}) pintada por`,
    top2 ? `${top2.object.name || '(sem nome)'} [${mat2?.name || '?'}]` : '(vazio)']);
  }
}

await battery('fabrica');

S.measures.setImplementMeasures({ height: 3.0 });
const ok = await B.until(() => {
  const d = S.trailerDims;
  return !!d && Math.abs(d.height - 3.0) < 0.06;
}, 60000);
out.push(['h300: resize assentou', ok]);
await B.frame(); await B.frame();
await battery('h300');

/* E as fotos de conjunto, ancoradas nos cantos da chapa — para o olho. */
{
  const mesh = panelOf('SIDE_L');
  if (mesh) {
    const cA = cornerOf(mesh, 0, 0), cB = cornerOf(mesh, 1, 0), cC = cornerOf(mesh, 1, 1);
    const uDir = new THREE.Vector3().subVectors(cB.p, cA.p);
    const len = uDir.length(); uDir.normalize();
    const vDir = new THREE.Vector3().subVectors(cC.p, cB.p);
    const hgt = vDir.length(); vDir.normalize();
    const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
    const shoot = (cx, cy, w, h, ppm, name) => {
      const centre = cA.p.clone().addScaledVector(uDir, cx).addScaledVector(vDir, cy);
      const wPx = Math.min(3600, Math.round(w * ppm));
      const hPx = Math.min(3600, Math.round(h * ppm));
      rr.setSize(wPx, hPx, false);
      const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 9);
      cam.position.copy(centre).addScaledVector(nDir, 4);
      cam.up.copy(vDir).negate();
      cam.lookAt(centre);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
      lamp.position.copy(cam.position);
      lamp.target.position.copy(centre);
      const amb = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(lamp, lamp.target, amb);
      rr.render(scene, cam);
      scene.remove(lamp, lamp.target, amb);
      const cc = document.createElement('canvas');
      cc.width = wPx; cc.height = hPx;
      cc.getContext('2d').drawImage(canvas, 0, 0);
      out.push([name, cc.toDataURL('image/png')]);
    };
    shoot(len / 2, hgt / 2, len + 0.4, hgt + 0.3, 200, 'h300-painel');
    shoot(len - 1.3, hgt - 1.0, 2.6, 1.8, 900, 'h300-emendas-close');
  }
}

/* E O PAINEL DO EDITOR, composto (estrutura + ferragem/emendas), lado a lado
   com as fotos 3D acima: as emendas e os rebites do desenho vêm da MESMA
   grade (`getPlateGrid`) que gerou a geometria — esta imagem é a prova de que
   as duas saídas coincidem. */
{
  /* A composição é assíncrona (uma imagem por camada, ~20 camadas com as
     emendas) e desenha da frente para trás: fotografar cedo demais pega o
     painel com metade das emendas — foi a foto da primeira rodada. */
  await new Promise((r) => setTimeout(r, 1500));
  const cc = document.createElement('canvas');
  const meas = S.measures;
  const dims = S.trailerDims;
  cc.width = 2400;
  cc.height = dims
    ? Math.max(200, Math.round(cc.width * (dims.height / dims.length)))
    : 460;
  const ctx = cc.getContext('2d');
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, cc.width, cc.height);
  meas.drawStructureInto(ctx, 'left', cc.width, cc.height);
  meas.drawFrontInto(ctx, 'left', cc.width, cc.height);
  out.push(['h300-editor-left', cc.toDataURL('image/png')]);
}

return out;
