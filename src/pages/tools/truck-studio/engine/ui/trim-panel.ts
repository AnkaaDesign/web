/* O card de CONFIGURAÇÕES — cores de peça, o que entra no produto, o que fica
   em cena.
   ---------------------------------------------------------------------------
   Chamava-se ACABAMENTOS e mudou de nome em 2026-08-13 junto com o que ele faz.
   O nome antigo descrevia bem uma tira que só pintava quatro peças; hoje ele
   carrega duas decisões de naturezas diferentes, e só uma delas é acabamento:

     CORES         paralamas, com seletor de cor
     VISTA         o conjunto, só o cavalo ou só o implemento

   E ELE ENCOLHEU DE NOVO em 2026-08-13: TETO e THERMO KING saíram para os
   liveries — o teto virou uma FACE (aba Teto) e o Thermo King uma CAMADA da
   testeira. Ver `CARD_PAINT_KEYS` abaixo para o porquê de o paralama ficar.

   E UMA TERCEIRA FOI TIRADA no mesmo dia: os checkboxes que punham e tiravam o
   Thermo King e a caixa de cozinha do produto ("remova a opção itens do
   implemento… não são necessários mais"). A CAPACIDADE continua em
   `vehicle/trim.ts` — `hideable`, `hideRoot` e o laço de visibilidade de
   `applyTrim()` estão intactos, e `TRIM_HIDE_KEYS` ainda a exporta —, porque o
   que saiu foi a pergunta e não a resposta: as duas peças ficam no produto, que
   é o estado padrão delas, e devolver o controle é uma seção de doze linhas.

   A interface de `vehicle/trim.ts` e de `models.setVehicleView()`, e nada além
   disso: quais malhas são quais, quem segue a cor do baú e como uma peça volta
   ao original mora lá. Aqui só há DOM.

   ---------------------------------------------------------------------------
   O SELETOR DE COR É UM SELETOR DE COR

   Havia aqui uma grade com a paleta do catálogo — as mesmas tintas do passo de
   cor do cavalo —, e ela saiu a pedido, com o motivo dito em uma linha: *"deve
   ter color picker o thermo king, paralamas e teto, não ser como está hoje que
   tem umas cores pré-definidas, que está horrível por sinal"*.

   E o pedido tem razão de ofício por trás. A paleta do catálogo é a lista de
   tintas de CABINE de cada montadora — é ela que faz sentido no passo em que se
   escolhe a cor do caminhão, porque ali a resposta certa é uma cor que a
   montadora produz. Um teto de baú, um paralama e a carcaça de um Thermo King
   não são pintados com tinta de montadora: são pintados com o que o cliente
   pedir, e frequentemente com a cor da frota dele, que não está em lista nenhuma.
   Oferecer 26 pastilhas de outra montadora para responder a essa pergunta é
   estreitar a resposta e ainda assim não acertá-la.

   Então cada peça tem `<input type="color">` — o seletor NATIVO, com espectro,
   conta-gotas e histórico do sistema — mais um campo de HEX, que é como uma cor
   de frota chega por escrito ("#c8102e", do manual da marca). Os dois escrevem
   no mesmo estado e se releem.

   ARRASTAR NÃO PODE CUSTAR UM setPaintTarget(). O seletor nativo emite `input` a
   cada pixel percorrido, e o caminho normal (`setTrim`) varre as ~2 150 malhas
   do implemento a cada evento. Por isso o arrasto passa por
   `setTrimColorLive()`, que só reescreve o uniforme da demão, e o COMMIT — o que
   grava a escolha e avisa os ouvintes — acontece no `change`. Ver a nota lá.

   ---------------------------------------------------------------------------
   ESTADO É DO MOTOR, NÃO DAQUI

   Mesma regra do painel de tinta: lê com `getTrim()`/`getVehicleView()` e
   escreve com `setTrim()`/`setVehicleView()`, e repinta a partir do que o motor
   devolveu. Nenhuma cópia local — é assim que uma segunda superfície começa a
   discordar da primeira. `setVehicleView()` inclusive devolve o modo EFETIVO,
   que pode não ser o pedido (esconder o cavalo sem implemento carregado deixaria
   a tela vazia), e é o retorno que redesenha o controle. */
