// `BRAND_COLORS` e não um token de tema: as páginas públicas rodam em
// `force-light`, e um token aqui renderiza branco sobre branco.
import { Fragment } from "react";
import { BRAND_COLORS } from "@/config/company";
import { formatCNPJ, formatCPF } from "@/utils/formatters";
import {
  formatBillingLocalityLine,
  formatBillingStreetLine,
} from "@/utils/quote-text-generators";

/**
 * O QUADRO DO TOMADOR — o cadastro que a prefeitura vai exigir na NFS-e.
 *
 * ESPELHA `.billing-table` do PDF assinado
 * (`api/src/modules/common/signature/document/quote-html.builder.ts`).
 *
 * POR QUE O CADASTRO ENTRA NUM DOCUMENTO DE APROVAÇÃO
 *   A NFS-e é emitida na Elotech com a razão social, o CNPJ, as inscrições e o
 *   endereço EXATOS do cadastro, e um dado errado só se descobre depois da nota
 *   autorizada — quando consertar significa cancelar e substituir, com o fiscal
 *   da prefeitura no meio (ver `supersedePreviousNfses` na API). O cliente é
 *   quem sabe o próprio cadastro. Pôr o quadro aqui faz a conferência acontecer
 *   na aprovação, que é o único momento em que ela é barata.
 *
 *   Foi por isso que a seção "Condições de pagamento" passou a se chamar
 *   "Faturamento": ela abre com este quadro, e a frase das parcelas — que é o
 *   acordo de pagamento e não podia sair do documento — vem logo abaixo.
 *
 * Campo vazio sai como travessão em vez de sumir: a linha ausente esconderia
 * exatamente o buraco que o quadro existe para expor.
 *
 * ⚠️ CORES EXPLÍCITAS, não tokens de tema: as páginas públicas rodam em
 * `force-light`, e um token de tema aqui renderiza branco sobre branco.
 */

interface QuoteBillingBoxProps {
  /** O cliente de FATURAMENTO — o da configuração, não o da tarefa. */
  customer:
    | {
        corporateName?: string | null;
        fantasyName?: string | null;
        cnpj?: string | null;
        cpf?: string | null;
        stateRegistration?: string | null;
        municipalRegistration?: string | null;
        streetType?: string | null;
        address?: string | null;
        addressNumber?: string | null;
        addressComplement?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        zipCode?: string | null;
      }
    | null
    | undefined;
  className?: string;
}

/** As duas metades do endereço numa linha, sem travessão solto quando falta uma. */
function joinAddress(street: string | null, locality: string | null): string | null {
  const parts = [street, locality].map(p => (p ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

export function QuoteBillingBox({ customer, className }: QuoteBillingBoxProps) {
  if (!customer) return null;

  const document = customer.cnpj
    ? formatCNPJ(customer.cnpj)
    : customer.cpf
      ? formatCPF(customer.cpf)
      : null;

  // CADA LINHA PODE TER DOIS PARES. Razão social, endereço e município são
  // longos e ocupam a largura; as duas inscrições são curtas e ficavam com dois
  // terços da folha em branco à direita de cada uma — duas linhas onde cabia uma.
  //
  // O NÚMERO DO PEDIDO saiu daqui: virou COLUNA da tabela de veículos, porque ele
  // identifica a ENTREGA e um orçamento de quatro implementos pode ter quatro
  // pedidos diferentes, que numa linha só não cabem.
  const rows: Array<Array<[string, string | null]>> = [
    [["Razão social", customer.corporateName || customer.fantasyName || null]],
    [["CNPJ / CPF", document]],
    [
      ["Inscrição estadual", customer.stateRegistration || null],
      ["Inscrição municipal", customer.municipalRegistration || null],
    ],
    // ENDEREÇO NUMA LINHA SÓ. Eram duas — logradouro e depois "Município" com
    // bairro, cidade/UF e CEP —, e nenhuma das duas enchia a largura: o quadro
    // gastava dois renques para dizer um endereço. Juntas, cabem de sobra e o
    // olho lê o endereço como o endereço é lido, de uma vez.
    [["Endereço", joinAddress(formatBillingStreetLine(customer), formatBillingLocalityLine(customer))]],
  ];

  return (
    <div className={`overflow-x-auto mb-3 ${className ?? ""}`}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((pairs) => (
            <tr key={pairs.map(([label]) => label).join("|")}>
              {pairs.map(([label, value], i) => (
                <Fragment key={label}>
                  <th
                    className="text-left font-semibold align-baseline whitespace-nowrap"
                    style={{
                      color: BRAND_COLORS.textGray,
                      width: "9.5rem",
                      // O SEGUNDO par ganha respiro à esquerda: sem ele o valor
                      // da inscrição estadual encosta no rótulo da municipal e
                      // os dois leem como um texto só.
                      padding: `0.2rem 0.75rem 0.2rem ${i > 0 ? "1.5rem" : "0"}`,
                    }}
                  >
                    {label}
                  </th>
                  <td
                    className="align-baseline"
                    style={{ color: BRAND_COLORS.textDark, padding: "0.2rem 0" }}
                    colSpan={pairs.length === 1 ? 3 : 1}
                  >
                    {value ?? <span style={{ color: BRAND_COLORS.textGray }}>—</span>}
                  </td>
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
