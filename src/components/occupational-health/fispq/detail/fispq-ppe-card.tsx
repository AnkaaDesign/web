import { IconShieldCheck } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Fispq } from "@/types/fispq";

interface FispqPpeCardProps {
  fispq: Fispq;
  className?: string;
}

export function FispqPpeCard({ fispq, className }: FispqPpeCardProps) {
  const ppeItems = fispq.requiredPpeItems ?? [];

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconShieldCheck className="h-5 w-5 text-muted-foreground" />
          EPI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ppeItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ppeItems.map((item) => (
              <Badge key={item.id} variant="secondary" className="text-xs font-normal">
                {item.name}
              </Badge>
            ))}
          </div>
        )}
        {fispq.requiredPpeText ? (
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">{fispq.requiredPpeText}</p>
          </div>
        ) : ppeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum EPI informado.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
