import fitz, anthropic, requests, re, json, os
from supabase import create_client

ANTHROPIC_KEY = os.environ["ANTHROPIC_API_KEY"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]
MAX_CHARS     = 12000

client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

KEYWORDS = [r"primary endpoint", r"success criterion", r"primary objective",
            r"efficacy endpoint", r"failure mode", r"device.related", r"adverse event"]

PROMPT = """Extract clinical endpoint data from FDA SSED text. Return ONLY valid JSON.
Fields: endpoint, threshold, result, study_name, study_type,
  sample_size_total, sample_size_treatment, sample_size_control,
  p_value, confidence_interval, statistical_approach,
  device_deaths, serious_adverse_events, malfunctions,
  failure_modes, follow_up_duration, enrollment_start, enrollment_end,
  sites_count, countries_count
Text: {text}"""

def fetch_pdf(pma_number):
    url = f"https://www.accessdata.fda.gov/cdrh_docs/pdf/{pma_number.lower()}.pdf"
    r = requests.get(url, timeout=30)
    if r.status_code == 200:
        print(f"   PDF fetched: {len(r.content)/1024:.0f}KB")
        return r.content
    return None

def parse_pdf_text(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)

def extract_endpoint_text(full_text):
    lines = full_text.split("\n")
    relevant, capture, count = [], False, 0
    for line in lines:
        if any(re.search(kw, line.lower()) for kw in KEYWORDS):
            capture, count = True, 0
        if capture:
            relevant.append(line)
            count += 1
            if count > 60:
                capture = False
    return "\n".join(relevant)[:MAX_CHARS]

def extract_with_claude(text, pma_number):
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5", max_tokens=1500,
            messages=[{"role": "user", "content": PROMPT.replace("{text}", text)}]
        )
        return json.loads(msg.content[0].text.strip())
    except Exception as e:
        print(f"   Error: {e}"); return None

def process_pma(pma_number, device_name):
    print(f"-> {pma_number}  {device_name}")
    pdf   = fetch_pdf(pma_number)
    if not pdf: print("   SKIP: not found"); return
    text  = parse_pdf_text(pdf)
    chunk = extract_endpoint_text(text)
    if len(chunk) < 200: print("   SKIP: no endpoint text"); return
    data  = extract_with_claude(chunk, pma_number)
    if not data: return
    supabase.table("endpoint_library").upsert({
        "pma_number": pma_number, "device_name": device_name,
        **data, "p4_proprietary": True, "extraction_method": "pymupdf+haiku"
    }, on_conflict="pma_number").execute()
    print("   Saved  OK")

if __name__ == "__main__":
    process_pma("P130030", "REBEL Stent")
