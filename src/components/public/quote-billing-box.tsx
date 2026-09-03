// `BRAND_COLORS` e não um token de tema: as páginas públicas rodam em
// `force-light`, e um token aqui renderiza branco sobre branco.
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
  /** Número do pedido do cliente. Só sai quando existe — ver abaixo. */
  orderNumber?: string | null;
  className?: string;
}

export function QuoteBillingBox({ customer, orderNumber, className }: QuoteBillingBoxProps) {
  if (!customer) return null;

  const document = customer.cnpj
    ? formatCNPJ(customer.cnpj)
    : customer.cpf
      ? formatCPF(customer.cpf)
      : null;

  const rows: Array<[string, string | null]> = [
    ["Razão social", customer.corporateName || customer.fantasyName || null],
    ["CNPJ / CPF", document],
    ["Inscrição estadual", customer.stateRegistration || null],
    ["Inscrição municipal", customer.municipalRegistration || null],
    ["Endereço", formatBillingStreetLine(customer)],
    ["Município", formatBillingLocalityLine(customer)],
    // Só sai quando existe: o número do pedido é exigência de alguns clientes e
    // não de todos, e uma linha "Nº do pedido —" num orçamento que não usa
    // pedido leria como pendência.
    ...(orderNumber ? ([["Nº do pedido", orderNumber]] as Array<[string, string | null]>) : []),
  ];

  return (
    <div className={`overflow-x-auto mb-3 ${className ?? ""}`}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th
                className="text-left font-semibold align-baseline whitespace-nowrap"
                style={{ color: BRAND_COLORS.textGray, width: "9.5rem", padding: "0.2rem 0.75rem 0.2rem 0" }}
              >
                {label}
              </th>
              <td className="align-baseline" style={{ color: BRAND_COLORS.textDark, padding: "0.2rem 0" }}>
                {value ?? <span style={{ color: BRAND_COLORS.textGray }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
