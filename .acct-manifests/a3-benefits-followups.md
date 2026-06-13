# a3-benefits — followups manifest (2026-06-11)

## Status das registrações compartilhadas (verificado, NADA a aplicar)

Todas as registrações do domínio Benefícios/Adesões JÁ estão aplicadas pelo W4 — verificadas nesta passada:

- `web/src/constants/navigation.ts` — seção "Departamento Pessoal" → sub-grupo "Benefícios" (`dp-beneficios`, `dp-beneficios-lista` Catálogo, `dp-beneficios-adesoes` Adesões, com filhos cadastrar/detalhes/editar), todos com `requiredPrivilege: [ACCOUNTING, HUMAN_RESOURCES, ADMIN]` (linhas ~2067–2098). **Nenhuma alteração pendente.**
- `web/src/utils/route-privileges.ts:244` — `"/departamento-pessoal/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN"]`. OK.
- `web/src/App.tsx` — 8 rotas lazy (catálogo + adesões, list/create/edit/details) registradas (linhas ~134–141 e ~2937–2999). OK.
- `web/src/constants/routes.ts` — `routes.personnelDepartment.benefits.{root,create,edit,details}` + `.enrollments.{root,create,edit,details}`. OK.
- `web/src/constants/enums.ts` — `BENEFIT_KIND`, `BENEFIT_ENROLLMENT_STATUS`, `CHANGE_LOG_ENTITY_TYPE.BENEFIT/USER_BENEFIT`, `FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_LISTAR` + `_ADESOES_LISTAR`. OK.
- `web/src/constants/enum-labels.ts` — labels dos enums + favoritos ("Benefícios", "Adesões de Benefícios"). OK.
- `web/src/api-client/index.ts:144` — `export * from "./benefit"`. OK.
- Query keys (`hooks/common/query-keys.ts`) — `benefitKeys`, `userBenefitKeys` registrados. OK.

## Novidades desta passada (sem necessidade de ação do W4)

- Regra canônica de coparticipação criada em `web/src/utils/benefit-discount.ts`
  (espelho idêntico de `api/src/utils/benefit-discount.ts`), exportada de
  `web/src/utils/index.ts`. O agente de FOLHA DE PAGAMENTO deve importar
  `calculateEmployeeShare` / `calculateBenefitSplit` daí — NÃO duplicar a regra.
- Card de benefícios para o detalhe do colaborador: ver manifesto
  `a3-benefits-user-detail.md` (inserção no detalhe do colaborador é do agente
  responsável por essa página / W4).
