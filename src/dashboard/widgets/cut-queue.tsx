// Cut queue widget — the "what to cut next" list for the home dashboard.
//
// Targeted at the cut executors (ADMIN / PLOTTING / WAREHOUSE). Shows the cut
// queue in the SAME order as the cuts page — statusOrder → priority → createdAt —
// so the drag-reorder priority the user sets on the cuts table is reflected here
// one-to-one. Each row: file thumbnail + task/file name + status & origin badges,
// with optional inline Start/Finish quick-actions (mirrors the cuts page's status
// transitions) and click-through to the cut detail.
//
// Structure mirrors the other table widgets (order-table): a focused config
// schema built on the shared `makeTableDisplaySchema` contract, a WidgetCard-
// wrapped render, and a Tabs-based config component using the `_shared` primitives.

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileOff,
  IconFilter,
  IconPlayerPlay,
  IconScissors,
} from "@tabler/icons-react";

import {
  CUT_STATUS,
  CUT_STATUS_LABELS,
  CUT_TYPE,
  CUT_TYPE_LABELS,
  CUT_ORIGIN_LABELS,
  SECTOR_PRIVILEGES,
  getBadgeVariant,
  routes,
} from "../../constants";
import type { Cut } from "../../types";
import { useCuts, useCutMutations } from "../../hooks/production/use-cut";
import { usePrivileges } from "../../hooks/common/use-privileges";
import { useCutQueueAlertPresence } from "../../hooks/common/use-nav-activity-alert";
import { useFileViewer } from "../../components/common/file";
import { getApiBaseUrl } from "../../config/api";

import { Badge } from "../../components/ui/badge";
import { FileTypeIcon } from "../../components/ui/file-type-icon";
import { Combobox } from "../../components/ui/combobox";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

import { WidgetCard } from "../components/widget-card";
import { WidgetTabsBar } from "../components/config-kit";
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
  DensitySegmented,
  LimitInput,
  REFETCH_INTERVAL_OPTIONS,
  Section,
  SectionGroup,
  ToggleRow,
  densityClasses,
  makeTableDisplaySchema,
  TABLE_DISPLAY_DEFAULTS,
  type Density,
} from "./_shared";

// ============================================================================
// Roles allowed to persist a status change (Start/Finish) — mirrors the cuts
// page's CUT_STATUS_MANAGERS / the API PUT /cuts guard. The widget audience
// (ADMIN/PLOTTING/WAREHOUSE) is a subset of these, so quick-actions are shown to
// everyone who sees the widget; the gate stays for defensive correctness.
// ============================================================================
const CUT_STATUS_MANAGERS = [
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.PLOTTING,
  SECTOR_PRIVILEGES.WAREHOUSE,
];

