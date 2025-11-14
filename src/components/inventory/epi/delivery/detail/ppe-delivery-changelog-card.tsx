import { ChangelogHistory } from "@/components/ui/changelog-history";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import type { PpeDelivery } from "../../../../../types";

interface PpeDeliveryChangelogCardProps {
  delivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryChangelogCard({ delivery, className }: PpeDeliveryChangelogCardProps) {
  // Get display name for the changelog
  const entityName = delivery.item?.name && delivery.user?.name
    ? `${delivery.item.name} - ${delivery.user.name}`
    : undefined;

  return (
    <ChangelogHistory
      entityType={CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY}
      entityId={delivery.id}
      entityName={entityName}
      entityCreatedAt={delivery.createdAt}
      className={className}
      maxHeight="600px"
      limit={50}
    />
  );
}
