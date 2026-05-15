import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGoalMutations, useUpsertGoalYear } from "@/hooks/administration/use-goal";
import { GOAL_METRIC, GOAL_METRIC_UNIT } from "@/constants";
import type { Goal } from "@/types";
import { formatGoalValue } from "@/utils/goal-format";

interface GoalCellProps {
  goal?: Goal;
  /** Used when the goal record for this (month) doesn't exist yet. */
  rowKey: { metric: GOAL_METRIC; year: number; sectorId: string | null; month: number };
}

export function GoalCell({ goal, rowKey }: GoalCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateAsync } = useGoalMutations();
  const upsertYear = useUpsertGoalYear();

  const currentValue = goal ? Number(goal.targetValue) : 0;
  const unit = GOAL_METRIC_UNIT[rowKey.metric];

  const beginEdit = useCallback(() => {
    setDraft(String(currentValue));
    setEditing(true);
  }, [currentValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    const parsed = draft.trim() === "" ? 0 : Number(draft.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Informe um número válido (≥ 0).");
      setEditing(false);
      return;
    }
    if (parsed === currentValue) {
      setEditing(false);
      return;
    }
    try {
      if (goal) {
        await updateAsync({ id: goal.id, data: { targetValue: parsed } });
      } else {
        await upsertYear.mutateAsync({
          metric: rowKey.metric,
          year: rowKey.year,
          sectorId: rowKey.sectorId,
          values: [{ month: rowKey.month, targetValue: parsed }],
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao salvar.");
    } finally {
      setEditing(false);
    }
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn(
          "block h-full w-full bg-background px-4 py-4 text-right text-sm tabular-nums",
          "border-0 outline-none ring-2 ring-inset ring-primary",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={beginEdit}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          beginEdit();
        }
      }}
      className={cn(
        "block h-full w-full px-4 py-4 text-right text-sm tabular-nums cursor-pointer",
        "hover:bg-accent/60 focus:outline-none focus:bg-accent/40",
        currentValue === 0 && "text-muted-foreground",
      )}
      title="Duplo clique para editar"
    >
      {formatGoalValue(currentValue, unit, { compactCurrency: true })}
    </button>
  );
}
