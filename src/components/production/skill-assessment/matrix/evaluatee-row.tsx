// components/production/skill-assessment/matrix/evaluatee-row.tsx
//
// One row of the leader matrix. The row is now selectable — clicking
// activates it as the target of the right-side ScoreLevelPicker. Scoring
// happens via that picker, not via inline buttons on the row.

import { useMemo } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ScoreBadge } from "../score-badge";
import type { AssessmentEntry, Topic } from "@/types";
import { ASSESSMENT_ENTRY_STATUS } from "@/constants";

interface EvaluateeRowProps {
  entry: AssessmentEntry;
  activeTopic: Topic;
  isActive: boolean;
  /** Zebra-striping index (parity-only). */
  rowIndex: number;
  /** Override score for this entry+activeTopic (from parent's optimistic map). */
  overrideScore: number | null | undefined;
  onSelect: () => void;
}

const CELL_BASE = "px-3 py-3 align-middle !border-b !border-border/30";

export function EvaluateeRow({
  entry,
  activeTopic,
  isActive,
  rowIndex,
  overrideScore,
  onSelect,
}: EvaluateeRowProps) {
  const isReadOnly = entry.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  const savedScore = useMemo<number | null>(() => {
    const r = (entry.responses ?? []).find((r) => r.topicId === activeTopic.id);
    return r?.score ?? null;
  }, [entry.responses, activeTopic.id]);

  const displayScore = overrideScore !== undefined ? overrideScore : savedScore;

  return (
    <TableRow
      onClick={onSelect}
      aria-selected={isActive}
      className={cn(
        "!border-b-0 cursor-pointer transition-colors",
        rowIndex % 2 === 1 ? "!bg-muted/15" : "!bg-transparent",
        "hover:!bg-muted/30",
        isActive && "!bg-primary/10 hover:!bg-primary/15",
        isReadOnly && "opacity-80",
      )}
    >
      <TableCell className={cn(CELL_BASE, "relative")}>
        {isActive && (
          <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary" aria-hidden />
        )}
        <span
          className="block truncate text-sm font-medium text-foreground"
          title={entry.evaluatee?.name ?? ""}
        >
          {entry.evaluatee?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-[220px]")}>
        <span
          className="block truncate text-sm text-foreground/80"
          title={entry.evaluatee?.position?.name ?? ""}
        >
          {entry.evaluatee?.position?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-[100px]")}>
        {displayScore != null ? (
          <ScoreBadge score={displayScore} size="md" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
