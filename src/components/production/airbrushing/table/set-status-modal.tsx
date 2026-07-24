import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import type { Airbrushing } from "../../../../types";

// Settable from this modal: the whole lifecycle except CANCELLED, which stays a
// deliberate one-off (the detail page's inline editor still offers it).
const SETTABLE_STATUSES = [
  AIRBRUSHING_STATUS.PREPARATION,
  AIRBRUSHING_STATUS.WAITING_PRODUCTION,
  AIRBRUSHING_STATUS.IN_PRODUCTION,
  AIRBRUSHING_STATUS.COMPLETED,
] as const;

type SettableStatus = (typeof SETTABLE_STATUSES)[number];

const setStatusSchema = z.object({
  status: z.enum(SETTABLE_STATUSES, {
    required_error: "Selecione um status",
  }),
});

type SetStatusFormData = z.infer<typeof setStatusSchema>;

interface SetStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  airbrushings: Airbrushing[];
  onConfirm: (status: SettableStatus) => void;
}

export function SetStatusModal({ open, onOpenChange, airbrushings, onConfirm }: SetStatusModalProps) {
  // Determine the initial status value
  // If all airbrushings have the same status, use that; otherwise leave empty
  const initialStatus = React.useMemo(() => {
    if (airbrushings.length === 0) return undefined;
    const firstStatus = airbrushings[0].status;
    const allSameStatus = airbrushings.every((a) => a.status === firstStatus);
    // Only seed a value the combobox can actually represent. CANCELLED (and any status
    // outside the settable options) must fall back to empty so the field isn't
    // stuck on an out-of-enum value that fails validation silently on submit.
    const settable: string[] = [...SETTABLE_STATUSES];
    return allSameStatus && settable.includes(firstStatus) ? firstStatus : undefined;
  }, [airbrushings]);

  const form = useForm<SetStatusFormData>({
    resolver: zodResolver(setStatusSchema),
    defaultValues: {
      status: initialStatus as any,
    },
  });

  // Reset form with current status when modal opens
  React.useEffect(() => {
    if (open && initialStatus) {
      form.reset({ status: initialStatus as any });
    }
  }, [open, initialStatus, form]);

  const handleSubmit = (data: SetStatusFormData) => {
    onConfirm(data.status);
    onOpenChange(false);
    form.reset();
  };

  const statusOptions: ComboboxOption[] = SETTABLE_STATUSES.map((s) => ({ value: s, label: AIRBRUSHING_STATUS_LABELS[s] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Status</DialogTitle>
          <DialogDescription>
            Selecione o novo status para {airbrushings.length === 1 ? "a aerografia" : `as ${airbrushings.length} aerografias`} selecionada{airbrushings.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={statusOptions}
                      placeholder="Selecione um status"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Confirmar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
