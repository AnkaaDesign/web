// HR requests widget — surfaces the same Secullum time-adjustment / justified-
// absence approval queue that lives at /recursos-humanos/requisicoes.
//
// Design decision: this widget mirrors the page's master-detail layout — a
// compact card list on the left, detail panel on the right with vertical
// metadata stack and a 7-column comparison table that shows the origin
// (mobile/biometric/manual) of every time entry as an icon with tooltip.
// Action buttons (Atualizar / Rejeitar / Aprovar) live in the WidgetCard
// header so they remain accessible regardless of the detail panel's state.
//
// Approve copies Observacoes into every AlteracoesFonteDados.Motivo (Secullum
// rejects the request with HTTP 400 when any entry has Motivo: null). Reject
// requires a free-text reason — same UX as the page.

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  IconClockEdit,
  IconAdjustments,
  IconFilter,
  IconUser,
  IconCalendar,
  IconSearch,
  IconArrowsSort,
  IconCloudOff,
  IconDeviceTablet,
  IconPaperclip,
  IconArrowsExchange,
  IconFileDescription,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "../../constants";
import { routes } from "../../constants/routes";
import {
  useSecullumRequests,
  useSecullumApproveRequest,
  useSecullumRejectRequest,
} from "../../hooks/integrations/use-secullum";
import { toast } from "../../components/ui/sonner";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { LoadingSpinner } from "../../components/ui/loading";
import { secullumService } from "../../api-client/services/secullum";

import { WidgetCard } from "../components/widget-card";
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
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import {
  Section,
  SectionGroup,
  ToggleRow,
  LimitInput,
  SORT_DIRECTION_OPTIONS,
  DensitySegmented,
  DENSITY_VALUES,
  cardDensityClasses,
  makeTableDisplaySchema,
  TABLE_DISPLAY_DEFAULTS,
  type Density,
} from "./_shared";

// ============================================================
// Domain types and constants
// ============================================================

interface SecullumRequest {
  Id: number;
  Data: string;
  DataFim: string | null;
  FuncionarioId: number;
  FuncionarioNome: string;
  Entrada1: string | null;
  Saida1: string | null;
  Entrada2: string | null;
  Saida2: string | null;
  Entrada3: string | null;
  Saida3: string | null;
  Entrada1Original: string | null;
  Saida1Original: string | null;
  Entrada2Original: string | null;
  Saida2Original: string | null;
  Entrada3Original: string | null;
  Saida3Original: string | null;
  // Origin codes for each time entry (16 = Ponto Virtual / mobile online,
  // other non-null = mobile offline, null = manual employee request).
  // Surfaced in the comparison table as icons + tooltips matching the page.
  OrigemEntrada1?: number | null;
  OrigemSaida1?: number | null;
  OrigemEntrada2?: number | null;
  OrigemSaida2?: number | null;
  OrigemEntrada3?: number | null;
  OrigemSaida3?: number | null;
  Tipo: number;
  TipoDescricao: string;
  Estado: number;
  Observacoes: string | null;
  DataSolicitacao: string;
  AlteracoesFonteDados: any[];
  Versao: string;
  DispositivoTipo?: "mobile" | "biometric" | "qrcode" | "card" | "web";
  DispositivoNome?: string;
  // ID of the attached photo (e.g. medical certificate uploaded with a
  // Justify Absence request). When set, an attachment can be fetched from
  // /Solicitacoes/FotoAtestado/{id}.
  SolicitacaoFotoId?: number | null;
}

// Origin lookup ported from the page so widget time cells read identically:
// 16 → Ponto Virtual (mobile, online sync); other non-null → mobile offline;
// null/undefined → manual request entered by the employee.
function getOriginInfo(origin: number | null | undefined): {
  icon: TablerIcon;
  label: string;
} {
  if (origin === 16) return { icon: IconDeviceTablet, label: "Ponto Virtual" };
  if (origin != null) return { icon: IconCloudOff, label: "Ponto Virtual Offline" };
  return { icon: IconUser, label: "Solicitado pelo colaborador" };
}

