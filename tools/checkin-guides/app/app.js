/* App de teste dos guias de foto.
   ---------------------------------------------------------------------------
   O que ele existe para responder, e por que cada peça está aqui:

   1. "A regra de descrição → jogo de fotos acerta?"  A lista traz O.S. DE
      PRODUÇÃO DE VERDADE, da API, e cada linha já mostra os grupos que a regra
      deduziu. Testar isso contra descrições inventadas não valeria nada: o
      banco tem "logomarca padrÃo", "pntura da frente e traseira" e
      "remoÇÃo geral", e é contra ESSAS que a regra precisa passar.

   2. "O enquadramento do render bate com a foto que o operador tira?"  O modo
      SOBRE A FOTO desenha o guia por cima das fotos de check-in que aquela
      mesma O.S. já tem. É a única prova honesta da pose — distância, altura de
      câmera e FOV saem confirmados ou reprovados na hora.

   3. "Como isso vai ficar no visor?"  O modo CÂMERA abre a webcam com o guia
      por cima e o mesmo controle de intensidade que o app tem.

   As regras vêm de `/regras.mjs`, que o servidor serve a partir do MESMO
   `poses.mjs` que o disparador usa. Uma cópia aqui viraria uma segunda verdade
   sobre o que "laterais" significa. */
import { gruposPara, REGRAS } from '/regras.mjs';

const $ = (id) => document.getElementById(id);
const api = (p, init) => fetch('/api' + p, {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: 'Bearer ' + token } : {}),
    ...(init?.headers || {}),
  },
});

let token = localStorage.getItem('guia_token') || '';
let manifesto = null;
let osAtual = null;
let posesDaOS = [];

