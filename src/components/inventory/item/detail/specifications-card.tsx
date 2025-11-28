import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInfoCircle, IconBarcode, IconFingerprint, IconCertificate, IconTruck, IconBox } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { cn } from "@/lib/utils";
import { MeasureDisplayFull } from "../common/measure-display";

interface SpecificationsCardProps {
  item: Item;
  className?: string;
}

export function SpecificationsCard({ item, className }: SpecificationsCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Especificações Técnicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Product Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Produto</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Marca</span>
                <span className="text-sm font-semibold text-foreground">{item.brand ? item.brand.name : <span className="text-muted-foreground italic">Não definida</span>}</span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.category ? item.category.name : <span className="text-muted-foreground italic">Não definida</span>}
                </span>
              </div>
              {item.supplier && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                  <span className="text-sm font-semibold text-foreground">{item.supplier.fantasyName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Identification Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {item.uniCode && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <IconFingerprint className="h-4 w-4" />
                    Código Universal
                  </p>
                  <p className="text-base bg-muted/50 rounded px-3 py-2 w-fit text-foreground">{item.uniCode}</p>
                </div>
              )}

              {item.ppeCA && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <IconCertificate className="h-4 w-4" />
                    Certificado de Aprovação (CA)
                  </p>
                  <p className="text-base bg-muted/50 rounded px-3 py-2 w-fit text-foreground">{item.ppeCA}</p>
                </div>
              )}

              {item.barcodes && item.barcodes.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <IconBarcode className="h-4 w-4" />
                    Códigos de Barras
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.barcodes.map((barcode, index) => (
                      <p key={index} className="text-base bg-muted/50 rounded px-3 py-2 text-foreground">
                        {barcode}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Measures Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Medidas e Dimensões</h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <MeasureDisplayFull item={item} />
            </div>
          </div>

          {/* Packaging Section */}
          {item.boxQuantity !== null && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Embalagem</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBox className="h-4 w-4" />
                  Unidades por Caixa
                </span>
                <span className="text-base font-semibold text-foreground">{item.boxQuantity}</span>
              </div>
            </div>
          )}

          {/* Logistics Section */}
          {item.estimatedLeadTime !== null && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Logística</h3>
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-2 flex items-center gap-2">
                  <IconTruck className="h-4 w-4" />
                  Prazo de Entrega Estimado
                </p>
                <p className="text-base font-semibold text-foreground">{item.estimatedLeadTime} dias</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
