/* A PORTEIRA DE WEBGL — a tela que existe para o erro ter uma resposta.
   ===========================================================================
   O PROBLEMA, e ele é anterior a qualquer otimização. `scene/scene.ts` cria o
   `WebGLRenderer` no ESCOPO DE MÓDULO. Numa máquina sem WebGL2 (three r163+ é
   WebGL2-only) ou com a aceleração por hardware desligada no navegador, isso
   LANÇA durante o import do módulo da rota — e o que o usuário vê é a tela de
   erro genérica do app, sem uma palavra sobre a causa e sem nada a fazer.

   Este arquivo roda ANTES desse import (ver `index.tsx`: o engine passou a ser
   `await import()` justamente para que exista um "antes") e transforma isso
   numa tela que diz o que aconteceu e o que fazer.

   ---------------------------------------------------------------------------
   ⚠️ O QUE ESTA TELA NÃO PODE FAZER, E É PRECISO SER HONESTO SOBRE ISSO

   **Uma página web não consegue ligar a aceleração gráfica.** Não há API, e não
   é omissão dos navegadores: é isolamento deliberado — se um site pudesse mexer
   nas configurações do navegador, isso seria a vulnerabilidade, não o recurso.

   E vai além do botão: **não dá nem para NAVEGAR até a tela de configuração.**
   Conteúdo web é proibido de abrir `chrome://`, `edge://`, `about:config` e
   companhia, por link ou por `window.open` — o Chromium bloqueia em silêncio e
   o Firefox lança. Já foi tentado; um link que não faz nada é pior que nenhum
   link, porque a pessoa clica, não acontece nada, e ela conclui que o app está
   quebrado em vez de que a configuração está desligada.

   ENTÃO O QUE DÁ PARA FAZER, E É O QUE ESTE ARQUIVO FAZ:
     · DETECTAR com certeza (rasterizador de software é uma string reconhecível);
     · IDENTIFICAR o navegador e mostrar o passo a passo DELE, não uma lista de
       cinco navegadores em que a pessoa tem de se achar;
     · dar o endereço da configuração com um botão de COPIAR, que é a única
       forma de levar alguém até `chrome://settings/system` em um gesto.

   Copiar é o afordance honesto aqui: é o mais perto de um botão que a
   plataforma permite. */

/** O que a porteira decidiu. */
export type GateVerdict =
  /** Tudo certo — WebGL2 acelerado. Segue para o engine. */
  | { kind: 'ok' }
  /** Há WebGL2, mas quem desenha é a CPU. O estúdio roda, e roda mal. */
  | { kind: 'software'; renderer: string }
  /** Não há WebGL2. O engine não sobe. */
  | { kind: 'none' };

interface BrowserHelp {
  name: string;
  /** O endereço da página de configuração, para copiar. */
  url: string | null;
  steps: string[];
}

/* Ordem IMPORTA: toda string de Chrome-like contém "Chrome", e a do Edge contém
   as duas. Do mais específico para o mais genérico. */
function detectBrowser(ua = navigator.userAgent): BrowserHelp {
  const has = (s: string) => ua.includes(s);
  if (has('Edg/')) {
    return {
      name: 'Microsoft Edge',
      url: 'edge://settings/system',
      steps: [
        'Abra edge://settings/system',
        'Ligue "Usar aceleração de hardware quando disponível"',
        'Clique em "Reiniciar" e volte a esta página',
      ],
    };
  }
  if (has('OPR/') || has('Opera')) {
    return {
      name: 'Opera',
      url: 'opera://settings/system',
      steps: [
        'Abra opera://settings/system',
        'Ligue "Usar aceleração de hardware quando disponível"',
        'Reinicie o navegador',
      ],
    };
  }
  if (has('Firefox/')) {
    return {
      name: 'Mozilla Firefox',
      url: 'about:preferences#general',
      steps: [
        'Abra about:preferences e vá até "Desempenho"',
        'Desmarque "Usar configurações de desempenho recomendadas"',
        'Marque "Usar aceleração de hardware quando disponível"',
        'Reinicie o Firefox',
      ],
    };
  }
  /* Safari antes de Chrome: a UA do Chrome também contém "Safari". */
  if (has('Safari/') && !has('Chrome/') && !has('Chromium/')) {
    return {
      name: 'Safari',
      /* Safari não tem página de configuração endereçável, e não tem
         interruptor de aceleração: ela é sempre ligada quando há GPU. Cair aqui
         quase sempre significa máquina virtual ou GPU bloqueada pelo sistema. */
      url: null,
      steps: [
        'O Safari não tem interruptor de aceleração — ela é automática',
        'Se esta tela apareceu, o sistema pode estar sem acesso à GPU (máquina virtual, sessão remota)',
        'Tente abrir em outro navegador, ou reinicie o Mac',
      ],
    };
  }
  if (has('Chrome/') || has('Chromium/')) {
    return {
      name: 'Google Chrome',
      url: 'chrome://settings/system',
      steps: [
        'Abra chrome://settings/system',
        'Ligue "Usar aceleração de hardware quando disponível"',
        'Clique em "Reiniciar" e volte a esta página',
      ],
    };
  }
  return {
    name: 'seu navegador',
    url: null,
    steps: [
      'Procure "aceleração de hardware" nas configurações do navegador',
      'Ligue a opção e reinicie o navegador',
    ],
  };
}

