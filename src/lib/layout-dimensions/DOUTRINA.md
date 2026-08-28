# Doutrina de cotagem de layout

Como o projetista da Ankaa cota uma face de implemento, medido — não suposto.

## De onde vieram os números

Base: `kennedy@ankaadesign.com.br:/srv/files/Clientes/*/Layouts/PDFs/*.pdf`,
357 arquivos, dos quais **347 foram baixados e lidos**; 201 tinham cota legível
por máquina. Delas saíram **2.102 cotas com âncora exata** (98% dos rótulos
resolvidos, erro máximo de 0,9 cm), **2.202 âncoras classificadas** contra a
geometria vetorial e **1.697 cotas com a linha de extensão medida ponta a ponta**.

O leitor de cotas usado no estudo está em `harness/` (fora do repositório):
ele acha o rótulo azul, procura as linhas de extensão perpendiculares que
tocam a linha de cota e escolhe o par cuja distância bate com o número escrito.
Esse casamento é auto-verificável — se o par não reproduz o rótulo, a cota é
descartada.

## O que é fixo no arquivo

| Item | Valor | Evidência |
|---|---|---|
| Escala | **1:10** (1 cm real = 1 mm no papel = 2,8346 pt) | 190 de 205 arquivos |
| Cor da cota | `#3374A9` | uniforme |
| Traço | 0,22 pt | 4.361 de 4.383 segmentos |
| Seta | triângulo cheio 10,6 × 5,7 pt | 2.178 setas |
| Rótulo | Arial 36 pt (24 pt em detalhe) | 945 de 1.096 |
| Valor | inteiro em cm, mínimo 3 cm | 2.071 de 2.071 |
| Faces por arquivo | 3 (motorista, sapo, traseira) | 161 de 205 |
| Cotas por face | mediana 3, p75 5, máximo 13 | 325 faces |

A traseira costuma ser cotada sobre a **foto** do caminhão, não sobre um
desenho — porta, dobradiça e lanterna não cabem num retângulo.

## As regras

### 1. Vertical: a borda de referência sai da altura do elemento

- centro do adesivo dentro dos **3/4 de cima** → cota a partir do **TOPO**
  (186 casos; **zero** no último quarto);
- centro no **último 1/4** → cota a partir da **BASE**
  (33 casos; **zero** no primeiro quarto).

### 2. Vertical: mede-se até o TOPO do elemento

`borda de cima → topo do adesivo` 129 × `borda de cima → base do adesivo` 15.

### 3. Horizontal: sempre da borda lateral MAIS PRÓXIMA

- `borda esquerda → esquerda do adesivo`: 109
- `direita do adesivo → borda direita`: 110

Adesivo centralizado recebe as duas (Ki Distribuidora: 725 à esquerda e 612 à
direita do mesmo logotipo).

### 4. Onde a linha mora

| | metade de cima | último quarto |
|---|---|---|
| cota horizontal | linha **acima** da face (119 × 12) | linha **abaixo** (60 × 1) |

Cota vertical fica do lado da borda que serviu de referência
(esquerda 96 × 15, direita 98 × 15).

### 5. Envelopamento não tem cota de bloco

