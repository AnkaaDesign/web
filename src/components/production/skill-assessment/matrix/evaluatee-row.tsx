// components/production/skill-assessment/matrix/evaluatee-row.tsx
//
// One row of the leader matrix. Pure autosave — no per-row Submit button,
// no Justification column. Layout is reflow-free: every cell is a fixed
// width and the in-button spinner replaces the digit (same glyph size),
// so a save does NOT shift any column boundary.

import { useMemo } from "react";
import { toast } from "@/components/ui/sonner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ScoreCell } from "./score-cell";
import { useResponseCell } from "@/hooks/skill/use-response-cell";
import type { AssessmentEntry, Topic } from "@/types";
import { ASSESSMENT_ENTRY_STATUS } from "@/constants";

interface EvaluateeRowProps {
  entry: AssessmentEntry;
  activeTopic: Topic;
  totalTopics: number;
  scoredCount: number;
  missingJustificationsCount: number;
  onCellHover: (score: number | null) => void;
}

const statusVariant = (status: string, complete: boolean) => {
  if (status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) return "default" as const;
  if (complete) return "default" as const;
  if (status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) return "secondary" as const;
  return "outline" as const;
};

const statusLabel = (status: string, complete: boolean) => {
  if (status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) return "Enviada";
  if (complete) return "Concluída";
  if (status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) return "Em progresso";
  return "Pendente";
};

// Common cell helper: kills the default TableCell padding (16px) and uses
// a taller, more breathable rhythm + soft bottom border for the row
// separator. The "!" on border-b is needed to beat the per-row
// `!border-b-0` override.
const CELL_BASE =
  "px-3 py-4 align-middle !border-b !border-border/30";

export function EvaluateeRow({
  entry,
  activeTopic,
  totalTopics,
  scoredCount,
  onCellHover,
}: EvaluateeRowProps) {
  const isReadOnly = entry.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  const savedResponse = useMemo(
    () => (entry.responses ?? []).find((r) => r.topicId === activeTopic.id),
    [entry.responses, activeTopic.id],
  );

  const cell = useResponseCell({
    entryId: entry.id,
    topicId: activeTopic.id,
    savedScore: savedResponse?.score ?? null,
    savedJustification: savedResponse?.justification ?? "",
    disabled: isReadOnly,
    onError: (err) => toast.error(err.message ?? "Falha ao salvar"),
  });

  const complete = totalTopics > 0 && scoredCount === totalTopics;

  return (
    <TableRow
      className={cn(
        // Neutralise the default zebra + heavy border baked into TableRow.
        "!border-b-0 !bg-transparent hover:!bg-muted/30 transition-colors",
        isReadOnly && "opacity-70",
      )}
      onMouseLeave={() => onCellHover(null)}
    >
      <TableCell className={cn(CELL_BASE, "w-[220px]")}>
        <span
          className="block truncate text-sm font-medium leading-tight"
          title={entry.evaluatee?.name ?? ""}
        >
          {entry.evaluatee?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-[180px]")}>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={entry.evaluatee?.position?.name ?? ""}
        >
          {entry.evaluatee?.position?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell
        className={cn(CELL_BASE, "w-[240px]")}
        onMouseEnter={() => onCellHover(cell.score)}
      >
        <ScoreCell
          value={cell.score}
          isSaving={cell.isSaving}
          disabled={isReadOnly}
          onChange={cell.setScore}
          ariaLabel={`Nota de ${entry.evaluatee?.name ?? "avaliado"} em ${activeTopic.title}`}
        />
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-[100px] text-center")}>
        <span
          className={cn(
            "inline-flex h-6 min-w-[3.5rem] items-center justify-center rounded-full px-2 text-[11px] font-medium tabular-nums",
            complete
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          {scoredCount}/{totalTopics}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-[130px]")}>
        <Badge
          variant={statusVariant(entry.status, complete)}
          className="text-[10px]"
        >
          {statusLabel(entry.status, complete)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
