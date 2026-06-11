import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconColorPicker, IconLoader2, IconPalette } from "@tabler/icons-react";
import { createPaint } from "../../../api-client";
import type { Paint } from "../../../types";
import { PAINT_FINISH, TRUCK_MANUFACTURER } from "../../../constants";
import { NameInput } from "./name-input";
import { FinishSelector } from "./finish-selector";
import { PaintTypeSelector } from "./paint-type-selector";
import { PaintBrandSelector } from "./brand-selector";
import { ManufacturerSelector } from "./manufacturer-selector";
import { AdvancedColorPicker } from "./advanced-color-picker";

// Minimal subset of paintCreateSchema — only what the API requires plus
// the optional fields that make sense without the full catalog wizard
const paintQuickCreateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  finish: z.enum(Object.values(PAINT_FINISH) as [string, ...string[]], {
    errorMap: () => ({ message: "Selecione o acabamento" }),
  }),
  paintTypeId: z.string().uuid("Selecione o tipo de tinta"),
  paintBrandId: z.string().uuid().nullable().optional(),
  manufacturer: z
    .enum(Object.values(TRUCK_MANUFACTURER) as [string, ...string[]])
    .nullable()
    .optional(),
});

type PaintQuickCreateFormData = z.infer<typeof paintQuickCreateSchema>;

interface PaintQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the name field (e.g. the search text typed in a selector) */
  initialName?: string;
  onPaintCreated: (paint: Paint) => void;
  /** Optional context-specific subtitle shown under the title */
  description?: string;
}

export function PaintQuickCreateDialog({
  open,
  onOpenChange,
  initialName,
  onPaintCreated,
  description,
}: PaintQuickCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaintQuickCreateFormData>({
    resolver: zodResolver(paintQuickCreateSchema),
    mode: "onTouched",
    defaultValues: {
      name: initialName || "",
      hex: "#000000",
      paintBrandId: null,
      manufacturer: null,
    },
  });

  // Re-seed the form each time the dialog opens with a fresh search term
  useEffect(() => {
    if (open) {
      form.reset({
        name: initialName || "",
        hex: "#000000",
        paintBrandId: null,
        manufacturer: null,
      });
    }
  }, [open, initialName]);

  const handleSubmit = async (data: PaintQuickCreateFormData) => {
    setIsSubmitting(true);
    try {
      // api-client interceptor handles success/error toasts
      const response = await createPaint(data as any, {
        include: { paintType: true, paintBrand: true },
      } as any);
      if (response.success && response.data) {
        onPaintCreated(response.data);
        onOpenChange(false);
      }
    } catch {
      // error toast already shown by the api-client interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPalette className="h-5 w-5" />
            Cadastrar Nova Tinta
          </DialogTitle>
          <DialogDescription>
            {description ||
              "Informe os dados básicos da nova tinta. Fórmulas podem ser cadastradas depois no catálogo de tintas."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              // Keep submission scoped to this dialog when nested in another form
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            <NameInput control={form.control} disabled={isSubmitting} required />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PaintTypeSelector control={form.control} disabled={isSubmitting} required />
              <FinishSelector control={form.control} disabled={isSubmitting} required />
              <FormField
                control={form.control}
                name="hex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconColorPicker className="h-4 w-4" />
                      Cor da Tinta
                      <span className="text-destructive ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <AdvancedColorPicker
                        color={field.value || "#000000"}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PaintBrandSelector control={form.control} disabled={isSubmitting} />
              <ManufacturerSelector control={form.control} disabled={isSubmitting} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar Tinta
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
