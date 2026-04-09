'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://p4-memory-archive.onrender.com'
  ]
}));

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// All routes
require('./src/routes/session-log')(app);
require('./src/routes/fda-pipeline')(app);
require('./src/routes/supabase-routes')(app);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
