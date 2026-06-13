# a3-benefits — inserção no detalhe do colaborador (2026-06-11)

Componente self-contained criado em:
`web/src/components/personnel-department/user-benefit/user-benefits-card.tsx`

Mostra as adesões ATIVAS do colaborador com a divisão de custo
**Empresa Paga × Colaborador Paga** (regra canônica `utils/benefit-discount`,
a mesma da folha: VT percentual = % do salário-base limitado ao custo; demais
= % do custo), com linha de totais mensais e link para a lista de adesões
filtrada pelo colaborador. Busca os próprios dados (só precisa do `userId`).

## Alvo

`web/src/pages/administration/collaborators/details/[id].tsx`

## 1. Import (junto aos demais imports de componentes)

```tsx
import { UserBenefitsCard } from "@/components/personnel-department/user-benefit/user-benefits-card";
```

## 2. JSX — inserir após o grid "Professional and Login Info Grid" (após a div
que contém `<ProfessionalInfoCard user={user} />` e `<LoginInfoCard user={user} />`)
e antes do grid de PPE Sizes/Changelog:

```tsx
            {/* Benefícios ativos (Empresa × Colaborador) */}
            <UserBenefitsCard userId={id} />
```

Observação: a página já está gated; o endpoint `GET /user-benefits` exige
ACCOUNTING/HUMAN_RESOURCES/ADMIN — para outros privilégios que enxerguem o
detalhe do colaborador, o card mostrará o estado de erro silencioso da query
(lista vazia). Se desejado, condicionar a renderização ao privilégio:

```tsx
{[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN].includes(
  user?.sector?.privileges as SECTOR_PRIVILEGES,
) && <UserBenefitsCard userId={id} />}
```

(`user` aqui é o usuário LOGADO via `useAuth()`, não o colaborador exibido.)
