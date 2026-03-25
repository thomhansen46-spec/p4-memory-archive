const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '../data/sessions.json');
const load = () => fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : [];
const save = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

module.exports = (app) => {
  const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_TOKEN });

app.get('/sessions', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
    });

    const results = response.results.map(page => ({
      id: page.id,
      module: page.properties.Module?.select?.name || "",
      prompt: page.properties.Prompt?.rich_text?.[0]?.plain_text || "",
      response: page.properties.Response?.rich_text?.[0]?.plain_text || "",
      created: page.created_time
    }));

    res.json(results);
  } catch (error) {
    console.error("Notion query error:", error);
    res.status(500).json({ error: error.message });
  }
});
  
  app.get('/sessions/:id', (req, res) => {
    const record = load().find(r => r.id === req.params.id);
    record ? res.json(record) : res.status(404).json({ error: 'Not found' });
  });

  app.post('/sessions', (req, res) => {
    const record = { id: uuidv4(), record_type: 'session_record', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...req.body };
    const data = load();
    data.push(record);
    save(data);
    res.status(201).json(record);
  });

  app.put('/sessions/:id', (req, res) => {
    const data = load();
    const i = data.findIndex(r => r.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    data[i] = { ...data[i], ...req.body, updated_at: new Date().toISOString() };
    save(data);
    res.json(data[i]);
  });

  app.delete('/sessions/:id', (req, res) => {
    const data = load().filter(r => r.id !== req.params.id);
    save(data);
    res.json({ deleted: req.params.id });
  });
app.post('/save-session', async (req, res) => {
try {
const { content } = req.body;

if (!content) {
return res.status(400).json({ error: 'No content provided' });
}

const record = {
id: uuidv4(),
created_at: new Date().toISOString(),
content
};

const data = load();
data.push(record);
save(data);

res.status(200).json({ success: true, record });

} catch (err) {
console.error(err);
res.status(500).json({ error: 'Failed to save session' });
}
});
};
