#!/usr/bin/env python3
"""Download one reference PDF into paper/references/pdf/ and check that it is a PDF.

    python3 paper/scripts/fetch_pdf.py KEY URL

Saves paper/references/pdf/KEY.pdf. Prints the size and the first page count marker,
or why it failed (an HTML page instead of a PDF usually means a login wall).
"""
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "references", "pdf")


def main(key, url):
    os.makedirs(OUT, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (reference download for a citation check)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
            ctype = r.headers.get("Content-Type", "")
    except Exception as e:  # noqa: BLE001
        print(f"{key}: FAILED {e}")
        return 1
    if not data.startswith(b"%PDF"):
        print(f"{key}: NOT A PDF ({ctype}, {len(data)} bytes); probably a login or landing page")
        return 1
    path = os.path.join(OUT, key + ".pdf")
    with open(path, "wb") as f:
        f.write(data)
    print(f"{key}: saved {os.path.relpath(path)} ({len(data) // 1024} KB, {data.count(b'/Type /Page') - data.count(b'/Type /Pages')} pages approx.)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
