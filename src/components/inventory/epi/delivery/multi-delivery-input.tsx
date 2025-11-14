import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash, IconUser, IconPackage } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ItemSelectorDropdown } from "./item-selector-dropdown";
import { UserSelectorDropdown } from "./user-selector-dropdown";

interface MultiDeliveryInputProps {
  control: any;
  disabled?: boolean;
}

export interface MultiDeliveryInputRef {
  addDelivery: () => void;
}

export const MultiDeliveryInput = forwardRef<MultiDeliveryInputRef, MultiDeliveryInputProps>(
  ({ control, disabled }, ref) => {
    const [initialized, setInitialized] = useState(false);
    const lastRowRef = useRef<HTMLDivElement>(null);
    const [selectedUsers, setSelectedUsers] = useState<Map<number, string>>(new Map());

    const { fields, append, remove } = useFieldArray({
      control,
      name: "ppeDeliveries",
    });

    // Initialize with one empty row
    useEffect(() => {
      if (!initialized && fields.length === 0) {
        append({
          userId: "",
          itemId: "",
          quantity: 1,
        });
        setInitialized(true);
      }
    }, [initialized, fields.length, append]);

    const handleAddDelivery = useCallback(() => {
      append({
        userId: "",
        itemId: "",
        quantity: 1,
      });

      // Focus on the new user selector after adding
      setTimeout(() => {
        lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }, [append]);

    const handleRemove = useCallback(
      (index: number) => {
        remove(index);
        // Remove the user from selected users map
        setSelectedUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(index);
          return newMap;
        });
      },
      [remove]
    );

    const handleUserChange = useCallback((index: number, userId: string) => {
      setSelectedUsers((prev) => {
        const newMap = new Map(prev);
        if (userId) {
          newMap.set(index, userId);
        } else {
          newMap.delete(index);
        }
        return newMap;
      });
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addDelivery: handleAddDelivery,
      }),
      [handleAddDelivery]
    );

    const canRemove = fields.length > 1;

    return (
      <div className="space-y-4">
        {/* Deliveries List */}
        {fields.length > 0 && (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                ref={index === fields.length - 1 ? lastRowRef : null}
                className="grid grid-cols-1 md:grid-cols-[1.5fr,2.5fr,150px,auto] gap-4 items-start"
              >
                {/* User Selector */}
                <FormField
                  control={control}
                  name={`ppeDeliveries.${index}.userId`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && (
                        <FormLabel className="flex items-center gap-2">
                          <IconUser className="h-4 w-4" />
                          Funcionário <span className="text-destructive">*</span>
                        </FormLabel>
                      )}
                      <FormControl>
                        <UserSelectorDropdown
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            handleUserChange(index, value || "");
                          }}
                          placeholder="Selecione o funcionário"
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Item Selector */}
                <FormField
                  control={control}
                  name={`ppeDeliveries.${index}.itemId`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && (
                        <FormLabel className="flex items-center gap-2">
                          <IconPackage className="h-4 w-4" />
                          EPI <span className="text-destructive">*</span>
                        </FormLabel>
                      )}
                      <FormControl>
                        <ItemSelectorDropdown
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione o EPI"
                          userId={selectedUsers.get(index)}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quantity Input */}
                <FormField
                  control={control}
                  name={`ppeDeliveries.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel>Quantidade <span className="text-destructive">*</span></FormLabel>}
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={field.value}
                          onChange={(value) => {
                            // Custom Input component passes value directly, not event
                            const numValue = typeof value === 'number' ? value : parseInt(String(value || "1"));
                            if (isNaN(numValue) || numValue < 1) {
                              field.onChange(1);
                            } else if (numValue > 999) {
                              field.onChange(999);
                            } else {
                              field.onChange(numValue);
                            }
                          }}
                          placeholder="Quantidade"
                          className="bg-transparent"
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Trash Button */}
                <FormItem>
                  {index === 0 && <FormLabel className="opacity-0">Ações</FormLabel>}
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(index)}
                      disabled={disabled || !canRemove}
                      className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remover entrega"
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </FormItem>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddDelivery}
          disabled={disabled}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Nova Entrega
        </Button>

        {/* Help Text */}
        {fields.length === 0 && (
          <Alert>
            <AlertDescription>
              Adicione entregas de EPI para os funcionários.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }
);

MultiDeliveryInput.displayName = "MultiDeliveryInput";
