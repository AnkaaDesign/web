# `diag/` — os diagnósticos de uso único

O que mora aqui rodou **uma vez**, para responder **uma** pergunta, e ficou
porque a resposta virou número num comentário ou numa seção do
`ARCHITECTURE.md`. É a trilha da medição, não a rede de proteção.

```bash
node tools/studio-bench/bench.mjs --gpu --geometry \
     --checks diag/checks-diag-<assunto>-<MMDD>.mjs
```

## Por que a pasta existe

`tools/studio-bench/` tinha **204 arquivos `checks-*.mjs` num nível só**, e 85
deles eram sonda de uma pergunta específica — *"o que mora na baia do 2º
direcional?"*, *"o deslocamento acumula entre cargas?"*. Misturados com os
portões, eles escondiam justamente o que alguém procura ao chegar: **qual é o
teste que eu tenho de manter verde.**

A regra, e ela é o que separa as duas pastas:

| | mora em | e a pergunta é |
|---|---|---|
| **portão** | `tools/studio-bench/` | *isto continua verdadeiro?* — roda de novo a cada mexida, e uma falha é regressão |
| **diagnóstico** | `tools/studio-bench/diag/` | *quanto é isto, aqui, hoje?* — respondeu, virou constante, não roda mais |

Um diagnóstico que passe a ser rodado de novo a cada rodada **não é
diagnóstico**: promova-o, dê-lhe uma asserção `★` e mova-o um nível acima.

## Por que eles não foram APAGADOS

Porque são a **procedência** dos números. `cab-bake-fixes.ts` diz *"medido em
`diag/checks-diag-paralama-scania-0823.mjs`"*, e cinco seções do
`ARCHITECTURE.md` citam um destes arquivos como a origem de uma cota. Apagar o
arquivo transformaria a cota num número mágico — que é exatamente o que este
projeto passa o dia inteiro tentando não ter.

Eles também não entram em bundle nenhum: `tools/` inteiro fica fora do build do
web.

## O que NÃO fica aqui

As FOTOS que eles tiram (`shots*/`) — o `.gitignore` já as recusa, e o motivo
está lá: `tools/studio-bench/shots/` sozinha tem 108 MB de PNG de conferência,
mais que todos os assets versionados somados.
