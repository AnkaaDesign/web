import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowsExchange2,
  IconArrowUpRight,
  IconBuildingStore,
  IconCopy,
  IconDeviceFloppy,
  IconDownload,
  IconExternalLink,
  IconFileInvoice,
  IconLinkOff,
  IconListDetails,
  IconLoader2,
  IconReceipt2,
  IconReceiptTax,
  IconRefresh,
  IconUser,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import {
  useFiscalDocument,
  useFiscalDocumentXml,
  useSetFiscalItemCategory,
  useUnmatchTransaction,
  useUnmatchFiscalDocument,
} from "@/hooks/financial/use-reconciliation";
import { FiscalItemsTable } from "@/components/financial/reconciliation/fiscal-items-table";
import { useToast } from "@/hooks/common/use-toast";
import { formatCNPJ, formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import type {
  FiscalAddress,
  FiscalDocument,
  FiscalDocumentStatus,
  ReconciliationStatus,
} from "@/types/reconciliation";

/** The bank transaction embedded in a fiscal document's match record. */
type LinkedTransaction = NonNullable<
  NonNullable<FiscalDocument["matches"]>[number]["transaction"]
>;
import {
  docTypeLabel,
} from "@/components/financial/reconciliation/fiscal-doc-badge";
import {
  MatchStatusBadge,
  getConfidenceBadgeVariant,
} from "@/components/financial/reconciliation/match-status-badge";
import {
  FiscalDocMatchSection,
  type MatchSaveState,
} from "@/components/financial/reconciliation/fiscal-doc-match-section";
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";

const SEFAZ_CONSULTA_URL =
  "https://www.nfe.fazenda.gov.br/portal/consultaResumo.aspx?tipoConteudo=7PhJ+gAVw2g=";
const SEFAZ_DOC_TYPES = new Set(["NFE", "NFCE", "CTE"]);

const STATUS_LABELS: Record<FiscalDocumentStatus, string> = {
  AUTHORIZED: "Autorizada",
  CANCELLED: "Cancelada",
  DENIED: "Denegada",
  PENDING: "Pendente",
};
const STATUS_VARIANTS: Record<
  FiscalDocumentStatus,
  "completed" | "cancelled" | "pending"
> = {
  AUTHORIZED: "completed",
  CANCELLED: "cancelled",
  DENIED: "cancelled",
  PENDING: "pending",
};

// NFe `pag.detPag.tPag` payment-form codes → human labels.
const PAYMENT_FORMS: Record<string, string> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de crédito",
  "04": "Cartão de débito",
  "05": "Crédito loja",
  "10": "Vale alimentação",
  "11": "Vale refeição",
  "12": "Vale presente",
  "13": "Vale combustível",
  "15": "Boleto bancário",
  "16": "Depósito bancário",
  "17": "PIX",
  "18": "Transferência bancária",
  "19": "Programa de fidelidade",
  "90": "Sem pagamento",
  "99": "Outros",
};

function toNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatAddress(a: FiscalAddress | null | undefined): string | null {
  if (!a) return null;
  const line = [
    [a.logradouro, a.numero].filter(Boolean).join(", "),
    a.complemento,
    a.bairro,
    [a.municipio, a.uf].filter(Boolean).join(" - "),
    a.cep,
  ]
    .filter(Boolean)
    .join(" · ");
  return line || null;
}

// Module-scoped so it isn't redefined on every render (avoids remounting the
// whole subtree).
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        {children}
      </div>
    </PrivilegeRoute>
  );
}

