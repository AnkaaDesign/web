import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader2,
  IconSelector,
} from "@tabler/icons-react";

import type { ProductionAvailabilityResult } from "@/api-client/paint";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatLiters } from "./format";

interface AvailabilitySummaryProps {
  result: ProductionAvailabilityResult | null;
  litersPerTask: number;
  isLoading: boolean;
  hasRows: boolean;
}

type Tone = "neutral" | "loading" | "success" | "warning" | "danger";

const TONE_STYLES: Record<Tone, { wrap: string; icon: string }> = {
  neutral: { wrap: "border-border bg-muted/40", icon: "text-muted-foreground" },
  loading: { wrap: "border-border bg-muted/40", icon: "text-muted-foreground" },
  success: {
    wrap: "border-green-500/40 bg-green-500/5",
    icon: "text-green-600 dark:text-green-400",
  },
  warning: {
    wrap: "border-amber-500/40 bg-amber-500/5",
    icon: "text-amber-600 dark:text-amber-400",
  },
  danger: { wrap: "border-red-500/40 bg-red-500/5", icon: "text-red-600 dark:text-red-400" },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-lg font-semibold" title={value}>
        {value}
      </div>
    </div>
  );
}

export function AvailabilitySummary({
  result,
  litersPerTask,
  isLoading,
  hasRows,
}: AvailabilitySummaryProps) {
  const summary = result?.summary ?? null;
  const components = result?.components ?? [];
  const hasShortage = components.some((c) => c.availableRatio != null && c.availableRatio < 1);

  let tone: Tone;
  let Icon = IconInfoCircle;
  let headline: string;
  let subline: string;

  if (!hasRows) {
    tone = "neutral";
    Icon = IconSelector;
    headline = "Nenhuma tinta selecionada";
    subline = "As tintas do cronograma entram automaticamente. Adicione ou ajuste os volumes.";
  } else if (!summary && isLoading) {
    tone = "loading";
    Icon = IconLoader2;
    headline = "Calculando disponibilidade…";
    subline = "Agregando a demanda de componentes das tintas selecionadas.";
  } else if (summary?.canProduceAll) {
    tone = "success";
    Icon = IconCircleCheck;
    headline = "Produção viável";
    subline = "Há estoque para produzir todas as tintas selecionadas.";
  } else if (hasShortage) {
    tone = "danger";
    Icon = IconAlertTriangle;
    headline = "Estoque insuficiente";
    subline = summary?.limitingItemName
      ? `Componente limitante: ${summary.limitingItemName}.`
      : "Faltam componentes para o volume solicitado.";
  } else {
    tone = "warning";
    Icon = IconAlertTriangle;
    headline = "Cálculo parcial";
    subline = "Alguns itens não têm medida de peso ou fórmula, então a estimativa é incompleta.";
  }

  const styles = TONE_STYLES[tone];

  return (
    <Card className={cn("flex-shrink-0 border", styles.wrap)}>
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Icon
            className={cn("h-8 w-8 flex-shrink-0", styles.icon, tone === "loading" && "animate-spin")}
          />
          <div>
            <div className="text-lg font-semibold">{headline}</div>
            <div className="text-sm text-muted-foreground">{subline}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat
            label="Total solicitado"
            value={summary ? formatLiters(summary.totalRequestedLiters) : "—"}
          />
          <Stat
            label="Máx. produzível"
            value={summary?.maxProducibleLiters != null ? formatLiters(summary.maxProducibleLiters) : "—"}
          />
          <Stat label="Componente limitante" value={summary?.limitingItemName ?? "—"} />
          <Stat label="Base por tarefa" value={formatLiters(litersPerTask)} />
        </div>
      </CardContent>
    </Card>
  );
}
