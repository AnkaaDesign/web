-- SQL Script to Insert Test Pricing Data
-- This script creates a complete pricing entry with multiple items, discount, and all fields populated
-- Run this on your backend database to test the budget PDF export feature

-- Instructions:
-- 1. Replace {TASK_ID} with an actual task ID from your database
-- 2. Run this script on your PostgreSQL/MySQL database
-- 3. Refresh the task detail page to see the pricing
-- 4. Click "Exportar PDF" to test the budget export

-- ============================================
-- STEP 1: Insert TaskPricing Record
-- ============================================

-- Generate a new UUID for the pricing (PostgreSQL)
-- If using MySQL, replace with UUID() function

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
  gen_random_uuid(),                          -- id (PostgreSQL UUID generation)
  NOW(),                                       -- createdAt
  NOW(),                                       -- updatedAt
  15500.00,                                    -- subtotal (sum of items below)
  'PERCENTAGE',                                -- discountType (NONE, PERCENTAGE, FIXED_VALUE)
  10.00,                                       -- discountValue (10% discount)
  13950.00,                                    -- total (subtotal - 10% = 15500 - 1550)
  'APPROVED',                                  -- status (DRAFT, APPROVED, REJECTED, CANCELLED)
  NOW() + INTERVAL '30 days',                 -- expiresAt (valid for 30 days from now)
  '{TASK_ID}'                                  -- taskId - REPLACE THIS WITH ACTUAL TASK ID
)
RETURNING "id" AS pricing_id;

-- ============================================
-- IMPORTANT: Get the pricing_id from above query result
-- Replace {PRICING_ID} below with the returned UUID
-- ============================================

-- ============================================
-- STEP 2: Insert TaskPricingItem Records
-- ============================================

-- Item 1: Adesivação Completa
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
) VALUES (
  gen_random_uuid(),
  NOW(),
  NOW(),
  'Adesivação Completa do Caminhão - Laterais e Traseira',
  8500.00,
  '{PRICING_ID}'  -- Replace with pricing ID from STEP 1
);

-- Item 2: Aplicação de Logotipo
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
) VALUES (
  gen_random_uuid(),
  NOW(),
  NOW(),
  'Aplicação de Logotipo em Vinil de Alta Qualidade',
  2500.00,
  '{PRICING_ID}'  -- Replace with pricing ID from STEP 1
);

-- Item 3: Envelopamento de Para-choque
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
) VALUES (
  gen_random_uuid(),
  NOW(),
  NOW(),
  'Envelopamento Completo de Para-choque Dianteiro',
  1800.00,
  '{PRICING_ID}'  -- Replace with pricing ID from STEP 1
);

-- Item 4: Recorte e Plotagem
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
) VALUES (
  gen_random_uuid(),
  NOW(),
  NOW(),
  'Recorte em Plotter e Plotagem de Arte',
  1200.00,
  '{PRICING_ID}'  -- Replace with pricing ID from STEP 1
);

-- Item 5: Proteção UV
INSERT INTO "TaskPricingItem" (
  "id",
  "createdAt",
  "updatedAt",
  "description",
  "amount",
  "pricingId"
) VALUES (
  gen_random_uuid(),
  NOW(),
  NOW(),
  'Aplicação de Película de Proteção UV',
  1500.00,
  '{PRICING_ID}'  -- Replace with pricing ID from STEP 1
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify the data was inserted correctly:

-- Check pricing record
SELECT * FROM "TaskPricing" WHERE "taskId" = '{TASK_ID}';

-- Check pricing items
SELECT
  tpi.*,
  tp."status" as pricing_status
FROM "TaskPricingItem" tpi
JOIN "TaskPricing" tp ON tpi."pricingId" = tp."id"
WHERE tp."taskId" = '{TASK_ID}'
ORDER BY tpi."createdAt";

-- Verify totals
SELECT
  tp."subtotal",
  tp."discountType",
  tp."discountValue",
  tp."total",
  SUM(tpi."amount") as calculated_subtotal,
  COUNT(tpi."id") as item_count
FROM "TaskPricing" tp
LEFT JOIN "TaskPricingItem" tpi ON tpi."pricingId" = tp."id"
WHERE tp."taskId" = '{TASK_ID}'
GROUP BY tp."id", tp."subtotal", tp."discountType", tp."discountValue", tp."total";

-- ============================================
-- ALTERNATIVE: Single Transaction Version
-- ============================================
-- Use this if you want to insert everything in one transaction
-- Requires manual UUID generation or database-specific UUID functions

/*
BEGIN;

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
    '{TASK_ID}'
  )
  RETURNING "id"
)
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
*/

-- ============================================
-- CLEANUP (if needed)
-- ============================================
-- Run this to remove test data:
-- DELETE FROM "TaskPricingItem" WHERE "pricingId" IN (SELECT "id" FROM "TaskPricing" WHERE "taskId" = '{TASK_ID}');
-- DELETE FROM "TaskPricing" WHERE "taskId" = '{TASK_ID}';
