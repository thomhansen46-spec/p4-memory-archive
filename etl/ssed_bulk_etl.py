import fitz
import re
import hashlib
import requests
import os
import time
from datetime import datetime

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

PMA_NUMBERS = [
    "P150035", "P160054", "P200026", "P100047",
    "P950037", "P110035", "P240013", "P910073",
    "P930035", "P910077", "P960006", "P960004",
    "P010012", "P170006",
]

def fetch_pdf_from_fda(pma_number):
    pma_lower = pma_number.lower()
    # FDA stores SSEDs with 'b' suffix (original approval document)
    urls = [
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf2/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf3/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf4/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf5/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf6/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf7/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf8/{pma_lower}b.pdf",
        f"https://www.accessdata.fda.gov/cdrh_docs/pdf9/{pma_lower}b.pdf",
    ]
    for url in urls:
        r = requests.get(url, timeout=30)
        if r.status_code == 200 and b"%PDF" in r.content[:10]:
            print(f"  found: {url} ({len(r.content)//1024}KB)")
            return r.content
    return None

def extract_text(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n".join([page.get_text() for page in doc])

def extract_sections(text):
    patterns = {
        "indication": r"INDICATIONS FOR USE(.*?)(\n[A-Z ]{5,})",
        "clinical":   r"CLINICAL(.*?)(\n[A-Z ]{5,})",
        "adverse":    r"ADVERSE EVENTS(.*?)(\n[A-Z ]{5,})",
    }
    data = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.S)
        if match:
            data[key] = match.group(1).strip()[:5000]
    return data

def upload(record):
    url = f"{SUPABASE_URL}/rest/v1/ssed_events"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(url, headers=headers, json=[record], timeout=30)
    if not r.ok:
        print(f"  upload error: {r.status_code} {r.text[:200]}")

def run():
    success, skipped = 0, 0
    for pma in PMA_NUMBERS:
        print(f"\n-> {pma}")
        pdf_bytes = fetch_pdf_from_fda(pma)
        if not pdf_bytes:
            print(f"  skipped — no PDF found")
            skipped += 1
            continue
        text = extract_text(pdf_bytes)
        sections = extract_sections(text)
        record_id = hashlib.sha256(text.encode()).hexdigest()
        record = {
            "id": record_id,
            "device_name": pma,
            "indication": sections.get("indication"),
            "clinical_summary": sections.get("clinical"),
            "adverse_events": [{"text": sections.get("adverse")}],
            "extracted_text_hash": record_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        upload(record)
        print(f"  ingested OK")
        success += 1
        time.sleep(1)
    print(f"\nDone. {success} ingested, {skipped} skipped")

if __name__ == "__main__":
    run()
