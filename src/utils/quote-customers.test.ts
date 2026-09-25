/**
 * CLIENTES DISTINTOS, NÃO FATIAS.
 *
 * O DEFEITO QUE ESTE ARQUIVO IMPEDE
 * ─────────────────────────────────────────────────────────────────────────────
 * Antes do orçamento multitarefa havia UMA configuração de faturamento por
 * cliente, e `customerConfigs.length >= 2` era — por acidente — a forma correta
 * de perguntar "este orçamento tem mais de um cliente?".
 *
 * Com `billingSplit = PER_TASK` existe uma fatia POR VEÍCULO. O orçamento nº
 * 0976 (4 implementos, 1 cliente) tinha QUATRO configurações, e onze leituras
 * passaram a afirmar que havia quatro clientes. O pior efeito estava na página
 * pública, a tela em que o cliente ASSINA: os cinco serviços eram filtrados para
 * fora da lista — nenhum tem `invoiceToCustomerId`, e num orçamento de um
 * cliente só ninguém preenche esse campo — e o documento anunciava a seção
 * "Serviços" vazia e "Total geral R$ 0,00".
 */

import { describe, expect, it } from "vitest";
import { customerCount, distinctCustomerIds, hasMultipleCustomers } from "./quote-tasks";

const CLIENTE_A = "b593f440-9f00-4c85-93ef-54bf5a9eef37";
const CLIENTE_B = "0f723f76-f3b6-41c9-ae1f-3c1209955f58";

/** As quatro faturas do orçamento nº 0976: um cliente, um implemento cada. */
const perTaskUmCliente = [
  { customerId: CLIENTE_A, tasks: [{ taskId: "t1" }] },
  { customerId: CLIENTE_A, tasks: [{ taskId: "t2" }] },
  { customerId: CLIENTE_A, tasks: [{ taskId: "t3" }] },
  { customerId: CLIENTE_A, tasks: [{ taskId: "t4" }] },
];

describe("quantos clientes um orçamento fatura", () => {
  it("quatro fatias PER_TASK do mesmo cliente são UM cliente", () => {
    expect(customerCount(perTaskUmCliente)).toBe(1);
    expect(hasMultipleCustomers(perTaskUmCliente)).toBe(false);
  });

  it("contar fatias daria 4 — é exatamente o erro que isto substitui", () => {
    expect(perTaskUmCliente.length).toBe(4);
    expect(perTaskUmCliente.length >= 2).toBe(true);
    expect(hasMultipleCustomers(perTaskUmCliente)).toBe(false);
  });

  it("dois clientes de verdade continuam sendo dois", () => {
    expect(
      hasMultipleCustomers([{ customerId: CLIENTE_A }, { customerId: CLIENTE_B }]),
    ).toBe(true);
  });

  it("PER_TASK com dois clientes e oito fatias ainda são dois", () => {
    const oito = [
      ...perTaskUmCliente,
      { customerId: CLIENTE_B, tasks: [{ taskId: "t1" }] },
      { customerId: CLIENTE_B, tasks: [{ taskId: "t2" }] },
      { customerId: CLIENTE_B, tasks: [{ taskId: "t3" }] },
      { customerId: CLIENTE_B, tasks: [{ taskId: "t4" }] },
    ];
    expect(customerCount(oito)).toBe(2);
    expect(hasMultipleCustomers(oito)).toBe(true);
  });

  it("o caso JOINT de sempre não muda", () => {
    expect(hasMultipleCustomers([{ customerId: CLIENTE_A }])).toBe(false);
  });

  it("lê o cliente pela relação incluída quando a FK não veio no select", () => {
    expect(customerCount([{ customer: { id: CLIENTE_A } }, { customer: { id: CLIENTE_B } }])).toBe(2);
  });

  it("fatia sem cliente é registro pela metade, não um cliente a mais", () => {
    // Contá-la seria repetir o erro por outro caminho: o formulário cria a
    // fatia antes de o cliente ser escolhido, e nesse instante o orçamento
    // passaria a se comportar como multicliente.
    expect(customerCount([{ customerId: CLIENTE_A }, { customerId: null }])).toBe(1);
    expect(customerCount([{ customerId: CLIENTE_A }, {}])).toBe(1);
  });

  it("vazio e nulo são zero, nunca um erro", () => {
    expect(customerCount([])).toBe(0);
    expect(customerCount(null)).toBe(0);
    expect(customerCount(undefined)).toBe(0);
    expect(hasMultipleCustomers(null)).toBe(false);
  });

  it("a ordem de aparição é preservada — as telas rotulam 'Cliente 1', 'Cliente 2'", () => {
    expect(
      distinctCustomerIds([
        { customerId: CLIENTE_B },
        { customerId: CLIENTE_A },
        { customerId: CLIENTE_B },
      ]),
    ).toEqual([CLIENTE_B, CLIENTE_A]);
  });
});
