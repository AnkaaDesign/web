import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconCalendar, IconUser, IconHistory, IconCommand } from "@tabler/icons-react";
import { CHANGE_LOG_ENTITY_TYPE_LABELS, CHANGE_LOG_ACTION_LABELS, CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ACTION } from "../../../../constants";
import { formatDate } from "../../../../utils";

interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}

interface FilterIndicatorsProps {
  filters: Record<string, any>;
  onRemoveFilter: (key: string, value?: any) => void;
  onClearAll: () => void;
}

export function FilterIndicators({ filters, onRemoveFilter, onClearAll }: FilterIndicatorsProps) {
  const indicators: FilterIndicator[] = [];

  // Entity types
  if (filters.entityTypes?.length > 0) {
    filters.entityTypes.forEach((type: string) => {
      indicators.push({
        key: `entityType-${type}`,
        label: "Entidade",
        value: CHANGE_LOG_ENTITY_TYPE_LABELS[type as CHANGE_LOG_ENTITY_TYPE] || type,
        icon: <IconHistory className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("entityTypes", type),
      });
    });
  }

  // Actions
  if (filters.actions?.length > 0) {
    filters.actions.forEach((action: string) => {
      indicators.push({
        key: `action-${action}`,
        label: "Ação",
        value: CHANGE_LOG_ACTION_LABELS[action as CHANGE_LOG_ACTION] || action,
        icon: <IconCommand className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("actions", action),
      });
    });
  }

  // Triggered by
  if (filters.triggeredBy?.length > 0) {
    filters.triggeredBy.forEach((trigger: string) => {
      indicators.push({
        key: `triggeredBy-${trigger}`,
        label: "Origem",
        value: trigger.replace(/_/g, " "),
        onRemove: () => onRemoveFilter("triggeredBy", trigger),
      });
    });
  }

  // User IDs (would need user data to show names)
  if (filters.userIds?.length > 0) {
    indicators.push({
      key: "userIds",
      label: "Usuários",
      value: `${filters.userIds.length} selecionado${filters.userIds.length > 1 ? "s" : ""}`,
      icon: <IconUser className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("userIds"),
    });
  }

  // Boolean filters
  if (filters.hasUser === true) {
    indicators.push({
      key: "hasUser-true",
      label: "Com usuário",
      value: "Sim",
      onRemove: () => onRemoveFilter("hasUser"),
    });
  } else if (filters.hasUser === false) {
    indicators.push({
      key: "hasUser-false",
      label: "Sem usuário",
      value: "Sistema",
      onRemove: () => onRemoveFilter("hasUser"),
    });
  }

  if (filters.hasField === true) {
    indicators.push({
      key: "hasField",
      label: "Com campo",
      value: "Sim",
      onRemove: () => onRemoveFilter("hasField"),
    });
  }

  if (filters.hasReason === true) {
    indicators.push({
      key: "hasReason",
      label: "Com motivo",
      value: "Sim",
      onRemove: () => onRemoveFilter("hasReason"),
    });
  }

  // Date range
  if (filters.createdAt) {
    const { gte, lte } = filters.createdAt;
    let dateText = "";
    if (gte && lte) {
      dateText = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      dateText = `Após ${formatDate(gte)}`;
    } else if (lte) {
      dateText = `Até ${formatDate(lte)}`;
    }

    if (dateText) {
      indicators.push({
        key: "createdAt",
        label: "Data",
        value: dateText,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("createdAt"),
      });
    }
  }

  if (indicators.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      {indicators.map((indicator) => (
        <Badge
          key={indicator.key}
          variant="secondary"
          className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={indicator.onRemove}
        >
          {indicator.icon}
          <span className="text-xs">
            <span className="font-medium">{indicator.label}:</span> {indicator.value}
          </span>
          <IconX className="h-3 w-3 ml-0.5" />
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs">
        Limpar todos
      </Button>
    </div>
  );
}
