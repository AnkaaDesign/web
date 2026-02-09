import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IconFileText, IconCut, IconAlertCircle } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import type { Cut } from "../../../../types";
import type { CutCreateFormData, CutUpdateFormData } from "../../../../schemas";
import { cutCreateSchema, cutUpdateSchema } from "../../../../schemas";
import { CUT_TYPE, CUT_STATUS, CUT_ORIGIN, CUT_TYPE_LABELS, CUT_STATUS_LABELS, CUT_ORIGIN_LABELS, CUT_REQUEST_REASON_LABELS } from "../../../../constants";
import { useCutMutations, useCut } from "../../../../hooks";
import { mapCutToFormData } from "../../../../schemas";
import { useToast } from "@/hooks/common/use-toast";

interface CutFormProps {
  cutId?: string;
  fileId?: string;
  taskId?: string;
  parentCutId?: string;
  mode: "create" | "edit";
  onSuccess?: (cut: Cut) => void;
  onCancel?: () => void;
  className?: string;
}

const createFormSchema = cutCreateSchema
  .extend({
    notes: z.string().optional(),
  })
  .refine(
    (data: any) => {
      // Additional validation: if origin is REQUEST, reason is required
      if (data.origin === CUT_ORIGIN.REQUEST) {
        return data.reason !== null && data.reason !== undefined;
      }
      return true;
    },
    {
      message: "Motivo é obrigatório quando a origem é 'Solicitação'",
      path: ["reason"],
    },
  );

const updateFormSchema = cutUpdateSchema
  .extend({
    notes: z.string().optional(),
  })
  .refine(
    (data: any) => {
      // Additional validation: if origin is REQUEST, reason is required
      if (data.origin === CUT_ORIGIN.REQUEST) {
        return data.reason !== null && data.reason !== undefined;
      }
      return true;
    },
    {
      message: "Motivo é obrigatório quando a origem é 'Solicitação'",
      path: ["reason"],
    },
  );

type CreateFormData = z.infer<typeof createFormSchema>;
type UpdateFormData = z.infer<typeof updateFormSchema>;

