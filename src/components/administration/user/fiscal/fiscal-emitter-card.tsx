// fiscal-emitter-card.tsx
//
// "Identidade Fiscal (NFS-e)" do colaborador — dados do PRESTADOR na nota. O aerografista
// é MEI e emite a NFS-e em nome próprio; a empresa figura como TOMADOR. Tudo aqui alimenta
// o DPS enviado à SEFIN nacional, por isso os campos seguem a nomenclatura fiscal
// (opSimpNac, cTribNac, série, ambiente) em vez de rótulos inventados.
//
// Quando ainda não existe perfil, o formulário nasce preenchido com a `suggestion` que a
// API devolve (CNPJ / razão social já conhecidos do vínculo do colaborador).

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconDeviceFloppy, IconLoader2, IconReceiptTax } from "@tabler/icons-react";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { NFSE_ENVIRONMENT, NFSE_ENVIRONMENT_LABELS, OP_SIMP_NAC, OP_SIMP_NAC_LABELS } from "../../../../constants";
import { useFiscalEmitter, useUpsertFiscalEmitter } from "../../../../hooks/administration/use-fiscal-emitter";

// Código de tributação nacional padrão de serviços de pintura/aerografia.
const DEFAULT_C_TRIB_NAC = "140501";

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

const schema = z.object({
  cnpj: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .refine((v) => onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos"),
  corporateName: z.string().min(1, "Razão social é obrigatória").max(200),
  tradeName: z.string().max(200).nullable().optional(),
  municipalRegistration: z.string().max(30).nullable().optional(),
  municipalityIbgeCode: z
    .string()
    .min(1, "Código IBGE é obrigatório")
    .refine((v) => onlyDigits(v).length === 7, "O código IBGE do município tem 7 dígitos"),
  opSimpNac: z.string().min(1, "Selecione o regime"),
  cTribNac: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || onlyDigits(v).length === 6, "O código de tributação nacional tem 6 dígitos"),
  cTribMun: z.string().max(20).nullable().optional(),
  serviceDescription: z.string().max(500).nullable().optional(),
  serie: z.string().max(5).nullable().optional(),
  environment: z.string().min(1, "Selecione o ambiente"),
  emissionEnabled: z.boolean().default(false),
});

type FiscalEmitterFormValues = z.infer<typeof schema>;

const OP_SIMP_NAC_OPTIONS = Object.entries(OP_SIMP_NAC_LABELS).map(([value, label]) => ({ value, label }));
const ENVIRONMENT_OPTIONS = Object.entries(NFSE_ENVIRONMENT_LABELS).map(([value, label]) => ({ value, label }));

interface FiscalEmitterCardProps {
  userId: string;
  className?: string;
  /**
   * Renderiza APENAS o corpo (sem `<Card>` / `<CardHeader>` / `<CardTitle>`). A seção da
   * página de detalhes já fornece a moldura e o título. Padrão false.
   */
  embedded?: boolean;
  /** Somente leitura — usado quando o visualizador não pode editar dados fiscais. */
  readOnly?: boolean;
}