Arte que sangra pelas bordas (fundo colorido, faixa, marca d'água) não tem
posição a cotar — o que o aplicador precisa é **em que ponto da aresta
superior ela começa**. É a cota 142 do GRESPAN 840, a 252 do Ki 1538 e a 160
do Norte Minas 1442. São raras: 28 de 2.202 âncoras. O motor emite no máximo 2
por face, preferindo a aresta de cima (13 × 5).

### 6. A linha de extensão vai ATÉ o item — e sai do ponto certo

Não é enfeite: é o que diz a que peça o número se refere. Em **2.780 de 3.348**
linhas de extensão a ponta cai DENTRO da peça medida (folga mediana **0 cm**), e
as duas extensões de uma mesma cota terminam no mesmo lugar (diferença mediana
2 cm). A sobra além da linha de cota é fixa: **2,5 cm** (p10 a p75 todos em 2,5).

O ponto de saída não é o canto da caixa, é **onde a tinta encosta na medida**.
No conjunto "maçã + folha + HORTIFRUTI" da Norte Minas, o topo do conjunto (8 cm
do teto) é a ponta da FOLHA, no meio do desenho — a caixa começa 180 cm à
esquerda, na maçã. Amarrar a extensão na caixa faz a linha apontar para o vazio:
o número fica certo e ilegível. Por isso `owningPart` acha a peça que produziu o
extremo e `PartExtremes` guarda a coordenada exata desse contato.

### 7. A linha de cota fica PERTO do item — e desvia da arte

Distância da linha até o item que ela mede: p25 19, **p50 35**, p75 69, p90 135 cm.
Não existe faixa distante na margem.

| onde o item está | onde vai a linha | contagem |
|---|---|---|
| encostado numa borda perpendicular (< 60 cm) | FORA da face, a ~18 cm dela | 773 × 213 |
| no meio da face (> 200 cm de qualquer borda) | DENTRO, ao lado dele | 91 × 48 |

O lado escolhido é o mais próximo do item em 793 casos contra 199 no lado oposto.
Empilhamento é raro: 451 lados com uma faixa só, 170 com duas, 20 com três, e o
passo entre faixas é de 18 cm (p50).

**A linha nasce AO LADO do trecho medido, nunca em cima dele.** Se ela cair
dentro do intervalo que a peça ocupa, a linha de extensão fica com comprimento
zero: a cota flutua sem nada que a ligue à peça, e o número parece pertencer ao
primeiro traço que estiver por perto — foi assim que o "25" de "Sabor e
Qualidade" foi parar na cauda do "Q". Por isso o afastamento é contado a partir
da BORDA do trecho, não do meio dele.

A linha ainda se desvia: partindo da posição ideal ela caminha para os lados até
achar um corredor livre de arte. Sem isso a cota de uma assinatura embaixo de um
logotipo sobe cortando o logotipo inteiro, com o número e as setas por cima do
desenho. A extensão pode cruzar arte — é fio de cabelo e o projetista faz o
tempo todo —, a linha de cota não.

### 8. A seta vira aos 25 cm — e é do VALOR, não do zoom

Medido em 1.723 cotas com as setas identificadas:

| valor da cota | setas |
|---|---|
| < 12 cm | 92% FORA do vão, apontando para dentro |
| 12–25 cm | 98% fora |
| 25–60 cm | 78% DENTRO |
| 60–150 cm | 98% dentro |
| > 150 cm | 99% dentro |

O limiar é 25 cm. Decidir isso pelo tamanho em PIXELS faz a seta virar sozinha
quando o operador dá zoom — foi assim que o defeito apareceu.

### 9. Cotas relativas dentro do conjunto

O vão entre o logotipo e a assinatura (o "36" do GRESPAN) diz ao aplicador como
montar o conjunto antes de colar. Uma por conjunto, a do maior vão. A variante
horizontal existe mas é rara (11 âncoras) e está desligada por padrão
(`relativeHorizontalDims`).

### 10. O que é UM adesivo

O agrupamento decide o que o operador clica, e errar para mais é pior que errar
para menos: item grande demais engole o vizinho e a cota fica sem dono.

- **Peça** — glifos soldados por uma folga que ACOMPANHA a altura deles
  (0,6 × altura, no mínimo 1,5 cm e no máximo 12 cm). Folga fixa ou parte a
  palavra num logotipo de 1 m ou solda duas linhas de um bloco de 11 cm.
- **Cor separa.** Vinil é cortado por cor: "GRESPAN" vermelho e "Pães
  congelados" preto são duas peças, mesmo coladas uma na outra no desenho.
- **Cores diferentes só se juntam quando as FORMAS se encostam.** A caixa não
  decide: "HORTIFRUTI" cai 99% dentro da caixa da maçã sem tocar nela — a maçã
  é um traço em C e o texto vive no vão. Já o "Ki" branco encosta no círculo
  verde, e aí é um logotipo só.
- **Imagem tem moldura, não contorno.** Metade dos logotipos entra como raster,
  e a caixa declarada é a do arquivo, com a folga transparente em volta. Sem
  recortar a tinta por pixel, a cota ancora no vazio.
- **Caminho com subformas distantes vira vários itens.** O CorelDRAW exporta uma
  marca d'água de dois blocos como UM caminho de 24 subformas.

### 11. O que NÃO se cota

Não se cota o **tamanho** do adesivo: 10 casos em 1.697 (0,6%). Cota-se onde ele
vai, não quanto ele mede — quem corta o vinil já tem o arquivo.

Distribuição das categorias:

| categoria | contagem | |
|---|---|---|
| borda da face → item | 808 | 47,6% |
| borda da face → âncora que o motor não isola | 536 | 31,6% |
| não classificada | 245 | 14,4% |
| entre dois itens | 98 | 5,8% |
| tamanho do item | 10 | 0,6% |

Por face: mediana de **6 cotas cobrindo 2 itens** (p75: 9 cotas, 4 itens).

### 12. A linha de alinhamento — implementada, DESLIGADA

Em "Supermercado" o "p" desce sozinho abaixo de todas as outras letras. Cotar
até ele dá um número certo e inútil: naquela altura não há nada para alinhar.
A referência do aplicador é a base onde S, u, e, r, m, c, a, d, o se apoiam.

O extremo é apurado assim: cada subforma (glifo, pétala, traço) entra com o seu
próprio extremo daquele lado, pesado pela largura que ocupa. Caminhando do
extremo absoluto para dentro e somando peso, a linha é onde a soma cruza 15% —
o "p" pesa ~8%, o rabo do "G" de GRESPAN ~14%, e os dois ficam de fora.

**Mas só apara quando existe uma linha DOMINANTE (≥ 50% da forma).** Sem essa
condição o lado curto da palavra se estraga: na direita de "GRESPAN" só o "N"
está no extremo, e sozinho ele pesa 14% — aparar apontaria a cota para o meio do
logotipo. Na base, ao contrário, seis das sete letras compartilham a linha.

Está no código (`alignEdges`, `profileEdge`) e chega a reproduzir o 150 que o
projetista pôs no GRESPAN — mas **sai de fábrica desligada**, e a razão é
honesta: calibrar *quando a reta existe* se mostrou traiçoeiro.

| caso | o que atrapalha |
|---|---|
| ápice de círculo (logotipo Ki) | uma roda de 2,3 m é quase plana no topo: 75% de apoio e 11 formas na faixa. Parece reta, não é. |
| capitular (o "G" do GRESPAN) | larga demais para o quantil descartar, estreita demais para a moda ignorar |
| fonte cursiva (Norte Minas) | letras ligadas: cada palavra é um caminho só e não há planalto por subforma |
| curva lisa (a maçã) | toda coluna termina noutra altura; qualquer planalto ali é curvatura, não reta |

Cada limiar que resolvia um caso estragava outro, e o quadro do item passou a
cortar letra que devia estar dentro. O padrão voltou ao **extremo real da tinta**
— que é, afinal, o que o adesivo recortado tem. Ligar de novo é `alignEdges: true`,
e o que falta para valer é um discriminador melhor entre reta e curvatura.

## O que a bancada mede

`harness/run.mjs` roda o motor nas 325 faces e compara com o que o projetista
desenhou no mesmo arquivo.

| Métrica | Antes da linha de alinhamento | Agora |
|---|---|---|
| Cotas do projetista reproduzidas (mesmo eixo, âncoras a ≤ 4 cm, valor a ≤ 3 cm) | 33,6% | **45,0%** |
| **Cotas cujas DUAS âncoras o motor enxerga** | 57,7% | **65,0%** |
| Dessas, valor correto | 100% | **1.099 de 1.099 (100%)** |
| Idem, com o ímã manual (cada caminho isolado) | 73,5% | **78,8%** |
| Faces reproduzidas por inteiro | 13 de 325 | **27 de 325** |

A leitura certa: **quando o motor vê as duas pontas, o número está sempre
certo.** A diferença para 100% não é erro de medida, é escolha editorial — qual
das cotas visíveis vale a pena desenhar. O motor erra por excesso de propósito
(4.200 cotas contra 1.690 do projetista, porque cota TODO item): na tela só
aparecem as do adesivo escolhido, e o PDF sai com o que está na tela.

`harness/snaptest2.mjs` mede o ímã manual: com erro de mira de 3 cm e raio de
8 cm, 1.653 medições simuladas deram **77,9% exatas (≤ 1 cm)** e mediana de erro
**0,00 cm**.

## A cota gerada fica perto do item?

É a pergunta que decide se o desenho se lê. Medido em 258 faces:

| | motor | projetista |
|---|---|---|
| cotas por face | 6,0 | 6 (mediana) |
| linha DENTRO da face | 65% | 26% |
| distância linha → item (p50) | **35 cm** | 35 cm |
| idem (p90) | **59 cm** | 135 cm |
| idem (máximo) | **101 cm** | 577 cm |
| extensão encosta num adesivo | **97,6%** | 83% |

**A divergência do "dentro" é deliberada.** O projetista leva a linha para a
margem em 74% dos casos porque coloca à mão e prefere a folha limpa; o preço é
uma extensão que atravessa metade do caminhão e um número que ninguém sabe de
onde saiu. O motor traz a linha para o lado do item, e isso é seguro aqui: uma
cota "topo da face → topo do item" ocupa exatamente a faixa VAZIA entre os dois,
nunca por cima da arte. O resultado é uma cauda muito mais curta — nenhuma cota
a mais de 1 m do que ela mede, contra 5,77 m do pior caso do projetista.

O que sobra de ambiguidade se resolve na tela: no visualizador, clicar num
adesivo mostra **só as cotas dele**.

O envelopamento aparece pelo **contorno real**, não pela caixa: a forma dele é
côncava (uma curva que varre a face de canto a canto) e o retângulo cobre metade
de área vazia. Com a caixa, a cota da travessia parecia não bater com o desenho
— quem não batia era a caixa.
