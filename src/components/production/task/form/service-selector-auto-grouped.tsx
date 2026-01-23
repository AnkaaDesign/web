import { useState, useMemo, useCallback } from "react";
import { useFieldArray, useWatch, useController } from "react-hook-form";
import { FormField, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconNote } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { Textarea } from "@/components/ui/textarea";
import { toTitleCase, getServiceOrderStatusColor } from "../../../../utils";
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
}

export function ServiceSelectorAutoGrouped({ control, disabled, currentUserId, userPrivilege, isTeamLeader = false, onItemDeleted }: ServiceSelectorProps) {
  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: "serviceOrders",
  });

  // Watch all services
  const servicesValues = useWatch({
    control,
    name: "serviceOrders",
  }) as any[] || [];

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
    switch (userPrivilege) {
      case SECTOR_PRIVILEGES.COMMERCIAL:
        // Can edit COMMERCIAL service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.COMMERCIAL && (isNotAssigned || isAssignedToCurrentUser);

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

      if (isComplete) {
        groups[service.type as SERVICE_ORDER_TYPE].push(index);
      } else {
        ungrouped.push(index);
      }
    });

    return { groupedServices: groups, ungroupedIndices: ungrouped };
  }, [fields, servicesValues]);

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

  const handleAddService = () => {
    // Use prepend to add new service at the beginning (top)
    prepend({
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

  // Render a service group card
  const renderServiceGroup = (type: SERVICE_ORDER_TYPE) => {
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

            return (
              <ServiceRow
                key={fields[index].id}
                control={control}
                index={index}
                type={type}
                disabled={isServiceDisabled}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormLabel>Serviços</FormLabel>
        {/* Add Service Button - At the top - Disabled for DESIGNER users */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddService}
          disabled={disabled || userPrivilege === SECTOR_PRIVILEGES.DESIGNER}
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>
      </div>

      {/* Ungrouped services (being edited) - shown in a card for consistency */}
      {ungroupedIndices.length > 0 && (
        <Card className="bg-transparent border-muted border-dashed">
          <CardContent className="pt-4 space-y-3">
            {/* Header for new/editing services */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Configurando Serviço
              </span>
              <span className="text-xs text-muted-foreground">
                Preencha o tipo e descrição
              </span>
            </div>

            {ungroupedIndices.map((index) => {
              const serviceOrder = servicesValues[index];
              const isServiceDisabled = disabled || !canEditServiceOrder(serviceOrder);

              return (
                <ServiceRow
                  key={fields[index].id}
                  control={control}
                  index={index}
                  type={servicesValues[index]?.type || SERVICE_ORDER_TYPE.PRODUCTION}
                  disabled={isServiceDisabled}
                  onRemove={() => handleRemoveItem(index)}
                  isGrouped={false}
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
        {Object.values(SERVICE_ORDER_TYPE).map((type) =>
          renderServiceGroup(type as SERVICE_ORDER_TYPE)
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
  onRemove: () => void;
  isGrouped: boolean; // Whether this service is in a group card or being edited
  userPrivilege?: string;
  currentUserId?: string;
  isTeamLeader?: boolean;
}

function ServiceRow({
  control,
  index,
  type,
  disabled,
  onRemove,
  isGrouped,
  userPrivilege,
  currentUserId,
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
    if (!isGrouped) return false; // Never show status for ungrouped (new) service orders

    // If user is PRODUCTION sector but NOT a team leader, show as badge instead of combobox
    if (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION && !isTeamLeader) {
      return false; // Will show badge instead
    }

    return true; // Show combobox for team leaders and other sectors
  }, [isGrouped, userPrivilege, isTeamLeader]);

  // Determine if this is a new service order (for observation button visibility)
  const isNewServiceOrder = useMemo(() => {
    return !serviceOrderId || (typeof serviceOrderId === 'string' && serviceOrderId.startsWith('temp-'));
  }, [serviceOrderId]);

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
      // Financial can CREATE financial, but can only UPDATE financial
      return [SERVICE_ORDER_TYPE.FINANCIAL];
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

  // Grid layout: consistent proportions for both grouped and ungrouped
  // Using min-w-0 on children to prevent content from affecting column width
  // Grouped: [Description 2fr] [User 1fr] [Status 1fr] [Buttons 90px]
  // Ungrouped: [Type 150px] [Description 2fr] [User 1fr] [Buttons 90px]
  // Note: Type column needs 150px to fit "Comercial" without truncation
  // Note: Buttons column now 90px to fit both observation and trash buttons (2 icons + gap)
  const gridClass = isGrouped
    ? "grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_90px] gap-3 items-center"
    : "grid grid-cols-1 md:grid-cols-[150px_2fr_1fr_90px] gap-3 items-center";

  return (
    <>
      <div className={gridClass}>
        {/* Type Field - Only show if not grouped (no label, inline) */}
        {!isGrouped && (
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
          />
        </div>

        {/* Status Field - Show combobox for team leaders/editors, badge for read-only users */}
        {showStatusField ? (
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
        ) : isGrouped ? (
          // Show read-only badge for PRODUCTION users who are not team leaders
          <div className="min-w-0 flex items-center">
            <Badge variant={getServiceOrderStatusColor(currentStatus)} className="whitespace-nowrap">
              {SERVICE_ORDER_STATUS_LABELS[currentStatus] || currentStatus}
            </Badge>
          </div>
        ) : (
          // Placeholder for ungrouped items to maintain grid structure
          <div className="min-w-0" />
        )}

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
              onChange={(e) => setTempObservation(toTitleCase(e.target.value))}
              placeholder="Digite a observação..."
              rows={4}
              className="resize-none capitalize"
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
