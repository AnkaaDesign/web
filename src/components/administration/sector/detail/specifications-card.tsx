import { IconInfoCircle, IconCalendar } from "@tabler/icons-react";

import type { Sector } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { SECTOR_PRIVILEGES_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Map privileges to badge colors (same as list page)
const getPrivilegeColor = (privilege: string) => {
  switch (privilege) {
    case SECTOR_PRIVILEGES.ADMIN:
      return "destructive"; // Red - highest privilege
    case SECTOR_PRIVILEGES.LEADER:
      return "warning"; // Yellow/Orange - leadership role
    case SECTOR_PRIVILEGES.HUMAN_RESOURCES:
      return "purple"; // Purple - HR specific
    case SECTOR_PRIVILEGES.PRODUCTION:
      return "blue"; // Blue - production role
    case SECTOR_PRIVILEGES.MAINTENANCE:
      return "orange"; // Orange - maintenance role
    case SECTOR_PRIVILEGES.WAREHOUSE:
      return "green"; // Green - warehouse role
    case SECTOR_PRIVILEGES.FINANCIAL:
      return "green"; // Green - financial role
    case SECTOR_PRIVILEGES.EXTERNAL:
      return "secondary"; // Gray - external access
    case SECTOR_PRIVILEGES.BASIC:
    default:
      return "default"; // Default gray - basic access
  }
};

interface SpecificationsCardProps {
  sector: Sector;
}

export function SpecificationsCard({ sector }: SpecificationsCardProps) {
  // Get the manager from managedByUsers relation (first user if multiple)
  const manager = sector.managedByUsers && sector.managedByUsers.length > 0 ? sector.managedByUsers[0] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5" />
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Informações Básicas</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Nome</span>
              <span className="text-sm font-medium">{sector.name}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Privilégios</span>
              <Badge variant={getPrivilegeColor(sector.privileges) as any} className="font-normal">
                {SECTOR_PRIVILEGES_LABELS[sector.privileges]}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Usuários</span>
              <span className="text-sm font-medium">
                {sector._count?.users || 0} usuário{(sector._count?.users || 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Tarefas</span>
              <span className="text-sm font-medium">
                {sector._count?.tasks || 0} tarefa{(sector._count?.tasks || 0) !== 1 ? "s" : ""}
              </span>
            </div>
            {manager && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Administrador</span>
                <span className="text-sm font-medium">{manager.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* System Dates */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Datas do Sistema
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Criado em</span>
              <span className="text-sm">{sector.createdAt ? formatDateTime(sector.createdAt) : "-"}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Atualizado em</span>
              <span className="text-sm">{sector.updatedAt ? formatDateTime(sector.updatedAt) : "-"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
