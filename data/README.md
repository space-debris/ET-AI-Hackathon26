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
