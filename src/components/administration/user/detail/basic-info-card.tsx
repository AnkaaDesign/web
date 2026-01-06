import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { IconUser, IconMail, IconPhone, IconBrandWhatsapp, IconId, IconShieldCheck } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatBrazilianPhone, getUserStatusBadgeText } from "../../../../utils";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";

interface BasicInfoCardProps {
  user: User;
  className?: string;
}

export function BasicInfoCard({ user, className }: BasicInfoCardProps) {
  const statusVariant = getBadgeVariantFromStatus(user.status, "USER");

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex justify-center mb-6">
            <UserAvatarDisplay
              avatar={user.avatar}
              userName={user.name}
              size="2xl"
              shape="rounded"
              bordered={true}
            />
          </div>

          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconId className="h-4 w-4" />
                  Nome
                </span>
                <span className="text-sm font-semibold text-foreground">{user.name}</span>
              </div>

              {user.email && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconMail className="h-4 w-4" />
                    E-mail
                  </span>
                  <a href={`mailto:${user.email}`} className="text-sm font-semibold text-primary hover:underline">
                    {user.email}
                  </a>
                </div>
              )}

              {user.phone && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconPhone className="h-4 w-4" />
                    Telefone
                  </span>
                  <div className="flex items-center gap-3">
                    <a href={`tel:${user.phone}`} className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline font-mono">
                      {formatBrazilianPhone(user.phone)}
                    </a>
                    <a
                      href={`https://wa.me/${user.phone.replace(/\D/g, "").startsWith("55") ? user.phone.replace(/\D/g, "") : `55${user.phone.replace(/\D/g, "")}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors"
                      title="Enviar mensagem no WhatsApp"
                    >
                      <IconBrandWhatsapp className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconShieldCheck className="h-4 w-4" />
                  Status
                </span>
                <Badge variant={statusVariant}>{getUserStatusBadgeText(user)}</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
