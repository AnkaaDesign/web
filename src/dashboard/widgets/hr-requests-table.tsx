// HR requests widget — surfaces the same Secullum time-adjustment / justified-
// absence approval queue that lives at /recursos-humanos/requisicoes.
//
// Design decision: this widget mirrors the page's master-detail layout — a
// compact card list on the left and a detail panel on the right showing the
// current selection's metadata + before/after comparison. Action buttons
// (Atualizar / Rejeitar / Aprovar) live in the WidgetCard header so they
// remain accessible regardless of detail panel state. The widget version
// trims the verbose vertical metadata stack on the page (Data do Ponto /
// Solicitado em / Solicitado por / Observação as separate rows) into a
// single inline row to keep things compact at widget widths.
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
  IconClock,
  IconNotes,
  IconRefresh,
  IconSearch,
  IconArrowsSort,
} from "@tabler/icons-react";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

import { WidgetCard } from "../components/widget-card";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import {
  Section,
  ToggleRow,
  LimitInput,
  SORT_DIRECTION_OPTIONS,
  DENSITY_VALUES,
  DENSITY_OPTIONS,
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
  Tipo: number;
  TipoDescricao: string;
  Estado: number;
  Observacoes: string | null;
  DataSolicitacao: string;
  AlteracoesFonteDados: any[];
  Versao: string;
  DispositivoTipo?: "mobile" | "biometric" | "qrcode" | "card" | "web";
  DispositivoNome?: string;
}

const ESTADO_LABELS: Record<number, string> = {
  0: "Pendente",
  1: "Aprovado",
  2: "Rejeitado",
};
const ESTADO_TONES: Record<number, string> = {
  0: "border-amber-500/40 text-amber-500",
  1: "border-emerald-500/40 text-emerald-500",
  2: "border-rose-500/40 text-rose-500",
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
  short: string;
  long: string;
}> = [
  { key: "Entrada1", origKey: "Entrada1Original", short: "E1", long: "Entrada 1" },
  { key: "Saida1", origKey: "Saida1Original", short: "S1", long: "Saída 1" },
  { key: "Entrada2", origKey: "Entrada2Original", short: "E2", long: "Entrada 2" },
  { key: "Saida2", origKey: "Saida2Original", short: "S2", long: "Saída 2" },
  { key: "Entrada3", origKey: "Entrada3Original", short: "E3", long: "Entrada 3" },
  { key: "Saida3", origKey: "Saida3Original", short: "S3", long: "Saída 3" },
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

/** Detect a justification (Tipo 2 OR all changes share the same `to` with empty `from`). */
function isJustification(r: SecullumRequest): boolean {
  if (r.Tipo === 2) return true;
  const tos: string[] = [];
  let allEmptyFrom = true;
  for (const f of TIME_FIELDS) {
    const cur = (r[f.key] as string | null) ?? "";
    const orig = (r[f.origKey] as string | null) ?? "";
    if (cur !== orig) {
      tos.push(cur);
      if (orig) allEmptyFrom = false;
    }
  }
  if (tos.length === 0) return false;
  const firstTo = tos[0];
  return allEmptyFrom && tos.every((t) => t === firstTo);
}

function justificationToken(r: SecullumRequest): string | undefined {
  for (const f of TIME_FIELDS) {
    const cur = (r[f.key] as string | null) ?? "";
    if (cur) return cur;
  }
  return undefined;
}

interface CardDensity {
  card: string;
  primary: string;
  meta: string;
}

function listCardDensity(d: Density): CardDensity {
  if (d === "compact") {
    return {
      card: "px-2.5 py-1.5",
      primary: "text-xs",
      meta: "text-[10px]",
    };
  }
  if (d === "spacious") {
    return {
      card: "px-3 py-2.5",
      primary: "text-sm",
      meta: "text-xs",
    };
  }
  return {
    card: "px-3 py-2",
    primary: "text-sm",
    meta: "text-[11px]",
  };
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
    borderColor: "none",
  }),
  display: z
    .object({
      density: z.enum(DENSITY_VALUES).default("comfortable"),
      striping: z.boolean().default(true),
      gridLines: z.boolean().default(true),
      hoverHighlight: z.boolean().default(true),
      showSearchBox: z.boolean().default(true),
      emptyStateMessage: z.string().max(160).default(""),
    })
    .default({
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      showSearchBox: true,
      emptyStateMessage: "",
    }),
  filters: z
    .object({
      searchingFor: z.string().default(""),
      estados: z.array(z.number().int()).default([0]),
      tipos: z.array(z.number().int()).default([]),
    })
    .default({ searchingFor: "", estados: [0], tipos: [] }),
  sort: z
    .object({
      key: z.enum(SORT_KEYS).default("dataSolicitacao"),
      direction: z.enum(["asc", "desc"]).default("desc"),
    })
    .default({ key: "dataSolicitacao", direction: "desc" }),
  limit: z.number().int().min(5).max(200).default(30),
  showHeader: z.boolean().default(true),
  showActionButtons: z.boolean().default(true),
});

