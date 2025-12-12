import type { Paint } from "../../../../types";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";

interface PaintChangelogHistoryCardProps {
  paint: Paint;
}

export function PaintChangelogHistoryCard({ paint }: PaintChangelogHistoryCardProps) {
  return (
    <ChangelogHistory
      entityType={CHANGE_LOG_ENTITY_TYPE.PAINT}
      entityId={paint.id}
      entityName={paint.name}
      entityCreatedAt={paint.createdAt}
      maxHeight="600px"
      limit={50}
    />
  );
}
