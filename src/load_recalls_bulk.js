'use strict';
const fs = require('fs');
const fetch = require('node-fetch');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const CRM_CODES = new Set(['LWS','LWP','DTB','NIK','DXX','MKJ','MRM','DSQ']);
const BATCH_SIZE = 50;
function mapRecord(r) {
  const o = r.openfda || {};
  return {
    product_res_number: r.product_res_number || null,
    recalling_firm: r.recalling_firm || null,
    product_description: r.product_description || null,
    product_code: r.product_code || null,
    recall_status: r.recall_status || null,
    distribution_pattern: r.distribution_pattern || null,
    reason_for_recall: r.reason_for_recall || null,
    event_date_initiated: r.event_date_initiated || null,
    event_date_posted: r.event_date_posted || null,
    city: r.city || null,
    state: r.state || null,
    postal_code: r.postal_code || null,
    product_quantity: r.product_quantity || null,
    action: r.action || null,
    cfres_id: r.cfres_id || null,
    res_event_number: r.res_event_number || null,
    k_numbers: Array.isArray(r.k_numbers) ? r.k_numbers.join(',') : (r.k_numbers || null),
    code_info: r.code_info || null,
    firm_fei_number: r.firm_fei_number || null,
    address_1: r.address_1 || null,
    additional_info_contact: r.additional_info_contact || null,
    root_cause_description: r.root_cause_description || null,
    openfda_device_name: (o.device_name || [null])[0],
    openfda_device_class: (o.device_class || [null])[0],
    openfda_regulation_number: (o.regulation_number || [null])[0],
    openfda_medical_specialty: (o.medical_specialty_description || [null])[0],
  };
}
async function upsertBatch(batch) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/recalls', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(batch)
  });
  if (res.status >= 300) {
    const txt = await res.text();
    throw new Error('Upsert failed: ' + txt);
  }
}
async function main() {
  console.log('Streaming recalls JSON...');
  const buf = [];
  let loaded = 0;
  await new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream('device-recall-0001-of-0001.json'),
      parser(),
      streamArray(),
    ]);
    pipeline.on('data', async ({ value: r }) => {
      if (!CRM_CODES.has(r.product_code)) return;
      buf.push(mapRecord(r));
      if (buf.length >= BATCH_SIZE) {
        pipeline.pause();
        const toSend = buf.splice(0, BATCH_SIZE);
        await upsertBatch(toSend);
        loaded += toSend.length;
        process.stdout.write('\rLoaded: ' + loaded);
        pipeline.resume();
      }
    });
    pipeline.on('end', async () => {
      if (buf.length > 0) { await upsertBatch(buf); loaded += buf.length; }
      console.log('\nDone! Total:', loaded);
      resolve();
    });
    pipeline.on('error', reject);
  });
}
main().catch(e => { console.error(e); process.exit(1); });
