'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const BASE = 'https://api.fda.gov/device';
const LIMIT = 100;
const CRM_CODES = 'DSQ,DTB,DXX,LWS,MKJ';
const CRM_QUERY = '(product_code:DQN+OR+product_code:MRX+OR+product_code:LWS+OR+device_name:pacemaker+OR+device_name:defibrillator+OR+device_name:cardioverter)';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function fdaFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return { results: [] };
    throw new Error(`FDA ${res.status}: ${url}`);
  }
  return res.json();
}

async function paginateAll(urlFn) {
  let skip = 0, all = [];
  while (true) {
    const data = await fdaFetch(urlFn(LIMIT, skip));
    if (!data.results || data.results.length === 0) break;
    all = all.concat(data.results);
    console.log(`  fetched ${all.length} records...`);
    if (data.results.length < LIMIT) break;
    skip += LIMIT;
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

async function ingestPMA() {
  console.log('\n[PMA] Fetching 5yr approvals...');
  const from = daysAgo(1825).replace(/-/g, '');
  const to   = daysAgo(0).replace(/-/g, '');
  const rows = await paginateAll((limit, skip) =>
    `${BASE}/pma.json?search=${CRM_QUERY}+AND+decision_date:[${from}+TO+${to}]&limit=${limit}&skip=${skip}&sort=decision_date:desc`
  );
  const records = rows.map(r => ({
    id:                 r.pma_number || r.supplement_number || `${r.applicant}-${r.decision_date}`,
    applicant:          r.applicant || null,
    device_name:        r.device_name || null,
    product_code:       r.product_code || null,
    decision_code:      r.decision_code || null,
    decision_date:      r.decision_date ? r.decision_date.slice(0,10) : null,
    advisory_committee: r.advisory_committee || null,
    supplement_number:  r.supplement_number || null,
  }));
  const { error } = await supabase.from('pma_approvals').insert(records);
  if (error) throw error;
  console.log(`[PMA] Upserted ${records.length} rows`);
  return records.length;
}

async function ingestMAUDE() {
  console.log('\n[MAUDE] Fetching 5yr events...');
  const range = `${daysAgo(1825)}+TO+${daysAgo(0)}`;
  const rows = await paginateAll((limit, skip) =>
    `${BASE}/event.json?search=device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)+AND+date_received:[${range}]&limit=${limit}&skip=${skip}&sort=date_received:desc`
  );
  const records = rows.map(r => ({
    id:             r.report_number || `${r.manufacturer_d_name}-${r.date_received}-${Math.random().toString(36).slice(2,7)}`,
    manufacturer:   r.manufacturer_d_name || null,
    brand_name:     r.brand_name || null,
    product_code:   r.product_code || null,
    event_type:     r.event_type || null,
    date_received:  r.date_received ? r.date_received.slice(0,10) : null,
    device_problem: Array.isArray(r.device_problem_codes) ? r.device_problem_codes.join(',') : null,
    report_number:  r.report_number || null,
  }));
  const { error } = await supabase.from('maude_events').upsert(records, { onConflict: 'id' });
  if (error) throw error;
  console.log(`[MAUDE] Upserted ${records.length} rows`);
  return records.length;
}

async function ingestRecalls() {
  console.log('\n[RECALLS] Fetching 5yr recalls...');
  const range = `${daysAgo(1825)}+TO+${daysAgo(0)}`;
  const rows = await paginateAll((limit, skip) =>
    `${BASE}/recall.json?search=${CRM_QUERY}&limit=${limit}&skip=${skip}&sort=event_date_initiated:desc`
  );
  const records = rows.map(r => ({
    id:             r.recall_number || `${r.recalling_firm}-${r.recall_initiation_date}`,
    recalling_firm: r.recalling_firm || null,
    device_name:    r.product_description || null,
    product_code:   r.product_code || null,
    classification: r.classification || null,
    date_initiated: r.recall_initiation_date ? r.recall_initiation_date.slice(0,10) : null,
    reason:         r.reason_for_recall || null,
    status:         r.status || null,
  }));
  const { error } = await supabase.from('recalls').upsert(records, { onConflict: 'id' });
  if (error) throw error;
  console.log(`[RECALLS] Upserted ${records.length} rows`);
  return records.length;
}

async function verify() {
  console.log('\n[VERIFY] Row counts:');
  const tables = ['pma_approvals','maude_events','recalls'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${error ? 'ERROR: ' + error.message : count + ' rows'}`);
  }
}

(async () => {
  try {
    await ingestPMA();
    await ingestMAUDE();
    await ingestRecalls();
    await verify();
    console.log('\nIngest complete.');
  } catch(e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
})();
