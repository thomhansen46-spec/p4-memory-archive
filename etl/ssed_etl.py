import fitz
import re
import hashlib
import requests
import os
from datetime import datetime

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def extract_text(pdf_path):
    doc = fitz.open(pdf_path)
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
            data[key] = match.group(1).strip()
    return data

def build_record(pdf_path):
    text = extract_text(pdf_path)
    sections = extract_sections(text)
    record_id = hashlib.sha256(text.encode()).hexdigest()
    return {
        "id": record_id,
        "device_name": pdf_path.split("/")[-1],
        "indication": sections.get("indication"),
        "clinical_summary": sections.get("clinical"),
        "adverse_events": [{"text": sections.get("adverse")}],
        "extracted_text_hash": record_id,
        "created_at": datetime.utcnow().isoformat(),
    }

def upload(record):
    url = f"{SUPABASE_URL}/rest/v1/ssed_events"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(url, headers=headers, json=[record])
    if not r.ok:
        raise RuntimeError(f"Upload failed: {r.status_code} {r.text[:300]}")

def run(pdf_path):
    record = build_record(pdf_path)
    upload(record)
    print("SSED ingested:", record["id"])

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "data/ssed/sample.pdf"
    run(path)
