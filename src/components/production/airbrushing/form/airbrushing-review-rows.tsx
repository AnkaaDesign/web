import { useEffect, useState, type ReactNode } from "react";
import {
  IconBrush,
  IconFileDescription,
  IconSpray,
  IconCreditCard,
  IconCalendar,
  IconCalendarDue,
  IconClock,
  IconCurrencyReal,
  IconCashBanknote,
  IconPaperclip,
  IconFileInvoice,
  IconPhoto,
  IconFileTypePdf,
} from "@tabler/icons-react";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_DUE_DATE_RULE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../../../constants";
import type { File as AnkaaFile } from "../../../../types";
import { AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS, resolveAirbrushingDueDate } from "@/utils/airbrushing";
import { formatCurrency } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import { generatePDFThumbnailFromBlob } from "@/utils/pdf-thumbnail";
import { FileItem } from "@/components/common/file";
import type { AirbrushingFieldValues } from "./airbrushing-fields";

export interface AirbrushingReviewRow {
  key: string;
  label: string;
  icon: ReactNode;
  value: string;
  /** Destaca o valor (usado no preço). */
  emphasis?: boolean;
}

export interface AirbrushingReviewOptions {
  canViewFinancials?: boolean;
  /** Nome do pintor já resolvido (as linhas guardam apenas o `painterId`). */
  painterName?: string | null;
  /** Quantos recibos/notas fiscais já existem — o formulário não os anexa, só os menciona. */
  receiptCount?: number;
  invoiceCount?: number;
}

/**
 * A revisão em TRÊS seções. `tarefa` não mora aqui (é a tarefa selecionada, que já tem
 * componente próprio) — esta definição cobre as duas seções que descrevem a aerografia.
 */
export interface AirbrushingReviewSections {
  /** Pintor, descrição, status, datas previstas E reais. O bloco de Layout entra ao lado destas. */
  aerografia: AirbrushingReviewRow[];
  /** Valor, status/forma de pagamento, regra e vencimento (+ menção a recibos/NFs). */
  pagamento: AirbrushingReviewRow[];
}

const dash = (value: string | null | undefined): string => (value && String(value).trim() ? String(value) : "-");
const dateOr = (value: Date | string | null | undefined): string => (value ? formatDate(new Date(value)) : "-");
const dateTimeOr = (value: Date | string | null | undefined): string => (value ? formatDateTime(new Date(value)) : "-");

/**
 * ÚNICA definição da revisão de uma aerografia — create e edit consomem estas seções, na mesma
 * ordem em que `AirbrushingFields` desenha os campos. Campo novo no formulário = campo novo
 * aqui, e em nenhum outro lugar.
 */
