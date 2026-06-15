import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconUsersPlus, IconRefresh } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";
import { useExpandVacationGroup, useSyncVacationGroup } from "../../../../hooks/personnel-department/use-vacation-groups";

interface VacationGroupExpandCardProps {
  groupId: string;
}

export function VacationGroupExpandCard({ groupId }: VacationGroupExpandCardProps) {
  const expand = useExpandVacationGroup();
  const sync = useSyncVacationGroup();

  const handleExpand = async () => {
    try {
      const result = await expand.mutateAsync(groupId);
      const data = result?.data;
      if (data) {
        toast.success(`Férias geradas: ${data.created} criada(s), ${data.skipped} ignorada(s), ${data.failed} falha(s).`);
      } else {
        toast.success(result?.message || "Férias individuais geradas.");
      }
    } catch (error) {
      toast.error("Não foi possível gerar as férias individuais.");
      if (process.env.NODE_ENV !== "production") {
        console.error("Error expanding vacation group:", error);
      }
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync(groupId);
      toast.success(result?.message || "Sincronização no ponto concluída.");
    } catch (error) {
      toast.error("Não foi possível sincronizar no ponto.");
      if (process.env.NODE_ENV !== "production") {
        console.error("Error syncing vacation group:", error);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsersPlus className="h-5 w-5 text-muted-foreground" />
          Geração e Sincronização
        </CardTitle>
        <CardDescription>Gere as férias individuais para os colaboradores elegíveis e sincronize com o ponto (Secullum).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="default" onClick={handleExpand} disabled={expand.isPending}>
          <IconUsersPlus className="h-4 w-4 mr-2" />
          Gerar férias individuais
        </Button>
        <Button variant="outline" onClick={handleSync} disabled={sync.isPending}>
          <IconRefresh className="h-4 w-4 mr-2" />
          Sincronizar no ponto
        </Button>
      </CardContent>
    </Card>
  );
}
