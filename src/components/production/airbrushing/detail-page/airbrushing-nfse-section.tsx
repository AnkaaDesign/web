// airbrushing-nfse-section.tsx
//
// Corpo da seção "NFS-e do Aerografista" da página de detalhes da aerografia. A nota sai
// com o PINTOR como prestador (MEI, certificado A1 dele) e a empresa como tomadora — por
// isso o CNPJ exibido é o do pintor, não o da Ankaa.
//
// O ambiente é destacado de propósito: uma nota em "Produção Restrita" NÃO tem valor
// fiscal, e confundir as duas é o erro caro deste fluxo.
//
// Esta é a seção ÚNICA do documento fiscal: o DANFSe (PDF) e o XML autorizado ficam lado a
// lado no bloco "Documentos da nota". Antes o PDF aparecia solto na galeria de notas
// anexadas — misturado aos arquivos que o usuário sobe à mão, sem nenhuma marca de que é
// gerado pelo sistema e longe do XML que o acompanha.

import { useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCopy,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconFileTypeXml,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { useFileViewer } from "@/components/common/file";

import { formatCurrency, formatDate, formatDateTime, maskCNPJ } from "@/utils";
import { formatFileSize, getFileDownloadUrl } from "@/utils/file";
import { NFSE_CANCEL_REASON, NFSE_CANCEL_REASON_LABELS, NFSE_ENVIRONMENT, NFSE_ENVIRONMENT_LABELS, NFSE_STATUS } from "../../../../constants";
import type { AirbrushingNfse, File as AnkaaFile } from "../../../../types";
import { airbrushingNfseService } from "@/api-client/airbrushing-nfse";
import { useAirbrushingNfse, useCancelAirbrushingNfse, useEmitAirbrushingNfse } from "../../../../hooks/production/use-airbrushing-nfse";

// A SEFIN recusa justificativas curtas; validamos aqui para não gastar a requisição.
const MIN_CANCEL_REASON_LENGTH = 15;

const CANCEL_REASON_OPTIONS = Object.entries(NFSE_CANCEL_REASON_LABELS).map(([value, label]) => ({ value, label }));

const muted = <span className="text-muted-foreground">—</span>;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value ?? muted}</span>
    </div>
  );
}

/**
 * Agrupador visual. A seção era uma pilha única de linhas rótulo/valor em que identificação,
 * dinheiro e documentos se confundiam; cada assunto agora fica no seu próprio bloco.
 *
 * Exportado porque a seção "Preço & Pagamento" usa o MESMO bloco para os recibos — o
 * objetivo é que documento de aerografia tenha um visual só, não um por seção.
 */
export function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

/**
 * Linha ÚNICA de documento do bloco "Documentos da nota" — DANFSe e XML usam esta mesma
 * estrutura, sem exceção: mesmo container, mesmo ícone à esquerda, mesmos botões DENTRO do
 * card e alinhados à direita.
 *
 * Antes o DANFSe era um `FileItem` (que traz o próprio cartão) com o botão de download
 * pendurado FORA dele, enquanto o XML era esta linha com o botão dentro — as duas linhas do
 * mesmo bloco não batiam. `FileItem` não deixa posicionar a ação, então quem cede é ele.
 *
 * Exportado: os recibos, dentro de "Preço & Pagamento", são a MESMA linha — um documento da
 * aerografia se parece com um documento da aerografia, esteja em que seção estiver.
 */
