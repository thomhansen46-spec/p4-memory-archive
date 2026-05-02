import os, re, time, requests, json
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
CODES = ['DSQ','DSR','DTB','DXY','EZW','HQL','JXK','LGW','LNM','LOF','LOM','LPB','LPM','LPO','LQE','LTI','LWP','LWR','LWS','LZP','MAF','MAQ','MCN','MDS','MER','MFK','MGB','MIH','MJO','MKJ','MKT','MLV','MNB','MOM','MOZ','MRA','MRM','MVK','MWG','MYL','MYM','MZO','MZP','NBE','NCD','NGV','NHL','NIM','NIN','NIO','NIP','NIQ','NIU','NKM','NOX','NPS','NPT','NPU','NPV','NPW','NQO','NQR','NSA','NTG','NUU','NVN','NVY','NWX','NXW','NYQ','OAD','OAE','OBF','OGO','ONU','OOB','OPR','OTL','OUT','OWD','OYF','OZA','OZD','OZG','OZO','OZP','PAB','PFV','PHO','PHP','PJQ','PJY','PLS','PNF','PNJ','PNW','PNY','POE','POH','PQP','PRC','PRL','PYX','PZE','PZK','QAN','QBA','QBI','QBT','QCA','QCT','QES','QFV','QHJ','QIK','QIT','QKF','QLK','QMG','QNH','QON','QPT','QQK','QQT','QRH','QRU','QSK','QTL','QVG','QWC','QWK','QWM','QWN','QWQ','QXB','QYI','QZI','QZJ','QZK','SAZ','SBB','SBL','SDK','SDQ','SEG','SEI','SEQ','SER','SFA','SFI','SFJ','SGK','SGU']

def scrape_tplc(code):
    r = requests.get(f"https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfTPLC/tplc.cfm?id={code}", headers=HEADERS, timeout=15)
    if r.status_code != 200: return None
    t = r.text
    mdr_rows = re.findall(r"reportdatefrom=1/1/(\d{4})[^>]*>(\d{4})</a></td>\s*\r?\n\s*<td[^>]*>(\d+)</td>\s*\r?\n\s*<td[^>]*>(\d+)</td>", t)
    mdr_by_year = [{"year":y,"reports":int(rp),"events":int(ev)} for _,y,rp,ev in mdr_rows]
    total = sum(int(rp) for _,_,rp,_ in mdr_rows)
    dev = re.findall(r"productproblem=\d+[^>]*>([^<]+)</a></td>\s*\t?\r?\n\s*<td[^>]*>(\d+)</td>\s*\t?\r?\n\s*<td[^>]*>(\d+)</td>", t)
    pat = re.findall(r"patientproblem=\d+[^>]*>([^<]+)</a></td>\s*\t?\r?\n\s*<td[^>]*>(\d+)</td>\s*\t?\r?\n\s*<td[^>]*>(\d+)</td>", t)
    return {
        "product_code": code,
        "mdr_by_year": json.dumps(mdr_by_year),
        "device_problems": json.dumps([{"problem":p,"mdrs":int(m),"events":int(e)} for p,m,e in dev[:10]]),
        "patient_problems": json.dumps([{"problem":p,"mdrs":int(m),"events":int(e)} for p,m,e in pat[:10]]),
        "total_mdrs": total,
    }

def run():
    print(f"Processing {len(CODES)} product codes")
    for code in CODES:
        try:
            data = scrape_tplc(code)
            if not data: print(f"{code}: no data"); continue
            print(f"{code}: {data['total_mdrs']} MDRs")
            sb.table("tplc_summary").upsert(data, on_conflict="product_code").execute()
            time.sleep(0.5)
        except Exception as e:
            print(f"{code}: error - {e}")
    print("Done.")

if __name__ == "__main__":
    run()
