/* Map Creator — 2D para editar, 3D para julgar.
 *
 * POR QUE DOIS MODOS E NAO UM. Layout de sitio industrial e um problema de
 * PLANTA: tudo e alinhado aos eixos, o que importa e vao entre pecas, recuo da
 * rua e raio livre da camera. Isso se edita de cima, com numeros, e um gizmo 3D
 * so atrapalha. Mas nada disso responde "parece uma empresa de verdade?", que e
 * uma pergunta de olho, em perspectiva, com o caminhao junto para dar escala.
 * Entao: 2D edita, 3D julga, e os dois leem o MESMO estado.
 *
 * EIXOS. O build e Blender: X direita, Y para frente (norte), Z para cima.
 *   2D      x -> direita, y -> CIMA (norte em cima, como planta de verdade)
 *   three   Y-up, entao Blender (x, y) vira (x, 0, -y) e a rotacao Z vira
 *           rotacao Y de mesmo sinal (derivado, nao chutado: o exportador usa
 *           export_yup, que mapeia (x,y,z) -> (x,z,-y)).
 */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const planCv = $('plan'), threeCv = $('three');

let SITE = null, CATALOG = {}, ITEMS = [], sel = -1;
let view = { x: 0, y: 20, s: 2.2 };            // centro em metros + px por metro
let proto = null;                               // cena de prototipos (three)

/* ---------------------------------------------------------------- dados -- */
async function boot() {
  let cat, lay;
  try {
    cat = await (await fetch('./catalog.json')).json();
    lay = await (await fetch('./layout.json')).json();
  } catch (e) {
    $('err').style.display = 'grid';
    $('err').innerHTML =
      '<div><b>Nao consegui ler catalog.json / layout.json.</b><br>' +
      'Esta pagina precisa ser SERVIDA, nao aberta como arquivo — ' +
      'o navegador bloqueia fetch em <code>file://</code>.' +
      '<code>cd web/tools/env-build/map-creator &amp;&amp; python -m http.server 8765</code>' +
      'e abra <code>http://localhost:8765</code></div>';
    throw e;
  }
  /* O SITIO VEM DO CATALOGO, nao do layout — e essa precedencia ja custou uma
     rodada. Um layout salvo numa sessao anterior carrega junto o `site` daquela
     sessao; se ele ganhar, o editor volta a desenhar as ruas e a laje antigas
     enquanto o build usa as atuais, e as pecas sao arranjadas contra uma planta
     que nao existe mais. catalog.json e reescrito a cada exportacao e e a
     unica fonte com o estado corrente do sitio. */
  SITE = cat.site;
  CATALOG = cat.catalog;
  ITEMS = lay.items;
  const opt = Object.entries(CATALOG)
    .sort((a, b) => a[1].label.localeCompare(b[1].label));
  for (const [k, c] of opt) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = `${c.label} — ${c.w}×${c.d} m`;
    $('add').appendChild(o);
  }
  resize();
  draw();
}

/* --------------------------------------------------------------- auditoria */
/* Caixa alinhada aos eixos de um retangulo GIRADO em qualquer angulo.
   A versao anterior so trocava largura/profundidade em 90 e 270 — o que estava
   certo enquanto tudo era ortogonal e passa a mentir no instante em que existe
   rotacao livre. Uma peca a 30 graus ocupa mais espaco que a caixa original nos
   dois eixos, e a auditoria de sobreposicao le esta caixa. */
/* `site.shiftX/Y` desloca o SITIO inteiro. Existe porque o app estaciona o
   caminhao na origem: mover o caminhao "para frente" so pode ser feito movendo
   o cenario. O editor aplica o mesmo deslocamento que o build, senao a planta
   aqui e o que sai no .glb divergem em silencio. */
const SX = () => Number(SITE.shiftX || 0);
const SY = () => Number(SITE.shiftY || 0);

function boxOf(it) {
  const c = CATALOG[it.key];
  if (!c) return null;
  const a = it.rot * Math.PI / 180;
  const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  const w0 = c.w * it.scale, d0 = c.d * it.scale;
  const w = w0 * ca + d0 * sa;
  const d = w0 * sa + d0 * ca;
  const cx = it.x + SX(), cy = it.y + SY();
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2,
           cx, cy, w, d, h: c.h * it.scale, w0, d0 };
}

