import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ACTION, CHANGE_TRIGGERED_BY } from "../../constants";
import { SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS_LABELS } from "../../constants/enum-labels";
import { formatRelativeTime, getFieldLabel, formatFieldValue, getActionLabel } from "../../utils";
import { useChangeLogs } from "../../hooks";
import { useEntityDetails } from "@/hooks/use-entity-details";
import { cn } from "@/lib/utils";

// Helper function to generate layout SVG for changelog display
const generateLayoutSVG = (layout: any): string => {
  if (!layout || !layout.layoutSections) return '';

  const height = (layout.height || 0) * 100; // Convert to cm
  const sections = layout.layoutSections || [];
  const totalWidth = sections.reduce((sum: number, s: any) => sum + (s.width || 0) * 100, 0);
  const margin = 30;
  const extraSpace = 40;
  const svgWidth = totalWidth + margin * 2 + extraSpace;
  const svgHeight = height + margin * 2 + extraSpace;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

  // Main container
  svg += `<rect x="${margin}" y="${margin}" width="${totalWidth}" height="${height}" fill="none" stroke="#000" stroke-width="1"/>`;

  // Add section dividers
  let currentPos = 0;
  sections.forEach((section: any, index: number) => {
    const sectionWidth = (section.width || 0) * 100;

    if (index > 0) {
      const prevSection = sections[index - 1];
      if (!section.isDoor && !prevSection.isDoor) {
        const lineX = margin + currentPos;
        svg += `<line x1="${lineX}" y1="${margin}" x2="${lineX}" y2="${margin + height}" stroke="#333" stroke-width="0.5"/>`;
      }
    }

    currentPos += sectionWidth;
  });

  // Add doors from layoutSections
  currentPos = 0;
  sections.forEach((section: any) => {
    const sectionWidth = (section.width || 0) * 100;
    const sectionX = margin + currentPos;

    if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
      const doorHeightCm = (section.doorHeight || 0) * 100;
      const doorTopY = margin + (height - doorHeightCm);

      // Door lines
      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX}" y2="${margin + height}" stroke="#000" stroke-width="1"/>`;
      svg += `<line x1="${sectionX + sectionWidth}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${margin + height}" stroke="#000" stroke-width="1"/>`;
      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${doorTopY}" stroke="#000" stroke-width="1"/>`;
    }

    currentPos += sectionWidth;
  });

  // Add width dimensions
  currentPos = 0;
  sections.forEach((section: any) => {
    const sectionWidth = (section.width || 0) * 100;
    const startX = margin + currentPos;
    const endX = margin + currentPos + sectionWidth;
    const centerX = startX + sectionWidth / 2;
    const dimY = margin + height + 15;

    svg += `<line x1="${startX}" y1="${dimY}" x2="${endX}" y2="${dimY}" stroke="#0066cc" stroke-width="1"/>`;
    svg += `<polygon points="${startX},${dimY} ${startX + 5},${dimY - 3} ${startX + 5},${dimY + 3}" fill="#0066cc"/>`;
    svg += `<polygon points="${endX},${dimY} ${endX - 5},${dimY - 3} ${endX - 5},${dimY + 3}" fill="#0066cc"/>`;
    svg += `<text x="${centerX}" y="${dimY + 12}" text-anchor="middle" font-size="10" fill="#0066cc">${Math.round(sectionWidth)}</text>`;

    currentPos += sectionWidth;
  });

  // Height dimension
  const dimX = margin - 15;
  svg += `<line x1="${dimX}" y1="${margin}" x2="${dimX}" y2="${margin + height}" stroke="#0066cc" stroke-width="1"/>`;
  svg += `<polygon points="${dimX},${margin} ${dimX - 3},${margin + 5} ${dimX + 3},${margin + 5}" fill="#0066cc"/>`;
  svg += `<polygon points="${dimX},${margin + height} ${dimX - 3},${margin + height - 5} ${dimX + 3},${margin + height - 5}" fill="#0066cc"/>`;
  svg += `<text x="${dimX - 8}" y="${margin + height / 2}" text-anchor="middle" font-size="10" fill="#0066cc" transform="rotate(-90, ${dimX - 8}, ${margin + height / 2})">${Math.round(height)}</text>`;
  svg += `</svg>`;

  return svg;
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
const actionConfig: Record<CHANGE_LOG_ACTION, { icon: React.ElementType; color: string }> = {
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
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.VIEW]: { icon: IconHistory, color: "text-gray-600" },
};

