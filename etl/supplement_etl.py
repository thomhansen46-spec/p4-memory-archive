import os, re, time, requests
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def clean(html):
    return re.sub(r'<[^>]+>', '', html).strip()

def get_supplements(pma):
    r = requests.get(f"https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id={pma}", headers=HEADERS, timeout=15)
    return re.findall(r'SupplementNumber=(S\d+)', r.text)

def scrape_supplement(pma, supp):
    r = requests.get(f"https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id={pma}{supp}", headers=HEADERS, timeout=15)
    t = r.text
    def field(label):
        m = re.findall(label + r'.*?<td[^>]*>(.*?)</td>', t, re.DOTALL|re.IGNORECASE)
        return clean(m[0]) if m else ""
    ao = re.findall(r'Approval Order Statement</[^>]+>\s*(.*?)</td>', t, re.DOTALL|re.IGNORECASE)
    return {"id": f"{pma}{supp}", "pma_number": pma, "supplement_number": supp,
            "supplement_type": field("Supplement Type"), "supplement_reason": field("Supplement Reason"),
            "decision_date": field("Decision Date") or None, "approval_statement": clean(ao[0]) if ao else ""}

def run():
    result = sb.table("ssed_events").select("device_name").execute()
    pmas = sorted(set(re.match(r'(P\d{6})', r.get("device_name","")).group(1)
                      for r in result.data if re.match(r'(P\d{6})', r.get("device_name",""))))
    print(f"Processing {len(pmas)} PMAs")
    for pma in pmas:
        supps = get_supplements(pma)
        if not supps:
            print(f"{pma}: no supplements")
            continue
        print(f"{pma}: {len(supps)} supplements")
        rows = []
        for s in supps:
            try:
                rows.append(scrape_supplement(pma, s))
                time.sleep(0.3)
            except Exception as e:
                print(f"  error {pma}{s}: {e}")
        if rows:
            sb.table("pma_supplements").upsert(rows, on_conflict="id").execute()
            print(f"  upserted {len(rows)}")
        time.sleep(0.5)

if __name__ == "__main__":
    run()
