import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconEdit, IconTrash, IconUser, IconId, IconCar, IconPhone, IconMail, IconHome, IconHeart, IconBriefcase, IconNotes } from "@tabler/icons-react";

import type { Driver } from "../../../../types";
import { DRIVER_STATUS_LABELS, CNH_CATEGORY_LABELS, DRIVER_LICENSE_TYPE_LABELS } from "../../../../constants";
import { isCNHExpired, isCNHExpiringSoon } from "../../../../utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangleIcon, InfoIcon } from "@radix-ui/react-icons";

interface DriverDetailProps {
  driver: Driver;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DriverDetail({ driver, onEdit, onDelete }: DriverDetailProps) {
  const isExpired = isCNHExpired(new Date(driver.cnhExpiryDate));
  const isExpiringSoon = !isExpired && isCNHExpiringSoon(new Date(driver.cnhExpiryDate));

  const getStatusBadge = () => {
    if (driver.status === "ACTIVE") {
      if (isExpired) {
        return <Badge variant="destructive">CNH Vencida</Badge>;
      }
      if (isExpiringSoon) {
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
            Vence em Breve
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="bg-green-500">
          Ativo
        </Badge>
      );
    }

    if (driver.status === "SUSPENDED") {
      return <Badge variant="destructive">Suspenso</Badge>;
    }

    if (driver.status === "LICENSE_EXPIRED") {
      return <Badge variant="destructive">CNH Vencida</Badge>;
    }

    return <Badge variant="secondary">Inativo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-3">
                <IconUser className="h-6 w-6" />
                {driver.name}
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>
                CPF: {driver.cpf} • CNH: {driver.cnhNumber}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onEdit}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" onClick={onDelete}>
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* CNH Status Alert */}
      {isExpired && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>CNH Vencida!</strong> A CNH deste motorista está vencida desde {format(new Date(driver.cnhExpiryDate), "dd/MM/yyyy", { locale: ptBR })}. O motorista não pode
            dirigir até renovar a licença.
          </AlertDescription>
        </Alert>
      )}

      {!isExpired && isExpiringSoon && (
        <Alert variant="default" className="border-yellow-500">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>CNH vencendo em breve!</strong> A CNH vence em {format(new Date(driver.cnhExpiryDate), "dd/MM/yyyy", { locale: ptBR })}. Considere renovar com antecedência.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconId className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Nome</p>
                <p>{driver.name}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <p>{DRIVER_STATUS_LABELS[driver.status]}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">CPF</p>
                <p>{driver.cpf}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">RG</p>
                <p>{driver.rg || "Não informado"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Data de Nascimento</p>
                <p>{driver.birthDate ? format(new Date(driver.birthDate), "dd/MM/yyyy", { locale: ptBR }) : "Não informado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CNH Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCar className="h-5 w-5" />
              Informações da CNH
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Número</p>
                <p className="font-mono">{driver.cnhNumber}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Categoria</p>
                <p>{CNH_CATEGORY_LABELS[driver.cnhCategory]}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Tipo</p>
                <p>{DRIVER_LICENSE_TYPE_LABELS[driver.licenseType]}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Estado Emissor</p>
                <p>{driver.cnhIssuingState || "Não informado"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Data de Emissão</p>
                <p>{driver.cnhIssueDate ? format(new Date(driver.cnhIssueDate), "dd/MM/yyyy", { locale: ptBR }) : "Não informado"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Vencimento</p>
                <p className={isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-yellow-600 font-medium" : ""}>
                  {format(new Date(driver.cnhExpiryDate), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPhone className="h-5 w-5" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Telefone</p>
                <p>{driver.phone || "Não informado"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">E-mail</p>
                <p>{driver.email || "Não informado"}</p>
              </div>
            </div>

            {(driver.emergencyContactName || driver.emergencyContactPhone) && (
              <>
                <Separator />
                <div>
                  <p className="font-medium text-muted-foreground mb-2">Contato de Emergência</p>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Nome:</strong> {driver.emergencyContactName || "Não informado"}
                    </p>
                    <p>
                      <strong>Telefone:</strong> {driver.emergencyContactPhone || "Não informado"}
                    </p>
                    <p>
                      <strong>Relação:</strong> {driver.emergencyContactRelation || "Não informado"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        {(driver.address || driver.city || driver.state) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconHome className="h-5 w-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {driver.address && (
                <p>
                  {driver.address}, {driver.addressNumber}
                </p>
              )}
              {driver.addressComplement && <p>{driver.addressComplement}</p>}
              {driver.neighborhood && <p>{driver.neighborhood}</p>}
              {(driver.city || driver.state) && (
                <p>
                  {driver.city}
                  {driver.city && driver.state && " - "}
                  {driver.state}
                </p>
              )}
              {driver.zipCode && <p>CEP: {driver.zipCode}</p>}
            </CardContent>
          </Card>
        )}

        {/* Medical Information */}
        {(driver.bloodType || driver.allergies || driver.medications || driver.medicalCertificateExpiry) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconHeart className="h-5 w-5" />
                Informações Médicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {driver.bloodType && (
                <div>
                  <p className="font-medium text-muted-foreground">Tipo Sanguíneo</p>
                  <p>{driver.bloodType}</p>
                </div>
              )}
              {driver.medicalCertificateExpiry && (
                <div>
                  <p className="font-medium text-muted-foreground">Atestado Médico - Vencimento</p>
                  <p>{format(new Date(driver.medicalCertificateExpiry), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              )}
              {driver.allergies && (
                <div>
                  <p className="font-medium text-muted-foreground">Alergias</p>
                  <p>{driver.allergies}</p>
                </div>
              )}
              {driver.medications && (
                <div>
                  <p className="font-medium text-muted-foreground">Medicamentos</p>
                  <p>{driver.medications}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employment Information */}
        {(driver.employeeId || driver.hireDate) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBriefcase className="h-5 w-5" />
                Informações de Emprego
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {driver.employeeId && (
                <div>
                  <p className="font-medium text-muted-foreground">Matrícula</p>
                  <p>{driver.employeeId}</p>
                </div>
              )}
              {driver.hireDate && (
                <div>
                  <p className="font-medium text-muted-foreground">Data de Contratação</p>
                  <p>{format(new Date(driver.hireDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {driver.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconNotes className="h-5 w-5" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{driver.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
