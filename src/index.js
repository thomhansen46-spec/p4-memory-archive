'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fetch   = require('node-fetch');

const app = express();

console.log('🚀 P4 Memory Archive starting…');

app.use(cors({
  origin: [
    app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://p4-memory-archive.onrender.com'
  ]
}));

'use strict';

const express = require('express');
const path = require('path');

const app = express();

console.log('🚀 P4 Memory Archive starting...');

// Middleware
app.use(express.json());

// ✅ ROOT ROUTE (FIXES "Cannot GET /")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});
// line ~36–38
// ✅ SESSION LOG ROUTE
require('./routes/session-log')(app);
require('./routes/fda-pipeline')(app);
require('./routes/supabase-routes')(app);
// Start server
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Server on port ${PORT}`);
});

