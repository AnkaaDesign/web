import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBriefcase, IconBuilding, IconUserCog, IconCalendarTime, IconCalendarShare, IconCalendarCheck, IconCalendarCancel } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";

interface ProfessionalInfoCardProps {
  user: User;
  className?: string;
}

export function ProfessionalInfoCard({ user, className }: ProfessionalInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconBriefcase className="h-5 w-5 text-muted-foreground" />
          Dados Profissionais
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Professional Information */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Dados Funcionais</h3>
            <div className="space-y-4">
              {user.position && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconBriefcase className="h-4 w-4" />
                    Cargo
                  </span>
                  <span className="text-sm font-semibold text-foreground">{user.position.name}</span>
                </div>
              )}

              {user.sector && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconBuilding className="h-4 w-4" />
                    Setor
                  </span>
                  <span className="text-sm font-semibold text-foreground">{user.sector.name}</span>
                </div>
              )}

              {user.managedSector && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUserCog className="h-4 w-4" />
                    Setor Gerenciado
                  </span>
                  <span className="text-sm font-semibold text-foreground">{user.managedSector.name}</span>
                </div>
              )}

              {user.exp1StartAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarTime className="h-4 w-4" />
                    Início Experiência 1
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.exp1StartAt)}</span>
                </div>
              )}

              {user.exp1EndAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarShare className="h-4 w-4" />
                    Fim Experiência 1
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.exp1EndAt)}</span>
                </div>
              )}

              {user.exp2StartAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarTime className="h-4 w-4" />
                    Início Experiência 2
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.exp2StartAt)}</span>
                </div>
              )}

              {user.exp2EndAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarShare className="h-4 w-4" />
                    Fim Experiência 2
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.exp2EndAt)}</span>
                </div>
              )}

              {user.effectedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarCheck className="h-4 w-4" />
                    Data de Contratação
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.effectedAt)}</span>
                </div>
              )}

              {user.dismissedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarCancel className="h-4 w-4" />
                    Data de Demissão
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDate(user.dismissedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Level */}
          {user.performanceLevel > 0 && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Nível de Desempenho</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nível de Desempenho</span>
                <span className="text-sm font-semibold text-foreground">{user.performanceLevel}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
