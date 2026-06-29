import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCategory,
  IconEdit,
  IconArchive,
  IconArchiveOff,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCategoryTextColor } from "@/components/financial/reconciliation/match-status-badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableState } from "@/hooks/common/use-table-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import {
  useReconciliationCategories,
  useCreateReconciliationCategory,
  useUpdateReconciliationCategory,
  useDeleteReconciliationCategory,
} from "@/hooks/financial/use-reconciliation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { getAccountingTypeLabel } from "@/components/financial/reconciliation/match-status-badge";
import {
  SECTOR_PRIVILEGES,
  routes,
  ACCOUNTING_TYPE,
  ACCOUNTING_TYPE_LABELS,
  FAVORITE_PAGES,
} from "@/constants";
import type {
  CreateTransactionCategoryPayload,
  TransactionCategory,
  UpdateTransactionCategoryPayload,
} from "@/types/reconciliation";

const DEFAULT_PAGE_SIZE = 40;

// Trailing group label for categories with no accounting type assigned yet.
const NO_ACCOUNTING_GROUP = "Sem grupo contábil";

// Select options for the accounting type (cost group) picker in the editor,
// derived from the foundation's label map so the 13 groups stay in sync.
const ACCOUNTING_TYPE_OPTIONS = Object.entries(
  ACCOUNTING_TYPE_LABELS as Record<string, string>,
).map(([value, label]) => ({ value, label }));

// Resolves a category's accounting-type group label (the chart-of-accounts
// cost group), falling back to a trailing "no group" bucket.
const accountingGroupOf = (c: TransactionCategory) =>
  getAccountingTypeLabel(c) ?? NO_ACCOUNTING_GROUP;

// Default multi-column sort applied on first load (no sort in the URL):
// recurring first → grupo contábil (accounting type, A→Z) → name A→Z.
// Every priority maps to a visible column header so clicking a header refines
// from here (no hidden sort keys like the old `kind` ordering).
// Module-level constant keeps a stable reference for useTableState/useMemo.
const DEFAULT_SORT: Array<{ column: string; direction: "asc" | "desc" }> = [
  { column: "isRecurring", direction: "desc" },
  { column: "accountingType", direction: "asc" },
  { column: "name", direction: "asc" },
];

// The only sort keys that map to a visible column header. Passed to
// useTableState so stale URLs carrying a removed key (the old `kind` sort) are
// dropped instead of occupying an invisible sort slot and skewing order badges.
const SORTABLE_COLUMNS = ["name", "accountingType", "isRecurring", "isActive"];

// Per-column sort key extractors. Returns a comparable primitive so the same
// comparator handles every sortable column (enums map to their group order).
// Ungrouped categories sort after grouped ones via a high-codepoint sentinel.
const SORT_ACCESSORS: Record<
  string,
  (c: TransactionCategory) => number | string
> = {
  name: c => c.name,
  accountingType: c => {
    const g = accountingGroupOf(c);
    return g === NO_ACCOUNTING_GROUP ? "￿" : g;
  },
  isRecurring: c => (c.isRecurring ? 1 : 0),
  isActive: c => (c.isActive ? 1 : 0),
};

// Item-derived categories are MIRRORS of the inventory item taxonomy — they are
// auto-synced and managed in the estoque module, never created/edited/deleted
// here. Only TRANSACTION_ONLY (and SERVICE, via create) categories are owned by
// this admin.
const isMirrored = (c: TransactionCategory) => c.kind === "ITEM_DERIVED";
// Both transaction-only buckets AND fiscal-service categories are owned here, so
// both can be edited (e.g. to set their grupo contábil / recurrence). Only
// inventory mirrors are read-only (managed in the estoque module).
const isEditable = (c: TransactionCategory) => c.kind !== "ITEM_DERIVED";

