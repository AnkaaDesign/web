import { IconInfoCircle, IconId, IconShieldCheck, IconUsers, IconClipboardList, IconUserStar, IconCalendarPlus, IconCalendarTime } from "@tabler/icons-react";

import type { Sector } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { SECTOR_PRIVILEGES_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Map privileges to badge colors (same as list page)
const getPrivilegeColor = (privilege: string) => {
  switch (privilege) {
    case SECTOR_PRIVILEGES.ADMIN:
      return "red"; // Red - admin privileges
    case SECTOR_PRIVILEGES.PRODUCTION:
      return "blue"; // Blue - production role
    case SECTOR_PRIVILEGES.HUMAN_RESOURCES:
      return "purple"; // Purple - HR specific
    case SECTOR_PRIVILEGES.FINANCIAL:
      return "purple"; // Purple - financial role (same as HR)
    case SECTOR_PRIVILEGES.DESIGNER:
      return "purple"; // Purple - designer role (same as HR)
    case SECTOR_PRIVILEGES.LOGISTIC:
      return "purple"; // Purple - logistics role (same as HR)
    case SECTOR_PRIVILEGES.MAINTENANCE:
      return "orange"; // Orange - maintenance role
    case SECTOR_PRIVILEGES.WAREHOUSE:
      return "green"; // Green - warehouse role
    case SECTOR_PRIVILEGES.EXTERNAL:
      return "gray"; // Gray - external access
    case SECTOR_PRIVILEGES.BASIC:
    default:
      return "gray"; // Gray - basic access
  }
};

interface SpecificationsCardProps {
  sector: Sector;
  className?: string;
}

export function SpecificationsCard({ sector, className }: SpecificationsCardProps) {
  // Get the leader from the leader relation (single User, not array)
  const leader = sector.leader ?? null;

  return (
    <Card className={`shadow-sm border border-border flex flex-col ${className ?? ""}`}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Básicas</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconId className="h-4 w-4" />
                  Nome
                </span>
                <span className="text-sm font-semibold text-foreground text-right">{sector.name}</span>
              </div>

              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconShieldCheck className="h-4 w-4" />
                  Privilégios
                </span>
                <Badge variant={getPrivilegeColor(sector.privileges) as any} className="font-normal">
                  {SECTOR_PRIVILEGES_LABELS[sector.privileges]}
                </Badge>
              </div>

              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconUsers className="h-4 w-4" />
                  Usuários
                </span>
                <span className="text-sm font-semibold text-foreground text-right">
                  {sector._count?.users || 0} usuário{(sector._count?.users || 0) !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconClipboardList className="h-4 w-4" />
                  Tarefas
                </span>
                <span className="text-sm font-semibold text-foreground text-right">
                  {sector._count?.tasks || 0} tarefa{(sector._count?.tasks || 0) !== 1 ? "s" : ""}
                </span>
              </div>

              {leader && (
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUserStar className="h-4 w-4" />
                    Líder
                  </span>
                  <span className="text-sm font-semibold text-foreground text-right">{leader.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* System Dates */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas do Sistema</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarPlus className="h-4 w-4" />
                  Criado em
                </span>
                <span className="text-sm font-semibold text-foreground text-right">{sector.createdAt ? formatDateTime(sector.createdAt) : "-"}</span>
              </div>

              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarTime className="h-4 w-4" />
                  Atualizado em
                </span>
                <span className="text-sm font-semibold text-foreground text-right">{sector.updatedAt ? formatDateTime(sector.updatedAt) : "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
