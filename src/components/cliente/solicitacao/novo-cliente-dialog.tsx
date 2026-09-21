// web/src/components/cliente/solicitacao/novo-cliente-dialog.tsx
//
// CADASTRAR O CLIENTE DE DENTRO DO COMBOBOX.
//
// O dono pediu isto com essas palavras: quem abre a requisição não pode ser
// mandado para outra tela para cadastrar quem vai receber o serviço. Então o
// cadastro acontece AQUI, na opção "criar" do próprio combobox, e o cliente
// nasce junto com a requisição (`novoCliente` de §5) — não há POST separado, e
// por isso um envio que falha não deixa cliente órfão para trás.
//
// ⚠️ CNPJ ou CPF é OBRIGATÓRIO (`novoClienteSchema`). `customerQuickCreateSchema`,
// o do sistema interno, não exige — e o cliente sem documento só revela o
// problema na hora da NFS-e, quando o serviço já foi feito.
//
// ⛔ E O DOCUMENTO QUE JÁ EXISTE NÃO É ERRO. Este diálogo NÃO consulta o
// cadastro antes de enviar, e não deve: o cliente procurado pode estar FORA do
// escopo deste contato (`GET /cliente/me/clientes` só devolve o que ele já
// alcança), então uma busca local diria "não existe" sobre um cadastro que
// existe. Quem decide é o servidor, no envio: casou o documento, a requisição
// usa o cadastro que já há, e o assistente mostra qual foi
// (`ClienteReaproveitadoDialog`). O que morreu foi o 400 "já está cadastrado",
// que empurrava a pessoa a inventar um nome levemente diferente e criar o
// SEGUNDO cadastro da mesma empresa.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBuilding, IconLoader2 } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { novoClienteSchema, type NovoClienteFormData } from "./solicitacao-schema";

interface NovoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenche o nome fantasia com o texto pesquisado no combobox. */
  initialName?: string;
  /** Dados já preenchidos, quando o contato reabre para corrigir. */
  initialValues?: NovoClienteFormData | null;
  onConfirm: (data: NovoClienteFormData) => void;
}

const EMPTY: NovoClienteFormData = {
  fantasyName: "",
  corporateName: "",
  cnpj: "",
  cpf: "",
  email: "",
  phone: "",
  city: "",
  state: "",
};

export function NovoClienteDialog({
  open,
  onOpenChange,
  initialName,
  initialValues,
  onConfirm,
}: NovoClienteDialogProps) {
  const form = useForm<NovoClienteFormData>({
    resolver: zodResolver(novoClienteSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(initialValues ?? { ...EMPTY, fantasyName: initialName ?? "" });
    // `initialValues` é recriado a cada render do pai; comparar por identidade
    // reabriria o reset a cada tecla e limparia o que está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName]);

  const handleConfirm = form.handleSubmit((data) => {
    onConfirm(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Diálogo abraça o conteúdo: largura do formulário, não da tela. */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBuilding className="h-5 w-5" />
            Cadastrar cliente
          </DialogTitle>
          <DialogDescription>
            O cliente é criado junto com a requisição. O CNPJ ou o CPF é obrigatório — sem
            documento não é possível emitir a nota depois. Se o documento já estiver
            cadastrado na Ankaa, usamos o cadastro que já existe, sem criar outro.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="fantasyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Nome fantasia</FormLabel>
                  <FormControl>
                    {/* `Input` entrega o VALOR, não o evento (contrato §10). */}
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value ?? "")}
                      onBlur={field.onBlur}
                      placeholder="Como o cliente é conhecido"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="corporateName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Razão social</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value ?? "")}
                      onBlur={field.onBlur}
                      placeholder="Opcional"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        type="cnpj"
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">CPF</FormLabel>
                    <FormControl>
                      <Input
                        type="cpf"
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Telefone</FormLabel>
                    <FormControl>
                      <Input
                        type="phone"
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Cidade</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                        placeholder="Opcional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel className="text-sm">UF</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(String(value ?? "").toUpperCase())}
                        onBlur={field.onBlur}
                        maxLength={2}
                        placeholder="PR"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Usar este cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
