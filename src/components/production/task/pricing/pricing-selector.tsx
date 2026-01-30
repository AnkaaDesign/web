import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFieldArray, useWatch, useFormContext, useController } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash, IconCalendar, IconCurrencyReal, IconPhoto, IconNote } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "../../../../utils";
import { DISCOUNT_TYPE, SERVICE_ORDER_TYPE } from "@/constants/enums";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { ServiceAutocomplete } from "../form/service-autocomplete";

interface PricingSelectorProps {
  control: any;
  disabled?: boolean;
  userRole?: string;
  readOnly?: boolean;
  onItemCountChange?: (count: number) => void;
  layoutFiles?: FileWithPreview[];
  onLayoutFilesChange?: (files: FileWithPreview[]) => void;
  onItemDeleted?: (description: string) => void;
}

export interface PricingSelectorRef {
  addItem: () => void;
  clearAll: () => void;
}

// Payment condition options (simplified - maps directly to PaymentCondition enum)
// Labels show cumulative payment dates: "Entrada + 20/40" = payment on day 0 (entrada), day 20, day 40
const PAYMENT_CONDITIONS = [
  { value: "CASH", label: "À vista" },
  { value: "INSTALLMENTS_2", label: "Entrada + 20" },
  { value: "INSTALLMENTS_3", label: "Entrada + 20/40" },
  { value: "INSTALLMENTS_4", label: "Entrada + 20/40/60" },
  { value: "INSTALLMENTS_5", label: "Entrada + 20/40/60/80" },
  { value: "INSTALLMENTS_6", label: "Entrada + 20/40/60/80/100" },
  { value: "INSTALLMENTS_7", label: "Entrada + 20/40/60/80/100/120" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

// Guarantee options
const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

// Validity days options (1-30 days)
const VALIDITY_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? 'dia' : 'dias'}`,
}));

export const PricingSelector = forwardRef<
  PricingSelectorRef,
  PricingSelectorProps
>(({ control, disabled, userRole, readOnly, onItemCountChange, layoutFiles: externalLayoutFiles, onLayoutFilesChange, onItemDeleted }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showCustomPayment, setShowCustomPayment] = useState(false);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);
  // Use external layout files if provided, otherwise use local state
  const [localLayoutFiles, setLocalLayoutFiles] = useState<FileWithPreview[]>([]);
  const layoutFiles = externalLayoutFiles ?? localLayoutFiles;
  const setLayoutFiles = onLayoutFilesChange ?? setLocalLayoutFiles;
  const lastRowRef = useRef<HTMLDivElement>(null);
  const { setValue, clearErrors, getValues } = useFormContext();

  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: "pricing.items",
  });

  // Watch pricing values
  const pricingItems = useWatch({ control, name: "pricing.items" });
  const pricingStatus = useWatch({ control, name: "pricing.status" }) || 'DRAFT';
  const pricingExpiresAt = useWatch({ control, name: "pricing.expiresAt" });
  const discountType = useWatch({ control, name: "pricing.discountType" }) || DISCOUNT_TYPE.NONE;
  const discountValue = useWatch({ control, name: "pricing.discountValue" });
  const paymentCondition = useWatch({ control, name: "pricing.paymentCondition" });
  const customPaymentText = useWatch({ control, name: "pricing.customPaymentText" });
  const guaranteeYears = useWatch({ control, name: "pricing.guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "pricing.customGuaranteeText" });
  const layoutFileId = useWatch({ control, name: "pricing.layoutFileId" });

  // Current payment condition - directly from stored value or CUSTOM if has custom text
  const currentPaymentCondition = useMemo(() => {
    if (customPaymentText) return "CUSTOM";
    return paymentCondition || "";
  }, [paymentCondition, customPaymentText]);

  // Derive current guarantee option from stored values
  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  // Initialize custom states from existing data
  useEffect(() => {
    if (customPaymentText && !showCustomPayment) {
      setShowCustomPayment(true);
    }
    if (customGuaranteeText && !showCustomGuarantee) {
      setShowCustomGuarantee(true);
    }
  }, [customPaymentText, customGuaranteeText, showCustomPayment, showCustomGuarantee]);

  // Note: Layout files initialization is now handled by the parent component (task-edit-form)
  // which passes the actual file data from the API including correct size information.
  // The layoutFileId is only used for tracking changes, not for creating placeholder files.

  // Handle layout file change
  const handleLayoutFileChange = useCallback((files: FileWithPreview[]) => {
    setLayoutFiles(files);
    if (files.length > 0 && files[0].uploadedFileId) {
      setValue("pricing.layoutFileId", files[0].uploadedFileId);
    } else if (files.length === 0) {
      setValue("pricing.layoutFileId", null);
    }
  }, [setValue]);


  // Calculate subtotal from all pricing items
  const subtotal = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return 0;
    return pricingItems.reduce((sum: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
      return sum + amount;
    }, 0);
  }, [pricingItems]);

  // Calculate discount amount
  const discountAmount = useMemo(() => {
    if (discountType === DISCOUNT_TYPE.NONE || !discountValue) return 0;
    if (discountType === DISCOUNT_TYPE.PERCENTAGE) {
      return Math.round((subtotal * discountValue) / 100 * 100) / 100;
    }
    if (discountType === DISCOUNT_TYPE.FIXED_VALUE) {
      return discountValue;
    }
    return 0;
  }, [subtotal, discountType, discountValue]);

  // Calculate total with discount applied
  const calculatedTotal = useMemo(() => {
    return Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  }, [subtotal, discountAmount]);

  // Check if any pricing item is incomplete
  // An item is incomplete only if it has amount > 0 but no description
  // Empty items (no description AND no amount) are allowed and filtered on submit
  const hasIncompletePricing = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return false;
    return pricingItems.some((item: any) => {
      const hasDescription = item.description && item.description.trim() !== "";
      const hasAmount = item.amount !== null && item.amount !== undefined && item.amount > 0;
      // Only incomplete if has amount but no description
      return hasAmount && !hasDescription;
    });
  }, [pricingItems]);

  // Initialize local state from form data
  useEffect(() => {
    if (!initialized) {
      const expiresAt = getValues("pricing.expiresAt");
      const items = getValues("pricing.items");
      const hasItems = items && items.length > 0;

      if (expiresAt) {
        const today = new Date();
        const diffTime = new Date(expiresAt).getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 90) {
          setValidityPeriod(diffDays);
        } else {
          setValidityPeriod(30);
        }
      } else {
        // Default to 30 days
        setValidityPeriod(30);
        // If there are items but no expiresAt, set a default expiry date
        // This fixes validation errors when editing tasks with pricing items but no expiry
        if (hasItems) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          expiryDate.setHours(23, 59, 59, 999);
          setValue("pricing.expiresAt", expiryDate, { shouldDirty: false });
        }
      }
      setInitialized(true);
    }
  }, [initialized, getValues, setValue]);

  // Notify parent about count changes
  useEffect(() => {
    if (onItemCountChange) {
      const count = pricingItems && pricingItems.length > 0 ? 1 : 0;
      onItemCountChange(count);
    }
  }, [pricingItems, onItemCountChange]);

  // Update subtotal and total in form
  useEffect(() => {
    if (pricingItems && pricingItems.length > 0) {
      const currentSubtotal = getValues("pricing.subtotal");
      const currentTotal = getValues("pricing.total");
      if (currentSubtotal !== subtotal) {
        setValue("pricing.subtotal", subtotal, { shouldDirty: false });
      }
      if (currentTotal !== calculatedTotal) {
        setValue("pricing.total", calculatedTotal, { shouldDirty: false });
      }
    }
  }, [subtotal, calculatedTotal, pricingItems, setValue, getValues]);

  const handleAddItem = useCallback(() => {
    clearErrors("pricing");
    if (fields.length === 0) {
      const defaultPeriod = 30;
      setValidityPeriod(defaultPeriod);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + defaultPeriod);
      expiryDate.setHours(23, 59, 59, 999);
      setValue("pricing.expiresAt", expiryDate);
      setValue("pricing.status", "DRAFT");
      setValue("pricing.discountType", DISCOUNT_TYPE.NONE);
      setValue("pricing.discountValue", null);
      setValue("pricing.subtotal", 0);
      setValue("pricing.total", 0);
    }
    // Append adds to the end, so new item appears right above the button
    append({ description: "", observation: null, amount: undefined });
    // Focus the new item (last one in the list)
    setTimeout(() => {
      if (lastRowRef.current) {
        const combobox = lastRowRef.current.querySelector('[role="combobox"]') as HTMLElement;
        combobox?.focus();
      }
    }, 100);
  }, [append, clearErrors, fields.length, setValue]);

  const clearAll = useCallback(() => {
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    setValue("pricing", undefined);
    clearErrors("pricing");
    setValidityPeriod(null);
    setShowCustomPayment(false);
    setShowCustomGuarantee(false);
    setLayoutFiles([]);
  }, [fields.length, remove, setValue, clearErrors]);

  useImperativeHandle(ref, () => ({ addItem: handleAddItem, clearAll }), [handleAddItem, clearAll]);

  const canEditStatus = userRole === 'ADMIN' || userRole === 'FINANCIAL' || userRole === 'COMMERCIAL';

  const statusOptions = [
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'Aprovado', value: 'APPROVED' },
    { label: 'Rejeitado', value: 'REJECTED' },
    { label: 'Cancelado', value: 'CANCELLED' },
  ];

  const validityPeriodOptions = [
    { label: '15 dias', value: '15' },
    { label: '30 dias', value: '30' },
    { label: '60 dias', value: '60' },
    { label: '90 dias', value: '90' },
  ];

  const handleValidityPeriodChange = useCallback((period: string) => {
    const days = Number(period);
    setValidityPeriod(days);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    expiryDate.setHours(23, 59, 59, 999);
    setValue("pricing.expiresAt", expiryDate);
  }, [setValue]);

  useEffect(() => {
    if (!pricingExpiresAt || validityPeriod !== null) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(pricingExpiresAt);
    expiryDate.setHours(0, 0, 0, 0);
    const diffInMs = expiryDate.getTime() - now.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
    const periods = [15, 30, 60, 90];
    for (const period of periods) {
      if (Math.abs(diffInDays - period) <= 1) {
        setValidityPeriod(period);
        break;
      }
    }
  }, [pricingExpiresAt, validityPeriod]);

  const handlePaymentConditionChange = useCallback((value: string) => {
    if (value === "CUSTOM") {
      setShowCustomPayment(true);
      setValue("pricing.paymentCondition", "CUSTOM");
    } else {
      setShowCustomPayment(false);
      setValue("pricing.customPaymentText", null);
      setValue("pricing.paymentCondition", value);
    }
  }, [setValue]);

  const handleGuaranteeOptionChange = useCallback((value: string) => {
    if (value === "CUSTOM") {
      setShowCustomGuarantee(true);
      setValue("pricing.guaranteeYears", null);
    } else {
      setShowCustomGuarantee(false);
      setValue("pricing.customGuaranteeText", null);
      setValue("pricing.guaranteeYears", value ? Number(value) : null);
    }
  }, [setValue]);

  const hasPricingItems = pricingItems && pricingItems.length > 0;

  // Handler to remove an item and track deletion
  const handleRemoveItem = useCallback((index: number) => {
    const item = pricingItems?.[index];
    if (item?.description && onItemDeleted) {
      onItemDeleted(item.description);
    }
    remove(index);
  }, [pricingItems, onItemDeleted, remove]);

  return (
    <div className="space-y-4">
      {/* Pricing Items - displayed in order, newest at bottom */}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <PricingItemRow
              key={field.id}
              control={control}
              index={index}
              disabled={disabled}
              readOnly={readOnly}
              onRemove={() => handleRemoveItem(index)}
              isFirstRow={index === 0}
              isLastRow={index === fields.length - 1}
              ref={index === fields.length - 1 ? lastRowRef : null}
            />
          ))}
        </div>
      )}

      {/* Add Service Button - Always at bottom, new items appear above */}
      {!readOnly && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>
      )}

      {/* Spacing between items and configuration sections */}
      {hasPricingItems && (
        <div className="h-4" />
      )}

      {/* Discount Section - Right after services */}
      {hasPricingItems && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="pricing.discountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Desconto</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || DISCOUNT_TYPE.NONE}
                    onValueChange={(newType) => {
                      const safeType = newType || DISCOUNT_TYPE.NONE;
                      const previousType = field.value || DISCOUNT_TYPE.NONE;
                      field.onChange(safeType);
                      if (safeType === DISCOUNT_TYPE.NONE) {
                        setValue("pricing.discountValue", null);
                      } else if (previousType !== safeType && previousType !== DISCOUNT_TYPE.NONE) {
                        setValue("pricing.discountValue", null);
                      }
                    }}
                    disabled={disabled || readOnly}
                    options={[
                      DISCOUNT_TYPE.NONE,
                      DISCOUNT_TYPE.PERCENTAGE,
                      DISCOUNT_TYPE.FIXED_VALUE,
                    ].map((type) => ({
                      value: type,
                      label: DISCOUNT_TYPE_LABELS[type],
                    }))}
                    placeholder="Selecione o tipo"
                    emptyMessage="Nenhum tipo encontrado"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="pricing.discountValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Valor do Desconto
                  {discountType === DISCOUNT_TYPE.PERCENTAGE && (
                    <span className="text-xs text-muted-foreground">(%)</span>
                  )}
                  {discountType === DISCOUNT_TYPE.FIXED_VALUE && (
                    <span className="text-xs text-muted-foreground">(R$)</span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type={discountType === DISCOUNT_TYPE.FIXED_VALUE ? "currency" : "number"}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(value) => {
                      if (value === null || value === undefined || value === "") {
                        field.onChange(null);
                      } else if (typeof value === "number") {
                        field.onChange(value);
                      } else {
                        const num = Number(value);
                        field.onChange(isNaN(num) ? null : num);
                      }
                    }}
                    disabled={disabled || readOnly || discountType === DISCOUNT_TYPE.NONE}
                    placeholder={discountType === DISCOUNT_TYPE.NONE ? "-" : discountType === DISCOUNT_TYPE.FIXED_VALUE ? "R$ 0,00" : "0"}
                    min={discountType === DISCOUNT_TYPE.PERCENTAGE ? "0" : undefined}
                    max={discountType === DISCOUNT_TYPE.PERCENTAGE ? "100" : undefined}
                    step={discountType === DISCOUNT_TYPE.PERCENTAGE ? "0.01" : undefined}
                    className="bg-transparent"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Totals Section - Right after discount */}
      {hasPricingItems && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconCurrencyReal className="h-4 w-4" />
              Subtotal
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(subtotal)}
                readOnly
                className="bg-muted cursor-not-allowed font-medium"
              />
            </FormControl>
          </FormItem>

          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconCurrencyReal className="h-4 w-4" />
              Valor Total
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(calculatedTotal)}
                readOnly
                className="bg-transparent font-bold text-lg text-primary cursor-not-allowed border-primary"
              />
            </FormControl>
          </FormItem>
        </div>
      )}

      {/* Spacing between totals and status */}
      {hasPricingItems && <div className="h-4" />}

      {/* Status and Validity Period */}
      {hasPricingItems && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="pricing.status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status da Precificação</FormLabel>
                <FormControl>
                  <Combobox
                    options={statusOptions}
                    value={field.value || 'DRAFT'}
                    onValueChange={field.onChange}
                    placeholder="Selecione o status"
                    emptyMessage="Nenhum status encontrado"
                    disabled={disabled || !canEditStatus || readOnly}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="pricing.expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Validade da Proposta
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={validityPeriod?.toString() || ""}
                    onValueChange={handleValidityPeriodChange}
                    options={validityPeriodOptions}
                    placeholder="Selecione o período"
                    emptyMessage="Nenhum período encontrado"
                    disabled={disabled || readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Payment, Date, Guarantee, and Validity - 6 column grid (2/6, 1/6, 2/6, 1/6) */}
      {hasPricingItems && (
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          {/* Payment Condition - 2/6 */}
          <FormItem className="sm:col-span-2">
            <FormLabel>Condição de Pagamento</FormLabel>
            <FormControl>
              <Combobox
                value={currentPaymentCondition}
                onValueChange={handlePaymentConditionChange}
                disabled={disabled || readOnly}
                options={PAYMENT_CONDITIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                placeholder="Selecione"
                emptyMessage="Nenhuma opção"
              />
            </FormControl>
          </FormItem>

          {/* Down Payment Date - 1/6 */}
          <FormField
            control={control}
            name="pricing.downPaymentDate"
            render={({ field }) => (
              <DateTimeInput
                field={field}
                mode="date"
                label="Data da Entrada"
                disabled={disabled || readOnly}
              />
            )}
          />

          {/* Guarantee - 2/6 */}
          <FormItem className="sm:col-span-2">
            <FormLabel>Período de Garantia</FormLabel>
            <FormControl>
              <Combobox
                value={currentGuaranteeOption}
                onValueChange={handleGuaranteeOptionChange}
                disabled={disabled || readOnly}
                options={GUARANTEE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                placeholder="Selecione"
                emptyMessage="Nenhuma opção"
              />
            </FormControl>
          </FormItem>

          {/* Custom Delivery Days - 1/6 */}
          <FormField
            control={control}
            name="pricing.customForecastDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prazo Entrega</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                    disabled={disabled || readOnly}
                    options={VALIDITY_DAYS_OPTIONS}
                    placeholder="Auto"
                    emptyMessage="Nenhuma opção"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Custom Payment Text */}
      {hasPricingItems && showCustomPayment && (
        <FormField
          control={control}
          name="pricing.customPaymentText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto Personalizado de Pagamento</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Descreva as condições de pagamento personalizadas..."
                  disabled={disabled || readOnly}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Custom Guarantee Text */}
      {hasPricingItems && showCustomGuarantee && (
        <FormField
          control={control}
          name="pricing.customGuaranteeText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto Personalizado de Garantia</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Descreva as condições de garantia personalizadas..."
                  disabled={disabled || readOnly}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Spacing before layout */}
      {hasPricingItems && <div className="h-4" />}

      {/* Layout File Upload */}
      {hasPricingItems && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <IconPhoto className="h-4 w-4" />
            Layout Aprovado
          </h4>
          <FileUploadField
            onFilesChange={handleLayoutFileChange}
            existingFiles={layoutFiles}
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            acceptedFileTypes={{
              "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
            }}
            disabled={disabled || readOnly}
            variant="compact"
            placeholder="Arraste ou clique para selecionar o layout"
            showPreview={true}
          />
        </div>
      )}

      {/* Validation Alert */}
      {hasIncompletePricing && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns serviços da precificação estão incompletos. Selecione o serviço e preencha o valor antes de enviar o formulário.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

PricingSelector.displayName = "PricingSelector";

// Pricing Item Row Component with Observation Support
interface PricingItemRowProps {
  control: any;
  index: number;
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
}

const PricingItemRow = forwardRef<HTMLDivElement, PricingItemRowProps>(
  ({ control, index, disabled, readOnly, onRemove, isFirstRow, isLastRow }, ref) => {
    // Observation modal state
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [tempObservation, setTempObservation] = useState("");

    // Watch observation field
    const currentObservation = useWatch({
      control,
      name: `pricing.items.${index}.observation`,
      defaultValue: "",
    });

    // Get observation field controller for updating
    const { field: observationField } = useController({
      control,
      name: `pricing.items.${index}.observation`,
      defaultValue: "",
    });

    // Handle opening observation modal
    const handleOpenObservationModal = () => {
      setTempObservation(currentObservation || "");
      setIsObservationModalOpen(true);
    };

    // Handle saving observation
    const handleSaveObservation = () => {
      observationField.onChange(tempObservation || null);
      setIsObservationModalOpen(false);
    };

    // Handle canceling observation modal
    const handleCancelObservation = () => {
      setTempObservation("");
      setIsObservationModalOpen(false);
    };

    // Check if observation has content
    const hasObservation = Boolean(currentObservation && currentObservation.trim());

    return (
      <>
        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end"
        >
          {/* Service Description - 1/2 width */}
          <ServiceAutocomplete
            control={control}
            name={`pricing.items.${index}.description`}
            disabled={disabled || readOnly}
            label="Serviço"
            placeholder="Selecione ou digite um serviço"
            showLabel={isFirstRow}
            type={SERVICE_ORDER_TYPE.PRODUCTION}
          />

          {/* Value + Buttons - 1/2 width */}
          <div className="flex items-end gap-2">
            <FormField
              control={control}
              name={`pricing.items.${index}.amount`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  {isFirstRow && (
                    <FormLabel className="flex items-center gap-2">
                      <IconCurrencyReal className="h-4 w-4" />
                      Valor
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      type="currency"
                      {...field}
                      placeholder="R$ 0,00"
                      disabled={disabled || readOnly}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Observation Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleOpenObservationModal}
                disabled={disabled || readOnly}
                className="relative h-9 w-9"
                title={hasObservation ? "Ver/Editar observação" : "Adicionar observação"}
              >
                <IconNote className="h-4 w-4" />
                {hasObservation && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    !
                  </span>
                )}
              </Button>

              {/* Remove Button */}
              {!readOnly && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  disabled={disabled}
                  className="text-destructive h-9 w-9"
                  title="Remover serviço"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              )}

            </div>
          </div>
        </div>

        {/* Observation Modal */}
        <Dialog open={isObservationModalOpen} onOpenChange={setIsObservationModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Observação do Serviço</DialogTitle>
              <DialogDescription>
                Adicione notas ou detalhes adicionais para este serviço da precificação.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={tempObservation}
                onChange={(e) => setTempObservation(e.target.value)}
                placeholder="Digite a observação..."
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelObservation}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveObservation}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

PricingItemRow.displayName = "PricingItemRow";
