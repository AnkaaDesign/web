/* Livery — composição por CAMADAS.
   ---------------------------------------------------------------------------
   ARQUIVO ESPELHADO — ver nota em `trailer-geometry.ts`.
   Depende só de DOM (canvas) e dos tipos daqui. Nada de three.js, nada de
   framework: o web monta a mesma pilha dentro do editor dele, o desktop monta
   uma pilha curta com uma imagem só.

   POR QUE CAMADAS
   ---------------------------------------------------------------------------
   O painel do baú não é uma arte chapada: é chapa nua, mais faixa refletiva,
   mais perfil metálico, mais o vão da porta, mais a arte do cliente por cima.
   Cada uma dessas coisas vem de uma fonte diferente e muda em momento
   diferente — a faixa e o frame acompanham a MEDIDA, a arte acompanha o
   CLIENTE. Chapar tudo numa imagem só obrigaria a regerar a arte inteira a
   cada centímetro de altura.

   Por isso a pilha é declarativa e posicionada em METROS, não em pixels. Quem
   desenha converte no fim, com a escala corrente. Mudar a medida do implemento
   recompõe sem tocar nas fontes.

   PLACEHOLDERS
   ---------------------------------------------------------------------------
   Os SVGs reais (faixas refletivas, frames metálicos, portas) ainda não
   existem. Até chegarem, `placeholderSvg()` devolve uma forma reconhecível com
   a mesma caixa, para o posicionamento poder ser conferido desde já. Trocar
   por arte real é só mudar a `source` da camada — nenhuma outra linha muda.

   O placeholder só vale alguma coisa se a CAIXA dele for a da peça modelada.
   Uma caixa errada não é um detalhe estético: ela é o que o cliente usa para
   decidir onde a arte dele começa. Por isso as constantes abaixo são MEDIDAS,
   não arredondamentos, e o bloco em `defaultLayers()` diz de onde cada uma
   saiu. Ver também a nota "O QUE A MEDIÇÃO DESMENTIU" ali. */

/** Em que face do baú a pilha está sendo composta. */
export type Face = 'left' | 'right' | 'rear' | 'front';

/**
 * O papel da camada. Define a ORDEM de empilhamento (ver `LAYER_ORDER`) e o
 * placeholder usado enquanto não há arte real.
 */
export type LayerKind =
  /** A chapa nua. Sempre a primeira. */
  | 'base'
  /** Arte do cliente — no desktop é a imagem única que o usuário sobe. */
  | 'art'
  /** Perfil metálico (cantoneira, frame lateral, moldura da porta). */
  | 'frame'
  /** Faixa refletiva. */
  | 'stripe'
  /** Vão de porta e sua ferragem. */
  | 'door'
  /** Qualquer coisa que o usuário acrescente sem semântica definida. */
  | 'custom';

/** Camadas mais altas cobrem as mais baixas. */
const LAYER_ORDER: Record<LayerKind, number> = {
  base: 0, art: 10, stripe: 20, frame: 30, door: 40, custom: 50,
};

export type LiverySource =
  | { kind: 'solid'; color: string }
  | { kind: 'image'; src: string | Blob }
  | { kind: 'svg'; markup: string };

/** Retângulo em METROS no espaço do painel: `x` corre o comprimento, `y` a altura, com origem embaixo à esquerda. */
export interface RectM { x: number; y: number; w: number; h: number }

/**
 * Onde a camada vale.
 *
 * `preview` — só no desenho 2D do editor. É o caso das faixas refletivas, dos
 * frames metálicos e das portas: **essas peças JÁ EXISTEM como geometria no
 * modelo 3D**. Pintá-las também na textura desenharia a mesma faixa duas
 * vezes, uma em relevo e outra chapada, desencontradas assim que a medida
 * mudasse. Elas existem aqui para o cliente ver a montagem do layout, não para
 * alimentar o 3D.
 *
 * `model` — vai também para a textura do baú. É o caso da arte do cliente, que
 * não tem equivalente em geometria.
 */
export type LayerScope = 'preview' | 'model';

