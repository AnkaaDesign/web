#!/bin/bash

# Instructions:
# 1. Open your browser Developer Tools (F12)
# 2. Go to Application/Storage tab → Cookies → http://192.168.0.14:3030
# 3. Find and copy the authentication cookie (usually named "token" or "access_token" or "connect.sid")
# 4. Replace YOUR_COOKIE_VALUE below with the actual cookie value
# 5. Run this script: ./CURL_CREATE_PRICING.sh

# Or run this curl command directly with your cookie:

COOKIE_VALUE="${1:-YOUR_COOKIE_VALUE}"

if [ "$COOKIE_VALUE" = "YOUR_COOKIE_VALUE" ]; then
  echo "❌ Please provide your authentication cookie value"
  echo ""
  echo "Usage: ./CURL_CREATE_PRICING.sh <cookie_value>"
  echo ""
  echo "Or edit this file and replace YOUR_COOKIE_VALUE with your actual cookie"
  echo ""
  echo "To get your cookie:"
  echo "  1. Open browser DevTools (F12)"
  echo "  2. Go to Application → Cookies"
  echo "  3. Find the auth cookie for http://192.168.0.14:3030"
  echo "  4. Copy the cookie value"
  exit 1
fi

echo "Creating test pricing data..."
echo ""

curl -X POST 'http://192.168.0.14:3030/task-pricings' \
  -H 'Content-Type: application/json' \
  -H "Cookie: connect.sid=$COOKIE_VALUE" \
  -d '{
  "taskId": "82d32ee1-6981-4240-996e-255d38faedcb",
  "subtotal": 15500.00,
  "discountType": "PERCENTAGE",
  "discountValue": 10.00,
  "total": 13950.00,
  "status": "APPROVED",
  "expiresAt": "2026-02-13T23:59:59.999Z",
  "items": [
    {
      "description": "Adesivação Completa do Caminhão - Laterais e Traseira",
      "amount": 8500.00
    },
    {
      "description": "Aplicação de Logotipo em Vinil de Alta Qualidade",
      "amount": 2500.00
    },
    {
      "description": "Envelopamento Completo de Para-choque Dianteiro",
      "amount": 1800.00
    },
    {
      "description": "Recorte em Plotter e Plotagem de Arte",
      "amount": 1200.00
    },
    {
      "description": "Aplicação de Película de Proteção UV",
      "amount": 1500.00
    }
  ]
}' | jq '.'

echo ""
echo "✅ If successful, refresh your browser to see the pricing!"
