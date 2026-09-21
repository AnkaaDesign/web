// web/src/components/cliente/orcamento/orcamento-cobranca-card.tsx
//
// O PAGAMENTO — seção `PAYMENT`, lida do PRÓPRIO orçamento.
//
// ⛔ ELE DESCEU NA TELA, por decisão do dono: *"parte de pagamento deveria vir
// depois de assinaturas"*. E é a ordem do processo — só se cobra o que já foi
// assinado. Quem ordena é a página (`pages/cliente/orcamentos/[id].tsx`); este
// arquivo só desenha.
//
// ⛔ E AS PARCELAS VIRARAM TABELA. Eram `<ul class="divide-y">` com quatro
// `<span>` por linha: número, vencimento, badge e valor, sem cabeçalho nenhum
// dizendo o que cada um era. `components/cliente/portal-table.tsx` existe
// exatamente para a tabela que mora DENTRO de um cartão, é seguro fora do
// `AuthProvider` e já resolve cabeçalho, alinhamento de moeda, vazio e rolagem
// horizontal no celular.
//
// ⚠️ ESTE CARD NÃO CHAMA `GET /cliente/me/cobrancas`, e a razão é que a
// resposta do orçamento já traz a seção inteira. `budgetSelect` monta
// `payment: { billingSplit, payers[].installments[].bankSlip, nfse[] }` sempre
// que o recorte inclui `PAYMENT` — e monta JÁ ESCOPADO por pagador
// (`payerScopeSelect`), que é a metade que uma consulta lateral não teria como
// reproduzir sem repetir a régua de escopo no navegador.
//
// ⚠️ DOIS CICLOS DE ESTADO, E ELES NÃO SE CONFUNDEM. O que está aqui é o PLANO
// de pagamento do orçamento: parcelas com `INSTALLMENT_STATUS`. O ciclo da
// COBRANÇA (`BILLING_STATUS`, com "Vencido" e "Liquidado") vive na tela de
// Cobranças, que é a fatura VIVA — e é para lá que o cabeçalho aponta. Desenhar
// `QuoteStatusBadge` numa cobrança foi exatamente o defeito que fez a lista de
// Faturamento mostrar o ciclo errado.
import { Link } from "react-router-dom";
import { IconArrowRight, IconFileInvoice } from "@tabler/icons-react";

import type {
  PortalBudget,
  PortalBudgetInstallment,
  PortalNfseRef,
} from "@/api-client/portal";
import { routes } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { INSTALLMENT_STATUS_LABELS, getBadgeVariant } from "@/constants";
import type { INSTALLMENT_STATUS } from "@/constants";
import { formatCurrency, formatDate } from "@/utils";
import { PortalDash, PortalCard, PortalSubheading } from "../portal-detail";
import { PortalTable, type PortalTableColumn } from "../portal-table";

const parcelaColumns: Array<PortalTableColumn<PortalBudgetInstallment>> = [
  {
    id: "numero",
    header: "Parcela",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (installment) => (installment.number ? `${installment.number}ª` : "—"),
  },
  {
    id: "vencimento",
    header: "Vencimento",
    className: "whitespace-nowrap tabular-nums",
    cell: (installment) =>
      installment.dueDate ? formatDate(installment.dueDate) : <PortalDash />,
  },
  {
    id: "situacao",
    header: "Situação",
    cell: (installment) => (
      // O mapa de cor é o de PARCELA DE PEDIDO — a mesma pergunta ("esta
      // parcela está paga, pendente, vencida ou cancelada?") com o mesmo
      // significado de cor. Declarar mais um mapa de cor de parcela nesta base
      // seria a forma conhecida de fazer dois lugares divergirem.
      <Badge variant={getBadgeVariant(installment.status ?? "", "ORDER_INSTALLMENT")} size="sm">
        {INSTALLMENT_STATUS_LABELS[installment.status as INSTALLMENT_STATUS] ??
          installment.status ??
          "—"}
      </Badge>
    ),
  },
  {
    id: "valor",
    header: "Valor",
    align: "right",
    className: "whitespace-nowrap font-medium tabular-nums",
    cell: (installment) =>
      typeof installment.amount === "number" ? (
        formatCurrency(installment.amount)
      ) : (
        <PortalDash />
      ),
  },
];

const nfseColumns: Array<PortalTableColumn<PortalNfseRef>> = [
  {
    id: "numero",
    header: "Nota",
    className: "whitespace-nowrap tabular-nums",
    cell: (nota) => (nota.nfseNumber ? `NFS-e ${nota.nfseNumber}` : "NFS-e"),
  },
  {
    id: "emitida",
    header: "Emitida em",
    align: "right",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (nota) => (nota.createdAt ? formatDate(nota.createdAt) : <PortalDash />),
  },
];

export function OrcamentoCobrancaCard({ budget }: { budget: PortalBudget }) {
  const payment = budget.payment;
  // `undefined` = a seção `PAYMENT` não está no recorte. O card não existe — e,
  // ao contrário do desenho antigo, NENHUMA pergunta é feita à rede por ele.
  if (!payment) return null;

  const payers = payment.payers ?? [];
  const nfse = payment.nfse ?? [];
  const comParcelas = payers.filter((payer) => (payer.installments ?? []).length > 0);
  const vazio = comParcelas.length === 0 && nfse.length === 0;
  // Um pagador só é o caso normal, e repetir o nome dele acima da única tabela
  // é ruído: o card inteiro já é o pagamento DESTE orçamento.
  const nomearPagador = comParcelas.length > 1;

  return (
    <PortalCard
      icon={IconFileInvoice}
      title="Pagamento"
      description="O plano de pagamento deste orçamento: parcelas, boletos e notas fiscais."
      actions={
        <Link
          to={routes.customer.portal.cobrancas}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver cobranças
          <IconArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    >
      {vazio ? (
        // ⚠️ VAZIO COM INTENÇÃO: "ainda não há o que pagar" é resposta, não
        // carcaça — é a pergunta que traz o financeiro do cliente ao portal.
        <EmptyState
          className="py-8"
          icon={<IconFileInvoice className="h-8 w-8" />}
          title="Nada a cobrar ainda"
          description="A cobrança nasce depois que o orçamento é aprovado. Quando as parcelas forem lançadas, elas aparecem aqui."
        />
      ) : (
        <div className="space-y-4">
          {comParcelas.map((payer) => (
            <div key={payer.id} className="space-y-1.5">
              {nomearPagador ? (
                <PortalSubheading>{payer.customerName ?? "Pagador"}</PortalSubheading>
              ) : null}
              <PortalTable
                columns={parcelaColumns}
                rows={payer.installments ?? []}
                getRowId={(installment) => installment.id}
              />
            </div>
          ))}

          {/* A NFS-e é do ORÇAMENTO, não da parcela: numa tabela de parcelas ela
              não tem linha onde morar. */}
          {nfse.length > 0 ? (
            <div className="space-y-1.5">
              <PortalSubheading>Notas fiscais</PortalSubheading>
              <PortalTable columns={nfseColumns} rows={nfse} getRowId={(nota) => nota.id} />
            </div>
          ) : null}
        </div>
      )}
    </PortalCard>
  );
}
