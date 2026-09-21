// web/src/components/cliente/pedido-form-dialog.tsx
//
// NOVO PEDIDO DE COMPRA — um número, N veículos.
//
// ── Por que a seleção é em LOTE ─────────────────────────────────────────────
//
// O caso real é "os 20 primeiros no pedido 8842". Antes, o número do pedido era
// TEXTO LIVRE numa coluna do orçamento: cabia uma string e não cabia a relação —
// não dava para dizer quais caminhões daquele orçamento entravam em qual pedido,
// nem para um pedido atravessar dois orçamentos. `PurchaseOrder` existe para
// expressar isso, e esta tela só é útil se deixar marcar vinte de uma vez.
//
// Daí a forma: busca, "marcar os da lista", e lista com caixa. Vinte cliques
// individuais seriam a mesma limitação de antes, só que com mais passos.
//
// ── ⛔ A FROTA VEM PAGINADA, E A BUSCA É DO SERVIDOR ────────────────────────
//
// Este diálogo recebia a frota INTEIRA por prop, e a página que a montava pedia
// `GET /cliente/me/veiculos?take=500` para consegui-la. Duas coisas estavam
// erradas:
//
//  1. o teto de `take` é 100 nos schemas da borda — a tela abria com um toast
//     vermelho de "Parâmetros de consulta inválidos" e a lista vazia;
//  2. mesmo funcionando, a Marquespan tem 358 veículos. Trezentas e cinquenta e
//     oito linhas de JSON, com identidade, layout e andamento de cada uma, para
//     que o navegador filtrasse por uma substring.
//
// Agora a pergunta vai inteira para o `WHERE`: `?searchingFor=` procura por
// série, placa, chassi e número do pedido, e `?semPedido=true` é o filtro que
// sustenta o padrão da tela — "mostre só os que ainda não têm número".
// `meta.totalRecords` é quem sabe o tamanho do universo; a tela nunca o carrega.
//
// ── A SELEÇÃO ATRAVESSA PÁGINA E BUSCA ──────────────────────────────────────
//
// Marcar é um ato acumulativo: quem marca cinco na página 1, procura uma placa e
// marca mais duas está montando UM pedido de sete. Por isso a seleção é um
// `Map` de `taskId → rótulo`, e não um `Set` cruzado com a lista visível — o
// rótulo viaja junto para que os marcados que saíram da página continuem tendo
// nome na conferência de cima.
//
// ── Duplicata não é erro ────────────────────────────────────────────────────
//
// A unicidade é por (cliente, número). Um número que já existe significa
// "acrescente estes veículos àquele pedido", e a tela diz isso ANTES de enviar —
// o rótulo do botão troca. Quem repete o número de propósito é quem está certo.
import { useEffect, useMemo, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconShoppingCartPlus,
} from "@tabler/icons-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import {
  portalErrorMessage,
  portalIdentityOf,
  portalVehicleLabel,
  usePortalCreatePurchaseOrder,
  usePortalVehicles,
  type PortalVehicleDetail,
  type PortalVehicleListParams,
} from "@/api-client/portal";
import { usePortalPedidoPorNumero } from "./usar-pedido-por-numero";

export interface PedidoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * O TAMANHO DA PÁGINA da lista de escolha.
 *
 * Vinte é o lote que o caso real cita ("os 20 primeiros no pedido 8842") e cabe
 * na caixa rolável sem transformar o diálogo numa tabela. O teto do servidor é
 * 100 e não se chega perto dele de propósito: quem procura por placa acha em uma
 * página; quem quer marcar muitos usa "marcar os N da lista" e avança.
 */
const PAGE_SIZE = 20;

/** O número do pedido JÁ amarrado a este veículo, pelos DOIS lados da escrita. */
const pedidoDe = (vehicle: PortalVehicleDetail): string | null => {
  const identity = portalIdentityOf(vehicle);
  return identity?.purchaseOrder?.number?.trim() || identity?.customerOrderNumber?.trim() || null;
};