export type HrRequestsTableConfig = z.infer<typeof hrRequestsTableConfigSchema>;

// ============================================================
// Render
// ============================================================

function HrRequestsTableRender({
  config,
  size,
}: WidgetRenderProps<HrRequestsTableConfig>) {
  const display = config.display;
  const dens = listCardDensity(display.density as Density);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const onlyPendingApi =
    config.filters.estados.length === 1 && config.filters.estados[0] === 0;

  const { data, isLoading, isError, refetch, isFetching } = useSecullumRequests(
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

    const sign = config.sort.direction === "asc" ? 1 : -1;
    const sortKey = config.sort.key;
    out = out.slice().sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "funcionarioName") {
        av = a.FuncionarioNome || "";
        bv = b.FuncionarioNome || "";
      } else if (sortKey === "estado") {
        av = a.Estado;
        bv = b.Estado;
      } else if (sortKey === "tipo") {
        av = a.Tipo;
        bv = b.Tipo;
      } else if (sortKey === "data") {
        av = new Date(a.Data || 0).getTime();
        bv = new Date(b.Data || 0).getTime();
      } else {
        av = new Date(a.DataSolicitacao || 0).getTime();
        bv = new Date(b.DataSolicitacao || 0).getTime();
      }
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });

    return out.slice(0, config.limit);
  }, [allRows, config.filters, config.sort, config.limit, debouncedSearch]);

  // Auto-select first row when data loads or selection becomes stale.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !rows.some((r) => r.Id === selectedId)) {
      setSelectedId(rows[0].Id);
    }
  }, [rows, selectedId]);

  const selected = useMemo(
    () => rows.find((r) => r.Id === selectedId) ?? null,
    [rows, selectedId],
  );
  const isSelectedActionable =
    !!selected && ACTIONABLE_ESTADOS.has(selected.Estado);

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
      }),
    [config.accent?.color, config.accent?.icon],
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

  // ---- Header search + actions ----
  const showActions =
    config.showActionButtons && !!selected && isSelectedActionable;

  const headerExtra = (
    <>
      {display.showSearchBox && (
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(v) => setSearchInput(typeof v === "string" ? v : "")}
            placeholder="Buscar..."
            className="h-7 pl-7 text-xs w-36"
          />
        </div>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={() => refetch()}
        disabled={isFetching}
        title="Atualizar"
      >
        <IconRefresh
          className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
        />
      </Button>
      {showActions && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 !bg-destructive !text-destructive-foreground !border-destructive font-semibold hover:!opacity-90"
            disabled={approveMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              if (!selected) return;
              setRejectTarget(selected);
              setRejectReason("");
            }}
          >
            Rejeitar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 px-3 font-semibold !text-primary-foreground"
            disabled={approveMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              if (!selected) return;
              onApprove(selected);
            }}
          >
            Aprovar
          </Button>
        </>
      )}
    </>
  );

  // ---- Layout: split master-detail at >=3 cols, list-only otherwise ----
  const useSplitLayout = (size?.cols ?? 4) >= 3;

  return (
    <WidgetCard
      showHeader={config.showHeader}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={routes.humanResources.requisicoes.list}
      headerExtra={headerExtra}
      count={!isLoading ? rows.length : null}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
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
        ) : useSplitLayout ? (
          <div className="flex h-full min-h-0">
            <div className="w-2/5 min-w-[180px] border-r border-border overflow-y-auto">
              <ListPanel
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                dens={dens}
                accentDot={accent.classes.dot}
                striping={display.striping}
                gridLines={display.gridLines}
                hoverHighlight={display.hoverHighlight}
              />
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto">
              {selected ? (
                <DetailPanel r={selected} />
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Selecione uma requisição.
                </div>
              )}
            </div>
          </div>
        ) : (
          <ListPanel
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            dens={dens}
            accentDot={accent.classes.dot}
            striping={display.striping}
            gridLines={display.gridLines}
            hoverHighlight={display.hoverHighlight}
          />
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
// List panel + card
// ============================================================

function ListPanel({
  rows,
  selectedId,
  onSelect,
  dens,
  accentDot,
  striping,
  gridLines,
  hoverHighlight,
}: {
  rows: SecullumRequest[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  dens: CardDensity;
  accentDot: string;
  striping: boolean;
  gridLines: boolean;
  hoverHighlight: boolean;
}) {
  return (
    <div>
      {rows.map((r, i) => (
        <ListCard
          key={r.Id}
          r={r}
          index={i}
          selected={r.Id === selectedId}
          onSelect={onSelect}
          dens={dens}
          accentDot={accentDot}
          striping={striping}
          gridLines={gridLines}
          hoverHighlight={hoverHighlight}
        />
      ))}
    </div>
  );
}

function ListCard({
  r,
  index,
  selected,
  onSelect,
  dens,
  accentDot,
  striping,
  gridLines,
  hoverHighlight,
}: {
  r: SecullumRequest;
  index: number;
  selected: boolean;
  onSelect: (id: number) => void;
  dens: CardDensity;
  accentDot: string;
  striping: boolean;
  gridLines: boolean;
  hoverHighlight: boolean;
}) {
  const tipoLabel = TIPO_LABELS[r.Tipo] || r.TipoDescricao || "—";
  const stripeBg = !selected && striping && index % 2 === 1 ? "bg-muted/15" : "";
  const hoverBg = !selected && hoverHighlight ? "hover:bg-secondary/40" : "";
  const selectedBg = selected ? "bg-emerald-500/10" : "";
  const border = gridLines ? "border-b border-border/40 last:border-b-0" : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(r.Id)}
      className={`w-full text-left ${dens.card} ${border} ${stripeBg} ${hoverBg} ${selectedBg} transition-colors min-w-0`}
    >
      <div className={`flex items-center gap-2 min-w-0 ${dens.primary}`}>
        <IconUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-semibold truncate flex-1 min-w-0 uppercase tracking-tight">
          {r.FuncionarioNome || "—"}
        </span>
        {selected && (
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${accentDot}`}
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className={`mt-1 flex items-center gap-1.5 text-muted-foreground ${dens.meta} min-w-0`}
      >
        <IconCalendar className="h-3 w-3 shrink-0" />
        <span className="tabular-nums">{formatDate(r.Data)}</span>
        <Badge
          variant="secondary"
          className="ml-auto text-[10px] py-0 px-1.5 shrink-0 font-normal"
        >
          {tipoLabel}
        </Badge>
      </div>
    </button>
  );
}

// ============================================================
// Detail panel
// ============================================================

function DetailPanel({ r }: { r: SecullumRequest }) {
  const tipoLabel = r.TipoDescricao || TIPO_LABELS[r.Tipo] || "—";
  const longDate = useMemo(() => {
    if (!r.Data) return "—";
    try {
      return new Date(r.Data).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return formatDate(r.Data);
    }
  }, [r.Data]);

  const justification = isJustification(r);
  const token = justification ? justificationToken(r) : undefined;
  const estadoTone =
    ESTADO_TONES[r.Estado] ?? "border-border text-muted-foreground";
  const estadoLabel = ESTADO_LABELS[r.Estado] ?? String(r.Estado);

  return (
    <div className="p-3 space-y-3">
      {/* Type pill + long date + status (only when not pending). */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
          {tipoLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {longDate}
        </span>
        {r.Estado !== 0 && (
          <Badge
            variant="outline"
            className={`text-[10px] py-0 px-1.5 ml-auto ${estadoTone}`}
          >
            {estadoLabel}
          </Badge>
        )}
      </div>

      {/* Compact info row: Ponto · Solicitado · Observação inline. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs">
        <InfoChip
          icon={IconCalendar}
          label="Ponto"
          value={formatDate(r.Data)}
        />
        <InfoChip
          icon={IconClock}
          label="Solicitado"
          value={formatDateTime(r.DataSolicitacao)}
        />
        {r.Observacoes && (
          <InfoChip
            icon={IconNotes}
            label="Observação"
            value={`“${r.Observacoes}”`}
            italic
            grow
          />
        )}
      </div>

      {/* Comparison or justification card. */}
      {justification ? (
        <JustificationCard token={token} observacoes={r.Observacoes} />
      ) : (
        <ComparisonGrid r={r} />
      )}
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
  italic = false,
  grow = false,
}: {
  icon: typeof IconCalendar;
  label: string;
  value: string;
  italic?: boolean;
  grow?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 ${grow ? "flex-1" : ""}`}
      title={value}
    >
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span
        className={`tabular-nums truncate ${italic ? "italic text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </span>
    </span>
  );
}

function ComparisonGrid({ r }: { r: SecullumRequest }) {
  const changedCount = TIME_FIELDS.reduce((acc, f) => {
    const cur = (r[f.key] as string | null) ?? "";
    const orig = (r[f.origKey] as string | null) ?? "";
    return acc + (cur !== orig ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Comparação de marcações
        </h4>
        {changedCount > 0 && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {changedCount === 1
              ? "1 alteração"
              : `${changedCount} alterações`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-[auto_repeat(6,minmax(0,1fr))] gap-px bg-border rounded-md overflow-hidden text-[11px]">
        {/* ----- header ----- */}
        <div className="bg-muted/60 px-2 py-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
          Marcação
        </div>
        {TIME_FIELDS.map((f) => (
          <div
            key={`h-${f.short}`}
            className="bg-muted/60 px-1 py-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground text-center"
          >
            {f.short}
          </div>
        ))}

        {/* ----- original row ----- */}
        <div className="bg-card px-2 py-1.5">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            Original
          </Badge>
        </div>
        {TIME_FIELDS.map((f) => {
          const orig = (r[f.origKey] as string | null) ?? "";
          return (
            <div
              key={`o-${f.short}`}
              className="bg-card px-1 py-1.5 text-center font-mono text-muted-foreground tabular-nums"
            >
              {orig || "—"}
            </div>
          );
        })}

        {/* ----- requested row ----- */}
        <div className="bg-card px-2 py-1.5">
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-500"
          >
            Solicitado
          </Badge>
        </div>
        {TIME_FIELDS.map((f) => {
          const orig = (r[f.origKey] as string | null) ?? "";
          const cur = (r[f.key] as string | null) ?? "";
          const changed = orig !== cur;
          return (
            <div
              key={`s-${f.short}`}
              className={`bg-card px-1 py-1.5 text-center font-mono tabular-nums ${
                changed
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {cur || "—"}
            </div>
          );
        })}
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
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-500"
        >
          Justificativa de ausência
        </Badge>
      </div>
      {token ? (
        <div className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">
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
    <div className="flex h-full min-h-0">
      <div className="w-2/5 min-w-[180px] border-r border-border space-y-px p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5 px-1 py-2">
            <div className="h-3 rounded bg-muted/60 animate-pulse w-3/4" />
            <div className="h-2.5 rounded bg-muted/40 animate-pulse w-1/2" />
          </div>
        ))}
      </div>
      <div className="flex-1 p-3 space-y-3">
        <div className="h-3 rounded bg-muted/60 animate-pulse w-1/3" />
        <div className="h-3 rounded bg-muted/40 animate-pulse w-2/3" />
        <div className="h-24 rounded bg-muted/40 animate-pulse" />
      </div>
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
  const setSort = <K extends keyof HrRequestsTableConfig["sort"]>(
    key: K,
    value: HrRequestsTableConfig["sort"][K],
  ) => onChange({ ...c, sort: { ...c.sort, [key]: value } });

  const resetFilters = () =>
    set("filters", hrRequestsTableWidget.defaultConfig.filters);

  const currentAccentColor = (c.accent?.color ?? "indigo") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "Clock") as WidgetAccentIcon;
  const currentBorderColor = (c.accent?.borderColor ?? "none") as WidgetBorderColor;
  const setAccent = (
    patch: Partial<{
      color: WidgetAccentColor;
      icon: WidgetAccentIcon;
      borderColor: WidgetBorderColor;
    }>,
  ) =>
    set("accent", {
      color: currentAccentColor,
      icon: currentAccentIcon,
      borderColor: currentBorderColor,
      ...patch,
    } as HrRequestsTableConfig["accent"]);

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
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{
                color: currentAccentColor,
                icon: currentAccentIcon,
                borderColor: currentBorderColor,
              }}
              onChange={(next) =>
                setAccent({
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                })
              }
            />
          </Section>
          <Section title="Densidade e cartões" defaultOpen>
            <div>
              <Label className="text-xs">Densidade</Label>
              <Combobox
                mode="single"
                value={c.display.density}
                onValueChange={(v) =>
                  setDisplay(
                    "density",
                    (typeof v === "string" ? v : "comfortable") as Density,
                  )
                }
                options={DENSITY_OPTIONS}
                clearable={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Listras alternadas"
                checked={c.display.striping}
                onCheckedChange={(v) => setDisplay("striping", v)}
              />
              <ToggleRow
                label="Linhas divisórias"
                checked={c.display.gridLines}
                onCheckedChange={(v) => setDisplay("gridLines", v)}
              />
              <ToggleRow
                label="Realce ao passar"
                checked={c.display.hoverHighlight}
                onCheckedChange={(v) => setDisplay("hoverHighlight", v)}
              />
              <ToggleRow
                label="Caixa de busca"
                hint="Mostra um campo de busca em tempo real no cabeçalho do widget."
                checked={c.display.showSearchBox}
                onCheckedChange={(v) => setDisplay("showSearchBox", v)}
              />
              <ToggleRow
                label="Cabeçalho do widget"
                checked={c.showHeader}
                onCheckedChange={(v) => set("showHeader", v)}
              />
              <ToggleRow
                label="Botões Aprovar/Rejeitar"
                hint="Mostra os botões de ação no cabeçalho quando uma requisição PENDENTE está selecionada."
                checked={c.showActionButtons}
                onCheckedChange={(v) => set("showActionButtons", v)}
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
        </TabsContent>

        {/* ---- ORDERING ---- */}
        <TabsContent value="ordering" className="space-y-3 mt-0">
          <Section title="Ordenação e limite" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ordenar por</Label>
                <Combobox
                  mode="single"
                  value={c.sort.key}
                  onValueChange={(v) =>
                    setSort(
                      "key",
                      (typeof v === "string"
                        ? v
                        : "dataSolicitacao") as HrRequestsTableConfig["sort"]["key"],
                    )
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
                  value={c.sort.direction}
                  onValueChange={(v) =>
                    setSort(
                      "direction",
                      (typeof v === "string"
                        ? v
                        : "desc") as HrRequestsTableConfig["sort"]["direction"],
                    )
                  }
                  options={SORT_DIRECTION_OPTIONS}
                  clearable={false}
                />
              </div>
            </div>
            <LimitInput value={c.limit} onChange={(n) => set("limit", n)} />
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>

          <Section title="Busca, status e tipo" defaultOpen>
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
              <p className="text-[11px] text-muted-foreground mt-1">
                Apenas requisições PENDENTES podem ser aprovadas ou rejeitadas
                pelos botões do cabeçalho.
              </p>
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
          </Section>
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
    accent: { color: "indigo", icon: "Clock", borderColor: "none" },
    display: {
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      showSearchBox: true,
      emptyStateMessage: "",
    },
    filters: { searchingFor: "", estados: [0], tipos: [] },
    sort: { key: "dataSolicitacao", direction: "desc" },
    limit: 30,
    showHeader: true,
    showActionButtons: true,
  },
  RenderComponent: HrRequestsTableRender,
  ConfigComponent: HrRequestsTableConfigComponent,
};
