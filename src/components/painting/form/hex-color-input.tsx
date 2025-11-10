import { useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { AdvancedColorPicker } from "./advanced-color-picker";
import { CanvasNormalMapRenderer } from "../effects/canvas-normal-map-renderer";
import { PAINT_FINISH } from "../../../constants";
import { IconColorPicker } from "@tabler/icons-react";
import "./color-picker.css";

interface HexColorInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function HexColorInput({ control, disabled, required }: HexColorInputProps) {
  // Watch the finish field to apply appropriate effects
  const finish = useWatch({
    control,
    name: "finish",
  });

  return (
    <FormField
      control={control}
      name="hex"
      render={({ field }) => (
        <FormItem className="flex flex-col h-full">
          <FormLabel className="flex items-center gap-2">
            <IconColorPicker className="h-4 w-4" />
            Cor da Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <AdvancedColorPicker color={field.value || "#000000"} onChange={field.onChange} disabled={disabled} />
          </FormControl>
          <FormMessage />

          {/* Color Preview Card with finish effects */}
          <Card className="flex-1 mt-4 overflow-hidden min-h-[200px]">
            {finish ? (
              <CanvasNormalMapRenderer
                baseColor={field.value || "#000000"}
                finish={finish as PAINT_FINISH}
                width={400}
                height={300}
                quality="high"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full transition-colors duration-300" style={{ backgroundColor: field.value || "#000000" }} />
            )}
          </Card>
        </FormItem>
      )}
    />
  );
}
