import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconDownload,
  IconExternalLink,
  IconLinkOff,
} from "@tabler/icons-react";
import {
  useFiscalDocumentXml,
  useUnmatchTransaction,
} from "@/hooks/financial/use-reconciliation";
import { useToast } from "@/hooks/common/use-toast";
import {
  formatCNPJ,
  formatCnpjCpf,
  formatCurrency,
  formatDate,
} from "@/utils";
import { routes } from "@/constants";
import type { FiscalDocument, FiscalDocumentStatus } from "@/types/reconciliation";
import { getConfidenceBadgeVariant } from "./match-status-badge";
import { MatchCard } from "./match-card";
import { UnmatchConfirmDialog } from "./unmatch-confirm-dialog";

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
  "completed" | "cancelled" | "pending" | "inProgress"
> = {
  AUTHORIZED: "completed",
  CANCELLED: "cancelled",
  DENIED: "cancelled",
  PENDING: "pending",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  NFE: "NF-e",
  NFSE: "NFS-e",
  CTE: "CT-e",
  NFCE: "NFC-e",
  CFE: "CF-e",
};

interface Props {
  doc: FiscalDocument | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Detail modal for a fiscal document. Renamed from "Sheet" but kept the
 *  filename for import-stability — content is now a Dialog. */
export function FiscalDocumentDetailSheet({ doc, open, onOpenChange }: Props) {
  const [requestXml, setRequestXml] = useState(false);
  const { data: blobUrl } = useFiscalDocumentXml(requestXml && doc ? doc.accessKey : undefined);
  const { toast } = useToast();
  const unmatchMut = useUnmatchTransaction();
  const [unmatchTarget, setUnmatchTarget] = useState<{ txId: string; matchCount: number } | null>(
    null,
  );

  // Backend endpoint removes every match for the transaction, not just the one
  // clicked. When the tx has multiple NFs linked, confirm before proceeding.
  const handleUnmatchRequest = (txId: string, totalMatchesForTx: number) => {
    if (totalMatchesForTx > 1) {
      setUnmatchTarget({ txId, matchCount: totalMatchesForTx });
      return;
    }
    runUnmatch(txId);
  };

  const runUnmatch = (txId: string) => {
    unmatchMut.mutate(txId, {
      // Success/error toasts are emitted by the axios interceptors.
      onSuccess: () => {
        setUnmatchTarget(null);
      },
    });
  };

  useEffect(() => {
    if (!open) setRequestXml(false);
  }, [open]);

  useEffect(() => {
    if (!requestXml || !blobUrl || !doc) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${doc.accessKey}.xml`;
    a.click();
    URL.revokeObjectURL(blobUrl);
    setRequestXml(false);
  }, [blobUrl, doc, requestXml]);

  if (!doc) return null;

  const showSefazLink = SEFAZ_DOC_TYPES.has(doc.docType);

  const handleOpenSefaz = async () => {
    try {
      await navigator.clipboard.writeText(doc.accessKey);
      toast({
        title: "Chave copiada",
        description: "Cole no campo de consulta do SEFAZ.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Não foi possível copiar a chave",
        description: "Copie manualmente antes de consultar.",
        variant: "error",
      });
    }
    window.open(SEFAZ_CONSULTA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da nota fiscal
            <Badge variant="inProgress" size="sm">
              {DOC_TYPE_LABELS[doc.docType] || doc.docType}
            </Badge>
            <Badge
              variant={doc.operationType === "ENTRADA" ? "completed" : "cancelled"}
              size="sm"
            >
              {doc.operationType === "ENTRADA" ? "Entrada" : "Saída"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="font-mono text-sm text-foreground/70 break-all">
            {doc.accessKey}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4 text-sm rounded-md border border-border/60 bg-muted/20 p-4">
            <Field label="Emissão" value={formatDate(doc.issueDate)} />
            <Field label="Número" value={doc.nfNumber || "—"} />
            <Field
              label="Status"
              value={
                <Badge variant={STATUS_VARIANTS[doc.status]} size="sm">
                  {STATUS_LABELS[doc.status] || doc.status}
                </Badge>
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Emitente">
              <p className="font-medium">{doc.emitName || "—"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {doc.emitCnpj ? formatCNPJ(doc.emitCnpj) : "—"}
              </p>
            </Section>

            <Section title="Destinatário">
              <p className="font-medium">{doc.destName || "—"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {doc.destCnpj
                  ? formatCNPJ(doc.destCnpj)
                  : doc.destCpf
                    ? formatCnpjCpf(doc.destCpf)
                    : "—"}
              </p>
            </Section>
          </div>

          {doc.items && doc.items.length > 0 && (
            <Section title="Serviços / Itens">
              <div className="rounded-md border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Código</th>
                      <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Qtd.</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Unitário</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {doc.items.map(item => {
                      const qty = toNumber(item.quantity);
                      const unitValue = toNumber(item.unitValue);
                      const total = toNumber(item.totalValue) ?? 0;
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {item.code || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <p className="whitespace-pre-wrap break-words">{item.description}</p>
                            {item.category?.name && (
                              <Badge
                                variant="secondary"
                                size="sm"
                                className="mt-1 whitespace-nowrap"
                                style={
                                  item.category.color
                                    ? { backgroundColor: item.category.color, color: "#fff", borderColor: "transparent" }
                                    : undefined
                                }
                              >
                                {item.category.name}
                                {typeof item.categoryConfidence === "number"
                                  ? ` · ${Math.round(item.categoryConfidence)}%`
                                  : ""}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {qty !== null && qty > 0 ? (
                              <>
                                {formatQuantity(qty)}
                                {item.unit ? (
                                  <span className="text-muted-foreground"> {item.unit}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {unitValue !== null && unitValue > 0 ? (
                              formatCurrency(unitValue)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                            {formatCurrency(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t-2 border-border">
                    <tr>
                      <td className="px-3 py-2.5 font-semibold uppercase text-xs tracking-wide">
                        Total
                      </td>
                      <td className="px-3 py-2.5" colSpan={3} />
                      <td className="px-3 py-2.5 text-right font-bold text-base tabular-nums whitespace-nowrap">
                        {formatCurrency(doc.totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}

          {doc.matches && doc.matches.length > 0 && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Transações vinculadas a esta nota
              </p>
              <ul className="space-y-2">
                {doc.matches.map(m => {
                  const tx = m.transaction;
                  if (!tx) {
                    return (
                      <li key={m.id} className="text-xs text-muted-foreground">
                        Transação removida
                      </li>
                    );
                  }
                  const txHref = `${routes.financial.reconciliation.transactions}?txId=${tx.id}`;
                  const inner = (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-medium">{formatDate(tx.postedAt)}</span>
                          {tx.type && (
                            <Badge
                              size="sm"
                              variant={tx.type === "CREDIT" ? "completed" : "cancelled"}
                            >
                              {tx.type === "CREDIT" ? "Crédito" : "Débito"}
                            </Badge>
                          )}
                          {m.confidenceScore !== undefined && (
                            <Badge
                              size="sm"
                              variant={getConfidenceBadgeVariant(m.confidenceScore)}
                            >
                              {m.confidenceScore}%
                            </Badge>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                      {(tx.counterpartyName || tx.counterpartyCnpjCpf) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {tx.counterpartyName ||
                            (tx.counterpartyCnpjCpf
                              ? formatCnpjCpf(tx.counterpartyCnpjCpf)
                              : "")}
                        </p>
                      )}
                      {tx.memo && (
                        <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                          {tx.memo}
                        </p>
                      )}
                      {m.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{m.notes}</p>
                      )}
                    </>
                  );
                  // The Desvincular button is a sibling of the navigation cue
                  // inside the shared MatchCard's footer. preventDefault +
                  // stopPropagation keep this click from following the parent
                  // Link to the transaction's detail page.
                  const txMatchCount = m.transaction
                    ? doc.matches?.filter(
                        x => x.transaction?.id === m.transaction?.id,
                      ).length ?? 1
                    : 1;
                  const unmatchAction = (
                    <button
                      type="button"
                      disabled={unmatchMut.isPending}
                      aria-label="Desvincular nota desta transação"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnmatchRequest(tx.id, txMatchCount);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs font-medium hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconLinkOff className="h-3 w-3" />
                      Desvincular
                    </button>
                  );
                  return (
                    <li key={m.id}>
                      <MatchCard
                        to={txHref}
                        linkLabel="transação"
                        onNavigate={() => onOpenChange(false)}
                        action={unmatchAction}
                      >
                        {inner}
                      </MatchCard>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {showSefazLink && (
              <Button onClick={handleOpenSefaz} className="flex-1">
                <IconExternalLink className="h-4 w-4 mr-2" /> Ver no SEFAZ
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setRequestXml(true)}
              className="flex-1"
            >
              <IconDownload className="h-4 w-4 mr-2" /> Baixar XML
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao abrir o SEFAZ a chave é copiada automaticamente — basta colar no campo
            de consulta e resolver o captcha para visualizar a DANFE. O XML continua
            sendo o documento fiscal autêntico.
          </p>
        </div>
      </DialogContent>

      <UnmatchConfirmDialog
        open={unmatchTarget !== null}
        onOpenChange={open => !open && setUnmatchTarget(null)}
        matchCount={unmatchTarget?.matchCount ?? 0}
        isLoading={unmatchMut.isPending}
        onConfirm={() => unmatchTarget && runUnmatch(unmatchTarget.txId)}
      />
    </Dialog>
  );
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatQuantity(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function Field({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={bold ? "font-semibold text-base" : "font-medium"}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground mb-1 tracking-wide">{title}</p>
      {children}
    </div>
  );
}
