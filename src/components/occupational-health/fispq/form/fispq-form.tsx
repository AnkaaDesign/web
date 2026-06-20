import { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconBuildingFactory2,
  IconAlertTriangle,
  IconTruck,
  IconThermometer,
  IconFirstAidKit,
  IconShieldCheck,
  IconFileTypePdf,
  IconLoader2,
} from "@tabler/icons-react";

import { fispqCreateSchema, fispqUpdateSchema, type FispqCreateFormData, type FispqUpdateFormData } from "@/schemas/fispq";
import { FISPQ_STATUS, GHS_PICTOGRAM_LABELS, GHS_SIGNAL_WORD_LABELS, FISPQ_STATUS_LABELS } from "../../../../constants";
import type { Fispq } from "@/types/fispq";
import type { Item } from "@/types/item";
import { useItem } from "@/hooks/inventory/use-item";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Badge } from "@/components/ui/badge";
import { FileItem, FileUploadField, type FileWithPreview } from "@/components/common/file";
import { GhsPictogramList } from "../ghs-pictogram";

interface CreateModeProps {
  mode: "create";
  itemId: string;
  onSubmit: (data: FispqCreateFormData) => Promise<void>;
  defaultValues?: Partial<FispqCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  fispq: Fispq;
  onSubmit: (data: FispqUpdateFormData) => Promise<void>;
}

type FispqFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  disabled?: boolean;
  /** Called when the user selects a new PDF (only meaningful in update mode — needs an entity id). */
  onUploadPdf?: (file: globalThis.File) => Promise<void>;
  isUploadingPdf?: boolean;
  /** Overrides the form id (and hidden submit-trigger id) when embedded. */
  formId?: string;
};

