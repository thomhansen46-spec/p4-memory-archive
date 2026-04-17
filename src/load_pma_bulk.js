const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const CRM_APPLICANTS = ['medtronic','abbott','boston scientific','biotronik','microport','st. jude','guidant'];
const PMA_FILE = path.join(process.env.HOME, 'Downloads/pma.txt');

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  if (!y || y.length !== 4) return null;
  return y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0');
}

async function upsertBatch(records) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/pma_approvals', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(records)
  });
  if (!res.ok) { const err = await res.text(); console.error('Upsert error:', err.slice(0,200)); return false; }
  return true;
}

async function main() {
  console.log('=== P4 PMA Bulk Loader ===');
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }
  const raw = fs.readFileSync(PMA_FILE, 'latin1');
  const lines = raw.split('\n');
  console.log('Total lines: ' + lines.length);
  let batch = [], loaded = 0, skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g,'').trim();
    if (!line) continue;
    const c = line.split('|');
    if (c.length < 21) { skipped++; continue; }
    const applicant = (c[2]||'').toLowerCase();
    const advisory  = (c[12]||'').trim();
    const isCRM = advisory === 'CV' && CRM_APPLICANTS.some(a => applicant.includes(a));
    if (!isCRM) { skipped++; continue; }
    batch.push({
      pma_number: (c[0]||'').trim()||null,
      supplement_number: (c[1]||'').trim()||null,
      applicant: (c[2]||'').trim()||null,
      device_name: (c[9]||'').trim()||null,
      trade_name: (c[10]||'').trim()||null,
      product_code: (c[11]||'').trim()||null,
      advisory_committee: (c[12]||'').trim()||null,
      supplement_type: (c[13]||'').trim()||null,
      supplement_reason: (c[14]||'').trim()||null,
      date_received: parseDate(c[16]),
      decision_date: parseDate(c[17]),
      decision_code: (c[20]||'').trim()||null,
      ao_statement: (c[21]||'').trim().slice(0,500)||null
    });
    if (batch.length === 200) {
      const ok = await upsertBatch(batch);
      if (ok) { loaded += 200; console.log('Upserted ' + loaded + ' CRM records...'); }
      batch = [];
    }
  }
  if (batch.length > 0) { const ok = await upsertBatch(batch); if (ok) loaded += batch.length; }
  console.log('\n=== DONE === Loaded: ' + loaded + ' | Skipped: ' + skipped);
}
main().catch(console.error);
