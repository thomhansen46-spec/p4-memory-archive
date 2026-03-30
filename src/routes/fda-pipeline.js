'use strict';

const https = require('https');

const CRM_QUERY = '(product_code:DQN+OR+product_code:MRX+OR+product_code:LWS+OR+device_name:"pacemaker"+OR+device_name:"defibrillator"+OR+device_name:"implantable+cardioverter")';
const BASE = 'https://api.fda.gov/device';

function fdaFetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        if (res.statusCode === 404) return resolve({ results: [], meta: { results: { total: 0 } } });
        if (res.statusCode !== 200) return reject(new Error(`openFDA HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON parse failed')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10).replace(/-/g,'');
}

function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeStr(v) { return typeof v === 'string' ? v.trim() : null; }

module.exports = (app) => {

  app.get('/api/fda/overview', async (req, res) => {
    try {
      const range = `${daysAgo(365)}+TO+${daysAgo(0)}`;
      const [pma, maude, recall, mfr, evtType, cls] = await Promise.all([
        fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&limit=1`),
        fdaFetch(`${BASE}/event.json?search=${CRM_QUERY}+AND+date_received:[${range}]&limit=1`),
        fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&limit=1`),
        fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&count=applicant.exact&limit=10`),
        fdaFetch(`${BASE}/event.json?search=${CRM_QUERY}&count=event_type&limit=6`),
        fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&count=classification&limit=5`)
      ]);
      res.json({ ok: true, retrieved_at: new Date().toISOString(),
        totals: { pma_approvals: pma.meta?.results?.total ?? 0, maude_events_1yr: maude.meta?.results?.total ?? 0, recalls: recall.meta?.results?.total ?? 0 },
        top_manufacturers: safeArr(mfr.results), maude_event_types: safeArr(evtType.results), recall_classes: safeArr(cls.results) });
    } catch (err) { res.status(502).json({ ok: false, error: err.message }); }
  });

  app.get('/api/fda/pma', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const skip  = Math.max(Number(req.query.skip)  || 0,  0);
    try {
      const d = await fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&limit=${limit}&skip=${skip}&sort=decision_date:desc`);
      res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length,
        results: safeArr(d.results).map(r => ({ pma_number: safeStr(r.pma_number), trade_name: safeStr(r.trade_name), applicant: safeStr(r.applicant), decision_date: safeStr(r.decision_date), decision_code: safeStr(r.decision_code), product_code: safeStr(r.product_code) })) });
    } catch (err) { res.status(502).json({ ok: false, error: err.message }); }
  });

  app.get('/api/fda/maude', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const skip  = Math.max(Number(req.query.skip)  || 0,  0);
    const days  = Math.min(Number(req.query.days)  || 365, 3650);
    const range = `${daysAgo(days)}+TO+${daysAgo(0)}`;
    try {
      const d = await fdaFetch(`${BASE}/event.json?search=${CRM_QUERY}+AND+date_received:[${range}]&limit=${limit}&skip=${skip}&sort=date_received:desc`);
      res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length, days_window: days,
        results: safeArr(d.results).map(r => ({ mdr_report_key: safeStr(r.mdr_report_key), date_received: safeStr(r.date_received), event_type: safeStr(r.event_type), device: { brand_name: safeStr(safeArr(r.device)[0]?.brand_name), manufacturer: safeStr(safeArr(r.device)[0]?.manufacturer_d_name) }, description: safeStr(safeArr(r.mdr_text).find(t => t.text_type_code === 'Description of Event or Problem')?.text) })) });
    } catch (err) { res.status(502).json({ ok: false, error: err.message }); }
  });

  app.get('/api/fda/recalls', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const skip  = Math.max(Number(req.query.skip)  || 0,  0);
    try {
      const d = await fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&limit=${limit}&skip=${skip}&sort=event_date_initiated:desc`);
      res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length,
        results: safeArr(d.results).map(r => ({ recall_number: safeStr(r.recall_number), recalling_firm: safeStr(r.recalling_firm), product_description: safeStr(r.product_description), classification: safeStr(r.classification), date_initiated: safeStr(r.event_date_initiated), reason: safeStr(r.reason_for_recall) })) });
    } catch (err) { res.status(502).json({ ok: false, error: err.message }); }
  });

  app.get('/api/fda/health', async (req, res) => {
    try {
      const d = await fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&limit=1`);
      res.json({ ok: true, openFDA_reachable: true, sample_total: d?.meta?.results?.total });
    } catch (err) { res.status(502).json({ ok: false, openFDA_reachable: false, error: err.message }); }
  });

  console.log('[fda-pipeline] registered');
};
'use strict';

const fetch = require('node-fetch');

const OPENFDA_BASE = 'https://api.fda.gov';

