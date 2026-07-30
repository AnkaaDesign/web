/**
 * Nome de arquivo dos PDFs de orçamento e de dossiê.
 *
 * ESPELHO de `api/src/modules/common/signature/document/document-filename.ts`.
 * Os dois existem porque o nome é decidido nos dois lados: o servidor manda no
 * `Content-Disposition` (que vale para quem abre a URL direto) e o navegador
 * manda no `a.download` (que vence quando o PDF é baixado como blob, o que é o
 * caso de toda rota autenticada aqui). Divergir faria o mesmo documento chegar
 * com dois nomes dependendo de por onde foi baixado — que é exatamente o que
 * havia antes.
 *
 * Formato: `RAZÃO SOCIAL - Orçamento 0417.pdf` e
 * `RAZÃO SOCIAL - Dossiê 0417.pdf`. O rótulo nomeia o DOCUMENTO — é o mesmo
 * texto que as duas páginas públicas já imprimem no topo ("Orçamento Nº 0417",
 * "Dossiê Nº 0417"), então o arquivo na pasta de Downloads é pesquisável pelo
 * que o cliente leu na tela.
 *
 * O NÚMERO é o mesmo nos dois: `budgetNumber`. Não existe sequência separada
 * para o dossiê, e inventar uma só para o nome do arquivo criaria um número
 * impossível de procurar no sistema.
 */

interface CustomerLike {
  corporateName?: string | null;
  fantasyName?: string | null;
}

/** Razão social, com recuo para nome fantasia e, por fim, um rótulo genérico. */
export function customerLabel(customer: CustomerLike | null | undefined): string {
  return customer?.corporateName?.trim() || customer?.fantasyName?.trim() || "Cliente";
}

/** `0417` — o mesmo texto que a página imprime ao lado de "Nº". */
export function padBudgetNumber(budgetNumber: number | string | null | undefined): string {
  if (budgetNumber === null || budgetNumber === undefined || budgetNumber === "") return "0000";
  return String(budgetNumber).padStart(4, "0");
}

/** `MADEIREIRA X LTDA - Orçamento 0417.pdf` */
export function budgetPdfFilename(
  customer: CustomerLike | null | undefined,
  budgetNumber: number | string | null | undefined,
): string {
  return `${sanitizeFilename(customerLabel(customer))} - Orçamento ${padBudgetNumber(budgetNumber)}.pdf`;
}

/** `MADEIREIRA X LTDA - Dossiê 0417.pdf` — mesmo número, outro documento. */
export function dossierPdfFilename(
  customer: CustomerLike | null | undefined,
  budgetNumber: number | string | null | undefined,
): string {
  return `${sanitizeFilename(customerLabel(customer))} - Dossiê ${padBudgetNumber(budgetNumber)}.pdf`;
}

/**
 * `MADEIREIRA X LTDA - Dossiê 0417.zip` — o pacote com os arquivos SOLTOS do
 * dossiê (fotos, boletos, NFS-e), montado no navegador.
 *
 * Sem par no servidor, ao contrário dos dois acima: este .zip só existe no
 * browser, e é por isso que ele ficou de fora quando os PDFs foram renomeados —
 * continuava caindo como `dossie-0742.zip`, sem dizer de quem era. Mesmo nome do
 * PDF do dossiê, só a extensão muda: os dois saem do mesmo botão, para o mesmo
 * cliente, e têm de ficar lado a lado na pasta de Downloads.
 */
export function dossierArchiveFilename(
  customer: CustomerLike | null | undefined,
  budgetNumber: number | string | null | undefined,
): string {
  return `${sanitizeFilename(customerLabel(customer))} - Dossiê ${padBudgetNumber(budgetNumber)}.zip`;
}

/**
 * Tira do nome o que sistema de arquivos não aceita.
 *
 * Acentos FICAM — o destino é a pasta de Downloads do cliente, e o `a.download`
 * aceita UTF-8. O que sai são os separadores de caminho, os reservados do
 * Windows e os controles.
 */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Windows recusa nome terminado em ponto ou espaço.
      .replace(/[. ]+$/, "") || "Documento"
  );
}
