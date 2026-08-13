// ============================================================
//  Mystic 后端代理 — 托管网页 + 代理 DeepSeek AI 解读
//  仅用 Node.js 内置模块，零 npm 依赖，方便一键部署。
//  API Key 只存在服务端环境变量，绝不下发到浏览器。
// ============================================================
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.DEEPSEEK_API_KEY;            // 必填
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ---- 极简限流：每 IP 每分钟最多 30 次，防滥用刷爆账单 ----
const hits = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (arr.length >= RATE_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ---- AI 代理 ----
  if (req.method === 'POST' && req.url === '/api/interpret') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' }));
    }
    return handleInterpret(req, res);
  }

  // ---- 健康检查 ----
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, hasKey: !!API_KEY, model: MODEL }));
  }

  // ---- 托管前端页面 ----
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const file = path.join(__dirname, 'fortune-app.html');
    return fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }

  res.writeHead(404); res.end('Not found');
});

function handleInterpret(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'SERVER_MISSING_KEY', message: '服务端未配置 DEEPSEEK_API_KEY' }));
  }

  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body); } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'BAD_JSON' }));
    }

    const userPrompt = String(payload.prompt || '').slice(0, 4000);
    const systemPrompt = String(payload.system || 'You are a helpful assistant.').slice(0, 2000);
    const maxTokens = Math.min(Number(payload.maxTokens) || 900, 2000);
    if (!userPrompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'EMPTY_PROMPT' }));
    }

    const apiBody = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: maxTokens
    });

    const options = {
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(apiBody)
      }
    };

    const r = https.request(options, (resp) => {
      let data = '';
      resp.on('data', d => data += d);
      resp.on('end', () => {
        if (resp.statusCode !== 200) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'UPSTREAM_ERROR', status: resp.statusCode, detail: data.slice(0, 400) }));
        }
        try {
          const json = JSON.parse(data);
          const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text }));
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'PARSE_ERROR', detail: data.slice(0, 400) }));
        }
      });
    });
    r.on('error', e => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'NETWORK_ERROR', message: e.message }));
    });
    r.on('timeout', () => { r.destroy(new Error('timeout')); });
    r.write(apiBody);
    r.end();
  });
}

server.listen(PORT, () => {
  console.log('✨ Mystic server running on port ' + PORT);
  console.log(API_KEY ? '✅ DeepSeek key loaded' : '⚠️  DEEPSEEK_API_KEY 未设置 — AI 解读将不可用');
});
