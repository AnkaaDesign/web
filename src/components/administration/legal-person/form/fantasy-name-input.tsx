import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function FantasyNameInput() {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name="fantasyName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Nome Fantasia <span className="text-red-500">*</span>
          </FormLabel>
          <FormControl>
            <Input {...field} placeholder="Digite o nome fantasia da empresa" autoComplete="organization" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
