'use strict';

const fs   = require('fs');
const path = require('path');

const TOKEN    = process.env.ARCHIVE_TOKEN || 'p4-archive-2026';
const DATA_DIR = path.join(__dirname, '../data');
const LOG_FILE = path.join(DATA_DIR, 'session-logs.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');

module.exports = (app) => {

  app.post('/api/session-log', (req, res) => {
    const auth = (req.headers['authorization'] || '').trim();
    if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const { session_id, title } = req.body;
    if (!session_id || !title) return res.status(400).json({ ok: false, error: 'session_id and title required' });
    const entry = { ...req.body, created_at: new Date().toISOString() };
    try {
      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      logs.push(entry);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
      return res.json({ ok: true, session_id, total_logs: logs.length });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/session-log', (req, res) => {
    const auth = (req.headers['authorization'] || '').trim();
    if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      return res.json({ ok: true, count: logs.length, logs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[session-log] registered');
};
