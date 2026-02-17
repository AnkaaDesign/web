import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePreviewCard } from "@/components/common/file";
import { generateLayoutSVG } from "@/utils/generate-layout-svg";
import {
  CUT_TYPE_LABELS,
  CUT_STATUS_LABELS,
  CUT_ORIGIN_LABELS,
  AIRBRUSHING_STATUS_LABELS,
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  SERVICE_ORDER_TYPE_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
} from "@/constants/enum-labels";
import {
  ENTITY_BADGE_CONFIG,
  PAINT_FINISH,
  SECTOR_PRIVILEGES,
  CUT_STATUS,
  CUT_TYPE,
  CUT_ORIGIN,
  AIRBRUSHING_STATUS,
  TRUCK_MANUFACTURER,
  SERVICE_ORDER_TYPE,
  SERVICE_ORDER_STATUS,
} from "@/constants";
import { formatHexColor, getContrastingTextColor } from "@/components/painting/catalogue/list/color-utils";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils";
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
} from "@tabler/icons-react";
import type { ChangeLog } from "../../types";
import {
  CHANGE_LOG_ENTITY_TYPE,
  CHANGE_LOG_ACTION,
  CHANGE_TRIGGERED_BY,
  CHANGE_LOG_ENTITY_TYPE_LABELS,
} from "../../constants";
import {
  formatRelativeTime,
  formatDateTime,
  getFieldLabel,
  formatFieldValue,
  getActionLabel,
} from "../../utils";
import { useChangeLogs } from "../../hooks";
import { cn } from "@/lib/utils";
import { useEntityDetails } from "@/hooks/common/use-entity-details";
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

  // Use the same API URL configuration as the API client
  const apiUrl = import.meta.env.VITE_API_URL || "http://192.168.10.169:3030";
  // Use thumbnail endpoint for file previews, serve endpoint for logos
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
        alt="Logo"
        className={cn(
          "object-cover border border-border rounded-md bg-muted",
          size,
          imageLoading ? "opacity-0" : "opacity-100",
        )}
        onError={(_e) => {
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
const actionConfig: Record<
  CHANGE_LOG_ACTION,
  { icon: React.ElementType; color: string }
> = {
  [CHANGE_LOG_ACTION.CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.RESTORE]: { icon: IconRefresh, color: "text-purple-600" },
  [CHANGE_LOG_ACTION.ROLLBACK]: {
    icon: IconArrowBackUpDouble,
    color: "text-blue-600",
  },
  [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconArchive, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: {
    icon: IconArchiveOff,
    color: "text-gray-600",
  },
  [CHANGE_LOG_ACTION.ACTIVATE]: {
    icon: IconToggleRight,
    color: "text-green-600",
  },
  [CHANGE_LOG_ACTION.DEACTIVATE]: {
    icon: IconToggleLeft,
    color: "text-orange-600",
  },
  [CHANGE_LOG_ACTION.APPROVE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.REJECT]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.CANCEL]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.COMPLETE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.RESCHEDULE]: { icon: IconCalendar, color: "text-blue-600" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: {
    icon: IconEdit,
    color: "text-neutral-600",
  },
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

// Empty state
const EmptyState = ({ entityType }: { entityType: CHANGE_LOG_ENTITY_TYPE }) => (
  <div className="text-center py-12">
    <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground mb-2">Nenhuma alteração registrada</p>
    <p className="text-sm text-muted-foreground">
      As alterações realizadas neste{" "}
      {CHANGE_LOG_ENTITY_TYPE_LABELS[entityType]?.toLowerCase() || "item"}{" "}
      aparecerão aqui
    </p>
  </div>
);

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
        // Ensure we have a proper file object for FilePreviewCard
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
            {/* Cut Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-xs font-semibold truncate min-w-0 flex-1">
                  {cut.file?.filename || cut.file?.name || "Arquivo de recorte"}
                </h4>
                {cut.status && (
                  <Badge
                    variant={ENTITY_BADGE_CONFIG.CUT?.[cut.status as CUT_STATUS] || "default"}
                    className="text-[10px] h-4 px-1.5 flex-shrink-0"
                  >
                    {CUT_STATUS_LABELS[cut.status as CUT_STATUS] || cut.status}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {cut.type && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Tipo:</span>
                    <span>{CUT_TYPE_LABELS[cut.type as CUT_TYPE] || cut.type}</span>
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
                    <span>{CUT_ORIGIN_LABELS[cut.origin as CUT_ORIGIN] || cut.origin}</span>
                  </div>
                )}
              </div>
            </div>

            {/* File Preview on Right */}
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

  const statusLabels: Record<string, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em Progresso",
    WAITING_APPROVE: "Aguardando Aprovação",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

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

          {/* Status */}
          {service.status && (
            <div className="text-sm">
              <span className="text-muted-foreground">Status: </span>
              <Badge variant="secondary" className="text-[10px] h-5 px-2">
                {statusLabels[service.status] || service.status}
              </Badge>
            </div>
          )}

          {/* Timestamps */}
          {service.startedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">Iniciado: </span>
              <span className="text-foreground">
                {formatDateTime(service.startedAt)}
              </span>
            </div>
          )}
          {service.finishedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">Finalizado: </span>
              <span className="text-foreground">
                {formatDateTime(service.finishedAt)}
              </span>
            </div>
          )}

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
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status as AIRBRUSHING_STATUS] ||
                  airbrushing.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Badge style for paint cards in changelog - matches paint-card.tsx
const PAINT_BADGE_STYLE = "border-0 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:border-0 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300";
const PAINT_TAG_BADGE_STYLE = "border-0 bg-neutral-700 text-neutral-100 dark:bg-neutral-300 dark:text-neutral-800 hover:border-0 hover:bg-neutral-700 hover:text-neutral-100 dark:hover:bg-neutral-300 dark:hover:text-neutral-800";

