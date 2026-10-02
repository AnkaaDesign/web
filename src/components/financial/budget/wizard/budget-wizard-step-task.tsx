/**
 * ① TAREFA — o que identifica o trabalho e vale para o orçamento inteiro.
 *
 * Decisão do dono (02/10/2026), nesta ordem: logomarca, Razão Social (o cliente
 * dono do veículo), detalhes, os prazos da proposta (validade, garantia, prazo de
 * entrega, tarefas simultâneas), responsáveis, tintas, arquivos base, layout e
 * aerografia. A identificação de cada veículo (série, placa, chassi, pedido,
 * previsão, medidas) é o passo seguinte.
 *
 * Num orçamento de N veículos, DETALHES, TINTA e AEROGRAFIA continuam sendo de
 * cada implemento (decisão de 23/09, caso Carlotti nº 990): as abas no topo
 * escolhem de qual veículo essas seções falam, e o título de cada uma diz isso.
 */
import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  IconAlertTriangle,
  IconCalendarTime,
  IconClipboardList,
  IconCopy,
  IconFileText,
  IconNotes,
  IconPalette,
  IconPhoto,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { canViewAirbrushingFinancials } from "@/utils/permissions/entity-permissions";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerSelector } from "@/components/production/task/form/customer-selector";
import { TaskNameAutocomplete } from "@/components/production/task/form/task-name-autocomplete";
import { GeneralPaintingSelector } from "@/components/production/task/form/general-painting-selector";
import { MultiAirbrushingSelector } from "@/components/production/task/form/multi-airbrushing-selector";
import { ResponsibleManager } from "@/components/administration/customer/responsible";
import { FileCardUploadField, FileUploadField, type FileWithPreview } from "@/components/common/file";
import {
  VehiclesArtSection,
  type ImplementArtVehicle,
} from "@/components/production/implement-art/vehicles-art-section";
import type { ResponsibleRowData } from "@/types/responsible";
import { BudgetProposalTerms } from "./budget-proposal-terms";
import { WizardSection } from "./wizard-section";

/** Âncoras do passo, para os atalhos da faixa dos eixos. */
export const BUDGET_TASK_ANCHORS = {
  terms: "orcamento-prazos",
  responsibles: "orcamento-responsaveis",
  layout: "orcamento-layout",
} as const;

export type BudgetApplyField = "customerOrderNumber" | "forecastDate" | "paintId" | "details";

interface BudgetWizardStepTaskProps {
  disabled?: boolean;
  mode: "create" | "edit";
  responsibleRows: ResponsibleRowData[];
  onResponsibleRowsChange: (rows: ResponsibleRowData[]) => void;
  showResponsibleErrors: boolean;
  baseFiles: FileWithPreview[];
  onBaseFilesChange: (files: FileWithPreview[]) => void;
  onPaintCreated?: (paint: any) => void;

  // ── LAYOUT ────────────────────────────────────────────────────────────────
  /** Criação: a imagem que entra como arte (rascunho) em TODOS os veículos que nascerem. */
  pendingArtFiles?: FileWithPreview[];
  onPendingArtFilesChange?: (files: FileWithPreview[]) => void;
  /** Detalhe: a arte de cada veículo (resumo aqui; o painel fica no passo Veículos). */
  artVehicles?: ImplementArtVehicle[];
  budgetId?: string | null;
  onOpenVehicle?: (taskId: string) => void;

  // ── N VEÍCULOS (só no detalhe) ────────────────────────────────────────────
  /** Prefixo dos campos DO VEÍCULO (`vehicles.<i>.`); vazio na criação. */
  vehicleFieldPrefix?: string;
  /** Identidade do veículo mostrado: as seções dele remontam ao trocar de aba. */
  vehicleKey?: string;
  vehicleCount?: number;
  activeVehicleLabel?: string;
  vehicleTabs?: ReactNode;
  onApplyToOtherVehicles?: (field: BudgetApplyField) => void;
  /** Campos comuns que DIVERGEM entre os veículos (dado anterior a esta tela). */
  commonDivergence?: { fields: string[]; equalized: boolean; onEqualize: () => void } | null;
}