export function FiscalEmitterCard({ userId, className, embedded = false, readOnly = false }: FiscalEmitterCardProps) {
  const { data: response, isLoading } = useFiscalEmitter(userId);
  const upsertMutation = useUpsertFiscalEmitter();
  const [isSaving, setIsSaving] = useState(false);

  const profile = response?.data?.profile ?? null;
  const suggestion = response?.data?.suggestion ?? null;

  // Perfil existente manda; sem perfil, a sugestão da API semeia CNPJ + razão social.
  const defaultValues = useMemo<FiscalEmitterFormValues>(
    () => ({
      cnpj: profile?.cnpj ?? suggestion?.cnpj ?? "",
      corporateName: profile?.corporateName ?? suggestion?.corporateName ?? "",
      tradeName: profile?.tradeName ?? "",
      municipalRegistration: profile?.municipalRegistration ?? "",
      municipalityIbgeCode: profile?.municipalityIbgeCode ?? "",
      opSimpNac: String(profile?.opSimpNac ?? OP_SIMP_NAC.OPTANTE_MEI),
      cTribNac: profile?.cTribNac ?? DEFAULT_C_TRIB_NAC,
      cTribMun: profile?.cTribMun ?? "",
      serviceDescription: profile?.serviceDescription ?? "",
      serie: profile?.serie ?? "",
      environment: String(profile?.environment ?? NFSE_ENVIRONMENT.RESTRICTED_PRODUCTION),
      emissionEnabled: profile?.emissionEnabled ?? false,
    }),
    [profile, suggestion],
  );

  const form = useForm<FiscalEmitterFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues,
  });

  // O primeiro render acontece antes do GET responder — resseme o formulário quando o
  // perfil/sugestão chega (e depois de cada save, que devolve o registro persistido).
  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const isRestricted = form.watch("environment") === String(NFSE_ENVIRONMENT.RESTRICTED_PRODUCTION);
  const disabled = readOnly || isSaving;

  const handleSubmit = async (values: FiscalEmitterFormValues) => {
    setIsSaving(true);
    // cTribNac / serviceDescription / serie têm DEFAULT no servidor e NÃO aceitam null —
    // quando o campo vem vazio, a chave é omitida para o default valer.
    const cTribNac = values.cTribNac ? onlyDigits(values.cTribNac) : "";
    const serviceDescription = values.serviceDescription?.trim() ?? "";
    const serie = values.serie?.trim() ?? "";
    try {
      await upsertMutation.mutateAsync({
        userId,
        data: {
          cnpj: onlyDigits(values.cnpj),
          corporateName: values.corporateName.trim(),
          tradeName: values.tradeName?.trim() || null,
          municipalRegistration: values.municipalRegistration?.trim() || null,
          municipalityIbgeCode: onlyDigits(values.municipalityIbgeCode),
          opSimpNac: Number(values.opSimpNac),
          cTribMun: values.cTribMun?.trim() || null,
          environment: Number(values.environment),
          emissionEnabled: values.emissionEnabled,
          ...(cTribNac ? { cTribNac } : {}),
          ...(serviceDescription ? { serviceDescription } : {}),
          ...(serie ? { serie } : {}),
        },
      });
      toast.success("Dados fiscais salvos.");
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    const skeleton = (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
    return embedded ? (
      <div className={className}>{skeleton}</div>
    ) : (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconReceiptTax className="h-5 w-5" />
            Identidade Fiscal (NFS-e)
          </CardTitle>
        </CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    );
  }

  const body = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Estes dados identificam o colaborador como <strong>prestador</strong> na NFS-e emitida a cada aerografia concluída. A empresa entra na nota como tomadora.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="cnpj"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  CNPJ <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="cnpj" value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} transparent disabled={disabled} />
                </FormControl>
                <FormDescription>CNPJ do MEI do colaborador — é o emissor da nota.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="corporateName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Razão Social <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Razão social do MEI" maxLength={200} transparent disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tradeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Fantasia</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Opcional" maxLength={200} transparent disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="municipalRegistration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inscrição Municipal</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Opcional" maxLength={30} transparent disabled={disabled} />
                </FormControl>
                <FormDescription>Opcional para MEI — a maioria não possui inscrição municipal. Deixe em branco se não houver.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="municipalityIbgeCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Código IBGE do Município <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Ex.: 4106902" maxLength={7} transparent disabled={disabled} />
                </FormControl>
                <FormDescription>7 dígitos — município onde o serviço é prestado.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="opSimpNac"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Regime Tributário <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(typeof v === "string" ? v : "")}
                    options={OP_SIMP_NAC_OPTIONS}
                    placeholder="Selecione o regime"
                    searchable={false}
                    clearable={false}
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>Para o aerografista MEI, mantenha "Optante pelo Simples Nacional — MEI".</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cTribNac"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de Tributação Nacional</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder={DEFAULT_C_TRIB_NAC} maxLength={6} transparent disabled={disabled} />
                </FormControl>
                <FormDescription>6 dígitos. O padrão {DEFAULT_C_TRIB_NAC} cobre serviços de pintura e aerografia.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cTribMun"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de Tributação Municipal</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Opcional" maxLength={20} transparent disabled={disabled} />
                </FormControl>
                <FormDescription>Preencha somente se o município exigir um código próprio.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="serie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Série</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(v) => field.onChange(String(v ?? ""))} onBlur={field.onBlur} placeholder="Ex.: 1" maxLength={5} transparent disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="environment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Ambiente <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(typeof v === "string" ? v : "")}
                    options={ENVIRONMENT_OPTIONS}
                    placeholder="Selecione o ambiente"
                    searchable={false}
                    clearable={false}
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription className={cn(isRestricted && "text-amber-600 dark:text-amber-500")}>
                  Mantenha em "Produção Restrita" até validar a emissão — notas de produção restrita NÃO têm valor fiscal. Só mude para "Produção" quando o fluxo estiver conferido.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="serviceDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição Padrão do Serviço</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex.: Serviço de aerografia em veículo"
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription>Texto usado na discriminação do serviço quando a aerografia não tiver descrição própria.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="emissionEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border border-border/40 p-4">
              <div className="space-y-0.5">
                <FormLabel>Emissão automática</FormLabel>
                <FormDescription>Quando ligada, cada aerografia concluída deste pintor gera a NFS-e automaticamente.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={disabled} />
              </FormControl>
            </FormItem>
          )}
        />

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={disabled}>
              {isSaving ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconDeviceFloppy className="mr-2 h-4 w-4" />}
              {profile ? "Salvar alterações" : "Cadastrar emissor"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );

  if (embedded) return <div className={className}>{body}</div>;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconReceiptTax className="h-5 w-5" />
          Identidade Fiscal (NFS-e)
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