/**
 * Sonda WebGL2 num canvas descartável e diz o que fazer.
 *
 * NUNCA LANÇA — ela é justamente o que existe para transformar uma exceção numa
 * tela legível, então uma exceção aqui derrotaria o propósito.
 */
export function checkWebGL(): GateVerdict {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return { kind: 'none' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    /* Solta o contexto: ele já respondeu tudo, e um contexto vivo conta para o
       limite do navegador (~16) que o engine vai querer inteiro. */
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    /* ⚠️ A AUSÊNCIA DA STRING NÃO É SUSPEITA. O Firefox mascara
       `UNMASKED_RENDERER_WEBGL` por privacidade, e tratar `''` como "software"
       poria o Firefox inteiro atrás desta tela em máquinas boas — que é
       exatamente o defeito que esta porteira existe para não ter. Sem
       informação, o veredito é OK. */
    if (name && /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name)) {
      return { kind: 'software', renderer: name };
    }
    return { kind: 'ok' };
  } catch {
    return { kind: 'none' };
  }
}

/* ---------------------------------------------------------------------------
   A TELA
   --------------------------------------------------------------------------- */

const CSS = `
.ts-gate{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  padding:24px;background:var(--ts-screen-bg,#0d1117);color:var(--ts-screen-fg,#e6edf3);
  font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:auto;z-index:40}
.ts-gate__card{max-width:520px;width:100%}
.ts-gate__ico{font-size:30px;line-height:1;margin-bottom:12px}
.ts-gate__h{margin:0 0 8px;font-size:19px;font-weight:650;letter-spacing:-.01em}
.ts-gate__p{margin:0 0 16px;opacity:.78}
.ts-gate__steps{margin:0 0 16px;padding-left:20px}
.ts-gate__steps li{margin:5px 0}
.ts-gate__url{display:flex;gap:8px;align-items:center;margin:0 0 18px}
.ts-gate__code{flex:1;min-width:0;padding:8px 10px;border-radius:8px;font-family:ui-monospace,
  SFMono-Regular,Menlo,monospace;font-size:12.5px;background:rgba(127,127,127,.14);
  border:1px solid rgba(127,127,127,.25);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ts-gate__btn{padding:8px 13px;border-radius:8px;border:1px solid rgba(127,127,127,.32);
  background:rgba(127,127,127,.12);color:inherit;font:inherit;font-weight:550;cursor:pointer;
  white-space:nowrap}
.ts-gate__btn:hover{background:rgba(127,127,127,.2)}
.ts-gate__btn--go{border-color:rgba(88,166,255,.5);background:rgba(88,166,255,.16)}
.ts-gate__row{display:flex;gap:8px;flex-wrap:wrap}
.ts-gate__note{margin:16px 0 0;font-size:12.5px;opacity:.6}
`;

