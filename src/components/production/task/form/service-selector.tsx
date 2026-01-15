import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import type { ServiceOrder, Service } from "../../../../types";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE_LABELS } from "../../../../constants";
import { useServiceMutations } from "../../../../hooks";
import { serviceService } from "../../../../api-client";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";

interface ServiceSelectorProps {
  control: any;
  disabled?: boolean;
}

export function ServiceSelectorFixed({ control, disabled }: ServiceSelectorProps) {
  const [initialized, setInitialized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const lastRowRef = useRef<HTMLDivElement>(null);

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "serviceOrders",
  });

  const { createAsync: createService } = useServiceMutations();

  // Watch services to auto-sort by type
  const servicesValues = useWatch({
    control,
    name: "serviceOrders",
  }) as any[] || [];

  // Track if this is the initial mount to skip auto-sort on first render
  const isInitialMount = useRef(true);

  // Auto-sort services by type whenever they change (but NOT on initial mount)
  useEffect(() => {
    if (!initialized || fields.length === 0) return;

    // Skip auto-sort on initial mount - data is pre-sorted in mapDataToForm
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Create a mapping of type to sort order
    const typeOrder: Record<string, number> = {
      [SERVICE_ORDER_TYPE.PRODUCTION]: 0,
      [SERVICE_ORDER_TYPE.FINANCIAL]: 1,
      [SERVICE_ORDER_TYPE.COMMERCIAL]: 2,
      [SERVICE_ORDER_TYPE.LOGISTIC]: 3,
      [SERVICE_ORDER_TYPE.ARTWORK]: 4,
    };

    // Create array of indices with their types
    const indexedServices = fields.map((field, index) => ({
      index,
      type: servicesValues[index]?.type || SERVICE_ORDER_TYPE.PRODUCTION,
      description: servicesValues[index]?.description || '',
    }));

    // Sort by type, then by description
    const sortedIndices = indexedServices
      .map((s, originalIndex) => ({ ...s, originalIndex }))
      .sort((a, b) => {
        const typeCompare = typeOrder[a.type] - typeOrder[b.type];
        if (typeCompare !== 0) return typeCompare;
        return a.description.localeCompare(b.description);
      });

    // Check if order changed
    const needsReorder = sortedIndices.some((s, i) => s.originalIndex !== i);

    if (needsReorder) {
      // Reorder the fields array
      sortedIndices.forEach((item, targetIndex) => {
        const currentIndex = fields.findIndex((_, idx) => idx === item.originalIndex);
        if (currentIndex !== targetIndex && currentIndex !== -1) {
          move(currentIndex, targetIndex);
        }
      });
    }
  }, [servicesValues, fields, initialized, move]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((service: Service) => service.description, []);
  const getOptionValue = useCallback((service: Service) => service.description, []);

  // Mark as initialized when component mounts
  // Defaults are now set in mapDataToForm, so no form mutations needed here
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  const handleAddService = () => {
    append({
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
      description: "",
      type: SERVICE_ORDER_TYPE.PRODUCTION,
      assignedToId: null,
    });

    // Focus on the new combobox after adding
    setTimeout(() => {
      const comboboxButton = lastRowRef.current?.querySelector('[role="combobox"]') as HTMLButtonElement;
      comboboxButton?.focus();
    }, 100);
  };

  const handleCreateService = async (description: string, type: SERVICE_ORDER_TYPE) => {
    try {
      setIsCreating(true);
      const result = await createService({
        description,
        type,
      });

      if (result && result.success && result.data) {
        // Return the full service object so Combobox can cache it
        return result.data;
      }
      // Return undefined if creation failed
      return undefined;
    } catch (error) {
      // Error is handled by the mutation hook
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const canRemove = fields.length > 1;

  return (
    <div className="space-y-4">
      <FormLabel>
        Serviços
      </FormLabel>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <ServiceRow
            key={field.id}
            control={control}
            index={index}
            disabled={disabled}
            isCreating={isCreating}
            canRemove={canRemove}
            lastRowRef={index === fields.length - 1 ? lastRowRef : null}
            onRemove={() => {
              if (canRemove) {
                remove(index);
              } else {
                // Clear the only row instead of removing it
                const fieldElement = document.querySelector(`[name="services.${index}.description"]`) as HTMLInputElement;
                if (fieldElement) {
                  fieldElement.value = "";
                  // Trigger change event
                  const event = new Event("change", { bubbles: true });
                  fieldElement.dispatchEvent(event);
                }
              }
            }}
            onCreateService={handleCreateService}
            getOptionLabel={getOptionLabel}
            getOptionValue={getOptionValue}
          />
        ))}
      </div>

      {/* Add Service Button - full width at bottom */}
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
  disabled?: boolean;
  isCreating: boolean;
  canRemove: boolean;
  lastRowRef: React.RefObject<HTMLDivElement> | null;
  onRemove: () => void;
  onCreateService: (description: string, type: SERVICE_ORDER_TYPE) => Promise<Service | undefined>;
  getOptionLabel: (service: Service) => string;
  getOptionValue: (service: Service) => string;
}

function ServiceRow({
  control,
  index,
  disabled,
  isCreating,
  canRemove,
  lastRowRef,
  onRemove,
  onCreateService,
  getOptionLabel,
  getOptionValue,
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
      type: selectedType, // Filter by selected type
    };

    // Only add search filter if there's a search term
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await serviceService.getServices(params);
      const services = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // If this is the first page and no search, ensure existing description is in the results
      if (page === 1 && (!search || !search.trim()) && existingDescription && existingDescription.trim()) {
        // Check if existing description is already in results
        const existsInResults = services.some((s) => s.description === existingDescription);

        if (!existsInResults) {
          // Create a temporary Service object for the existing description
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
    <div ref={lastRowRef} className="border rounded-lg p-4 space-y-3">
      {/* Row with 3 comboboxes: Type, Description, Assignment */}
      <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_240px_auto] gap-3 items-start">
        {/* Type Field - First */}
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
                    SERVICE_ORDER_TYPE.COMMERCIAL,
                    SERVICE_ORDER_TYPE.LOGISTIC,
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

        {/* Description Field - Second (filtered by type) */}
        <FormField
          control={control}
          name={`serviceOrders.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
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
                    const newService = await onCreateService(value, selectedType);
                    if (newService) {
                      // Return the full service object
                      // The Combobox will handle setting the value after caching
                      return newService;
                    }
                  }}
                  isCreating={isCreating}
                  queryKey={["serviceOrders", "search", index, selectedType]} // Add selectedType to invalidate query when type changes
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

        {/* Assigned User Field - Third */}
        <AdminUserSelector
          control={control}
          name={`serviceOrders.${index}.assignedToId`}
          label="Responsável"
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
          className="text-destructive flex-shrink-0 mt-8"
          title="Remover serviço"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Maintain compatibility with existing imports
export const ServiceSelector = ServiceSelectorFixed;