export function BudgetWizardStepTask({
  disabled,
  mode,
  responsibleRows,
  onResponsibleRowsChange,
  showResponsibleErrors,
  baseFiles,
  onBaseFilesChange,
  onPaintCreated,
  pendingArtFiles = [],
  onPendingArtFilesChange,
  artVehicles = [],
  budgetId,
  onOpenVehicle,
  vehicleFieldPrefix = "",
  vehicleKey,
  vehicleCount = 1,
  activeVehicleLabel,
  vehicleTabs,
  onApplyToOtherVehicles,
  commonDivergence,
}: BudgetWizardStepTaskProps) {
  const { user } = useAuth();
  const { control } = useFormContext();
  const customerId = useWatch({ control, name: "customerId" }) as string | undefined;

  const privileges = user?.sector?.privileges;
  const isCommercialOrAdmin = privileges === SECTOR_PRIVILEGES.ADMIN || privileges === SECTOR_PRIVILEGES.COMMERCIAL;

  const v = (field: string) => `${vehicleFieldPrefix}${field}`;
  const vk = (part: string) => (vehicleKey ? `${vehicleKey}:${part}` : undefined);
  const multiVehicle = mode === "edit" && vehicleCount > 1;
  const vehicleSuffix = multiVehicle && activeVehicleLabel ? ` — ${activeVehicleLabel}` : "";
  const commonSuffix = multiVehicle ? " — comum a todos os veículos" : "";
  const applyButton = (field: BudgetApplyField, label: string) =>
    multiVehicle && onApplyToOtherVehicles && !disabled ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground"
        onClick={() => onApplyToOtherVehicles(field)}
      >
        <IconCopy className="h-3.5 w-3.5" />
        {label}
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      {multiVehicle && vehicleTabs && (
        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 pb-2 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Detalhes, tinta e aerografia são de cada veículo — escolha de qual:
          </p>
          {vehicleTabs}
        </div>
      )}

      {/* IDENTIFICAÇÃO — logomarca, Razão Social, detalhes */}
      <WizardSection icon={<IconClipboardList className="h-5 w-5" />} title={`Identificação${commonSuffix}`}>
        <TaskNameAutocomplete control={control} disabled={disabled} />
        <CustomerSelector control={control} disabled={disabled} label="Razão Social (dono do veículo)" />

        {multiVehicle && commonDivergence && commonDivergence.fields.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 space-y-2">
              <p className="text-amber-900 dark:text-amber-100">
                Os veículos estão com valores diferentes em{" "}
                <span className="font-medium">{commonDivergence.fields.join(", ")}</span>. Esses campos são comuns ao
                orçamento: o que aparece aqui é o do veículo aberto.
              </p>
              {commonDivergence.equalized ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Ao salvar, todos os veículos ficam com os valores mostrados aqui.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={commonDivergence.onEqualize}
                  disabled={disabled}
                >
                  Igualar todos os veículos a estes valores
                </Button>
              )}
            </div>
          </div>
        )}

        <FormField
          key={vk("detalhes")}
          control={control}
          name={v("details")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex flex-wrap items-center gap-2">
                <IconNotes className="h-4 w-4" />
                Detalhes{vehicleSuffix}
                {applyButton("details", "Repetir nos demais")}
              </FormLabel>
              <FormControl>
                <Textarea
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value ?? "")}
                  placeholder="Detalhes adicionais sobre o trabalho..."
                  rows={3}
                  disabled={disabled}
                  className="bg-transparent"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </WizardSection>

      {/* PRAZOS DA PROPOSTA — do orçamento */}
      <WizardSection
        id={BUDGET_TASK_ANCHORS.terms}
        icon={<IconCalendarTime className="h-5 w-5" />}
        title="Prazos da proposta"
        description="Validade, garantia, prazo de entrega e quantas tarefas a produção toca ao mesmo tempo."
      >
        <BudgetProposalTerms disabled={disabled} />
      </WizardSection>

      {/* RESPONSÁVEIS — comuns */}
      {isCommercialOrAdmin && (
        <WizardSection
          id={BUDGET_TASK_ANCHORS.responsibles}
          icon={<IconUser className="h-5 w-5" />}
          title={`Responsáveis${commonSuffix}`}
          description="Os contatos do cliente que pedem, aprovam e assinam este orçamento."
        >
          <ResponsibleManager
            companyId={customerId}
            value={responsibleRows}
            onChange={onResponsibleRowsChange}
            disabled={disabled}
            minRows={0}
            maxRows={10}
            control={control}
            showErrors={showResponsibleErrors}
          />
        </WizardSection>
      )}

      {/* TINTAS — de cada veículo */}
      {isCommercialOrAdmin && (
        <WizardSection
          icon={<IconPalette className="h-5 w-5" />}
          title={`Tintas${vehicleSuffix}`}
          actions={applyButton("paintId", "Aplicar esta pintura aos demais")}
        >
          <GeneralPaintingSelector
            key={vk("tinta")}
            name={v("paintId")}
            control={control}
            disabled={disabled}
            userPrivilege={privileges}
            allowQuickCreate={!disabled}
            onPaintCreated={onPaintCreated}
            quickCreateDescription='Informe os dados básicos da nova tinta. Ao salvar o orçamento, uma ordem de serviço "Formular Cor" será criada para a equipe de artes.'
          />
        </WizardSection>
      )}

      {/* ARQUIVOS BASE — comuns */}
      <WizardSection
        icon={<IconFileText className="h-5 w-5" />}
        title={
          <>
            Arquivos Base{commonSuffix}
            {baseFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {baseFiles.length}
              </Badge>
            )}
          </>
        }
      >
        <FileCardUploadField
          onFilesChange={onBaseFilesChange}
          maxFiles={30}
          maxSize={500 * 1024 * 1024}
          disabled={disabled}
          showPreview={true}
          existingFiles={baseFiles}
          variant="card"
          placeholder="Adicione arquivos base para a tarefa (vídeos, imagens, PDFs)"
          label="Arquivos base anexados"
          acceptedFileTypes={{
            "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
            "application/pdf": [".pdf"],
            "video/mp4": [".mp4"],
            "video/quicktime": [".mov"],
            "video/webm": [".webm"],
            "video/x-msvideo": [".avi"],
            "video/x-matroska": [".mkv"],
            "application/postscript": [".eps", ".ai"],
          }}
        />
      </WizardSection>

      {/* LAYOUT — a arte é do implemento; aqui entra a imagem comum */}
      {isCommercialOrAdmin && (mode === "create" ? !!onPendingArtFilesChange : artVehicles.length > 0) && (
        <WizardSection
          id={BUDGET_TASK_ANCHORS.layout}
          icon={<IconPhoto className="h-5 w-5" />}
          title="Layout"
          description={
            mode === "create"
              ? "Uma imagem para todos os veículos: entra como rascunho na arte de cada um. Depois ajuste veículo a veículo e envie ao cliente."
              : undefined
          }
        >
          {mode === "create" ? (
            <FileUploadField
              onFilesChange={onPendingArtFilesChange!}
              maxFiles={10}
              maxSize={50 * 1024 * 1024}
              disabled={disabled}
              showPreview={true}
              existingFiles={pendingArtFiles}
              variant="full"
              placeholder="Adicione a imagem do layout"
              label="Layout para todos os veículos"
              acceptedFileTypes={{ "image/*": [".jpeg", ".jpg", ".png", ".webp", ".svg"] }}
            />
          ) : (
            <VehiclesArtSection vehicles={artVehicles} budgetId={budgetId} summary onOpenVehicle={onOpenVehicle} />
          )}
        </WizardSection>
      )}

      {/* AEROGRAFIA — de cada veículo */}
      {isCommercialOrAdmin && (
        <WizardSection icon={<IconSparkles className="h-5 w-5" />} title={`Aerografias${vehicleSuffix}`}>
          <MultiAirbrushingSelector
            key={vk("aerografia")}
            name={v("airbrushings")}
            control={control}
            disabled={disabled}
            customerId={customerId || undefined}
            canViewFinancials={canViewAirbrushingFinancials(user as any)}
          />
        </WizardSection>
      )}
    </div>
  );
}
