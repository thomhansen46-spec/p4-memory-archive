'use strict';
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhgqexopbqfivoubzzeg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3FleG9wYnFmaXZvdWJ6emVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY5ODcsImV4cCI6MjA5MDQwMjk4N30.NBh-bjOfqHbYG06r6D8GwHL3NXte2hKAoMEHpN-ueug';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BASE = 'https://api.fda.gov/device';
const API_KEY = 'e4NgRq2lviZ0A7OhHdg3CEhUGjVwWy1TbZ4p061t';
const BATCH = 1000;
const DELAY = 400;
const PMA_CODES = ['DQN','MRX','LWS','QHN','DTB','DXX','NIQ','OZO','PZH','JAR','MAX','FRN'];
const EVENT_CODES = ['DQN','MRX','LWS','QHN','DTB','DXX','NIQ','OZO','PZH','JAR','MAX','FRN','KZH','LQQ'];
const SAMD_CODES = ['QBS','QCE','QCF','QCG','QDL','QDM','QDN','MYN','OYP','PIB','QDD'];
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
    const url=urlBase+'&api_key=e4NgRq2lviZ0A7OhHdg3CEhUGjVwWy1TbZ4p061t&limit='+BATCH+'&skip='+skip;
    console.log('  GET skip='+skip+(total!==null?'/'+total:'')+' ...');
    try{
      const d=await fdaFetch(url);
      const results=safeArr(d.results);
      if(!results.length)break;
      if(total===null)total=(d.meta&&d.meta.results)?d.meta.results.total:0;
      all.push(...results);skip+=results.length;
      if(skip>=total||all.length>=maxRows||results.length<BATCH)break;
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
async function seedPma(){
  console.log('\n-- PMA --');const map=new Map();
  for(const code of PMA_CODES){
    console.log(' code:',code);
    const raw=await fetchAll(BASE+'/pma.json?search=product_code:'+code+'&sort=decision_date:desc',5000);
    for(const r of raw){
      const key=safeStr(r.pma_number)||(safeStr(r.applicant)+'_'+safeStr(r.decision_date));
      if(!key||map.has(key))continue;
      map.set(key,{applicant:safeStr(r.applicant),device_name:safeStr(r.trade_name)||safeStr(r.generic_name),product_code:safeStr(r.product_code),decision_code:safeStr(r.decision_code),decision_date:safeStr(r.decision_date),advisory_committee:safeStr(r.advisory_committee_description)||safeStr(r.advisory_committee),supplement_number:safeStr(r.supplement_number)});
    }
    await sleep(DELAY);
  }
  for(const term of ['pacemaker','defibrillator','cardioverter']){
    console.log(' term:',term);
    const raw=await fetchAll(BASE+'/pma.json?search=device_name:'+term+'&sort=decision_date:desc',5000);
    for(const r of raw){
      const key=safeStr(r.pma_number)||(safeStr(r.applicant)+'_'+safeStr(r.decision_date));
      if(!key||map.has(key))continue;
      map.set(key,{applicant:safeStr(r.applicant),device_name:safeStr(r.trade_name)||safeStr(r.generic_name),product_code:safeStr(r.product_code),decision_code:safeStr(r.decision_code),decision_date:safeStr(r.decision_date),advisory_committee:safeStr(r.advisory_committee_description)||safeStr(r.advisory_committee),supplement_number:safeStr(r.supplement_number)});
    }
    await sleep(DELAY);
  }
  const rows=[...map.values()].filter(r=>r.applicant||r.device_name);
  console.log(' Unique PMA:',rows.length);
  await upsert('pma_approvals',rows,'supplement_number');
}
async function seedMaude(){
  console.log('\n-- MAUDE --');const map=new Map();
  for(const code of EVENT_CODES){
    console.log(' code:',code);
    const raw=await fetchAll(BASE+'/event.json?search=device.device_report_product_code:'+code+'&sort=date_received:desc',5000);
    for(const r of raw){
      const key=safeStr(r.mdr_report_key);if(!key||map.has(key))continue;
      const dev=safeArr(r.device)[0]||{};
      map.set(key,{report_number:key,manufacturer:safeStr(dev.manufacturer_d_name),brand_name:safeStr(dev.brand_name),product_code:safeStr(dev.device_report_product_code),event_type:safeStr(r.event_type),date_received:safeStr(r.date_received),device_problem:null});
    }
    await sleep(DELAY);
  }
  for(const term of ['pacemaker','defibrillator','cardioverter']){
    console.log(' term:',term);
    const raw=await fetchAll(BASE+'/event.json?search=device.generic_name:'+term+'&sort=date_received:desc',5000);
    for(const r of raw){
      const key=safeStr(r.mdr_report_key);if(!key||map.has(key))continue;
      const dev=safeArr(r.device)[0]||{};
      map.set(key,{report_number:key,manufacturer:safeStr(dev.manufacturer_d_name),brand_name:safeStr(dev.brand_name),product_code:safeStr(dev.device_report_product_code),event_type:safeStr(r.event_type),date_received:safeStr(r.date_received),device_problem:null});
    }
    await sleep(DELAY);
  }
  console.log(' Unique MAUDE:',map.size);
  await upsert('maude_events',[...map.values()],'report_number');
}
async function seedRecalls(){
  console.log('\n-- Recalls --');const map=new Map();
  for(const code of PMA_CODES){
    console.log(' code:',code);
    const raw=await fetchAll(BASE+'/recall.json?search=product_code:'+code+'&sort=event_date_initiated:desc',5000);
    for(const r of raw){
      const key=safeStr(r.recall_number)||safeStr(r.res_event_number);if(!key||map.has(key))continue;
      map.set(key,{recalling_firm:safeStr(r.recalling_firm),device_name:safeStr(r.product_description),product_code:safeStr(r.product_code),classification:safeStr(r.classification),date_initiated:safeStr(r.event_date_initiated),reason:safeStr(r.reason_for_recall),status:safeStr(r.status)});
    }
    await sleep(DELAY);
  }
  for(const term of ['pacemaker','defibrillator','cardioverter','implantable pulse generator']){
    console.log(' term:',term);
    const raw=await fetchAll(BASE+'/recall.json?search=product_description:'+encodeURIComponent(term)+'&sort=event_date_initiated:desc',5000);
    for(const r of raw){
      const key=safeStr(r.recall_number)||safeStr(r.res_event_number);if(!key||map.has(key))continue;
      map.set(key,{recalling_firm:safeStr(r.recalling_firm),device_name:safeStr(r.product_description),product_code:safeStr(r.product_code),classification:safeStr(r.classification),date_initiated:safeStr(r.event_date_initiated),reason:safeStr(r.reason_for_recall),status:safeStr(r.status)});
    }
    await sleep(DELAY);
  }
  console.log(' Unique Recalls:',map.size);
  await upsert('recalls',[...map.values()],'recalling_firm');
}
async function seedSamd(){
  console.log('\n-- SaMD --');const map=new Map();
  for(const code of SAMD_CODES){
    console.log(' code:',code);
    const raw=await fetchAll(BASE+'/event.json?search=device.device_report_product_code:'+code+'&sort=date_received:desc',5000);
    for(const r of raw){
      const key=safeStr(r.mdr_report_key);if(!key||map.has(key))continue;
      const dev=safeArr(r.device)[0]||{};
      map.set(key,{report_number:key,manufacturer:safeStr(dev.manufacturer_d_name),brand_name:safeStr(dev.brand_name),product_code:safeStr(dev.device_report_product_code),event_type:safeStr(r.event_type),date_received:safeStr(r.date_received),device_problem:null});
    }
    await sleep(DELAY);
  }
  for(const term of ['monitoring software','clinical decision support']){
    console.log(' term:',term);
    const raw=await fetchAll(BASE+'/event.json?search=device.generic_name:'+encodeURIComponent(term)+'&sort=date_received:desc',500);
    for(const r of raw){
      const key=safeStr(r.mdr_report_key);if(!key||map.has(key))continue;
      const dev=safeArr(r.device)[0]||{};
      map.set(key,{report_number:key,manufacturer:safeStr(dev.manufacturer_d_name),brand_name:safeStr(dev.brand_name),product_code:safeStr(dev.device_report_product_code),event_type:safeStr(r.event_type),date_received:safeStr(r.date_received),device_problem:null});
    }
    await sleep(DELAY);
  }
  console.log(' Unique SaMD:',map.size);
  await upsert('samd_events',[...map.values()],'report_number');
}
async function main(){
  console.log('P4 ETL -- '+new Date().toISOString());
  await seedPma();await seedMaude();await seedRecalls();await seedSamd();
  console.log('\n-- Final Counts --');
  for(const t of ['pma_approvals','maude_events','recalls','samd_events']){
    const{count}=await supabase.from(t).select('*',{count:'exact',head:true});
    console.log(' '+t+': '+count);
  }
  console.log('Done -- '+new Date().toISOString());
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(1);});
