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
  taskInvoiceCustomerLabel,
  taskInvoiceCustomerNames,
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

describe('"Faturar Para" numa linha de TAREFA', () => {
  const nomeA = "53.842.320 Kennedy de Campos Teixeira";
  const nomeB = "Transportes Marquespan Ltda";
  const clienteA = { id: CLIENTE_A, corporateName: nomeA };
  const clienteB = { id: CLIENTE_B, corporateName: nomeB };

  /** Quatro veículos de UM cliente, cobrados um a um — o caso do print. */
  const porVeiculo = [
    { id: "c1", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t1" }] },
    { id: "c2", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t2" }] },
    { id: "c3", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t3" }] },
    { id: "c4", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t4" }] },
  ];

  it("o mesmo cliente NÃO se repete uma vez por veículo", () => {
    // Era isto que a tela imprimia: o nome quatro vezes no detalhe de UM caminhão.
    expect(taskInvoiceCustomerNames(porVeiculo, "t1")).toEqual([nomeA]);
    expect(taskInvoiceCustomerLabel(porVeiculo, "t3")).toBe(nomeA);
  });

  it("fatura conjunta cobrindo todos responde o mesmo em qualquer veículo", () => {
    const conjunta = [
      { id: "c1", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t1" }, { taskId: "t2" }] },
    ];
    expect(taskInvoiceCustomerNames(conjunta, "t1")).toEqual([nomeA]);
    expect(taskInvoiceCustomerNames(conjunta, "t2")).toEqual([nomeA]);
  });

  it("dois clientes dividindo os serviços do MESMO veículo aparecem os dois", () => {
    // O caso real em que mais de um nome é a resposta certa.
    const dois = [
      { id: "c1", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t1" }] },
      { id: "c2", customerId: CLIENTE_B, customer: clienteB, coveredTasks: [{ taskId: "t1" }] },
    ];
    expect(taskInvoiceCustomerNames(dois, "t1")).toEqual([nomeA, nomeB]);
  });

  it("a fatia de OUTRO veículo não vaza para esta linha", () => {
    const misto = [
      { id: "c1", customerId: CLIENTE_A, customer: clienteA, coveredTasks: [{ taskId: "t1" }] },
      { id: "c2", customerId: CLIENTE_B, customer: clienteB, coveredTasks: [{ taskId: "t2" }] },
    ];
    expect(taskInvoiceCustomerNames(misto, "t1")).toEqual([nomeA]);
    expect(taskInvoiceCustomerNames(misto, "t2")).toEqual([nomeB]);
  });

  it("sem a cobertura na resposta, degrada para o cliente — nunca para linha vazia", () => {
    // Consulta que não pediu `coveredTasks`: melhor um nome a mais do que nenhum.
    const semCobertura = [{ id: "c1", customerId: CLIENTE_A, customer: clienteA }];
    expect(taskInvoiceCustomerLabel(semCobertura, "t1")).toBe(nomeA);
  });

  it("orçamento sem fatia nenhuma devolve string vazia", () => {
    expect(taskInvoiceCustomerLabel([], "t1")).toBe("");
    expect(taskInvoiceCustomerLabel(undefined, "t1")).toBe("");
  });
});

/**
 * O NÚMERO DO LOTE SAI DA LISTA DE VEÍCULOS, NÃO DA ORDEM DAS FATURAS.
 *
 * "Lote 1" é só a posição na lista, e ela herdava a ordem em que as faturas
 * voltavam da API. O painel abria de trás para frente — o primeiro caminhão no
 * Lote 4, o último no Lote 1 — e cada mudança renumerava tudo debaixo da mão do
 * operador: ele escolhia "Lote 4" e a linha passava a exibir "Lote 3".
 *
 * Ancorado no PRIMEIRO veículo de cada grupo, o número passa a derivar da mesma
 * ordem que a tela já mostra. Só rótulo: a identidade de um agrupamento é QUEM
 * está com QUEM, e nem o casamento de cobertura no servidor nem o recorte
 * material (que ordena `billingGroups` antes do hash) olham para a ordem.
 */
describe("a ordem dos lotes", () => {
  const ids = VEICULOS.map((v) => v.id);

  it("o lote do PRIMEIRO veículo é sempre o Lote 1, venha na ordem que vier", () => {
    const deTrasParaFrente = [["t4"], ["t3"], ["t2"], ["t1"]];
    expect(normalizeGroups(deTrasParaFrente, ids)).toEqual([
      ["t1"],
      ["t2"],
      ["t3"],
      ["t4"],
    ]);
  });

  it("com lotes compostos, ordena pelo primeiro membro de cada um", () => {
    expect(normalizeGroups([["t3", "t4"], ["t1", "t2"]], ids)).toEqual([
      ["t1", "t2"],
      ["t3", "t4"],
    ]);
  });

  it("o veículo que nenhum lote reivindicou entra sozinho, na posição dele", () => {
    // `t2` fora de qualquer grupo: vira um lote próprio, entre t1 e t3 — não no
    // fim da lista, que é onde a ordem de chegada o colocava.
    expect(normalizeGroups([["t1"], ["t3", "t4"]], ids)).toEqual([
      ["t1"],
      ["t2"],
      ["t3", "t4"],
    ]);
  });

  it("reordenar a entrada não muda a saída — é a mesma partição", () => {
    const a = normalizeGroups([["t2", "t1"], ["t4", "t3"]], ids);
    const b = normalizeGroups([["t4", "t3"], ["t2", "t1"]], ids);
    expect(a).toEqual(b);
  });
});