export function buildAirbrushingReviewSections(
  a: AirbrushingFieldValues,
  { canViewFinancials = true, painterName, receiptCount = 0, invoiceCount = 0 }: AirbrushingReviewOptions = {},
): AirbrushingReviewSections {
  const status = (a.status as AIRBRUSHING_STATUS) ?? AIRBRUSHING_STATUS.PREPARATION;
  const paymentStatus = (a.paymentStatus as AIRBRUSHING_PAYMENT_STATUS) ?? AIRBRUSHING_PAYMENT_STATUS.PENDING;
  const dueDateRule = (a.dueDateRule as AIRBRUSHING_DUE_DATE_RULE) ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;

  // Seção 2 — o serviço. Previsto E real sempre aparecem: uma linha "-" diz que a aerografia
  // ainda não começou, e sumir com ela faria a revisão mudar de tamanho a cada etapa.
  const aerografia: AirbrushingReviewRow[] = [
    { key: "painter", label: "Pintor", icon: <IconBrush className="h-4 w-4" />, value: dash(painterName) },
    { key: "description", label: "Descrição", icon: <IconFileDescription className="h-4 w-4" />, value: dash(a.description) },
    { key: "status", label: "Status", icon: <IconSpray className="h-4 w-4" />, value: AIRBRUSHING_STATUS_LABELS[status] || "-" },
    { key: "startDate", label: "Início Previsto", icon: <IconCalendar className="h-4 w-4" />, value: dateOr(a.startDate) },
    { key: "finishDate", label: "Término Previsto", icon: <IconCalendar className="h-4 w-4" />, value: dateOr(a.finishDate) },
    { key: "startedAt", label: "Iniciado em", icon: <IconClock className="h-4 w-4" />, value: dateTimeOr(a.startedAt) },
    { key: "finishedAt", label: "Finalizado em", icon: <IconClock className="h-4 w-4" />, value: dateTimeOr(a.finishedAt) },
  ];

  // Seção 3 — dinheiro. Some inteira para quem não pode ver valores.
  const pagamento: AirbrushingReviewRow[] = [];
  if (canViewFinancials) {
    pagamento.push(
      {
        key: "price",
        label: "Valor do Serviço",
        icon: <IconCurrencyReal className="h-4 w-4" />,
        value: a.price != null ? formatCurrency(Number(a.price)) : "-",
        emphasis: true,
      },
      {
        key: "paymentStatus",
        label: "Status do Pagamento",
        icon: <IconCreditCard className="h-4 w-4" />,
        value: AIRBRUSHING_PAYMENT_STATUS_LABELS[paymentStatus] || "-",
      },
      {
        key: "paymentMethod",
        label: "Forma de Pagamento",
        icon: <IconCashBanknote className="h-4 w-4" />,
        value: a.paymentMethod ? PAYMENT_METHOD_LABELS[a.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] || a.paymentMethod : "-",
      },
      {
        key: "dueDateRule",
        label: "Regra de Vencimento",
        icon: <IconCalendarDue className="h-4 w-4" />,
        value: AIRBRUSHING_DUE_DATE_RULE_LABELS[dueDateRule] || "-",
      },
    );

    // O campo que a regra escolhida consome.
    if (dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH) {
      const days = a.paymentTermDays ?? AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS;
      pagamento.push({
        key: "paymentTermDays",
        label: "Prazo após o Término",
        icon: <IconCalendarDue className="h-4 w-4" />,
        value: `${days} ${days === 1 ? "dia" : "dias"}${a.paymentTermDays == null ? " (padrão)" : ""}`,
      });
    } else if (dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH) {
      pagamento.push({
        key: "dueDayOfMonth",
        label: "Dia do Vencimento",
        icon: <IconCalendarDue className="h-4 w-4" />,
        value: a.dueDayOfMonth != null ? `Dia ${a.dueDayOfMonth}` : "-",
      });
    } else {
      pagamento.push({
        key: "dueDate",
        label: "Data de Vencimento",
        icon: <IconCalendarDue className="h-4 w-4" />,
        value: dateOr(a.dueDate),
      });
    }

    // Prévia do que o servidor vai materializar em Contas a Pagar.
    if (dueDateRule !== AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE) {
      const preview = resolveAirbrushingDueDate(
        { dueDateRule, paymentTermDays: a.paymentTermDays, dueDayOfMonth: a.dueDayOfMonth, dueDate: a.dueDate },
        a.finishedAt ?? a.finishDate,
      );
      pagamento.push({
        key: "previewDueDate",
        label: "Vencimento Previsto",
        icon: <IconCalendarDue className="h-4 w-4" />,
        value: preview ? formatDate(preview) : "Sem vencimento",
      });
    }

    // Recibos e notas fiscais não são anexados por este formulário (o recibo vem de Contas a
    // Pagar, a NF é gerada com a NFS-e) — só aparecem quando já existe algo a mencionar.
    if (receiptCount > 0) {
      pagamento.push({
        key: "receipts",
        label: "Recibos",
        icon: <IconPaperclip className="h-4 w-4" />,
        value: `${receiptCount} ${receiptCount === 1 ? "anexo" : "anexos"}`,
      });
    }
    if (invoiceCount > 0) {
      pagamento.push({
        key: "invoices",
        label: "Notas Fiscais",
        icon: <IconFileInvoice className="h-4 w-4" />,
        value: `${invoiceCount} ${invoiceCount === 1 ? "anexo" : "anexos"}`,
      });
    }
  }

  return { aerografia, pagamento };
}

