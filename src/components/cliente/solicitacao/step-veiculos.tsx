// web/src/components/cliente/solicitacao/step-veiculos.tsx
//
// PASSO 3 — OS VEÍCULOS, UM POR LINHA, SEM PRODUTO CARTESIANO.
//
// ⛔ A ARMADILHA QUE ESTE ARQUIVO EXISTE PARA NÃO CAIR.
//
// O formulário interno de orçamento pede "placas" e "números de série" em dois
// campos separados e cria o PRODUTO dos dois (`vehicleCombinations`). No portal
// isso é 400 na cara do cliente: `Task.serialNumber` e `Truck.plate` são
// `@unique` GLOBAIS, então 3 placas × 1 série produz três tarefas disputando a
// mesma série e o servidor recusa a primeira colisão.
//
// Aqui cada veículo é uma LINHA, e cada linha é a tupla explícita
// (série, placa, chassi). A faixa de série é uma CONVENIÊNCIA DE DIGITAÇÃO:
// "1001 a 1005" vira cinco linhas editáveis, e a partir daí elas são cinco
// veículos independentes — nunca um multiplicador.
//
// ⛔ E A MEDIDA DO IMPLEMENTO NÃO MORA NA LINHA.
//
// Ela morava: cada veículo tinha altura e três comprimentos, e quem pedia dez
// caminhões do mesmo modelo digitava os mesmos quatro números dez vezes. É a
// segunda metade da mesma armadilha do produto cartesiano, pelo avesso — ali o
// perigo era COMBINAR o que é de linhas diferentes; aqui era REPETIR o que é do
// lote inteiro, e cada repetição é uma chance de duas linhas divergirem sem
// ninguém ver. Agora a medida é UMA, da requisição, no cartão abaixo da lista, e
// `buildSolicitacaoPayload` a copia para cada veículo no envio.
//
// ⚠️ Quem desenha é o `ImplementMeasureForm` — o MESMO componente do formulário
// interno de tarefa (`task-create-form.tsx`, `task-edit-form.tsx`), com o mesmo
// visual, as mesmas portas e o mesmo "Baixar SVG". Ele não toca em `useAuth`,
// `usePrivileges`, `useFavorites` nem `useAttentionEntity`: só `useTheme`, que
// vive acima de TODA a árvore (`App.tsx`), inclusive do portal.
//
// ⚠️ TRÊS UNIDADES, UMA CONVERSÃO. O formulário guarda CENTÍMETROS; o
// `ImplementMeasureForm` fala METROS nas props; o banco guarda metros e quem
// divide por 100 é o SERVIDOR (contrato §5). As duas conversões desta tela se
// cancelam — ver `medidaLadoParaFormulario`/`medidaLadoDoFormulario`. Uma
// divisão a mais em qualquer ponto não estoura nada: produz um implemento de
// 7,8 centímetros.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  IconAlertCircle,
  IconCar,
  IconHash,
  IconPlus,
  IconRuler2,
  IconTrash,
} from "@tabler/icons-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { IMPLEMENT_TYPE_LABELS, IMPLEMENT_CATEGORY_LABELS } from "@/constants";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { formatPlate } from "@/utils";
import { ImplementMeasureForm } from "@/components/production/implement-measure/implement-measure-form";
import {
  LADO_DO_IMPLEMENTO,
  MAX_VEICULOS,
  ROTULO_DO_LADO,
  expandSerialRange,
  medidaLadoDoFormulario,
  medidaLadoParaFormulario,
  novasMedidas,
  novoVeiculo,
  type LadoImplemento,
  type MedidasFormData,
  type SolicitacaoFormData,
} from "./solicitacao-schema";
import { IMPLEMENT_FACES } from "@/constants/implement-faces";

interface StepVeiculosProps {
  disabled?: boolean;
}