export function ReconciliationFiscalDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTracker({ title: "Detalhe da Nota Fiscal", icon: "receipt" });

  const { data: doc, isLoading, error } = useFiscalDocument(id);

  // XML download (lazy — only fetched once the user clicks).
  const [requestXml, setRequestXml] = useState(false);
  const { data: blobUrl } = useFiscalDocumentXml(
    requestXml && doc ? doc.accessKey : undefined,
  );
  useEffect(() => {
    if (!requestXml || !blobUrl || !doc) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${doc.accessKey}.xml`;
    a.click();
    URL.revokeObjectURL(blobUrl);
    setRequestXml(false);
  }, [blobUrl, doc, requestXml]);

  const unmatchMut = useUnmatchTransaction();
  const unmatchDocMut = useUnmatchFiscalDocument();
  const setItemCategory = useSetFiscalItemCategory();
  const [unmatchTarget, setUnmatchTarget] = useState<{
    txId: string;
    matchCount: number;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  // The match section reports its save-ability + allocation totals up so the
  // Salvar button and running "Alocado / Faltam" summary live in the header.
  const [matchState, setMatchState] = useState<MatchSaveState | null>(null);
  const runUnmatch = (txId: string) =>
    unmatchMut.mutate(txId, { onSuccess: () => setUnmatchTarget(null) });
  const handleUnmatchRequest = (txId: string, totalForTx: number) => {
    if (totalForTx > 1) setUnmatchTarget({ txId, matchCount: totalForTx });
    else runUnmatch(txId);
  };
  const runResetMatches = () => {
    if (!doc) return;
    unmatchDocMut.mutate(doc.id, { onSuccess: () => setResetOpen(false) });
  };

  const isNfse = doc?.docType === "NFSE";
  const synthKey = doc?.accessKey?.startsWith("NFSE_") ?? false;

  const handleCopyKey = async () => {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(doc.accessKey);
      toast({ title: "Chave copiada", variant: "success" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "error" });
    }
  };
  const handleOpenSefaz = async () => {
    await handleCopyKey();
    window.open(SEFAZ_CONSULTA_URL, "_blank", "noopener,noreferrer");
  };

  const payments = useMemo(
    () => normalizePayments(doc?.paymentMethods),
    [doc?.paymentMethods],
  );

  if (!id)
    return (
      <Navigate to={routes.financial.reconciliation.fiscalDocuments} replace />
    );

  if (isLoading) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Frame>
    );
  }

  if (error || !doc) {
    return (
      <Frame>
        <Alert variant="destructive" className="mt-4">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Não foi possível carregar a nota fiscal.</span>
            <button
              className="text-sm underline hover:text-foreground"
              onClick={() =>
                navigate(routes.financial.reconciliation.fiscalDocuments)
              }
            >
              Voltar para a lista
            </button>
          </AlertDescription>
        </Alert>
      </Frame>
    );
  }

  const title =
    `${docTypeLabel(doc.docType)} ${doc.nfNumber ? `#${doc.nfNumber}` : ""}`.trim();

  // NF conciliation state — derived for the status badge. ENTRADA (received)
  // notes settle against bank debits: the open balance is the total minus the
  // non-reversed allocations, so a partial payment reads PARTIAL and a fully
  // covered note RECONCILED. SAIDA (emitted) notes never get a bank match —
  // their durable link is the faturamento — so fall back to the API `linked`
  // flag. reversedAt / adjustmentAmount aren't guaranteed on the trimmed match
  // embed, so read them defensively.
  const activeNfMatches = (doc.matches ?? []).filter(
    (m) => (m as { reversedAt?: string | null }).reversedAt == null,
  );
  const nfAllocated = activeNfMatches.reduce(
    (sum, m) =>
      sum +
      (m.allocatedAmount ?? 0) +
      ((m as { adjustmentAmount?: number | null }).adjustmentAmount ?? 0),
    0,
  );
  const nfOpenBalance = Number((doc.totalValue - nfAllocated).toFixed(2));
  const nfStatus: ReconciliationStatus =
    doc.operationType === "SAIDA"
      ? doc.linked
        ? "RECONCILED"
        : "PENDING"
      : nfOpenBalance <= 0.05 && activeNfMatches.length > 0
        ? "RECONCILED"
        : activeNfMatches.length > 0
          ? "PARTIAL"
          : "PENDING";

  return (
    <Frame>
      <PageHeader
        variant="detail"
        title={title}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          // The received-NF reconciliation surface lives under Conciliação
          // Bancária → Notas Fiscais (the fiscal-document side of conciliation).
          {
            label: "Conciliação Bancária",
            href: routes.financial.reconciliation.root,
          },
          {
            label: "Notas Fiscais",
            href: routes.financial.reconciliation.fiscalDocuments,
          },
          { label: title },
        ]}
        headerExtra={
          matchState ? (
            <span className="text-sm whitespace-nowrap mr-1">
              Alocado{" "}
              <strong
                className={
                  matchState.valid ? "text-emerald-600" : "text-amber-600"
                }
              >
                {formatCurrency(matchState.allocated)}
              </strong>{" "}
              / {formatCurrency(matchState.target)}
              {matchState.selectedCount > 0 && !matchState.valid && (
                <span className="text-amber-600">
                  {" "}
                  ·{" "}
                  {matchState.allocated > matchState.target
                    ? "Excede"
                    : "Faltam"}{" "}
                  {formatCurrency(matchState.missing)}
                </span>
              )}
            </span>
          ) : undefined
        }
        actions={[
          // Salvar conciliação — surfaced only while the match section reports a
          // selectable state (see FiscalDocMatchSection.onSaveStateChange). Merged
          // ahead of the existing NF-info actions (refresh / SEFAZ / XML).
          ...(matchState
            ? [
                {
                  key: "save",
                  label: matchState.label ?? "Salvar conciliação",
                  icon: IconDeviceFloppy,
                  onClick: () => matchState.save(),
                  disabled: !matchState.canSave,
                  loading: matchState.saving,
                  variant: "default" as const,
                },
              ]
            : []),
          ...(SEFAZ_DOC_TYPES.has(doc.docType)
            ? [
                {
                  key: "sefaz",
                  label: "Ver no SEFAZ",
                  icon: IconExternalLink,
                  onClick: handleOpenSefaz,
                  variant: "outline" as const,
                },
              ]
            : []),
          {
            key: "xml",
            label: "Baixar XML",
            icon: IconDownload,
            onClick: () => setRequestXml(true),
            disabled: !doc.rawXmlFileId,
            // Yields the primary slot to "Salvar conciliação" while a match is
            // in progress; otherwise stays the default (primary) NF action.
            variant: matchState ? ("outline" as const) : ("default" as const),
          },
        ]}
        className="flex-shrink-0"
      />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          {doc.dateInferred && (
            <Alert>
              <IconAlertTriangle className="h-4 w-4" />
              <AlertDescription>
                A data de emissão não pôde ser lida do XML e foi inferida —
                confira no documento original.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Identificação */}
            <SectionCard
              title="Identificação"
              icon={IconFileInvoice}
              headerRight={<MatchStatusBadge status={nfStatus} />}
            >
              <InfoRow
                label="Status"
                value={
                  <Badge variant={STATUS_VARIANTS[doc.status]} size="sm">
                    {STATUS_LABELS[doc.status] || doc.status}
                  </Badge>
                }
              />
              <InfoRow label="Número" value={doc.nfNumber} />
              <InfoRow label="Série" value={doc.series} />
              <InfoRow label="Modelo" value={doc.model} />
              <InfoRow
                label="Natureza da operação"
                value={doc.naturezaOperacao}
              />
              <InfoRow label="Emissão" value={formatDate(doc.issueDate)} />
              {doc.orderCodes && doc.orderCodes.length > 0 && (
                <InfoRow
                  label={doc.orderCodes.length > 1 ? "Pedidos" : "Pedido"}
                  value={
                    <span className="flex flex-wrap justify-end gap-1">
                      {doc.orderCodes.map((o) => (
                        <Badge
                          key={o.code}
                          variant="secondary"
                          size="sm"
                          className="font-mono"
                        >
                          {o.code}
                        </Badge>
                      ))}
                    </span>
                  }
                />
              )}
              <InfoRow
                label="Origem"
                value={
                  doc.source === "SIEG_API"
                    ? "SIEG (automático)"
                    : "Upload manual"
                }
              />
              {doc.status === "CANCELLED" && doc.cancelledAt && (
                <InfoRow
                  label="Cancelada em"
                  value={formatDate(doc.cancelledAt)}
                />
              )}
              <InfoRow
                label={synthKey ? "Identificador" : "Chave de acesso"}
                value={
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="font-mono text-xs inline-flex items-center gap-1.5 hover:underline break-all text-right"
                    title={doc.accessKey}
                  >
                    {synthKey ? doc.accessKey : `…${doc.accessKey.slice(-16)}`}
                    <IconCopy className="h-3 w-3 flex-shrink-0" />
                  </button>
                }
              />
              {doc.infCpl && (
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1.5">
                  <span className="text-sm font-medium text-muted-foreground">
                    Informações complementares
                  </span>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {doc.infCpl}
                  </p>
                </div>
              )}
            </SectionCard>

            {/* Valores, impostos e pagamento — a single financial section sitting
                next to Identificação: values/taxes, then the payment forms and
                the linked bank transaction(s), so "how much" and "paid how /
                matched to what" read together. */}
            <SectionCard
              title="Valores, impostos e pagamento"
              icon={IconReceiptTax}
            >
              <div className="space-y-5">
                {/* Valores e impostos */}
                <div className="space-y-3">
                  {isNfse ? (
                    <>
                      <InfoRow
                        label="Valor dos serviços"
                        value={fmtMoney(doc.valorServicos)}
                      />
                      <InfoRow
                        label="Base de cálculo ISS"
                        value={fmtMoney(doc.baseCalculo)}
                      />
                      <InfoRow
                        label="Valor do ISS"
                        value={fmtMoney(doc.issValue)}
                      />
                      <InfoRow
                        label="Alíquota ISS"
                        value={
                          toNum(doc.issRate) != null
                            ? `${toNum(doc.issRate)}%`
                            : null
                        }
                      />
                      {doc.issRetained != null && (
                        <InfoRow
                          label="ISS retido"
                          value={doc.issRetained ? "Sim" : "Não"}
                        />
                      )}
                      <InfoRow
                        label="Valor líquido"
                        value={fmtMoney(doc.valorLiquido)}
                      />
                      <InfoRow
                        label="Cód. trib. município"
                        value={doc.codigoTributacaoMunicipio}
                      />
                      <InfoRow
                        label="Município prestação"
                        value={doc.municipioPrestacao}
                      />
                    </>
                  ) : (
                    <>
                      <InfoRow
                        label="Produtos"
                        value={fmtMoney(doc.totals?.vProd)}
                      />
                      <InfoRow
                        label="Frete"
                        value={fmtMoney(doc.totals?.vFrete)}
                      />
                      <InfoRow
                        label="Desconto"
                        value={fmtMoney(doc.totals?.vDesc)}
                      />
                      <InfoRow
                        label="Base ICMS"
                        value={fmtMoney(doc.totals?.vBC)}
                      />
                      <InfoRow
                        label="Valor ICMS"
                        value={fmtMoney(doc.totals?.vICMS)}
                      />
                      <InfoRow label="IPI" value={fmtMoney(doc.totals?.vIPI)} />
                      <InfoRow
                        label="Tributos aprox."
                        value={fmtMoney(doc.totals?.vTotTrib)}
                      />
                    </>
                  )}
                  <div className="flex justify-between items-center bg-primary/10 rounded-lg px-4 py-3 border border-primary/20">
                    <span className="text-sm font-semibold text-foreground">
                      Total da nota
                    </span>
                    <span className="text-base font-bold text-foreground tabular-nums">
                      {formatCurrency(doc.totalValue)}
                    </span>
                  </div>
                </div>

                {/* Pagamento */}
                {payments.length > 0 && (
                  <div className="space-y-3">
                    <SubHeading icon={IconReceipt2}>Pagamento</SubHeading>
                    {payments.map((p, i) => (
                      <InfoRow
                        key={i}
                        label={
                          PAYMENT_FORMS[p.form ?? ""] ||
                          p.form ||
                          "Forma de pagamento"
                        }
                        value={p.value != null ? formatCurrency(p.value) : "—"}
                      />
                    ))}
                  </div>
                )}

                {/* Transações vinculadas */}
                {doc.matches && doc.matches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <SubHeading icon={IconArrowsExchange2}>
                        {doc.matches.length > 1
                          ? "Transações vinculadas"
                          : "Transação vinculada"}
                      </SubHeading>
                      {doc.matches.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unmatchDocMut.isPending}
                          onClick={() => setResetOpen(true)}
                        >
                          <IconRefresh className="h-4 w-4" />
                          Desfazer todas
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {doc.matches.map((m) => {
                        const tx = m.transaction;
                        if (!tx) {
                          return (
                            <p
                              key={m.id}
                              className="text-xs text-muted-foreground"
                            >
                              Transação removida
                            </p>
                          );
                        }
                        const txMatchCount =
                          doc.matches?.filter(
                            (x) => x.transaction?.id === tx.id,
                          ).length ?? 1;
                        return (
                          <LinkedTransactionCard
                            key={m.id}
                            tx={tx}
                            confidenceScore={m.confidenceScore}
                            allocatedAmount={m.allocatedAmount}
                            unmatchDisabled={unmatchMut.isPending}
                            onUnmatch={() =>
                              handleUnmatchRequest(tx.id, txMatchCount)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Orçamento / Faturamento — direction-aware "vinculada" for
                    SAIDA (emitted) notes. An emitted NFS-e never gets a bank
                    match; its durable link is the faturamento (Invoice) or the
                    orçamento (Task) it was generated from. */}
                {doc.operationType === "SAIDA" &&
                  (doc.nfseDocument?.invoiceId || doc.nfseDocument?.taskId) && (
                    <div className="space-y-3">
                      <SubHeading icon={IconArrowsExchange2}>
                        Orçamento / Faturamento
                      </SubHeading>
                      <div className="flex flex-wrap gap-2">
                        {doc.nfseDocument?.invoiceId && (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              to={routes.financial.billing.details(
                                doc.nfseDocument.invoiceId,
                              )}
                            >
                              Abrir faturamento
                              <IconArrowUpRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        )}
                        {doc.nfseDocument?.taskId && (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              to={routes.financial.budget.details(
                                doc.nfseDocument.taskId,
                              )}
                            >
                              Abrir orçamento
                              <IconArrowUpRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </SectionCard>
          </div>

          {/* Emitente / Destinatário (Prestador / Tomador for NFSe) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title={isNfse ? "Prestador" : "Emitente"}
              icon={IconBuildingStore}
            >
              <InfoRow label="Nome / Razão social" value={doc.emitName} />
              <InfoRow
                label="CNPJ"
                value={doc.emitCnpj ? formatCNPJ(doc.emitCnpj) : null}
              />
              <InfoRow label="Inscrição estadual" value={doc.emitIE} />
              <InfoRow
                label="Endereço"
                value={formatAddress(doc.emitAddress)}
              />
            </SectionCard>

            <SectionCard
              title={isNfse ? "Tomador" : "Destinatário"}
              icon={IconUser}
            >
              <InfoRow label="Nome / Razão social" value={doc.destName} />
              <InfoRow
                label="CNPJ / CPF"
                value={
                  doc.destCnpj
                    ? formatCNPJ(doc.destCnpj)
                    : doc.destCpf
                      ? formatCnpjCpf(doc.destCpf)
                      : null
                }
              />
              <InfoRow label="Inscrição estadual" value={doc.destIE} />
              <InfoRow label="E-mail" value={doc.destEmail} />
              <InfoRow
                label="Endereço"
                value={formatAddress(doc.destAddress)}
              />
            </SectionCard>
          </div>

          {/* Serviços (NFSe) or Itens (NFe) — editable per-line category */}
          {doc.items && doc.items.length > 0 && (
            <SectionCard
              title={isNfse ? "Serviços" : "Itens / produtos"}
              icon={IconListDetails}
            >
              <FiscalItemsTable
                items={doc.items}
                docType={doc.docType}
                totalValue={doc.totalValue}
                editable
                hideLineMeta
                onItemCategoryChange={(fiscalItemId, categoryId) =>
                  setItemCategory.mutate({ fiscalItemId, categoryId })
                }
              />
            </SectionCard>
          )}

          {/* Conciliar — pick a bank transaction that settles this note. The
              NF-side mirror of the transaction page's "Candidatas à conciliação".
              Self-gates: renders (and reports a header save state) only for
              ENTRADA notes with an open balance; otherwise it returns null and
              clears the header state. */}
          <FiscalDocMatchSection
            fiscalDocument={doc}
            onSaveStateChange={setMatchState}
          />
        </div>
      </div>

      <UnmatchConfirmDialog
        open={unmatchTarget !== null}
        onOpenChange={(open) => !open && setUnmatchTarget(null)}
        matchCount={unmatchTarget?.matchCount ?? 0}
        isLoading={unmatchMut.isPending}
        onConfirm={() => unmatchTarget && runUnmatch(unmatchTarget.txId)}
      />

      <UnmatchConfirmDialog
        open={resetOpen}
        onOpenChange={(open) => !open && setResetOpen(false)}
        matchCount={doc?.matches?.length ?? 0}
        isLoading={unmatchDocMut.isPending}
        onConfirm={runResetMatches}
        title="Desfazer todas as conciliações da nota"
        description="Esta ação removerá o vínculo desta nota fiscal com todas as transações conciliadas (incluindo parcelas). As transações afetadas voltarão a 'Não conciliado' e a nota poderá ser conciliada novamente."
      />
    </Frame>
  );
}

function SectionCard({
  title,
  icon: Icon,
  headerRight,
  children,
}: {
  title: string;
  icon: (props: { className?: string }) => React.ReactNode;
  /** Optional trailing node in the card header (e.g. a status badge). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            {title}
          </CardTitle>
          {headerRight}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Small section sub-header used to label blocks nested inside a SectionCard
 *  (e.g. "Pagamento" / "Transação vinculada" inside the financial section). */
function SubHeading({
  icon: Icon,
  children,
}: {
  icon: (props: { className?: string }) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/** Neutral, link-styled card for a bank transaction matched to this note. */
function LinkedTransactionCard({
  tx,
  confidenceScore,
  allocatedAmount,
  unmatchDisabled,
  onUnmatch,
}: {
  tx: LinkedTransaction | undefined;
  confidenceScore?: number;
  allocatedAmount?: number | null;
  unmatchDisabled?: boolean;
  onUnmatch: () => void;
}) {
  if (!tx) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {formatDate(tx.postedAt)}
            </span>
            {tx.type && (
              <Badge
                size="sm"
                variant={tx.type === "CREDIT" ? "completed" : "cancelled"}
              >
                {tx.type === "CREDIT" ? "Crédito" : "Débito"}
              </Badge>
            )}
            {confidenceScore !== undefined && (
              <Badge
                size="sm"
                variant={getConfidenceBadgeVariant(confidenceScore)}
              >
                {confidenceScore}%
              </Badge>
            )}
          </div>
          {(tx.counterpartyName || tx.counterpartyCnpjCpf) && (
            <p className="text-xs text-muted-foreground truncate">
              {tx.counterpartyName ||
                (tx.counterpartyCnpjCpf
                  ? formatCnpjCpf(tx.counterpartyCnpjCpf)
                  : "")}
            </p>
          )}
          {tx.memo && (
            <p className="text-[10px] font-mono text-muted-foreground/70 truncate">
              {tx.memo}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="font-semibold tabular-nums text-sm">
            {formatCurrency(tx.amount)}
          </span>
          {allocatedAmount != null && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              Alocado {formatCurrency(allocatedAmount)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <Button asChild variant="default" size="sm" className="h-8">
          <Link to={routes.financial.reconciliation.transactionDetail(tx.id)}>
            Abrir transação
            <IconArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-8"
          disabled={unmatchDisabled}
          aria-label="Desvincular nota desta transação"
          onClick={onUnmatch}
        >
          <IconLinkOff className="h-3.5 w-3.5 mr-1" />
          Desvincular
        </Button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div
      className={cn(
        "flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3",
        className,
      )}
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">
        {value}
      </span>
    </div>
  );
}

function fmtMoney(v: number | string | null | undefined): string | null {
  const n = toNum(v);
  return n != null ? formatCurrency(n) : null;
}

interface NormalizedPayment {
  form?: string;
  value?: number | null;
}
function normalizePayments(raw: unknown): NormalizedPayment[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((p): NormalizedPayment | null => {
      if (!p || typeof p !== "object") return null;
      const rec = p as Record<string, unknown>;
      const form = rec.tPag != null ? String(rec.tPag) : undefined;
      const value = toNum(rec.vPag as string | number | null | undefined);
      if (form === undefined && value == null) return null;
      return { form, value };
    })
    .filter((p): p is NormalizedPayment => p !== null);
}

export default ReconciliationFiscalDocumentDetailPage;