const ESTADO_LABELS: Record<number, string> = {
  0: "Pendente",
  1: "Aprovado",
  2: "Rejeitado",
};
// Solid BADGE_COLORS palette (centralized in src/constants/badge-colors.ts):
//   pending → amber, approved → green, rejected → red.
const ESTADO_TONES: Record<number, string> = {
  0: "bg-amber-600 text-white border-amber-700",
  1: "bg-green-700 text-white border-green-800",
  2: "bg-red-700 text-white border-red-800",
};
const ESTADO_OPTIONS = [
  { value: "0", label: "Pendente" },
  { value: "1", label: "Aprovado" },
  { value: "2", label: "Rejeitado" },
];

const TIPO_LABELS: Record<number, string> = {
  0: "Ajuste de Ponto",
  2: "Justificar Ausência",
};
const TIPO_OPTIONS = [
  { value: "0", label: "Ajuste de Ponto" },
  { value: "2", label: "Justificativa de Ausência" },
];

const ACTIONABLE_ESTADOS = new Set<number>([0]);

const TIME_FIELDS: ReadonlyArray<{
  key: keyof SecullumRequest;
  origKey: keyof SecullumRequest;
  originKey: keyof SecullumRequest;
  short: string;
  long: string;
}> = [
  { key: "Entrada1", origKey: "Entrada1Original", originKey: "OrigemEntrada1", short: "E1", long: "Entrada 1" },
  { key: "Saida1", origKey: "Saida1Original", originKey: "OrigemSaida1", short: "S1", long: "Saída 1" },
  { key: "Entrada2", origKey: "Entrada2Original", originKey: "OrigemEntrada2", short: "E2", long: "Entrada 2" },
  { key: "Saida2", origKey: "Saida2Original", originKey: "OrigemSaida2", short: "S2", long: "Saída 2" },
  { key: "Entrada3", origKey: "Entrada3Original", originKey: "OrigemEntrada3", short: "E3", long: "Entrada 3" },
  { key: "Saida3", origKey: "Saida3Original", originKey: "OrigemSaida3", short: "S3", long: "Saída 3" },
];

// ============================================================
// Helpers
// ============================================================

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}
function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

/** Detect an absence-justification request. Mirrors the requisicoes page,
 *  which always renders the marking-comparison table for time-adjustment
 *  requests (Tipo !== 2) — even when only a single "to" is filled and the
 *  "from" side is empty (a missing-punch correction). */
function isJustification(r: SecullumRequest): boolean {
  return r.Tipo === 2;
}

function justificationToken(r: SecullumRequest): string | undefined {
  for (const f of TIME_FIELDS) {
    const cur = (r[f.key] as string | null) ?? "";
    if (cur) return cur;
  }
  return undefined;
}

// ============================================================
// Config schema
// ============================================================

const SORT_KEYS = [
  "dataSolicitacao",
  "data",
  "funcionarioName",
  "estado",
  "tipo",
] as const;

const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  dataSolicitacao: "Solicitada em",
  data: "Data de referência",
  funcionarioName: "Colaborador",
  estado: "Status",
  tipo: "Tipo",
};

export const hrRequestsTableConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Requisições de RH"),
  accent: makeAccentSchema({
    color: "indigo",
    icon: "Clock",
  }),
  // Canonical cross-platform table display block. Previous defaults all matched
  // TABLE_DISPLAY_DEFAULTS (incl. showSearchBox=true, emptyStateMessage=""); the
  // factory additively contributes stickyHeader / showColumnHeaders / showRowDot
  // / showViewAllLink / refreshIntervalMs.
  display: makeTableDisplaySchema(),
  filters: z
    .object({
      searchingFor: z.string().default(""),
      estados: z.array(z.number().int()).default([0]),
      tipos: z.array(z.number().int()).default([]),
    })
    .default({ searchingFor: "", estados: [0], tipos: [] }),
  sorts: z
    .array(
      z.object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "dataSolicitacao", direction: "desc" }]),
  limit: z.number().int().min(5).max(200).default(30),
  showActionButtons: z.boolean().default(true),
});

export type HrRequestsTableConfig = z.infer<typeof hrRequestsTableConfigSchema>;

// ============================================================
// Render
// ============================================================

