// web/src/components/cliente/solicitacao/step-briefing.tsx
//
// PASSO 2 — O QUE O CLIENTE QUER, NAS PALAVRAS DELE.
//
// `BudgetRequest.briefing` é texto livre de propósito: a requisição NÃO tem
// item, nem serviço, nem preço — isso é do comercial, e é ele quem traduz este
// parágrafo em `BudgetItem`. Pedir ao cliente que escolha serviços de uma lista
// seria pedir que ele adivinhasse o catálogo.
//
// ⚠️ `Textarea` entrega o EVENTO (é um `<textarea>` cru), enquanto `Input`
// entrega o VALOR. As duas convenções convivem nesta mesma tela e trocá-las
// grava `[object Object]` — contrato §10.
import { useFormContext, useWatch } from "react-hook-form";
import { IconMessage2, IconSignature } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { SolicitacaoFormData } from "./solicitacao-schema";

interface StepBriefingProps {
  disabled?: boolean;
}

const BRIEFING_MAX = 5000;

export function SolicitacaoStepBriefing({ disabled }: StepBriefingProps) {
  const { control } = useFormContext<SolicitacaoFormData>();
  const briefing = useWatch({ control, name: "briefing" }) ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconMessage2 className="h-5 w-5" />
            O que você precisa
          </CardTitle>
          <CardDescription>
            Explique o serviço com as suas palavras: o que vai ser feito, em que parte do veículo,
            e qualquer detalhe que ajude o comercial a montar o orçamento. Nada aqui é
            compromisso de preço.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <FormField
            control={control}
            name="briefing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição do serviço</FormLabel>
                <FormControl>
                  {/* ⚠️ EVENTO, não valor. Ver o cabeçalho. */}
                  <Textarea
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    disabled={disabled}
                    rows={8}
                    maxLength={BRIEFING_MAX}
                    placeholder="Ex.: pintura geral do furgão em branco, aplicação da logomarca nas duas laterais e na traseira, faixa refletiva na porta traseira."
                  />
                </FormControl>
                <div className="flex items-start justify-between gap-4">
                  <FormMessage />
                  <span className="shrink-0 pt-1 text-sm text-muted-foreground">
                    {briefing.length}/{BRIEFING_MAX}
                  </span>
                </div>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSignature className="h-5 w-5" />
            Logomarca
          </CardTitle>
          <CardDescription>
            O nome da marca que vai ser aplicada, quando houver. As artes em si entram no passo de
            pintura e arquivos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="logoName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da logomarca</FormLabel>
                <FormControl>
                  {/* ⚠️ VALOR, não evento. */}
                  <Input
                    value={field.value ?? ""}
                    onChange={(value) => field.onChange(value ?? "")}
                    onBlur={field.onBlur}
                    name={field.name}
                    disabled={disabled}
                    placeholder="Opcional"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
