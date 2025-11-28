import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconId, IconCertificate, IconFileText } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import { maskCPF } from "../../../../utils";

interface DocumentsCardProps {
  user: User;
  className?: string;
}

export function DocumentsCard({ user, className }: DocumentsCardProps) {
  const hasDocuments = user.cpf || user.pis;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {hasDocuments ? (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Documentação Pessoal</h3>
              <div className="space-y-4">
                {user.cpf && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconId className="h-4 w-4" />
                      CPF
                    </span>
                    <span className="text-sm font-semibold text-foreground">{maskCPF(user.cpf)}</span>
                  </div>
                )}

                {user.pis && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCertificate className="h-4 w-4" />
                      PIS
                    </span>
                    <span className="text-sm font-semibold text-foreground">{user.pis}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconFileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum documento cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este usuário não possui documentos cadastrados.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
