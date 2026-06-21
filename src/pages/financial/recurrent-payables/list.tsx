import { useCallback, useEffect, useMemo, useState } from "react";
import { IconRepeat, IconEdit, IconArchive, IconArchiveOff, IconTrash, IconPlus } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableState } from "@/hooks/common/use-table-state";
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
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { RecurrentPayableForm } from "@/components/financial/recurrent-payables/recurrent-payable-form";

import { useRecurrentPayables, useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes, PAYMENT_METHOD_LABELS, SCHEDULE_FREQUENCY_LABELS, PAYMENT_METHOD, SCHEDULE_FREQUENCY } from "@/constants";
import { formatCurrency } from "@/utils";
import type { RecurrentPayable } from "@/types/recurrent-payable";

const DEFAULT_PAGE_SIZE = 40;

const DEFAULT_SORT: Array<{ column: string; direction: "asc" | "desc" }> = [
  { column: "isActive", direction: "desc" },
  { column: "name", direction: "asc" },
];

const SORTABLE_COLUMNS = ["name", "amount", "dueDayOfMonth", "isActive"];

// Resolves the displayed value: the fixed amount for FIXED bills, else the
// estimate for VARIABLE bills (null when none informed yet).
const amountOf = (p: RecurrentPayable): number | null => {
  const raw = p.amountKind === "FIXED" ? p.fixedAmount : p.estimatedAmount;
  return raw == null ? null : Number(raw);
};

const SORT_ACCESSORS: Record<string, (p: RecurrentPayable) => number | string> = {
  name: (p) => p.name,
  amount: (p) => amountOf(p) ?? -1,
  dueDayOfMonth: (p) => p.dueDayOfMonth,
  isActive: (p) => (p.isActive ? 1 : 0),
};

