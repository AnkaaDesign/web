import type { ExternalWithdrawal } from "../../../../types";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";

import { ChangelogHistory } from "@/components/ui/changelog-history";

interface ExternalWithdrawalChangelogCardProps {
  withdrawal: ExternalWithdrawal;
  className?: string;
}

export function ExternalWithdrawalChangelogCard({ withdrawal, className }: ExternalWithdrawalChangelogCardProps) {
  return (
    <ChangelogHistory
      entityType={CHANGE_LOG_ENTITY_TYPE.EXTERNAL_WITHDRAWAL}
      entityId={withdrawal.id}
      entityName={`Retirada Externa - ${withdrawal.withdrawerName}`}
      entityCreatedAt={withdrawal.createdAt}
      className={className}
      maxHeight="500px"
      limit={100}
    />
  );
}