// Render paints as cards - matches the visual style of paint-card.tsx
const renderPaintsCards = (paints: any[]) => {
  if (!Array.isArray(paints) || paints.length === 0) {
    return (
      <span className="text-red-600 dark:text-red-400 font-medium ml-1">—</span>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      {paints.map((paint: any, index: number) => {
        const backgroundColor = formatHexColor(paint.hex);
        const textColor = getContrastingTextColor(paint.hex);
        const codeOverlayStyle = textColor === "#FFFFFF"
          ? { backgroundColor: "rgba(255,255,255,0.9)", color: "#000000" }
          : { backgroundColor: "rgba(0,0,0,0.75)", color: "#FFFFFF" };

        return (
          <div
            key={paint.id || index}
            className="border dark:border-border rounded-lg overflow-hidden bg-card"
          >
            {/* Color preview header - matches paint-card.tsx h-28 */}
            <div className="h-20 relative flex-shrink-0 overflow-hidden">
              {paint.colorPreview ? (
                <img
                  src={paint.colorPreview}
                  alt={paint.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor }} />
              )}

              {/* Paint code overlay */}
              {paint.code && (
                <div
                  className="absolute bottom-1.5 right-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={codeOverlayStyle}
                >
                  {paint.code}
                </div>
              )}
            </div>

            {/* Card content */}
            <div className="p-2">
              {/* Name */}
              <h4 className="font-semibold text-sm line-clamp-2">{paint.name}</h4>

              {/* Badges */}
              <div className="flex flex-nowrap gap-1 overflow-hidden mt-1.5">
                {paint.paintType?.name && (
                  <Badge className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", PAINT_BADGE_STYLE)}>
                    {paint.paintType.name}
                  </Badge>
                )}
                {paint.finish && (
                  <Badge className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", PAINT_BADGE_STYLE)}>
                    {PAINT_FINISH_LABELS[paint.finish as PAINT_FINISH]}
                  </Badge>
                )}
                {paint.paintBrand?.name && (
                  <Badge className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", PAINT_BADGE_STYLE)}>
                    {paint.paintBrand.name}
                  </Badge>
                )}
                {paint.manufacturer && (
                  <Badge className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", PAINT_BADGE_STYLE)}>
                    {TRUCK_MANUFACTURER_LABELS[paint.manufacturer as TRUCK_MANUFACTURER]}
                  </Badge>
                )}
              </div>

              {/* Tags */}
              {paint.tags && paint.tags.length > 0 && (
                <div className="w-full overflow-x-auto mt-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="flex gap-1 whitespace-nowrap">
                    {paint.tags.map((tag: string, tagIndex: number) => (
                      <Badge
                        key={tagIndex}
                        className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", PAINT_TAG_BADGE_STYLE)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
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
    users: Map<string, { name: string; email?: string }>;
    customers: Map<string, string>;
    sectors: Map<string, string>;
    paints: Map<string, any>;
    formulas: Map<string, string>;
    items: Map<string, string>;
    files: Map<string, string>;
    observations: Map<string, string>;
    trucks: Map<string, string>;
    serviceOrders: Map<string, any>;
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
  const formatValueWithEntity = (
    value: any,
    field: string | null,
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
        if (
          field === "categoryId" &&
          entityDetails.categories.has(parsedValue)
        ) {
          return entityDetails.categories.get(parsedValue) || "Categoria";
        }
        if (field === "brandId" && entityDetails.brands.has(parsedValue)) {
          return entityDetails.brands.get(parsedValue) || "Marca";
        }
        if (field === "supplierId" && entityDetails.suppliers.has(value)) {
          return entityDetails.suppliers.get(value) || "Fornecedor";
        }
        if (
          (field === "assignedToUserId" || field === "createdById" || field === "startedById" || field === "completedById" || field === "approvedById" || field === "assignedToId") &&
          entityDetails.users.has(value)
        ) {
          return entityDetails.users.get(value) || "Usuário";
        }
        if ((field === "customerId" || field === "invoiceToId") && entityDetails.customers.has(value)) {
          return entityDetails.customers.get(value) || "Cliente";
        }
        if (field === "sectorId" && entityDetails.sectors.has(value)) {
          return entityDetails.sectors.get(value) || "Setor";
        }
        if (field === "paintId" && entityDetails.paints.has(value)) {
          // Return the full paint object for special rendering
          return entityDetails.paints.get(value) || "Tinta";
        }
        if (
          (field === "formulaId" || field === "formulaPaintId") &&
          entityDetails.formulas.has(value)
        ) {
          return entityDetails.formulas.get(value) || "Fórmula";
        }
        if (field === "itemId" && entityDetails.items.has(value)) {
          return entityDetails.items.get(value) || "Item";
        }
        if (
          (field === "budgetIds" ||
            field === "invoiceIds" ||
            field === "receiptIds") &&
          entityDetails.files.has(value)
        ) {
          return entityDetails.files.get(value) || "Arquivo";
        }
        if (
          field === "observationId" &&
          entityDetails.observations.has(value)
        ) {
          return entityDetails.observations.get(value) || "Observação";
        }
      }

      // If entity details not available, show a placeholder
      if (field === "categoryId") return "Categoria (carregando...)";
      if (field === "brandId") return "Marca (carregando...)";
      if (field === "supplierId") return "Fornecedor (carregando...)";
      if (field === "assignedToUserId" || field === "createdById" || field === "startedById" || field === "completedById" || field === "approvedById" || field === "assignedToId")
        return "Usuário (carregando...)";
      if (field === "customerId" || field === "invoiceToId") return "Cliente (carregando...)";
      if (field === "sectorId") return "Setor (carregando...)";
      if (field === "paintId") return "Tinta (carregando...)";
      if (field === "formulaId" || field === "formulaPaintId")
        return "Fórmula (carregando...)";
      if (field === "itemId") return "Item (carregando...)";
      if (
        field === "budgetIds" ||
        field === "invoiceIds" ||
        field === "receiptIds"
      )
        return "Arquivo (carregando...)";
      if (field === "observationId") return "Observação (carregando...)";
      if (field === "truckId") return "Caminhão (carregando...)";
    }

    // Special handling for logoId fields - render as images
    if (
      (field === "logoId" || field === "logo") &&
      value &&
      value !== "Nenhum"
    ) {
      // Check if value is a UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

    // Render arrays as stacked lines (e.g., representatives)
    if (Array.isArray(result)) {
      return result.map((item, i) => (
        <div key={i}>{String(item)}</div>
      ));
    }

    return result;
  };

  // Determine the action label
  const actionLabel = getActionLabel(
    firstChange.action as any,
    firstChange.triggeredBy || CHANGE_TRIGGERED_BY.USER,
    firstChange.metadata as { sourceTaskName?: string } | undefined,
  );

  // Check if this is a CREATE action
  if (firstChange.action === CHANGE_LOG_ACTION.CREATE) {
    // Extract entity details from newValue for CREATE actions
    let entityDetails: any = null;
    try {
      if (firstChange.newValue) {
        entityDetails =
          typeof firstChange.newValue === "string"
            ? JSON.parse(firstChange.newValue)
            : firstChange.newValue;
      }
    } catch (e) {
      // Failed to parse
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
            <div className="text-lg font-semibold mb-2">{actionLabel}</div>

            {/* Service Order Details */}
            {entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
              entityDetails && (
                <div className="space-y-2 mb-3">
                  {entityDetails.type && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="text-foreground font-medium">
                        {SERVICE_ORDER_TYPE_LABELS[entityDetails.type as SERVICE_ORDER_TYPE] ||
                          entityDetails.type}
                      </span>
                    </div>
                  )}
                  {entityDetails.description && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Descrição: </span>
                      <span className="text-foreground font-medium">
                        {entityDetails.description}
                      </span>
                    </div>
                  )}
                  {entityDetails.status && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Status: </span>
                      <span className="text-foreground font-medium">
                        {SERVICE_ORDER_STATUS_LABELS[entityDetails.status as SERVICE_ORDER_STATUS] ||
                          entityDetails.status}
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* Truck Details */}
            {entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK && entityDetails && (
              <div className="space-y-2 mb-3">
                {entityDetails.plate && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Placa: </span>
                    <span className="text-foreground font-medium">
                      {entityDetails.plate}
                    </span>
                  </div>
                )}
                {entityDetails.chassisNumber && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Chassi: </span>
                    <span className="text-foreground font-medium">
                      {entityDetails.chassisNumber}
                    </span>
                  </div>
                )}
                {entityDetails.category && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Categoria: </span>
                    <span className="text-foreground font-medium">
                      {TRUCK_MANUFACTURER_LABELS[entityDetails.category as TRUCK_MANUFACTURER] ||
                        entityDetails.category}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Layout Details with SVG Visualization - Show all layouts in group horizontally */}
            {entityType === CHANGE_LOG_ENTITY_TYPE.LAYOUT && (
              <div className="flex flex-row flex-wrap gap-3 mb-3">
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

                    return { layoutChange, layoutDetails, sideName, sortOrder };
                  })
                  .filter(Boolean)
                  .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                  .map(({ layoutChange, layoutDetails, sideName }: any) => (
                    <div key={layoutChange.id} className="flex-shrink-0">
                      <div className="text-xs font-medium text-muted-foreground mb-1 text-center">
                        {sideName}
                      </div>
                      <div className="border rounded-lg bg-white/50 dark:bg-muted/30 backdrop-blur-sm p-1.5">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: generateLayoutSVG(layoutDetails),
                          }}
                          className="[&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-[140px] [&>svg]:max-h-[60px]"
                        />
                      </div>
                    </div>
                  ))}
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
              {/* Simplify the label for status changes */}
              {firstChange.field === "status" ? "Status" : actionLabel}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatRelativeTime(firstChange.createdAt)}
            </div>
          </div>

          {/* SERVICE_ORDER UPDATE - Special handling to group related changes */}
          {entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
            firstChange.action === CHANGE_LOG_ACTION.UPDATE &&
            (() => {
              // Get service order details from entityDetails
              const serviceOrderDetails = entityDetails?.serviceOrders?.get(
                firstChange.entityId,
              );

              // Group related field changes intelligently for service orders
              const statusChange = changelogGroup.find(
                (c) => c.field === "status",
              );
              const descriptionChange = changelogGroup.find(
                (c) => c.field === "description",
              );
              const typeChange = changelogGroup.find((c) => c.field === "type");
              const timestampChanges = changelogGroup.filter((c) =>
                [
                  "startedAt",
                  "finishedAt",
                  "approvedAt",
                  "completedAt",
                ].includes(c.field || ""),
              );
              const userChanges = changelogGroup.filter((c) =>
                ["startedById", "completedById", "approvedById"].includes(
                  c.field || "",
                ),
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
                  if (newStatus === "IN_PROGRESS" && c.field === "startedAt")
                    return true;
                  if (
                    newStatus === "COMPLETED" &&
                    (c.field === "finishedAt" || c.field === "completedAt")
                  )
                    return true;
                  if (
                    newStatus === "WAITING_APPROVE" &&
                    c.field === "approvedAt"
                  )
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
                  if (
                    newStatus === "WAITING_APPROVE" &&
                    c.field === "approvedById"
                  )
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
                <div className="space-y-3">
                  {/* Service Order identification - show description and type */}
                  {(descriptionChange || typeChange || serviceOrderDetails) && (
                    <div className="mb-3 space-y-2">
                      {(descriptionChange?.newValue ||
                        serviceOrderDetails?.description) && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Descrição:{" "}
                          </span>
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

                  {/* Status change summary */}
                  {statusSummary && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                      <div className="font-medium text-foreground">
                        {statusSummary.title}
                      </div>
                      {statusSummary.timestamp && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <IconClock className="inline h-3.5 w-3.5 mr-1" />
                          {statusSummary.timestamp}
                        </div>
                      )}
                      {statusSummary.user && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <IconUser className="inline h-3.5 w-3.5 mr-1" />
                          Por: {statusSummary.user}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Other field changes (observation, description, type, assignedToId) */}
                  {otherChanges.length > 0 && (
                    <div className="space-y-2">
                      {otherChanges.map((changelog) => (
                        <div key={changelog.id} className="text-sm">
                          <span className="text-muted-foreground">
                            {getFieldLabel(changelog.field, entityType)}:{" "}
                          </span>
                          <span className="text-red-600 dark:text-red-400 line-through mr-2">
                            {formatFieldValue(
                              changelog.oldValue,
                              changelog.field,
                              entityType,
                            ) || "Nenhum"}
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            {formatFieldValue(
                              changelog.newValue,
                              changelog.field,
                              entityType,
                            ) || "Nenhum"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Field changes (generic - not SERVICE_ORDER) */}
          {entityType !== CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER && (
            <div className="space-y-3">
              {changelogGroup
                .filter((changelog) => {
                  // Exclude internal/system fields from display
                  if (changelog.field === "statusOrder") return false;
                  if (changelog.field === "colorOrder") return false;

                  // Exclude services field when it's just internal updates (service orders have their own changelog)
                  if (changelog.field === "services") {
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
                    const oldCount = Array.isArray(oldParsed)
                      ? oldParsed.length
                      : 0;
                    const newCount = Array.isArray(newParsed)
                      ? newParsed.length
                      : 0;

                    // If count is the same, services weren't added/removed, just updated - don't show
                    if (oldCount === newCount && oldCount > 0) {
                      return false;
                    }
                  }

                  return true;
                })
                .map((changelog, index) => {
                  if (!changelog.field) {
                    return null;
                  }

                  const showSeparator =
                    index > 0 && index < changelogGroup.length;

                  return (
                    <div key={changelog.id}>
                      {showSeparator && <Separator className="my-3 opacity-40" />}

                      {/* Field name - Hide for services field as it renders as cards */}
                      {changelog.field !== "services" && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-muted-foreground">
                            <span className="text-muted-foreground">
                              Campo:{" "}
                            </span>
                            <span className="text-foreground font-medium">
                              {getFieldLabel(changelog.field, entityType)}
                            </span>
                          </div>

                          {/* Rollback button */}
                          {(firstChange.action === CHANGE_LOG_ACTION.UPDATE ||
                            firstChange.action ===
                              CHANGE_LOG_ACTION.ROLLBACK) &&
                            changelog.field &&
                            changelog.oldValue !== null &&
                            onRollback &&
                            (entityType === CHANGE_LOG_ENTITY_TYPE.TASK ||
                              entityType === CHANGE_LOG_ENTITY_TYPE.TRUCK ||
                              entityType === CHANGE_LOG_ENTITY_TYPE.TASK_PRICING ||
                              entityType === CHANGE_LOG_ENTITY_TYPE.TASK_PRICING_ITEM) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  onRollback(
                                    changelog.id,
                                    getFieldLabel(changelog.field!, entityType),
                                  )
                                }
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
                      )}

                      {/* Values */}
                      <div className="space-y-1">
                        {changelog.oldValue !== undefined ||
                        changelog.newValue !== undefined ? (
                          <>
                            {/* Handle different cases: check special fields first, then generic cases */}
                            {changelog.field === "cuts" ||
                            changelog.field === "cutRequest" ||
                            changelog.field === "cutPlan" ? (
                              // Special handling for cuts - render as cards (handles all cases: add, remove, update)
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

                                const oldParsed = parseValue(
                                  changelog.oldValue,
                                );
                                const newParsed = parseValue(
                                  changelog.newValue,
                                );

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
                              // Special handling for services - DON'T show for TASK since service orders have their own changelog
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

                                const oldParsed = parseValue(
                                  changelog.oldValue,
                                );
                                const newParsed = parseValue(
                                  changelog.newValue,
                                );

                                // Check if old or new is empty
                                const hasOld =
                                  Array.isArray(oldParsed) &&
                                  oldParsed.length > 0;
                                const hasNew =
                                  Array.isArray(newParsed) &&
                                  newParsed.length > 0;

                                // Check if services were actually added or removed (count changed)
                                const oldCount = Array.isArray(oldParsed)
                                  ? oldParsed.length
                                  : 0;
                                const newCount = Array.isArray(newParsed)
                                  ? newParsed.length
                                  : 0;

                                // If count is the same, services weren't added/removed, just updated internally
                                // In this case, don't show anything - individual service order changelogs will show below
                                if (oldCount === newCount && oldCount > 0) {
                                  return null;
                                }

                                // Only show services being added (no "Antes:/Depois:" labels)
                                if (!hasOld && hasNew) {
                                  return renderServicesCards(newParsed);
                                }

                                // Only show services being removed
                                if (hasOld && !hasNew) {
                                  return (
                                    <div>
                                      <span className="text-sm text-muted-foreground mb-2 block">
                                        Removidos:
                                      </span>
                                      {renderServicesCards(oldParsed)}
                                    </div>
                                  );
                                }

                                // Show added and removed services when count changed
                                if (hasOld && hasNew && oldCount !== newCount) {
                                  // Find which services were added/removed by ID
                                  const oldIds = new Set(
                                    oldParsed
                                      .map((s: any) => s.id)
                                      .filter(Boolean),
                                  );
                                  const newIds = new Set(
                                    newParsed
                                      .map((s: any) => s.id)
                                      .filter(Boolean),
                                  );

                                  const addedServices = newParsed.filter(
                                    (s: any) => s.id && !oldIds.has(s.id),
                                  );
                                  const removedServices = oldParsed.filter(
                                    (s: any) => s.id && !newIds.has(s.id),
                                  );

                                  return (
                                    <>
                                      {removedServices.length > 0 && (
                                        <div className="mb-3">
                                          <span className="text-sm text-muted-foreground mb-2 block">
                                            Removidos:
                                          </span>
                                          {renderServicesCards(removedServices)}
                                        </div>
                                      )}
                                      {addedServices.length > 0 && (
                                        <div>
                                          {removedServices.length > 0 && (
                                            <span className="text-sm text-muted-foreground mb-2 block">
                                              Adicionados:
                                            </span>
                                          )}
                                          {renderServicesCards(addedServices)}
                                        </div>
                                      )}
                                    </>
                                  );
                                }

                                // Nothing to show
                                return null;
                              })()
                            ) : changelog.field === "airbrushings" ? (
                              // Special handling for airbrushings - render as cards (handles all cases: add, remove, update)
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

                                const oldParsed = parseValue(
                                  changelog.oldValue,
                                );
                                const newParsed = parseValue(
                                  changelog.newValue,
                                );

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
                              // Special handling for paintId (general painting) - render as single paint card
                              (() => {
                                // Get full paint objects from entityDetails
                                const getFullPaint = (paintIdValue: any) => {
                                  if (
                                    !paintIdValue ||
                                    typeof paintIdValue !== "string"
                                  )
                                    return null;
                                  const uuidRegex =
                                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                  if (!uuidRegex.test(paintIdValue))
                                    return null;
                                  return (
                                    entityDetails?.paints.get(paintIdValue) ||
                                    null
                                  );
                                };

                                const oldPaint = getFullPaint(
                                  changelog.oldValue,
                                );
                                const newPaint = getFullPaint(
                                  changelog.newValue,
                                );

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
                              // Special handling for paints, paintGrounds, and groundPaints - render as cards (handles all cases: add, remove, update)
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

                                // Convert array of paint IDs to full paint objects
                                const getPaintObjects = (paintIds: any) => {
                                  if (!paintIds || !Array.isArray(paintIds))
                                    return null;

                                  const paintObjects = paintIds
                                    .map((id: string) => {
                                      // ID could be a string UUID or already a full object
                                      if (typeof id === "object" && id !== null)
                                        return id;
                                      if (typeof id !== "string") return null;

                                      // Check if it's a valid UUID
                                      const uuidRegex =
                                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                      if (!uuidRegex.test(id)) return null;

                                      // Look up the full paint object from entityDetails
                                      return (
                                        entityDetails?.paints.get(id) || null
                                      );
                                    })
                                    .filter(Boolean);

                                  return paintObjects.length > 0
                                    ? paintObjects
                                    : null;
                                };

                                const oldParsed = parseValue(
                                  changelog.oldValue,
                                );
                                const newParsed = parseValue(
                                  changelog.newValue,
                                );

                                const oldPaints = getPaintObjects(oldParsed);
                                const newPaints = getPaintObjects(newParsed);

                                return (
                                  <>
                                    <div>
                                      <span className="text-sm text-muted-foreground">
                                        Antes:
                                      </span>
                                      {renderPaintsCards(oldPaints || [])}
                                    </div>
                                    <div className="mt-3">
                                      <span className="text-sm text-muted-foreground">
                                        Depois:
                                      </span>
                                      {renderPaintsCards(newPaints || [])}
                                    </div>
                                  </>
                                );
                              })()
                            ) : changelog.oldValue !== null &&
                              changelog.newValue === null ? (
                              // Field removed (generic case for non-special fields)
                              <div className="text-sm">
                                <span className="text-muted-foreground">
                                  Removido:{" "}
                                </span>
                                <span className="text-red-600 dark:text-red-400 font-medium line-through">
                                  {formatValueWithEntity(
                                    changelog.oldValue,
                                    changelog.field,
                                    changelog.metadata,
                                  )}
                                </span>
                              </div>
                            ) : Array.isArray(changelog.oldValue) &&
                              Array.isArray(changelog.newValue) &&
                              changelog.field === "phones" ? (
                              // Special handling for phone arrays - show complete lists
                              <>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">
                                    Antes:{" "}
                                  </span>
                                  <span className="text-red-600 dark:text-red-400 font-medium">
                                    {formatValueWithEntity(
                                      changelog.oldValue,
                                      changelog.field,
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
                                      changelog.metadata,
                                    )}
                                  </span>
                                </div>
                              </>
                            ) : Array.isArray(changelog.oldValue) &&
                              Array.isArray(changelog.newValue) &&
                              (changelog.field === "barcodes" ||
                                changelog.field === "barcode") ? (
                              // Special handling for barcode arrays
                              <>
                                {(() => {
                                  const oldBarcodes =
                                    changelog.oldValue as string[];
                                  const newBarcodes =
                                    changelog.newValue as string[];
                                  const added = newBarcodes.filter(
                                    (bc) => !oldBarcodes.includes(bc),
                                  );
                                  const removed = oldBarcodes.filter(
                                    (bc) => !newBarcodes.includes(bc),
                                  );

                                  return (
                                    <>
                                      {removed.length > 0 && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">
                                            Removidos:{" "}
                                          </span>
                                          <span className="text-red-600 dark:text-red-400 font-medium">
                                            {removed.join(", ")}
                                          </span>
                                        </div>
                                      )}
                                      {added.length > 0 && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">
                                            Adicionados:{" "}
                                          </span>
                                          <span className="text-green-600 dark:text-green-400 font-medium">
                                            {added.join(", ")}
                                          </span>
                                        </div>
                                      )}
                                      {removed.length === 0 &&
                                        added.length === 0 && (
                                          <div className="text-sm">
                                            <span className="text-muted-foreground">
                                              Reordenados
                                            </span>
                                          </div>
                                        )}
                                    </>
                                  );
                                })()}
                              </>
                            ) : changelog.field === "truck.leftSideLayoutId" ||
                              changelog.field === "truck.rightSideLayoutId" ||
                              changelog.field === "truck.backSideLayoutId" ? (
                              // Special handling for truck layout fields - show SVG visualization
                              (() => {
                                const parseLayoutValue = (val: any) => {
                                  if (!val) return null;
                                  if (
                                    typeof val === "string" &&
                                    val.trim().startsWith("{")
                                  ) {
                                    try {
                                      return JSON.parse(val);
                                    } catch (e) {
                                      return null;
                                    }
                                  }
                                  return typeof val === "object" ? val : null;
                                };

                                const oldLayout = parseLayoutValue(
                                  changelog.oldValue,
                                );
                                const newLayout = parseLayoutValue(
                                  changelog.newValue,
                                );

                                const sideName = changelog.field.includes(
                                  "leftSide",
                                )
                                  ? "Lado Motorista"
                                  : changelog.field.includes("rightSide")
                                    ? "Lado Sapo"
                                    : changelog.field.includes("backSide")
                                      ? "Traseira"
                                      : "Layout";

                                return (
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      {sideName}
                                    </div>

                                    {oldLayout &&
                                      oldLayout.layoutSections &&
                                      oldLayout.layoutSections.length > 0 && (
                                        <div>
                                          <span className="text-sm text-muted-foreground mb-1 block">
                                            Antes:
                                          </span>
                                          <div className="border rounded-lg bg-white/50 dark:bg-muted/30 backdrop-blur-sm p-1.5">
                                            <div
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  generateLayoutSVG(oldLayout),
                                              }}
                                              className="[&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-[140px] [&>svg]:max-h-[60px]"
                                            />
                                          </div>
                                        </div>
                                      )}

                                    {newLayout &&
                                      newLayout.layoutSections &&
                                      newLayout.layoutSections.length > 0 && (
                                        <div>
                                          <span className="text-sm text-muted-foreground mb-1 block">
                                            Depois:
                                          </span>
                                          <div className="border rounded-lg bg-white/50 dark:bg-muted/30 backdrop-blur-sm p-1.5">
                                            <div
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  generateLayoutSVG(newLayout),
                                              }}
                                              className="[&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-[140px] [&>svg]:max-h-[60px]"
                                            />
                                          </div>
                                        </div>
                                      )}

                                    {!oldLayout?.layoutSections?.length &&
                                      !newLayout?.layoutSections?.length && (
                                        <div className="text-sm text-muted-foreground">
                                          Layout modificado (sem visualização
                                          disponível)
                                        </div>
                                      )}
                                  </div>
                                );
                              })()
                            ) : changelog.field === "logoId" ||
                              changelog.field === "logo" ? (
                              // Special handling for logo fields - show "Antes" and "Depois" format
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
                            ) : changelog.field === "artworks" ||
                              changelog.field === "artworkIds" ||
                              changelog.field === "baseFileIds" ||
                              changelog.field === "budgets" ||
                              changelog.field === "invoices" ||
                              changelog.field === "receipts" ? (
                              // Special handling for file fields - show thumbnail previews
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
                                    const files = parseValue(
                                      changelog.oldValue,
                                    );
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
                                          // Handle both object format {id: "..."} and string format "id"
                                          const fileId =
                                            typeof file === "string"
                                              ? file
                                              : file.id;
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
                                    const files = parseValue(
                                      changelog.newValue,
                                    );
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
                                          // Handle both object format {id: "..."} and string format "id"
                                          const fileId =
                                            typeof file === "string"
                                              ? file
                                              : file.id;
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
                            ) : changelog.field === "layouts" ? (
                              // Display layout changelog with dimensions, door count, and SVG
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

                                const oldLayouts = parseValue(
                                  changelog.oldValue,
                                );
                                const newLayouts = parseValue(
                                  changelog.newValue,
                                );

                                const layoutSides = [
                                  {
                                    key: "leftSideLayoutId",
                                    label: "Lado Motorista",
                                  },
                                  {
                                    key: "rightSideLayoutId",
                                    label: "Lado Sapo",
                                  },
                                  {
                                    key: "backSideLayoutId",
                                    label: "Traseira",
                                  },
                                ];

                                // Find sides that have changes
                                const changedSides = layoutSides.filter(
                                  ({ key }) =>
                                    (oldLayouts && oldLayouts[key] !== undefined) ||
                                    (newLayouts && newLayouts[key] !== undefined),
                                );

                                if (changedSides.length === 0) {
                                  return (
                                    <span className="text-muted-foreground text-sm">
                                      Sem alterações
                                    </span>
                                  );
                                }

                                const getDimensions = (layout: any) => {
                                  if (!layout) return null;
                                  return {
                                    width: Math.round((layout.totalWidth || 0) * 100),
                                    height: Math.round((layout.height || 0) * 100),
                                    doors: layout.doorCount || 0,
                                  };
                                };

                                const renderLayoutChange = (
                                  oldLayout: any,
                                  newLayout: any,
                                ) => {
                                  const oldDims = getDimensions(oldLayout);
                                  const newDims = getDimensions(newLayout);

                                  // One side is null (added or removed)
                                  if (!oldDims && newDims) {
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="text-xs text-muted-foreground">Antes: </span>
                                          <span className="text-red-600 dark:text-red-400 font-medium text-xs">Nenhum</span>
                                        </div>
                                        <div>
                                          <span className="text-xs text-muted-foreground">Depois: </span>
                                          <span className="text-green-600 dark:text-green-400 font-medium text-xs">
                                            {newDims.width}cm × {newDims.height}cm — {newDims.doors} porta{newDims.doors !== 1 ? "s" : ""}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (oldDims && !newDims) {
                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <span className="text-xs text-muted-foreground">Antes: </span>
                                          <span className="text-red-600 dark:text-red-400 font-medium text-xs">
                                            {oldDims.width}cm × {oldDims.height}cm — {oldDims.doors} porta{oldDims.doors !== 1 ? "s" : ""}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-xs text-muted-foreground">Depois: </span>
                                          <span className="text-green-600 dark:text-green-400 font-medium text-xs">Nenhum</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (!oldDims && !newDims) {
                                    return <span className="text-muted-foreground text-xs">Sem alterações</span>;
                                  }

                                  // Both have values - check if dimensions are the same
                                  const sameMeasures = oldDims!.width === newDims!.width && oldDims!.height === newDims!.height;

                                  if (sameMeasures) {
                                    // Same measures → show door count change
                                    return (
                                      <div className="flex items-center gap-2 text-xs font-medium">
                                        <span className="text-red-600 dark:text-red-400">
                                          {oldDims!.doors} porta{oldDims!.doors !== 1 ? "s" : ""}
                                        </span>
                                        <span className="text-muted-foreground">→</span>
                                        <span className="text-green-600 dark:text-green-400">
                                          {newDims!.doors} porta{newDims!.doors !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    );
                                  }

                                  // Different measures → show dimensions change
                                  return (
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                      <span className="text-red-600 dark:text-red-400">
                                        {oldDims!.width}cm × {oldDims!.height}cm
                                      </span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="text-green-600 dark:text-green-400">
                                        {newDims!.width}cm × {newDims!.height}cm
                                      </span>
                                    </div>
                                  );
                                };

                                return (
                                  <div className="space-y-4">
                                    {changedSides.map(
                                      ({ key, label }) => {
                                        const oldLayout =
                                          oldLayouts?.[key] ?? null;
                                        const newLayout =
                                          newLayouts?.[key] ?? null;
                                        return (
                                          <div
                                            key={key}
                                            className="border dark:border-border rounded-lg p-3 bg-muted/20"
                                          >
                                            <div className="text-xs font-semibold mb-2">
                                              {label}
                                            </div>
                                            {renderLayoutChange(oldLayout, newLayout)}
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                );
                              })()
                            ) : changelog.field === "serviceOrders" ? (
                              // Special handling for serviceOrders from copy operation - show count
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
                                  return 0;
                                };

                                const oldCount = getCount(oldValue);
                                const newCount = getCount(newValue);

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
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        {newCount === 0
                                          ? "Nenhuma"
                                          : `${newCount} ordem${newCount > 1 ? "s" : ""} de serviço`}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()
                            ) : (
                              // Field updated - always show both "Antes:" and "Depois:" lines
                              <>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">
                                    Antes:{" "}
                                  </span>
                                  <span className="text-red-600 dark:text-red-400 font-medium">
                                    {formatValueWithEntity(
                                      changelog.oldValue,
                                      changelog.field,
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
                                      changelog.metadata,
                                    )}
                                  </span>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          // No value change recorded
                          <div className="text-sm text-muted-foreground">
                            Sem alteração de valor registrada
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-border/40 text-sm text-muted-foreground">
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

export function ChangelogHistory({
  entityType,
  entityId,
  entityName,
  entityCreatedAt,
  className,
  maxHeight,
  limit = 50,
}: ChangelogHistoryProps) {
  // Rollback loading state
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  // Get current user for privilege checking
  const { user } = useAuth();

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
  const handleRollback = async (changeLogId: string, _fieldName: string) => {
    // Only allow rollback for supported entities
    if (
      entityType !== CHANGE_LOG_ENTITY_TYPE.TASK &&
      entityType !== CHANGE_LOG_ENTITY_TYPE.TASK_PRICING &&
      entityType !== CHANGE_LOG_ENTITY_TYPE.TASK_PRICING_ITEM
    ) {
      return;
    }

    setRollbackLoading(changeLogId);

    try {
      await rollbackFieldChange({ changeLogId });

      // Success toast is handled by axios interceptor - no need to show duplicate toast

      // Refresh changelog data
      await refetch();
    } catch (error: any) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Rollback error:", error);
      }

      // Error toast is also handled by axios interceptor
      // Only log the error for debugging
    } finally {
      setRollbackLoading(null);
    }
  };

  const changelogs = useMemo(() => {
    const logs = changelogsResponse?.data || [];

    // Check if user can view financial fields (price, budgets, invoices, receipts, etc.)
    const canViewFinancialFields =
      user &&
      hasAnyPrivilege(user as any, [
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ADMIN,
      ]);

    // Check if user can view commission field (ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION)
    const canViewCommissionField =
      user &&
      hasAnyPrivilege(user as any, [
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.PRODUCTION,
      ]);

    // Check if user can view restricted fields (forecastDate, representatives)
    // Only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER can see these
    const canViewRestrictedFields =
      user &&
      hasAnyPrivilege(user as any, [
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.LOGISTIC,
        SECTOR_PRIVILEGES.DESIGNER,
      ]);

    // Check if user can view invoiceTo field - DESIGNER cannot see it
    // Only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC can see invoiceTo
    const canViewInvoiceToField =
      user &&
      hasAnyPrivilege(user as any, [
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.LOGISTIC,
      ]);

    // Define sensitive fields that should not be displayed
    const sensitiveFields = [
      "sessionToken",
      "verificationCode",
      "verificationExpiresAt",
      "verificationType",
      "password",
      "token",
      "apiKey",
      "secret",
    ];

    // Define internal/system fields that should be hidden from changelog (ordering, internal state, etc.)
    const hiddenFields = ["colorOrder"];

    // Define financial/document fields that should only be visible to FINANCIAL and ADMIN
    const financialFields = [
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
      "pricingId",
    ];

    // Define restricted fields that should only be visible to privileged users (ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER)
    const restrictedFields = [
      "forecastDate",
      "representatives",
      "representativeIds",
      "negotiatingWith",
    ]; // invoiceTo removed - has its own check

    // Define invoiceTo fields - DESIGNER cannot see these (only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC)
    const invoiceToFields = ["invoiceTo", "invoiceToId"];

    // Filter out sensitive field changes and restricted fields for non-privileged users
    const filteredLogs = logs.filter((log) => {
      if (!log.field) return true;

      // Check if the field is sensitive (case-insensitive)
      const fieldLower = log.field.toLowerCase();

      // Always filter out sensitive fields
      if (
        sensitiveFields.some((sensitive) =>
          fieldLower.includes(sensitive.toLowerCase()),
        )
      ) {
        return false;
      }

      // Always filter out hidden/internal fields (ordering, internal state, etc.)
      if (
        hiddenFields.some((hidden) => fieldLower.includes(hidden.toLowerCase()))
      ) {
        return false;
      }

      // Filter out financial fields for non-FINANCIAL/ADMIN users
      if (
        !canViewFinancialFields &&
        financialFields.some((financial) =>
          fieldLower.includes(financial.toLowerCase()),
        )
      ) {
        return false;
      }

      // Filter out commission field for users without permission
      if (!canViewCommissionField && fieldLower.includes("commission")) {
        return false;
      }

      // Filter out restricted fields (forecastDate, representatives) for non-privileged users
      if (
        !canViewRestrictedFields &&
        restrictedFields.some((restricted) =>
          fieldLower.includes(restricted.toLowerCase()),
        )
      ) {
        return false;
      }

      // Filter out invoiceTo fields - DESIGNER cannot see (only ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC)
      if (
        !canViewInvoiceToField &&
        invoiceToFields.some((invoiceTo) =>
          fieldLower.includes(invoiceTo.toLowerCase()),
        )
      ) {
        return false;
      }

      return true;
    });

    // Only add creation entry if entityCreatedAt is provided AND there's no existing CREATE action
    if (entityCreatedAt && !isLoading) {
      // Check if there's already a CREATE action in the filtered logs
      const hasCreateAction = filteredLogs.some(
        (log) => log.action === CHANGE_LOG_ACTION.CREATE,
      );

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
  }, [
    changelogsResponse?.data,
    entityCreatedAt,
    entityId,
    entityType,
    isLoading,
    user,
  ]);

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
    const serviceOrderIds = new Set<string>();

    changelogs.forEach((changelog) => {
      // Collect service order IDs from SERVICE_ORDER entity type changelogs
      if (
        changelog.entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER &&
        changelog.entityId
      ) {
        serviceOrderIds.add(changelog.entityId);
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

      if (changelog.field === "categoryId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          categoryIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          categoryIds.add(changelog.newValue);
      } else if (changelog.field === "brandId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          brandIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          brandIds.add(changelog.newValue);
      } else if (changelog.field === "supplierId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          supplierIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          supplierIds.add(changelog.newValue);
      } else if (
        changelog.field === "assignedToUserId" ||
        changelog.field === "createdById"
      ) {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          userIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          userIds.add(changelog.newValue);
      } else if (changelog.field === "customerId" || changelog.field === "invoiceToId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          customerIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          customerIds.add(changelog.newValue);
      } else if (changelog.field === "sectorId") {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (
          changelog.oldValue &&
          typeof changelog.oldValue === "string" &&
          uuidRegex.test(changelog.oldValue)
        )
          sectorIds.add(changelog.oldValue);
        if (
          changelog.newValue &&
          typeof changelog.newValue === "string" &&
          uuidRegex.test(changelog.newValue)
        )
          sectorIds.add(changelog.newValue);
      } else if (changelog.field === "paintId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          paintIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          paintIds.add(changelog.newValue);
      } else if (
        changelog.field === "logoPaints" ||
        changelog.field === "logoPaintIds" ||
        changelog.field === "paints" ||
        changelog.field === "groundPaints" ||
        changelog.field === "paintGrounds"
      ) {
        // Extract paint IDs from arrays
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
      } else if (
        changelog.field === "formulaId" ||
        changelog.field === "formulaPaintId"
      ) {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          formulaIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          formulaIds.add(changelog.newValue);
      } else if (changelog.field === "itemId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          itemIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          itemIds.add(changelog.newValue);
      } else if (
        changelog.field === "budgetId" ||
        changelog.field === "nfeId" ||
        changelog.field === "receiptId"
      ) {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          fileIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          fileIds.add(changelog.newValue);
      } else if (changelog.field === "observationId") {
        if (changelog.oldValue && typeof changelog.oldValue === "string")
          observationIds.add(changelog.oldValue);
        if (changelog.newValue && typeof changelog.newValue === "string")
          observationIds.add(changelog.newValue);
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
      serviceOrderIds: Array.from(serviceOrderIds),
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
    const recentChanges = changelogs.filter(
      (c) =>
        new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    ).length;

    const uniqueUsers = new Set(changelogs.map((c) => c.userId).filter(Boolean))
      .size;

    const fieldChanges = changelogs.reduce(
      (acc, c) => {
        if (c.field) {
          acc[c.field] = (acc[c.field] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostChangedField = Object.entries(fieldChanges).sort(
      ([, a], [, b]) => b - a,
    )[0];

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
            <p className="text-destructive">
              Erro ao carregar histórico de alterações
            </p>
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
    <Card
      className={cn(
        "shadow-sm border border-border flex flex-col overflow-hidden",
        className,
      )}
      style={maxHeight ? { maxHeight, height: maxHeight } : undefined}
    >
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Histórico de Alterações
          {entityName && (
            <span className="text-base font-normal text-muted-foreground">
              - {entityName}
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

      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <ChangelogSkeleton />
        ) : changelogs.length === 0 ? (
          <EmptyState entityType={entityType} />
        ) : (
          <ScrollArea className="pr-4 h-full">
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
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
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
                                entityDetails={entityDetails as any}
                                onRollback={handleRollback}
                                rollbackLoading={rollbackLoading}
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
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
