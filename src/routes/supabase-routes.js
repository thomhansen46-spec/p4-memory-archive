const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY
);
module.exports = function(app) {
  app.get('/api/metrics', async (req, res) => {
    try {
      const [ssed, pma, maude, recalls, trials] = await Promise.all([
        supabase.from('ssed_events').select('id', { count: 'exact', head: true }),
        supabase.from('pma_approvals').select('id', { count: 'exact', head: true }),
        supabase.from('maude_events').select('id', { count: 'exact', head: true }),
        supabase.from('device_recalls').select('id', { count: 'exact', head: true }),
        supabase.from('clinical_trials').select('nct_id', { count: 'exact', head: true }),
      ]);
      res.json({ ssed_events: ssed.count, pma_approvals: pma.count, maude_events: maude.count, device_recalls: recalls.count, clinical_trials: trials.count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/ssed', async (req, res) => {
    try {
      const { data, error } = await supabase.from('ssed_events').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/pma', async (req, res) => {
    try {
      const { data, error } = await supabase.from('pma_approvals').select('*').order('decision_date', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/maude', async (req, res) => {
    try {
      const { data, error } = await supabase.from('maude_events').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/recalls', async (req, res) => {
    try {
      const { data, error } = await supabase.from('device_recalls').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/trials', async (req, res) => {
    try {
      const { data, error } = await supabase.from('clinical_trials').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
};
curl -s https://p4-memory-archive.onrender.com/api/metrics
