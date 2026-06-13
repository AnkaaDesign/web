import { IconUser, IconBriefcase, IconBuilding } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CollaboratorCardProps {
  leave: Leave;
  className?: string;
}

export function CollaboratorCard({ leave, className }: CollaboratorCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Colaborador
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Nome
            </span>
            <span className="text-sm font-semibold text-foreground text-right">{leave.user?.name || "-"}</span>
          </div>
          <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconBriefcase className="h-4 w-4" />
              Cargo
            </span>
            <span className="text-sm font-semibold text-foreground text-right">{leave.user?.position?.name || "-"}</span>
          </div>
          <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Setor
            </span>
            <span className="text-sm font-semibold text-foreground text-right">{leave.user?.sector?.name || "-"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
