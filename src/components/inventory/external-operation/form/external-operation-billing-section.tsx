import { IconCurrencyReal, IconFileInvoice, IconGripVertical, IconLock, IconPlus, IconReceipt, IconTrash, IconUserDollar } from "@tabler/icons-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomerCombobox } from "@/components/ui/customer-combobox";
import { PaymentConfigField } from "@/components/financial/payment-config-field";
import { formatCurrency } from "../../../../utils";
import type { PaymentConfig } from "@/schemas/task-quote";
import type { Customer } from "@/types/customer";

export interface BillingServiceRow {
  id?: string;
  description: string;
  amount: number;
  /**
   * Client-only stable key for rows that haven't been persisted yet, so drag-to-reorder
   * and React keys survive edits. Stripped by the submit mappers in the create/edit forms.
   */
  _uid?: string;
}

/** Monotonic counter backing `_uid` — only ever compared for equality. */
let newServiceRowSeq = 0;

/** Leading 24px column is the drag handle (empty on the header row). */
const SERVICE_ROW_GRID = "grid-cols-[24px_minmax(150px,1fr)_200px_36px]";

interface ExternalOperationBillingSectionProps {
  customerId: string | null;
  onCustomerIdChange: (customerId: string | null) => void;
  initialCustomer?: Customer | null;
  generateInvoice: boolean;
  onGenerateInvoiceChange: (value: boolean) => void;
  generateBankSlip: boolean;
  onGenerateBankSlipChange: (value: boolean) => void;
  paymentConfig: PaymentConfig | null;
  onPaymentConfigChange: (config: PaymentConfig | null) => void;
  services: BillingServiceRow[];
  onServicesChange: (services: BillingServiceRow[]) => void;
  /** Service mode: at least one service row is required */
  servicesRequired?: boolean;
  disabled?: boolean;
  /** Note shown when the section is locked (status !== PENDING) */
  disabledReason?: string;
}

/**
 * Billing configuration section for CHARGEABLE external withdrawals:
 * customer selector, NFS-e / boleto switches, payment condition and the
 * ad-hoc services editor (description + amount rows).
 */
export function ExternalOperationBillingSection({
  customerId,
  onCustomerIdChange,
  initialCustomer,
  generateInvoice,
  onGenerateInvoiceChange,
  generateBankSlip,
  onGenerateBankSlipChange,
  paymentConfig,
  onPaymentConfigChange,
  services,
  onServicesChange,
  servicesRequired = false,
  disabled = false,
  disabledReason,
}: ExternalOperationBillingSectionProps) {
  const servicesTotal = services.reduce((sum, service) => sum + (Number(service.amount) || 0), 0);

  const handleServiceChange = (index: number, patch: Partial<BillingServiceRow>) => {
    onServicesChange(services.map((service, i) => (i === index ? { ...service, ...patch } : service)));
  };

  const handleAddService = () => {
    onServicesChange([...services, { description: "", amount: 0, _uid: `new-${++newServiceRowSeq}` }]);
  };

  const handleRemoveService = (index: number) => {
    onServicesChange(services.filter((_, i) => i !== index));
  };

  // Stable per-row drag id: persisted rows use their uuid, new rows their `_uid`.
  const rowIds = services.map((service, index) => service.id ?? service._uid ?? `row-${index}`);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Array order is the persisted order — the submit mappers stamp `position` from the index.
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const oldIndex = rowIds.indexOf(String(active.id));
    const newIndex = rowIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onServicesChange(arrayMove(services, oldIndex, newIndex));
  };

  return (
    <div className="space-y-6">
      {/* Billing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUserDollar className="h-5 w-5" />
            Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {disabled && disabledReason && (
            <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
              <IconLock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{disabledReason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <CustomerCombobox
                value={customerId}
                onValueChange={onCustomerIdChange}
                initialCustomer={initialCustomer ?? undefined}
                disabled={disabled}
                placeholder="Selecione o cliente"
              />
              <p className="text-xs text-muted-foreground">Necessário para emitir NFS-e e boletos</p>
            </div>

            {/* Payment condition */}
            <PaymentConfigField
              paymentConfig={paymentConfig}
              onChange={(config) => {
                onPaymentConfigChange(config);
                // Pix settles directly (no boleto to emit); Boleto/Parcelado flip
                // generation back on — every direction stays in sync with the method.
                if (config?.type === "CASH") {
                  onGenerateBankSlipChange(config.method !== "PIX");
                } else if (config?.type === "INSTALLMENTS") {
                  onGenerateBankSlipChange(true);
                }
              }}
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NFS-e switch */}
            <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-3">
              <Label htmlFor="generate-invoice-switch" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                Emitir NFS-e
              </Label>
              <Switch id="generate-invoice-switch" checked={generateInvoice} onCheckedChange={onGenerateInvoiceChange} disabled={disabled} />
            </div>

            {/* Boleto switch */}
            <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-3">
              <Label htmlFor="generate-bank-slip-switch" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <IconReceipt className="h-4 w-4 text-muted-foreground" />
                Gerar Boleto
              </Label>
              <Switch id="generate-bank-slip-switch" checked={generateBankSlip} onCheckedChange={onGenerateBankSlipChange} disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyReal className="h-5 w-5" />
            Serviços
            {servicesRequired && <span className="text-destructive">*</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.length > 0 && (
            <div className={`grid ${SERVICE_ROW_GRID} gap-2 text-xs font-semibold text-muted-foreground uppercase`}>
              <span />
              <span className="px-2">Descrição</span>
              <span className="px-2">Valor</span>
              <span />
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {services.map((service, index) => (
                <SortableServiceRow
                  key={rowIds[index]}
                  id={rowIds[index]}
                  service={service}
                  disabled={disabled}
                  onDescriptionChange={(value) => handleServiceChange(index, { description: value })}
                  onAmountChange={(value) => handleServiceChange(index, { amount: value })}
                  onRemove={() => handleRemoveService(index)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {servicesRequired
                ? "Adicione pelo menos um serviço com descrição e valor."
                : "Nenhum serviço adicionado. Operações cobráveis podem ter itens, serviços ou ambos."}
            </p>
          )}

          {!disabled && (
            <Button type="button" variant="outline" size="sm" onClick={handleAddService} className="w-full">
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </Button>
          )}

          {services.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
              <span className="text-muted-foreground">Total de serviços</span>
              <span className="font-semibold">{formatCurrency(servicesTotal)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableServiceRowProps {
  id: string;
  service: BillingServiceRow;
  disabled?: boolean;
  onDescriptionChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onRemove: () => void;
}

function SortableServiceRow({ id, service, disabled, onDescriptionChange, onAmountChange, onRemove }: SortableServiceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`grid ${SERVICE_ROW_GRID} gap-2 items-center`}>
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={`flex items-center justify-center ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      >
        <IconGripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <Input
        value={service.description}
        onChange={(value: string | number | null) => onDescriptionChange(typeof value === "string" ? value : String(value ?? ""))}
        placeholder="Descrição do serviço"
        disabled={disabled}
        maxLength={500}
        className="h-9"
      />
      <Input
        type="currency"
        value={service.amount || 0}
        onChange={(val: any) => onAmountChange(Number(val) || 0)}
        disabled={disabled}
        className="h-9"
      />
      {!disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
