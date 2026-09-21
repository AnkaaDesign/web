// web/src/components/cliente/portal-inline-field.tsx
//
// A LINHA QUE SE EDITA COM DUPLO CLIQUE — a do portal.
//
// ⛔ NÃO É `ui/detailpage/inline-edit-field.tsx`, e não pode ser: aquele
// componente chama `useAttentionField()`, `usePricingVisible()` e
// `useOptionalAuth()`, e os dois primeiros LANÇAM fora dos provedores do lado
// funcionário — o portal é IRMÃO do `AuthProvider`, não filho. É a mesma razão
// que já impediu `DetailPage` e `DataTable` de entrarem aqui.
//
// O QUE É COPIADO, e de propósito, é o CONTRATO com quem usa:
//
//   · duplo clique (ou Enter/F2 com a linha focada) entra em edição;
//   · Enter grava, Escape descarta, clicar fora grava o que está no campo;
//   · gravou, aparece um "Desfazer" vermelho com contagem regressiva ao lado do
//     valor — e não um toast de canto, que some junto com o lugar onde a coisa
//     aconteceu. Passar o mouse por cima PAUSA a contagem;
//   · a linha inteira é o alvo (`role="button"`, `tabIndex=0`), com o mesmo
//     `cursor-pointer select-none hover:bg-muted` do lado funcionário.
//
// ⛔ POR QUE O FORMULÁRIO SAIU. A identificação do veículo era um `<form>` com
// quatro campos, `Descartar` e `Salvar` — e, por causa dele, a página inteira
// precisava de guarda de navegação, diálogo de "alterações não salvas" e um
// estado `dirty` subindo por três componentes. O cliente que abre o portal no
// pátio para digitar UMA placa não tem por que administrar um formulário: ele
// corrige o campo, e o campo se grava. Sem rascunho não há rascunho a perder.
//
// ⚠️ CADA CAMPO GRAVA SOZINHO. `onCommit` recebe um campo só, e quem o
// implementa manda só ele ao servidor — reenviar os outros três faria o
// `PATCH` percorrer as guardas de unicidade e de documento assinado de valores
// que ninguém tocou.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconArrowBackUp } from "@tabler/icons-react";

import { DetailRow } from "@/components/ui/detail-row";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Quantos segundos o "Desfazer" fica na linha. O mesmo do lado funcionário. */
const UNDO_SECONDS = 5;

export interface PortalInlineFieldProps {
  label: ReactNode;
  /** O valor CRU — o que vai para a API, sem máscara. */
  value: string;
  /** Como ele aparece LIDO (máscara, "não informado" em âmbar). Padrão: o valor. */
  display?: ReactNode;
  canEdit: boolean;
  /** `plate` e `chassis` trazem máscara e caixa alta do `ui/input`. */
  inputType?: "text" | "plate" | "chassis" | "date";
  /**
   * QUANDO O CAMPO É UMA ESCOLHA, e não texto — categoria, implemento.
   *
   * ⚠️ O editor vira `Combobox` e o valor gravado é o VALOR DO ENUM; o rótulo
   * em português é coisa de tela. É por isso que `display` continua sendo do
   * chamador: aqui não se sabe traduzir `REFRIGERATED`.
   *
   * ⚠️ `clearable`: escolher nada é uma resposta legítima — o cadastro nasce
   * sem categoria e sem implemento, e a folha os imprime em branco.
   */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /**
   * A recusa ANTES da rede. Devolve a mensagem, ou `null` quando passa.
   *
   * ⚠️ É também o que decide se o "Desfazer" é ARMADO: um valor anterior que
   * esta função recusaria (o pedido de compra vazio, por exemplo) não pode ser
   * oferecido de volta, senão o desfazer vira um 400 garantido.
   */
  validate?: (value: string) => string | null;
  /** Grava UM campo. Rejeitar deixa a mensagem na linha. */
  onCommit: (value: string) => Promise<void>;
  /** Ajuda mostrada SÓ enquanto se edita — nunca ocupando espaço na leitura. */
  hint?: ReactNode;
  /** O que aparece à direita quando a pessoa não pode editar este campo. */
  lockedHint?: ReactNode;
}

