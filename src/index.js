'use strict';
const express = require('express');
const path = require('path');
const app = express();

console.log('P4 Memory Archive starting...');

app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

require('./routes/session-log')(app);
require('./routes/fda-pipeline')(app);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server on port ' + PORT);
});
