import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconLogin, IconShieldCheck, IconShieldOff, IconKey, IconClock, IconUserCheck, IconUserOff } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { VERIFICATION_TYPE_LABELS } from "../../../../constants";

interface LoginInfoCardProps {
  user: User;
  className?: string;
}

export function LoginInfoCard({ user, className }: LoginInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconLogin className="h-5 w-5 text-muted-foreground" />
          Informações de Login
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Dados de Acesso</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {user.isActive ? <IconUserCheck className="h-4 w-4 text-green-600" /> : <IconUserOff className="h-4 w-4 text-destructive" />}
                  Conta Ativa
                </span>
                <Badge variant={user.isActive ? "active" : "destructive"}>{user.isActive ? "Ativo" : "Inativo"}</Badge>
              </div>

              <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {user.verified ? <IconShieldCheck className="h-4 w-4 text-green-600" /> : <IconShieldOff className="h-4 w-4 text-muted-foreground" />}
                  Status de Verificação
                </span>
                <Badge variant={user.verified ? "active" : "inactive"}>{user.verified ? "Verificado" : "Não Verificado"}</Badge>
              </div>

              {user.requirePasswordChange !== undefined && (
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconKey className="h-4 w-4" />
                    Alteração de Senha
                  </span>
                  <Badge variant={user.requirePasswordChange ? "warning" : "active"}>{user.requirePasswordChange ? "Requerida" : "Não Requerida"}</Badge>
                </div>
              )}

              {user.lastLoginAt && (
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Último Acesso
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatDateTime(user.lastLoginAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(user.lastLoginAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Verification Details */}
          {user.verificationType && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes da Verificação</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Tipo de Verificação</span>
                  <span className="text-sm font-semibold text-foreground">{VERIFICATION_TYPE_LABELS[user.verificationType as keyof typeof VERIFICATION_TYPE_LABELS]}</span>
                </div>

                {user.verificationExpiresAt && (
                  <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Expiração da Verificação</span>
                    <span className="text-sm font-semibold text-foreground">{formatDateTime(user.verificationExpiresAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Sistema</h3>
            <div className="space-y-4">
              {user.createdAt && (
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Data de Criação
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatDateTime(user.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(user.createdAt)}</p>
                  </div>
                </div>
              )}

              {user.updatedAt && (
                <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Última Atualização
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatDateTime(user.updatedAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(user.updatedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
