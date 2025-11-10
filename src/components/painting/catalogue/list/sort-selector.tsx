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

export type SortOption = "finish" | "color" | "paintBrand" | "manufacturer" | "name" | "type";

interface SortSelectorProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const SORT_OPTIONS: Record<SortOption, string> = {
  finish: "Acabamento",
  color: "Cor",
  paintBrand: "Marca",
  manufacturer: "Montadora",
  name: "Nome",
  type: "Tipo",
};

export function SortSelector({ currentSort, onSortChange }: SortSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default" className="group">
          <IconArrowsSort className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-foreground">Ordenar: {SORT_OPTIONS[currentSort]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentSort} onValueChange={(value) => onSortChange(value as SortOption)}>
          {Object.entries(SORT_OPTIONS).map(([key, label]) => (
            <DropdownMenuRadioItem key={key} value={key} className="cursor-pointer">
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