// ============================================================================
// File thumbnail — the on-demand thumbnail endpoint with a colored file-type
// icon fallback (EPS/vector files can't be rasterized). Clicking it opens the
// file directly in the unified file viewer (image/PDF/video modal), matching the
// cuts table's CutFilePreview; `stopPropagation` keeps that click from also firing
// the row's navigate-to-detail.
// ============================================================================
function CutThumb({
  file,
  size,
  onOpen,
}: {
  file?: Cut["file"];
  size: number;
  onOpen?: (file: NonNullable<Cut["file"]>) => void;
}) {
  const [errored, setErrored] = useState(false);
  const box = { width: size, height: size };
  const clickable = !!file && !!onOpen;
  return (
    <div
      className={`shrink-0 rounded-md overflow-hidden bg-muted/30 flex items-center justify-center transition-all ${
        clickable ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""
      }`}
      style={box}
      role={clickable ? "button" : undefined}
      title={clickable ? "Abrir arquivo" : undefined}
      onClick={
        clickable
          ? (e) => {
              e.stopPropagation();
              onOpen!(file!);
            }
          : undefined
      }
    >
      {!file ? (
        <IconFileOff className="h-4 w-4 text-muted-foreground/50" />
      ) : errored ? (
        <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
      ) : (
        <img
          src={`${getApiBaseUrl()}/files/thumbnail/${file.id}?size=small`}
          alt={file.filename}
          className="w-full h-full object-contain"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Config schema
// ============================================================================

const cutQueueConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Fila de Corte"),
  accent: makeAccentSchema({ color: "cyan", icon: "Scissors" }),

  // Canonical cross-platform display block. Column headers / search box aren't
  // used by this compact list, so they start off; the widget-specific extras
  // (thumbnail, origin badge, quick-actions) ride alongside via `.and`.
  display: makeTableDisplaySchema({
    showColumnHeaders: false,
    showSearchBox: false,
    showRowDot: false,
    emptyStateMessage: "Nenhum corte na fila.",
  }).and(
    z
      .object({
        showThumbnail: z.boolean().default(true),
        showType: z.boolean().default(true),
        showOrigin: z.boolean().default(true),
        showQuickActions: z.boolean().default(true),
      })
      .default({ showThumbnail: true, showType: true, showOrigin: true, showQuickActions: true }),
  ),

  // Which status groups make up the "queue". Default = the active work
  // (pending + cutting); completed is opt-in.
  statuses: z
    .array(z.nativeEnum(CUT_STATUS))
    .default([CUT_STATUS.PENDING, CUT_STATUS.CUTTING]),

  limit: z.number().int().min(5).max(100).default(20),
});

export type CutQueueConfig = z.infer<typeof cutQueueConfigSchema>;

const DEFAULT_CONFIG: CutQueueConfig = {
  title: "Fila de Corte",
  accent: { color: "cyan", icon: "Scissors" },
  display: {
    ...TABLE_DISPLAY_DEFAULTS,
    showColumnHeaders: false,
    showSearchBox: false,
    showRowDot: false,
    emptyStateMessage: "Nenhum corte na fila.",
    showThumbnail: true,
    showType: true,
    showOrigin: true,
    showQuickActions: true,
  },
  statuses: [CUT_STATUS.PENDING, CUT_STATUS.CUTTING],
  limit: 20,
};

// The queue order — identical to the cuts page so a drag-reorder priority shows
// up here too. statusOrder groups by status, priority is the user order within a
// group, createdAt then id are the stable tiebreaks (matches the cuts page exactly).
const QUEUE_ORDER_BY = [{ statusOrder: "asc" }, { priority: "asc" }, { createdAt: "asc" }, { id: "asc" }];

// ============================================================================
// Render
// ============================================================================

function CutQueueRender({ config }: WidgetRenderProps<CutQueueConfig>) {
  const navigate = useNavigate();
  const { canAccess } = usePrivileges();
  const canManage = canAccess(CUT_STATUS_MANAGERS);
  const { updateAsync } = useCutMutations();
  const fileViewer = useFileViewer();

  // Viewing this widget counts as "entering" the cut queue: it silences the sidebar
  // blink + bip for 30 min, shared with the Recorte page (entering either mutes both).
  useCutQueueAlertPresence();

  const display = config.display;
  const dens = densityClasses(display.density as Density);

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

  const statuses = config.statuses.length > 0 ? config.statuses : [CUT_STATUS.PENDING, CUT_STATUS.CUTTING];

  const params = useMemo(
    () => ({
      status: statuses,
      orderBy: QUEUE_ORDER_BY,
      include: { task: true, file: true },
      limit: config.limit,
      page: 1,
    }),
    [statuses, config.limit],
  );

  const { data, isLoading, isError } = useCuts(
    params as never,
    display.refreshIntervalMs > 0 ? { refetchInterval: display.refreshIntervalMs } : undefined,
  );
  const cuts = useMemo(() => (data as { data?: Cut[] } | undefined)?.data ?? [], [data]);

  // Apply a single status transition (mirrors the cuts page). Stops the row's
  // navigate from firing when a quick-action button is clicked.
  const runTransition = useCallback(
    async (cut: Cut, next: CUT_STATUS) => {
      const patch =
        next === CUT_STATUS.CUTTING
          ? { status: CUT_STATUS.CUTTING, startedAt: new Date() }
          : { status: CUT_STATUS.COMPLETED, completedAt: new Date() };
      try {
        await updateAsync({ id: cut.id, data: patch as never });
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [updateAsync],
  );

  // Taller rows with a larger, easier-to-click file preview.
  const thumbSize = display.density === "compact" ? 40 : display.density === "spacious" ? 56 : 48;
  const rowMinH =
    display.density === "compact" ? "min-h-[52px]" : display.density === "spacious" ? "min-h-[72px]" : "min-h-[62px]";

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-1.5 p-6 text-center text-sm text-muted-foreground">
          <IconAlertTriangle className="h-5 w-5 opacity-60" />
          Erro ao carregar a fila de corte.
        </div>
      );
    }
    if (cuts.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <IconScissors className="h-6 w-6 opacity-40" />
          {display.emptyStateMessage?.trim() || "Nenhum corte na fila."}
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto">
        {cuts.map((cut, i) => {
          const name = cut.task?.name || cut.file?.filename || "—";
          const secondary = cut.task?.name ? cut.file?.filename : undefined;
          const canStart = cut.status === CUT_STATUS.PENDING;
          const canFinish = cut.status === CUT_STATUS.CUTTING;
          return (
            <div
              key={cut.id}
              role="button"
              onClick={() => navigate(routes.production.cutting.details(cut.id))}
              className={`flex items-center gap-2.5 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-secondary/50 ${dens.row} ${rowMinH} ${
                i % 2 === 1 ? "bg-muted/20" : ""
              }`}
            >
              {display.showThumbnail && (
                <CutThumb file={cut.file} size={thumbSize} onOpen={(f) => fileViewer.actions.viewFile(f)} />
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{name}</div>
                {secondary && (
                  <div className="truncate text-[11px] text-muted-foreground">{secondary}</div>
                )}
              </div>

              <Badge variant={getBadgeVariant(cut.status, "CUT")} className="shrink-0 text-[10px] py-0 px-1.5">
                {CUT_STATUS_LABELS[cut.status]}
              </Badge>

              {display.showType && cut.type && (
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] py-0 px-1.5 ${
                    cut.type === CUT_TYPE.STENCIL ? "text-violet-600 dark:text-violet-400" : ""
                  }`}
                >
                  {CUT_TYPE_LABELS[cut.type]}
                </Badge>
              )}

              {display.showOrigin && (
                <Badge
                  variant={getBadgeVariant(cut.origin, "CUT_ORIGIN")}
                  className="shrink-0 text-[10px] py-0 px-1.5"
                >
                  {CUT_ORIGIN_LABELS[cut.origin]}
                </Badge>
              )}

              {cut.file && (
                <button
                  type="button"
                  title="Baixar arquivo"
                  aria-label="Baixar arquivo"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileViewer.actions.downloadFile(cut.file!);
                  }}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <IconDownload className="h-4 w-4" />
                </button>
              )}

              {display.showQuickActions && canManage && (canStart || canFinish) && (
                <button
                  type="button"
                  title={canStart ? "Iniciar corte" : "Finalizar corte"}
                  aria-label={canStart ? "Iniciar corte" : "Finalizar corte"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runTransition(cut, canStart ? CUT_STATUS.CUTTING : CUT_STATUS.COMPLETED);
                  }}
                  className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                    canStart
                      ? "border-blue-500/40 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                      : "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  }`}
                >
                  {canStart ? <IconPlayerPlay className="h-4 w-4" /> : <IconCheck className="h-4 w-4" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <WidgetCard
      showHeader={display.showHeader ?? true}
      title={<span className={accent.classes.text}>{config.title || "Fila de Corte"}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      count={display.showCount && !isLoading ? cuts.length : null}
      viewAllHref={display.showViewAllLink ? routes.production.cutting.list : undefined}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="h-full">{renderBody()}</div>
    </WidgetCard>
  );
}

// ============================================================================
// Config component
// ============================================================================

const STATUS_TOGGLES: Array<{ value: CUT_STATUS; label: string }> = [
  { value: CUT_STATUS.PENDING, label: CUT_STATUS_LABELS[CUT_STATUS.PENDING] },
  { value: CUT_STATUS.CUTTING, label: CUT_STATUS_LABELS[CUT_STATUS.CUTTING] },
  { value: CUT_STATUS.COMPLETED, label: CUT_STATUS_LABELS[CUT_STATUS.COMPLETED] },
];

function CutQueueConfigComponent({ config, onChange }: WidgetConfigProps<CutQueueConfig>) {
  const setDisplay = <K extends keyof CutQueueConfig["display"]>(
    key: K,
    value: CutQueueConfig["display"][K],
  ) => onChange({ ...config, display: { ...config.display, [key]: value } });

  const toggleStatus = (status: CUT_STATUS, on: boolean) => {
    const next = on
      ? Array.from(new Set([...config.statuses, status]))
      : config.statuses.filter((s) => s !== status);
    onChange({ ...config, statuses: next });
  };

  const accentColor = (config.accent?.color ?? "cyan") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Scissors") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const refreshValue = String(config.display.refreshIntervalMs ?? 0);

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar>
          <TabsList className="self-start">
            <TabsTrigger value="appearance" className="gap-1">
              <IconAdjustments className="h-3.5 w-3.5" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-1">
              <IconEye className="h-3.5 w-3.5" /> Exibição
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-1">
              <IconFilter className="h-3.5 w-3.5" /> Filtros
            </TabsTrigger>
          </TabsList>
        </WidgetTabsBar>

        {/* --- Appearance --- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section
              title="Destaque (cor e ícone)"
              icon={<IconAdjustments className="h-3.5 w-3.5" />}
              defaultOpen
            >
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  onChange({
                    ...config,
                    accent: { ...config.accent, color: next.color, icon: next.icon, shade: next.shade },
                  })
                }
              />
            </Section>
            <Section title="Elementos visíveis" icon={<IconEye className="h-3.5 w-3.5" />}>
              <div className="space-y-1">
                <ToggleRow
                  label="Cabeçalho do widget"
                  checked={config.display.showHeader}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label="Contador no cabeçalho"
                  checked={config.display.showCount}
                  onCheckedChange={(v) => setDisplay("showCount", v)}
                />
                <ToggleRow
                  label='Rodapé "Ver todos"'
                  checked={config.display.showViewAllLink}
                  onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* --- Display --- */}
        <TabsContent value="display" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Linhas" icon={<IconScissors className="h-3.5 w-3.5" />} defaultOpen>
              <div className="space-y-1">
                <ToggleRow
                  label="Miniatura do arquivo"
                  hint="Clique na miniatura para abrir o arquivo. O botão de download fica ao lado das ações."
                  checked={config.display.showThumbnail}
                  onCheckedChange={(v) => setDisplay("showThumbnail", v)}
                />
                <ToggleRow
                  label="Badge de tipo"
                  hint="Vinil / Espovo (estêncil)."
                  checked={config.display.showType}
                  onCheckedChange={(v) => setDisplay("showType", v)}
                />
                <ToggleRow
                  label="Badge de origem"
                  hint="Plano de corte / Solicitação — oculto automaticamente em telas estreitas."
                  checked={config.display.showOrigin}
                  onCheckedChange={(v) => setDisplay("showOrigin", v)}
                />
                <ToggleRow
                  label="Ações rápidas (iniciar / finalizar)"
                  hint="Botões inline para quem pode alterar o status do corte."
                  checked={config.display.showQuickActions}
                  onCheckedChange={(v) => setDisplay("showQuickActions", v)}
                />
              </div>
              <DensitySegmented
                value={config.display.density as Density}
                onChange={(d) => setDisplay("density", d)}
              />
            </Section>

            <Section title="Dados" icon={<IconAdjustments className="h-3.5 w-3.5" />}>
              <LimitInput
                value={config.limit}
                min={5}
                max={100}
                onChange={(v) => onChange({ ...config, limit: v })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Atualização automática</Label>
                <Combobox
                  value={refreshValue}
                  onValueChange={(v) =>
                    setDisplay("refreshIntervalMs", Number(v ?? "0") || 0)
                  }
                  options={REFETCH_INTERVAL_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* --- Filters --- */}
        <TabsContent value="filters" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Status na fila" icon={<IconFilter className="h-3.5 w-3.5" />} defaultOpen>
              <div className="space-y-1">
                {STATUS_TOGGLES.map((s) => (
                  <ToggleRow
                    key={s.value}
                    label={s.label}
                    checked={config.statuses.includes(s.value)}
                    onCheckedChange={(on) => toggleStatus(s.value, on)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A ordem segue a prioridade da fila (a mesma da página de Cortes).
              </p>
            </Section>
          </SectionGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Widget definition
// ============================================================================

export const cutQueueWidget: WidgetDefinition<CutQueueConfig> = {
  id: "production.cut-queue",
  name: "Fila de Corte",
  description:
    "Fila de cortes na ordem de prioridade (a mesma da página de Cortes) — miniatura do arquivo, status e origem, com ações rápidas de iniciar/finalizar. Ideal para plotagem e almoxarifado verem o que cortar em seguida.",
  icon: IconScissors,
  category: "production",
  // Cut executors only: plotting + warehouse run the queue; ADMIN always bypasses.
  allowedSectors: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.WAREHOUSE],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: cutQueueConfigSchema,
  defaultConfig: DEFAULT_CONFIG,
  RenderComponent: CutQueueRender,
  ConfigComponent: CutQueueConfigComponent,
};
