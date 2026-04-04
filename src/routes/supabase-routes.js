'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug';

function sendError(res, msg, status) {
  console.error('[supabase-routes]', msg);
  res.status(status || 500).json({ error: msg });
}

function parseQuery(q) {
  return {
    limit:  Math.min(parseInt(q.limit)  || 500, 2000),
    order:  q.order  || null,
    asc:    q.dir === 'asc',
    year:   q.year   ? parseInt(q.year) : null,
    search: q.search || null,
  };
}

module.exports = function(app) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Health ──────────────────────────────────────────────────────────────
  app.get('/api/db/health', async (req, res) => {
    try {
      const tables = ['pma_approvals','maude_events','recalls','samd_events'];
      const counts = {};
      await Promise.all(tables.map(async t => {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        counts[t] = error ? 'error: ' + error.message : count;
      }));
      res.json({ status: 'ok', counts, timestamp: new Date().toISOString() });
    } catch(e) { sendError(res, e.message); }
  });

  // ── PMA Approvals ───────────────────────────────────────────────────────
  // Schema: id, applicant, device_name, product_code, decision_code,
  //         decision_date, advisory_committee, supplement_number
  app.get('/api/pma', async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from('pma_approvals')
        .select('id,applicant,device_name,product_code,decision_code,decision_date,advisory_committee,supplement_number')
        .limit(limit)
        .order(order || 'decision_date', { ascending: asc });
      if (year)   q = q.gte('decision_date', year + '-01-01').lte('decision_date', year + '-12-31');
      if (search) q = q.or('applicant.ilike.%' + search + '%,device_name.ilike.%' + search + '%');
      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch(e) { sendError(res, e.message); }
  });

  // ── MAUDE Events ────────────────────────────────────────────────────────
  // Schema: id, manufacturer, brand_name, product_code, event_type,
  //         date_received, device_problem, report_number
  app.get('/api/maude', async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from('maude_events')
        .select('id,manufacturer,brand_name,product_code,event_type,date_received,device_problem,report_number')
        .limit(limit)
        .order(order || 'date_received', { ascending: asc });
      if (year)   q = q.gte('date_received', year + '-01-01').lte('date_received', year + '-12-31');
      if (search) q = q.or('manufacturer.ilike.%' + search + '%,brand_name.ilike.%' + search + '%');
      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch(e) { sendError(res, e.message); }
  });

  // ── Recalls ─────────────────────────────────────────────────────────────
  // Schema: id, recalling_firm, device_name, product_code, classification,
  //         date_initiated, reason, status
  app.get('/api/recalls', async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from('recalls')
        .select('id,recalling_firm,device_name,product_code,classification,date_initiated,reason,status')
        .limit(limit)
        .order(order || 'date_initiated', { ascending: asc });
      if (year)   q = q.gte('date_initiated', year + '-01-01').lte('date_initiated', year + '-12-31');
      if (search) q = q.or('recalling_firm.ilike.%' + search + '%,device_name.ilike.%' + search + '%');
      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch(e) { sendError(res, e.message); }
  });

  // ── SaMD Events ─────────────────────────────────────────────────────────
  // Schema: id, manufacturer, brand_name, product_code, event_type,
  //         date_received, device_problem, report_number
  app.get('/api/samd', async (req, res) => {
    try {
      const { limit, order, asc, year, search } = parseQuery(req.query);
      let q = supabase
        .from('samd_events')
        .select('id,manufacturer,brand_name,product_code,event_type,date_received,device_problem,report_number')
        .limit(limit)
        .order(order || 'date_received', { ascending: asc });
      if (year)   q = q.gte('date_received', year + '-01-01').lte('date_received', year + '-12-31');
      if (search) q = q.or('manufacturer.ilike.%' + search + '%,brand_name.ilike.%' + search + '%');
      const { data, error } = await q;
      if (error) throw error;
      res.json({ total: data.length, results: data });
    } catch(e) { sendError(res, e.message); }
  });

  // ── Session log proxy ────────────────────────────────────────────────────
  app.get('/api/sessions', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('session_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch(e) { sendError(res, e.message); }
  });

};
