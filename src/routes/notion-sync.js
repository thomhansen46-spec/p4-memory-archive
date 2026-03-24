const fetch = require('node-fetch');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const syncToNotion = async (session) => {
  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) return;
  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: session.title || session.project_id } }] },
          'Render Id': { rich_text: [{ text: { content: session.project_id } }] },
          'Open Items': { rich_text: [{ text: { content: session.open_items || '' } }] },
        }
      })
    });
  } catch (e) {
    console.error('Notion sync
cd ~/p4-memory-archive && npm install node-fetch@2
cat > ~/p4-memory-archive/src/routes/sessions.js << 'EOF'
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { syncToNotion } = require('./notion-sync');

const DB = path.join(__dirname, '../data/sessions.json');
const load = () => fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : [];
const save = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

module.exports = (app) => {
  app.get('/sessions', (req, res) => res.json(load()));

  app.post('/sessions', async (req, res) => {
    const data = load();
    const record = { id: uuidv4(), record_type: 'session_record', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...req.body };
    data.push(record);
    save(data);
    await syncToNotion(record);
    res.status(201).json(record);
  });

  app.put('/sessions/:id', (req, res) => {
    const data = load();
    const i = data.findIndex(r => r.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Not found' });
    data[i] = { ...data[i], ...req.body, updated_at: new Date().toISOString() };
    sav
cd ~/p4-memory-archive
git add .
git commit -m "Add Notion sync"
git push origin main
cd ~/p4-memory-archive && git push origin main
cd ~/p4-memory-archive && git push origin main
