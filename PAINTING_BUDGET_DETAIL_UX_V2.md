# Orçamento de Pintura — Detalhe UX v2 (especificação, sem implementação)

Página alvo: `src/pages/administration/painting-budget/details/[id].tsx`
Componentes atuais: `src/components/administration/painting-budget/detail/`
Padrões de referência: `src/pages/profile/preferences.tsx`, `src/components/ui/page-header.tsx`, `DETAIL_PAGE_SPACING`.

Feedback do dono que rege esta versão (literal, resumido):

1. Os passos do multistep devem ser **os passos de produção** (dezenas), não "Revisão/Plano/Orçamento".
2. A tabela de fronteiras **não** deve aparecer separada.
3. Os controles "Fundo da face" e "Recalcular" no header do card estão ruins.
4. Cada passo de produção = **canvas de simulação + tabela** (Tamanho / Material / Quantidade / Tempo por unidade / Preço por unidade / Preço total).
5. Pode manter "Artes do Implemento" e uma "Revisão" enxuta; "Orçamento" fecha o fluxo.

---

## 0. Diagnóstico do que existe (por que muda)

| Hoje | Problema |
|---|---|
| `FormSteps` horizontal com 4 passos fixos (Artes / Revisão da Análise / Plano de Produção / Orçamento) | O plano tem dezenas de passos reais (`PaintingProductionStep`, agrupados por `day`/`session`); o stepper esconde exatamente o que o negócio quer inspecionar passo a passo. Stepper horizontal não escala para N≈30. |
| `BoundariesCard`: tabela avulsa "Fronteiras" (Tipo/Comprimento/Curva/Resolução/Corte/Fita) | Tabela sem contexto visual — o usuário não sabe *qual* divisa é qual. Deve virar edição contextual dentro do painel da região clicada. |
| "Fundo da face" (Combobox w-52) e "Recalcular" (dropdown 4 itens) no `CardHeader` de "Análise da Arte" | Controles de naturezas diferentes disputando o header do card; "Recalcular" expõe estágio de motor (`MATCH/STRATEGY/PLAN`) ao usuário final. |
| `PlanTab`: cards por passo com minutos inline, CURA como divisor | Sem canvas, sem tabela de custos por passo; passo não é navegável individualmente. |
| `BudgetTab`: margem `formatNumber(plan.profitMarginPct)%` | API grava fração (`0.35`, vinda do indireto `PROFIT_MARGIN_PCT`; `suggestedPrice = totalCost * (1 + fração)`) → UI mostra "0,35%". Decimais do Prisma serializados como string entram em somas (`entry.cost += step.laborCost`) → concatenação/NaN. Materiais sem preço só têm badge por linha. |

---

## 1. Modelo de navegação

### 1.1 Sequência plana única

A página deixa de ter "4 abas" e passa a ter **uma sequência linear de entradas**, todas do mesmo nível:

```
[Artes] → [Revisão] → [Produção: passo 1] → … → [Produção: passo N] → [Orçamento]
```

- `Artes` e `Revisão` são entradas fixas (pré-produção).
- Os passos de produção são **dinâmicos**: 1 entrada por `PaintingProductionStep`, ordenados por `position`, agrupados visualmente por `day`.
- `Orçamento` é a entrada final fixa.
- **Anterior/Próximo no header continuam** e caminham essa sequência plana (Revisão → passo 1; passo N → Orçamento). Desabilitados nas pontas, com tooltip.

**Decisão — um rail lateral esquerdo substitui o `FormSteps`.** Não há "stepper de fases + sub-lista": uma única lista vertical é a fonte de verdade da navegação. Duas camadas de navegação (fase em cima, passo do lado) obrigariam o usuário a manter dois cursores mentais; o rail com grupos de dia dá o mesmo panorama com um só cursor. `FormSteps` sai desta página (continua existindo para os wizards de formulário).

### 1.2 Moldura geral da página

