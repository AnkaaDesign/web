import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { IconCalendar } from "@tabler/icons-react";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

interface ExpenseDatePickerProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function ExpenseDatePicker({ control }: ExpenseDatePickerProps) {
  return (
    <FormField
      control={control}
      name="expenseDate"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Data da Despesa *</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !field.value && "text-muted-foreground"
                  )}
                >
                  {field.value ? (
                    formatDate(field.value)
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                  <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={(date) => {
                  // Disable future dates (more than 1 day ahead)
                  const maxDate = new Date();
                  maxDate.setDate(maxDate.getDate() + 1);

                  // Disable dates older than 1 year
                  const minDate = new Date();
                  minDate.setFullYear(minDate.getFullYear() - 1);

                  return date > maxDate || date < minDate;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}