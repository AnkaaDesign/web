import { describe, expect, it } from "vitest";
import {
  canEditPayerDocument,
  changedCustomerFieldLabels,
  customerUpdatePatch,
  duplicatePayerIndex,
  existingCustomerIdFromError,
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
    const config = {
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
});
