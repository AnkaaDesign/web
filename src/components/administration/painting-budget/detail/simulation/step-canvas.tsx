import { useId } from "react";
import { IconClock } from "@tabler/icons-react";

import { PAINTING_FACE_VIEW_LABELS } from "@/types";
import type { PaintingAnalysisFace, PaintingStepVisualization, PaintingVisualizationRect } from "@/types";
import { BW_PLOTTER_FILTER, serveFileUrl } from "../common";

/** Z-order: janela de pintura por baixo, papel kraft por cima, banda de adesivo no topo; rótulos em passe final. */
const RECT_KIND_Z: Record<PaintingVisualizationRect["kind"], number> = {
  PAINT_WINDOW: 0,
  PAPER: 1,
  ADHESIVE_BAND: 2,
};

const KRAFT_WAVES = (
  <>
    <rect width={12} height={12} fill="#d3b184" />
    <path d="M0 3 Q1.5 1.8 3 3 T6 3 T9 3 T12 3" fill="none" stroke="#b8905c" strokeWidth={0.6} />
    <path d="M0 6.5 Q1.5 5.3 3 6.5 T6 6.5 T9 6.5 T12 6.5" fill="none" stroke="#aa8150" strokeWidth={0.5} />
    <path d="M0 10 Q1.5 8.8 3 10 T6 10 T9 10 T12 10" fill="none" stroke="#b8905c" strokeWidth={0.6} />
  </>
);

interface StepCanvasProps {
  face: PaintingAnalysisFace;
  visualization: PaintingStepVisualization | null;
  /** Quando presente, o passo é de CURA — overlay central de relógio sobre a cena. */
  cureLabel?: string | null;
}

/**
 * Simulação do passo sobre a arte: viewBox em CENTÍMETROS (1 unidade SVG = 1 cm, zero conversão em JS).
 * Atenção: espaço DIFERENTE do overlay de regiões da Revisão (px de trabalho do engine) — nunca misturar no mesmo svg.
 * A cena é autocontida por passo (rects já cumulativos com phase) — nada é acumulado no cliente.
 */
export function StepCanvas({ face, visualization, cureLabel }: StepCanvasProps) {
  const patternId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const widthCm = face.widthCm;
  const heightCm = face.heightCm;
  const rects = [...(visualization?.rects ?? [])].sort((a, b) => RECT_KIND_Z[a.kind] - RECT_KIND_Z[b.kind]);
  const labeledRects = rects.filter((rect) => rect.label);

  const labelFontFor = (rect: PaintingVisualizationRect): number => {
    const base = widthCm != null ? Math.min(Math.max(widthCm * 0.02, 5), 30) : 5;
    return Math.max(2, Math.min(base, rect.h * 0.7));
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-muted/20">
      <img
        src={serveFileUrl(face.fileId)}
        alt={PAINTING_FACE_VIEW_LABELS[face.view]}
        className="block w-full select-none transition-[filter] duration-300"
        style={{ filter: visualization?.baseMode === "BW" ? BW_PLOTTER_FILTER : undefined }}
        draggable={false}
      />
      {/* Guarda: sem calibração (widthCm/heightCm) não há espaço em cm — só a imagem. */}
      {widthCm != null && heightCm != null && rects.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${widthCm} ${heightCm}`} preserveAspectRatio="none">
          <defs>
            <pattern id={`${patternId}-h`} width={12} height={12} patternUnits="userSpaceOnUse">
              {KRAFT_WAVES}
            </pattern>
            <pattern id={`${patternId}-v`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
              {KRAFT_WAVES}
            </pattern>
          </defs>

          {rects.map((rect, index) => {
            const isPrior = rect.phase === "PRIOR";
            if (rect.kind === "ADHESIVE_BAND") {
              return (
                <rect
                  key={index}
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  fill="#64748b"
                  fillOpacity={isPrior ? 0.08 : 0.18}
                  strokeDasharray="7 5"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  className={isPrior ? "stroke-muted-foreground/50" : "stroke-primary"}
                />
              );
            }
            if (rect.kind === "PAPER") {
              return (
                <rect
                  key={index}
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  fill={`url(#${patternId}-${rect.w >= rect.h ? "h" : "v"})`}
                  fillOpacity={0.95}
                  stroke="#8a6a42"
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                  opacity={isPrior ? 0.75 : 1}
                />
              );
            }
            // PAINT_WINDOW — 8% da arte fica visível para conferência via fillOpacity 0.92
            return (
              <rect
                key={index}
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={rect.color ?? "#94a3b8"}
                fillOpacity={0.92}
                stroke={isPrior ? "none" : "#ffffff"}
                strokeWidth={isPrior ? 0 : 2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Passe final: rótulos por cima de tudo, com halo branco */}
          {labeledRects.map((rect, index) => {
            const font = labelFontFor(rect);
            return (
              <text
                key={`label-${index}`}
                x={rect.x + rect.w / 2}
                y={rect.y + rect.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={font}
                fill="#1f2937"
                stroke="#ffffff"
                strokeWidth={font * 0.18}
                style={{ paintOrder: "stroke" }}
                className="select-none tabular-nums"
              >
                {rect.label}
              </text>
            );
          })}
        </svg>
      )}

      {cureLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-background/40 px-4 py-2 backdrop-blur">
            <IconClock className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium tabular-nums">{cureLabel} de espera</span>
          </div>
        </div>
      )}
    </div>
  );
}
