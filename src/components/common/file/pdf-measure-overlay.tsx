import * as React from "react";

import { cn } from "@/lib/utils";
import {
  DIM_COLOR,
  STYLE_CM,
  SnapIndex,
  measureBetween,
  type Dimension,
  type Measurement,
  type PageGeometry,
  type Pt,
  type Rect,
  type Scale,
  type SnapTarget,
} from "@/lib/layout-dimensions";

/** Uma cota do plano, com a face de onde ela veio. */
export interface PlannedDimensionEntry {
  dimension: Dimension;
  /**
   * A ponte pt ↔ cm da face a que a cota pertence.
   *
   * Só isto. A face inteira já viajou por aqui como `Panel`, e nunca foi lida:
   * a cota chega da API em centímetro da FACE, e para pôr o número na tela
   * basta a origem do retângulo e a razão de conversão.
   */
  scale: Scale;
}

/** Uma medida já confirmada pelo operador. */
export interface CommittedMeasurement extends Measurement {
  id: string;
}

export interface PdfMeasureOverlayProps {
  geometry: PageGeometry;
  /** escala de renderização do canvas (pt da página → px de tela) */
  zoom: number;
  /** pontos por centímetro real do implemento, lidos da PÁGINA (1:10 e afins) */
  ptPerCm: number;
  /**
   * Escala de cada face reconhecida.
   *
   * Quando existe, ela manda: a escala da página é a que o desenho declara, a
   * da face é a que as medidas do caminhão impõem. Divergindo as duas, a régua
   * e a cota automática davam números diferentes para a mesma distância — e a
   * que vale para quem cola é a da face.
   */
  faceScales?: Scale[];
  measurements: CommittedMeasurement[];
  onCommit: (measurement: CommittedMeasurement) => void;
  /**
   * Cotagem automática. Cada cota carrega a face a que pertence, porque um
   * arquivo traz as duas laterais e cada uma tem a sua própria escala e origem.
   */
  plan?: PlannedDimensionEntry[] | null;
  /** Adesivos clicáveis, em pt da página, para filtrar as cotas de um item só. */
  selectable?: { index: number; bbox: Rect; drawBox?: Rect; outline?: Pt[][] }[];
  selectedIndex?: number | null;
  onSelect?: (index: number | null) => void;
  /** `select` deixa o clique escolher o adesivo; `measure` liga a régua. */
  mode?: "measure" | "select";
  className?: string;
}

/**
 * A cota sai no azul da casa — o mesmo `#3374A9` que o CorelDRAW já usa nos
 * layouts. O aplicador lê essa cor há anos; não há motivo para inventar outra.
 */
export const DIMENSION_COLOR = `rgb(${Math.round(DIM_COLOR.r * 255)} ${Math.round(DIM_COLOR.g * 255)} ${Math.round(DIM_COLOR.b * 255)})`;
const COLOR = DIMENSION_COLOR;
const SNAP_COLOR = "#16A34A";
const SELECTED_FILL = "rgb(51 116 169 / 0.08)";
const SELECTED_FILL_OPACITY = 0.08;
const SNAP_RADIUS_PX = 22;

/**
 * LABELS_ARE_UPRIGHT — o número de uma cota vertical NÃO gira.
 *
 * O desenho do projetista gira o texto (é a convenção do CorelDRAW e do papel),
 * mas aqui a cota é lida na TELA, quase sempre num celular na mão: um "147"
 * deitado obriga a virar o aparelho, que é o gesto que a ferramenta existe para
 * evitar. Decisão do dono, e vale nos dois lados — mesmo número, mesma posição,
 * na web e no celular.
 *
 * O preço é o espaço horizontal: o número de uma cota vertical passa a ocupar
 * largura em vez de altura, e por isso ele é ancorado pela ponta que encosta na
 * linha (`start` à direita dela, `end` à esquerda) e sai INTEIRO para fora, em
 * vez de ficar centrado em cima da linha.
 */
const ARROW = 9;
const ARROWS_OUTSIDE_BELOW_CM = STYLE_CM.arrowsOutsideBelowCm;

