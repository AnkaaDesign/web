import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import type { ServiceOrder, Service } from "../../../../types";
import { SERVICE_ORDER_STATUS } from "../../../../constants";
import { useServiceMutations } from "../../../../hooks";
import { serviceService } from "../../../../api-client";

interface ServiceSelectorProps {
  control: any;
  disabled?: boolean;
}

export function ServiceSelectorFixed({ control, disabled }: ServiceSelectorProps) {
  const [initialized, setInitialized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const lastRowRef = useRef<HTMLDivElement>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "services",
  });

  const { createAsync: createService } = useServiceMutations();

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((service: Service) => service.description, []);
  const getOptionValue = useCallback((service: Service) => service.description, []);

  // Extract existing service descriptions for initial display
  const existingServiceDescriptions = fields
    .map((field: any) => field.description)
    .filter((desc: string) => desc && desc.trim().length > 0);

  // Search function for Combobox - include existing services to ensure they display
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
    };

    // Only add search filter if there's a search term
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await serviceService.getServices(params);
      const services = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // If this is the first page and no search, prepend existing services to ensure they're available
      if (page === 1 && (!search || !search.trim()) && existingServiceDescriptions.length > 0) {
        // Create Service objects for existing descriptions if they're not already in the results
        const existingServices: Service[] = existingServiceDescriptions
          .filter((desc: string) => !services.some((s) => s.description === desc))
          .map((desc: string) => ({
            id: `temp-${desc}`, // Temporary ID for display purposes
            description: desc,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

        return {
          data: [...existingServices, ...services],
          hasMore: hasMore,
        };
      }

      return {
        data: services,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error('Error fetching services:', error);
      return { data: [], hasMore: false };
    }
  };

  // Initialize with one empty row if no services exist (create mode)
  useEffect(() => {
    if (!initialized && fields.length === 0) {
      append({
        status: SERVICE_ORDER_STATUS.PENDING,
        statusOrder: 1,
        description: "",
      });
      setInitialized(true);
    } else if (!initialized && fields.length > 0) {
      setInitialized(true);
    }
  }, [fields.length, append, initialized]);

  const handleAddService = () => {
    append({
      status: SERVICE_ORDER_STATUS.PENDING,
      statusOrder: 1,
      description: "",
    });

    // Focus on the new combobox after adding
    setTimeout(() => {
      const comboboxButton = lastRowRef.current?.querySelector('[role="combobox"]') as HTMLButtonElement;
      comboboxButton?.focus();
    }, 100);
  };

  const handleCreateService = async (description: string) => {
    try {
      setIsCreating(true);
      const result = await createService({
        description,
      });

      if (result && result.success && result.data) {
        return result.data.description;
      }
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
        Serviços <span className="text-destructive">*</span>
      </FormLabel>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} ref={index === fields.length - 1 ? lastRowRef : null} className="flex items-center gap-1">
            {/* Service Combobox */}
            <FormField
              control={control}
              name={`services.${index}.description`}
              render={({ field }) => (
                <FormItem className="flex-1">
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
                        const newDescription = await handleCreateService(value);
                        if (newDescription) {
                          field.onChange(newDescription);
                        }
                      }}
                      isCreating={isCreating}
                      queryKey={["services", "search", index]}
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

            {/* Remove Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
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
              disabled={disabled}
              className="text-destructive flex-shrink-0"
              title="Remover serviço"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
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
        Adicionar
      </Button>
    </div>
  );
}

// Maintain compatibility with existing imports
export const ServiceSelector = ServiceSelectorFixed;