export const ReconciliationCategoriesListPage = () => {
  usePageTracker({ title: "Categorias - Conciliação", icon: "tags" });
  const { data: categories, isLoading } = useReconciliationCategories({
    includeInactive: true,
  });
  const createMut = useCreateReconciliationCategory();
  const updateMut = useUpdateReconciliationCategory();
  const deleteMut = useDeleteReconciliationCategory();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionCategory | null>(
    null,
  );
  const [searchText, setSearchText] = useState("");

  // Context menu state (right-click on a row)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: TransactionCategory;
  } | null>(null);

  // Close context menu on any outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Client-side pagination + interactive sort state (0-based page). Sort lives
  // in the URL with a multi-column default; clicking a header refines it, just
  // like the server-side tables elsewhere in the app.
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultSort: DEFAULT_SORT,
    allowedSortColumns: SORTABLE_COLUMNS,
  });

  // Full sorted list. Applies the active sort configs in priority order, with a
  // stable name tiebreak so equal rows keep a deterministic order.
  const sorted = useMemo(() => {
    return [...(categories ?? [])].sort((a, b) => {
      for (const { column, direction } of sortConfigs) {
        const accessor = SORT_ACCESSORS[column];
        if (!accessor) continue;
        const av = accessor(a);
        const bv = accessor(b);
        const cmp =
          typeof av === "string" && typeof bv === "string"
            ? av.localeCompare(bv, "pt-BR")
            : Number(av) - Number(bv);
        if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [categories, sortConfigs]);

  // Text filter over name + grupo contábil. All categories are shown in one
  // unified list (no origin split, no hide toggle).
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        accountingGroupOf(c).toLowerCase().includes(q),
    );
  }, [sorted, searchText]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Slice the filtered array for the current page.
  const pageItems = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchText(value);
      setPage(0);
    },
    [setPage],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: TransactionCategory) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [],
  );

  const openEdit = useCallback((c: TransactionCategory) => {
    setEditing(c);
    setEditorOpen(true);
    setContextMenu(null);
  }, []);

  const toggleActive = useCallback(
    (c: TransactionCategory) => {
      updateMut.mutate({ id: c.id, body: { isActive: !c.isActive } });
      setContextMenu(null);
    },
    [updateMut],
  );

  const openDelete = useCallback((c: TransactionCategory) => {
    setDeleteTarget(c);
    setContextMenu(null);
  }, []);

  const columns: StandardizedColumn<TransactionCategory>[] = [
    {
      key: "name",
      header: "Nome",
      sortable: true,
      render: c => (
        <div
          className={`flex items-center gap-2 min-w-0 ${c.isActive ? "" : "opacity-50"}`}
        >
          {c.color && (
            <span
              className="h-3 w-3 rounded-full flex-shrink-0 border border-border"
              style={{ backgroundColor: c.color }}
            />
          )}
          <span className="truncate text-sm font-medium">{c.name}</span>
        </div>
      ),
    },
    {
      key: "accountingType",
      header: "Grupo contábil",
      width: "220px",
      sortable: true,
      render: c => {
        const label = getAccountingTypeLabel(c);
        return label ? (
          <span className={`text-sm ${c.isActive ? "" : "opacity-50"}`}>
            {label}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      key: "isRecurring",
      header: "Recorrente",
      width: "170px",
      align: "center",
      sortable: true,
      render: c =>
        c.isRecurring ? (
          <Badge variant="inProgress" size="sm">
            Sim
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "isActive",
      header: "Status",
      width: "170px",
      align: "center",
      sortable: true,
      render: c =>
        c.isActive ? (
          <Badge variant="completed" size="sm">
            Ativa
          </Badge>
        ) : (
          <Badge variant="muted" size="sm">
            Arquivada
          </Badge>
        ),
    },
  ];

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Categorias de Conciliação"
          icon={IconCategory}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_CATEGORIAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária", href: routes.financial.reconciliation.root },
            { label: "Categorias" },
          ]}
          actions={[
            {
              key: "create",
              label: "Nova categoria",
              icon: IconPlus,
              onClick: () => {
                setEditing(null);
                setEditorOpen(true);
              },
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              {/* Wrap in a flex row so TableSearchInput's `flex-1` grows
                  horizontally, not vertically (a direct flex-col child would
                  stretch into a tall box). */}
              <div className="flex flex-shrink-0 items-center gap-4">
                <TableSearchInput
                  value={searchText}
                  onChange={handleSearch}
                  placeholder="Buscar por nome ou grupo contábil..."
                />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable
                  className="h-full"
                  columns={columns}
                  data={pageItems}
                  getItemKey={c => c.id}
                  onContextMenu={handleContextMenu}
                  onSort={toggleSort}
                  getSortDirection={getSortDirection}
                  getSortOrder={getSortOrder}
                  sortConfigs={sortConfigs.map(s => ({
                    field: s.column,
                    direction: s.direction,
                  }))}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma categoria cadastrada"
                  emptyIcon={IconCategory}
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRecords={totalRecords}
                  onPageChange={setPage}
                  onPageSizeChange={size => {
                    setPageSize(size);
                    setPage(0);
                  }}
                  pageSizeOptions={[40, 60, 100]}
                  showPageSizeSelector
                  showGoToPage
                  showPageInfo
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right-click context menu */}
      <DropdownMenu
        open={!!contextMenu}
        onOpenChange={open => !open && setContextMenu(null)}
      >
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-48 ![position:fixed]"
          onCloseAutoFocus={e => e.preventDefault()}
        >
          {contextMenu && isEditable(contextMenu.item) && (
            <>
              <DropdownMenuItem onClick={() => openEdit(contextMenu.item)}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {contextMenu &&
            !isMirrored(contextMenu.item) &&
            (contextMenu.item.isActive ? (
              <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                <IconArchive className="mr-2 h-4 w-4" />
                Arquivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                <IconArchiveOff className="mr-2 h-4 w-4" />
                Ativar
              </DropdownMenuItem>
            ))}

          {contextMenu && isEditable(contextMenu.item) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openDelete(contextMenu.item)}
                className="text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <CategoryEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        category={editing}
        isLoading={createMut.isPending || updateMut.isPending}
        onSubmit={(payload, id) => {
          if (id) {
            updateMut.mutate(
              { id, body: payload as UpdateTransactionCategoryPayload },
              { onSuccess: () => setEditorOpen(false) },
            );
          } else {
            createMut.mutate(payload as CreateTransactionCategoryPayload, {
              onSuccess: () => setEditorOpen(false),
            });
          }
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" será arquivada (ou removida se nunca tiver sido usada). As transações já classificadas mantêm seus registros históricos.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteMut.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

function CategoryEditorDialog({
  open,
  onOpenChange,
  category,
  isLoading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: TransactionCategory | null;
  isLoading?: boolean;
  onSubmit: (
    payload: CreateTransactionCategoryPayload | UpdateTransactionCategoryPayload,
    id?: string,
  ) => void;
}) {
  const isEdit = !!category;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"TRANSACTION_ONLY" | "SERVICE">(
    "TRANSACTION_ONLY",
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [color, setColor] = useState("");
  // Accounting type (chart-of-accounts cost group). Empty string = unset.
  const [accountingType, setAccountingType] = useState<ACCOUNTING_TYPE | "">("");
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setKind(category.kind === "SERVICE" ? "SERVICE" : "TRANSACTION_ONLY");
      setIsRecurring(category.isRecurring);
      setColor(category.color ?? "");
      setAccountingType(
        ((category as { accountingType?: string | null }).accountingType as ACCOUNTING_TYPE | null) ?? "",
      );
    } else {
      setName("");
      setKind("TRANSACTION_ONLY");
      setIsRecurring(false);
      setColor("");
      setAccountingType("");
    }
  }, [open, category]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // accountingType is the DRE rollup; null clears the cost group.
    const accountingField = { accountingType: accountingType || null };
    // isResolving is intentionally omitted — the backend defaults it by kind
    // (TRANSACTION_ONLY ⇒ resolves) when not provided.
    if (isEdit && category) {
      onSubmit(
        {
          name: trimmed,
          isRecurring,
          color: color || null,
          ...accountingField,
        },
        category.id,
      );
    } else {
      onSubmit({
        name: trimmed,
        kind,
        isRecurring,
        color: color || null,
        ...accountingField,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            Categorias de transação auto-conciliantes dispensam nota fiscal —
            uma transação é conciliada por estar classificada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={v =>
                setName(typeof v === "string" ? v : v == null ? "" : String(v))
              }
              placeholder="Ex.: Aluguel, Tarifa bancária..."
            />
          </div>

          <div className="space-y-2">
            <Label>Grupo contábil</Label>
            <Combobox
              value={accountingType || undefined}
              onValueChange={v =>
                setAccountingType(typeof v === "string" ? (v as ACCOUNTING_TYPE) : "")
              }
              options={ACCOUNTING_TYPE_OPTIONS}
              placeholder="Selecione o grupo contábil..."
              searchPlaceholder="Buscar grupo..."
              emptyText="Nenhum grupo encontrado"
              searchable
              clearable
            />
            <p className="text-xs text-muted-foreground">
              Define a qual grupo do plano de contas esta categoria pertence.
            </p>
          </div>

          {/* The preview chip IS the color picker: click it to open the native
              color input. Shows a live preview of the category badge. */}
          <div className="space-y-2">
            <Label>Cor (clique na prévia para escolher)</Label>
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="inline-flex w-fit cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Clique para escolher a cor"
            >
              <span
                className={`inline-flex items-center rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition ${
                  color
                    ? "hover:brightness-95"
                    : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
                }`}
                style={
                  color
                    ? { backgroundColor: color, color: getCategoryTextColor(color) ?? "#fff" }
                    : undefined
                }
              >
                {name.trim() || "Nome da categoria"}
              </span>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color || "#888888"}
              onChange={e => setColor(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
            {color && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColor("")}
                className="text-muted-foreground"
              >
                Remover cor
              </Button>
            )}
          </div>

          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-sm">
              Recorrente
              <span className="block text-xs text-muted-foreground">
                Aparece na previsão mensal de pagamentos.
              </span>
            </span>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading ? "Salvando..." : isEdit ? "Salvar" : "Criar categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReconciliationCategoriesListPage;
