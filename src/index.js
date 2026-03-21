const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'P4 Memory Archive running', version: '1.0.0' });
});

require('./routes/sessions')(app);
require('./routes/assets')(app);
require('./routes/sops')(app);
require('./routes/sequences')(app);
require('./routes/seeds')(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