export interface LiveryLayer {
  id: string;
  kind: LayerKind;
  source: LiverySource;
  /** Ausente = `preview`. Só o que não existir em geometria deve virar `model`. */
  scope?: LayerScope;
  /** Onde fica. Ausente = ocupa o painel inteiro. */
  rect?: RectM;
  /**
   * Repetição ao longo do comprimento, com passo em METROS.
   *
   * Existe porque a faixa refletiva se REPETE — a medida do modelo é 583,9 mm
   * de passo para a fita 3M lateral. Um baú mais longo leva mais unidades, não
   * as mesmas esticadas; é a mesma doutrina do `RepeatSet` da geometria, aqui
   * no plano da textura.
   *
   * `span` é a largura DESENHADA de uma unidade; ausente = o passo inteiro, e
   * aí a repetição vira uma barra contínua. A fita 3M não é contínua: são
   * segmentos de 300 mm a cada 583,9 mm, ou seja 283,9 mm de chapa nua entre
   * um e outro. Desenhar a barra cheia cobriria essa chapa nua — que é área
   * onde a arte do cliente aparece.
   *
   * `anchor` diz em QUE PONTA a treliça fica presa, e é o que impede o 2D de
   * inventar uma deriva própria. No 3D o baú cresce PARA TRÁS (a dianteira
   * carrega o pino-rei e não anda), então `RepeatSet` prende a casa dianteira e
   * abre as casas novas atrás — a sobra de divisão fica SEMPRE na traseira, e a
   * folga dianteira é exatamente 0. Aqui a mesma regra tem de valer, e ela
   * depende da face: `addLiveryUV()` faz u = (z−minZ)/span na SIDE_L e
   * u = (maxZ−z)/span na SIDE_R, ou seja x=0 é a TRASEIRA num lado e a
   * DIANTEIRA no outro. Prender sempre em x=0 deixaria o lado Motorista com a
   * sobra na frente enquanto o 3D a põe atrás — até um passo inteiro (584 mm)
   * de erro entre o que o editor mostra e o que o baú tem.
   */
  repeat?: {
    pitch: number;
    /** Largura desenhada de uma unidade, em metros. Ausente = `pitch`. */
    span?: number;
    /** Ponta presa: `start` = borda `from`, `end` = borda `to`. Ausente = `start`. */
    anchor?: 'start' | 'end';
    from?: number;
    to?: number;
  };
  opacity?: number;
  visible?: boolean;
}

/** Uma porta, nas mesmas unidades e nomes que o formulário de medidas usa. */
export interface DoorSpec {
  /** Distância da borda esquerda do painel até a borda esquerda da porta, em metros. */
  position: number;
  width: number;
  height: number;
}

/** O painel a compor — vem direto das medidas do implemento. */
export interface PanelSpec {
  face: Face;
  /** Comprimento do painel em metros (na traseira/frente, é a largura do baú). */
  length: number;
  height: number;
  doors: DoorSpec[];
}

/* ------------------------------------------------------------ placeholders */

/**
 * Forma reconhecível com a caixa certa, até a arte real chegar.
 *
 * Não é enfeite: sem algo ocupando a caixa, não dá para conferir se a faixa
 * caiu na altura certa nem se a porta bateu com o vão — e esses são os erros
 * que só aparecem depois, com a arte real, quando fica caro mexer.
 */
export function placeholderSvg(kind: LayerKind, w: number, h: number): string {
  const box = `viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"`;
  switch (kind) {
    case 'stripe':
      /* Faixa refletiva: alternância amarelo/vermelho, como a 3M diagonal. */
      return `<svg ${box}><defs><pattern id="s" width="${h}" height="${h}"
        patternUnits="userSpaceOnUse" patternTransform="skewX(-20)">
        <rect width="${h / 2}" height="${h}" fill="#f2c200"/>
        <rect x="${h / 2}" width="${h / 2}" height="${h}" fill="#c8102e"/>
        </pattern></defs><rect width="${w}" height="${h}" fill="url(#s)"/></svg>`;
    case 'frame':
      return `<svg ${box}><rect width="${w}" height="${h}" fill="#b9c0c7"/>
        <rect width="${w}" height="${Math.max(1, h * 0.18)}" fill="#8d959d"/></svg>`;
    case 'door':
      return `<svg ${box}><rect x="1" y="1" width="${w - 2}" height="${h - 2}"
        fill="none" stroke="#5b6169" stroke-width="2" stroke-dasharray="8 6"/></svg>`;
    default:
      return `<svg ${box}><rect width="${w}" height="${h}" fill="none"
        stroke="#9aa2ab" stroke-width="1"/></svg>`;
  }
}