function ensureCss(host: HTMLElement) {
  if (host.querySelector('style[data-ts-gate]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-ts-gate', '');
  s.textContent = CSS;
  host.appendChild(s);
}

/**
 * Desenha a tela e devolve um cancelador.
 *
 * `onContinue` só é passado no caso `software`: ali o estúdio FUNCIONA, apenas
 * mal, e barrar alguém que decidiu seguir assim seria decidir por ele. No caso
 * `none` não há o que continuar — o engine não sobe.
 */
export function renderGate(
  host: HTMLElement, verdict: GateVerdict, onContinue?: () => void,
): () => void {
  ensureCss(host);
  const help = detectBrowser();
  const wrap = document.createElement('div');
  wrap.className = 'ts-gate';

  const card = document.createElement('div');
  card.className = 'ts-gate__card';

  const soft = verdict.kind === 'software';
  card.insertAdjacentHTML('beforeend',
    `<div class="ts-gate__ico">${soft ? '🐌' : '🛑'}</div>`);

  const h = document.createElement('h2');
  h.className = 'ts-gate__h';
  h.textContent = soft
    ? 'A aceleração gráfica parece estar desligada'
    : 'Este navegador está sem aceleração 3D';
  card.appendChild(h);

  const p = document.createElement('p');
  p.className = 'ts-gate__p';
  p.textContent = soft
    ? `Quem está desenhando é o processador, não a placa de vídeo${
      verdict.kind === 'software' && verdict.renderer ? ` (${verdict.renderer})` : ''
    }. O Truck Studio abre assim, mas vai ficar lento e a ventoinha vai trabalhar. `
      + `Ligar a aceleração no ${help.name} resolve.`
    : `O Truck Studio precisa de WebGL2 para desenhar em 3D, e ele não está `
      + `disponível no ${help.name}. Normalmente é a aceleração por hardware desligada.`;
  card.appendChild(p);

  const ol = document.createElement('ol');
  ol.className = 'ts-gate__steps';
  for (const step of help.steps) {
    const li = document.createElement('li');
    li.textContent = step;
    ol.appendChild(li);
  }
  card.appendChild(ol);

  /* O ENDEREÇO COM BOTÃO DE COPIAR, e não um link. Ver o aviso do cabeçalho:
     conteúdo web não pode navegar para `chrome://`, então um <a> aqui seria um
     link que não faz nada — e um link morto faz a pessoa concluir que o app
     está quebrado. Copiar funciona, e é um gesto só. */
  if (help.url) {
    const row = document.createElement('div');
    row.className = 'ts-gate__url';
    const code = document.createElement('code');
    code.className = 'ts-gate__code';
    code.textContent = help.url;
    row.appendChild(code);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'ts-gate__btn';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(help.url!).then(
        () => { copy.textContent = 'Copiado ✓'; },
        /* Área de transferência bloqueada (sem HTTPS, sem permissão): seleciona
           o texto, que é o plano B manual e sempre funciona. */
        () => {
          const r = document.createRange();
          r.selectNodeContents(code);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
          copy.textContent = 'Selecionado — Ctrl+C';
        },
      );
      setTimeout(() => { copy.textContent = 'Copiar'; }, 2600);
    });
    row.appendChild(copy);
    card.appendChild(row);
  }

  const row = document.createElement('div');
  row.className = 'ts-gate__row';
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'ts-gate__btn ts-gate__btn--go';
  again.textContent = 'Já liguei — verificar de novo';
  again.addEventListener('click', () => window.location.reload());
  row.appendChild(again);

  if (soft && onContinue) {
    const anyway = document.createElement('button');
    anyway.type = 'button';
    anyway.className = 'ts-gate__btn';
    anyway.textContent = 'Abrir assim mesmo';
    anyway.addEventListener('click', () => { wrap.remove(); onContinue(); });
    row.appendChild(anyway);
  }
  card.appendChild(row);

  const note = document.createElement('p');
  note.className = 'ts-gate__note';
  /* DITO EM VOZ ALTA, porque a primeira pergunta de quem lê isto é "por que o
     site não liga para mim?". Sem esta linha a tela parece preguiça nossa. */
  note.textContent = 'Um site não pode ligar essa opção sozinho — é uma '
    + 'configuração do navegador, protegida por segurança. Por isso o passo a passo.';
  card.appendChild(note);

  wrap.appendChild(card);
  host.appendChild(wrap);
  return () => wrap.remove();
}
