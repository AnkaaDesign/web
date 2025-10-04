import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Globe } from "lucide-react";

export function WebsiteInput() {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name="website"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Website</FormLabel>
          <FormControl>
            <div className="relative">
              <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input {...field} value={field.value || ""} type="url" placeholder="https://www.exemplo.com" className="pl-10" autoComplete="url" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
