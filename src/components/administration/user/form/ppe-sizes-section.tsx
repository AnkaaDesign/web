import { FormCombobox } from "@/components/ui/form-combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SHIRT_SIZE,
  BOOT_SIZE,
  PANTS_SIZE,
  SLEEVES_SIZE,
  MASK_SIZE,
  GLOVES_SIZE,
  RAIN_BOOTS_SIZE
} from "../../../../constants";
import {
  SHIRT_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "../../../../constants/enum-labels";
import { IconShirt, IconShoe } from "@tabler/icons-react";

interface PpeSizesSectionProps {
  disabled?: boolean;
}

export function PpeSizesSection({ disabled }: PpeSizesSectionProps) {
  // Convert enums to options for dropdowns
  const shirtSizeOptions = Object.values(SHIRT_SIZE).map((size) => ({
    value: size,
    label: SHIRT_SIZE_LABELS[size],
  }));

  const bootSizeOptions = Object.values(BOOT_SIZE).map((size) => ({
    value: size,
    label: BOOT_SIZE_LABELS[size],
  }));

  const pantsSizeOptions = Object.values(PANTS_SIZE).map((size) => ({
    value: size,
    label: PANTS_SIZE_LABELS[size],
  }));

  const sleevesSizeOptions = Object.values(SLEEVES_SIZE).map((size) => ({
    value: size,
    label: SLEEVES_SIZE_LABELS[size],
  }));

  const maskSizeOptions = Object.values(MASK_SIZE).map((size) => ({
    value: size,
    label: MASK_SIZE_LABELS[size],
  }));

  const glovesSizeOptions = Object.values(GLOVES_SIZE).map((size) => ({
    value: size,
    label: GLOVES_SIZE_LABELS[size],
  }));

  const rainBootsSizeOptions = Object.values(RAIN_BOOTS_SIZE).map((size) => ({
    value: size,
    label: RAIN_BOOTS_SIZE_LABELS[size],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconShirt className="h-5 w-5 text-muted-foreground" />
          Tamanhos de EPIs
        </CardTitle>
        <CardDescription>Tamanhos dos equipamentos de proteção individual do colaborador</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Shirts and Pants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormCombobox
            name="ppeSize.shirts"
            label="Camisa"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={shirtSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho da camisa"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
          <FormCombobox
            name="ppeSize.pants"
            label="Calça"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={pantsSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho da calça"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
        </div>

        {/* Row 2: Shorts and Boots */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormCombobox
            name="ppeSize.shorts"
            label="Bermuda"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={pantsSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho da bermuda"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
          <FormCombobox
            name="ppeSize.boots"
            label="Botas"
            icon={<IconShoe className="h-4 w-4 text-muted-foreground" />}
            options={bootSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho das botas"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
        </div>

        {/* Row 3: Rain Boots */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormCombobox
            name="ppeSize.rainBoots"
            label="Galocha"
            icon={<IconShoe className="h-4 w-4 text-muted-foreground" />}
            options={rainBootsSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho da galocha"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
        </div>

        {/* Row 4: Sleeves and Mask */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormCombobox
            name="ppeSize.sleeves"
            label="Manguito"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={sleevesSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho do manguito"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
          <FormCombobox
            name="ppeSize.mask"
            label="Máscara"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={maskSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho da máscara"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
        </div>

        {/* Row 5: Gloves */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormCombobox
            name="ppeSize.gloves"
            label="Luvas"
            icon={<IconShirt className="h-4 w-4 text-muted-foreground" />}
            options={glovesSizeOptions}
            disabled={disabled}
            placeholder="Selecione o tamanho das luvas"
            emptyText="Nenhum tamanho disponível"
            required={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
