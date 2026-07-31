/* The studio's own markup — a verbatim port of truck-studio/webapp/index.html's
   <body>, minus the <script> tags (Vite owns module loading here).

   The engine builds and owns this DOM (see core/dom.ts); React only hosts the
   container. Keeping the ids/classes identical to the standalone app means
   every engine module (scene/models/livery/ui) works untouched, and upstream
   changes to the standalone app still apply cleanly.

   The 3-step selector overlay (#ts-selector) and the bottom-left badge
   (#ts-badge) are deliberately NOT here: ui/selector.ts builds and injects them
   itself, because their markup is data-driven (one card per manifest entry). */
export const STUDIO_HTML = /* html */ `
  <div id="app">
    <!-- 3D VIEWPORT -->
    <section id="viewport">
      <header id="topbar">
        <div class="brand">
          <span class="logo-dot"></span>
          <div>
            <h1>Truck Studio</h1>
            <p id="brand-sub">Cavalo mecânico · Frigorífico Paleteiro</p>
          </div>
        </div>
        <div class="top-actions">
          <label class="chk"><input type="checkbox" id="show-cab" checked /><span>Cabine</span></label>
          <label class="chk"><input type="checkbox" id="show-trailer" checked /><span>Implemento</span></label>
        </div>
      </header>
      <div id="canvas-holder">
        <!-- VIEW CONTROLS — enquadrar / girar / capturar.
             Ficam DENTRO de #canvas-holder, no canto superior direito, e não na
             topbar: são ações sobre a CENA, e o lugar onde o olho já está é o
             render, não a barra. O canto esquerdo é do HUD de iluminação e dos
             dois badges do seletor, então a direita é a metade livre.
             Os ids são os mesmos de quando isto morava na topbar — ui/sidebar.ts
             liga por id e não precisou mudar.
             Ícones: SVG inline, 24x24, traço em currentColor, mesma convenção
             de ui/hud.ts (nunca emoji: a plataforma escolheria a fonte e o
             glifo não seguiria a cor nem combinaria com o resto). -->
        <div id="view-controls" role="group" aria-label="Controles de visualização">
          <button id="btn-reset" class="ts-vbtn" type="button" title="Enquadrar o veículo"
                  aria-label="Enquadrar o veículo">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <path d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9
                       M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15"/>
              <circle cx="12" cy="12" r="2.6"/>
            </svg>
          </button>
          <button id="btn-turn" class="ts-vbtn" type="button" title="Girar automaticamente"
                  aria-label="Girar automaticamente" aria-pressed="false">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8"/>
              <path d="M20.4 4.2v3.6h-3.6"/>
            </svg>
          </button>
          <button id="btn-shot" class="ts-vbtn" type="button" title="Baixar imagem"
                  aria-label="Baixar imagem da cena">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <path d="M3.4 8.8h3.2l1.3-2.2h8.2l1.3 2.2h3.2a.8.8 0 0 1 .8.8v8.2a.8.8 0 0 1-.8.8
                       H3.4a.8.8 0 0 1-.8-.8V9.6a.8.8 0 0 1 .8-.8Z"/>
              <circle cx="12" cy="13.4" r="3.1"/>
            </svg>
          </button>
        </div>
        <div id="loading">
          <div class="spinner"></div>
          <div class="load-text" id="load-text">Carregando modelos…</div>
          <div class="load-bar"><i id="load-fill"></i></div>
        </div>
        <div id="cab-switching" class="hidden">
          <div class="spinner small"></div><span id="cab-switching-text">Trocando veículo…</span>
        </div>
        <!-- Pílula da captura em alta resolução. Mesmo desenho de
             #cab-switching (as duas dividem a regra em core/studio.css), mas um
             NÓ SEPARADO de propósito: aquela pertence ao swap de modelo em
             studio.ts, e duas coisas escrevendo o mesmo elemento é como uma UI
             acaba discordando de si mesma.
             Existe porque scene/capture.ts BLOQUEIA a thread principal por
             algumas centenas de ms para renderizar o quadro grande — sem um
             aviso, o estúdio simplesmente congela e o arquivo aparece depois.
             É uma pílula e não a cortina: a cortina (#ts-loader) é a batida
             emocional da escolha do caminhão e dura segundos; isto dura menos
             de um. role=status + aria-live para quem não vê o spinner. -->
        <div id="ts-shot" class="hidden" role="status" aria-live="polite">
          <div class="spinner small"></div><span id="ts-shot-text">Gerando imagem…</span>
        </div>
        <div id="view-hint">Arraste para girar · scroll para zoom · botão direito para mover</div>
      </div>
    </section>

    <!-- SIDEBAR -->
    <aside id="sidebar">


      <!-- Pintura -->
      <section class="panel">
        <h3 class="panel-title">
          <span>Pintura</span>
          <b class="panel-hint" id="paint-finish-label"></b>
        </h3>

        <div class="seg" id="paint-finish" role="group" aria-label="Acabamento">
          <button class="seg-btn" data-finish="solid" title="Cor lisa com verniz — sem flocos">Sólida</button>
          <button class="seg-btn on" data-finish="metallic" title="Flocos de alumínio na tinta">Metálica</button>
          <button class="seg-btn" data-finish="pearl" title="Mica: a cor muda com o ângulo">Perolizada</button>
        </div>

        <label class="ctl">
          <span>Cor base</span>
          <input type="color" id="paint-color" value="#b9bec6" />
        </label>
        <label class="ctl range">
          <span>Brilho do verniz <b id="cc-gloss-val"></b></span>
          <input type="range" id="paint-cc-gloss" min="0" max="100" value="90"
                 title="Nitidez do reflexo do verniz (clearcoat)" />
        </label>
        <label class="ctl range">
          <span>Casca de laranja <b id="peel-val"></b></span>
          <input type="range" id="paint-peel" min="0" max="100" value="12"
                 title="Ondulação microscópica real do verniz — 0 % é um espelho perfeito, irreal" />
        </label>

        <div class="paint-group" data-finish="metallic">
          <label class="ctl range">
            <span>Intensidade metálica <b id="metallic-val"></b></span>
            <input type="range" id="paint-metallic" min="0" max="100" value="72" />
          </label>
          <label class="ctl range">
            <span>Flop (claro/escuro) <b id="flop-val"></b></span>
            <input type="range" id="paint-flop" min="0" max="100" value="65"
                   title="Clareia de frente e escurece de lado — a assinatura da tinta metálica" />
          </label>
        </div>

        <div class="paint-group" data-finish="pearl">
          <label class="ctl">
            <span>Cor do reflexo</span>
            <input type="color" id="paint-pearl-color" value="#d8c7a8"
                   title="Cor que aparece nos ângulos rasantes (flop)" />
          </label>
          <label class="ctl range">
            <span>Intensidade do perolizado <b id="pearl-val"></b></span>
            <input type="range" id="paint-pearl" min="0" max="100" value="62" />
          </label>
          <label class="ctl range">
            <span>Nitidez da transição <b id="pearl-sharp-val"></b></span>
            <input type="range" id="paint-pearl-sharp" min="0" max="100" value="45" />
          </label>
        </div>

        <div class="paint-group" data-finish="metallic pearl">
          <label class="ctl range">
            <span>Tamanho dos flocos <b id="flake-size-val"></b></span>
            <input type="range" id="paint-flake-size" min="0" max="100" value="38" />
          </label>
          <label class="ctl range">
            <span>Brilho dos flocos <b id="flake-glint-val"></b></span>
            <input type="range" id="paint-flake-glint" min="0" max="100" value="55" />
          </label>
          <label class="ctl">
            <span>Cor dos flocos</span>
            <input type="color" id="paint-flake-color" value="#ffffff"
                   title="Tinge o brilho dos flocos (ex.: vermelho com flocos dourados)" />
          </label>
        </div>

        <label class="chk wide-chk">
          <input type="checkbox" id="paint-trailer" />
          <span>Aplicar ao implemento</span>
        </label>
      </section>

      <!-- Design do implemento -->
      <section class="panel">
        <h3 class="panel-title">Design do implemento</h3>
        <div class="preview-card" data-surface="left" title="Clique para editar">
          <div class="preview-frame">
            <canvas id="prev-left" width="600" height="150"></canvas>
          </div>
          <div class="preview-foot">
            <span>Lateral esquerda</span>
            <button class="mini primary btn-edit" data-surface="left">Editar</button>
          </div>
        </div>
        <div class="preview-card" data-surface="right" title="Clique para editar">
          <div class="preview-frame">
            <canvas id="prev-right" width="600" height="150"></canvas>
          </div>
          <div class="preview-foot">
            <span>Lateral direita</span>
            <button class="mini primary btn-edit" data-surface="right">Editar</button>
          </div>
        </div>
        <div class="preview-card" data-surface="rear" title="Clique para editar">
          <div class="preview-frame square">
            <canvas id="prev-rear" width="300" height="300"></canvas>
          </div>
          <div class="preview-foot">
            <span>Traseira <small>(portas)</small></span>
            <button class="mini primary btn-edit" data-surface="rear">Editar</button>
          </div>
        </div>
      </section>

      <div class="side-foot">
        <span id="status">Carregando…</span>
      </div>
    </aside>
  </div>

  <!-- LARGE LIVERY EDITOR MODAL -->
  <div id="editor-modal" class="hidden">
    <div class="modal-card">
      <header class="modal-head">
        <div class="tabs" id="surface-tabs">
          <button class="tab active" data-surface="left">Lateral esquerda</button>
          <button class="tab" data-surface="right">Lateral direita</button>
          <button class="tab" data-surface="rear">Traseira</button>
        </div>
        <div class="editor-caption" id="editor-caption">Lateral esquerda</div>
        <button id="modal-close" class="ghost" title="Fechar (Esc)">✕ Fechar</button>
      </header>

      <div class="modal-toolbar">
        <button class="tool" data-act="text"><span>T</span>Texto</button>
        <button class="tool" data-act="logo"><span>▣</span>Logo</button>
        <button class="tool" data-act="draw"><span>✎</span>Desenhar</button>
        <button class="tool" data-act="rect"><span>▭</span>Retângulo</button>
        <button class="tool" data-act="circle"><span>◯</span>Círculo</button>
        <button class="tool" data-act="delete"><span>🗑</span>Excluir</button>
        <button class="tool" data-act="front"><span>⬆</span>Frente</button>
        <button class="tool" data-act="back"><span>⬇</span>Trás</button>
        <button class="tool" data-act="clear"><span>⌫</span>Limpar</button>
        <span class="tb-sep"></span>
        <label class="tb-ctl"><span>Cor</span><input type="color" id="color" value="#c8102e" /></label>
        <label class="tb-ctl"><span>Traço</span><input type="range" id="brush" min="2" max="60" value="14" /></label>
        <label class="tb-ctl"><span>Fundo</span><input type="color" id="bgcolor" value="#ffffff" />
          <button class="mini ghost" id="bg-clear" title="Voltar ao alumínio original">×</button></label>
      </div>

      <div class="modal-stage" id="modal-stage">
        <div class="stage-panel" id="stage-left">
          <canvas id="fabric-left" width="2048" height="512"></canvas>
        </div>
        <div class="stage-panel hidden" id="stage-right">
          <canvas id="fabric-right" width="2048" height="512"></canvas>
        </div>
        <div class="stage-panel hidden" id="stage-rear">
          <canvas id="fabric-rear" width="1024" height="1024"></canvas>
        </div>
        <div id="drop-hint">Solte a imagem para adicionar</div>
      </div>
      <div class="modal-foot">Dica: arraste e solte uma imagem em qualquer lugar do painel · a linha tracejada é a silhueta real do painel</div>
    </div>
  </div>

  <input type="file" id="logo-input" accept="image/*" hidden />
`;
