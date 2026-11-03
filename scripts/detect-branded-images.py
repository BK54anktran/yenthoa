#!/usr/bin/env python3
"""OCR every imported image and list the ones that still carry the source company's branding
(logo text, hotline, email burned into the pixels). Output: JSON list of paths relative to
public/sites/hungphat/img, consumed by `import-hoangkim.mjs transform`.

  python3 -m venv .venv && .venv/bin/pip install rapidocr-onnxruntime pillow
  .venv/bin/python scripts/detect-branded-images.py OUT.json
"""
import json, os, re, sys
from multiprocessing import Pool

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "sites", "hungphat", "img")
# "Hoang Kim" logo text, the hotline and the company e-mail / site name
PATTERN = re.compile(r"ho[aà]?ng\s*k[il1]m|0937|012[\s.]?012|hethongxemay|xemayhoang|hungthanhdat", re.I)
_ocr = None


def scan(rel):
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    try:
        result, _ = _ocr(os.path.join(ROOT, rel))
    except Exception as e:  # unreadable image: keep it, report on stderr
        print("ocr failed", rel, e, file=sys.stderr)
        return rel, False
    text = " ".join(r[1] for r in (result or []))
    return rel, bool(PATTERN.search(text))


if __name__ == "__main__":
    out = sys.argv[1]
    files = sorted(
        os.path.relpath(os.path.join(d, f), ROOT)
        for d, _, fs in os.walk(ROOT) for f in fs if f.endswith(".webp")
    )
    flagged = []
    with Pool(int(os.environ.get("OCR_PROCS", os.cpu_count() or 2))) as pool:
        for i, (rel, bad) in enumerate(pool.imap_unordered(scan, files, chunksize=8), 1):
            if bad:
                flagged.append(rel)
            if i % 200 == 0:
                print(f"{i}/{len(files)} flagged={len(flagged)}", flush=True)
                json.dump(sorted(flagged), open(out, "w"))
    json.dump(sorted(flagged), open(out, "w"))
    print(f"done: {len(flagged)} of {len(files)} images flagged", flush=True)
