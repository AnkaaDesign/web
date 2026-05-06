// Widget picker. Category tabs + square card grid.
// Filters automatically by user's sector. Search across name/description.

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ScrollArea } from "../../components/ui/scroll-area";
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
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle>Adicionar widget</DialogTitle>
          <DialogDescription>
            Escolha um widget para adicionar ao seu painel. Apenas widgets disponíveis para o
            seu setor são exibidos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(v) => setQuery(typeof v === "string" ? v : "")}
            placeholder="Buscar widgets..."
            className="pl-9"
            autoFocus
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="shrink-0">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1 bg-muted/60">
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

        <ScrollArea className="flex-1 min-h-0 -mr-2 pr-2">
          {filteredWidgets.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground py-12">
              <IconStar className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">Nenhum widget encontrado.</p>
              {query && (
                <p className="text-xs mt-1">
                  Tente outro termo de busca ou mude de categoria.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-2">
              {filteredWidgets.map((w) => (
                <WidgetCard key={w.id} widget={w} onPick={() => handlePick(w.id)} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function WidgetCard({ widget, onPick }: { widget: WidgetDefinition; onPick: () => void }) {
  const Icon = widget.icon;
  return (
    <button
      type="button"
      onClick={onPick}
      // NOTE: in this theme, --accent === --primary (same green) in dark mode.
      // We use bg-secondary for the hover background so the foreground stays
      // legible, then flip the icon to filled-primary for visual feedback.
      className="group relative aspect-square rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-all p-3 flex flex-col items-start text-left overflow-hidden"
      title={widget.description}
    >
      <div className="rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground p-2.5 mb-2 transition-all">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-h-0 w-full">
        <div className="text-sm font-semibold leading-tight line-clamp-2 text-foreground">
          {widget.name}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3 leading-tight">
          {widget.description}
        </p>
      </div>
      <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
        {WIDGET_CATEGORY_LABELS[widget.category]}
      </div>
    </button>
  );
}
