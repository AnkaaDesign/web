import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function CorporateNameInput() {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name="corporateName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Razão Social <span className="text-red-500">*</span>
          </FormLabel>
          <FormControl>
            <Input {...field} placeholder="Digite a razão social da empresa" autoComplete="organization" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
