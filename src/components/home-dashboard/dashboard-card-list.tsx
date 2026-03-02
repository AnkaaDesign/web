import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

interface DashboardCardListProps {
  title: string;
  icon: ReactNode;
  viewAllLink?: string;
  emptyMessage: string;
  children?: ReactNode;
  isEmpty?: boolean;
  footer?: ReactNode;
}

export function DashboardCardList({
  title,
  icon,
  viewAllLink,
  emptyMessage,
  children,
  isEmpty,
  footer,
}: DashboardCardListProps) {
  return (
    <div className="space-y-2">
      {/* Section header — outside the card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold text-secondary-foreground">{title}</h3>
        </div>
        {viewAllLink && (
          <Link to={viewAllLink} className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      {/* Card body — fixed height for 7 rows */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="h-[284px] overflow-y-auto">
          {isEmpty ? (
            <p className="text-muted-foreground text-sm py-6 text-center">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}

/** Compact inline pagination for dashboard tables */
interface DashboardPaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function DashboardPagination({ totalItems, page, pageSize, onPageChange }: DashboardPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const start = totalItems > 0 ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border text-xs text-muted-foreground">
      <span className="whitespace-nowrap">{start}–{end} de {totalItems}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>
        <span className="tabular-nums">{page + 1}/{totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
