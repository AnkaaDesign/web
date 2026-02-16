import React from "react";
import { useBorrowsInfinite } from "../../../../hooks";
import type { Borrow } from "../../../../types";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BorrowStatusBadge } from "../common/borrow-status-badge";
import { BorrowActionsDropdown } from "../common/borrow-actions-dropdown";
import { BorrowEmptyState } from "./borrow-empty-state";
import { formatDate } from "../../../../utils";
import { IconUser, IconPackage, IconCalendar, IconClock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface BorrowListMobileProps {
  onEdit: (borrow: Borrow) => void;
  onDelete: (borrow: Borrow) => void;
  filters: Partial<BorrowGetManyFormData>;
  className?: string;
  onDataChange?: (data: { items: Borrow[]; totalRecords: number }) => void;
}

export function BorrowListMobile({ onEdit, onDelete, filters, className, onDataChange }: BorrowListMobileProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useBorrowsInfinite({
    ...filters,
    include: {
      item: true,
      user: true,
    },
  });

  // Flatten paginated data
  const borrows = React.useMemo(() => {
    const items = data?.pages?.flatMap((page) => page.data || []) || [];
    const totalRecords = data?.pages?.[0]?.meta?.totalRecords || 0;

    // Call onDataChange when data changes
    if (onDataChange && items.length > 0) {
      onDataChange({ items, totalRecords });
    }

    return items;
  }, [data, onDataChange]);

  // Handle scroll to load more
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const scrollPercentage = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;

      if (scrollPercentage > 80 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (borrows.length === 0) {
    return (
      <div className={className}>
        <BorrowEmptyState />
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)} onScroll={handleScroll}>
      <div className="space-y-3 p-4 pb-20">
        {borrows.map((borrow) => (
          <BorrowCard key={borrow.id} borrow={borrow} onEdit={() => onEdit(borrow)} onDelete={() => onDelete(borrow)} />
        ))}

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando mais...
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

interface BorrowCardProps {
  borrow: Borrow;
  onEdit: () => void;
  onDelete: () => void;
}

function BorrowCard({ borrow, onEdit, onDelete }: BorrowCardProps) {
  const isOverdue = false;

  return (
    <Card className={cn("transition-all hover:shadow-sm", isOverdue && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            {/* Item info */}
            <div>
              <h3 className="font-semibold text-base line-clamp-1">{borrow.item?.name || "Item desconhecido"}</h3>
              {borrow.item?.uniCode && <p className="text-sm text-muted-foreground">Código: {borrow.item.uniCode}</p>}
            </div>

            {/* User info */}
            <div className="flex items-center gap-2 text-sm">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{borrow.user?.name || "Usuário desconhecido"}</span>
            </div>

            {/* Quantity and dates */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <IconPackage className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{borrow.quantity} un.</span>
              </div>

              <div className="flex items-center gap-1.5">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{formatDate(borrow.createdAt)}</span>
              </div>

              {borrow.returnedAt && (
                <div className="flex items-center gap-1.5">
                  <IconClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Devolvido: {formatDate(borrow.returnedAt)}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <BorrowStatusBadge status={borrow.status} isOverdue={isOverdue} />
            </div>
          </div>

          {/* Actions */}
          <BorrowActionsDropdown borrow={borrow} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </CardContent>
    </Card>
  );
}