Mantém o esqueleto padrão de página de detalhe (`preferences.tsx` / demais detalhes): container `flex-col h-full` + `DETAIL_PAGE_SPACING`, `PageHeader variant="detail"` fixo no topo, conteúdo rolável `min-h-0 flex-1`. O que muda é que o corpo vira `grid [rail | conteúdo]`.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Início › Administração › Orçamento de Pintura › Baú Sider — Transportes XYZ          │
│                                                                                      │
│ 🖩 Baú Sider — Transportes XYZ            [⋯] [← Anterior] [Próximo →] [✓ Aprovar]  │
│    REVIEW · ⟳ Recalculando…                                          (só no Orçam.)  │
├──────────────────┬───────────────────────────────────────────────────────────────────┤
│ RAIL (w-72)      │ CONTEÚDO DA ENTRADA SELECIONADA                                   │
│ rolagem própria  │ rolagem própria                                                   │
│                  │                                                                   │
│ ○ Artes (2)      │   (wireframes por tela nas seções 2–5)                            │
│ ● Revisão   ⚠2   │                                                                   │
│ ── DIA 1 · 6h40 ─│                                                                   │
│  1 Lavagem  PREP │                                                                   │
│  2 Lixamento PREP│                                                                   │
│  …               │                                                                   │
│ ── DIA 2 · 7h10 ─│                                                                   │
│  …               │                                                                   │
│ ◇ Orçamento  ●   │                                                                   │
└──────────────────┴───────────────────────────────────────────────────────────────────┘
```

Header — composição exata dos `PageAction`s:

- `[⋯]` menu avançado (dropdown): `Recalcular tudo`, `Recalcular tintas (ΔE)`, `Recalcular estratégias`, `Recalcular plano`, separador, `Reprocessar imagem` (com confirm — regenera regiões e pode descartar ajustes manuais). É o novo lar do antigo botão "Recalcular" (seção 3.3).
- `[← Anterior]` / `[Próximo →]`: sequência plana; sempre visíveis (padrão atual mantido).
- Ação contextual primária por entrada: `Artes` → `▶ Processar análise` (regras atuais de disable/tooltip mantidas); `Orçamento` → `✓ Aprovar orçamento` (habilitado só em `REVIEW`, como hoje). Demais entradas não têm primária.
- Sob o título: linha de status (badge do `PaintingAnalysisStatus`) + indicador discreto de recálculo (seção 3.3). Mensagens de `PROCESSING`/`FAILED` continuam nessa faixa, acima do grid.

### 1.3 O rail em detalhe (dezenas de passos)

```
┌─ RAIL ────────────────────────────┐
│ Produção · 28 passos · 21h40 · 4d │  ← sumário fixo no topo do rail
│───────────────────────────────────│
│ ✓ Artes do Implemento        2/2  │  ← entrada fixa; contador de faces processadas
│ ● Revisão                    ⚠ 2  │  ← entrada atual (●); badge âmbar = alertas
│                                   │     não resolvidos + divisas sem resolução
│ ── DIA 1 ─────────────── 6h40 ──  │  ← header de grupo STICKY ao rolar
│  1  Lavagem geral        [PREP] 40m
│  2  Lixamento            [PREP] 1h10
│  3  Empapelamento        [MASC] 45m
│  4  Fundo — face lateral [PINT] 1h30
│  5  ⏲ Cura do fundo      [CURA] 3h   ← linha compacta, nº esmaecido + relógio
│  6  Pintura — Azul 2100  [PINT] 1h20
│ ── DIA 2 ─────────────── 7h10 ──  │
│  7  Fita — divisas Azul  [MASC] 50m
│  8  Pintura — Branco     [PINT] 2h
│  …                                │
│ ── DIA 4 ─────────────── 3h05 ──  │
│ 27  Limpeza final        [FINAL] 30m
│ 28  Inspeção             [FINAL] 15m
│───────────────────────────────────│
│ ◇ Orçamento          R$ 12.480  ● │  ← entrada fixa; ● âmbar se material sem preço
└───────────────────────────────────┘
```

Anatomia de uma linha de passo: `nº (position global) · título (truncado) · badge de tipo · tempo`. Estados: atual (fundo `bg-muted`, borda esquerda `border-primary`), hover, com pendência (ponto âmbar). Sem estado "concluído" por passo — este fluxo é de *orçamentação*, não de execução; ✓ só nas entradas fixas quando sua pré-condição está satisfeita (Artes: todas as faces processadas; Revisão: sem alertas/divisas pendentes).

**Badge de tipo — família, não o kind cru.** 22 `PaintingStepKind` distintos viram ruído em lista longa; 5 famílias coloridas dão ritmo e contam a narrativa de produção (prepara → mascara → pinta → cura → finaliza). O kind completo (`PAINTING_STEP_KIND_LABELS`) aparece no conteúdo do passo.

| Família (badge) | Cor | Kinds |
|---|---|---|
| `PREP` | slate | REMOCAO_ADESIVO_ANTIGO, REMOCAO_REFLETIVA, LAVAGEM, VEDACAO_PU, LIXAMENTO |
| `MASC` | azul | EMPAPELAMENTO, MASCARAMENTO_LIQUIDO, ADESIVO_PLOTAGEM, ADESIVO_DEPILACAO, ADESIVO_APLICACAO, FITA, CORTE, STENCIL, REMOCAO_MASCARA |
| `PINT` | primary (verde) | FUNDO, PINTURA, VERNIZ, AEROGRAFIA |
| `CURA` | âmbar | CURA |
| `FINAL` | roxo | APLICACAO_REFLETIVA, LIMPEZA, INSPECAO |

Comportamento:

- Grupos de dia **não colapsam** — colapsar mata o panorama, que é o motivo do rail. Headers de dia são sticky para orientação; o passo atual é auto-rolado para a viewport (`scrollIntoView` block:nearest) quando muda via Anterior/Próximo.
- Clique = navegação livre (mesma filosofia do `FormSteps`: quem gera aparência de bloqueio é o estado, não o marcador). Gating real: entradas de produção e Orçamento só existem/clicáveis se `plan` existe; caso contrário o rail mostra, no lugar dos grupos de dia, o placeholder "Processe a análise para gerar os passos" (seção 7).
- Teclado: `↑/↓` movem a seleção no rail, `Enter` abre; `Alt+←/→` espelham Anterior/Próximo.
- Sessões (`session`) **não** aparecem no rail (nº + título + badge + tempo já saturam a linha); a sessão vira chip no cabeçalho do passo.
- Responsivo `< lg`: rail vira `Sheet` lateral aberto por um botão no header do conteúdo — `[≡ Passo 12 de 31 ▾]`; Anterior/Próximo do header continuam funcionando, então o fluxo linear sobrevive sem o rail visível.

---

## 2. Tela "Artes do Implemento" (mantida, com novo lar do "Fundo da face")

Layout mestre-detalhe no lugar do card único atual: lista de faces à esquerda, **painel de propriedades da face selecionada** à direita — é aqui que "Fundo da face" passa a morar (1º lar; o 2º é a ação contextual do alerta, seção 3.2).

```
┌ CONTEÚDO — Artes do Implemento ─────────────────────────────────────────────────────┐
│ Artes do Implemento                                    [Processando… ⣷] (badge)     │
│ Uma imagem por vista; a medida de referência calibra a escala (px/cm).              │
│                                                                                     │
│ ┌ Faces ───────────────────────────┐  ┌ Propriedades — Lateral Esquerda ──────────┐ │
│ │ ▸ [img] Lateral Esquerda    ✓    │  │ [    thumbnail grande da arte    ]        │ │
│ │        1.480 × 280 cm · 41,4 m²  │  │                                           │ │
│ │   [img] Lateral Direita     ✓    │  │ Vista            Lateral Esquerda         │ │
│ │        1.480 × 280 cm · 41,4 m²  │  │ Referência       Comprimento total 1480cm │ │
│ │   [img] Traseira   (não proc.)   │  │ Escala           3,2 px/cm                │ │
│ │        Comprimento total: 260 cm │  │ Dimensões        1.480 × 280 cm · 41,4 m² │ │
│ │                                  │  │                                           │ │
│ │ ┌ Nova arte ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  │ Fundo da face          [MANUAL]           │ │
│ │ │ Vista        [Frente     ▾] │  │  │ [Chapa Branca                   ▾]        │ │
│ │ │ Medida ref.  [Compr. tot ▾] │  │  │ ⓘ Mockups raramente têm branco puro — se  │ │
│ │ │ Valor (cm)   [_______]      │  │  │   a chapa é branca de fábrica, o motor    │ │
│ │ │ Imagem       [⭱ Selecionar] │  │  │   deixa de orçar a pintura do fundo.      │ │
│ │ │            [+ Adicionar]    │  │  │                                           │ │
│ │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │  │ [🗑 Remover arte]                          │ │
│ └──────────────────────────────────┘  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Decisões:

