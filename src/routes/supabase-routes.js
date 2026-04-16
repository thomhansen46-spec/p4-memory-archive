const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = function(app, requireAuth) {

  // =========================
  // HEALTH CHECK (safe route)
  // =========================
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'API is running' });
  });

  // =========================
  // RPN DATA (YOUR MAIN ROUTE)
  // =========================
  app.get('/api/rpn', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('abbott_eu_fmea')
        .select('*')
        .order('rpn', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data);
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ error: 'server error' });
    }
  });

};
