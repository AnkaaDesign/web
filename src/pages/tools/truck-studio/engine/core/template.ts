/* The studio's own markup.

   The engine builds and owns this DOM (see core/dom.ts); React only hosts the
   container. Keeping the ids/classes stable is what lets every engine module
   (scene/models/livery/ui) bind by id without knowing where the node lives.

   The selector overlay (#ts-selector) and the viewport badges (#ts-badge,
   #ts-mapbadge, #ts-colorbadge) are deliberately NOT here: ui/selector.ts builds
   and injects them itself, because their markup is data-driven (one card per
   manifest entry).

   NÃO EXISTE MAIS SIDEBAR. A coluna da direita carregava duas coisas, e as duas
   mudaram de lugar:
   - PINTURA virou um passo do seletor (ui/selector.ts): cards com o cavalo
     renderizado em 3D, um por cor da paleta (catalog/colors.ts). Uma cor é uma
     coisa que se ESCOLHE olhando, não oito sliders;
   - DESIGN DO IMPLEMENTO virou três cards flutuando sobre o render
     (#ts-panels), com as mesmas prévias vivas de antes. Clicar abre o mesmo
     editor grande, que agora é o único lugar onde o desenho das laterais e da
     traseira se mexe — e é lá que mora o "pintar o implemento", porque é uma
     decisão sobre o IMPLEMENTO e não sobre o cavalo.
   Com isso o render ocupa a largura inteira, que é o assunto da tela. */
