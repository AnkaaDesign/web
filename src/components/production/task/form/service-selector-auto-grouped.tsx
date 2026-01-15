import { useState, useMemo, useCallback } from "react";
import { useFieldArray, useWatch, useController } from "react-hook-form";
import { FormField, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconPlus, IconTrash, IconNote } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { Service } from "../../../../types";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS, SERVICE_ORDER_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { Textarea } from "@/components/ui/textarea";
import { useServiceMutations } from "../../../../hooks";
import { serviceService } from "../../../../api-client";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";
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
}

export function ServiceSelectorAutoGrouped({ control, disabled, currentUserId, userPrivilege }: ServiceSelectorProps) {
  const [creatingServiceIndex, setCreatingServiceIndex] = useState<number | null>(null);

  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: "serviceOrders",
  });

  const { createAsync: createService } = useServiceMutations();

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

    // Allow editing of new service orders (ones without an id) so users can set type and description
    const isNewServiceOrder = !serviceOrder.id || (typeof serviceOrder.id === 'string' && serviceOrder.id.startsWith('temp-'));
    if (isNewServiceOrder) return true;

    // Get the service order type and assignment
    const { type, assignedToId } = serviceOrder;
    const isNotAssigned = !assignedToId || assignedToId === null || assignedToId === "";
    const isAssignedToCurrentUser = assignedToId === currentUserId;

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

      case SECTOR_PRIVILEGES.LOGISTIC:
        // Can edit PRODUCTION service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.PRODUCTION && (isNotAssigned || isAssignedToCurrentUser);

      default:
        // Other sectors cannot edit any service orders
        return false;
    }
  }, [userPrivilege, currentUserId]);

  // Memoize callbacks
  const getOptionLabel = useCallback((service: Service) => service.description, []);
  const getOptionValue = useCallback((service: Service) => service.description, []);

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
      // BUT: Don't group services while they're being created (creatingServiceIndex matches)
      // This prevents the component from unmounting mid-creation
      const isBeingCreated = creatingServiceIndex === index;
      const isComplete = service?.type && service?.description && service.description.trim().length >= 3 && !isBeingCreated;

      if (isComplete) {
        groups[service.type as SERVICE_ORDER_TYPE].push(index);
      } else {
        ungrouped.push(index);
      }
    });

    return { groupedServices: groups, ungroupedIndices: ungrouped };
  }, [fields, servicesValues, creatingServiceIndex]);

  const handleAddService = () => {
    // Set default service order type based on user's sector privilege
    let defaultType = SERVICE_ORDER_TYPE.PRODUCTION;

    if (userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
      defaultType = SERVICE_ORDER_TYPE.COMMERCIAL;
    } else if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      defaultType = SERVICE_ORDER_TYPE.FINANCIAL;
    } else if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      defaultType = SERVICE_ORDER_TYPE.LOGISTIC;
    } else if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      defaultType = SERVICE_ORDER_TYPE.ARTWORK;
    } else if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      defaultType = SERVICE_ORDER_TYPE.PRODUCTION;
    }

    // Use prepend to add new service at the beginning (top)
    prepend({
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
      description: "",
      type: defaultType,
      assignedToId: null,
    });
  };

  const handleCreateService = async (description: string, type: SERVICE_ORDER_TYPE, serviceIndex: number) => {
    try {
      setCreatingServiceIndex(serviceIndex);

      const result = await createService({
        description,
        type,
      });

      if (result && result.success && result.data) {
        // Don't clear creatingServiceIndex here - let it stay set until after onValueChange completes
        return result.data;
      }
      setCreatingServiceIndex(null); // Clear only on failure
      return undefined;
    } catch (error) {
      setCreatingServiceIndex(null); // Clear on error
      throw error;
    }
  };

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
                isCreating={creatingServiceIndex === index}
                onRemove={() => remove(index)}
                onCreateService={handleCreateService}
                getOptionLabel={getOptionLabel}
                getOptionValue={getOptionValue}
                isGrouped={true}
                clearCreatingState={() => setCreatingServiceIndex(null)}
                userPrivilege={userPrivilege}
                currentUserId={currentUserId}
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
        {/* Add Service Button - At the top */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddService}
          disabled={disabled}
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
                  isCreating={creatingServiceIndex === index}
                  onRemove={() => remove(index)}
                  onCreateService={handleCreateService}
                  getOptionLabel={getOptionLabel}
                  getOptionValue={getOptionValue}
                  isGrouped={false}
                  clearCreatingState={() => setCreatingServiceIndex(null)}
                  userPrivilege={userPrivilege}
                  currentUserId={currentUserId}
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
  isCreating: boolean;
  onRemove: () => void;
  onCreateService: (description: string, type: SERVICE_ORDER_TYPE, index: number) => Promise<Service | undefined>;
  getOptionLabel: (service: Service) => string;
  getOptionValue: (service: Service) => string;
  isGrouped: boolean; // Whether this service is in a group card or being edited
  clearCreatingState: () => void;
  userPrivilege?: string;
  currentUserId?: string;
}