const pictogramOptions = Object.entries(GHS_PICTOGRAM_LABELS).map(([value, label]) => ({ value, label }));
const signalWordOptions = Object.entries(GHS_SIGNAL_WORD_LABELS).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(FISPQ_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function buildUpdateDefaults(fispq: Fispq): FispqUpdateFormData {
  return {
    itemId: fispq.itemId,
    productName: fispq.productName ?? null,
    manufacturer: fispq.manufacturer ?? null,
    supplierName: fispq.supplierName ?? null,
    recommendedUse: fispq.recommendedUse ?? null,
    emergencyPhone: fispq.emergencyPhone ?? null,
    ghsPictograms: fispq.ghsPictograms ?? [],
    signalWord: fispq.signalWord ?? null,
    hazardStatements: fispq.hazardStatements ?? [],
    precautionStatements: fispq.precautionStatements ?? [],
    casNumber: fispq.casNumber ?? null,
    onuNumber: fispq.onuNumber ?? null,
    unRiskClass: fispq.unRiskClass ?? null,
    packingGroup: fispq.packingGroup ?? null,
    physicalState: fispq.physicalState ?? null,
    color: fispq.color ?? null,
    odor: fispq.odor ?? null,
    flashPoint: fispq.flashPoint ?? null,
    phValue: fispq.phValue ?? null,
    firstAidMeasures: fispq.firstAidMeasures ?? null,
    fireFightingMeasures: fispq.fireFightingMeasures ?? null,
    accidentalRelease: fispq.accidentalRelease ?? null,
    handlingStorage: fispq.handlingStorage ?? null,
    requiredPpeText: fispq.requiredPpeText ?? null,
    pdfFileId: fispq.pdfFileId ?? null,
    revisionNumber: fispq.revisionNumber ?? null,
    issueDate: fispq.issueDate ? new Date(fispq.issueDate) : null,
    revisionDate: fispq.revisionDate ? new Date(fispq.revisionDate) : null,
    validUntil: fispq.validUntil ? new Date(fispq.validUntil) : null,
    status: fispq.status ?? FISPQ_STATUS.DRAFT,
    notes: fispq.notes ?? null,
    isActive: fispq.isActive ?? true,
  };
}

/**
 * Full FISPQ / FDS form, rendered as multiple top-level Cards (one per section)
 * to match the app's standard multi-section form style (item-form / medical-exam
 * form). Reused by the dedicated Medicina create/edit pages and the item-form card.
 *
 * Rendered as a <div> (not <form>) so it can be embedded inside the item-form
 * <form> without invalid nested-form markup. Submission is triggered by an
 * external button clicking the hidden trigger by id.
 */
export function FispqForm(props: FispqFormProps) {
  const { isSubmitting, disabled, onUploadPdf, isUploadingPdf } = props;
  const formId = props.formId ?? "fispq-form";

  const defaultValues = useMemo(
    () =>
      props.mode === "create"
        ? ({
            itemId: props.itemId,
            ghsPictograms: [],
            hazardStatements: [],
            precautionStatements: [],
            status: FISPQ_STATUS.DRAFT,
            isActive: true,
            ...(props.defaultValues || {}),
          } as Partial<FispqCreateFormData>)
        : buildUpdateDefaults(props.fispq),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode, props.mode === "create" ? props.itemId : props.fispq.id],
  );

  const form = useForm<FispqCreateFormData | FispqUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? fispqCreateSchema : fispqUpdateSchema) as any,
    defaultValues: defaultValues as any,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const [pendingPdf, setPendingPdf] = useState<FileWithPreview[]>([]);
  const submitting = isSubmitting || form.formState.isSubmitting;
  const fieldsDisabled = disabled || submitting;

  const existingPdf = props.mode === "update" ? props.fispq.pdfFile : undefined;

  // The linked stock item — manufacturer = brand, supplier already lives on the item,
  // so we derive and show them read-only instead of re-typing them.
  const activeItemId = props.mode === "create" ? props.itemId : props.fispq.itemId;
  const { data: itemResponse } = useItem(activeItemId, {
    enabled: !!activeItemId,
    include: { brands: true, supplier: true },
  });
  const linkedItem = (itemResponse as any)?.data as Item | undefined;
  const brandNames = (linkedItem?.brands ?? []).map((b) => b.name).filter(Boolean).join(", ");
  const supplierName = linkedItem?.supplier?.fantasyName ?? "";

  // Keep the form's itemId in sync when the item is picked after the form already mounted
  // (create page renders the cards before a product is selected).
  useEffect(() => {
    if (props.mode === "create") {
      form.setValue("itemId", props.itemId, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === "create" ? props.itemId : undefined]);

  const selectedPictograms = (form.watch("ghsPictograms") as string[] | undefined) ?? [];

  // Newline-separated textareas backing the H/P string[] fields.
  const toLines = (arr?: string[] | null) => (arr && arr.length > 0 ? arr.join("\n") : "");
  const fromLines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const handlePdfChange = async (selected: FileWithPreview[]) => {
    setPendingPdf(selected);
    if (!onUploadPdf) return;
    const newFiles = selected.filter((f) => !(f as any).uploaded && f instanceof File);
    if (newFiles.length === 0) return;
    try {
      await onUploadPdf(newFiles[0] as unknown as globalThis.File);
      setPendingPdf([]);
    } catch {
      // toast handled by api client
    }
  };

  const handleSubmit = async (data: FispqCreateFormData | FispqUpdateFormData) => {
    if (props.mode === "create") {
      await props.onSubmit(data as FispqCreateFormData);
    } else {
      await props.onSubmit(data as FispqUpdateFormData);
    }
  };

  return (
    <FormProvider {...form}>
      <div id={formId}>
        <button id={`${formId}-submit`} type="button" className="hidden" disabled={submitting} onClick={() => form.handleSubmit(handleSubmit)()} />

        <div className="space-y-4">
          {/* Identificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuildingFactory2 className="h-5 w-5 text-muted-foreground" />
                Identificação
              </CardTitle>
              <CardDescription>O produto, a marca (fabricante) e o fornecedor vêm do item de estoque</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Read-only context derived from the linked stock item */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Produto</p>
                  <p className="text-sm text-foreground">{linkedItem?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Marca (fabricante)</p>
                  <p className="text-sm text-foreground">{brandNames || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Fornecedor</p>
                  <p className="text-sm text-foreground">{supplierName || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone de emergência</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="0800 ..." disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recommendedUse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Uso recomendado</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Aplicação / uso recomendado" disabled={fieldsDisabled} maxLength={1000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Perigos (GHS) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                Perigos (GHS)
              </CardTitle>
              <CardDescription>Classificação de perigo, pictogramas e frases de perigo/precaução</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ghsPictograms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pictogramas GHS</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="multiple"
                          value={(field.value as string[]) ?? []}
                          onValueChange={(value) => field.onChange((value as string[]) ?? [])}
                          options={pictogramOptions}
                          disabled={fieldsDisabled}
                          placeholder="Selecione os pictogramas"
                          emptyText="Nenhum pictograma"
                          searchable={false}
                          clearable
                        />
                      </FormControl>
                      {selectedPictograms.length > 0 && <GhsPictogramList codes={selectedPictograms} size={44} className="pt-2" />}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="signalWord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Palavra de advertência</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value ?? undefined}
                          onValueChange={(value) => field.onChange(value ?? null)}
                          options={signalWordOptions}
                          disabled={fieldsDisabled}
                          placeholder="Perigo / Atenção"
                          emptyText="Nenhuma"
                          searchable={false}
                          clearable
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hazardStatements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frases de perigo (H)</FormLabel>
                      <FormControl>
                        <Textarea
                          value={toLines(field.value as string[] | null)}
                          onChange={(e) => field.onChange(fromLines(e.target.value))}
                          placeholder={"Uma por linha, ex.:\nH225 Líquido e vapores altamente inflamáveis"}
                          disabled={fieldsDisabled}
                          rows={4}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormDescription>Uma frase H por linha.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precautionStatements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frases de precaução (P)</FormLabel>
                      <FormControl>
                        <Textarea
                          value={toLines(field.value as string[] | null)}
                          onChange={(e) => field.onChange(fromLines(e.target.value))}
                          placeholder={"Uma por linha, ex.:\nP210 Mantenha afastado do calor"}
                          disabled={fieldsDisabled}
                          rows={4}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormDescription>Uma frase P por linha.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Composição e Transporte */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTruck className="h-5 w-5 text-muted-foreground" />
                Composição e Transporte
              </CardTitle>
              <CardDescription>Identificação CAS/ONU e classificação para transporte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="casNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número CAS</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="CAS" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="onuNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número ONU</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="UN" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unRiskClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de risco</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Classe ANTT" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="packingGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo de embalagem</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="I / II / III" disabled={fieldsDisabled} maxLength={50} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Propriedades físico-químicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconThermometer className="h-5 w-5 text-muted-foreground" />
                Propriedades físico-químicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="physicalState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado físico</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Líquido / Sólido / Gás" disabled={fieldsDisabled} maxLength={200} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Cor" disabled={fieldsDisabled} maxLength={200} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="odor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Odor</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Odor" disabled={fieldsDisabled} maxLength={200} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="flashPoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ponto de fulgor</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Ex.: 23 °C" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>pH</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="pH" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Medidas de segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFirstAidKit className="h-5 w-5 text-muted-foreground" />
                Medidas de segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstAidMeasures"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primeiros socorros</FormLabel>
                      <FormControl>
                        <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Medidas de primeiros socorros" disabled={fieldsDisabled} rows={3} className="resize-none" maxLength={4000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fireFightingMeasures"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Combate a incêndio</FormLabel>
                      <FormControl>
                        <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Medidas de combate a incêndio" disabled={fieldsDisabled} rows={3} className="resize-none" maxLength={4000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accidentalRelease"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Derramamento acidental</FormLabel>
                      <FormControl>
                        <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Medidas em caso de vazamento" disabled={fieldsDisabled} rows={3} className="resize-none" maxLength={4000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="handlingStorage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manuseio e armazenamento</FormLabel>
                      <FormControl>
                        <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Condições de manuseio e armazenamento" disabled={fieldsDisabled} rows={3} className="resize-none" maxLength={4000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* EPI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconShieldCheck className="h-5 w-5 text-muted-foreground" />
                EPI
              </CardTitle>
              <CardDescription>Equipamentos de proteção individual necessários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="requiredPpeText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EPIs necessários</FormLabel>
                    <FormControl>
                      <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Luvas, óculos de proteção, máscara..." disabled={fieldsDisabled} rows={2} className="resize-none" maxLength={2000} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Documento e validade + PDF */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileTypePdf className="h-5 w-5 text-muted-foreground" />
                Documento e validade
                {isUploadingPdf && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>Revisão, vigência e PDF oficial da FDS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="revisionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da revisão</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(v) => field.onChange(v === null ? "" : String(v))} placeholder="Ex.: 03" disabled={fieldsDisabled} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value ?? undefined}
                          onValueChange={(value) => field.onChange(value ?? undefined)}
                          options={statusOptions}
                          disabled={fieldsDisabled}
                          placeholder="Status da FDS"
                          emptyText="Nenhum"
                          searchable={false}
                          clearable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => <DateTimeInput field={field as any} label="Data de emissão" mode="date" disabled={fieldsDisabled} />} />
                <FormField control={form.control} name="revisionDate" render={({ field }) => <DateTimeInput field={field as any} label="Data de revisão" mode="date" disabled={fieldsDisabled} />} />
                <FormField control={form.control} name="validUntil" render={({ field }) => <DateTimeInput field={field as any} label="Válida até" mode="date" disabled={fieldsDisabled} />} />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="Observações" disabled={fieldsDisabled} rows={2} className="resize-none" maxLength={2000} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PDF da FDS (oficial) */}
              <div className="space-y-3 pt-2 border-t border-border">
                <FormLabel className="flex items-center gap-2">
                  <IconFileTypePdf className="h-4 w-4" />
                  PDF da FDS (oficial)
                </FormLabel>
                {existingPdf ? (
                  <FileItem file={existingPdf} viewMode="list" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {props.mode === "create" ? "Salve a FISPQ primeiro para anexar o PDF oficial." : "Nenhum PDF anexado."}
                  </p>
                )}

                {props.mode === "update" && onUploadPdf && (
                  <FileUploadField
                    onFilesChange={handlePdfChange}
                    existingFiles={pendingPdf}
                    maxFiles={1}
                    disabled={disabled || isUploadingPdf}
                    acceptedFileTypes={{ "application/pdf": [".pdf"] }}
                    variant="compact"
                    placeholder="Anexe o PDF oficial da FDS"
                  />
                )}
                {existingPdf && (
                  <Badge variant="secondary" className="text-xs">
                    PDF anexado
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FormProvider>
  );
}
