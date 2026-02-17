import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useFieldArray, useWatch, useController } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconNote, IconArrowsSort } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_DISPLAY_ORDER, SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { Textarea } from "@/components/ui/textarea";
import { getServiceOrderStatusColor } from "../../../../utils";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";
import { ServiceDescriptionInput } from "./service-description-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ServiceSelectorProps {
  control: any;
  disabled?: boolean;
  currentUserId?: string;
  userPrivilege?: string;
  isTeamLeader?: boolean;
  onItemDeleted?: (description: string) => void;
  isAccordionOpen?: boolean;
}

export function ServiceSelectorAutoGrouped({ control, disabled, currentUserId, userPrivilege, isTeamLeader = false, onItemDeleted, isAccordionOpen }: ServiceSelectorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "serviceOrders",
  });

  // Track field IDs that are "pending organization" — they stay in the ungrouped section
  // even after being filled in, until the user presses "Organizar" or the accordion closes
  const [pendingFieldIds, setPendingFieldIds] = useState<Set<string>>(new Set());
  const prevAccordionOpen = useRef(isAccordionOpen);

  // Organize (clear pending) when accordion closes
  useEffect(() => {
    if (prevAccordionOpen.current === true && isAccordionOpen === false) {
      setPendingFieldIds(new Set());
    }
    prevAccordionOpen.current = isAccordionOpen;
  }, [isAccordionOpen]);

  // Watch all services
  const servicesValues = (useWatch({
    control,
    name: "serviceOrders",
  }) as any[] | undefined) ?? [];

  // Helper function to determine if a service order can be edited by the current user
  const canEditServiceOrder = useCallback((serviceOrder: any) => {
    if (!userPrivilege || !serviceOrder) return true; // If no privilege info, allow editing (fallback)

    // Admin can edit all service orders
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) return true;

    // Get the service order type and assignment
    const { type, assignedToId } = serviceOrder;
    const isNotAssigned = !assignedToId || assignedToId === null || assignedToId === "";
    const isAssignedToCurrentUser = assignedToId === currentUserId;

    // Allow editing of new service orders (ones without an id) so users can set type and description
    // EXCEPT for DESIGNER users who can only edit ARTWORK service orders
    const isNewServiceOrder = !serviceOrder.id || (typeof serviceOrder.id === 'string' && serviceOrder.id.startsWith('temp-'));
    if (isNewServiceOrder) {
      // DESIGNER users can only edit new service orders if they're ARTWORK type
      if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
        return type === SERVICE_ORDER_TYPE.ARTWORK;
      }
      return true;
    }

    // Check permissions based on sector and service order type
    // Users can edit fields (description, responsible, observation) on all service order types
    // Status editing is controlled separately by canEditServiceOrderStatus
    switch (userPrivilege) {
      case SECTOR_PRIVILEGES.COMMERCIAL:
        // Commercial can edit fields on ALL service order types
        return true;

      case SECTOR_PRIVILEGES.FINANCIAL:
        // Can edit FINANCIAL service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.FINANCIAL && (isNotAssigned || isAssignedToCurrentUser);

      case SECTOR_PRIVILEGES.LOGISTIC:
        // Can edit LOGISTIC and PRODUCTION service orders if not assigned or assigned to them
        return (type === SERVICE_ORDER_TYPE.LOGISTIC || type === SERVICE_ORDER_TYPE.PRODUCTION) && (isNotAssigned || isAssignedToCurrentUser);

      case SECTOR_PRIVILEGES.DESIGNER:
        // Can edit ARTWORK service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.ARTWORK && (isNotAssigned || isAssignedToCurrentUser);

      default:
        // Other sectors cannot edit any service orders
        return false;
    }
  }, [userPrivilege, currentUserId]);

  // Check if user can edit the STATUS of a service order (more restrictive than field editing)
  const canEditServiceOrderStatus = useCallback((serviceOrder: any) => {
    if (!userPrivilege || !serviceOrder) return true;
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) return true;

    const { type, assignedToId } = serviceOrder;
    const isNotAssigned = !assignedToId || assignedToId === null || assignedToId === "";
    const isAssignedToCurrentUser = assignedToId === currentUserId;

    const isNewServiceOrder = !serviceOrder.id || (typeof serviceOrder.id === 'string' && serviceOrder.id.startsWith('temp-'));
    if (isNewServiceOrder) return true;

    switch (userPrivilege) {
      case SECTOR_PRIVILEGES.COMMERCIAL:
        return type === SERVICE_ORDER_TYPE.COMMERCIAL && (isNotAssigned || isAssignedToCurrentUser);
      case SECTOR_PRIVILEGES.FINANCIAL:
        return type === SERVICE_ORDER_TYPE.FINANCIAL && (isNotAssigned || isAssignedToCurrentUser);
      case SECTOR_PRIVILEGES.LOGISTIC:
        return (type === SERVICE_ORDER_TYPE.LOGISTIC || type === SERVICE_ORDER_TYPE.PRODUCTION) && (isNotAssigned || isAssignedToCurrentUser);
      case SECTOR_PRIVILEGES.DESIGNER:
        return type === SERVICE_ORDER_TYPE.ARTWORK && (isNotAssigned || isAssignedToCurrentUser);
      default:
        return false;
    }
  }, [userPrivilege, currentUserId]);

  // Group services by type (only complete services with type and description)
  const { groupedServices, ungroupedIndices } = useMemo(() => {
    const groups: Record<SERVICE_ORDER_TYPE, number[]> = {
      [SERVICE_ORDER_TYPE.PRODUCTION]: [],
      [SERVICE_ORDER_TYPE.FINANCIAL]: [],
      [SERVICE_ORDER_TYPE.COMMERCIAL]: [],
      [SERVICE_ORDER_TYPE.LOGISTIC]: [],
      [SERVICE_ORDER_TYPE.ARTWORK]: [],
    };
    const ungrouped: number[] = [];

    fields.forEach((field, index) => {
      const service = servicesValues[index];
      // A service is "complete" if it has both type and description (at least 3 chars)
      const isComplete = service?.type && service?.description && service.description.trim().length >= 3;

      // Keep in ungrouped if: incomplete OR pending organization (recently added/edited)
      if (!isComplete || pendingFieldIds.has(field.id)) {
        ungrouped.push(index);
      } else {
        groups[service.type as SERVICE_ORDER_TYPE].push(index);
      }
    });

    return { groupedServices: groups, ungroupedIndices: ungrouped };
  }, [fields, servicesValues, pendingFieldIds]);

  // Get the default type for the user's sector (the type they work with most)
  const getDefaultTypeForSector = useCallback(() => {
    switch (userPrivilege) {
      case SECTOR_PRIVILEGES.COMMERCIAL:
        return SERVICE_ORDER_TYPE.COMMERCIAL;
      case SECTOR_PRIVILEGES.FINANCIAL:
        return SERVICE_ORDER_TYPE.FINANCIAL;
      case SECTOR_PRIVILEGES.LOGISTIC:
        return SERVICE_ORDER_TYPE.LOGISTIC;
      case SECTOR_PRIVILEGES.DESIGNER:
        return SERVICE_ORDER_TYPE.ARTWORK;
      case SECTOR_PRIVILEGES.PRODUCTION:
      case SECTOR_PRIVILEGES.ADMIN:
      default:
        return SERVICE_ORDER_TYPE.PRODUCTION;
    }
  }, [userPrivilege]);

  // Track previous field IDs to detect newly added fields
  const prevFieldIdsRef = useRef<Set<string>>(new Set(fields.map(f => f.id)));

  // Detect newly added fields and mark them as pending
  useEffect(() => {
    const currentIds = new Set(fields.map(f => f.id));
    const newIds = new Set<string>();
    currentIds.forEach(id => {
      if (!prevFieldIdsRef.current.has(id)) {
        newIds.add(id);
      }
    });
    if (newIds.size > 0) {
      setPendingFieldIds(prev => {
        const updated = new Set(prev);
        newIds.forEach(id => updated.add(id));
        return updated;
      });
    }
    prevFieldIdsRef.current = currentIds;
  }, [fields]);

  const handleAddService = () => {
    append({
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
      description: "",
      observation: null,
      type: getDefaultTypeForSector(),
      assignedToId: null,
    });
  };

  // Handler to remove an item and track deletion
  const handleRemoveItem = useCallback((index: number) => {
    const item = servicesValues?.[index];
    if (item?.description && onItemDeleted) {
      onItemDeleted(item.description);
    }
    remove(index);
  }, [servicesValues, onItemDeleted, remove]);

  // Determine which service order types should be visible for the current user
  // This controls which grouped service cards are shown
  const visibleServiceOrderTypes = useMemo(() => {
    if (!userPrivilege) return Object.values(SERVICE_ORDER_TYPE);

    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) {
      return Object.values(SERVICE_ORDER_TYPE);
    }
    if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      // Financial can only see COMMERCIAL, LOGISTIC, FINANCIAL (not PRODUCTION, ARTWORK)
      return [
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      // Designer can only see PRODUCTION, ARTWORK (not COMMERCIAL, LOGISTIC, FINANCIAL)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    // All other sectors see all types
    return Object.values(SERVICE_ORDER_TYPE);
  }, [userPrivilege]);

  // Render a service group card
  const renderServiceGroup = (type: SERVICE_ORDER_TYPE) => {
    // Skip if this type is not visible for the current user
    if (!visibleServiceOrderTypes.includes(type)) {
      return null;
    }

    const serviceIndices = groupedServices[type];

    // Skip if this type doesn't exist in our groups (e.g., old NEGOTIATION enum value)
    if (!serviceIndices || serviceIndices.length === 0) {
      return null; // Don't show empty groups
    }

    return (
      <Card key={type} className="bg-transparent border-muted">
        <CardContent className="pt-4 space-y-3">
          {/* Type Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {SERVICE_ORDER_TYPE_LABELS[type]}
            </span>
            <span className="text-xs text-muted-foreground">
              {serviceIndices.length} {serviceIndices.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </div>

          {/* Services in this group */}
          {serviceIndices.map((index) => {
            const serviceOrder = servicesValues[index];
            const isServiceDisabled = disabled || !canEditServiceOrder(serviceOrder);
            const isStatusDisabled = disabled || !canEditServiceOrderStatus(serviceOrder);

            return (
              <ServiceRow
                key={fields[index].id}
                control={control}
                index={index}
                type={type}
                disabled={isServiceDisabled}
                statusDisabled={isStatusDisabled}
                onRemove={() => handleRemoveItem(index)}
                isGrouped={true}
                userPrivilege={userPrivilege}
                currentUserId={currentUserId}
                isTeamLeader={isTeamLeader}
              />
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const handleOrganize = useCallback(() => {
    setPendingFieldIds(new Set());
  }, []);

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddService}
          disabled={disabled || userPrivilege === SECTOR_PRIVILEGES.DESIGNER}
          className="flex-1"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOrganize}
          disabled={disabled || pendingFieldIds.size === 0}
          className="shrink-0"
        >
          <IconArrowsSort className="h-4 w-4 mr-2" />
          Organizar
        </Button>
      </div>

      {/* Ungrouped services (being edited / pending organization) */}
      {ungroupedIndices.length > 0 && (
        <Card className="bg-transparent border-muted border-dashed">
          <CardContent className="pt-4 space-y-3">

            {[...ungroupedIndices].reverse().map((index) => {
              const serviceOrder = servicesValues[index];
              const isServiceDisabled = disabled || !canEditServiceOrder(serviceOrder);
              const isStatusDisabled = disabled || !canEditServiceOrderStatus(serviceOrder);
              // Pending items that are complete should show type + status (flat view mode)
              const isPendingComplete = pendingFieldIds.has(fields[index].id) &&
                serviceOrder?.type && serviceOrder?.description && serviceOrder.description.trim().length >= 3;

              return (
                <ServiceRow
                  key={fields[index].id}
                  control={control}
                  index={index}
                  type={servicesValues[index]?.type || SERVICE_ORDER_TYPE.PRODUCTION}
                  disabled={isServiceDisabled}
                  statusDisabled={isStatusDisabled}
                  onRemove={() => handleRemoveItem(index)}
                  isGrouped={false}
                  isFlatView={isPendingComplete}
                  userPrivilege={userPrivilege}
                  currentUserId={currentUserId}
                  isTeamLeader={isTeamLeader}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Grouped services by type */}
      <div className="space-y-4">
        {SERVICE_ORDER_TYPE_DISPLAY_ORDER.map((type) =>
          renderServiceGroup(type)
        )}
      </div>
    </div>
  );
}

interface ServiceRowProps {
  control: any;
  index: number;
  type: SERVICE_ORDER_TYPE;
  disabled?: boolean;
  statusDisabled?: boolean;
  onRemove: () => void;
  isGrouped: boolean; // Whether this service is in a group card or being edited
  isFlatView?: boolean; // Whether we're in flat (unorganized) view - shows type + status
  userPrivilege?: string;
  currentUserId?: string;
  isTeamLeader?: boolean;
}

function ServiceRow({
  control,
  index,
  type: _type,
  disabled,
  statusDisabled,
  onRemove,
  isGrouped,
  isFlatView = false,
  userPrivilege,
  currentUserId: _currentUserId,
  isTeamLeader = false,
}: ServiceRowProps) {
  // Observation modal state
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [tempObservation, setTempObservation] = useState("");

  // Watch the type field for this service to filter descriptions
  const selectedType = useWatch({
    control,
    name: `serviceOrders.${index}.type`,
    defaultValue: SERVICE_ORDER_TYPE.PRODUCTION,
  });

  // Determine which sector privileges to include based on service order type
  // Each service order type has specific sectors that can be assigned
  const includeSectorPrivileges = useMemo(() => {
    switch (selectedType) {
      case SERVICE_ORDER_TYPE.PRODUCTION:
        // Production service orders: only production sector users
        return [SECTOR_PRIVILEGES.PRODUCTION];
      case SERVICE_ORDER_TYPE.LOGISTIC:
        // Logistic service orders: logistic and admin users
        return [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.COMMERCIAL:
        // Commercial service orders: commercial and admin users
        return [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.ARTWORK:
        // Artwork service orders: designer and admin users
        return [SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.FINANCIAL:
        // Financial service orders: commercial, financial, and admin users
        return [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN];
      default:
        return undefined;
    }
  }, [selectedType]);

  // Watch the current status
  const currentStatus = useWatch({
    control,
    name: `serviceOrders.${index}.status`,
    defaultValue: SERVICE_ORDER_STATUS.PENDING,
  });

  // Watch if this is an existing service order (has id)
  const serviceOrderId = useWatch({
    control,
    name: `serviceOrders.${index}.id`,
  });

  // Watch observation field
  const currentObservation = useWatch({
    control,
    name: `serviceOrders.${index}.observation`,
    defaultValue: "",
  });

  // Get observation field controller for updating
  const { field: observationField } = useController({
    control,
    name: `serviceOrders.${index}.observation`,
    defaultValue: "",
  });

  // Handle opening observation modal
  const handleOpenObservationModal = () => {
    setTempObservation(currentObservation || "");
    setIsObservationModalOpen(true);
  };

  // Handle saving observation (just updates form field and closes modal)
  const handleSaveObservation = () => {
    observationField.onChange(tempObservation || null);
    setIsObservationModalOpen(false);
  };

  // Handle canceling observation modal
  const handleCancelObservation = () => {
    setTempObservation("");
    setIsObservationModalOpen(false);
  };

  // Check if observation has content
  const hasObservation = Boolean(currentObservation && currentObservation.trim());

  // Determine which status options are available based on type and user privilege
  // IMPORTANT: WAITING_APPROVE status is ONLY available for ARTWORK service orders
  // This is because only artwork has the designer → admin approval workflow
  const getAvailableStatuses = useMemo(() => {
    // For new service orders (no id), only PENDING is allowed
    const isNewServiceOrder = !serviceOrderId || (typeof serviceOrderId === 'string' && serviceOrderId.startsWith('temp-'));
    if (isNewServiceOrder) {
      return [SERVICE_ORDER_STATUS.PENDING];
    }

    const isArtworkType = selectedType === SERVICE_ORDER_TYPE.ARTWORK;

    // Admin can set any status, but WAITING_APPROVE only for ARTWORK
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) {
      if (isArtworkType) {
        // ARTWORK: All statuses including WAITING_APPROVE (approval workflow)
        return [
          SERVICE_ORDER_STATUS.PENDING,
          SERVICE_ORDER_STATUS.IN_PROGRESS,
          SERVICE_ORDER_STATUS.WAITING_APPROVE,
          SERVICE_ORDER_STATUS.COMPLETED,
          SERVICE_ORDER_STATUS.CANCELLED,
        ];
      } else {
        // Non-ARTWORK: All statuses EXCEPT WAITING_APPROVE (simple workflow)
        return [
          SERVICE_ORDER_STATUS.PENDING,
          SERVICE_ORDER_STATUS.IN_PROGRESS,
          SERVICE_ORDER_STATUS.COMPLETED,
          SERVICE_ORDER_STATUS.CANCELLED,
        ];
      }
    }

    // ARTWORK type has special two-step approval - designer can only go to WAITING_APPROVE
    if (isArtworkType && userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      return [
        SERVICE_ORDER_STATUS.PENDING,
        SERVICE_ORDER_STATUS.IN_PROGRESS,
        SERVICE_ORDER_STATUS.WAITING_APPROVE,
        // Note: No COMPLETED - designer must submit for admin approval
        // Note: No CANCELLED - only admin can cancel
      ];
    }

    // For other users/types, return simple workflow statuses (no WAITING_APPROVE, no CANCELLED)
    return [
      SERVICE_ORDER_STATUS.PENDING,
      SERVICE_ORDER_STATUS.IN_PROGRESS,
      SERVICE_ORDER_STATUS.COMPLETED,
    ];
  }, [serviceOrderId, userPrivilege, selectedType]);

  // Determine if status field should be shown as combobox (editable) or badge (read-only)
  // For PRODUCTION sector users who are NOT team leaders: show as badge (read-only)
  // For team leaders and other sectors with edit permissions: show as combobox
  const showStatusField = useMemo(() => {
    // Show status for grouped items or flat view (existing items shown ungrouped)
    if (!isGrouped && !isFlatView) return false; // Never show status for truly new service orders

    // If user is PRODUCTION sector but NOT a team leader, show as badge instead of combobox
    if (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION && !isTeamLeader) {
      return false; // Will show badge instead
    }

    return true; // Show combobox for team leaders and other sectors
  }, [isGrouped, userPrivilege, isTeamLeader, isFlatView]);

  // Determine which service order types the user can CREATE based on their privilege
  // Note: This is separate from what they can UPDATE (handled by canEditServiceOrder)
  // Creating is more permissive than updating
  const allowedServiceOrderTypes = useMemo(() => {
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) {
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
      // Commercial can CREATE all types, but can only UPDATE commercial
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      // Financial can CREATE commercial, logistic, and financial service orders
      return [
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      // Designer can CREATE artwork, but can only UPDATE artwork
      return [SERVICE_ORDER_TYPE.ARTWORK];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      // Logistic can CREATE production, artwork, commercial, logistic
      // but can only UPDATE logistic and production
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION) {
      return [SERVICE_ORDER_TYPE.PRODUCTION];
    }
    // Default: only production for other sectors
    return [SERVICE_ORDER_TYPE.PRODUCTION];
  }, [userPrivilege]);

  // Show type selector when not grouped (new items or flat view)
  const showTypeSelector = !isGrouped;

  // Grid layout: consistent proportions for both grouped and ungrouped
  // Using min-w-0 on children to prevent content from affecting column width
  // Grouped: [Description 2fr] [User 1fr] [Status 1fr] [Buttons 90px]
  // Ungrouped: [Type 150px] [Description 2fr] [User 1fr] [Buttons 90px]
  // Flat view: [Type 150px] [Description 2fr] [User 1fr] [Status 1fr] [Buttons 90px]
  // Note: Type column needs 150px to fit "Comercial" without truncation
  // Note: Buttons column now 90px to fit both observation and trash buttons (2 icons + gap)
  const gridClass = isFlatView
    ? "grid grid-cols-[150px_2fr_1fr_1fr_90px] gap-3 items-center"
    : isGrouped
      ? "grid grid-cols-[2fr_1fr_1fr_90px] gap-3 items-center"
      : "grid grid-cols-[150px_2fr_1fr_90px] gap-3 items-center";

  return (
    <>
      <div className={gridClass}>
        {/* Type Field - Only show if not grouped or in flat view (no label, inline) */}
        {showTypeSelector && (
          <div className="min-w-0">
            <FormField
              control={control}
              name={`serviceOrders.${index}.type`}
              render={({ field }) => (
                <Combobox
                  value={field.value || SERVICE_ORDER_TYPE.PRODUCTION}
                  onValueChange={field.onChange}
                  disabled={disabled || allowedServiceOrderTypes.length === 1}
                  options={allowedServiceOrderTypes.map((type) => ({
                    value: type,
                    label: SERVICE_ORDER_TYPE_LABELS[type],
                  }))}
                  placeholder="Tipo"
                  searchable={false}
                  clearable={false}
                  className="w-full"
                />
              )}
            />
          </div>
        )}

        {/* Description Field - largest proportion */}
        <div className="min-w-0">
          <FormField
            control={control}
            name={`serviceOrders.${index}.description`}
            render={({ field, fieldState }) => (
              <ServiceDescriptionInput
                value={field.value || ""}
                onChange={field.onChange}
                disabled={disabled}
                placeholder="Digite o servico..."
                type={selectedType}
                hasError={!!fieldState.error}
                className="w-full"
              />
            )}
          />
        </div>

        {/* Assigned User Field - No wrapper needed, AdminUserSelector has its own FormField */}
        <div className="min-w-0">
          <AdminUserSelector
            control={control}
            name={`serviceOrders.${index}.assignedToId`}
            label=""
            placeholder="Responsável"
            disabled={disabled}
            required={false}
            includeSectorPrivileges={includeSectorPrivileges}
          />
        </div>

        {/* Status Field - Rendered for grouped or flat view service orders */}
        {(isGrouped || isFlatView) && (showStatusField && !statusDisabled ? (
          <div className="min-w-0">
            <FormField
              control={control}
              name={`serviceOrders.${index}.status`}
              render={({ field }) => (
                <Combobox
                  value={field.value || SERVICE_ORDER_STATUS.PENDING}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  options={getAvailableStatuses.map((status) => ({
                    value: status,
                    label: SERVICE_ORDER_STATUS_LABELS[status],
                  }))}
                  placeholder="Status"
                  searchable={false}
                  clearable={false}
                  className="w-full"
                />
              )}
            />
          </div>
        ) : (
          // Show read-only badge when user cannot edit status (e.g., PRODUCTION non-leaders, or cross-sector)
          <div className="min-w-0 flex items-center">
            <Badge variant={getServiceOrderStatusColor(currentStatus)} className="whitespace-nowrap">
              {SERVICE_ORDER_STATUS_LABELS[currentStatus as SERVICE_ORDER_STATUS] || currentStatus}
            </Badge>
          </div>
        ))}

        {/* Action Buttons - fixed width */}
        <div className="flex items-center justify-end gap-1">
          {/* Observation Button - Always available for all service orders */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleOpenObservationModal}
            disabled={disabled}
            className="relative flex-shrink-0 h-9 w-9"
            title={hasObservation ? "Ver/Editar observação" : "Adicionar observação"}
          >
            <IconNote className="h-4 w-4" />
            {/* Red indicator when observation exists */}
            {hasObservation && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                !
              </span>
            )}
          </Button>

          {/* Remove Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled}
            className="text-destructive flex-shrink-0 h-9 w-9"
            title="Remover serviço"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Observation Modal */}
      <Dialog open={isObservationModalOpen} onOpenChange={setIsObservationModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Observação do Serviço</DialogTitle>
            <DialogDescription>
              Adicione notas ou justificativas para este serviço (ex: motivo de reprovação).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={tempObservation}
              onChange={(e) => setTempObservation(e.target.value)}
              placeholder="Digite a observação..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelObservation}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveObservation}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Maintain compatibility with existing imports
export const ServiceSelector = ServiceSelectorAutoGrouped;