import { $, $opt, el } from '../core/dom';
import {
  TRIM_PAINT_KEYS, getTrim, setTrim, setTrimColorLive,
  trimLabel, trimFollowsBody,
} from '../vehicle/trim';
import type { TrimKey } from '../vehicle/trim';
import {
  state, getVehicleView, setVehicleView, onPaintTargetApplied, type VehicleView,
} from '../vehicle/models';
import { setStatus } from './chrome';
import { buildQualitySection } from './hud';

/* ---------------- AS PEÇAS QUE AINDA MORAM AQUI ----------------
   Pedido de 2026-08-13, literal: *"em vez de ter a configuração de teto e
   thermo king na parte de configurações, devem estar em liveries"*. E o pedido
   tem razão de ofício: as duas peças que saíram são superfícies que se OLHA, e
   quem escolhe a cor delas está olhando para o painel em que elas aparecem.

     TETO         virou uma FACE de livery (aba Teto). A cor dele é o Fundo
                  daquela face — a mesma pergunta, respondida no mesmo lugar em
                  que se decide o que vai desenhado por cima dela.
     THERMO KING  virou uma CAMADA do livery da testeira, ao lado do Fundo. Ele
                  é montado naquela parede e não aparece em nenhuma outra face.
     PARALAMAS    fica. Ele não é uma superfície plotável — não tem face, não
                  tem `uv1`, não tem editor — e uma cor de peça sem painel onde
                  aparecer não tem para onde ir a não ser um card de
                  configuração. Esta é a única razão de este bloco ainda existir.

   A CAPACIDADE DAS DUAS CONTINUA EM `vehicle/trim.ts`, intacta e ainda
   `paintable: true` — é ela que o editor de livery chama. O que sai é a
   PERGUNTA daqui, não a resposta: `TRIM_PAINT_KEYS` continua listando as três,
   porque ele descreve o MOTOR, e este card passou a filtrar o que mostra. Uma
   lista própria e não um `paintable: false` porque desligar a capacidade
   quebraria a camada nova. */
const CARD_PAINT_KEYS: TrimKey[] = TRIM_PAINT_KEYS.filter((k) => k === 'fenders');

/** Um hex de 6 dígitos, com ou sem `#`. O que o campo de texto aceita. */
const HEX_RE = /^#?([0-9a-f]{6})$/i;
const normalizeHex = (raw: string): string | null => {
  const m = HEX_RE.exec((raw || '').trim());
  return m ? '#' + m[1].toLowerCase() : null;
};

/**
 * O hex que o `<input type="color">` mostra quando a peça NÃO tem cor própria.
 *
 * Um input de cor não tem estado vazio — ele sempre mostra alguma cor, e se
 * ninguém disser qual, mostra preto. Preto lê como "esta peça é preta", que é
 * justamente a informação errada. Branco é a verdade aproximada nas três peças
 * que pintam: o teto e o Thermo King saem brancos de fábrica e o paralama é a
 * peça mais clara do conjunto. E a linha diz por escrito qual é o estado real,
 * ao lado — ver `emptyLabel()`.
 */
const NEUTRAL = '#ffffff';

/** O que a ausência de cor significa, em palavras — e são duas frases porque são
 *  dois comportamentos. Teto e Thermo King JÁ eram pintados junto com o baú;
 *  paralamas nunca foi. Dizer "Original" para o teto seria mentir. */
const emptyLabel = (key: TrimKey) => (trimFollowsBody(key) ? 'Como o baú' : 'Original');

/* ---------------- peças ---------------- */

/** Uma pastilha de cor. Vazia (sem cor própria) é um quadriculado, não um vazio:
 *  um quadrado transparente sobre vidro escuro lê como "preto", que é uma cor. */
