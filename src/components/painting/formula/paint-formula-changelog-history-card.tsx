import type { PaintFormula } from "../../../types";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";

interface PaintFormulaChangelogHistoryCardProps {
  formula: PaintFormula;
}

export function PaintFormulaChangelogHistoryCard({ formula }: PaintFormulaChangelogHistoryCardProps) {
  return (
    <ChangelogHistory
      entityType={CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA}
      entityId={formula.id}
      entityName={`Fórmula: ${formula.description}`}
      entityCreatedAt={formula.createdAt}
      maxHeight="600px"
      limit={50}
    />
  );
}