/* Posicao do puxador de rotacao, no referencial girado da peca. */
function handlePos(it) {
  const b = boxOf(it); if (!b) return null;
  const a = it.rot * Math.PI / 180;
  const ly = b.d0 / 2 + 22 / view.s;
  return [b.cx - ly * Math.sin(a), b.cy + ly * Math.cos(a)];
}

function audit() {
  const out = [];
  const boxes = ITEMS.map(boxOf);
  for (let i = 0; i < ITEMS.length; i++) {
    const a = boxes[i]; if (!a) continue;
    for (let j = i + 1; j < ITEMS.length; j++) {
      const b = boxes[j]; if (!b) continue;
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      /* `dressing` sobrepoe DE PROPOSITO. ibc08 nao e um predio — e o aparato
         (tubos, guarda-corpos, escadas) que precisa ficar SOBRE um galpao
         solido, senao a tubulacao fica boiando no patio. Marcar sobreposicao
         nesse caso seria um alarme permanente para a unica coisa certa. */
      if (ox > 0.5 && oy > 0.5 &&
          !(ITEMS[i].dressing || ITEMS[j].dressing))
        out.push({ i, lvl: 'bad', t: 'Sobreposicao',
                   d: `${label(i)} × ${label(j)} — ${ox.toFixed(1)}×${oy.toFixed(1)} m` });
    }
    /* raio livre da camera */
    const dx = Math.max(a.x0, 0, -a.x1), dy = Math.max(a.y0, 0, -a.y1);
    const near = Math.hypot(dx, dy);
    if (near < SITE.clearRadius)
      out.push({ i, lvl: 'bad', t: 'Dentro da orbita',
                 d: `${label(i)} a ${near.toFixed(0)} m (minimo ${SITE.clearRadius})` });
    /* altura <= distancia/5 dentro de 80 m */
    else if (a.h > 3 && near < 80 && a.h > near / 5)
      out.push({ i, lvl: 'warn', t: 'Alto demais para a distancia',
                 d: `${label(i)}: ${a.h.toFixed(1)} m a ${near.toFixed(0)} m (cabe ${(near / 5).toFixed(1)} m)` });
    /* fora da laje */
    const [X0, X1, Y0, Y1] = SITE.yard;
    if (ITEMS[i].inside !== false &&
        (a.x0 < X0 || a.x1 > X1 || a.y0 < Y0 || a.y1 > Y1))
      out.push({ i, lvl: 'warn', t: 'Fora do piso', d: label(i) });
  }
  /* vao ate o vizinho mais proximo */
  let gaps = [];
  for (let i = 0; i < ITEMS.length; i++) {
    const a = boxes[i]; if (!a) continue;
    let best = 1e9;
    for (let j = 0; j < ITEMS.length; j++) {
      if (i === j) continue; const b = boxes[j]; if (!b) continue;
      const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
      const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    if (best < 1e8) gaps.push(best);
  }
  gaps.sort((p, q) => p - q);
  const med = gaps.length ? gaps[gaps.length >> 1] : 0;
  return { out, med };
}

const label = (i) => ITEMS[i].note || CATALOG[ITEMS[i].key]?.label || ITEMS[i].key;

function renderPanels() {
  const { out, med } = audit();
  $('stats').textContent =
    `${ITEMS.length} pecas · vao mediano ${med.toFixed(1)} m · ${out.length} avisos`;
  const a = $('audit');
  a.innerHTML = out.length ? '' : '<div class="hint">Sem problemas.</div>';
  for (const p of out.slice(0, 40)) {
    const d = document.createElement('div');
    d.className = 'issue' + (p.lvl === 'warn' ? ' warn' : '');
    d.innerHTML = `<b>${p.t}</b><span>${p.d}</span>`;
    d.onclick = () => { sel = p.i; focusSel(); draw(); };
    a.appendChild(d);
  }
  const s = $('sel');
  if (sel < 0 || !ITEMS[sel]) { s.className = 'hint'; s.textContent = 'Nada selecionado.'; return; }
  const it = ITEMS[sel], c = CATALOG[it.key] || {};
  s.className = '';
  s.innerHTML =
    `<div style="margin-bottom:6px"><b>${c.label || it.key}</b><br>
     <span class="hint">${c.w}×${c.d}×${c.h} m · ${it.key}</span></div>` +
    ['x', 'y', 'rot', 'scale'].map((f) =>
      `<div class="row"><label>${f}</label><input data-f="${f}" value="${it[f]}"></div>`).join('') +
    `<div class="row"><label>nota</label><input data-f="note" value="${it.note || ''}"></div>` +
    `<div class="row"><label>dentro</label><input data-f="inside" value="${it.inside !== false}"></div>`;
  s.querySelectorAll('input').forEach((inp) => {
    inp.onchange = () => {
      const f = inp.dataset.f;
      if (f === 'note') it.note = inp.value;
      else if (f === 'inside') it.inside = /true|1|sim/i.test(inp.value);
      else { const v = parseFloat(inp.value); if (!isNaN(v)) it[f] = v; }
      draw();
    };
  });
}

/* -------------------------------------------------------------------- 2D -- */
const toPx = (mx, my) => [
  planCv.width / 2 + (mx - view.x) * view.s,
  planCv.height / 2 - (my - view.y) * view.s];
const toM = (px, py) => [
  (px - planCv.width / 2) / view.s + view.x,
  -(py - planCv.height / 2) / view.s + view.y];

function rect(g, x0, y0, x1, y1, fill, stroke) {
  const [a, b] = toPx(x0, y1), [c, d] = toPx(x1, y0);
  if (fill) { g.fillStyle = fill; g.fillRect(a, b, c - a, d - b); }
  if (stroke) { g.strokeStyle = stroke; g.strokeRect(a, b, c - a, d - b); }
}

function draw() {
  renderPanels();
  if (mode === '3d') { sync3d(); return; }
  const g = planCv.getContext('2d');
  const W = planCv.width, H = planCv.height;
  g.fillStyle = '#0f1216'; g.fillRect(0, 0, W, H);

  const F = SITE.fenceHalf;
  /* terreno fora da cerca */
  rect(g, -F - 90, -F - 90, F + 90, F + 90, '#171c17');
  /* dentro da cerca: grama */
  rect(g, -F, -F, F, F, '#1e2a1c', '#3d5138');
  /* laje */
  const [X0, X1, Y0, Y1] = SITE.yard;
  rect(g, X0, Y0, X1, Y1, '#2a2a28');
  /* vias internas */
  for (const [sx0, sx1, sy0, sy1] of (SITE.serviceRoads || []))
    rect(g, sx0, sy0, sx1, sy1, '#232427');
  /* pistas */
  for (const cx of [SITE.roadA, SITE.roadB])
    rect(g, cx - SITE.roadW / 2, -1180 / 2, cx + SITE.roadW / 2, 1180 / 2, '#1b1c1f');
  /* canteiro central */
  rect(g, SITE.roadB + SITE.edge, -1180 / 2, SITE.roadA - SITE.edge, 1180 / 2, '#1e2a1c');

  /* grade de 10 m */
  if (view.s > 1.1) {
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.beginPath();
    const step = view.s > 3 ? 10 : 50;
    for (let x = Math.ceil((view.x - W / 2 / view.s) / step) * step;
         x < view.x + W / 2 / view.s; x += step) {
      const [p] = toPx(x, 0); g.moveTo(p, 0); g.lineTo(p, H);
    }
    for (let y = Math.ceil((view.y - H / 2 / view.s) / step) * step;
         y < view.y + H / 2 / view.s; y += step) {
      const [, q] = toPx(0, y); g.moveTo(0, q); g.lineTo(W, q);
    }
    g.stroke();
  }

  /* raio livre + caminhao */
  const [ox, oy] = toPx(0, 0);
  g.strokeStyle = 'rgba(226,86,74,.5)'; g.setLineDash([5, 5]);
  g.beginPath(); g.arc(ox, oy, SITE.clearRadius * view.s, 0, 7); g.stroke();
  g.setLineDash([]);
  const T = SITE.truck;
  rect(g, -T.w / 2, 0, T.w / 2, T.len, '#c8483c', '#ff7a6b');

  /* pecas */
  const issues = new Set(audit().out.filter((p) => p.lvl === 'bad').map((p) => p.i));
  ITEMS.forEach((it, i) => {
    const b = boxOf(it); if (!b) return;
    const c = CATALOG[it.key];
    const tall = b.h > 8;
    let fill = it.inside === false ? '#33373f' : (tall ? '#4a5570' : '#59606e');
    if (issues.has(i)) fill = '#7d3b34';
    if (i === sel) fill = '#5aa9e6';
    /* A PECA E DESENHADA GIRADA, nao como a caixa alinhada.
       Canvas gira no sentido horario porque o Y dele cresce para baixo; o plano
       aqui tem Y para cima. Derivando a equivalencia, o angulo do canvas e
       -theta — desenhar +theta espelharia a planta em relacao ao 3D. */
    const [cxp, cyp] = toPx(b.cx, b.cy);
    g.save();
    g.translate(cxp, cyp);
    g.rotate(-it.rot * Math.PI / 180);
    const pw = b.w0 * view.s, pd = b.d0 * view.s;
    g.fillStyle = fill;
    g.fillRect(-pw / 2, -pd / 2, pw, pd);
    g.strokeStyle = i === sel ? '#bfe2ff' : 'rgba(0,0,0,.5)';
    g.strokeRect(-pw / 2, -pd / 2, pw, pd);
    g.restore();
    if (i === sel) {
      const hp = handlePos(it);
      if (hp) {
        const [hx, hy] = toPx(hp[0], hp[1]);
        g.strokeStyle = '#bfe2ff'; g.beginPath();
        g.moveTo(cxp, cyp); g.lineTo(hx, hy); g.stroke();
        g.fillStyle = '#bfe2ff'; g.beginPath();
        g.arc(hx, hy, 6, 0, 7); g.fill();
      }
    }
    if (view.s > 1.5) {
      const [tx, ty] = toPx(b.cx, b.cy);
      g.fillStyle = i === sel ? '#08121b' : 'rgba(255,255,255,.82)';
      g.font = '10px ui-sans-serif,system-ui';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = (c?.label || it.key);
      g.fillText(txt.length > 22 ? txt.slice(0, 21) + '…' : txt, tx, ty);
      if (view.s > 3) {
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.fillText(`${b.w.toFixed(0)}×${b.d.toFixed(0)}·${b.h.toFixed(0)}m`, tx, ty + 11);
      }
    }
  });

  /* escala */
  g.fillStyle = 'rgba(255,255,255,.6)'; g.textAlign = 'left'; g.font = '11px ui-sans-serif';
  g.fillText(`${(100).toFixed(0)} m`, 12, H - 14);
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath();
  g.moveTo(56, H - 18); g.lineTo(56 + 100 * view.s, H - 18); g.stroke();
}

/* --------------------------------------------------------------- 2D input */
let drag = null, pan = null;
planCv.addEventListener('mousedown', (e) => {
  if (mode !== '2d') return;
  if (e.button === 1 || e.shiftKey && e.button === 0) {
    pan = { px: e.offsetX, py: e.offsetY, x: view.x, y: view.y }; return;
  }
  if (e.button !== 0) return;
  const [mx, my] = toM(e.offsetX, e.offsetY);
  /* O puxador de rotacao ganha do corpo da peca: ele fica FORA da caixa, mas
     pode cair sobre a peca vizinha, e clicar nele tem de girar, nao selecionar
     outra coisa. */
  if (sel >= 0 && ITEMS[sel]) {
    const hp = handlePos(ITEMS[sel]);
    if (hp && Math.hypot(mx - hp[0], my - hp[1]) * view.s < 10) {
      drag = { i: sel, rotate: true }; return;
    }
  }
  let hit = -1;
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const b = boxOf(ITEMS[i]); if (!b) continue;
    /* teste no referencial da peca, senao uma peca girada e selecionavel pelos
       cantos vazios da caixa alinhada */
    const a = ITEMS[i].rot * Math.PI / 180;
    const dx = mx - b.cx, dy = my - b.cy;
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= b.w0 / 2 && Math.abs(ly) <= b.d0 / 2) { hit = i; break; }
  }
  sel = hit;
  if (hit >= 0) drag = { i: hit, dx: ITEMS[hit].x + SX() - mx, dy: ITEMS[hit].y + SY() - my };
  draw();
});
addEventListener('mousemove', (e) => {
  if (pan) {
    view.x = pan.x - (e.offsetX - pan.px) / view.s;
    view.y = pan.y + (e.offsetY - pan.py) / view.s;
    draw(); return;
  }
  if (!drag) return;
  const [mx, my] = toM(e.offsetX, e.offsetY);
  const it = ITEMS[drag.i];
  if (drag.rotate) {
    /* O puxador aponta para o +Y local da peca, entao o angulo dela e o angulo
       do mouse menos 90 graus. Passo de 15 graus, livre com Alt: layout
       industrial e quase todo ortogonal, e um passo evita 87,3 graus por
       acidente — mas as vezes se quer um galpao enviesado de proposito. */
    let a = Math.atan2(my - (it.y + SY()), mx - (it.x + SX())) * 180 / Math.PI - 90;
    if (!e.altKey) a = Math.round(a / 15) * 15;
    it.rot = +(((a % 360) + 360) % 360).toFixed(1);
    draw();
    return;
  }
  const snap = e.altKey ? 0.1 : 0.5;
  it.x = Math.round((mx + drag.dx) / snap) * snap;
  it.y = Math.round((my + drag.dy) / snap) * snap;
  draw();
});
addEventListener('mouseup', () => { drag = null; pan = null; });
planCv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [bx, by] = toM(e.offsetX, e.offsetY);
  view.s = Math.max(0.25, Math.min(14, view.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  const [ax, ay] = toM(e.offsetX, e.offsetY);
  view.x += bx - ax; view.y += by - ay;
  draw();
}, { passive: false });

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const it = ITEMS[sel];
  if (e.key === 'Delete' && it) { ITEMS.splice(sel, 1); sel = -1; draw(); return; }
  if (e.key.toLowerCase() === 'd' && e.ctrlKey && it) {
    e.preventDefault();
    ITEMS.push({ ...it, x: it.x + 6, y: it.y - 6, note: (it.note || '') + ' (cópia)' });
    sel = ITEMS.length - 1; draw(); return;
  }
  if (!it) return;
  const step = e.shiftKey ? 5 : 0.5;
  if (e.key === 'ArrowLeft') it.x -= step;
  else if (e.key === 'ArrowRight') it.x += step;
  else if (e.key === 'ArrowUp') it.y += step;
  else if (e.key === 'ArrowDown') it.y -= step;
  else if (e.key.toLowerCase() === 'r') it.rot = (it.rot + (e.shiftKey ? -90 : 90) + 360) % 360;
  else if (e.key === '[') it.scale = Math.max(0.3, +(it.scale - 0.05).toFixed(2));
  else if (e.key === ']') it.scale = Math.min(3, +(it.scale + 0.05).toFixed(2));
  else return;
  e.preventDefault(); draw();
});

