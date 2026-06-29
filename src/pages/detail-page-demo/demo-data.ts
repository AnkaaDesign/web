import { useMemo, useSyncExternalStore } from "react";

/**
 * Shared in-memory dataset for BOTH demos: the DataTable demo (/data-table-demo) lists
 * these orders and navigates into the detail demo (/detail-page-demo/:id). A tiny external
 * store makes inline edits on the detail page stick for the session and reflect back in the
 * table — no backend needed. Deterministic seed so layout/persistence is stable across reloads.
 */

export type DemoStatus = "CRIADO" | "FEITO" | "RECEBIDO" | "CANCELADO" | "ATRASADO";
export type DemoPayment = "PAGO" | "PENDENTE" | "A_DEFINIR";

export interface DemoOrder {
  id: string;
  orderNumber: number;
  description: string;
  supplier: string;
  status: DemoStatus;
  payment: DemoPayment;
  itemsCount: number;
  total: number;
  tags: string[];
  urgent: boolean;
  forecast: string; // ISO
  createdAt: string; // ISO
  notes: string;
}

export const DEMO_STATUSES: DemoStatus[] = ["CRIADO", "FEITO", "RECEBIDO", "CANCELADO", "ATRASADO"];
export const DEMO_STATUS_LABELS: Record<DemoStatus, string> = {
  CRIADO: "Criado",
  FEITO: "Feito",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
  ATRASADO: "Atrasado",
};
export const DEMO_STATUS_VARIANT = {
  CRIADO: "secondary",
  FEITO: "created",
  RECEBIDO: "completed",
  CANCELADO: "cancelled",
  ATRASADO: "pending",
} as const;
/** A simple state machine so the status combobox demos restricted transitions. */
export const DEMO_STATUS_TRANSITIONS: Record<DemoStatus, DemoStatus[]> = {
  CRIADO: ["FEITO", "ATRASADO", "CANCELADO"],
  ATRASADO: ["FEITO", "CANCELADO"],
  FEITO: ["RECEBIDO", "CANCELADO"],
  RECEBIDO: [],
  CANCELADO: ["CRIADO"],
};

export const DEMO_PAYMENTS: DemoPayment[] = ["PAGO", "PENDENTE", "A_DEFINIR"];
export const DEMO_PAYMENT_LABELS: Record<DemoPayment, string> = { PAGO: "Pago", PENDENTE: "Pendente", A_DEFINIR: "A definir" };
export const DEMO_PAYMENT_VARIANT = { PAGO: "completed", PENDENTE: "pending", A_DEFINIR: "secondary" } as const;

export const DEMO_SUPPLIERS = ["Farben (Ronaldo)", "Actual Tintas", "Mercado Livre", "Fuso Air", "Compenfort", "Adere", "BR Epis"];
export const DEMO_TAGS = ["Tinta", "EPI", "Ferramenta", "Compressor", "Verniz", "Lixa", "Limpeza"];

const DESCRIPTIONS = [
  "Removedor Pastoso",
  "Óleo Compressor",
  "Filtros Bebedouros",
  "Chapas Compensado",
  "Endurecedores + Vernizes",
  "Pistola PRO 550",
  "Estopas de Pano",
  "Máscaras Respiratórias",
  "Pigmentos Automotivos",
  "Solventes",
];
const NOTES = [
  "Confirmar prazo de entrega com o fornecedor.",
  "Material para o galpão 2 — prioridade da produção.",
  "Aguardando aprovação do financeiro antes de faturar.",
  "Conferir nota fiscal na chegada; houve divergência na última compra.",
  "",
];
const UNITS = ["UN", "CX", "L", "KG", "PCT"];

const BASE = new Date("2026-06-27T12:00:00").getTime();
const DAY = 86_400_000;

function makeData(count: number): DemoOrder[] {
  return Array.from({ length: count }, (_, i) => {
    const tags = DEMO_TAGS.filter((_, t) => (i + t) % 3 === 0).slice(0, 3);
    return {
      id: `order-${i + 1}`,
      orderNumber: count - i,
      description: `${DESCRIPTIONS[i % DESCRIPTIONS.length]} ${String.fromCharCode(65 + (i % 26))}`,
      supplier: DEMO_SUPPLIERS[i % DEMO_SUPPLIERS.length],
      status: DEMO_STATUSES[i % DEMO_STATUSES.length],
      payment: DEMO_PAYMENTS[i % DEMO_PAYMENTS.length],
      itemsCount: (i % 5) + 1,
      total: Math.round((i * 137) % 9000) + 80 + (i % 7) * 12.5 + (i % 100) / 3,
      tags: tags.length ? tags : [DEMO_TAGS[i % DEMO_TAGS.length]],
      urgent: i % 4 === 0,
      forecast: new Date(BASE + ((i % 30) - 10) * DAY).toISOString(),
      createdAt: new Date(BASE - i * (DAY / 2)).toISOString(),
      notes: NOTES[i % NOTES.length],
    };
  });
}

// --- tiny external store (so inline edits persist for the session) ---------
let ORDERS: DemoOrder[] = makeData(240);
const listeners = new Set<() => void>();

export function getDemoOrders(): DemoOrder[] {
  return ORDERS;
}
export function getDemoOrder(id: string): DemoOrder | undefined {
  return ORDERS.find((o) => o.id === id);
}
export function updateDemoOrder(id: string, patch: Partial<DemoOrder>): void {
  ORDERS = ORDERS.map((o) => (o.id === id ? { ...o, ...patch } : o));
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDemoOrders(): DemoOrder[] {
  return useSyncExternalStore(subscribe, getDemoOrders, getDemoOrders);
}
export function useDemoOrder(id: string): DemoOrder | undefined {
  const orders = useDemoOrders();
  return useMemo(() => orders.find((o) => o.id === id), [orders, id]);
}

export interface DemoOrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}
/** Synthetic line items for the embedded "Itens" section. */
export function demoOrderItems(order: DemoOrder): DemoOrderItem[] {
  return Array.from({ length: order.itemsCount }, (_, i) => ({
    id: `${order.id}-item-${i + 1}`,
    name: DESCRIPTIONS[(order.orderNumber + i) % DESCRIPTIONS.length],
    quantity: ((order.orderNumber + i) % 9) + 1,
    unit: UNITS[i % UNITS.length],
  }));
}
