const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { amount, name, email, note } = body;

  if (!amount || amount < 100) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Amount must be at least $1.00' }) };
  }

  // Build Stripe Checkout Session payload
  const siteUrl = 'https://macklegaldash.netlify.app';
  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    'mode': 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': amount.toString(),
    'line_items[0][price_data][product_data][name]': 'MACK Legal Services',
    'line_items[0][price_data][product_data][description]': note || 'Process Serving Services',
    'line_items[0][quantity]': '1',
    'customer_email': email,
    'metadata[client_name]': name,
    'metadata[note]': note || '',
    'success_url': `${siteUrl}/payment.html?status=success`,
    'cancel_url': `${siteUrl}/payment.html?status=cancel`
  });

  const postData = params.toString();

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.stripe.com',
      path: '/v1/checkout/sessions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            resolve({
              statusCode: 400,
              headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: parsed.error.message })
            });
          } else {
            resolve({
              statusCode: 200,
              headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: parsed.id, url: parsed.url })
            });
          }
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error' }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(postData);
    req.end();
  });
};
