import { Button } from "@/components/ui/button";
import { IconArrowsSort } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProductionSortOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "volumeLiters_desc"
  | "volumeLiters_asc"
  | "formula.paint.name_asc"
  | "formula.paint.name_desc"
  | "formula.paint.paintType.name_asc"
  | "formula.paint.paintType.name_desc"
  | "formula.paint.manufacturer_asc"
  | "formula.paint.manufacturer_desc";

interface ProductionSortSelectorProps {
  currentSort: ProductionSortOption;
  onSortChange: (sort: ProductionSortOption) => void;
}

const SORT_OPTIONS: Record<ProductionSortOption, string> = {
  createdAt_desc: "Data (Mais Recente)",
  createdAt_asc: "Data (Mais Antiga)",
  volumeLiters_desc: "Volume (Maior)",
  volumeLiters_asc: "Volume (Menor)",
  "formula.paint.name_asc": "Nome da Tinta (A-Z)",
  "formula.paint.name_desc": "Nome da Tinta (Z-A)",
  "formula.paint.paintType.name_asc": "Tipo de Tinta (A-Z)",
  "formula.paint.paintType.name_desc": "Tipo de Tinta (Z-A)",
  "formula.paint.manufacturer_asc": "Montadora (A-Z)",
  "formula.paint.manufacturer_desc": "Montadora (Z-A)",
};

export function ProductionSortSelector({ currentSort, onSortChange }: ProductionSortSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default" className="group">
          <IconArrowsSort className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-foreground">Ordenar: {SORT_OPTIONS[currentSort]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentSort} onValueChange={(value) => onSortChange(value as ProductionSortOption)}>
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Data de Produção</DropdownMenuLabel>
          <DropdownMenuRadioItem value="createdAt_desc" className="cursor-pointer">
            {SORT_OPTIONS["createdAt_desc"]}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="createdAt_asc" className="cursor-pointer">
            {SORT_OPTIONS["createdAt_asc"]}
          </DropdownMenuRadioItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Volume Produzido</DropdownMenuLabel>
          <DropdownMenuRadioItem value="volumeLiters_desc" className="cursor-pointer">
            {SORT_OPTIONS["volumeLiters_desc"]}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="volumeLiters_asc" className="cursor-pointer">
            {SORT_OPTIONS["volumeLiters_asc"]}
          </DropdownMenuRadioItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Tinta</DropdownMenuLabel>
          <DropdownMenuRadioItem value="formula.paint.name_asc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.name_asc"]}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="formula.paint.name_desc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.name_desc"]}
          </DropdownMenuRadioItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Tipo de Tinta</DropdownMenuLabel>
          <DropdownMenuRadioItem value="formula.paint.paintType.name_asc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.paintType.name_asc"]}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="formula.paint.paintType.name_desc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.paintType.name_desc"]}
          </DropdownMenuRadioItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Montadora</DropdownMenuLabel>
          <DropdownMenuRadioItem value="formula.paint.manufacturer_asc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.manufacturer_asc"]}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="formula.paint.manufacturer_desc" className="cursor-pointer">
            {SORT_OPTIONS["formula.paint.manufacturer_desc"]}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
