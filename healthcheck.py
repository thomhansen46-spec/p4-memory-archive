import re, subprocess, sys
from pathlib import Path

ROOT = Path.home() / "p4-memory-archive"
HTML = ROOT / "public/dashboard.html"
ROUTES_DIR = ROOT / "src/routes"

html = HTML.read_text()
errors = []
warnings = []

print("=" * 60)
print("P4 PLATFORM HEALTH CHECK")
print("=" * 60)

# ── 1. JS element IDs referenced but not in HTML ──────────────
print("\n[1] Checking JS getElementById refs vs HTML ids...")
js_refs = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", html)
html_ids = re.findall(r'\bid=["\']([^"\']+)["\']', html)
html_ids_set = set(html_ids)
missing_ids = []
for ref in set(js_refs):
    if ref not in html_ids_set:
        missing_ids.append(ref)
if missing_ids:
    for m in sorted(missing_ids):
        errors.append(f"MISSING ID: #{m} referenced in JS but not found in HTML")
        print(f"  ❌ #{m} — referenced in JS but not in HTML")
        print(f"     FIX: Add <div id=\"{m}\"></div> to HTML, or remove the JS reference")
else:
    print("  ✅ All getElementById refs have matching HTML ids")

# ── 2. API fetch paths vs registered routes ───────────────────
print("\n[2] Checking API fetch paths vs registered routes...")
fetch_paths = set(re.findall(r"apiFetch\(['\"]([^'\"]+)['\"]\)", html))
route_paths = set()
for f in ROUTES_DIR.glob("*.js"):
    if ".bak" in f.name: continue
    txt = f.read_text()
    found = re.findall(r"app\.(get|post|put|delete)\(['\"]([^'\"]+)['\"]", txt)
    for method, path in found:
        route_paths.add(path)

for path in sorted(fetch_paths):
    if path not in route_paths:
        errors.append(f"MISSING ROUTE: {path} fetched in JS but no matching route")
        print(f"  ❌ {path} — no matching route registered")
        print(f"     FIX: Add app.get('{path}', ...) to a routes file")
    else:
        print(f"  ✅ {path}")

# ── 3. ECharts div height check ───────────────────────────────
print("\n[3] Checking ECharts chart divs for explicit height...")
chart_divs = re.findall(r'<div[^>]+id="([^"]*[Cc]hart[^"]*)"([^>]*)>', html)
for div_id, attrs in chart_divs:
    if "height" not in attrs:
        warnings.append(f"CHART DIV: #{div_id} has no explicit height — may render at 0px")
        print(f"  ⚠️  #{div_id} — no height set, may render blank")
        print(f"     FIX: Add style=\"height:300px;width:100%\" to the div")
    else:
        print(f"  ✅ #{div_id}")

# ── 4. Panel IDs vs tab data-tab values ───────────────────────
print("\n[4] Checking tab data-tab values vs panel ids...")
tabs = re.findall(r'data-tab=["\']([^"\']+)["\']', html)
panels = re.findall(r'id=["\']panel-([^"\']+)["\']', html)
panels_set = set(panels)
for tab in tabs:
    if tab not in panels_set:
        errors.append(f"MISSING PANEL: tab data-tab=\"{tab}\" has no matching panel-{tab} div")
        print(f"  ❌ {tab} — no matching panel-{tab} div")
        print(f"     FIX: Add <div class=\"panel\" id=\"panel-{tab}\">...</div>")
    else:
        print(f"  ✅ panel-{tab}")

# ── 5. JS syntax check ────────────────────────────────────────
print("\n[5] Checking JS syntax...")
script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
if script_match:
    js = script_match.group(1)
    tmp = Path("/tmp/p4_check.js")
    tmp.write_text(js)
    result = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    if result.returncode != 0:
        msg = result.stderr.strip()
        errors.append(f"JS SYNTAX ERROR: {msg}")
        print(f"  ❌ {msg}")
        line_match = re.search(r':(\d+)', msg)
        if line_match:
            line_num = int(line_match.group(1))
            js_lines = js.split('\n')
            if line_num <= len(js_lines):
                print(f"     LINE {line_num}: {js_lines[line_num-1].strip()}")
        print(f"     FIX: Check for unclosed braces/brackets near the line above")
    else:
        print("  ✅ No syntax errors")

# ── Summary ───────────────────────────────────────────────────
print("\n" + "=" * 60)
if errors:
    print(f"❌ {len(errors)} ERROR(S) FOUND — platform likely broken")
    for e in errors:
        print(f"   • {e}")
else:
    print("✅ NO ERRORS — platform looks healthy")
if warnings:
    print(f"⚠️  {len(warnings)} WARNING(S)")
    for w in warnings:
        print(f"   • {w}")
print("=" * 60)