export function CutForm({ cutId, fileId, taskId, parentCutId, mode, onSuccess, onCancel, className }: CutFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing cut data for edit mode
  const { data: existingCut, isLoading: isLoadingCut } = useCut(
    cutId || "",
    {
      include: {
        file: true,
        task: {
          include: {
            customer: true,
          },
        },
        parentCut: {
          include: {
            file: true,
          },
        },
      },
    },
    {
      enabled: mode === "edit" && !!cutId,
    },
  );

  const { create, update } = useCutMutations();

  // Determine schema and default values based on mode
  const schema = mode === "create" ? createFormSchema : updateFormSchema;
  const defaultValues =
    mode === "create"
      ? {
          fileId: fileId || "",
          type: CUT_TYPE.VINYL,
          status: CUT_STATUS.PENDING,
          origin: CUT_ORIGIN.PLAN,
          taskId: taskId || null,
          parentCutId: parentCutId || null,
          reason: null,
          notes: "",
        }
      : existingCut
        ? {
            ...mapCutToFormData(existingCut),
            notes: "",
          }
        : {};

  const form = useForm<CreateFormData | UpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Watch form values for conditional rendering
  const watchedOrigin = form.watch("origin");
  const watchedType = form.watch("type");
  const watchedStatus = form.watch("status");

  // Trigger validation when origin changes
  useEffect(() => {
    form.trigger("reason");
  }, [watchedOrigin, form]);

  const handleSubmit = async (data: CreateFormData | UpdateFormData) => {
    setIsSubmitting(true);
    try {
      let result: Cut;

      if (mode === "create") {
        const createData = data as CutCreateFormData;
        const { notes, ...cutData } = createData as CreateFormData;

        const response = await create.mutateAsync({
          data: cutData,
          include: {
            file: true,
            task: {
              include: {
                customer: true,
              },
            },
            parentCut: {
              include: {
                file: true,
              },
            },
          },
        });
        result = response.data;
      } else {
        const updateData = data as CutUpdateFormData;
        const { notes, ...cutData } = updateData as UpdateFormData;

        const response = await update.mutateAsync({
          id: cutId!,
          data: cutData,
          include: {
            file: true,
            task: {
              include: {
                customer: true,
              },
            },
            parentCut: {
              include: {
                file: true,
              },
            },
          },
        });
        result = response.data;
      }

      toast({
        title: mode === "create" ? "Corte criado" : "Corte atualizado",
        description: `Corte ${mode === "create" ? "criado" : "atualizado"} com sucesso.`,
      });

      onSuccess?.(result);
    } catch (error) {
      toast({
        title: "Erro",
        description: `Erro ao ${mode === "create" ? "criar" : "atualizar"} corte.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === "edit" && isLoadingCut) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Carregando corte...</p>
        </div>
      </div>
    );
  }

  if (mode === "edit" && !existingCut) {
    return (
      <Alert className="m-4">
        <IconAlertCircle className="h-4 w-4" />
        <AlertDescription>Corte não encontrado.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Header with cut info */}
          {mode === "edit" && existingCut && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IconCut className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">Editar Corte</h3>
                <Badge variant="outline">{CUT_STATUS_LABELS[existingCut.status]}</Badge>
              </div>

              {existingCut.file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconFileText className="h-4 w-4" />
                  <span>Arquivo: {existingCut.file.filename}</span>
                </div>
              )}

              {existingCut.task && (
                <div className="text-sm text-muted-foreground">
                  Tarefa: {existingCut.task.name}
                  {existingCut.task.customer && ` - ${existingCut.task.customer.name}`}
                </div>
              )}

              <Separator />
            </div>
          )}

          {/* Main form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File ID - only for create mode */}
            {mode === "create" && (
              <FormField
                control={form.control}
                name="fileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={[{ value: "placeholder", label: "Selecionar arquivo..." }]}
                        placeholder="Selecione um arquivo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Cut Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Corte *</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={field.onChange}
                      options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Selecione o tipo"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cut Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={field.onChange}
                      options={Object.entries(CUT_STATUS_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Selecione o status"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cut Origin */}
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem *</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={field.onChange}
                      options={Object.entries(CUT_ORIGIN_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Selecione a origem"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Request Reason - only show if origin is REQUEST */}
            {watchedOrigin === CUT_ORIGIN.REQUEST && (
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo da Solicitação {watchedOrigin === CUT_ORIGIN.REQUEST ? "*" : "(Opcional)"}</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || ""}
                        onChange={(value: any) => field.onChange(value === "" ? null : value)}
                        options={Object.entries(CUT_REQUEST_REASON_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione o motivo"
                        searchable={false}
                        clearable={watchedOrigin !== CUT_ORIGIN.REQUEST}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Task ID - optional */}
            {mode === "create" && (
              <FormField
                control={form.control}
                name="taskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarefa (Opcional)</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || undefined}
                        onChange={(value: any) => field.onChange(value || null)}
                        options={[{ value: "placeholder", label: "Selecionar tarefa..." }]}
                        placeholder="Selecionar tarefa..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Parent Cut ID - for recuts */}
            {mode === "create" && (
              <FormField
                control={form.control}
                name="parentCutId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corte Pai (Para Retrabalho)</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || undefined}
                        onChange={(value: any) => field.onChange(value || null)}
                        options={[{ value: "placeholder", label: "Selecionar corte pai..." }]}
                        placeholder="Selecionar corte pai..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Notes field */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    placeholder="Adicione observações sobre este corte..."
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Summary info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Resumo do Corte</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <span className="ml-2">{watchedType ? CUT_TYPE_LABELS[watchedType] : "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2">{watchedStatus ? CUT_STATUS_LABELS[watchedStatus] : "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Origem:</span>
                <span className="ml-2">{watchedOrigin ? CUT_ORIGIN_LABELS[watchedOrigin] : "-"}</span>
              </div>
              {watchedOrigin === CUT_ORIGIN.REQUEST && form.watch("reason") && (
                <div>
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="ml-2">{CUT_REQUEST_REASON_LABELS[form.watch("reason")]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form actions */}
          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={!form.formState.isValid || isSubmitting} className="min-w-[120px]">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {mode === "create" ? "Criando..." : "Salvando..."}
                </div>
              ) : mode === "create" ? (
                "Criar Corte"
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
