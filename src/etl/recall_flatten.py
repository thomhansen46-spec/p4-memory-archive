import json,zipfile,os
from datetime import datetime,timedelta
RAW=os.path.expanduser(chr(126)+chr(47)+'p4-memory-archive/src/data/raw')
OUT=os.path.expanduser(chr(126)+chr(47)+'p4-memory-archive/src/data/sql')
os.makedirs(OUT,exist_ok=True)
cutoff=(datetime.now()-timedelta(days=1825)).strftime(chr(37)+'Y-'+chr(37)+'m-'+chr(37)+'d')
CRM={'DSQ','DTB','DXX','LWS','MKJ'}
print('[RECALL] Opening zip...')
with zipfile.ZipFile(os.path.join(RAW,'recall.zip')) as z:
    fname=[f for f in z.namelist() if f.endswith('.json')][0]
    with z.open(fname) as f:
        data=json.load(f)
records=data['results']
print('[RECALL] Total: '+str(len(records)))
filtered=[r for r in records if r.get('product_code') in CRM and r.get('event_date_initiated','')>=cutoff]
print('[RECALL] CRM 5yr: '+str(len(filtered)))
cols=['product_res_number','recalling_firm','product_description','product_code','recall_status','voluntary_mandated','initial_firm_notification','distribution_pattern','reason_for_recall','status','event_date_initiated','event_date_posted','event_date_terminated','city','state','country','postal_code','product_quantity','action']
q=chr(39)
def esc(v):
    if v is None or v=='': return 'NULL'
    return q+str(v).replace(q,q+q)[:500]+q
rows=['('+','.join(esc(r.get(c)) for c in cols)+')' for r in filtered]
sql='TRUNCATE TABLE recalls;'+chr(10)+'INSERT INTO recalls ('+','.join(cols)+')'+chr(10)+'VALUES'+chr(10)+(','+chr(10)).join(rows)+';'
open(os.path.join(OUT,'recalls.sql'),'w').write(sql)
print('[RECALL] SQL written')
for field in ['product_res_number','product_code','recalling_firm','recall_status','event_date_initiated']:
    n=sum(1 for r in filtered if r.get(field))
    print('  '+field+': '+str(n)+'/'+str(len(filtered)))
ids=[r.get('product_res_number') for r in filtered if r.get('product_res_number')]
print('  Dupes: '+str(len(ids)-len(set(ids))))
print('DONE')