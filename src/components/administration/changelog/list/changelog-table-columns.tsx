import React from "react";
import type { ChangeLog } from "../../../../types";
import { CHANGE_LOG_ENTITY_TYPE_LABELS, CHANGE_LOG_ACTION_LABELS, CHANGE_LOG_ACTION, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconArrowBackUpDouble, IconArchive, IconCheck, IconX, IconClock, IconEye, IconPackages } from "@tabler/icons-react";
// Define the column interface directly to avoid import issues
interface ChangelogColumn {
  key: string;
  header: string;
  accessor: (changelog: ChangeLog) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const getActionIcon = (action: CHANGE_LOG_ACTION) => {
  switch (action) {
    case CHANGE_LOG_ACTION.CREATE:
    case CHANGE_LOG_ACTION.BATCH_CREATE:
      return <IconPlus className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.UPDATE:
    case CHANGE_LOG_ACTION.BATCH_UPDATE:
      return <IconEdit className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.DELETE:
    case CHANGE_LOG_ACTION.BATCH_DELETE:
      return <IconTrash className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.RESTORE:
      return <IconRefresh className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.ROLLBACK:
      return <IconArrowBackUpDouble className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.ARCHIVE:
    case CHANGE_LOG_ACTION.UNARCHIVE:
      return <IconArchive className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.APPROVE:
      return <IconCheck className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.REJECT:
    case CHANGE_LOG_ACTION.CANCEL:
      return <IconX className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.COMPLETE:
      return <IconCheck className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.RESCHEDULE:
      return <IconClock className="h-3 w-3" />;
    case CHANGE_LOG_ACTION.VIEW:
      return <IconEye className="h-3 w-3" />;
    default:
      return <IconPackages className="h-3 w-3" />;
  }
};

const getActionVariant = (action: CHANGE_LOG_ACTION): any => {
  switch (action) {
    case CHANGE_LOG_ACTION.CREATE:
    case CHANGE_LOG_ACTION.BATCH_CREATE:
    case CHANGE_LOG_ACTION.APPROVE:
    case CHANGE_LOG_ACTION.COMPLETE:
      return "success";
    case CHANGE_LOG_ACTION.DELETE:
    case CHANGE_LOG_ACTION.BATCH_DELETE:
    case CHANGE_LOG_ACTION.REJECT:
    case CHANGE_LOG_ACTION.CANCEL:
      return "destructive";
    case CHANGE_LOG_ACTION.UPDATE:
    case CHANGE_LOG_ACTION.BATCH_UPDATE:
    case CHANGE_LOG_ACTION.RESCHEDULE:
      return "secondary";
    case CHANGE_LOG_ACTION.RESTORE:
    case CHANGE_LOG_ACTION.ROLLBACK:
    case CHANGE_LOG_ACTION.UNARCHIVE:
      return "info";
    case CHANGE_LOG_ACTION.ARCHIVE:
      return "warning";
    case CHANGE_LOG_ACTION.VIEW:
      return "outline";
    default:
      return "default";
  }
};

export const createChangelogColumns = (): ChangelogColumn[] => {
  return [
    {
      key: "createdAt",
      header: "DATA/HORA",
      accessor: (changelog: ChangeLog) => (
        <div className="text-sm">
          <div className="font-medium">{formatDateTime(changelog.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatRelativeTime(changelog.createdAt)}</div>
        </div>
      ),
      sortable: true,
      className: "w-[180px]",
    },
    {
      key: "entityType",
      header: "ENTIDADE",
      accessor: (changelog: ChangeLog) => (
        <Badge variant="outline" className="font-mono text-xs">
          {CHANGE_LOG_ENTITY_TYPE_LABELS[changelog.entityType as CHANGE_LOG_ENTITY_TYPE] || changelog.entityType}
        </Badge>
      ),
      sortable: true,
      className: "w-[150px]",
    },
    {
      key: "action",
      header: "AÇÃO",
      accessor: (changelog: ChangeLog) => {
        const action = changelog.action as CHANGE_LOG_ACTION;
        return (
          <Badge variant={getActionVariant(action)} className="gap-1">
            {getActionIcon(action)}
            {CHANGE_LOG_ACTION_LABELS[action] || action}
          </Badge>
        );
      },
      sortable: true,
      className: "w-[140px]",
    },
    {
      key: "field",
      header: "CAMPO",
      accessor: (changelog: ChangeLog) => {
        if (!changelog.field) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return <span className="font-mono text-xs">{changelog.field}</span>;
      },
      sortable: true,
      className: "w-[120px]",
    },
    {
      key: "oldValue",
      header: "VALOR ANTERIOR",
      accessor: (changelog: ChangeLog) => {
        if (changelog.oldValue === null || changelog.oldValue === undefined) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        const value = typeof changelog.oldValue === "object" ? JSON.stringify(changelog.oldValue) : String(changelog.oldValue);

        return (
          <div className="max-w-[200px]">
            <TruncatedTextWithTooltip text={value} className="text-xs font-mono text-red-600 dark:text-red-400" />
          </div>
        );
      },
      sortable: false,
      className: "w-[200px]",
    },
    {
      key: "newValue",
      header: "VALOR NOVO",
      accessor: (changelog: ChangeLog) => {
        if (changelog.newValue === null || changelog.newValue === undefined) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        const value = typeof changelog.newValue === "object" ? JSON.stringify(changelog.newValue) : String(changelog.newValue);

        return (
          <div className="max-w-[200px]">
            <TruncatedTextWithTooltip text={value} className="text-xs font-mono text-green-600 dark:text-green-400" />
          </div>
        );
      },
      sortable: false,
      className: "w-[200px]",
    },
    {
      key: "user",
      header: "USUÁRIO",
      accessor: (changelog: ChangeLog) => {
        if (!changelog.user) {
          return <span className="text-sm text-muted-foreground italic">Sistema</span>;
        }
        return (
          <div className="text-sm">
            <div className="font-medium truncate">{changelog.user.name}</div>
            {changelog.user.email && <div className="text-xs text-muted-foreground truncate">{changelog.user.email}</div>}
          </div>
        );
      },
      sortable: true,
      className: "w-[180px]",
    },
    {
      key: "reason",
      header: "MOTIVO",
      accessor: (changelog: ChangeLog) => {
        if (!changelog.reason) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="max-w-[250px]">
            <TruncatedTextWithTooltip text={changelog.reason} className="text-sm" />
          </div>
        );
      },
      sortable: false,
      className: "w-[250px]",
    },
    {
      key: "triggeredBy",
      header: "ORIGEM",
      accessor: (changelog: ChangeLog) => {
        if (!changelog.triggeredBy) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return <span className="font-mono text-xs">{changelog.triggeredBy}</span>;
      },
      sortable: true,
      className: "w-[150px]",
    },
  ];
};

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["createdAt", "entityType", "action", "field", "newValue", "user", "reason"]);
};