export const RecurrentPayablesListPage = () => {
  usePageTracker({ title: "Contas Recorrentes", icon: "repeat" });

  const { data: payables, isLoading } = useRecurrentPayables();
  const { create, update, delete: remove, createMutation, updateMutation, deleteMutation } = useRecurrentPayableMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RecurrentPayable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurrentPayable | null>(null);
  const [searchText, setSearchText] = useState("");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecurrentPayable } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const { page, pageSize, setPage, setPageSize, sortConfigs, toggleSort, getSortDirection, getSortOrder } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultSort: DEFAULT_SORT,
    allowedSortColumns: SORTABLE_COLUMNS,
  });

  const sorted = useMemo(() => {
    return [...(payables ?? [])].sort((a, b) => {
      for (const { column, direction } of sortConfigs) {
        const accessor = SORT_ACCESSORS[column];
        if (!accessor) continue;
        const av = accessor(a);
        const bv = accessor(b);
        const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, "pt-BR") : Number(av) - Number(bv);
        if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [payables, sortConfigs]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.supplier?.fantasyName ?? p.payeeName ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [sorted, searchText]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const pageItems = useMemo(() => filtered.slice(page * pageSize, page * pageSize + pageSize), [filtered, page, pageSize]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchText(value);
      setPage(0);
    },
    [setPage],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, item: RecurrentPayable) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const openEdit = useCallback((p: RecurrentPayable) => {
    setEditing(p);
    setEditorOpen(true);
    setContextMenu(null);
  }, []);

  const toggleActive = useCallback(
    (p: RecurrentPayable) => {
      update({ id: p.id, body: { isActive: !p.isActive } });
      setContextMenu(null);
    },
    [update],
  );

  const openDelete = useCallback((p: RecurrentPayable) => {
    setDeleteTarget(p);
    setContextMenu(null);
  }, []);

  const columns: StandardizedColumn<RecurrentPayable>[] = [
    {
      key: "name",
      header: "Nome",
      sortable: true,
      render: (p) => (
        <div className={`flex min-w-0 ${p.isActive ? "" : "opacity-50"}`}>
          <span className="truncate text-sm font-medium">{p.name}</span>
        </div>
      ),
    },
    {
      key: "payee",
      header: "Tomador",
      width: "200px",
      render: (p) => {
        const payee = p.supplier?.fantasyName ?? p.payeeName;
        return payee ? (
          <span className={`text-sm ${p.isActive ? "" : "opacity-50"}`}>{payee}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      key: "category",
      header: "Categoria",
      width: "180px",
      render: (p) =>
        p.category?.name ? (
          <span className={`text-sm ${p.isActive ? "" : "opacity-50"}`}>{p.category.name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "amount",
      header: "Valor",
      width: "150px",
      align: "right",
      sortable: true,
      render: (p) => {
        const value = amountOf(p);
        const isVariable = p.amountKind === "VARIABLE";
        return (
          <span className={`text-sm font-medium tabular-nums ${isVariable ? "italic text-muted-foreground" : ""}`}>
            {value != null ? formatCurrency(value) : "—"}
            {isVariable && value != null ? " (est.)" : ""}
          </span>
        );
      },
    },
    {
      key: "dueDayOfMonth",
      header: "Vencimento",
      width: "120px",
      align: "center",
      sortable: true,
      render: (p) => <span className="text-sm whitespace-nowrap">Dia {p.dueDayOfMonth}</span>,
    },
    {
      key: "frequency",
      header: "Frequência",
      width: "140px",
      render: (p) => (
        <span className="text-sm text-muted-foreground">
          {SCHEDULE_FREQUENCY_LABELS[p.frequency as SCHEDULE_FREQUENCY] ?? p.frequency}
        </span>
      ),
    },
    {
      key: "method",
      header: "Forma",
      width: "140px",
      render: (p) =>
        p.paymentMethod ? (
          <span className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[p.paymentMethod as PAYMENT_METHOD] ?? p.paymentMethod}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "isActive",
      header: "Status",
      width: "130px",
      align: "center",
      sortable: true,
      render: (p) =>
        p.isActive ? (
          <Badge variant="completed" size="sm">
            Ativa
          </Badge>
        ) : (
          <Badge variant="muted" size="sm">
            Inativa
          </Badge>
        ),
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Contas Recorrentes"
          icon={IconRepeat}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Contas Recorrentes" },
          ]}
          actions={[
            {
              key: "create",
              label: "Nova conta",
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
              <div className="flex flex-shrink-0 items-center gap-4">
                <TableSearchInput value={searchText} onChange={handleSearch} placeholder="Buscar por nome, tomador ou categoria..." />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable
                  className="h-full"
                  columns={columns}
                  data={pageItems}
                  getItemKey={(p) => p.id}
                  onContextMenu={handleContextMenu}
                  onSort={toggleSort}
                  getSortDirection={getSortDirection}
                  getSortOrder={getSortOrder}
                  sortConfigs={sortConfigs.map((s) => ({ field: s.column, direction: s.direction }))}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma conta recorrente cadastrada"
                  emptyIcon={IconRepeat}
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRecords={totalRecords}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
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
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent position={contextMenu} isOpen={!!contextMenu} className="w-48 ![position:fixed]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {contextMenu && (
            <>
              <DropdownMenuItem onClick={() => openEdit(contextMenu.item)}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {contextMenu.item.isActive ? (
                <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                  <IconArchive className="mr-2 h-4 w-4" />
                  Desativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                  <IconArchiveOff className="mr-2 h-4 w-4" />
                  Ativar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openDelete(contextMenu.item)} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <RecurrentPayableForm
        open={editorOpen}
        onOpenChange={setEditorOpen}
        payable={editing}
        isPending={createMutation.isPending || updateMutation.isPending}
        onSubmit={(payload, id) => {
          if (id) {
            update({ id, body: payload }, { onSuccess: () => setEditorOpen(false) });
          } else {
            create(payload, { onSuccess: () => setEditorOpen(false) });
          }
        }}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}" será removida e deixará de gerar novas cobranças mensais.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                remove(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

export default RecurrentPayablesListPage;
