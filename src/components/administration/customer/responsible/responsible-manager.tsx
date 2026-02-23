import React, { useEffect, useCallback } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/common/use-toast';
import type {
  ResponsibleRole,
  ResponsibleRowData,
} from '@/types/responsible';
import { ResponsibleRow } from './responsible-row';

/**
 * Validate responsible rows that are in inline-create mode.
 * Returns true if all new rows have required fields filled.
 */
export function validateResponsibleRows(rows: ResponsibleRowData[]): boolean {
  return rows.every(row => {
    // Only validate rows in create mode (isNew + temp id)
    if (!row.isNew || !row.isEditing || !row.id?.startsWith('temp-')) return true;
    return !!row.name?.trim() && !!row.phone?.trim();
  });
}

interface ResponsibleManagerProps {
  companyId?: string;
  value: ResponsibleRowData[];
  onChange: (responsibles: ResponsibleRowData[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  helperText?: string;
  allowedRoles?: ResponsibleRole[];
  required?: boolean;
  minRows?: number;
  maxRows?: number;
  control?: any; // React Hook Form control for nested fields
  showErrors?: boolean;
}

export const ResponsibleManager: React.FC<ResponsibleManagerProps> = ({
  companyId,
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
  showErrors = false,
}) => {
  const { toast } = useToast();

  // Ensure at least minRows are always present
  useEffect(() => {
    if (value.length < minRows) {
      const emptyRows: ResponsibleRowData[] = Array.from(
        { length: minRows - value.length },
        (_, i) => ({
          id: `temp-${Date.now()}-${i}`,
          name: '',
          phone: '',
          email: '',
          role: allowedRoles?.[0] || ('COMMERCIAL' as ResponsibleRole),
          isActive: true,
          isNew: true,
          isEditing: false, // Start with combobox visible, not edit mode
          isSaving: false,
          error: null,
          companyId: null, // User explicitly selects via CustomerCombobox
        })
      );
      onChange([...value, ...emptyRows]);
    }
  }, [value.length, minRows, onChange, allowedRoles, companyId]);

  // Generate a unique temporary ID for new rows
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add a new row
  const handleAddRow = useCallback(() => {
    if (value.length >= maxRows) {
      toast({
        title: 'Limite atingido',
        description: `Você pode adicionar no máximo ${maxRows} responsáveis`,
        variant: 'warning',
      });
      return;
    }

    const newRow: ResponsibleRowData = {
      id: generateTempId(),
      name: '',
      phone: '',
      email: '',
      role: allowedRoles?.[0] || ('COMMERCIAL' as ResponsibleRole),
      isActive: true,
      isNew: true,
      isEditing: false, // Start with combobox visible, not edit mode
      isSaving: false,
      error: null,
      companyId: companyId || null, // Default to primary company
    };

    onChange([...value, newRow]);
  }, [value, maxRows, allowedRoles, onChange, toast, companyId]);

  // Remove a row
  const handleRemoveRow = useCallback((index: number) => {
    if (value.length <= minRows) {
      toast({
        title: 'Mínimo de responsáveis',
        description: `Você deve ter pelo menos ${minRows} responsável(is)`,
        variant: 'warning',
      });
      return;
    }

    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  }, [value, minRows, onChange, toast]);

  // Update a row
  const handleUpdateRow = useCallback((index: number, updates: Partial<ResponsibleRowData>) => {
    const newValue = value.map((row, i) =>
      i === index
        ? { ...row, ...updates, error: null }
        : row
    );

    onChange(newValue);
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      {/* Responsible Rows */}
      {value.length > 0 ? (
        <div className="space-y-3">
          {value.map((row, index) => (
            <ResponsibleRow
            key={index}
            control={control}
            index={index}
            companyId={companyId || ''}
            disabled={disabled}
            readOnly={readOnly}
            onRemove={() => handleRemoveRow(index)}
            isFirstRow={index === 0}
            isLastRow={index === value.length - 1}
            value={row}
            onChange={(updates) => handleUpdateRow(index, updates)}
            showErrors={showErrors}
          />
        ))}
      </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          Nenhum responsável adicionado. Clique no botão abaixo para adicionar.
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
          Adicionar Responsável
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
            {helperText || 'Por favor, corrija os erros nos responsáveis'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
