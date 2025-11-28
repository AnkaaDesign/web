import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPhone, IconPhoneCall, IconBrandWhatsapp } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatBrazilianPhone } from "../../../../utils";

interface ContactInfoCardProps {
  user: User;
  className?: string;
}

export function ContactInfoCard({ user, className }: ContactInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconPhoneCall className="h-5 w-5 text-muted-foreground" />
          Informações de Contato
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {user.phone ? (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Telefone</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconPhone className="h-4 w-4" />
                  Telefone Principal
                </span>
                <div className="flex items-center gap-3">
                  <a href={`tel:${user.phone}`} className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline font-mono">
                    {formatBrazilianPhone(user.phone)}
                  </a>
                  {user.phone && (
                    <a
                      href={`https://wa.me/${user.phone.replace(/\D/g, "").startsWith("55") ? user.phone.replace(/\D/g, "") : `55${user.phone.replace(/\D/g, "")}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors"
                      title="Enviar mensagem no WhatsApp"
                    >
                      <IconBrandWhatsapp className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconPhoneCall className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma informação de contato</h3>
              <p className="text-sm text-muted-foreground">Este usuário não possui telefone cadastrado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
