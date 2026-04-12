'use strict';

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

function headers() {
  return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
}

async function query(table, params) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + params;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

module.exports = function(app) {

  app.get('/api/db/health', async (req, res) => {
    try {
      const tables = ['pma_approvals','maude_events','recalls'];
      const counts = {};
      for (const t of tables) {
        const r = await fetch(SUPABASE_URL + '/rest/v1/' + t + '?select=id&limit=1', {
          headers: { ...headers(), 'Prefer': 'count=exact' }
        });
        counts[t] = r.headers.get('content-range') || '?';
      }
      res.json({ ok: true, counts });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pma', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('pma_approvals', 'select=id,applicant,device_name,product_code,decision_code,decision_date,advisory_committee,supplement_number&order=decision_date.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/maude', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('maude_events', 'select=id,manufacturer,brand_name,product_code,event_type,date_received,device_problem,report_number&order=date_received.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/recalls', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('recalls', 'select=product_res_number,recalling_firm,product_description,product_code,recall_status,event_date_initiated,reason_for_recall,status&order=event_date_initiated.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/samd-events', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
      const data = await query('samd_events', 'select=id,manufacturer,brand_name,product_code,event_type,date_received,device_problem,report_number&order=date_received.desc&limit=' + limit);
      res.json({ total: data.length, results: data });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  const SOFTWARE_CLASSES = {
    '1': ['software','firmware','algorithm','crash','reboot','reset','freeze','hang','corrupt','exception','fault'],
    '2': ['telemetry','wireless','bluetooth','communication','signal','transmission','remote','connection','sync','carelink','latitude','merlin','smartsync'],
    '3': ['sensing','detection','inappropriate','inhibit','oversensing','undersensing','mode switch','safety mode','shock','pacing','rate response','threshold']
  };
  const CRM_CODES = ['DSQ','LWS','DXX','MKJ','DTB','NKE','MYN','KZE'];

  function psi(event_type, adverse_flag, cls) {
    let score = 0;
    if (event_type === 'Death') score += cls === '3' ? 8 : cls === '2' ? 7 : 6;
    else if (event_type === 'Injury') score += cls === '3' ? 5 : 4;
    else score += 2;
    if (adverse_flag === 'Y') score += cls === '3' ? 2 : 1;
    if (cls === '3') score += 2;
    return Math.min(score, 10);
  }

  app.get('/api/samd', async (req, res) => {
    try {
      const { limit = 500, cls = 'all', manufacturer, year } = req.query;
      const lim = Math.min(parseInt(limit) || 500, 2000);
      const data = await query('maude_events',
        'select=id,manufacturer,brand_name,product_code,event_type,date_received,adverse_event_flag,report_number&order=date_received.desc&limit=' + lim
        + '&product_code=in.(' + CRM_CODES.join(',') + ')'
        + (manufacturer ? '&manufacturer=ilike.*' + encodeURIComponent(manufacturer) + '*' : '')
        + (year ? '&date_received=gte.' + year + '-01-01&date_received=lte.' + year + '-12-31' : '')
      );
      const results = data.map(r => ({ ...r, psi: psi(r.event_type, r.adverse_event_flag, cls === 'all' ? '1' : cls) }));
      const byMfr = {}, byYear = {}, byEventType = {};
      results.forEach(r => {
        const m = (r.manufacturer||'Unknown').slice(0,30);
        const yr = (r.date_received||'').slice(0,4);
        byMfr[m] = (byMfr[m]||0)+1;
        if(yr) byYear[yr] = (byYear[yr]||0)+1;
        byEventType[r.event_type] = (byEventType[r.event_type]||0)+1;
      });
      res.json({ total: results.length, search_class: cls, summary: { byMfr, byYear, byEventType }, results: results.slice(0,200) });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/samd/summary', async (req, res) => {
    try {
      const data = await query('maude_events',
        'select=manufacturer,event_type,date_received,adverse_event_flag,product_code&product_code=in.(' + CRM_CODES.join(',') + ')&limit=2000&order=date_received.desc'
      );
      const byMfr = {}, byYear = {}, byType = {}, byCode = {};
      data.forEach(r => {
        const m = (r.manufacturer||'Unknown').slice(0,30);
        const yr = (r.date_received||'').slice(0,4);
        byMfr[m]=(byMfr[m]||0)+1;
        if(yr) byYear[yr]=(byYear[yr]||0)+1;
        byType[r.event_type]=(byType[r.event_type]||0)+1;
        byCode[r.product_code]=(byCode[r.product_code]||0)+1;
      });
      res.json({ total: data.length, byMfr, byYear, byType, byCode });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });


};

  // Session Log — pulls latest Notion page
  app.get('/api/session/latest', async (req, res) => {
    try {
      const r = await fetch('https://api.notion.com/v1/databases/' + process.env.NOTION_DATABASE_ID + '/query', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sorts: [{ timestamp: 'created_time', direction: 'descending' }], page_size: 1 })
      });
      const d = await r.json();
      const page = d.results?.[0];
      if (!page) return res.json({ error: 'No sessions found' });
      const pageId = page.id;
      const title = page.properties?.title?.title?.[0]?.text?.content || 'Session';
      const blocks = await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children', {
        headers: { 'Authorization': 'Bearer ' + process.env.NOTION_TOKEN, 'Notion-Version': '2022-06-28' }
      }).then(x => x.json());
      res.json({ title, blocks: blocks.results || [] });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
