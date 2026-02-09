import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { BORROW_STATUS, BORROW_STATUS_ORDER } from "../../../../constants";
import { BorrowStatusBadge } from "../common/borrow-status-badge";

interface StatusSelectorProps {
  control: any;
  disabled?: boolean;
  currentStatus: BORROW_STATUS;
  onStatusChange?: (status: BORROW_STATUS) => void;
}

// Define valid status transitions
const getValidStatusTransitions = (currentStatus: BORROW_STATUS): BORROW_STATUS[] => {
  switch (currentStatus) {
    case BORROW_STATUS.ACTIVE:
      return [BORROW_STATUS.ACTIVE, BORROW_STATUS.RETURNED, BORROW_STATUS.LOST];
    case BORROW_STATUS.RETURNED:
      return [BORROW_STATUS.RETURNED]; // Cannot change from returned
    case BORROW_STATUS.LOST:
      return [BORROW_STATUS.LOST]; // Cannot change from lost
    default:
      return [currentStatus];
  }
};

export function BorrowStatusSelector({ control, disabled, currentStatus, onStatusChange }: StatusSelectorProps) {
  const validStatuses = getValidStatusTransitions(currentStatus);

  return (
    <div className="space-y-4">
      {/* Current Status Display */}
      <div className="rounded-lg border p-4">
        <div className="space-y-2">
          <FormLabel className="text-base">Status Atual</FormLabel>
          <BorrowStatusBadge status={currentStatus} />
        </div>
      </div>

      {/* Status Selection */}
      {validStatuses.length > 1 && (
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <div className="space-y-2">
                <FormLabel className="text-base">Alterar Status</FormLabel>
                <FormDescription>Selecione o novo status do empréstimo</FormDescription>
                <FormControl>
                  <Combobox
                    options={validStatuses
                      .sort((a, b) => (BORROW_STATUS_ORDER[a] || 999) - (BORROW_STATUS_ORDER[b] || 999))
                      .map((status) => ({
                        value: status,
                        label: status,
                      }))}
                    value={field.value || currentStatus}
                    onValueChange={(value) => {
                      const newStatus = value as BORROW_STATUS;
                      field.onChange(newStatus);

                      // Call the external status change handler
                      onStatusChange?.(newStatus);

                      // Auto-set returnedAt when status changes to RETURNED
                      if (newStatus === BORROW_STATUS.RETURNED) {
                        control._formValues.returnedAt = new Date();
                      } else {
                        control._formValues.returnedAt = null;
                      }
                    }}
                    placeholder="Selecione o status"
                    disabled={disabled}
                    searchable={false}
                    clearable={false}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      )}

      {/* Status Change Warnings */}
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div>
                {field.value === BORROW_STATUS.LOST && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-950 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                      <span className="text-xl font-enhanced-unicode">⚠️</span>
                      <div>
                        <p className="font-semibold">Atenção: Item será marcado como perdido</p>
                        <p className="text-sm">Esta ação indica que o item foi perdido e pode impactar o estoque.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
