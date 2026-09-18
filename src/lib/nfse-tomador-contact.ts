// =====================================================
// Contato do tomador que vai para a NFS-e — UMA definição
// =====================================================
//
// Espelha a precedência do servidor (api `nfse-tomador.mapper.ts`), que é o que a
// prefeitura realmente imprime em "Fone/Fax" e "E-Mail" do tomador na DANFSe:
//
//   1. o cadastro do próprio cliente;
//   2. (só no servidor) os responsáveis ativos dele, financeiro primeiro.
//
// O degrau que SAIU era "o responsável escolhido para ESTE faturamento"
// (`customerConfig.responsible`), e ele saiu porque a coluna saiu: o pagador não
// elege mais um contato. Quem responde pelo orçamento é `Task.responsibles`, e
// para a nota basta a ordem por função — que ninguém precisa manter em dia.
//
// O passo 2 continua sem existir aqui: a tela não carrega os responsáveis do
// cliente. Numa nota cujo cadastro não tem telefone nem e-mail, o Resumo e a
// pré-visualização mostram o campo vazio e a emissão preenche pelo contato
// financeiro. Preferir um campo em branco a um palpite é o certo aqui — a
// pré-visualização não deve afirmar um telefone que o servidor pode não usar.
//
// `phones` é ARRAY no cadastro do cliente: a nota leva o primeiro preenchido, e o Resumo
// mostra todos.

interface ContactSource {
  email?: string | null;
  phones?: string[] | null;
}

export interface TomadorContact {
  /** Telefone que sai na nota — o primeiro preenchido. */
  phone: string;
  /** Todos os telefones do cadastro, para exibição. */
  phones: string[];
  email: string;
}

export function resolveTomadorContact(
  customerData: ContactSource | null | undefined,
): TomadorContact {
  const phones = (customerData?.phones ?? []).filter((p) => !!p && p.trim() !== "");
  const phone = phones[0] || "";
  const email = customerData?.email?.trim() || "";
  return { phone, phones: phones.length > 0 ? phones : phone ? [phone] : [], email };
}
