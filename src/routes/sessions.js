'use strict';
const fetch = require('node-fetch');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug';
const sbH = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
module.exports = (app) => {
  app.get('/sessions', async (req, res) => {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/sessions?select=*&order=created_at.desc&limit=200', { headers: sbH });
      res.json(await r.json());
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/sessions', async (req, res) => {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/sessions', { method: 'POST', headers: { ...sbH, 'Prefer': 'return=representation' }, body: JSON.stringify(req.body) });
      res.status(201).json(await r.json());
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/sessions/:id', async (req, res) => {
    try {
      await fetch(SUPABASE_URL + '/rest/v1/sessions?id=eq.' + req.params.id, { method: 'DELETE', headers: sbH });
      res.json({ deleted: req.params.id });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
};
