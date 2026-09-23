/**
 * A LENTE DO "FATURAR PARA" nas colunas — e no que o PDF/XLSX leva.
 *
 * Caso real, orçamento 269: UMA cobrança, DOIS pagadores. A Ibiporã paga
 * R$ 14.306,00 e já pagou; a RKO paga R$ 13.850,60 e está vencida. Filtrando pela
 * RKO, a lista mostrava R$ 28.156,60 — e o PDF mandado à RKO cobrava dela a parte
 * da Ibiporã. O export lê `meta.exportValue` pelo mesmo caminho da tabela
 * (`rawColumnValue`), então testar esse caminho é testar o arquivo.
 */
import { describe, expect, it } from "vitest";

import { rawColumnValue } from "@/components/ui/datatable/data-table-utils";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Billing } from "@/types/budget";
import { formatCurrency } from "@/utils";
import { withPricingVisible } from "@/utils/pricing-visibility";
import { billingExportLabels, createBillingColumns } from "./billing-table-columns";

const IBIPORA = "cust-ibipora";
const RKO = "cust-rko";

const b269 = {
  id: "billing-269",
  quoteId: "quote-269",
  status: "OVERDUE",
  statusOrder: 1,
  approvedAt: "2026-09-01T12:00:00.000Z",
  quote: { id: "quote-269", budgetNumber: 269, vehicleCount: 1, total: 28156.6, subtotal: 30605 },
  tasks: [{ taskId: "t1", task: { id: "t1", name: "RKO Alimentos", serialNumber: "78000", finishedAt: "2026-08-30T12:00:00.000Z" } }],
  customerConfigs: [
    {
      id: "cfg-ibipora",
      customerId: IBIPORA,
      subtotal: 15550,
      total: 14306,
      customer: { corporateName: "Industria de Carrocerias Metalicas Ibipora LTDA" },
      installments: [{ id: "i1", number: 1, dueDate: "2026-09-05T12:00:00.000Z", amount: 14306, paidAmount: 14306, status: "PAID" }],
    },
    {
      id: "cfg-rko",
      customerId: RKO,
      subtotal: 15055,
      total: 13850.6,
      customer: { corporateName: "RKO Alimentos LTDA" },
      installments: [
        { id: "i2", number: 1, dueDate: "2026-09-10T12:00:00.000Z", amount: 6925.3, paidAmount: 2000, status: "OVERDUE" },
        { id: "i3", number: 2, dueDate: "2026-10-10T12:00:00.000Z", amount: 6925.3, paidAmount: 0, status: "PENDING" },
      ],
    },
  ],
} as unknown as Billing;

// Uma cobrança só da RKO, sem divisão — para a linha "Total" ter duas parcelas.
const b300 = {
  id: "billing-300",
  quoteId: "quote-300",
  status: "APPROVED",
  statusOrder: 3,
  quote: { id: "quote-300", budgetNumber: 300, vehicleCount: 1, total: 1000, subtotal: 1000 },
  tasks: [],
  customerConfigs: [
    {
      id: "cfg-300",
      customerId: RKO,
      subtotal: 1000,
      total: 1000,
      customer: { corporateName: "RKO Alimentos LTDA" },
      installments: [{ id: "i4", number: 1, dueDate: "2026-10-01T12:00:00.000Z", amount: 1000, paidAmount: 0, status: "PENDING" }],
    },
  ],
} as unknown as Billing;

/** O valor como o ARQUIVO o leva — o export força os preços visíveis. */
const brl = (n: number) => withPricingVisible(() => formatCurrency(n));
/** A linha "Total" do PDF, pelo mesmo caminho do exportador. */
const totalOf = (cols: DataTableColumnDef<Billing>[], id: string, rows: Billing[]) =>
  withPricingVisible(() => col(cols, id).meta?.exportTotal?.(rows));

const col = (cols: DataTableColumnDef<Billing>[], id: string) => {
  const found = cols.find((c) => c.id === id);
  if (!found) throw new Error(`coluna ${id} não existe`);
  return found;
};
const exported = (cols: DataTableColumnDef<Billing>[], id: string, row: Billing) => rawColumnValue(col(cols, id), row);

