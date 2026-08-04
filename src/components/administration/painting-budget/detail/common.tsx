import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { PaintingStepKind, PaintingStrategy, PaintingValueSource } from "@/types";
import { getApiBaseUrl } from "@/utils/file-viewer-utils";

/** Cores fixas do viewer por estratégia (overlay SVG e legendas — não são badges). */
export const STRATEGY_FILL: Record<PaintingStrategy, string> = {
  ADESIVO_RECORTE: "#3b82f6", // azul
  FITA_CORTE: "#f97316", // laranja
  FITA_FLEXIVEL: "#eab308", // amarelo
  STENCIL: "#8b5cf6", // roxo
  CURA_ADESIVO: "#14b8a6", // teal
  AEROGRAFIA: "#ec4899", // rosa
  AEROGRAFIA_ARTISTICA: "#d946ef", // magenta
  NENHUMA: "transparent",
};

export const serveFileUrl = (fileId: string) => `${getApiBaseUrl()}/files/serve/${fileId}`;

/** Filtro P&B "plotter" aplicado à arte quando a cena do passo pede baseMode BW (não inverter no dark). */
export const BW_PLOTTER_FILTER = "grayscale(1) contrast(1.45) brightness(1.12)";

export interface StepFamilyInfo {
  label: "PREP" | "MASC" | "PINT" | "CURA" | "FINAL";
  variant: BadgeProps["variant"];
}

/** 29 kinds → 5 famílias com cor própria (narrativa prepara → mascara → pinta → cura → finaliza). */
export const STEP_FAMILY: Record<PaintingStepKind, StepFamilyInfo> = {
  REMOCAO_ADESIVO_ANTIGO: { label: "PREP", variant: "gray" },
  REMOCAO_REFLETIVA: { label: "PREP", variant: "gray" },
  DESMONTAGEM: { label: "PREP", variant: "gray" },
  PREPARACAO: { label: "PREP", variant: "gray" },
  SECAGEM: { label: "PREP", variant: "gray" },
  LIMPEZA_TETO: { label: "PREP", variant: "gray" },
  LAVAGEM: { label: "PREP", variant: "gray" },
  VEDACAO_PU: { label: "PREP", variant: "gray" },
  LIXAMENTO: { label: "PREP", variant: "gray" },
  MASCARAMENTO: { label: "MASC", variant: "blue" },
  EMPAPELAMENTO: { label: "MASC", variant: "blue" },
  MASCARAMENTO_LIQUIDO: { label: "MASC", variant: "blue" },
  PINTURA_TETO: { label: "PINT", variant: "green" },
  REMONTAGEM: { label: "FINAL", variant: "purple" },
  ADESIVO_PLOTAGEM: { label: "MASC", variant: "blue" },
  ADESIVO_DEPILACAO: { label: "MASC", variant: "blue" },
  ADESIVO_APLICACAO: { label: "MASC", variant: "blue" },
  FITA: { label: "MASC", variant: "blue" },
  CORTE: { label: "MASC", variant: "blue" },
  STENCIL: { label: "MASC", variant: "blue" },
  REMOCAO_MASCARA: { label: "MASC", variant: "blue" },
  FUNDO: { label: "PINT", variant: "green" },
  PINTURA: { label: "PINT", variant: "green" },
  VERNIZ: { label: "PINT", variant: "green" },
  AEROGRAFIA: { label: "PINT", variant: "green" },
  CURA: { label: "CURA", variant: "amber" },
  APLICACAO_REFLETIVA: { label: "FINAL", variant: "purple" },
  LIMPEZA: { label: "FINAL", variant: "purple" },
  INSPECAO: { label: "FINAL", variant: "purple" },
};

/**
 * Campos Decimal da API (laborCost, totalCost, unitPriceSnapshot, quantity…) chegam como STRING
 * via JSON, apesar dos types declararem number. Somar/formatar direto concatena strings e vira NaN.
 * Sempre coagir com este helper antes de agregar ou formatar (null/undefined/lixo → 0).
 */
export const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Labels sintéticos de grupo artístico chegam com "#multi" — exibe um nome amigável no lugar. */
export const materialDisplayLabel = (label: string): string => (label.includes("#multi") ? "Tintas de aerografia" : label);

export const formatNumber = (value: number | null | undefined, digits = 2): string =>
  value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export function formatMinutesLabel(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}min`;
}

/** Marca campos cujo valor foi sobrescrito por uma pessoa (source === MANUAL). */
export function SourceBadge({ source }: { source: PaintingValueSource }) {
  if (source !== "MANUAL") return null;
  return (
    <Badge variant="amber" size="sm">
      MANUAL
    </Badge>
  );
}

export function PaintSwatch({ hex, className }: { hex: string | null | undefined; className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 rounded-full border border-border ${className ?? ""}`}
      style={{ backgroundColor: hex ?? "transparent" }}
    />
  );
}
