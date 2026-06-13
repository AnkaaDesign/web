# a7-financeiro — follow-ups for the nav agent (route-privileges.ts)

Audit date: 2026-06-11. Navigation.ts is already fully wired for ACCOUNTING
(Financeiro section, Conciliação subtree, ACCOUNTING-only "Notas Fiscais" →
/financeiro/conciliacao/notas, Contas a Pagar, Custo de Funcionário) — no
navigation.ts changes needed.

## 1. route-privileges.ts — add FINANCIAL to the order detail route

`ROUTE_PRIVILEGES` is runtime-enforced by `AutoPrivilegeRoute`. The Contas a
Pagar page (`/financeiro/contas-a-pagar`, gated ACCOUNTING/FINANCIAL/ADMIN)
links every row and its context menu ("Ver pedido") to
`/estoque/pedidos/detalhes/:id`, and the reconciliation pages can also land
there. FINANCIAL is currently missing from that route entry, so a FINANCIAL
user clicking a payable row gets "Acesso Negado".

In `web/src/utils/route-privileges.ts` line ~108 change:

```ts
  "/estoque/pedidos/detalhes/:id": ["WAREHOUSE", "ACCOUNTING", "ADMIN"], // Order detail - ACCOUNTING read access
```

to:

```ts
  "/estoque/pedidos/detalhes/:id": ["WAREHOUSE", "FINANCIAL", "ACCOUNTING", "ADMIN"], // Order detail - FINANCIAL/ACCOUNTING read access (contas a pagar)
```

The page-level `PrivilegeRoute` in
`web/src/pages/inventory/orders/details/[id].tsx` was already widened by this
agent to `[WAREHOUSE, FINANCIAL, ACCOUNTING, ADMIN]` (write actions stay
gated by `canEditOrders` = WAREHOUSE/ADMIN), and the API `GET /orders/:id`
already allows FINANCIAL and ACCOUNTING — only this route map entry is left.
