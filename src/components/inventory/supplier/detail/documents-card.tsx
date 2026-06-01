import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconFileTypePdf, IconCertificate } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem } from "@/components/common/file";

interface DocumentsCardProps {
  supplier: Supplier;
  className?: string;
  // Extended supplier type that includes document fields (for future use)
  contracts?: AnkaaFile[];
  certificates?: AnkaaFile[];
  otherDocuments?: AnkaaFile[];
}

export function DocumentsCard({
  supplier,
  className,
  contracts = [],
  certificates = [],
  otherDocuments = []
}: DocumentsCardProps) {
  const allDocuments = [...contracts, ...certificates, ...otherDocuments];
  const hasDocuments = allDocuments.length > 0;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {hasDocuments ? (
            <>
              {/* Contracts Section */}
              {contracts.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconFileTypePdf className="h-5 w-5 text-red-500" />
                    Contratos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contracts.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Certificates Section */}
              {certificates.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconCertificate className="h-5 w-5 text-blue-500" />
                    Certificados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {certificates.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Documents Section */}
              {otherDocuments.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconFileText className="h-5 w-5 text-muted-foreground" />
                    Outros Documentos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {otherDocuments.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconFileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum documento cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este fornecedor não possui documentos cadastrados.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
