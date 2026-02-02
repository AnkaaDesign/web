import React, { useCallback, forwardRef } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BasePhoneInput } from '@/components/ui/phone-input';
import { Combobox } from '@/components/ui/combobox';
import { FormLabel } from '@/components/ui/form';
import type { Representative, RepresentativeRole, RepresentativeRowData } from '@/types/representative';
import { REPRESENTATIVE_ROLE_LABELS } from '@/types/representative';

interface RepresentativeRowProps {
  control?: any;
  index: number;
  customerId: string;
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
  availableRepresentatives: Representative[];
  loadingRepresentatives: boolean;
  value: RepresentativeRowData;
  onChange: (updates: Partial<RepresentativeRowData>) => void;
}

const CREATE_NEW_VALUE = '__CREATE_NEW__';

export const RepresentativeRow = forwardRef<HTMLDivElement, RepresentativeRowProps>(
  ({
    control,
    index,
    customerId,
    disabled,
    readOnly,
    onRemove,
    isFirstRow,
    availableRepresentatives,
    loadingRepresentatives,
    value,
    onChange,
  }, ref) => {
    // Determine if we're in create mode based on the value
    const showCreateInputs = value.isEditing && value.id?.startsWith('temp-');

    // Filter representatives by selected role and customer (if provided)
    const filteredRepresentatives = value.role
      ? availableRepresentatives.filter(rep => {
          // Filter by role
          if (rep.role !== value.role) return false;

          // If customerId is provided, only show representatives for that customer
          // Otherwise show all representatives for the role
          if (customerId && rep.customerId !== customerId) return false;

          return true;
        })
      : [];

    // Handle role selection
    const handleRoleChange = useCallback((role: string) => {
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
    const handleRepresentativeChange = useCallback((selectedValue: string | null | undefined) => {
      // Handle null/undefined (when clicking the same value again in single mode)
      if (!selectedValue) {
        return; // Don't do anything if value is cleared
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
        // Select existing representative
        const rep = filteredRepresentatives.find(r => r.id === selectedValue);
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
    }, [filteredRepresentatives, onChange, value]);


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

    // Build representative options - "Cadastrar novo" first, then existing representatives
    const representativeOptions = [
      { value: CREATE_NEW_VALUE, label: 'Cadastrar novo' },
      ...filteredRepresentatives.map(rep => ({
        value: rep.id,
        label: `${rep.name} - ${formatPhoneDisplay(rep.phone)}`,
      })),
    ];

    // Determine the current representative value
    const currentRepresentativeValue = showCreateInputs
      ? CREATE_NEW_VALUE
      : (value.id && !value.id.startsWith('temp-') ? value.id : '');

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
              emptyMessage="Nenhuma função encontrada"
              disabled={disabled || readOnly}
              searchable={false}
            />
          </div>

          {/* Representative Selection OR Inline Inputs - 8/12 width */}
          <div className="sm:col-span-8">
            {showCreateInputs ? (
              /* Inline Create Representative Inputs */
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            ) : (
              /* Representative Selection */
              <div className="space-y-2">
                {isFirstRow && <FormLabel>Representante</FormLabel>}
                <Combobox
                  value={currentRepresentativeValue || ''}
                  onValueChange={(newValue) => {
                    // Prevent deselection when clicking the same value
                    if (newValue !== undefined) {
                      handleRepresentativeChange(newValue);
                    }
                  }}
                  options={representativeOptions}
                  placeholder={value.role ? "Selecione ou cadastre novo" : "Selecione função primeiro"}
                  emptyMessage="Nenhum representante encontrado"
                  disabled={!value.role || disabled || readOnly || loadingRepresentatives}
                  loading={loadingRepresentatives}
                  searchable={filteredRepresentatives.length > 5}
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
