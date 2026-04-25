'use strict';
const express = require('express');
const path = require('path');
const app = express();

console.log('P4 Memory Archive starting...');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

const sessionLog = require('./routes/session-log');
if (typeof sessionLog === 'function') {
  sessionLog(app);
} else {
  app.use('/session-log', sessionLog);
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server on port ' + PORT);
});
