import { useCallback, useMemo, useState, forwardRef } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BasePhoneInput } from '@/components/ui/phone-input';
import { Combobox } from '@/components/ui/combobox';
import { FormLabel } from '@/components/ui/form';
import { CustomerCombobox } from '@/components/ui/customer-combobox';
import { cn } from '@/lib/utils';
import { responsibleService } from '@/services/responsibleService';
import { toBrazilianNameCase } from '@/utils/formatters';
import type { Responsible, ResponsibleRole, ResponsibleRowData } from '@/types/responsible';
import { RESPONSIBLE_ROLE_LABELS } from '@/types/responsible';

interface ResponsibleRowProps {
  control?: any;
  index: number;
  companyId: string;
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
  value: ResponsibleRowData;
  onChange: (updates: Partial<ResponsibleRowData>) => void;
  showErrors?: boolean;
}

const CREATE_NEW_VALUE = '__CREATE_NEW__';

// Module-level shared cache so all ResponsibleRow instances can look up responsibles
// regardless of which instance's queryFn was called by React Query (query deduplication)
const responsibleCache = new Map<string, Responsible>();

export const ResponsibleRow = forwardRef<HTMLDivElement, ResponsibleRowProps>(
  ({
    companyId: _companyId,
    disabled,
    readOnly,
    onRemove,
    isFirstRow,
    value,
    onChange,
    showErrors = false,
  }, ref) => {
    // Determine if we're in create mode based on the value
    const showCreateInputs = value.isEditing && value.id?.startsWith('temp-');

    // Track which fields have been touched (blurred) for inline validation
    const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean }>({});

    // Validation: name and phone are required when in create mode
    const nameEmpty = showCreateInputs && !value.name?.trim();
    const phoneEmpty = showCreateInputs && !value.phone?.trim();
    const nameError = nameEmpty && (touched.name || showErrors);
    const phoneError = phoneEmpty && (touched.phone || showErrors);

    // Async query function for the Combobox
    const queryFn = useCallback(async (searchTerm: string, page?: number) => {
      const response = await responsibleService.getAll({
        search: searchTerm || undefined,
        isActive: true,
        page: page || 1,
        pageSize: 20,
      });
      // Cache fetched reps in shared module-level cache
      response.data.forEach(rep => responsibleCache.set(rep.id, rep));
      return {
        data: response.data,
        hasMore: response.meta.page < response.meta.pageCount,
      };
    }, []);

    // Query key changes when role changes, triggering a re-fetch
    const queryKey = useMemo(() => ['responsibles', 'combobox'], []);

    // Provide the currently selected rep as initial option so the Combobox can display it
    const initialOptions = useMemo(() => {
      if (value.id && !value.id.startsWith('temp-') && value.name) {
        const rep = { id: value.id, name: value.name, phone: value.phone || '', email: value.email || '', role: value.role, isActive: true } as Responsible;
        responsibleCache.set(rep.id, rep);
        return [rep];
      }
      return [];
    }, [value.id, value.name, value.phone, value.email, value.role]);

    // Handle role selection
    const handleRoleChange = useCallback((role: string | string[] | null | undefined) => {
      if (!role || Array.isArray(role)) return;
      const roleValue = role as ResponsibleRole;
      onChange({
        role: roleValue,
        id: `temp-${Date.now()}`,
        name: '',
        phone: '',
        email: '',
        isNew: true,
        isEditing: value.isEditing,
      });
    }, [onChange, value.isEditing]);

    // Handle responsible selection
    const handleResponsibleChange = useCallback((selectedValue: string | string[] | null | undefined, searchTerm?: string) => {
      // Handle array values (shouldn't happen in single mode, but handle defensively)
      if (Array.isArray(selectedValue)) return;

      // Handle null/undefined - allow clearing the selection
      if (!selectedValue) {
        onChange({
          ...value,
          id: '',
          name: '',
          phone: '',
          email: '',
          isNew: false,
          isEditing: false,
        });
        return;
      }

      if (selectedValue === CREATE_NEW_VALUE) {
        onChange({
          ...value, // Preserve existing values, especially role
          id: `temp-${Date.now()}`,
          name: toBrazilianNameCase(searchTerm || ''),
          phone: '',
          email: '',
          isNew: true,
          isEditing: true, // This will trigger showCreateInputs
        });
      } else {
        // Select existing responsible from cache
        const rep = responsibleCache.get(selectedValue);
        if (rep) {
          onChange({
            id: rep.id,
            name: rep.name,
            phone: rep.phone,
            email: rep.email || '',
            // Keep user's role selection instead of overwriting with DB role
            isActive: rep.isActive,
            isNew: false,
            isEditing: false,
          });
        }
      }
    }, [onChange, value]);

    // Handle customer selection from CustomerCombobox
    const handleCustomerChange = useCallback((customerId: string | null) => {
      onChange({ ...value, companyId: customerId });
    }, [onChange, value]);

    // Build role options
    const roleOptions = Object.entries(RESPONSIBLE_ROLE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    }));

    // Format phone for display
    const formatPhoneDisplay = (phone: string) => {
      const numbers = phone.replace(/\D/g, "");
      if (numbers.length === 0) return phone;
      if (numbers.length === 11) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      }
      if (numbers.length === 10) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
      }
      return phone; // Return as-is if not standard format
    };

    // Option accessors for Responsible type
    const getOptionValue = useCallback((rep: Responsible) => rep.id, []);
    const getOptionLabel = useCallback((rep: Responsible) => `${rep.name} - ${formatPhoneDisplay(rep.phone)}`, []);
    const getOptionDescription = useCallback((rep: Responsible) => rep.email || undefined, []);

    // Fixed top content for "Cadastrar novo" button (pinned between search and scrollable list)
    const fixedTopContent = useCallback((searchTerm: string) => (
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-b dark:border-border/30"
        onClick={() => handleResponsibleChange(CREATE_NEW_VALUE, searchTerm)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleResponsibleChange(CREATE_NEW_VALUE, searchTerm);
          }
        }}
      >
        <span className="truncate font-medium">+ Cadastrar novo{searchTerm ? ` "${toBrazilianNameCase(searchTerm)}"` : ''}</span>
      </div>
    ), [handleResponsibleChange]);

    // Determine the current responsible value
    const currentResponsibleValue = value.id && !value.id.startsWith('temp-') ? value.id : '';

    return (
      <div ref={ref} className={cn("space-y-3", (nameError || phoneError) && "pb-4")}>
        <div className={cn(
          "grid grid-cols-1 gap-2 items-end",
          showCreateInputs ? "sm:grid-cols-[3fr_3fr_2fr_3fr_auto]" : "sm:grid-cols-[1fr_auto]"
        )}>
          {showCreateInputs ? (
            /* Inline Create Mode: Role + Name + Phone + Company + Remove */
            <>
              {/* Role Selection */}
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Função</FormLabel>}
                <Combobox
                  value={value.role || ''}
                  onValueChange={handleRoleChange}
                  options={roleOptions}
                  placeholder="Selecione uma função"
                  emptyText="Nenhuma função encontrada"
                  disabled={disabled || readOnly}
                  searchable={false}
                />
              </div>

              {/* Name */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>}
                <Input
                  type="text"
                  value={value.name || ''}
                  onChange={(newValue) => {
                    const finalValue = typeof newValue === 'string' ? newValue : '';
                    onChange({
                      ...value,
                      name: finalValue,
                    });
                  }}
                  onBlur={() => {
                    setTouched(prev => ({ ...prev, name: true }));
                    if (value.name) {
                      onChange({
                        ...value,
                        name: toBrazilianNameCase(value.name),
                      });
                    }
                  }}
                  placeholder="Digite o nome"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", nameError && "border-destructive")}
                  autoFocus
                />
                {nameError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">Nome é obrigatório</p>}
              </div>

              {/* Phone */}
              <div className="relative space-y-2">
                {isFirstRow && <FormLabel>Telefone <span className="text-destructive">*</span></FormLabel>}
                <BasePhoneInput
                  value={value.phone || ''}
                  onChange={(phoneValue) => {
                    onChange({
                      ...value,
                      phone: phoneValue || '',
                    });
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                  placeholder="(00) 00000-0000"
                  disabled={disabled || readOnly}
                  className={cn("bg-transparent", phoneError && "border-destructive")}
                />
                {phoneError && <p className="absolute left-0 top-full mt-0.5 text-xs text-destructive whitespace-nowrap">Telefone é obrigatório</p>}
              </div>

              {/* Company */}
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Empresa</FormLabel>}
                <CustomerCombobox
                  value={value.companyId || null}
                  onValueChange={handleCustomerChange}
                  disabled={disabled || readOnly}
                  placeholder="Selecione a empresa"
                />
              </div>
            </>
          ) : (
            /* Selection Mode: Just the Responsible combobox */
            <div className="space-y-2">
              {isFirstRow && <FormLabel>Responsável</FormLabel>}
              <Combobox<Responsible>
                value={currentResponsibleValue || ''}
                onValueChange={(newValue) => {
                  // Prevent deselection when clicking the same value
                  if (newValue !== undefined) {
                    handleResponsibleChange(newValue);
                  }
                }}
                async
                queryKey={queryKey}
                queryFn={queryFn}
                initialOptions={initialOptions}
                minSearchLength={0}
                getOptionValue={getOptionValue}
                getOptionLabel={getOptionLabel}
                getOptionDescription={getOptionDescription}
                placeholder="Selecione ou cadastre novo"
                emptyText="Nenhum responsável encontrado"
                disabled={disabled || readOnly}
                searchable={true}
                fixedTopContent={fixedTopContent}
              />
            </div>
          )}

          {/* Remove Button */}
          <div>
            {!readOnly && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                disabled={disabled}
                className="text-destructive h-10 w-10"
                title="Remover responsável"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ResponsibleRow.displayName = 'ResponsibleRow';
