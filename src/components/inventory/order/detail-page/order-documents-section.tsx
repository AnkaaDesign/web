import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconReceipt, IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { Order } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";

interface OrderDocumentsSectionProps {
  order: Order;
}

/**
 * Bare "Comprovantes" gallery — the body of the legacy OrderDocumentsCard without its outer
 * Card/header chrome (the DetailPage section provides the title). Grid/list toggle + click-to-preview
 * via the app-level file viewer. Faithful reproduction of order-documents-card.tsx.
 */
export function OrderDocumentsSection({ order }: OrderDocumentsSectionProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const { actions } = useFileViewer();

  const receipts = order.receipts || [];

  const handleFileClick = (file: AnkaaFile) => {
    const index = receipts.findIndex((f) => f.id === file.id);
    actions.viewFiles(receipts, index);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
          <IconList className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
          <IconLayoutGrid className="h-4 w-4" />
        </Button>
      </div>
      {receipts.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto">
          <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
            {receipts.map((file) => (
              <FileItem key={file.id} file={file} viewMode={viewMode} onPreview={handleFileClick} />
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
    </div>
  );
}