export const STUDIO_HTML = /* html */ `
  <div id="app">
    <!-- 3D VIEWPORT -->
    <section id="viewport">
      <!-- NÃO EXISTE MAIS TOPBAR. Ela carregava a marca, a linha de estado e os
           dois checkboxes de visibilidade, e tomava ~56 px da altura do render
           em todas as telas. O render é o produto; uma barra de identidade em
           cima dele é o app se apresentando para si mesmo.
           Os checkboxes foram embora de vez: eram um atalho de depuração
           ("some com a cabine"), não uma escolha de configuração, e escondiam
           metade do veículo sem nada na tela dizendo por quê.
           A linha de estado sobrevive INVISÍVEL logo abaixo — ver #status. -->
      <div id="canvas-holder">
        <!-- VIEW CONTROLS — enquadrar / girar / capturar.
             Ficam DENTRO de #canvas-holder, no canto superior direito, e não na
             topbar: são ações sobre a CENA, e o lugar onde o olho já está é o
             render, não a barra. O canto esquerdo é do HUD de iluminação e dos
             badges do seletor.
             Os ids são os mesmos de quando isto morava na topbar — ui/sidebar.ts
             liga por id e não precisou mudar.
             Ícones: SVG inline, 24x24, traço em currentColor, mesma convenção
             de ui/hud.ts (nunca emoji: a plataforma escolheria a fonte e o
             glifo não seguiria a cor nem combinaria com o resto). -->
        <!-- A linha de estado, agora só para leitor de tela. Ela é escrita de
             cinco lugares (carga, captura, erro, troca de cor, pintura do
             implemento) e é a única confirmação textual de que algo terminou —
             então some da tela, não do documento. role=status + aria-live
             anunciam a mudança sem ocupar um pixel. -->
        <span id="status" class="ts-sr" role="status" aria-live="polite">Carregando…</span>
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
          <!-- Esconder a interface. Recolhe TUDO que flutua sobre o render —
               badges de cenário, caminhão e cor, HUD de luz, cards de design e a
               dica — e deixa só a cena. Existe porque esta tela é usada para
               olhar o caminhão e para mostrá-lo a alguém, e nesses dois momentos
               a interface é justamente o que sobra.
               Os próprios view controls FICAM: um botão que se esconde junto não
               teria como ser desfeito a não ser adivinhando onde clicar. (A
               captura em alta resolução nunca teve esse problema — ela
               re-renderiza a cena 3D, e nenhum overlay de DOM entra nela.) -->
          <button id="btn-chrome" class="ts-vbtn" type="button" title="Esconder a interface"
                  aria-label="Esconder a interface" aria-pressed="false">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <path d="M2.6 12S6.4 5.6 12 5.6 21.4 12 21.4 12 17.6 18.4 12 18.4 2.6 12 2.6 12Z"/>
              <circle cx="12" cy="12" r="2.9"/>
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

        <!-- DESIGN DO IMPLEMENTO — os três painéis pintáveis, um card cada.
             Mesmo material dos badges do seletor (vidro sobre o render), do lado
             oposto da tela, porque são a mesma classe de objeto: um cartão que
             MOSTRA o que está configurado e ABRE onde se muda aquilo.
             Cada card é um <button> para ganhar Enter/Espaço, foco e ordem de
             tabulação de graça — e mantém .preview-card + data-surface,
             que é por onde vehicle/livery.ts liga o clique.
             Os <canvas> continuam com as MESMAS ids e os mesmos tamanhos de
             buffer: livery.ts os resolve na avaliação do módulo, então eles têm
             de existir AQUI, e não serem criados por JS depois. -->
        <div id="ts-panels" role="group" aria-label="Design do implemento">
          <button type="button" class="ts-panel ts-panel--rear preview-card" data-surface="rear"
                  title="Editar as portas traseiras">
            <span class="ts-panel__media square"><canvas id="prev-rear" width="300" height="300"></canvas></span>
            <span class="ts-panel__body">
              <span class="ts-panel__label">Portas</span>
              <span class="ts-panel__name">Traseira</span>
            </span>
            <span class="ts-panel__edit" aria-hidden="true">Editar</span>
          </button>
          <button type="button" class="ts-panel preview-card" data-surface="left"
                  title="Editar a lateral esquerda">
            <span class="ts-panel__media"><canvas id="prev-left" width="600" height="101"></canvas></span>
            <span class="ts-panel__body">
              <span class="ts-panel__label">Lateral</span>
              <span class="ts-panel__name">Esquerda</span>
            </span>
            <span class="ts-panel__edit" aria-hidden="true">Editar</span>
          </button>
          <button type="button" class="ts-panel preview-card" data-surface="right"
                  title="Editar a lateral direita">
            <span class="ts-panel__media"><canvas id="prev-right" width="600" height="101"></canvas></span>
            <span class="ts-panel__body">
              <span class="ts-panel__label">Lateral</span>
              <span class="ts-panel__name">Direita</span>
            </span>
            <span class="ts-panel__edit" aria-hidden="true">Editar</span>
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
        <span class="tb-sep"></span>
        <!-- "Pintar o implemento" mora AQUI, e não junto da escolha de cor: a cor
             é do cavalo, e estendê-la ao baú é uma decisão sobre o IMPLEMENTO —
             tomada olhando para o painel que vai receber a tinta.
             Ligado, o fundo BRANCO das telas sai (o branco é o baú, e ele
             esconderia a tinta por cima): é assim que o branco passa a refletir
             a cor escolhida para o cavalo. Ver livery.ts→setBackgroundsForPaint()
             e models.ts→setPaintTarget(). -->
        <label class="tb-ctl tb-chk" title="Estende a pintura do cavalo às laterais, à traseira e à frente do baú">
          <input type="checkbox" id="paint-trailer" />
          <span>Pintar o implemento com a cor do cavalo</span>
        </label>
      </div>

      <!-- A tela de desenho fica DENTRO da foto do painel de verdade, e por
           BAIXO dela: as fotos (models/vehicles/panels/*.png) têm o painel
           vazado, então o que se vê pela janela é a arte, e o que fica por cima
           é a estrutura — frisos, dobradiças, a borracha central das portas. É
           isso que faz um texto atravessado pela borracha aparecer cortado aqui
           igual ao que vai acontecer no baú.
           .panel-window existe porque o fabric EMBRULHA o canvas num
           .canvas-container que ele mesmo posiciona: pôr a janela nesse nó
           seria disputar o style dele a cada resize. O wrapper é nosso, ele
           mora dentro.
           2048x344: a janela da lateral tem razão ~5,95 (medida na própria
           foto por vehicle/livery.ts). Com a antiga 4:1 a tela era esticada ao
           virar textura e um círculo desenhado aqui saía oval no caminhão. A
           traseira segue quadrada — a janela dela mede 0,99. -->
      <div class="modal-stage" id="modal-stage">
        <div class="stage-panel" id="stage-left">
          <div class="panel-window"><canvas id="fabric-left" width="2048" height="344"></canvas></div>
        </div>
        <div class="stage-panel hidden" id="stage-right">
          <div class="panel-window"><canvas id="fabric-right" width="2048" height="344"></canvas></div>
        </div>
        <div class="stage-panel hidden" id="stage-rear">
          <div class="panel-window"><canvas id="fabric-rear" width="1024" height="1024"></canvas></div>
        </div>
        <div id="drop-hint">Solte a imagem para adicionar</div>
      </div>
      <div class="modal-foot">Dica: arraste e solte uma imagem em qualquer lugar do painel · a linha tracejada é a silhueta real do painel</div>
    </div>
  </div>

  <input type="file" id="logo-input" accept="image/*" hidden />
`;
