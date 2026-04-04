'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fetch   = require('node-fetch');

const app = express();

console.log('🚀 P4 Memory Archive starting…');

app.use(cors({
  origin: [
    'https://p4-memory-archive.onrender.com',
    'http://localhost:10000'
  ]
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

require('./routes/session-log')(app);
require('./routes/fda-pipeline')(app);
require('./routes/supabase-routes')(app);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server on port ${PORT}`);
});
