import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconHome, IconBuildingCommunity, IconMap, IconMailbox, IconUser } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { cn } from "@/lib/utils";

interface AddressCardProps {
  user: User;
  className?: string;
}

export function AddressCard({ user, className }: AddressCardProps) {
  const hasAddress = user.address || user.neighborhood || user.city || user.state || user.zipCode;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Informações Pessoais
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Address Section */}
          {hasAddress ? (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Endereço</h3>
              <div className="space-y-4">
                {user.address && (
                  <div className="flex justify-between items-start bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconHome className="h-4 w-4" />
                      Endereço
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {user.address}
                        {user.addressNumber && `, ${user.addressNumber}`}
                      </p>
                      {user.addressComplement && <p className="text-xs text-muted-foreground mt-1">{user.addressComplement}</p>}
                    </div>
                  </div>
                )}

                {user.neighborhood && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuildingCommunity className="h-4 w-4" />
                      Bairro
                    </span>
                    <span className="text-sm font-semibold text-foreground">{user.neighborhood}</span>
                  </div>
                )}

                {(user.city || user.state) && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconMap className="h-4 w-4" />
                      Cidade/Estado
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {user.city}
                      {user.city && user.state && " - "}
                      {user.state}
                    </span>
                  </div>
                )}

                {user.zipCode && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconMailbox className="h-4 w-4" />
                      CEP
                    </span>
                    <span className="text-sm font-semibold text-foreground font-mono">{user.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconUser className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum endereço cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este usuário não possui endereço registrado.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
