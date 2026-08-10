# Screenshots do app — índice das marcações

Estes arquivos **precisam ser largados aqui pelo Kennedy**: eles vieram como anexos
de chat e não há como gravá-los em disco a partir dali.

Salve cada um com o nome indicado. O que está descrito abaixo é o que a marcação
vermelha cerca e, quando eu consegui derivar por projeção inversa, a coordenada de
mundo correspondente (X direita, Y frente, Z cima — espaço do build).

A câmera do `g_top` usada nas projeções: alvo `(0, 10, 0)`, distância `470`,
direção `(0.30, -0.30, 1.0)`, FOV `40`, render `1000x600`. Validada com o caminhão
na origem caindo em px(496,302) contra os ~(497,300) observados.

---

## 01-juncao-L-antes.png
Topo fechado da boca do entroncamento (rua interna × pista A leste, y 27..35).
**Sem marcação.** É o "L terrível": meio-fio terminando no ar dos dois lados da
boca, asfalto esticado na concordância.
**Status: CORRIGIDO** (arco de guia + sarjeta tangente, UV refeita).

## 02-arvores-topo.png
Vista de cima do sítio inteiro. **Sem marcação.** As árvores lidas como X/estrela.
**Status: CORRIGIDO de cima** — mas ver 08.

## 03-construcoes-sobrepostas.png
Vista de cima com **dois círculos vermelhos**, ambos resolvendo para o mesmo par:
- `long hall` (`ibc12`) — mundo (82.75, −10.50), pegada x 68.0..97.5, y −42.7..21.7
- `small warehouse 2` (`shed_sm`) — mundo (87.75, −10.00), pegada x 79.0..96.5, y −16.3..−3.7
O segundo círculo, invertido em z=0, cai em (78.2, −39.2) — a ponta sul do
`long hall` dentro da transversal (y −44..−36).
**Status: CORRIGIDO** (separados; rua da doca encurtada para x=62 porque o galpão
de 64,4 m não cabia na faixa de 63 m entre as duas vias internas).

## 04-estacionamento-marcacao.png
Vista de cima, marca em L na faixa ao sul da transversal.
Invertido: canto superior (18.9, −51.3), canto inferior-direito (61.0, −45.6).
**Status: CORRIGIDO** — estacionamento novo em `PARKING`, eixo "x",
`(20.0, -45.0, 17, 2.5, 5.0, "x")`.

## 05-porta-piscando-A.png
Prédio de bloco (família `mc_*`), **círculo vermelho numa porta** da fachada
frontal, ao lado da porta de enrolar.
**Status: NÃO CONFIRMADO CORRIGIDO.** Ver "Piscando" no PROMPT.md.

## 06-porta-piscando-B.png
Outro prédio de bloco, **círculo vermelho numa porta** isolada à direita da
fachada, entre dois quadros elétricos.
**Status: NÃO CONFIRMADO CORRIGIDO.**

## 07-elemento-piscando-topo.png
**Círculo vermelho num elemento sobre a construção** (topo/beiral), acima do
caminhão. Peça pequena aplicada na fachada.
**Status: NÃO CONFIRMADO CORRIGIDO.**

## 08-arvores-de-perto.png
Cinturão visto do chão. As árvores lidas como cartões cruzados / "2 folhas
cruzadas", e numa versão intermediária como **guarda-sóis** (o cartão de copa
horizontal).
**Status: PARCIAL.** Guarda-sol removido; ainda são cartões.

## 09-canteiro-elevado-e-buracos.png
Vista do app com **retângulo vermelho** sobre o canteiro entre as pistas, na
altura da abertura da transversal (y −44..−36).
Dois defeitos relatados: a faixa parece elevada, e **cada quina tem um buraco**.
**Status: buracos CORRIGIDOS** (o nariz ia dorso-a-dorso e deixava 62×62 cm
descobertos em cada quina, mostrando a brita 63 cm abaixo);
**altura CORRIGIDA** (a travessia cruzava o canteiro apoiada na cota do pátio).
**Cantos arredondados: NÃO FEITO.**

## 10-cantos-altura-bugada.png
Rasante mostrando a guia da via interna com face muito alta e a laje parecendo
afundada.
**Status: CORRIGIDO** — o dorso da guia era a constante `KERB_TOP` enquanto o
asfalto desce 20 cm em rampa; e o rebaixo da laje era um retângulo 6,5 m mais
largo que a rua, criando um degrau reto paralelo à via.

## 11-linha-reta-na-boca.png
Rasante com **traço vermelho** sobre a linha de bordo atravessando reta a boca do
entroncamento.
**Status: CORRIGIDO** — arco concêntrico de raio `FLARE_R + 0.42`, tangente
verificada nos 8 pontos com erro < 4e-14 m.

## 12-textura-rua-principal.png
Vista do app: a pista principal com aspecto manchado diferente do pátio e das
vias secundárias.
**Status: CORRIGIDO em duas frentes** — aliasing do `COLOR_0` (malha de 7,9 m
amostrando ruído de 5 m) e semente por malha (campo unificado).
