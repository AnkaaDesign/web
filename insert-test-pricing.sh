#!/bin/bash

# Script to insert test pricing data for a task
# This script helps you quickly add test pricing data to test the PDF export feature

echo "================================================"
echo "Test Pricing Data Insertion Script"
echo "================================================"
echo ""

# Check if task ID is provided as argument
if [ -z "$1" ]; then
  echo "Usage: ./insert-test-pricing.sh <TASK_ID> [DATABASE_URL]"
  echo ""
  echo "Example:"
  echo "  ./insert-test-pricing.sh 123e4567-e89b-12d3-a456-426614174000"
  echo "  ./insert-test-pricing.sh 123e4567-e89b-12d3-a456-426614174000 postgresql://user:pass@localhost:5432/dbname"
  echo ""
  echo "Or you can run the SQL manually:"
  echo "  1. Open test-pricing-insert.sql"
  echo "  2. Replace {TASK_ID} with your actual task ID"
  echo "  3. Run the SQL in your database client"
  exit 1
fi

TASK_ID=$1
DATABASE_URL=${2:-${DATABASE_URL}}

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not provided and not found in environment"
  echo ""
  echo "Please provide database URL as second argument or set DATABASE_URL environment variable:"
  echo "  export DATABASE_URL='postgresql://user:pass@localhost:5432/dbname'"
  echo "  ./insert-test-pricing.sh $TASK_ID"
  exit 1
fi

echo "📋 Task ID: $TASK_ID"
echo "🗄️  Database: ${DATABASE_URL%%@*}@..." # Hide password in output
echo ""

# Create temporary SQL file with replaced variables
TEMP_SQL=$(mktemp)

cat > "$TEMP_SQL" << 'EOSQL'
-- Insert Test Pricing Data
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
    '__TASK_ID__'
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

-- Display inserted data
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
WHERE tp."taskId" = '__TASK_ID__'
GROUP BY tp."id", tp."subtotal", tp."discountType", tp."discountValue", tp."total", tp."status", tp."expiresAt";
EOSQL

# Replace placeholders
sed -i "s/__TASK_ID__/$TASK_ID/g" "$TEMP_SQL"

echo "🚀 Inserting test pricing data..."
echo ""

# Execute SQL
if command -v psql &> /dev/null; then
  psql "$DATABASE_URL" -f "$TEMP_SQL"
  EXIT_CODE=$?
else
  echo "❌ psql command not found. Please install PostgreSQL client tools."
  echo ""
  echo "Generated SQL saved to: $TEMP_SQL"
  echo "You can run it manually using your database client."
  EXIT_CODE=1
fi

# Cleanup
if [ $EXIT_CODE -eq 0 ]; then
  rm "$TEMP_SQL"
  echo ""
  echo "✅ Test pricing data inserted successfully!"
  echo ""
  echo "📊 Summary:"
  echo "  - Subtotal: R$ 15.500,00"
  echo "  - Discount: 10% (R$ 1.550,00)"
  echo "  - Total: R$ 13.950,00"
  echo "  - Items: 5 services"
  echo "  - Status: APPROVED"
  echo "  - Valid for: 30 days"
  echo ""
  echo "🎯 Next steps:"
  echo "  1. Refresh the task detail page in your browser"
  echo "  2. Click 'Exportar PDF' button in the pricing section"
  echo "  3. Add notes and images (optional)"
  echo "  4. Generate the PDF and verify the output"
  echo ""
else
  echo ""
  echo "⚠️  SQL file saved to: $TEMP_SQL"
  echo "You can inspect and run it manually."
fi

exit $EXIT_CODE
