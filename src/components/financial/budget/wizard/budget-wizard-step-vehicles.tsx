/**
 * ② VEÍCULOS — a identificação de cada implemento e o que é dele.
 *
 * Decisão do dono (02/10/2026): série, placa, chassi, nº do pedido, previsão,
 * categoria, tipo e as medidas do implemento no desenho estilizado do formulário
 * da tarefa. E a ARTE de cada veículo, que mora no implemento (Modelo C).
 *
 * CRIAÇÃO: os veículos ainda não existem — séries × placas dizem quantos vão
 *   nascer, e categoria, tipo, pedido, previsão e medidas valem para todos.
 * DETALHE: um cartão por veículo, com os campos dele e o painel da arte.
 *   Categoria, tipo e medidas são COMUNS (mesmo orçamento, mesmo implemento; a
 *   API replica as medidas aos irmãos).
 *
 * O Nº DO PEDIDO segue a DD12.1: um pedido por orçamento — os veículos sem
 * número herdam o único registrado. A tela diz qual é e quem herda.
 */
import { useMemo, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  IconAlertTriangle,
  IconBox,
  IconChevronDown,
  IconCopy,
  IconHash,
  IconId,
  IconInfoCircle,
  IconRuler,
  IconTruck,
} from "@tabler/icons-react";

import {
  IMPLEMENT_CATEGORY,
  IMPLEMENT_CATEGORY_LABELS,
  IMPLEMENT_TYPE,
  IMPLEMENT_TYPE_LABELS,
  SECTOR_PRIVILEGES,
} from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import type { ImplementFace } from "@/constants/implement-faces";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { PlateTagsInput } from "@/components/production/task/form/plate-tags-input";
import { SerialNumberRangeInput } from "@/components/production/task/form/serial-number-range-input";
import { ImplementMeasuresEditor } from "@/components/production/implement-measure/implement-measures-editor";
import { ImplementArtPanel } from "@/components/production/implement-art/implement-art-panel";
import { cn } from "@/lib/utils";
import { orderNumberInheritance } from "@/utils/budget-order-number";
import { implementArtStateOf, type ImplementArtState } from "@/utils/implement-art";
import type { MeasureLayout } from "@/utils/implement-measures";
import type { ImplementArtVehicle } from "@/components/production/implement-art/vehicles-art-section";
import { LAYOUT_STATUS_LABELS_FROM_CONTRACT } from "@/constants/budget-contract";
import { LAYOUT_STATUS } from "@/constants/enums";
import { WizardSection } from "./wizard-section";

/** Âncora do quadro da arte — o atalho "arte pendente" da faixa leva até ela. */
export const BUDGET_VEHICLES_ART_ANCHOR = "arte-do-implemento";

export type BudgetVehicleApplyField = "customerOrderNumber" | "forecastDate";

export interface BudgetMeasuresState {
  layouts: Partial<Record<ImplementFace, MeasureLayout | null>>;
  modifiedSides: ReadonlySet<ImplementFace>;
  savedSides?: ReadonlySet<ImplementFace>;
  onSideChange: (side: ImplementFace, layout: MeasureLayout) => void;
  error: string | null;
}

export interface BudgetVehicleCard {
  taskId: string;
  label: string;
  /** A placa, quando o rótulo é a série. */
  detail: string | null;
  dirty: boolean;
  art: ImplementArtVehicle;
}

interface BudgetWizardStepVehiclesProps {
  disabled?: boolean;
  mode: "create" | "edit";
  measures: BudgetMeasuresState;
  /** Quem grava medidas (ADMIN, COMERCIAL, LOGÍSTICA). */
  canEditMeasures: boolean;

  // ── DETALHE ───────────────────────────────────────────────────────────────
  vehicles?: BudgetVehicleCard[];
  openVehicleId?: string | null;
  onOpenVehicleChange?: (taskId: string | null) => void;
  vinPlateFilesByTask?: Record<string, FileWithPreview[]>;
  onVinPlateFilesChange?: (taskId: string, files: FileWithPreview[]) => void;
  onApplyToOtherVehicles?: (field: BudgetVehicleApplyField, fromIndex: number) => void;
}

const ART_STATE_LABEL: Record<ImplementArtState, string> = {
  APPROVED: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.APPROVED],
  PENDING_APPROVAL: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.PENDING_APPROVAL],
  DRAFT: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.DRAFT],
  REPROVED: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.REPROVED],
  NONE: "Sem arte",
};