// Pacemaker / CRM-oriented keywords to start with
const CRM_TERMS = [
  'pacemaker',
  'implantable pulse generator',
  'cardiac resynchronization',
  'CRT-P',
  'CRT-D',
  'Micra',
  'AVEIR',
  'Azure',
  'Assurity'
];

// Simple helper
async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`openFDA error ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

function encodeSearch(search) {
  return encodeURIComponent(search);
}

module.exports = (app) => {
  // Health check for the FDA route module
  app.get('/api/fda/health', async (req, res) => {
    return res.json({
      ok: true,
      module: 'fda-pipeline',
      endpoints: ['/api/fda/pma', '/api/fda/maude', '/api/fda/recalls', '/api/fda/dashboard']
    });
  });

  // PMA approvals
  app.get('/api/fda/pma', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 10);
      const term = (req.query.term || 'pacemaker').trim();

      // Start broad and useful for PMA/device product descriptions
      const search = `device_name:"${term}"`;
      const url = `${OPENFDA_BASE}/device/pma.json?search=${encodeSearch(search)}&limit=${limit}`;

      const data = await fetchJson(url);

      const results = (data.results || []).map((item) => ({
        pma_number: item.pma_number || null,
        decision_date: item.decision_date || null,
        applicant: item.applicant || null,
        advisory_committee: item.advisory_committee || null,
        device_name: item.device_name || null,
        generic_name: item.generic_name || null,
        product_code: item.product_code || null
      }));

      return res.json({
        ok: true,
        source: 'openFDA PMA',
        query_term: term,
        meta: data.meta || null,
        results
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // MAUDE adverse events
  app.get('/api/fda/maude', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 25);
      const brand = (req.query.brand || 'pacemaker').trim();

      // openFDA examples show fielded search syntax on device event
      const search =
        `device.brand_name:"${brand}"+OR+device.generic_name:"${brand}"`;
      const url = `${OPENFDA_BASE}/device/event.json?search=${encodeSearch(search)}&limit=${limit}`;

      const data = await fetchJson(url);

      const results = (data.results || []).map((item) => ({
        report_number: item.mdr_report_key || item.report_number || null,
        date_received: item.date_received || null,
        event_type: item.event_type || null,
        manufacturer_name: item.manufacturer_name || null,
        brand_name: item.device?.[0]?.brand_name || null,
        generic_name: item.device?.[0]?.generic_name || null,
        model_number: item.device?.[0]?.model_number || null,
        manufacturer_d_name: item.device?.[0]?.manufacturer_d_name || null
      }));

      return res.json({
        ok: true,
        source: 'openFDA Device Event / MAUDE',
        query_brand: brand,
        meta: data.meta || null,
        results
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Recalls
  app.get('/api/fda/recalls', async (req, res) => {
    try {
      const limit = Number(req.query.limit || 10);
      const term = (req.query.term || 'pacemaker').trim();

      const search = `product_description:"${term}"`;
      const url = `${OPENFDA_BASE}/device/recall.json?search=${encodeSearch(search)}&limit=${limit}`;

      const data = await fetchJson(url);

      const results = (data.results || []).map((item) => ({
        recall_number: item.recall_number || null,
        recall_initiation_date: item.recall_initiation_date || null,
        status: item.status || null,
        classification: item.classification || null,
        product_description: item.product_description || null,
        code_info: item.code_info || null,
        recalling_firm: item.recalling_firm || null,
        reason_for_recall: item.reason_for_recall || null
      }));

      return res.json({
        ok: true,
        source: 'openFDA Device Recall',
        query_term: term,
        meta: data.meta || null,
        results
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Simple combined dashboard endpoint
  app.get('/api/fda/dashboard', async (req, res) => {
    try {
      const terms = CRM_TERMS;

      const [pmaData, maudeData, recallData] = await Promise.all([
        fetchJson(
          `${OPENFDA_BASE}/device/pma.json?search=${encodeSearch('device_name:"pacemaker"')}&limit=5`
        ),
        fetchJson(
          `${OPENFDA_BASE}/device/event.json?search=${encodeSearch('device.generic_name:"pacemaker" OR device.brand_name:"Micra" OR device.brand_name:"AVEIR"')}&limit=10`
        ),
        fetchJson(
          `${OPENFDA_BASE}/device/recall.json?search=${encodeSearch('product_description:"pacemaker"')}&limit=5`
        )
      ]);

      return res.json({
        ok: true,
        therapy_area: 'Cardiac Rhythm Management',
        tracked_terms: terms,
        summary: {
          pma_count_returned: (pmaData.results || []).length,
          maude_count_returned: (maudeData.results || []).length,
          recall_count_returned: (recallData.results || []).length
        },
        pma: pmaData.results || [],
        maude: maudeData.results || [],
        recalls: recallData.results || []
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[fda-pipeline] registered');
};
