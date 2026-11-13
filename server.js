const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const BASE = 'https://api.omegatech.app';

// ===== Chat models =====
const CHAT_MODELS = {
  claude:    { path: '/api/ai/Chatbot',           field: 'reply',     label: 'Claude' },
  gemini:    { path: '/api/ai/Gemini-premuim',    field: 'answer',    label: 'Gemini Premium' },
  gpt4mini:  { path: '/api/ai/Gpt-4-mini',        field: 'answer',    label: 'GPT-4o-mini' },
  qwen:      { path: '/api/ai/Qwen-Claude-Haiku', field: 'answer',    label: 'Qwen3 80B' },
  gemmacode: { path: '/api/ai/Gemma-code-gen',    field: 'data.code', label: 'Gemma Code' },
};

async function omegaPost(endpoint, body) {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.error || data.raw || `HTTP ${res.status}`);
  }
  return data;
}

// ===== CHAT =====
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'claude', sessionId } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message khali hai' });
    }
    const cfg = CHAT_MODELS[model];
    if (!cfg) return res.status(400).json({ error: 'Invalid model' });

    const body = { message };
    if (sessionId) body.sessionId = sessionId;

    const data = await omegaPost(cfg.path, body);

    let reply = '';
    if (cfg.field === 'data.code') reply = data?.data?.code || '';
    else reply = data?.[cfg.field] || '';
    if (!reply) reply = data?.answer || data?.reply || data?.message || '';

    res.json({
      reply: reply || '(khali jawab aaya)',
      sessionId: data.sessionId || data?.data?.sessionId || null,
      chatId: data.chatId || null,
      meta: {
        model: data.model || cfg.label,
        modelLabel: data.modelLabel || cfg.label,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== IMAGE EDIT =====
app.post('/api/image-edit', async (req, res) => {
  try {
    const { prompt, image, mask, size } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    if (!image) return res.status(400).json({ error: 'Image required' });

    const body = { prompt, image };
    if (mask) body.mask = mask;
    if (size) body.size = size;

    const data = await omegaPost('/api/ai/Gpt-image-edit', body);

    const imageUrl = data?.imageUrl || data?.url || data?.data?.imageUrl || data?.data?.url || data?.data?.[0]?.url || null;
    const b64 = data?.b64_json || data?.data?.b64_json || data?.data?.[0]?.b64_json || null;

    res.json({ imageUrl, b64, raw: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== FLUX IMAGE GENERATION =====
app.post('/api/image-gen', async (req, res) => {
  try {
    const { prompt, size, steps } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const body = { prompt };
    if (size) body.size = size;
    if (steps) body.steps = steps;

    const data = await omegaPost('/api/ai/flux', body);

    const findImage = (obj) => {
      if (!obj || typeof obj !== 'object') return { url: null, b64: null };
      const url = obj.imageUrl || obj.url || obj.image ||
                  obj?.data?.imageUrl || obj?.data?.url || obj?.data?.image ||
                  obj?.data?.[0]?.url || obj?.data?.[0]?.imageUrl ||
                  obj?.result?.url || obj?.result?.imageUrl ||
                  obj?.output?.url || obj?.output?.[0] || null;
      const b64 = obj.b64_json || obj?.data?.b64_json || obj?.data?.[0]?.b64_json ||
                  obj?.result?.b64_json || obj?.output?.b64_json || null;
      return { url, b64 };
    };

    const { url, b64 } = findImage(data);
    res.json({ imageUrl: url, b64, raw: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DOWNLOADS =====
app.get('/api/downloads', async (req, res) => {
  try {
    const r = await fetch(BASE + '/api/download/all');
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HEALTH =====
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Taha AI ready → http://localhost:${PORT}\n`);
});
