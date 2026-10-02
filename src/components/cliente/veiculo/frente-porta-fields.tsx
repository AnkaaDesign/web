// web/src/components/cliente/veiculo/frente-porta-fields.tsx
//
// A FRENTE E A PORTA TRASEIRA DO IMPLEMENTO, no portal.
//
// As três faces de sempre (motorista, sapo, traseira) são desenhadas pelo
// `ImplementMeasureForm`, que ainda não conhece a frente — a frente entra no
// sistema interno com o pacote da produção. No portal ela é o que de fato
// importa para o cliente informar: altura e largura do painel da frente, sem
// porta. A porta traseira não é medida, é ESCOLHA: bipartida ou tripartida,
// quantos varões e quantas portinholas.
//
// ⚠️ CENTÍMETROS, como o resto da borda do portal; o servidor divide por 100.
// ⚠️ Os limites são os do servidor (`rearDoorBarCountSchema` 2–4,
// `rearDoorHatchCountSchema` 0–6): oferecer 5 varões seria oferecer um 400.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalRearDoorInput } from "@/api-client/portal";
import { cn } from "@/lib/utils";

/** A frente é UM painel: altura × largura, em centímetros. */
export interface FrenteCm {
  heightCm: number | null;
  widthCm: number | null;
}

export const VAROES_OPCOES = [2, 3, 4] as const;
export const PORTINHOLAS_OPCOES = [0, 1, 2, 3, 4, 5, 6] as const;

export const ABERTURA_OPCOES: Array<{ value: "BIPARTIDA" | "TRIPARTIDA"; label: string }> = [
  { value: "BIPARTIDA", label: "Bipartida" },
  { value: "TRIPARTIDA", label: "Tripartida" },
];

/** `RearDoorLeaves` (leitura) → a palavra da borda do portal (escrita). */
export function aberturaDaLeitura(leaves: string | null | undefined): "BIPARTIDA" | "TRIPARTIDA" | null {
  if (leaves === "BIPARTITE") return "BIPARTIDA";
  if (leaves === "TRIPARTITE") return "TRIPARTIDA";
  return null;
}

/** A frente no formato da borda (`{ height, sections }`), ou `null` se incompleta. */
export function frenteParaPayload(frente: FrenteCm | null | undefined) {
  if (!frente?.heightCm || !frente?.widthCm) return null;
  return {
    height: Math.round(frente.heightCm),
    sections: [{ width: Math.round(frente.widthCm), isDoor: false, doorHeight: null, position: 0 }],
  };
}

/** A porta no formato da borda; `null` quando nada foi escolhido. */
export function portaParaPayload(porta: PortalRearDoorInput | null | undefined): PortalRearDoorInput | null {
  if (!porta) return null;
  const { abertura = null, varoes = null, portinholas = null } = porta;
  if (abertura == null && varoes == null && portinholas == null) return null;
  return { abertura, varoes, portinholas };
}

function Opcoes<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  render = (v) => String(v),
}: {
  label: string;
  options: readonly T[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  disabled?: boolean;
  render?: (value: T) => string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const ativo = value === option;
          return (
            <Button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={ativo}
              variant={ativo ? "default" : "outline"}
              disabled={disabled}
              // Tocar de novo na escolhida desfaz — é como se apaga a resposta.
              onClick={() => onChange(ativo ? null : option)}
              className="h-11 min-w-11 px-4"
            >
              {render(option)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function PortaTraseiraFields({
  value,
  onChange,
  disabled,
  className,
}: {
  value: PortalRearDoorInput | null | undefined;
  onChange: (value: PortalRearDoorInput) => void;
  disabled?: boolean;
  className?: string;
}) {
  const atual = value ?? {};
  return (
    <div className={cn("space-y-4", className)}>
      <Opcoes
        label="Abertura"
        options={ABERTURA_OPCOES.map((o) => o.value)}
        value={atual.abertura ?? null}
        onChange={(abertura) => onChange({ ...atual, abertura })}
        disabled={disabled}
        render={(v) => ABERTURA_OPCOES.find((o) => o.value === v)?.label ?? v}
      />
      <Opcoes
        label="Varões"
        options={VAROES_OPCOES}
        value={atual.varoes ?? null}
        onChange={(varoes) => onChange({ ...atual, varoes })}
        disabled={disabled}
      />
      <Opcoes
        label="Portinholas"
        options={PORTINHOLAS_OPCOES}
        value={atual.portinholas ?? null}
        onChange={(portinholas) => onChange({ ...atual, portinholas })}
        disabled={disabled}
      />
    </div>
  );
}

/** Altura × largura da frente, em centímetros. */
export function FrenteFields({
  value,
  onChange,
  disabled,
  idPrefix,
  className,
}: {
  value: FrenteCm | null | undefined;
  onChange: (value: FrenteCm) => void;
  disabled?: boolean;
  idPrefix: string;
  className?: string;
}) {
  const atual: FrenteCm = value ?? { heightCm: null, widthCm: null };
  const numero = (raw: string): number | null => {
    const n = Number(raw.replace(",", "."));
    return raw.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-frente-altura`} className="text-sm">
          Altura (cm)
        </Label>
        <Input
          id={`${idPrefix}-frente-altura`}
          inputMode="decimal"
          className="h-11 text-base"
          placeholder="Ex.: 260"
          disabled={disabled}
          value={atual.heightCm ?? ""}
          onChange={(raw) => onChange({ ...atual, heightCm: numero(String(raw ?? "")) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-frente-largura`} className="text-sm">
          Largura (cm)
        </Label>
        <Input
          id={`${idPrefix}-frente-largura`}
          inputMode="decimal"
          className="h-11 text-base"
          placeholder="Ex.: 248"
          disabled={disabled}
          value={atual.widthCm ?? ""}
          onChange={(raw) => onChange({ ...atual, widthCm: numero(String(raw ?? "")) })}
        />
      </div>
    </div>
  );
}