function focusSel() {
  const it = ITEMS[sel]; if (!it) return;
  view.x = it.x; view.y = it.y;
}

/* -------------------------------------------------------------------- 3D -- */
let renderer, scene, cam, ctrl, group3d, ready3d = false;

async function init3d() {
  renderer = new THREE.WebGLRenderer({ canvas: threeCv, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fa3b0);
  scene.fog = new THREE.Fog(0x8fa3b0, 260, 900);
  cam = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
  cam.position.set(70, 45, 90);
  ctrl = new OrbitControls(cam, threeCv);
  ctrl.target.set(0, 2, -10);
  ctrl.maxPolarAngle = Math.PI / 2 - 0.02;
  ctrl.addEventListener('change', () => renderer.render(scene, cam));

  scene.add(new THREE.HemisphereLight(0xdfefff, 0x40442f, 2.0));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  sun.position.set(80, 120, 60); scene.add(sun);

  /* contexto: terreno, laje, pistas, cerca */
  const F = SITE.fenceHalf, [X0, X1, Y0, Y1] = SITE.yard;
  const flat = (w, d, cx, cy, col, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: col }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, y, -cy); scene.add(m); return m;
  };
  flat(2400, 2400, 0, 0, 0x59613f, -0.05);
  flat(F * 2, F * 2, 0, 0, 0x4a5c39, 0.0);
  flat(X1 - X0, Y1 - Y0, (X0 + X1) / 2, (Y0 + Y1) / 2, 0x8d8b84, 0.06);
  for (const [a, b, c, d] of (SITE.serviceRoads || []))
    flat(b - a, d - c, (a + b) / 2, (c + d) / 2, 0x4c4c50, 0.09);
  for (const cx of [SITE.roadA, SITE.roadB])
    flat(SITE.roadW, 1180, cx, 0, 0x3a3a3e, 0.07);
  flat(SITE.medianW, 1180, (SITE.roadA - SITE.edge + SITE.roadB + SITE.edge) / 2, 0,
       0x4a5c39, 0.08);
  /* cerca como quatro fitas */
  const fm = new THREE.MeshLambertMaterial({ color: 0x9aa3ad, transparent: true,
    opacity: 0.45, side: THREE.DoubleSide });
  for (const [w, d, cx, cy] of [[F * 2, 0, 0, F], [F * 2, 0, 0, -F],
                                [0, F * 2, F, 0], [0, F * 2, -F, 0]]) {
    const g = new THREE.PlaneGeometry(w || d, 4.3);
    const m = new THREE.Mesh(g, fm);
    m.position.set(cx, 2.15, -cy);
    if (!w) m.rotation.y = Math.PI / 2;
    scene.add(m);
  }
  /* caminhao */
  const T = SITE.truck;
  const truck = new THREE.Mesh(new THREE.BoxGeometry(T.w, T.h, T.len),
    new THREE.MeshLambertMaterial({ color: 0xd8443a }));
  truck.position.set(0, T.h / 2, -T.len / 2);
  scene.add(truck);

  group3d = new THREE.Group(); scene.add(group3d);
  proto = await new GLTFLoader().loadAsync('./prototypes.glb');
  ready3d = true;
  /* resize() DEPOIS de existir renderer. setMode chama resize() e so entao
     init3d(), que e async — entao na primeira vez o renderer nascia com o
     tamanho padrao de 300x150 do canvas e ficava assim ate a janela mudar. */
  resize();
  sync3d();
}