function HrRequestsTableRender({
  config,
}: WidgetRenderProps<HrRequestsTableConfig>) {
  const display = config.display;
  const dens = cardDensityClasses(display.density as Density);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [openIds, setOpenIds] = useState<string[]>([]);

  const onlyPendingApi =
    config.filters.estados.length === 1 && config.filters.estados[0] === 0;

  const { data, isLoading, isError } = useSecullumRequests(
    onlyPendingApi || undefined,
  );
  const approveMutation = useSecullumApproveRequest();
  const rejectMutation = useSecullumRejectRequest();

  // Unwrap Secullum's nested response shape: { data: { success, message, data: [...] } }
  const allRows = useMemo<SecullumRequest[]>(() => {
    if (!data) return [];
    const anyData = data as any;
    if (anyData?.data?.data && Array.isArray(anyData.data.data)) {
      return anyData.data.data as SecullumRequest[];
    }
    if (anyData?.data && Array.isArray(anyData.data)) {
      return anyData.data as SecullumRequest[];
    }
    if (Array.isArray(anyData)) return anyData as SecullumRequest[];
    return [];
  }, [data]);

  const rows = useMemo(() => {
    const f = config.filters;
    const search = (debouncedSearch || f.searchingFor).trim().toLowerCase();
    let out = allRows;

    if (f.estados.length > 0) {
      const allowed = new Set(f.estados);
      out = out.filter((r) => allowed.has(r.Estado));
    }
    if (f.tipos.length > 0) {
      const allowed = new Set(f.tipos);
      out = out.filter((r) => allowed.has(r.Tipo));
    }
    if (search) {
      out = out.filter((r) =>
        [r.FuncionarioNome, r.TipoDescricao, r.Observacoes, r.DispositivoNome]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    }

    // Multi-sort: walk each sorts entry and use the first one that yields a
    // non-zero comparison.
    const cmpByKey = (a: SecullumRequest, b: SecullumRequest, key: string) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (key === "funcionarioName") {
        av = a.FuncionarioNome || "";
        bv = b.FuncionarioNome || "";
      } else if (key === "estado") {
        av = a.Estado;
        bv = b.Estado;
      } else if (key === "tipo") {
        av = a.Tipo;
        bv = b.Tipo;
      } else if (key === "data") {
        av = new Date(a.Data || 0).getTime();
        bv = new Date(b.Data || 0).getTime();
      } else {
        av = new Date(a.DataSolicitacao || 0).getTime();
        bv = new Date(b.DataSolicitacao || 0).getTime();
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    };
    const sorts = config.sorts ?? [];
    out = out.slice().sort((a, b) => {
      for (const s of sorts) {
        const sign = s.direction === "asc" ? 1 : -1;
        const c = cmpByKey(a, b, s.key);
        if (c !== 0) return sign * c;
      }
      return 0;
    });

    return out.slice(0, config.limit);
  }, [allRows, config.filters, config.sorts, config.limit, debouncedSearch]);

  // Drop any open accordion ids that no longer correspond to a visible row
  // (filters/search changed). All-closed-by-default is preserved otherwise.
  useEffect(() => {
    setOpenIds((prev) => {
      const visibleIds = new Set(rows.map((r) => String(r.Id)));
      const next = prev.filter((id) => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [rows]);

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  // ---- Mutations + reject dialog state ----
  const [rejectTarget, setRejectTarget] = useState<SecullumRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const onApprove = (r: SecullumRequest) => {
    const motivo = (r.Observacoes && r.Observacoes.trim()) || "Aprovado";
    const alteracoes = (r.AlteracoesFonteDados ?? []).map((c: any) => ({
      ...c,
      Motivo:
        c?.Motivo && String(c.Motivo).trim() !== "" ? c.Motivo : motivo,
    }));
    approveMutation.mutate({
      requestId: String(r.Id),
      data: {
        Versao: r.Versao,
        AlteracoesFonteDados: alteracoes,
        TipoSolicitacao: r.Tipo ?? 0,
      },
    });
  };

  const onConfirmReject = () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    rejectMutation.mutate(
      {
        requestId: String(rejectTarget.Id),
        data: {
          Versao: rejectTarget.Versao,
          Motivo: rejectReason,
          TipoSolicitacao: rejectTarget.Tipo ?? 0,
        },
      },
      {
        onSettled: () => {
          setRejectTarget(null);
          setRejectReason("");
        },
      },
    );
  };

  const headerExtra = display.showSearchBox ? (
    <div className="relative">
      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={searchInput}
        onChange={(v) => setSearchInput(typeof v === "string" ? v : "")}
        placeholder="Buscar..."
        className="h-7 pl-7 text-xs w-36"
      />
    </div>
  ) : undefined;

  return (
    <WidgetCard
      showHeader={config.display.showHeader ?? true}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={routes.humanResources.requisicoes.list}
      headerExtra={headerExtra}
      count={(config.display.showCount ?? true) && !isLoading ? rows.length : null}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <>
        {isLoading ? (
          <SkeletonState />
        ) : isError ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Erro ao carregar requisições.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {display.emptyStateMessage?.trim() ||
              "Nenhuma requisição encontrada com os filtros atuais."}
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto">
            <Accordion
              type="multiple"
              value={openIds}
              onValueChange={setOpenIds}
              className="p-2 space-y-1.5"
            >
              {rows.map((r) => (
                <RequestAccordionItem
                  key={r.Id}
                  r={r}
                  dens={dens}
                  showActions={true}
                  approvePending={approveMutation.isPending}
                  rejectPending={rejectMutation.isPending}
                  onApprove={() => onApprove(r)}
                  onReject={() => {
                    setRejectTarget(r);
                    setRejectReason("");
                  }}
                />
              ))}
            </Accordion>
          </div>
        )}

        <AlertDialog
          open={!!rejectTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar requisição</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja rejeitar a requisição de{" "}
                <span className="font-medium text-foreground">
                  {rejectTarget?.FuncionarioNome ?? ""}
                </span>
                ? O motivo é obrigatório e será anexado ao registro no Secullum.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">Motivo</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex.: marcação inconsistente, sem comprovante..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={rejectMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Rejeitar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </WidgetCard>
  );
}

// ============================================================
// Accordion item — collapsible card whose trigger shows the request
// summary (name + date + tipo badge) and whose content shows the full
// detail (info row + comparison table + per-card actions).
// ============================================================

function RequestAccordionItem({
  r,
  dens,
  showActions,
  approvePending,
  rejectPending,
  onApprove,
  onReject,
}: {
  r: SecullumRequest;
  dens: ReturnType<typeof cardDensityClasses>;
  showActions: boolean;
  approvePending: boolean;
  rejectPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const tipoLabel = TIPO_LABELS[r.Tipo] || r.TipoDescricao || "—";
  const justification = isJustification(r);
  const token = justification ? justificationToken(r) : undefined;
  const estadoTone =
    ESTADO_TONES[r.Estado] ?? "border-border text-muted-foreground";
  const estadoLabel = ESTADO_LABELS[r.Estado] ?? String(r.Estado);
  const isActionable = ACTIONABLE_ESTADOS.has(r.Estado);
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  return (
    <AccordionItem
      value={String(r.Id)}
      className="rounded-md border border-border/60 bg-card last:border-b last:border-border/60 data-[state=open]:border-primary/50 data-[state=open]:shadow-sm"
    >
      <AccordionTrigger
        className={`${dens.card} no-underline hover:no-underline data-[state=open]:bg-muted/30 transition-colors rounded-md`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0 text-left">
            <div className={`flex items-center gap-2 min-w-0 ${dens.primary}`}>
              <IconUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-semibold truncate flex-1 min-w-0 uppercase tracking-tight">
                {r.FuncionarioNome || "—"}
              </span>
            </div>
            <div
              className={`mt-1 flex items-center gap-1.5 ${dens.meta} min-w-0 text-muted-foreground`}
            >
              <IconCalendar className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">{formatDate(r.Data)}</span>
              {r.Estado !== 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0 px-1.5 shrink-0 ${estadoTone}`}
                >
                  {estadoLabel}
                </Badge>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 shrink-0 font-normal"
          >
            {tipoLabel}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pt-3 pb-3 space-y-3">
        {/* Information block — same fields as the page, but laid out
            horizontally so it fits compactly inside the accordion. */}
        <div className="rounded-md bg-muted/30 p-3 space-y-2.5">
          <h3 className="text-[11px] font-semibold flex items-center gap-1.5 text-foreground">
            <IconFileDescription className="h-3.5 w-3.5 text-primary" />
            Informações da Solicitação
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            <InfoRow label="Data do Ponto" value={formatDate(r.Data)} />
            <InfoRow label="Solicitado em" value={formatDateTime(r.DataSolicitacao)} />
            <InfoRow label="Solicitado por" value={r.FuncionarioNome || "—"} />
          </div>
          {r.Observacoes && (
            <InfoRow label="Observação" value={r.Observacoes} multiline />
          )}
          {r.SolicitacaoFotoId != null && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Foto Anexada
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-7 text-xs"
                onClick={() => setAttachmentOpen(true)}
              >
                <IconPaperclip className="h-3.5 w-3.5" />
                Ver foto anexada
              </Button>
            </div>
          )}
        </div>

        {/* Comparison or justification card. */}
        {justification ? (
          <JustificationCard token={token} observacoes={r.Observacoes} />
        ) : (
          <ComparisonGrid r={r} />
        )}

        {/* Per-card action buttons — only for pending (actionable) requests. */}
        {showActions && isActionable && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-3 !bg-destructive !text-destructive-foreground !border-destructive font-semibold hover:!opacity-90"
              disabled={approvePending || rejectPending}
              onClick={onReject}
            >
              Rejeitar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-3 font-semibold !text-primary-foreground"
              disabled={approvePending || rejectPending}
              onClick={onApprove}
            >
              Aprovar
            </Button>
          </div>
        )}

        {r.SolicitacaoFotoId != null && (
          <RequestAttachmentDialog
            solicitacaoId={r.SolicitacaoFotoId}
            open={attachmentOpen}
            onOpenChange={setAttachmentOpen}
          />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-xs ${multiline ? "whitespace-pre-wrap" : "tabular-nums"} text-foreground`}
      >
        {value}
      </p>
    </div>
  );
}

// Lightweight TimeCell — shows the time value with an inline origin icon
// (mobile-online / mobile-offline / manual). Matches the real page's
// component but inline-flex sized for the tile-width comparison grid.
function TimeCell({
  value,
  icon: Icon,
  tooltipLabel,
  tooltipReason,
}: {
  value: string | null;
  icon: TablerIcon | null;
  tooltipLabel?: string;
  tooltipReason?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="tabular-nums">{value || "—"}</span>
      {value && Icon && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 max-w-xs">
                <p className="text-xs font-medium">{tooltipLabel}</p>
                {tooltipReason && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {tooltipReason}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}

// Side dialog showing the attached photo (e.g. medical certificate).
// Lazy-loads the photo from the Secullum service when opened.
function RequestAttachmentDialog({
  solicitacaoId,
  open,
  onOpenChange,
}: {
  solicitacaoId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || solicitacaoId == null) {
      setPhoto(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    secullumService
      .getRequestAttachmentPhoto(solicitacaoId)
      .then((res: any) => {
        if (cancelled) return;
        const base64 = res?.data?.data?.Foto;
        if (base64) setPhoto(`data:image/jpeg;base64,${base64}`);
        else setError("Foto não disponível para esta solicitação.");
      })
      .catch(() => {
        if (!cancelled) setError("Falha ao carregar a foto anexada.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, solicitacaoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Foto anexada à solicitação</DialogTitle>
          <DialogDescription>
            Documento enviado pelo colaborador (ex: atestado médico).
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg overflow-hidden">
          {isLoading && <LoadingSpinner size="lg" />}
          {!isLoading && error && (
            <p className="text-sm text-muted-foreground p-6">{error}</p>
          )}
          {!isLoading && !error && photo && (
            <img
              src={photo}
              alt="Foto anexada"
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonGrid({ r }: { r: SecullumRequest }) {
  const changedCount = TIME_FIELDS.reduce((acc, f) => {
    const cur = (r[f.key] as string | null) ?? "";
    const orig = (r[f.origKey] as string | null) ?? "";
    return acc + (cur !== orig ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold flex items-center gap-1.5">
          <IconArrowsExchange className="h-3.5 w-3.5 text-primary" />
          Comparação de Marcações
        </h3>
        {changedCount > 0 && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {changedCount === 1
              ? "1 alteração"
              : `${changedCount} alterações`}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <div className="grid grid-cols-[auto_repeat(6,minmax(56px,1fr))] gap-px bg-border text-[11px] min-w-[420px]">
          {/* ----- header ----- */}
          <div className="bg-muted/60 px-2 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
            Marcação
          </div>
          {TIME_FIELDS.map((f) => (
            <div
              key={`h-${f.short}`}
              className="bg-muted/60 px-1 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground text-center"
            >
              {f.short}
            </div>
          ))}

          {/* ----- original row ----- */}
          <div className="bg-card px-2 py-1.5">
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
              Original
            </Badge>
          </div>
          {TIME_FIELDS.map((f) => {
            const value = (r[f.origKey] as string | null) ?? null;
            const origin = (r[f.originKey] as number | null | undefined) ?? null;
            const info = getOriginInfo(origin);
            return (
              <div
                key={`o-${f.short}`}
                className="bg-card px-1 py-1.5 text-center font-mono text-muted-foreground"
              >
                <TimeCell
                  value={value}
                  icon={value ? info.icon : null}
                  tooltipLabel={info.label}
                />
              </div>
            );
          })}

          {/* ----- requested row ----- */}
          <div className="bg-card px-2 py-1.5">
            <Badge className="text-[10px] py-0 px-1.5">Solicitado</Badge>
          </div>
          {TIME_FIELDS.map((f) => {
            const orig = (r[f.origKey] as string | null) ?? "";
            const cur = (r[f.key] as string | null) ?? null;
            const changed = orig !== (cur ?? "");
            const origin = (r[f.originKey] as number | null | undefined) ?? null;
            // Changed cells render with the Solicitado-pelo-colaborador icon
            // (matches real page: an explicit edit beats whatever origin the
            // entry happened to have before).
            const info = changed
              ? { icon: IconUser, label: "Solicitado pelo colaborador" }
              : getOriginInfo(origin);
            return (
              <div
                key={`s-${f.short}`}
                className={`px-1 py-1.5 text-center font-mono transition-colors ${
                  changed
                    ? "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                    : "bg-card text-muted-foreground"
                }`}
              >
                <TimeCell
                  value={cur}
                  icon={cur ? info.icon : null}
                  tooltipLabel={info.label}
                  tooltipReason={changed ? r.Observacoes : null}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function JustificationCard({
  token,
  observacoes,
}: {
  token?: string;
  observacoes: string | null;
}) {
  return (
    <div className="rounded-md border border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge className="text-[10px] py-0 px-1.5 bg-amber-600 text-white border-amber-700">
          Justificativa de ausência
        </Badge>
      </div>
      {token ? (
        <div className="font-mono text-sm font-semibold text-amber-800 dark:text-amber-300">
          {token}
        </div>
      ) : (
        <div className="text-xs italic text-muted-foreground">
          Sem código de justificativa.
        </div>
      )}
      {observacoes && (
        <div className="text-xs italic text-muted-foreground">
          “{observacoes}”
        </div>
      )}
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="p-2 space-y-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border/60 bg-card px-3 py-2 space-y-1.5"
        >
          <div className="h-3 rounded bg-muted/60 animate-pulse w-2/3" />
          <div className="h-2.5 rounded bg-muted/40 animate-pulse w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Configure UI
// ============================================================

function HrRequestsTableConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<HrRequestsTableConfig>) {
  const c = config;
  const set = <K extends keyof HrRequestsTableConfig>(
    key: K,
    value: HrRequestsTableConfig[K],
  ) => onChange({ ...c, [key]: value });
  const setDisplay = <K extends keyof HrRequestsTableConfig["display"]>(
    key: K,
    value: HrRequestsTableConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });
  const setFilter = <K extends keyof HrRequestsTableConfig["filters"]>(
    key: K,
    value: HrRequestsTableConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  // Multi-sort: this widget has no column-picker (master-detail layout), so
  // the UI exposes only the primary sort. We read/write `sorts[0]`.
  const primarySort = (c.sorts && c.sorts[0]) ?? { key: "dataSolicitacao", direction: "desc" as const };
  const setPrimarySort = (next: { key: string; direction: "asc" | "desc" }) => {
    const rest = (c.sorts ?? []).slice(1);
    onChange({ ...c, sorts: [next, ...rest] as HrRequestsTableConfig["sorts"] });
  };

  const currentAccentColor = (c.accent?.color ?? "indigo") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "Clock") as WidgetAccentIcon;
  const currentAccentShade = (c.accent?.shade ?? "500") as WidgetAccentShade;

  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={c.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Requisições de RH"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="ordering" className="gap-1">
            <IconArrowsSort className="h-3.5 w-3.5" /> Ordenação e limite
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFilter className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Acento (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{
                  color: currentAccentColor,
                  icon: currentAccentIcon,
                  shade: currentAccentShade,
                }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || currentAccentColor,
                    icon: next.icon || currentAccentIcon,
                    shade: next.shade || currentAccentShade,
                  } as HrRequestsTableConfig["accent"])
                }
              />
            </Section>
            <Section title="Densidade e linhas">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                <DensitySegmented
                  value={c.display.density}
                  onChange={(d) => setDisplay("density", d)}
                />
                <LimitInput value={c.limit} onChange={(n) => set("limit", n)} />
              </div>
            </Section>
            <Section title="Cabeçalho e link">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={c.display.showHeader ?? true}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label="Exibir contagem"
                  checked={c.display.showCount ?? true}
                  onCheckedChange={(v) => setDisplay("showCount", v)}
                />
                <ToggleRow
                  label="Caixa de busca"
                  checked={c.display.showSearchBox}
                  onCheckedChange={(v) => setDisplay("showSearchBox", v)}
                />
              </div>

            </Section>
            <Section title="Mensagem quando vazio">
              <Input
                value={c.display.emptyStateMessage}
                onChange={(v) =>
                  setDisplay("emptyStateMessage", typeof v === "string" ? v : "")
                }
                placeholder="Nenhuma requisição encontrada com os filtros atuais."
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* ---- ORDERING ---- */}
        <TabsContent value="ordering" className="space-y-3 mt-0">
          <Section title="Ordenação" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ordenar por</Label>
                <Combobox
                  mode="single"
                  value={primarySort.key}
                  onValueChange={(v) =>
                    setPrimarySort({
                      ...primarySort,
                      key: typeof v === "string" ? v : "dataSolicitacao",
                    })
                  }
                  options={SORT_KEYS.map((k) => ({
                    value: k,
                    label: SORT_LABELS[k],
                  }))}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Direção</Label>
                <Combobox
                  mode="single"
                  value={primarySort.direction}
                  onValueChange={(v) =>
                    setPrimarySort({
                      ...primarySort,
                      direction: (typeof v === "string" ? v : "desc") as "asc" | "desc",
                    })
                  }
                  options={SORT_DIRECTION_OPTIONS}
                  clearable={false}
                />
              </div>
            </div>
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div>
            <Label className="text-xs">Busca padrão</Label>
            <Input
              value={c.filters.searchingFor}
              onChange={(v) =>
                setFilter("searchingFor", typeof v === "string" ? v : "")
              }
              placeholder="Colaborador, observação, dispositivo..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplicado sempre. A caixa de busca em tempo real (se ativada)
              prevalece.
            </p>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Combobox
              mode="multiple"
              value={c.filters.estados.map((n) => String(n))}
              onValueChange={(v) =>
                setFilter("estados", asArray(v).map((s) => Number(s)))
              }
              options={ESTADO_OPTIONS}
              placeholder="Todos os status"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Combobox
              mode="multiple"
              value={c.filters.tipos.map((n) => String(n))}
              onValueChange={(v) =>
                setFilter("tipos", asArray(v).map((s) => Number(s)))
              }
              options={TIPO_OPTIONS}
              placeholder="Todos os tipos"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Definition
// ============================================================

export const hrRequestsTableWidget: WidgetDefinition<HrRequestsTableConfig> = {
  id: "table.hr-requests",
  name: "Requisições de RH",
  description:
    "Aprove ou rejeite ajustes de ponto e justificativas de ausência diretamente do dashboard. Lista compacta à esquerda, detalhe da requisição selecionada à direita com comparação de marcações.",
  icon: IconClockEdit,
  category: "hr",
  allowedSectors: [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
  ],
  defaultSize: { cols: 4, rows: 3 },
  minSize: { cols: 2, rows: 2 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: hrRequestsTableConfigSchema,
  defaultConfig: {
    title: "Requisições de RH",
    accent: { color: "indigo", icon: "Clock" },
    display: { ...TABLE_DISPLAY_DEFAULTS },
    filters: { searchingFor: "", estados: [0], tipos: [] },
    sorts: [{ key: "dataSolicitacao", direction: "desc" }],
    limit: 30,
    showActionButtons: true,
  },
  RenderComponent: HrRequestsTableRender,
  ConfigComponent: HrRequestsTableConfigComponent,
};
