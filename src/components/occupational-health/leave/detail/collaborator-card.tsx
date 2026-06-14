import { IconUser, IconBriefcase, IconBuilding } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/ui/detail-row";

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
        <div className="space-y-2">
          <DetailRow icon={IconUser} label="Nome" value={leave.user?.name || "-"} />
          <DetailRow icon={IconBriefcase} label="Cargo" value={leave.user?.position?.name || "-"} />
          <DetailRow icon={IconBuilding} label="Setor" value={leave.user?.sector?.name || "-"} />
        </div>
      </CardContent>
    </Card>
  );
}