- "Fundo da face" é **propriedade da face** — semanticamente pertence ao cadastro da arte, não à revisão da análise. Movê-lo para cá tira o combobox do header do card da Revisão (reclamação nº 3) e o coloca onde o usuário está pensando "o que é esta face". A dica (`BACKGROUND_MODE_HINT`) vira texto `ⓘ` permanente sob o campo em vez de `title` invisível. Badge `MANUAL` (via `SourceBadge`) mantido.
- Trocar o fundo dispara o recálculo **automático** (seção 3.3) — sem botão.
- O combobox de fundo só habilita com `face.processedAt` (antes do processamento o motor ainda não estimou fundo); antes disso mostra "define-se após o processamento".
- Formulário "Nova arte" e AlertDialog de remoção mantidos como hoje (com sugestão da próxima vista).
- Seleção de face na lista alimenta o painel; a mesma seleção é compartilhada com a Revisão (estado no pai, como o `selectedFaceId` atual).

---

## 3. Tela "Revisão" (enxuta)

### 3.1 O que ela é

Uma única pergunta: **"a leitura automática da arte está certa?"** Mostra: viewer com overlay + painel contextual da região clicada + alertas. Nada de tabelas panorâmicas.

```
┌ CONTEÚDO — Revisão ─────────────────────────────────────────────────────────────────┐
│ ⚠ Fundo ambíguo na face Traseira — [Definir fundo ▾]        ⚠ Traço fino < 8 mm     │
│   (faixa de alertas; chips clicáveis; ação contextual inline)      na região #12 ↗  │
│                                                                                     │
│ [Lateral Esq.] [Lateral Dir.] [Traseira] [Frente*] [Teto*]   * = não processada     │
│  (tabs segmentadas por vista — substituem o combobox de face)                       │
│ ┌ Viewer ────────────────────────────────────────────┐ ┌ Região #7 ───────────────┐ │
│ │                                                    │ │ ▉ #1E5AA8  cor detectada │ │
│ │      ┌────────┐         ╔══════════╗               │ │                          │ │
│ │      │ região │         ║ região   ║ ← selecionada │ │ Tinta         [AUTO]     │ │
│ │      │ (hover)│         ║ (stroke  ║               │ │ ▉ Azul 2100      [▾]     │ │
│ │      └────────┘         ║  branco) ║               │ │ Tipo          [MANUAL]   │ │
│ │           ~~~~~~~~ divisa em destaque ~~~~~        │ │ [Chapada          ▾]     │ │
│ │   ⚠ região com divisa sem resolução = contorno     │ │ Estratégia    [AUTO]     │ │
│ │     tracejado + ponto âmbar                        │ │ [■ Fita + Corte   ▾]     │ │
│ └────────────────────────────────────────────────────┘ │ ────────────────────────  │ │
│ Legenda: ■ Adesivo Recorte ■ Fita+Corte ■ Stencil …    │ Área      3,2 m²         │ │
│                                                        │ Perímetro 8,4 m          │ │
│                                                        │ Ilhas 4 · Traço 6,2 mm   │ │
│                                                        │ Caixa 320 × 180 cm       │ │
│                                                        │ ────────────────────────  │ │
│                                                        │ DIVISAS DESTA REGIÃO (3) │ │
│                                                        │ ┌──────────────────────┐ │ │
│                                                        │ │ Tinta×Tinta · 4,2 m  │ │ │
│                                                        │ │ ↳ com Branco 9000    │ │ │
│                                                        │ │ Resolução [Fita+C ▾] │ │ │
│                                                        │ │ Corte 4,2m · Fita 8,4m │ │
│                                                        │ ├──────────────────────┤ │ │
│                                                        │ │ Keyline · 1,1 m  ⚠   │ │ │
│                                                        │ │ Resolução [Nenhuma ▾]│ │ │
│                                                        │ └──────────────────────┘ │ │
└────────────────────────────────────────────────────────┴──────────────────────────┘ │
```

### 3.2 O que SOME e para onde vai

