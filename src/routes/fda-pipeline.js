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

app.get('/api/overview', async (req, res) => {
try {
const range = `${daysAgo(365)}+TO+${daysAgo(0)}`;
const [pma, maude, recall, mfr, evtType, cls] = await Promise.all([
fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&limit=1`),
fdaFetch(`${BASE}/event.json?search=device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)+AND+date_received:[${range}]&limit=${limit}&skip=${skip}&sort=date_received:desc`),
fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&limit=1`),
fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&count=applicant.exact&limit=10`),
fdaFetch(`${BASE}/event.json?search=device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)+AND+date_received:[${range}]&limit=${limit}&skip=${skip}&sort=date_received:desc`),
fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&count=classification&limit=5`)
]);
res.json({ ok: true, retrieved_at: new Date().toISOString(),
totals: { pma_approvals: pma.meta?.results?.total ?? 0, maude_events_1yr: maude.meta?.results?.total ?? 0, recalls: recall.meta?.results?.total ?? 0 },
top_manufacturers: safeArr(mfr.results), maude_event_types: safeArr(evtType.results), recall_classes: safeArr(cls.results) });
} catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});

app.get('/api/pma', async (req, res) => {
const limit = Math.min(Number(req.query.limit) || 500, 500);
const skip = Math.max(Number(req.query.skip) || 0, 0);
try {
    const pmaFrom = daysAgo(1825).replace(/-/g,"");
    const pmaTo = daysAgo(0).replace(/-/g,"");
    const d = await fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}+AND+decision_date:[${pmaFrom}+TO+${pmaTo}]&limit=${limit}&skip=${skip}&sort=decision_date:desc`);
res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length,
results: safeArr(d.results).map(r => ({ pma_number: safeStr(r.pma_number), trade_name: safeStr(r.trade_name), applicant: safeStr(r.applicant), decision_date: safeStr(r.decision_date), decision_code: safeStr(r.decision_code), product_code: safeStr(r.product_code) })) });
} catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});

app.get('/api/maude', async (req, res) => {
const limit = Math.min(Number(req.query.limit) || 500, 500);
const skip = Math.max(Number(req.query.skip) || 0, 0);
const days = Math.min(Number(req.query.days) || 1825, 3650);
const range = `${daysAgo(days)}+TO+${daysAgo(0)}`;
try {
const d = await fdaFetch(`${BASE}/event.json?search=device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)+AND+date_received:[${range}]&limit=${limit}&skip=${skip}&sort=date_received:desc`);
res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length, days_window: days,
results: safeArr(d.results).map(r => ({ mdr_report_key: safeStr(r.mdr_report_key), date_received: safeStr(r.date_received), event_type: safeStr(r.event_type), device: { brand_name: safeStr(safeArr(r.device)[0]?.brand_name), manufacturer: safeStr(safeArr(r.device)[0]?.manufacturer_d_name) }, description: safeStr(safeArr(r.mdr_text).find(t => t.text_type_code === 'Description of Event or Problem')?.text) })) });
} catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});

app.get('/api/recalls', async (req, res) => {
const limit = Math.min(Number(req.query.limit) || 500, 500);
const skip = Math.max(Number(req.query.skip) || 0, 0);
try {
const d = await fdaFetch(`${BASE}/recall.json?search=${CRM_QUERY}&limit=${limit}&skip=${skip}&sort=event_date_initiated:desc`);
res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length,
results: safeArr(d.results).map(r => ({ recall_number: safeStr(r.recall_number), recalling_firm: safeStr(r.recalling_firm), product_description: safeStr(r.product_description), classification: safeStr(r.classification), date_initiated: safeStr(r.event_date_initiated), reason: safeStr(r.reason_for_recall) })) });
} catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});


app.get('/api/samd-events', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 500, 500);
    const from = daysAgo(1825); const to = daysAgo(0);
    const Q = 'device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)';
    try {
        const d = await fdaFetch(BASE + '/event.json?search=' + Q + '+AND+date_received:[' + from + '+TO+' + to + ']&limit=' + limit + '&sort=date_received:desc');
        res.json({ ok: true, total: d.meta?.results?.total ?? 0, count: safeArr(d.results).length,
            results: safeArr(d.results).map(r => ({
                mdr_report_key: safeStr(r.mdr_report_key),
                date_received: safeStr(r.date_received),
                event_type: safeStr(r.event_type),
                brand_name: safeStr(safeArr(r.device)[0]?.brand_name),
                manufacturer: safeStr(safeArr(r.device)[0]?.manufacturer_d_name),
                product_code: safeStr(safeArr(r.device)[0]?.device_report_product_code)
            }))
        });
    } catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});
app.get('/api/health', async (req, res) => {
try {
const d = await fdaFetch(`${BASE}/pma.json?search=${CRM_QUERY}&limit=1`);
res.json({ ok: true, openFDA_reachable: true, sample_total: d?.meta?.results?.total });
} catch (err) { res.status(502).json({ ok: false, openFDA_reachable: false, error: err.message }); }
});

console.log('[fda-pipeline] registered');
};