describe("Faturamento — sem lente, a cobrança inteira", () => {
  const cols = createBillingColumns();

  it("Valor e Subtotal somam os dois pagadores", () => {
    expect(exported(cols, "billingTotal", b269)).toBe(brl(28156.6));
    expect(exported(cols, "billingSubtotal", b269)).toBe(brl(30605));
  });

  it("Faturar Para lista os dois, e o estado é o da cobrança", () => {
    expect(exported(cols, "invoiceToCustomers", b269)).toEqual(["Industria de Carrocerias Metalicas Ibipora LTDA", "RKO Alimentos LTDA"]);
    expect(exported(cols, "billingStatus", b269)).toBe("Vencido");
    expect(exported(cols, "installments", b269)).toBe("1/3");
  });

  it("Em Aberto é o valor menos o que entrou (14.306 + 2.000)", () => {
    expect(exported(cols, "openBalance", b269)).toBe(brl(28156.6 - 14306 - 2000));
  });
});

describe("Faturamento — lente RKO: só a parte dela", () => {
  const cols = createBillingColumns({ lens: [RKO] });
  const rko269 = { ...b269, payerStatus: "OVERDUE" } as Billing;

  it("Valor e Subtotal são os da RKO — nunca os R$ 28.156,60 da cobrança", () => {
    expect(exported(cols, "billingTotal", rko269)).toBe(brl(13850.6));
    expect(exported(cols, "billingSubtotal", rko269)).toBe(brl(15055));
  });

  it("Faturar Para leva só a RKO — o nome de quem divide não vai para o documento dela", () => {
    expect(exported(cols, "invoiceToCustomers", rko269)).toEqual(["RKO Alimentos LTDA"]);
  });

  it("Parcelas, Vencimento e Em Aberto são os da RKO", () => {
    expect(exported(cols, "installments", rko269)).toBe("0/2");
    expect(exported(cols, "currentInstallmentDueDate", rko269)).toBe("10/09/2026");
    expect(exported(cols, "openBalance", rko269)).toBe(brl(11850.6));
  });

  it("o estado é o da parte (`payerStatus`), não o da cobrança", () => {
    const ibiporaCols = createBillingColumns({ lens: [IBIPORA] });
    const ibipora269 = { ...b269, payerStatus: "SETTLED" } as Billing;
    expect(exported(ibiporaCols, "billingStatus", ibipora269)).toBe("Liquidado");
    // …e liquidado não deve nada, mesmo que a outra parte deva.
    expect(exported(ibiporaCols, "openBalance", ibipora269)).toBe("");
  });

  it("colunas da cobrança e dos veículos não mudam com a lente", () => {
    const semLente = createBillingColumns();
    for (const id of ["budgetNumber", "name", "identificador", "coveredVehicles", "finishedAt"]) {
      expect(exported(cols, id, rko269)).toEqual(exported(semLente, id, rko269));
    }
  });

  it("a linha Total do PDF soma as partes da RKO", () => {
    const rows = [rko269, { ...b300, payerStatus: "APPROVED" } as Billing];
    expect(totalOf(cols, "billingTotal", rows)).toBe(brl(14850.6));
    expect(totalOf(cols, "openBalance", rows)).toBe(brl(12850.6));
  });

  it("sem pagador da lente carregado, travessão — nunca o valor da cobrança inteira", () => {
    const semPagadores = { ...b269, customerConfigs: [] } as unknown as Billing;
    expect(exported(cols, "billingTotal", semPagadores)).toBe("");
  });
});

describe("Faturamento — o PDF diz de quem é", () => {
  it("com um cliente: título e arquivo com o nome, e o aviso da divisão sem dizer com quem", () => {
    const labels = billingExportLabels([RKO], ["RKO Alimentos LTDA"]);
    expect(labels.title).toBe("Faturamento — RKO Alimentos LTDA");
    expect(labels.filename).toBe("faturamento_rko-alimentos-ltda");
    const subtitle = labels.subtitle([b269, b300]);
    expect(subtitle).toBe(
      "Cliente: RKO Alimentos LTDA. Nos faturamentos divididos com outra empresa, os valores são somente a parte deste cliente.",
    );
    expect(subtitle).not.toContain("Ibipora");
  });

  it("sem cobrança dividida entre as exportadas, só o nome", () => {
    expect(billingExportLabels([RKO], ["RKO Alimentos LTDA"]).subtitle([b300])).toBe("Cliente: RKO Alimentos LTDA.");
  });

  it("sem lente, nada muda", () => {
    const labels = billingExportLabels([], []);
    expect(labels).toMatchObject({ title: "Faturamento", filename: "faturamento" });
    expect(labels.subtitle([b269])).toBeUndefined();
  });
});
