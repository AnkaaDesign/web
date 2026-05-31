import { useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconCash,
  IconEye,
  IconLink,
  IconLinkOff,
  IconBan,
} from "@tabler/icons-react";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { CategoryChips, MatchStatusBadge } from "./match-status-badge";
import { routes } from "@/constants";
import {
  formatAccountNumber,
  formatCNPJ,
  formatCnpjCpf,
  formatCurrency,
  formatDate,
} from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

interface Props {
  data: BankTransaction[];
  isLoading?: boolean;
  totalPages?: number;
  totalRecords?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  /** Shows the bank account column (bank + agency/account). Off by default
   *  for compact lists; on for the global transactions view. */
  showAccountColumn?: boolean;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onSelectionChange?: (id: string) => void;
  allSelected?: boolean;
  partiallySelected?: boolean;
  onSelectAll?: () => void;
  onMatch?: (tx: BankTransaction) => void;
  onUnmatch?: (tx: BankTransaction) => void;
  onIgnore?: (tx: BankTransaction) => void;
  onViewDetails?: (tx: BankTransaction) => void;
}

export function BankTransactionTable({
  data,
  isLoading,
  totalPages,
  totalRecords,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyMessage = "Nenhuma transação encontrada",
  emptyIcon = IconCash,
  showAccountColumn = false,
  selectable,
  isSelected,
  onSelectionChange,
  allSelected,
  partiallySelected,
  onSelectAll,
  onMatch,
  onUnmatch,
  onIgnore,
  onViewDetails,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tx: BankTransaction;
  } | null>(null);

  const closeContextMenu = () => setContextMenu(null);

  const columns: StandardizedColumn<BankTransaction>[] = [
    {
      key: "postedAt",
      header: "Data",
      sortable: true,
      width: "92px",
      render: t => <span className="whitespace-nowrap text-sm">{formatDate(t.postedAt)}</span>,
    },
    ...(showAccountColumn
      ? ([
          {
            key: "account",
            header: "Conta",
            width: "200px",
            render: t => (
              <span className="text-sm whitespace-nowrap truncate block">
                {t.bankName}
                {t.agency ? ` · Ag ${t.agency}` : ""}
                {t.accountNumber ? ` / ${formatAccountNumber(t.accountNumber)}` : ""}
              </span>
            ),
          },
        ] as StandardizedColumn<BankTransaction>[])
      : []),
    {
      key: "type",
      header: "Tipo",
      width: "80px",
      render: t => (
        <Badge variant={t.type === "CREDIT" ? "completed" : "cancelled"} size="sm">
          {t.type === "CREDIT" ? "Crédito" : "Débito"}
        </Badge>
      ),
    },
    {
      key: "subtype",
      header: "Forma",
      width: "84px",
      render: t => <span className="text-xs text-muted-foreground">{t.subtype}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      sortable: true,
      width: "110px",
      render: t => (
        <span
          className={`font-semibold tabular-nums whitespace-nowrap text-sm ${
            t.type === "CREDIT" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {formatCurrency(t.amount)}
        </span>
      ),
    },
    {
      key: "counterparty",
      header: "Contraparte / Descrição",
      render: t => (
        <span className="block truncate text-sm">
          {t.counterpartyName ||
            (t.counterpartyCnpjCpf ? formatCnpjCpf(t.counterpartyCnpjCpf) : t.memo || "—")}
        </span>
      ),
    },
    {
      key: "linkedNf",
      header: "NF vinculada",
      width: "180px",
      render: t => {
        const firstDoc = t.matches?.find(m => m.fiscalDocument)?.fiscalDocument;
        const extraCount = (t.matches?.filter(m => m.fiscalDocument).length ?? 0) - 1;
        if (!firstDoc?.id) {
          // No linked fiscal doc — plain dash. Category tags live in the
          // dedicated "Categoria" column, never leaking into this NF column.
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        const emitDisplay = firstDoc.emitName
          ? firstDoc.emitName
          : firstDoc.emitCnpj
            ? formatCNPJ(firstDoc.emitCnpj)
            : "NF";
        return (
          <Link
            to={`${routes.financial.reconciliation.fiscalDocuments}?nfId=${firstDoc.id}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[12rem] truncate"
            title={emitDisplay}
          >
            <span className="truncate">{emitDisplay}</span>
            {extraCount > 0 && (
              <span className="text-muted-foreground">(+{extraCount})</span>
            )}
            <IconArrowUpRight className="h-3 w-3 flex-shrink-0" />
          </Link>
        );
      },
    },
    {
      key: "category",
      header: "Categoria",
      width: "220px",
      render: t => <CategoryChips categories={t.categories} />,
    },
    {
      key: "reconciliationStatus",
      header: "Status",
      width: "120px",
      className: "whitespace-nowrap",
      render: t => <MatchStatusBadge status={t.reconciliationStatus} />,
    },
  ];

  const ctxTx = contextMenu?.tx;
  const ctxHasMatches = (ctxTx?.matches?.length ?? 0) > 0;

  return (
    <>
      <StandardizedTable
        columns={columns}
        data={data}
        getItemKey={t => t.id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon={emptyIcon}
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        isSelected={selectable ? isSelected : undefined}
        onSelectionChange={selectable ? onSelectionChange : undefined}
        onSelectAll={selectable ? onSelectAll : undefined}
        allSelected={allSelected}
        partiallySelected={partiallySelected}
        onRowClick={onViewDetails}
        onContextMenu={(e, tx) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, tx });
        }}
      />

      {contextMenu && ctxTx && (
        <DropdownMenu open onOpenChange={open => !open && closeContextMenu()}>
          <PositionedDropdownMenuContent
            position={contextMenu}
            isOpen
            className="w-56"
            onCloseAutoFocus={e => e.preventDefault()}
          >
            {onViewDetails && (
              <DropdownMenuItem
                onClick={() => {
                  onViewDetails(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconEye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
            )}
            {onMatch && !(ctxTx.reconciliationStatus === "RECONCILED" && ctxTx.reconciliationSource === "MANUAL") && (
              <DropdownMenuItem
                onClick={() => {
                  onMatch(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconLink className="h-4 w-4 mr-2" />
                Conciliar manualmente
              </DropdownMenuItem>
            )}
            {onUnmatch && ctxHasMatches && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onUnmatch(ctxTx);
                    closeContextMenu();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <IconLinkOff className="h-4 w-4 mr-2" />
                  Desfazer conciliação
                </DropdownMenuItem>
              </>
            )}
            {onIgnore && ctxTx.reconciliationStatus !== "IGNORED" && (
              <DropdownMenuItem
                onClick={() => {
                  onIgnore(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconBan className="h-4 w-4 mr-2" />
                Ignorar
              </DropdownMenuItem>
            )}
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