| Some | Vira |
|---|---|
| `BoundariesCard` (tabela "Fronteiras" avulsa) | **Seção "Divisas desta região"** dentro do `RegionPanel`: ao clicar numa região, o painel lista só as `boundaries` que tocam aquela região (`regionAId`/`regionBId`), cada uma como mini-card: badge do tipo, comprimento, com quem divide (nome da tinta da outra região), **Resolução editável** (mesmo combobox/PATCH de hoje) e os derivados Corte/Fita em metros. Hover no mini-card acende a polilinha da divisa no viewer (`samplePath`); hover na divisa no viewer destaca o mini-card. Divisa com `resolution: NENHUMA` ganha ⚠. |
| Visão panorâmica que a tabela dava | Dois substitutos: (a) regiões com divisa pendente ganham **contorno tracejado + ponto âmbar** no viewer — o mapa é o índice; (b) o estado vazio do painel (nenhuma região clicada) mostra o **resumo da face**: dimensões, fundo (chip com atalho de edição), nº de regiões e "3 divisas sem resolução — clique nas regiões marcadas". O contador também aparece no badge ⚠ do rail. |
| "Fundo da face" no header do card | (a) painel de propriedades da face na tela **Artes** (seção 2); (b) **ação contextual do alerta** de fundo ambíguo: o chip do alerta na faixa traz o botão `Definir fundo ▾` que abre popover com os 3 modos (`WHITE_PLATE/GENERAL_PAINT/SIDER_CANVAS`) + a dica; escolher aplica o PATCH, resolve o alerta e dispara recálculo automático. Mapeamento por `alert.code` (tabela código→ação no componente da faixa). |
| "Recalcular" (dropdown no header do card) | Seção 3.3 — automático + item avançado no menu `⋯` do header da página. |
| `AlertsCard` (card lateral) | **Faixa de alertas** no topo do conteúdo: chips horizontais compactos (ícone de severidade + mensagem curta + ação contextual quando houver + `Resolver`). Alerta que referencia região/face, ao ser clicado, seleciona a face e a região no viewer (`↗`). Faixa colapsa para "⚠ 4 alertas" quando > 3. |

Decisões:

- Tabs segmentadas por vista no lugar do combobox: são no máximo 5 vistas (`PaintingFaceView`), sempre visíveis, com asterisco/esmaecido para não processada — um clique em vez de dois, e o estado de todas as faces fica visível.
- O painel direito continua 360px (grid `xl:grid-cols-[minmax(0,1fr)_360px]` atual serve); em `< xl` o painel vai para baixo do viewer.
- Ajustes manuais continuam marcados com `SourceBadge` (`MANUAL`), inclusive na resolução de divisa.

### 3.3 "Recalcular" some do olho do usuário

- **Automático:** toda edição que afeta o resultado dispara recálculo com debounce de ~800 ms, coalescendo estágios (uma rajada de edições = um compute). Mapa edição→estágios:

  | Edição (PATCH) | Estágios (`PaintingComputeStage`) |
  |---|---|
  | `face.backgroundMode` | MATCH + STRATEGY + PLAN |
  | `region.paintId` | STRATEGY + PLAN |
  | `region.kind` | STRATEGY + PLAN |
  | `region.strategy` | PLAN |
  | `boundary.resolution` | PLAN |
  | `step.minutes` / `step.waitMinutes` | nenhum estágio do motor — reprecificação em cascata no próprio PATCH (seção 6.4) |

  Implementação no cliente (hook `useAutoRecalc`), porque os PATCHes e o endpoint de compute já existem e o editor é um usuário por vez; endurecer para disparo server-side fica como evolução (nota na seção 6.5).
- **Indicador discreto:** pill na linha de status do header — `⟳ Recalculando…` (spinner 14px) enquanto `debouncePendente || computeMutation.isPending`; ao concluir, troca por `✓ Atualizado agora` que esmaece em ~3 s. Os valores monetários/minutos afetados recebem shimmer sutil durante o recálculo em vez de sumir (nada de layout shift). Sem toasts de sucesso a cada edição (o par de toasts atual "atualizado…/recalculado" morre); toast só em erro.
- **Item avançado:** menu `⋯` do header (seção 1.2) guarda os recálculos manuais por estágio e o "Reprocessar imagem" — para suporte/poder, fora do fluxo normal.

---

## 4. Passo de produção (o coração)

### 4.1 Tela padrão de passo

