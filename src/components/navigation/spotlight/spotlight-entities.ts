import { routes, TASK_STATUS_LABELS, ORDER_STATUS_LABELS, CONTRACT_STATUS_LABELS, PAINT_FINISH_LABELS } from "@/constants";
import type { GlobalSearchEntity } from "@/types";

export interface SpotlightEntityMeta {
  label: string;
  detailRoute: (id: string) => string;
  /** Maps the raw status enum returned by the API to a pt-BR label. */
  statusLabels?: Record<string, string>;
  /** Entity key for getBadgeVariant (badge-colors ENTITY_BADGE_CONFIG). */
  badgeEntity?: string;
}

export const SPOTLIGHT_ENTITIES: Record<GlobalSearchEntity, SpotlightEntityMeta> = {
  TASK: {
    label: "Tarefas",
    detailRoute: routes.production.schedule.details,
    statusLabels: TASK_STATUS_LABELS,
    badgeEntity: "TASK",
  },
  ITEM: {
    label: "Produtos",
    detailRoute: routes.inventory.products.details,
  },
  ORDER: {
    label: "Pedidos",
    detailRoute: routes.inventory.orders.details,
    statusLabels: ORDER_STATUS_LABELS,
    badgeEntity: "ORDER",
  },
  USER: {
    label: "Colaboradores",
    detailRoute: routes.administration.collaborators.details,
    statusLabels: CONTRACT_STATUS_LABELS,
  },
  PAINT: {
    label: "Tintas",
    detailRoute: routes.painting.catalog.details,
    statusLabels: PAINT_FINISH_LABELS,
  },
  CUSTOMER: {
    label: "Clientes",
    detailRoute: routes.financial.customers.details,
  },
  SUPPLIER: {
    label: "Fornecedores",
    detailRoute: routes.inventory.suppliers.details,
  },
};
