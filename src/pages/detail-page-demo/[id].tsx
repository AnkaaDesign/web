import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { IconCalendar, IconCash, IconClipboardList, IconListDetails, IconNote, IconTags } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES } from "@/constants";
import { formatCurrency } from "@/utils/number";
import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import { DataTable } from "@/components/ui/datatable";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import {
  useDemoOrder,
  getDemoOrders,
  updateDemoOrder,
  demoOrderItems,
  DEMO_STATUSES,
  DEMO_STATUS_LABELS,
  DEMO_STATUS_VARIANT,
  DEMO_STATUS_TRANSITIONS,
  DEMO_PAYMENTS,
  DEMO_PAYMENT_LABELS,
  DEMO_PAYMENT_VARIANT,
  DEMO_SUPPLIERS,
  DEMO_TAGS,
  type DemoOrder,
  type DemoOrderItem,
  type DemoStatus,
  type DemoPayment,
} from "./demo-data";

const HEADER_STATUS_VARIANT: Record<DemoStatus, "default" | "secondary" | "destructive" | "outline"> = {
  CRIADO: "secondary",
  FEITO: "default",
  RECEBIDO: "default",
  CANCELADO: "destructive",
  ATRASADO: "outline",
};

// Embedded tables inside a detail page ARE the same DataTable we built — full toolbar
// (search, column visibility, filters, export, resize/reorder, URL + persistence).
const ITEM_COLUMNS: DataTableColumnDef<DemoOrderItem>[] = [
  { id: "name", accessorKey: "name", header: "Item", size: 320, meta: { exportHeader: "Item" }, cell: ({ getValue }) => <span className="truncate">{getValue() as string}</span> },
  { id: "quantity", accessorKey: "quantity", header: "Qtd.", size: 110, meta: { align: "right", exportHeader: "Qtd." }, cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span> },
  { id: "unit", accessorKey: "unit", header: "Un.", size: 100, meta: { exportHeader: "Un." } },
];

function ItemsTable({ order }: { order: DemoOrder }) {
  const items = demoOrderItems(order);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataTable<DemoOrderItem>
        tableId="detail-demo-order-items"
        data={items}
        columns={ITEM_COLUMNS}
        getRowId={(it) => it.id}
        bare
        enableSelection={false}
        searchPlaceholder="Buscar item..."
        emptyMessage="Sem itens."
        exportTitle="Itens do pedido"
        exportFilename="itens-pedido"
      />
    </div>
  );
}

