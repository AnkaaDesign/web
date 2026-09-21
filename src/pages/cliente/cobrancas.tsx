// web/src/pages/cliente/cobrancas.tsx
//
// COBRANÇAS — parcelas, boletos e NFS-e DESTE cliente.
//
// ⛔ O RECORTE É DO SERVIDOR, E O QUE NÃO VEM NÃO SE INVENTA.
//
// `GET /cliente/me/cobrancas` exige a seção `PAYMENT` e projeta os campos. O que
// NUNCA vem, e não deve ser desenhado "quando vier": `nossoNumero`, `txid`,
// `sicrediStatus`, `errorMessage`, `errorCount`, `liquidationData`, `lastSyncAt`,
// `pdfFileId`, observação interna, dado de conciliação. Nada disso é do cliente:
// são rastros do nosso lado do processo, e uma tela que os desenhasse convidaria
// a projeção do servidor a afrouxar para alimentá-la.
//
// ── A LINHA É UMA `Invoice`, NÃO UMA `Billing` ──────────────────────────────
//
// Esta tela foi escrita contra um tipo `PortalBilling` que a API nunca mandou —
// `{ budgetId, total, installments[].value, invoices[] }`. O que o servidor
// entrega é a FATURA VIVA (`LIVE_INVOICE_WHERE`), com `totalAmount`/`paidAmount`,
// as parcelas em `amount` + `paidAmount`, o boleto como OBJETO e as notas em
// `nfse`. A `Billing` aparece ANINHADA, porque o estado dela é outro ciclo.
//
// Duas consequências visíveis:
//
//   · NÃO HÁ ARQUIVO DE BOLETO PARA ABRIR. A tela antiga desenhava um botão
//     "Abrir" a partir de um `bankSlipFileId` que nunca existiu — e que, se
//     existisse, seria o PDF interno. O que o cliente recebe é a LINHA
//     DIGITÁVEL e o copia-e-cola do PIX, que é o que ele de fato usa para pagar.
//   · O PAGO DE CADA PARCELA É UM CAMPO, não uma derivação. `paidAmount` vem na
//     resposta; a versão antiga derivava "pago = valor da parcela se `paidAt`",
//     o que apagava todo pagamento PARCIAL e o registrava como lacuna do
//     contrato. Não era lacuna: era o campo que o tipo não declarava.
//
// ── Dois ciclos de estado, e eles não se confundem ──────────────────────────
//
// A COBRANÇA tem `BILLING_STATUS` (`BillingStatusBadge`); a PARCELA tem
// `INSTALLMENT_STATUS`. Os dois têm `PENDING` e `CANCELLED` querendo dizer
// coisas diferentes, e "Vencido" só existe de um lado de cada vez. Nenhum rótulo
// nem nenhuma cor é declarado aqui: vêm de `BILLING_STATUS_LABELS`,
// `INSTALLMENT_STATUS_LABELS` e dos mapas de `constants/badge-colors`.
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconCheck, IconCopy, IconFileInvoice, IconReceipt2 } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BillingStatusBadge } from "@/components/financial/billing/billing-status-badge";
import {
  PortalCardSkeleton,
  PortalErrorBanner,
} from "@/components/cliente/portal-detail";
import { routes } from "@/constants/routes";
import { PortalSectionCard } from "@/components/cliente/portal-section-card";
import { PortalTable, type PortalTableColumn } from "@/components/cliente/portal-table";
import {
  portalErrorMessage,
  usePortalCharges,
  type PortalCharge,
  type PortalChargeInstallment,
  type PortalChargeNfse,
} from "@/api-client/portal";
import { INSTALLMENT_STATUS_LABELS, getBadgeVariant } from "@/constants";
import type { INSTALLMENT_STATUS } from "@/constants";
import type { BILLING_STATUS } from "@/types/budget";
import { formatCurrency, formatDate } from "@/utils";
import { usePricingVisible } from "@/hooks/common/use-pricing-visible";
import { cn } from "@/lib/utils";

const Dash = () => <span className="text-muted-foreground">—</span>;

/**
 * ⛔ ESTA TELA PAGINA, E ANTES ELA TRUNCAVA EM SILÊNCIO.
 *
 * `usePortalCharges()` era chamado SEM parâmetro nenhum. O servidor aplica
 * `take = 20` por omissão (`PortalReadService.paginate`), então um cliente com
 * 30 faturas via 20 cartões, nenhum rodapé e nenhum total — e não havia como
 * ele saber. Numa tela sobre dinheiro devido, "só existem 20" e "mostramos 20"
 * são afirmações muito diferentes, e a tela fazia a primeira.
 *
 * ⚠️ O rodapé é próprio, e não o do `DataTable`. A linha aqui é uma FATURA com
 * duas tabelas aninhadas (parcelas e NFS-e) e dois ciclos de estado distintos —
 * achatá-los numa linha plana só para herdar o rodapé do `DataTablePage` é
 * exatamente o que `portal-table.tsx` explica que não se faz. O `?page=` mora na
 * URL pelo mesmo motivo das outras listas: é dela que a consulta sai, e é ela
 * que sobrevive a um F5 e a um link compartilhado.
 */
