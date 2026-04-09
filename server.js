

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const path = require('path');


app.use(express.json());
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'P4 API LIVE',
    time: new Date()
  });
});

app.use('/session-log', require('./src/routes/session-log'));
// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
  

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.use(express.static('public'));

// Test route
app.get('/test', (req, res) => {
  res.send('TEST OK');
});

// Save session
app.post('/save-session', async (req, res) => {
  const { prompt, response, tags } = req.body;

  const { data, error } = await supabase
    .from('sessions')
    .insert([{ prompt, response, tags }]);

  if (error) return res.status(500).json({ error });

  res.json({ success: true, data });
});

// Get sessions
app.get('/sessions', async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log(error);
    return res.status(500).json({ error });
  }

  res.json(data);
});

// Start server
const PORT = process.env.PORT || 3000;

app.get('/api/samd-events', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('samd_events')
      .select('*')
      .limit(1000);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);
});
