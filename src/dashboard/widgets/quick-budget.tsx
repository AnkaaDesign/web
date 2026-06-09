// Quick-budget widget — inline form that creates a Task + TaskQuote (Budget)
// directly from the home dashboard. NO navigation to the full wizard.
//
// Mirrors the field set of /financeiro/orcamento/cadastrar grouped by step:
//   - Tarefa:        cliente · nome / logomarca · identificador · prazo ·
//                    liberação · descrição
//   - Informações:   validade · garantia (texto) · dias de previsão custom
//   - Serviços:      lista (descrição + valor)
//
// Submits in two calls (matching the wizard):
//   1. createTaskAsync({ status: PREPARATION, customerId, name, details,
//                        term, forecastDate, serialNumber })
//   2. useCreateTaskQuote().mutateAsync({
//        taskId, expiresAt, status: PENDING,
//        subtotal, total,
//        customGuaranteeText, customForecastDays,
//        customerConfigs: [{ customerId, subtotal, total }],
//        services
//      })
//
// Footer link "Abrir formulário completo" jumps to the wizard for fields
// not exposed inline (file uploads, multi-customer billing, payment terms).

import { useMemo, useState } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { toast } from "sonner";
import {
  IconReceipt,
  IconPlus,
  IconBuildingStore,
  IconTrash,
  IconCalendarEvent,
  IconCurrencyReal,
  IconExternalLink,
  IconClipboardText,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Combobox } from "../../components/ui/combobox";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { IconAdjustments, IconLayout } from "@tabler/icons-react";
import { useCustomers } from "../../hooks/administration/use-customer";
import { useTaskMutations } from "../../hooks/production/use-task";
import { useCreateTaskQuote } from "../../hooks/production/use-task-quote";
import { WidgetCard } from "../components/widget-card";
import { Section, SectionGroup, ToggleRow } from "./_shared";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";
import { SECTOR_PRIVILEGES, TASK_STATUS } from "../../constants";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

const configSchema = z.object({
  title: z.string().min(1).max(80).default("Novo Orçamento"),
  accent: makeAccentSchema({
    color: "emerald",
    icon: "Receipt",
  }),
  defaultCustomerId: z.string().uuid().optional(),
  defaultGuaranteeYears: z.number().int().min(0).max(5).optional(),
  display: z
    .object({
      showHeader: z.boolean().default(true),
    })
    .default({ showHeader: true }),
});
type Config = z.infer<typeof configSchema>;

interface ServiceLine {
  description: string;
  amount: number;
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function Render({ config }: WidgetRenderProps<Config>) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { data: customersData } = useCustomers({
    orderBy: { fantasyName: "asc" },
  } as any);

  // ---- Tarefa
  const [customerId, setCustomerId] = useState<string | undefined>(config.defaultCustomerId);
  const [taskName, setTaskName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [term, setTerm] = useState<string>("");
  const [forecastDate, setForecastDate] = useState<string>("");
  const [details, setDetails] = useState<string>("");

  // ---- Informações
  const [expiresAt, setExpiresAt] = useState<string>(() => todayPlusDays(15));
  const [customGuaranteeText, setCustomGuaranteeText] = useState<string>("");
  const [customForecastDays, setCustomForecastDays] = useState<number | null>(null);

  // ---- Serviços
  const [services, setServices] = useState<ServiceLine[]>([{ description: "", amount: 0 }]);

  const { createAsync: createTaskAsync, isLoading: isTaskMutating } = useTaskMutations();
  const createQuote = useCreateTaskQuote();

  const customerOptions = useMemo(
    () =>
      (customersData?.data ?? []).map((c: any) => ({
        value: c.id,
        label: c.fantasyName || c.corporateName,
      })),
    [customersData?.data],
  );

  const subtotal = useMemo(
    () => services.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0),
    [services],
  );

  const isSubmitting = isTaskMutating || createQuote.isPending;
  const canSubmit =
    !!customerId &&
    !!expiresAt &&
    services.length > 0 &&
    services.every((s) => s.description.trim().length > 0 && s.amount >= 0) &&
    subtotal > 0 &&
    !isSubmitting;

