'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fetch   = require('node-fetch');

const app = express();

console.log('P4 Memory Archive starting...');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://p4-memory-archive.onrender.com'
  ]
}));
app.use(express.json());

// Static pages
app.get('/',              (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/login.html',    (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/dashboard.html',(req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));

// JWT auth middleware
const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug';

async function requireAuth(req, res, next) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON }
    });
    if (!r.ok) return res.status(401).json({ error: 'Invalid session' });
    req.user = await r.json();
    next();
  } catch(e) {
    res.status(401).json({ error: 'Auth check failed' });
  }
}

// Routes
require('./routes/session-log')(app);
require('./routes/sessions')(app);
require('./routes/fda-pipeline')(app);
require('./routes/supabase-routes')(app, requireAuth);

// Start
const PORT = process.env.PORT || 10000;
app.get('/api/rpn', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('abbott_eu_fmea')
      .select('*')
      .order('rpn', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json(error);
    }

    res.json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server error' });
  }
});
app.listen(PORT, () => console.log('Server on port ' + PORT));