export function DocumentRow({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted/30">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-foreground">{title}</h4>
        <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/**
 * Status + ambiente da nota, para o `headerActions` da seção no DetailPage. Antes ocupavam
 * uma linha inteira do corpo; no cabeçalho a nota se identifica antes de ser lida.
 *
 * Não busca nada: recebe a nota já carregada pela página (mesma query, mesmo cache).
 */
export function AirbrushingNfseHeaderBadges({ nfse }: { nfse: AirbrushingNfse | null | undefined }) {
  if (!nfse) return null;
  const isRestricted = nfse.environment === NFSE_ENVIRONMENT.RESTRICTED_PRODUCTION;
  return (
    <div className="flex items-center gap-2">
      <NfseStatusBadge status={nfse.status} />
      <Badge variant={isRestricted ? "amber" : "secondary"}>{NFSE_ENVIRONMENT_LABELS[nfse.environment] || nfse.environment}</Badge>
    </div>
  );
}

interface AirbrushingNfseSectionProps {
  airbrushingId: string;
  /** Quem pode disparar reemissão / cancelamento (mesma audiência financeira da página). */
  canManage?: boolean;
  /**
   * Anexos de "Notas Fiscais" da aerografia. O servidor conecta o DANFSe nesta relação, então
   * é daqui que sai o File completo do PDF (nome, tamanho, miniatura) sem uma segunda busca.
   */
  invoices?: AnkaaFile[];
  className?: string;
}

export function AirbrushingNfseSection({ airbrushingId, canManage = false, invoices, className }: AirbrushingNfseSectionProps) {
  const { data: response, isLoading } = useAirbrushingNfse(airbrushingId);
  const emitMutation = useEmitAirbrushingNfse();
  const cancelMutation = useCancelAirbrushingNfse();
  const { actions } = useFileViewer();

  const [isDownloading, setIsDownloading] = useState(false);
  const [emitConfirmOpen, setEmitConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(String(NFSE_CANCEL_REASON.EMISSION_ERROR));
  const [cancelReason, setCancelReason] = useState("");

  const nfse = response?.data ?? null;

  const isRestricted = nfse?.environment === NFSE_ENVIRONMENT.RESTRICTED_PRODUCTION;
  const isCancellable = !!nfse && nfse.status === NFSE_STATUS.AUTHORIZED;
  // Reemissão só faz sentido quando a nota não está viva: erro, ou cancelada/rejeitada.
  const isReemittable = !nfse || [NFSE_STATUS.ERROR, NFSE_STATUS.CANCELLED, NFSE_STATUS.CANCEL_REJECTED].includes(nfse.status);
  // O XML só existe depois de autorizada — antes disso a rota 404a de propósito.
  const hasXml =
    !!nfse?.accessKey &&
    [NFSE_STATUS.AUTHORIZED, NFSE_STATUS.CANCEL_REQUESTED, NFSE_STATUS.CANCEL_REJECTED, NFSE_STATUS.CANCELLED].includes(nfse.status);

  /** O File do DANFSe vive nos anexos da aerografia; casá-lo por id dá nome/tamanho de graça. */
  const pdfFile = useMemo(() => {
    if (!nfse?.pdfFileId) return null;
    return (invoices ?? []).find((f) => f.id === nfse.pdfFileId) ?? null;
  }, [invoices, nfse?.pdfFileId]);

  const reasonTooShort = cancelReason.trim().length < MIN_CANCEL_REASON_LENGTH;

  const providerLabel = useMemo(() => {
    if (!nfse?.profile) return null;
    return (
      <span className="text-right">
        <span className="block">{nfse.profile.corporateName}</span>
        <span className="block font-mono text-xs font-normal text-muted-foreground">{maskCNPJ(nfse.profile.cnpj)}</span>
      </span>
    );
  }, [nfse?.profile]);

  const handleCopyAccessKey = async () => {
    if (!nfse?.accessKey) return;
    try {
      await navigator.clipboard.writeText(nfse.accessKey);
      toast.success("Chave de acesso copiada.");
    } catch {
      toast.error("Não foi possível copiar a chave de acesso.");
    }
  };

  /** Abre o DANFSe no visualizador global (mesmo modal das galerias de arquivo). */
  const handleViewPdf = () => {
    if (!pdfFile) return;
    actions.viewFiles([pdfFile], 0);
  };

  /**
   * Download do DANFSe. Quando o File veio no include usamos `getFileDownloadUrl` (que sabe
   * lidar com arquivo remoto); quando só temos o id, cai na rota por id do próprio arquivo.
   */
  const handleDownloadPdf = () => {
    const url = pdfFile ? getFileDownloadUrl(pdfFile) : nfse?.pdfFileId ? getFileDownloadUrl({ id: nfse.pdfFileId, path: "" } as AnkaaFile) : null;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /**
   * O endpoint devolve o XML como STRING (não um blob), então o download é montado aqui:
   * Blob → object URL → clique sintético → revoke.
   */
  const handleDownloadXml = async () => {
    setIsDownloading(true);
    try {
      const result = await airbrushingNfseService.getAirbrushingNfseXml(airbrushingId);
      const xml = result?.data?.xml;
      if (!xml) {
        toast.error("XML indisponível para esta nota.");
        return;
      }
      const accessKey = result?.data?.accessKey || nfse?.accessKey || airbrushingId;
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nfse-${accessKey}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * A rota responde 200 com `success: false` quando a emissão falha ou é ignorada — o
   * interceptor global não toasta nesses casos, então o desfecho é anunciado aqui, com a
   * mensagem que o próprio servidor formatou.
   */
  const handleEmit = async () => {
    setEmitConfirmOpen(false);
    try {
      const result = await emitMutation.mutateAsync({ airbrushingId });
      const message = result?.message || (result?.data?.status === "AUTHORIZED" ? "NFS-e emitida." : "Emissão solicitada.");
      if (result?.success === false) toast.error(message);
      else toast.success(message);
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    }
  };

  const handleCancel = async () => {
    if (reasonTooShort) {
      toast.error(`A justificativa deve ter no mínimo ${MIN_CANCEL_REASON_LENGTH} caracteres.`);
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        airbrushingId,
        data: { reasonCode: Number(cancelReasonCode), reason: cancelReason.trim() },
      });
      // Cancelamento recusado também volta 200 — a recusa fica em `data.cancelled`.
      if (result?.data?.cancelled === false) {
        toast.error(result.data.message || result.message || "Não foi possível cancelar a NFS-e.");
        return;
      }
      toast.success(result?.message || "NFS-e cancelada.");
      setCancelOpen(false);
      setCancelReason("");
      setCancelReasonCode(String(NFSE_CANCEL_REASON.EMISSION_ERROR));
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
    );
  }

  // Estado vazio: explica POR QUE não há nota em vez de só dizer "nenhuma nota".
  if (!nfse) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 px-4 py-8 text-center">
          <IconFileInvoice className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma NFS-e emitida</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A nota é emitida automaticamente quando a aerografia é concluída, desde que o pintor tenha identidade fiscal cadastrada, certificado A1 válido e emissão automática ligada.
            </p>
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEmitConfirmOpen(true)} disabled={emitMutation.isPending}>
              <IconRefresh className="mr-2 h-4 w-4" />
              Emitir agora
            </Button>
          )}
        </div>

        <AlertDialog open={emitConfirmOpen} onOpenChange={setEmitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Emitir NFS-e</AlertDialogTitle>
              <AlertDialogDescription>
                A nota será emitida em nome do pintor (prestador), assinada com o certificado A1 dele. Confirmar a emissão?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleEmit}>Emitir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Produção Restrita não é nota de verdade — o aviso vem antes de qualquer dado. */}
        {isRestricted && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-500">
              Emitida em <strong>Produção Restrita</strong>: esta nota é de teste e <strong>não tem valor fiscal</strong>.
            </p>
          </div>
        )}

        {/* ── Identificação: o que a nota É ────────────────────────────────── */}
        <SubBlock title="Identificação">
          <Row label="Número / Série" value={nfse.nfseNumber ? `${nfse.nfseNumber}${nfse.serie ? ` / ${nfse.serie}` : ""}` : null} />
          <Row
            label="Chave de Acesso"
            value={
              nfse.accessKey ? (
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="break-all font-mono text-xs">{nfse.accessKey}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" onClick={handleCopyAccessKey} title="Copiar chave de acesso">
                    <IconCopy className="h-3.5 w-3.5" />
                  </Button>
                </span>
              ) : null
            }
          />
          <Row label="Data de Emissão" value={nfse.issuedAt ? formatDateTime(nfse.issuedAt) : null} />
          <Row label="Competência" value={nfse.competence ? formatDate(nfse.competence) : null} />
          {nfse.cancelledAt && <Row label="Cancelada em" value={formatDateTime(nfse.cancelledAt)} />}
          {nfse.cancelReason && <Row label="Motivo do Cancelamento" value={nfse.cancelReason} />}
        </SubBlock>

        {/* ── Valores e partes: quanto, e para quem ────────────────────────── */}
        <SubBlock title="Valores e partes">
          <Row label="Valor do Serviço" value={nfse.serviceAmount != null ? formatCurrency(nfse.serviceAmount) : null} />
          <Row label="Prestador" value={providerLabel} />
          {nfse.painter?.name && <Row label="Pintor" value={nfse.painter.name} />}
        </SubBlock>

        {/* ── Documentos da nota: DANFSe e XML JUNTOS ──────────────────────── */}
        {/* As duas linhas são o MESMO componente (DocumentRow): baixar/visualizar estão
            sempre dentro do card, nunca ao lado dele. Estes botões são o ÚNICO caminho
            de download da nota — a barra de ações abaixo cuida só do que não é download. */}
        <SubBlock title="Documentos da nota">
          <div className="space-y-2 py-1">
            {pdfFile || nfse.pdfFileId ? (
              <DocumentRow
                icon={IconFileInvoice}
                title="DANFSe (PDF)"
                // Com o File no include dá para mostrar nome e tamanho reais; sem ele,
                // só sabemos que o arquivo foi gerado pelo sistema.
                subtitle={pdfFile ? `${pdfFile.filename} · ${formatFileSize(pdfFile.size ?? 0)}` : "Gerado pelo sistema"}
                actions={
                  <>
                    {pdfFile && (
                      <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={handleViewPdf} title="Visualizar DANFSe">
                        <IconEye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={handleDownloadPdf} title="Baixar DANFSe">
                      <IconDownload className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ) : (
              <DocumentRow icon={IconFileInvoice} title="DANFSe (PDF)" subtitle="Não arquivado para esta nota — pode estar entre as notas anexadas." />
            )}

            {hasXml ? (
              <DocumentRow
                icon={IconFileTypeXml}
                title="XML autorizado"
                subtitle={`nfse-${nfse.accessKey}.xml`}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={handleDownloadXml}
                    disabled={isDownloading}
                    title={isDownloading ? "Baixando XML..." : "Baixar XML"}
                  >
                    <IconDownload className="h-4 w-4" />
                  </Button>
                }
              />
            ) : (
              <DocumentRow icon={IconFileTypeXml} title="XML autorizado" subtitle="Disponível somente após a autorização da nota." />
            )}
          </div>
        </SubBlock>

        {/* Falha na emissão: mensagem + quantas tentativas já foram feitas. */}
        {nfse.status === NFSE_STATUS.ERROR && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
            <p className="text-xs font-medium text-destructive">
              Falha na emissão{nfse.errorCount > 0 ? ` (${nfse.errorCount} ${nfse.errorCount === 1 ? "tentativa" : "tentativas"})` : ""}
            </p>
            <p className="mt-0.5 text-xs text-destructive/90">{nfse.errorMessage || "Erro não informado pelo servidor."}</p>
          </div>
        )}

        {/* Barra de ações: SÓ o que muda a nota. Baixar XML e ver/baixar DANFSe saíram
            daqui — repetiam, com outro rótulo, os botões que já vivem em cada card de
            documento acima. Cancelar é destrutivo e irreversível: vem em vermelho. */}
        {/* Sem download, a barra só existe para quem administra a nota — para os demais
            (comercial, que VÊ mas não emite) não sobra ação nenhuma e ela não é montada. */}
        {canManage && (isReemittable || isCancellable) && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {/* Reemitir em verde: é a ação construtiva da barra — gera documento
                fiscal novo — em oposição visual clara ao Cancelar, destrutivo. */}
            {isReemittable && (
              <Button
                size="sm"
                onClick={() => setEmitConfirmOpen(true)}
                disabled={emitMutation.isPending}
                className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
              >
                <IconRefresh className="mr-2 h-4 w-4" />
                Reemitir
              </Button>
            )}
            {isCancellable && (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)} disabled={cancelMutation.isPending}>
                <IconX className="mr-2 h-4 w-4" />
                Cancelar NFS-e
              </Button>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={emitConfirmOpen} onOpenChange={setEmitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemitir NFS-e</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova emissão será solicitada em nome do pintor (prestador), assinada com o certificado A1 dele. Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmit}>Reemitir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NFS-e</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento da NFS-e{nfse.nfseNumber ? ` nº ${nfse.nfseNumber}` : ""}. A solicitação é enviada à SEFIN nacional.
            </DialogDescription>
          </DialogHeader>
          {/* O cancelamento é um ato fiscal definitivo — o aviso vem ANTES do formulário,
              porque depois de aceito pela SEFIN não existe "desfazer". */}
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Esta ação é <strong>irreversível</strong>: uma nota cancelada não volta atrás. Para corrigir os dados será preciso emitir uma nova NFS-e.
            </p>
          </div>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Motivo</label>
              <Combobox
                value={cancelReasonCode}
                onValueChange={(v) => setCancelReasonCode(typeof v === "string" ? v : String(NFSE_CANCEL_REASON.EMISSION_ERROR))}
                options={CANCEL_REASON_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Justificativa <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                maxLength={255}
                placeholder="Descreva o motivo do cancelamento..."
                aria-invalid={reasonTooShort}
              />
              <p className={reasonTooShort ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
                Mínimo de {MIN_CANCEL_REASON_LENGTH} caracteres ({cancelReason.trim().length}/{MIN_CANCEL_REASON_LENGTH}).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending || reasonTooShort}>
              {cancelMutation.isPending ? "Enviando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
