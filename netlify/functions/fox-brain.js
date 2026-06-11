// fox-brain.js — secure proxy to the Anthropic API.
// The API key lives ONLY in a Netlify environment variable (ANTHROPIC_API_KEY),
// never in the app code or the browser. The app POSTs a normal Messages-API
// body here; this function adds the key and forwards it to Anthropic.

exports.handler = async (event) => {
  // CORS preflight (so the browser is happy)
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Netlify environment variables.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Bad JSON body' }) };
  }

  // Basic safety: cap max_tokens so a bug can't run up a huge bill.
  if (typeof body.max_tokens !== 'number' || body.max_tokens > 2000) {
    body.max_tokens = Math.min(body.max_tokens || 1000, 2000);
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Allow the web_search tool to run server-side.
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors,
      body: JSON.stringify({ error: 'Upstream error: ' + (err.message || 'unknown') }),
    };
  }
};
