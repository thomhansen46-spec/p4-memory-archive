 const express = require('express');
const router = express.Router();

let logs = [];

router.get('/', (req, res) => {
  res.json(logs);
});

router.post('/', (req, res) => {
  const { prompt, response, tags } = req.body;

  const entry = {
    id: Date.now(),
    prompt,
    response,
    tags,
    createdAt: new Date()
  };

  logs.push(entry);

  res.json({ status: 'ok', entry });
});

module.exports = router;