function swatch(hex: string | null, cls = ''): HTMLElement {
  const s = el('span', 'ts-cfg__sw' + (hex ? '' : ' is-empty') + (cls ? ' ' + cls : ''));
  if (hex) s.style.background = hex;
  return s;
}

/** As pastilhas da linha recolhida — só das peças que pintam. */
function paintDots() {
  const dots = $('ts-cfg-dots');
  dots.textContent = '';
  const trim = getTrim();
  for (const key of CARD_PAINT_KEYS) {
    dots.appendChild(swatch(trim[key].color, 'ts-cfg__sw--dot'));
  }
}

/* ---------------- A LINHA "COR DO CAVALO" ----------------
   Pedido de 2026-08-16: *"o paralamas está faltando ter a opção de pintar da cor
   do cavalo também, como todos os outros itens"*. E a metade do motor já foi
   feita — `SPECS.fenders.followsBody` virou `true` em `vehicle/trim.ts`. O que
   falta é a PERGUNTA, e ela tem de estar aqui porque é aqui que o para-lama
   mora: as outras duas peças que seguem o corpo (o Fundo da chapa e o Thermo
   King) fazem a mesma pergunta no inspetor do editor de plotagem, cada uma ao
   lado da face em que aparece.

   ⚠️⚠️ ELA NÃO IMPLEMENTA NADA, E NÃO PODE IMPLEMENTAR. A decisão é UMA só — a
   tinta do cavalo vale para o implemento INTEIRO — e ela já tem dono:
   `bindTrailerPaint()` em `vehicle/livery.ts`, que troca o material do 3D,
   repinta a chapa das quatro telas e escreve a linha de estado. Esta linha
   escreve no `#paint-trailer` e despacha o `change` dele, exatamente como a
   linha do Thermo King faz — é a mesma técnica, pelo mesmo motivo, e é o que
   torna impossível dois controles discordarem.

   ⚠️ E ELA SOME NUMA EDIÇÃO ESPECIAL. `setSpecialEdition()` (vehicle/livery.ts)
   esconde as outras duas por id; esta entra na mesma lista com o id
   `ts-cfg-row-cab`. Deixá-la de pé ofereceria a tinta de um caminhão que não tem
   tinta.

   O ESTADO DELA É LIDO DO CHECKBOX DE LÁ, nunca de uma cópia: `paint()` roda
   também no `onPaintTargetApplied()`, então ligar a caixa no editor de plotagem
   marca esta, e vice-versa. */
function cabPaintRow(): HTMLElement | null {
  const master = $opt<HTMLInputElement>('paint-trailer');
  if (!master) return null;

  const row = el('label', 'ts-cfg__row ts-cfg__row--check');
  row.id = 'ts-cfg-row-cab';
  row.title = 'Estende a pintura do cavalo ao implemento inteiro — inclusive aos'
    + ' para-lamas. As peças com cor própria continuam com ela.';
  /* A edição especial esconde a linha ORIGEM; esta acompanha o estado dela em
     vez de consultar o catálogo por conta própria. */
  const masterRow = master.closest('label');
  if (masterRow?.classList.contains('hidden')) row.classList.add('hidden');

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.className = 'ts-cfg__check';
  box.id = 'ts-cfg-paint-cab';
  box.checked = master.checked;
  row.appendChild(box);

  /* A pastilha lê `--ts-cabpaint`, a mesma custom property que a linha do editor
     usa — escrita por `livery.ts` a cada tinta nova. Uma segunda leitura do
     catálogo daqui seria uma segunda fonte para a mesma cor. */
  const chip = el('span', 'ts-cfg__chip ts-cfg__chip--flat');
  chip.appendChild(el('span', 'ts-cfg__sw ts-cfg__sw--cab'));
  row.appendChild(chip);

  row.appendChild(el('span', 'ts-cfg__name', 'Cor do cavalo'));
  row.appendChild(el('span', 'ts-cfg__val', 'todo o implemento'));

  /* `change` e não `click`: o `<label>` já alterna a caixa antes de o evento
     chegar, e reagir ao clique alternaria duas vezes. */
  box.addEventListener('change', () => {
    master.checked = box.checked;
    master.dispatchEvent(new Event('change'));
  });
  return row;
}

