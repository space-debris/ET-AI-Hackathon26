# Data Directory
This directory contains:
- `sample_cams.pdf` — Synthetic CAMS statement for testing (Abhishek)
- `generate_dummy_cams_statement.py` — ReportLab generator for a richer judge-scenario CAS (6 funds, 4 AMCs, overlap notes)
- `sample_cams_detailed.pdf` — Generated output of `generate_dummy_cams_statement.py` (create on demand)
- `fund_factsheets/` — Fund factsheet documents for ChromaDB RAG indexing (Abhishek)
- `chromadb/` — ChromaDB persistent storage (auto-generated, gitignored)

Generate detailed sample:
- `python data/generate_dummy_cams_statement.py`
- Requires: `reportlab` (`pip install reportlab`)

Recommended Track 9 demo inputs:
- `sample_cams_detailed.pdf` — best default for a compact, parser-friendly walkthrough that still shows overlap, XIRR, expense drag, and six funds
- `sample_cams_aggressive.pdf`, `sample_cams_moderate.pdf`, `sample_cams_conservative.pdf` — useful persona variants, but not ideal for overlap demos because they currently cover fewer funds
- `master_cams_statement.pdf` — best "full" demo statement once available locally, because it exercises the same six-fund Scenario C analytics at larger scale
