import React from "react";
import type { ServiceOrder } from "../../../../types";
import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { Button } from "@/components/ui/button";
import { IconDownload } from "@tabler/icons-react";

interface ServiceOrderExportProps {
  filters: Partial<ServiceOrderGetManyFormData>;
  currentItems: ServiceOrder[];
  totalRecords: number;
}

export function ServiceOrderExport({ filters, currentItems, totalRecords }: ServiceOrderExportProps) {
  const handleExport = () => {
    // Placeholder export functionality
  };

  return (
    <Button variant="outline" size="default" onClick={handleExport}>
      <IconDownload className="h-4 w-4 mr-2" />
      Exportar
    </Button>
  );
}
