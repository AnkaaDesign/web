#!/usr/bin/env node

/**
 * Script to create test pricing data via API
 * Task ID: 82d32ee1-6981-4240-996e-255d38faedcb
 */

const API_URL = 'http://192.168.0.14:3030';
const TASK_ID = '82d32ee1-6981-4240-996e-255d38faedcb';

// Calculate expiry date (30 days from now)
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

console.log('================================================');
console.log('Creating Test Pricing Data via API');
console.log('================================================');
console.log('');
console.log(`API URL: ${API_URL}`);
console.log(`Task ID: ${TASK_ID}`);
console.log('');
console.log('Pricing Data:');
console.log(`  Subtotal: R$ ${pricingData.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`  Discount: ${pricingData.discountValue}% (R$ ${(pricingData.subtotal * pricingData.discountValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
console.log(`  Total: R$ ${pricingData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`  Status: ${pricingData.status}`);
console.log(`  Items: ${pricingData.items.length}`);
console.log(`  Expires: ${expiryDate.toLocaleDateString('pt-BR')}`);
console.log('');
console.log('📡 Sending request to API...');
console.log('');

// Make HTTP request
fetch(`${API_URL}/task-pricings`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(pricingData)
})
  .then(response => {
    console.log(`Response status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      return response.json().then(err => {
        throw new Error(JSON.stringify(err, null, 2));
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('');
    console.log('✅ Success! Test pricing data created.');
    console.log('');
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    console.log('🎯 Next steps:');
    console.log('  1. Refresh the task detail page in your browser');
    console.log(`  2. Go to: http://localhost:5173/producao/agenda/${TASK_ID}/editar`);
    console.log('  3. Scroll to "Precificação Detalhada" section');
    console.log('  4. Click "Exportar PDF" button');
    console.log('  5. Test the PDF export!');
    console.log('');
  })
  .catch(error => {
    console.error('');
    console.error('❌ Error creating pricing data:');
    console.error(error.message);
    console.error('');
    console.error('Possible issues:');
    console.error('  - API server is not running');
    console.error('  - Task ID does not exist');
    console.error('  - Task already has pricing data');
    console.error('  - Network connection issue');
    console.error('');
    process.exit(1);
  });
