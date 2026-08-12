/* A markup do próprio estúdio.

   O engine constrói e é dono deste DOM (ver core/dom.ts); o React só hospeda o
   container. Manter os ids/classes estáveis é o que permite a cada módulo do
   engine (scene/models/livery/ui) ligar por id sem saber onde o nó mora.

   O overlay do seletor (#ts-selector) e os badges do render (#ts-badge,
   #ts-mapbadge, #ts-colorbadge) NÃO estão aqui de propósito: ui/selector.ts os
   constrói e injeta sozinho, porque a markup deles é orientada a dados (um card
   por entrada do manifesto).

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
    <!-- O RENDER 3D -->
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
             Os ids são os mesmos de quando isto morava na topbar — ui/chrome.ts
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
          <!-- TELA CHEIA. Vizinha de "esconder a interface" porque as duas são a
               mesma classe de comando: não mudam o que o caminhão é, mudam o
               tamanho que a cena ocupa. Juntas elas são o modo apresentação.
               O ícone é de SETAS DIAGONAIS, e não de cantoneiras, de propósito:
               #btn-reset ali ao lado já é quatro cantoneiras com um alvo no meio,
               e dois glifos de canto na mesma régua de 5 botões leriam como o
               mesmo comando duas vezes.
               Os dois caminhos moram no MESMO svg e trocam por CSS na classe
               "on" — um botão que troca de ícone conforme o estado é o mesmo
               botão, e montar/desmontar svg no clique perderia o foco do
               teclado. (Sem crase nenhuma neste arquivo: STUDIO_HTML É um
               template literal, e uma crase de comentário o encerra no meio.)
               ui/chrome.ts ESCONDE este botão inteiro quando o navegador não tem
               a API (iPhone não tem fullscreen de elemento): um controle morto na
               barra é pior do que um controle ausente. -->
          <button id="btn-full" class="ts-vbtn ts-vbtn--full hidden" type="button"
                  title="Tela cheia" aria-label="Entrar em tela cheia" aria-pressed="false">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <g class="ts-ico-in"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></g>
              <g class="ts-ico-out"><path d="M20 10h-6V4M13 11l7-7M4 14h6v6M11 13l-7 7"/></g>
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
          <!-- GRAVAR VÍDEO. Vizinho imediato da câmera porque são a mesma
               pergunta com duas respostas — "levar esta cena embora" como
               imagem parada ou como movimento —, e separá-los faria procurar.
               O ícone é uma CÂMERA DE VÍDEO e não um ponto de gravação: um
               círculo cheio nesta régua leria como o alvo de #btn-reset, e um
               ponto vermelho parado significa "gravando" em toda interface que
               existe — dizer isso com o botão em repouso seria mentir. O estado
               ligado quem mostra é a pílula #ts-rec, que é vermelha de verdade.
               ui/chrome.ts ESCONDE este botão quando o navegador não tem
               MediaRecorder ou captureStream (mesma doutrina de #btn-full). -->
          <button id="btn-rec" class="ts-vbtn hidden" type="button" title="Gravar vídeo"
                  aria-label="Gravar um vídeo da cena" aria-pressed="false">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <rect x="2.8" y="6.6" width="12.4" height="10.8" rx="2"/>
              <path d="M15.2 10.6l4.4-2.7a.7.7 0 0 1 1.1.6v7a.7.7 0 0 1-1.1.6l-4.4-2.7Z"/>
            </svg>
          </button>
          <!-- Ajuste da tinta. Fica na MESMA régua dos outros controles de vista
               porque é a mesma natureza de comando: não muda o que o caminhão é,
               muda como ele é visto. Ícone de pincel para não competir com a
               pastilha de cor do seletor, que é onde se ESCOLHE a tinta —
               aqui ela se afina e se grava. -->
          <button id="btn-paint" class="ts-vbtn" type="button" title="Ajustar a tinta"
                  aria-label="Ajustar e gravar a receita desta tinta">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
                 focusable="false" aria-hidden="true">
              <path d="M4.6 14.4 14 5a2.3 2.3 0 0 1 3.3 0l1.7 1.7a2.3 2.3 0 0 1 0 3.3l-9.4 9.4"/>
              <path d="M4.6 14.4 9.6 19.4"/>
              <path d="M6.6 20.9c-1.5 1-3.9.6-4.4-1.1.9 0 1.5-.5 1.8-1.3.4-1.1 1.6-1.7 2.7-1.3 1.1.4 1.6 1.6 1.2 2.7-.2.5-.6.8-1.3 1Z"/>
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
                  title="Editar o lado do motorista">
            <span class="ts-panel__media"><canvas id="prev-left" width="600" height="101"></canvas></span>
            <span class="ts-panel__body">
              <span class="ts-panel__label">Lateral</span>
              <span class="ts-panel__name">Motorista</span>
            </span>
            <span class="ts-panel__edit" aria-hidden="true">Editar</span>
          </button>
          <button type="button" class="ts-panel preview-card" data-surface="right"
                  title="Editar o lado do passageiro">
            <span class="ts-panel__media"><canvas id="prev-right" width="600" height="101"></canvas></span>
            <span class="ts-panel__body">
              <span class="ts-panel__label">Lateral</span>
              <span class="ts-panel__name">Passageiro</span>
            </span>
            <span class="ts-panel__edit" aria-hidden="true">Editar</span>
          </button>
          <!-- ACABAMENTOS — teto, paralamas, caixa e Thermo King.
               DENTRO de #ts-panels e como PRIMEIRO filho, e as duas coisas são
               decisões:
               · dentro, porque este grupo já se chama "Design do implemento" e
                 é exatamente o que estas quatro peças são. Um segundo grupo
                 flutuante na mesma borda seria um quinto material sobre o
                 render e uma segunda coluna disputando a mesma âncora;
               · primeiro, porque a pilha é ancorada pela BASE e cresce para
                 cima — as duas laterais, que é onde a arte de verdade vai,
                 continuam no mesmo lugar de sempre.
               É DELIBERADAMENTE MAIS DISCRETO que os três cards de plotagem: uma
               tira recolhida com o nome e quatro pontinhos de cor, que só abre
               no clique. Pedido do dono do produto, e ele está certo — plotagem
               é o que se vem fazer aqui; acabamento é um ajuste.
               NÃO tem a classe .preview-card: ui/livery-editor.ts liga um clique
               em TODA .preview-card para abrir o editor de plotagem, e uma
               tira de acabamento com aquela classe abriria o editor de uma
               superfície indefinida. (E nenhuma crase neste arquivo — ver a
               nota do #btn-full: o template é uma string, e uma crase de
               comentário a encerra no meio.)
               As linhas são construídas por ui/trim-panel.ts: elas dependem do
               estado de vehicle/trim.ts e da paleta, nenhum dos dois disponível
               na avaliação deste template. -->
          <div id="ts-trim" class="ts-trim" role="group" aria-label="Acabamentos">
            <button id="ts-trim-toggle" class="ts-trim__head" type="button"
                    aria-expanded="false" aria-controls="ts-trim-body"
                    title="Pintar teto, paralamas, caixa e Thermo King">
              <span class="ts-trim__title">Acabamentos</span>
              <span id="ts-trim-dots" class="ts-trim__dots" aria-hidden="true"></span>
              <span class="ts-trim__chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     focusable="false"><path d="M6 9.5 12 15.5 18 9.5"/></svg>
              </span>
            </button>
            <div id="ts-trim-body" class="ts-trim__body hidden"></div>
          </div>
        </div>

        <!-- O indicador de BOOTSTRAP: o que se vê entre a página abrir e o
             catálogo responder, antes de existir seletor, cortina ou 3D.
             Spinner + linha de texto, e nada mais. Havia aqui uma barra de
             progresso (.load-bar / #load-fill) que ninguém escrevia: este painel
             ganha a classe .hide assim que o catálogo termina, então qualquer
             escrita posterior caía num elemento invisível. O que ela mostrava, na
             prática, era um trilho de 220px parado em zero embaixo de
             "CARREGANDO CATÁLOGO…" — pior do que não ter barra nenhuma, porque
             uma barra parada lê como travado e um spinner lê como trabalhando.
             O progresso de verdade tem dois donos, os dois com barra própria: a
             cortina (ui/loader.ts) e a pílula de troca de veículo. -->
        <div id="loading">
          <div class="spinner"></div>
          <div class="load-text" id="load-text">Carregando modelos…</div>
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
          <!-- Sem id: o rótulo é fixo, ninguém o reescreve, e um id que só
               existe na markup é um contrato que o tsc não confere. -->
          <div class="spinner small"></div><span>Gerando imagem…</span>
        </div>
        <!-- Pílula da GRAVAÇÃO. Terceira da família (#cab-switching, #ts-shot),
             nó próprio pelo mesmo motivo que aqueles dois: dono separado.
             Duas diferenças de propósito em relação às irmãs:
             1. um PONTO que pulsa, e não um spinner. Um spinner diz "espere"; uma
                gravação não é uma espera, é um estado em que o usuário age — ele
                está orbitando o caminhão enquanto isto roda. O ponto vermelho é o
                vocabulário universal disso.
             2. ela é CLICÁVEL: o botão de parar mora aqui, e não na régua de
                view controls. Quem está gravando está olhando o vídeo acontecer,
                e o alvo de "parar" tem de estar onde o olho já está.
             ELA NÃO ENTRA NO VÍDEO. Overlay de DOM nunca é composto no canvas, e
             é por isso que ela também NÃO some com .ts-bare — ao contrário dos
             cards, esconder a interface durante uma gravação não pode esconder a
             única coisa que diz que existe uma gravação. -->
        <div id="ts-rec" class="hidden" role="status" aria-live="polite">
          <span class="ts-recdot" aria-hidden="true"></span>
          <span id="ts-rec-text">Gravando…</span>
          <button id="ts-rec-stop" class="ts-recstop" type="button"
                  aria-label="Parar a gravação">Parar</button>
        </div>
        <div id="view-hint">Arraste para girar · scroll para zoom · botão direito para mover</div>
      </div>
    </section>
  </div>

  <!-- O EDITOR GRANDE DE PLOTAGEM, EM MODAL -->
  <div id="editor-modal" class="hidden">
    <div class="modal-card">
      <header class="modal-head">
        <!-- O ponto nas abas das laterais diz se as duas carregam a MESMA arte.
             Cheio = iguais; vazado = diferentes, e "Espelhar" iguala. É a
             alternativa barata a um vínculo ao vivo entre os lados, que
             obrigaria a decidir quem ganha a cada edição — e as duas laterais
             são legitimamente assimétricas (o Thermo King fica de um lado só, e
             as fitas 3M não devem ser espelhadas: ver CONVENTIONS.md). -->
        <div class="tabs" id="surface-tabs">
          <button class="tab active" data-surface="left">Motorista<i class="sync-dot"></i></button>
          <button class="tab" data-surface="right">Passageiro<i class="sync-dot"></i></button>
          <button class="tab" data-surface="rear">Traseira</button>
        </div>
        <div class="editor-caption" id="editor-caption">Lado do motorista</div>
        <button id="btn-mirror" class="ghost" title="Copiar esta arte para a outra lateral">↔ Espelhar</button>
        <button id="btn-help" class="ghost" title="Atalhos do teclado">?</button>
        <button id="modal-close" class="ghost" title="Fechar (Esc)">✕ Fechar</button>
      </header>

      <!-- Sem formas básicas e sem desenho à mão livre: o que se faz aqui é
           COMPOR — texto, logo e o alinhamento entre eles. Um retângulo e um
           traço de lápis não são pintura de frota, e ocupavam a barra que agora
           é do desfazer. Cor, camada e tudo que é propriedade DE UM OBJETO
           mudou-se para o inspetor à direita, que sabe o que está selecionado. -->
      <div class="modal-toolbar">
        <button class="tool" data-act="text"><span>T</span>Texto</button>
        <button class="tool" data-act="logo"><span>▣</span>Logo</button>
        <button class="tool" data-act="duplicate"><span>⧉</span>Duplicar</button>
        <button class="tool" data-act="delete"><span>🗑</span>Excluir</button>
        <span class="tb-sep"></span>
        <button class="tool" data-act="undo" title="Desfazer (Ctrl+Z)"><span>↶</span>Desfazer</button>
        <button class="tool" data-act="redo" title="Refazer (Ctrl+Shift+Z)"><span>↷</span>Refazer</button>
        <span class="tb-sep"></span>
        <button class="tool" data-act="clear"><span>⌫</span>Limpar</button>
        <span class="tb-sep"></span>
        <label class="tb-ctl"><span>Fundo</span><input type="color" id="bgcolor" value="#ffffff" />
          <button class="mini ghost" id="bg-clear" title="Voltar ao alumínio original">×</button></label>
        <span class="tb-sep"></span>
        <label class="tb-ctl"><span>Zoom</span>
          <select id="stage-zoom" class="select tb-select">
            <option value="fit" selected>Ajustar</option>
            <option value="1.5">150 %</option>
            <option value="2">200 %</option>
            <option value="3">300 %</option>
            <option value="4">400 %</option>
          </select></label>
        <label class="tb-ctl tb-chk-inline" title="Encaixe em bordas, centros e outros objetos (segure Shift para suspender)">
          <input type="checkbox" id="snap-toggle" checked /><span>Guias</span></label>
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
           OS TAMANHOS ABAIXO SÃO SEMENTE, NÃO VERDADE. Quem manda no buffer é
           syncSurfaceAspect() (vehicle/livery.ts), chamada a cada chapa nova:
           ela dimensiona a tela pela GEOMETRIA MEDIDA do painel, com densidade
           constante em px/mm. Estes números só existem para o primeiro quadro,
           antes de haver chapa recortada para medir, e por isso já vêm na razão
           da chapa de fábrica — 2048x389 na lateral (14 655 x 2 777 mm,
           razão 5,2775) e 977x1024 na traseira (2 590 x 2 716 mm, razão 0,9536).
           O par 2048x344 que estava aqui tinha vindo de medir a FOTO
           panels/lateral.png (razão 5,9535), não a chapa, e fazia toda a arte
           sair 12,8 % mais alta que larga no baú. Mexer nestes números sem
           mexer na chapa não muda nada: a próxima medição os sobrescreve. -->
      <div class="modal-body">
        <div class="stage-wrap">
          <canvas class="ruler ruler-h" id="ruler-h"></canvas>
          <canvas class="ruler ruler-v" id="ruler-v"></canvas>
          <span class="ruler-corner">cm</span>
          <div class="modal-stage" id="modal-stage">
            <div class="stage-scroll" id="stage-scroll">
              <!-- Qual ponta é a cabine. addLiveryUV() (vehicle/models.ts) gera
                   u = (z-minZ)/span na SIDE_L e u = (maxZ-z)/span na SIDE_R, e a
                   frente do baú é o +Z — então as DUAS telas correm no sentido
                   contrário uma da outra. É o que faz o mesmo desenho sair
                   legível dos dois lados, e é também por isso que copiar uma
                   lateral na outra sem espelhar a POSIÇÃO joga o logo da cabine
                   lá para as portas. Sem estes rótulos isso parece defeito. -->
              <div class="stage-panel" id="stage-left">
                <span class="edge-label edge-start">◄ TRASEIRA</span>
                <span class="edge-label edge-end">FRENTE ►</span>
                <div class="panel-window"><canvas id="fabric-left" width="2048" height="389"></canvas></div>
              </div>
              <div class="stage-panel hidden" id="stage-right">
                <span class="edge-label edge-start">◄ FRENTE</span>
                <span class="edge-label edge-end">TRASEIRA ►</span>
                <div class="panel-window"><canvas id="fabric-right" width="2048" height="389"></canvas></div>
              </div>
              <div class="stage-panel hidden" id="stage-rear">
                <div class="panel-window"><canvas id="fabric-rear" width="977" height="1024"></canvas></div>
              </div>
            </div>
            <div id="drop-hint">Solte a imagem para adicionar</div>
          </div>
        </div>

        <!-- O inspetor fica SEMPRE montado e só troca quais seções aparecem:
             aparecer/sumir mudaria a largura do palco a cada clique, forçando um
             reenquadramento da tela e fazendo o desenho pular. -->
        <aside id="inspector">
          <section class="panel insp" data-for="none">
            <h3 class="panel-title">Painel</h3>
            <div class="ctl"><span>Tamanho real</span><b id="panel-dims">—</b></div>
            <div class="ctl"><span>Resolução</span><b id="panel-scale">—</b></div>
            <p class="insp-hint">Selecione um objeto no painel para editar suas propriedades.</p>
          </section>

          <section class="panel insp hidden" data-for="text">
            <h3 class="panel-title"><span>Tipografia</span><b class="panel-hint" id="font-current"></b></h3>
            <div class="font-picker">
              <button class="font-trigger" id="font-trigger"><span id="font-trigger-label">Anton</span><i>▾</i></button>
              <div class="font-menu hidden" id="font-menu"></div>
            </div>
            <label class="ctl"><span>Corpo</span>
              <span class="num-unit"><input type="number" id="t-size" class="num" min="1" step="1" /><em>cm</em></span>
            </label>
            <div class="chip-row" id="t-size-presets"></div>
            <div class="ctl"><span>Peso</span>
              <div class="seg tight" id="t-weight">
                <button class="seg-btn on" data-w="400">Regular</button>
                <button class="seg-btn" data-w="700">Bold</button>
              </div>
            </div>
            <div class="ctl"><span>Alinhar</span>
              <div class="seg tight" id="t-align">
                <button class="seg-btn on" data-a="left" title="Esquerda">⯇</button>
                <button class="seg-btn" data-a="center" title="Centro">≡</button>
                <button class="seg-btn" data-a="right" title="Direita">⯈</button>
              </div>
            </div>
            <label class="ctl range"><span>Entre letras <b id="t-tracking-val"></b></span>
              <input type="range" id="t-tracking" min="-100" max="600" value="0" /></label>
            <label class="ctl range"><span>Entrelinha <b id="t-leading-val"></b></span>
              <input type="range" id="t-leading" min="80" max="220" value="116" /></label>
            <label class="ctl"><span>Cor</span><input type="color" id="t-fill" value="#c8102e" /></label>
            <label class="ctl"><span>Contorno</span>
              <span class="row-2"><input type="color" id="t-stroke" value="#ffffff" />
                <span class="num-unit"><input type="number" id="t-stroke-w" class="num sm" min="0" step="0.5" value="0" /><em>cm</em></span>
              </span>
            </label>
          </section>

          <section class="panel insp hidden" data-for="image">
            <h3 class="panel-title"><span>Imagem</span><b class="panel-hint" id="img-name"></b></h3>
            <label class="ctl range"><span>Opacidade <b id="i-opacity-val"></b></span>
              <input type="range" id="i-opacity" min="10" max="100" value="100" /></label>
            <button class="mini ghost" id="i-reset-aspect">Restaurar proporção original</button>
            <div class="dpi-note" id="img-dpi"></div>
          </section>

          <section class="panel insp hidden" data-for="text image multi">
            <h3 class="panel-title">Transformar</h3>
            <div class="grid-2">
              <label class="ctl mini-ctl"><span>X</span><input type="number" id="tf-x" class="num" step="1" /></label>
              <label class="ctl mini-ctl"><span>Y</span><input type="number" id="tf-y" class="num" step="1" /></label>
              <label class="ctl mini-ctl"><span>Larg.</span><input type="number" id="tf-w" class="num" step="1" /></label>
              <label class="ctl mini-ctl"><span>Alt.</span><input type="number" id="tf-h" class="num" step="1" /></label>
            </div>
            <label class="ctl range"><span>Rotação <b id="tf-rot-val"></b></span>
              <input type="range" id="tf-rot" min="-180" max="180" value="0" /></label>
            <div class="chip-row" id="tf-rot-presets">
              <button class="chip" data-deg="0">0°</button>
              <button class="chip" data-deg="90">90°</button>
              <button class="chip" data-deg="180">180°</button>
              <button class="chip" data-deg="270">270°</button>
            </div>
            <div class="btn-row">
              <button class="mini ghost" id="flip-x" title="Espelha o objeto — textos ficam invertidos">⇋ Inverter H</button>
              <button class="mini ghost" id="flip-y">⇅ Inverter V</button>
            </div>
          </section>

          <section class="panel insp hidden" data-for="text image multi">
            <h3 class="panel-title"><span>Alinhar</span><b class="panel-hint" id="align-hint"></b></h3>
            <div class="seg tight hidden" id="align-frame">
              <button class="seg-btn" data-frame="outline">Painel</button>
              <button class="seg-btn on" data-frame="selection">Seleção</button>
            </div>
            <div class="icon-grid" id="align-grid">
              <button class="icon-btn" data-align="left"    title="Alinhar à esquerda">⇤</button>
              <button class="icon-btn" data-align="hcenter" title="Centralizar na horizontal">↔</button>
              <button class="icon-btn" data-align="right"   title="Alinhar à direita">⇥</button>
              <button class="icon-btn" data-align="top"     title="Alinhar ao topo">⇡</button>
              <button class="icon-btn" data-align="vcenter" title="Centralizar na vertical">↕</button>
              <button class="icon-btn" data-align="bottom"  title="Alinhar à base">⇣</button>
            </div>
            <h4 class="sub-title">Distribuir</h4>
            <div class="btn-row">
              <button class="mini ghost" data-dist="x" title="Espaços iguais na horizontal">↔ Horizontal</button>
              <button class="mini ghost" data-dist="y" title="Espaços iguais na vertical">↕ Vertical</button>
            </div>
            <label class="ctl"><span>Espaçamento</span>
              <span class="num-unit"><input type="number" id="gap-val" class="num" min="0" step="1" value="10" /><em>cm</em></span>
            </label>
            <div class="btn-row">
              <button class="mini ghost" data-gap="x">↔ Aplicar</button>
              <button class="mini ghost" data-gap="y">↕ Aplicar</button>
            </div>
          </section>

          <!-- AS MEDIDAS DO IMPLEMENTO, editadas AQUI DENTRO.
               O pedido é literal: "a edição das medidas deve ser direto no
               livery". Não é um segundo formulário ao lado — é a mesma tela em
               que a arte é desenhada, porque medida e arte são a mesma decisão
               vista de dois ângulos: subir a altura do baú move a faixa
               refletiva e o vão da porta por baixo do que já está desenhado, e
               quem desenha precisa ver isso acontecer.
               data-for="always" porque medida não é propriedade de um objeto
               selecionado: ela vale com ou sem seleção.
               O conteúdo é montado por ui/livery-measures.ts — ele depende do
               número de portas cadastradas, que muda em tempo de execução. -->
          <section class="panel insp" data-for="always">
            <h3 class="panel-title"><span>Medidas do implemento</span><b class="panel-hint" id="measures-face"></b></h3>
            <div id="measures-body"></div>
          </section>

          <section class="panel insp" data-for="always">
            <h3 class="panel-title"><span>Camadas</span><b class="panel-hint" id="layer-count"></b></h3>
            <div class="layer-list" id="layer-list"></div>
          </section>
        </aside>
      </div>

      <div class="modal-foot" id="modal-foot">Dica: arraste e solte uma imagem em qualquer lugar do painel · o painel é um retrato do implemento carregado, com as medidas e as portas dele</div>
    </div>

    <div class="popover hidden" id="mirror-pop">
      <h4 id="mirror-pop-title">Espelhar para o lado do passageiro</h4>
      <label class="radio-row"><input type="radio" name="mirror-mode" value="keep" checked />
        <span><b>Manter a leitura</b><em>Textos e logos ficam legíveis dos dois lados, no mesmo ponto do implemento.</em></span></label>
      <label class="radio-row"><input type="radio" name="mirror-mode" value="reflect" />
        <span><b>Reflexo exato</b><em>Como um espelho — textos ficam invertidos.</em></span></label>
      <p class="warn" id="mirror-warn"></p>
      <div class="btn-row end">
        <button class="mini ghost" id="mirror-cancel">Cancelar</button>
        <button class="mini primary" id="mirror-go">Espelhar</button>
      </div>
    </div>

    <div class="popover hidden" id="help-pop">
      <h4>Atalhos</h4>
      <dl class="keys">
        <dt>Ctrl/⌘ Z</dt><dd>Desfazer</dd>
        <dt>Ctrl/⌘ ⇧ Z</dt><dd>Refazer</dd>
        <dt>Ctrl/⌘ D</dt><dd>Duplicar</dd>
        <dt>Ctrl/⌘ A</dt><dd>Selecionar tudo</dd>
        <dt>Ctrl/⌘ C · V</dt><dd>Copiar · colar (entre painéis)</dd>
        <dt>Ctrl/⌘ ] · [</dt><dd>Trazer à frente · enviar para trás</dd>
        <dt>← ↑ → ↓</dt><dd>Mover 1 px · ⇧ move 10 px</dd>
        <dt>Delete</dt><dd>Excluir</dd>
        <dt>T</dt><dd>Novo texto</dd>
        <dt>⇧ (segurar)</dt><dd>Suspende o encaixe nas guias</dd>
        <dt>Esc</dt><dd>Desselecionar · fechar</dd>
      </dl>
    </div>
  </div>

  <input type="file" id="logo-input" accept="image/*" hidden />
`;
