import React from "react";
import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ServiceOrderFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ServiceOrderGetManyFormData>;
  onFilterChange: (filters: Partial<ServiceOrderGetManyFormData>) => void;
}

export function ServiceOrderFilters({ open, onOpenChange, filters, onFilterChange }: ServiceOrderFiltersProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Filtros de Ordens de Serviço</DialogTitle>
          <DialogDescription>Configure os filtros para refinar sua busca por ordens de serviço.</DialogDescription>
        </DialogHeader>
        <div className="p-4 text-center text-muted-foreground">
          Filter implementation would go here.
          <br />
          This component needs status filters, date ranges, service and task selectors.
        </div>
      </DialogContent>
    </Dialog>
  );
}
