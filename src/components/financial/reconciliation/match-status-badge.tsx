import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import type { MatchStatus } from "@/types/reconciliation";

const STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; variant: "completed" | "pending" | "inProgress" | "muted" | "cancelled" }
> = {
  UNMATCHED: { label: "Não conciliado", variant: "pending" },
  AUTO_MATCHED: { label: "Conciliado (auto)", variant: "inProgress" },
  MANUAL_MATCHED: { label: "Conciliado", variant: "completed" },
  PARTIAL: { label: "Parcial", variant: "pending" },
  IGNORED: { label: "Ignorado", variant: "muted" },
  DISPUTED: { label: "Em disputa", variant: "cancelled" },
};

/**
 * Maps a 0–100 confidence score to a semantic badge variant.
 *   0–29: vermelho (cancelled)
 *  30–59: laranja (preparation)
 *  60–89: amarelo (yellow)
 *  90–99: azul    (inProgress)
 *    100: verde   (completed)
 */
export function getConfidenceBadgeVariant(confidence: number): BadgeProps["variant"] {
  if (confidence >= 100) return "completed";
  if (confidence >= 90) return "inProgress";
  if (confidence >= 60) return "yellow";
  if (confidence >= 30) return "preparation";
  return "cancelled";
}

interface Props {
  status: MatchStatus;
  confidence?: number | null;
}

export function MatchStatusBadge({ status, confidence }: Props) {
  const cfg = STATUS_CONFIG[status];
  if (status === "AUTO_MATCHED" && typeof confidence === "number") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
        <Badge variant={getConfidenceBadgeVariant(confidence)} size="sm">
          {confidence}%
        </Badge>
      </div>
    );
  }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
