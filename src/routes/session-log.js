'use strict';
const fetch = require('node-fetch');
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB = process.env.NOTION_DATABASE_ID;
async function notionCreate(title, body) {
  if (!NOTION_TOKEN || !NOTION_DB) throw new Error('Notion env vars not set');
  const r = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' }, body: JSON.stringify({ parent: { database_id: NOTION_DB }, properties: { Name: { title: [{ text: { content: title } }] } }, children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: body.slice(0,2000) } }] } }] }) });
  return r.json();
}
module.exports = function(app) {
  let logs = [];
  app.get('/api/session-log', (req, res) => res.json({ logs }));
  app.post('/api/session-log', async (req, res) => {
    const { title, body } = req.body;
    const entry = { id: Date.now(), title, body, createdAt: new Date().toISOString() };
    logs.push(entry);
    try { await notionCreate(title || 'P4 Session', body || ''); res.json({ status: 'ok', entry, notion: true }); }
    catch(e) { res.json({ status: 'ok', entry, notion: false }); }
  });
};