const ART_STATE_VARIANT: Record<ImplementArtState, string> = {
  APPROVED: "completed",
  PENDING_APPROVAL: "teal",
  DRAFT: "secondary",
  REPROVED: "cancelled",
  NONE: "outline",
};

export function BudgetWizardStepVehicles({
  disabled,
  mode,
  measures,
  canEditMeasures,
  vehicles = [],
  openVehicleId,
  onOpenVehicleChange,
  vinPlateFilesByTask = {},
  onVinPlateFilesChange,
  onApplyToOtherVehicles,
}: BudgetWizardStepVehiclesProps) {
  const { user } = useAuth();
  const { control } = useFormContext();
  const privileges = user?.sector?.privileges;
  // Prazo de Entrega (`term`) — só PRODUCTION_MANAGER/ADMIN gravam (domínio do
  // campo na API). Aberto para o comercial, ele derrubaria o salvamento inteiro.
  const canEditTerm = privileges === SECTOR_PRIVILEGES.ADMIN || privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;

  const plates = (useWatch({ control, name: "plates" }) as string[] | undefined) ?? [];
  const serialNumbers = (useWatch({ control, name: "serialNumbers" }) as unknown[] | undefined) ?? [];
  const watchedVehicles =
    (useWatch({ control, name: "vehicles" }) as Array<{ customerOrderNumber?: string | null }> | undefined) ?? [];

  const createCount = useMemo(() => {
    if (plates.length > 0 && serialNumbers.length > 0) return plates.length * serialNumbers.length;
    return Math.max(plates.length, serialNumbers.length, 1);
  }, [plates.length, serialNumbers.length]);

  // DD12.1 — o pedido do orçamento e quem o herda.
  const orderNumbers = useMemo(
    () => orderNumberInheritance(vehicles.map((_, index) => watchedVehicles[index] ?? null)),
    [vehicles, watchedVehicles],
  );

  const commonFields = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="category"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="flex items-center gap-2">
              <IconTruck className="h-4 w-4" />
              Categoria do Implemento
            </FormLabel>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={[
                { value: "", label: "Nenhuma" },
                ...Object.values(IMPLEMENT_CATEGORY).map((value) => ({ value, label: IMPLEMENT_CATEGORY_LABELS[value] })),
              ]}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar categoria..."
              emptyText="Nenhuma categoria encontrada"
              disabled={disabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="implementType"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="flex items-center gap-2">
              <IconBox className="h-4 w-4" />
              Tipo de Implemento
            </FormLabel>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={[
                { value: "", label: "Nenhum" },
                ...Object.values(IMPLEMENT_TYPE).map((value) => ({ value, label: IMPLEMENT_TYPE_LABELS[value] })),
              ]}
              placeholder="Selecione o tipo de implemento"
              searchPlaceholder="Buscar tipo de implemento..."
              emptyText="Nenhum tipo de implemento encontrado"
              disabled={disabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const measuresSection = (
    <WizardSection
      icon={<IconRuler className="h-5 w-5" />}
      title="Medidas do implemento"
      description={
        mode === "edit" && vehicles.length > 1
          ? `Comuns aos ${vehicles.length} veículos: mesmo orçamento, mesmo implemento — gravadas em todos.`
          : mode === "create" && createCount > 1
            ? `Valem para os ${createCount} veículos que vão nascer.`
            : undefined
      }
    >
      <ImplementMeasuresEditor
        layouts={measures.layouts}
        modifiedSides={measures.modifiedSides}
        savedSides={measures.savedSides}
        onSideChange={measures.onSideChange}
        validationError={measures.error}
        disabled={disabled || !canEditMeasures}
      />
    </WizardSection>
  );

  if (mode === "create") {
    return (
      <div className="space-y-4">
        <WizardSection icon={<IconTruck className="h-5 w-5" />} title="Veículos">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SerialNumberRangeInput control={control} disabled={disabled || plates.length > 1} />
            <PlateTagsInput control={control} disabled={disabled || serialNumbers.length > 1} />
            <FormField
              control={control}
              name="customerOrderNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconHash className="h-4 w-4" />
                    N° do Pedido
                    {createCount > 1 && (
                      <span className="text-xs font-normal text-muted-foreground">(um pedido para os {createCount})</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(value) => field.onChange(value === null || value === "" ? null : String(value))}
                      placeholder="Ex: 12345"
                      maxLength={100}
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {createCount > 1 && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
              <IconInfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{createCount} veículos serão criados</p>
                {plates.length > 0 && serialNumbers.length > 0 && (
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                    {plates.length} {plates.length === 1 ? "placa" : "placas"} × {serialNumbers.length}{" "}
                    {serialNumbers.length === 1 ? "número de série" : "números de série"}
                  </p>
                )}
              </div>
            </div>
          )}

          {commonFields}

          <div className={cn("grid grid-cols-1 gap-4", canEditTerm && "md:grid-cols-2")}>
            <FormField
              control={control}
              name="forecastDate"
              render={({ field }) => (
                <DateTimeInput
                  {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                  mode="datetime"
                  label="Data de Previsão de Liberação"
                  disabled={disabled}
                />
              )}
            />
            {canEditTerm && (
              <FormField
                control={control}
                name="term"
                render={({ field }) => (
                  <DateTimeInput
                    {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                    mode="datetime"
                    label="Prazo de Entrega"
                    disabled={disabled}
                  />
                )}
              />
            )}
          </div>
        </WizardSection>
        {measuresSection}
      </div>
    );
  }

  const multi = vehicles.length > 1;

  return (
    <div className="space-y-4">
      <WizardSection
        icon={<IconTruck className="h-5 w-5" />}
        title={multi ? "Comum a todos os veículos" : "Implemento"}
      >
        {commonFields}
      </WizardSection>

      {measuresSection}

      <WizardSection
        id={BUDGET_VEHICLES_ART_ANCHOR}
        icon={<IconId className="h-5 w-5" />}
        title={multi ? `Veículos (${vehicles.length})` : "Veículo"}
        description="Identificação, pedido, previsão e a arte de cada implemento."
      >
        <OrderNumberBanner
          inherited={orderNumbers.inherited}
          registered={orderNumbers.registered}
          missing={orderNumbers.missing}
          total={vehicles.length}
        />

        <div className="divide-y divide-border rounded-lg border border-border">
          {vehicles.map((vehicle, index) => (
            <VehicleCard
              key={vehicle.taskId}
              vehicle={vehicle}
              index={index}
              open={!multi || openVehicleId === vehicle.taskId}
              collapsible={multi}
              onOpenChange={(open) => onOpenVehicleChange?.(open ? vehicle.taskId : null)}
              disabled={disabled}
              canEditTerm={canEditTerm}
              inheritedOrderNumber={orderNumbers.inherited}
              vinPlateFiles={vinPlateFilesByTask[vehicle.taskId] ?? []}
              onVinPlateFilesChange={onVinPlateFilesChange ? (files) => onVinPlateFilesChange(vehicle.taskId, files) : undefined}
              onApply={multi && onApplyToOtherVehicles && !disabled ? (field) => onApplyToOtherVehicles(field, index) : undefined}
            />
          ))}
        </div>
      </WizardSection>
    </div>
  );
}

function OrderNumberBanner({
  inherited,
  registered,
  missing,
  total,
}: {
  inherited: string | null;
  registered: string[];
  missing: number;
  total: number;
}) {
  let text: ReactNode;
  let warn = false;
  if (registered.length === 0) {
    text = total > 1 ? "Nenhum veículo tem nº do pedido ainda. O pedido é um só para o orçamento." : "Sem nº do pedido.";
  } else if (inherited) {
    text =
      missing > 0 ? (
        <>
          Pedido do orçamento: <span className="font-semibold">{inherited}</span>. Os {missing}{" "}
          {missing === 1 ? "veículo sem número herda" : "veículos sem número herdam"} este pedido.
        </>
      ) : (
        <>
          Pedido do orçamento: <span className="font-semibold">{inherited}</span>.
        </>
      );
  } else {
    warn = true;
    text = (
      <>
        Os veículos têm pedidos diferentes ({registered.join(", ")}). O pedido é um só por orçamento: sem um número
        único, quem assina por Compras terá de informá-lo para os veículos em branco.
      </>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        warn
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      {warn ? (
        <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      ) : (
        <IconHash className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p>{text}</p>
    </div>
  );
}

function VehicleCard({
  vehicle,
  index,
  open,
  collapsible,
  onOpenChange,
  disabled,
  canEditTerm,
  inheritedOrderNumber,
  vinPlateFiles,
  onVinPlateFilesChange,
  onApply,
}: {
  vehicle: BudgetVehicleCard;
  index: number;
  open: boolean;
  collapsible: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  canEditTerm: boolean;
  inheritedOrderNumber: string | null;
  vinPlateFiles: FileWithPreview[];
  onVinPlateFilesChange?: (files: FileWithPreview[]) => void;
  onApply?: (field: BudgetVehicleApplyField) => void;
}) {
  const { control } = useFormContext();
  const artState = implementArtStateOf(vehicle.art);
  const f = (field: string) => `vehicles.${index}.${field}`;
  const orderNumber = useWatch({ control, name: f("customerOrderNumber") }) as string | null | undefined;
  const applyButton = (field: BudgetVehicleApplyField, label: string) =>
    onApply ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-my-1 h-5 gap-1 px-1.5 text-xs font-normal text-muted-foreground"
        onClick={() => onApply(field)}
      >
        <IconCopy className="h-3 w-3" />
        {label}
      </Button>
    ) : null;

  const fields = (
    <div className="space-y-4 px-3 pb-4 pt-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <FormField
          control={control}
          name={f("serialNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconHash className="h-4 w-4" />
                Número de Série
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value ?? "")}
                  placeholder="Ex: 39088"
                  disabled={disabled}
                  className="bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("plate")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconTruck className="h-4 w-4" />
                Placa
              </FormLabel>
              <FormControl>
                {/* Guarda a placa LIMPA em maiúsculas (ABC1234), como o formulário de Tarefa. */}
                <Input
                  type="plate"
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value ? String(value) : "")}
                  disabled={disabled}
                  className="bg-transparent uppercase"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("chassisNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconId className="h-4 w-4" />
                Chassi
              </FormLabel>
              <FormControl>
                <Input
                  type="chassis"
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value ? String(value) : "")}
                  disabled={disabled}
                  className="bg-transparent font-mono uppercase"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("customerOrderNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <IconHash className="h-4 w-4" />
                N° do Pedido
                {applyButton("customerOrderNumber", "Repetir")}
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value === null || value === "" ? null : String(value))}
                  placeholder={inheritedOrderNumber ? `Herda ${inheritedOrderNumber}` : "Ex: 12345"}
                  maxLength={100}
                  disabled={disabled}
                  className="bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {onVinPlateFilesChange && (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconId className="h-4 w-4" />
              Plaqueta
            </FormLabel>
            <FormControl>
              <FileUploadField
                onFilesChange={onVinPlateFilesChange}
                maxFiles={1}
                maxSize={20 * 1024 * 1024}
                disabled={disabled}
                showPreview={true}
                existingFiles={vinPlateFiles}
                variant="inline"
                placeholder="Fotografe ou anexe a plaqueta"
                label="Foto da plaqueta"
                acceptedFileTypes={{ "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"] }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      </div>

      <div className={cn("grid grid-cols-1 gap-4", canEditTerm && "md:grid-cols-2")}>
        <div className="space-y-1">
          <FormField
            control={control}
            name={f("forecastDate")}
            render={({ field }) => (
              <DateTimeInput
                {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                mode="datetime"
                label="Data de Previsão de Liberação"
                disabled={disabled}
              />
            )}
          />
          {applyButton("forecastDate", "Aplicar esta previsão aos demais veículos")}
        </div>
        {canEditTerm && (
          <FormField
            control={control}
            name={f("term")}
            render={({ field }) => (
              <DateTimeInput
                {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                mode="datetime"
                label="Prazo de Entrega"
                disabled={disabled}
              />
            )}
          />
        )}
      </div>

      <ImplementArtPanel
        implementId={vehicle.art.implement?.id}
        vehicleLabel={vehicle.label}
        className="rounded-lg border border-border p-3"
      />
    </div>
  );

  if (!collapsible) return fields;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {vehicle.label}
            {vehicle.dirty && <span className="ml-2 text-xs font-normal text-amber-600">alterado</span>}
          </span>
          {(vehicle.detail || orderNumber) && (
            <span className="block truncate text-xs text-muted-foreground">
              {[vehicle.detail, orderNumber ? `Pedido ${orderNumber}` : null].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        <Badge variant={ART_STATE_VARIANT[artState] as any} className="shrink-0">
          Arte: {ART_STATE_LABEL[artState]}
        </Badge>
        <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>{fields}</CollapsibleContent>
    </Collapsible>
  );
}
