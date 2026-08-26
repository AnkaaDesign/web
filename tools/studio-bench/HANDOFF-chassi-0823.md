# HANDOFF — sobreposição de peças nos três rígidos

> **ESTADO EM 2026-08-23, 2ª frente: a varredura geral EXISTE e rodou.**
> Ver `src/pages/tools/truck-studio/ARCHITECTURE.md` **§44**. O que este
> documento pedia está feito; o que sobra está listado no fim, com número.

## O que existe agora

    node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-varredura-0823.mjs

`tools/studio-bench/checks-varredura-0823.mjs` — cada FAMÍLIA de peça posta em
runtime contra a árvore da CABINE **e** contra a do IMPLEMENTO, mais o
implemento inteiro contra a cabine, nas dez configurações, ordenado por
profundidade e com peça, flanco e faixa de z. Ele **se confere antes de medir**
(cena de teste com resposta conhecida) e roda em 4…6 s por configuração.

| | 1ª passada | agora |
|---|---|---|
| pares ≥ 5 mm nas 10 configurações | 138 | **97** |
| maior mancha | 178 mm (arco × caixa de bateria do VM) | 103 mm |
| **achado mais externo** | — | **\|x\| 458 mm** — nada no flanco |

## Os cinco defeitos que ele achou e as dez fotos não

1. **`fundo` ZERA em triângulo alinhado com eixo** — uma barra de 50 mm
   atravessando uma chapa de ponta a ponta dá `fundo` 0. As quatro pendências
   "de 5 a 16 mm" de §43.10 eram, medidas de verdade, **178, 125 e 162 mm**.
2. **`InstancedMesh` era medida na pose do NÓ**, e é ela que colide.
3. **O para-lama do 2º direcional não cabe** entre os direcionais — passou a ser
   CORTADO, em duas passadas (cabine e implemento).
4. **A tampa de ponta da grade ultrapassava o corrido** em toda fronteira; era
   ela dentro do cubo da roda, não a barra.
5. **A ferragem da grade nunca tinha sido extraída** do semirreboque
   (`FAIXA.xMin` era 1,19 e o braço nasce em 374) — daí "a grade está
   flutuando". `protecao_lateral_v2.glb` a traz.

## O que sobra, assumido com número

Todos os 97 pares restantes estão em **\|x\| ≤ 458 mm** — entre as longarinas,
acima das rodas e sob o baú, com as duas peças pretas.

- **Sobrechassi × longarina do caminhão** (VW 103 · Scania 84/65 · VM 35 mm,
  11…16 manchas). §25.2 mediu as longarinas do sub-chassi em \|x\| 0,374…0,439
  **a cavalo sobre a alma de 0,425**: é o projeto do assentamento. Fechar move
  `frameTopY`, o piso, o teto e o balanço.
- Berço do tanque do VM × longarina do Scania (30 mm), braço do para-barro
  nascendo na estrutura (23 mm, §35), para-barro de FÁBRICA do Scania × tanque
  (10 mm), testeira do sobrechassi × traseira da cabine no VW (26 mm).

## O que ficou de fora, e por quê

- **Subir a grade** — ela está em 510…1010 mm de solo e a CONTRAN 805/1995
  limita a borda inferior a 550; com a inclinação do baú o ponto mais baixo já
  está em 449. Sobram **40 mm** de folga legal, num único número, se o dono
  pedir. Ver §44.9.
- Abas de para-barro dianteiras do VW penduram baixo (é do rip, igual no 6x2).
- Entre-eixos dos bitrucks continua o do rip (5 341 no VM, 5 653 no VW) contra
  5 900 de catálogo — mover o tandem é cirurgia de suspensão inteira.
- `caixa de ferramentas` e `tanque de água` não existem em rip nenhum dos três.
