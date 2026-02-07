import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPhone, IconMail, IconPhoneCall, IconBrandWhatsapp, IconLock, IconLockOpen } from "@tabler/icons-react";
import type { Representative } from "@/types/representative";
import { cn } from "@/lib/utils";
import { formatBrazilianPhone } from "@/utils";

interface ContactDetailsCardProps {
  representative: Representative;
  className?: string;
}

export function ContactDetailsCard({ representative, className }: ContactDetailsCardProps) {
  const hasSystemAccess = !!representative.email && !!representative.password;

  // Clean phone number for WhatsApp (remove non-digits and add country code if needed)
  const cleanPhone = representative.phone.replace(/\D/g, "");
  const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconPhoneCall className="h-5 w-5 text-muted-foreground" />
          Informações de Contato
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Phone Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Telefone</h3>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconPhone className="h-4 w-4" />
                Telefone
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={`tel:${representative.phone}`}
                  className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline font-mono"
                >
                  {formatBrazilianPhone(representative.phone)}
                </a>
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors"
                  title="Enviar mensagem no WhatsApp"
                >
                  <IconBrandWhatsapp className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Email Section */}
          {representative.email && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">E-mail</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconMail className="h-4 w-4" />
                  E-mail
                </span>
                <a
                  href={`mailto:${representative.email}`}
                  className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline"
                >
                  {representative.email}
                </a>
              </div>
            </div>
          )}

          {/* System Access Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Acesso ao Sistema</h3>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {hasSystemAccess ? (
                  <IconLockOpen className="h-4 w-4 text-green-600" />
                ) : (
                  <IconLock className="h-4 w-4" />
                )}
                Status de Acesso
              </span>
              <span className={cn(
                "text-sm font-semibold",
                hasSystemAccess ? "text-green-600" : "text-muted-foreground"
              )}>
                {hasSystemAccess ? "Com acesso ao sistema" : "Sem acesso ao sistema"}
              </span>
            </div>
          </div>

          {/* Empty State */}
          {!representative.phone && !representative.email && (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconPhoneCall className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma informação de contato</h3>
              <p className="text-sm text-muted-foreground">Este representante não possui informações de contato cadastradas.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