  const reset = () => {
    setTaskName("");
    setSerialNumber("");
    setTerm("");
    setForecastDate("");
    setDetails("");
    setExpiresAt(todayPlusDays(15));
    setCustomGuaranteeText("");
    setCustomForecastDays(null);
    setServices([{ description: "", amount: 0 }]);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !customerId) return;
    try {
      const taskRes: any = await createTaskAsync({
        status: TASK_STATUS.PREPARATION,
        customerId,
        name: taskName || undefined,
        serialNumber: serialNumber || undefined,
        term: term ? new Date(term) : undefined,
        forecastDate: forecastDate ? new Date(forecastDate) : undefined,
        details: details || undefined,
      } as any);

      const taskId = taskRes?.data?.id;
      if (!taskId) {
        toast.error("Tarefa criada mas ID não retornado.");
        return;
      }

      await createQuote.mutateAsync({
        taskId,
        expiresAt: new Date(expiresAt) as any,
        status: "PENDING",
        subtotal,
        total: subtotal,
        guaranteeYears: config.defaultGuaranteeYears ?? null,
        customGuaranteeText: customGuaranteeText || null,
        customForecastDays: customForecastDays != null ? customForecastDays : null,
        customerConfigs: [{ customerId, subtotal, total: subtotal }],
        services: services.map((s) => ({
          description: s.description.trim(),
          amount: s.amount,
        })),
      } as any);

      toast.success("Orçamento criado!", {
        description: "Você pode abrir o detalhe para finalizar.",
        action: {
          label: "Abrir",
          onClick: () => navigate(`/financeiro/orcamento/detalhes/${taskId}`, { state: { returnTo } }),
        },
      });
      reset();
    } catch {
      // toast already fired by mutation hooks
    }
  };

  const updateService = (i: number, patch: Partial<ServiceLine>) => {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const addServiceLine = () =>
    setServices((prev) => [...prev, { description: "", amount: 0 }]);
  const removeServiceLine = (i: number) => {
    setServices((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const accent = resolveAccent({
    color: config.accent?.color as WidgetAccentColor,
    icon: config.accent?.icon as WidgetAccentIcon,
    shade: config.accent?.shade as WidgetAccentShade | undefined,
  });
  const AccentIcon = accent.Icon;

  return (
    <WidgetCard
      title={
        <span className={accent.classes.text}>
          {config.title || "Novo Orçamento"}
        </span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
      footerExtra={
        <Link
          to="/financeiro/orcamento/cadastrar"
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
        >
          Formulário completo
          <IconExternalLink className="h-3 w-3" />
        </Link>
      }
    >
      <div className="h-full flex flex-col gap-3 p-3 overflow-y-auto">
        {/* TAREFA */}
        <Section title="Tarefa" icon={<IconClipboardText className="h-3.5 w-3.5 text-muted-foreground" />} defaultOpen>
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <IconBuildingStore className="h-3 w-3" />
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Combobox
              mode="single"
              value={customerId}
              onValueChange={(v) => {
                const id = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
                setCustomerId(id);
              }}
              options={customerOptions}
              placeholder="Selecionar cliente..."
              searchPlaceholder="Buscar cliente..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome / Logomarca</Label>
              <Input
                value={taskName}
                onChange={(v) => setTaskName(typeof v === "string" ? v : "")}
                placeholder="Ex: Frota verão"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Identificador</Label>
              <Input
                value={serialNumber}
                onChange={(v) => setSerialNumber(typeof v === "string" ? v : "")}
                placeholder="Ex: 29806"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo</Label>
              <input
                type="date"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Liberação</Label>
              <input
                type="date"
                value={forecastDate}
                onChange={(e) => setForecastDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={2}
              className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 focus:outline-none"
            />
          </div>
        </Section>

        {/* INFORMAÇÕES */}
        <Section
          title="Informações do orçamento"
          icon={<IconShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />}
          defaultOpen={false}
        >
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <IconCalendarEvent className="h-3 w-3" />
              Validade <span className="text-destructive">*</span>
            </Label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto de garantia (opcional)</Label>
            <textarea
              value={customGuaranteeText}
              onChange={(e) => setCustomGuaranteeText(e.target.value)}
              placeholder="Ex: 12 meses contra defeitos de fabricação"
              rows={2}
              className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dias de previsão custom (opcional)</Label>
            <Input
              type="number"
              value={customForecastDays ?? ""}
              onChange={(v) => {
                const n = typeof v === "number" ? v : v ? Number(v) : null;
                setCustomForecastDays(Number.isFinite(n) ? (n as number) : null);
              }}
              placeholder="Ex: 15"
              min={1}
              max={30}
            />
          </div>
        </Section>

        {/* SERVIÇOS */}
        <Section
          title="Serviços"
          icon={<IconCurrencyReal className="h-3.5 w-3.5 text-muted-foreground" />}
          defaultOpen
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Pelo menos uma linha. Total = soma dos valores.
            </span>
            <button
              type="button"
              onClick={addServiceLine}
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              <IconPlus className="h-3 w-3" /> Adicionar linha
            </button>
          </div>
          <div className="space-y-1.5">
            {services.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <Input
                  value={s.description}
                  onChange={(v) =>
                    updateService(i, { description: typeof v === "string" ? v : "" })
                  }
                  placeholder="Descrição"
                  className="flex-1"
                />
                <Input
                  type="currency"
                  value={s.amount}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : v ? Number(v) : 0;
                    updateService(i, {
                      amount: Number.isFinite(n) ? (n as number) : 0,
                    });
                  }}
                  placeholder="R$ 0,00"
                  className="w-32"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeServiceLine(i)}
                  disabled={services.length <= 1}
                  className="h-10 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                  type="button"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(subtotal)}
            </span>
          </div>
        </Section>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full gap-1.5 mt-1"
        >
          <IconPlus className="h-4 w-4" />
          {isSubmitting ? "Criando..." : "Criar orçamento"}
        </Button>
      </div>
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...config, [key]: value });
  const accentColor = (config.accent?.color ?? "emerald") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Receipt") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const { data: customersData } = useCustomers({
    orderBy: { fantasyName: "asc" },
  } as any);
  const customerOptions = useMemo(
    () =>
      (customersData?.data ?? []).map((c: any) => ({
        value: c.id,
        label: c.fantasyName || c.corporateName,
      })),
    [customersData?.data],
  );
  const guaranteeOptions = useMemo(
    () => [
      { value: "none", label: "Sem padrão" },
      { value: "0", label: "Sem garantia (0 anos)" },
      { value: "1", label: "1 ano" },
      { value: "2", label: "2 anos" },
      { value: "3", label: "3 anos" },
      { value: "4", label: "4 anos" },
      { value: "5", label: "5 anos" },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar><TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1">
            <IconLayout className="h-3.5 w-3.5" /> Comportamento
          </TabsTrigger>
        </TabsList></WidgetTabsBar>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Destaque (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || accentColor,
                    icon: next.icon || accentIcon,
                    shade: next.shade || accentShade,
                  } as Config["accent"])
                }
              />
            </Section>
            <Section title="Cabeçalho">
              <ToggleRow
                label="Exibir cabeçalho"
                checked={config.display?.showHeader ?? true}
                onCheckedChange={(v) =>
                  set("display", { ...(config.display ?? {}), showHeader: v } as Config["display"])
                }
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-3 mt-0">
          <Section title="Valores padrão" defaultOpen>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente padrão (opcional)</Label>
              <Combobox
                mode="single"
                value={config.defaultCustomerId}
                onValueChange={(v) => {
                  const id =
                    typeof v === "string"
                      ? v
                      : Array.isArray(v)
                        ? v[0]
                        : undefined;
                  set("defaultCustomerId", id);
                }}
                options={customerOptions}
                placeholder="Sem cliente padrão..."
                searchPlaceholder="Buscar cliente..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Garantia padrão (anos)</Label>
              <Combobox
                mode="single"
                value={
                  config.defaultGuaranteeYears == null
                    ? "none"
                    : String(config.defaultGuaranteeYears)
                }
                onValueChange={(v) => {
                  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "none";
                  if (!raw || raw === "none") {
                    set("defaultGuaranteeYears", undefined);
                  } else {
                    const n = Number(raw);
                    set(
                      "defaultGuaranteeYears",
                      Number.isFinite(n) ? n : undefined,
                    );
                  }
                }}
                options={guaranteeOptions}
                placeholder="Sem padrão"
                searchable={false}
              />
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const quickBudgetWidget: WidgetDefinition<Config> = {
  id: "quick-action.budget",
  name: "Novo Orçamento",
  description:
    "Crie um orçamento sem sair do painel — agrupado em Tarefa, Informações e Serviços, exatamente como o formulário completo.",
  icon: IconReceipt,
  category: "other",
  // Mirror /financeiro/orcamento page privileges. PRODUCTION_MANAGER is
  // intentionally excluded — managers don't create budgets.
  allowedSectors: [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ],
  defaultSize: { cols: 2, rows: 4 },
  minSize: { cols: 2, rows: 3 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Novo Orçamento",
    accent: { color: "emerald", icon: "Receipt", shade: "500" },
    display: { showHeader: true },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
