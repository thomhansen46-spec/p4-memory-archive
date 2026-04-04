module.exports = (app) => {

  let logs = [];

  // GET logs
  app.get('/session-log', (req, res) => {
    res.json(logs);
  });

  // POST logs
  app.post('/session-log', (req, res) => {
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

};
