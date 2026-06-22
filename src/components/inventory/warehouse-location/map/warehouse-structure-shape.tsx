import { WAREHOUSE_LOCATION_TYPE } from "../../../../constants";
import { WAREHOUSE_TYPE_STYLE } from "./warehouse-type-style";

interface Props {
  id: string;
  type: WAREHOUSE_LOCATION_TYPE;
  x: number;
  y: number;
  w: number;
  h: number;
  selected: boolean;
  columns?: number;
  /**
   * Live px-per-cm scale (X, Y) from the map's projection. Fine details (corner posts,
   * bin rims, pallet seams, nails) are sized in SCREEN PIXELS via these so they stay a
   * consistent visible size at every zoom instead of vanishing (thin) or ballooning.
   * The map keeps sx ≈ sy (viewBox height is derived from canvas aspect), so shapes are
   * never sheared; per-axis conversion is used anyway for correctness/robustness.
   */
  sx?: number;
  sy?: number;
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

/**
 * Top-view illustration of a real warehouse object:
 * - estante / kanban → gray steel with bright L-shaped corner posts (+ black kanban bins)
 * - estante dupla → two racks back-to-back: corner L-posts + shared T-posts on the seam
 * - painel → white pegboard
 * - palete → light pine deck boards over cross-stringers, with nails
 */
export function StructureShape({ id, type, x, y, w, h, selected, columns = 1, sx = 1, sy = 1, className, onClick, onDoubleClick }: Props) {
  const s = WAREHOUSE_TYPE_STYLE[type];
  const body = selected ? s.bodySel : s.body;
  const hit = { "data-role": "structure", "data-id": id } as Record<string, string>;
  const inert = { pointerEvents: "none" as const };
  const SX = sx || 1;
  const SY = sy || 1;
  const cmx = (px: number) => px / SX; // screen px → cm, horizontal
  const cmy = (px: number) => px / SY; // screen px → cm, vertical
  const wPx = w * SX; // structure size on screen
  const hPx = h * SY;

  // ---- PALETE: top-down wooden pallet --------------------------------------
  if (type === WAREHOUSE_LOCATION_TYPE.PALETE) {
    const n = Math.max(5, Math.min(7, Math.round(hPx / 26))); // chunky deck boards by screen size
    const slot = h / n;
    const boardH = slot * 0.64; // clear gaps so it reads as a pallet, not blinds
    const stW = Math.max(cmx(7), w * 0.085); // stringer width
    const stringerXs = [x, x + (w - stW) / 2, x + w - stW];
    const showNails = wPx > 120 && hPx > 70;
    const nrx = cmx(1.3);
    const nry = cmy(1.3);
    return (
      <g className={className}>
        <rect {...hit} x={x} y={y} width={w} height={h} fill="#4d3a22" stroke={s.border} strokeWidth={1.25} vectorEffect="non-scaling-stroke" onClick={onClick} onDoubleClick={onDoubleClick} />
        {/* three cross-stringers UNDER the deck — visible through the board gaps */}
        {stringerXs.map((sxp, i) => <rect key={`st${i}`} x={sxp} y={y} width={stW} height={h} fill="#7d5a32" style={inert} />)}
        {/* light pine deck boards on top, with a top highlight, seam line and nails */}
        {Array.from({ length: n }, (_, i) => {
          const by = y + i * slot + (slot - boardH) / 2;
          return (
            <g key={i}>
              <rect x={x} y={by} width={w} height={boardH} fill={s.detail} stroke="#5e472a" strokeWidth={0.75} vectorEffect="non-scaling-stroke" style={inert} />
              <rect x={x} y={by} width={w} height={cmy(1.4)} fill="#ead0a2" opacity={0.55} style={inert} />
              {showNails && stringerXs.map((sxp, j) => <ellipse key={j} cx={sxp + stW / 2} cy={by + boardH / 2} rx={nrx} ry={nry} fill="#3f2f1b" opacity={0.7} style={inert} />)}
            </g>
          );
        })}
      </g>
    );
  }

  // ---- PAINEL: white pegboard ---------------------------------------------
  if (type === WAREHOUSE_LOCATION_TYPE.PAINEL) {
    const rows = 2;
    const cols = Math.max(4, Math.round(w / 16));
    const rPx = Math.max(1.5, Math.min(Math.min(wPx, hPx) * 0.12, 5));
    const rx = cmx(rPx);
    const ry = cmy(rPx);
    const holes: { cx: number; cy: number }[] = [];
    for (let ri = 0; ri < rows; ri++) for (let ci = 0; ci < cols; ci++) holes.push({ cx: x + ((ci + 0.5) / cols) * w, cy: y + ((ri + 0.5) / rows) * h });
    return (
      <g className={className}>
        <rect {...hit} x={x} y={y} width={w} height={h} fill={body} stroke={s.border} strokeWidth={1.25} vectorEffect="non-scaling-stroke" onClick={onClick} onDoubleClick={onDoubleClick} />
        {holes.map((hh, i) => <ellipse key={i} cx={hh.cx} cy={hh.cy} rx={rx} ry={ry} fill={s.detail} style={inert} />)}
      </g>
    );
  }

  // ---- ESTANTE / DUPLA / KANBAN: steel rack -------------------------------
  // Corner uprights drawn as FILLED angle-iron L-posts — kept SLIM so they read as a thin
  // angle-iron corner detail, not a chunky block. The leg gives a recognisable corner; the
  // thickness is deliberately small. Floor keeps them visible when zoomed out; the per-box
  // clamp only shrinks them for unusually tiny structures.
  const span = Math.min(w, h);
  const postLen = Math.min(Math.max(5, cmx(3.5)), span * 0.28); // ~5 cm leg
  const postTh = Math.min(Math.max(1.5, cmx(1)), span * 0.07); // ~1.5 cm thickness (slim)
  const POST_FILL = "#3a414c";
  const lPost = (px: number, py: number, dx: number, dy: number) =>
    `M ${px} ${py} L ${px + dx * postLen} ${py} L ${px + dx * postLen} ${py + dy * postTh} L ${px + dx * postTh} ${py + dy * postTh} L ${px + dx * postTh} ${py + dy * postLen} L ${px} ${py + dy * postLen} Z`;
  const posts = [
    lPost(x, y, 1, 1),
    lPost(x + w, y, -1, 1),
    lPost(x, y + h, 1, -1),
    lPost(x + w, y + h, -1, -1),
  ];
  const isKanban = type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN;
  const isDupla = type === WAREHOUSE_LOCATION_TYPE.ESTANTE_DUPLA;
  const mx = x + w / 2;
  const my = y + h / 2;
  const postFill = { fill: POST_FILL, stroke: s.border, strokeWidth: 0.75, strokeOpacity: 0.5, vectorEffect: "non-scaling-stroke" as const, ...inert };
  return (
    <g className={className}>
      <rect {...hit} x={x} y={y} width={w} height={h} fill={body} stroke={s.border} strokeWidth={1} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" onClick={onClick} onDoubleClick={onDoubleClick} />
      {posts.map((d, i) => <path key={i} d={d} {...postFill} />)}
      {/* dupla seam: filled centre beam where the two racks meet */}
      {isDupla &&
        (h > w ? (
          <rect x={mx - postTh / 2} y={y} width={postTh} height={h} {...postFill} />
        ) : (
          <rect x={x} y={my - postTh / 2} width={w} height={postTh} {...postFill} />
        ))}
      {isKanban && (() => {
        // a row/column of black plastic bins: dark body + lighter open interior + rim
        const n = Math.max(2, Math.min(columns, 8));
        const horiz = wPx >= hPx;
        const padX = w * 0.06;
        const padY = h * 0.1;
        const inX = x + padX;
        const inY = y + padY;
        const inW = w - 2 * padX;
        const inH = h - 2 * padY;
        const slot = (horiz ? inW : inH) / n;
        const gap = slot * 0.16;
        const rxv = cmx(2.5);
        const ryv = cmy(2.5);
        return Array.from({ length: n }, (_, i) => {
          const bx = horiz ? inX + i * slot + gap / 2 : inX;
          const by = horiz ? inY : inY + i * slot + gap / 2;
          const bw = horiz ? slot - gap : inW;
          const bh = horiz ? inH : slot - gap;
          return (
            <g key={i}>
              <rect x={bx} y={by} width={bw} height={bh} rx={rxv} ry={ryv} fill="#16181d" stroke="#3a4048" strokeWidth={1} vectorEffect="non-scaling-stroke" style={inert} />
              <rect x={bx + bw * 0.16} y={by + bh * 0.16} width={bw * 0.68} height={bh * 0.68} rx={cmx(1.5)} ry={cmy(1.5)} fill="#262b33" style={inert} />
            </g>
          );
        });
      })()}
    </g>
  );
}
