import { useCallback, useRef, useMemo, forwardRef } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BasePhoneInput } from '@/components/ui/phone-input';
import { Combobox } from '@/components/ui/combobox';
import { FormLabel } from '@/components/ui/form';
import { representativeService } from '@/services/representativeService';
import type { Representative, RepresentativeRole, RepresentativeRowData } from '@/types/representative';
import { REPRESENTATIVE_ROLE_LABELS } from '@/types/representative';

interface CustomerOption {
  id: string;
  name: string;
}

interface RepresentativeRowProps {
  control?: any;
  index: number;
  customerId: string;
  invoiceToId?: string; // Billing customer (legacy single)
  invoiceToCustomerIds?: string[]; // Multiple billing customer IDs from pricing
  customerOptions?: CustomerOption[]; // Options for customer selection when creating new representatives
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
  value: RepresentativeRowData;
  onChange: (updates: Partial<RepresentativeRowData>) => void;
}

const CREATE_NEW_VALUE = '__CREATE_NEW__';

export const RepresentativeRow = forwardRef<HTMLDivElement, RepresentativeRowProps>(
  ({
    customerId,
    invoiceToId,
    invoiceToCustomerIds,
    customerOptions = [],
    disabled,
    readOnly,
    onRemove,
    isFirstRow,
    value,
    onChange,
  }, ref) => {
    // Determine if we're in create mode based on the value
    const showCreateInputs = value.isEditing && value.id?.startsWith('temp-');

    // Show customer selector only when:
    // 1. In create mode (showCreateInputs)
    // 2. There are multiple customer options (customer and invoiceTo are different)
    const showCustomerSelector = showCreateInputs && customerOptions.length > 1;

    // Handle customer selection for new representatives
    const handleCustomerChange = useCallback((selectedCustomerId: string | string[] | null | undefined) => {
      if (!selectedCustomerId || Array.isArray(selectedCustomerId)) return;
      onChange({
        ...value,
        customerId: selectedCustomerId || null,
      });
    }, [onChange, value]);

    // Build customer options for the dropdown
    const customerSelectOptions = customerOptions.map(opt => ({
      value: opt.id,
      label: opt.name,
    }));

    // Cache fetched representatives for lookup on selection
    const fetchedRepsRef = useRef<Map<string, Representative>>(new Map());

    // Async query function for the Combobox
    const queryFn = useCallback(async (searchTerm: string, page?: number) => {
      if (!value.role) return { data: [] as Representative[], hasMore: false };
      const response = await representativeService.getAll({
        search: searchTerm || undefined,
        role: value.role as RepresentativeRole,
        isActive: true,
        page: page || 1,
        pageSize: 20,
      });
      // Cache fetched reps for lookup on selection
      response.data.forEach(rep => fetchedRepsRef.current.set(rep.id, rep));
      return {
        data: response.data,
        hasMore: response.meta.page < response.meta.pageCount,
      };
    }, [value.role]);

    // Query key changes when role changes, triggering a re-fetch
    const queryKey = useMemo(() => ['representatives', 'combobox', value.role], [value.role]);

    // Provide the currently selected rep as initial option so the Combobox can display it
    const initialOptions = useMemo(() => {
      if (value.id && !value.id.startsWith('temp-') && value.name) {
        const rep = { id: value.id, name: value.name, phone: value.phone || '', email: value.email || '', role: value.role, isActive: true } as Representative;
        fetchedRepsRef.current.set(rep.id, rep);
        return [rep];
      }
      return [];
    }, [value.id, value.name, value.phone, value.email, value.role]);

    // Handle role selection
    const handleRoleChange = useCallback((role: string | string[] | null | undefined) => {
      if (!role || Array.isArray(role)) return;
      const roleValue = role as RepresentativeRole;
      onChange({
        role: roleValue,
        // Reset representative selection when role changes
        id: `temp-${Date.now()}`,
        name: '',
        phone: '',
        email: '',
        isNew: true,
        isEditing: false, // Start with create mode OFF when changing role
      });
    }, [onChange]);

    // Handle representative selection
    const handleRepresentativeChange = useCallback((selectedValue: string | string[] | null | undefined) => {
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
          name: '',
          phone: '',
          email: '',
          isNew: true,
          isEditing: true, // This will trigger showCreateInputs
        });
      } else {
        // Select existing representative from cache
        const rep = fetchedRepsRef.current.get(selectedValue);
        if (rep) {
          onChange({
            id: rep.id,
            name: rep.name,
            phone: rep.phone,
            email: rep.email || '',
            role: rep.role,
            isActive: rep.isActive,
            isNew: false,
            isEditing: false,
          });
        }
      }
    }, [onChange, value]);


    // Build role options
    const roleOptions = Object.entries(REPRESENTATIVE_ROLE_LABELS).map(([key, label]) => ({
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

    // Option accessors for Representative type
    const getOptionValue = useCallback((rep: Representative) => rep.id, []);
    const getOptionLabel = useCallback((rep: Representative) => `${rep.name} - ${formatPhoneDisplay(rep.phone)}`, []);
    const getOptionDescription = useCallback((rep: Representative) => rep.email || undefined, []);

    // Fixed top content for "Cadastrar novo" button (pinned between search and scrollable list)
    const fixedTopContent = (
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-b dark:border-border/30"
        onClick={() => handleRepresentativeChange(CREATE_NEW_VALUE)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRepresentativeChange(CREATE_NEW_VALUE);
          }
        }}
      >
        <span className="truncate font-medium">+ Cadastrar novo</span>
      </div>
    );

    // Determine the current representative value
    const currentRepresentativeValue = value.id && !value.id.startsWith('temp-') ? value.id : '';

    return (
      <div ref={ref} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          {/* Role Selection - 3/12 width */}
          <div className="sm:col-span-3 space-y-2">
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

          {/* Representative Selection OR Inline Inputs - 8/12 width */}
          <div className="sm:col-span-8">
            {showCreateInputs ? (
              /* Inline Create Representative Inputs */
              <div className={`grid gap-2 ${showCustomerSelector ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="space-y-2">
                  {isFirstRow && <FormLabel>Nome do Representante</FormLabel>}
                  <Input
                    type="text"
                    value={value.name || ''}
                    onChange={(newValue) => {
                      // Input component passes the value directly when no name prop is provided
                      const finalValue = typeof newValue === 'string' ? newValue : '';
                      console.log('[RepresentativeRow] Name onChange:', {
                        receivedValue: newValue,
                        finalValue,
                        currentRow: value,
                        willUpdate: { ...value, name: finalValue }
                      });
                      onChange({
                        ...value,
                        name: finalValue,
                      });
                    }}
                    placeholder="Digite o nome"
                    disabled={disabled || readOnly}
                    className="bg-transparent"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  {isFirstRow && <FormLabel>Telefone</FormLabel>}
                  <BasePhoneInput
                    value={value.phone || ''}
                    onChange={(phoneValue) => {
                      console.log('[RepresentativeRow] Phone onChange:', {
                        phoneValue,
                        currentRow: value,
                        willUpdate: { ...value, phone: phoneValue || '' }
                      });
                      onChange({
                        ...value,
                        phone: phoneValue || '',
                      });
                    }}
                    placeholder="(00) 00000-0000"
                    disabled={disabled || readOnly}
                    className="bg-transparent"
                  />
                </div>

                {/* Customer Selector - only shown when there are multiple customer options */}
                {showCustomerSelector && (
                  <div className="space-y-2">
                    {isFirstRow && <FormLabel>Cliente</FormLabel>}
                    <Combobox
                      value={value.customerId || customerOptions[0]?.id || ''}
                      onValueChange={handleCustomerChange}
                      options={customerSelectOptions}
                      placeholder="Selecione o cliente"
                      emptyText="Nenhum cliente"
                      disabled={disabled || readOnly}
                      searchable={false}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Representative Selection */
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Representante</FormLabel>}
                <Combobox<Representative>
                  value={currentRepresentativeValue || ''}
                  onValueChange={(newValue) => {
                    // Prevent deselection when clicking the same value
                    if (newValue !== undefined) {
                      handleRepresentativeChange(newValue);
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
                  placeholder={value.role ? "Selecione ou cadastre novo" : "Selecione função primeiro"}
                  emptyText="Nenhum representante encontrado"
                  disabled={!value.role || disabled || readOnly}
                  searchable={true}
                  fixedTopContent={fixedTopContent}
                />
              </div>
            )}
          </div>

          {/* Remove Button - 1/12 width */}
          <div className="sm:col-span-1">
            {!readOnly && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                disabled={disabled}
                className="text-destructive h-10 w-10"
                title="Remover representante"
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

RepresentativeRow.displayName = 'RepresentativeRow';
