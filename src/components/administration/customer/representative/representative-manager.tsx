import React, { useState, useEffect, useCallback } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { representativeService } from '@/services/representativeService';
import { useToast } from '@/hooks/common/use-toast';
import type {
  Representative,
  RepresentativeRole,
  RepresentativeRowData,
} from '@/types/representative';
import { RepresentativeRow } from './RepresentativeRow';

interface CustomerOption {
  id: string;
  name: string;
}

interface RepresentativeManagerProps {
  customerId?: string;
  customerName?: string; // Display name for primary customer
  invoiceToId?: string; // Billing customer - representatives from this customer should also be available
  invoiceToName?: string; // Display name for billing customer
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
  if (invoiceToId && invoiceToName && invoiceToId !== customerId) {
    customerOptions.push({ id: invoiceToId, name: invoiceToName });
  }
  const { toast } = useToast();

  // State
  const [availableRepresentatives, setAvailableRepresentatives] = useState<Representative[]>([]);
  const [loadingRepresentatives, setLoadingRepresentatives] = useState(false);

  // Load available representatives - for customer, invoiceTo, or all if no customer selected
  useEffect(() => {
    loadRepresentatives();
  }, [customerId, invoiceToId]);

  const loadRepresentatives = async () => {
    setLoadingRepresentatives(true);
    try {
      let reps: Representative[] = [];

      // Collect unique customer IDs to fetch representatives from
      const customerIds = new Set<string>();
      if (customerId) customerIds.add(customerId);
      if (invoiceToId) customerIds.add(invoiceToId);

      if (customerIds.size > 0) {
        // Fetch representatives for each customer in parallel
        const promises = Array.from(customerIds).map(cId =>
          representativeService.getByCustomer(cId)
        );
        const results = await Promise.all(promises);

        // Merge and deduplicate representatives by ID
        const repsMap = new Map<string, Representative>();
        results.flat().forEach(rep => {
          if (!repsMap.has(rep.id)) {
            repsMap.set(rep.id, rep);
          }
        });
        reps = Array.from(repsMap.values());
      } else {
        // Get all representatives if no customer selected
        const response = await representativeService.getAll({ pageSize: 1000 });
        reps = response.data;
      }

      // Filter by allowed roles if specified
      const filteredReps = allowedRoles
        ? reps.filter(r => allowedRoles.includes(r.role))
        : reps;

      setAvailableRepresentatives(filteredReps);
    } catch (error: any) {
      console.error('Error loading representatives:', error);
      setAvailableRepresentatives([]);
    } finally {
      setLoadingRepresentatives(false);
    }
  };

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
            customerOptions={customerOptions}
            disabled={disabled || loadingRepresentatives}
            readOnly={readOnly}
            onRemove={() => handleRemoveRow(index)}
            isFirstRow={index === 0}
            isLastRow={index === value.length - 1}
            availableRepresentatives={availableRepresentatives}
            loadingRepresentatives={loadingRepresentatives}
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
          disabled={disabled || readOnly || loadingRepresentatives}
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
