import { describe, expect, it } from "vitest";
import {
  canEditPayerDocument,
  changedCustomerFieldLabels,
  customerStillPays,
  customerUpdatePatch,
  distinctPayerCustomerIds,
  duplicatePayerIndex,
  existingCustomerIdFromError,
  isCnpjLookupStillCurrent,
  mergedCustomerPatch,
  newPayerConfig,
  remapServicesPayer,
  swapPayerCustomer,
} from "./budget-payers";

const ibipora = {
  id: "c-ibipora",
  corporateName: "Industria de Carrocerias Metalicas Ibipora LTDA",
  fantasyName: "Ibipora Implementos",
  cnpj: "85462471000174",
  city: "Ibiporã",
  zipCode: "86204-020",
};
const sola = { id: "c-sola", corporateName: "Sola Transportes", fantasyName: "Sola", cnpj: "11222333000181" };

describe("swapPayerCustomer", () => {
  it("refaz a cópia do cadastro inteira: nada do anterior sobra, nem o editado", () => {
    const config: Record<string, any> = {
      ...newPayerConfig(ibipora),
      id: "payer-row-1",
      paymentConfig: { type: "CASH" },
      generateBankSlip: false,
    };
    config.customerData.city = "editado à mão";
    const swapped = swapPayerCustomer(config, sola);
    expect(swapped.customerId).toBe("c-sola");
    expect(swapped.customerData.corporateName).toBe("Sola Transportes");
    expect(swapped.customerData.cnpj).toBe("11222333000181");
    expect(swapped.customerData.city).toBe("");
    // As condições do faturamento ficam; a linha vira um pagador novo.
    expect(swapped.paymentConfig).toEqual({ type: "CASH" });
    expect(swapped.generateBankSlip).toBe(false);
    expect(swapped.id).toBeUndefined();
  });
  it("o mesmo cliente não mexe em nada", () => {
    const config = newPayerConfig(ibipora);
    expect(swapPayerCustomer(config, ibipora)).toBe(config);
  });
});

describe("duplicatePayerIndex", () => {
  it("acha o mesmo cliente em outro pagador", () => {
    const configs = [{ customerId: "a" }, { customerId: "b" }];
    expect(duplicatePayerIndex(configs, "b")).toBe(1);
    expect(duplicatePayerIndex(configs, "b", 1)).toBe(-1);
    expect(duplicatePayerIndex(configs, "z")).toBe(-1);
  });
});

describe("duplicatePayerIndex com o recorte de uma cobrança", () => {
  const configs = [{ customerId: "A" }, { customerId: "A" }, { customerId: "B" }];
  it("o mesmo cliente em faturas irmãs não é duplicidade dentro do recorte", () => {
    expect(duplicatePayerIndex(configs, "A", 1, [1, 2])).toBe(-1);
  });
  it("o mesmo cliente duas vezes na mesma fatura é", () => {
    expect(duplicatePayerIndex(configs, "B", -1, [1, 2])).toBe(2);
  });
  it("sem recorte, olha o orçamento inteiro", () => {
    expect(duplicatePayerIndex(configs, "A", 1)).toBe(0);
  });
});

