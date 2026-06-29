import { useCallback, useMemo, type ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { IconEdit, IconInfoCircle, IconChartBar, IconCalculator, IconShieldCheck, IconClock, IconHistory, IconLink, IconPackage, IconRuler, IconCertificate, IconPackages, IconUser, IconTag, IconCategory, IconBuildingStore, IconBox, IconCurrencyReal } from "@tabler/icons-react";

import { useItem, useItemMutations, useOrderSchedules, useOrderScheduleProjection, useCanViewPrices } from "../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE, SECTOR_PRIVILEGES, MEASURE_TYPE_LABELS, MEASURE_TYPE_ORDER, MEASURE_UNIT_LABELS, PPE_TYPE, PPE_SIZE, PPE_DELIVERY_MODE, PPE_TYPE_LABELS, PPE_SIZE_LABELS, PPE_DELIVERY_MODE_LABELS } from "../../../../constants";
import type { Item, Measure } from "../../../../types";
import { measureUtils, formatItemLocation } from "../../../../utils";
import { getItemBrands } from "@/api-client/item-brand";
import { getItemCategories } from "@/api-client/item-category";
import { getSuppliers } from "@/api-client/supplier";

import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef, DetailFieldDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { canEditItems } from "@/utils/permissions/entity-permissions";

import { MetricsSection } from "./sections/metrics-section";
import { CalculationSection, type ScheduledNextOrder } from "./sections/calculation-section";
import { ActivitySection, hasActivitiesThisPeriod } from "./sections/activity-section";
import { RelatedItemsSection, relatedItemsCount } from "./sections/related-items-section";

const NotDefined = () => <span className="text-muted-foreground italic font-normal">Não definida</span>;

// Format a single measure into a "value unit" string (e.g. "900 ml"), with graceful fallbacks.
function formatMeasureValue(measure: Measure): string {
  if (measure.value != null && measure.unit != null) {
    return measureUtils.formatMeasure({ value: measure.value, unit: measure.unit }, true, 2, measure.measureType);
  }
  if (measure.unit != null) return MEASURE_UNIT_LABELS[measure.unit] || measure.unit;
  if (measure.value != null) return String(measure.value);
  return "—";
}

const DETAIL_INCLUDE = {
  brands: true,
  category: true,
  supplier: true,
  warehouseLocation: true,
  prices: { orderBy: { createdAt: "desc" }, take: 10 },
  activities: { include: { user: { select: { name: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
  relatedItems: { include: { brands: true, category: true } },
  relatedTo: { include: { brands: true, category: true } },
  orderItems: { include: { order: { include: { supplier: true, items: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
  borrows: { include: { user: { select: { name: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
  changeLogs: { include: { user: { select: { name: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
  _count: {
    select: { activities: true, borrows: true, orderItems: true, prices: true, measures: true, relatedItems: true, relatedTo: true },
  },
} as const;

export function ItemDetailPage() {
  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <ItemDetailContent />
    </PrivilegeRoute>
  );
}

function ItemDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canEdit = canEditItems(user);
  const canViewPrices = useCanViewPrices();

  const { data: response, isLoading, error, refetch } = useItem(id!, { include: DETAIL_INCLUDE as never, enabled: !!id });
  const item = (response?.data ?? null) as Item | null;

  usePageTracker({ title: item ? `Produto: ${item.name}` : "Produto", icon: "package" });

  // This item's purchasing is governed by any active order schedule that lists it. Surface the
  // schedule's projected "expected" quantity (gap + one cycle) on the calculation section.
  const { data: schedulesResponse } = useOrderSchedules({ where: { isActive: true }, limit: 100, enabled: !!item });

  const targetSchedule = useMemo(() => {
    if (!item) return null;
    const matches = (schedulesResponse?.data || []).filter((s) => Array.isArray(s.items) && s.items.includes(item.id));
    return matches.sort((a, b) => new Date(a.nextRun || 0).getTime() - new Date(b.nextRun || 0).getTime())[0] || null;
  }, [schedulesResponse, item]);

  const { data: scheduleProjectionResponse } = useOrderScheduleProjection(targetSchedule?.id || "", { enabled: !!targetSchedule?.id });

  const scheduledNextOrder = useMemo<ScheduledNextOrder | null>(() => {
    if (!item || !targetSchedule) return null;
    const projItem = scheduleProjectionResponse?.data?.items?.find((p) => p.itemId === item.id);
    if (!projItem) return null;
    return {
      quantity: projItem.quantityGapPlusCycle,
      scheduleName: targetSchedule.name,
      scheduleId: targetSchedule.id,
      nextRun: scheduleProjectionResponse?.data?.meta?.nextRun ?? targetSchedule.nextRun ?? null,
    };
  }, [item, targetSchedule, scheduleProjectionResponse]);

  const { updateAsync } = useItemMutations();
  const setField = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!item) return;
      await updateAsync({ id: item.id, data: patch as never });
    },
    [item, updateAsync],
  );
  const toInt = (v: unknown): number | null => (v === "" || v == null ? null : Number(v));
  const toNum = (v: unknown): number => (v === "" || v == null ? 0 : Number(v));

  // Async relation loaders (mirror task-detail's loadCustomers/loadSectors pattern) — each returns
  // a paged ComboboxOption list for the inline relation/multiselect editors.
  const loadBrands = useCallback(async (search: string, page = 1) => {
    const limit = 20;
    const res = (await getItemBrands({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as {
      data?: Array<{ id: string; name?: string }>;
    };
    const out = (res?.data ?? []).map((b) => ({ value: b.id, label: b.name || b.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const loadCategories = useCallback(async (search: string, page = 1) => {
    const limit = 20;
    const res = (await getItemCategories({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as {
      data?: Array<{ id: string; name?: string }>;
    };
    const out = (res?.data ?? []).map((c) => ({ value: c.id, label: c.name || c.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const loadSuppliers = useCallback(async (search: string, page = 1) => {
    const limit = 20;
    const res = (await getSuppliers({ searchingFor: search, page, limit, orderBy: { fantasyName: "asc" } } as never)) as {
      data?: Array<{ id: string; fantasyName?: string; corporateName?: string }>;
    };
    const out = (res?.data ?? []).map((s) => ({ value: s.id, label: s.fantasyName || s.corporateName || s.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const sections = useMemo<DetailSectionDef<Item>[]>(() => {
    const list: DetailSectionDef<Item>[] = [];

    // ── Especificações Técnicas ────────────────────────────────────────────
    const specFields: DetailFieldDef<Item>[] = [
      {
        id: "name",
        label: "Nome",
        icon: IconTag,
        accessor: (i) => i.name,
        editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        edit: canEdit ? { get: (i) => i.name, placeholder: "Nome do produto", onCommit: (v) => setField({ name: (v as string) || undefined }) } : undefined,
      },
      {
        id: "brands",
        label: "Marcas",
        dataType: "multiselect",
        icon: IconTag,
        editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        accessor: (i) => (i.brands?.length ? i.brands.map((b) => b.name).join(", ") : null),
        render: (i) => (i.brands?.length ? <span>{i.brands.map((b) => b.name).join(", ")}</span> : <NotDefined />),
        edit: canEdit
          ? {
              get: (i) => (i.brands ?? []).map((b) => b.id),
              loadOptions: loadBrands,
              options: (item?.brands ?? []).map((b) => ({ value: b.id, label: b.name || "" })),
              placeholder: "Selecionar marcas...",
              onCommit: (v) => setField({ brandIds: Array.isArray(v) ? (v as string[]) : [] }),
            }
          : undefined,
      },
      {
        id: "category",
        label: "Categoria",
        dataType: "relation",
        icon: IconCategory,
        editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        accessor: (i) => i.category?.name ?? null,
        render: (i) => (i.category ? <span>{i.category.name}</span> : <NotDefined />),
        edit: canEdit
          ? {
              get: (i) => i.categoryId ?? null,
              loadOptions: loadCategories,
              options: item?.category ? [{ value: item.category.id, label: item.category.name || "" }] : undefined,
              placeholder: "Buscar categoria...",
              onCommit: (v) => setField({ categoryId: (v as string) || null }),
            }
          : undefined,
      },
    ];
    specFields.push({
      id: "supplier",
      label: "Fornecedor",
      dataType: "relation",
      icon: IconBuildingStore,
      editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
      accessor: (i) => i.supplier?.fantasyName ?? null,
      render: (i) => (i.supplier ? <span>{i.supplier.fantasyName}</span> : <NotDefined />),
      edit: canEdit
        ? {
            get: (i) => i.supplierId ?? null,
            loadOptions: loadSuppliers,
            options: item?.supplier ? [{ value: item.supplier.id, label: item.supplier.fantasyName || item.supplier.corporateName || "" }] : undefined,
            placeholder: "Buscar fornecedor...",
            onCommit: (v) => setField({ supplierId: (v as string) || null }),
          }
        : undefined,
    });
    if (item?.warehouseLocation) {
      specFields.push({ id: "location", label: "Localização", icon: IconRuler, accessor: () => formatItemLocation(item as Item), render: () => <span>{formatItemLocation(item as Item)}</span> });
    }
    // Estoque + preço — quantity is editable; price (current monetary value) is gated to non-WAREHOUSE.
    specFields.push({
      id: "quantity",
      label: "Quantidade em Estoque",
      dataType: "number",
      icon: IconBox,
      accessor: (i) => i.quantity,
      edit: canEdit ? { get: (i) => i.quantity, min: 0, onCommit: (v) => setField({ quantity: toNum(v) }) } : undefined,
    });
    if (canViewPrices) {
      specFields.push({
        id: "price",
        label: "Preço Atual",
        dataType: "money",
        icon: IconCurrencyReal,
        accessor: (i) => i.prices?.[0]?.value ?? null,
        edit: canEdit ? { get: (i) => i.prices?.[0]?.value ?? null, min: 0, onCommit: (v) => setField({ price: toNum(v) }) } : undefined,
      });
    }
    // Identificação
    specFields.push({
      id: "uniCode",
      label: "Código Universal",
      accessor: (i) => i.uniCode,
      render: (i) => (i.uniCode ? <span className="font-mono">{i.uniCode}</span> : <span className="text-muted-foreground">—</span>),
      edit: canEdit ? { get: (i) => i.uniCode ?? "", onCommit: (v) => setField({ uniCode: (v as string) || null }) } : undefined,
    });
    if (item?.ppeCA) {
      specFields.push({ id: "ppeCA", label: "Certificado de Aprovação (CA)", accessor: (i) => i.ppeCA, render: (i) => <span className="font-mono">{i.ppeCA}</span> });
    }
    if (item?.barcodes && item.barcodes.length > 0) {
      specFields.push({
        id: "barcodes",
        label: "Códigos de Barras",
        block: true,
        accessor: (i) => i.barcodes,
        render: (i) => (
          <span className="flex flex-wrap gap-2 justify-end">
            {i.barcodes.map((barcode, index) => (
              <span key={index} className="font-mono bg-background/60 rounded px-2 py-0.5">
                {barcode}
              </span>
            ))}
          </span>
        ),
      });
    }
    // Medidas — one stacked row per measure (sorted by canonical type order).
    specFields.push({
      id: "measures",
      label: "Medidas",
      block: true,
      accessor: (i) => (i.measures || []).map((m) => formatMeasureValue(m)).join(", ") || null,
      render: (i) => {
        const measures = [...(i.measures || [])].sort((a, b) => (MEASURE_TYPE_ORDER[a.measureType] ?? 999) - (MEASURE_TYPE_ORDER[b.measureType] ?? 999));
        if (!measures.length) return <NotDefined />;
        return (
          <div className="mt-1 space-y-2">
            {measures.map((m) => (
              <div key={m.id} className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">{MEASURE_TYPE_LABELS[m.measureType] ?? m.measureType}</span>
                <span className="text-sm font-semibold text-foreground">{formatMeasureValue(m)}</span>
              </div>
            ))}
          </div>
        );
      },
    });
    // Embalagem e Logística
    specFields.push({
      id: "boxQuantity",
      label: "Unidades por Caixa",
      dataType: "integer",
      icon: IconPackages,
      accessor: (i) => i.boxQuantity,
      edit: canEdit ? { get: (i) => i.boxQuantity, min: 0, onCommit: (v) => setField({ boxQuantity: toInt(v) }) } : undefined,
    });
    specFields.push({
      id: "estimatedLeadTime",
      label: "Prazo de Entrega Estimado",
      dataType: "integer",
      accessor: (i) => i.estimatedLeadTime,
      render: (i) => <span>{i.estimatedLeadTime != null ? `${i.estimatedLeadTime} dias` : "—"}</span>,
      edit: canEdit ? { get: (i) => i.estimatedLeadTime, min: 0, onCommit: (v) => setField({ estimatedLeadTime: toInt(v) }) } : undefined,
    });

    list.push({ id: "specifications", label: "Especificações Técnicas", icon: IconInfoCircle, span: 1, fields: specFields });

    // ── Métricas e Análises ────────────────────────────────────────────────
    list.push({ id: "metrics", label: "Métricas e Análises", icon: IconChartBar, span: 1, render: (i) => <MetricsSection item={i} /> });

    // ── Cálculo de Estoque ─────────────────────────────────────────────────
    list.push({ id: "calculation", label: "Cálculo de Estoque", icon: IconCalculator, span: 2, render: (i) => <CalculationSection item={i} scheduledNextOrder={scheduledNextOrder} /> });

    // ── Informações de EPI (only for PPE items) ────────────────────────────
    if (item?.ppeType) {
      const ppeFields: DetailFieldDef<Item>[] = [
        {
          id: "ppeType",
          label: "Tipo",
          dataType: "enum",
          icon: IconShieldCheck,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => (i.ppeType ? PPE_TYPE_LABELS[i.ppeType] : null),
          render: (i) => <span>{i.ppeType ? PPE_TYPE_LABELS[i.ppeType] : "—"}</span>,
          edit: canEdit
            ? { get: (i) => i.ppeType ?? null, enum: { values: Object.values(PPE_TYPE), labels: PPE_TYPE_LABELS }, onCommit: (v) => setField({ ppeType: (v as string) || null }) }
            : undefined,
        },
        {
          id: "ppeSize",
          label: "Tamanho",
          dataType: "enum",
          icon: IconRuler,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => (i.ppeSize ? PPE_SIZE_LABELS[i.ppeSize] : null),
          render: (i) => <span>{i.ppeSize ? PPE_SIZE_LABELS[i.ppeSize] : "—"}</span>,
          edit: canEdit
            ? { get: (i) => i.ppeSize ?? null, enum: { values: Object.values(PPE_SIZE), labels: PPE_SIZE_LABELS }, onCommit: (v) => setField({ ppeSize: (v as string) || null }) }
            : undefined,
        },
        {
          id: "ppeInfoCA",
          label: "Certificado de Aprovação (CA)",
          icon: IconCertificate,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => i.ppeCA,
          edit: canEdit ? { get: (i) => i.ppeCA ?? "", onCommit: (v) => setField({ ppeCA: (v as string) || null }) } : undefined,
        },
        {
          id: "ppeDeliveryMode",
          label: "Modo de Entrega",
          dataType: "enum",
          icon: IconPackage,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => (i.ppeDeliveryMode ? PPE_DELIVERY_MODE_LABELS[i.ppeDeliveryMode] : null),
          render: (i) => <span>{i.ppeDeliveryMode ? PPE_DELIVERY_MODE_LABELS[i.ppeDeliveryMode] : "—"}</span>,
          edit: canEdit
            ? { get: (i) => i.ppeDeliveryMode ?? null, enum: { values: Object.values(PPE_DELIVERY_MODE), labels: PPE_DELIVERY_MODE_LABELS }, onCommit: (v) => setField({ ppeDeliveryMode: (v as string) || null }) }
            : undefined,
        },
        {
          id: "shouldAssignToUser",
          label: "Atribuído ao Usuário",
          dataType: "boolean",
          icon: IconUser,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => i.shouldAssignToUser,
          edit: canEdit ? { get: (i) => !!i.shouldAssignToUser, onCommit: (v) => setField({ shouldAssignToUser: !!v }) } : undefined,
        },
        {
          id: "ppeStandardQuantity",
          label: "Quantidade Padrão",
          dataType: "integer",
          icon: IconPackage,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (i) => i.ppeStandardQuantity,
          edit: canEdit ? { get: (i) => i.ppeStandardQuantity, min: 1, onCommit: (v) => setField({ ppeStandardQuantity: toInt(v) }) } : undefined,
        },
      ];
      list.push({ id: "ppe", label: "Informações de EPI", icon: IconShieldCheck, span: 1, fields: ppeFields });
    }

    // ── Histórico de Atividades (only when there are activities IN THE CURRENT
    //    PERIOD — ActivitySection filters to the current month, so gate on the
    //    same period to avoid showing an empty card for items whose only
    //    activities are older than this month). ─────────────────────────────
    if (item && hasActivitiesThisPeriod(item)) {
      list.push({
        id: "activity",
        label: "Histórico de Atividades",
        icon: IconClock,
        span: 2,
        scroll: true,
        render: (i) => <ActivitySection item={i} />,
      });
    }

    // ── Produtos Relacionados (full width, only when present) — gate on the
    //    fully-fetched relatedItems/relatedTo relations so the empty card never
    //    renders (Item has no `_count` type field; the relations carry no take
    //    limit, so the array-length count is exact). ─────────────────────────
    if (item && relatedItemsCount(item) > 0) {
      list.push({ id: "related", label: "Produtos Relacionados", icon: IconLink, span: 2, render: (i) => <RelatedItemsSection item={i} /> });
    }

    // ── Histórico de Alterações (bare ChangelogHistory inside ONE card section) ──
    list.push({
      id: "changelog",
      label: "Histórico de Alterações",
      icon: IconHistory,
      span: 2,
      scroll: true,
      render: (i) => <ChangelogHistory embedded entityType={CHANGE_LOG_ENTITY_TYPE.ITEM} entityId={i.id} entityName={i.name} entityCreatedAt={i.createdAt} className="w-full" />,
    });

    return list;
  }, [item, canEdit, canViewPrices, setField, scheduledNextOrder, loadBrands, loadCategories, loadSuppliers]);

  const actions = useMemo<PageAction[]>(() => {
    const list: PageAction[] = [];
    if (canEdit && item) {
      list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.inventory.products.edit(item.id)) });
    }
    return list;
  }, [canEdit, item, navigate, refetch]);

  const errorNode: ReactNode = error ? "Produto não encontrado." : undefined;

  return (
    <DetailPage<Item>
      detailKey="item-detail"
      data={item}
      isLoading={isLoading}
      error={errorNode}
      emptyMessage="Produto não encontrado."
      sections={sections}
      title={item?.name ?? "Produto"}
      icon={IconPackage}
      actions={actions}
      breadcrumbs={[
        { label: "Início", href: routes.home },
        { label: "Estoque", href: routes.inventory.root },
        { label: "Produtos", href: routes.inventory.products.root },
        { label: item?.name ?? "Detalhe" },
      ]}
      navigation={{
        ids: (location.state as { ids?: string[] } | null)?.ids,
        toRoute: (rid) => routes.inventory.products.details(rid),
      }}
    />
  );
}
