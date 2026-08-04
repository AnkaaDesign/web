/* Chrome do estúdio: a linha de estado (hoje só para leitor de tela) e os
   controles de cena — enquadrar, girar, esconder a interface e capturar — que
   flutuam no canto superior direito do render.

   A TOPBAR SAIU INTEIRA. Ela tomava ~56 px de altura para mostrar o nome do
   próprio app, e levava junto os dois checkboxes de "Cabine"/"Implemento": eram
   um atalho de depuração, não uma configuração, e sumir com metade do veículo
   sem nada na tela explicando por quê é a pior coisa que um toggle pode fazer.
   Quem quer ver a cena limpa usa o botão de esconder interface, que devolve
   tudo com um clique.

   Este arquivo é o que sobrou de ui/sidebar.ts, e o nome mudou porque a coisa
   mudou: não há mais sidebar. O que morava lá foi para onde pertence —
   - iluminação → HUD de vidro (ui/hud.ts),
   - modelo → badge do caminhão (ui/selector.ts),
   - PINTURA → passo de cor do seletor, com o cavalo renderizado em cada cor
     (ui/selector.ts + ui/preview.ts + catalog/colors.ts),
   - DESIGN DO IMPLEMENTO → três cards sobre o render (#ts-panels), abrindo o
     editor grande (vehicle/livery.ts),
   - "pintar o implemento" → barra do editor grande, ao lado do painel que
     recebe a tinta (vehicle/livery.ts).
   Cada um desses tinha virado uma SEGUNDA superfície escrevendo um estado que
   outra superfície já era dona — que é como uma UI acaba discordando de si
   mesma. Sobrou aqui só o que não tem outro dono. */
import { frameAll, controls } from '../scene/scene';
import { captureViewport } from '../scene/capture';
import { state } from '../vehicle/models';
import { root, $, evCurrent } from '../core/dom';

export const setStatus = (t: string) => { $('status').textContent = t; };

/* ---------------- topbar + view controls ----------------
   Os dois toggles de visibilidade seguem na topbar; enquadrar/girar/capturar
   ficam SOBRE o render, no canto superior direito (#view-controls, em
   core/template.ts). */
function bindTopbar() {
  /* #canvas-holder guarda o canvas e estes botões como IRMÃOS, e scene.ts liga o
     OrbitControls a `renderer.domElement` — o canvas, não o holder — então hoje
     um clique aqui não tem caminho de bolha até os controles. Isto é a guarda
     para o dia em que tiver: sem ela, apertar "Screenshot" começaria a arrastar
     a câmera por baixo do botão. Mesma proteção que ui/hud.ts, os badges do
     seletor e os cards de painel já aplicam. `wheel` é passivo: só precisa não
     viajar. */
  const cluster = $('view-controls');
  const swallow = (e: Event) => e.stopPropagation();
  cluster.addEventListener('pointerdown', swallow);
  cluster.addEventListener('pointerup', swallow);
  cluster.addEventListener('wheel', swallow, { passive: true });

  $('btn-reset').addEventListener('click', () => frameAll([state.cabGroup, state.trailerGroup]));
  $('btn-turn').addEventListener('click', (e) => {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.2;
    const btn = evCurrent(e);
    btn.classList.toggle('on', controls.autoRotate);
    /* O botão declara aria-pressed no template, então ele TEM de acompanhar —
       um toggle que anuncia "não pressionado" enquanto gira é pior do que um
       que não anuncia nada. */
    btn.setAttribute('aria-pressed', controls.autoRotate ? 'true' : 'false');
  });
  /* Esconder a interface. Uma classe na raiz e nada mais: quem sabe o que é
     "interface" é o CSS (core/studio.css), e cada coisa que flutua sobre o
     render já tem seletor próprio lá. Um toggle que fosse apagando nó por nó
     daqui teria de ser atualizado toda vez que um novo card aparecesse — e
     esqueceria de um.
     O botão é o único que fica visível, senão desfazer viraria adivinhação. */
  $('btn-chrome').addEventListener('click', (e) => {
    const bare = root.classList.toggle('ts-bare');
    const btn = evCurrent(e);
    btn.classList.toggle('on', bare);
    btn.setAttribute('aria-pressed', bare ? 'true' : 'false');
    btn.title = bare ? 'Mostrar a interface' : 'Esconder a interface';
    btn.setAttribute('aria-label', btn.title);
    setStatus(bare ? 'Interface escondida · só a cena' : 'Interface visível');
  });

  $('btn-shot').addEventListener('click', () => { void runCapture(); });
}

/* ---------------- captura em alta resolução ----------------
   A UI da coisa; o trabalho pesado é de scene/capture.ts, que documenta por que
   um toDataURL do canvas visível saía em ~1500x900. Aqui só mora o que é DOM:
   a pílula, o guarda de reentrância e o download. */

/* Um clique de cada vez. captureViewport() para o loop de render e
   redimensiona o buffer; um segundo clique no meio pegaria o renderer já
   remexido e devolveria o estado errado no seu próprio finally. */
let capturing = false;

/* Um rAF agenda DEPOIS do próximo cálculo de estilo/layout; o segundo só roda
   depois que aquele quadro foi pintado. Duas voltas, portanto, é o mínimo que
   garante que a pílula está NA TELA antes de a captura travar a thread — com
   uma só, o indicador aparece quando o trabalho que ele anuncia já acabou. */
const painted = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  /* Revogar na mesma volta cancela o download em alguns motores: o clique só
     ENFILEIRA a busca da blob: URL. Alguns segundos cobrem isso com folga, e o
     PNG (dezenas de MB em 12 MP) não fica pendurado na memória além disso —
     que é justamente o que este recurso não pode fazer. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function runCapture() {
  if (capturing) return;
  capturing = true;

  const btn = $<HTMLButtonElement>('btn-shot');
  const pill = $('ts-shot');
  btn.disabled = true;
  pill.classList.remove('hidden');   /* o texto é do template; ninguém o reescreve */

  try {
    await painted();
    const shot = await captureViewport();
    downloadBlob(shot.blob, 'truck-studio.png');
    setStatus(`Imagem salva · ${shot.width} × ${shot.height}`);
  } catch (err: unknown) {
    console.error('[truck-studio] captura falhou', err);
    setStatus('Não foi possível gerar a imagem.');
  } finally {
    pill.classList.add('hidden');
    btn.disabled = false;
    capturing = false;
  }
}

export function initUI() {
  bindTopbar();
}