// Group changelog fields by entity and time (matching ChangelogHistory)
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

// Format field values with entity resolution
const formatValueWithEntity = (
  value: any,
  field: string | null,
  entityType: CHANGE_LOG_ENTITY_TYPE,
  entityDetails: any,
  metadata?: any
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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
        // Return the full paint object for special rendering
        return entityDetails.paints.get(parsedValue) || "Tinta";
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
}: {
  changelogGroup: ChangeLog[];
  isLast: boolean;
  entityType: CHANGE_LOG_ENTITY_TYPE;
  entityDetails: any;
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
    firstChange.metadata as { sourceTaskName?: string } | undefined
  );

  // Check if this is a CREATE action
  if (firstChange.action === CHANGE_LOG_ACTION.CREATE) {
    // Extract entity details from newValue
    let entityDetails: any = null;
    try {
      if (firstChange.newValue) {
        entityDetails = typeof firstChange.newValue === 'string'
          ? JSON.parse(firstChange.newValue)
          : firstChange.newValue;
      }
    } catch (e) {
      // Failed to parse, will show basic info only
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
              <div className="text-lg font-semibold">{entityTypeLabel} {actionLabel}</div>
              <div className="text-sm text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</div>
            </div>

            {/* Entity Details */}
            {entityDetails && (
              <div className="mb-3 space-y-1">
                {/* Service Order Details */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER && (
                  <>
                    {entityDetails.type && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tipo: </span>
                        <span className="text-foreground font-medium">
                          {SERVICE_ORDER_TYPE_LABELS[entityDetails.type as keyof typeof SERVICE_ORDER_TYPE_LABELS] || entityDetails.type}
                        </span>
                      </div>
                    )}
                    {entityDetails.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Descrição: </span>
                        <span className="text-foreground font-medium">{entityDetails.description}</span>
                      </div>
                    )}
                    {entityDetails.status && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Status: </span>
                        <span className="text-foreground font-medium">
                          {SERVICE_ORDER_STATUS_LABELS[entityDetails.status as keyof typeof SERVICE_ORDER_STATUS_LABELS] || entityDetails.status}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Truck Details */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK && (
                  <>
                    {entityDetails.plate && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Placa: </span>
                        <span className="text-foreground font-medium">{entityDetails.plate}</span>
                      </div>
                    )}
                    {entityDetails.chassisNumber && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Chassi: </span>
                        <span className="text-foreground font-medium">{entityDetails.chassisNumber}</span>
                      </div>
                    )}
                    {entityDetails.spot && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Localização: </span>
                        <span className="text-foreground font-medium">
                          {formatFieldValue(entityDetails.spot, 'spot', entityType)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Layout Details - Show all layouts in group */}
                {entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT && (
                  <div className="flex flex-wrap gap-4 my-2">
                    {changelogGroup
                      .map((layoutChange) => {
                        let layoutDetails: any = null;
                        try {
                          if (layoutChange.newValue) {
                            layoutDetails = typeof layoutChange.newValue === 'string'
                              ? JSON.parse(layoutChange.newValue)
                              : layoutChange.newValue;
                          }
                        } catch (e) {
                          return null;
                        }

                        if (!layoutDetails?.layoutSections || layoutDetails.layoutSections.length === 0) {
                          return null;
                        }

                        const sideName = layoutChange.reason?.includes('leftSideLayoutId') ? 'Lado Motorista' :
                                        layoutChange.reason?.includes('rightSideLayoutId') ? 'Lado Sapo' :
                                        layoutChange.reason?.includes('backSideLayoutId') ? 'Traseira' : 'Layout';

                        // Determine sort order: left=1, right=2, back=3, other=4
                        const sortOrder = layoutChange.reason?.includes('leftSideLayoutId') ? 1 :
                                         layoutChange.reason?.includes('rightSideLayoutId') ? 2 :
                                         layoutChange.reason?.includes('backSideLayoutId') ? 3 : 4;

                        return { layoutChange, layoutDetails, sideName, sortOrder };
                      })
                      .filter(Boolean)
                      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                      .map(({ layoutChange, layoutDetails, sideName }: any) => (
                        <div key={layoutChange.id} className="flex-shrink-0">
                          <div className="text-xs font-medium text-muted-foreground mb-1">{sideName}</div>
                          <div className="border rounded-lg bg-white/50 backdrop-blur-sm p-2">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: generateLayoutSVG(layoutDetails)
                              }}
                              className="[&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-[280px] [&>svg]:max-h-[100px]"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
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
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", config.color)} />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            <div className="text-lg font-semibold mb-2">{entityTypeLabel} {actionLabel}</div>
            {firstChange.reason && (
              <div className="text-sm text-muted-foreground mb-2">{firstChange.reason}</div>
            )}
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

  // UPDATE action
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
            <div className="text-lg font-semibold">{entityTypeLabel} {actionLabel}</div>
            <div className="text-sm text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</div>
          </div>

          {/* Field changes */}
          <div className="space-y-3">
            {changelogGroup
              .filter((changelog) => {
                // Exclude internal/system fields from display
                if (changelog.field === "statusOrder") return false;
                if (changelog.field === "colorOrder") return false;
                return true;
              })
              .map((changelog, index) => {
                if (!changelog.field) {
                  return null;
                }

                return (
                  <div key={changelog.id}>
                    {index > 0 && <div className="my-3 border-t" />}

                    {/* Field name */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-muted-foreground">
                        <span className="text-muted-foreground">Campo: </span>
                        <span className="text-foreground font-medium">{getFieldLabel(changelog.field, entityType)}</span>
                      </div>
                    </div>

                    {/* Values */}
                    <div className="space-y-1">
                      {changelog.oldValue !== undefined || changelog.newValue !== undefined ? (
                        <>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Antes: </span>
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {formatValueWithEntity(changelog.oldValue, changelog.field, entityType, entityDetails, changelog.metadata)}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Depois: </span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {formatValueWithEntity(changelog.newValue, changelog.field, entityType, entityDetails, changelog.metadata)}
                            </span>
                          </div>
                        </>
                      ) : (
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
  taskCreatedAt,
  serviceOrderIds,
  truckId,
  layoutIds = [],
  className,
  maxHeight,
  limit = 100,
}: TaskWithServiceOrdersChangelogProps) {
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
      entityId: serviceOrderIds.length > 0 ? { in: serviceOrderIds } : undefined,
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
  const combinedChangelogs = useMemo(() => {
    const taskLogs = taskChangelogsResponse?.data || [];
    const serviceLogs = serviceOrderChangelogsResponse?.data || [];
    const truckLogs = truckChangelogsResponse?.data || [];
    const layoutLogs = layoutChangelogsResponse?.data || [];

    // Merge all changelogs
    const allLogs = [...taskLogs, ...serviceLogs, ...truckLogs, ...layoutLogs];

    // Sort by createdAt descending (newest first)
    allLogs.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return allLogs;
  }, [taskChangelogsResponse, serviceOrderChangelogsResponse, truckChangelogsResponse, layoutChangelogsResponse]);

  // Extract all entity IDs that need to be fetched for resolution
  const entityIds = useMemo(() => {
    const customerIds = new Set<string>();
    const sectorIds = new Set<string>();
    const paintIds = new Set<string>();
    const userIds = new Set<string>();
    const invoiceToIds = new Set<string>();
    const truckIds = new Set<string>();

    combinedChangelogs.forEach((changelog) => {
      // Extract customer IDs
      if (changelog.field === "customerId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") customerIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") customerIds.add(changelog.newValue);
      }

      // Extract sector IDs
      if (changelog.field === "sectorId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") sectorIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") sectorIds.add(changelog.newValue);
      }

      // Extract paint IDs
      if (changelog.field === "paintId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") paintIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") paintIds.add(changelog.newValue);
      }

      // Extract invoiceTo IDs
      if (changelog.field === "invoiceToId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") invoiceToIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") invoiceToIds.add(changelog.newValue);
      }

      // Extract truck IDs
      if (changelog.field === "truckId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string") truckIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string") truckIds.add(changelog.newValue);
      }

      // Extract user IDs from negotiatingWith field
      if (changelog.field === "negotiatingWith") {
        const extractUserIdsFromNegotiating = (value: any) => {
          if (!value) return;
          try {
            const parsed = typeof value === "string" ? JSON.parse(value) : value;
            if (parsed?.userId) userIds.add(parsed.userId);
          } catch (e) {
            // Ignore parse errors
          }
        };
        extractUserIdsFromNegotiating(changelog.oldValue);
        extractUserIdsFromNegotiating(changelog.newValue);
      }
    });

    return {
      customerIds: Array.from(customerIds),
      sectorIds: Array.from(sectorIds),
      paintIds: Array.from(paintIds),
      userIds: Array.from(userIds),
      invoiceToIds: Array.from(invoiceToIds),
      truckIds: Array.from(truckIds),
    };
  }, [combinedChangelogs]);

  // Fetch entity details for UUID resolution
  const { data: entityDetails } = useEntityDetails(entityIds);

  // Group changelogs by entity type for stats
  const groupedByEntity = useMemo(() => {
    const groups = {
      task: [] as ChangeLog[],
      serviceOrders: [] as ChangeLog[],
      trucks: [] as ChangeLog[],
      layouts: [] as ChangeLog[],
    };

    combinedChangelogs.forEach((log) => {
      if (log.entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
        groups.task.push(log);
      } else if (log.entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER) {
        groups.serviceOrders.push(log);
      } else if (log.entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK) {
        groups.trucks.push(log);
      } else if (log.entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT) {
        groups.layouts.push(log);
      }
    });

    return groups;
  }, [combinedChangelogs]);

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
      (c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const uniqueUsers = new Set(combinedChangelogs.map((c) => c.userId).filter(Boolean)).size;

    return {
      totalChanges,
      recentChanges,
      uniqueUsers,
    };
  }, [combinedChangelogs]);

  const isLoading = taskLoading || serviceOrdersLoading || truckLoading || layoutsLoading;
  const error = taskError || serviceOrdersError || truckError || layoutsError;

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
  if (!isLoading && combinedChangelogs.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn("shadow-sm border border-border flex flex-col overflow-hidden", className)}
      style={maxHeight ? { maxHeight, height: maxHeight } : undefined}
    >
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Histórico de Alterações
          {taskName && <span className="text-base font-normal text-muted-foreground">- {taskName}</span>}
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

      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <ChangelogSkeleton />
        ) : combinedChangelogs.length === 0 ? (
          <div className="text-center py-12">
            <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma alteração registrada</p>
            <p className="text-sm text-muted-foreground">
              As alterações realizadas nesta tarefa aparecerão aqui
            </p>
          </div>
        ) : (
          <ScrollArea className="pr-4 h-full">
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
                        const entityType = changelogGroup[0].entityType as CHANGE_LOG_ENTITY_TYPE;

                        return (
                          <div key={changelogGroup[0].id} className="relative">
                            {/* Timeline line connector */}
                            {!isLastChange && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <ChangelogTimelineItem
                              changelogGroup={changelogGroup}
                              isLast={isLastChange}
                              entityType={entityType}
                              entityDetails={entityDetails}
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
