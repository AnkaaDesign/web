import { useNavigate } from "react-router-dom";
import { IconUsers, IconUser, IconMail, IconPhone, IconChevronRight } from "@tabler/icons-react";

import type { Sector } from "../../../../types";
import { routes, USER_STATUS_LABELS } from "../../../../constants";
import { formatCPF, formatPhone } from "../../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RelatedUsersCardProps {
  sector: Sector;
}

export function RelatedUsersCard({ sector }: RelatedUsersCardProps) {
  const navigate = useNavigate();

  if (!sector.users || sector.users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Usuários do Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado neste setor</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Usuários do Setor
          </div>
          <Badge variant="secondary">
            {sector.users.length} usuário{sector.users.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {sector.users.map((user) => (
              <div
                key={user.id}
                className="group border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(routes.administration.users.details(user.id))}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium flex items-center gap-2">
                      <IconUser className="h-4 w-4 text-muted-foreground" />
                      {user.name}
                    </h4>
                    {user.position && <p className="text-sm text-muted-foreground mt-1">{user.position.name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">
                      {USER_STATUS_LABELS[user.status]}
                    </Badge>
                    <IconChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {user.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconMail className="h-3.5 w-3.5" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconPhone className="h-3.5 w-3.5" />
                      <span>{formatPhone(user.phone)}</span>
                    </div>
                  )}
                  {user.cpf && <div className="text-muted-foreground">CPF: {formatCPF(user.cpf)}</div>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={() => navigate(routes.administration.users.root + `?sectorId=${sector.id}`)}>
            Ver todos os usuários deste setor
            <IconChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
