const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'missing_key', detail: 'ANTHROPIC_API_KEY is not set.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'bad_json' }) }; }

  if (typeof body.max_tokens !== 'number' || body.max_tokens > 2000) {
    body.max_tokens = Math.min(body.max_tokens || 1000, 2000);
  }

  try {
    const headers = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    };

    if (typeof fetch === 'function') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const text = await resp.text();
      return { statusCode: resp.status, headers: CORS, body: text };
    }

    const https = require('https');
    const payload = JSON.stringify(body);
    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
          headers: { ...headers, 'content-length': Buffer.byteLength(payload) } },
        (res) => { let data = ''; res.on('data', (c) => (data += c)); res.on('end', () => resolve({ status: res.statusCode, body: data })); }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    return { statusCode: result.status, headers: CORS, body: result.body };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'proxy_failed', detail: String((err && err.message) || err) }) };
  }
};