/** O que identifica a linha quando ela está fechada. */
function tituloDaLinha(row: SolicitacaoFormData["veiculos"][number] | undefined, index: number): string {
  const serial = row?.serialNumber?.trim();
  const plate = row?.plate?.trim();
  if (serial && plate) return `Série ${serial} · ${formatPlate(plate)}`;
  if (serial) return `Série ${serial}`;
  if (plate) return formatPlate(plate);
  const chassis = row?.chassisNumber?.trim();
  if (chassis) return `Chassi ${chassis}`;
  return `Veículo ${index + 1}`;
}

export function SolicitacaoStepVeiculos({ disabled }: StepVeiculosProps) {
  const { control, formState } = useFormContext<SolicitacaoFormData>();
  const { fields, append, remove } = useFieldArray({ control, name: "veiculos" });
  const veiculos = useWatch({ control, name: "veiculos" }) ?? [];

  const [faixa, setFaixa] = useState("");
  // Acordeão de EXPANSÃO ÚNICA (preferência permanente do dono). Abre na linha
  // recém-criada: é ali que o contato vai digitar em seguida.
  const [aberto, setAberto] = useState<string | undefined>("veiculo-0");

  // Erro em linha FECHADA seria erro invisível: o `AccordionContent` do Radix
  // desmonta o conteúdo, então nem o `shouldFocus` do react-hook-form alcança o
  // campo. Ao reprovar o passo, a primeira linha com problema se abre sozinha.
  const errosDeVeiculos = formState.errors?.veiculos;
  useEffect(() => {
    if (!Array.isArray(errosDeVeiculos)) return;
    const index = errosDeVeiculos.findIndex(Boolean);
    if (index >= 0) setAberto(`veiculo-${index}`);
  }, [errosDeVeiculos]);

  const erroDaLinha = useCallback(
    (index: number) => {
      const erros = formState.errors?.veiculos as unknown as Array<Record<string, unknown>> | undefined;
      return !!erros?.[index];
    },
    [formState.errors],
  );


  const adicionarFaixa = useCallback(() => {
    const { series, truncated } = expandSerialRange(faixa);
    if (series.length === 0) {
      toast.error("Faixa inválida", 'Digite um número ("1001") ou uma faixa ("1001 a 1005").');
      return;
    }

    const jaUsadas = new Set(
      (veiculos ?? []).map((row) => (row?.serialNumber ?? "").trim().toUpperCase()).filter(Boolean),
    );
    // A linha vazia inicial não é um veículo — é o lugar onde a primeira série
    // cabe. Reaproveitá-la evita a linha em branco pendurada no fim da lista.
    const vazias = (veiculos ?? []).reduce(
      (total, row) =>
        total + (!row?.serialNumber?.trim() && !row?.plate?.trim() && !row?.chassisNumber?.trim() ? 1 : 0),
      0,
    );

    const novas = series.filter((serial) => !jaUsadas.has(serial.toUpperCase()));
    if (novas.length === 0) {
      toast.error("Nada a adicionar", "Todas essas séries já estão na lista.");
      return;
    }

    const espaco = MAX_VEICULOS - (fields.length - vazias);
    const aInserir = novas.slice(0, Math.max(espaco, 0));
    if (aInserir.length === 0) {
      toast.error("Limite de veículos", `Uma requisição comporta até ${MAX_VEICULOS} veículos.`);
      return;
    }

    // ⛔ N LINHAS, e não um multiplicador. Ver o cabeçalho do arquivo.
    if (vazias > 0) {
      // Remove as linhas em branco de trás para a frente, para que os índices
      // que ainda faltam remover não se desloquem no meio do laço.
      for (let i = (veiculos ?? []).length - 1; i >= 0; i--) {
        const row = veiculos[i];
        if (!row?.serialNumber?.trim() && !row?.plate?.trim() && !row?.chassisNumber?.trim()) {
          remove(i);
        }
      }
    }
    aInserir.forEach((serial) => append(novoVeiculo(serial)));

    setFaixa("");
    // Fecha o acordeão: depois de expandir uma faixa o que o contato precisa
    // ver é a LISTA inteira, e não a primeira linha aberta empurrando as outras
    // para fora da tela.
    setAberto(undefined);
    if (truncated || aInserir.length < novas.length) {
      toast.warning(
        "Faixa cortada",
        `Foram adicionados ${aInserir.length} veículos — o limite da requisição é ${MAX_VEICULOS}.`,
      );
    }
  }, [faixa, veiculos, fields.length, append, remove]);

  const totalPreenchido = useMemo(
    () =>
      (veiculos ?? []).filter(
        (row) => row?.serialNumber?.trim() || row?.plate?.trim() || row?.chassisNumber?.trim(),
      ).length,
    [veiculos],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconHash className="h-5 w-5" />
            Adicionar por número de série
          </CardTitle>
          <CardDescription>
            Digite um número ("1001") ou uma faixa ("1001 a 1005"). A faixa vira uma linha por
            veículo, e cada linha recebe a sua própria placa e o seu próprio chassi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              {/* `Label` e não `FormLabel`: este campo NÃO é do formulário — é
                  um auxiliar de digitação, e `FormLabel` exige o contexto de um
                  `FormField` que aqui não existe. */}
              <Label htmlFor="faixa-de-serie">Número ou faixa de série</Label>
              <Input
                id="faixa-de-serie"
                value={faixa}
                onChange={(value) => setFaixa(String(value ?? ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    adicionarFaixa();
                  }
                }}
                disabled={disabled}
                placeholder="1001 a 1005"
                className="mt-2"
              />
            </div>
            <Button type="button" variant="outline" onClick={adicionarFaixa} disabled={disabled}>
              <IconPlus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <IconCar className="h-5 w-5" />
                Veículos
              </CardTitle>
              <CardDescription>
                Cada linha é um veículo. A série, a placa e o chassi de uma linha pertencem ao
                MESMO veículo — a série de uma linha nunca se combina com a placa de outra.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {totalPreenchido} de {fields.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeof formState.errors?.veiculos?.message === "string" && (
            <p className="text-sm font-medium text-destructive">{formState.errors.veiculos.message}</p>
          )}

          <Accordion type="single" collapsible value={aberto} onValueChange={setAberto} className="space-y-3">
            {fields.map((field, index) => {
              const row = veiculos?.[index];
              const comErro = erroDaLinha(index);
              return (
                <AccordionItem
                  key={field.id}
                  value={`veiculo-${index}`}
                  className="rounded-lg border border-border px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-left">
                      {comErro ? (
                        <IconAlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <IconCar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium">{tituloDaLinha(row, index)}</span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="space-y-4 pb-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField
                        control={control}
                        name={`veiculos.${index}.serialNumber` as const}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Número de série</FormLabel>
                            <FormControl>
                              {/* ⚠️ TEXTO, não número (contrato §5, armadilha 2).
                                  `type="text"` é deliberado: série com zero à
                                  esquerda ou com letra é série válida. */}
                              <Input
                                type="text"
                                value={f.value ?? ""}
                                onChange={(value) => f.onChange(String(value ?? ""))}
                                onBlur={f.onBlur}
                                name={f.name}
                                disabled={disabled}
                                placeholder="Ex.: 1001"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`veiculos.${index}.plate` as const}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Placa</FormLabel>
                            <FormControl>
                              {/* `type="plate"` usa a máscara POSICIONAL: placa
                                  antiga e Mercosul convivem sem travar no 4º
                                  caractere, e o valor que sai é limpo. */}
                              <Input
                                type="plate"
                                value={f.value ?? ""}
                                onChange={(value) => f.onChange(String(value ?? ""))}
                                onBlur={f.onBlur}
                                name={f.name}
                                disabled={disabled}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`veiculos.${index}.chassisNumber` as const}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel>Chassi</FormLabel>
                            <FormControl>
                              <Input
                                type="chassis"
                                value={f.value ?? ""}
                                onChange={(value) => f.onChange(String(value ?? ""))}
                                onBlur={f.onBlur}
                                name={f.name}
                                disabled={disabled}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled || fields.length <= 1}
                        onClick={() => remove(index)}
                      >
                        <IconTrash className="mr-2 h-4 w-4" />
                        Remover veículo
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <MedidasDoImplemento disabled={disabled} totalDeVeiculos={fields.length} />
    </div>
  );
}

/** As faces vêm da lista única (G18): a frente, quando entrar, aparece aqui sozinha. */
const LADOS: readonly LadoImplemento[] = IMPLEMENT_FACES;

/**
 * A primeira mensagem de erro que houver sob este nó, em qualquer profundidade.
 *
 * ⚠️ Um erro do zod em `medidas` pode pousar em `medidas`, em
 * `medidas.esquerda`, em `medidas.esquerda.sections` ou em
 * `medidas.esquerda.sections.1.doorHeight` — depende de qual `refine` reprovou.
 * Procurar só no topo deixaria "a porta não pode ser mais alta que o
 * implemento" invisível, e o passo reprovaria sem nada na tela explicando.
 */
function primeiraMensagem(no: unknown, profundidade = 0): string | null {
  if (!no || typeof no !== "object" || profundidade > 6) return null;
  const registro = no as Record<string, unknown>;
  if (typeof registro.message === "string" && registro.message) return registro.message;
  for (const valor of Object.values(registro)) {
    const achado = primeiraMensagem(valor, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

/**
 * AS MEDIDAS DO IMPLEMENTO — UMAS SÓ, PARA A REQUISIÇÃO INTEIRA.
 *
 * ⛔ NÃO HÁ ESCAPE POR VEÍCULO, e isso é decisão, não esquecimento. Um seletor
 * "este caminhão é diferente" reintroduziria exatamente o estado ambíguo que
 * esta mudança extingue — a tela passaria a ter duas verdades sobre o mesmo
 * lote, e a linha que ninguém abriu guardaria uma medida que ninguém conferiu.
 * Quem tem implementos de modelos diferentes abre DUAS requisições, que é o que
 * o comercial vai fazer com elas de qualquer forma (orçamentos distintos), e o
 * ajuste fino por caminhão continua existindo do lado da Ankaa, na tarefa.
 *
 * ⚠️ O INTERRUPTOR É O ATO AFIRMATIVO. Sem ele, `medidas` é `null` e nenhum
 * veículo recebe medida. Não dá para deixar o componente montado e "vazio": o
 * `ImplementMeasureForm` nasce com um implemento de 2,00 m × 2,00 m e emite
 * esse padrão sozinho — toda requisição sairia com um implemento inventado
 * atrás, e ninguém saberia distinguir o padrão do que o cliente mediu.
 *
 * ⚠️ Quando liga, os TRÊS lados nascem juntos (`novasMedidas()`), com o mesmo
 * padrão que o componente usa por dentro. Se nascessem só os que a pessoa
 * abrisse, o primeiro render de cada aba mostraria um número que o estado do
 * formulário ainda não tem — e "medida que existe na tela e não no envio" é a
 * classe de defeito que esta tela inteira evita.
 */
/** Derivadas do mapa de rótulos — ver a nota em `veiculo-identidade-card.tsx`. */
const CATEGORIA_OPCOES = Object.entries(IMPLEMENT_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const IMPLEMENTO_OPCOES = Object.entries(IMPLEMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function MedidasDoImplemento({
  disabled,
  totalDeVeiculos,
}: {
  disabled?: boolean;
  totalDeVeiculos: number;
}) {
  const { control, formState, getValues, setValue } = useFormContext<SolicitacaoFormData>();
  const medidas = useWatch({ control, name: "medidas" }) as MedidasFormData | null | undefined;
  const [lado, setLado] = useState<LadoImplemento>("left");

  // MEDIDAS SEMPRE VISÍVEIS — não há interruptor.
  //
  // Elas eram opt-in porque `ImplementMeasureForm` emite um padrão 2,00 × 2,00 m
  // sozinho ao montar, e deixá-lo montado faria toda requisição carregar um
  // implemento que ninguém mediu. O interruptor resolvia isso escondendo o
  // formulário — e escondia junto o campo que a pessoa veio preencher.
  //
  // A troca: o formulário fica sempre à vista e quem decide se a medida VIAJA é
  // `medidasParaPayload`, via `medidasIntocadas` — o padrão intacto não vira
  // dado, medida preenchida vai. O padrão continua sendo semeado aqui, uma vez,
  // para que estado do formulário e desenho nunca discordem.
  useEffect(() => {
    if (!medidas) {
      setValue("medidas", novasMedidas(), { shouldDirty: false, shouldValidate: false });
    }
  }, [medidas, setValue]);

  const ladoAtual = medidas ? medidas[LADO_DO_IMPLEMENTO[lado]] : null;

  // CENTÍMETROS → METROS. A volta está em `aplicar`, e as duas se cancelam:
  // ver o cabeçalho do arquivo.
  const layout = useMemo(() => medidaLadoParaFormulario(ladoAtual), [ladoAtual]);

  const aplicar = useCallback(
    (side: LadoImplemento, dados: { height?: number | null; sections?: unknown }) => {
      const atual = getValues("medidas");
      // O interruptor foi desligado enquanto a emissão viajava. Escrever aqui
      // RESSUSCITARIA a medida que a pessoa acabou de dispensar.
      if (!atual) return;
      setValue(
        "medidas",
        {
          ...atual,
          [LADO_DO_IMPLEMENTO[side]]: medidaLadoDoFormulario(
            dados as Parameters<typeof medidaLadoDoFormulario>[0],
          ),
        },
        { shouldDirty: true, shouldValidate: false },
      );
    },
    [getValues, setValue],
  );

  /**
   * ⚠️ `queueMicrotask` E NÃO A ESCRITA DIRETA.
   *
   * O `ImplementMeasureForm` chama o `onChange` de DENTRO do atualizador de
   * `setSideStates` — um lugar que o React pode executar na fase de render.
   * Escrever no react-hook-form dali é efeito colateral durante o render, e o
   * sintoma é o aviso "Cannot update a component while rendering a different
   * component" mais, no pior caso, uma emissão perdida.
   *
   * A microtarefa preserva a ORDEM, e isso importa: ao mudar a altura, o
   * componente emite DUAS vezes (a altura da esquerda e da direita andam
   * juntas), e cada `aplicar` relê o estado com `getValues` — a segunda escrita
   * enxerga a primeira.
   */
  const aoMudar = useCallback(
    (side: LadoImplemento, dados: { height?: number | null; sections?: unknown }) => {
      queueMicrotask(() => aplicar(side, dados));
    },
    [aplicar],
  );

  const comprimentoTotal = useMemo(
    () => (ladoAtual?.sections ?? []).reduce((soma, secao) => soma + (secao?.width || 0), 0),
    [ladoAtual],
  );

  /**
   * O erro reprovado pelo zod, dentro do próprio componente.
   *
   * ⚠️ O `ImplementMeasureForm` tem `validationError` justamente para isto, e é
   * o que os chamadores internos usam. Sem ele o passo reprovaria com um toast e
   * a pessoa ficaria olhando o desenho sem saber o que corrigir — e o lado
   * culpado pode nem ser o que está aberto, daí o nome do lado na frente.
   */
  const erroDasMedidas = useMemo(() => {
    const erros = (formState.errors as Record<string, unknown>)?.medidas;
    if (!erros) return null;
    const doLadoAberto = primeiraMensagem(
      (erros as Record<string, unknown>)[LADO_DO_IMPLEMENTO[lado]],
    );
    if (doLadoAberto) return doLadoAberto;
    for (const outro of LADOS) {
      if (outro === lado) continue;
      const mensagem = primeiraMensagem(
        (erros as Record<string, unknown>)[LADO_DO_IMPLEMENTO[outro]],
      );
      if (mensagem) return `${ROTULO_DO_LADO[outro]}: ${mensagem}`;
    }
    return primeiraMensagem(erros);
  }, [formState.errors, lado]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <IconRuler2 className="h-5 w-5" />
              Medidas do implemento
            </CardTitle>
            <CardDescription>
              {totalDeVeiculos > 1
                ? `Uma medida só, aplicada aos ${totalDeVeiculos} veículos da requisição. São caminhões do mesmo modelo — não é preciso repetir os números em cada linha.`
                : "A medida vale para todos os veículos desta requisição. Se acrescentar mais veículos, todos recebem esta mesma medida."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {/* ── O QUE O IMPLEMENTO É, antes de quanto ele mede ────────────────
            Categoria e implemento são dado do CLIENTE, e ele os sabe no momento
            em que pede o orçamento — pintar baú frigorífico não custa o mesmo
            que pintar um sider, e até aqui o comercial descobria isso por
            telefone, depois de receber a requisição.

            ⚠️ PERGUNTADOS UMA VEZ, como as medidas e pela mesma razão (ver o
            cabeçalho deste componente): o lote é do mesmo modelo de implemento.
            `buildSolicitacaoPayload` copia a escolha para cada veículo.

            ⚠️ Em branco é resposta: quem não souber segue sem escolher, e os
            dois continuam corrigíveis por veículo no portal, depois. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={control}
            name="category"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>Categoria do veículo</FormLabel>
                <FormControl>
                  <Combobox
                    value={f.value ?? ""}
                    onValueChange={(next) =>
                      f.onChange(typeof next === "string" && next ? next : null)
                    }
                    mode="single"
                    options={CATEGORIA_OPCOES}
                    getOptionLabel={(o) => o.label}
                    getOptionValue={(o) => o.value}
                    placeholder="Não informada"
                    searchable={false}
                    clearable
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="implementType"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>Tipo de implemento</FormLabel>
                <FormControl>
                  <Combobox
                    value={f.value ?? ""}
                    onValueChange={(next) =>
                      f.onChange(typeof next === "string" && next ? next : null)
                    }
                    mode="single"
                    options={IMPLEMENTO_OPCOES}
                    getOptionLabel={(o) => o.label}
                    getOptionValue={(o) => o.value}
                    placeholder="Não informado"
                    searchable={false}
                    clearable
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {LADOS.map((l) => (
                  <Button
                    key={l}
                    type="button"
                    size="sm"
                    variant={lado === l ? "default" : "outline"}
                    onClick={() => setLado(l)}
                    disabled={disabled}
                  >
                    {ROTULO_DO_LADO[l]}
                  </Button>
                ))}
              </div>
              <div className="rounded-md bg-primary/10 px-3 py-1">
                <span className="text-sm text-muted-foreground">Comprimento total: </span>
                <span className="text-sm font-semibold text-foreground">{comprimentoTotal}cm</span>
              </div>
            </div>

            {/* ⚠️ `showPhoto={false}`: o POST da requisição não carrega foto de
                layout (só `baseFiles`), e o componente toastaria "será salva ao
                submeter" para uma foto que nunca sai daqui. A tela de pintura é
                onde os arquivos do cliente de fato viajam. */}
            <ImplementMeasureForm
              selectedSide={lado}
              layout={layout}
              onChange={aoMudar}
              showPhoto={false}
              disabled={disabled}
              validationError={erroDasMedidas}
            />
        </>
      </CardContent>
    </Card>
  );
}
