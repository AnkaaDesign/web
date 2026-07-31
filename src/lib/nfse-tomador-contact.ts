// =====================================================
// Contato do tomador que vai para a NFS-e — UMA definição
// =====================================================
//
// Espelha a precedência do servidor (api `nfse-tomador.mapper.ts`), que é o que a
// prefeitura realmente imprime em "Fone/Fax" e "E-Mail" do tomador na DANFSe:
//
//   1. o cadastro do próprio cliente;
//   2. o responsável escolhido para ESTE faturamento (`customerConfig.responsible`);
//   3. (só no servidor) os demais responsáveis ativos, financeiro primeiro.
//
// O passo 3 não existe aqui porque a tela carrega apenas o responsável do config — mas os
// dois primeiros cobrem o caso comum, e sem eles o Resumo e a pré-visualização mostravam
// contato em branco para clientes cujo telefone/e-mail só existe no responsável.
//
// `phones` é ARRAY no cadastro do cliente: a nota leva o primeiro preenchido, e o Resumo
// mostra todos.

interface ContactSource {
  email?: string | null;
  phones?: string[] | null;
}

interface ResponsibleLike {
  email?: string | null;
  phone?: string | null;
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
  responsible?: ResponsibleLike | null,
): TomadorContact {
  const phones = (customerData?.phones ?? []).filter((p) => !!p && p.trim() !== "");
  const phone = phones[0] || responsible?.phone?.trim() || "";
  const email = customerData?.email?.trim() || responsible?.email?.trim() || "";
  return { phone, phones: phones.length > 0 ? phones : phone ? [phone] : [], email };
}