/** Espelha o estado da linha ORIGEM sem trocar nó nenhum — ver a nota do
 *  `onPaintTargetApplied()` em `initTrimPanel()`. */
function syncCabRow() {
  const master = $opt<HTMLInputElement>('paint-trailer');
  const box = $opt<HTMLInputElement>('ts-cfg-paint-cab');
  if (!master || !box) return;
  if (box.checked !== master.checked) box.checked = master.checked;
  const row = $opt('ts-cfg-row-cab');
  const masterRow = master.closest('label');
  if (row && masterRow) {
    row.classList.toggle('hidden', masterRow.classList.contains('hidden'));
  }
}

/**
 * A linha de COR de uma peça: pastilha-seletor, nome, estado e o botão de voltar.
 *
 * O `<input type="color">` fica POR CIMA da pastilha, transparente e do tamanho
 * dela — em vez de um input nativo desenhado pelo sistema ao lado de uma
 * pastilha nossa. Dois motivos, e o segundo é o que decide: a caixa nativa não
 * aceita `border-radius` de forma consistente entre navegadores (o Chrome
 * desenha a própria moldura interna), e um clique na pastilha é o gesto que já
 * existe no resto do estúdio. Assim o alvo é o que se vê.
 */
function colorRow(key: TrimKey): HTMLElement {
  const trim = getTrim()[key];
  const hex = trim.color;

  const row = el('div', 'ts-cfg__row');

  /* --- a pastilha, que É o seletor --- */
  const chip = el('span', 'ts-cfg__chip');
  chip.appendChild(swatch(hex));
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'ts-cfg__picker';
  picker.id = `ts-cfg-pick-${key}`;
  picker.value = hex || NEUTRAL;
  picker.title = `Escolher a cor · ${trimLabel(key)}`;
  picker.setAttribute('aria-label', `Cor do ${trimLabel(key).toLowerCase()}`);
  chip.appendChild(picker);
  row.appendChild(chip);

  row.appendChild(el('span', 'ts-cfg__name', trimLabel(key)));

  /* O ESTADO EM PALAVRAS — "Como o baú" / "Original" / o nome da escolha.
     O HEX POR ESCRITO SAIU, a pedido ("os color pickers não devem mostrar o hex
     da cor, não é necessário"), e o que fica no lugar não é um valor: é a
     resposta à pergunta que a linha faz. Sem cor própria ela diz o que a peça
     está seguindo, que é a informação que um hex nunca deu; com cor própria diz
     só "Personalizada", porque quem escolheu a cor está olhando para ela na
     pastilha ao lado e o código dela não muda decisão nenhuma aqui. */
  row.appendChild(el('span', 'ts-cfg__val', hex ? 'Personalizada' : emptyLabel(key)));

  /* --- voltar ao estado de fábrica --- */
  const reset = el('button', 'ts-cfg__reset');
  reset.type = 'button';
  reset.id = `ts-cfg-reset-${key}`;
  reset.textContent = '×';
  reset.title = `Voltar para "${emptyLabel(key)}"`;
  reset.setAttribute('aria-label', reset.title);
  reset.disabled = !hex;
  row.appendChild(reset);

  /* ---- comportamento ----
     `input` é o ARRASTO: caminho barato, sem gravar (ver setTrimColorLive).
     `change` é a ESCOLHA: passa por setTrim(), que reaplica o alvo da tinta e
     avisa quem grava. Quando a peça ainda não tinha cor, o primeiro `input` já
     tem de passar pelo caminho caro — não existe demão para atualizar. */
  const live = (value: string) => {
    const v = normalizeHex(value);
    if (!v) return;
    if (!setTrimColorLive(key, v)) setTrim(key, { color: v });
    const sw = chip.firstElementChild as HTMLElement;
    sw.style.background = v;
    sw.classList.remove('is-empty');
    reset.disabled = false;
  };
  const commit = (value: string | null) => {
    setTrim(key, { color: value });
    paint();
    setStatus(value
      ? `${trimLabel(key)} · ${value}`
      : `${trimLabel(key)} · ${emptyLabel(key).toLowerCase()}`);
  };

  picker.addEventListener('input', () => live(picker.value));
  picker.addEventListener('change', () => commit(normalizeHex(picker.value)));
  reset.addEventListener('click', () => commit(null));

  return row;
}

