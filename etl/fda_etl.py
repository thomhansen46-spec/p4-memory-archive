import os, time, logging
from datetime import datetime
import requests
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("fda_etl")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

FDA_BASE = "https://api.fda.gov"
PAGE_LIMIT = 100
MAX_RECORDS = 2000
CRM = ["FRY","LWS","MRX","NIK","JAC","DTB","KZG","OZO"]
SAMD = ["QJO","PIB","QFN","OZO"]

def sg(obj, *keys, d=""):
    val = obj
    for k in keys:
        if val is None: return d
        if isinstance(val, dict): val = val.get(k)
        elif isinstance(val, list): val = val[0] if val else d
        else: return d
    if isinstance(val, list): val = val[0] if val else d
    return val if val is not None else d

def pd(raw):
    if not raw or len(raw) < 8: return None
    try: return datetime.strptime(raw[:8], "%Y%m%d").strftime("%Y-%m-%d")
    except: return None

def fetch(endpoint, search):
    records, skip = [], 0
    while skip < MAX_RECORDS:
        limit = min(PAGE_LIMIT, MAX_RECORDS - skip)
        params = {"search": search, "limit": limit, "skip": skip}
        for attempt in range(1, 4):
            try:
                r = requests.get(f"{FDA_BASE}{endpoint}", params=params, timeout=30)
                if r.status_code == 404: return records
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:
                log.warning("attempt %d: %s", attempt, e)
                if attempt == 3: return records
                time.sleep(3)
        batch = data.get("results", [])
        if not batch: break
        records.extend(batch)
        skip += len(batch)
        log.info("  fetched %d", len(records))
        time.sleep(0.3)
    return records

def t_pma(raw):
    rows = []
    for r in raw:
        pid = sg(r, "pma_number")
        if not pid: continue
        rows.append({"id":pid,"applicant":sg(r,"applicant"),"device_name":sg(r,"trade_name"),"product_code":sg(r,"product_code"),"decision_code":sg(r,"decision"),"decision_date":pd(sg(r,"decision_date")),"advisory_committee":sg(r,"advisory_committee"),"supplement_number":sg(r,"supplement_number")})
    return rows

def t_maude(raw):
    rows = []
    for r in raw:
        key = sg(r, "mdr_report_key")
        if not key: continue
        dev = r.get("device", [{}])[0] if r.get("device") else {}
        dp = sg(dev, "device_problem_codes")
        rows.append({"id":str(key),"manufacturer":sg(dev,"manufacturer_d_name"),"brand_name":sg(dev,"brand_name"),"product_code":sg(dev,"device_report_product_code"),"event_type":sg(r,"event_type"),"date_received":pd(sg(r,"date_received")),"device_problem":"; ".join(dp) if isinstance(dp,list) else str(dp),"report_number":sg(r,"report_number")})
    return rows

def t_recalls(raw):
    rows = []
    for r in raw:
        rid = sg(r, "recall_number")
        if not rid: continue
        rows.append({"id":rid,"recalling_firm":sg(r,"recalling_firm"),"device_name":sg(r,"product_description"),"product_code":sg(r,"product_code"),"classification":sg(r,"classification"),"date_initiated":pd(sg(r,"recall_initiation_date")),"reason":sg(r,"reason_for_recall"),"status":sg(r,"status")})
    return rows

def upsert(table, rows):
    if not rows: return log.info("  [%s] 0 rows", table)
    for i in range(0, len(rows), 200):
        try:
            supabase.table(table).upsert(rows[i:i+200], on_conflict="id").execute()
            log.info("  [%s] upserted %d", table, min(i+200, len(rows)))
        except Exception as e:
            log.error("  [%s] error: %s", table, e)

def main():
    start = datetime.utcnow()
    log.info("ETL started")
    s = " OR ".join
    log.info("=== PMA ===")
    upsert("pma_approvals", t_pma(fetch("/device/pma.json", s(f"product_code:{p}" for p in CRM))))
    log.info("=== MAUDE ===")
    upsert("maude_events", t_maude(fetch("/device/event.json", s(f"device.device_report_product_code:{p}" for p in CRM))))
    log.info("=== Recalls ===")
    upsert("recalls", t_recalls(fetch("/device/enforcement.json", s(f"product_code:{p}" for p in CRM))))
    log.info("=== SaMD ===")
    upsert("samd_events", t_maude(fetch("/device/event.json", s(f"device.device_report_product_code:{p}" for p in SAMD))))
    log.info("ETL complete in %.1fs", (datetime.utcnow()-start).total_seconds())

if __name__ == "__main__":
    main()
