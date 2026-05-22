import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import type {
  ReconciliationCategory,
  ReconciliationSource,
  ReconciliationStatus,
} from "@/types/reconciliation";

export const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  PENDING: "Pendente",
  RECONCILED: "Conciliado",
  PARTIAL: "Parcial",
  IGNORED: "Ignorado",
  DISPUTED: "Em disputa",
};

const STATUS_VARIANT: Record<
  ReconciliationStatus,
  "completed" | "pending" | "inProgress" | "muted" | "cancelled"
> = {
  PENDING: "pending",
  RECONCILED: "completed",
  PARTIAL: "pending",
  IGNORED: "muted",
  DISPUTED: "cancelled",
};

export const CATEGORY_LABEL: Record<ReconciliationCategory, string> = {
  NF: "NF",
  TRIBUTO: "Tributo",
  FOLHA: "Folha",
  TRANSFERENCIA: "Transferência",
  TARIFA_BANCARIA: "Tarifa Bancária",
  CONVENIO: "Convênio",
  PRO_LABORE: "Pró-Labore",
  ALUGUEL: "Aluguel",
  ESTORNO: "Estorno",
  OUTROS: "Outros",
  UNCLASSIFIED: "Não classificado",
};

// Only MANUAL is annotated — AUTO is the default state and would just add
// visual noise. The filter sheet still exposes both sources for querying.
const SOURCE_LABEL: Partial<Record<ReconciliationSource, string>> = {
  MANUAL: "manual",
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
  status: ReconciliationStatus;
  category?: ReconciliationCategory;
  source?: ReconciliationSource | null;
  // NF confidence score, only displayed when the row is RECONCILED via NF auto-match.
  confidence?: number | null;
  className?: string;
}

/**
 * Renders the reconciliation state as a two-part chip:
 *
 *   [Status] · [Category] (source) [· confidence%]
 *
 * Example: "Conciliado · Tarifa Bancária (auto)"
 * Example: "Conciliado · NF (auto) · 92%"
 * Example: "Pendente · NF"
 *
 * Skips the category chip when UNCLASSIFIED — only the status appears.
 */
export function MatchStatusBadge({
  status,
  category,
  source,
  confidence,
  className,
}: Props) {
  const cfg = STATUS_VARIANT[status];
  const showCategory = category && category !== "UNCLASSIFIED";
  const showConfidence =
    status === "RECONCILED" &&
    category === "NF" &&
    source === "AUTO" &&
    typeof confidence === "number";

  const parts: string[] = [STATUS_LABEL[status]];
  if (showCategory) parts.push(`· ${CATEGORY_LABEL[category!]}`);
  const sourceTag = source && status === "RECONCILED" ? SOURCE_LABEL[source] : undefined;
  if (sourceTag) parts.push(`(${sourceTag})`);
  if (showConfidence) parts.push(`· ${confidence}%`);

  return (
    <Badge variant={cfg} className={`whitespace-nowrap ${className ?? ""}`}>
      {parts.join(" ")}
    </Badge>
  );
}
