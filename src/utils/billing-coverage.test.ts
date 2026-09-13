/**
 * A COBERTURA DO FATURAMENTO, do lado da TELA.
 *
 * O DEFEITO QUE ESTE ARQUIVO IMPEDE
 * ─────────────────────────────────────────────────────────────────────────────
 * Os assistentes tinham UM PASSO POR FATURA e chamavam todos de "Cliente N". Num
 * orçamento cobrado veículo a veículo as N faturas são do MESMO cliente, então a
 * tela mostrava "Cliente 1", "Cliente 2", "Cliente 3", "Cliente 4" — o mesmo
 * nome quatro vezes, sem dizer de qual caminhão era cada passo. O operador
 * editava o segundo achando que era o segundo veículo.
 *
 * Pior: o save reenviava as quatro SEM a cobertura, o servidor entendia "decida
 * pelo modo" e reexpandia cada uma sobre todas as fatias — a última gravando por
 * cima das outras três, levando desconto, condição de pagamento e "gerar
 * NF/boleto" junto.
 *
 * O que este arquivo protege é a correção das duas coisas: a tela NOMEIA a
 * cobertura, e a partição que ela monta é a mesma que a API monta (espelha
 * `planCoverage` de `api/src/utils/quote-money.ts`).
 */

import { describe, expect, it } from "vitest";
import {
  configsForTask,
  coverageLabels,
  coverageSummary,
  coveredTaskCount,
  coversTask,
  dedupeConfigsByCustomer,
} from "./quote-tasks";
import { computeQuoteMoney, planCoverage } from "./quote-money";
import {
  expandConfigsIntoLots,
  groupsForSplit,
  normalizeGroups,
} from "@/components/financial/shared/billing-split-field";

const CLIENTE_A = "b593f440-9f00-4c85-93ef-54bf5a9eef37";
const CLIENTE_B = "0f723f76-f3b6-41c9-ae1f-3c1209955f58";

const VEICULOS = [
  { id: "t1", serialNumber: "16677", truck: { plate: "ABC1D23" } },
  { id: "t2", serialNumber: "16678", truck: { plate: "ABC1D24" } },
  { id: "t3", serialNumber: "16679", truck: { plate: "ABC1D25" } },
  { id: "t4", serialNumber: "16680", truck: { plate: "ABC1D26" } },
];

const cov = (...ids: string[]) => ids.map((taskId) => ({ taskId }));

describe("de quais veículos é esta fatura", () => {
  it("conta a cobertura", () => {
    expect(coveredTaskCount({ coveredTasks: cov("t1", "t2") })).toBe(2);
    expect(coveredTaskCount({ coveredTasks: [] })).toBe(0);
    expect(coveredTaskCount({})).toBe(0);
  });

  it("responde se cobra um veículo", () => {
    const lote = { coveredTasks: cov("t1", "t2") };
    expect(coversTask(lote, "t2")).toBe(true);
    expect(coversTask(lote, "t3")).toBe(false);
    expect(coversTask(lote, null)).toBe(false);
  });

  it("nomeia pelo que o operador lê: série, senão placa", () => {
    expect(coverageLabels({ coveredTasks: cov("t1", "t3") }, VEICULOS)).toEqual(["16677", "16679"]);
    // Sem série, a placa. Sem as duas, o começo do id — nunca vazio.
    expect(coverageLabels({ coveredTasks: cov("x9") }, VEICULOS)).toEqual(["x9"]);
  });

  it("resume sem virar ruído: cobrir todos não vira lista de sessenta séries", () => {
    expect(coverageSummary({ coveredTasks: cov("t1", "t2", "t3", "t4") }, 4, VEICULOS)).toBe(
      "Todos os 4 veículos",
    );
    expect(coverageSummary({ coveredTasks: cov("t2") }, 4, VEICULOS)).toBe("16678");
    expect(coverageSummary({ coveredTasks: cov("t1", "t2") }, 4, VEICULOS)).toBe("16677, 16678");
    expect(coverageSummary({ coveredTasks: cov("t1", "t2", "t3") }, 4, VEICULOS)).toBe(
      "16677, 16678, 16679",
    );
  });
});

