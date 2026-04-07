'use strict';
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug';
const API_KEY = 'e4NgRq2lviZ0A7OhHdg3CEhUGjVwWy1TbZ4p061t';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BASE = 'https://api.fda.gov/device';
const DELAY = 400;
const CRM_DEVICES = [
  { pma_number: 'P150033', applicant: 'Medtronic', device_name: 'Micra Transcatheter Pacemaker' },
  { pma_number: 'P960006', applicant: 'Medtronic', device_name: 'ICD' },
  { pma_number: 'P010031', applicant: 'Medtronic', device_name: 'CRT-D' },
  { pma_number: 'P150035', applicant: 'Abbott', device_name: 'Aveir VR/DR' },
  { pma_number: 'P930039', applicant: 'Abbott', device_name: 'ICD' },
  { pma_number: 'P130022', applicant: 'Boston Scientific', device_name: 'ICD' },
  { pma_number: 'P050023', applicant: 'Boston Scientific', device_name: 'CRT-D' },
  { pma_number: 'P100015', applicant: 'Biotronik', device_name: 'Pacemaker' },
];
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function safeStr(v){return typeof v==='string'?v.trim().slice(0,500):null;}
function safeArr(v){return Array.isArray(v)?v:[];}
function fdaFetch(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{timeout:20000},res=>{
      let raw='';
      res.on('data',c=>raw+=c);
      res.on('end',()=>{
        if(res.statusCode===404)return resolve({results:[],meta:{results:{total:0}}});
        if(res.statusCode===429)return reject(new Error('Rate limited'));
        if(res.statusCode!==200)return reject(new Error('HTTP '+res.statusCode));
        try{resolve(JSON.parse(raw));}catch(e){reject(new Error('parse fail'));}
      });
    });
    req.on('timeout',()=>{req.destroy();reject(new Error('Timeout'));});
    req.on('error',reject);
  });
}
async function fetchAll(urlBase,maxRows){
  const all=[];let skip=0;let total=null;
  while(true){
    const url=urlBase+'&api_key='+API_KEY+'&limit=1000&skip='+skip;
    console.log('  GET skip='+skip+(total!==null?'/'+total:'')+' ...');
    try{
      const d=await fdaFetch(url);
      const results=safeArr(d.results);
      if(!results.length)break;
      if(total===null)total=(d.meta&&d.meta.results)?d.meta.results.total:0;
      all.push(...results);skip+=results.length;
      if(skip>=total||all.length>=maxRows||results.length<1000)break;
      await sleep(DELAY);
    }catch(e){console.warn('  warn:',e.message);break;}
  }
  return all;
}
async function upsert(table,rows,conflict){
  if(!rows.length){console.log('  (no rows)');return;}
  let done=0;
  for(let i=0;i<rows.length;i+=500){
    const chunk=rows.slice(i,i+500);
    const{error}=await supabase.from(table).upsert(chunk,{onConflict:conflict,ignoreDuplicates:true});
    if(error)console.warn('  upsert warn:',error.message);
    else done+=chunk.length;
  }
  console.log('  OK '+done+' rows -> '+table);
}
function classifyType(r){
  const code=safeStr(r.decision_code)||'';
  const type=safeStr(r.supplement_type)||'';
  const reason=safeStr(r.supplement_reason)||'';
  if(/panel/i.test(type))return 'Panel Track';
  if(/180/i.test(type)||/software/i.test(reason))return '180-Day';
  if(/30.day/i.test(type)||/manufacturing/i.test(reason))return '30-Day Notice';
  if(/special/i.test(type))return 'Special';
  if(/label/i.test(reason))return 'Labeling';
  if(/APPL/i.test(code))return 'Original PMA';
  return safeStr(r.supplement_type)||'Other';
}
async function seedSupplements(){
  console.log('\n-- PMA Supplements --');
  const map=new Map();
  for(const device of CRM_DEVICES){
    console.log('\n Device:',device.pma_number,'-',device.applicant);
    const url=BASE+'/pma.json?search=pma_number:'+device.pma_number;
    const raw=await fetchAll(url,5000);
    console.log('  Fetched:',raw.length,'records');
    for(const r of raw){
      const suppNum=safeStr(r.supplement_number);
      const key=device.pma_number+'_'+(suppNum||safeStr(r.decision_date));
      if(!key||map.has(key))continue;
      map.set(key,{pma_number:device.pma_number,supplement_number:suppNum,supplement_type:classifyType(r),decision_date:safeStr(r.decision_date),decision_code:safeStr(r.decision_code),supplement_reason:safeStr(r.supplement_reason),applicant:safeStr(r.applicant)||device.applicant,device_name:safeStr(r.trade_name)||safeStr(r.generic_name)||device.device_name,product_code:safeStr(r.product_code)});
    }
    await sleep(DELAY);
  }
  const rows=[...map.values()];
  console.log('\n Total unique supplements:',rows.length);
  await upsert('pma_supplements',rows,'pma_number,supplement_number');
}
async function main(){
  console.log('P4 Supplement ETL -- '+new Date().toISOString());
  await seedSupplements();
  console.log('\n-- Final Counts --');
  for(const t of ['crm_devices','pma_supplements']){
    const{count}=await supabase.from(t).select('*',{count:'exact',head:true});
    console.log(' '+t+': '+count);
  }
  console.log('Done -- '+new Date().toISOString());
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(1);});
