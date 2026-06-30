import { useEffect, useMemo, useState } from "react";
import { IconFileTypeXls, IconFileTypePdf, IconSearch } from "@tabler/icons-react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { exportToXlsx, exportToPdf } from "./data-table-export";
import { columnHeaderText } from "./data-table-utils";
import type { DataTableColumnDef } from "./data-table-types";

export type ShareFormat = "pdf" | "xlsx";

/** Which rows to export. */
type ExportScope = "selected" | "page" | "all";

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
 * Column-selection modal shown AFTER the user picks PDF or XLSX in the share
 * popover. The column list mirrors the column-visibility manager (search +
 * select-all/none + a checkbox list) so the two pickers feel identical.
 * Current visible columns are pre-checked; respects row selection.
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set(visibleColumnIds));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedCount = selectedCountProp ?? selectedRows.length;
  // Scope defaults to the selection if any, else ALL filtered rows when available (restores the
  // legacy "all data" export default), else the current page.
  const [scope, setScope] = useState<ExportScope>("page");

  useEffect(() => {
    if (open) {
      setSelected(new Set(visibleColumnIds.length ? visibleColumnIds : exportable.map((c) => c.id)));
      setSearch("");
      setScope(selectedCount > 0 ? "selected" : resolveAllRows ? "all" : "page");
    }
  }, [open, visibleColumnIds, exportable, selectedCount, resolveAllRows]);

  const filtered = useMemo(
    () => (search ? exportable.filter((c) => columnHeaderText(c).toLowerCase().includes(search.toLowerCase())) : exportable),
    [exportable, search],
  );
  const chosenColumns = useMemo(() => exportable.filter((c) => selected.has(c.id)), [exportable, selected]);
  const isXlsx = format === "xlsx";

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const doExport = async () => {
    if (!chosenColumns.length) return notify.error("Atenção", "Selecione ao menos uma coluna.");
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
      const req = { rows, columns: chosenColumns, filename, title };
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

        {/* Column picker — same layout as the column-visibility manager. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Colunas ({selected.size}/{exportable.length})</span>
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
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setSelected(new Set(exportable.map((c) => c.id)))}>
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setSelected(new Set())}>
              Desmarcar Todas
            </Button>
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-2">
              {filtered.map((c) => (
                <Label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-muted"
                >
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(ck) => toggle(c.id, ck === true)} />
                  <span className="min-w-0 flex-1 truncate text-sm">{columnHeaderText(c)}</span>
                </Label>
              ))}
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
