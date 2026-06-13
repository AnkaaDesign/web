import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconUser, IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes, CONTRACT_TYPE_LABELS } from "../../../../constants";
import type { CONTRACT_TYPE } from "../../../../constants";
import { formatCPF, formatDate, formatDateTime } from "../../../../utils";
import type { Admission } from "../../../../types/admission";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";

interface UserCardProps {
  admission: Admission;
  className?: string;
}

export function UserCard({ admission, className }: UserCardProps) {
  const user = admission.user;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Colaborador
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Colaborador não encontrado.</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium truncate" title={user.name}>
                {user.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-medium">{user.cpf ? formatCPF(user.cpf) : "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Nº Folha</span>
              <span className="font-medium">{user.payrollNumber || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cargo</span>
              <span className="font-medium truncate">{user.position?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Setor</span>
              <span className="font-medium truncate">{user.sector?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tipo de Contrato</span>
              {user.currentContractType ? (
                <Badge variant={getBadgeVariantFromStatus(user.currentContractType, "USER")} className="text-xs whitespace-nowrap">
                  {CONTRACT_TYPE_LABELS[user.currentContractType as CONTRACT_TYPE] || user.currentContractType}
                </Badge>
              ) : (
                <span className="font-medium">-</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Data de Admissão</span>
              <span className="font-medium">{admission.hireDate ? formatDate(new Date(admission.hireDate)) : "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Criado por</span>
              <span className="font-medium truncate">{admission.createdBy?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Criado em</span>
              <span className="font-medium">{admission.createdAt ? formatDateTime(new Date(admission.createdAt)) : "-"}</span>
            </div>

            {admission.notes && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">Observações</div>
                <div className="whitespace-pre-wrap break-words">{admission.notes}</div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <Link
                to={routes.administration.collaborators.details(user.id)}
                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-600 dark:hover:text-green-500 hover:underline"
              >
                Ver colaborador
                <IconExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
