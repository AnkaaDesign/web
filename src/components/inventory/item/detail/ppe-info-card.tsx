import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconShieldCheck, IconShirt, IconShoe, IconBoxSeam, IconMask, IconBulb, IconPackage, IconUser, IconCertificate, IconRuler } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { PPE_TYPE_LABELS, PPE_SIZE_LABELS, PPE_DELIVERY_MODE_LABELS, PPE_TYPE } from "../../../../constants";
import { cn } from "@/lib/utils";

interface PpeInfoCardProps {
  item: Item;
  className?: string;
}

const getPpeIcon = (ppeType: PPE_TYPE) => {
  switch (ppeType) {
    case PPE_TYPE.SHIRT:
      return IconShirt;
    case PPE_TYPE.BOOTS:
      return IconShoe;
    case PPE_TYPE.PANTS:
      return IconBoxSeam;
    case PPE_TYPE.MASK:
      return IconMask;
    case PPE_TYPE.SLEEVES:
      return IconBulb;
    default:
      return IconShieldCheck;
  }
};

export function PpeInfoCard({ item, className }: PpeInfoCardProps) {
  if (!item.ppeType) {
    return null;
  }

  const Icon = getPpeIcon(item.ppeType);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconShieldCheck className="h-5 w-5 text-muted-foreground" />
          Informações de EPI
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* PPE Type and Size */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Tipo de EPI</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  Tipo
                </span>
                <span className="text-sm font-semibold text-foreground">{PPE_TYPE_LABELS[item.ppeType]}</span>
              </div>
              {item.ppeSize && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconRuler className="h-4 w-4" />
                    Tamanho
                  </span>
                  <span className="text-sm font-semibold text-foreground">{PPE_SIZE_LABELS[item.ppeSize]}</span>
                </div>
              )}
              {item.ppeCA && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCertificate className="h-4 w-4" />
                    Certificado de Aprovação (CA)
                  </span>
                  <span className="text-sm font-semibold text-foreground">{item.ppeCA}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Configuration */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Configuração de Entrega</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconPackage className="h-4 w-4" />
                  Modo de Entrega
                </p>
                <p className="text-base font-medium text-foreground">{item.ppeDeliveryMode && PPE_DELIVERY_MODE_LABELS[item.ppeDeliveryMode]}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconUser className="h-4 w-4" />
                  Atribuído ao Usuário
                </p>
                <p className="text-base font-medium text-foreground">{item.shouldAssignToUser ? "Sim" : "Não"}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconPackage className="h-4 w-4" />
                  Quantidade Padrão
                </p>
                <p className="text-base font-semibold text-foreground">{item.ppeStandardQuantity}</p>
              </div>

            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
