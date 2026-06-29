import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { IconCash, IconEdit, IconExternalLink, IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES } from "@/constants";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/number";
import { formatDate } from "@/utils/date";
import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableColumnDef, DataTableFilterDef, DataTableRowAction, DataTableRowClickMeta } from "@/components/ui/datatable";
import {
  useDemoOrders,
  DEMO_STATUSES,
  DEMO_STATUS_LABELS,
  DEMO_STATUS_VARIANT,
  DEMO_PAYMENTS,
  DEMO_PAYMENT_LABELS,
  DEMO_PAYMENT_VARIANT,
  DEMO_SUPPLIERS,
  type DemoOrder,
} from "@/pages/detail-page-demo/demo-data";

/** A demo row that may carry clustered child orders (to showcase generic expand/collapse). */
type DemoOrderRow = DemoOrder & { __children?: DemoOrder[] };

export function DataTableDemoPage() {
  const navigate = useNavigate();
  const data = useDemoOrders();

  // Cluster orders by supplier: each supplier with >1 order becomes an expandable parent row
  // whose siblings are real, individually selectable/clickable child rows. (Mirrors the
  // task-preparation name-clustering — but the expand/collapse machinery is fully generic.)
  const clustered = useMemo<DemoOrderRow[]>(() => {
    const bySupplier = new Map<string, DemoOrder[]>();
    for (const o of data) {
      const arr = bySupplier.get(o.supplier) ?? [];
      arr.push(o);
      bySupplier.set(o.supplier, arr);
    }
    const out: DemoOrderRow[] = [];
    for (const group of bySupplier.values()) {
      if (group.length === 1) out.push(group[0]);
      else out.push({ ...group[0], __children: group.slice(1) });
    }
    return out;
  }, [data]);

  // Click a row → open the DETAIL demo, handing over the table's current filtered+sorted
  // order so the detail page's prev/next pages through exactly the list shown here.
  const onRowClick = useCallback(
    (o: DemoOrderRow, meta: DataTableRowClickMeta) => {
      navigate(`/detail-page-demo/${o.id}`, { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  const columns = useMemo<DataTableColumnDef<DemoOrderRow>[]>(
    () => [
      {
        id: "orderNumber",
        accessorKey: "orderNumber",
        header: "Nº",
        size: 90,
        minSize: 70,
        meta: { align: "right", exportHeader: "Número" },
        cell: ({ getValue }) => <span className="font-mono">{String(getValue()).padStart(4, "0")}</span>,
      },
      {
        id: "description",
        accessorKey: "description",
        header: "Descrição",
        size: 260,
        meta: { exportHeader: "Descrição" },
        cell: ({ getValue, row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{getValue() as string}</span>
            {/* The cluster-count badge is only useful while collapsed — once expanded, the children
                are visible, so hide it. */}
            {!row.getIsExpanded() && row.original.__children?.length ? (
              <Badge variant="secondary" className="shrink-0">
                +{row.original.__children.length}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: "supplier",
        accessorKey: "supplier",
        header: "Fornecedor",
        size: 190,
        meta: { exportHeader: "Fornecedor" },
        cell: ({ getValue }) => <span className="truncate">{getValue() as string}</span>,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        size: 130,
        meta: { exportHeader: "Status", exportValue: (o) => DEMO_STATUS_LABELS[o.status] },
        cell: ({ row }) => <Badge variant={DEMO_STATUS_VARIANT[row.original.status]}>{DEMO_STATUS_LABELS[row.original.status]}</Badge>,
      },
      {
        id: "payment",
        accessorKey: "payment",
        header: "Pagamento",
        size: 130,
        meta: { exportHeader: "Pagamento", exportValue: (o) => DEMO_PAYMENT_LABELS[o.payment] },
        cell: ({ row }) => <Badge variant={DEMO_PAYMENT_VARIANT[row.original.payment]}>{DEMO_PAYMENT_LABELS[row.original.payment]}</Badge>,
      },
      {
        id: "itemsCount",
        accessorKey: "itemsCount",
        header: "Itens",
        size: 80,
        meta: { align: "center", exportHeader: "Itens" },
        cell: ({ getValue }) => <Badge variant="secondary">{getValue() as number}</Badge>,
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Valor Total",
        size: 140,
        // Privilege-gated: only these sectors see the monetary column (everywhere — incl. the
        // column-visibility picker + export). WAREHOUSE (not listed) never sees it; ADMIN always does.
        meta: {
          align: "right",
          exportHeader: "Valor Total",
          exportValue: (o) => o.total,
          requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
        },
        cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      {
        id: "tags",
        accessorKey: "tags",
        header: "Tags",
        size: 200,
        enableSorting: false,
        meta: { exportHeader: "Tags", exportValue: (o) => o.tags },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "urgent",
        accessorKey: "urgent",
        header: "Urgente",
        size: 100,
        meta: { align: "center", exportHeader: "Urgente", exportValue: (o) => o.urgent },
        cell: ({ getValue }) =>
          getValue() ? <Badge variant="pending">Sim</Badge> : <span className="text-muted-foreground">—</span>,
      },
      {
        id: "forecast",
        accessorKey: "forecast",
        header: "Previsão",
        size: 120,
        meta: { exportHeader: "Previsão", exportValue: (o) => new Date(o.forecast) },
        cell: ({ getValue }) => formatDate(new Date(getValue() as string)),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Criado em",
        size: 120,
        meta: { defaultVisible: false, exportHeader: "Criado em", exportValue: (o) => new Date(o.createdAt) },
        cell: ({ getValue }) => formatDate(new Date(getValue() as string)),
      },
    ],
    [],
  );

  const filterDefs = useMemo<DataTableFilterDef<DemoOrderRow>[]>(
    () => [
      { key: "status", label: "Status", type: "multiselect", options: DEMO_STATUSES.map((s) => ({ value: s, label: DEMO_STATUS_LABELS[s] })) },
      { key: "payment", label: "Pagamento", type: "select", options: DEMO_PAYMENTS.map((p) => ({ value: p, label: DEMO_PAYMENT_LABELS[p] })) },
      { key: "supplier", label: "Fornecedor", type: "multiselect", options: DEMO_SUPPLIERS.map((s) => ({ value: s, label: s })) },
      {
        key: "total",
        label: "Valor (R$)",
        type: "number-range",
        currency: true,
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
      },
      { key: "forecast", label: "Previsão", type: "date-range" },
      { key: "urgent", label: "Urgente", type: "boolean" },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<DemoOrderRow>[]>(
    () => [
      {
        key: "open",
        label: "Abrir detalhes",
        icon: <IconExternalLink className="h-4 w-4" />,
        onClick: (rows) => {
          const first = rows[0];
          if (first) navigate(`/detail-page-demo/${first.id}`);
        },
      },
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        disabled: (rows) => rows.length > 1,
        onClick: (rows) => toast.info(`Editar ${rows[0]?.description ?? ""}`),
      },
      {
        // Privilege-gated: only FINANCIAL / ACCOUNTING / ADMIN see "Pagar" in the menu.
        key: "pay",
        label: "Pagar",
        icon: <IconCash className="h-4 w-4" />,
        requiredPrivilege: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN],
        onClick: (rows) => toast.success(`Pagar ${rows.length} pedido(s)`),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        onClick: (rows) => toast.error(`Excluir ${rows.length} pedido(s)`),
      },
    ],
    [navigate],
  );

  return (
    <DataTablePage<DemoOrderRow>
      title="DataTable — Demonstração"
      subtitle="Clique numa linha para abrir o detalhe (com navegação anterior/próximo). Expandir/recolher grupos, redimensionar, reordenar, multi-ordenação, fixar linhas, filtros, compartilhar, URL + persistência server-side."
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "DataTable Demo" }]}
      actions={[
        {
          key: "info",
          label: "Sobre",
          icon: IconInfoCircle,
          variant: "outline",
          onClick: () =>
            toast.message("Tabela de demonstração", {
              description:
                "Clique numa linha → detalhe. Arraste as bordas para redimensionar, arraste o cabeçalho para reordenar, clique para ordenar (múltiplas), botão direito para o menu, fixe linhas no topo.",
            }),
        },
      ]}
      table={{
        tableId: "data-table-demo",
        data: clustered,
        columns,
        filterDefs,
        rowActions,
        getRowId: (o) => o.id,
        enableExpansion: true,
        getSubRows: (o) => o.__children,
        onRowClick,
        searchPlaceholder: "Buscar por descrição, fornecedor, tags...",
        exportTitle: "Pedidos (Demonstração)",
        exportFilename: "pedidos-demo",
        defaultSorting: [{ id: "orderNumber", desc: false }],
      }}
    />
  );
}