/* ---------------- vista ---------------- */

const VIEWS: { id: VehicleView; label: string; title: string }[] = [
  { id: 'both', label: 'Conjunto', title: 'Cavalo e implemento' },
  { id: 'cab', label: 'Cavalo', title: 'Só o cavalo mecânico' },
  { id: 'trailer', label: 'Implemento', title: 'Só o implemento, sem o cavalo' },
];

/**
 * O que fica em cena, num controle segmentado de três posições.
 *
 * TRÊS POSIÇÕES E NÃO DOIS CHECKBOXES, e a diferença não é estética: dois
 * checkboxes independentes têm um quarto estado — ambos desmarcados — que é uma
 * tela vazia. Já existiu assim na topbar antiga e foi removido junto com ela.
 * Um segmentado não consegue produzir esse estado.
 *
 * A opção sem geometria fica DESABILITADA em vez de sumir: um estúdio sem
 * implemento carregado que escondesse "Implemento" do controle faria o usuário
 * procurar o botão em vez de entender que não há o que mostrar.
 */
function viewControl(): HTMLElement {
  const wrap = el('div', 'ts-cfg__seg');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'O que aparece em cena');
  const now = getVehicleView();
  for (const v of VIEWS) {
    const btn = el('button', 'ts-cfg__segbtn' + (v.id === now ? ' is-on' : ''));
    btn.type = 'button';
    btn.id = `ts-cfg-view-${v.id}`;
    btn.textContent = v.label;
    btn.title = v.title;
    btn.setAttribute('aria-pressed', v.id === now ? 'true' : 'false');
    btn.disabled = (v.id === 'cab' && !state.cab) || (v.id === 'trailer' && !state.trailer);
    btn.addEventListener('click', () => {
      /* `setVehicleView()` reenquadra E reancora a órbita na metade que ficou —
         ver `frameVisible()` lá. Não é o card que decide isso: com "só o
         implemento", o centro do giro tem de sair do engate e ir para o baú, e
         quem sabe disso é quem escondeu o cavalo. */
      const got = setVehicleView(v.id);
      paint();
      const chosen = VIEWS.find((x) => x.id === got);
      setStatus(`Em cena · ${chosen ? chosen.label.toLowerCase() : 'conjunto'}`);
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

/* ---------------- montagem ---------------- */

/** Um bloco do card: título curto e conteúdo. Seções SEPARADAS e não uma lista
 *  corrida — as duas respondem perguntas de naturezas diferentes, e sem a
 *  divisão o olho lê "esconder o cavalo" como se fosse mais uma peça pintável
 *  do implemento. */
function section(title: string, ...content: HTMLElement[]): HTMLElement {
  const s = el('section', 'ts-cfg__sec');
  s.appendChild(el('h4', 'ts-cfg__sectitle', title));
  for (const c of content) s.appendChild(c);
  return s;
}

/** Repinta o card inteiro a partir do motor. */
function paint() {
  paintDots();
  const body = $('ts-cfg-body');
  /* O foco morre com o nó que o carrega, e este laço troca todos. Guardado e
     devolvido pelo id: sem isto, escolher uma cor pelo teclado ou clicar em
     "Implemento" mandaria o foco para o começo do documento, e a próxima
     tabulação recomeçaria da barra do navegador. Por isso cada controle deste
     card tem id — eles existem para este laço, não para o CSS. */
  const focused = (document.activeElement as HTMLElement | null)?.id || '';
  body.textContent = '';

  const colors = el('div', 'ts-cfg__list');
  /* A "Cor do cavalo" VEM PRIMEIRO porque ela qualifica a linha de baixo: um
     controle que muda o significado do que vem depois tem de vir antes. É a
     mesma ordem do stack do Fundo no editor de plotagem, e a mesma regra que o
     "Fundo" usa no menu da câmera. */
  const cab = cabPaintRow();
  if (cab) colors.appendChild(cab);
  for (const key of CARD_PAINT_KEYS) colors.appendChild(colorRow(key));
  body.appendChild(section('Cores', colors));

  body.appendChild(section('Em cena', viewControl()));

  /* ---------------- QUALIDADE ----------------
     AQUI E NÃO NO PAINEL DE LUZ, por pedido do dono do produto: *"a seleção de
     qualidade deveria estar onde já tem configurações, onde está a seleção de
     somente implemento, somente cavalo"*.

     A razão de fundo é a mesma que já tirou a fileira do painel de iluminação —
     luz é decisão AUTORAL, qualidade é decisão de MÁQUINA —, mas levada até o
     fim: este card já É o painel de configurações do estúdio. "Em cena" e as
     cores dos cards também não são luz. Criar uma segunda casa de configurações
     dentro do vidro da luz era inventar um terceiro endereço para o que já
     tinha um.

     As fileiras vêm de `ui/hud.ts` porque é lá que moram os componentes e o
     estado que `onQualityChange`/`onScaleChange` repintam — mudar de endereço
     não é motivo para duplicar isso. E o bloco de diagnóstico só existe em
     desenvolvimento; ver a nota de `buildQualitySection()`. */
  const q = el('div', 'ts-cfg__quality');
  q.appendChild(buildQualitySection());
  body.appendChild(section('Qualidade', q));

  if (focused) $opt(focused)?.focus();
}

export function initTrimPanel() {
  const card = $('ts-cfg');
  const toggle = $<HTMLButtonElement>('ts-cfg-toggle');
  const body = $('ts-cfg-body');

  /* Mesma guarda que ui/hud.ts, os badges e os view controls já aplicam: o
     OrbitControls está ligado ao canvas, que é IRMÃO deste card dentro do
     holder. Hoje um clique aqui não tem caminho de bolha até lá; isto é a
     guarda para o dia em que tiver, senão escolher uma cor arrastaria a câmera
     por baixo do card. */
  const swallow = (e: Event) => e.stopPropagation();
  card.addEventListener('pointerdown', swallow);
  card.addEventListener('pointerup', swallow);
  card.addEventListener('wheel', swallow, { passive: true });

  /* ⚠️ SINCRONIZA, NÃO REPINTA — e a diferença é um defeito evitado, não uma
     economia. `setTrim()` passa por `setPaintTarget()` (ver a nota lá), que
     dispara este gancho; e `setTrim()` é chamado no PRIMEIRO `input` do seletor
     de cor, ou seja NO MEIO DO ARRASTO. Um `paint()` aqui destruiria o
     `<input type="color">` que está com o diálogo nativo aberto debaixo do dedo.
     `syncCabRow()` só reescreve o que mudou e não troca nó nenhum.

     O gancho é o do MOTOR e não um segundo `change` no `#paint-trailer`: dois
     ouvintes no mesmo elemento dependeriam da ordem de registro para ler o
     estado JÁ aplicado, e essa ordem é a do boot. */
  onPaintTargetApplied(syncCabRow);

  toggle.addEventListener('click', () => {
    const closed = body.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', closed ? 'false' : 'true');
    card.classList.toggle('is-open', !closed);
  });

  paint();
}

/**
 * Repinta de fora.
 *
 * Dois chamadores, e os dois mudam o que o card deve mostrar sem passar por
 * nenhum controle dele: o boot (quando o implemento e o cavalo terminam de
 * carregar, e com eles as opções de "Em cena" que estavam desabilitadas) e a
 * troca de veículo. `studio.ts` avisa.
 */
export const refreshTrimPanel = () => paint();