const PAGE_SIZE_PADRAO = 10;
const OPCOES_POR_PAGINA = [10, 20, 40, 60, 100];

/**
 * O COPIA-E-COLA DO PAGAMENTO.
 *
 * ⚠️ É a única forma de pagar que esta tela oferece, e é deliberada: o PDF do
 * boleto é arquivo interno e não vem na projeção. A linha digitável e o PIX vêm
 * — são o instrumento, e quem lê a rota é o pagador autenticado daquela fatura.
 *
 * O aviso de "copiado" é INLINE e some sozinho. Um toast aqui seria a exceção à
 * regra do §10 (o interceptor é o dono dos toasts) por um acerto de campo, e
 * um toast por linha numa fatura de doze parcelas é ruído.
 */
function CopiarCodigo({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem clipboard (http, permissão negada): o código continua selecionável
      // no `title` do botão, que é o caminho manual.
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-sm"
      onClick={() => void copiar()}
      title={value}
    >
      {copiado ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
      {copiado ? "Copiado" : label}
    </Button>
  );
}

const installmentColumns: Array<PortalTableColumn<PortalChargeInstallment>> = [
  {
    // ⚠️ id de coluna SEM PONTO (§10).
    id: "numero",
    header: "Parcela",
    cell: (installment) => <span className="tabular-nums">{installment.number ?? "—"}</span>,
  },
  {
    id: "vencimento",
    header: "Vencimento",
    cell: (installment) =>
      installment.dueDate ? (
        <span className="whitespace-nowrap tabular-nums">{formatDate(installment.dueDate)}</span>
      ) : (
        <Dash />
      ),
  },
  {
    id: "valor",
    header: "Valor",
    align: "right",
    cell: (installment) =>
      typeof installment.amount === "number" ? (
        <span className="whitespace-nowrap tabular-nums">{formatCurrency(installment.amount)}</span>
      ) : (
        <Dash />
      ),
  },
  {
    id: "pago",
    header: "Pago",
    align: "right",
    cell: (installment) => {
      // ⚠️ `paidAmount` é CAMPO, não derivação — pagamento parcial é
      // representável e chega aqui como o número que ele é.
      if (typeof installment.paidAmount !== "number" || installment.paidAmount === 0) {
        return <Dash />;
      }
      return (
        <span className="whitespace-nowrap tabular-nums">
          {formatCurrency(installment.paidAmount)}
        </span>
      );
    },
  },
  {
    // ⛔ A DATA SAIU DE DENTRO DO VALOR. Ela vinha grudada ("R$ 4.453,13 em
    // 17/09/2026"), e duas grandezas na mesma célula quebram as duas: o
    // dinheiro perde o alinhamento à direita que faz uma coluna de valores ser
    // lida de cima a baixo, e a data perde o cabeçalho que diz o que ela é.
    // Coluna própria, como manda a tabela.
    id: "pagoEm",
    header: "Pago em",
    align: "right",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (installment) =>
      installment.paidAt ? formatDate(installment.paidAt) : <Dash />,
  },
  {
    id: "situacao",
    header: "Situação",
    cell: (installment) => (
      // O mapa de cor é o de PARCELA DE PEDIDO — a mesma pergunta ("esta
      // parcela está paga, pendente, vencida ou cancelada?") com o mesmo
      // significado de cor. Declarar um sexto mapa de cor de parcela nesta base
      // seria a forma conhecida de fazer dois lugares divergirem.
      <Badge variant={getBadgeVariant(installment.status ?? "", "ORDER_INSTALLMENT")}>
        {INSTALLMENT_STATUS_LABELS[installment.status as INSTALLMENT_STATUS] ??
          installment.status ??
          "—"}
      </Badge>
    ),
  },
  {
    id: "pagamento",
    header: "Pagar",
    align: "right",
    cell: (installment) => {
      const slip = installment.bankSlip;
      if (!slip) return <Dash />;
      return (
        <span className="flex flex-wrap justify-end gap-1.5">
          {slip.digitableLine ? (
            <CopiarCodigo label="Linha digitável" value={slip.digitableLine} />
          ) : null}
          {slip.pixQrCode ? <CopiarCodigo label="PIX" value={slip.pixQrCode} /> : null}
          {!slip.digitableLine && !slip.pixQrCode ? <Dash /> : null}
        </span>
      );
    },
  },
];

const nfseColumns: Array<PortalTableColumn<PortalChargeNfse>> = [
  {
    id: "numero",
    header: "Nota",
    cell: (nota) => <span className="tabular-nums">{nota.nfseNumber ?? "Sem número"}</span>,
  },
  {
    id: "emissao",
    header: "Emissão",
    cell: (nota) =>
      nota.createdAt ? (
        <span className="whitespace-nowrap tabular-nums">{formatDate(nota.createdAt)}</span>
      ) : (
        <Dash />
      ),
  },
  {
    id: "situacao",
    header: "Situação",
    align: "right",
    // Só nota AUTORIZADA chega ao cliente (o `where` é do servidor), então a
    // coluna é um confirmatório e não um estado que varia.
    cell: () => (
      <Badge variant="completed" size="sm">
        Autorizada
      </Badge>
    ),
  },
];

/** Uma cobrança — o cartão contornado que o §10 pede para cada seção. */
function CobrancaCard({ cobranca }: { cobranca: PortalCharge }) {
  const installments = cobranca.installments ?? [];
  const nfse = cobranca.nfse ?? [];

  const total = cobranca.totalAmount ?? 0;
  const pago = cobranca.paidAmount ?? 0;
  const emAberto = Math.max(total - pago, 0);
  const pagas = installments.filter((i) => (i.paidAmount ?? 0) > 0).length;

  const titulo = cobranca.budget?.budgetNumber
    ? `Orçamento nº ${cobranca.budget.budgetNumber}`
    : "Cobrança";

  return (
    <PortalSectionCard
      title={titulo}
      description={
        /* ⛔ E AQUI NÃO VAI MAIS NADA. Os três valores desceram para a faixa
           acima das parcelas — alinhados com a tabela, e o "Em aberto" com o
           peso que ele tem na decisão de quem paga. A lista de veículos saiu
           inteira: quem abre Cobranças veio pelo DINHEIRO, e a placa já está na
           tela do veículo e na do orçamento; ali ela só empurrava a tabela para
           baixo sem responder pergunta nenhuma. */
        undefined
      }
      action={
        // ⚠️ `BillingStatusBadge`, e o estado vem do bloco `billing` ANINHADO —
        // nunca de `cobranca.status`, que é o ciclo da `Invoice` e é um terceiro
        // vocabulário. Sem `billing` não há selo: a fatura existe e a cobrança
        // ainda não foi montada.
        cobranca.billing?.status ? (
          <BillingStatusBadge
            status={cobranca.billing.status as BILLING_STATUS}
            paidCount={pagas}
            totalCount={installments.length}
          />
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* ── O DINHEIRO, EM TRÊS BLOCOS DE LARGURA IGUAL ───────────────────
            ⛔ Era uma frase corrida no subtítulo do card, e o número que decide
            — o que ainda falta pagar — ficava por último, sem peso, no fim de
            uma linha de texto.

            Aqui os três dividem a mesma faixa, encostada na tabela de parcelas,
            e só o "Em aberto" vem em corpo maior: é ele que o financeiro do
            cliente veio ver. Quando a conta fecha, ele PERDE o destaque em vez
            de virar um zero gritando na tela. */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border">
          <div className="bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="tabular-nums text-foreground">{formatCurrency(total)}</p>
          </div>
          <div className="bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="tabular-nums text-foreground">{formatCurrency(pago)}</p>
          </div>
          <div className="bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">Em aberto</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums",
                emAberto > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {formatCurrency(emAberto)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Parcelas</p>
          <PortalTable
            columns={installmentColumns}
            rows={installments}
            getRowId={(installment) => installment.id}
            emptyTitle="Sem parcelas"
            emptyDescription="Esta cobrança ainda não teve as parcelas lançadas."
          />
        </div>

        {/* A NFS-e é uma seção PRÓPRIA dentro do cartão — nota fiscal e parcela
            são dois documentos diferentes, e empilhá-los numa tabela só faria o
            cliente procurar a nota entre os vencimentos. */}
        {nfse.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Notas fiscais</p>
            <PortalTable
              columns={nfseColumns}
              rows={nfse}
              getRowId={(nota) => nota.id}
              emptyTitle="Sem notas"
            />
          </div>
        )}
      </div>
    </PortalSectionCard>
  );
}

export function ClientePortalCobrancasPage() {
  /**
   * ⚠️ DINHEIRO VISÍVEL — quem LIGA é a `ResponsibleLayout`, uma vez por sessão.
   *
   * O eixo "mostrar/ocultar valores" nasce DESLIGADO (`pricing-visibility.ts`,
   * `_visible = false`) porque quem o liga no app interno é o `PricingProvider`,
   * que lê a preferência do FUNCIONÁRIO e, de propósito, não existe na árvore do
   * portal. Sem alguém ligando, todo `formatCurrency` desta tela imprimiria
   * "R$ ••••••" para um cliente que não tem botão nenhum para revelar. O lugar
   * certo disso é a moldura, e é lá que ele está — esta tela NÃO o duplica: dois
   * donos do mesmo valor global se desfazem na ordem errada de desmontagem.
   *
   * O que esta tela faz é SE INSCREVER. `formatCurrency` lê a bandeira como
   * valor de módulo, fora do React, e a moldura a liga num efeito — ou seja,
   * depois do primeiro render. Quando os dados vêm da rede, o render seguinte
   * conserta sozinho; quando a resposta já está no cache do react-query (entrar
   * direto nesta URL, voltar para a aba), não vem render nenhum e os pontinhos
   * ficariam na tela. `useSyncExternalStore` transforma a virada da bandeira no
   * gatilho do re-render, que é exatamente o que falta.
   */
  void usePricingVisible();

  // A PÁGINA VEM DA URL — mesma doutrina das listas de Orçamentos e Veículos.
  const [searchParams, setSearchParams] = useSearchParams();
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const takeRaw = Number(searchParams.get("pageSize") ?? String(PAGE_SIZE_PADRAO));
  const take = Number.isFinite(takeRaw) && takeRaw > 0 ? takeRaw : PAGE_SIZE_PADRAO;

  const query = useMemo(() => ({ page, take }), [page, take]);
  const charges = usePortalCharges(query);
  const cobrancas = useMemo(() => charges.data?.data ?? [], [charges.data]);

  /**
   * ⛔ `?? 0`, e NUNCA `?? cobrancas.length` — o fallback pelo tamanho da página
   * é o que fazia o rodapé das outras listas colapsar para "1 de 1" e
   * desabilitar o próprio botão de avançar. `keepPreviousData` (em
   * `usePortalCharges`) mantém a contagem anterior viva durante a viagem.
   */
  const meta = charges.data?.meta;
  const totalRecords = meta?.totalRecords ?? 0;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  /**
   * ⚠️ UMA escrita, com as duas chaves — `setSearchParams` do react-router NÃO
   * acumula (ele navega com o `searchParams` capturado naquele render), então
   * duas chamadas no mesmo tick se apagam. É a armadilha nº 2 de
   * `components/ui/datatable/pagination-url-sync.test.tsx`.
   */
  const escreverUrl = useCallback(
    (mutar: (p: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutar(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const irParaPagina = useCallback(
    // `SimplePaginationAdvanced` fala em índice 0; a URL fala em número de
    // página, como as demais listas do portal.
    (indice: number) => escreverUrl((p) => (indice > 0 ? p.set("page", String(indice + 1)) : p.delete("page"))),
    [escreverUrl],
  );

  const trocarTamanho = useCallback(
    // Trocar o tamanho invalida a página corrente: a de nº 7 com 10 por página
    // não existe com 60. As duas chaves na MESMA escrita.
    (tamanho: number) =>
      escreverUrl((p) => {
        tamanho === PAGE_SIZE_PADRAO ? p.delete("pageSize") : p.set("pageSize", String(tamanho));
        p.delete("page");
      }),
    [escreverUrl],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cobranças"
        icon={IconFileInvoice}
        breadcrumbs={[
          { label: "Início", href: routes.customer.portal.root },
          { label: "Cobranças" },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            onClick: () => void charges.refetch(),
            loading: charges.isFetching,
          },
        ]}
      />

      {/* O interceptor do portal já toastou; o que FICA na tela é isto, com o
          caminho de volta ao lado. Um toast some em 8 segundos. */}
      {charges.isError && (
        <PortalErrorBanner
          message={portalErrorMessage(charges.error, "Não foi possível carregar suas cobranças.")}
          onRetry={() => void charges.refetch()}
          retrying={charges.isFetching}
        />
      )}

      {charges.isLoading ? (
        <PortalCardSkeleton rows={2} />
      ) : cobrancas.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Nenhuma cobrança"
              description="Quando um orçamento seu for faturado, as parcelas, os boletos e as notas fiscais aparecem aqui."
              icon={<IconReceipt2 className="h-10 w-10" />}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {cobrancas.map((cobranca) => (
            <CobrancaCard key={cobranca.id} cobranca={cobranca} />
          ))}

          {/* O rodapé só aparece havendo o que paginar — numa empresa com três
              faturas ele seria uma barra de controles sem função. */}
          {totalPages > 1 && (
            <Card>
              <CardContent className="px-4 py-2">
                <SimplePaginationAdvanced
                  currentPage={page - 1}
                  totalPages={totalPages}
                  pageSize={take}
                  totalItems={totalRecords}
                  pageSizeOptions={OPCOES_POR_PAGINA}
                  onPageChange={irParaPagina}
                  onPageSizeChange={trocarTamanho}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// `App.tsx` carrega as telas do portal por `lazy(() => import(...))`, que exige
// exportação padrão. O nome continua valendo para quem importar direto.
export default ClientePortalCobrancasPage;
