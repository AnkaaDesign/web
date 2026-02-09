import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FilePreviewCard } from "@/components/common/file";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import {
  IconHistory,
  IconEdit,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
  IconCalendar,
  IconClock,
  IconUser,
} from "@tabler/icons-react";
import type { ChangeLog } from "../../types";
import {
  CHANGE_LOG_ENTITY_TYPE,
  CHANGE_LOG_ACTION,
  CHANGE_TRIGGERED_BY,
  SERVICE_ORDER_TYPE,
  SECTOR_PRIVILEGES,
} from "../../constants";
import { useCurrentUser } from "../../hooks";
import { getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";
import {
  SERVICE_ORDER_TYPE_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  CUT_TYPE_LABELS,
  CUT_STATUS_LABELS,
  CUT_ORIGIN_LABELS,
  AIRBRUSHING_STATUS_LABELS,
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
} from "../../constants/enum-labels";
import { ENTITY_BADGE_CONFIG, PAINT_FINISH } from "../../constants";
import {
  formatRelativeTime,
  formatDateTime,
  getFieldLabel,
  formatFieldValue,
  getActionLabel,
} from "../../utils";
import { useChangeLogs } from "../../hooks";
import { useEntityDetails } from "@/hooks/common/use-entity-details";
import { cn } from "@/lib/utils";

// Logo component for changelog display
const LogoDisplay = ({
  logoId,
  size = "w-12 h-12",
  className = "",
  useThumbnail = false,
}: {
  logoId?: string;
  size?: string;
  className?: string;
  useThumbnail?: boolean;
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  if (!logoId) {
    return (
      <div
        className={cn(
          "bg-muted border border-border rounded-md flex items-center justify-center",
          size,
          className,
        )}
      >
        <span className="text-xs text-muted-foreground">📷</span>
      </div>
    );
  }

  if (imageError) {
    return (
      <div
        className={cn(
          "bg-muted border border-border rounded-md flex items-center justify-center",
          size,
          className,
        )}
      >
        <span className="text-xs text-muted-foreground">📷</span>
      </div>
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL || "http://192.168.10.169:3030";
  const imageUrl = useThumbnail
    ? `${apiUrl}/files/thumbnail/${logoId}`
    : `${apiUrl}/files/serve/${logoId}`;
  return (
    <div className={cn("relative", size, className)}>
      {imageLoading && (
        <div
          className={cn(
            "absolute inset-0 bg-muted border border-border rounded-md flex items-center justify-center",
            size,
          )}
        >
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={imageUrl}
        alt="Preview"
        className={cn(
          "object-cover border border-border rounded-md bg-muted",
          size,
          imageLoading ? "opacity-0" : "opacity-100",
        )}
        onError={() => {
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

// Render cuts as cards (matching task detail page design)
const renderCutsCards = (cuts: any[]) => {
  if (!Array.isArray(cuts) || cuts.length === 0) {
    return (
      <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {cuts.map((cut: any, index: number) => {
        const fileObject =
          cut.file ||
          (cut.fileId
            ? {
                id: cut.fileId,
                filename: "Arquivo de recorte",
                mimetype: "application/octet-stream",
                size: 0,
                thumbnailUrl: null,
              }
            : null);

        return (
          <div
            key={index}
            className="border rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 bg-card"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-xs font-semibold truncate min-w-0 flex-1">
                  {cut.file?.filename || cut.file?.name || "Arquivo de recorte"}
                </h4>
                {cut.status && (
                  <Badge
                    variant={ENTITY_BADGE_CONFIG.CUT?.[cut.status] || "default"}
                    className="text-[10px] h-4 px-1.5 flex-shrink-0"
                  >
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
            {fileObject && (
              <div className="flex-shrink-0">
                <FilePreviewCard
                  file={fileObject}
                  size="sm"
                  className="w-12 h-12"
                  showActions={false}
                  showMetadata={false}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Render services as cards - enhanced to match service order component
const renderServicesCards = (services: any[]) => {
  if (!Array.isArray(services) || services.length === 0) {
    return null;
  }

  const typeLabels: Record<string, string> = {
    PRODUCTION: "Produção",
    ART: "Arte",
    AIRBRUSH: "Aerografia",
    OTHER: "Outro",
  };

  return (
    <div className="space-y-3 mt-2">
      {services.map((service: any, index: number) => (
        <div key={index} className="border rounded-lg p-3 bg-card space-y-2">
          {/* Description */}
          {service.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Descrição: </span>
              <span className="text-foreground font-medium">
                {service.description}
              </span>
            </div>
          )}

          {/* Type */}
          {service.type && (
            <div className="text-sm">
              <span className="text-muted-foreground">Tipo: </span>
              <span className="text-foreground font-medium">
                {typeLabels[service.type] || service.type}
              </span>
            </div>
          )}

          {/* Status - REMOVED as service orders have their own changelog */}

          {/* Timestamps - REMOVED as service orders have their own changelog */}

          {/* Assigned user */}
          {service.assignedTo?.name && (
            <div className="text-sm">
              <span className="text-muted-foreground">Responsável: </span>
              <span className="text-foreground">{service.assignedTo.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Render airbrushings as cards
const renderAirbrushingsCards = (airbrushings: any[]) => {
  if (!Array.isArray(airbrushings) || airbrushings.length === 0) {
    return (
      <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>
    );
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
              <Badge
                variant="secondary"
                className="text-[10px] h-4 px-1.5 flex-shrink-0"
              >
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status] ||
                  airbrushing.status}
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
    return (
      <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {paints.map((paint: any, index: number) => (
        <div
          key={paint.id || index}
          className="border dark:border-border/40 rounded-lg px-2.5 py-1.5 bg-card"
        >
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-md ring-1 ring-border shadow-sm overflow-hidden">
                {paint.colorPreview ? (
                  <img
                    src={paint.colorPreview}
                    alt={paint.name}
                    className="w-full h-full object-cover rounded-md"
                    loading="lazy"
                  />
                ) : (
                  <CanvasNormalMapRenderer
                    baseColor={paint.hex || "#888888"}
                    finish={
                      (paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID
                    }
                    width={40}
                    height={40}
                    quality="medium"
                    className="w-full h-full object-cover rounded-md"
                  />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-semibold truncate">{paint.name}</h4>
                {paint.code && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {paint.code}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {paint.paintType?.name && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0">
                    {paint.paintType.name}
                  </Badge>
                )}
                {paint.finish && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0">
                    {PAINT_FINISH_LABELS[paint.finish]}
                  </Badge>
                )}
                {paint.paintBrand?.name && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0">
                    {paint.paintBrand.name}
                  </Badge>
                )}
                {paint.manufacturer && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0">
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

interface TaskWithServiceOrdersChangelogProps {
  taskId: string;
  taskName?: string;
  taskCreatedAt?: Date;
  serviceOrderIds: string[];
  truckId?: string;
  layoutIds?: string[];
  className?: string;
  maxHeight?: string;
  limit?: number;
}

// Map actions to icons and colors (matching ChangelogHistory)
const actionConfig: Record<
  CHANGE_LOG_ACTION,
  { icon: React.ElementType; color: string }
> = {
  [CHANGE_LOG_ACTION.CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.RESTORE]: { icon: IconRefresh, color: "text-purple-600" },
  [CHANGE_LOG_ACTION.ROLLBACK]: { icon: IconRefresh, color: "text-blue-600" },
  [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconTrash, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: { icon: IconPlus, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.ACTIVATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.DEACTIVATE]: { icon: IconTrash, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.APPROVE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.REJECT]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.CANCEL]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.COMPLETE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: {
    icon: IconEdit,
    color: "text-neutral-600",
  },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.VIEW]: { icon: IconHistory, color: "text-gray-600" },
};

// Group changelog fields by entity and time (matching ChangelogHistory)
// CREATE actions for different entities are kept separate (each CREATE = own group)
// EXCEPT for LAYOUT CREATE actions which are grouped by time (to show all sides together)
// UPDATE actions on the same entity within 1 second are grouped together
const groupChangelogsByEntity = (changelogs: ChangeLog[]) => {
  const groups: ChangeLog[][] = [];
  let currentGroup: ChangeLog[] = [];
  let currentTime: number | null = null;
  let currentEntityId: string | null = null;
  let currentAction: string | null = null;
  let currentEntityType: string | null = null;

  changelogs.forEach((changelog) => {
    const time = new Date(changelog.createdAt).getTime();
    const isCreateAction = changelog.action === CHANGE_LOG_ACTION.CREATE;
    const isLayoutEntity =
      changelog.entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT;

    // For LAYOUT CREATE actions, group by time (within 1 second) to combine all sides
    if (isCreateAction && isLayoutEntity) {
      // Check if we can add to current group (same entity type, within 1 second)
      const canGroupWithCurrent =
        currentEntityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT &&
        currentAction === CHANGE_LOG_ACTION.CREATE &&
        currentTime !== null &&
        Math.abs(time - currentTime) < 1000;

      if (canGroupWithCurrent) {
        currentGroup.push(changelog);
        currentTime = time;
      } else {
        // Start a new group
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [changelog];
        currentTime = time;
        currentEntityId = changelog.entityId;
        currentAction = changelog.action;
        currentEntityType = changelog.entityType;
      }
      return;
    }

    // CREATE actions for non-LAYOUT entities should always be separate groups
    // This ensures each "Ordem de Serviço Criada" is displayed separately
    if (isCreateAction) {
      // Finish current group if exists
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      // CREATE action gets its own group
      groups.push([changelog]);
      currentGroup = [];
      currentTime = null;
      currentEntityId = null;
      currentAction = null;
      currentEntityType = null;
      return;
    }

    // For non-CREATE actions, group by time AND entity
    const shouldGroup =
      currentTime !== null &&
      Math.abs(time - currentTime) < 1000 &&
      currentEntityId === changelog.entityId &&
      currentAction !== CHANGE_LOG_ACTION.CREATE;

    if (shouldGroup) {
      currentGroup.push(changelog);
      currentTime = time;
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [changelog];
      currentTime = time;
      currentEntityId = changelog.entityId;
      currentAction = changelog.action;
      currentEntityType = changelog.entityType;
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

// Loading skeleton (matching ChangelogHistory)
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
          {i < 2 && (
            <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
          )}

          {Array.from({ length: 2 }, (_, j) => (
            <div key={j} className="relative">
              {(i < 2 || j < 1) && (
                <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
              )}

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

// Format field values with entity resolution
const formatValueWithEntity = (
  value: any,
  field: string | null,
  entityType: CHANGE_LOG_ENTITY_TYPE,
  entityDetails: any,
  metadata?: any,
) => {
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
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof parsedValue === "string" && uuidRegex.test(parsedValue)) {
    // Try to get entity name from fetched details
    if (entityDetails) {
      if (field === "customerId" && entityDetails.customers.has(parsedValue)) {
        return entityDetails.customers.get(parsedValue) || "Cliente";
      }
      if (field === "sectorId" && entityDetails.sectors.has(parsedValue)) {
        return entityDetails.sectors.get(parsedValue) || "Setor";
      }
      if (field === "paintId" && entityDetails.paints.has(parsedValue)) {
        const paint = entityDetails.paints.get(parsedValue);
        return paint?.name || "Tinta";
      }
      if (field === "invoiceToId" && entityDetails.customers.has(parsedValue)) {
        return entityDetails.customers.get(parsedValue) || "Cliente";
      }
      if (field === "truckId" && entityDetails.trucks.has(parsedValue)) {
        return entityDetails.trucks.get(parsedValue) || "Caminhão";
      }
    }

    // If entity details not available, show a placeholder
    if (field === "customerId") return "Cliente (carregando...)";
    if (field === "sectorId") return "Setor (carregando...)";
    if (field === "paintId") return "Tinta (carregando...)";
    if (field === "invoiceToId") return "Cliente (carregando...)";
    if (field === "truckId") return "Caminhão (carregando...)";
  }

  // Use parsedValue to ensure arrays/objects are properly formatted
  const result = formatFieldValue(parsedValue, field, entityType, metadata);
  return result;
};

// Timeline item component (matching ChangelogHistory)
const ChangelogTimelineItem = ({
  changelogGroup,
  entityType,
  entityDetails,
  userSectorPrivilege,
}: {
  changelogGroup: ChangeLog[];
  isLast: boolean;
  entityType: CHANGE_LOG_ENTITY_TYPE;
  entityDetails: any;
  userSectorPrivilege?: SECTOR_PRIVILEGES;
}) => {
  const firstChange = changelogGroup[0];
  const config = actionConfig[firstChange.action] || {
    icon: IconEdit,
    color: "text-gray-500",
  };

  const Icon = config.icon;

  // Get entity type label
  const entityTypeLabel =
    entityType === CHANGE_LOG_ENTITY_TYPE.TASK
      ? "Tarefa"
      : entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER
        ? "Ordem de Serviço"
        : entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK
          ? "Caminhão"
          : entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT
            ? "Layout"
            : "";

  // Determine the action label
  const actionLabel = getActionLabel(
    firstChange.action as any,
    firstChange.triggeredBy || CHANGE_TRIGGERED_BY.USER,
    firstChange.metadata as { sourceTaskName?: string } | undefined,
  );

  // Check if this is a CREATE action
  if (firstChange.action === CHANGE_LOG_ACTION.CREATE) {
    // Extract entity details from newValue (renamed to avoid shadowing the prop)
    let createdEntityData: any = null;
    try {
      if (firstChange.newValue) {
        createdEntityData =
          typeof firstChange.newValue === "string"
            ? JSON.parse(firstChange.newValue)
            : firstChange.newValue;
      }
    } catch (e) {
      // Failed to parse, will show basic info only
    }

    // Resolve user name for assignedToId from the fetched entityDetails
    const assignedUserName =
      createdEntityData?.assignedToId && entityDetails?.users
        ? entityDetails.users.get(createdEntityData.assignedToId)?.name
        : null;

    return (
      <div className="relative">
        <div className="flex items-start gap-4 group">
          {/* Timeline dot and icon */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12">
            <Icon
              className={cn(
                "h-5 w-5 transition-transform group-hover:scale-110",
                config.color,
              )}
            />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">
                {entityTypeLabel}{" "}
                {entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER
                  ? "Criada"
                  : actionLabel}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatRelativeTime(firstChange.createdAt)}
              </div>
            </div>

            {/* Entity Details */}
            {createdEntityData && (
              <div className="mb-3 space-y-1">
                {/* Service Order Details */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER && (
                  <>
                    {createdEntityData.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Descrição:{" "}
                        </span>
                        <span className="text-foreground font-medium">
                          {createdEntityData.description}
                        </span>
                      </div>
                    )}
                    {createdEntityData.type && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tipo: </span>
                        <span className="text-foreground font-medium">
                          {SERVICE_ORDER_TYPE_LABELS[
                            createdEntityData.type as keyof typeof SERVICE_ORDER_TYPE_LABELS
                          ] || createdEntityData.type}
                        </span>
                      </div>
                    )}
                    {createdEntityData.status && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Status: </span>
                        <span className="text-foreground font-medium">
                          {SERVICE_ORDER_STATUS_LABELS[
                            createdEntityData.status as keyof typeof SERVICE_ORDER_STATUS_LABELS
                          ] || createdEntityData.status}
                        </span>
                      </div>
                    )}
                    {createdEntityData.assignedToId && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Atribuído a:{" "}
                        </span>
                        <span className="text-foreground font-medium">
                          {assignedUserName || "Usuário atribuído"}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Truck Details */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK && (
                  <>
                    {createdEntityData.plate && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Placa: </span>
                        <span className="text-foreground font-medium">
                          {createdEntityData.plate}
                        </span>
                      </div>
                    )}
                    {createdEntityData.chassisNumber && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Chassi: </span>
                        <span className="text-foreground font-medium">
                          {createdEntityData.chassisNumber}
                        </span>
                      </div>
                    )}
                    {createdEntityData.spot && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Localização:{" "}
                        </span>
                        <span className="text-foreground font-medium">
                          {formatFieldValue(
                            createdEntityData.spot,
                            "spot",
                            entityType,
                          )}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Layout Details - Show all layouts in group horizontally */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT && (
                  <div className="flex flex-row flex-wrap gap-3 my-2">
                    {changelogGroup
                      .map((layoutChange) => {
                        let layoutDetails: any = null;
                        try {
                          if (layoutChange.newValue) {
                            layoutDetails =
                              typeof layoutChange.newValue === "string"
                                ? JSON.parse(layoutChange.newValue)
                                : layoutChange.newValue;
                          }
                        } catch (e) {
                          return null;
                        }

                        if (
                          !layoutDetails?.layoutSections ||
                          layoutDetails.layoutSections.length === 0
                        ) {
                          return null;
                        }

                        // Calculate dimensions
                        const height = Math.round(
                          (layoutDetails.height || 0) * 100,
                        );
                        const totalWidth = Math.round(
                          layoutDetails.layoutSections.reduce(
                            (sum: number, s: any) => sum + (s.width || 0) * 100,
                            0,
                          ),
                        );

                        // Detect side from reason - backend uses "lado left/right/back" format
                        const reason = layoutChange.reason?.toLowerCase() || "";
                        const sideName =
                          reason.includes("lado left") ||
                          reason.includes("leftside")
                            ? "Lado Motorista"
                            : reason.includes("lado right") ||
                                reason.includes("rightside")
                              ? "Lado Sapo"
                              : reason.includes("lado back") ||
                                  reason.includes("backside") ||
                                  reason.includes("traseira")
                                ? "Traseira"
                                : "Layout";

                        // Determine sort order: left=1, right=2, back=3, other=4
                        const sortOrder =
                          reason.includes("lado left") ||
                          reason.includes("leftside")
                            ? 1
                            : reason.includes("lado right") ||
                                reason.includes("rightside")
                              ? 2
                              : reason.includes("lado back") ||
                                  reason.includes("backside") ||
                                  reason.includes("traseira")
                                ? 3
                                : 4;

                        return {
                          layoutChange,
                          layoutDetails,
                          sideName,
                          sortOrder,
                          totalWidth,
                          height,
                        };
                      })
                      .filter(Boolean)
                      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                      .map(
                        ({
                          layoutChange,
                          sideName,
                          totalWidth,
                          height,
                        }: any) => (
                          <div
                            key={layoutChange.id}
                            className="border dark:border-border/40 rounded-lg px-2.5 py-1.5 bg-muted/30 inline-flex items-center gap-2"
                          >
                            <span className="text-xs font-medium">
                              {sideName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {totalWidth}cm × {height}cm
                            </span>
                          </div>
                        ),
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">
                {firstChange.user?.name || "Sistema"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DELETE action
  if (firstChange.action === CHANGE_LOG_ACTION.DELETE) {
    return (
      <div className="relative">
        <div className="flex items-start gap-4 group">
          {/* Timeline dot and icon */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12">
            <Icon
              className={cn(
                "h-5 w-5 transition-transform group-hover:scale-110",
                config.color,
              )}
            />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            <div className="text-lg font-semibold mb-2">
              {entityTypeLabel} {actionLabel}
            </div>
            {firstChange.reason && (
              <div className="text-sm text-muted-foreground mb-2">
                {firstChange.reason}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">
                {firstChange.user?.name || "Sistema"}
              </span>
              <span className="ml-3 text-muted-foreground">
                {formatRelativeTime(firstChange.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SERVICE_ORDER UPDATE - Special handling to group related changes
  if (
    entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
    firstChange.action === CHANGE_LOG_ACTION.UPDATE
  ) {
    // Get service order details from entityDetails
    const serviceOrderDetails = entityDetails?.serviceOrders?.get(
      firstChange.entityId,
    );

    // Group related field changes intelligently for service orders
    const statusChange = changelogGroup.find((c) => c.field === "status");
    const descriptionChange = changelogGroup.find(
      (c) => c.field === "description",
    );
    const typeChange = changelogGroup.find((c) => c.field === "type");
    const timestampChanges = changelogGroup.filter((c) =>
      ["startedAt", "finishedAt", "approvedAt", "completedAt"].includes(
        c.field || "",
      ),
    );
    const userChanges = changelogGroup.filter((c) =>
      ["startedById", "completedById", "approvedById"].includes(c.field || ""),
    );
    const otherChanges = changelogGroup.filter(
      (c) =>
        c.field &&
        ![
          "status",
          "statusOrder",
          "description",
          "type",
          "startedAt",
          "finishedAt",
          "approvedAt",
          "completedAt",
          "startedById",
          "completedById",
          "approvedById",
        ].includes(c.field),
    );

    // Build a summary of the status change
    let statusSummary: {
      title: string;
      details: string[];
      timestamp?: string;
      user?: string;
    } | null = null;

    if (statusChange) {
      const newStatus = statusChange.newValue;
      const oldStatus = statusChange.oldValue;
      const newStatusLabel =
        SERVICE_ORDER_STATUS_LABELS[
          newStatus as keyof typeof SERVICE_ORDER_STATUS_LABELS
        ] || newStatus;
      const oldStatusLabel =
        SERVICE_ORDER_STATUS_LABELS[
          oldStatus as keyof typeof SERVICE_ORDER_STATUS_LABELS
        ] || oldStatus;

      statusSummary = {
        title: `Status: ${oldStatusLabel} → ${newStatusLabel}`,
        details: [],
      };

      // Add timestamp if available
      const relevantTimestamp = timestampChanges.find((c) => {
        if (newStatus === "IN_PROGRESS" && c.field === "startedAt") return true;
        if (
          newStatus === "COMPLETED" &&
          (c.field === "finishedAt" || c.field === "completedAt")
        )
          return true;
        if (newStatus === "WAITING_APPROVE" && c.field === "approvedAt")
          return true;
        return false;
      });
      if (relevantTimestamp?.newValue) {
        // Parse the value - handle both double-encoded (old data) and correct format (new data)
        let dateValue = relevantTimestamp.newValue;

        // If the value is a string that looks like a JSON-encoded string, parse it
        if (
          typeof dateValue === "string" &&
          dateValue.startsWith('"') &&
          dateValue.endsWith('"')
        ) {
          try {
            dateValue = JSON.parse(dateValue);
          } catch (e) {
            // If parsing fails, use as-is
          }
        }

        statusSummary.timestamp = formatDateTime(dateValue);
      }

      // Add user info if available
      const relevantUser = userChanges.find((c) => {
        if (newStatus === "IN_PROGRESS" && c.field === "startedById")
          return true;
        if (newStatus === "COMPLETED" && c.field === "completedById")
          return true;
        if (newStatus === "WAITING_APPROVE" && c.field === "approvedById")
          return true;
        return false;
      });
      if (relevantUser?.newValue && entityDetails?.users) {
        statusSummary.user = entityDetails.users.get(
          relevantUser.newValue,
        )?.name;
      }
    }

    return (
      <div className="relative">
        <div className="flex items-start gap-4 group">
          {/* Timeline dot and icon */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12">
            <Icon
              className={cn(
                "h-5 w-5 transition-transform group-hover:scale-110",
                config.color,
              )}
            />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">
                {entityTypeLabel} Atualizada
              </div>
              <div className="text-sm text-muted-foreground">
                {formatRelativeTime(firstChange.createdAt)}
              </div>
            </div>

            {/* Service Order identification - show description and type */}
            {(descriptionChange || typeChange || serviceOrderDetails) && (
              <div className="mb-3 space-y-2">
                {(descriptionChange?.newValue ||
                  serviceOrderDetails?.description) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Descrição: </span>
                    <span className="text-foreground font-medium">
                      {descriptionChange?.newValue ||
                        serviceOrderDetails?.description}
                    </span>
                  </div>
                )}
                {(typeChange?.newValue || serviceOrderDetails?.type) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tipo: </span>
                    <span className="text-foreground font-medium">
                      {SERVICE_ORDER_TYPE_LABELS[
                        (typeChange?.newValue ||
                          serviceOrderDetails?.type) as keyof typeof SERVICE_ORDER_TYPE_LABELS
                      ] ||
                        typeChange?.newValue ||
                        serviceOrderDetails?.type}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Status change summary - matching CREATE style */}
            {statusSummary && (
              <div className="text-sm">
                <span className="text-muted-foreground">Status: </span>
                <span className="text-foreground font-medium">
                  {statusSummary.title.replace("Status: ", "")}
                </span>
              </div>
            )}

            {/* Other field changes (observation, assignedToId, etc.) */}
            {otherChanges.length > 0 && (
              <div className="space-y-2 mt-2">
                {otherChanges.map((changelog) => {
                  // Special handling for assignedToId - show only new value with resolved user name
                  if (changelog.field === "assignedToId") {
                    const newUserId = changelog.newValue;
                    const newUserName =
                      newUserId && entityDetails?.users
                        ? entityDetails.users.get(newUserId)?.name
                        : null;

                    return (
                      <div key={changelog.id} className="text-sm">
                        <span className="text-muted-foreground">
                          Atribuído a:{" "}
                        </span>
                        <span className="text-foreground font-medium">
                          {newUserName || (newUserId ? "Usuário" : "Nenhum")}
                        </span>
                      </div>
                    );
                  }

                  // Default rendering for other fields (with before/after)
                  return (
                    <div key={changelog.id} className="text-sm">
                      <span className="text-muted-foreground">
                        {getFieldLabel(changelog.field, entityType)}:{" "}
                      </span>
                      <span className="text-red-600 dark:text-red-400 line-through mr-2">
                        {formatValueWithEntity(
                          changelog.oldValue,
                          changelog.field,
                          entityType,
                          entityDetails,
                        ) || "Nenhum"}
                      </span>
                      <span className="text-green-600 dark:text-green-400">
                        {formatValueWithEntity(
                          changelog.newValue,
                          changelog.field,
                          entityType,
                          entityDetails,
                        ) || "Nenhum"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">
                {firstChange.user?.name || "Sistema"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // UPDATE action (generic)
  // Check if this is a copy operation (has custom reason with "Campos copiados")
  const isCopyOperation =
    firstChange.reason && firstChange.reason.includes("Campos copiados");
  const displayTitle = isCopyOperation
    ? firstChange.reason
    : `${entityTypeLabel} ${actionLabel}`;

  return (
    <div className="relative">
      <div className="flex items-start gap-4 group">
        {/* Timeline dot and icon */}
        <div className="relative z-10 flex items-center justify-center w-12 h-12">
          <Icon
            className={cn(
              "h-5 w-5 transition-transform group-hover:scale-110",
              config.color,
            )}
          />
        </div>

        {/* Change card */}
        <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">{displayTitle}</div>
            <div className="text-sm text-muted-foreground">
              {formatRelativeTime(firstChange.createdAt)}
            </div>
          </div>

          {/* Field changes */}
          <div className="space-y-3">
            {changelogGroup
              .filter((changelog) => {
                // Exclude internal/system fields from display
                if (changelog.field === "statusOrder") return false;
                if (changelog.field === "colorOrder") return false;

                // Filter out financial fields for non-FINANCIAL/ADMIN users
                const financialFields = [
                  "pricingId",
                  "budgetIds",
                  "invoiceIds",
                  "receiptIds",
                  "price",
                  "cost",
                  "value",
                  "totalPrice",
                  "totalCost",
                  "discount",
                  "profit",
                ];
                const canViewFinancialFields =
                  userSectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.ADMIN;
                if (
                  !canViewFinancialFields &&
                  changelog.field &&
                  financialFields.some((f) =>
                    changelog.field?.toLowerCase().includes(f.toLowerCase()),
                  )
                ) {
                  return false;
                }

                // Filter out restricted fields (forecastDate, representatives) for users who can't view them
                // Only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER can see these
                const canViewRestrictedFields =
                  userSectorPrivilege === SECTOR_PRIVILEGES.ADMIN ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.DESIGNER;
                const restrictedFields = [
                  "forecastDate",
                  "representatives",
                  "representativeIds",
                  "negotiatingWith",
                ]; // invoiceTo removed - has its own check
                if (
                  !canViewRestrictedFields &&
                  changelog.field &&
                  restrictedFields.includes(changelog.field)
                ) {
                  return false;
                }

                // Filter out invoiceTo fields - DESIGNER cannot see (only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC)
                const canViewInvoiceToField =
                  userSectorPrivilege === SECTOR_PRIVILEGES.ADMIN ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
                  userSectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC;
                const invoiceToFields = ["invoiceTo", "invoiceToId"];
                if (
                  !canViewInvoiceToField &&
                  changelog.field &&
                  invoiceToFields.includes(changelog.field)
                ) {
                  return false;
                }

                // For services field, only show if there's a meaningful change (count changed)
                if (changelog.field === "services") {
                  const parseValue = (val: any) => {
                    if (!val) return null;
                    if (
                      typeof val === "string" &&
                      (val.trim().startsWith("[") || val.trim().startsWith("{"))
                    ) {
                      try {
                        return JSON.parse(val);
                      } catch (e) {
                        return null;
                      }
                    }
                    return val;
                  };

                  const oldParsed = parseValue(changelog.oldValue);
                  const newParsed = parseValue(changelog.newValue);
                  const oldCount = Array.isArray(oldParsed)
                    ? oldParsed.length
                    : 0;
                  const newCount = Array.isArray(newParsed)
                    ? newParsed.length
                    : 0;

                  // Only show if count actually changed (services added or removed)
                  if (oldCount === newCount) {
                    return false;
                  }
                }

                return true;
              })
              .map((changelog, index) => {
                if (!changelog.field) {
                  return null;
                }

                return (
                  <div key={changelog.id}>
                    {index > 0 && <div className="my-3 border-t" />}

                    {/* Field name - Hide for services field as it renders as cards */}
                    {changelog.field !== "services" && (
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">
                          <span className="text-muted-foreground">Campo: </span>
                          <span className="text-foreground font-medium">
                            {getFieldLabel(changelog.field, entityType)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Values */}
                    <div className="space-y-1">
                      {changelog.oldValue !== undefined ||
                      changelog.newValue !== undefined ? (
                        <>
                          {/* Special handling for cuts */}
                          {changelog.field === "cuts" ||
                          changelog.field === "cutRequest" ||
                          changelog.field === "cutPlan" ? (
                            (() => {
                              const parseValue = (val: any) => {
                                if (!val) return val;
                                if (
                                  typeof val === "string" &&
                                  (val.trim().startsWith("[") ||
                                    val.trim().startsWith("{"))
                                ) {
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
                                    <span className="text-sm text-muted-foreground">
                                      Antes:
                                    </span>
                                    {renderCutsCards(oldParsed)}
                                  </div>
                                  <div className="mt-3">
                                    <span className="text-sm text-muted-foreground">
                                      Depois:
                                    </span>
                                    {renderCutsCards(newParsed)}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "services" ? (
                            (() => {
                              const parseValue = (val: any) => {
                                if (!val) return val;
                                if (
                                  typeof val === "string" &&
                                  (val.trim().startsWith("[") ||
                                    val.trim().startsWith("{"))
                                ) {
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

                              // Check if services were actually added or removed (count changed)
                              const oldCount = Array.isArray(oldParsed)
                                ? oldParsed.length
                                : 0;
                              const newCount = Array.isArray(newParsed)
                                ? newParsed.length
                                : 0;

                              // If count is the same, services weren't added/removed, just updated internally
                              // This shouldn't happen since we filter it out, but just in case
                              if (oldCount === newCount && oldCount > 0) {
                                return null;
                              }

                              // ALWAYS show Antes/Depois when count changed (more clear for user)
                              return (
                                <>
                                  {oldParsed &&
                                    Array.isArray(oldParsed) &&
                                    oldParsed.length > 0 && (
                                      <div>
                                        <span className="text-sm text-muted-foreground mb-2 block">
                                          Antes:
                                        </span>
                                        {renderServicesCards(oldParsed)}
                                      </div>
                                    )}
                                  {newParsed &&
                                    Array.isArray(newParsed) &&
                                    newParsed.length > 0 && (
                                      <div
                                        className={
                                          oldParsed &&
                                          Array.isArray(oldParsed) &&
                                          oldParsed.length > 0
                                            ? "mt-3"
                                            : ""
                                        }
                                      >
                                        <span className="text-sm text-muted-foreground mb-2 block">
                                          Depois:
                                        </span>
                                        {renderServicesCards(newParsed)}
                                      </div>
                                    )}
                                </>
                              );
                            })()
                          ) : changelog.field === "airbrushings" ? (
                            (() => {
                              const parseValue = (val: any) => {
                                if (!val) return val;
                                if (
                                  typeof val === "string" &&
                                  (val.trim().startsWith("[") ||
                                    val.trim().startsWith("{"))
                                ) {
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
                                    <span className="text-sm text-muted-foreground">
                                      Antes:
                                    </span>
                                    {renderAirbrushingsCards(oldParsed)}
                                  </div>
                                  <div className="mt-3">
                                    <span className="text-sm text-muted-foreground">
                                      Depois:
                                    </span>
                                    {renderAirbrushingsCards(newParsed)}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "paintId" ? (
                            (() => {
                              const getFullPaint = (paintIdValue: any) => {
                                if (
                                  !paintIdValue ||
                                  typeof paintIdValue !== "string"
                                )
                                  return null;
                                const uuidRegex =
                                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                if (!uuidRegex.test(paintIdValue)) return null;
                                return (
                                  entityDetails?.paints?.get(paintIdValue) ||
                                  null
                                );
                              };
                              const oldPaint = getFullPaint(changelog.oldValue);
                              const newPaint = getFullPaint(changelog.newValue);
                              return (
                                <>
                                  <div>
                                    <span className="text-sm text-muted-foreground">
                                      Antes:
                                    </span>
                                    {oldPaint ? (
                                      renderPaintsCards([oldPaint])
                                    ) : (
                                      <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                                        —
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3">
                                    <span className="text-sm text-muted-foreground">
                                      Depois:
                                    </span>
                                    {newPaint ? (
                                      renderPaintsCards([newPaint])
                                    ) : (
                                      <span className="text-green-600 dark:text-green-400 font-medium ml-1">
                                        —
                                      </span>
                                    )}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "logoPaints" ||
                            changelog.field === "logoPaintIds" ||
                            changelog.field === "paints" ||
                            changelog.field === "paintGrounds" ||
                            changelog.field === "groundPaints" ? (
                            (() => {
                              const parseValue = (val: any) => {
                                if (!val) return val;
                                if (
                                  typeof val === "string" &&
                                  (val.trim().startsWith("[") ||
                                    val.trim().startsWith("{"))
                                ) {
                                  try {
                                    return JSON.parse(val);
                                  } catch (e) {
                                    return val;
                                  }
                                }
                                return val;
                              };
                              const getPaintObjects = (paintIds: any) => {
                                if (!paintIds || !Array.isArray(paintIds))
                                  return null;
                                const paintObjects = paintIds
                                  .map((id: string) => {
                                    if (typeof id === "object" && id !== null)
                                      return id;
                                    if (typeof id !== "string") return null;
                                    const uuidRegex =
                                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                    if (!uuidRegex.test(id)) return null;
                                    return (
                                      entityDetails?.paints?.get(id) || null
                                    );
                                  })
                                  .filter(Boolean);
                                return paintObjects.length > 0
                                  ? paintObjects
                                  : null;
                              };
                              const oldParsed = parseValue(changelog.oldValue);
                              const newParsed = parseValue(changelog.newValue);
                              const oldPaints = getPaintObjects(oldParsed);
                              const newPaints = getPaintObjects(newParsed);
                              return (
                                <>
                                  <div>
                                    <span className="text-sm text-muted-foreground">
                                      Antes:
                                    </span>
                                    {renderPaintsCards(oldPaints)}
                                  </div>
                                  <div className="mt-3">
                                    <span className="text-sm text-muted-foreground">
                                      Depois:
                                    </span>
                                    {renderPaintsCards(newPaints)}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "artworks" ||
                            changelog.field === "artworkIds" ||
                            changelog.field === "baseFileIds" ||
                            changelog.field === "budgets" ||
                            changelog.field === "invoices" ||
                            changelog.field === "receipts" ? (
                            <>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  Antes:{" "}
                                </span>
                                {(() => {
                                  const parseValue = (val: any) => {
                                    if (val === null || val === undefined)
                                      return null;
                                    if (Array.isArray(val)) return val;
                                    if (typeof val === "string") {
                                      try {
                                        const parsed = JSON.parse(val);
                                        return Array.isArray(parsed)
                                          ? parsed
                                          : null;
                                      } catch {
                                        return null;
                                      }
                                    }
                                    return null;
                                  };
                                  const files = parseValue(changelog.oldValue);
                                  if (!files || files.length === 0) {
                                    return (
                                      <span className="text-red-600 dark:text-red-400 font-medium">
                                        Nenhum arquivo
                                      </span>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {files.map((file: any, idx: number) => {
                                        // Handle different data structures:
                                        // - For artworks: { id: artworkId, fileId: fileId, file: { id, thumbnailUrl } }
                                        // - For baseFiles/budgets/etc: { id: fileId, filename, thumbnailUrl }
                                        // - For legacy: just a string ID
                                        const isArtworkField =
                                          changelog.field === "artworks" ||
                                          changelog.field === "artworkIds";
                                        let fileId: string;
                                        if (typeof file === "string") {
                                          fileId = file;
                                        } else if (isArtworkField) {
                                          // For artworks, use fileId or file.id (the actual file ID)
                                          fileId =
                                            file.fileId ||
                                            file.file?.id ||
                                            file.id;
                                        } else {
                                          fileId = file.id;
                                        }
                                        return (
                                          <LogoDisplay
                                            key={idx}
                                            logoId={fileId}
                                            size="w-12 h-12"
                                            useThumbnail
                                          />
                                        );
                                      })}
                                      <span className="text-sm text-muted-foreground self-center">
                                        ({files.length} arquivo
                                        {files.length > 1 ? "s" : ""})
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  Depois:{" "}
                                </span>
                                {(() => {
                                  const parseValue = (val: any) => {
                                    if (val === null || val === undefined)
                                      return null;
                                    if (Array.isArray(val)) return val;
                                    if (typeof val === "string") {
                                      try {
                                        const parsed = JSON.parse(val);
                                        return Array.isArray(parsed)
                                          ? parsed
                                          : null;
                                      } catch {
                                        return null;
                                      }
                                    }
                                    return null;
                                  };
                                  const files = parseValue(changelog.newValue);
                                  if (!files || files.length === 0) {
                                    return (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        Nenhum arquivo
                                      </span>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {files.map((file: any, idx: number) => {
                                        // Handle different data structures (same as above)
                                        const isArtworkField =
                                          changelog.field === "artworks" ||
                                          changelog.field === "artworkIds";
                                        let fileId: string;
                                        if (typeof file === "string") {
                                          fileId = file;
                                        } else if (isArtworkField) {
                                          fileId =
                                            file.fileId ||
                                            file.file?.id ||
                                            file.id;
                                        } else {
                                          fileId = file.id;
                                        }
                                        return (
                                          <LogoDisplay
                                            key={idx}
                                            logoId={fileId}
                                            size="w-12 h-12"
                                            useThumbnail
                                          />
                                        );
                                      })}
                                      <span className="text-sm text-muted-foreground self-center">
                                        ({files.length} arquivo
                                        {files.length > 1 ? "s" : ""})
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          ) : changelog.field === "logoId" ||
                            changelog.field === "logo" ? (
                            <>
                              <div className="text-sm flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  Antes:{" "}
                                </span>
                                {changelog.oldValue &&
                                changelog.oldValue !== null ? (
                                  <LogoDisplay
                                    logoId={changelog.oldValue as string}
                                    size="w-10 h-10"
                                  />
                                ) : (
                                  <span className="text-red-600 dark:text-red-400 font-medium">
                                    —
                                  </span>
                                )}
                              </div>
                              <div className="text-sm flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  Depois:{" "}
                                </span>
                                {changelog.newValue &&
                                changelog.newValue !== null ? (
                                  <LogoDisplay
                                    logoId={changelog.newValue as string}
                                    size="w-10 h-10"
                                  />
                                ) : (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    —
                                  </span>
                                )}
                              </div>
                            </>
                          ) : changelog.field === "layouts" ? (
                            // Special handling for layouts field from copy operation
                            (() => {
                              const parseValue = (val: any) => {
                                if (val === null || val === undefined)
                                  return null;
                                if (
                                  typeof val === "object" &&
                                  !Array.isArray(val)
                                )
                                  return val;
                                if (typeof val === "string") {
                                  try {
                                    return JSON.parse(val);
                                  } catch {
                                    return null;
                                  }
                                }
                                return null;
                              };

                              const oldLayouts = parseValue(changelog.oldValue);
                              const newLayouts = parseValue(changelog.newValue);

                              const renderLayoutBadges = (
                                layouts: any,
                                isOld: boolean,
                              ) => {
                                if (!layouts) {
                                  return (
                                    <span
                                      className={
                                        isOld
                                          ? "text-red-600 dark:text-red-400 font-medium"
                                          : "text-green-600 dark:text-green-400 font-medium"
                                      }
                                    >
                                      Nenhum
                                    </span>
                                  );
                                }

                                const layoutConfigs = [
                                  {
                                    key: "leftSideLayoutId",
                                    dimKey: "leftSideDimensions",
                                    label: "Lado Motorista",
                                  },
                                  {
                                    key: "rightSideLayoutId",
                                    dimKey: "rightSideDimensions",
                                    label: "Lado Sapo",
                                  },
                                  {
                                    key: "backSideLayoutId",
                                    dimKey: "backSideDimensions",
                                    label: "Traseira",
                                  },
                                ];

                                const configuredLayouts = layoutConfigs.filter(
                                  (l) => layouts[l.key],
                                );
                                if (configuredLayouts.length === 0) {
                                  return (
                                    <span
                                      className={
                                        isOld
                                          ? "text-red-600 dark:text-red-400 font-medium"
                                          : "text-green-600 dark:text-green-400 font-medium"
                                      }
                                    >
                                      Nenhum
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex flex-col gap-2 mt-1">
                                    {configuredLayouts.map(
                                      ({ key, dimKey, label }) => {
                                        const dimensions = layouts[dimKey];
                                        const dimensionStr =
                                          dimensions &&
                                          dimensions.width &&
                                          dimensions.height
                                            ? `${dimensions.width}cm × ${dimensions.height}cm`
                                            : null;

                                        return (
                                          <div
                                            key={key}
                                            className="border dark:border-border/40 rounded-lg px-2.5 py-1.5 bg-muted/30 inline-flex items-center gap-2 w-fit"
                                          >
                                            <span className="text-xs font-medium">
                                              {label}
                                            </span>
                                            {dimensionStr && (
                                              <span className="text-xs text-muted-foreground">
                                                {dimensionStr}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                );
                              };

                              return (
                                <>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">
                                      Antes:
                                    </span>
                                    {renderLayoutBadges(oldLayouts, true)}
                                  </div>
                                  <div className="text-sm mt-3">
                                    <span className="text-muted-foreground">
                                      Depois:
                                    </span>
                                    {renderLayoutBadges(newLayouts, false)}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "serviceOrders" ? (
                            // Special handling for serviceOrders from copy operation - show list
                            (() => {
                              const parseValue = (val: any) => {
                                if (val === null || val === undefined)
                                  return null;
                                if (typeof val === "number")
                                  return { count: val };
                                if (
                                  typeof val === "object" &&
                                  !Array.isArray(val)
                                )
                                  return val;
                                if (typeof val === "string") {
                                  try {
                                    const parsed = JSON.parse(val);
                                    if (typeof parsed === "number")
                                      return { count: parsed };
                                    return parsed;
                                  } catch {
                                    return null;
                                  }
                                }
                                return null;
                              };

                              const oldValue = parseValue(changelog.oldValue);
                              const newValue = parseValue(changelog.newValue);

                              const getCount = (val: any) => {
                                if (!val) return 0;
                                if (typeof val === "number") return val;
                                if (val.count !== undefined) return val.count;
                                if (Array.isArray(val.ids))
                                  return val.ids.length;
                                if (Array.isArray(val.items))
                                  return val.items.length;
                                return 0;
                              };

                              const oldCount = getCount(oldValue);
                              const newCount = getCount(newValue);

                              // Get items with descriptions/types if available
                              const newItems = newValue?.items || [];

                              return (
                                <>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">
                                      Antes:{" "}
                                    </span>
                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                      {oldCount === 0
                                        ? "Nenhuma"
                                        : `${oldCount} ordem${oldCount > 1 ? "s" : ""} de serviço`}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">
                                      Depois:{" "}
                                    </span>
                                    {newCount === 0 ? (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        Nenhuma
                                      </span>
                                    ) : newItems.length > 0 ? (
                                      <div className="flex flex-col gap-1.5 mt-1">
                                        {newItems.map(
                                          (item: any, idx: number) => {
                                            const typeLabel = item.type
                                              ? SERVICE_ORDER_TYPE_LABELS[
                                                  item.type as keyof typeof SERVICE_ORDER_TYPE_LABELS
                                                ] || item.type
                                              : null;
                                            return (
                                              <div
                                                key={idx}
                                                className="border dark:border-border/40 rounded-lg px-2.5 py-1.5 bg-muted/30 inline-flex items-center gap-2 w-fit"
                                              >
                                                {typeLabel && (
                                                  <span className="text-xs font-semibold text-primary">
                                                    {typeLabel}
                                                  </span>
                                                )}
                                                {item.description && (
                                                  <span className="text-xs text-muted-foreground">
                                                    {item.description}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        {`${newCount} ordem${newCount > 1 ? "s" : ""} de serviço`}
                                      </span>
                                    )}
                                  </div>
                                </>
                              );
                            })()
                          ) : changelog.field === "pricingId" ? (
                            // Special handling for pricingId - show pricing info elegantly with items
                            (() => {
                              const parseValue = (val: any) => {
                                if (val === null || val === undefined)
                                  return null;
                                if (typeof val === "object" && val.id)
                                  return val;
                                if (typeof val === "string") {
                                  try {
                                    const parsed = JSON.parse(val);
                                    if (
                                      parsed &&
                                      typeof parsed === "object" &&
                                      parsed.id
                                    )
                                      return parsed;
                                    // If it's just a UUID string, return it as id
                                    return {
                                      id: val,
                                      budgetNumber: null,
                                      total: null,
                                      items: null,
                                    };
                                  } catch {
                                    // It's a raw UUID string
                                    return {
                                      id: val,
                                      budgetNumber: null,
                                      total: null,
                                      items: null,
                                    };
                                  }
                                }
                                return null;
                              };

                              const formatCurrency = (value: number | null) => {
                                if (value === null || value === undefined)
                                  return null;
                                return new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(value);
                              };

                              const oldPricing = parseValue(changelog.oldValue);
                              const newPricing = parseValue(changelog.newValue);

                              const renderPricingValue = (
                                pricing: any,
                                isOld: boolean,
                              ) => {
                                if (!pricing || !pricing.id) {
                                  return (
                                    <span
                                      className={
                                        isOld
                                          ? "text-red-600 dark:text-red-400 font-medium"
                                          : "text-green-600 dark:text-green-400 font-medium"
                                      }
                                    >
                                      Nenhum
                                    </span>
                                  );
                                }

                                const hasBudgetInfo =
                                  pricing.budgetNumber || pricing.total;
                                const items = pricing.items || [];

                                return (
                                  <div className="flex flex-col gap-2 mt-1">
                                    {hasBudgetInfo ? (
                                      <div className="border dark:border-border/40 rounded-lg px-3 py-2 bg-muted/30">
                                        <div className="flex items-center gap-2">
                                          {pricing.budgetNumber && (
                                            <span
                                              className={`text-sm font-semibold ${isOld ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                                            >
                                              Orçamento #{pricing.budgetNumber}
                                            </span>
                                          )}
                                          {pricing.total !== null &&
                                            pricing.total !== undefined && (
                                              <span className="text-sm font-medium text-muted-foreground">
                                                {formatCurrency(pricing.total)}
                                              </span>
                                            )}
                                        </div>
                                        {items.length > 0 && (
                                          <div className="mt-2 pt-2 border-t dark:border-border/40">
                                            <span className="text-xs text-muted-foreground font-medium">
                                              Itens:
                                            </span>
                                            <div className="flex flex-col gap-1 mt-1">
                                              {items.map(
                                                (item: any, idx: number) => (
                                                  <div
                                                    key={idx}
                                                    className="flex items-center justify-between text-xs"
                                                  >
                                                    <span className="text-foreground">
                                                      {item.description}
                                                    </span>
                                                    <span className="text-muted-foreground font-medium">
                                                      {formatCurrency(
                                                        item.amount,
                                                      )}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      // Fallback to showing just the ID if no budget info
                                      <span
                                        className={`font-mono text-xs ${isOld ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                                      >
                                        {pricing.id}
                                      </span>
                                    )}
                                  </div>
                                );
                              };

                              return (
                                <>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">
                                      Antes:{" "}
                                    </span>
                                    {renderPricingValue(oldPricing, true)}
                                  </div>
                                  <div className="text-sm mt-2">
                                    <span className="text-muted-foreground">
                                      Depois:{" "}
                                    </span>
                                    {renderPricingValue(newPricing, false)}
                                  </div>
                                </>
                              );
                            })()
                          ) : (
                            // Default rendering for other fields
                            <>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  Antes:{" "}
                                </span>
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                  {formatValueWithEntity(
                                    changelog.oldValue,
                                    changelog.field,
                                    entityType,
                                    entityDetails,
                                    changelog.metadata,
                                  )}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  Depois:{" "}
                                </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {formatValueWithEntity(
                                    changelog.newValue,
                                    changelog.field,
                                    entityType,
                                    entityDetails,
                                    changelog.metadata,
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Sem alteração de valor registrada
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            <span className="text-muted-foreground">Por: </span>
            <span className="text-foreground font-medium">
              {firstChange.user?.name || "Sistema"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Combined Changelog Display for Tasks, Service Orders, Trucks, and Layouts
 *
 * This component fetches and displays changelogs for:
 * 1. The task itself (TASK entity type)
 * 2. All service orders belonging to the task (SERVICE_ORDER entity type)
 * 3. The truck associated with the task (TRUCK entity type)
 * 4. All layouts belonging to the truck (LAYOUT entity type)
 *
 * Changelogs are merged, sorted by date, and displayed in a unified timeline
 * matching the design of the standard ChangelogHistory component.
 */
export function TaskWithServiceOrdersChangelog({
  taskId,
  taskName,
  taskCreatedAt: _taskCreatedAt,
  serviceOrderIds,
  truckId,
  layoutIds = [],
  className,
  maxHeight,
  limit = 100,
}: TaskWithServiceOrdersChangelogProps) {
  // Get current user for permission checks
  const { data: currentUser } = useCurrentUser();
  const userSectorPrivilege = currentUser?.sector?.privileges as
    | SECTOR_PRIVILEGES
    | undefined;
  const visibleServiceOrderTypes = useMemo(
    () => getVisibleServiceOrderTypes(userSectorPrivilege),
    [userSectorPrivilege],
  );

  // Fetch task changelogs
  const {
    data: taskChangelogsResponse,
    isLoading: taskLoading,
    error: taskError,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.TASK,
      entityId: taskId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  // Fetch service order changelogs
  const {
    data: serviceOrderChangelogsResponse,
    isLoading: serviceOrdersLoading,
    error: serviceOrdersError,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER,
      entityId:
        serviceOrderIds.length > 0 ? { in: serviceOrderIds } : undefined,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    enabled: serviceOrderIds.length > 0,
  });

  // Fetch truck changelogs
  const {
    data: truckChangelogsResponse,
    isLoading: truckLoading,
    error: truckError,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.TRUCK,
      entityId: truckId || undefined,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    enabled: !!truckId,
  });

  // Fetch layout changelogs
  const {
    data: layoutChangelogsResponse,
    isLoading: layoutsLoading,
    error: layoutsError,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.LAYOUT,
      entityId: layoutIds.length > 0 ? { in: layoutIds } : undefined,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    enabled: layoutIds.length > 0,
  });

  // Combine and sort all changelogs
  // IMPORTANT: Only include data from queries that are actually enabled to avoid stale cache data
  const combinedChangelogs = useMemo(() => {
    // Task logs are always enabled
    const taskLogs = taskChangelogsResponse?.data || [];
    // Only include service order logs if the query is enabled (has service order IDs)
    const serviceLogs =
      serviceOrderIds.length > 0
        ? serviceOrderChangelogsResponse?.data || []
        : [];
    // Only include truck logs if the query is enabled (has truck ID)
    const truckLogs = truckId ? truckChangelogsResponse?.data || [] : [];
    // Only include layout logs if the query is enabled (has layout IDs)
    const layoutLogs =
      layoutIds.length > 0 ? layoutChangelogsResponse?.data || [] : [];

    // Build a map of service order entityId -> type from CREATE actions
    const serviceOrderTypeMap = new Map<string, SERVICE_ORDER_TYPE>();
    serviceLogs.forEach((log) => {
      if (
        log.entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
        log.action === CHANGE_LOG_ACTION.CREATE &&
        log.newValue &&
        log.entityId
      ) {
        try {
          const data =
            typeof log.newValue === "string"
              ? JSON.parse(log.newValue)
              : log.newValue;
          if (data?.type) {
            serviceOrderTypeMap.set(
              log.entityId,
              data.type as SERVICE_ORDER_TYPE,
            );
          }
        } catch {
          // Ignore parse errors
        }
      }
    });

    // Filter service order logs based on user permissions
    const filteredServiceLogs = serviceLogs.filter((log) => {
      if (log.entityType !== CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER) return true;

      // Get the service order type from our map (built from CREATE actions)
      const serviceOrderType = serviceOrderTypeMap.get(log.entityId);

      // If we can't determine the type, hide it by default for security
      if (!serviceOrderType) return false;

      // Check if user has permission to view this service order type
      return visibleServiceOrderTypes.includes(serviceOrderType);
    });

    // Merge all changelogs
    const allLogs = [
      ...taskLogs,
      ...filteredServiceLogs,
      ...truckLogs,
      ...layoutLogs,
    ];

    // Sort by createdAt descending (newest first)
    allLogs.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return allLogs;
  }, [
    taskChangelogsResponse,
    serviceOrderChangelogsResponse,
    truckChangelogsResponse,
    layoutChangelogsResponse,
    serviceOrderIds,
    truckId,
    layoutIds,
    visibleServiceOrderTypes,
  ]);

  // Extract all entity IDs that need to be fetched for resolution
  const entityIds = useMemo(() => {
    const customerIds = new Set<string>();
    const sectorIds = new Set<string>();
    const paintIds = new Set<string>();
    const userIds = new Set<string>();
    const invoiceToIds = new Set<string>();
    const truckIds = new Set<string>();
    const serviceOrderIdsSet = new Set<string>();

    combinedChangelogs.forEach((changelog) => {
      // Collect service order IDs from SERVICE_ORDER entity changelogs
      if (
        changelog.entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
        changelog.entityId
      ) {
        serviceOrderIdsSet.add(changelog.entityId);
      }

      // Also collect user IDs from service order related fields
      if (
        changelog.field === "startedById" ||
        changelog.field === "completedById" ||
        changelog.field === "approvedById" ||
        changelog.field === "assignedToId"
      ) {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          userIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          userIds.add(changelog.newValue);
      }

      // Extract assignedToId from SERVICE_ORDER CREATE action newValue
      if (
        changelog.entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
        changelog.action === CHANGE_LOG_ACTION.CREATE &&
        changelog.newValue
      ) {
        try {
          const createdData =
            typeof changelog.newValue === "string"
              ? JSON.parse(changelog.newValue)
              : changelog.newValue;
          if (
            createdData?.assignedToId &&
            typeof createdData.assignedToId === "string"
          ) {
            userIds.add(createdData.assignedToId);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Extract customer IDs
      if (changelog.field === "customerId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          customerIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          customerIds.add(changelog.newValue);
      }

      // Extract sector IDs
      if (changelog.field === "sectorId") {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (
          changelog.oldValue &&
          typeof changelog.oldValue === "string" &&
          uuidRegex.test(changelog.oldValue)
        ) {
          sectorIds.add(changelog.oldValue);
        }
        if (
          changelog.newValue &&
          typeof changelog.newValue === "string" &&
          uuidRegex.test(changelog.newValue)
        ) {
          sectorIds.add(changelog.newValue);
        }
      }

      // Extract paint IDs
      if (changelog.field === "paintId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          paintIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          paintIds.add(changelog.newValue);
      }

      // Extract paint IDs from arrays (logoPaints, paints, groundPaints)
      if (
        changelog.field === "logoPaints" ||
        changelog.field === "paints" ||
        changelog.field === "groundPaints" ||
        changelog.field === "paintGrounds"
      ) {
        const extractPaintIds = (val: any) => {
          if (!val) return;
          let parsed = val;
          if (
            typeof val === "string" &&
            (val.trim().startsWith("[") || val.trim().startsWith("{"))
          ) {
            try {
              parsed = JSON.parse(val);
            } catch (e) {
              return;
            }
          }
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (typeof item === "string") {
                const uuidRegex =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      }

      // Extract invoiceTo IDs
      if (changelog.field === "invoiceToId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          invoiceToIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          invoiceToIds.add(changelog.newValue);
      }

      // Extract truck IDs
      if (changelog.field === "truckId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          truckIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          truckIds.add(changelog.newValue);
      }

      // Extract user IDs from negotiatingWith field (DEPRECATED - kept for historical data)
      if (changelog.field === "negotiatingWith") {
        const extractUserIdsFromNegotiating = (value: any) => {
          if (!value) return;
          try {
            const parsed =
              typeof value === "string" ? JSON.parse(value) : value;
            if (parsed?.userId) userIds.add(parsed.userId);
          } catch (e) {
            // Ignore parse errors
          }
        };
        extractUserIdsFromNegotiating(changelog.oldValue);
        extractUserIdsFromNegotiating(changelog.newValue);
      }

      // Extract representative IDs from representatives/representativeIds fields
      if (
        changelog.field === "representatives" ||
        changelog.field === "representativeIds"
      ) {
        const extractRepresentativeIds = (value: any) => {
          if (!value) return;
          try {
            const parsed =
              typeof value === "string" ? JSON.parse(value) : value;
            if (Array.isArray(parsed)) {
              parsed.forEach((rep: any) => {
                if (typeof rep === "string") userIds.add(rep);
                else if (rep?.id) userIds.add(rep.id);
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        };
        extractRepresentativeIds(changelog.oldValue);
        extractRepresentativeIds(changelog.newValue);
      }
    });

    return {
      customerIds: Array.from(customerIds),
      sectorIds: Array.from(sectorIds),
      paintIds: Array.from(paintIds),
      userIds: Array.from(userIds),
      invoiceToIds: Array.from(invoiceToIds),
      truckIds: Array.from(truckIds),
      serviceOrderIds: Array.from(serviceOrderIdsSet),
    };
  }, [combinedChangelogs]);

  // Fetch entity details for UUID resolution
  const { data: entityDetails } = useEntityDetails(entityIds);

  // Group changelogs by entity and time
  const groupedChangelogs = useMemo(() => {
    const changelogGroups = groupChangelogsByEntity(combinedChangelogs);

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
  }, [combinedChangelogs]);

  // Calculate summary statistics
  const changeStats = useMemo(() => {
    const totalChanges = combinedChangelogs.length;
    const recentChanges = combinedChangelogs.filter(
      (c) =>
        new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    ).length;

    const uniqueUsers = new Set(
      combinedChangelogs.map((c) => c.userId).filter(Boolean),
    ).size;

    return {
      totalChanges,
      recentChanges,
      uniqueUsers,
    };
  }, [combinedChangelogs]);

  const isLoading =
    taskLoading || serviceOrdersLoading || truckLoading || layoutsLoading;
  const error = taskError || serviceOrdersError || truckError || layoutsError;

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">
              Erro ao carregar histórico de alterações
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show the card if there are no changelogs
  if (!isLoading && combinedChangelogs.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn("shadow-sm border border-border flex flex-col", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Histórico de Alterações
          {taskName && (
            <span className="text-base font-normal text-muted-foreground">
              - {taskName}
            </span>
          )}
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
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">
                    Total de Alterações
                  </span>
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
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">
                    Últimos 7 Dias
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  {changeStats.recentChanges}
                </p>
              </div>
            </div>

            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconUser className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">
                    Usuários Envolvidos
                  </span>
                </div>
                <p className="text-2xl font-bold">{changeStats.uniqueUsers}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <ChangelogSkeleton />
        ) : combinedChangelogs.length === 0 ? (
          <div className="text-center py-12">
            <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">
              Nenhuma alteração registrada
            </p>
            <p className="text-sm text-muted-foreground">
              As alterações realizadas nesta tarefa aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="pr-4">
            <div className="space-y-6">
              {groupedChangelogs.map(
                ([date, dayChangelogGroups], groupIndex) => {
                  const isLastGroup =
                    groupIndex === groupedChangelogs.length - 1;

                  return (
                    <div key={date} className="relative">
                      {/* Date Header */}
                      <div className="pb-1 mb-4 rounded-md">
                        <div className="flex justify-center items-center gap-4">
                          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50">
                            <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              {date}
                            </span>
                          </div>
                          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                        </div>
                      </div>

                      {/* Changes for this date */}
                      <div className="space-y-3 relative">
                        {/* Timeline line */}
                        {!isLastGroup && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
                        )}

                        {dayChangelogGroups.map((changelogGroup, index) => {
                          const isLastChange =
                            isLastGroup &&
                            index === dayChangelogGroups.length - 1;
                          const entityType = changelogGroup[0]
                            .entityType as CHANGE_LOG_ENTITY_TYPE;

                          return (
                            <div
                              key={changelogGroup[0].id}
                              className="relative"
                            >
                              {/* Timeline line connector */}
                              {!isLastChange && (
                                <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
                              )}

                              <ChangelogTimelineItem
                                changelogGroup={changelogGroup}
                                isLast={isLastChange}
                                entityType={entityType}
                                entityDetails={entityDetails}
                                userSectorPrivilege={userSectorPrivilege}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
