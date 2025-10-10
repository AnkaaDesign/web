import React from "react";
import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ServiceOrderFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ServiceOrderGetManyFormData>;
  onFilterChange: (filters: Partial<ServiceOrderGetManyFormData>) => void;
}

export function ServiceOrderFilters({ open, onOpenChange, filters, onFilterChange }: ServiceOrderFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Ordens de Serviço
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar sua busca por ordens de serviço.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="p-4 text-center text-muted-foreground">
            Filter implementation would go here.
            <br />
            This component needs status filters, date ranges, service and task selectors.
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onFilterChange({})} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
