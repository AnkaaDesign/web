import { useState, useEffect, useMemo, useCallback } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { Service } from "../../../../types";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { useServiceMutations } from "../../../../hooks";
import { serviceService } from "../../../../api-client";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";

interface ServiceSelectorProps {
  control: any;
  disabled?: boolean;
  currentUserId?: string;
  userPrivilege?: string;
}

export function ServiceSelectorAutoGrouped({ control, disabled, currentUserId, userPrivilege }: ServiceSelectorProps) {
  const [creatingServiceIndex, setCreatingServiceIndex] = useState<number | null>(null);

  const { fields, append, remove } = useFieldArray({
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
        // Can edit NEGOTIATION service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.NEGOTIATION && (isNotAssigned || isAssignedToCurrentUser);

      case SECTOR_PRIVILEGES.FINANCIAL:
        // Can edit FINANCIAL service orders if not assigned or assigned to them
        return type === SERVICE_ORDER_TYPE.FINANCIAL && (isNotAssigned || isAssignedToCurrentUser);

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
      [SERVICE_ORDER_TYPE.NEGOTIATION]: [],
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
      defaultType = SERVICE_ORDER_TYPE.NEGOTIATION;
    } else if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      defaultType = SERVICE_ORDER_TYPE.FINANCIAL;
    } else if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      defaultType = SERVICE_ORDER_TYPE.ARTWORK;
    } else if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      defaultType = SERVICE_ORDER_TYPE.PRODUCTION;
    }

    append({
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

    if (serviceIndices.length === 0) {
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
              />
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <FormLabel>Serviços</FormLabel>

      {/* Ungrouped services (being edited) */}
      {ungroupedIndices.length > 0 && (
        <div className="space-y-3 pb-4 border-b">
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
              />
            );
          })}
        </div>
      )}

      {/* Grouped services by type */}
      <div className="space-y-4">
        {Object.values(SERVICE_ORDER_TYPE).map((type) =>
          renderServiceGroup(type as SERVICE_ORDER_TYPE)
        )}
      </div>

      {/* Add Service Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddService}
        disabled={disabled}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar Serviço
      </Button>
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
}: ServiceRowProps) {
  // Watch the type field for this service to filter descriptions
  const selectedType = useWatch({
    control,
    name: `serviceOrders.${index}.type`,
    defaultValue: SERVICE_ORDER_TYPE.PRODUCTION,
  });

  // Extract existing service description for this row
  const existingDescription = useWatch({
    control,
    name: `serviceOrders.${index}.description`,
    defaultValue: "",
  });

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px_auto] gap-3 items-end">
      {/* Type Field - Only show if not grouped */}
      {!isGrouped && (
        <FormField
          control={control}
          name={`serviceOrders.${index}.type`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value || SERVICE_ORDER_TYPE.PRODUCTION}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  options={[
                    SERVICE_ORDER_TYPE.PRODUCTION,
                    SERVICE_ORDER_TYPE.FINANCIAL,
                    SERVICE_ORDER_TYPE.NEGOTIATION,
                    SERVICE_ORDER_TYPE.ARTWORK,
                  ].map((type) => ({
                    value: type,
                    label: SERVICE_ORDER_TYPE_LABELS[type],
                  }))}
                  placeholder="Tipo"
                  searchable={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Description Field */}
      <FormField
        control={control}
        name={`serviceOrders.${index}.description`}
        render={({ field }) => (
          <FormItem className={!isGrouped ? "" : "col-span-2"}>
            {!isGrouped && <FormLabel>Descrição</FormLabel>}
            <FormControl>
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
                placeholder="Selecione ou crie um serviço"
                emptyText="Digite para criar um novo serviço"
                searchPlaceholder="Pesquisar serviços..."
                disabled={disabled || isCreating}
                async={true}
                allowCreate={true}
                createLabel={(value) => `Criar serviço "${value}"`}
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
                loadMoreText="Carregar mais serviços"
                loadingMoreText="Carregando..."
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
                className="w-full"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Assigned User Field */}
      <FormField
        control={control}
        name={`serviceOrders.${index}.assignedToId`}
        render={({ field }) => (
          <FormItem>
            {!isGrouped && <FormLabel>Responsável</FormLabel>}
            <FormControl>
              <AdminUserSelector
                control={control}
                name={`serviceOrders.${index}.assignedToId`}
                label=""
                placeholder="Responsável"
                disabled={disabled}
                required={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Remove Button - Add FormItem wrapper with hidden label for alignment */}
      <FormItem>
        {!isGrouped && <FormLabel className="opacity-0 select-none">-</FormLabel>}
        <FormControl>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled}
            className="text-destructive flex-shrink-0"
            title="Remover serviço"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </FormControl>
      </FormItem>
    </div>
  );
}

// Maintain compatibility with existing imports
export const ServiceSelector = ServiceSelectorAutoGrouped;
