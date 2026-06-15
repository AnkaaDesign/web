import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconUsersGroup, IconLoader2 } from "@tabler/icons-react";
import { useVacationGroupMembers } from "../../../../hooks/personnel-department/use-vacation-groups";

interface VacationGroupMembersCardProps {
  groupId: string;
}

export function VacationGroupMembersCard({ groupId }: VacationGroupMembersCardProps) {
  const { data: response, isLoading, error } = useVacationGroupMembers(groupId);
  const members = response?.data?.members || [];
  const total = response?.data?.total ?? 0;
  const eligible = response?.data?.eligible ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsersGroup className="h-5 w-5 text-muted-foreground" />
          Colaboradores Abrangidos
        </CardTitle>
        <CardDescription>Pré-visualização dos colaboradores que receberão as férias coletivas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            Total: <span className="ml-1 font-semibold tabular-nums">{total}</span>
          </Badge>
          <Badge variant="success" className="text-xs">
            Elegíveis: <span className="ml-1 font-semibold tabular-nums">{eligible}</span>
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
            Calculando colaboradores...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Não foi possível carregar os colaboradores abrangidos.</AlertDescription>
          </Alert>
        ) : members.length === 0 ? (
          <Alert variant="warning">
            <AlertDescription>Nenhum colaborador abrangido por estes critérios.</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="text-xs font-bold uppercase">Colaborador</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Setor</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Cargo</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm">{m.sectorName || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-sm">{m.positionName || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {m.eligible ? (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0">
                            Elegível
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0" title={m.reason}>
                            {m.reason || "Inelegível"}
                          </Badge>
                        )}
                        {m.alreadyExpanded && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Já gerado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