function sync3d() {
  if (!ready3d) return;
  group3d.clear();
  for (const it of ITEMS) {
    const c = CATALOG[it.key]; if (!c) continue;
    const src = proto.scene.getObjectByName(c.node);
    if (!src) continue;
    const o = src.clone(true);
    /* Blender (x, y) -> three (x, 0, -y); rotZ -> rotY de mesmo sinal. */
    o.position.set(it.x, 0, -it.y);
    o.rotation.set(0, THREE.MathUtils.degToRad(it.rot), 0);
    o.scale.setScalar(it.scale);
    group3d.add(o);
  }
  renderer.render(scene, cam);
}

/* ------------------------------------------------------------------ modos */
let mode = '2d';
function setMode(m) {
  mode = m;
  $('m2d').classList.toggle('on', m === '2d');
  $('m3d').classList.toggle('on', m === '3d');
  planCv.style.display = m === '2d' ? 'block' : 'none';
  threeCv.style.display = m === '3d' ? 'block' : 'none';
  resize();
  if (m === '3d' && !renderer) init3d(); else draw();
}
$('m2d').onclick = () => setMode('2d');
$('m3d').onclick = () => setMode('3d');

function resize() {
  /* O canvas 2D trabalha em PIXELS CSS de proposito: toPx/toM leem
     planCv.width, entao misturar devicePixelRatio aqui obrigaria os dois a
     saber do DPR. A versao anterior definia o tamanho com DPR, chamava
     setTransform e depois REDEFINIA width — o que zera o transform — ou seja,
     fazia as tres coisas e nenhuma valia.

     O fallback de tamanho importa: quando a aba esta oculta o layout devolve
     clientWidth 0, e um canvas de largura zero quebra getImageData e desenha
     nada. */
  const st = $('stage');
  const w = Math.max(320, st.clientWidth || innerWidth - 280);
  const h = Math.max(240, st.clientHeight || innerHeight - 44);
  planCv.width = w; planCv.height = h;
  if (renderer) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
}
addEventListener('resize', () => { resize(); draw(); });

/* ---------------------------------------------------------------- acoes -- */
$('add').onchange = (e) => {
  const k = e.target.value; if (!k) return;
  ITEMS.push({ key: k, x: Math.round(view.x - SX()), y: Math.round(view.y - SY()),
               rot: 0, scale: 1, note: CATALOG[k].label, inside: true });
  sel = ITEMS.length - 1; e.target.value = ''; draw();
};
$('dup').onclick = () => {
  const it = ITEMS[sel]; if (!it) return;
  ITEMS.push({ ...it, x: it.x + 6, y: it.y - 6 }); sel = ITEMS.length - 1; draw();
};
$('del').onclick = () => { if (sel >= 0) { ITEMS.splice(sel, 1); sel = -1; draw(); } };
$('save').onclick = () => {
  const blob = new Blob([JSON.stringify({ site: SITE, items: ITEMS }, null, 1)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'layout.json'; a.click();
};
$('load').onclick = () => $('file').click();
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const j = JSON.parse(await f.text());
  if (j.site) SITE = j.site;
  ITEMS = j.items || []; sel = -1; draw();
};

boot();
