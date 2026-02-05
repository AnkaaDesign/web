import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatPIS,
  formatCEP,
  formatCurrency,
  formatPercentage,
  formatNumberWithDecimals,
  formatChassis,
  cleanCPF,
  cleanCNPJ,
  cleanPhone,
  cleanPIS,
  cleanCEP,
  cleanNumeric,
  cleanChassis,
  isValidCPF,
  isValidCNPJ,
  isValidPhone,
  isValidPIS,
  parseCurrency,
  formatBrazilianPhone,
} from "../../utils";
import { useCepLookup } from "@/hooks/use-cep-lookup";
import { IconLoader2 } from "@tabler/icons-react";

type InputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "decimal"
  | "currency"
  | "percentage"
  | "cpf"
  | "cnpj"
  | "cpf-cnpj"
  | "phone"
  | "pis"
  | "cep"
  | "date"
  | "time"
  | "rg"
  | "plate"
  | "chassis"
  | "integer"
  | "natural";

interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "maxLength" | "onBlur" | "name"> {
  type?: InputType;
  value?: string | number | null;
  // Support both custom onChange (value) and react-hook-form onChange (event)
  onChange?: ((value: string | number | null) => void) | React.ChangeEventHandler<HTMLInputElement>;
  decimals?: number;
  documentType?: "cpf" | "cnpj";
  onCepLookup?: (data: CepData) => void;
  showCepLoading?: boolean;
  // Natural typing features
  naturalTyping?: boolean;
  typewriterPlaceholder?: boolean;
  typingSpeed?: number;
  onTypingComplete?: () => void;
  withIcon?: boolean;
  transparent?: boolean;
  maxLength?: number; // Handle maxLength in JavaScript to avoid Unicode issues
  // Min/Max for number/decimal/natural/integer types
  min?: number;
  max?: number;
  step?: number;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      value,
      onChange,
      decimals = 2,
      documentType,
      onCepLookup,
      showCepLoading = false,
      // Natural typing props
      naturalTyping = false,
      typewriterPlaceholder = false,
      typingSpeed = 50,
      onTypingComplete,
      withIcon = false,
      transparent = false,
      disabled,
      placeholder,
      min,
      max,
      step,
      onBlur: onBlurProp,
      name: nameProp,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState("");
    const [displayValue, setDisplayValue] = React.useState("");
    const [cursorPosition, setCursorPosition] = React.useState<number | null>(null);
    const [previousCep, setPreviousCep] = React.useState("");

    // Natural typing state
    const [isTyping, setIsTyping] = React.useState(false);
    const [showCursor, setShowCursor] = React.useState(false);
    const [placeholderText, setPlaceholderText] = React.useState("");
    const [isTypingPlaceholder, setIsTypingPlaceholder] = React.useState(false);

    // Refs
    const inputRef = React.useRef<HTMLInputElement>(null);
    const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const cursorTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const placeholderTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const lastKeyRef = React.useRef<string>("");
    const isComposingRef = React.useRef<boolean>(false);

    // CEP lookup hook
    const { lookupCep, isLoading: isCepLoading } = useCepLookup({
      onSuccess: onCepLookup,
    });

    // Merge refs - add empty dependency array to prevent infinite re-renders
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    // Format value based on type
    const formatValue = React.useCallback(
      (val: string | number | null | undefined, inputType: InputType, docType?: "cpf" | "cnpj"): string => {
        if (val === null || val === undefined) return "";

        const strValue = String(val);

        switch (inputType) {
          case "cpf":
            return formatCPF(strValue);
          case "cnpj":
            return formatCNPJ(strValue);
          case "cpf-cnpj":
            return docType === "cnpj" ? formatCNPJ(strValue) : formatCPF(strValue);
          case "phone":
            return formatBrazilianPhone(strValue);
          case "pis":
            return formatPIS(strValue);
          case "cep":
            return formatCEP(strValue);
          case "currency": {
            // Handle currency with improved formatting
            if (typeof val === "number") {
              return formatCurrency(val);
            }
            // Parse string that might already be formatted
            const cleanStr = strValue.replace(/[^\d,-]/g, "").replace(",", ".");
            const numVal = parseFloat(cleanStr);
            if (!isNaN(numVal)) {
              return formatCurrency(numVal);
            }
            // Try parsing as cents
            const cents = parseInt(strValue.replace(/\D/g, ""), 10) || 0;
            return formatCurrency(cents / 100);
          }
          case "percentage": {
            const pctVal = typeof val === "number" ? val : parseFloat(strValue.replace(/[^\d,.-]/g, "").replace(",", "."));
            return isNaN(pctVal) ? "" : formatNumberWithDecimals(pctVal, decimals) + "%";
          }
          case "decimal":
          case "number": {
            const decVal = typeof val === "number" ? val : parseFloat(strValue.replace(/[^\d,.-]/g, "").replace(",", "."));
            if (isNaN(decVal)) return "";
            // For decimal type, keep natural format - don't force decimal places
            // This allows "1" to stay as "1" instead of "1,00"
            if (inputType === "decimal") {
              return decVal.toString().replace(".", ",");
            }
            return formatNumberWithDecimals(decVal, 0);
          }
          case "integer":
          case "natural": {
            const intVal = typeof val === "number" ? val : parseInt(strValue.replace(/[^\d-]/g, ""), 10);
            if (isNaN(intVal)) return "";
            if (inputType === "natural" && intVal < 0) return "0";
            return String(intVal);
          }
          case "plate":
            return strValue.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
          case "chassis":
            return formatChassis(strValue);
          case "rg":
            return strValue.replace(/[^0-9A-Za-z.-]/g, "").slice(0, 15);
          default:
            return strValue;
        }
      },
      [decimals],
    );

    // Clean value to get the actual data value
    const cleanValue = React.useCallback(
      (val: string, inputType: InputType, docType?: "cpf" | "cnpj"): string | number | null => {
        if (!val) return null;

        switch (inputType) {
          case "cpf":
            return cleanCPF(val);
          case "cnpj":
            return cleanCNPJ(val);
          case "cpf-cnpj":
            return docType === "cnpj" ? cleanCNPJ(val) : cleanCPF(val);
          case "phone":
            return cleanPhone(val);
          case "pis":
            return cleanPIS(val);
          case "cep":
            return cleanCEP(val);
          case "currency": {
            // Improved currency parsing
            try {
              // First try using the utility function
              return parseCurrency(val);
            } catch {
              // Fallback to manual parsing
              const cleaned = val.replace(/[^\d,-]/g, "");
              const normalized = cleaned.replace(",", ".");
              const parsed = parseFloat(normalized);
              return isNaN(parsed) ? null : parsed;
            }
          }
          case "percentage": {
            const cleaned = val.replace(/[^\d,.-]/g, "").replace(",", ".");
            const pct = parseFloat(cleaned);
            return isNaN(pct) ? null : pct;
          }
          case "decimal":
          case "number": {
            const cleaned = val.replace(/[^\d,.-]/g, "").replace(",", ".");
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          }
          case "integer": {
            const intVal = parseInt(val.replace(/[^\d-]/g, ""), 10);
            return isNaN(intVal) ? null : intVal;
          }
          case "natural": {
            const natVal = parseInt(val.replace(/\D/g, ""), 10);
            return isNaN(natVal) || natVal < 0 ? null : natVal;
          }
          case "plate":
            return val.toUpperCase().replace(/[^A-Z0-9-]/g, "");
          case "chassis":
            return cleanChassis(val);
          case "rg":
            return val.replace(/[^0-9A-Za-z.-]/g, "");
          default:
            return val;
        }
      },
      [],
    );

    // Helper for simple cursor positioning
    const calculateSimpleCursorPosition = (oldVal: string, newVal: string, oldPos: number): number => {
      // For simple cases, try to maintain relative position
      if (oldPos >= oldVal.length) return newVal.length;

      const ratio = oldPos / oldVal.length;
      return Math.round(ratio * newVal.length);
    };

    // Helper for formatted input cursor positioning (CPF, CNPJ, phone, etc)
    const calculateFormattedCursorPosition = (oldVal: string, newVal: string, oldPos: number): number => {
      // Count digits before cursor in old value
      let digitsBeforeCursor = 0;
      for (let i = 0; i < oldPos && i < oldVal.length; i++) {
        if (/\d/.test(oldVal[i])) digitsBeforeCursor++;
      }

      // Find position in new value after same number of digits
      let newPos = 0;
      let digitsSeen = 0;
      for (let i = 0; i < newVal.length; i++) {
        if (/\d/.test(newVal[i])) {
          digitsSeen++;
          if (digitsSeen === digitsBeforeCursor) {
            newPos = i + 1;
            break;
          }
        }
      }

      return newPos || newVal.length;
    };

    // Advanced cursor position calculation
    const calculateCursorPosition = React.useCallback(
      (
        oldVal: string,
        newVal: string,
        oldPos: number,
        inputType: InputType,
        isDeleting: boolean = false,
        key: string = "",
      ): number => {
        // For text inputs, maintain position
        if (["text", "email", "password"].includes(inputType)) {
          return Math.min(oldPos, newVal.length);
        }

        // Special handling for currency
        if (inputType === "currency") {
          const oldDigits = oldVal.replace(/\D/g, "");
          const newDigits = newVal.replace(/\D/g, "");

          // If deleting
          if (isDeleting || key === "Backspace" || key === "Delete") {
            // Count digits before cursor in old value
            let digitsBeforeCursor = 0;
            for (let i = 0; i < oldPos && i < oldVal.length; i++) {
              if (/\d/.test(oldVal[i])) digitsBeforeCursor++;
            }

            // Adjust for deletion
            if (key === "Backspace" && digitsBeforeCursor > 0) {
              digitsBeforeCursor--;
            }

            // Find position in new value
            let newPos = 0;
            let digitsSeen = 0;
            for (let i = 0; i < newVal.length; i++) {
              if (/\d/.test(newVal[i])) {
                if (digitsSeen === digitsBeforeCursor) {
                  newPos = i;
                  break;
                }
                digitsSeen++;
              }
              newPos = i + 1;
            }

            // Keep cursor after "R$ " prefix
            return Math.max(3, newPos);
          } else {
            // Adding digits
            let digitsTyped = 0;
            for (let i = 0; i < oldPos && i < oldVal.length; i++) {
              if (/\d/.test(oldVal[i])) digitsTyped++;
            }

            // If we added a new digit
            if (newDigits.length > oldDigits.length) {
              digitsTyped = Math.min(digitsTyped + 1, newDigits.length);
            }

            // Find position after the correct number of digits
            let position = 0;
            let digitCount = 0;
            for (let i = 0; i < newVal.length; i++) {
              if (/\d/.test(newVal[i])) {
                digitCount++;
                if (digitCount === digitsTyped) {
                  position = i + 1;
                  break;
                }
              }
            }

            return Math.max(3, position || newVal.length);
          }
        }

        // For other formatted inputs
        const isFormattedInput = ["cpf", "cnpj", "cpf-cnpj", "phone", "pis", "cep"].includes(inputType);
        if (!isFormattedInput) {
          return Math.min(oldPos, newVal.length);
        }

        const oldDigits = oldVal.replace(/\D/g, "");
        const newDigits = newVal.replace(/\D/g, "");

        // Count digits before cursor position in old value
        let digitsBeforeCursor = 0;
        for (let i = 0; i < oldPos && i < oldVal.length; i++) {
          if (/\d/.test(oldVal[i])) digitsBeforeCursor++;
        }

        // Adjust for backspace
        if (isDeleting && key === "Backspace" && digitsBeforeCursor > 0) {
          digitsBeforeCursor--;
        }

        // Adjust if adding digits
        if (!isDeleting && newDigits.length > oldDigits.length) {
          digitsBeforeCursor = Math.min(digitsBeforeCursor + (newDigits.length - oldDigits.length), newDigits.length);
        }

        // Find position in new formatted value
        let position = 0;
        let digitCount = 0;
        for (let i = 0; i < newVal.length; i++) {
          if (/\d/.test(newVal[i])) {
            digitCount++;
            if (digitCount === digitsBeforeCursor) {
              position = i + 1;
              break;
            }
          }
        }

        return position || newVal.length;
      },
      [],
    );

    // Natural typing speed variation
    const getRandomTypingDelay = React.useCallback(() => {
      const baseSpeed = typingSpeed;
      const variation = baseSpeed * 0.3;
      return baseSpeed + (Math.random() - 0.5) * variation;
    }, [typingSpeed]);

    // Update internal value when prop changes (only in controlled mode)
    // Skip when value is undefined - this means the input is uncontrolled (e.g., using react-hook-form register())
    React.useEffect(() => {
      if (value === undefined) {
        return;
      }

      // For currency, handle special formatting
      if (type === "currency") {
        if (!inputRef.current?.matches(":focus")) {
          const cents = value !== null ? Math.round(Number(value) * 100) : 0;

          if (cents === 0) {
            // Keep empty for placeholder
            setInternalValue("");
            if (!naturalTyping || disabled) {
              setDisplayValue("");
            }
          } else {
            // Format the cents value
            const whole = Math.floor(cents / 100);
            const decimal = cents % 100;
            const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            const decimalStr = decimal.toString().padStart(2, "0");
            const formatted = `R$ ${wholeStr},${decimalStr}`;

            setInternalValue(formatted);
            if (!naturalTyping || disabled) {
              setDisplayValue(formatted);
            }
          }
        }
      } else {
        const formatted = formatValue(value, type, documentType);
        setInternalValue(formatted);

        if (!naturalTyping || disabled) {
          setDisplayValue(formatted);
        }
      }
    }, [value, type, documentType, formatValue, naturalTyping, disabled]);

    // Handle CEP lookup
    React.useEffect(() => {
      if (type === "cep" && onCepLookup) {
        const cleanedCep = cleanCEP(internalValue);
        if (cleanedCep.length === 8 && cleanedCep !== previousCep) {
          setPreviousCep(cleanedCep);
          lookupCep(cleanedCep);
        }
      }
    }, [internalValue, type, onCepLookup, lookupCep, previousCep]);

    // Cursor blinking animation for natural typing
    React.useEffect(() => {
      if (!naturalTyping) return;

      const blinkCursor = () => {
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
        }
        cursorTimeoutRef.current = setTimeout(() => {
          setShowCursor((prev) => !prev);
          blinkCursor();
        }, 500);
      };

      if (isTyping || document.activeElement === inputRef.current) {
        setShowCursor(true);
        blinkCursor();
      } else {
        setShowCursor(false);
      }

      return () => {
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
          cursorTimeoutRef.current = null;
        }
      };
    }, [isTyping, naturalTyping]);

    // Typewriter placeholder effect
    React.useEffect(() => {
      if (!typewriterPlaceholder || !placeholder || isTypingPlaceholder) return;

      setIsTypingPlaceholder(true);
      setPlaceholderText("");
      let index = 0;

      const typePlaceholder = () => {
        if (index < placeholder.length) {
          setPlaceholderText((prev) => prev + placeholder[index]);
          index++;
          placeholderTimeoutRef.current = setTimeout(typePlaceholder, getRandomTypingDelay());
        } else {
          setIsTypingPlaceholder(false);
        }
      };

      typePlaceholder();

      return () => {
        if (placeholderTimeoutRef.current) {
          clearTimeout(placeholderTimeoutRef.current);
          placeholderTimeoutRef.current = null;
        }
      };
    }, [placeholder, typewriterPlaceholder, getRandomTypingDelay, isTypingPlaceholder]);

    // Natural typing animation
    React.useEffect(() => {
      const safeValue = internalValue ?? "";

      if (!naturalTyping || disabled) {
        setDisplayValue(safeValue);
        return;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (safeValue === displayValue) {
        setIsTyping(false);
        onTypingComplete?.();
        return;
      }

      setIsTyping(true);

      const typeCharacter = () => {
        setDisplayValue((prev) => {
          if (prev === safeValue) {
            setIsTyping(false);
            onTypingComplete?.();
            return prev;
          }

          const targetLength = safeValue.length;
          const currentLength = prev.length;

          if (currentLength < targetLength) {
            // Adding characters
            const nextChar = safeValue[currentLength];
            const newValue = prev + nextChar;

            if (newValue !== safeValue) {
              typingTimeoutRef.current = setTimeout(typeCharacter, getRandomTypingDelay());
            } else {
              setIsTyping(false);
              onTypingComplete?.();
            }

            return newValue;
          } else if (currentLength > targetLength) {
            // Removing characters (backspace effect)
            const newValue = prev.slice(0, -1);

            if (newValue !== safeValue) {
              typingTimeoutRef.current = setTimeout(typeCharacter, getRandomTypingDelay() * 0.5);
            } else {
              setIsTyping(false);
              onTypingComplete?.();
            }

            return newValue;
          }

          return prev;
        });
      };

      // Start typing with a small delay for more natural feel
      typingTimeoutRef.current = setTimeout(typeCharacter, getRandomTypingDelay());

      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      };
    }, [internalValue, naturalTyping, disabled, getRandomTypingDelay, onTypingComplete, displayValue]);

    // Restore cursor position after formatting
    React.useEffect(() => {
      if (cursorPosition !== null && inputRef.current && !naturalTyping) {
        const supportsSelection = !["email", "number", "date", "time"].includes(getHtmlType());

        if (supportsSelection) {
          // Use setTimeout for currency to ensure React has rendered
          if (type === "currency") {
            setTimeout(() => {
              if (inputRef.current && cursorPosition !== null) {
                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
              }
            }, 0);
          } else {
            try {
              requestAnimationFrame(() => {
                if (inputRef.current) {
                  inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                }
              });
            } catch (e) {
              // Silently ignore if the input type doesn't support selection
            }
          }
        }
      }
    }, [internalValue, cursorPosition, naturalTyping, type]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      lastKeyRef.current = e.key;

      // Special handling for currency input
      if (type === "currency") {
        // Allow control keys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Allow navigation and selection keys
        const allowedKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Tab", "Enter", "Escape", "Backspace", "Delete"];
        if (allowedKeys.includes(e.key)) return;

        // Block decimal separators (they don't make sense in cents-based input)
        if (e.key === "," || e.key === ".") {
          e.preventDefault();
          return;
        }

        // Only allow numbers
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }

      // Special handling for decimal and number inputs
      if (type === "decimal" || type === "number") {
        // Allow control keys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Allow navigation and selection keys
        const allowedKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Tab", "Enter", "Escape", "Backspace", "Delete"];
        if (allowedKeys.includes(e.key)) return;

        // Allow minus for negative numbers (only at the start)
        if (e.key === "-") {
          const input = e.currentTarget;
          const selectionStart = input.selectionStart || 0;
          // Only allow minus at the beginning
          if (selectionStart !== 0 || input.value.includes("-")) {
            e.preventDefault();
          }
          return;
        }

        // Allow decimal separator (comma or period)
        if (e.key === "," || e.key === ".") {
          const input = e.currentTarget;
          // Only allow one decimal separator
          if (input.value.includes(",") || input.value.includes(".")) {
            e.preventDefault();
          }
          return;
        }

        // Only allow numbers
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }

      // Special handling for natural numbers (no negative, no decimal)
      if (type === "natural") {
        // Allow control keys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Allow navigation and selection keys
        const allowedKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Tab", "Enter", "Escape", "Backspace", "Delete"];
        if (allowedKeys.includes(e.key)) return;

        // Block decimal separators and minus
        if (e.key === "," || e.key === "." || e.key === "-") {
          e.preventDefault();
          return;
        }

        // Only allow numbers
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }

      // Special handling for integer (allow negative but no decimal)
      if (type === "integer") {
        // Allow control keys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Allow navigation and selection keys
        const allowedKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Tab", "Enter", "Escape", "Backspace", "Delete"];
        if (allowedKeys.includes(e.key)) return;

        // Allow minus for negative numbers (only at the start)
        if (e.key === "-") {
          const input = e.currentTarget;
          const selectionStart = input.selectionStart || 0;
          // Only allow minus at the beginning
          if (selectionStart !== 0 || input.value.includes("-")) {
            e.preventDefault();
          }
          return;
        }

        // Block decimal separators
        if (e.key === "," || e.key === ".") {
          e.preventDefault();
          return;
        }

        // Only allow numbers
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      handleChange(e as any);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (type === "currency") {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text");

        // Extract digits only and treat as cents
        const digitsOnly = pastedText.replace(/\D/g, "");

        if (digitsOnly) {
          let centsValue = parseInt(digitsOnly, 10);

          // Limit to max safe value
          const maxCents = 99999999999;
          if (centsValue > maxCents) {
            centsValue = maxCents;
          }

          const realValue = centsValue / 100;

          // Format using the same logic as handleChange
          const whole = Math.floor(centsValue / 100);
          const decimal = centsValue % 100;
          const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          const decimalStr = decimal.toString().padStart(2, "0");
          const formatted = `R$ ${wholeStr},${decimalStr}`;

          setInternalValue(formatted);
          setDisplayValue(naturalTyping ? displayValue : formatted);
          onChange?.(realValue);

          // Set cursor to end after paste
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(formatted.length, formatted.length);
            }
          }, 0);
        }
      } else if (type === "cep") {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text");

        // Extract digits only - handles both "86204020" and "86204-020"
        const digitsOnly = pastedText.replace(/\D/g, "");

        if (digitsOnly) {
          // Limit to 8 digits
          const limitedDigits = digitsOnly.slice(0, 8);

          // Format as XXXXX-XXX
          let formatted = "";
          for (let i = 0; i < limitedDigits.length; i++) {
            if (i === 5) formatted += "-";
            formatted += limitedDigits[i];
          }

          setInternalValue(formatted);
          setDisplayValue(naturalTyping ? displayValue : formatted);
          onChange?.(limitedDigits);

          // Set cursor to end after paste
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(formatted.length, formatted.length);
            }
          }, 0);
        }
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      let rawValue = input.value;
      const oldCursorPos = input.selectionStart || 0;
      const isDeleting = lastKeyRef.current === "Backspace" || lastKeyRef.current === "Delete";

      // For basic text inputs, handle simply without formatting
      // IMPORTANT: Don't block onChange during IME composition for text inputs
      // because we're not doing any formatting - just passing the value through
      if (type === "text" || type === "email" || type === "password") {
        // Don't enforce maxLength during typing to avoid interfering with IME composition
        // maxLength will be enforced by schema validation
        setInternalValue(rawValue);
        setDisplayValue(naturalTyping ? displayValue : rawValue);
        setCursorPosition(null);

        if (onChange) {
          // If name prop is provided (e.g., from react-hook-form's register()),
          // pass the event for compatibility. Otherwise pass value directly.
          if (nameProp !== undefined) {
            (onChange as React.ChangeEventHandler<HTMLInputElement>)(e);
          } else {
            (onChange as (value: string | number | null) => void)(rawValue);
          }
        }
        return;
      }

      // For formatted inputs (CPF, phone, etc.), don't process during IME composition
      if (isComposingRef.current) return;

      // Special handling for currency - build from cents
      if (type === "currency") {
        // Check if user is typing at the end (most common case for currency)
        const isTypingAtEnd = oldCursorPos >= rawValue.length;

        // Extract only digits from the raw value
        const digitsOnly = rawValue.replace(/\D/g, "");


        // If empty (all digits removed), clear the field
        if (!digitsOnly) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        // Convert digits to cents value - treat the whole number as cents
        let centsValue = parseInt(digitsOnly, 10);

        // Limit to max safe value (999.999.999,99)
        const maxCents = 99999999999;
        if (centsValue > maxCents) {
          centsValue = maxCents;
        }

        const realValue = centsValue / 100;

        // Format for display using special currency formatting
        const whole = Math.floor(centsValue / 100);
        const decimal = centsValue % 100;
        const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const decimalStr = decimal.toString().padStart(2, "0");
        const formattedValue = `R$ ${wholeStr},${decimalStr}`;

        setInternalValue(formattedValue);
        if (!naturalTyping) {
          setDisplayValue(formattedValue);
        }

        // Calculate cursor position after formatting
        if (isTypingAtEnd) {
          // When typing at the end, keep cursor at end
          setCursorPosition(formattedValue.length);
        } else {
          // When editing in the middle, maintain relative position
          // Count how many digits were before cursor in the raw input
          let targetDigitPosition = 0;
          for (let i = 0; i < oldCursorPos && i < rawValue.length; i++) {
            if (/\d/.test(rawValue[i])) {
              targetDigitPosition++;
            }
          }

          // Position cursor after the same number of digits in formatted value
          let newCursorPos = formattedValue.length;
          let digitsSeen = 0;

          for (let i = 0; i < formattedValue.length; i++) {
            if (/\d/.test(formattedValue[i])) {
              digitsSeen++;
              if (digitsSeen === targetDigitPosition) {
                newCursorPos = i + 1;
                break;
              }
            }
          }

          setCursorPosition(newCursorPos);
        }

        if (onChange) {
          onChange(realValue);
        }
        return;
      }

      // Check if user is typing at the end (common for most inputs)
      const isTypingAtEnd = oldCursorPos >= rawValue.length;

      // Special handling for percentage - similar to currency
      if (type === "percentage") {
        // Extract digits and handle decimal
        const cleanedForPercentage = rawValue.replace(/[^\d.,]/g, "");

        // Check if user typed a decimal separator
        const hasDecimal = cleanedForPercentage.includes(",") || cleanedForPercentage.includes(".");

        if (!cleanedForPercentage || cleanedForPercentage === "," || cleanedForPercentage === ".") {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        let percentValue: number;

        if (hasDecimal) {
          // User explicitly typed decimal - use as-is
          const normalized = cleanedForPercentage.replace(",", ".");
          percentValue = parseFloat(normalized);
        } else {
          // No decimal - treat as percentage value with automatic decimal
          const digits = cleanedForPercentage.replace(/\D/g, "");
          if (digits.length <= 2) {
            // For 1-2 digits, use as whole percentage
            percentValue = parseInt(digits, 10);
          } else {
            // For 3+ digits, insert decimal before last 2 digits
            const wholePart = digits.slice(0, -2);
            const decimalPart = digits.slice(-2);
            percentValue = parseFloat(`${wholePart}.${decimalPart}`);
          }
        }

        if (isNaN(percentValue)) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        // Limit to reasonable percentage (0-9999.99%)
        if (percentValue > 9999.99) {
          percentValue = 9999.99;
        }

        const formattedValue = formatNumberWithDecimals(percentValue, decimals) + "%";

        setInternalValue(formattedValue);
        if (!naturalTyping) {
          setDisplayValue(formattedValue);
        }

        // Position cursor before % sign if typing at end
        const newPos = isTypingAtEnd ? formattedValue.length - 1 : calculateSimpleCursorPosition(rawValue, formattedValue, oldCursorPos);
        setCursorPosition(newPos);

        onChange?.(percentValue);
        return;
      }

      // Special handling for decimal numbers
      if (type === "decimal" || type === "number") {
        const cleanedForNumber = rawValue.replace(/[^\d.,-]/g, "");

        if (!cleanedForNumber || cleanedForNumber === "," || cleanedForNumber === ".") {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        // Convert . to , for Brazilian format display
        let displayValue = cleanedForNumber.replace(/\./g, ",");

        // Only allow one decimal separator
        const commaCount = (displayValue.match(/,/g) || []).length;
        if (commaCount > 1) {
          // Keep only the first comma
          const firstCommaIndex = displayValue.indexOf(",");
          displayValue = displayValue.slice(0, firstCommaIndex + 1) + displayValue.slice(firstCommaIndex + 1).replace(/,/g, "");
        }

        // For parsing, convert comma to dot
        const normalized = displayValue.replace(",", ".");

        const numValue = parseFloat(normalized);

        if (isNaN(numValue)) {
          // Allow partial input like "15," or "15-"
          setInternalValue(displayValue);
          if (!naturalTyping) {
            setDisplayValue(displayValue);
          }
          setCursorPosition(isTypingAtEnd ? displayValue.length : calculateSimpleCursorPosition(rawValue, displayValue, oldCursorPos));
          return;
        }

        // Apply min/max constraints if provided
        // Note: We constrain the value passed to onChange, but keep the displayValue as typed by the user
        // The displayValue will be corrected on blur to match NaturalFloatInput behavior
        let constrainedValue = numValue;
        if (min !== undefined && constrainedValue < min) {
          constrainedValue = min;
        }
        if (max !== undefined && constrainedValue > max) {
          constrainedValue = max;
        }

        // Keep user's input format - don't force decimal places on integers
        setInternalValue(displayValue);
        if (!naturalTyping) {
          setDisplayValue(displayValue);
        }

        const newPos = isTypingAtEnd ? displayValue.length : calculateSimpleCursorPosition(rawValue, displayValue, oldCursorPos);
        setCursorPosition(newPos);

        onChange?.(constrainedValue);
        return;
      }

      // Special handling for phone numbers - ensure proper formatting as user types
      if (type === "phone") {
        // Extract only digits
        const digits = rawValue.replace(/\D/g, "");

        if (!digits) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        // Limit to 11 digits for Brazilian phones
        const limitedDigits = digits.slice(0, 11);

        // Use formatBrazilianPhone for consistent formatting
        const formatted = formatBrazilianPhone(limitedDigits);

        setInternalValue(formatted);
        if (!naturalTyping) {
          setDisplayValue(formatted);
        }

        // Calculate cursor position
        let newPos = formatted.length;
        if (!isTypingAtEnd) {
          let digitsBeforeCursor = 0;
          for (let i = 0; i < oldCursorPos && i < rawValue.length; i++) {
            if (/\d/.test(rawValue[i])) digitsBeforeCursor++;
          }

          let digitsSeen = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              digitsSeen++;
              if (digitsSeen === digitsBeforeCursor) {
                newPos = i + 1;
                break;
              }
            }
          }
        }

        setCursorPosition(newPos);
        onChange?.(limitedDigits);
        return;
      }

      // Special handling for CPF - progressive formatting
      if (type === "cpf") {
        const digits = rawValue.replace(/\D/g, "");

        if (!digits) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        const limitedDigits = digits.slice(0, 11);

        // Format progressively
        let formatted = "";
        for (let i = 0; i < limitedDigits.length; i++) {
          if (i === 3 || i === 6) formatted += ".";
          if (i === 9) formatted += "-";
          formatted += limitedDigits[i];
        }

        setInternalValue(formatted);
        if (!naturalTyping) {
          setDisplayValue(formatted);
        }

        // Maintain cursor position
        const newPos = isTypingAtEnd ? formatted.length : calculateFormattedCursorPosition(rawValue, formatted, oldCursorPos);
        setCursorPosition(newPos);

        onChange?.(limitedDigits);
        return;
      }

      // Special handling for CNPJ - progressive formatting
      if (type === "cnpj") {
        const digits = rawValue.replace(/\D/g, "");

        if (!digits) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        const limitedDigits = digits.slice(0, 14);

        // Format progressively: XX.XXX.XXX/XXXX-XX
        let formatted = "";
        for (let i = 0; i < limitedDigits.length; i++) {
          if (i === 2 || i === 5) formatted += ".";
          if (i === 8) formatted += "/";
          if (i === 12) formatted += "-";
          formatted += limitedDigits[i];
        }

        setInternalValue(formatted);
        if (!naturalTyping) {
          setDisplayValue(formatted);
        }

        const newPos = isTypingAtEnd ? formatted.length : calculateFormattedCursorPosition(rawValue, formatted, oldCursorPos);
        setCursorPosition(newPos);

        onChange?.(limitedDigits);
        return;
      }

      // Special handling for CEP
      if (type === "cep") {
        const digits = rawValue.replace(/\D/g, "");

        if (!digits) {
          setInternalValue("");
          setDisplayValue("");
          setCursorPosition(0);
          onChange?.(null);
          return;
        }

        const limitedDigits = digits.slice(0, 8);

        // Format as XXXXX-XXX
        let formatted = "";
        for (let i = 0; i < limitedDigits.length; i++) {
          if (i === 5) formatted += "-";
          formatted += limitedDigits[i];
        }

        setInternalValue(formatted);
        if (!naturalTyping) {
          setDisplayValue(formatted);
        }

        const newPos = isTypingAtEnd ? formatted.length : calculateFormattedCursorPosition(rawValue, formatted, oldCursorPos);
        setCursorPosition(newPos);

        onChange?.(limitedDigits);
        return;
      }

      // Default handling for other types
      let processedValue = rawValue;

      // For natural numbers, prevent negative values
      if (type === "natural") {
        processedValue = rawValue.replace(/[^\d]/g, "");
      }

      // For integer types, allow negative but no decimals
      if (type === "integer") {
        processedValue = rawValue.replace(/[^\d-]/g, "");
        // Ensure minus sign is only at the beginning
        const minusCount = (processedValue.match(/-/g) || []).length;
        if (minusCount > 1) {
          processedValue = "-" + processedValue.replace(/-/g, "");
        }
      }

      // Clean and validate
      const cleanedValue = cleanValue(processedValue, type, documentType);

      // Format for display
      const formattedValue = formatValue(cleanedValue, type, documentType);

      // Calculate new cursor position
      const newCursorPos = calculateSimpleCursorPosition(
        rawValue,
        formattedValue,
        oldCursorPos
      );

      setInternalValue(formattedValue);
      if (!naturalTyping) {
        setDisplayValue(formattedValue);
      }
      setCursorPosition(newCursorPos);

      if (onChange) {
        onChange(cleanedValue);
      }
    };

    const handleFocus = () => {
      if (naturalTyping) {
        setShowCursor(true);
      }
      // Don't auto-populate currency with 0,00 on focus anymore
      // Let the user start typing from empty
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (naturalTyping) {
        setShowCursor(false);
        setIsTyping(false);
      }

      // Call external onBlur if provided (e.g., from react-hook-form register)
      if (onBlurProp) {
        onBlurProp(e);
      }

      // Ensure proper formatting on blur for currency
      if (type === "currency" && internalValue) {
        const digitsOnly = internalValue.replace(/\D/g, "");
        if (digitsOnly) {
          const cents = parseInt(digitsOnly, 10);
          const whole = Math.floor(cents / 100);
          const decimal = cents % 100;
          const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          const decimalStr = decimal.toString().padStart(2, "0");
          const formatted = `R$ ${wholeStr},${decimalStr}`;
          setInternalValue(formatted);
          setDisplayValue(formatted);
        }
      }

      // Enforce min value on blur for decimal/number inputs
      if ((type === "decimal" || type === "number") && min !== undefined) {
        const normalized = internalValue.replace(",", ".");
        const numValue = parseFloat(normalized);

        // Allow empty values - don't force minimum
        if (internalValue === "" || internalValue === "," || internalValue === ".") {
          setInternalValue("");
          setDisplayValue("");
          onChange?.(null);
        } else if (isNaN(numValue)) {
          // Invalid input - clear the field
          setInternalValue("");
          setDisplayValue("");
          onChange?.(null);
        } else if (numValue < min) {
          // Enforce minimum - keep natural format
          const minDisplay = min.toString().replace(".", ",");
          setInternalValue(minDisplay);
          setDisplayValue(minDisplay);
          onChange?.(min);
        } else if (max !== undefined && numValue > max) {
          // Enforce maximum - keep natural format
          const maxDisplay = max.toString().replace(".", ",");
          setInternalValue(maxDisplay);
          setDisplayValue(maxDisplay);
          onChange?.(max);
        } else {
          // Value is valid - keep it as typed by user (natural format)
          // Don't force decimal places
          setInternalValue(internalValue);
          setDisplayValue(internalValue);
        }
      }

      // Enforce min value on blur for natural numbers
      if (type === "natural" && min !== undefined) {
        const numValue = parseInt(internalValue.replace(/\D/g, ""), 10);

        if (isNaN(numValue) || internalValue === "") {
          // Reset to minimum value if invalid
          const minDisplay = min.toString();
          setInternalValue(minDisplay);
          setDisplayValue(minDisplay);
          onChange?.(min);
        } else if (numValue < min) {
          // Enforce minimum
          const minDisplay = min.toString();
          setInternalValue(minDisplay);
          setDisplayValue(minDisplay);
          onChange?.(min);
        } else if (max !== undefined && numValue > max) {
          // Enforce maximum
          const maxDisplay = max.toString();
          setInternalValue(maxDisplay);
          setDisplayValue(maxDisplay);
          onChange?.(max);
        }
      }

      // Enforce min value on blur for integers
      if (type === "integer" && min !== undefined) {
        const numValue = parseInt(internalValue.replace(/[^\d-]/g, ""), 10);

        if (isNaN(numValue) || internalValue === "") {
          // Reset to minimum value if invalid
          const minDisplay = min.toString();
          setInternalValue(minDisplay);
          setDisplayValue(minDisplay);
          onChange?.(min);
        } else if (numValue < min) {
          // Enforce minimum
          const minDisplay = min.toString();
          setInternalValue(minDisplay);
          setDisplayValue(minDisplay);
          onChange?.(min);
        } else if (max !== undefined && numValue > max) {
          // Enforce maximum
          const maxDisplay = max.toString();
          setInternalValue(maxDisplay);
          setDisplayValue(maxDisplay);
          onChange?.(max);
        }
      }

      // Enforce maxLength on blur for text inputs
      if ((type === "text" || type === "email" || type === "password") && props.maxLength) {
        const input = e.target;
        const value = input.value;
        if (value.length > props.maxLength) {
          const trimmed = value.slice(0, props.maxLength);
          setInternalValue(trimmed);
          setDisplayValue(trimmed);
          if (onChange) {
            onChange(trimmed);
          }
        }
      }

      // Call original onBlur if provided
      props.onBlur?.(e);
    };

    const getInputMode = (): React.InputHTMLAttributes<HTMLInputElement>["inputMode"] => {
      switch (type) {
        case "cpf":
        case "cnpj":
        case "cpf-cnpj":
        case "phone":
        case "pis":
        case "cep":
        case "currency":
        case "number":
        case "integer":
        case "natural":
          return "numeric";
        case "decimal":
        case "percentage":
          return "decimal";
        case "email":
          return "email";
        default:
          return "text";
      }
    };

    const getHtmlType = (): string => {
      switch (type) {
        case "email":
          return "email";
        case "password":
          return "password";
        case "date":
          return "date";
        case "time":
          return "time";
        default:
          return "text";
      }
    };

    const getPlaceholder = (): string => {
      if (typewriterPlaceholder) return placeholderText;
      if (props.placeholder) return props.placeholder;

      switch (type) {
        case "cpf":
          return "000.000.000-00";
        case "cnpj":
          return "00.000.000/0000-00";
        case "cpf-cnpj":
          return documentType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00";
        case "phone":
          return "(00) 00000-0000";
        case "pis":
          return "000.00000.00-0";
        case "cep":
          return "00000-000";
        case "currency":
          return "R$ 0,00";
        case "percentage":
          return "0%";
        case "plate":
          return "ABC1234";
        case "chassis":
          return "9BD 17205 1R 123456";
        case "rg":
          return "12.345.678-9";
        case "integer":
        case "natural":
          return "123";
        default:
          return "";
      }
    };

    const getMaxLength = (): number | undefined => {
      // Don't use native maxLength for text/email/password to avoid Unicode issues
      // We handle maxLength in JavaScript in handleChange instead
      if (type === "text" || type === "email" || type === "password") {
        return undefined;
      }

      if (props.maxLength) return props.maxLength;

      switch (type) {
        case "cpf":
          return 14;
        case "cnpj":
          return 18;
        case "phone":
          return 15;
        case "pis":
          return 14;
        case "cep":
          return 9;
        case "plate":
          return 8;
        case "chassis":
          return 20; // 17 chars + 3 spaces
        case "rg":
          return 15;
        case "currency":
          return 20; // R$ 999.999.999,99
        default:
          return undefined;
      }
    };

    const isDisabled = disabled || (type === "cep" && isCepLoading);

    // Clean up timeouts on unmount
    React.useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
          cursorTimeoutRef.current = null;
        }
        if (placeholderTimeoutRef.current) {
          clearTimeout(placeholderTimeoutRef.current);
          placeholderTimeoutRef.current = null;
        }
      };
    }, []);

    const currentDisplayValue = naturalTyping ? displayValue : internalValue;

    // For simple text/email/password inputs without a value prop (uncontrolled mode with register()),
    // don't set the value attribute - let react-hook-form control it via refs
    const isUncontrolledTextInput = value === undefined && ["text", "email", "password"].includes(type);

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type={getHtmlType()}
          name={nameProp}
          className={cn(
            "flex h-10 w-full rounded-md border border-border px-2 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ease-in-out",
            transparent ? "!bg-transparent" : "bg-input",
            withIcon && "pr-10",
            className,
          )}
          {...(isUncontrolledTextInput ? {} : { value: currentDisplayValue })}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          inputMode={getInputMode()}
          placeholder={getPlaceholder()}
          maxLength={getMaxLength()}
          disabled={isDisabled}
          {...props}
        />

        {/* Animated cursor overlay for natural typing */}
        {naturalTyping && showCursor && (document.activeElement === inputRef.current || isTyping) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-foreground pointer-events-none transition-opacity duration-150"
            style={{
              left: `${Math.max(12, Math.min(12 + currentDisplayValue.length * 8, 90))}px`,
              opacity: showCursor ? 1 : 0,
            }}
          />
        )}

        {/* Loading indicator during typing */}
        {naturalTyping && isTyping && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
          </div>
        )}

        {/* CEP loading indicator */}
        {type === "cep" && showCepLoading && isCepLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };