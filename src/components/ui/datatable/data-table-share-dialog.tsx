import { useEffect, useMemo, useState } from "react";
import { IconFileTypeXls, IconFileTypePdf, IconSearch, IconGripVertical } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { notify } from "@/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { exportToXlsx, exportToPdf } from "./data-table-export";
import { columnHeaderText } from "./data-table-utils";
import type { DataTableColumnDef, ExportCellValue } from "./data-table-types";

export type ShareFormat = "pdf" | "xlsx";

/** Which rows to export. */
type ExportScope = "selected" | "page" | "all";

/**
 * One row in the dialog's column picker. A plain column yields a single entry; a column that
 * declares `meta.exportVariants` yields the base entry plus one extra entry per variant. Every
 * entry derived from the same column exports under that column's header — only `exportValue`
 * (and the picker `label`) differ.
 */
interface PickerEntry<TData> {
  /** Unique picker/order id — the base column id, or `${colId}::${variantId}` for a variant. */
  id: string;
  /** Text shown in the picker (base: the column header; variant: the variant's label). */
  label: string;
  /** The source column (supplies the export header, accessor, etc.). */
  col: DataTableColumnDef<TData>;
  /** Variant-only value override; absent ⇒ the column's default `exportValue` is used. */
  exportValue?: (row: TData) => ExportCellValue;
}

interface DataTableShareDialogProps<TData> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which file the user chose in the share popover — drives the title + confirm button. */
  format: ShareFormat;
  columns: DataTableColumnDef<TData>[];
  visibleColumnIds: string[];
  /** Rows on the current page. */
  pageRows: TData[];
  /** Currently-loaded selected rows (current page in server mode); used as a sync fallback. */
  selectedRows: TData[];
  /**
   * Total selected across all pages. Defaults to `selectedRows.length`. In server mode the full
   * selection (from the URL `sel` param) can exceed the loaded rows, so the page passes the real
   * count here to label the "Selecionados" scope correctly.
   */
  selectedCount?: number;
  /**
   * Resolve the FULL selection across all pages (server mode fetches unloaded selected rows).
   * Absent ⇒ the "Selecionados" scope exports `selectedRows` as-is.
   */
  resolveSelectedRows?: () => Promise<TData[]>;
  /** Total rows matching the active search/filters — the label/scope for "all". */
  totalCount: number;
  /**
   * Resolve EVERY filtered row across all pages (client: in-memory pre-pagination model; server: a
   * fetch-all request). Absent ⇒ the "Todos" scope isn't offered.
   */
  resolveAllRows?: () => Promise<TData[]>;
  title: string;
  filename: string;
}

/**
 * A single draggable + checkable column row, mirroring the column-visibility manager: a grip
 * handle for reorder, a checkbox, and the header label.
 */
function ShareColumnRow({
  id,
  label,
  checked,
  onToggle,
  dragDisabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragDisabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted"
    >
      <span
        {...attributes}
        {...listeners}
        className={cn("shrink-0", dragDisabled ? "text-muted-foreground/30" : "cursor-grab text-muted-foreground active:cursor-grabbing")}
      >
        <IconGripVertical className="h-4 w-4" />
      </span>
      <Checkbox checked={checked} onCheckedChange={(c) => onToggle(c === true)} />
      <span onClick={() => onToggle(!checked)} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
        {label}
      </span>
    </div>
  );
}

/**
 * Column-selection modal shown AFTER the user picks PDF or XLSX in the share
 * popover. The column list mirrors the column-visibility manager (search +
 * select-all/none + a drag-to-reorder checkbox list) so the two pickers feel
 * identical. Current visible columns are pre-checked; respects row selection.
 */
