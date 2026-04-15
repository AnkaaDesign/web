import { useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { PaymentConfig } from "@/schemas/task-quote";

// ─── Type selector options ────────────────────────────────────────────────────

export const PAYMENT_TYPE_OPTIONS = [
  { value: "CASH",   label: "À vista"      },
  { value: "INST_2", label: "Parcelado 2x" },
  { value: "INST_3", label: "Parcelado 3x" },
  { value: "INST_4", label: "Parcelado 4x" },
  { value: "INST_5", label: "Parcelado 5x" },
  { value: "INST_6", label: "Parcelado 6x" },
];

// Vencimento (À vista) — days + Personalizado to open date input
export const VENCIMENTO_OPTIONS = [
  { value: "5",      label: "5 dias"        },
  { value: "10",     label: "10 dias"       },
  { value: "20",     label: "20 dias"       },
  { value: "40",     label: "40 dias"       },
  { value: "CUSTOM", label: "Personalizado" },
];

// Entrada (1ª parcela) — days + Personalizado
export const ENTRADA_OPTIONS = [
  { value: "1",      label: "1 dia"         },
  { value: "3",      label: "3 dias"        },
  { value: "5",      label: "5 dias"        },
  { value: "7",      label: "7 dias"        },
  { value: "10",     label: "10 dias"       },
  { value: "14",     label: "14 dias"       },
  { value: "15",     label: "15 dias"       },
  { value: "20",     label: "20 dias"       },
  { value: "30",     label: "30 dias"       },
  { value: "CUSTOM", label: "Personalizado" },
];

export const INSTALLMENT_STEP_OPTIONS = [
  { value: "7",  label: "7 dias"  },
  { value: "10", label: "10 dias" },
  { value: "14", label: "14 dias" },
  { value: "15", label: "15 dias" },
  { value: "20", label: "20 dias" },
  { value: "25", label: "25 dias" },
  { value: "30", label: "30 dias" },
  { value: "45", label: "45 dias" },
  { value: "60", label: "60 dias" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert legacy paymentCondition string into a PaymentConfig for display */
export function legacyToConfig(condition: string | null | undefined): PaymentConfig | null {
  if (!condition || condition === "CUSTOM") return null;
  if (condition === "CASH_5")  return { type: "CASH", cashDays: 5  };
  if (condition === "CASH_10") return { type: "CASH", cashDays: 10 };
  if (condition === "CASH_20") return { type: "CASH", cashDays: 20 };
  if (condition === "CASH_40") return { type: "CASH", cashDays: 40 };
  const m = condition.match(/^INSTALLMENTS_(\d+)$/);
  if (m) return { type: "INSTALLMENTS", installmentCount: Number(m[1]), installmentStep: 20, entryDays: 5 };
  return null;
}

/** Derive type combobox value from a PaymentConfig */
export function configToTypeValue(config: PaymentConfig | null | undefined): string {
  if (!config) return "";
  if (config.type === "CASH") return "CASH";
  if (config.type === "INSTALLMENTS") return `INST_${config.installmentCount}`;
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PaymentConfigFieldProps {
  paymentConfig: PaymentConfig | null | undefined;
  onChange: (config: PaymentConfig | null) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  className?: string;
}

export function PaymentConfigField({
  paymentConfig,
  onChange,
  disabled,
  required,
  label = "Condição de Pagamento",
  className,
}: PaymentConfigFieldProps) {
  const typeValue = configToTypeValue(paymentConfig);
  const paymentType = paymentConfig?.type ?? null;

  // Track whether the date-override input is visible.
  // Initialized from existing specificDate so remounts preserve state.
  const [showDateInput, setShowDateInput] = useState(() => !!paymentConfig?.specificDate);

  const patch = (partial: Partial<PaymentConfig>) =>
    onChange({ ...(paymentConfig as PaymentConfig), ...partial } as PaymentConfig);

  // ── Type combobox ────────────────────────────────────────────────────────
  const handleTypeChange = (v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { onChange(null); setShowDateInput(false); return; }
    if (val === "CASH") {
      setShowDateInput(!!paymentConfig?.specificDate);
      onChange({ type: "CASH", cashDays: paymentConfig?.cashDays ?? 5, specificDate: paymentConfig?.specificDate });
      return;
    }
    const m = val.match(/^INST_(\d+)$/);
    if (m) {
      setShowDateInput(!!paymentConfig?.specificDate);
      onChange({
        type: "INSTALLMENTS",
        installmentCount: Number(m[1]),
        installmentStep: paymentConfig?.installmentStep ?? 20,
        entryDays: paymentConfig?.entryDays ?? 5,
        specificDate: paymentConfig?.specificDate,
      });
    }
  };

  // ── Vencimento (À vista) ─────────────────────────────────────────────────
  const vencimentoValue = paymentConfig?.specificDate ? "CUSTOM" : String(paymentConfig?.cashDays ?? "");
  const handleVencimentoChange = (v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { patch({ cashDays: undefined, specificDate: undefined }); setShowDateInput(false); return; }
    if (val === "CUSTOM") { setShowDateInput(true); return; }
    patch({ cashDays: Number(val) as any, specificDate: undefined });
    setShowDateInput(false);
  };

  // ── Entrada (Parcelado 1ª parcela) ───────────────────────────────────────
  const entradaValue = paymentConfig?.specificDate ? "CUSTOM" : String(paymentConfig?.entryDays ?? "");
  const handleEntradaChange = (v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { patch({ entryDays: undefined, specificDate: undefined }); setShowDateInput(false); return; }
    if (val === "CUSTOM") { setShowDateInput(true); return; }
    patch({ entryDays: Number(val), specificDate: undefined });
    setShowDateInput(false);
  };

  return (
    <div className={className}>
      <div className="flex gap-3 items-end">

        {/* ── Type selector ──────────────────────────────────────────────── */}
        <div className="space-y-1.5 flex-1 min-w-[140px]">
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Combobox
            value={typeValue}
            onValueChange={handleTypeChange}
            options={PAYMENT_TYPE_OPTIONS}
            placeholder="Selecione..."
            searchable={false}
            clearable
            disabled={disabled}
          />
        </div>

        {/* ── À vista: Vencimento ────────────────────────────────────────── */}
        {paymentType === "CASH" && (
          <div className="space-y-1.5 flex-1">
            <Label className="text-sm font-medium">Vencimento</Label>
            <Combobox
              value={vencimentoValue}
              onValueChange={handleVencimentoChange}
              options={VENCIMENTO_OPTIONS}
              placeholder="Dias..."
              searchable={false}
              clearable={false}
              disabled={disabled}
            />
          </div>
        )}

        {/* ── Parcelado: Intervalo ───────────────────────────────────────── */}
        {paymentType === "INSTALLMENTS" && (
          <div className="space-y-1.5 flex-1">
            <Label className="text-sm font-medium">Intervalo</Label>
            <Combobox
              value={String(paymentConfig?.installmentStep ?? 20)}
              onValueChange={(v) => patch({ installmentStep: Number(v) })}
              options={INSTALLMENT_STEP_OPTIONS}
              placeholder="Intervalo..."
              searchable={false}
              clearable={false}
              disabled={disabled}
            />
          </div>
        )}

        {/* ── Parcelado: Entrada ─────────────────────────────────────────── */}
        {paymentType === "INSTALLMENTS" && (
          <div className="space-y-1.5 flex-1">
            <Label className="text-sm font-medium">Entrada</Label>
            <Combobox
              value={entradaValue}
              onValueChange={handleEntradaChange}
              options={ENTRADA_OPTIONS}
              placeholder="Dias..."
              searchable={false}
              clearable={false}
              disabled={disabled}
            />
          </div>
        )}

        {/* ── Specific date — shown when Personalizado is chosen ─────────── */}
        {paymentType && showDateInput && (
          <div className="space-y-1.5 flex-1">
            <Label className="text-sm font-medium">Data específica</Label>
            <DateTimeInput
              mode="date"
              value={
                paymentConfig?.specificDate
                  ? (() => {
                      const [y, m, d] = paymentConfig.specificDate.split("-").map(Number);
                      return new Date(y, m - 1, d, 13, 0, 0);
                    })()
                  : null
              }
              onChange={(date) => {
                if (!date || !(date instanceof Date)) {
                  patch({ specificDate: undefined });
                  return;
                }
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, "0");
                const dd = String(date.getDate()).padStart(2, "0");
                patch({ specificDate: `${yyyy}-${mm}-${dd}` });
              }}
              disabled={disabled}
              hideLabel
              showClearButton
            />
          </div>
        )}

      </div>
    </div>
  );
}
