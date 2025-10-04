import * as React from "react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface FormComboboxProps<TData = ComboboxOption> {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  emptyText?: string;
  options?: TData[];
  disabled?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  searchable?: boolean;
  allowCreate?: boolean;
  createLabel?: (value: string) => string;
  onCreate?: (value: string) => void | Promise<void>;
  isCreating?: boolean;
  loading?: boolean;
  // Extended for async mode
  async?: boolean;
  queryKey?: unknown[];
  queryFn?: (searchTerm: string) => Promise<TData[]>;
  initialOptions?: TData[];
  minSearchLength?: number;
  queryKeysToInvalidate?: unknown[][];
  getOptionLabel?: (option: TData) => string;
  getOptionValue?: (option: TData) => string;
  getOptionDescription?: (option: TData) => string | undefined;
  renderOption?: (option: TData, isSelected: boolean) => React.ReactNode;
  // Multi-select
  multiple?: boolean;
  singleMode?: boolean;
  showCount?: boolean;
  // Display
  formatDisplay?: "category" | "brand";
  // For testing
  testId?: string;
}

export function FormCombobox<TData = ComboboxOption>({
  name,
  label,
  description,
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  options = [],
  disabled = false,
  required = false,
  icon,
  className,
  searchable = true,
  allowCreate = false,
  createLabel = (value) => `Criar "${value}"`,
  onCreate,
  isCreating = false,
  loading = false,
  // Async props
  async = false,
  queryKey,
  queryFn,
  initialOptions = [],
  minSearchLength = 1,
  queryKeysToInvalidate = [],
  getOptionLabel = (option: any) => option.label,
  getOptionValue = (option: any) => option.value,
  getOptionDescription,
  renderOption,
  // Multi-select
  multiple = false,
  singleMode = false,
  showCount = true,
  formatDisplay,
  testId,
}: FormComboboxProps<TData>) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className} data-testid={testId}>
          {label && (
            <FormLabel className="flex items-center gap-2">
              {icon}
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Combobox<TData>
              value={field.value}
              onValueChange={(val) => {
                // Ensure null is properly set when clearing
                field.onChange(val === undefined ? null : val);
              }}
              options={options}
              mode={multiple ? "multiple" : "single"}
              async={async}
              queryKey={queryKey}
              queryFn={queryFn}
              initialOptions={initialOptions}
              minSearchLength={minSearchLength}
              allowCreate={allowCreate}
              onCreate={onCreate}
              createLabel={createLabel}
              isCreating={isCreating}
              queryKeysToInvalidate={queryKeysToInvalidate}
              placeholder={`${placeholder}${required ? "" : " (opcional)"}`}
              emptyText={emptyText}
              disabled={disabled || loading}
              searchable={searchable}
              clearable={!required}
              loading={loading}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              getOptionDescription={getOptionDescription}
              renderOption={renderOption}
              formatDisplay={formatDisplay}
              singleMode={singleMode}
              showCount={showCount}
              className="w-full"
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Hook for entity creation with common pattern
export function useEntityCreation<TCreateData, TCreateResponse>(
  createFn: (data: TCreateData) => Promise<{ success: boolean; data?: TCreateResponse }>,
  onSuccess?: (data: TCreateResponse) => void,
) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (createData: TCreateData): Promise<void> => {
    setIsCreating(true);
    try {
      const result = await createFn(createData);

      if (result.success && result.data) {
        onSuccess?.(result.data);
      }
    } catch (error) {
      // Error is handled by the API client
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    handleCreate,
  };
}

// Convenience wrapper for sector selectors
interface FormSectorComboboxProps extends Omit<FormComboboxProps, "options" | "onCreate" | "isCreating"> {
  sectors?: Array<{ id: string; name: string; privileges?: string }>;
  onSectorCreate?: (name: string) => Promise<void>;
  productionOnly?: boolean;
  loading?: boolean;
}

export function FormSectorCombobox({ sectors = [], onSectorCreate, productionOnly = false, loading = false, ...props }: FormSectorComboboxProps) {
  const { isCreating, handleCreate } = useEntityCreation(async (name: string) => {
    if (onSectorCreate) {
      await onSectorCreate(name);
      return { success: true, data: null };
    }
    return { success: false };
  });

  // Filter sectors based on productionOnly flag
  const filteredSectors = React.useMemo(() => {
    if (!productionOnly) return sectors;

    return sectors.filter((sector) => {
      const privileges = sector.privileges?.toLowerCase();
      return privileges?.includes("production") || privileges?.includes("leader");
    });
  }, [sectors, productionOnly]);

  // Create options from filtered sectors
  const options = React.useMemo(
    () =>
      filteredSectors.map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
    [filteredSectors],
  );

  return (
    <FormCombobox
      {...props}
      options={options}
      onCreate={onSectorCreate ? handleCreate : undefined}
      isCreating={isCreating}
      loading={loading}
      allowCreate={!!onSectorCreate}
      createLabel={(value) => `Criar setor "${value}"`}
      emptyText={loading ? "Carregando setores..." : productionOnly ? "Nenhum setor de produção encontrado" : "Nenhum setor encontrado"}
    />
  );
}

// Convenience wrapper for position selectors
interface FormPositionComboboxProps extends Omit<FormComboboxProps, "options" | "onCreate" | "isCreating"> {
  positions?: Array<{ id: string; name: string }>;
  onPositionCreate?: (name: string) => Promise<void>;
  loading?: boolean;
}

export function FormPositionCombobox({ positions = [], onPositionCreate, loading = false, ...props }: FormPositionComboboxProps) {
  const { isCreating, handleCreate } = useEntityCreation(async (name: string) => {
    if (onPositionCreate) {
      await onPositionCreate(name);
      return { success: true, data: null };
    }
    return { success: false };
  });

  const options = React.useMemo(
    () =>
      positions.map((position) => ({
        value: position.id,
        label: position.name,
      })),
    [positions],
  );

  return (
    <FormCombobox
      {...props}
      options={options}
      onCreate={onPositionCreate ? handleCreate : undefined}
      isCreating={isCreating}
      loading={loading}
      allowCreate={!!onPositionCreate}
      createLabel={(value) => `Criar cargo "${value}"`}
      emptyText={loading ? "Carregando cargos..." : "Nenhum cargo encontrado"}
    />
  );
}

// Convenience wrapper for user selectors
interface FormUserComboboxProps extends Omit<FormComboboxProps, "options"> {
  users?: Array<{ id: string; name: string; email?: string }>;
  showEmail?: boolean;
  loading?: boolean;
}

export function FormUserCombobox({ users = [], showEmail = false, loading = false, ...props }: FormUserComboboxProps) {
  const options = React.useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: showEmail && user.email ? `${user.name} (${user.email})` : user.name,
      })),
    [users, showEmail],
  );

  return <FormCombobox {...props} options={options} loading={loading} allowCreate={false} emptyText={loading ? "Carregando usuários..." : "Nenhum usuário encontrado"} />;
}