export function DataTableShareDialog<TData>({
  open,
  onOpenChange,
  format,
  columns,
  visibleColumnIds,
  pageRows,
  selectedRows,
  selectedCount: selectedCountProp,
  resolveSelectedRows,
  totalCount,
  resolveAllRows,
  title,
  filename,
}: DataTableShareDialogProps<TData>) {
  const exportable = useMemo(() => columns.filter((c) => !c.meta?.excludeFromExport), [columns]);
  // Flatten columns into picker entries: each column contributes its base entry plus one extra
  // entry per `meta.exportVariants` item (e.g. exact vs. floored quantity).
  const entries = useMemo(() => {
    const out: PickerEntry<TData>[] = [];
    for (const c of exportable) {
      out.push({ id: c.id, label: columnHeaderText(c), col: c });
      for (const v of c.meta?.exportVariants ?? []) {
        out.push({ id: `${c.id}::${v.id}`, label: v.label, col: c, exportValue: v.exportValue });
      }
    }
    return out;
  }, [exportable]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(visibleColumnIds));
  // Chosen export order (entry ids). Initialised to the table's current column order.
  const [columnOrder, setColumnOrder] = useState<string[]>(() => entries.map((e) => e.id));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedCount = selectedCountProp ?? selectedRows.length;
  // Scope defaults to the selection if any, else ALL filtered rows when available (restores the
  // legacy "all data" export default), else the current page.
  const [scope, setScope] = useState<ExportScope>("page");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (open) {
      setSelected(new Set(visibleColumnIds.length ? visibleColumnIds : exportable.map((c) => c.id)));
      setColumnOrder(entries.map((e) => e.id));
      setSearch("");
      setScope(selectedCount > 0 ? "selected" : resolveAllRows ? "all" : "page");
    }
  }, [open, visibleColumnIds, exportable, entries, selectedCount, resolveAllRows]);

  const orderedEntries = useMemo(() => {
    const idx = new Map(columnOrder.map((id, i) => [id, i] as const));
    return [...entries].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
  }, [entries, columnOrder]);

  const filtered = useMemo(
    () => (search ? orderedEntries.filter((e) => e.label.toLowerCase().includes(search.toLowerCase())) : orderedEntries),
    [orderedEntries, search],
  );
  const dragDisabled = search.length > 0;

  const chosenEntries = useMemo(() => orderedEntries.filter((e) => selected.has(e.id)), [orderedEntries, selected]);
  const isXlsx = format === "xlsx";

  // Materialise the chosen entries into export columns (in the chosen order). A variant entry
  // clones its source column with the variant's `exportValue`, keeping the column's export header.
  const resolveExportColumns = (): DataTableColumnDef<TData>[] =>
    chosenEntries.map((e) => (e.exportValue ? { ...e.col, id: e.id, meta: { ...e.col.meta, exportValue: e.exportValue } } : e.col));

  const handleDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = columnOrder.indexOf(String(active.id));
    const to = columnOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setColumnOrder(arrayMove(columnOrder, from, to));
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const doExport = async () => {
    if (!chosenEntries.length) return notify.error("Atenção", "Selecione ao menos uma coluna.");
    setBusy(true);
    try {
      // Resolve the rows for the chosen scope. "selected" and "all" may be async (server-mode
      // fetch of rows not loaded on the current page).
      const rows =
        scope === "selected"
          ? resolveSelectedRows
            ? await resolveSelectedRows()
            : selectedRows
          : scope === "all" && resolveAllRows
            ? await resolveAllRows()
            : pageRows;
      if (!rows.length) {
        notify.error("Atenção", "Nenhum registro para exportar.");
        return;
      }
      const req = { rows, columns: resolveExportColumns(), filename, title };
      if (isXlsx) await exportToXlsx(req);
      else await exportToPdf(req);
      notify.success("Exportado", `${rows.length} registro(s) exportado(s) com sucesso.`);
      onOpenChange(false);
    } catch {
      notify.error("Erro", "Falha ao gerar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isXlsx ? <IconFileTypeXls className="h-5 w-5 text-primary" /> : <IconFileTypePdf className="h-5 w-5 text-primary" />}
            {isXlsx ? "Exportar planilha (XLSX)" : "Exportar PDF"}
          </DialogTitle>
          <DialogDescription>
            {scope === "selected"
              ? `${selectedCount} linha(s) selecionada(s) serão exportadas.`
              : scope === "all"
                ? `Todos os ${totalCount} registro(s) que correspondem aos filtros serão exportados.`
                : `${pageRows.length} registro(s) da página atual serão exportados.`}
          </DialogDescription>
        </DialogHeader>

        {/* Export scope — selected / current page / all filtered rows. */}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Registros</span>
          <div className="flex gap-2">
            {selectedCount > 0 && (
              <Button
                type="button"
                variant={scope === "selected" ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => setScope("selected")}
              >
                Selecionados ({selectedCount})
              </Button>
            )}
            <Button
              type="button"
              variant={scope === "page" ? "default" : "outline"}
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => setScope("page")}
            >
              Página atual ({pageRows.length})
            </Button>
            {resolveAllRows && (
              <Button
                type="button"
                variant={scope === "all" ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => setScope("all")}
              >
                Todos ({totalCount})
              </Button>
            )}
          </div>
        </div>

        {/* Column picker — same layout as the column-visibility manager (search +
            select-all/none + drag-to-reorder checkbox list). */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Colunas ({selected.size}/{entries.length})</span>
          </div>

          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar coluna..."
              value={search}
              onChange={(v) => setSearch(String(v || ""))}
              className="h-9 bg-transparent pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setSelected(new Set(entries.map((e) => e.id)))}>
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setSelected(new Set())}>
              Desmarcar Todas
            </Button>
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-2">
              {dragDisabled ? (
                filtered.map((e) => (
                  <ShareColumnRow key={e.id} id={e.id} label={e.label} checked={selected.has(e.id)} onToggle={(c) => toggle(e.id, c)} dragDisabled />
                ))
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filtered.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    {filtered.map((e) => (
                      <ShareColumnRow
                        key={e.id}
                        id={e.id}
                        label={e.label}
                        checked={selected.has(e.id)}
                        onToggle={(c) => toggle(e.id, c)}
                        dragDisabled={false}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button className="gap-2" onClick={doExport} disabled={busy}>
            {isXlsx ? <IconFileTypeXls className="h-4 w-4" /> : <IconFileTypePdf className="h-4 w-4" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
