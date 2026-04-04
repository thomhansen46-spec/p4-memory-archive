'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fetch   = require('node-fetch');

const app = express();

console.log('🚀 P4 Memory Archive starting…');

app.use(cors({
  origin: [
    'https://p4-memory-archive.onrender.com',
    'http://localhost:10000'
  ]
}));

app.use(express.json());

require('./routes/session-log')(app);
require('./routes/fda-pipeline')(app);
require('./routes/supabase-routes')(app);

app.post('/api/add', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'prompt is required' });
    }
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${process.env.NOTION_API_KEY}`,
        'Content-Type':   'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent:     { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          Prompt:   { title:     [{ text: { content: prompt.trim() } }] },
          Response: { rich_text: [{ text: { content: 'Logged from system' } }] }
        }
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      return res.status(502).json({ message: 'Notion API error', detail: errBody });
    }
    res.json({ message: 'Saved to Notion ✅' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/session-log', require('./routes/session-log'));  // ✅ ADD HERE

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  console.error('[unhandled error]', err.stack || err.message);
  res.status(500).json({ ok: false, error: err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
