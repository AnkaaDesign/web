import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowStatusBadge } from "@/components/inventory/borrow/common/borrow-status-badge";
import { IconInfoCircle, IconUser, IconCalendar, IconCalendarCheck, IconBriefcase, IconBuilding, IconHash } from "@tabler/icons-react";
import type { Borrow } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { BORROW_STATUS } from "../../../../constants";

interface BorrowSpecificationsCardProps {
  borrow: Borrow;
  className?: string;
}

export function BorrowSpecificationsCard({ borrow, className }: BorrowSpecificationsCardProps) {
  const isReturned = borrow.status === BORROW_STATUS.RETURNED;
  const isLost = borrow.status === BORROW_STATUS.LOST;
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Especificações do Empréstimo
        </CardTitle>
          <BorrowStatusBadge status={borrow.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* User Information Section */}
          {borrow.user && (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Usuário</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUser className="h-4 w-4" />
                    Usuário
                  </span>
                  <span className="text-sm font-semibold text-foreground">{borrow.user.name}</span>
                </div>
                {borrow.user.position && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBriefcase className="h-4 w-4" />
                      Cargo
                    </span>
                    <span className="text-sm font-semibold text-foreground">{borrow.user.position.name}</span>
                  </div>
                )}
                {borrow.user.sector && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Setor
                    </span>
                    <span className="text-sm font-semibold text-foreground">{borrow.user.sector.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Borrow Details Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes do Empréstimo</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  Quantidade Emprestada
                </span>
                <span className="text-sm font-semibold text-foreground">{borrow.quantity}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data do Empréstimo
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(borrow.createdAt)}</span>
              </div>

              {isReturned && borrow.returnedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarCheck className="h-4 w-4" />
                    Data de Devolução
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDateTime(borrow.returnedAt)}</span>
                </div>
              )}

              {isLost && (
                <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-900/20 rounded-lg px-4 py-3 border border-red-200/40 dark:border-red-700/40">
                  <span className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                    <IconCalendarCheck className="h-4 w-4" />
                    Status
                  </span>
                  <span className="text-sm font-semibold text-red-800 dark:text-red-200">Item marcado como perdido</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
