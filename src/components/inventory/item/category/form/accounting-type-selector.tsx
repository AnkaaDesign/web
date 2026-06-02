import type { FieldErrors } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { ItemCategoryCreateFormData, ItemCategoryUpdateFormData } from "../../../../../schemas";
import { ACCOUNTING_TYPE, ACCOUNTING_TYPE_LABELS } from "../../../../../constants";

// Item categories only ever roll up into these operational accounting groups.
// The remaining AccountingType values (Salários, Despesas Fixas, Aplicação
// Financeira, Estorno, etc.) are transaction-only and are intentionally not
// offered when categorizing physical inventory.
const ITEM_ACCOUNTING_TYPES = [
  ACCOUNTING_TYPE.PRODUTIVO,
  ACCOUNTING_TYPE.MATERIA_PRIMA,
  ACCOUNTING_TYPE.MANUTENCAO,
  ACCOUNTING_TYPE.EPI,
  ACCOUNTING_TYPE.ESCRITORIO,
] as const;

interface AccountingTypeSelectorProps {
  control: any;
  errors?: FieldErrors<ItemCategoryCreateFormData | ItemCategoryUpdateFormData>;
  disabled?: boolean;
  /** When true, the field is shown read-only (subcategories roll up the parent's value). */
  readOnlyRollup?: boolean;
}

export function AccountingTypeSelector({ control, disabled, readOnlyRollup }: AccountingTypeSelectorProps) {
  const options = ITEM_ACCOUNTING_TYPES.map((type) => ({
    value: type,
    label: ACCOUNTING_TYPE_LABELS[type],
  }));

  return (
    <FormField
      control={control}
      name="accountingType"
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Tipo (Contábil)
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder={readOnlyRollup ? "Herdado da categoria" : "Selecione o tipo contábil"}
              emptyText="Nenhum tipo contábil"
              disabled={disabled || readOnlyRollup}
              searchable={false}
              clearable={!readOnlyRollup}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
