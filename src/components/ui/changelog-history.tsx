import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePreviewCard } from "@/components/file";
import { CUT_TYPE_LABELS, CUT_STATUS_LABELS, CUT_ORIGIN_LABELS, AIRBRUSHING_STATUS_LABELS, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS } from "@/constants/enum-labels";
import { ENTITY_BADGE_CONFIG, PAINT_FINISH } from "@/constants";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";
import {
  IconHistory,
  IconEdit,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconArchive,
  IconArchiveOff,
  IconToggleLeft,
  IconToggleRight,
  IconCheck,
  IconX,
  IconClock,
  IconUser,
  IconAlertCircle,
  IconCalendar,
  IconArrowBackUpDouble,
  IconSparkles,
  IconTruckLoading,
  IconDroplet,
} from "@tabler/icons-react";
import type { ChangeLog } from "../../types";
import { CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ACTION, CHANGE_TRIGGERED_BY, CHANGE_LOG_ENTITY_TYPE_LABELS } from "../../constants";
import { formatRelativeTime, getFieldLabel, formatFieldValue, getActionLabel } from "../../utils";
import { useChangeLogs } from "../../hooks";
import { cn } from "@/lib/utils";
import { useEntityDetails } from "@/hooks/use-entity-details";
import { rollbackFieldChange } from "@/api-client/task";

interface ChangelogHistoryProps {
  entityType: CHANGE_LOG_ENTITY_TYPE;
  entityId: string;
  entityName?: string;
  entityCreatedAt?: Date;
  className?: string;
  maxHeight?: string;
  limit?: number;
}

