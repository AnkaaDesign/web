/**
 * Validador de Documentos (Ferramentas) — os fluxos que a página promete.
 *
 *  - `?codigo=` na URL consulta sozinho e mostra o veredito;
 *  - 404 é o único caso que culpa a digitação;
 *  - o PDF em mãos é conferido pelo SHA-256 contra os hashes da cerimônia;
 *  - enviar o campo vazio avisa E limpa a URL (o aviso não pode sumir);
 *  - só a última consulta escreve o resultado.
 */
import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

const verify = vi.fn();
vi.mock("@/api-client/signature", () => ({ signatureService: { verify: (c: string) => verify(c) } }));
vi.mock("@/components/ui/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/hooks/common/use-page-tracker", () => ({ usePageTracker: () => {} }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DocumentValidatorPage } from "./document-validator";

const SIGNED_BYTES = "%PDF-assinado";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const payload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    data: {
      verificationCode: "ABCD-EFGH-IJKL",
      status: "COMPLETED",
      budgetNumber: 973,
      issuer: { name: "Ankaa Design", cnpj: "00.000.000/0001-00" },
      customer: { name: "Cliente X", cnpj: null },
      originalSha256: sha("%PDF-original"),
      finalSha256: sha(SIGNED_BYTES),
      sealedAt: "2026-09-01T12:00:00.000Z",
      padesLevel: "B-LT",
      certSerialNumber: null,
      auditChain: { valid: true, events: 7, reason: null },
      addendum: null,
      documents: [],
      signers: [
        { name: "Fulano", cargo: "Compras", cpfMasked: "***.123.456-**", status: "SIGNED", signedAt: "2026-09-01T11:00:00.000Z", authMethod: "Código de uso único via e-mail" },
      ],
      ...overrides,
    },
  },
});

// jsdom não implementa `Blob.arrayBuffer` (todo navegador atual implementa).
if (!(Blob.prototype as any).arrayBuffer) {
  (Blob.prototype as any).arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

let lastSearch = "";
let navigateTo: (to: string) => void = () => {};
function LocationProbe() {
  lastSearch = useLocation().search;
  navigateTo = useNavigate();
  return null;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/ferramentas/validador-de-documentos"
          element={
            <>
              <DocumentValidatorPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function pickFile(content: string, name = "orcamento.pdf") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([content], name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  verify.mockReset();
  lastSearch = "";
});

describe("DocumentValidatorPage", () => {
  it("consulta o código vindo da URL e mostra o veredito", async () => {
    verify.mockResolvedValue(payload());
    renderAt("/ferramentas/validador-de-documentos?codigo=ABCD-EFGH-IJKL");
    expect(await screen.findByText("Assinado e selado")).toBeTruthy();
    expect(verify).toHaveBeenCalledWith("ABCD-EFGH-IJKL");
    expect(screen.getByText("Orçamento nº 973")).toBeTruthy();
    expect(screen.getByText("Trilha de auditoria")).toBeTruthy();
    expect(screen.getByText("Íntegra")).toBeTruthy();
    // Estado vazio some quando há resultado.
    expect(screen.queryByText("Nenhum documento consultado")).toBeNull();
    expect(screen.getByText("Fulano")).toBeTruthy();
  });

  it("sem código: um bloco só, com os 3 passos, e nenhuma consulta", () => {
    renderAt("/ferramentas/validador-de-documentos");
    expect(screen.getByText("Nenhum documento consultado")).toBeTruthy();
    for (const step of ["Informe o código", "Veja o veredito", "Confira o PDF"]) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    // A conferência de arquivo só existe com resultado.
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("404 culpa a digitação; nada de resultado", async () => {
    verify.mockRejectedValue({ response: { status: 404 } });
    renderAt("/ferramentas/validador-de-documentos?codigo=ERRADO");
    expect(await screen.findByText(/Código não encontrado/)).toBeTruthy();
    expect(screen.queryByText("Assinado e selado")).toBeNull();
  });

  it("confere o PDF em mãos pelo SHA-256", async () => {
    verify.mockResolvedValue(payload());
    renderAt("/ferramentas/validador-de-documentos?codigo=ABCD-EFGH-IJKL");
    await screen.findByText("Assinado e selado");

    pickFile(SIGNED_BYTES);
    expect(await screen.findByText("Arquivo confere: Documento assinado")).toBeTruthy();

    pickFile("%PDF-adulterado");
    expect(await screen.findByText("Arquivo NÃO confere com este código")).toBeTruthy();
  });

  it("campo vazio: avisa e limpa ?codigo= — o aviso sobrevive à limpeza", async () => {
    verify.mockResolvedValue(payload());
    renderAt("/ferramentas/validador-de-documentos?codigo=ABCD-EFGH-IJKL");
    await screen.findByText("Assinado e selado");

    const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Verificar/ }));

    await waitFor(() => expect(lastSearch).toBe(""));
    expect(screen.getByText("Informe o código impresso no rodapé do documento.")).toBeTruthy();
    expect(screen.queryByText("Assinado e selado")).toBeNull();
  });

  // O botão fica desabilitado durante a consulta; a troca de código com outra
  // em voo chega pela URL (voltar/avançar do navegador, link colado).
  it("só a última consulta escreve o resultado", async () => {
    let resolveSlow!: (v: unknown) => void;
    verify
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockResolvedValueOnce(payload({ budgetNumber: 2, verificationCode: "NOVO" }));
    renderAt("/ferramentas/validador-de-documentos?codigo=VELHO");

    act(() => navigateTo("/ferramentas/validador-de-documentos?codigo=NOVO"));
    expect(await screen.findByText("Orçamento nº 2")).toBeTruthy();

    resolveSlow(payload({ budgetNumber: 1, verificationCode: "VELHO" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText("Orçamento nº 1")).toBeNull();
    expect(screen.getByText("Orçamento nº 2")).toBeTruthy();
  });
});