/**
 * Folga desenhável ALÉM da página, em pt.
 *
 * A doutrina manda a cota de um item encostado na borda morar fora da face, a
 * ~18 cm dela — que a 1:10 são 51 pt. Um `<svg>` recorta no próprio viewBox, e
 * sem esta folga a cota mais comum do acervo simplesmente sumia da tela. O
 * valor cobre os 18 cm de afastamento, o empilhamento de faixas e o rótulo.
 */
export const DIMENSION_BLEED_PT = 150;

/** O alvo de clique nunca é menor que isto, para o dedo achar a faixa fina. */
const MIN_HIT_PX = 22;

function formatCm(value: number): string {
  return value >= 100 ? `${Math.round(value)}` : value.toFixed(value < 10 ? 1 : 0);
}

/**
 * O ponto está dentro do contorno? Regra par-ímpar, a mesma do desenho.
 *
 * A caixa não serve para escolher item: o envelopamento é côncavo — uma onda
 * que varre a face — e metade da caixa dele é vazio. Clicar nesse vazio
 * selecionava a onda em vez do adesivo que está por baixo.
 */
function pointInPoly(poly: Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Um item é a UNIÃO das formas dele, não a alternância entre elas.
 *
 * A paridade corria num contador só para todos os polígonos, e formas
 * EMPILHADAS se cancelavam: a onda do DiCasa é uma sombra cinza com a onda
 * vermelha por cima, quase coincidentes — o dedo caía dentro das duas, a
 * paridade voltava a par, e clicar no meio da faixa mais visível da face não
 * selecionava nada. Par-ímpar só faz sentido DENTRO de uma forma, para vazar o
 * miolo de um "o"; entre formas diferentes, quem vale é o "dentro de alguma".
 */
function pointInPolys(polys: Pt[][], p: Pt): boolean {
  return polys.some((poly) => pointInPoly(poly, p));
}

/** Distância do ponto ao contorno — dá a tolerância de dedo em forma fina. */
function distanceToPolys(polys: Pt[][], p: Pt): number {
  let best = Infinity;
  for (const poly of polys) {
    for (let i = 0; i + 1 < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
    }
  }
  return best;
}

/** Um polígono da silhueta como caminho SVG fechado, já em pixels de tela. */
function polyPath(poly: Pt[], zoom: number): string {
  return (
    poly
      .map((p, i) => `${i ? "L" : "M"} ${(p.x * zoom).toFixed(1)} ${(p.y * zoom).toFixed(1)}`)
      .join(" ") + " Z"
  );
}

/** Seta cheia apontando para (x, y) na direção `angle`. */
function arrowPath(x: number, y: number, angle: number): string {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const bx = x - ux * ARROW;
  const by = y - uy * ARROW;
  const px = -uy * (ARROW * 0.27);
  const py = ux * (ARROW * 0.27);
  return `M ${x} ${y} L ${bx + px} ${by + py} L ${bx - px} ${by - py} Z`;
}

function MeasurementMark({ m, zoom }: { m: Measurement; zoom: number }) {
  const x1 = m.from.x * zoom;
  const y1 = m.from.y * zoom;
  const x2 = m.to.x * zoom;
  const y2 = m.to.y * zoom;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const label = formatCm(m.valueCm);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const vertical = m.axis === "V";
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR} strokeWidth={1.25} />
      <path d={arrowPath(x1, y1, angle + Math.PI)} fill={COLOR} />
      <path d={arrowPath(x2, y2, angle)} fill={COLOR} />
      {/* O número NUNCA gira: ver LABELS_ARE_UPRIGHT. */}
      <text
        x={vertical ? mx + 6 : mx}
        y={vertical ? my : my - 8}
        textAnchor={vertical ? "start" : "middle"}
        dominantBaseline={vertical ? "central" : undefined}
        fontSize={12}
        fontWeight={700}
        fill={COLOR}
        stroke="white"
        strokeWidth={3.2}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Desenha uma cota do plano automático em coordenadas de tela.
 *
 * A cota vive em cm da FACE; a face vive em pt da PÁGINA; a página é desenhada
 * com um zoom. As três conversões acontecem aqui e em lugar nenhum mais.
 *
 * O traço que sai de `tieCm` é o que dá sentido ao número: ele encosta no
 * adesivo medido. Sem ele o "8 cm" fica solto na margem e o aplicador não sabe
 * de que peça se trata.
 */
function PlannedDimension({
  dimension,
  scale,
  zoom,
}: {
  dimension: Dimension;
  scale: Scale;
  zoom: number;
}) {
  const x = (cm: number) => (scale.panelPt.x0 + cm * scale.ptPerCm) * zoom;
  const y = (cm: number) => (scale.panelPt.y0 + cm * scale.ptPerCm) * zoom;
  /**
   * De que lado do item a linha mora: -1 acima/à esquerda, +1 abaixo/à direita.
   *
   * O rótulo vai sempre do lado de FORA da linha, nunca entre ela e o desenho:
   * cota no alto tem o número por cima, cota embaixo tem o número por baixo. É
   * o que o desenho do projetista faz, e é o que deixa a faixa entre a linha e
   * a peça limpa para a extensão passar.
   */
  const outward = dimension.offsetCm >= dimension.tieCm ? 1 : -1;
  const over = outward * 2.5 * scale.ptPerCm * zoom;
  const label = String(dimension.valueCm);
  const parts: React.ReactNode[] = [];

  if (dimension.axis === "H") {
    const yl = y(dimension.offsetCm);
    const xa = x(dimension.aCm);
    const xb = x(dimension.bCm);
    if (dimension.side !== "inside") {
      const tie = y(dimension.tieCm);
      parts.push(
        <line key="ea" x1={xa} y1={tie} x2={xa} y2={yl + over} stroke={COLOR} strokeWidth={0.7} />,
        <line key="eb" x1={xb} y1={tie} x2={xb} y2={yl + over} stroke={COLOR} strokeWidth={0.7} />,
      );
    }
    // dentro ou fora é decisão do VALOR em cm, nunca do tamanho em pixels
    const inside = dimension.valueCm >= ARROWS_OUTSIDE_BELOW_CM;
    parts.push(
      <line
        key="l"
        x1={inside ? xa : xa - ARROW * 1.6}
        y1={yl}
        x2={inside ? xb : xb + ARROW * 1.6}
        y2={yl}
        stroke={COLOR}
        strokeWidth={1.1}
      />,
      <path key="a1" d={arrowPath(xa, yl, inside ? Math.PI : 0)} fill={COLOR} />,
      <path key="a2" d={arrowPath(xb, yl, inside ? 0 : Math.PI)} fill={COLOR} />,
      <text
        key="t"
        x={(xa + xb) / 2}
        y={outward < 0 ? yl - 5 : yl + 13}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={COLOR}
        stroke="white"
        strokeWidth={3.2}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {label}
      </text>,
    );
    return <g>{parts}</g>;
  }

  const xl = x(dimension.offsetCm);
  const ya = y(dimension.aCm);
  const yb = y(dimension.bCm);
  if (dimension.side !== "inside") {
    const tie = x(dimension.tieCm);
    parts.push(
      <line key="ea" x1={tie} y1={ya} x2={xl + over} y2={ya} stroke={COLOR} strokeWidth={0.7} />,
      <line key="eb" x1={tie} y1={yb} x2={xl + over} y2={yb} stroke={COLOR} strokeWidth={0.7} />,
    );
  }
  const insideV = dimension.valueCm >= ARROWS_OUTSIDE_BELOW_CM;
  parts.push(
    <line
      key="l"
      x1={xl}
      y1={insideV ? ya : ya - ARROW * 1.6}
      x2={xl}
      y2={insideV ? yb : yb + ARROW * 1.6}
      stroke={COLOR}
      strokeWidth={1.1}
    />,
    // A seta aponta SEMPRE para a linha de extensão, tanto faz de que lado
    // dela esteja. Na vertical `ya` é a ponta de CIMA (y menor), então a seta
    // de dentro do vão aponta para cima (-PI/2) e a de fora aponta para baixo.
    // O sinal estava trocado e as duas setas de uma cota vertical apontavam uma
    // para a outra pelo lado errado.
    <path key="a1" d={arrowPath(xl, ya, insideV ? -Math.PI / 2 : Math.PI / 2)} fill={COLOR} />,
    <path key="a2" d={arrowPath(xl, yb, insideV ? Math.PI / 2 : -Math.PI / 2)} fill={COLOR} />,
    // O número NUNCA gira: ver LABELS_ARE_UPRIGHT. Ele sai INTEIRO para o lado
    // de fora da linha, ancorado pela ponta que encosta nela, para não invadir
    // o vão que a cota mede.
    <text
      key="t"
      x={xl + (outward > 0 ? 6 : -6)}
      y={(ya + yb) / 2}
      textAnchor={outward > 0 ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
      fill={COLOR}
      stroke="white"
      strokeWidth={3.2}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {label}
    </text>,
  );
  return <g>{parts}</g>;
}

/**
 * Camada de medição sobre a página do PDF.
 *
 * O ímã trabalha sobre a geometria vetorial do arquivo, então o clique cai na
 * quina real do adesivo e não onde o dedo acertou. Dois cliques em retas
 * paralelas dão a distância perpendicular — que é a medida que o aplicador
 * quer, não a distância entre os dois pontos clicados.
 */
export function PdfMeasureOverlay({
  geometry,
  zoom,
  ptPerCm,
  faceScales,
  measurements,
  onCommit,
  plan,
  selectable,
  selectedIndex = null,
  onSelect,
  mode = "measure",
  className,
}: PdfMeasureOverlayProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hover, setHover] = React.useState<SnapTarget | null>(null);
  const [pending, setPending] = React.useState<SnapTarget | null>(null);

  const index = React.useMemo(() => new SnapIndex(geometry), [geometry]);
  const scale = React.useMemo<Scale>(
    () => ({ ptPerCm, panelPt: { x0: 0, y0: 0, x1: geometry.width, y1: geometry.height } }),
    [ptPerCm, geometry.width, geometry.height],
  );

  /**
   * A escala que vale entre dois pontos: a da face que contém a medida.
   *
   * Um arquivo traz as três faces e cada uma tem a sua própria escala, tirada
   * da medida real daquele lado. Medir na traseira com a escala da lateral dá
   * um número plausível e errado.
   */
  const scaleAt = React.useCallback(
    (a: Pt, b: Pt): Scale => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const face = faceScales?.find(
        (f) => mx >= f.panelPt.x0 && mx <= f.panelPt.x1 && my >= f.panelPt.y0 && my <= f.panelPt.y1,
      );
      return face ?? scale;
    },
    [faceScales, scale],
  );

  const toPagePoint = React.useCallback(
    (event: React.PointerEvent | React.MouseEvent): Pt | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      // o canto do SVG está uma folga ANTES do canto da página (ver
      // DIMENSION_BLEED_PT); sem descontá-la todo clique cai deslocado
      return {
        x: (event.clientX - rect.left) / zoom - DIMENSION_BLEED_PT,
        y: (event.clientY - rect.top) / zoom - DIMENSION_BLEED_PT,
      };
    },
    [zoom],
  );

  const handleMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (mode === "select") return;
      const point = toPagePoint(event);
      if (!point) return;
      setHover(index.snap(point, SNAP_RADIUS_PX / zoom, pending?.orientation));
    },
    [index, mode, pending, toPagePoint, zoom],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const point = toPagePoint(event);
      if (!point) return;
      if (mode === "select") {
        // O clique cai na FORMA, não na caixa. Uma onda de envelopamento é
        // côncava e metade da caixa dela é vazio: escolher pela caixa
        // entregava a onda quando o dedo estava no adesivo que fica no vão.
        const tol = MIN_HIT_PX / zoom;
        const hits = (selectable ?? []).filter((s) => {
          if (
            point.x < s.bbox.x0 - tol || point.x > s.bbox.x1 + tol ||
            point.y < s.bbox.y0 - tol || point.y > s.bbox.y1 + tol
          ) {
            return false;
          }
          if (!s.outline?.length) return true;
          return pointInPolys(s.outline, point) || distanceToPolys(s.outline, point) <= tol;
        });
        // o menor adesivo sob o cursor ganha: um dentro do outro não trava a escolha
        hits.sort(
          (a, b) =>
            (a.bbox.x1 - a.bbox.x0) * (a.bbox.y1 - a.bbox.y0) -
            (b.bbox.x1 - b.bbox.x0) * (b.bbox.y1 - b.bbox.y0),
        );
        onSelect?.(hits.length ? hits[0].index : null);
        return;
      }
      const target = index.snap(point, SNAP_RADIUS_PX / zoom, pending?.orientation);
      if (!target) return;
      if (!pending) {
        setPending(target);
        return;
      }
      const measurement = measureBetween(pending, target, scaleAt(pending.point, target.point));
      if (measurement.valueCm > 0.2) {
        onCommit({ ...measurement, id: `m-${Date.now()}-${Math.round(Math.random() * 1e6)}` });
      }
      setPending(null);
    },
    [index, mode, onCommit, onSelect, pending, scaleAt, selectable, toPagePoint, zoom],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const preview = React.useMemo(() => {
    if (!pending || !hover) return null;
    const m = measureBetween(pending, hover, scaleAt(pending.point, hover.point));
    return m.valueCm > 0.2 ? m : null;
  }, [hover, pending, scaleAt]);

  const width = geometry.width * zoom;
  const height = geometry.height * zoom;
  // a folga sai em pixels de tela, mas o sistema de coordenadas de dentro
  // continua sendo o da página: nada no desenho precisa saber que ela existe
  const bleed = DIMENSION_BLEED_PT * zoom;

  return (
    <svg
      ref={svgRef}
      className={cn(
        "absolute",
        mode === "select" ? "cursor-pointer" : "cursor-crosshair touch-none",
        className,
      )}
      style={{ left: -bleed, top: -bleed }}
      width={width + 2 * bleed}
      height={height + 2 * bleed}
      viewBox={`${-bleed} ${-bleed} ${width + 2 * bleed} ${height + 2 * bleed}`}
      onPointerMove={handleMove}
      onPointerLeave={() => setHover(null)}
      onClick={handleClick}
    >
      {/*
        Só o item ESCOLHIDO ganha contorno. Tracejar todos para anunciar que são
        clicáveis enchia o desenho de retângulos e competia com a arte — o
        cursor já muda de forma, e clicar é a única coisa que se faz aqui.
        O clique não depende deste desenho: ele é resolvido na geometria.
      */}
      {selectable
        ?.filter((s) => s.index === selectedIndex)
        .map((s) => {
          const draw = s.drawBox ?? s.bbox;
          return (
            <g key={`sel-${s.index}`}>
              {s.outline?.length ? (
                <>
                  {/*
                    O preenchimento é a UNIÃO das formas, pela mesma razão que o
                    clique: em par-ímpar a sombra e a onda que ela acompanha se
                    anulavam e o realce virava um filete. Cada forma é pintada
                    cheia dentro de um grupo transparente — a opacidade é do
                    grupo, então a sobreposição não escurece duas vezes. O traço
                    sai à parte, opaco, senão sumiria junto.
                  */}
                  <g opacity={SELECTED_FILL_OPACITY}>
                    {s.outline.map((poly, k) => (
                      <path key={k} d={polyPath(poly, zoom)} fill={COLOR} />
                    ))}
                  </g>
                  <path
                    d={s.outline.map((poly) => polyPath(poly, zoom)).join(" ")}
                    fill="none"
                    stroke={COLOR}
                    strokeWidth={1.4}
                  />
                </>
              ) : (
                <rect
                  x={draw.x0 * zoom}
                  y={draw.y0 * zoom}
                  width={(draw.x1 - draw.x0) * zoom}
                  height={(draw.y1 - draw.y0) * zoom}
                  fill={SELECTED_FILL}
                  stroke={COLOR}
                  strokeWidth={1.4}
                />
              )}
            </g>
          );
        })}

      {plan?.map((entry) => (
        <PlannedDimension
          key={entry.dimension.id}
          dimension={entry.dimension}
          scale={entry.scale}
          zoom={zoom}
        />
      ))}

      {measurements.map((m) => (
        <MeasurementMark key={m.id} m={m} zoom={zoom} />
      ))}

      {preview && <MeasurementMark m={preview} zoom={zoom} />}

      {/* aresta sob o ímã */}
      {hover && (
        <line
          x1={hover.a.x * zoom}
          y1={hover.a.y * zoom}
          x2={hover.b.x * zoom}
          y2={hover.b.y * zoom}
          stroke={SNAP_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.9}
        />
      )}
      {hover && <circle cx={hover.point.x * zoom} cy={hover.point.y * zoom} r={4} fill={SNAP_COLOR} />}
      {pending && (
        <circle
          cx={pending.point.x * zoom}
          cy={pending.point.y * zoom}
          r={5}
          fill="none"
          stroke={COLOR}
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

export default PdfMeasureOverlay;
