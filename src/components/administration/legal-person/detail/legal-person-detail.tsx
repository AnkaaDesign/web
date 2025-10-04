import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Building, Mail, Phone, Globe, MapPin, Calendar, Edit, Trash2, ExternalLink } from "lucide-react";
import { formatCNPJ, formatDate } from "../../../../utils";
import type { LegalPerson } from "../../../../types";

interface LegalPersonDetailProps {
  legalPerson: LegalPerson;
  onEdit?: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

export function LegalPersonDetail({ legalPerson, onEdit, onDelete, isLoading = false }: LegalPersonDetailProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={legalPerson.logo?.path} />
            <AvatarFallback className="text-lg">{getInitials(legalPerson.fantasyName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{legalPerson.fantasyName}</h1>
            {legalPerson.corporateName && <p className="text-muted-foreground">{legalPerson.corporateName}</p>}
            <div className="flex items-center space-x-2 mt-1">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{formatCNPJ(legalPerson.cnpj)}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações de Contato</CardTitle>
            <CardDescription>Dados de contato da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {legalPerson.email && (
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <a href={`mailto:${legalPerson.email}`} className="text-sm text-blue-600 hover:underline">
                    {legalPerson.email}
                  </a>
                </div>
              </div>
            )}

            {legalPerson.website && (
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Website</p>
                  <a href={legalPerson.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center">
                    {legalPerson.website}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {legalPerson.phones.length > 0 && (
              <div className="flex items-start space-x-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm font-medium">Telefones</p>
                  <div className="space-y-1">
                    {legalPerson.phones.map((phone, index) => (
                      <a key={index} href={`tel:${phone.replace(/\D/g, "")}`} className="block text-sm text-blue-600 hover:underline">
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!legalPerson.email && !legalPerson.website && legalPerson.phones.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma informação de contato cadastrada.</p>
            )}
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>Localização da empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {legalPerson.address || legalPerson.city || legalPerson.state ? (
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  {legalPerson.address && (
                    <p className="text-sm">
                      {legalPerson.address}
                      {legalPerson.addressNumber && `, ${legalPerson.addressNumber}`}
                    </p>
                  )}
                  {legalPerson.addressComplement && <p className="text-sm text-muted-foreground">{legalPerson.addressComplement}</p>}
                  {legalPerson.neighborhood && <p className="text-sm">{legalPerson.neighborhood}</p>}
                  {(legalPerson.city || legalPerson.state) && <p className="text-sm">{[legalPerson.city, legalPerson.state].filter(Boolean).join(", ")}</p>}
                  {legalPerson.zipCode && <p className="text-sm font-mono">CEP: {legalPerson.zipCode}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
            )}
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
            <CardDescription>Dados de controle interno</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Cadastrado em</p>
                <p className="text-sm text-muted-foreground">{formatDate(legalPerson.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Última atualização</p>
                <p className="text-sm text-muted-foreground">{formatDate(legalPerson.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas</CardTitle>
            <CardDescription>Resumo de atividades da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Tarefas</span>
              <Badge variant="secondary">{legalPerson.tasks?.length || 0}</Badge>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-sm">Pedidos</span>
              <Badge variant="secondary">{legalPerson.orders?.length || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