// Logo component for changelog display
const LogoDisplay = ({ logoId, size = "w-12 h-12", className = "" }: { logoId?: string; size?: string; className?: string }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  if (!logoId) {
    return (
      <div className={cn("bg-muted border border-border rounded-md flex items-center justify-center", size, className)}>
        <span className="text-xs text-muted-foreground">📷</span>
      </div>
    );
  }

  if (imageError) {
    return (
      <div className={cn("bg-muted border border-border rounded-md flex items-center justify-center", size, className)}>
        <span className="text-xs text-muted-foreground">📷</span>
      </div>
    );
  }

  // Use the same API URL configuration as the API client
  const apiUrl = import.meta.env.VITE_API_URL || "http://192.168.0.13:3030";
  const imageUrl = `${apiUrl}/files/serve/${logoId}`;
  return (
    <div className={cn("relative", size, className)}>
      {imageLoading && (
        <div className={cn("absolute inset-0 bg-muted border border-border rounded-md flex items-center justify-center", size)}>
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={imageUrl}
        alt="Logo"
        className={cn("object-contain border border-border rounded-md bg-muted", size, imageLoading ? "opacity-0" : "opacity-100")}
        onError={(e) => {
          setImageError(true);
          setImageLoading(false);
        }}
        onLoad={() => {
          setImageLoading(false);
        }}
      />
    </div>
  );
};

// Map actions to icons and colors
const actionConfig: Record<CHANGE_LOG_ACTION, { icon: React.ElementType; color: string }> = {
  [CHANGE_LOG_ACTION.CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.RESTORE]: { icon: IconRefresh, color: "text-purple-600" },
  [CHANGE_LOG_ACTION.ROLLBACK]: { icon: IconArrowBackUpDouble, color: "text-blue-600" },
  [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconArchive, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: { icon: IconArchiveOff, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.ACTIVATE]: { icon: IconToggleRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.DEACTIVATE]: { icon: IconToggleLeft, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.APPROVE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.REJECT]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.CANCEL]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.COMPLETE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.RESCHEDULE]: { icon: IconClock, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.VIEW]: { icon: IconHistory, color: "text-gray-600" },
};

// Group changelog fields by entity and time
const groupChangelogsByEntity = (changelogs: ChangeLog[]) => {
  const groups: ChangeLog[][] = [];
  let currentGroup: ChangeLog[] = [];
  let currentTime: number | null = null;

  changelogs.forEach((changelog) => {
    const time = new Date(changelog.createdAt).getTime();

    // Group changes that happened within 1 second of each other
    if (!currentTime || Math.abs(time - currentTime) < 1000) {
      currentGroup.push(changelog);
      currentTime = time;
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [changelog];
      currentTime = time;
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

// Loading skeleton
const ChangelogSkeleton = () => (
  <div className="space-y-6">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="relative">
        {/* Date header skeleton */}
        <div className="flex justify-center items-center gap-4 mb-4">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
        </div>

        {/* Timeline items */}
        <div className="space-y-3 relative">
          {i < 2 && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

          {Array.from({ length: 2 }, (_, j) => (
            <div key={j} className="relative">
              {(i < 2 || j < 1) && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-12 h-12">
                  <Skeleton className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Empty state
const EmptyState = ({ entityType }: { entityType: CHANGE_LOG_ENTITY_TYPE }) => (
  <div className="text-center py-12">
    <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground mb-2">Nenhuma alteração registrada</p>
    <p className="text-sm text-muted-foreground">As alterações realizadas neste {CHANGE_LOG_ENTITY_TYPE_LABELS[entityType]?.toLowerCase() || "item"} aparecerão aqui</p>
  </div>
);

// Render cuts as cards (matching task detail page design)
const renderCutsCards = (cuts: any[]) => {
  if (!Array.isArray(cuts) || cuts.length === 0) {
    return <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>;
  }

  return (
    <div className="space-y-2 mt-2">
      {cuts.map((cut: any, index: number) => {
        // Ensure we have a proper file object for FilePreviewCard
        const fileObject = cut.file || (cut.fileId ? {
          id: cut.fileId,
          filename: 'Arquivo de recorte',
          mimetype: 'application/octet-stream',
          size: 0,
          thumbnailUrl: null,
        } : null);

        return (
          <div key={index} className="border rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 bg-card">
            {/* Cut Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-xs font-semibold truncate min-w-0 flex-1">
                  {cut.file?.filename || cut.file?.name || "Arquivo de recorte"}
                </h4>
                {cut.status && (
                  <Badge variant={ENTITY_BADGE_CONFIG.CUT?.[cut.status] || "default"} className="text-[10px] h-4 px-1.5 flex-shrink-0">
                    {CUT_STATUS_LABELS[cut.status] || cut.status}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {cut.type && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Tipo:</span>
                    <span>{CUT_TYPE_LABELS[cut.type] || cut.type}</span>
                  </div>
                )}
                {cut.quantity && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Qtd:</span>
                    <span>{cut.quantity}</span>
                  </div>
                )}
                {cut.origin && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Origem:</span>
                    <span>{CUT_ORIGIN_LABELS[cut.origin] || cut.origin}</span>
                  </div>
                )}
              </div>
            </div>

            {/* File Preview on Right */}
            {fileObject && (
              <div className="flex-shrink-0">
                <FilePreviewCard file={fileObject} size="sm" className="w-12 h-12" showActions={false} showMetadata={false} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Render services as cards
const renderServicesCards = (services: any[]) => {
  if (!Array.isArray(services) || services.length === 0) {
    return <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>;
  }

  const statusLabels: Record<string, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em Progresso",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

  return (
    <div className="space-y-2 mt-2">
      {services.map((service: any, index: number) => (
        <div key={index} className="border rounded-lg px-2.5 py-1.5 bg-card">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold truncate flex-1">
              {service.description || "Serviço"}
            </h4>
            {service.status && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                {statusLabels[service.status] || service.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Render airbrushings as cards
const renderAirbrushingsCards = (airbrushings: any[]) => {
  if (!Array.isArray(airbrushings) || airbrushings.length === 0) {
    return <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>;
  }

  return (
    <div className="space-y-2 mt-2">
      {airbrushings.map((airbrushing: any, index: number) => (
        <div key={index} className="border rounded-lg px-2.5 py-1.5 bg-card">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold truncate flex-1">
              {airbrushing.description || "Aerografia"}
            </h4>
            {airbrushing.status && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status] || airbrushing.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Render paints as cards
const renderPaintsCards = (paints: any[]) => {
  if (!Array.isArray(paints) || paints.length === 0) {
    return <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>;
  }

  return (
    <div className="space-y-2 mt-2">
      {paints.map((paint: any, index: number) => (
        <div key={paint.id || index} className="border rounded-lg px-2.5 py-1.5 bg-card">
          <div className="flex items-start gap-3">
            {/* Paint preview */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-md overflow-hidden shadow-inner border border-muted">
                <CanvasNormalMapRenderer
                  baseColor={paint.hex || "#888888"}
                  finish={(paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                  width={40}
                  height={40}
                  quality="medium"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Paint information */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-semibold truncate">{paint.name}</h4>
                <span className="text-[10px] font-mono text-muted-foreground">{paint.hex}</span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                {paint.paintType?.name && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    <IconDroplet className="h-2.5 w-2.5 mr-0.5" />
                    {paint.paintType.name}
                  </Badge>
                )}
                {paint.finish && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    <IconSparkles className="h-2.5 w-2.5 mr-0.5" />
                    {PAINT_FINISH_LABELS[paint.finish]}
                  </Badge>
                )}
                {paint.paintBrand?.name && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {paint.paintBrand.name}
                  </Badge>
                )}
                {paint.manufacturer && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    <IconTruckLoading className="h-2.5 w-2.5 mr-0.5" />
                    {TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Timeline item component
const ChangelogTimelineItem = ({
  changelogGroup,
  entityType,
  entityDetails,
  onRollback,
  rollbackLoading,
}: {
  changelogGroup: ChangeLog[];
  isLast: boolean;
  entityType: CHANGE_LOG_ENTITY_TYPE;
  entityDetails?: {
    categories: Map<string, string>;
    brands: Map<string, string>;
    suppliers: Map<string, string>;
    users: Map<string, string>;
    customers: Map<string, string>;
    sectors: Map<string, string>;
    paints: Map<string, string>;
    formulas: Map<string, string>;
    items: Map<string, string>;
    files: Map<string, string>;
    observations: Map<string, string>;
    trucks: Map<string, string>;
    garages: Map<string, string>;
  };
  onRollback?: (changeLogId: string, fieldName: string) => void;
  rollbackLoading?: string | null;
}) => {
  const firstChange = changelogGroup[0];
  const config = actionConfig[firstChange.action] || {
    icon: IconEdit,
    color: "text-gray-500",
  };

  const Icon = config.icon;

  // Format value with entity details
  const formatValueWithEntity = (value: any, field: string | null, metadata?: any) => {
    if (!field) return formatFieldValue(value, field, entityType, metadata);

    // Handle null/undefined values
    if (value === null || value === undefined) return "Nenhum";

    // Parse JSON strings if needed (backend stores as Json type which may come as strings)
    let parsedValue = value;
    if (typeof value === "string") {
      try {
        // Try to parse if it looks like JSON (starts with [ or {)
        if (value.trim().startsWith("[") || value.trim().startsWith("{")) {
          parsedValue = JSON.parse(value);
        }
      } catch (e) {
        // If parsing fails, use the original string value
        parsedValue = value;
      }
    }

    // Check if it's a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof parsedValue === "string" && uuidRegex.test(parsedValue)) {
      // Try to get entity name from fetched details
      if (entityDetails) {
        if (field === "categoryId" && entityDetails.categories.has(parsedValue)) {
          return entityDetails.categories.get(parsedValue) || "Categoria";
        }
        if (field === "brandId" && entityDetails.brands.has(parsedValue)) {
          return entityDetails.brands.get(parsedValue) || "Marca";
        }
        if (field === "supplierId" && entityDetails.suppliers.has(value)) {
          return entityDetails.suppliers.get(value) || "Fornecedor";
        }
        if ((field === "assignedToUserId" || field === "createdById") && entityDetails.users.has(value)) {
          return entityDetails.users.get(value) || "Usuário";
        }
        if (field === "customerId" && entityDetails.customers.has(value)) {
          return entityDetails.customers.get(value) || "Cliente";
        }
        if (field === "sectorId" && entityDetails.sectors.has(value)) {
          return entityDetails.sectors.get(value) || "Setor";
        }
        if (field === "paintId" && entityDetails.paints.has(value)) {
          // Return the full paint object for special rendering
          return entityDetails.paints.get(value) || "Tinta";
        }
        if ((field === "formulaId" || field === "formulaPaintId") && entityDetails.formulas.has(value)) {
          return entityDetails.formulas.get(value) || "Fórmula";
        }
        if (field === "itemId" && entityDetails.items.has(value)) {
          return entityDetails.items.get(value) || "Item";
        }
        if ((field === "budgetId" || field === "nfeId" || field === "receiptId") && entityDetails.files.has(value)) {
          return entityDetails.files.get(value) || "Arquivo";
        }
        if (field === "observationId" && entityDetails.observations.has(value)) {
          return entityDetails.observations.get(value) || "Observação";
        }
        if (field === "truckId" && entityDetails.trucks.has(value)) {
          return entityDetails.trucks.get(value) || "Caminhão";
        }
        if (field === "garageId" && entityDetails.garages.has(value)) {
          return entityDetails.garages.get(value) || "Garagem";
        }
      }

      // If entity details not available, show a placeholder
      if (field === "categoryId") return "Categoria (carregando...)";
      if (field === "brandId") return "Marca (carregando...)";
      if (field === "supplierId") return "Fornecedor (carregando...)";
      if (field === "assignedToUserId" || field === "createdById") return "Usuário (carregando...)";
      if (field === "customerId") return "Cliente (carregando...)";
      if (field === "sectorId") return "Setor (carregando...)";
      if (field === "paintId") return "Tinta (carregando...)";
      if (field === "formulaId" || field === "formulaPaintId") return "Fórmula (carregando...)";
      if (field === "itemId") return "Item (carregando...)";
      if (field === "budgetId" || field === "nfeId" || field === "receiptId") return "Arquivo (carregando...)";
      if (field === "observationId") return "Observação (carregando...)";
      if (field === "truckId") return "Caminhão (carregando...)";
      if (field === "garageId") return "Garagem (carregando...)";
    }

    // Special handling for logoId fields - render as images
    if ((field === "logoId" || field === "logo") && value && value !== "Nenhum") {
      // Check if value is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof value === "string" && uuidRegex.test(value)) {
        return (
          <div className="inline-flex items-center gap-2">
            <LogoDisplay logoId={value} size="w-12 h-12" />
            <span className="text-xs text-muted-foreground">Logo</span>
          </div>
        );
      }
    }

    // Use parsedValue to ensure arrays/objects are properly formatted
    const result = formatFieldValue(parsedValue, field, entityType, metadata);
    return result;
  };

  // Determine the action label
  const actionLabel = getActionLabel(firstChange.action as any, firstChange.triggeredBy || CHANGE_TRIGGERED_BY.USER);

  // Check if this is a CREATE action
  if (firstChange.action === CHANGE_LOG_ACTION.CREATE) {
    return (
      <div className="relative">
        <div className="flex items-start gap-4 group">
          {/* Timeline dot and icon */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12">
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", config.color)} />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            <div className="text-lg font-semibold mb-2">{actionLabel}</div>
            <div className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
              <span className="ml-3 text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-start gap-4 group">
        {/* Timeline dot and icon */}
        <div className="relative z-10 flex items-center justify-center w-12 h-12">
          <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", config.color)} />
        </div>

        {/* Change card */}
        <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">
              {/* Simplify the label for status changes */}
              {firstChange.field === "status" ? "Status" : actionLabel}
            </div>
            <div className="text-sm text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</div>
          </div>

          {/* Field changes */}
          <div className="space-y-3">
            {changelogGroup.map((changelog, index) => {
              if (!changelog.field) {
                return null;
              }

              const showSeparator = index > 0 && index < changelogGroup.length;

              return (
                <div key={changelog.id}>
                  {showSeparator && <Separator className="my-3" />}

                  {/* Field name - simplify status field */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">
                      {changelog.field === "status" ? (
                        // For status field, just show "Status" without "Campo:"
                        <span className="text-foreground font-medium">Status</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Campo: </span>
                          <span className="text-foreground font-medium">{getFieldLabel(changelog.field, entityType)}</span>
                        </>
                      )}
                    </div>

                    {/* Rollback button */}
                    {(firstChange.action === CHANGE_LOG_ACTION.UPDATE || firstChange.action === CHANGE_LOG_ACTION.ROLLBACK) &&
                      changelog.field &&
                      changelog.oldValue !== null &&
                      onRollback &&
                      entityType === CHANGE_LOG_ENTITY_TYPE.TASK && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRollback(changelog.id, getFieldLabel(changelog.field!, entityType))}
                          disabled={rollbackLoading === changelog.id}
                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          {rollbackLoading === changelog.id ? (
                            <>
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                              Revertendo...
                            </>
                          ) : (
                            <>
                              <IconArrowBackUpDouble className="w-3 h-3 mr-1" />
                              Reverter
                            </>
                          )}
                        </Button>
                      )}
                  </div>

                  {/* Values */}
                  <div className="space-y-1">
                    {changelog.oldValue !== undefined || changelog.newValue !== undefined ? (
                      <>
                        {/* Handle different cases: check special fields first, then generic cases */}
                        {changelog.field === "cuts" || changelog.field === "cutRequest" || changelog.field === "cutPlan" ? (
                          // Special handling for cuts - render as cards (handles all cases: add, remove, update)
                          (() => {
                            const parseValue = (val: any) => {
                              if (!val) return val;
                              if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
                                try {
                                  return JSON.parse(val);
                                } catch (e) {
                                  return val;
                                }
                              }
                              return val;
                            };

                            const oldParsed = parseValue(changelog.oldValue);
                            const newParsed = parseValue(changelog.newValue);

                            return (
                              <>
                                <div>
                                  <span className="text-sm text-muted-foreground">Antes:</span>
                                  {renderCutsCards(oldParsed)}
                                </div>
                                <div className="mt-3">
                                  <span className="text-sm text-muted-foreground">Depois:</span>
                                  {renderCutsCards(newParsed)}
                                </div>
                              </>
                            );
                          })()
                        ) : changelog.field === "services" ? (
                          // Special handling for services - render as cards (handles all cases: add, remove, update)
                          (() => {
                            const parseValue = (val: any) => {
                              if (!val) return val;
                              if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
                                try {
                                  return JSON.parse(val);
                                } catch (e) {
                                  return val;
                                }
                              }
                              return val;
                            };

                            const oldParsed = parseValue(changelog.oldValue);
                            const newParsed = parseValue(changelog.newValue);

                            return (
                              <>
                                <div>
                                  <span className="text-sm text-muted-foreground">Antes:</span>
                                  {renderServicesCards(oldParsed)}
                                </div>
                                <div className="mt-3">
                                  <span className="text-sm text-muted-foreground">Depois:</span>
                                  {renderServicesCards(newParsed)}
                                </div>
                              </>
                            );
                          })()
                        ) : changelog.field === "airbrushings" ? (
                          // Special handling for airbrushings - render as cards (handles all cases: add, remove, update)
                          (() => {
                            const parseValue = (val: any) => {
                              if (!val) return val;
                              if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
                                try {
                                  return JSON.parse(val);
                                } catch (e) {
                                  return val;
                                }
                              }
                              return val;
                            };

                            const oldParsed = parseValue(changelog.oldValue);
                            const newParsed = parseValue(changelog.newValue);

                            return (
                              <>
                                <div>
                                  <span className="text-sm text-muted-foreground">Antes:</span>
                                  {renderAirbrushingsCards(oldParsed)}
                                </div>
                                <div className="mt-3">
                                  <span className="text-sm text-muted-foreground">Depois:</span>
                                  {renderAirbrushingsCards(newParsed)}
                                </div>
                              </>
                            );
                          })()
                        ) : changelog.field === "paintId" ? (
                          // Special handling for paintId (general painting) - render as single paint card
                          (() => {
                            // Get full paint objects from entityDetails
                            const getFullPaint = (paintIdValue: any) => {
                              if (!paintIdValue || typeof paintIdValue !== "string") return null;
                              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                              if (!uuidRegex.test(paintIdValue)) return null;
                              return entityDetails?.paints.get(paintIdValue) || null;
                            };

                            const oldPaint = getFullPaint(changelog.oldValue);
                            const newPaint = getFullPaint(changelog.newValue);

                            return (
                              <>
                                <div>
                                  <span className="text-sm text-muted-foreground">Antes:</span>
                                  {oldPaint ? renderPaintsCards([oldPaint]) : <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>}
                                </div>
                                <div className="mt-3">
                                  <span className="text-sm text-muted-foreground">Depois:</span>
                                  {newPaint ? renderPaintsCards([newPaint]) : <span className="text-green-600 dark:text-green-400 font-medium ml-1">—</span>}
                                </div>
                              </>
                            );
                          })()
                        ) : changelog.field === "logoPaints" || changelog.field === "paints" ? (
                          // Special handling for paints - render as cards (handles all cases: add, remove, update)
                          (() => {
                            const parseValue = (val: any) => {
                              if (!val) return val;
                              if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
                                try {
                                  return JSON.parse(val);
                                } catch (e) {
                                  return val;
                                }
                              }
                              return val;
                            };

                            // Convert array of paint IDs to full paint objects
                            const getPaintObjects = (paintIds: any) => {
                              if (!paintIds || !Array.isArray(paintIds)) return null;

                              const paintObjects = paintIds
                                .map((id: string) => {
                                  // ID could be a string UUID or already a full object
                                  if (typeof id === "object" && id !== null) return id;
                                  if (typeof id !== "string") return null;

                                  // Check if it's a valid UUID
                                  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                  if (!uuidRegex.test(id)) return null;

                                  // Look up the full paint object from entityDetails
                                  return entityDetails?.paints.get(id) || null;
                                })
                                .filter(Boolean);

                              return paintObjects.length > 0 ? paintObjects : null;
                            };

                            const oldParsed = parseValue(changelog.oldValue);
                            const newParsed = parseValue(changelog.newValue);

                            const oldPaints = getPaintObjects(oldParsed);
                            const newPaints = getPaintObjects(newParsed);

                            return (
                              <>
                                <div>
                                  <span className="text-sm text-muted-foreground">Antes:</span>
                                  {renderPaintsCards(oldPaints)}
                                </div>
                                <div className="mt-3">
                                  <span className="text-sm text-muted-foreground">Depois:</span>
                                  {renderPaintsCards(newPaints)}
                                </div>
                              </>
                            );
                          })()
                        ) : changelog.oldValue !== null && changelog.newValue === null ? (
                          // Field removed (generic case for non-special fields)
                          <div className="text-sm">
                            <span className="text-muted-foreground">Removido: </span>
                            <span className="text-red-600 dark:text-red-400 font-medium line-through">
                              {formatValueWithEntity(changelog.oldValue, changelog.field, changelog.metadata)}
                            </span>
                          </div>
                        ) : Array.isArray(changelog.oldValue) && Array.isArray(changelog.newValue) && changelog.field === "phones" ? (
                          // Special handling for phone arrays - show complete lists
                          <>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Antes: </span>
                              <span className="text-red-600 dark:text-red-400 font-medium">{formatValueWithEntity(changelog.oldValue, changelog.field, changelog.metadata)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Depois: </span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {formatValueWithEntity(changelog.newValue, changelog.field, changelog.metadata)}
                              </span>
                            </div>
                          </>
                        ) : Array.isArray(changelog.oldValue) && Array.isArray(changelog.newValue) && (changelog.field === "barcodes" || changelog.field === "barcode") ? (
                          // Special handling for barcode arrays
                          <>
                            {(() => {
                              const oldBarcodes = changelog.oldValue as string[];
                              const newBarcodes = changelog.newValue as string[];
                              const added = newBarcodes.filter((bc) => !oldBarcodes.includes(bc));
                              const removed = oldBarcodes.filter((bc) => !newBarcodes.includes(bc));

                              return (
                                <>
                                  {removed.length > 0 && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Removidos: </span>
                                      <span className="text-red-600 dark:text-red-400 font-medium">{removed.join(", ")}</span>
                                    </div>
                                  )}
                                  {added.length > 0 && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Adicionados: </span>
                                      <span className="text-green-600 dark:text-green-400 font-medium">{added.join(", ")}</span>
                                    </div>
                                  )}
                                  {removed.length === 0 && added.length === 0 && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Reordenados</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        ) : changelog.field === "logoId" || changelog.field === "logo" ? (
                          // Special handling for logo fields - show "Antes" and "Depois" format
                          <>
                            <div className="text-sm flex items-center gap-2">
                              <span className="text-muted-foreground">Antes: </span>
                              {changelog.oldValue && changelog.oldValue !== null ? (
                                <LogoDisplay logoId={changelog.oldValue as string} size="w-10 h-10" />
                              ) : (
                                <span className="text-red-600 dark:text-red-400 font-medium">—</span>
                              )}
                            </div>
                            <div className="text-sm flex items-center gap-2">
                              <span className="text-muted-foreground">Depois: </span>
                              {changelog.newValue && changelog.newValue !== null ? (
                                <LogoDisplay logoId={changelog.newValue as string} size="w-10 h-10" />
                              ) : (
                                <span className="text-green-600 dark:text-green-400 font-medium">—</span>
                              )}
                            </div>
                          </>
                        ) : (
                          // Field updated - always show both "Antes:" and "Depois:" lines
                          <>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Antes: </span>
                              <span className="text-red-600 dark:text-red-400 font-medium">{formatValueWithEntity(changelog.oldValue, changelog.field, changelog.metadata)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Depois: </span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {formatValueWithEntity(changelog.newValue, changelog.field, changelog.metadata)}
                              </span>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      // No value change recorded
                      <div className="text-sm text-muted-foreground">Sem alteração de valor registrada</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            <span className="text-muted-foreground">Por: </span>
            <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ChangelogHistory({ entityType, entityId, entityName, entityCreatedAt, className, maxHeight = "500px", limit = 50 }: ChangelogHistoryProps) {
  // Rollback loading state
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  // Fetch changelogs for this specific entity
  const {
    data: changelogsResponse,
    isLoading,
    error,
    refetch,
  } = useChangeLogs({
    where: {
      entityType,
      entityId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  // Handle rollback action
  const handleRollback = async (changeLogId: string, fieldName: string) => {
    // Only allow rollback for task entities
    if (entityType !== CHANGE_LOG_ENTITY_TYPE.TASK) {
      return;
    }

    setRollbackLoading(changeLogId);

    try {
      await rollbackFieldChange({ changeLogId });

      // Success toast is handled by axios interceptor - no need to show duplicate toast

      // Refresh changelog data
      await refetch();
    } catch (error: any) {
      console.error("Rollback error:", error);

      // Error toast is also handled by axios interceptor
      // Only log the error for debugging
    } finally {
      setRollbackLoading(null);
    }
  };

  const changelogs = useMemo(() => {
    const logs = changelogsResponse?.data || [];

    // Define sensitive fields that should not be displayed
    const sensitiveFields = ["sessionToken", "verificationCode", "verificationExpiresAt", "verificationType", "password", "token", "apiKey", "secret"];

    // Filter out sensitive field changes
    const filteredLogs = logs.filter((log) => {
      if (!log.field) return true;
      // Check if the field is sensitive (case-insensitive)
      const fieldLower = log.field.toLowerCase();
      return !sensitiveFields.some((sensitive) => fieldLower.includes(sensitive.toLowerCase()));
    });

    // Only add creation entry if entityCreatedAt is provided AND there's no existing CREATE action
    if (entityCreatedAt && !isLoading) {
      // Check if there's already a CREATE action in the filtered logs
      const hasCreateAction = filteredLogs.some((log) => log.action === CHANGE_LOG_ACTION.CREATE);

      if (!hasCreateAction) {
        const creationEntry: ChangeLog = {
          id: `${entityId}-creation`,
          entityId,
          entityType: entityType as any,
          action: CHANGE_LOG_ACTION.CREATE,
          field: null,
          oldValue: null,
          newValue: null,
          reason: null,
          metadata: null,
          triggeredBy: CHANGE_TRIGGERED_BY.USER,
          triggeredById: null,
          userId: null,
          user: undefined,
          createdAt: new Date(entityCreatedAt),
          updatedAt: new Date(entityCreatedAt),
        };

        // Add creation entry at the end (oldest)
        return [...filteredLogs, creationEntry];
      }
    }

    return filteredLogs;
  }, [changelogsResponse?.data, entityCreatedAt, entityId, entityType, isLoading]);

  // Extract all entity IDs that need to be fetched
  const entityIds = useMemo(() => {
    const categoryIds = new Set<string>();
    const brandIds = new Set<string>();
    const supplierIds = new Set<string>();
    const userIds = new Set<string>();
    const customerIds = new Set<string>();
    const sectorIds = new Set<string>();
    const paintIds = new Set<string>();
    const formulaIds = new Set<string>();
    const itemIds = new Set<string>();
    const fileIds = new Set<string>();
    const observationIds = new Set<string>();
    const truckIds = new Set<string>();
    const garageIds = new Set<string>();

    changelogs.forEach((changelog) => {
      if (changelog.field === "categoryId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") categoryIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") categoryIds.add(changelog.newValue);
      } else if (changelog.field === "brandId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") brandIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") brandIds.add(changelog.newValue);
      } else if (changelog.field === "supplierId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") supplierIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") supplierIds.add(changelog.newValue);
      } else if (changelog.field === "assignedToUserId" || changelog.field === "createdById") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") userIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") userIds.add(changelog.newValue);
      } else if (changelog.field === "customerId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") customerIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") customerIds.add(changelog.newValue);
      } else if (changelog.field === "sectorId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") sectorIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") sectorIds.add(changelog.newValue);
      } else if (changelog.field === "paintId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") paintIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") paintIds.add(changelog.newValue);
      } else if (changelog.field === "logoPaints" || changelog.field === "paints") {
        // Extract paint IDs from arrays
        const extractPaintIds = (val: any) => {
          if (!val) return;
          let parsed = val;
          if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
            try {
              parsed = JSON.parse(val);
            } catch (e) {
              return;
            }
          }
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (typeof item === "string") {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(item)) {
                  paintIds.add(item);
                }
              } else if (item && typeof item === "object" && item.id) {
                paintIds.add(item.id);
              }
            });
          }
        };
        extractPaintIds(changelog.oldValue);
        extractPaintIds(changelog.newValue);
      } else if (changelog.field === "formulaId" || changelog.field === "formulaPaintId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") formulaIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") formulaIds.add(changelog.newValue);
      } else if (changelog.field === "itemId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") itemIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") itemIds.add(changelog.newValue);
      } else if (changelog.field === "budgetId" || changelog.field === "nfeId" || changelog.field === "receiptId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") fileIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") fileIds.add(changelog.newValue);
      } else if (changelog.field === "observationId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") observationIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") observationIds.add(changelog.newValue);
      } else if (changelog.field === "truckId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") truckIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") truckIds.add(changelog.newValue);
      } else if (changelog.field === "garageId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") garageIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") garageIds.add(changelog.newValue);
      }
    });

    return {
      categoryIds: Array.from(categoryIds),
      brandIds: Array.from(brandIds),
      supplierIds: Array.from(supplierIds),
      userIds: Array.from(userIds),
      customerIds: Array.from(customerIds),
      sectorIds: Array.from(sectorIds),
      paintIds: Array.from(paintIds),
      formulaIds: Array.from(formulaIds),
      itemIds: Array.from(itemIds),
      fileIds: Array.from(fileIds),
      observationIds: Array.from(observationIds),
      truckIds: Array.from(truckIds),
      garageIds: Array.from(garageIds),
    };
  }, [changelogs]);

  // Fetch entity details
  const { data: entityDetails } = useEntityDetails(entityIds);

  // Group changelogs by entity and time
  const groupedChangelogs = useMemo(() => {
    const changelogGroups = groupChangelogsByEntity(changelogs);

    // Group by date
    const dateGroups = new Map<string, typeof changelogGroups>();

    changelogGroups.forEach((group) => {
      const date = new Date(group[0].createdAt).toLocaleDateString("pt-BR");
      const existingGroups = dateGroups.get(date) || [];
      existingGroups.push(group);
      dateGroups.set(date, existingGroups);
    });

    return Array.from(dateGroups.entries()).sort((a, b) => {
      const dateA = new Date(a[0].split("/").reverse().join("-"));
      const dateB = new Date(b[0].split("/").reverse().join("-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [changelogs]);

  // Calculate summary statistics
  const changeStats = useMemo(() => {
    const totalChanges = changelogs.length;
    const recentChanges = changelogs.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;

    const uniqueUsers = new Set(changelogs.map((c) => c.userId).filter(Boolean)).size;

    const fieldChanges = changelogs.reduce(
      (acc, c) => {
        if (c.field) {
          acc[c.field] = (acc[c.field] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostChangedField = Object.entries(fieldChanges).sort(([, a], [, b]) => b - a)[0];

    return {
      totalChanges,
      recentChanges,
      uniqueUsers,
      mostChangedField: mostChangedField
        ? {
            field: getFieldLabel(mostChangedField[0], entityType),
            count: mostChangedField[1],
          }
        : null,
    };
  }, [changelogs, entityType]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Erro ao carregar histórico de alterações</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show the card if there are no changelogs
  if (!isLoading && changelogs.length === 0) {
    return null;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Histórico de Alterações
          {entityName && <span className="text-base font-normal text-muted-foreground">- {entityName}</span>}
        </CardTitle>

        {/* Summary stats */}
        {changeStats.totalChanges > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconEdit className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Total de Alterações</span>
                </div>
                <p className="text-2xl font-bold">{changeStats.totalChanges}</p>
              </div>
            </div>

            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconClock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Últimos 7 Dias</span>
                </div>
                <p className="text-2xl font-bold">{changeStats.recentChanges}</p>
              </div>
            </div>

            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconUser className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Usuários Envolvidos</span>
                </div>
                <p className="text-2xl font-bold">{changeStats.uniqueUsers}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {isLoading ? (
          <ChangelogSkeleton />
        ) : changelogs.length === 0 ? (
          <EmptyState entityType={entityType} />
        ) : (
          <ScrollArea className="pr-4 flex-grow" style={{ maxHeight }}>
            <div className="space-y-6">
              {groupedChangelogs.map(([date, dayChangelogGroups], groupIndex) => {
                const isLastGroup = groupIndex === groupedChangelogs.length - 1;

                return (
                  <div key={date} className="relative">
                    {/* Date Header */}
                    <div className="pb-1 mb-4 rounded-md">
                      <div className="flex justify-center items-center gap-4">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50">
                          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">{date}</span>
                        </div>
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                      </div>
                    </div>

                    {/* Changes for this date */}
                    <div className="space-y-3 relative">
                      {/* Timeline line */}
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {dayChangelogGroups.map((changelogGroup, index) => {
                        const isLastChange = isLastGroup && index === dayChangelogGroups.length - 1;

                        return (
                          <div key={changelogGroup[0].id} className="relative">
                            {/* Timeline line connector */}
                            {!isLastChange && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <ChangelogTimelineItem
                              changelogGroup={changelogGroup}
                              isLast={isLastChange}
                              entityType={entityType}
                              entityDetails={entityDetails}
                              onRollback={handleRollback}
                              rollbackLoading={rollbackLoading}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
