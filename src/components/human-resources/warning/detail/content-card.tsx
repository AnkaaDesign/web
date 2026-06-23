import { IconFileText, IconNotes } from "@tabler/icons-react";

import type { Warning } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/ui/detail-row";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  warning: Warning;
  className?: string;
}

export function ContentCard({ warning, className }: ContentCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Conteúdo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <DetailRow label="Motivo" value={warning.reason} block />

          {warning.description && (
            <DetailRow label="Descrição Detalhada" value={warning.description} block />
          )}

          {warning.hrNotes && (
            <div className="rounded-lg px-4 py-3 flex flex-col gap-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-700/40">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconNotes className="h-4 w-4" />
                <span>Notas do RH</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {warning.hrNotes}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
