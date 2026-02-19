import React, { useEffect, useCallback } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/common/use-toast';
import type {
  RepresentativeRole,
  RepresentativeRowData,
} from '@/types/representative';
import { RepresentativeRow } from './representative-row';

interface CustomerOption {
  id: string;
  name: string;
}

interface InvoiceToCustomer {
  id: string;
  fantasyName?: string;
  corporateName?: string;
}

interface RepresentativeManagerProps {
  customerId?: string;
  customerName?: string; // Display name for primary customer
  invoiceToId?: string; // Billing customer (legacy single) - representatives from this customer should also be available
  invoiceToName?: string; // Display name for billing customer (legacy single)
  invoiceToCustomers?: InvoiceToCustomer[]; // Multiple billing customers from pricing
  value: RepresentativeRowData[];
  onChange: (representatives: RepresentativeRowData[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  helperText?: string;
  allowedRoles?: RepresentativeRole[];
  required?: boolean;
  minRows?: number;
  maxRows?: number;
  control?: any; // React Hook Form control for nested fields
}

export const RepresentativeManager: React.FC<RepresentativeManagerProps> = ({
  customerId,
  customerName,
  invoiceToId,
  invoiceToName,
  invoiceToCustomers,
  value = [],
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
  helperText,
  allowedRoles,
  required: _required = false,
  minRows = 0, // No minimum required by default
  maxRows = 10,
  control,
}) => {
  // Build customer options for the dropdown when creating new representatives
  const customerOptions: CustomerOption[] = [];
  if (customerId && customerName) {
    customerOptions.push({ id: customerId, name: customerName });
  }
  // Support multiple invoiceTo customers from pricing
  if (invoiceToCustomers && invoiceToCustomers.length > 0) {
    invoiceToCustomers.forEach(c => {
      if (c.id !== customerId) {
        customerOptions.push({ id: c.id, name: c.fantasyName || c.corporateName || 'Cliente' });
      }
    });
  } else if (invoiceToId && invoiceToName && invoiceToId !== customerId) {
    // Legacy single invoiceTo fallback
    customerOptions.push({ id: invoiceToId, name: invoiceToName });
  }
  const { toast } = useToast();

  // Ensure at least minRows are always present
  useEffect(() => {
    if (value.length < minRows) {
      const emptyRows: RepresentativeRowData[] = Array.from(
        { length: minRows - value.length },
        (_, i) => ({
          id: `temp-${Date.now()}-${i}`,
          name: '',
          phone: '',
          email: '',
          role: allowedRoles?.[0] || ('COMMERCIAL' as RepresentativeRole),
          isActive: true,
          isNew: true,
          isEditing: false, // Start with combobox visible, not edit mode
          isSaving: false,
          error: null,
          customerId: customerId || null, // Default to primary customer
        })
      );
      onChange([...value, ...emptyRows]);
    }
  }, [value.length, minRows, onChange, allowedRoles, customerId]);

  // Generate a unique temporary ID for new rows
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add a new row
  const handleAddRow = useCallback(() => {
    if (value.length >= maxRows) {
      toast({
        title: 'Limite atingido',
        description: `Você pode adicionar no máximo ${maxRows} representantes`,
        variant: 'warning',
      });
      return;
    }

    const newRow: RepresentativeRowData = {
      id: generateTempId(),
      name: '',
      phone: '',
      email: '',
      role: allowedRoles?.[0] || ('COMMERCIAL' as RepresentativeRole),
      isActive: true,
      isNew: true,
      isEditing: false, // Start with combobox visible, not edit mode
      isSaving: false,
      error: null,
      customerId: customerId || null, // Default to primary customer
    };

    onChange([...value, newRow]);
  }, [value, maxRows, allowedRoles, onChange, toast, customerId]);

  // Remove a row
  const handleRemoveRow = useCallback((index: number) => {
    if (value.length <= minRows) {
      toast({
        title: 'Mínimo de representantes',
        description: `Você deve ter pelo menos ${minRows} representante(s)`,
        variant: 'warning',
      });
      return;
    }

    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  }, [value, minRows, onChange, toast]);

  // Update a row
  const handleUpdateRow = useCallback((index: number, updates: Partial<RepresentativeRowData>) => {
    console.log('[RepresentativeManager] handleUpdateRow:', {
      index,
      updates,
      currentValue: value[index],
      willUpdate: { ...value[index], ...updates }
    });

    const newValue = value.map((row, i) =>
      i === index
        ? { ...row, ...updates, error: null }
        : row
    );

    console.log('[RepresentativeManager] Calling parent onChange with:', newValue);
    onChange(newValue);
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      {/* Representative Rows */}
      {value.length > 0 ? (
        <div className="space-y-3">
          {value.map((row, index) => (
            <RepresentativeRow
            key={row.id}
            control={control}
            index={index}
            customerId={customerId || ''}
            invoiceToId={invoiceToId || ''}
            invoiceToCustomerIds={invoiceToCustomers?.map(c => c.id)}
            customerOptions={customerOptions}
            disabled={disabled}
            readOnly={readOnly}
            onRemove={() => handleRemoveRow(index)}
            isFirstRow={index === 0}
            isLastRow={index === value.length - 1}
            value={row}
            onChange={(updates) => handleUpdateRow(index, updates)}
          />
        ))}
      </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          Nenhum representante adicionado. Clique no botão abaixo para adicionar.
        </div>
      )}

      {/* Add Button */}
      {!disabled && !readOnly && value.length < maxRows && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={disabled || readOnly}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Representante
        </Button>
      )}

      {/* Helper Text */}
      {helperText && (
        <p className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {helperText}
        </p>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {helperText || 'Por favor, corrija os erros nos representantes'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