```
┌ CONTEÚDO — Passo 8 de 28 ───────────────────────────────────────────────────────────┐
│ ⑧  Pintura — Azul 2100                    [PINT · Pintura] [Dia 2] [Sessão 1]       │
│ Aplicar 2 demãos de Azul 2100 nas regiões mascaradas da face lateral esquerda.      │
│                                                                                     │
│ ┌ Canvas de simulação ──────────────────────────────┐ ┌ Tempo e taxa ─────────────┐ │
│ │ [Lateral Esq.]  ← tab só se o passo cobre + faces │ │ Tempo do passo            │ │
│ │                                                   │ │ [  78 ] min   [MANUAL]    │ │
│ │      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░            │ │ ≈ 1h18                    │ │
│ │      ░░┌──────────┐░░░░╔════════╗░░░░░            │ │                           │ │
│ │      ░░│ (dimmed) │░░░░║ REGIÃO ║░░░░░            │ │ Espera após o passo       │ │
│ │      ░░│  resto   │░░░░║ DESTE  ║░░░░░            │ │ ⏲ 40min (secagem demão)   │ │
│ │      ░░│  da face │░░░░║ PASSO  ║░░░░░            │ │                           │ │
│ │      ░░└──────────┘░░░░╚════════╝░░░░░            │ │ Taxa aplicada             │ │
│ │      ░░░░░░ pintado na cor da tinta ░░            │ │ 0,42 m²/min · complexid.  │ │
│ │                                                   │ │ média ×1,3                │ │
│ │ ▉ Azul 2100 · 12,4 m² nesta etapa                 │ └───────────────────────────┘ │
│ └───────────────────────────────────────────────────┘                               │
│                                                                                     │
│ ┌ Composição do passo ────────────────────────────────────────────────────────────┐ │
│ │ Tamanho        │ Material            │ Quantidade │ Tempo/un    │ R$/un │ Total │ │
│ ├────────────────┼─────────────────────┼────────────┼─────────────┼───────┼───────┤ │
│ │ 320 × 180 cm   │ Mão de obra —       │  5,8 m²    │ 2,4 min/m²  │ 3,60  │ 20,88 │ │
│ │ (região #7)    │ pintura             │            │             │       │       │ │
│ │ 410 × 160 cm   │ Mão de obra —       │  6,6 m²    │ 2,4 min/m²  │ 3,60  │ 23,76 │ │
│ │ (região #9)    │ pintura             │            │             │       │       │ │
│ │ —              │ Tinta Azul 2100     │  2,1 L     │ —           │ 89,90 │188,79 │ │
│ │ —              │ Solvente 5001       │  0,4 L     │ —           │ [sem preço] — │ │
│ ├────────────────┴─────────────────────┴────────────┴─────────────┴───────┼───────┤ │
│ │ Tempo total: 1h18 · Espera: 40min                     Custo do passo R$ │233,43 │ │
│ └─────────────────────────────────────────────────────────────────────────┴───────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Anatomia:

1. **Cabeçalho do passo:** nº (`position`), título, chips: família+kind (`PINT · Pintura`), `Dia N`, `Sessão N` (quando `session > 0`). Descrição (`step.description`) logo abaixo, texto corrido.
2. **Canvas de simulação** (esquerda, flex-1): a face do passo (`step.faceId`) com overlay dirigido por `step.visualization` (contrato na seção 6.3):
   - `REGION_FILL` (pintura, fundo, verniz, adesivo, stencil, aerografia): regiões do passo (`regionIds`) preenchidas com a cor da tinta/estratégia; resto da face sob véu esmaecido (`fill` cinza a 55%). Legenda: swatch + "12,4 m² nesta etapa".
   - `BOUNDARY_LINES` (fita, corte): polilinhas das divisas envolvidas (`samplePath`) traçadas grossas na cor da família, regiões apenas contornadas.
   - `FULL_FACE` (lavagem, lixamento, empapelamento, remoções): face inteira sob tint leve da família — comunica "o passo é a face toda".
   - `NONE` / `faceId` nulo (inspeção, limpeza geral): grade de miniaturas de todas as faces + ícone do kind — sem fingir precisão que o passo não tem.
   - Reutiliza o mesmo componente base de viewer da Revisão (imagem + SVG `viewBox` do artifact) — um renderer, dois modos (interativo na Revisão, ilustrativo aqui; no passo, clique numa região destacada abre a Revisão com ela selecionada — atalho de auditoria).
3. **Painel "Tempo e taxa"** (direita, ~340px):
   - **Tempo do passo**: input inline de minutos (o `StepMinutesInput` atual: blur → PATCH, badge `MANUAL` quando `minutesSource === "MANUAL"`), com equivalente `≈ 1h18` ao lado. **É o único lugar de edição de minutos** — a coluna Tempo/un da tabela é derivada e read-only; editar o total mantém o modelo mental "eu sei quanto tempo isso leva no total".
   - **Espera após o passo**: `waitMinutes` formatado; read-only aqui (edição só na tela de CURA).
   - **Taxa aplicada**: `rateUsed` + **unidade** (`rateMode` → labels `PAINTING_RATE_MODE_LABELS`: m²/min, m/min, cm/min, min fixo, min/un) + fator de complexidade quando aplicável. Hoje `rateUsed` é número sem unidade — campo novo no contrato (seção 6.2).
4. **Tabela "Composição do passo"** (largura total, embaixo — 6 colunas não cabem num painel lateral): colunas exatamente **Tamanho / Material / Quantidade / Tempo por unidade / Preço por unidade / Preço total**.
   - **Linhas de mão de obra:** uma por região coberta (quando `regionIds` presente) — Tamanho = caixa da região (`bboxWidthCm × bboxHeightCm`) com a área como quantidade; ou uma linha única com a quantidade do passo (`quantity` + `quantityUnit`) quando não há regiões. Tempo/un = `minutesPerUnit`; R$/un = `laborUnitPrice`; Total = fatia do `laborCost`.
   - **Linhas de material:** de `PaintingStepMaterial` — Tamanho = especificação do insumo quando existir (ex.: "Rolo 60 cm", vem do label/contrato), Quantidade = `quantity unit`, Tempo/un = "—", R$/un = `unitPriceSnapshot` (badge vermelho `sem preço` quando 0, célula Total "—"), Total = `totalCost`.
   - **Rodapé:** Tempo total + espera à esquerda; **Custo do passo** (labor + materiais) à direita.
   - A tabela é **servida pronta pela API** (`step.lines[]`, seção 6.2) — o front não refaz matemática de preço (fonte única, evita divergência com o Orçamento).

### 4.2 Passo de CURA — tela especial (relógio)

CURA não é trabalho, é espera; a tela muda de natureza (sem tabela de composição, sem canvas de regiões):

```
┌ CONTEÚDO — Passo 5 de 28 ───────────────────────────────────────────────────────────┐
│ ⑤  Cura do fundo                                        [CURA · Cura] [Dia 1]       │
│                                                                                     │
│                                   ┌─────────┐                                       │
│                                   │   ⏲     │                                       │
│                                   │  3h00   │   ← relógio grande, mostrador com     │
│                                   │ de espera│     arco proporcional (3h de 24h)    │
│                                   └─────────┘                                       │
│                                                                                     │
│              Curando: Fundo cinza — Sessão 1 · faces Lateral Esq./Dir.              │
│              Próximo passo: ⑥ Pintura — Azul 2100 (após a cura)                     │
│                                                                                     │
│   ┌ Ajuste ────────────────────────────────────────────────────────────────────┐    │
│   │ Tempo de cura   [ 180 ] min  ≈ 3h                              [MANUAL]    │    │
│   │ ⓘ Esperas de até 3h ocupam o mesmo dia de produção; acima disso o plano    │    │
│   │   pula para o dia seguinte.                                                │    │
│   └────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- Conteúdo: o que está curando (título/descrição + sessão + faces via `regionIds`/`faceId`), preview do próximo passo (link), e a **regra de dia** explicada (o compute soma `min(wait, 180)` ao dia — a UI conta isso ao usuário em vez de deixá-lo adivinhar por que o dia virou).
- **Edição inline dos minutos de cura mora aqui** (PATCH `waitMinutes`/`minutes` conforme o campo que o motor usa para CURA — hoje o divisor exibe `waitMinutes || minutes`; o contrato 6.4 normaliza: CURA usa `waitMinutes`). Badge `MANUAL` idem.
- No rail, CURA aparece como linha compacta com ⏲ (seção 1.3) — presença sem peso.

