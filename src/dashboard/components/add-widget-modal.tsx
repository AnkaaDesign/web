// Widget picker. Category tabs + colored card grid.
// Filters automatically by user's sector. Search across name/description.

import { useMemo, useState } from "react";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { WidgetConfigDialog } from "./config-kit";
import { IconSearch, IconStar } from "@tabler/icons-react";
import { usePrivileges } from "../../hooks/common/use-privileges";
import { widgetRegistry } from "../registry";
import { WIDGET_CATEGORY_LABELS } from "../types";
import type { WidgetCategory, WidgetDefinition } from "../types";

interface AddWidgetModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (widgetId: string) => void;
}

type TabKey = "all" | WidgetCategory;

// Per-category palette — chosen so each WidgetCategory is visually distinct
// at a glance. All tokens use Tailwind palette names that are already used
// elsewhere in the codebase, with explicit dark-mode variants so contrast
// holds in both themes.
interface CategoryPalette {
  /** Top accent stripe shown across the card head. */
  stripe: string;
  /** Soft tinted background for the icon tile. */
  iconBg: string;
  /** Icon stroke color. */
  iconText: string;
  /** Badge background + text used for the in-card category pill. */
  badge: string;
  /** Subtle hover-state border accent. */
  hoverBorder: string;
}

const CATEGORY_PALETTE: Record<WidgetCategory, CategoryPalette> = {
  inventory: {
    stripe: "bg-emerald-500/80 dark:bg-emerald-400/80",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconText: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    hoverBorder: "group-hover:border-emerald-500/50 dark:group-hover:border-emerald-400/50",
  },
  hr: {
    stripe: "bg-violet-500/80 dark:bg-violet-400/80",
    iconBg: "bg-violet-500/10 dark:bg-violet-400/10",
    iconText: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    hoverBorder: "group-hover:border-violet-500/50 dark:group-hover:border-violet-400/50",
  },
  production: {
    stripe: "bg-amber-500/80 dark:bg-amber-400/80",
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconText: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    hoverBorder: "group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50",
  },
  financial: {
    stripe: "bg-blue-500/80 dark:bg-blue-400/80",
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    hoverBorder: "group-hover:border-blue-500/50 dark:group-hover:border-blue-400/50",
  },
  other: {
    stripe: "bg-sky-500/80 dark:bg-sky-400/80",
    iconBg: "bg-sky-500/10 dark:bg-sky-400/10",
    iconText: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    hoverBorder: "group-hover:border-sky-500/50 dark:group-hover:border-sky-400/50",
  },
};

export function AddWidgetModal({ open, onClose, onAdd }: AddWidgetModalProps) {
  const { currentPrivilege } = usePrivileges();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");

  const allWidgets = useMemo(
    () => widgetRegistry.getAvailableWidgets(currentPrivilege),
    [currentPrivilege],
  );

  // Categories that actually have widgets the user can use — others are hidden as tabs.
  const availableCategories = useMemo(() => {
    const seen = new Set<WidgetCategory>();
    for (const w of allWidgets) seen.add(w.category);
    // Preserve declaration order from WIDGET_CATEGORY_LABELS
    return (Object.keys(WIDGET_CATEGORY_LABELS) as WidgetCategory[]).filter((c) => seen.has(c));
  }, [allWidgets]);

  const filteredWidgets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allWidgets.filter((w) => {
      if (tab !== "all" && w.category !== tab) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
      );
    });
  }, [allWidgets, tab, query]);

  const handlePick = (widgetId: string) => {
    onAdd(widgetId);
    onClose();
  };

  return (
    <WidgetConfigDialog
      open={open}
      onOpenChange={(v) => (!v ? onClose() : undefined)}
      title="Adicionar widget"
      description="Escolha um widget para adicionar ao seu painel. Apenas widgets disponíveis para o seu setor são exibidos."
      headerExtra={
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(v) => setQuery(typeof v === "string" ? v : "")}
              placeholder="Buscar widgets..."
              className="pl-9"
              autoFocus
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            {/* min-h reserves vertical space so the body below stays anchored
                even if the wrap behavior changes between tab counts. */}
            <TabsList className="h-auto min-h-9 flex flex-wrap justify-start gap-1 p-1 bg-muted/60 w-full">
              <TabsTrigger value="all" className="text-xs h-8">
                Todos
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                  {allWidgets.length}
                </span>
              </TabsTrigger>
              {availableCategories.map((cat) => {
                const count = allWidgets.filter((w) => w.category === cat).length;
                return (
                  <TabsTrigger key={cat} value={cat} className="text-xs h-8">
                    {WIDGET_CATEGORY_LABELS[cat]}
                    <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{count}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      }
    >
      {filteredWidgets.length === 0 ? (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground py-12">
          <IconStar className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">Nenhum widget encontrado.</p>
          {query && (
            <p className="text-xs mt-1">
              Tente outro termo de busca ou mude de categoria.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredWidgets.map((w) => (
            <WidgetGalleryCard key={w.id} widget={w} onPick={() => handlePick(w.id)} />
          ))}
        </div>
      )}
    </WidgetConfigDialog>
  );
}

function WidgetGalleryCard({
  widget,
  onPick,
}: {
  widget: WidgetDefinition;
  onPick: () => void;
}) {
  const Icon = widget.icon;
  const palette = CATEGORY_PALETTE[widget.category];
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group relative min-h-[200px] rounded-xl border border-border bg-card hover:bg-accent/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-all overflow-hidden flex flex-col text-left ${palette.hoverBorder}`}
      title={widget.description}
    >
      <div className={`h-1.5 w-full shrink-0 ${palette.stripe}`} />
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`rounded-lg p-2.5 shrink-0 ${palette.iconBg} ${palette.iconText}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${palette.badge}`}
          >
            {WIDGET_CATEGORY_LABELS[widget.category]}
          </span>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-base font-semibold leading-snug text-foreground line-clamp-2">
            {widget.name}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
            {widget.description}
          </p>
        </div>
      </div>
    </button>
  );
}
