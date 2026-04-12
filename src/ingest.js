'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const BASE  = 'https://api.fda.gov/device';
const LIMIT = 100;
const CRM_QUERY = '(product_code:DQN+OR+product_code:MRX+OR+product_code:LWS+OR+device_name:pacemaker+OR+device_name:defibrillator+OR+device_name:cardioverter)';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function fdaFetch(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return { results: [] };
      if (!res.ok) throw new Error(`FDA ${res.status}: ${url}`);
      return res.json();
    } catch(e) {
      if (attempt === 3) throw e;
      console.log(`  [retry ${attempt}] ${e.message.slice(0,80)}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
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

// Date-chunked paginator — bypasses openFDA 25100 offset hard limit
async function paginateChunked(urlFn, chunkMonths = 6) {
  const all = [];
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 10);

  let chunkEnd = new Date(endDate);
  while (chunkEnd > startDate) {
    let chunkStart = new Date(chunkEnd);
    chunkStart.setMonth(chunkStart.getMonth() - chunkMonths);
    if (chunkStart < startDate) chunkStart = new Date(startDate);

    const from = chunkStart.toISOString().slice(0,10).replace(/-/g,'');
    const to   = chunkEnd.toISOString().slice(0,10).replace(/-/g,'');
    console.log(`  [chunk] ${from} → ${to}`);

    let skip = 0;
    while (true) {
      const data = await fdaFetch(urlFn(LIMIT, skip, from, to));
      if (!data.results || data.results.length === 0) break;
      all.push(...data.results);
      console.log(`  fetched ${all.length} total...`);
      if (data.results.length < LIMIT) break;
      skip += LIMIT;
      if (skip >= 25000) { console.log('  [chunk cap] advancing window'); break; }
      await new Promise(r => setTimeout(r, 300));
    }

    chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() - 1);
  }
  return all;
}

async function upsertBatched(table, records, conflict = 'id') {
  // Deduplicate by conflict key before upserting
  const seen = new Map();
  for (const r of records) seen.set(r[conflict], r);
  const deduped = [...seen.values()];
  console.log(`  [dedup] ${records.length} → ${deduped.length} rows`);
  let upserted = 0;
  for (let i = 0; i < deduped.length; i += 500) {
    const { error } = await supabase.from(table).upsert(deduped.slice(i, i+500), { onConflict: conflict });
    if (error) throw error;
    upserted += Math.min(500, deduped.length - i);
  }
  return upserted;
}

async function ingestPMA() {
  console.log('\n[PMA] Fetching 10yr approvals...');
  const from = daysAgo(3650).replace(/-/g,'');
  const to   = daysAgo(0).replace(/-/g,'');
  const rows = await paginateAll((limit, skip) =>
    `${BASE}/pma.json?search=${CRM_QUERY}+AND+decision_date:[${from}+TO+${to}]&limit=${limit}&skip=${skip}&sort=decision_date:desc`
  );
  const records = rows.map(r => ({
    id:                 `${r.pma_number||''}-${r.supplement_number||r.decision_date||(Math.random().toString(36).slice(2))}`,
    applicant:          r.applicant          || null,
    device_name:        r.device_name        || null,
    product_code:       r.product_code       || null,
    decision_code:      r.decision_code      || null,
    decision_date:      r.decision_date      ? r.decision_date.slice(0,10) : null,
    advisory_committee: r.advisory_committee || null,
    supplement_number:  r.supplement_number  || null,
  }));
  const n = await upsertBatched('pma_approvals', records);
  console.log(`[PMA] Upserted ${n} rows`);
}

async function ingestMAUDE() {
  console.log('\n[MAUDE] Fetching 10yr events (date-chunked)...');
  const rows = await paginateChunked(
    (limit, skip, from, to) =>
      `${BASE}/event.json?search=device.generic_name:(pacemaker+OR+defibrillator+OR+cardioverter)+AND+date_received:[${from}+TO+${to}]&limit=${limit}&skip=${skip}&sort=date_received:desc`
  );
  const records = rows.map(r => {
    const dev = (Array.isArray(r.device) && r.device[0]) || {};
    return {
      id:             r.report_number || `${dev.manufacturer_d_name}-${r.date_received}-${Math.random().toString(36).slice(2,7)}`,
      manufacturer:   dev.manufacturer_d_name || null,
      brand_name:     dev.brand_name          || null,
      product_code:   dev.device_report_product_code || null,
      event_type:     r.event_type            || null,
      date_received:  r.date_received         ? r.date_received.slice(0,10) : null,
      device_problem: Array.isArray(r.device_problem_codes) ? r.device_problem_codes.join(',') : null,
      report_number:  r.report_number         || null,
    };
  });
  const n = await upsertBatched('maude_events', records);
  console.log(`[MAUDE] Upserted ${n} rows`);
}

async function ingestRecalls() {
  console.log('\n[RECALLS] Fetching 10yr recalls...');
  const rows = await paginateAll((limit, skip) =>
    `${BASE}/recall.json?search=${CRM_QUERY}&limit=${limit}&skip=${skip}&sort=event_date_initiated:desc`
  );
  const records = rows.map(r => ({
    product_res_number: r.product_res_number  || null,
    recalling_firm:     r.recalling_firm       || null,
    product_description:r.product_description  || null,
    product_code:       r.product_code         || null,
    recall_status:      r.status               || null,
    event_date_initiated: r.event_date_initiated ? r.event_date_initiated.slice(0,10) : null,
    reason_for_recall:  r.reason_for_recall    || null,
    status:             r.status               || null,
  }));
  const n = await upsertBatched('recalls', records, 'product_res_number');
  console.log(`[RECALLS] Upserted ${n} rows`);
}

async function verify() {
  console.log('\n[VERIFY] Row counts:');
  for (const t of ['pma_approvals','maude_events','recalls']) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${error ? 'ERROR: ' + error.message : count + ' rows'}`);
  }
}

(async () => {
  try {
    await ingestPMA();
    await ingestMAUDE();
    await ingestRecalls();
    await ingestSaMD();
    await verify();
    console.log('\nIngest complete.');
  } catch(e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
})();

async function ingestSaMD() {
  console.log('\n[SAMD] Fetching 10yr SaMD events (OZO, date-chunked)...');
  const raw = await paginateChunked((limit, skip, from, to) => {
    const Q = `product_code:OZO+AND+date_received:[${from}+TO+${to}]`;
    return `${BASE}/event.json?api_key=${process.env.FDA_API_KEY}&search=${Q}&limit=${limit}&skip=${skip}`;
  });
  const records = raw.map(r => {
    const dev = (Array.isArray(r.device) && r.device[0]) || {};
    return {
      report_number:      r.report_number || null,
      manufacturer:       dev.manufacturer_d_name || null,
      brand_name:         dev.brand_name || null,
      product_code:       dev.device_report_product_code || 'OZO',
      event_type:         r.event_type || null,
      date_received:      r.date_received ? r.date_received.slice(0,10) : null,
      device_problem:     Array.isArray(r.device_problem_codes) ? r.device_problem_codes[0] : null,
      adverse_event_flag: r.adverse_event_flag || null,
      report_source:      r.report_source_code || null,
    };
  }).filter(r => r.report_number);
  const n = await upsertBatched('samd_events', records, 'report_number');
  console.log(`[SAMD] Upserted ${n} rows`);
}
