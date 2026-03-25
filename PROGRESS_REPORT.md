# FinSage AI — Progress Review & Code Report

> **Updated**: March 25, 2026, 11:24 PM IST | **Days Remaining**: 3

---

## Overall Progress: ~65%

| Module | Owner | Status | Notes |
|---|---|---|---|
| Shared Schemas | Mayur | ✅ 100% | 502 lines, all Pydantic contracts |
| Config | Mayur | ✅ 100% | Tax slabs, SEBI constants, FIRE defaults |
| Prompt Templates | Mayur | ✅ 100% | advisory_system, fire_planner, tax_optimizer |
| Advisory Agent | Mayur | ✅ 100% | 878 lines — rebalancing, FIRE, tax, health score |
| Compliance Agent | Mayur | ✅ 100% | 388 lines — regex scanning, no LLM needed |
| **Orchestrator** | Mayur | **✅ 100%** | 415 lines — LangGraph StateGraph pipeline |
| Parser Agent | Abhishek | ✅ 95% | PDF parsing via pdfplumber + camelot fallback |
| Analytics Agent | Abhishek | ✅ 85% | XIRR, overlap, category allocation done. Expense ratios need real data |
| XIRR Calculator | Abhishek | ✅ 100% | Dual solver (Newton + Brentq) |
| Overlap Detector | Abhishek | ✅ 100% | Stock-level overlap, weighted exposure |
| Fund Fetcher | Abhishek | ✅ 100% | Live NAV via mftool |
| Sample CAMS PDF | Abhishek | ✅ 100% | 6 funds, 4 AMCs, ReportLab-generated |
| **Merge** | Mayur | **✅ Done** | Abhishek's branch merged into `orchestration` |
| Tests | Both | 🟡 50% | Abhishek's 3 tests pass; Advisory tests in progress |
| Frontend | Ayush | 🟡 10% | App skeleton only |
| Docker | Mayur | 🔴 0% | — |

---

## What Was Done (Day 1 — Late Evening Session)

### Session 1-3 (Earlier Today)
1. Built all prompt templates (`advisory_system.txt`, `fire_planner.txt`, `tax_optimizer.txt`)
2. Built `advisory_agent.py` (878 lines) — LLM-powered + deterministic tax math
3. Built `compliance_agent.py` (388 lines) — regex-based SEBI compliance scanning
4. Built `orchestrator.py` (415 lines) — LangGraph StateGraph pipeline with conditional routing
5. Fixed Pydantic 2.12 `date: date` field name clash → `DateType`
6. Cleaned `requirements.txt` (removed torch-pulling deps)
7. Set up clean `.venv`, verified all 4 module imports

### Session 4 (This Session)
8. Reviewed Abhishek's `abhishek-analytics` branch (7 files)
9. Merged Abhishek's code into `orchestration` branch
10. Writing advisory agent unit tests (tax math, HRA, slab rates)

---

## Abhishek's Branch Review (`abhishek-analytics`)

**Quality: ✅ Good** — well-structured, follows shared contracts, proper docstrings.

**Minor Issues:**
- 🔴 Deleted our `advisory_agent.py` (accidental) — restored during merge
- `expense_ratio` hardcoded to 0.0, `top_holdings` left empty → overlap/expense drag returns zero without factsheet data
- `_infer_amc()` takes first word of fund name — fragile but OK for hackathon

---

## Bugs Fixed

1. **Pydantic 2.12 crash**: `date: date` field name clashed with type → fixed to `DateType`
2. **Bloated venv**: `requirements.txt` had torch-pulling deps → commented out, fresh `.venv`
3. **Orchestrator syntax**: Garbage text in `get_graph_visualization()` → cleaned

---

## Data Sources

| Data | Source | How |
|---|---|---|
| Portfolio transactions | **User uploads** CAMS PDF | Parser Agent extracts |
| Financial profile | **User fills form** (age, income, tax details) | Streamlit sidebar |
| Live NAV | **mftool API** (auto) | fund_fetcher.py |
| Tax slabs | **Hardcoded** in config.py | FY 2025-26 |
| SEBI compliance | **Hardcoded** banned phrases + regex | No external data |

---

## Next Steps (Day 2)
1. ✅ ~~Merge Abhishek's branch~~ → Done
2. 🔄 Write advisory agent tests (tax math, HRA, slab rates) — in progress
3. Integration test: full pipeline with sample CAMS PDF
4. Frontend work with Ayush
5. Docker + README
