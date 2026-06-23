import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconReceipt, IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { Order } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";

interface OrderDocumentsCardProps {
  order: Order;
  className?: string;
}

export function OrderDocumentsCard({
  order,
  className,
}: OrderDocumentsCardProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const { actions } = useFileViewer();

  const receipts = order.receipts || [];
  const hasDocuments = receipts.length > 0;

  const handleFileClick = (file: AnkaaFile) => {
    const index = receipts.findIndex(f => f.id === file.id);
    actions.viewFiles(receipts, index);
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconReceipt className="h-5 w-5 text-muted-foreground" />
          Comprovantes
        </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <IconList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <IconLayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {hasDocuments ? (
          <div className="max-h-[420px] overflow-y-auto">
            <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
              {receipts.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  viewMode={viewMode}
                  onPreview={handleFileClick}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <IconReceipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum comprovante cadastrado</h3>
            <p className="text-sm text-muted-foreground">Este pedido não possui comprovantes anexados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
