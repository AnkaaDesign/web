import { describe, it, expect } from "vitest";
import {
  budgetPdfFilename,
  dossierArchiveFilename,
  dossierPdfFilename,
  padBudgetNumber,
  sanitizeFilename,
} from "./document-filename";

/**
 * Este helper é METADE de um par: o outro é
 * `api/src/modules/common/signature/document/document-filename.ts`, que escreve
 * o mesmo nome no `Content-Disposition`. O que estes testes travam é o formato
 * acordado — se ele mudar aqui sem mudar lá, o mesmo PDF passa a chegar com dois
 * nomes dependendo de por onde foi baixado.
 */
describe("nome dos PDFs de orçamento e dossiê", () => {
  const cliente = { corporateName: "MADEIREIRA SÃO JOÃO LTDA", fantasyName: "Madeireira SJ" };

  it("orçamento: razão social + rótulo + número com 4 dígitos", () => {
    expect(budgetPdfFilename(cliente, 417)).toBe("MADEIREIRA SÃO JOÃO LTDA - Orçamento 0417.pdf");
  });

  it("dossiê: MESMO número do orçamento, rótulo Dossiê", () => {
    // Não existe sequência separada para o dossiê — o rótulo nomeia o documento,
    // o número continua sendo o do orçamento.
    expect(dossierPdfFilename(cliente, 417)).toBe("MADEIREIRA SÃO JOÃO LTDA - Dossiê 0417.pdf");
  });

  it("o .zip do dossiê é o mesmo nome do PDF, só com outra extensão", () => {
    // Os dois saem do mesmo botão da página pública e têm de ficar lado a lado.
    expect(dossierArchiveFilename(cliente, 417)).toBe("MADEIREIRA SÃO JOÃO LTDA - Dossiê 0417.zip");
  });

  it("recua para o nome fantasia e depois para 'Cliente'", () => {
    expect(budgetPdfFilename({ corporateName: null, fantasyName: "Madeireira SJ" }, 1)).toBe(
      "Madeireira SJ - Orçamento 0001.pdf",
    );
    expect(budgetPdfFilename(null, 1)).toBe("Cliente - Orçamento 0001.pdf");
  });

  it("não trunca número com mais de 4 dígitos", () => {
    expect(padBudgetNumber(12345)).toBe("12345");
  });

  it("aceita o número já formatado que as páginas públicas carregam", () => {
    // As páginas guardam `budgetNumber` como "0417" para exibição; passar essa
    // string não pode gerar "00417".
    expect(padBudgetNumber("0417")).toBe("0417");
  });

  it("substitui o que sistema de arquivos recusa, preservando acento", () => {
    expect(sanitizeFilename('TRANSPORTES A/B: "X" <Y>')).toBe("TRANSPORTES A B X Y");
    expect(sanitizeFilename("AÇOS ANDRÉ")).toBe("AÇOS ANDRÉ");
  });

  it("nunca devolve nome vazio", () => {
    expect(sanitizeFilename("///")).toBe("Documento");
  });
});
