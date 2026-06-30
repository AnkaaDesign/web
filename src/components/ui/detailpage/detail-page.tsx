import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { IconChevronLeft, IconChevronRight, IconDownload, IconFileText, IconTable, IconLink } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader, type PageAction } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useScrollHideHeader, exportToPdf, exportToXlsx, copyShareLink } from "@/components/ui/datatable";
import type { DataTableColumnDef, ExportCellValue } from "@/components/ui/datatable";
import type { FAVORITE_PAGES, SECTOR_PRIVILEGES } from "@/constants";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { cn } from "@/lib/utils";
import { useDetailLayout } from "./use-detail-layout";
import { useRecordNavigation } from "./use-record-navigation";
import { DetailSection } from "./detail-section";
import { DetailCustomizeManager } from "./detail-customize-manager";
import type { DetailSectionDef, PersistedDetailConfig } from "./detail-page-types";

/**
 * Per-sector default layout overrides for a detail page, keyed by the user's single sector
 * privilege. Applied with precedence localStorage > server config > SECTOR DEFAULT > hardcoded
 * section/field defaults — never over a user's saved or interacted-with layout. Omit a key
 * (e.g. ADMIN) to fall back to the hardcoded defaults for it.
 */
export type SectorDetailDefaults = Partial<Record<SECTOR_PRIVILEGES, Partial<PersistedDetailConfig>>>;
import { balanceColumns } from "./pack-rows";

/** True at the Tailwind `lg` breakpoint (≥1024px) — below it, sections render flat in order. */
function useIsLgUp(): boolean {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches));
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return matches;
}

export interface DetailPageNavigation {
  /** Ordered ids of the list (from `location.state.ids`) for prev/next paging. */
  ids?: string[];
  /** Build the detail route for a given id. */
  toRoute: (id: string) => string;
  /** Prefetch neighbours (e.g. `queryClient.prefetchQuery` on the detail key). */
  onPrefetch?: (id: string) => void;
}

export interface DetailPageProps<TData> {
  /** Stable persistence key for this detail-page type (e.g. "order-detail"). */
  detailKey: string;
  data: TData | null | undefined;
  isLoading?: boolean;
  error?: ReactNode;
  emptyMessage?: ReactNode;
  sections: DetailSectionDef<TData>[];
  /** Read the record id (for prev/next). Defaults to `data.id`. */
  getRecordId?: (row: TData) => string;

  // --- header ---
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  icon?: TablerIcon;
  favoritePage?: FAVORITE_PAGES;
  status?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline"; icon?: TablerIcon };
  backButton?: { label?: string; href?: string; onClick?: () => void };
  /** Extra page actions, appended after the built-in nav/customize/export controls. */
  actions?: PageAction[];

  // --- features ---
  navigation?: DetailPageNavigation;
  persist?: boolean;
  /**
   * Per-sector STARTING defaults (visible/ordered sections, widths, etc.), keyed by the user's single
   * sector privilege. Applied with precedence localStorage > server config > SECTOR DEFAULT > hardcoded
   * section/field defaults — so it NEVER overrides a user's saved or interacted-with layout.
   */
  sectorDefaults?: SectorDetailDefaults;
  enableCustomize?: boolean;
  enableExport?: boolean;
  exportTitle?: string;
  exportFilename?: string;
  scrollHideHeader?: boolean;
  /** Hide fields with no value (instead of rendering a "—" row). */
  hideEmptyFields?: boolean;
  pageClassName?: string;
}

/**
 * The canonical "detail page": a collapsing-on-scroll header with built-in prev/next
 * record navigation, a "Gerenciar seções" manager (reorder / show-hide / width+column / fields),
 * and optional record export — over a responsive, privilege-gated, inline-editable section grid whose
 * per-user layout persists to Preferences.detailConfigsWeb. The detail-page analog of
 * `DataTablePage`.
 */
