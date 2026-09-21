// web/src/components/cliente/assinatura-termo-dialog.tsx
//
// O ATO. Um diálogo, e não uma página — porque assinar é um ato único e
// deliberado, e porque o dono pede que o diálogo ABRACE o conteúdo (§10).
//
// É a mesma cerimônia de `pages/public/signature/[token].tsx`, MENOS o código.
// A diferença não é comodidade: lá a autenticação do ato é o OTP que chega na
// hora; aqui ela é a SESSÃO, que já foi provada por OTP no login e que o
// servidor relê do banco a cada requisição. `SignatureAuthMethod` ganhou
// `RESPONSIBLE_SESSION` exatamente para registrar essa diferença na evidência —
// e é por isso que o §7 exige uma VARIANTE da cláusula de aceite: a frase
// congelada no PDF dizia que o CONTRATANTE se autentica "por código de uso único
// enviado", e num ato por sessão essa frase seria falsa no instrumento assinado.
//
// ⚠️ ESTA TELA NÃO ESCOLHE A VARIANTE. Quem escolhe é a EMISSÃO, antes de
// congelar bytes — `countersign` recusa envelope pré-reforma justamente porque
// não se converte signatário OTP em signatário de sessão depois. O que chega
// aqui em `declarations` já é o conjunto da variante de sessão: sem `identity`,
// COM `authority`, que é a que de fato importa no tribunal (CC art. 118).
//
// ── O que NÃO existe aqui, e por quê ────────────────────────────────────────
//
//  • Campo de CPF e de cargo: a cerimônia pública os pede porque o link pode ter
//    sido encaminhado e ela precisa provar QUEM está do outro lado. A sessão do
//    portal já provou isso no login.
//  • RECUSA: o §4 não dá rota de recusa ao portal. Oferecer o botão e não ter
//    onde entregá-lo seria pior que não oferecer — a saída honesta é falar com a
//    Ankaa, e é o que o texto diz.
import { useMemo, useState } from "react";
import { IconCheck, IconLoader2, IconShieldCheck } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COMPANY_INFO } from "@/config/company";
import type { PortalPendingSignature } from "@/api-client/portal";

export interface AssinaturaTermoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assinatura: PortalPendingSignature;
  /** Cargo do signatário, para as declarações que o citam (`{cargo}`). */
  cargo: string;
  busy: boolean;
  /** Erro do ato, já em português. Fica no diálogo, junto do botão que falhou. */
  error: string | null;
  /** Recebe as CHAVES das declarações aceitas — é o que a trilha registra. */
  onSign: (declarations: string[]) => void;
}

export function AssinaturaTermoDialog({
  open,
  onOpenChange,
  assinatura,
  cargo,
  busy,
  error,
  onSign,
}: AssinaturaTermoDialogProps) {
  /**
   * UM aceite na tela, TODAS as declarações no servidor.
   *
   * Uma caixa por declaração virava quatro cliques mecânicos sobre o mesmo
   * consentimento. O que tem peso probatório é o TEOR declarado, e ele é
   * registrado por inteiro: `onSign` manda todas as chaves. É a mesma decisão da
   * cerimônia pública, e vale repetir aqui para que as duas não divirjam.
   */
  const [consent, setConsent] = useState(false);

  /**
   * ⚠️ `declaracoes`, em PORTUGUÊS — é como o servidor a chama.
   *
   * O tipo antigo declarava `declarations`, em inglês, e nada disso dava erro
   * de compilação: a lista chegava `undefined`, a seção "Ao assinar, você
   * declara que:" simplesmente não era desenhada, e o ato seguia com ZERO
   * chaves aceitas — um termo sem teor, que é justamente o que tem peso
   * probatório.
   */
  const declarationKeys = useMemo(
    () => (assinatura.declaracoes ?? []).map((d) => d.key),
    [assinatura.declaracoes],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setConsent(false);
        onOpenChange(next);
      }}
    >
      {/* `max-w-2xl` + `overflow-y-auto`: o diálogo abraça o conteúdo e cresce só
          até caber na tela. Num celular o termo é longo e a rolagem é dele, não
          da página atrás. */}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconShieldCheck className="h-5 w-5 text-primary" />
            Confirmar assinatura
          </DialogTitle>
          <DialogDescription>
            Orçamento nº {assinatura.envelope?.budgetNumber ?? "—"} · {COMPANY_INFO.name}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[42vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed">
          <p className="font-medium text-foreground">
            Você foi indicado por {COMPANY_INFO.name} para revisar e assinar eletronicamente o
            orçamento nº {assinatura.envelope?.budgetNumber ?? "—"}.
          </p>

          {/* O RELATO DO MÉTODO, e é ele que muda em relação à cerimônia pública.
              A frase precisa ser verdadeira no instrumento: o ato NÃO é
              autenticado por um código enviado agora, é autenticado pela sessão
              — que por sua vez nasceu de um código de uso único no login. Dizer
              as duas metades é o que torna a declaração exata. */}
          <p className="text-muted-foreground">
            Esta assinatura é autenticada pela sua <strong>sessão no portal do cliente</strong>,
            aberta com um código de uso único enviado ao contato do seu cadastro. Não há novo
            código a digitar: a sessão é conferida no servidor a cada requisição e é ela que
            identifica você neste ato.
          </p>

          {(assinatura.declaracoes?.length ?? 0) > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="font-medium text-foreground">Ao assinar, você declara que:</p>
              <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                {assinatura.declaracoes.map((declaration) => (
                  <li key={declaration.key}>
                    {declaration.text.replace("{cargo}", cargo || "{cargo}")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-muted-foreground">
            Serão registrados, para comprovação de autoria e integridade: seu nome, o contato do
            seu cadastro, o identificador da sua sessão, o endereço IP, a data e a hora, e o
            resumo criptográfico (SHA-256) do documento — em trilha de auditoria encadeada,
            anexada ao PDF assinado. O tratamento desses dados tem por finalidade exclusiva a
            comprovação da autoria e da integridade deste documento e o exercício regular de
            direitos, nos termos da Lei nº 13.709/2018 (LGPD), art. 7º, VI e IX.
          </p>

          <p className="text-muted-foreground">
            Se você não é a pessoa indicada, ou se não possui poderes para aprovar este orçamento
            em nome da empresa, <strong>não assine</strong> e entre em contato com a{" "}
            {COMPANY_INFO.name}.
          </p>
        </div>

        {/* Caixa, nunca chave: preferência permanente do dono (§10). */}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
            className="mt-0.5"
            disabled={busy}
          />
          <span className="text-foreground">
            Li e concordo com o termo de aceite eletrônico e com as declarações acima.
          </span>
        </label>

        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="w-full"
          size="lg"
          disabled={busy || !consent || !assinatura.podeAssinarAqui}
          onClick={() => onSign(declarationKeys)}
        >
          {busy ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <IconCheck className="mr-2 h-4 w-4" />
          )}
          Assinar orçamento
        </Button>
      </DialogContent>
    </Dialog>
  );
}
