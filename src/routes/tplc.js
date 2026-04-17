const { createClient } = require('@supabase/supabase-js');
module.exports = (app) => {
  const supabase = createClient(
    process.env.SUPABASE_URL  || 'https://lhgqexopbqfivoubzzeg.supabase.co',
    process.env.SUPABASE_KEY  || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug'
  );
  app.get('/api/tplc', async (req, res) => {
    try {
      const { data, error } = await supabase.from('tplc_device_problems').select('product_code, device_name, device_class, problem_type, mdr_report_count, severity_tier');
      if (error) throw error;
      const codes = {};
      for (const row of data) {
        if (!codes[row.product_code]) codes[row.product_code] = { product_code: row.product_code, device_name: row.device_name, device_class: row.device_class, device_problems: 0, patient_outcomes: 0, critical: 0, high: 0, medium: 0, low: 0, total_device_mdrs: 0 };
        const c = codes[row.product_code];
        if (row.problem_type === 'device') { c.device_problems++; c.total_device_mdrs += (row.mdr_report_count || 0); if (row.severity_tier === 'CRITICAL') c.critical++; else if (row.severity_tier === 'HIGH') c.high++; else if (row.severity_tier === 'MEDIUM') c.medium++; else if (row.severity_tier === 'LOW') c.low++; } else { c.patient_outcomes++; }
      }
      res.json({ success: true, data: Object.values(codes).sort((a,b) => b.total_device_mdrs - a.total_device_mdrs) });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
  });
  app.get('/api/tplc/intelligence', async (req, res) => {
    try {
      const { severity, code } = req.query;
      let query = supabase.from('tplc_device_problems').select('product_code, device_name, problem_name, mdr_report_count, mdr_event_count, severity_tier').eq('problem_type', 'device').not('severity_tier', 'is', null).order('mdr_report_count', { ascending: false });
      if (severity) query = query.eq('severity_tier', severity.toUpperCase());
      if (code) query = query.eq('product_code', code.toUpperCase());
      const { data, error } = await query;
      if (error) throw error;
      const t = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      data.sort((a,b) => { const d = (t[a.severity_tier]??9)-(t[b.severity_tier]??9); return d !== 0 ? d : b.mdr_report_count - a.mdr_report_count; });
      res.json({ success: true, count: data.length, data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
  });
  app.get('/api/tplc/:code/critical', async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const { data, error } = await supabase.from('tplc_device_problems').select('problem_name, mdr_report_count, severity_tier').eq('product_code', code).eq('problem_type', 'device').in('severity_tier', ['CRITICAL', 'HIGH']).order('mdr_report_count', { ascending: false });
      if (error) throw error;
      res.json({ success: true, product_code: code, count: data.length, data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
  });
  app.get('/api/tplc/:code', async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const { data, error } = await supabase.from('tplc_device_problems').select('*').eq('product_code', code).order('mdr_report_count', { ascending: false });
      if (error) throw error;
      if (!data.length) return res.status(404).json({ success: false, error: code + ' not found' });
      res.json({ success: true, product_code: code, device_name: data[0].device_name, device_problems: data.filter(r => r.problem_type === 'device'), patient_outcomes: data.filter(r => r.problem_type === 'patient') });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
  });
};
