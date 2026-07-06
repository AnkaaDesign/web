import { IconChecklist, IconBuilding, IconBuildingFactory2, IconCalendar, IconCurrencyDollar } from "@tabler/icons-react";
import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Task } from "@/types";
import type { TaskGetManyFormData } from "@/schemas";
import { TASK_STATUS, TASK_STATUS_LABELS, SECTOR_PRIVILEGES } from "@/constants";

export const TASK_HISTORY_DEFAULT_PAGE_SIZE = 40;

/** Sectors allowed to change the Status filter (and thus see cancelled / non-completed tasks). */
const STATUS_FILTER_VIEWERS: SECTOR_PRIVILEGES[] = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL];

/** Sectors allowed to filter by monetary value (mirrors the price column gate). */
const PRICE_FILTER_VIEWERS: SECTOR_PRIVILEGES[] = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL];

/**
 * Trimmed server `include` — only what the history columns render. Uses a TOP-LEVEL `include`
 * (not a top-level `select`) so the API repository's Decimal→number mapper runs and `quote.total`
 * arrives as a real number (the Total column / export coerces defensively as a backstop).
 */
export const TASK_HISTORY_LIST_INCLUDE = {
  customer: { select: { id: true, fantasyName: true, corporateName: true } },
  sector: { select: { id: true, name: true } },
  responsibles: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  observation: { select: { id: true, description: true } },
  generalPainting: { include: { paintType: true, paintBrand: true } },
  serviceOrders: {
    select: { id: true, status: true, type: true, description: true, assignedToId: true, assignedTo: { select: { id: true, name: true } } },
  },
  truck: {
    include: {
      leftSideMeasure: { include: { sections: true } },
      rightSideMeasure: { include: { sections: true } },
      backSideMeasure: { include: { sections: true } },
    },
  },
  quote: { include: { customerConfigs: { include: { customer: { select: { id: true, corporateName: true, fantasyName: true } } } } } },
} as const;

/** Option lists loaded by the page for the entity filters. */
export interface TaskHistoryFilterOptionSources {
  sectors: { value: string; label: string }[];
  customers: { value: string; label: string }[];
}

/**
 * Declarative filter set for the History table. Status is gated to ADMIN/COMMERCIAL/FINANCIAL —
 * other sectors never reach the filter and `buildTaskHistoryQuery` keeps them pinned to COMPLETED.
 */
export function createTaskHistoryFilterDefs(sources: TaskHistoryFilterOptionSources): DataTableFilterDef<Task>[] {
  return [
    {
      key: "status",
      label: "Status",
      type: "multiselect",
      icon: <IconChecklist className="h-4 w-4" />,
      placeholder: "Selecione status...",
      requiredPrivilege: STATUS_FILTER_VIEWERS,
      options: (Object.values(TASK_STATUS) as TASK_STATUS[]).map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
    },
    {
      key: "sectorIds",
      label: "Setores",
      type: "multiselect",
      icon: <IconBuildingFactory2 className="h-4 w-4" />,
      placeholder: "Selecione setores...",
      options: sources.sectors,
    },
    {
      key: "customerIds",
      label: "Razão Social",
      type: "multiselect",
      icon: <IconBuilding className="h-4 w-4" />,
      placeholder: "Selecione clientes...",
      options: sources.customers,
    },
    {
      key: "finishedDateRange",
      label: "Data de Finalização",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "entryDateRange",
      label: "Data de Entrada",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "termRange",
      label: "Prazo",
      type: "date-range",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      key: "priceRange",
      label: "Faixa de Valor",
      type: "number-range",
      currency: true,
      icon: <IconCurrencyDollar className="h-4 w-4" />,
      requiredPrivilege: PRICE_FILTER_VIEWERS,
    },
  ];
}

type DateRangeValue = { from?: string; to?: string };
type NumberRangeValue = { min?: number; max?: number };

function activeDateRange(v: unknown): { from?: Date; to?: Date } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { from, to } = v as DateRangeValue;
  if (!from && !to) return undefined;
  return { ...(from ? { from: new Date(from) } : {}), ...(to ? { to: new Date(to) } : {}) };
}

/**
 * Map the declarative filter values + global search onto a `TaskGetManyFormData` query.
 * The Status default ([COMPLETED]) is applied here, so sectors that cannot see/change the
 * Status filter always get the completed-only history.
 */
export function buildTaskHistoryQuery(filters: DataTableFilterValues, search: string): Partial<TaskGetManyFormData> {
  const root: Record<string, unknown> = {};

  // Status (multi). Default to COMPLETED-only when nothing is selected.
  const status = filters.status;
  if (Array.isArray(status) && status.length > 0) {
    root.status = status as TASK_STATUS[];
  } else {
    root.status = [TASK_STATUS.COMPLETED];
  }

  const sectorIds = filters.sectorIds;
  if (Array.isArray(sectorIds) && sectorIds.length > 0) root.sectorIds = sectorIds;

  const customerIds = filters.customerIds;
  if (Array.isArray(customerIds) && customerIds.length > 0) root.customerIds = customerIds;

  const finished = activeDateRange(filters.finishedDateRange);
  if (finished) root.finishedDateRange = finished;
  const entry = activeDateRange(filters.entryDateRange);
  if (entry) root.entryDateRange = entry;
  const term = activeDateRange(filters.termRange);
  if (term) root.termRange = term;

  const price = filters.priceRange as NumberRangeValue | undefined;
  if (price && (price.min != null || price.max != null)) {
    root.priceRange = { ...(price.min != null ? { from: price.min } : {}), ...(price.max != null ? { to: price.max } : {}) };
  }

  if (search) root.searchingFor = search;

  return root as Partial<TaskGetManyFormData>;
}

/** Server-side sort mapping: column id → `orderBy` for that direction. Default = finishedAt desc. */
export const TASK_HISTORY_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  name: (d) => ({ name: d }),
  customer: (d) => ({ customer: { fantasyName: d } }),
  sector: (d) => ({ sector: { name: d } }),
  identificador: (d) => ({ serialNumber: d }),
  status: (d) => ({ status: d }),
  bonification: (d) => ({ bonificationOrder: d }),
  forecastDate: (d) => ({ forecastDate: d }),
  entryDate: (d) => ({ entryDate: d }),
  startedAt: (d) => ({ startedAt: d }),
  finishedAt: (d) => ({ finishedAt: d }),
  term: (d) => ({ term: d }),
  createdAt: (d) => ({ createdAt: d }),
};

/** Build the API `orderBy` from the table's sort state; defaults to finishedAt descending. */
export function buildTaskHistoryOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => TASK_HISTORY_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return { finishedAt: "desc" };
  return entries.length === 1 ? entries[0] : entries;
}
