import { describe, expect, it } from "vitest";

import {
  aberturaDaLeitura,
  frenteParaPayload,
  portaParaPayload,
} from "./veiculo/frente-porta-fields";
import { resumoDaArte } from "./orcamento/orcamento-arte-card";
import type { PortalBudgetArtwork } from "@/api-client/portal";

describe("frente do implemento", () => {
  it("vira UM painel em centímetros, sem porta", () => {
    expect(frenteParaPayload({ heightCm: 260.4, widthCm: 248 })).toEqual({
      height: 260,
      sections: [{ width: 248, isDoor: false, doorHeight: null, position: 0 }],
    });
  });

  it("incompleta não viaja", () => {
    expect(frenteParaPayload({ heightCm: 260, widthCm: null })).toBeNull();
    expect(frenteParaPayload(null)).toBeNull();
  });
});

describe("porta traseira", () => {
  it("lê o enum do servidor na palavra da borda do portal", () => {
    expect(aberturaDaLeitura("BIPARTITE")).toBe("BIPARTIDA");
    expect(aberturaDaLeitura("TRIPARTITE")).toBe("TRIPARTIDA");
    expect(aberturaDaLeitura(null)).toBeNull();
  });

  it("nada escolhido não viaja; o escolhido viaja inteiro", () => {
    expect(portaParaPayload({ abertura: null, varoes: null, portinholas: null })).toBeNull();
    expect(portaParaPayload({ abertura: "BIPARTIDA" })).toEqual({
      abertura: "BIPARTIDA",
      varoes: null,
      portinholas: null,
    });
  });
});

describe("resumo da arte do orçamento", () => {
  const base: PortalBudgetArtwork = {
    total: 3,
    approved: 0,
    awaitingCustomer: 0,
    awaitingMe: 0,
    atAnkaa: 0,
    groups: [],
  };

  it("todas aprovadas", () => {
    expect(resumoDaArte({ ...base, approved: 3 })).toBe("Arte aprovada nos 3 veículos.");
    expect(resumoDaArte({ ...base, total: 1, approved: 1 })).toBe("A arte está aprovada.");
  });

  it("diz o que espera por mim e o que está na Ankaa", () => {
    expect(resumoDaArte({ ...base, approved: 1, awaitingCustomer: 1, awaitingMe: 1, atAnkaa: 1 })).toBe(
      "1 de 3 aprovadas · 1 espera a sua decisão · 1 em preparação na Ankaa",
    );
  });

  it("pendente com outro contato não é 'sua decisão'", () => {
    expect(resumoDaArte({ ...base, awaitingCustomer: 2, atAnkaa: 1 })).toBe(
      "2 com o cliente · 1 em preparação na Ankaa",
    );
  });
});
