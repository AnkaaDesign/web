import { IconFileText, IconNotes } from "@tabler/icons-react";

import type { Warning } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface DescriptionCardProps {
  warning: Warning;
}

export function DescriptionCard({ warning }: DescriptionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5" />
          Detalhes da Advertência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reason */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Motivo</h3>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm whitespace-pre-wrap">{warning.reason}</p>
          </div>
        </div>

        {/* Description */}
        {warning.description && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Descrição Detalhada</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{warning.description}</p>
              </div>
            </div>
          </>
        )}

        {/* HR Notes */}
        {warning.hrNotes && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <IconNotes className="h-4 w-4" />
                Notas do RH
              </h3>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{warning.hrNotes}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