function ServiceRow({
  control,
  index,
  type,
  disabled,
  isCreating,
  onRemove,
  onCreateService,
  getOptionLabel,
  getOptionValue,
  isGrouped,
  clearCreatingState,
  userPrivilege,
  currentUserId,
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

  // Extract existing service description for this row
  const existingDescription = useWatch({
    control,
    name: `serviceOrders.${index}.description`,
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
  const getAvailableStatuses = useMemo(() => {
    // For new service orders (no id), only PENDING is allowed
    const isNewServiceOrder = !serviceOrderId || (typeof serviceOrderId === 'string' && serviceOrderId.startsWith('temp-'));
    if (isNewServiceOrder) {
      return [SERVICE_ORDER_STATUS.PENDING];
    }

    // Admin can set any status
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) {
      return [
        SERVICE_ORDER_STATUS.PENDING,
        SERVICE_ORDER_STATUS.IN_PROGRESS,
        SERVICE_ORDER_STATUS.WAITING_APPROVE,
        SERVICE_ORDER_STATUS.COMPLETED,
        SERVICE_ORDER_STATUS.CANCELLED,
      ];
    }

    // ARTWORK type has special two-step approval - designer can only go to WAITING_APPROVE
    if (selectedType === SERVICE_ORDER_TYPE.ARTWORK && userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      return [
        SERVICE_ORDER_STATUS.PENDING,
        SERVICE_ORDER_STATUS.IN_PROGRESS,
        SERVICE_ORDER_STATUS.WAITING_APPROVE,
        SERVICE_ORDER_STATUS.CANCELLED,
      ];
    }

    // For other users, return available statuses without WAITING_APPROVE (not needed for non-artwork)
    return [
      SERVICE_ORDER_STATUS.PENDING,
      SERVICE_ORDER_STATUS.IN_PROGRESS,
      SERVICE_ORDER_STATUS.COMPLETED,
      SERVICE_ORDER_STATUS.CANCELLED,
    ];
  }, [serviceOrderId, userPrivilege, selectedType]);

  // Determine if status field should be shown (for all grouped service orders)
  const showStatusField = useMemo(() => {
    return isGrouped; // Show for all grouped service orders (new ones will only have PENDING option)
  }, [isGrouped]);

  // Determine if this is a new service order (for observation button visibility)
  const isNewServiceOrder = useMemo(() => {
    return !serviceOrderId || (typeof serviceOrderId === 'string' && serviceOrderId.startsWith('temp-'));
  }, [serviceOrderId]);

  // Create initial options that include the existing description
  // This ensures the Combobox can display the selected value even after remounting
  const initialOptions = useMemo(() => {
    if (!existingDescription || !existingDescription.trim()) {
      return [];
    }
    return [{
      id: `existing-${existingDescription}`,
      description: existingDescription,
      type: selectedType,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Service];
  }, [existingDescription, selectedType]);

  // Search function for Combobox - filtered by type
  const searchServices = async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Service[];
    hasMore: boolean;
  }> => {
    const params: any = {
      orderBy: { description: "asc" },
      page: page,
      take: 50,
      type: selectedType,
    };

    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await serviceService.getServices(params);
      const services = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // If this is the first page and no search, ensure existing description is in the results
      if (page === 1 && (!search || !search.trim()) && existingDescription && existingDescription.trim()) {
        const existsInResults = services.some((s) => s.description === existingDescription);

        if (!existsInResults) {
          const existingService: Service = {
            id: `temp-${existingDescription}`,
            description: existingDescription,
            type: selectedType,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return {
            data: [existingService, ...services],
            hasMore: hasMore,
          };
        }
      }

      return {
        data: services,
        hasMore: hasMore,
      };
    } catch (error) {
      return { data: [], hasMore: false };
    }
  };

  // Determine which service order types the user can create based on their privilege
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
      return [SERVICE_ORDER_TYPE.COMMERCIAL];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      return [SERVICE_ORDER_TYPE.FINANCIAL];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      return [SERVICE_ORDER_TYPE.ARTWORK];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      return [SERVICE_ORDER_TYPE.PRODUCTION, SERVICE_ORDER_TYPE.LOGISTIC];
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
  // Ungrouped: [Type 120px] [Description 2fr] [User 1fr] [Buttons 90px]
  // Note: Buttons column now 90px to fit both observation and trash buttons (2 icons + gap)
  const gridClass = isGrouped
    ? "grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_90px] gap-3 items-center"
    : "grid grid-cols-1 md:grid-cols-[120px_2fr_1fr_90px] gap-3 items-center";

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
              <Combobox<Service>
                value={field.value}
                onValueChange={(newValue) => {
                  // Update the form field
                  field.onChange(newValue);

                  // CRITICAL: DON'T clear creating state immediately
                  // Wait for much longer to ensure form value is fully propagated
                  // and the Combobox is displaying the correct value BEFORE re-grouping
                  setTimeout(() => {
                    // Only clear if the field value is actually set
                    if (field.value && field.value === newValue) {
                      clearCreatingState();
                    } else {
                      // Try again after a delay
                      setTimeout(() => {
                        clearCreatingState();
                      }, 500);
                    }
                  }, 1000); // Wait 1 full second
                }}
                placeholder="Selecione o serviço..."
                emptyText="Digite para criar um novo"
                searchPlaceholder="Buscar serviço..."
                disabled={disabled || isCreating}
                async={true}
                initialOptions={initialOptions}
                allowCreate={true}
                createLabel={(value) => `Criar "${value}"`}
                onCreate={async (value) => {
                  const newService = await onCreateService(value, selectedType, index);

                  if (newService) {
                    // Return the full service object
                    // The Combobox will handle setting the value after caching
                    return newService;
                  }

                  return undefined;
                }}
                isCreating={isCreating}
                queryKey={["serviceOrders", "search", index, selectedType]}
                queryFn={searchServices}
                getOptionLabel={getOptionLabel}
                getOptionValue={getOptionValue}
                renderOption={(service) => <span>{service.description}</span>}
                loadMoreText="Carregar mais"
                loadingMoreText="Carregando..."
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
                className={`w-full ${fieldState.error ? 'border-destructive ring-destructive' : ''}`}
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

        {/* Status Field - Only show for existing grouped service orders */}
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
                  className="w-full"
                />
              )}
            />
          </div>
        ) : (
          // Placeholder for grouped items without status to maintain grid structure
          isGrouped && <div className="min-w-0" />
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
