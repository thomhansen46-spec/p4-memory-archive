'use strict';
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB    = process.env.NOTION_DATABASE_ID;

async function supabaseInsert(entry) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars not set');
  const r = await fetch(SUPABASE_URL + '/rest/v1/session_logs', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(entry)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('Supabase error: ' + err);
  }
  return r.json();
}

async function notionCreate(title, body) {
  if (!NOTION_TOKEN || !NOTION_DB) throw new Error('Notion env vars not set');
  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + NOTION_TOKEN,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DB },
      properties: {
        Name: { title: [{ text: { content: title } }] }
      },
      children: [{
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: body.slice(0, 2000) } }] }
      }]
    })
  });
  return r.json();
}

module.exports = function(app) {

  // GET — fetch all logs from Supabase
  app.get('/api/session-log', async (req, res) => {
    try {
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/session_logs?select=*&order=created_at.desc&limit=50',
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
      );
      const logs = await r.json();
      res.json({ logs: Array.isArray(logs) ? logs : [] });
    } catch(e) {
      res.json({ logs: [] });
    }
  });

  // POST — save to Supabase + sync to Notion
  app.post('/api/session-log', async (req, res) => {
    const { title, summary, focus, source } = req.body;
    const bodyText = [
      title ? 'SESSION: ' + title : '',
      summary ? 'SUMMARY: ' + summary : '',
      focus ? 'NEXT FOCUS: ' + focus : '',
      source ? 'SOURCE: ' + source : '',
      'LOGGED: ' + new Date().toISOString()
    ].filter(Boolean).join('\n');

    const entry = {
      title:      title   || 'P4 Session',
      summary:    summary || '',
      focus:      focus   || '',
      status:     'Complete',
      created_at: new Date().toISOString()
    };

    let supabaseOk = false;
    let notionOk   = false;
    let notionId   = null;

    // 1. Save to Supabase
    try {
      await supabaseInsert(entry);
      supabaseOk = true;
    } catch(e) {
      console.error('[SESSION-LOG] Supabase error:', e.message);
    }

    // 2. Sync to Notion
    try {
      const n = await notionCreate(entry.title, bodyText);
      notionOk = true;
      notionId = n.id || null;
    } catch(e) {
      console.error('[SESSION-LOG] Notion error:', e.message);
    }

    res.json({
      status: supabaseOk ? 'ok' : 'partial',
      supabase: supabaseOk,
      notion: notionOk,
      notionId,
      entry
    });
  });
};
