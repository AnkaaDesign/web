import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  BankTransactionCategoryTag,
  ReconciliationSource,
  ReconciliationStatus,
} from "@/types/reconciliation";

export const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  PENDING: "Pendente",
  RECONCILED: "Resolvido",
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

const SOURCE_LABEL: Record<ReconciliationSource, string> = {
  AUTO: "automática",
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

/**
 * Picks black or white text for a `#RRGGBB` chip background using perceived
 * luminance (0.299r+0.587g+0.114b). Light backgrounds (luminance > 0.6) get
 * black text; darker ones get white. Returns null for unparseable colors so the
 * caller can fall back to its default styling.
 */
export function getCategoryTextColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const hex = color.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000" : "#fff";
}

interface CategoryChipsProps {
  categories: BankTransactionCategoryTag[];
  /** Max chips before collapsing the rest into a "+N" overflow chip. */
  maxVisible?: number;
  className?: string;
}

/**
 * Renders one chip per category tag. Chip color comes from the category's
 * `color` (falling back to a neutral badge); the tooltip surfaces the tag's
 * source (automática/manual) and confidence%. Beyond `maxVisible` tags a
 * "+N" overflow chip is shown whose tooltip lists the remaining names.
 */
export function CategoryChips({
  categories,
  maxVisible = 3,
  className,
}: CategoryChipsProps) {
  if (!categories || categories.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const visible = categories.slice(0, maxVisible);
  const overflow = categories.slice(maxVisible);

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
        {visible.map(tag => {
          const color = tag.category.color;
          const confidenceText =
            typeof tag.confidence === "number" ? ` · ${Math.round(tag.confidence)}%` : "";
          const tooltip = `${tag.category.name} (${SOURCE_LABEL[tag.source]}${confidenceText})`;
          return (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant={color ? undefined : "secondary"}
                  size="sm"
                  className="whitespace-nowrap border-transparent"
                  style={
                    color
                      ? { backgroundColor: color, color: getCategoryTextColor(color) ?? "#fff" }
                      : undefined
                  }
                >
                  {tag.category.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
        {overflow.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" size="sm" className="whitespace-nowrap">
                +{overflow.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {overflow.map(t => t.category.name).join(", ")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

interface Props {
  status: ReconciliationStatus;
  /** Best candidate confidence (0-100). When provided on a PENDING/PARTIAL row,
   *  a colored "40%" chip is shown next to the status for quick triage. */
  topMatchScore?: number | null;
  className?: string;
}

/**
 * Renders the reconciliation state as a status chip. Category tags live in
 * their own dedicated column (see CategoryChips) — this badge is status-only.
 * For unresolved rows it can also surface the best candidate's confidence.
 */
export function MatchStatusBadge({ status, topMatchScore, className }: Props) {
  const cfg = STATUS_VARIANT[status];
  const showScore =
    (status === "PENDING" || status === "PARTIAL") &&
    typeof topMatchScore === "number" &&
    topMatchScore > 0;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      <Badge variant={cfg} className="whitespace-nowrap">
        {STATUS_LABEL[status]}
      </Badge>
      {showScore && (
        <Badge
          variant={getConfidenceBadgeVariant(topMatchScore!)}
          size="sm"
          className="whitespace-nowrap"
          title="Confiança da melhor nota candidata"
        >
          {Math.round(topMatchScore!)}%
        </Badge>
      )}
    </div>
  );
}
