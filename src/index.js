'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fetch   = require('node-fetch');

const app = express();

console.log('🚀 P4 Memory Archive starting…');

// ── HTTP Basic Auth (protects dashboard UI, passes /api/ through) ──
const DASH_USER = process.env.DASH_USER || 'p4admin';
const DASH_PASS = process.env.DASH_PASS || 'phase4crm2026';

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    const [user, ...rest] = decoded.split(':');
    const pass = rest.join(':');
    if (user === DASH_USER && pass === DASH_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="P4 Memory Archive"');
  return res.status(401).send('Unauthorized');
});

app.use(cors({
  origin: [
    'https://p4-memory-archive.onrender.com',
    'http://localhost:10000'
  ]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

require('./routes/session-log')(app);
require('./routes/fda-pipeline')(app);
require('./routes/supabase-routes')(app);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server on port ${PORT}`);
});