/* ---------------------------------------------- as medidas do modelo ------
   Tudo aqui saiu do `trailer.glb` por leitura das caixas dos acessores de
   POSITION com as matrizes de nó aplicadas — não de estimativa em cima de
   render. Os valores estão em METROS e no referencial do PAINEL: y = 0 é o
   piso do baú (y 1,391857 no modelo) e y = height é o teto (4,168820), que é
   exatamente o intervalo que `addLiveryUV()` mapeia.

   Se o `trailer.glb` for trocado, estes sete números são o que precisa ser
   remedido — e é por isso que estão nomeados e juntos em vez de espalhados
   como literais dentro de `defaultLayers()`, que foi como o erro dos 318 mm
   conseguiu ficar em duas faixas de alturas diferentes sem ninguém ver. */

/** Altura da fita 3M. Medida: 50,008 mm, nas duas fileiras. */
const FITA_H = 0.050;
/** Comprimento de um segmento de fita. Medido: 299,999 mm. */
const FITA_SEG = 0.300;
/** Passo da fita 3M. Medido: 583,911 mm de média em 23 vãos regulares
 *  (mín. 583,872, máx. 583,920). O comentário antigo dizia 584. */
const FITA_PITCH = 0.5839;
/** Pé da fita INFERIOR, relativo ao piso. NEGATIVO de propósito: a fita mora
 *  na saia, 51,9 mm abaixo do piso, e o compositor a recorta. Ver o bloco
 *  "O QUE A MEDIÇÃO DESMENTIU". */
const FITA_LOW_Y = -0.0519;
/** Quanto o pé da fita SUPERIOR fica abaixo do teto. Medido: 78,084 mm
 *  (o topo dela fica a 28,076 mm do teto). */
const FITA_HIGH_DROP = 0.0781;
/** Altura da cantoneira de topo. Medida: 210,0 mm — o perfil
 *  `metal-galvanizado-mantido` que corre a lateral inteira. Eram 60 mm. */
const CANTONEIRA_H = 0.210;
/** Quanto o pé da cantoneira fica abaixo do teto. Medido: 207,4 mm — ela
 *  ultrapassa o teto em 2,6 mm, que é a dobra sobre a chapa do teto. */
const CANTONEIRA_DROP = 0.2074;

/**
 * A pilha padrão de um painel, montada a partir das MEDIDAS.
 *
 * É esta função que o formulário de medidas chama quando algo muda: as
 * camadas estruturais (faixa, frame, porta) são derivadas da medida, então
 * recompor é recalcular esta lista — a arte do cliente não é tocada.
 *
 * TODAS as camadas daqui são `preview`: faixa refletiva, cantoneira e porta já
 * existem como GEOMETRIA no modelo 3D. Elas servem para o cliente montar e
 * conferir o layout na tela; mandá-las para a textura desenharia a mesma peça
 * duas vezes. Quem vai ao 3D é só a arte, acrescentada por quem chama com
 * `scope: 'model'`.
 *
 * O QUE A MEDIÇÃO DESMENTIU
 * ---------------------------------------------------------------------------
 * O cabeçalho antigo dizia "faixa inferior y 1,322–1,640 (318 mm)" e "faixa
 * superior y 3,841–4,152 (311 mm)", e o código usava 318 mm nas DUAS. Remedido
 * no `trailer.glb` (material `Faixa-3M`, 76 primitivas), nenhum dos dois é
 * altura de faixa: são ENVELOPES. 1,3219 é o pé da fita da TRASEIRA, 1,6400 é o
 * topo do risco VERTICAL de canto da LATERAL, e 4,1519 é o topo da fita da
 * traseira de novo. Mediu-se a caixa do material inteiro e leu-se como se fosse
 * uma faixa — daí os 318 e os 311 saírem de faces diferentes e de peças
 * diferentes. A fita horizontal de verdade tem 50,0 mm, nas duas alturas.
 *
 * O que o GLB tem, com o piso do baú em y 1,391857 e o teto em y 4,168820 (o
 * mesmo datum de `trailer-geometry.ts`, que mede o material branco):
 *
 *   fita 3M inferior (lateral)  y 1,340000–1,390004   h 50,0 mm
 *   fita 3M superior (lateral)  y 4,090736–4,140744   h 50,0 mm
 *   cantoneira de topo          y 3,9614–4,1714       h 210,0 mm
 *   segmento de fita            300,0 mm     passo    583,9 mm
 *
 * Duas consequências que o número sozinho não conta:
 *
 * 1. A FITA INFERIOR NÃO ESTÁ NO PAINEL. O topo dela (1,390004) fica 1,9 mm
 *    ABAIXO do piso (1,391857): ela mora na saia lateral, sob a chapa branca —
 *    é o que `trailer-assembly.ts` já registra ao explicar por que o corte do
 *    piso não pode ser cego. Por isso ela entra aqui com `y` NEGATIVO e o
 *    compositor a recorta: no painel pintável não há faixa embaixo, e desenhar
 *    uma faria o cliente reservar 5 cm de arte para uma peça que não está lá.
 *    O `y` medido fica registrado para quando alguém quiser desenhar a saia.
 * 2. A fita SUPERIOR do modelo são só dois segmentos de canto por lateral, não
 *    uma fileira corrida. Mantemos a fileira no placeholder porque é ela que o
 *    cliente vai fornecer; o que precisa estar exato — e está — é a ALTURA e a
 *    distância até o teto, que é o que desalinha arte.
 */
