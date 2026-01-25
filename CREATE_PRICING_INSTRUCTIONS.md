# Create Test Pricing Data

Since the API requires authentication, here are two options to create the test pricing data:

## Option 1: Using Browser Console (Easiest)

1. **Open your browser** and go to any page in your application (make sure you're logged in)

2. **Open Developer Console** (F12 or Right-click → Inspect → Console tab)

3. **Copy and paste this code** into the console and press Enter:

```javascript
// Create test pricing data for task 82d32ee1-6981-4240-996e-255d38faedcb
const TASK_ID = '82d32ee1-6981-4240-996e-255d38faedcb';

const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + 30);
expiryDate.setHours(23, 59, 59, 999);

const pricingData = {
  taskId: TASK_ID,
  subtotal: 15500.00,
  discountType: 'PERCENTAGE',
  discountValue: 10.00,
  total: 13950.00,
  status: 'APPROVED',
  expiresAt: expiryDate.toISOString(),
  items: [
    {
      description: 'Adesivação Completa do Caminhão - Laterais e Traseira',
      amount: 8500.00
    },
    {
      description: 'Aplicação de Logotipo em Vinil de Alta Qualidade',
      amount: 2500.00
    },
    {
      description: 'Envelopamento Completo de Para-choque Dianteiro',
      amount: 1800.00
    },
    {
      description: 'Recorte em Plotter e Plotagem de Arte',
      amount: 1200.00
    },
    {
      description: 'Aplicação de Película de Proteção UV',
      amount: 1500.00
    }
  ]
};

fetch('http://192.168.0.14:3030/task-pricings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify(pricingData)
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ Success! Pricing created:', data);
    console.log('📍 Now refresh the page or go to task detail to see it!');
    alert('✅ Test pricing data created successfully! Refresh the page.');
  })
  .catch(error => {
    console.error('❌ Error:', error);
    alert('❌ Error creating pricing: ' + error.message);
  });
```

4. **You should see** a success message in the console and an alert

5. **Refresh** the task detail page to see the pricing section

---

## Option 2: Using curl with Auth Token

1. **Get your auth token** from browser:
   - Open Developer Tools (F12)
   - Go to Application tab → Cookies
   - Find your auth cookie/token
   - Copy the value

2. **Run this curl command** (replace `YOUR_TOKEN` with your actual token):

```bash
curl -X POST 'http://192.168.0.14:3030/task-pricings' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
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
  }'
```

---

## Option 3: Using SQL Script (Direct Database)

If you have direct database access, use one of these files:

- **Automated:** `insert-test-pricing.sh 82d32ee1-6981-4240-996e-255d38faedcb <DATABASE_URL>`
- **Manual:** Open `insert-pricing-82d32ee1.sql` in your database client

---

## After Creating:

1. ✅ Refresh the task detail page
2. ✅ Scroll to "Precificação Detalhada" section
3. ✅ Click "Exportar PDF" button
4. ✅ Add notes and images (optional)
5. ✅ Generate and download the PDF!

---

## Test Data Summary:

| Item | Description | Value |
|------|-------------|-------|
| 1 | Adesivação Completa do Caminhão | R$ 8.500,00 |
| 2 | Aplicação de Logotipo | R$ 2.500,00 |
| 3 | Envelopamento de Para-choque | R$ 1.800,00 |
| 4 | Recorte e Plotagem | R$ 1.200,00 |
| 5 | Proteção UV | R$ 1.500,00 |
| **Subtotal** | | **R$ 15.500,00** |
| **Discount** | 10% | **- R$ 1.550,00** |
| **TOTAL** | | **R$ 13.950,00** |

- **Status:** APPROVED
- **Valid for:** 30 days
- **Task ID:** 82d32ee1-6981-4240-996e-255d38faedcb
