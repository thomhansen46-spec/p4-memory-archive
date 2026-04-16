'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://p4-memory-archive.onrender.com',
    'null'
  ]
}));

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// All routes
require('./src/routes/session-log')(app);
require('./src/routes/supabase-routes')(app);

const PORT = process.env.PORT || 10000;
app.get('/api/rpn', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('abbott_eu_fmea')
      .select('*')
      .order('rpn', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json(error);
    }

    res.json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'server error' });
  }
});
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
