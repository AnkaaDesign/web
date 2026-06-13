# a2-payroll — followups / orchestrator notes (2026-06-11)

## Nav / route-privileges — NADA A APLICAR

Verificado no estado atual (nav agent já cobriu):

- `web/src/constants/navigation.ts:2080` — entrada `dp-folha-de-pagamento` (seção Departamento Pessoal → Salários e Cargos) com `[ACCOUNTING, HUMAN_RESOURCES, ADMIN]`. OK.
- `web/src/constants/navigation.ts:1898` — entrada antiga `folha-de-pagamento` na seção RH segue `[HUMAN_RESOURCES, ADMIN]` (intencional: ACCOUNTING navega pela seção DP).
- `web/src/utils/route-privileges.ts:290` — wildcard `"/recursos-humanos/*": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN"]` já cobre `/recursos-humanos/folha-de-pagamento*`. OK.
- Gates de página (`PrivilegeRoute`) em `pages/human-resources/payroll/list.tsx:1057` e `detail.tsx:229,240` já incluem ACCOUNTING. OK.

## Pós-restore do banco (ordem)

1. Conferir migrations aplicadas (inclui `20260611170000_dependents_agenda_postit_loan` — tabela `Dependent` + colunas `PayrollDiscount.totalInstallments/currentInstallment`).
2. `cd api && npx tsx scripts/seed-dependents-loans.ts` — seed determinístico/idempotente: ~8 usuários (não-ADMIN, não desligados) com 1–3 dependentes (mix parentescos/IRRF/salário-família) + 3 empréstimos consignados LOAN parcelados (10× R$ 250,00; 6× R$ 180,50; 12× R$ 99,90) ancorados na folha mais recente de cada usuário.
3. (Opcional, sem banco) `cd api && npx tsx scripts/test-payroll-calculations.ts` — 28 testes puros de INSS/IRRF/salário-família/coparticipação. Devem passar 28/28.

## Tabelas fiscais — fonte e precedência

- Fonte estatutária em `api/src/modules/human-resources/payroll/utils/tax-tables.ts` (versionada por vigência; anos futuros usam a última publicada):
  - INSS 2026 (Portaria Interministerial MPS/MF nº 13/2026): 7,5% até 1.621,00; 9% até 2.902,84; 12% até 4.354,27; 14% até o teto 8.475,55 (desconto máx. R$ 988,09).
  - IRRF mensal (Lei 14.663/2023 + MP 1.294/2025): faixa isenta 2.428,80 … 27,5% acima de 4.664,68 (parcela a deduzir 908,73); dedução por dependente R$ 189,59; desconto simplificado R$ 607,20 (substitui as deduções legais quando mais benéfico).
  - REDUTOR Lei 15.270/2025 (2026+): rendimentos ≤ R$ 5.000 → imposto zero; 5.000,01–7.350,00 → redução = 978,62 − 0,133145 × rendimentos (limitada ao imposto); acima → sem redução.
  - Salário-família 2026: R$ 67,54/filho (≤14 anos ou inválido) para remuneração ≤ R$ 1.980,38.
- TaxTable do banco (quando existir para o ano) tem precedência nos BRACKETS; o redutor vem SEMPRE das constantes (o modelo TaxBracket não o representa), com override opcional via `taxTable.settings.redutor`.
- NÃO é necessário seedar TaxTable 2026 no banco — o fallback estatutário cobre.

## Diferido / decisões em aberto

1. **Salário-família na folha**: cálculo puro pronto (`computeSalarioFamilia` + dependente.salarioFamilia + testes), mas NÃO integrado ao holerite — o modelo `Payroll` não tem coluna de proventos extras e `PayrollDiscount` só representa descontos. Requer migração (ex.: coluna `salarioFamiliaAmount`) ou linha de provento; decidir com a Andressa.
2. **Bônus na base de INSS/IRRF**: comportamento existente mantido — a bonificação integra o bruto e, portanto, as bases. Pós-reforma trabalhista, "prêmios" por liberalidade podem não integrar o salário de contribuição; confirmar enquadramento contábil.
3. **DSR sobre faltas**: o desconto de faltas usa horas × valor-hora; a perda de DSR proporcional (calculateAbsenceDeduction já existe no serviço de impostos) não é aplicada pelo calculador completo. Tipos PARTIAL_ABSENCE/DSR_ABSENCE seguem sem uso.
4. **FGTS na folha salva vs ao vivo**: folha salva materializa linha `FGTS (Empregador)` (informativa, fora de totalDiscounts); a folha ao vivo não cria a linha (mostra via fgtsAmount). Convenção de exibição: a UI nunca soma FGTS nos descontos do colaborador.
5. **Mobile**: sem paridade de telas (somente enums, conforme contrato §7).

## Mudanças de cálculo aplicadas (registro para auditoria)

- IRRF 2026 com redutor Lei 15.270/2025 (antes faltava → IRRF a maior para salários ≤ 7.350).
- INSS/IRRF/FGTS agora incidem sobre a remuneração DEVIDA (bruto − faltas injustificadas − atrasos), não sobre o bruto cheio.
- Folha AO VIVO passou a passar os descontos persistentes PARA DENTRO do calculador (antes descontos percentuais persistentes — ex.: pensão % — contavam ZERO no modo ao vivo).
- Coparticipação de benefícios (UserBenefit ACTIVE) entra na folha via regra canônica `api/src/utils/benefit-discount.ts` (uma linha de desconto por adesão; adesão é ignorada quando já existe desconto persistente manual do mesmo tipo — anti dupla contagem).
