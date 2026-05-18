import { Link } from "react-router-dom";
import { IconReceipt, IconCopy, IconLink } from "@tabler/icons-react";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/constants";
import { formatCNPJ, formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import { useToast } from "@/hooks/common/use-toast";
import type { FiscalDocument } from "@/types/reconciliation";

const DOC_TYPE_LABEL: Record<string, string> = {
  NFE: "NF-e",
  NFSE: "NFS-e",
  CTE: "CT-e",
  NFCE: "NFC-e",
  CFE: "CF-e",
};

interface Props {
  data: FiscalDocument[];
  isLoading?: boolean;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalRecords?: number;
  onPageChange?: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  onRowClick?: (doc: FiscalDocument) => void;
}

export function FiscalDocumentTable({
  data,
  isLoading,
  page,
  pageSize,
  totalPages,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  onRowClick,
}: Props) {
  const { toast } = useToast();
  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: "Chave copiada", variant: "success" });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente a chave de acesso.",
        variant: "error",
      });
    }
  };
  const columns: StandardizedColumn<FiscalDocument>[] = [
    {
      key: "docType",
      header: "Tipo",
      render: d => <Badge size="sm" variant="inProgress">{DOC_TYPE_LABEL[d.docType] || d.docType}</Badge>,
    },
    {
      key: "operationType",
      header: "Operação",
      render: d => (
        <Badge
          size="sm"
          variant={d.operationType === "ENTRADA" ? "completed" : "cancelled"}
        >
          {d.operationType === "ENTRADA" ? "Entrada" : "Saída"}
        </Badge>
      ),
    },
    {
      key: "issueDate",
      header: "Emissão",
      sortable: true,
      render: d => <span className="whitespace-nowrap">{formatDate(d.issueDate)}</span>,
    },
    {
      key: "accessKey",
      header: "Chave",
      render: d => (
        <button
          type="button"
          aria-label="Copiar chave de acesso"
          onClick={e => {
            e.stopPropagation();
            handleCopyKey(d.accessKey);
          }}
          className="font-mono text-sm font-medium flex items-center gap-1.5 hover:underline"
          title={d.accessKey}
        >
          …{d.accessKey.slice(-14)}
          <IconCopy className="h-3.5 w-3.5" />
        </button>
      ),
    },
    {
      key: "emitter",
      header: "Emitente",
      render: d => {
        const formattedCnpj = d.emitCnpj ? formatCNPJ(d.emitCnpj) : "";
        return (
          <span
            className="block max-w-xs truncate"
            title={`${d.emitName ?? "—"} (${formattedCnpj})`}
          >
            {d.emitName || formattedCnpj || "—"}
          </span>
        );
      },
    },
    {
      key: "destinatario",
      header: "Destinatário",
      render: d => (
        <span className="block max-w-xs truncate">
          {d.destName ||
            (d.destCnpj
              ? formatCNPJ(d.destCnpj)
              : d.destCpf
                ? formatCnpjCpf(d.destCpf)
                : "—")}
        </span>
      ),
    },
    {
      key: "totalValue",
      header: "Valor",
      sortable: true,
      align: "right",
      render: d => (
        <span className="font-semibold tabular-nums">{formatCurrency(d.totalValue)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: d => (
        <Badge size="sm" variant={d.status === "AUTHORIZED" ? "completed" : "cancelled"}>
          {d.status === "AUTHORIZED" ? "Autorizada" : d.status === "CANCELLED" ? "Cancelada" : d.status}
        </Badge>
      ),
    },
    {
      key: "linked",
      header: "Vinculada",
      align: "center",
      render: d => {
        const matches = d.matches ?? [];
        const count = matches.length;
        if (count === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        // Single match → fast-path link to the tx. Multi-match → fall through
        // to the row click which opens the NF modal where the user picks one.
        const onlyTxId = count === 1 ? matches[0].transaction?.id : null;
        const badge = (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-500/30 px-2.5 py-1 text-xs font-semibold"
            title={`${count} ${count === 1 ? "transação vinculada" : "transações vinculadas"}`}
          >
            <IconLink className="h-3.5 w-3.5" />
            {count === 1 ? "1 transação" : `${count} transações`}
          </span>
        );
        if (onlyTxId) {
          return (
            <Link
              to={`${routes.financial.reconciliation.transactions}?txId=${onlyTxId}`}
              onClick={e => e.stopPropagation()}
              className="hover:opacity-80 transition-opacity"
            >
              {badge}
            </Link>
          );
        }
        return badge;
      },
    },
  ];

  return (
    <StandardizedTable
      columns={columns}
      data={data}
      getItemKey={d => d.id}
      isLoading={isLoading}
      emptyMessage="Nenhuma nota fiscal encontrada. Importe XMLs ou execute uma sincronização SIEG."
      emptyIcon={IconReceipt}
      currentPage={page}
      pageSize={pageSize}
      totalPages={totalPages}
      totalRecords={totalRecords}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onRowClick={onRowClick}
    />
  );
}
