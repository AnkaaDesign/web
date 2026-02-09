import { useState, useRef, useEffect } from "react";
import { PhotoshopPicker } from "react-color";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconPalette } from "@tabler/icons-react";
import "./color-picker.css";

interface AdvancedColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  className?: string;
  popoverSide?: "top" | "right" | "bottom" | "left";
  popoverAlign?: "start" | "center" | "end";
}

export function AdvancedColorPicker({
  color,
  onChange,
  disabled,
  className,
  popoverSide: _popoverSide = "bottom",
  popoverAlign = "start"
}: AdvancedColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempColor, setTempColor] = useState(color);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempColor(color);
  }, [color]);

  // Translate picker texts when it opens
  useEffect(() => {
    if (isOpen && pickerRef.current) {
      const translatePicker = () => {
        const picker = pickerRef.current?.querySelector(".photoshop-picker");
        if (picker) {
          // Translate "new" and "current" labels
          const spans = picker.querySelectorAll("span");
          spans.forEach((span) => {
            if (span.textContent === "new") {
              span.textContent = "novo";
            } else if (span.textContent === "current") {
              span.textContent = "atual";
            }
          });

          // Translate buttons
          const buttons = picker.querySelectorAll("button");
          buttons.forEach((button) => {
            if (button.textContent === "Accept") {
              button.textContent = "OK";
            } else if (button.textContent === "Cancel") {
              button.textContent = "Cancelar";
            }
          });
        }
      };

      // Use a small delay to ensure DOM is ready
      const timer = setTimeout(translatePicker, 0);

      // Also observe for any changes
      const observer = new MutationObserver(translatePicker);
      if (pickerRef.current) {
        observer.observe(pickerRef.current, { childList: true, subtree: true });
      }

      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
  }, [isOpen]);

  const handleAccept = () => {
    onChange(tempColor);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempColor(color);
    setIsOpen(false);
  };

  const handleChange = (newColor: { hex: string }) => {
    setTempColor(newColor.hex);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-all",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !color && "text-muted-foreground",
            "bg-transparent border-border",
            className,
          )}
        >
          <span className="flex-1 text-left">{color || "Selecione uma cor"}</span>
          <IconPalette className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 border-0 w-auto"
        align={popoverAlign}
        side="top"
        sideOffset={8}
        alignOffset={-20}
        avoidCollisions={true}
        collisionPadding={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <div className="photoshop-picker-wrapper" ref={pickerRef}>
          <PhotoshopPicker
            color={tempColor}
            onAccept={handleAccept}
            onCancel={handleCancel}
            onChange={handleChange}
            header="Selecione a cor da tinta"
            className="custom-photoshop-picker"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
