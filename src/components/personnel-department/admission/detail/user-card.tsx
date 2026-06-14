import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconUser, IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes, CONTRACT_TYPE_LABELS } from "../../../../constants";
import type { CONTRACT_TYPE } from "../../../../constants";
import { formatCPF, formatDate, formatDateTime } from "../../../../utils";
import type { Admission } from "../../../../types/admission";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";

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
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <DetailRow
                label="Nome"
                value={
                  <span className="truncate" title={user.name}>
                    {user.name}
                  </span>
                }
              />
              <DetailRow label="CPF" value={user.cpf ? formatCPF(user.cpf) : "-"} />
              <DetailRow label="Nº Folha" value={user.payrollNumber || "-"} />
              <DetailRow label="Cargo" value={<span className="truncate">{user.position?.name || "-"}</span>} />
              <DetailRow label="Setor" value={<span className="truncate">{user.sector?.name || "-"}</span>} />
              <DetailRow
                label="Tipo de Contrato"
                value={
                  user.currentContractType ? (
                    <Badge variant={getBadgeVariantFromStatus(user.currentContractType, "USER")} className="text-xs whitespace-nowrap">
                      {CONTRACT_TYPE_LABELS[user.currentContractType as CONTRACT_TYPE] || user.currentContractType}
                    </Badge>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailRow label="Data de Admissão" value={admission.hireDate ? formatDate(new Date(admission.hireDate)) : "-"} />
              <DetailRow label="Criado por" value={<span className="truncate">{admission.createdBy?.name || "-"}</span>} />
              <DetailRow label="Criado em" value={admission.createdAt ? formatDateTime(new Date(admission.createdAt)) : "-"} />
            </div>

            {admission.notes && <DetailRow label="Observações" value={<span className="break-words">{admission.notes}</span>} block />}

            <div className="pt-2">
              <Link
                to={routes.administration.collaborators.details(user.id)}
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 dark:text-green-600 dark:hover:text-green-500 hover:underline"
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