describe("as faturas que dizem respeito a ESTE veículo", () => {
  const perTask = [
    { id: "c1", customerId: CLIENTE_A, coveredTasks: cov("t1") },
    { id: "c2", customerId: CLIENTE_A, coveredTasks: cov("t2") },
    { id: "c3", customerId: CLIENTE_A, coveredTasks: cov("t3") },
    { id: "c4", customerId: CLIENTE_A, coveredTasks: cov("t4") },
  ];

  it("a tela do caminhão 2 mostra a fatura DELE, não as quatro", () => {
    expect(configsForTask(perTask, "t2").map((c) => c.id)).toEqual(["c2"]);
  });

  it("numa fatura conjunta, a tela de qualquer caminhão mostra a fatura", () => {
    const joint = [{ id: "c1", customerId: CLIENTE_A, coveredTasks: cov("t1", "t2", "t3", "t4") }];
    expect(configsForTask(joint, "t3").map((c) => c.id)).toEqual(["c1"]);
  });

  it("em lotes, mostra o lote que cobra este veículo", () => {
    const lotes = [
      { id: "c1", customerId: CLIENTE_A, coveredTasks: cov("t1", "t2") },
      { id: "c2", customerId: CLIENTE_A, coveredTasks: cov("t3", "t4") },
    ];
    expect(configsForTask(lotes, "t4").map((c) => c.id)).toEqual(["c2"]);
  });

  it("com dois clientes conjuntos, mostra as duas faturas", () => {
    const dois = [
      { id: "c1", customerId: CLIENTE_A, coveredTasks: cov("t1", "t2") },
      { id: "c2", customerId: CLIENTE_B, coveredTasks: cov("t1", "t2") },
    ];
    expect(configsForTask(dois, "t1").map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("cobertura ausente (consulta enxuta) continua valendo para todos", () => {
    const semCobertura = [{ id: "c1", customerId: CLIENTE_A }];
    expect(configsForTask(semCobertura, "t1").map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("um passo por CLIENTE, e a partição num campo só", () => {
  const quatroFaturas = [
    { id: "c1", customerId: CLIENTE_A, coveredTasks: cov("t1") },
    { id: "c2", customerId: CLIENTE_A, coveredTasks: cov("t2") },
    { id: "c3", customerId: CLIENTE_A, coveredTasks: cov("t3") },
    { id: "c4", customerId: CLIENTE_A, coveredTasks: cov("t4") },
  ];

  it("quatro faturas de um cliente viram UM passo", () => {
    const { configs } = dedupeConfigsByCustomer(quatroFaturas);
    expect(configs.map((c) => c.id)).toEqual(["c1"]);
  });

  it("e a repartição sai delas", () => {
    expect(dedupeConfigsByCustomer(quatroFaturas).coverageGroups).toEqual([
      ["t1"],
      ["t2"],
      ["t3"],
      ["t4"],
    ]);
  });

  it("com dois clientes, a repartição sai do PRIMEIRO — unir os dois daria cada veículo duas vezes", () => {
    const dois = [
      { id: "a1", customerId: CLIENTE_A, coveredTasks: cov("t1", "t2") },
      { id: "b1", customerId: CLIENTE_B, coveredTasks: cov("t1", "t2") },
    ];
    const { configs, coverageGroups } = dedupeConfigsByCustomer(dois);
    expect(configs.map((c) => c.id)).toEqual(["a1", "b1"]);
    expect(coverageGroups).toEqual([["t1", "t2"]]);
  });
});

describe("a partição que a tela monta é a mesma que a API monta", () => {
  const ids = ["t1", "t2", "t3", "t4"];

  it("junto, separado e lotes batem com `planCoverage`", () => {
    expect(groupsForSplit("JOINT", ids)).toEqual(planCoverage("JOINT", ids));
    expect(groupsForSplit("PER_TASK", ids)).toEqual(planCoverage("PER_TASK", ids));
    const lotes = [["t1", "t2"], ["t3", "t4"]];
    expect(groupsForSplit("CUSTOM", ids, lotes)).toEqual(planCoverage("CUSTOM", ids, lotes));
  });

  it("veículo que nenhum lote reivindicou fica SOZINHO — nunca enfiado no primeiro", () => {
    // Enfiar mudaria em silêncio o valor de uma fatura já conferida.
    expect(normalizeGroups([["t1", "t2"]], ids)).toEqual([["t1", "t2"], ["t3"], ["t4"]]);
    expect(normalizeGroups([["t1", "t2"]], ids)).toEqual(planCoverage("CUSTOM", ids, [["t1", "t2"]]));
  });

  it("veículo em dois lotes fica no primeiro — é o que o índice único do banco proíbe", () => {
    expect(normalizeGroups([["t1", "t2"], ["t2", "t3"]], ids)).toEqual([
      ["t1", "t2"],
      ["t3"],
      ["t4"],
    ]);
  });

  it("veículo que saiu do orçamento some do lote", () => {
    expect(normalizeGroups([["t1", "t9"]], ["t1", "t2"])).toEqual([["t1"], ["t2"]]);
  });
});

describe("a expansão em lotes, no save", () => {
  const configs = [
    { id: "c1", customerId: CLIENTE_A, total: 100 },
    { id: "c2", customerId: CLIENTE_B, total: 200 },
  ];
  const ids = ["t1", "t2", "t3", "t4"];

  it("junto e separado passam direto — o servidor deriva a cobertura do modo", () => {
    expect(expandConfigsIntoLots(configs, "JOINT", ids)).toEqual(configs);
    expect(expandConfigsIntoLots(configs, "PER_TASK", ids)).toEqual(configs);
  });

  it("em lotes, vira uma fatura por (cliente × lote), com a cobertura", () => {
    const out = expandConfigsIntoLots(configs, "CUSTOM", ids, [["t1", "t2"], ["t3", "t4"]]);
    expect(out).toHaveLength(4);
    expect(out.map((c) => c.taskIds)).toEqual([
      ["t1", "t2"],
      ["t1", "t2"],
      ["t3", "t4"],
      ["t3", "t4"],
    ]);
    expect(out.map((c) => c.customerId)).toEqual([CLIENTE_A, CLIENTE_B, CLIENTE_A, CLIENTE_B]);
  });

  it("o `id` NÃO acompanha a expansão — repeti-lo casaria os K lotes com a MESMA linha", () => {
    const out = expandConfigsIntoLots(configs, "CUSTOM", ids, [["t1", "t2"], ["t3", "t4"]]);
    expect(out.every((c) => c.id === undefined)).toBe(true);
  });
});

describe("o dinheiro fecha nos três modos", () => {
  // Marquespan: R$ 13.830,00 por veículo, 12% ⇒ R$ 12.170,40 cada.
  const money = (covered?: number) =>
    computeQuoteMoney({
      serviceAmounts: [4545, 1285, 8000],
      discountType: "PERCENTAGE",
      discountValue: 12,
      taskCount: 60,
      coveredTaskCount: covered,
    });

  it("a soma das faturas reconstrói o contrato", () => {
    const CONTRATO = 730224;
    expect(money(60).configTotal).toBe(CONTRATO);
    expect(
      Math.round(Array.from({ length: 60 }, () => money(1).configTotal).reduce((a, b) => a + b, 0) * 100) / 100,
    ).toBe(CONTRATO);
    expect(
      Math.round([20, 20, 20].map((k) => money(k).configTotal).reduce((a, b) => a + b, 0) * 100) / 100,
    ).toBe(CONTRATO);
  });

  it("cobertura vazia cai no orçamento inteiro, nunca em R$ 0,00", () => {
    expect(money(0).configTotal).toBe(730224);
    expect(money(undefined).configTotal).toBe(730224);
  });
});
