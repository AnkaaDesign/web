import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconPlus, IconClipboardCheck, IconEdit, IconPercentage, IconGitMerge, IconCheck, IconX, IconTrash, IconPackages } from "@tabler/icons-react";
import {
  DataTablePage,
  type DataTableRowAction,
  type DataTableRowClickMeta,
  type DataTableFilterValues,
} from "@/components/ui/datatable";
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
import { toast } from "@/components/ui/sonner";
import { useItems, useItemMutations, useItemBatchMutations, useItemMerge, useItemBrands, useItemCategories, useSuppliers } from "@/hooks";
import { getItems } from "@/api-client";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "@/constants";
import type { Item } from "@/types";
import { PriceAdjustmentModal } from "../modals/price-adjustment-modal";
import { ItemMergeDialog } from "../merge/item-merge-dialog";
import { createItemTableColumns } from "./item-table-columns";
import { createItemFilterDefs, buildItemQuery, buildItemOrderBy, ITEM_LIST_INCLUDE, ITEM_DEFAULT_PAGE_SIZE } from "./item-table-filters";

const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

export function ItemTablePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { updateAsync } = useItemMutations();
  const { batchUpdateAsync, batchDeleteAsync } = useItemBatchMutations();
  const { mutateAsync: mergeItems } = useItemMerge();

  // --- search + filters come from the table via onParamsChange; page/pageSize/sort from the URL
  //     (the DataTable writes them there in server mode). ---
  const [params, setParams] = useState(EMPTY_PARAMS);
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string; filters: DataTableFilterValues }) => {
    const key = JSON.stringify(next);
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams(next);
  }, []);

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(ITEM_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : ITEM_DEFAULT_PAGE_SIZE;
  const sortParam = searchParams.get("sort");
  const sorting = useMemo<{ id: string; desc: boolean }[]>(() => {
    if (!sortParam) return [];
    try {
      const parsed = JSON.parse(sortParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [sortParam]);

  const query = useMemo(
    () => ({
      ...buildItemQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildItemOrderBy(sorting),
      include: ITEM_LIST_INCLUDE,
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading } = useItems(query as never);
  const items = (response?.data ?? []) as Item[];
  const totalRecords = response?.meta?.totalRecords ?? 0;

  // Export "all": refetch every item matching the current search/filters/sort in one request (the
  // table only holds the current page). Gating still applies — the share dialog only exports columns
  // the user can see (price/totalPrice are dropped for WAREHOUSE before the dialog).
  const fetchAllForExport = useCallback(async (): Promise<Item[]> => {
    const res = await getItems({
      ...buildItemQuery(params.filters, params.search),
      page: 1,
      limit: Math.max(totalRecords, 1),
      orderBy: buildItemOrderBy(sorting),
      include: ITEM_LIST_INCLUDE,
    } as never);
    return (res?.data ?? []) as Item[];
  }, [params, sorting, totalRecords]);

  // --- filter option sources (loaded once; API caps limit at 100) ---
  const { data: categoriesData } = useItemCategories({ orderBy: { name: "asc" }, limit: 100 } as never);
  const { data: brandsData } = useItemBrands({ orderBy: { name: "asc" }, limit: 100 } as never);
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" }, limit: 100 } as never);

  const filterDefs = useMemo(
    () =>
      createItemFilterDefs({
        categories: (categoriesData?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
        brands: (brandsData?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
        suppliers: (suppliersData?.data ?? []).map((s) => ({ value: s.id, label: s.fantasyName })),
      }),
    [categoriesData?.data, brandsData?.data, suppliersData?.data],
  );

  const columns = useMemo(() => createItemTableColumns(), []);

  // --- context-menu modals (hosted at page level; operate on the rows handed to the action) ---
  const [priceModal, setPriceModal] = useState<{ open: boolean; items: Item[] }>({ open: false, items: [] });
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; items: Item[] }>({ open: false, items: [] });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; items: Item[] }>({ open: false, items: [] });

  const setActive = useCallback(
    async (rows: Item[], isActive: boolean) => {
      try {
        if (rows.length === 1) {
          await updateAsync({ id: rows[0].id, data: { isActive } });
        } else if (rows.length > 1) {
          await batchUpdateAsync({ items: rows.map((r) => ({ id: r.id, data: { isActive } })) });
        }
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [updateAsync, batchUpdateAsync],
  );

  const confirmDelete = useCallback(async () => {
    try {
      await batchDeleteAsync({ itemIds: deleteDialog.items.map((i) => i.id) });
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog({ open: false, items: [] });
    }
  }, [batchDeleteAsync, deleteDialog.items]);

  const confirmMerge = useCallback(
    async (targetId: string, resolutions: Record<string, unknown>) => {
      try {
        const sourceItemIds = mergeDialog.items.map((i) => i.id).filter((id) => id !== targetId);
        await mergeItems({ targetItemId: targetId, sourceItemIds, conflictResolutions: resolutions } as never);
        setMergeDialog({ open: false, items: [] });
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [mergeItems, mergeDialog.items],
  );

  const rowActions = useMemo<DataTableRowAction<Item>[]>(
    () => [
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        onClick: (rows) => {
          if (rows.length === 1) navigate(routes.inventory.products.edit(rows[0].id));
          else if (rows.length > 1) navigate(`${routes.inventory.products.batchEdit}?ids=${rows.map((r) => r.id).join(",")}`);
        },
      },
      {
        key: "stock-balance",
        label: "Balanço de estoque",
        icon: <IconClipboardCheck className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        onClick: (rows) => {
          if (rows.length === 0) return;
          navigate(`${routes.inventory.products.stockBalance}?ids=${rows.map((r) => r.id).join(",")}`);
        },
      },
      {
        key: "price-adjustment",
        label: "Aplicar Ajuste",
        icon: <IconPercentage className="h-4 w-4" />,
        // canEdit (WAREHOUSE|ADMIN) AND canViewPrices (not WAREHOUSE) → ADMIN only.
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        onClick: (rows) => setPriceModal({ open: true, items: rows }),
      },
      {
        key: "merge",
        label: "Mesclar Itens",
        icon: <IconGitMerge className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        hidden: (rows) => rows.length < 2,
        onClick: (rows) => {
          if (rows.length < 2) {
            toast.error("Selecione pelo menos 2 itens para mesclar");
            return;
          }
          setMergeDialog({ open: true, items: rows });
        },
      },
      {
        key: "activate",
        label: "Ativar",
        icon: <IconCheck className="h-4 w-4" />,
        separatorBefore: true,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        hidden: (rows) => !rows.some((r) => !r.isActive),
        onClick: (rows) => void setActive(rows.filter((r) => !r.isActive), true),
      },
      {
        key: "deactivate",
        label: "Desativar",
        icon: <IconX className="h-4 w-4" />,
        variant: "destructive",
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        hidden: (rows) => !rows.some((r) => r.isActive),
        onClick: (rows) => void setActive(rows.filter((r) => r.isActive), false),
      },
      {
        key: "delete",
        label: "Deletar",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        onClick: (rows) => setDeleteDialog({ open: true, items: rows }),
      },
    ],
    [navigate, setActive],
  );

  const onRowClick = useCallback(
    (item: Item, meta: DataTableRowClickMeta) => {
      navigate(routes.inventory.products.details(item.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  return (
    <>
      <DataTablePage<Item>
        title="Produtos"
        icon={IconPackages}
        favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Produtos" },
        ]}
        actions={[
          {
            key: "stock-balance",
            label: "Balanço",
            icon: IconClipboardCheck,
            onClick: () => navigate(routes.inventory.stockBalance.create),
            variant: "outline",
          },
          {
            key: "create",
            label: "Cadastrar",
            icon: IconPlus,
            onClick: () => navigate(routes.inventory.products.create),
            variant: "default",
          },
        ]}
        table={{
          tableId: "inventory-items",
          data: items,
          columns,
          getRowId: (item) => item.id,
          mode: "server",
          rowCount: totalRecords,
          filterDefs,
          rowActions,
          onRowClick,
          isLoading,
          onParamsChange,
          onExportFetchAll: fetchAllForExport,
          defaultPageSize: ITEM_DEFAULT_PAGE_SIZE,
          searchPlaceholder: "Buscar por nome, código, código de barras...",
          exportTitle: "Produtos",
          exportFilename: "produtos",
          emptyMessage: "Nenhum produto encontrado. Ajuste os filtros ou cadastre um novo produto.",
        }}
      />

      <PriceAdjustmentModal
        open={priceModal.open}
        onOpenChange={(open) => setPriceModal((s) => ({ ...s, open }))}
        selectedItems={priceModal.items}
        onSuccess={() => setPriceModal({ open: false, items: [] })}
      />

      <ItemMergeDialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog((s) => ({ ...s, open }))}
        items={mergeDialog.items}
        onMerge={confirmMerge}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, items: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {deleteDialog.items.length > 1 ? `${deleteDialog.items.length} produtos` : "este produto"}?
              <br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