export function defaultLayers(panel: PanelSpec): LiveryLayer[] {
  const { face, length, height, doors } = panel;
  const layers: LiveryLayer[] = [
    { id: 'base', kind: 'base', source: { kind: 'solid', color: '#ffffff' } },
  ];

  /* A ponta presa, em coordenada de PAINEL. O 3D prende a dianteira; x=0 é a
     traseira na SIDE_L e a dianteira na SIDE_R (ver `anchor` em LiveryLayer). */
  const anchor: 'start' | 'end' = face === 'left' ? 'end' : 'start';

  /* Faixa refletiva. Uma presa ao PISO e outra presa ao TETO — nenhuma das duas
     estica com a altura, porque no 3D elas não esticam: a de baixo é `floor` e
     a de cima anda junto com o teto (`roof`). Ver `TrailerAssembly`. */
  for (const [id, y] of [
    ['stripe-low', FITA_LOW_Y],
    ['stripe-high', height - FITA_HIGH_DROP],
  ] as const) {
    layers.push({
      id, kind: 'stripe',
      source: { kind: 'svg', markup: '' },   // preenchido no render pelo placeholder
      rect: { x: 0, y, w: length, h: FITA_H },
      repeat: { pitch: FITA_PITCH, span: FITA_SEG, anchor },
    });
  }

  /* Cantoneira de topo — o perfil galvanizado que corre o painel lateral
     inteiro. Presa ao TETO, como no 3D. */
  layers.push({
    id: 'frame-top', kind: 'frame',
    source: { kind: 'svg', markup: '' },
    rect: { x: 0, y: height - CANTONEIRA_DROP, w: length, h: CANTONEIRA_H },
  });

  for (const [i, d] of doors.entries()) {
    layers.push({
      id: `door-${i}`, kind: 'door',
      source: { kind: 'svg', markup: '' },
      rect: { x: d.position, y: 0, w: d.width, h: d.height },
    });
  }

  return layers;
}

/* -------------------------------------------------------------- compositor */

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, err) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = err;
  img.src = src;
});

const svgToUrl = (markup: string) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);

/**
 * Desenha a pilha num canvas, que é a textura do painel.
 *
 * A conversão metro→pixel acontece só aqui. É o que permite trocar a resolução
 * do canvas sem mexer em nenhuma camada, e é o que faz a mesma pilha servir
 * para a miniatura da UI e para o render em alta.
 */
export class LiveryComposer {
  private layers: LiveryLayer[] = [];
  private panel: PanelSpec = { face: 'left', length: 14.7, height: 2.78, doors: [] };

  constructor(readonly canvas: HTMLCanvasElement) {}

  setPanel(panel: PanelSpec) {
    this.panel = panel;
    return this;
  }

  setLayers(layers: LiveryLayer[]) {
    this.layers = layers;
    return this;
  }

  /** Acrescenta ou substitui uma camada pelo `id`. */
  upsert(layer: LiveryLayer) {
    const i = this.layers.findIndex((l) => l.id === layer.id);
    if (i >= 0) this.layers[i] = layer; else this.layers.push(layer);
    return this;
  }

  remove(id: string) {
    this.layers = this.layers.filter((l) => l.id !== id);
    return this;
  }

  get all(): readonly LiveryLayer[] { return this.layers; }

