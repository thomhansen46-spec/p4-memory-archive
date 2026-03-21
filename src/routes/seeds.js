const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '../data/seeds.json');
const load = () => fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : [];
const save = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

module.exports = (app) => {
  app.get('/seeds', (req, res) => res.json(load()));

  app.get('/seeds/:id', (req, res) => {
    const record = load().find(r => r.id === req.params.id);
    record ? res.json(record) : res.status(404).json({ error: 'Not found' });
  });

  app.post('/seeds', (req, res) => {
    const record = { id: uuidv4(), record_type: 'context_seed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...req.body };
    const data = load();
    data.push(record);
    save(data);
    res.status(201).json(record);
  });

  app.put('/seeds/:id', (req, res) => {
    const data = load();
    const i = data.findIndex(r => r.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    data[i] = { ...data[i], ...req.body, updated_at: new Date().toISOString() };
    save(data);
    res.json(data[i]);
  });

  app.delete('/seeds/:id', (req, res) => {
    const data = load().filter(r => r.id !== req.params.id);
    save(data);
    res.json({ deleted: req.params.id });
  });
};