export function PortalInlineField({
  label,
  value,
  display,
  canEdit,
  inputType = "text",
  options,
  placeholder,
  validate,
  onCommit,
  hint,
  lockedHint,
}: PortalInlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [undo, setUndo] = useState<{ previous: string } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Enter/Escape desmontam o input e o React dispara um `blur` fantasma. */
  const settled = useRef(false);

  const pauseUndo = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const clearUndo = useCallback(() => {
    pauseUndo();
    setUndo(null);
    setRemaining(0);
  }, [pauseUndo]);

  const runCountdown = useCallback(() => {
    pauseUndo();
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          pauseUndo();
          setUndo(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [pauseUndo]);

  const resumeUndo = useCallback(() => {
    if (undo && remaining > 0 && !timer.current) runCountdown();
  }, [undo, remaining, runCountdown]);

  useEffect(() => () => pauseUndo(), [pauseUndo]);

  const begin = useCallback(() => {
    if (!canEdit || pending) return;
    clearUndo(); // uma edição nova supera o desfazer pendente
    setErro(null);
    setDraft(value);
    settled.current = false;
    setEditing(true);
  }, [canEdit, pending, clearUndo, value]);

  const gravar = useCallback(
    async (next: string, { arma }: { arma: boolean }) => {
      const limpo = next.trim();
      if (limpo === value.trim()) {
        setEditing(false);
        setErro(null);
        return;
      }

      const recusa = validate?.(limpo) ?? null;
      if (recusa) {
        setErro(recusa);
        return; // continua em edição: o valor culpado fica à vista
      }

      const anterior = value;
      setPending(true);
      setEditing(false);
      try {
        await onCommit(limpo);
        setErro(null);
        // ⚠️ SÓ ARMA O DESFAZER quando o valor anterior é ele mesmo gravável.
        // Ver `validate`.
        if (arma && !(validate?.(anterior.trim()) ?? null)) {
          setUndo({ previous: anterior });
          setRemaining(UNDO_SECONDS);
          runCountdown();
        }
      } catch (error) {
        // O interceptor de `api-client/portal.ts` já toastou; o que fica aqui é
        // o que o toast não sabe fazer: ficar na linha do campo culpado.
        setErro(mensagemDe(error));
      } finally {
        setPending(false);
      }
    },
    [onCommit, validate, value, runCountdown],
  );

  const desfazer = useCallback(
    (previous: string) => {
      clearUndo();
      void gravar(previous, { arma: false });
    },
    [clearUndo, gravar],
  );

  // ── LEITURA ───────────────────────────────────────────────────────────────
  if (!editing) {
    const undoButton = undo ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          desfazer(undo.previous);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseEnter={pauseUndo}
        onMouseLeave={resumeUndo}
        onFocus={pauseUndo}
        onBlur={resumeUndo}
        title="Desfazer alteração"
        className={cn(
          "group/undo inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs font-semibold shadow-sm outline-none",
          "bg-destructive text-destructive-foreground",
          "transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.97]",
          "focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "animate-in fade-in-50 zoom-in-95",
        )}
      >
        <IconArrowBackUp className="h-4 w-4 transition-transform duration-150 group-hover/undo:-translate-x-0.5" />
        <span>Desfazer</span>
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive-foreground/20 px-1.5 text-[11px] font-bold leading-none tabular-nums">
          {remaining}
        </span>
      </button>
    ) : null;

    // ⛔ O LÁPIS SAIU, e por uma razão de ALINHAMENTO, não de gosto.
    //
    // Ele morava no slot `trailing` do `DetailRow` — que é um item de flex, e
    // portanto OCUPA LARGURA mesmo com `opacity-0`. O efeito: em toda linha
    // editável o valor parava ~22 px antes da borda, e as linhas de leitura ao
    // lado (Cliente, Orçamento, Concluído em) terminavam encostadas. Duas
    // colunas de valores desalinhadas dentro do mesmo card, que foi o que o
    // dono viu.
    //
    // ⚠️ A PISTA CONTINUA EXISTINDO, e é a mesma do lado funcionário
    // (`ui/detailpage/inline-edit-field.tsx`): a linha inteira muda de fundo no
    // hover, o cursor vira ponteiro e o `title` diz "Duplo clique para editar".
    // Lá também NÃO há lápis parado — a régua já era essa.
    const trailing = undoButton ?? (canEdit ? undefined : lockedHint ?? undefined);

    return (
      <div className="space-y-1">
        <DetailRow
          label={label}
          value={display ?? (value || undefined)}
          trailing={trailing}
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          title={canEdit ? "Duplo clique para editar" : undefined}
          onDoubleClick={canEdit ? begin : undefined}
          onKeyDown={
            canEdit
              ? (e) => {
                  if (e.key === "Enter" || e.key === "F2") {
                    e.preventDefault();
                    begin();
                  }
                }
              : undefined
          }
          className={cn(
            "group/inline",
            canEdit &&
              "cursor-pointer select-none outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-border",
            pending && "pointer-events-none opacity-60",
          )}
        />
        {erro ? (
          <p className="px-4 text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    );
  }

  // ── EDIÇÃO ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-1">
      <DetailRow
        label={label}
        value={
          inputType === "date" ? (
            /* ⚠️ DATA É O `DateTimeInput` DA CASA — o mesmo do diálogo de
               pedido de compra, com calendário e digitação em dd/mm/aaaa. O
               valor que trafega continua sendo STRING ISO, para que `onCommit`
               e o "Desfazer" não precisem saber o tipo. */
            <DateTimeInput
              mode="date"
              value={draft ? new Date(draft) : null}
              onChange={(next) => {
                const iso = next instanceof Date ? next.toISOString() : "";
                setDraft(iso);
                settled.current = true;
                void gravar(iso, { arma: true });
              }}
              disabled={pending}
              className="h-8 w-[16rem] max-w-full"
            />
          ) : options ? (
            <Combobox
              // ⚠️ `open` inicial: o duplo clique já é a intenção de trocar — abrir
              // a lista junto poupa um clique e deixa o campo pronto para o
              // teclado, como o editor de texto que abre focado.
              value={draft}
              onValueChange={(next) => {
                const escolhido = typeof next === "string" ? next : "";
                setDraft(escolhido);
                settled.current = true;
                void gravar(escolhido, { arma: true });
              }}
              mode="single"
              options={options}
              getOptionLabel={(o) => o.label}
              getOptionValue={(o) => o.value}
              placeholder={placeholder ?? "Selecionar"}
              searchable={false}
              clearable
              disabled={pending}
              className="h-8 w-[16rem] max-w-full"
            />
          ) : (
          <Input
            autoFocus
            type={inputType}
            value={draft}
            placeholder={placeholder}
            disabled={pending}
            onChange={(v) => setDraft(typeof v === "string" ? v : "")}
            onBlur={() => {
              if (settled.current) return; // Enter/Escape já resolveram
              settled.current = true;
              void gravar(draft, { arma: true });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                settled.current = true;
                void gravar(draft, { arma: true });
              } else if (e.key === "Escape") {
                e.preventDefault();
                settled.current = true;
                setErro(null);
                setEditing(false);
              }
            }}
            className="h-8 w-[16rem] max-w-full"
          />
          )
        }
      />
      {erro ? (
        <p className="px-4 text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : hint ? (
        <p className="px-4 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** A frase do servidor quando ela existe — ela nomeia o valor culpado. */
function mensagemDe(error: unknown): string {
  const resposta = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (typeof resposta === "string" && resposta.trim()) return resposta;
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar. Tente de novo.";
}