  /** Reajusta o canvas à proporção do painel. */
  resize(pixelsPerMeter = 256) {
    this.canvas.width = Math.max(1, Math.round(this.panel.length * pixelsPerMeter));
    this.canvas.height = Math.max(1, Math.round(this.panel.height * pixelsPerMeter));
    return this;
  }

  /**
   * Desenha a pilha.
   *
   * `scope` decide o QUE entra, e é o que separa as duas saídas do mesmo
   * estado: `'preview'` compõe tudo, para o editor; `'model'` compõe só o que
   * não existe em geometria, para virar textura do baú. Sem essa separação a
   * faixa refletiva apareceria duas vezes no 3D — uma em relevo, do modelo, e
   * outra chapada, da textura.
   */
  async render(opts: { scope?: LayerScope } = {}) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const wanted = opts.scope ?? 'preview';
    const { length, height } = this.panel;
    const px = this.canvas.width / length;
    const py = this.canvas.height / height;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const ordered = [...this.layers]
      .filter((l) => l.visible !== false)
      /* No 3D só entra o que NÃO existe em geometria. A chapa nua entra sempre:
         é o fundo branco sobre o qual a arte é aplicada. */
      .filter((l) => wanted === 'preview' || l.kind === 'base' || (l.scope ?? 'preview') === 'model')
      .sort((a, b) => LAYER_ORDER[a.kind] - LAYER_ORDER[b.kind]);

    for (const layer of ordered) {
      const r = layer.rect ?? { x: 0, y: 0, w: length, h: height };
      /* Y do painel cresce para CIMA; o canvas cresce para baixo. */
      const x0 = r.x * px;
      const y0 = this.canvas.height - (r.y + r.h) * py;
      const w = r.w * px;
      const h = r.h * py;

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.source.kind === 'solid') {
        ctx.fillStyle = layer.source.color;
        ctx.fillRect(x0, y0, w, h);
      } else {
        /* Fonte vazia + tipo semântico = ainda não há arte real: usa o
           placeholder com a MESMA caixa, para o posicionamento já poder ser
           conferido. */
        let url: string;
        if (layer.source.kind === 'svg') {
          const markup = layer.source.markup
            || placeholderSvg(layer.kind, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
          url = svgToUrl(markup);
        } else {
          url = typeof layer.source.src === 'string'
            ? layer.source.src
            : URL.createObjectURL(layer.source.src);
        }

        try {
          const img = await loadImage(url);
          if (layer.repeat) {
            const step = layer.repeat.pitch * px;
            const from = (layer.repeat.from ?? r.x) * px;
            const to = (layer.repeat.to ?? r.x + r.w) * px;
            /* A unidade DESENHADA, que não é o passo: entre um segmento de fita
               e o próximo há chapa nua, e ela tem de continuar aparecendo. */
            const unit = Math.max(1e-6, Math.min((layer.repeat.span ?? layer.repeat.pitch) * px, to - from));
            /* Só casas INTEIRAS. A sobra da divisão vira vão, nunca um segmento
               cortado ao meio — a fábrica não corta fita, e o `RepeatSet` do 3D
               também não: lá a sobra aparece como um vão maior numa ponta (na
               medida de fábrica, 850 mm na traseira contra 583,9 do passo). */
            const slots = Math.max(1, Math.floor((to - from - unit) / step + 1e-9) + 1);
            /* `end` prende a ÚLTIMA casa na borda `to` e joga a sobra para o
               início; `start` faz o contrário. É isto que casa o 2D com a
               âncora dianteira do 3D nas duas laterais. */
            const first = layer.repeat.anchor === 'end'
              ? to - unit - (slots - 1) * step
              : from;
            for (let i = 0; i < slots; i++) {
              const x = first + i * step;
              const cut = Math.min(unit, to - x);
              if (cut <= 0) continue;
              ctx.drawImage(img, 0, 0, img.width * (cut / unit), img.height, x, y0, cut, h);
            }
          } else {
            ctx.drawImage(img, x0, y0, w, h);
          }
        } catch {
          /* Arte que não carrega não pode derrubar a composição inteira: as
             outras camadas ainda valem, e o buraco é visível. */
        }
        if (layer.source.kind === 'image' && typeof layer.source.src !== 'string') {
          URL.revokeObjectURL(url);
        }
      }
      ctx.restore();
    }
  }
}
