// Copy and paste this entire code into your browser console (F12 → Console tab)
// Make sure you're on the application (logged in) when you run this

(async function() {
  const TASK_ID = '82d32ee1-6981-4240-996e-255d38faedcb';
  const API_URL = 'http://192.168.0.14:3030';

  console.log('🚀 Creating test pricing data...');
  console.log('Task ID:', TASK_ID);

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

  try {
    const response = await fetch(`${API_URL}/task-pricings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(pricingData)
    });

    const data = await response.json();

    if (response.ok && data.success !== false) {
      console.log('✅ SUCCESS!');
      console.log('Pricing created:', data);
      console.log('');
      console.log('📍 Next steps:');
      console.log('  1. Refresh this page (F5)');
      console.log('  2. Scroll to "Precificação Detalhada"');
      console.log('  3. Click "Exportar PDF"');
      alert('✅ Pricing created successfully! Refresh the page (F5) to see it.');
    } else {
      throw new Error(data.message || data.error || 'Failed to create pricing');
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('');
    console.error('Possible issues:');
    console.error('  - Task already has pricing (delete it first)');
    console.error('  - API server not running');
    console.error('  - Not authenticated');
    console.error('  - Task does not exist');
    alert('❌ Error: ' + error.message);
  }
})();
