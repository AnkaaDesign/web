import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDebounce } from "@/hooks/common/use-debounce";
import { searchService } from "@/api-client";
import { getBadgeVariant } from "@/constants";
import { getIconInfoByPath } from "@/utils/page-icons";
import { formatDate } from "@/utils/date";
import type { GlobalSearchGroup, GlobalSearchResultItem } from "@/types";
import { SPOTLIGHT_ENTITIES } from "./spotlight-entities";
import { useSpotlightShortcut, IS_MAC } from "./use-spotlight-shortcut";
import { HighlightedText, windowAroundMatch } from "./highlighted-text";
import {
  loadHistory,
  recordSelection,
  removeFromHistory,
  getRecent,
  frecencyBoost,
  entityAffinity,
  type SpotlightEntry,
  type SpotlightHistoryEntry,
} from "./spotlight-history";

const MIN_QUERY_LENGTH = 2;

type SpotlightRowData = SpotlightEntry & Partial<Pick<GlobalSearchResultItem, "date" | "extra" | "match">>;

interface SpotlightSection {
  label: string;
  rows: SpotlightRowData[];
  /** Rows can be removed (recents). */
  removable?: boolean;
}

const normalizeTokens = (query: string): string[] =>
  query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function SpotlightRow({
  item,
  tokens,
  index,
  active,
  onActivate,
  onSelect,
  onRemove,
}: {
  item: SpotlightRowData;
  tokens: string[];
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
  onSelect: (item: SpotlightRowData) => void;
  onRemove?: (item: SpotlightRowData) => void;
}) {
  const meta = SPOTLIGHT_ENTITIES[item.entity];
  const { icon: Icon, color } = getIconInfoByPath(meta.detailRoute(item.id));
  // The matched hidden field (Orçamento Nº, Chassi, CPF, Tinta...) renders
  // inline with the identity fields; its value is windowed around the matched
  // fragment so truncation never hides WHY the row appeared.
  const rowFields = [...(item.fields ?? []), ...(item.match ? [{ label: item.match.label, value: windowAroundMatch(item.match.value, tokens) }] : [])];
  const statusLabel = item.statusLabel ?? (item.status ? meta.statusLabels?.[item.status] : undefined);
  const statusVariant = (item.statusVariant as BadgeProps["variant"]) ?? (item.status ? getBadgeVariant(item.status, meta.badgeEntity) : "default");

  return (
    <div
      role="option"
      aria-selected={active}
      data-spotlight-index={index}
      className={cn("flex cursor-pointer select-none items-start gap-3 rounded-sm px-2 py-2", active && "bg-muted")}
      onMouseMove={() => onActivate(index)}
      onClick={() => onSelect(item)}
    >
      {item.entity === "PAINT" && item.color ? (
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-border shadow-sm" style={{ backgroundColor: item.color }} />
      ) : (
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            <HighlightedText text={item.title} tokens={tokens} />
          </span>
          {item.extra && (
            <Badge variant="secondary" size="sm" className="shrink-0">
              {item.extra}
            </Badge>
          )}
          {statusLabel && (
            <Badge variant={statusVariant} size="sm" className="shrink-0">
              {statusLabel}
            </Badge>
          )}
        </div>

        {(rowFields.length > 0 || item.date) && (
          <div className="mt-0.5 flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className="flex min-w-0 flex-1 items-baseline overflow-hidden whitespace-nowrap">
              {rowFields.map((field, fieldIndex) => (
                <span key={fieldIndex} className="flex min-w-0 items-baseline">
                  {fieldIndex > 0 && <span className="mx-1 shrink-0 text-muted-foreground/50">·</span>}
                  {field.label && <span className="shrink-0 text-muted-foreground/60">{field.label}&nbsp;</span>}
                  <span className="min-w-0 max-w-52 truncate" title={field.value}>
                    <HighlightedText text={field.value} tokens={tokens} />
                  </span>
                </span>
              ))}
            </span>
            {item.date && (
              <span className="shrink-0 text-[11px]">
                {item.date.label} {formatDate(item.date.iso)}
              </span>
            )}
          </div>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          aria-label="Remover dos recentes"
          className={cn("mt-1 shrink-0 rounded p-1 text-muted-foreground/50 hover:bg-background/60 hover:text-foreground", !active && "opacity-0")}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item);
          }}
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function SpotlightSearch() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [history, setHistory] = useState<SpotlightHistoryEntry[]>(loadHistory);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 250);
  const trimmed = debouncedQuery.trim();
  const searchEnabled = open && trimmed.length >= MIN_QUERY_LENGTH;
  const tokens = useMemo(() => normalizeTokens(trimmed), [trimmed]);

  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) setQuery("");
      return !wasOpen;
    });
  }, []);

  useSpotlightShortcut(toggleOpen, isAuthenticated);

  const { data, isFetching } = useQuery({
    queryKey: ["spotlight-search", trimmed],
    queryFn: () => searchService.globalSearch({ searchingFor: trimmed }),
    enabled: searchEnabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const recentEntries = useMemo(() => getRecent(history), [history]);

  // Frecency: results the user opens often (and recently) float above cold
  // ones; groups the user favors get a small affinity boost on top of the
  // server's best-hit ordering.
  const sections: SpotlightSection[] = useMemo(() => {
    if (!searchEnabled) {
      return recentEntries.length > 0 ? [{ label: "Recentes", rows: recentEntries, removable: true }] : [];
    }
    const groups: GlobalSearchGroup[] = data?.data?.groups ?? [];
    return groups
      .map((group) => ({
        group,
        rows: [...group.items].sort((a, b) => b.score + frecencyBoost(history, b.entity, b.id) - (a.score + frecencyBoost(history, a.entity, a.id))),
      }))
      .sort((a, b) => {
        const bestA = (a.rows[0]?.score ?? 0) + frecencyBoost(history, a.group.entity, a.rows[0]?.id ?? "") + entityAffinity(history, a.group.entity);
        const bestB = (b.rows[0]?.score ?? 0) + frecencyBoost(history, b.group.entity, b.rows[0]?.id ?? "") + entityAffinity(history, b.group.entity);
        return bestB - bestA;
      })
      .map(({ group, rows }) => ({ label: group.label, rows }));
  }, [searchEnabled, data, history, recentEntries]);

  const flatRows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);

  // Always keep one row highlighted; snap back to the first whenever the
  // visible result set changes (typing, results arriving, opening).
  const rowsSignature = useMemo(() => flatRows.map((row) => `${row.entity}:${row.id}`).join("|"), [flatRows]);
  useEffect(() => {
    setActiveIndex(0);
  }, [rowsSignature, open]);

  // Keep the highlighted row visible while navigating with the keyboard.
  useEffect(() => {
    const element = listRef.current?.querySelector(`[data-spotlight-index="${activeIndex}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (item: SpotlightRowData) => {
      const entry: SpotlightEntry = {
        entity: item.entity,
        id: item.id,
        title: item.title,
        fields: item.fields ?? null,
        status: item.status,
        statusLabel: item.statusLabel,
        statusVariant: item.statusVariant,
        color: item.color,
      };
      setHistory((previous) => recordSelection(previous, entry));
      setOpen(false);
      navigate(SPOTLIGHT_ENTITIES[item.entity].detailRoute(item.id));
    },
    [navigate],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (flatRows.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % flatRows.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + flatRows.length) % flatRows.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const active = flatRows[activeIndex];
        if (active) handleSelect(active);
      }
    },
    [flatRows, activeIndex, handleSelect],
  );

  if (!isAuthenticated) return null;

  const hasResults = flatRows.length > 0;
  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="top-[15%] max-w-3xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <div onKeyDown={handleKeyDown}>
          <div className="relative flex items-center border-b border-border px-3">
            <IconSearch className="mr-2 h-5 w-5 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tarefas, produtos, pedidos, colaboradores, tintas..."
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            {isFetching && searchEnabled && <IconLoader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />}
          </div>

          <div ref={listRef} role="listbox" className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2">
            {!searchEnabled && !hasResults && (
              <div className="py-10 text-center text-sm text-muted-foreground">Digite pelo menos {MIN_QUERY_LENGTH} caracteres para buscar em todo o sistema</div>
            )}

            {searchEnabled && !hasResults && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {isFetching ? (
                  "Buscando..."
                ) : (
                  <>
                    Nenhum resultado para <span className="font-medium text-foreground">“{trimmed}”</span>
                  </>
                )}
              </div>
            )}

            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{section.label}</div>
                {section.rows.map((item) => {
                  flatIndex++;
                  const index = flatIndex;
                  return (
                    <SpotlightRow
                      key={`${item.entity}:${item.id}`}
                      item={item}
                      tokens={searchEnabled ? tokens : []}
                      index={index}
                      active={index === activeIndex}
                      onActivate={setActiveIndex}
                      onSelect={handleSelect}
                      onRemove={section.removable ? (row) => setHistory((previous) => removeFromHistory(previous, row.entity, row.id)) : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navegar
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> abrir
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> fechar
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>{IS_MAC ? "⇧" : "Shift"}</Kbd>
              <Kbd>F</Kbd> para abrir
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
