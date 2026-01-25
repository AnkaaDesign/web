-- SQL Script to Insert Test Pricing Data
-- Task ID: 82d32ee1-6981-4240-996e-255d38faedcb
-- Ready to execute - no placeholders to replace!

BEGIN;

-- Insert pricing record and capture the ID
WITH pricing_insert AS (
  INSERT INTO "TaskPricing" (
    "id",
    "createdAt",
    "updatedAt",
    "subtotal",
    "discountType",
    "discountValue",
    "total",
    "status",
    "expiresAt",
    "taskId"
  ) VALUES (
    gen_random_uuid(),
    NOW(),
    NOW(),
    15500.00,
    'PERCENTAGE',
    10.00,
    13950.00,
    'APPROVED',
    NOW() + INTERVAL '30 days',
    '82d32ee1-6981-4240-996e-255d38faedcb'
  )
  RETURNING "id"
)
-- Insert all pricing items
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
)
SELECT
  gen_random_uuid(),
  NOW(),
  NOW(),
  description,
  amount,
  (SELECT "id" FROM pricing_insert)
FROM (VALUES
  ('Adesivação Completa do Caminhão - Laterais e Traseira', 8500.00),
  ('Aplicação de Logotipo em Vinil de Alta Qualidade', 2500.00),
  ('Envelopamento Completo de Para-choque Dianteiro', 1800.00),
  ('Recorte em Plotter e Plotagem de Arte', 1200.00),
  ('Aplicação de Película de Proteção UV', 1500.00)
) AS items(description, amount);

COMMIT;

-- Verify the inserted data
SELECT
  tp."id" as pricing_id,
  tp."subtotal",
  tp."discountType",
  tp."discountValue",
  tp."total",
  tp."status",
  tp."expiresAt",
  COUNT(tpi."id") as item_count
FROM "TaskPricing" tp
LEFT JOIN "TaskPricingItem" tpi ON tpi."pricingId" = tp."id"
WHERE tp."taskId" = '82d32ee1-6981-4240-996e-255d38faedcb'
GROUP BY tp."id", tp."subtotal", tp."discountType", tp."discountValue", tp."total", tp."status", tp."expiresAt";

-- Display all items
SELECT
  tpi."description",
  tpi."amount",
  tp."status" as pricing_status
FROM "TaskPricingItem" tpi
JOIN "TaskPricing" tp ON tpi."pricingId" = tp."id"
WHERE tp."taskId" = '82d32ee1-6981-4240-996e-255d38faedcb'
ORDER BY tpi."createdAt";
