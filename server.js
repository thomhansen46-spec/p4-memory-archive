const express = require('express');
const app = express();

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('P4 Memory Archive running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
