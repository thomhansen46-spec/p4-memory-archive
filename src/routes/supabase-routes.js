const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = function(app, requireAuth) {

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // RPN route
  app.get('/api/rpn', async (req, res) => {
    try {
      const { data, error } = await supabase
        ..from('abbott_eu_fmea')
        .select('*')
        .order('rpn', { ascending: false });

      if (error) {
        console.error('SUPABASE ERROR:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data);

    } catch (err) {
      console.error('SERVER ERROR:', err);
      res.status(500).json({ error: err.message });
    }
  });

};
