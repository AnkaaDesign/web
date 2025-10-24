import { IconHammer } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GarageListProps {
  className?: string;
}

export function GarageList({ className }: GarageListProps) {
  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="rounded-full bg-muted p-6">
            <IconHammer className="h-16 w-16 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Em Construção
            </h2>
            <p className="text-muted-foreground">
              Esta página está sendo desenvolvida. Em breve, você poderá gerenciar garagens aqui.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
