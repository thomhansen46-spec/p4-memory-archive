const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());
app.use('/session-log', require('./src/routes/session-log'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'P4 API LIVE', time: new Date() });
});

app.get('/test', (req, res) => res.send('TEST OK'));

app.post('/save-session', async (req, res) => {
  const { prompt, response, tags } = req.body;
  const { data, error } = await supabase.from('sessions').insert([{ prompt, response, tags }]);
  if (error) return res.status(500).json({ error });
  res.json({ success: true, data });
});

app.get('/sessions', async (req, res) => {
  const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.get('/api/samd-events', async (req, res) => {
  try {
    const { data, error } = await supabase.from('samd_events').select('*').limit(100);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/endpoint-library', async (req, res) => {
  try {
    const { data, error } = await supabase.from('endpoint_library').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/samd-devices', async (req, res) => {
  try {
    const cardioOnly = req.query.cardiology === 'true';
    let query = supabase.from('samd_devices').select('*').order('decision_date', { ascending: false }).limit(500);
    if (cardioOnly) query = query.eq('is_cardiology', true);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static('public'));


app.get('/api/pma', async (req, res) => {
  try {
    const { data, error } = await supabase.from('pma_approvals').select('*').order('decision_date', { ascending: false }).limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/maude', async (req, res) => {
  try {
    const { data, error } = await supabase.from('maude_events').select('*').order('date_received', { ascending: false }).limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/recalls', async (req, res) => {
  try {
    const { data, error } = await supabase.from('recalls').select('*').limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/rpn', async (req, res) => {
  try {
    const { data, error } = await supabase.from('abbott_eu_fmea').select('*').order('rpn', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/session-logs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('session_logs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/indication-monitor', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pma_supplements')
      .select('*')
      .ilike('supplement_reason', '%Indication%')
      .order('decision_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