---

## 5. Tela "Orçamento" (fecha o fluxo)

Estrutura mantida (4 cards de resumo + card "Composição do Orçamento"), com três correções obrigatórias e um reforço:

```
┌ CONTEÚDO — Orçamento ───────────────────────────────────────────────────────────────┐
│ ⚠ 3 materiais sem preço cadastrado — o custo real será maior que o exibido.         │
│   [Ver materiais ↓]                                  (banner âmbar clicável)        │
│                                                                                     │
│ ┌ Área total ─┐ ┌ Horas trab. ─┐ ┌ Horas espera ┐ ┌ Dias de produção ┐              │
│ │  86,2 m²    │ │   21h40      │ │    7h30      │ │       4          │              │
│ └─────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘              │
│                                                                                     │
│ ┌ Composição do Orçamento ────────────────────────────────────────────────────────┐ │
│ │ Item                                  │ Detalhe          │ Valor                │ │
│ ├───────────────────────────────────────┼──────────────────┼──────────────────────┤ │
│ │ MÃO DE OBRA (R$ 45,00/h)              │                  │                      │ │
│ │   Pintura                             │ 8h20             │ R$ 375,00            │ │
│ │   Fita                                │ 2h10             │ R$ 97,50             │ │
│ │   …                                   │                  │                      │ │
│ │ MATERIAIS                             │                  │                      │ │
│ │   Tinta Azul 2100                     │ 6,3 L            │ R$ 566,37            │ │
│ │   Solvente 5001  [sem preço]          │ 1,2 L            │ —                    │ │
│ │ Custos indiretos                      │                  │ R$ 890,00            │ │
│ │ Custo total                           │                  │ R$ 9.244,00          │ │
│ │ Margem de lucro                       │ 35%              │ R$ 3.235,40          │ │
│ │ ▓ Preço sugerido                      │                  │ R$ 12.479,40         │ │
│ ├───────────────────────────────────────┴──────────────────┴──────────────────────┤ │
│ │ Preços congelados em 04/08/2026 14:32          [✓ Aprovar orçamento → no header]│ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Correções:

1. **Margem como % real.** `plan.profitMarginPct` chega como **fração** (0.35 — valor do indireto `PROFIT_MARGIN_PCT`; `suggestedPrice = totalCost * (1 + fração)`). Decisão: **manter fração no banco** (coerente com a fórmula e com `PaintingIndirectMode.PCT_*`) e formatar na borda: novo helper `formatPercentFromFraction(v)` → `formatNumber(v * 100, 0)%` → "35%". Documentar a semântica no type web e no schema API (comentário) para o campo não ser "consertado" duas vezes. Bônus de leitura: a linha ganha o **valor em R$** na coluna Valor (`suggestedPrice - totalCost`) e o % vai para a coluna Detalhe — hoje a linha da margem tem Valor vazio e o % órfão.
2. **Zero NaN.** Causa raiz provável: campos `Decimal` do Prisma (`laborCost`, `materialCost`, `unitPriceSnapshot`, `totalCost`, `laborRatePerHour`, `suggestedPrice`) serializados como **string** e somados no front (`entry.cost += step.laborCost` → concatenação → `formatCurrency` NaN). Correção em duas camadas: (a) coerção `Number()` no mapeamento do serviço/hook (uma vez, na entrada); (b) guarda nos formatadores locais — `formatNumber`/`formatCurrency` retornam "—" quando `!Number.isFinite(v)`. Nenhuma célula da página pode renderizar "NaN" ou "R$ NaN".
3. **Materiais sem preço.** Badge vermelho por linha mantido; célula Valor vira "—" (não R$ 0,00 — zero mente). **Banner âmbar** no topo com contagem e âncora que rola/destaca as linhas; a entrada "Orçamento" no rail ganha o ponto âmbar (seção 1.3) — o problema fica visível antes de o usuário chegar à tela de aprovação.
4. Rodapé com `priceSnapshotAt` mantido; "Aprovar orçamento" permanece **no header da página** (padrão de ação primária de página, como hoje).

---

## 6. Mapa de componentes e contrato de dados

### 6.1 Arquivos (web)

`src/components/administration/painting-budget/detail/`:

| Arquivo | Ação | Conteúdo |
|---|---|---|
| `step-rail.tsx` | **NOVO** | Rail: sumário, entradas fixas (Artes/Revisão/Orçamento), grupos sticky por dia, linha de passo (nº+título+badge família+tempo), badges de pendência, teclado, auto-scroll. Versão `Sheet` para `< lg`. |
| `face-viewer.tsx` | **NOVO** (extraído do `analysis-tab`) | Base imagem + SVG (`engineArtifact.image.work*Px`, `regionPathD` evenodd). Props: modo interativo (Revisão: hover/click/pendências tracejadas) vs ilustrativo (passo: overlay por `visualization`, dim veil, polilinhas de divisa). |
| `review-screen.tsx` | **RENOMEADO/REFEITO** de `analysis-tab.tsx` | Faixa de alertas + tabs de vista + `face-viewer` + `region-panel`. Sem "Fundo da face" e sem "Recalcular" no header do card. |
| `region-panel.tsx` | **ALTERADO** | + seção "Divisas desta região" (mini-cards com Resolução editável, hover-sync com o viewer); + estado vazio = resumo da face com pendências. |
| `alerts-strip.tsx` | **NOVO** (substitui `alerts-card.tsx`) | Chips horizontais, mapa `alert.code` → ação contextual (ex.: fundo ambíguo → popover "Definir fundo"), clique foca região/face, colapso > 3. |
| `production-step-screen.tsx` | **NOVO** | Tela do passo: cabeçalho, canvas (`face-viewer` ilustrativo), painel Tempo/Taxa (com `StepMinutesInput` movido para cá), `step-lines-table`. Decide tela normal × CURA. |
| `cure-screen.tsx` | **NOVO** | Tela de CURA: relógio, contexto, próximo passo, edição de minutos de espera + regra dos 180 min/dia. |
| `step-lines-table.tsx` | **NOVO** | Tabela 6 colunas renderizando `step.lines[]` da API; rodapé de totais; badge `sem preço`. |
| `faces-screen.tsx` | **REFEITO** de `faces-card.tsx` | Mestre-detalhe: lista de faces + painel de propriedades (com "Fundo da face") + form de nova arte. |
| `budget-tab.tsx` | **ALTERADO** | `formatPercentFromFraction`, guardas NaN, coluna Detalhe/Valor da margem, banner de materiais sem preço, célula "—" p/ preço zero. |
| `recalc-indicator.tsx` | **NOVO** | Pill "⟳ Recalculando… / ✓ Atualizado". |
| `common.tsx` | **ALTERADO** | + `STEP_FAMILY` (kind→família/cor/label curto), + `formatPercentFromFraction`, guardas `Number.isFinite` em `formatNumber`, + `toApiNumber`. |
| `boundaries-card.tsx` | **REMOVIDO** | Absorvido pelo `region-panel`. |
| `plan-tab.tsx` | **REMOVIDO** | Substituído por rail + `production-step-screen` (o `StepMinutesInput` migra). |

Fora do diretório:

| Arquivo | Ação | Conteúdo |
|---|---|---|
| `src/pages/administration/painting-budget/details/[id].tsx` | **REFEITO** | Estado `selectedEntry` (`{type:'faces'|'review'|'step'|'budget', stepId?}`) substitui `clickedStep`; sequência plana p/ Anterior/Próximo; grid rail+conteúdo; header actions (⋯, contextuais); remove `FormSteps`. Entrada inicial: `faces` sem face processada; senão `review`. Passos permanecem montados/ocultos apenas para Revisão (preserva seleção de região) — passos de produção montam sob demanda (dezenas de canvases simultâneos custam caro). |
| `src/hooks/painting/use-painting-analysis.ts` | **ALTERADO** | + `useAutoRecalc` (debounce + coalescência de estágios + estado p/ indicador). |
| `src/types/paintingAnalysis.ts` | **ALTERADO** | Ver 6.2 (espelhar em `mobile/` se/quando a tela existir lá — schemas são duplicados por convenção do monorepo). |

### 6.2 Contrato por passo — o que a API passa a fornecer

`PaintingProductionStep` (Prisma) **já tem** `faceId`, `regionIds Json?`, `windowAreaM2`, `visualization Json?` — mas o compute não popula `visualization`/`windowAreaM2` e o type web não expõe nenhum deles. Contrato v2 do GET de detalhe, por passo:

```ts
interface PaintingProductionStep {
  // …campos atuais (position, day, session, kind, title, description,
  //  quantity, quantityUnit, minutes, minutesSource, waitMinutes,
  //  laborCost, materialCost, materials[])…

