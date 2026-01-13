import { useState, useEffect, useMemo, useCallback } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { Service } from "../../../../types";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS } from "../../../../constants";
import { useServiceMutations } from "../../../../hooks";
import { serviceService } from "../../../../api-client";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";

interface ServiceSelectorGroupedProps {
  control: any;
  disabled?: boolean;
}

export function ServiceSelectorGrouped({ control, disabled }: ServiceSelectorGroupedProps) {
  const [isCreating, setIsCreating] = useState(false);

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "serviceOrders",
  });

  const { createAsync: createService } = useServiceMutations();

  // Watch all services to group them by type
  const servicesValues = useWatch({
    control,
    name: "serviceOrders",
  }) as any[] || [];

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((service: Service) => service.description, []);
  const getOptionValue = useCallback((service: Service) => service.description, []);

  // Group services by type
  const servicesByType = useMemo(() => {
    const groups: Record<SERVICE_ORDER_TYPE, number[]> = {
      [SERVICE_ORDER_TYPE.PRODUCTION]: [],
      [SERVICE_ORDER_TYPE.FINANCIAL]: [],
      [SERVICE_ORDER_TYPE.NEGOTIATION]: [],
      [SERVICE_ORDER_TYPE.ARTWORK]: [],
    };

    fields.forEach((field, index) => {
      const service = servicesValues[index];
      if (service && service.type) {
        groups[service.type as SERVICE_ORDER_TYPE].push(index);
      }
    });

    return groups;
  }, [fields, servicesValues]);

  const handleAddService = (type: SERVICE_ORDER_TYPE) => {
    append({
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
      description: "",
      type: type,
      assignedToId: null,
    });
  };

  const handleCreateService = async (description: string, type: SERVICE_ORDER_TYPE) => {
    try {
      setIsCreating(true);
      const result = await createService({
        description,
        type,
      });

      if (result && result.success && result.data) {
        return result.data.description;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  // Render services for a specific type
  const renderServiceGroup = (type: SERVICE_ORDER_TYPE) => {
    const serviceIndices = servicesByType[type];

    if (serviceIndices.length === 0 && disabled) {
      return null; // Don't show empty groups when disabled (view mode)
    }

    return (
      <Card key={type} className="bg-white dark:bg-neutral-850">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span>{SERVICE_ORDER_TYPE_LABELS[type]}</span>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddService(type)}
                disabled={disabled || isCreating}
              >
                <IconPlus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {serviceIndices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum serviço adicionado</p>
          ) : (
            serviceIndices.map((index) => (
              <ServiceRow
                key={fields[index].id}
                control={control}
                index={index}
                type={type}
                disabled={disabled}
                isCreating={isCreating}
                onRemove={() => remove(index)}
                onCreateService={handleCreateService}
                getOptionLabel={getOptionLabel}
                getOptionValue={getOptionValue}
              />
            ))
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <FormLabel>Serviços</FormLabel>

      <div className="space-y-4">
        {Object.values(SERVICE_ORDER_TYPE).map((type) => renderServiceGroup(type as SERVICE_ORDER_TYPE))}
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
  onCreateService: (description: string, type: SERVICE_ORDER_TYPE) => Promise<string | undefined>;
  getOptionLabel: (service: Service) => string;
  getOptionValue: (service: Service) => string;
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
}: ServiceRowProps) {
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
      type: type,
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
            type: type,
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
    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-start">
      {/* Description Field */}
      <FormField
        control={control}
        name={`serviceOrders.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Combobox<Service>
                value={field.value || ""}
                onValueChange={field.onChange}
                placeholder="Selecione ou crie um serviço"
                emptyText="Digite para criar um novo serviço"
                searchPlaceholder="Pesquisar serviços..."
                disabled={disabled || isCreating}
                async={true}
                allowCreate={true}
                createLabel={(value) => `Criar serviço "${value}"`}
                onCreate={async (value) => {
                  const newDescription = await onCreateService(value, type);
                  if (newDescription) {
                    field.onChange(newDescription);
                  }
                }}
                isCreating={isCreating}
                queryKey={["serviceOrders", "search", index, type]}
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
      <AdminUserSelector
        control={control}
        name={`serviceOrders.${index}.assignedToId`}
        label=""
        placeholder="Responsável"
        disabled={disabled}
        required={false}
      />

      {/* Remove Button */}
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
    </div>
  );
}

// Maintain compatibility with existing imports
export const ServiceSelector = ServiceSelectorGrouped;
