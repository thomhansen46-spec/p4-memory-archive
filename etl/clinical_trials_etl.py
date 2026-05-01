import requests
import os
import time

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
CTGOV_BASE = "https://clinicaltrials.gov/api/v2/studies"

CONDITIONS = [
    "pacemaker",
    "cardiac ablation",
    "coronary stent",
    "transcatheter valve",
    "implantable defibrillator",
    "heart failure device",
    "cardiac resynchronization",
    "left ventricular assist",
    "cardiac catheter",
    "coronary artery disease",
]

def fetch_trials(condition, page_size=100):
    params = {"query.cond": condition, "pageSize": page_size, "format": "json"}
    r = requests.get(CTGOV_BASE, params=params, timeout=30)
    if not r.ok:
        raise RuntimeError(f"CT.gov error: {r.status_code}")
    return r.json().get("studies", [])

def flatten(study):
    p = study.get("protocolSection", {})
    ident = p.get("identificationModule", {})
    status = p.get("statusModule", {})
    sponsor = p.get("sponsorCollaboratorsModule", {})
    return {
        "nct_id": ident.get("nctId"),
        "brief_title": ident.get("briefTitle"),
        "overall_status": status.get("overallStatus"),
        "start_date": (status.get("startDateStruct") or {}).get("date"),
        "completion_date": (status.get("completionDateStruct") or {}).get("date"),
        "lead_sponsor": (sponsor.get("leadSponsor") or {}).get("name"),
        "has_results": bool(study.get("resultsSection")),
    }

def upload(rows):
    url = f"{SUPABASE_URL}/rest/v1/clinical_trials"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(url, headers=headers, json=rows, timeout=60)
    if not r.ok:
        raise RuntimeError(f"Upload failed: {r.status_code} {r.text[:300]}")

if __name__ == "__main__":
    total = 0
    for condition in CONDITIONS:
        try:
            studies = fetch_trials(condition)
            rows = [flatten(s) for s in studies if s.get("protocolSection")]
            upload(rows)
            print(f"{condition}: {len(rows)} trials loaded")
            total += len(rows)
            time.sleep(1)
        except Exception as e:
            print(f"{condition}: ERROR — {e}")
    print(f"\nTotal trials loaded: {total}")