  // Expostos (já existem no banco):
  faceId: string | null;
  regionIds: string[] | null;
  windowAreaM2: number | null;

  // NOVOS — unidade de taxa (hoje rateUsed é número sem unidade):
  rateMode: PaintingRateMode | null;   // nova coluna; gravada do rate usado (rates.get(rateKey).mode)
  rateKey: string | null;              // opcional, rastreabilidade ("PAINT_M2_PER_MIN")
  minutesPerUnit: number | null;       // derivado no server (inclui fator de complexidade) — o front não inverte rate

  // NOVO — preço unitário de mão de obra:
  laborUnitPrice: number | null;       // R$ por unidade de quantity = (laborRatePerHour / 60) * minutesPerUnit
                                       // persistido no snapshot (coerente com priceSnapshotAt / unitPriceSnapshot)

  // NOVO — visualization POPULADO pelo compute (era coluna morta):
  visualization: PaintingStepVisualization | null;

  // NOVO — tabela pronta (serializada no GET, montada no server):
  lines: PaintingStepLine[];
}
```

```ts
type PaintingStepVisualization =
  | { mode: "REGION_FILL"; faceId: string; regionIds: string[]; colorHex?: string; dimOpacity?: number }
  | { mode: "BOUNDARY_LINES"; faceId: string; boundaryIds: string[]; colorHex?: string }  // paths via boundary.samplePath
  | { mode: "FULL_FACE"; faceId: string; tintHex?: string }
  | { mode: "NONE" };