describe("customerStillPays e distinctPayerCustomerIds", () => {
  it("o cliente que continua em outra fatura ainda paga", () => {
    expect(customerStillPays([{ customerId: "A" }, { customerId: "B" }], "A")).toBe(true);
    expect(customerStillPays([{ customerId: "B" }], "A")).toBe(false);
  });
  it("clientes distintos, na ordem", () => {
    expect(distinctPayerCustomerIds([{ customerId: "A" }, { customerId: "A" }, null, { customerId: "B" }])).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("remapServicesPayer", () => {
  it("leva os serviços do pagador trocado para o novo, ou para ninguém", () => {
    const services = [{ invoiceToCustomerId: "a" }, { invoiceToCustomerId: "b" }];
    expect(remapServicesPayer(services, "a", "c").map((s) => s.invoiceToCustomerId)).toEqual(["c", "b"]);
    expect(remapServicesPayer(services, "a", null).map((s) => s.invoiceToCustomerId)).toEqual([null, "b"]);
  });
});

describe("customerUpdatePatch", () => {
  it("manda só o que mudou, comparando documento e CEP por dígitos", () => {
    const data = { ...newPayerConfig(ibipora).customerData, zipCode: "86204020", city: "Londrina" };
    expect(customerUpdatePatch(ibipora, data)).toEqual({ city: "Londrina" });
    expect(changedCustomerFieldLabels(ibipora, data)).toEqual(["Cidade"]);
  });
  it("nada mudou: nada a gravar", () => {
    expect(customerUpdatePatch(ibipora, newPayerConfig(ibipora).customerData)).toEqual({});
  });
  it("campo apagado não apaga o cadastro", () => {
    expect(customerUpdatePatch(ibipora, { ...newPayerConfig(ibipora).customerData, city: "" })).toEqual({});
  });
  it("documento de cadastro que já tem um não muda pelo faturamento", () => {
    const data = { ...newPayerConfig(ibipora).customerData, cnpj: "11.222.333/0001-81" };
    expect(customerUpdatePatch(ibipora, data)).toEqual({});
    expect(canEditPayerDocument(ibipora)).toBe(false);
  });
  it("cadastro sem documento recebe o documento em dígitos", () => {
    const semDoc = { id: "x", corporateName: "Nova" };
    expect(canEditPayerDocument(semDoc)).toBe(true);
    expect(customerUpdatePatch(semDoc, { cnpj: "11.222.333/0001-81" })).toEqual({ cnpj: "11222333000181" });
  });
});

describe("existingCustomerIdFromError", () => {
  it("lê o id do dono do documento no 409", () => {
    const error = { response: { status: 409, data: { details: { existingCustomerId: "c-sola" } } } };
    expect(existingCustomerIdFromError(error)).toBe("c-sola");
    expect(existingCustomerIdFromError({ response: { data: { existingCustomerId: "c1" } } })).toBe("c1");
    expect(existingCustomerIdFromError(new Error("x"))).toBeNull();
  });
  it("lê o 409 no formato REAL que o interceptor do axiosClient rejeita", () => {
    // `axiosClient` rejeita com `new Error(msg)` + `originalError` (o AxiosError).
    const enhanced = Object.assign(new Error("Cliente já cadastrado"), {
      _statusCode: 409,
      originalError: { response: { status: 409, data: { details: { existingCustomerId: "c-sola" } } } },
    });
    expect(existingCustomerIdFromError(enhanced)).toBe("c-sola");
  });
});

describe("isCnpjLookupStillCurrent", () => {
  const target = { customerId: "a", digits: "11222333000181" };
  it("vale se o pagador e o documento são os mesmos do disparo", () => {
    expect(isCnpjLookupStillCurrent(target, { customerId: "a", cnpj: "11.222.333/0001-81" })).toBe(true);
  });
  it("descarta se o cliente do pagador foi trocado no meio", () => {
    expect(isCnpjLookupStillCurrent(target, { customerId: "b", cnpj: "11.222.333/0001-81" })).toBe(false);
  });
  it("descarta se o documento foi editado depois do disparo", () => {
    expect(isCnpjLookupStillCurrent(target, { customerId: "a", cnpj: "11.222.333/0001-8" })).toBe(false);
  });
});

describe("mergedCustomerPatch", () => {
  const record = { id: "x", corporateName: "X LTDA", city: "Ibiporã", address: "Rua A" };
  it("a edição em QUALQUER cópia entra no patch (não só a primeira)", () => {
    const intacta = { corporateName: "X LTDA", city: "Ibiporã", address: "Rua A" };
    const editada = { corporateName: "X LTDA", city: "Ibiporã", address: "Rua B" };
    expect(mergedCustomerPatch(record, [intacta, editada])).toEqual({ patch: { address: "Rua B" }, conflicts: [] });
  });
  it("cópias com valores diferentes: vale a primeira e o campo volta como conflito", () => {
    const a = { address: "Rua B" };
    const b = { address: "Rua C", city: "Londrina" };
    expect(mergedCustomerPatch(record, [a, b])).toEqual({
      patch: { address: "Rua B", city: "Londrina" },
      conflicts: ["address"],
    });
  });
});