export function PedidoFormDialog({ open, onOpenChange }: PedidoFormDialogProps) {
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  /**
   * Por padrão a lista mostra só quem AINDA não tem pedido.
   *
   * É o estado em que a pergunta faz sentido: um veículo que já tem número não
   * é o que se está tentando resolver. A caixa abaixo traz os outros de volta
   * para o caso de correção, que existe e é raro — e o filtro é do SERVIDOR
   * (`semPedido`), não um `.filter()` sobre uma página que já veio recortada.
   */
  const [incluirComPedido, setIncluirComPedido] = useState(false);
  /** `taskId → rótulo`. Ver o cabeçalho: a seleção atravessa página e busca. */
  const [selected, setSelected] = useState<Map<string, string>>(() => new Map());
  const [error, setError] = useState<string | null>(null);

  const createPedido = usePortalCreatePurchaseOrder();
  const busy = createPedido.isPending;

  const trimmed = number.trim();
  /** Duplicata reconhecida por CONSULTA, não por uma lista carregada inteira. */
  const existente = usePortalPedidoPorNumero(trimmed);

  const termo = search.trim();

  // Busca nova e filtro novo recomeçam da primeira página: manter `page: 3`
  // sobre um resultado de duas páginas devolveria uma lista vazia que se lê
  // como "nenhum veículo corresponde".
  useEffect(() => {
    setPage(1);
  }, [termo, incluirComPedido]);

  const query = useMemo<PortalVehicleListParams>(
    () => ({
      page,
      take: PAGE_SIZE,
      ...(termo ? { searchingFor: termo } : {}),
      // ⚠️ `undefined` é "sem filtro", e é o que a caixa marcada pede. Mandar
      // `false` seria pedir SÓ os que já têm pedido — o oposto.
      ...(incluirComPedido ? {} : { semPedido: true }),
    }),
    [page, termo, incluirComPedido],
  );

  // Só busca com o diálogo aberto: fechado, o contato não está escolhendo nada.
  const vehicles = usePortalVehicles(query, { enabled: open });
  const visiveis = useMemo(() => vehicles.data?.data ?? [], [vehicles.data]);
  const totalRecords = vehicles.data?.meta?.totalRecords ?? 0;
  const totalPages = Math.max(Math.ceil(totalRecords / PAGE_SIZE), 1);

  const toggle = (taskId: string, label: string) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.set(taskId, label);
      return next;
    });

  /** "Os 20 primeiros": marcar tudo o que está na tela, de uma vez. */
  const selectAllVisible = () =>
    setSelected((current) => {
      const next = new Map(current);
      for (const vehicle of visiveis) next.set(vehicle.id, portalVehicleLabel(vehicle));
      return next;
    });

  const reset = () => {
    setNumber("");
    setIssuedAt(null);
    setSearch("");
    setPage(1);
    setIncluirComPedido(false);
    setSelected(new Map());
    setError(null);
  };

  const canSubmit = !busy && trimmed.length > 0 && selected.size > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createPedido.mutateAsync({
        number: trimmed,
        // `null` e não `undefined`: o campo é opcional e "não informado" é uma
        // resposta legítima — nem todo pedido tem data de emissão registrada.
        issuedAt: issuedAt ? issuedAt.toISOString() : null,
        taskIds: [...selected.keys()],
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      // O interceptor do portal já toastou; isto é a cópia inline, ao lado do
      // botão que falhou, e que não some sozinha em 8 segundos.
      setError(portalErrorMessage(e, "Não foi possível gravar o pedido."));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {/* Abraça o conteúdo e cresce só até caber na tela (§10). */}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido de compra</DialogTitle>
          <DialogDescription>
            Um número de pedido pode cobrir vários veículos. Marque todos os que entram neste.
          </DialogDescription>
        </DialogHeader>

        {/* ── Dados do pedido ─────────────────────────────────────────────── */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              {/* Rótulo no mesmo tamanho do controle ao lado (§10). */}
              <Label htmlFor="pedido-numero" className="text-sm">
                Número do pedido *
              </Label>
              <Input
                id="pedido-numero"
                // ⚠️ `Input` entrega o VALOR, não o evento (§10).
                value={number}
                onChange={(value) => {
                  setError(null);
                  setNumber(String(value ?? ""));
                }}
                placeholder="Ex.: 8842"
                disabled={busy}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pedido-emissao" className="text-sm">
                Emitido em
              </Label>
              <DateTimeInput
                mode="date"
                hideLabel
                value={issuedAt}
                // ⚠️ `DateTimeInput` entrega `Date | DateRange | null`. Em
                // `mode="date"` nunca vem intervalo, mas o tipo permite — o
                // estreitamento é explícito para que uma mudança de modo não
                // grave um objeto onde a API espera uma data.
                onChange={(value) => setIssuedAt(value instanceof Date ? value : null)}
                disabled={busy}
                placeholder="Opcional"
              />
            </div>
          </div>

          {existente ? (
            <p className="text-sm text-muted-foreground">
              Este pedido já existe
              {existente.veiculos?.length
                ? ` e cobre ${existente.veiculos.length} ${existente.veiculos.length === 1 ? "veículo" : "veículos"}`
                : ""}
              . Os veículos marcados serão acrescentados a ele.
            </p>
          ) : null}
        </div>

        {/* ── Veículos ────────────────────────────────────────────────────── */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="pedido-busca" className="text-sm">
              Veículos deste pedido
              {selected.size > 0 ? ` · ${selected.size} marcado${selected.size > 1 ? "s" : ""}` : ""}
            </Label>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                disabled={busy || visiveis.length === 0}
              >
                Marcar os {visiveis.length} da lista
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Map())}
                disabled={busy || selected.size === 0}
              >
                Limpar
              </Button>
            </div>
          </div>

          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pedido-busca"
              value={search}
              onChange={(value) => setSearch(String(value ?? ""))}
              placeholder="Buscar por série, placa, chassi ou pedido"
              className="pl-9"
              disabled={busy}
              autoComplete="off"
            />
          </div>

          {/* Caixa, nunca chave — preferência permanente do dono (§10). */}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={incluirComPedido}
              onCheckedChange={(value) => setIncluirComPedido(value === true)}
              disabled={busy}
            />
            <span className="text-foreground">Mostrar também os que já têm pedido</span>
          </label>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {vehicles.isLoading ? (
              <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Carregando a frota…
              </p>
            ) : visiveis.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                {termo
                  ? "Nenhum veículo corresponde à busca."
                  : incluirComPedido
                    ? "Nenhum veículo na sua frota."
                    : "Todos os seus veículos já têm pedido de compra."}
              </p>
            ) : (
              visiveis.map((vehicle) => {
                const label = portalVehicleLabel(vehicle);
                const numeroExistente = pedidoDe(vehicle);
                return (
                  <label
                    key={vehicle.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(vehicle.id)}
                      onCheckedChange={() => toggle(vehicle.id, label)}
                      className="mt-0.5"
                      disabled={busy}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{label}</span>
                      {/* Rótulo secundário em `text-sm`, e não `text-xs`: rótulo
                          não pode ser menor que o controle ao lado (§10), e o
                          controle aqui é uma `Checkbox`. */}
                      <span className="block truncate text-sm text-muted-foreground">
                        {vehicle.budget
                          ? `Orçamento nº ${vehicle.budget.budgetNumber}`
                          : "Sem orçamento"}
                        {numeroExistente ? ` · já no pedido ${numeroExistente}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* A PAGINAÇÃO, com o TOTAL do universo ao lado.
              É `meta.totalRecords` que responde "quantos ainda estão sem
              número?" — a pergunta que antes custava a frota inteira. */}
          {totalRecords > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {totalRecords === 1 ? "1 veículo" : `${totalRecords} veículos`}
                {incluirComPedido ? "" : " sem pedido"}
                {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}
              </span>
              {totalPages > 1 && (
                <span className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={busy || page <= 1 || vehicles.isFetching}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={busy || page >= totalPages || vehicles.isFetching}
                  >
                    Próxima
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </div>
          )}

          {/* OS MARCADOS QUE SAÍRAM DA TELA continuam nomeados aqui. Sem isto,
              trocar de página faria "7 marcados" virar um número sem rosto — e
              o pedido é um documento: quem assina precisa saber o que assinou. */}
          {selected.size > 0 && (
            <p className="text-sm text-muted-foreground">
              Marcados: {[...selected.values()].join(" · ")}
            </p>
          )}
        </div>

        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : existente ? (
              <IconPlus className="mr-2 h-4 w-4" />
            ) : (
              <IconShoppingCartPlus className="mr-2 h-4 w-4" />
            )}
            {existente ? `Adicionar ao pedido ${existente.number}` : "Criar pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