interface PaintingStepLine {
  id: string;
  scope: "LABOR" | "MATERIAL";
  sizeLabel: string | null;        // "320 × 180 cm (região #7)" | "Rolo 60 cm" | null → "—"
  materialLabel: string;           // "Mão de obra — pintura" | "Tinta Azul 2100"
  paintId?: string | null;         // swatch
  itemId?: string | null;
  quantity: number;
  quantityUnit: string;            // "m²", "L", "m", "un"
  minutesPerUnit: number | null;   // null em MATERIAL → "—"
  unitPrice: number | null;        // null/0 sem preço → badge "sem preço", total "—"
  totalPrice: number | null;
  source: PaintingValueSource;     // MANUAL quando minutos do passo foram sobrescritos
}
```

Justificativas: (a) **fonte única de matemática** — o server já calcula custo; se o front recompuser Tempo/un e R$/un, a tabela do passo e o Orçamento divergirão um dia; (b) `rateMode` é a "unidade de taxa" pedida — sem ela a UI não sabe se `rateUsed` é m²/min ou min fixo; (c) `laborUnitPrice` persistido respeita a semântica de snapshot (`priceSnapshotAt`) que os materiais já têm via `unitPriceSnapshot`.

### 6.3 Migração/compute (API)

- Colunas novas: `rateMode PaintingRateMode?`, `rateKey String?`, `laborUnitPrice Decimal? @db.Decimal(12,4)` em `PaintingProductionStep` (migração simples; `lines` NÃO é coluna — é montagem no serializer a partir de regiões + materials + campos do passo).
- Compute passa a gravar: `rateMode`/`rateKey`/`laborUnitPrice` (já tem tudo em mãos em `minutesFor(draft)` + `hourly`), `visualization` (deriva do draft: regionIds → REGION_FILL; FITA/CORTE → BOUNDARY_LINES; kinds de face inteira → FULL_FACE; senão NONE) e `windowAreaM2` quando aplicável.
- Serializer do GET converte todos os `Decimal` para **number** (mata a família de NaN na origem; front mantém as guardas por defesa).

### 6.4 PATCH de minutos — cascata obrigatória

`PATCH /painting-analyses/steps/:id { minutes | waitMinutes }` deve, no server: recalcular `laborCost` do passo (`minutes/60 * laborRatePerHour`), `minutesPerUnit`/`laborUnitPrice` (se `quantity > 0`), reagrupar dias se `waitMinutes` cruzar o teto de 180 min e reagregar os totais do plano (`totalMinutes`, `totalWaitMinutes`, `totalDays`, `laborCost`, `totalCost`, `suggestedPrice`). Sem isso, a edição inline de minutos deixa o Orçamento defasado até o próximo recompute completo. CURA normaliza edição em `waitMinutes` (a UI atual lê `waitMinutes || minutes`).

### 6.5 Semânticas documentadas (para não regredir)

- `profitMarginPct` = **fração** (0.35). Formatação ×100 só na borda (`formatPercentFromFraction`). Comentário no type web + no schema Prisma.
- `unitPriceSnapshot === 0` ⇒ "sem preço" (convenção atual mantida; exibição "—", nunca R$ 0,00).
- Auto-recalc é client-side (hook debounced); evolução futura: disparo server-side pós-PATCH com push (Socket.io padrão attention) — fora do escopo v2.
- Códigos de `PaintingAnalysisAlert.code` viram contrato de UI (mapa código→ação contextual na faixa de alertas); listar os códigos emitidos pelo motor ao implementar.

---

## 7. Regras transversais (estados)

| Situação | Comportamento |
|---|---|
| Nenhuma face processada | Rail: Artes (atual) + Revisão desabilitada com tooltip + placeholder "Processe a análise para gerar os passos" no lugar dos dias + Orçamento desabilitado. Próximo para além de Artes: desabilitado com tooltip. |
| `status: PROCESSING` | Faixa informativa sob o header (como hoje, com auto-refresh); rail congelado (linhas esmaecidas); badge "Processando…" na entrada Artes. |
| `status: FAILED` | Faixa destrutiva com `processingError` (como hoje) + ação "Reprocessar imagem" inline. |
| Plano existe mas recálculo em voo | Conteúdo permanece interativo; valores afetados com shimmer; pill "Recalculando…". Nunca esconder a tela inteira. |
| Passo referenciando região/face apagada (`SetNull`) | Canvas cai para `NONE` (grade de faces); linha da tabela mantém rótulos snapshotados. |
| Mobile `< lg` | Rail → Sheet (botão "Passo X de Y" no topo do conteúdo); painéis laterais empilham sob o conteúdo; tabela do passo com `overflow-x-auto`. |
| Teclado | `↑/↓` + `Enter` no rail; `Alt+←/→` = Anterior/Próximo. |
| Privilégios | Mantidos (`PAINTING_BUDGET_PRIVILEGES`); nenhuma mudança de gate por sector nesta v2. |

## 8. Fora de escopo desta v2 (registrado para não virar scope creep)

- Execução/checagem de produção (marcar passo como feito, `actualMinutes`/`actualNotes` já existem no modelo — tela futura de apontamento).
- Editor manual de regiões/geometria no viewer.
- Recomputo server-side com push em tempo real (evolução do 6.5).
- Exportar/imprimir o orçamento (o header já comporta uma ação futura no menu `⋯`).
