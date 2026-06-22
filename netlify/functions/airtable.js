const https = require('https');

exports.handler = async function(event) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "No Airtable token configured" }) };
  }

  const path = (event.queryStringParameters && event.queryStringParameters.path) || '';
  const qs = (event.queryStringParameters && event.queryStringParameters.qs) || '';
  const url = `https://api.airtable.com/v0/${path}${qs ? '?' + qs : ''}`;

  return new Promise((resolve) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: body
        });
      });
    });
    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
  });
};