export function DetailPageDemoPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const order = useDemoOrder(id);
  // Prev/next ids come from the table (location.state); fall back to ALL orders so paging still
  // works on a direct visit / reload.
  const navIds = (location.state as { ids?: string[] } | null)?.ids ?? getDemoOrders().map((o) => o.id);

  // Sections are stable per record id — inline commits write to the shared store, which
  // re-renders the row via `useDemoOrder` without rebuilding the section config.
  const sections = useMemo<DetailSectionDef<DemoOrder>[]>(() => {
    const statusEnum = {
      values: DEMO_STATUSES,
      labels: DEMO_STATUS_LABELS,
      variants: { ...DEMO_STATUS_VARIANT },
      transitions: (current: string) => DEMO_STATUS_TRANSITIONS[current as DemoStatus] ?? [],
    };
    const paymentEnum = { values: DEMO_PAYMENTS, labels: DEMO_PAYMENT_LABELS, variants: { ...DEMO_PAYMENT_VARIANT } };

    return [
      {
        id: "resumo",
        label: "Resumo",
        icon: IconClipboardList,
        required: true,
        fields: [
          { id: "description", label: "Descrição", dataType: "text", edit: { get: (o) => o.description, onCommit: (v) => updateDemoOrder(id, { description: String(v ?? "") }) } },
          {
            id: "supplier",
            label: "Fornecedor",
            dataType: "relation",
            edit: {
              get: (o) => o.supplier,
              onCommit: (v) => updateDemoOrder(id, { supplier: String(v ?? "") }),
              options: DEMO_SUPPLIERS.map((s) => ({ value: s, label: s })),
            },
          },
          { id: "status", label: "Status", dataType: "enum", edit: { get: (o) => o.status, onCommit: (v) => updateDemoOrder(id, { status: v as DemoStatus }), enum: statusEnum } },
          { id: "payment", label: "Pagamento", dataType: "enum", edit: { get: (o) => o.payment, onCommit: (v) => updateDemoOrder(id, { payment: v as DemoPayment }), enum: paymentEnum } },
          { id: "itemsCount", label: "Qtd. de itens", dataType: "integer", edit: { get: (o) => o.itemsCount, onCommit: (v) => updateDemoOrder(id, { itemsCount: Number(v) || 0 }), min: 0 } },
          { id: "urgent", label: "Urgente", dataType: "boolean", edit: { get: (o) => o.urgent, onCommit: (v) => updateDemoOrder(id, { urgent: !!v }) } },
        ],
      },
      {
        id: "datas",
        label: "Datas",
        icon: IconCalendar,
        fields: [
          { id: "forecast", label: "Previsão", dataType: "date", accessor: (o) => o.forecast, edit: { get: (o) => (o.forecast ? new Date(o.forecast) : null), onCommit: (v) => updateDemoOrder(id, { forecast: v instanceof Date ? v.toISOString() : "" }) } },
          { id: "createdAt", label: "Criado em", dataType: "date", accessor: (o) => o.createdAt },
        ],
      },
      {
        id: "classificacao",
        label: "Classificação",
        icon: IconTags,
        fields: [
          { id: "tags", label: "Tags", dataType: "multiselect", edit: { get: (o) => o.tags, onCommit: (v) => updateDemoOrder(id, { tags: (v as string[]) ?? [] }), options: DEMO_TAGS.map((t) => ({ value: t, label: t })) } },
          { id: "orderNumber", label: "Nº do pedido", dataType: "integer", accessor: (o) => o.orderNumber },
        ],
      },
      {
        id: "observacoes",
        label: "Observações",
        icon: IconNote,
        fields: [{ id: "notes", label: "Notas", dataType: "textarea", edit: { get: (o) => o.notes, onCommit: (v) => updateDemoOrder(id, { notes: String(v ?? "") }), placeholder: "Adicione uma observação..." } }],
      },
      {
        id: "financeiro",
        label: "Financeiro",
        icon: IconCash,
        // Generic privilege gate (the same `requiredPrivilege` the DataTable columns use):
        // hidden ENTIRELY — page, customize panel, and export — for anyone outside this set.
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
        fields: [
          { id: "total", label: "Valor total", dataType: "money", edit: { get: (o) => o.total, onCommit: (v) => updateDemoOrder(id, { total: Number(v) || 0 }), min: 0 } },
          { id: "unitValue", label: "Valor por item", render: (o) => formatCurrency(o.total / Math.max(1, o.itemsCount)) },
        ],
      },
      {
        id: "itens",
        label: "Itens do pedido",
        icon: IconListDetails,
        span: 2,
        resizableHeight: true,
        defaultHeight: 360,
        render: (o) => <ItemsTable order={o} />,
      },
    ];
  }, [id]);

  return (
    <DetailPage<DemoOrder>
      detailKey="detail-page-demo-v2"
      data={order}
      sections={sections}
      title={order ? `Pedido #${String(order.orderNumber).padStart(4, "0")}` : "Pedido"}
      subtitle={order?.description}
      icon={IconClipboardList}
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "DataTable Demo", href: "/data-table-demo" },
        { label: "Detalhe" },
      ]}
      status={order ? { label: DEMO_STATUS_LABELS[order.status], variant: HEADER_STATUS_VARIANT[order.status] } : undefined}
      emptyMessage="Pedido não encontrado. Abra a partir da tabela de demonstração."
      navigation={{ ids: navIds, toRoute: (recordId) => `/detail-page-demo/${recordId}` }}
    />
  );
}

export default DetailPageDemoPage;