/* --------------------------------------------------------------- manifesto */
async function carregaManifesto() {
  const r = await fetch('/guias/manifest.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('manifest.json não encontrado — rode `node tools/checkin-guides/shoot.mjs`');
  manifesto = await r.json();
}

/** As poses de um grupo, na ordem em que o operador deve fotografar. */
function posesDoGrupo(grupo) {
  return manifesto.poses
    .filter((p) => p.grupo === grupo)
    /* Lado antes de ordem: as três da esquerda juntas, depois as três da
       direita. Alternar lado obrigaria o operador a dar duas voltas. */
    .sort((a, b) => (a.lado || '').localeCompare(b.lado || '') || a.ordem - b.ordem);
}

/* ------------------------------------------------------------------- login */
async function entrar() {
  const contact = $('contato').value.trim();
  const password = $('senha').value;
  if (!contact || !password) return;
  $('entrar').disabled = true;
  try {
    const r = await api('/auth/login', {
      method: 'POST', body: JSON.stringify({ contact, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
    token = j?.data?.token || j?.token || j?.data?.accessToken || j?.accessToken;
    if (!token) throw new Error('resposta sem token: ' + JSON.stringify(j).slice(0, 200));
    localStorage.setItem('guia_token', token);
    $('quem').textContent = '✓ conectado';
    $('senha').value = '';
    buscar();
  } catch (e) {
    $('quem').textContent = '';
    alert('Não entrou: ' + e.message);
  } finally {
    $('entrar').disabled = false;
  }
}

/* ------------------------------------------------------------------ lista */
async function buscar() {
  const q = $('q').value.trim();
  const params = new URLSearchParams({
    limit: '40',
    orderBy: JSON.stringify({ createdAt: 'desc' }),
    typeIn: JSON.stringify(['PRODUCTION']),
  });
  if (q) params.set('searchingFor', q);

  $('dicaLista').textContent = 'Buscando…';
  try {
    const r = await api('/service-orders?' + params.toString());
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
    const linhas = j?.data || [];
    $('dicaLista').textContent = `${linhas.length} O.S. de produção`;
    render(linhas);
  } catch (e) {
    $('dicaLista').textContent = 'Falhou: ' + e.message;
    $('oss').innerHTML = '';
  }
}

function render(linhas) {
  const ul = $('oss');
  ul.innerHTML = '';
  for (const so of linhas) {
    const grupos = gruposPara(so.description);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="d"></div>
      <div class="m"></div>
      <div class="g">${grupos.length
        ? grupos.map((g) => `<span class="tag on">${g}</span>`).join('')
        : '<span class="tag">sem guia</span>'}</div>`;
    li.querySelector('.d').textContent = so.description || '(sem descrição)';
    li.querySelector('.m').textContent = [
      so.status, so.task?.name, so.task?.plate, so.task?.customer?.fantasyName,
    ].filter(Boolean).join(' · ');
    li.onclick = () => { [...ul.children].forEach((c) => c.classList.remove('sel')); li.classList.add('sel'); abrir(so); };
    ul.appendChild(li);
  }
}

/* ---------------------------------------------------------------- detalhe */
async function abrir(so) {
  osAtual = so;
  $('vazio').hidden = true;
  $('conteudo').hidden = false;
  $('osDesc').textContent = so.description || '(sem descrição)';
  $('osMeta').textContent = [
    so.task?.name, so.task?.plate, so.task?.customer?.fantasyName, so.status,
  ].filter(Boolean).join(' · ');

  const grupos = gruposPara(so.description);
  $('osChips').innerHTML = grupos.length
    ? grupos.map((g) => `<span class="tag on">${g}</span>`).join('')
    : '<span class="tag">nenhuma regra casou — câmera limpa</span>';

  posesDaOS = grupos.flatMap(posesDoGrupo);

  const grade = $('grade');
  grade.innerHTML = '';
  posesDaOS.forEach((pose, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <button class="thumb"><img loading="lazy" src="/guias/${pose.render}" alt=""></button>
      <div class="rot"><span class="num">${i + 1}</span><span class="t"></span></div>
      <div class="cam"></div>`;
    card.querySelector('.t').textContent = pose.rotulo;
    card.querySelector('.cam').textContent =
      `${pose.w}×${pose.h} · ${pose.camY.toFixed(2)} m de altura · ` +
      `${pose.camera.dist.toFixed(1)} m · ${pose.fovLongDeg}°` +
      (pose.espelhoDe ? ' · espelho' : '');
    card.querySelector('.thumb').onclick = () => palco(pose, i);
    grade.appendChild(card);
  });

  /* As fotos de check-in que ESSA O.S. já tem — a régua contra a qual o
     enquadramento é julgado. Vêm da rota por id porque a listagem não traz
     `include`. */
  so.__fotos = await fotosDaOS(so.id);
}

async function fotosDaOS(id) {
  try {
    const inc = JSON.stringify({ checkinFiles: true, checkoutFiles: true });
    const r = await api(`/service-orders/${id}?include=${encodeURIComponent(inc)}`);
    const j = await r.json().catch(() => ({}));
    const d = j?.data || {};
    return [...(d.checkinFiles || []), ...(d.checkoutFiles || [])];
  } catch { return []; }
}

/* ------------------------------------------------------------------ palco */
let stream = null;
let poseAtual = null;

function palco(pose, i) {
  poseAtual = pose;
  $('palco').hidden = false;
  $('palcoTitulo').textContent = `${i + 1}. ${pose.rotulo}`;
  $('quadro').style.aspectRatio = `${pose.w} / ${pose.h}`;
  $('guia').src = '/guias/' + pose.guia;
  $('camMeta').textContent =
    `câmera a ${pose.camera.dist.toFixed(2)} m · olho a ${pose.camY.toFixed(2)} m · ` +
    `azimute ${pose.azDeg}° · FOV ${pose.fovLongDeg}° no lado maior`;
  aplicaOpacidade();
  modo('guia');
  montaTiras();
}

function montaTiras() {
  const tiras = $('tirasFoto');
  tiras.innerHTML = '';
  const fotos = osAtual?.__fotos || [];
  if (!fotos.length) return;
  fotos.forEach((f, k) => {
    const img = document.createElement('img');
    img.src = `/api/files/serve/${f.id}`;
    img.onclick = () => {
      [...tiras.children].forEach((c) => c.classList.remove('sel'));
      img.classList.add('sel');
      $('fundo').src = img.src;
      modo('foto');
    };
    if (k === 0) img.classList.add('sel');
    tiras.appendChild(img);
  });
  $('fundo').src = `/api/files/serve/${fotos[0].id}`;
}

function modo(m) {
  document.querySelectorAll('.modo').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === m));
  const v = $('video'), f = $('fundo');
  v.hidden = m !== 'camera';
  f.hidden = m !== 'foto';
  if (m === 'camera') ligaCamera(); else desligaCamera();
}

async function ligaCamera() {
  if (stream) return;
  try {
    /* `facingMode: environment` pede a traseira no celular e é ignorado no
       desktop, onde só existe uma. A resolução pedida é a da POSE, para o
       preview ter a mesma proporção do guia. */
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: poseAtual.w }, height: { ideal: poseAtual.h },
      },
      audio: false,
    });
    $('video').srcObject = stream;
  } catch (e) {
    alert('Câmera indisponível: ' + e.message + '\n(o navegador exige HTTPS ou localhost)');
  }
}

function desligaCamera() {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
  $('video').srcObject = null;
}

const aplicaOpacidade = () => { $('guia').style.opacity = $('opac').value / 100; };

/* ------------------------------------------------------------------ ligar */
$('entrar').onclick = entrar;
$('senha').onkeydown = (e) => { if (e.key === 'Enter') entrar(); };
$('buscar').onclick = buscar;
$('q').onkeydown = (e) => { if (e.key === 'Enter') buscar(); };
$('opac').oninput = aplicaOpacidade;
$('fechar').onclick = () => { desligaCamera(); $('palco').hidden = true; };
document.querySelectorAll('.modo').forEach((b) => { b.onclick = () => modo(b.dataset.modo); });
document.onkeydown = (e) => { if (e.key === 'Escape' && !$('palco').hidden) $('fechar').click(); };

await carregaManifesto();
console.info(`manifesto: ${manifesto.poses.length} poses · ${REGRAS.length} regras`);
if (token) { $('quem').textContent = '✓ conectado (token guardado)'; buscar(); }