export function DetailPage<TData>({
  detailKey,
  data,
  isLoading,
  error,
  emptyMessage = "Registro não encontrado.",
  sections,
  getRecordId,
  title,
  subtitle,
  breadcrumbs,
  icon,
  favoritePage,
  status,
  backButton,
  actions,
  navigation,
  persist = true,
  sectorDefaults,
  enableCustomize = true,
  enableExport = false,
  exportTitle,
  exportFilename,
  scrollHideHeader = true,
  hideEmptyFields = false,
  pageClassName,
}: DetailPageProps<TData>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  useScrollHideHeader({ scrollRef, headerRef, enabled: scrollHideHeader });

  // Resolve this user's sector starting defaults (null until the privilege loads; the hook's
  // sector-default effect waits for `isAuthenticated` before applying it).
  const { currentPrivilege } = usePrivileges();
  const sectorDefault = currentPrivilege ? sectorDefaults?.[currentPrivilege] : undefined;
  const layout = useDetailLayout<TData>({ detailKey, sections, persist, sectorDefault });
  const isLgUp = useIsLgUp();

  const recordId = data ? (getRecordId ? getRecordId(data) : String((data as { id?: unknown }).id ?? "")) : "";
  const nav = useRecordNavigation({
    ids: navigation?.ids,
    currentId: recordId,
    toRoute: navigation?.toRoute ?? (() => ""),
    onPrefetch: navigation?.onPrefetch,
    enabled: !!navigation && !!recordId,
  });

  const runExport = async (format: "pdf" | "xlsx") => {
    if (!data) return;
    const columns: DataTableColumnDef<TData>[] = [];
    for (const s of layout.orderedSections) {
      for (const f of s.fields) {
        if (f.excludeFromExport) continue;
        const headerText = typeof f.label === "string" ? f.label : f.id;
        columns.push({
          id: f.id,
          header: headerText,
          meta: {
            exportHeader: headerText,
            exportValue: (r: TData): ExportCellValue => {
              if (f.exportValue) return f.exportValue(r);
              const v = f.accessor ? f.accessor(r) : f.edit?.get(r);
              if (v == null) return undefined;
              if (v instanceof Date) return v;
              if (Array.isArray(v)) return v as ExportCellValue;
              if (typeof v === "object") return JSON.stringify(v);
              return v as string | number | boolean;
            },
          },
        } as DataTableColumnDef<TData>);
      }
    }
    const req = {
      rows: [data],
      columns,
      filename: exportFilename ?? detailKey,
      title: exportTitle ?? (typeof title === "string" ? title : detailKey),
    };
    try {
      if (format === "pdf") await exportToPdf(req);
      else await exportToXlsx(req);
    } catch {
      toast.error("Falha ao exportar.");
    }
  };

  // Built-in header controls (rendered verbatim via PageAction's ReactNode-label slot).
  const builtin: PageAction[] = [];
  if (navigation && nav.total > 0) {
    builtin.push({
      key: "record-nav",
      hideOnMobile: true,
      label: (
        <div className="flex items-center gap-1">
          {/* h-9 w-9 to match the "Seções" trigger (size="sm" = h-9) sitting beside it. */}
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={!nav.hasPrev} onClick={nav.goPrev} title="Anterior (←)">
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3.5rem] px-1 text-center text-sm tabular-nums text-muted-foreground">
            {nav.position} / {nav.total}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={!nav.hasNext} onClick={nav.goNext} title="Próximo (→)">
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    });
  }
  if (enableCustomize) {
    builtin.push({
      key: "customize",
      hideOnMobile: true,
      label: (
        <DetailCustomizeManager
          sections={layout.managerSections}
          sectionOrder={layout.sectionOrder}
          onSectionOrderChange={layout.setSectionOrder}
          onToggleSection={layout.toggleSection}
          onToggleField={layout.toggleField}
          onSetWidth={layout.setSectionWidth}
          onSetColumn={layout.setSectionColumn}
          onFieldOrderChange={layout.setSectionFieldOrder}
          onSetAll={layout.setAllSections}
          onReset={layout.resetLayout}
          visibleCount={layout.visibleCount}
          totalCount={layout.totalCount}
        />
      ),
    });
  }
  if (enableExport) {
    builtin.push({
      key: "export",
      hideOnMobile: true,
      label: (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={!data}>
              <IconDownload className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => runExport("pdf")}>
              <IconFileText className="mr-2 h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExport("xlsx")}>
              <IconTable className="mr-2 h-4 w-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                copyShareLink();
                toast.success("Link copiado.");
              }}
            >
              <IconLink className="mr-2 h-4 w-4" />
              Copiar link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });
  }
  const allActions: PageAction[] = [...builtin, ...(actions ?? [])];

  let content: ReactNode;
  if (isLoading) {
    content = (
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
    );
  } else if (!data) {
    content = (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  } else if (!isLgUp) {
    // Below lg: flat, full-width, in the user's configured order (no column shuffle).
    const row = data;
    content = (
      <div className="space-y-4">
        {layout.orderedSections.map((s) => (
          <DetailSection key={s.def.id} section={s} row={row} hideEmptyFields={hideEmptyFields} />
        ))}
      </div>
    );
  } else {
    const row = data;
    // Full-width (span 2) sections get their own full-width row; each run of consecutive half-width
    // sections becomes a 2-column masonry — cards at their NATURAL height, balanced by column.
    type Sec = (typeof layout.orderedSections)[number];
    const blocks: Array<{ kind: "full"; section: Sec } | { kind: "rows"; sections: Sec[] }> = [];
    for (const s of layout.orderedSections) {
      if (s.span === 2) {
        blocks.push({ kind: "full", section: s });
      } else {
        const last = blocks[blocks.length - 1];
        if (last && last.kind === "rows") last.sections.push(s);
        else blocks.push({ kind: "rows", sections: [s] });
      }
    }
    // A half-width section left ALONE in its band — e.g. a sector that only sees one of a default
    // half-width pair (warehouse on the order detail sees `info` but not `payment`) — renders
    // full-width instead of a lopsided card with an empty column beside it. An EXPLICIT ½← / ½→ pin
    // (`column` set) is still honored, so this only cleans up the auto-balanced default.
    const normalized = blocks.map((b) =>
      b.kind === "rows" && b.sections.length === 1 && !b.sections[0].column
        ? ({ kind: "full" as const, section: b.sections[0] })
        : b,
    );
    content = (
      <div className="space-y-4">
        {normalized.map((b, i) => {
          if (b.kind === "full") return <DetailSection key={b.section.def.id} section={b.section} row={row} hideEmptyFields={hideEmptyFields} />;
          const { left, right } = balanceColumns(b.sections);
          // A half-width section ALWAYS renders at half width — honoring the user's explicit ½←/½→
          // choice — even when it's alone in its band (the opposite column simply stays empty). Sibling
          // cards in a band are EQUAL height: the row is `items-stretch` so the two columns match the
          // taller one, and each card (`grow` + `CardContent flex-1`, see detail-section.tsx) fills its
          // cell with content top-aligned (extra space becomes plain bottom padding — a clean grid look).
          return (
            <div key={`rows-${i}`} className="flex items-stretch gap-4">
              {[left, right].map((col, ci) => (
                <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
                  {col.map((s) => (
                    <DetailSection key={s.def.id} section={s} row={row} hideEmptyFields={hideEmptyFields} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col bg-background p-4", pageClassName)}>
      <div
        ref={headerRef}
        data-hidden="false"
        className="grid shrink-0 grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out will-change-[grid-template-rows] data-[hidden=true]:grid-rows-[0fr]"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3">
            <PageHeader
              variant="detail"
              title={title}
              subtitle={subtitle}
              breadcrumbs={breadcrumbs}
              icon={icon}
              favoritePage={favoritePage}
              status={status}
              backButton={backButton}
              actions={allActions}
            />
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="pb-6">{content}</div>
      </div>
    </div>
  );
}
