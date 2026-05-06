// Auto-generates a form from a Zod object schema. Supported field shapes:
//   - z.string()                      → text input
//   - z.string().email()              → email input
//   - z.number() / z.number().int()   → number input
//   - z.boolean()                     → switch
//   - z.enum([...])                   → select
//   - z.nativeEnum(...)               → select
//   - Optional / Nullable / Default   → unwrapped recursively
// Anything else falls back to a JSON textarea so configs aren't blocked by an
// unsupported shape.

import { useMemo } from "react";
import { z } from "zod";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

interface DynamicFormFieldProps {
  schema: z.ZodType<unknown>;
  value: unknown;
  onChange: (next: unknown) => void;
}

export function DynamicFormField({ schema, value, onChange }: DynamicFormFieldProps) {
  const fields = useMemo(() => extractFields(schema), [schema]);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Este widget não possui configurações.
      </p>
    );
  }

  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const setField = (name: string, v: unknown) => onChange({ ...obj, [name]: v });

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={obj[field.name]}
          onChange={(v) => setField(field.name, v)}
        />
      ))}
    </div>
  );
}

// ---------- Field extraction ----------

interface FieldDescriptor {
  name: string;
  label: string;
  description?: string;
  kind: "string" | "number" | "boolean" | "enum" | "unknown";
  options?: Array<{ value: string; label: string }>;
  inputType?: "text" | "email" | "number";
  optional?: boolean;
}

function extractFields(schema: z.ZodType<unknown>): FieldDescriptor[] {
  const obj = unwrap(schema);
  const def = (obj as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> } })._def;
  if (def?.typeName !== "ZodObject" || !def.shape) return [];
  const shape = def.shape();
  return Object.entries(shape).map(([name, raw]) => describeField(name, raw));
}

function describeField(name: string, schema: z.ZodTypeAny): FieldDescriptor {
  const optional = isOptional(schema);
  const inner = unwrap(schema);
  const innerDef = (inner as { _def?: { typeName?: string; checks?: Array<{ kind: string }>; values?: unknown[] } })._def;
  const description = (schema._def as { description?: string }).description;
  const label = description ?? humanize(name);
  const typeName = innerDef?.typeName;

  if (typeName === "ZodString") {
    const checks = innerDef?.checks ?? [];
    const isEmail = checks.some((c) => c.kind === "email");
    return { name, label, description, kind: "string", inputType: isEmail ? "email" : "text", optional };
  }
  if (typeName === "ZodNumber") {
    return { name, label, description, kind: "number", inputType: "number", optional };
  }
  if (typeName === "ZodBoolean") {
    return { name, label, description, kind: "boolean", optional };
  }
  if (typeName === "ZodEnum") {
    const values = (innerDef?.values as string[]) ?? [];
    return {
      name,
      label,
      description,
      kind: "enum",
      options: values.map((v) => ({ value: String(v), label: humanize(String(v)) })),
      optional,
    };
  }
  if (typeName === "ZodNativeEnum") {
    const valuesObj = (innerDef as unknown as { values: Record<string, string | number> }).values;
    const entries = Object.entries(valuesObj).filter(([, v]) => typeof v === "string");
    return {
      name,
      label,
      description,
      kind: "enum",
      options: entries.map(([k, v]) => ({ value: String(v), label: humanize(k) })),
      optional,
    };
  }
  return { name, label, description, kind: "unknown", optional };
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema as z.ZodTypeAny & { _def: { typeName: string; innerType?: z.ZodTypeAny } };
  // Strip ZodOptional / ZodNullable / ZodDefault wrappers.
  while (
    current &&
    current._def &&
    ["ZodOptional", "ZodNullable", "ZodDefault", "ZodEffects", "ZodBranded"].includes(
      current._def.typeName,
    ) &&
    current._def.innerType
  ) {
    current = current._def.innerType as typeof current;
  }
  return current;
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const tn = (schema._def as { typeName?: string }).typeName;
  return tn === "ZodOptional" || tn === "ZodNullable" || tn === "ZodDefault";
}

function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ---------- Renderer ----------

interface FieldRowProps {
  field: FieldDescriptor;
  value: unknown;
  onChange: (next: unknown) => void;
}

function FieldRow({ field, value, onChange }: FieldRowProps) {
  if (field.kind === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">{field.label}</Label>
          {field.description && field.description !== field.label && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.kind === "enum" && field.options) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{field.label}</Label>
        <Select value={value == null ? "" : String(value)} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{field.label}</Label>
        <Input
          type="number"
          value={value == null ? "" : (typeof value === "number" ? value : Number(value))}
          onChange={(v) => {
            // The custom Input emits string | number | null
            if (v === null || v === "") {
              onChange(field.optional ? undefined : 0);
            } else {
              const n = typeof v === "number" ? v : Number(v);
              onChange(Number.isFinite(n) ? n : 0);
            }
          }}
        />
      </div>
    );
  }

  if (field.kind === "string") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{field.label}</Label>
        <Input
          type={field.inputType ?? "text"}
          value={value == null ? "" : String(value)}
          onChange={(v) => {
            const s = v == null ? "" : typeof v === "string" ? v : String(v);
            onChange(s || (field.optional ? undefined : ""));
          }}
        />
      </div>
    );
  }

  // Fallback for unsupported shapes — JSON textarea so power users can still configure.
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{field.label}</Label>
      <textarea
        className="w-full text-xs font-mono rounded-md border border-input bg-background px-3 py-2 min-h-[80px]"
        value={value == null ? "" : JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onChange(e.target.value ? JSON.parse(e.target.value) : undefined);
          } catch {
            // Keep raw text in the textarea by not propagating; user fixes JSON.
          }
        }}
      />
    </div>
  );
}
