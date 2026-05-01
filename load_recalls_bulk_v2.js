'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTY5NTYsImV4cCI6MjA1ODU5Mjk1Nn0.xNFDqnMoRe8dxMmF2xQyJ1wMFEJ9RBZCP_piSxcRHtU';
const CRM_CODES = new Set(['DSQ', 'DTB', 'DXX', 'LWS', 'MKJ']);
const FILE = path.join(__dirname, 'device-recall-0001-of-0001.json');
const CHUNK_SIZE = 100;

function mapRecord(r) {
  return {
    product_res_number: r.product_res_number || null,
    recalling_firm: r.recalling_firm || null,
    product_description: r.product_description || null,
    product_code: r.product_code || null,
    recall_status: r.recall_status || null,
    voluntary_mandated: r.voluntary_mandated || null,
    initial_firm_notification: r.initial_firm_notification || null,
    distribution_pattern: r.distribution_pattern || null,
    reason_for_recall: r.reason_for_recall || null,
    status: r.status || null,
    event_date_initiated: r.event_date_initiated || null,
    event_date_posted: r.event_date_posted || null,
    event_date_terminated: r.event_date_terminated || null,
    city: r.city || null,
    state: r.state || null,
    country: r.country || null,
    postal_code: r.postal_code || null,
    product_quantity: r.product_quantity || null,
    action: r.action || null,
    cfres_id: r.cfres_id || null,
    res_event_number: r.res_event_number ? String(r.res_event_number) : null,
    k_numbers: Array.isArray(r.k_numbers) ? r.k_numbers.join(',') : (r.k_numbers || null),
    code_info: r.code_info || null,
    firm_fei_number: r.firm_fei_number ? String(r.firm_fei_number) : null,
    address_1: r.address_1 || null,
    additional_info_contact: r.additional_info_contact || null,
    root_cause_description: r.root_cause_description || null,
    openfda_device_name: r.openfda?.device_name?.[0] || null,
    openfda_device_class: r.openfda?.device_class || null,
    openfda_regulation_number: r.openfda?.regulation_number?.[0] || null,
    openfda_medical_specialty: r.openfda?.medical_specialty_description?.[0] || null,
  };
}

async function upsertChunk(records) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(records);
    const opts = {
      hostname: 'lhgqexopbqfivoubzzeg.supabase.co',
      path: '/rest/v1/recalls',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0,300)}`));
        else resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Streaming', FILE);
  const stream = fs.createReadStream(FILE, { encoding: 'utf8', highWaterMark: 8 * 1024 * 1024 });

  let buffer = '';
  let inResults = false;
  let depth = 0;
  let recordBuffer = '';
  let inRecord = false;
  let crm = [];
  let total = 0;

  for await (const chunk of stream) {
    buffer += chunk;

    if (!inResults) {
      const idx = buffer.indexOf('"results":[');
      if (idx !== -1) {
        inResults = true;
        buffer = buffer.slice(idx + '"results":['.length);
      } else {
        if (buffer.length > 100) buffer = buffer.slice(-100);
        continue;
      }
    }

    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (ch === '{') {
        depth++;
        if (depth === 1) { inRecord = true; recordBuffer = '{'; }
        else if (inRecord) recordBuffer += ch;
      } else if (ch === '}') {
        if (inRecord) recordBuffer += ch;
        depth--;
        if (depth === 0 && inRecord) {
          inRecord = false;
          total++;
          try {
            const r = JSON.parse(recordBuffer);
            if (CRM_CODES.has(r.product_code)) crm.push(mapRecord(r));
          } catch(e) {}
          recordBuffer = '';
        }
      } else if (inRecord) {
        recordBuffer += ch;
      }
    }
    buffer = inRecord ? recordBuffer : '';
    if (inRecord) recordBuffer = '';
  }

  console.log(`\nTotal records parsed: ${total}`);
  console.log(`CRM records found: ${crm.length}`);

  if (!crm.length) { console.log('No CRM records found.'); return; }

  console.log('Clearing existing CRM recalls...');
  await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'lhgqexopbqfivoubzzeg.supabase.co',
      path: '/rest/v1/recalls?product_code=in.(DSQ,DTB,DXX,LWS,MKJ)',
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { console.log('Clear status:', res.statusCode); resolve(); });
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`Inserting ${crm.length} records...`);
  let inserted = 0;
  for (let i = 0; i < crm.length; i += CHUNK_SIZE) {
    await upsertChunk(crm.slice(i, i + CHUNK_SIZE));
    inserted += Math.min(CHUNK_SIZE, crm.length - i);
    process.stdout.write(`\r  ${inserted}/${crm.length}`);
  }
  console.log('\n✅ CDRH recalls loaded into Supabase!');
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
