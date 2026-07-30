import { describe, it, expect } from "vitest";
import { formatDate } from "./date";

/**
 * A CALENDAR DATE must not drift a day when it is rendered.
 *
 * `new Date("2026-07-30")` is read as UTC midnight, which is 2026-07-29 21:00 in São
 * Paulo — so a bare date formatted in local time comes out one day EARLIER. That is how
 * NFS-e nº 3185, emitted on 30/07/2026, displayed as "Emissão 29/07/2026" on the
 * faturamento page. Elotech returns `dataEmissao` as a bare "yyyy-MM-dd", and so do
 * plenty of other payloads, so this is not specific to one screen.
 *
 * A date-only string carries no time and no zone: it means that calendar day everywhere.
 * A string that DOES carry a time is a genuine instant and keeps the normal parse.
 */
describe("formatDate", () => {
  it("não perde um dia em data pura (o bug da NFS-e 3185)", () => {
    expect(formatDate("2026-07-30")).toBe("30/07/2026");
  });

  it("mantém o dia em qualquer data pura", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
    // Virada de mês e ano são onde o deslocamento aparece de forma mais visível.
    expect(formatDate("2027-01-01")).toBe("01/01/2027");
  });

  it("preserva o comportamento de instantes (string com hora)", () => {
    // Com hora e sem offset, o valor é lido como horário local — continua sendo o dia 30.
    expect(formatDate("2026-07-30T09:35:11")).toBe("30/07/2026");
  });

  it("respeita o offset quando ele existe", () => {
    expect(formatDate("2026-07-30T12:00:00-03:00")).toBe("30/07/2026");
  });

  it("aceita Date e trata vazio/inválido", () => {
    expect(formatDate(new Date(2026, 6, 30))).toBe("30/07/2026");
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
    expect(formatDate("não é data")).toBe("Data inválida");
  });
});
