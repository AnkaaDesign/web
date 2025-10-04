import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPhone, IconMail, IconPhoneCall, IconWorld, IconBrandWhatsapp } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatBrazilianPhone } from "../../../../utils";

interface ContactDetailsCardProps {
  customer: Customer;
  className?: string;
}

export function ContactDetailsCard({ customer, className }: ContactDetailsCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconPhoneCall className="h-5 w-5 text-primary" />
          </div>
          Informações de Contato
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Email Section */}
          {customer.email && (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">E-mail</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconMail className="h-4 w-4" />
                  E-mail Principal
                </span>
                <a href={`mailto:${customer.email}`} className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline">
                  {customer.email}
                </a>
              </div>
            </div>
          )}

          {/* Phone Numbers Section */}
          {customer.phones && customer.phones.length > 0 && (
            <div className={customer.email ? "pt-6 border-t border-border/50" : ""}>
              <h3 className="text-base font-semibold mb-4 text-foreground">Telefones</h3>
              <div className="space-y-3">
                {customer.phones.map((phone: string, index: number) => {
                  // Clean phone number for WhatsApp (remove non-digits and add country code if needed)
                  const cleanPhone = phone.replace(/\D/g, "");
                  const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

                  return (
                    <div key={index} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconPhone className="h-4 w-4" />
                        Telefone {customer.phones.length > 1 ? `${index + 1}` : ""}
                      </span>
                      <div className="flex items-center gap-3">
                        <a href={`tel:${phone}`} className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline font-mono">
                          {formatBrazilianPhone(phone)}
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Website Section */}
          {customer.site && (
            <div className={customer.email || (customer.phones && customer.phones.length > 0) ? "pt-6 border-t border-border/50" : ""}>
              <h3 className="text-base font-semibold mb-4 text-foreground">Website</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconWorld className="h-4 w-4" />
                  Site
                </span>
                <a
                  href={customer.site.startsWith("http") ? customer.site : `https://${customer.site}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline"
                >
                  {customer.site}
                </a>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!customer.email && (!customer.phones || customer.phones.length === 0) && !customer.site && (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconPhoneCall className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma informação de contato</h3>
              <p className="text-sm text-muted-foreground">Este cliente não possui informações de contato cadastradas.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
