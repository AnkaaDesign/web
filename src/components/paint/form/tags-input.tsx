import React, { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { IconX, IconPlus, IconTag } from "@tabler/icons-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TagsInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function TagsInput({ control, disabled, required }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");

  return (
    <FormField
      control={control}
      name="tags"
      render={({ field }) => {
        const tags = Array.isArray(field.value) ? field.value : [];

        const addTag = () => {
          const trimmedValue = inputValue.trim().toLowerCase();
          if (trimmedValue && !tags.includes(trimmedValue)) {
            field.onChange([...tags, trimmedValue]);
            setInputValue("");
          }
        };

        const removeTag = (tagToRemove: string) => {
          field.onChange(tags.filter((tag) => tag !== tagToRemove));
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        };

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              <IconTag className="h-4 w-4" />
              Tags
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
            <FormControl>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={inputValue}
                    onChange={(value) => setInputValue(value as string)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma tag e pressione Enter ou clique em +"
                    disabled={disabled}
                    className="flex-1 bg-transparent"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={addTag}
                          disabled={disabled || !inputValue.trim()}
                          className="border border-border bg-transparent hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                        >
                          <IconPlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{!inputValue.trim() ? "Digite uma tag primeiro" : "Adicionar tag"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge
                        key={`tag-${index}`}
                        variant="secondary"
                        className="flex items-center gap-1.5 text-sm pr-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => !disabled && removeTag(tag)}
                      >
                        <span>{tag}</span>
                        <IconX className="h-3.5 w-3.5" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </FormControl>
            <FormDescription>Tags ajudam a categorizar e encontrar tintas mais facilmente</FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
