// web/src/components/cliente/solicitacao/cliente-reaproveitado-dialog.tsx
//
// "ESTE CNPJ JÁ ESTÁ CADASTRADO COMO «X» — USAMOS ESSE CADASTRO."
//
// ⛔ POR QUE ISTO INTERROMPE, em vez de ser um toast que passa.
//
// Até 20/09 digitar o documento de um cliente que já existia devolvia **400**.
// Era um beco: quem abre a requisição CONHECE a empresa, digita o CNPJ dela, e
// a porta fecha sem dizer por onde seguir — porque o cadastro pode estar fora
// do escopo dele, e então nem a lista do combobox o encontra. O que ele fazia
// em seguida era mudar uma letra do nome e criar um SEGUNDO cadastro da MESMA
// empresa, que parte o faturamento em dois (é por isso que esta base já tem
// `POST /customers/merge`).
//
// Agora o servidor REAPROVEITA o cadastro. Só que, com isso, a pessoa digitou
// um nome e a requisição nasceu com OUTRO — e trocar isso em silêncio seria
// pior que a recusa que havia antes: ela ligaria para o comercial perguntando
// por um cliente que não existe. Então a troca é dita, uma vez, em cima do
// caminho de saída, e a navegação para o orçamento só acontece depois de a
// pessoa ver.
//
// ⚠️ Nada foi alterado no cadastro encontrado, e a tela afirma isso: o nome, o
// endereço e as inscrições dele são o registro-mestre da Ankaa, e quem abre a
// requisição não é dono deles. O que o formulário trouxe de diferente foi
// DESCARTADO, não gravado — e dizer só "usamos esse cadastro" deixaria a dúvida
// de se o endereço digitado sobrescreveu alguma coisa.
import { IconBuildingStore } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PortalReusedCustomer } from "@/api-client/portal";

interface ClienteReaproveitadoDialogProps {
  /** `null` = não houve reaproveitamento; o diálogo não existe. */
  reuso: PortalReusedCustomer | null;
  onConfirm: () => void;
}

export function ClienteReaproveitadoDialog({ reuso, onConfirm }: ClienteReaproveitadoDialogProps) {
  if (!reuso) return null;

  const rotulo = reuso.matchedBy === "cnpj" ? "CNPJ" : "CPF";

  return (
    <AlertDialog
      open
      // ⚠️ SEM "cancelar" e sem fechar por fora. Não há o que desfazer: a
      // requisição JÁ foi gravada quando esta tela aparece, e oferecer uma saída
      // que não desfaz nada faria a pessoa acreditar que desfez.
      onOpenChange={(aberto) => {
        if (!aberto) onConfirm();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconBuildingStore className="h-5 w-5" />
            Este {rotulo} já estava cadastrado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                O {rotulo} <span className="font-medium text-foreground">{reuso.document}</span> já
                está cadastrado na Ankaa como{" "}
                <span className="font-medium text-foreground">«{reuso.fantasyName}»</span>. A sua
                requisição foi aberta para esse cadastro — nenhum cliente novo foi criado.
              </p>

              {reuso.typedFantasyName && (
                <p>
                  Você digitou{" "}
                  <span className="font-medium text-foreground">«{reuso.typedFantasyName}»</span>; é
                  pelo nome cadastrado que o orçamento vai aparecer para você e para o comercial.
                </p>
              )}

              <p className="text-muted-foreground">
                Nada foi alterado no cadastro existente. Se algum dado dele estiver
                desatualizado, fale com o comercial da Ankaa.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>Ver a requisição</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
