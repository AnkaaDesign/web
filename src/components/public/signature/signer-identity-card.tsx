/**
 * Bloco de identificação do signatário — leitura, não formulário.
 *
 * Nome, CPF, WhatsApp e cargo vêm do cadastro do cliente e o signatário não os
 * escolhe: é isso que dá peso probatório ao código enviado ao telefone. Então
 * eles aparecem como **dados do documento** (rótulo + valor, com fio pontilhado
 * entre as linhas), na mesma tipografia do resto da página, e não como campos
 * editáveis. A conferência dos dígitos que faltam acontece no modal disparado
 * por "Enviar código no WhatsApp".
 *
 * O CPF é impresso com a máscara do §5.9 (`***.456.789-**` — três primeiros e os
 * dois verificadores ocultos, PARECER 00001/2021/CONJUR-CGU/AGU). Antes da
 * conferência a página não conhece o miolo, então a linha mostra a forma
 * inteiramente oculta; depois, os seis dígitos confirmados aparecem no meio.
 */

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IconCircleCheck, IconLock } from "@tabler/icons-react";

interface IdentityRowProps {
  label: string;
  value: ReactNode;
  /** Marca "conferido" à direita do valor. */
  confirmed?: boolean;
}

/**
 * Rótulo e valor na MESMA linha, inclusive no celular.
 *
 * O empilhamento anterior (`flex-col` abaixo de `sm`) transformava 5 dados em 10
 * linhas e fazia o cartão dominar a tela do telefone — que é onde este link quase
 * sempre é aberto. Rótulo curto à esquerda e valor à direita cabem lado a lado
 * até em 320px; só o valor quebra, se precisar.
 */
function IdentityRow({ label, value, confirmed }: IdentityRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {confirmed && (
          <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-green-700">
            <IconCircleCheck className="h-3.5 w-3.5" />
            conferido
          </span>
        )}
      </dd>
    </div>
  );
}

export interface SignerIdentityCardProps {
  name: string;
  /** Já mascarado pela regra do §5.9. */
  cpfDisplay: string;
  phoneDisplay: string;
  cargo: string | null;
  company: string | null;
  /** True depois que os dígitos foram aceitos pela API. */
  confirmed: boolean;
  /** Ações da etapa (enviar código, recusar) — seção separada, com fio acima. */
  children?: ReactNode;
}

export function SignerIdentityCard({
  name,
  cpfDisplay,
  phoneDisplay,
  cargo,
  company,
  confirmed,
  children,
}: SignerIdentityCardProps) {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="font-semibold">Identificação do signatário</h2>
          <p className="text-sm text-muted-foreground">
            Dados do cadastro do cliente. Não podem ser alterados aqui — se algo estiver
            errado, fale com a Ankaa antes de assinar.
          </p>
        </div>

        <dl className="divide-y divide-dashed divide-border border-y border-dashed border-border">
          <IdentityRow label="Nome" value={name} />
          <IdentityRow
            label="CPF"
            value={<span className="tabular-nums">{cpfDisplay}</span>}
            confirmed={confirmed}
          />
          <IdentityRow
            label="WhatsApp"
            value={<span className="tabular-nums">{phoneDisplay}</span>}
            confirmed={confirmed}
          />
          <IdentityRow label="Cargo na empresa" value={cargo?.trim() ? cargo : "—"} />
          {company?.trim() ? <IdentityRow label="Empresa" value={company} /> : null}
        </dl>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <IconLock className="mt-0.5 h-3 w-3 shrink-0" />
          O telefone que recebe o código vem do cadastro e não pode ser trocado por quem
          assina — é o que liga esta assinatura a você.
        </p>

        {children && <div className="border-t border-border pt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}
