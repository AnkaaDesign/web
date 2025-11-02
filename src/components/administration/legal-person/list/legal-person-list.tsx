import { useState } from "react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, Building, Mail, Phone, Globe, MapPin } from "lucide-react";
import { formatCNPJ } from "../../../../utils";
import type { LegalPerson } from "../../../../types";

interface LegalPersonListProps {
  legalPersons?: LegalPerson[];
  isLoading?: boolean;
  onCreateNew?: () => void;
  onEdit?: (legalPerson: LegalPerson) => void;
  onDelete?: (legalPerson: LegalPerson) => void;
  onView?: (legalPerson: LegalPerson) => void;
}

export function LegalPersonList({ legalPersons = [], isLoading = false, onCreateNew, onEdit, onDelete, onView }: LegalPersonListProps) {
  const [searchQuery, setSearchQuery] = useQueryState("search", {
    defaultValue: "",
    clearOnDefault: true,
  });

  // Filter legal persons based on search query
  const filteredLegalPersons = legalPersons.filter((legalPerson) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      legalPerson.fantasyName.toLowerCase().includes(query) ||
      legalPerson.corporateName?.toLowerCase().includes(query) ||
      legalPerson.cnpj.includes(query) ||
      legalPerson.email?.toLowerCase().includes(query) ||
      legalPerson.city?.toLowerCase().includes(query)
    );
  });

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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Pessoas Jurídicas</h1>
            <p className="text-muted-foreground">Gerencie as empresas cadastradas</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Pessoas Jurídicas</h1>
          <p className="text-muted-foreground">Gerencie as empresas cadastradas no sistema</p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ, email ou cidade..." value={searchQuery} onChange={(value) => setSearchQuery(String(value || ""))} className="pl-10" />
        </div>
        <Badge variant="secondary">
          {filteredLegalPersons.length} empresa{filteredLegalPersons.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Legal Person Cards */}
      {filteredLegalPersons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{searchQuery ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery ? "Tente ajustar os termos de busca ou limpe o filtro." : "Comece cadastrando sua primeira empresa no sistema."}
            </p>
            {!searchQuery && (
              <Button onClick={onCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeira Empresa
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredLegalPersons.map((legalPerson) => (
            <Card key={legalPerson.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={legalPerson.logo?.path} />
                      <AvatarFallback>{getInitials(legalPerson.fantasyName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{legalPerson.fantasyName}</CardTitle>
                      {legalPerson.corporateName && <CardDescription className="text-xs truncate">{legalPerson.corporateName}</CardDescription>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView?.(legalPerson)}>Visualizar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(legalPerson)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete?.(legalPerson)} className="text-destructive">
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* CNPJ */}
                <div className="flex items-center space-x-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{formatCNPJ(legalPerson.cnpj)}</span>
                </div>

                {/* Email */}
                {legalPerson.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{legalPerson.email}</span>
                  </div>
                )}

                {/* Phone */}
                {legalPerson.phones.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{legalPerson.phones[0]}</span>
                    {legalPerson.phones.length > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        +{legalPerson.phones.length - 1}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Website */}
                {legalPerson.website && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{legalPerson.website}</span>
                  </div>
                )}

                {/* Location */}
                {(legalPerson.city || legalPerson.state) && (
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{[legalPerson.city, legalPerson.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                {/* Action Button */}
                <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => onView?.(legalPerson)}>
                  Ver Detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
