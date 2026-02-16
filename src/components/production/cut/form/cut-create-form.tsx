import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCut, IconFileText, IconClipboardList } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import type { Cut } from "../../../../types";
import { CUT_TYPE, CUT_ORIGIN, CUT_REQUEST_REASON, CUT_TYPE_LABELS, CUT_ORIGIN_LABELS, CUT_REQUEST_REASON_LABELS } from "../../../../constants";
import { useCutBatchMutations } from "../../../../hooks";
import { useToast } from "@/hooks/common/use-toast";

interface CutCreateFormProps {
  fileId?: string;
  fileName?: string;
  taskId?: string;
  taskName?: string;
  parentCutId?: string;
  defaultOrigin?: keyof typeof CUT_ORIGIN;
  onSuccess?: (cuts: Cut[]) => void;
  onCancel?: () => void;
  className?: string;
}

// cutCreateNestedSchema is a ZodEffects (has .transform()), so we need to work with the base schema
// We'll create our own schema based on the same structure
const createSchema = z
  .object({
    fileId: z.string().uuid("Arquivo inválido").optional().nullable(),
    file: z.any().optional().nullable(),
    type: z.nativeEnum(CUT_TYPE, {
      errorMap: () => ({ message: "Tipo de corte inválido" }),
    }),
    origin: z.nativeEnum(CUT_ORIGIN, {
      errorMap: () => ({ message: "Origem do corte inválida" }),
    }),
    reason: z
      .nativeEnum(CUT_REQUEST_REASON, {
        errorMap: () => ({ message: "Motivo da solicitação inválido" }),
      })
      .nullable()
      .optional(),
    parentCutId: z.string().uuid("Corte pai inválido").nullable().optional(),
    quantity: z.number().int().min(1).max(100).default(1),
  })
  .refine(
    (data) => {
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

type CreateFormData = z.infer<typeof createSchema>;

export function CutCreateForm({ fileId, fileName, taskId, taskName, parentCutId, defaultOrigin = "PLAN", onSuccess, onCancel, className }: CutCreateFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { batchCreateAsync } = useCutBatchMutations();

  const form = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      fileId: fileId || "",
      type: CUT_TYPE.VINYL,
      origin: CUT_ORIGIN[defaultOrigin],
      reason: null,
      parentCutId: parentCutId || null,
      quantity: 1,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Watch form values for conditional rendering
  const watchedOrigin = form.watch("origin");
  const watchedQuantity = form.watch("quantity");

  // Trigger validation when origin changes
  useEffect(() => {
    form.trigger("reason");
  }, [watchedOrigin, form]);

  const handleSubmit = async (data: CreateFormData) => {
    if (!data.fileId) {
      toast({
        title: "Erro",
        description: "É necessário selecionar um arquivo.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { quantity, ...cutData } = data;

      // Create multiple cuts based on quantity
      const cuts = Array.from({ length: quantity }, () => ({
        ...cutData,
        ...(taskId && { taskId }),
      }));

      const response = await batchCreateAsync(
        // @ts-expect-error - type mismatch for cuts
        { cuts },
        {
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
        } as any,
      );

      toast({
        title: "Cortes criados",
        description: `${quantity} corte(s) criado(s) com sucesso.`,
      });

      onSuccess?.(response.data?.success ?? []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar cortes.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCut className="h-5 w-5 text-primary" />
          Criar Novo Corte
        </CardTitle>

        {/* Context info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {fileName && (
            <div className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              <span>Arquivo: {fileName}</span>
            </div>
          )}
          {taskName && (
            <div className="flex items-center gap-2">
              <IconClipboardList className="h-4 w-4" />
              <span>Tarefa: {taskName}</span>
            </div>
          )}
          {parentCutId && (
            <Badge variant="outline" className="w-fit">
              Retrabalho
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* File selection - only if not provided */}
            {!fileId && (
              <FormField
                control={form.control}
                name="fileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={[
                          /* TODO: Implement file selector with files list */
                          { value: "placeholder", label: "Selecionar arquivo..." },
                        ]}
                        placeholder="Selecione um arquivo"
                        searchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onValueChange={field.onChange}
                        options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione o tipo"
                        searchable={false}
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
                        onValueChange={field.onChange}
                        options={Object.entries(CUT_ORIGIN_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione a origem"
                        searchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        value={field.value || undefined}
                        onValueChange={(value) => field.onChange(value || null)}
                        options={Object.entries(CUT_REQUEST_REASON_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione o motivo"
                        searchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} placeholder="1" ref={field.ref} value={field.value} onChange={(value) => field.onChange(typeof value === "number" ? value : 1)} onBlur={field.onBlur} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary */}
            {watchedQuantity > 1 && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <span className="font-medium">Serão criados {watchedQuantity} cortes idênticos</span>
              </div>
            )}

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
                    Criando...
                  </div>
                ) : (
                  `Criar ${watchedQuantity > 1 ? `${watchedQuantity} Cortes` : "Corte"}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
