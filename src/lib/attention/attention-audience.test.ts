// Quem PODE ser incomodado — a trava de audiência do registro de regras.
//
// O caso que originou este arquivo: `airbrushing.waiting-production` mirava PRODUCTION e
// sobreviveu ao commit que tirou a Aerografia do chão de fábrica no app (29/07/2026). A regra
// seguiu vibrando o aparelho de quem não abre a página nem pode mudar o status, e nada quebrou
// — nenhum teste falava de audiência. Agora fala, e nos três repositórios a lista é a mesma:
// mudar `targetSectors` aqui sem mudar `RULE_QUERIES` na API quebra o contrato de
// `evaluatedRuleIds` (acks limpos indevidamente → o alerta re-arma sozinho).

import { describe, it, expect } from "vitest";
import { SECTOR_PRIVILEGES } from "@/constants";
import { ATTENTION_RULES } from "./rules";
import { ATTENTION_ENTITIES } from "./entities";

describe("audiência das regras de atenção", () => {
  it("PRODUCTION não é alvo de regra nenhuma", () => {
    const offenders = ATTENTION_RULES.filter((r) => r.targetSectors.includes(SECTOR_PRIVILEGES.PRODUCTION)).map((r) => r.id);

    expect(offenders, `O setor PRODUCTION não deve receber atenção. Regras encontradas: ${offenders.join(", ")}`).toEqual([]);
  });

  it("só `ppe-delivery.awaiting-my-signature` tem audiência aberta", () => {
    // Audiência vazia significa TODO setor, então é também a porta dos fundos para PRODUCTION.
    // A única regra assim é pessoal: escopada pelo servidor ao próprio usuário (`userId`), numa
    // página que todo setor tem (/pessoal/meus-epis), nomeando algo que só ele pode fazer.
    const open = ATTENTION_RULES.filter((r) => r.enabled && r.targetSectors.length === 0).map((r) => r.id);

    expect(open).toEqual(["ppe-delivery.awaiting-my-signature"]);
  });

  it("toda regra mira um privilégio que existe", () => {
    const known = new Set<string>(Object.values(SECTOR_PRIVILEGES));
    const unknown = [...new Set(ATTENTION_RULES.flatMap((r) => r.targetSectors).filter((s) => !known.has(s)))];

    expect(unknown, `Privilégios inexistentes: ${unknown.join(", ")}`).toEqual([]);
  });

  it("todo tipo com regra tem casa na navegação, e vice-versa", () => {
    // As duas metades do contrato que a aerografia quebrou dos dois lados: regra sem descritor
    // não tem para onde levar, descritor sem regra promete um alerta que nunca chega.
    const ruled = new Set(ATTENTION_RULES.filter((r) => r.enabled).map((r) => r.entityType));
    const described = new Set(ATTENTION_ENTITIES.map((d) => d.entityType));

    expect([...ruled].filter((t) => !described.has(t)), "regra sem descritor").toEqual([]);
    expect([...described].filter((t) => !ruled.has(t)), "descritor sem regra").toEqual([]);
    expect(described.has("AIRBRUSHING")).toBe(false);
  });
});