/** Renderizador das linhas de revisão — mesma pílula usada nas demais revisões do sistema. */
export function AirbrushingReviewRows({ rows }: { rows: AirbrushingReviewRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 min-h-11 py-2 gap-3">
          <span className="text-sm text-muted-foreground flex items-center gap-2 flex-shrink-0">
            {row.icon}
            {row.label}
          </span>
          <span className={`text-sm font-semibold truncate text-right min-w-0 ${row.emphasis ? "text-primary" : "text-foreground"}`} title={row.value}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

AirbrushingReviewRows.displayName = "AirbrushingReviewRows";

// ---------------------------------------------------------------------------
// Layouts da revisão — a IMAGEM/PDF em si, não a contagem nem o nome.
// ---------------------------------------------------------------------------

/**
 * Um layout já enviado (existe no servidor) usa o `FileItem` em modo grade: mesma miniatura,
 * mesmo menu de contexto e mesmo clique-para-visualizar do resto do sistema.
 */
const uploadedLayoutFile = (file: any): AnkaaFile =>
  ({
    id: file?.uploadedFileId || file?.id,
    filename: file?.filename || file?.name || "layout",
    originalName: file?.originalName || file?.filename || file?.name || "layout",
    mimetype: file?.mimetype || file?.type || "application/octet-stream",
    size: file?.size ?? 0,
    path: file?.path ?? "",
    thumbnailUrl: file?.thumbnailUrl,
    createdAt: file?.createdAt ?? new Date(),
    updatedAt: file?.updatedAt ?? new Date(),
  }) as AnkaaFile;

/**
 * Um layout ACABADO DE ESCOLHER ainda não tem id nem miniatura no servidor, então a prévia é
 * feita no cliente: imagem por object URL, PDF pelo pdfjs (o mesmo `generatePDFThumbnailFromBlob`
 * do cartão do seletor de arquivos). Fora esses dois casos, sobra o ícone do tipo.
 */
const LocalLayoutPreview = ({ file }: { file: File }) => {
  const name = file.name || "layout";
  const isImage = (file.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    if (isImage) {
      objUrl = URL.createObjectURL(file);
      setThumb(objUrl);
    } else if (isPdf) {
      generatePDFThumbnailFromBlob(file).then((url) => {
        if (!cancelled) setThumb(url);
      });
    }
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [file, isImage, isPdf]);

  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border overflow-hidden" title={name}>
      <div className="flex items-center justify-center bg-muted/30" style={{ height: "8rem" }}>
        {thumb ? (
          <img src={thumb} alt={name} className="w-full h-full object-contain" />
        ) : isPdf ? (
          <IconFileTypePdf className="h-8 w-8 text-red-500" />
        ) : (
          <IconPhoto className="h-8 w-8 text-blue-500" />
        )}
      </div>
    </div>
  );
};

/** Grade de layouts da revisão — a mesma nos dois modos (cadastro e edição). */
export function AirbrushingLayoutPreviews({ files }: { files: any[] }) {
  const layouts = files ?? [];
  return (
    <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        <IconPhoto className="h-4 w-4" />
        Layouts
      </span>
      {layouts.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {layouts.map((f, index) => {
            const key = (f?.uploadedFileId || f?.id || f?.name || index) as string | number;
            // Ler a flag ANTES do instanceof: o narrowing para o `File` do DOM apaga `uploaded`.
            const isUploaded = Boolean(f?.uploaded || f?.uploadedFileId);
            if (!isUploaded && f instanceof File) return <LocalLayoutPreview key={key} file={f} />;
            return <FileItem key={key} file={uploadedLayoutFile(f)} viewMode="grid" showFilename={false} showFileSize={false} />;
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum layout</p>
      )}
    </div>
  );
}

AirbrushingLayoutPreviews.displayName = "AirbrushingLayoutPreviews";
