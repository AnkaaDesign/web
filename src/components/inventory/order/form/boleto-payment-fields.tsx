import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";

// Boleto payment scheduling — flexible like the task quote:
//  • Parcelas (installmentCount)
//  • Primeiro Vencimento (paymentFirstDueDate) — quick presets in days OR an exact
//    date via "Personalizado"
//  • Intervalo entre Parcelas (paymentDueDays) — only relevant for 2x+, the spacing
//    between each parcela.

const FIRST_DUE_PRESETS = [
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "45", label: "45 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "120", label: "120 dias" },
  { value: "CUSTOM", label: "Personalizado" },
];

const INTERVAL_PRESETS = [
  { value: "15", label: "15 dias" },
  { value: "20", label: "20 dias" },
  { value: "30", label: "30 dias" },
  { value: "45", label: "45 dias" },
  { value: "60", label: "60 dias" },
];

/** A date `days` from now, anchored at 13:00 São Paulo time (matches forecast convention). */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(13, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

interface BoletoPaymentFieldsProps {
  form: UseFormReturn<any>;
  /** Edit form needs setValue to mark the form dirty so the save button enables. */
  markDirty?: boolean;
  /**
   * Lock the schedule inputs. Used by the edit form once a parcela is settled: the API freezes
   * the boleto schedule then, so editing parcelas/due-dates would be a no-op (or desync).
   */
  disabled?: boolean;
}

export function BoletoPaymentFields({ form, markDirty, disabled }: BoletoPaymentFieldsProps) {
  const opts = markDirty ? { shouldDirty: true } : undefined;
  const installmentCount = form.watch("installmentCount") || 1;
  const firstDue: Date | null = form.watch("paymentFirstDueDate") || null;
  const interval = form.watch("paymentDueDays");

  // Existing values load as "Personalizado" (we can't reverse a stored date into a preset).
  const [firstDueMode, setFirstDueMode] = useState<string>(() => (firstDue ? "CUSTOM" : ""));
  const showDateInput = firstDueMode === "CUSTOM";

  const rowCls = "flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]";
  const labelCls = "text-sm text-muted-foreground whitespace-nowrap mr-4";
  const ctrlCls = "flex-1 max-w-[55%] [&_button]:border-neutral-500";

  return (
    <>
      {/* Parcelas */}
      <div className={rowCls}>
        <span className={labelCls}>Parcelas</span>
        <div className={ctrlCls}>
          <Combobox
            value={String(installmentCount)}
            onValueChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value;
              form.setValue("installmentCount", v ? parseInt(v) : 1, opts);
            }}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: (i + 1).toString(),
              label: i === 0 ? "À vista (1x)" : `${i + 1}x`,
            }))}
            placeholder="Selecione as parcelas"
            emptyText="—"
            searchable={false}
            disabled={disabled}
            className="h-8 w-full"
          />
        </div>
      </div>

      {/* Primeiro Vencimento — days preset or exact date */}
      <div className={rowCls}>
        <span className={labelCls}>{installmentCount > 1 ? "1º Vencimento" : "Vencimento"}</span>
        <div className={ctrlCls}>
          <Combobox
            value={firstDueMode}
            onValueChange={(value) => {
              const v = (Array.isArray(value) ? value[0] : value) || "";
              if (!v) {
                setFirstDueMode("");
                form.setValue("paymentFirstDueDate", null, opts);
                return;
              }
              if (v === "CUSTOM") {
                setFirstDueMode("CUSTOM");
                return;
              }
              setFirstDueMode(v);
              form.setValue("paymentFirstDueDate", daysFromNow(parseInt(v)), opts);
            }}
            options={FIRST_DUE_PRESETS}
            placeholder="Selecione o vencimento"
            emptyText="Nenhuma opção"
            searchable={false}
            disabled={disabled}
            className="h-8 w-full"
          />
        </div>
      </div>

      {/* Exact date — shown when "Personalizado" is chosen */}
      {showDateInput && (
        <div className={rowCls}>
          <span className={labelCls}>Data do 1º Vencimento</span>
            {/* Recolor the picker's outer border to match the neutral-500 used by the
              sibling Combobox/Input fields (same in light & dark). Color-only, so it
              only affects the one bordered wrapper div. */}
          <div className="flex-1 max-w-[55%] [&_div]:border-neutral-500">
            <DateTimeInput
              mode="date"
              value={firstDue || undefined}
              onChange={(date) => {
                if (date instanceof Date) {
                  const d = new Date(date);
                  d.setHours(13, 0, 0, 0);
                  form.setValue("paymentFirstDueDate", d, opts);
                } else {
                  form.setValue("paymentFirstDueDate", null, opts);
                }
              }}
              hideLabel
              showClearButton
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Intervalo entre parcelas — only meaningful for 2x+ */}
      {installmentCount > 1 && (
        <div className={rowCls}>
          <span className={labelCls}>Intervalo entre Parcelas</span>
          <div className={ctrlCls}>
            <Combobox
              value={interval ? String(interval) : "30"}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                form.setValue("paymentDueDays", v ? parseInt(v) : 30, opts);
              }}
              options={INTERVAL_PRESETS}
              placeholder="Intervalo"
              emptyText="—"
              searchable={false}
              disabled={disabled}
              className="h-8 w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
