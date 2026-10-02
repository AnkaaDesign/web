import { describe, expect, it } from "vitest";
import { BUDGET_SIGNATURE_STATUS, TASK_QUOTE_STATUS } from "@/constants/enums";
import { budgetAxes, countApprovedArt, emissionBlockerItems } from "./budget-axes";

const axis = (input: Parameters<typeof budgetAxes>[0], key: string) =>
  budgetAxes(input).find((a) => a.key === key)!;

describe("budgetAxes", () => {
  it("devolve os quatro eixos na ordem da faixa", () => {
    const axes = budgetAxes({ status: TASK_QUOTE_STATUS.PENDING, artStates: [] });
    expect(axes.map((a) => a.key)).toEqual(["value", "art", "signature", "billing"]);
  });

  describe("valor", () => {
    it("pendente: a bola é da Ankaa, enviar ao cliente", () => {
      const value = axis({ status: TASK_QUOTE_STATUS.PENDING, artStates: [] }, "value");
      expect(value.tone).toBe("todo");
      expect(value.next).toEqual({ label: "Enviar ao cliente", target: "value" });
    });
    it("com o cliente: espera, sem botão", () => {
      const value = axis({ status: TASK_QUOTE_STATUS.IN_NEGOTIATION, artStates: [] }, "value");
      expect(value.tone).toBe("waiting");
      expect(value.next).toBeUndefined();
    });
    it("aprovado: resolvido", () => {
      expect(axis({ status: TASK_QUOTE_STATUS.APPROVED, artStates: [] }, "value").tone).toBe("done");
    });
  });

  describe("arte", () => {
    it("conta k de N", () => {
      expect(countApprovedArt(["APPROVED", "DRAFT", "APPROVED"])).toEqual({ approved: 2, total: 3 });
      expect(axis({ artStates: ["APPROVED", "DRAFT", "APPROVED"] }, "art").state).toBe("2 de 3 aprovadas");
    });
    it("todas aprovadas: resolvido", () => {
      expect(axis({ artStates: ["APPROVED", "APPROVED"] }, "art").tone).toBe("done");
    });
    it("a ordem do trabalho: existir, ir ao cliente, refazer", () => {
      expect(axis({ artStates: ["NONE", "DRAFT", "REPROVED"] }, "art").next?.label).toBe("Subir arte");
      expect(axis({ artStates: ["APPROVED", "DRAFT", "REPROVED"] }, "art").next?.label).toBe("Enviar arte ao cliente");
      expect(axis({ artStates: ["APPROVED", "REPROVED"] }, "art").next?.label).toBe("Subir versão nova");
    });
    it("só falta o cliente decidir: espera", () => {
      const art = axis({ artStates: ["APPROVED", "PENDING_APPROVAL"] }, "art");
      expect(art.tone).toBe("waiting");
      expect(art.next).toBeUndefined();
    });
    it("sem veículos: não se aplica", () => {
      expect(axis({ artStates: [] }, "art").tone).toBe("off");
    });
  });

  describe("assinatura", () => {
    it("não emitida e valor não aprovado: bloqueada pelo valor", () => {
      const signature = axis({ status: TASK_QUOTE_STATUS.PENDING, artStates: [] }, "signature");
      expect(signature.tone).toBe("blocked");
    });
    it("valor aprovado e portão aberto: emitir", () => {
      const signature = axis(
        {
          status: TASK_QUOTE_STATUS.APPROVED,
          signatureStatus: BUDGET_SIGNATURE_STATUS.NOT_ISSUED,
          emission: { ready: true, blockers: [] },
          artStates: ["APPROVED"],
        },
        "signature",
      );
      expect(signature.next).toEqual({ label: "Emitir para assinatura", target: "signature" });
    });
    it("valor aprovado mas portão fechado: bloqueada pelas pendências", () => {
      const signature = axis(
        {
          status: TASK_QUOTE_STATUS.APPROVED,
          signatureStatus: BUDGET_SIGNATURE_STATUS.NOT_ISSUED,
          emission: { ready: false, blockers: [{ code: "ARTWORK_PENDING", message: "x" }] },
          artStates: ["DRAFT"],
        },
        "signature",
      );
      expect(signature.tone).toBe("blocked");
    });
    it("recusada: emitir de novo", () => {
      const signature = axis(
        { status: TASK_QUOTE_STATUS.APPROVED, signatureStatus: BUDGET_SIGNATURE_STATUS.REFUSED, artStates: [] },
        "signature",
      );
      expect(signature.next?.label).toBe("Emitir de novo");
    });
    it("falta a Ankaa: assinar", () => {
      const signature = axis(
        { status: TASK_QUOTE_STATUS.APPROVED, signatureStatus: BUDGET_SIGNATURE_STATUS.AWAITING_ANKAA, artStates: [] },
        "signature",
      );
      expect(signature.next?.label).toBe("Assinar pela Ankaa");
    });
    it.each([BUDGET_SIGNATURE_STATUS.SIGNED, BUDGET_SIGNATURE_STATUS.SIGNED_OFFLINE, BUDGET_SIGNATURE_STATUS.WAIVED])(
      "%s resolve o eixo",
      (signatureStatus) => {
        expect(axis({ status: TASK_QUOTE_STATUS.APPROVED, signatureStatus, artStates: [] }, "signature").tone).toBe(
          "done",
        );
      },
    );
  });

  describe("cobrança", () => {
    it("segue o `billable` da API quando ele vem", () => {
      expect(axis({ status: TASK_QUOTE_STATUS.APPROVED, billable: true, artStates: [] }, "billing").state).toBe(
        "Liberada",
      );
      expect(axis({ status: TASK_QUOTE_STATUS.APPROVED, billable: false, artStates: [] }, "billing").tone).toBe(
        "blocked",
      );
    });
    it("sem `billable`: valor aprovado E assinatura resolvida", () => {
      expect(
        axis(
          { status: TASK_QUOTE_STATUS.APPROVED, signatureStatus: BUDGET_SIGNATURE_STATUS.SIGNED_OFFLINE, artStates: [] },
          "billing",
        ).state,
      ).toBe("Liberada");
      const blocked = axis(
        { status: TASK_QUOTE_STATUS.APPROVED, signatureStatus: BUDGET_SIGNATURE_STATUS.AWAITING_CUSTOMER, artStates: [] },
        "billing",
      );
      expect(blocked.tone).toBe("blocked");
      expect(blocked.hint).toMatch(/assinatura/);
    });
    it("o motivo diz o valor quando é ele que falta", () => {
      expect(axis({ status: TASK_QUOTE_STATUS.PENDING, artStates: [] }, "billing").hint).toMatch(/valor/);
    });
  });
});

describe("emissionBlockerItems", () => {
  it("portão aberto: nada a listar", () => {
    expect(emissionBlockerItems({ ready: true, blockers: [] })).toEqual([]);
    expect(emissionBlockerItems(undefined)).toEqual([]);
  });
  it("cada impedimento ganha a ação que o resolve", () => {
    const items = emissionBlockerItems({
      ready: false,
      blockers: [
        { code: "VALUE_NOT_APPROVED", message: "Aprove o valor" },
        { code: "VALIDITY_EXPIRED", message: "Venceu" },
      ],
    });
    expect(items.map((i) => i.action?.target)).toEqual(["value", "validity"]);
  });
  it("código desconhecido: a frase da API, sem botão", () => {
    const items = emissionBlockerItems({ ready: false, blockers: [{ code: "NEW_GATE" as any, message: "Algo" }] });
    expect(items[0]).toEqual({ code: "NEW_GATE", message: "Algo", action: undefined });
  });
});
