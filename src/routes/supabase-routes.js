'use strict';

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

function headers() {
  return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
}

async function query(table, params) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + params;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

module.exports = function(app) {

  app.get('/api/db/health', async (req, res) => {
    try {
      const tables = ['pma_approvals','maude_events','recalls'];
      const counts = {};
      for (const t of tables) {
        const r = await fetch(SUPABASE_URL + '/rest/v1/' + t + '?select=id&limit=1', {
          headers: { ...headers(), 'Prefer': 'count=exact' }
        });
        counts[t] = r.headers.get('content-range') || '?';
      }
      res.json({ ok: true, counts });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pma', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('pma_approvals', 'select=id,applicant,device_name,product_code,decision_code,decision_date,advisory_committee,supplement_number&order=decision_date.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/maude', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('maude_events', 'select=id,manufacturer,brand_name,product_code,event_type,date_received,device_problem,report_number&order=date_received.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/recalls', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('recalls', 'select=product_res_number,recalling_firm,product_description,product_code,recall_status,event_date_initiated,reason_for_recall,status&order=event_date_initiated.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

};
