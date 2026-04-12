const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function handleError(res, err) {
  console.error('[Supabase]', err.message);
  res.status(500).json({ error: err.message });
}

module.exports = function registerRoutes(app) {

  app.get('/api/pma-approvals', async (req, res) => {
    try {
      const { limit = 200, offset = 0, product_code, year, applicant } = req.query;
      let q = supabase.from('pma_approvals').select('*')
        .order('decision_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      if (product_code) q = q.eq('product_code', product_code.toUpperCase());
      if (year) q = q.gte('decision_date', `${year}-01-01`).lte('decision_date', `${year}-12-31`);
      if (applicant) q = q.ilike('applicant', `%${applicant}%`);
      const { data, error } = await q;
      if (error) return handleError(res, error);
      res.json({ results: data, count: data.length });
    } catch (err) { handleError(res, err); }
  });

  app.get('/api/maude-events', async (req, res) => {
    try {
      const { limit = 200, offset = 0, product_code, manufacturer, event_type, year } = req.query;
      let q = supabase.from('maude_events').select('*')
        .order('date_received', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      if (product_code) q = q.eq('product_code', product_code.toUpperCase());
      if (manufacturer) q = q.ilike('manufacturer', `%${manufacturer}%`);
      if (event_type) q = q.eq('event_type', event_type.toUpperCase());
      if (year) q = q.gte('date_received', `${year}-01-01`).lte('date_received', `${year}-12-31`);
      const { data, error } = await q;
      if (error) return handleError(res, error);
      res.json({ results: data, count: data.length });
    } catch (err) { handleError(res, err); }
  });

  app.get('/api/maude-events/by-manufacturer', async (req, res) => {
    try {
      const { data, error } = await supabase.from('maude_events').select('manufacturer').not('manufacturer', 'is', null);
      if (error) return handleError(res, error);
      const counts = {};
      data.forEach(r => {
        const key = r.manufacturer.toUpperCase().slice(0, 30);
        counts[key] = (counts[key] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, count]) => ({ manufacturer: name, count }));
      res.json({ results: sorted });
    } catch (err) { handleError(res, err); }
  });

  app.get('/api/recalls', async (req, res) => {
    try {
      const { limit = 200, offset = 0, classification, product_code, year } = req.query;
      let q = supabase.from('recalls').select('*')
        .order('date_initiated', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      if (classification) q = q.ilike('classification', `%${classification}%`);
      if (product_code) q = q.eq('product_code', product_code.toUpperCase());
      if (year) q = q.gte('date_initiated', `${year}-01-01`).lte('date_initiated', `${year}-12-31`);
      const { data, error } = await q;
      if (error) return handleError(res, error);
      res.json({ results: data, count: data.length });
    } catch (err) { handleError(res, err); }
  });

  app.get('/api/samd-events', async (req, res) => {
    try {
      const { limit = 200, offset = 0, manufacturer, year, event_type } = req.query;
      let q = supabase.from('samd_events').select('*')
        .order('date_received', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      if (manufacturer) q = q.ilike('manufacturer', `%${manufacturer}%`);
      if (event_type) q = q.eq('event_type', event_type.toUpperCase());
      if (year) q = q.gte('date_received', `${year}-01-01`).lte('date_received', `${year}-12-31`);
      const { data, error } = await q;
      if (error) return handleError(res, error);
      res.json({ results: data, count: data.length });
    } catch (err) { handleError(res, err); }
  });

  app.get('/api/stats', async (req, res) => {
    try {
      const tables = ['pma_approvals', 'maude_events', 'recalls', 'samd_events'];
      const counts = await Promise.all(tables.map(t =>
        supabase.from(t).select('*', { count: 'exact', head: true })
      ));
      const stats = {};
      tables.forEach((t, i) => { stats[t] = counts[i].count ?? 0; });
      res.json(stats);
    } catch (err) { handleError(res, err); }
  });

  console.log('[P4] Supabase routes registered');
};
