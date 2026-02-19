import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBuilding, IconCertificate, IconUser, IconFileDescription, IconPhone, IconMail, IconWorld, IconBrandWhatsapp } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import { cn } from "@/lib/utils";
import { maskCNPJ, maskCPF, formatBrazilianPhone } from "../../../../utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { REGISTRATION_STATUS_OPTIONS } from "@/constants/enums";

interface BasicInfoCardProps {
  customer: Customer;
  className?: string;
}

export function BasicInfoCard({ customer, className }: BasicInfoCardProps) {
  const hasContact = customer.email || (customer.phones && customer.phones.length > 0) || customer.site;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconBuilding className="h-5 w-5 text-muted-foreground" />
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <CustomerLogoDisplay
              logo={customer.logo}
              customerName={customer.fantasyName}
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
                <span className="text-sm font-medium text-muted-foreground">Nome Fantasia</span>
                <span className="text-sm font-semibold text-foreground">{customer.fantasyName}</span>
              </div>

              {customer.corporateName && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Razão Social</span>
                  <span className="text-sm font-semibold text-foreground">{customer.corporateName}</span>
                </div>
              )}

              {customer.cnpj && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCertificate className="h-4 w-4" />
                    CNPJ
                  </span>
                  <span className="text-sm font-semibold text-foreground">{maskCNPJ(customer.cnpj)}</span>
                </div>
              )}

              {customer.cpf && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUser className="h-4 w-4" />
                    CPF
                  </span>
                  <span className="text-sm font-semibold text-foreground">{maskCPF(customer.cpf)}</span>
                </div>
              )}

              {customer.registrationStatus && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconFileDescription className="h-4 w-4" />
                    Situação Cadastral
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {REGISTRATION_STATUS_OPTIONS.find(opt => opt.value === customer.registrationStatus)?.label ?? customer.registrationStatus}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Section */}
          {hasContact && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Contato</h3>
              <div className="space-y-3">
                {customer.email && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconMail className="h-4 w-4" />
                      E-mail
                    </span>
                    <a href={`mailto:${customer.email}`} className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}

                {customer.phones && customer.phones.length > 0 && customer.phones.map((phone: string, index: number) => {
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

                {customer.site && (
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
                )}
              </div>
            </div>
          )}

          {/* Tags Section */}
          {customer.tags && customer.tags.length > 0 && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {customer.tags.map((tag: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
