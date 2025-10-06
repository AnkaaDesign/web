import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconWorld } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "../../../../schemas";

type FormData = CustomerCreateFormData | CustomerUpdateFormData;

interface WebsiteInputProps {
  disabled?: boolean;
}

export function WebsiteInput({ disabled }: WebsiteInputProps) {
  const form = useFormContext<FormData>();

  const formatUrl = (url: string): string => {
    if (!url || url.trim() === "") return "";

    const trimmedUrl = url.trim();

    // If it already has a protocol, return as is
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }

    // Add https://www. if missing
    if (trimmedUrl.startsWith("www.")) {
      return `https://${trimmedUrl}`;
    }

    // Add https://www. to bare domain
    return `https://www.${trimmedUrl}`;
  };

  return (
    <FormField
      control={form.control}
      name="site"
      render={({ field: { value, onChange, onBlur, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconWorld className="h-4 w-4" />
            Website
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="url"
              value={value || ""}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val === "" ? null : val);
              }}
              onBlur={(e) => {
                const val = e.target.value;
                if (val && val.trim() !== "") {
                  const formattedUrl = formatUrl(val);
                  onChange(formattedUrl);
                }
                onBlur?.(e);
              }}
              placeholder="https://www.exemplo.com.br"
              disabled={disabled}
              transparent={true}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
