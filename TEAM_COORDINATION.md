# FinSage AI — Team Coordination Guide

> **Read this before writing a single line of code.**
> This file defines exactly WHO does WHAT, in what ORDER, and what MUST be done before the next step.
> Deadline: March 29, 2026. Today: March 25, 2026.

---

## Team Branches

| Person | GitHub Branch | Area |
|---|---|---|
| **Mayur** | `orchestration` | LangGraph pipeline, Advisory Agent, Compliance Agent, Docker, README |
| **Abhishek** | `analytics` | Parser Agent, Analytics Agent, XIRR, Overlap, Fund Data, Sample CAMS PDF |
| **Ayush** | `frontend` | Streamlit app, all charts, FIRE planner UI, Health Score, PDF download |

**Shared files** (touch only these to collaborate — everything else is your own branch):
- `shared/schemas.py` — Pydantic models. **Do not modify without team consensus.**
- `shared/config.py` — Constants and config. **Do not modify without team consensus.**
- `requirements.txt` — Add your dependencies here, do not remove others.

---

## Day-by-Day Task Order

### 📅 DAY 1 (March 25) — Foundation + Core Logic

---

#### STEP 1 — ALL THREE (Do this first before anything else)

```
git clone https://github.com/space-debris/ET-AI-Hackathon26.git
cd ET-AI-Hackathon26
cp .env.example .env          # Add your GEMINI_API_KEY in .env
pip install -r requirements.txt
```

Then checkout your branch:
```bash
git checkout -b orchestration   # Mayur
git checkout -b analytics       # Abhishek
git checkout -b frontend        # Ayush
```

Read `IMPLEMENTATION_PLAN.md` fully before starting. It has function signatures for every file.

---

#### STEP 2 — ABHISHEK (Start immediately, Mayur and Ayush are blocked on your output)

> ⚠️ Mayur CANNOT do integration testing until Abhishek finishes `analytics_agent.py`.
> ⚠️ Ayush can work with mock data but needs Abhishek's real output by Day 3.

**File: `utils/xirr_calculator.py`** — Do this FIRST (standalone, no dependencies)
- Implement `calculate_xirr(cashflows: List[Tuple[date, float]]) -> float`
- Use `scipy.optimize.newton` or `scipy.optimize.brentq`
- Test it: feed in known cashflows, verify output against an online XIRR calculator
- Commit when working: `git commit -m "feat: XIRR calculator working"`

**File: `utils/fund_fetcher.py`** — Do this SECOND (standalone)
- Implement `get_fund_nav`, `get_fund_details`, `search_fund` using `mftool`
- Test: `python utils/fund_fetcher.py` should print live NAV for "119551"
- Commit: `git commit -m "feat: mftool fund fetcher working"`

**File: `agents/parser_agent.py`** — Do this THIRD
- Implement `parse_pdf(pdf_path) -> str` using `pdfplumber`
- Implement `extract_transactions(raw_text) -> List[Transaction]` using regex patterns
- You'll need a sample CAMS PDF for testing — create `data/sample_cams.pdf` (synthetic, see DATA REQUIREMENTS section below)
- Commit: `git commit -m "feat: parser agent extracting transactions"`

**File: `utils/overlap_detector.py`** — AFTER parser works
- Implement `detect_overlap(holdings: List[FundHolding]) -> (overlap_matrix, overlap_details)`
- Only flags stocks appearing in 2+ funds
- Commit: `git commit -m "feat: overlap detector working"`

**File: `agents/analytics_agent.py`** — LAST (depends on xirr + overlap + fund_fetcher)
- Implement `calculate_portfolio(transactions) -> PortfolioAnalytics`
- Calls XIRR, overlap, expense ratio drag — assembles into `PortfolioAnalytics` object
- Implement `run(state: dict) -> dict` for LangGraph
- Commit: `git commit -m "feat: analytics agent complete"`

**Data to download (for RAG):**
- Download 6-8 fund factsheet PDFs from AMC websites (see DATA REQUIREMENTS section below)
- Place in `data/fund_factsheets/` folder
- Commit: `git commit -m "data: add fund factsheets for RAG indexing"`

---

#### STEP 2 — AYUSH (Start immediately — fully independent from Abhishek on Day 1)

> You do NOT need Abhishek or Mayur to finish anything before Day 3.
> Use the mock data below to build the full UI today.

**File: `frontend/app.py`** — Start here
- Set up Streamlit app skeleton: page config, sidebar, tabs
- Add PDF upload widget (`st.file_uploader`)
- Add manual financial profile input form in sidebar (all `UserFinancialProfile` fields)
- Wire up a "Run Analysis" button that calls a dummy function for now

**File: `frontend/components/portfolio_charts.py`** — Next
- Build pie chart: fund allocation (current value breakdown)
- Build bar chart: fund-wise XIRR comparison
- Build heatmap: stock overlap matrix
- All charts take a `PortfolioAnalytics` object as input — use `MOCK_ANALYTICS` below

**File: `frontend/components/fire_planner_ui.py`**
- Build input form: retirement age slider, target monthly income, risk profile
- Build timeline visualization: stacked area chart (equity/debt/gold over time)
- **Critical**: use `st.session_state` so changing retirement age updates chart WITHOUT full pipeline re-run

**File: `frontend/components/health_score_ui.py`**
- Build Plotly radar chart for 6 health dimensions
- Each dimension: score 0-100, show rationale on hover

**File: `frontend/utils/report_generator.py`**
- Build PDF download using `fpdf2`
- Contains: portfolio summary, rebalancing table, FIRE roadmap, health score

**Mock data to use (paste this at the top of `app.py` for now):**
```python
from shared.schemas import *
from datetime import date

MOCK_ANALYTICS = PortfolioAnalytics(
    holdings=[
        FundHolding(fund_name="HDFC Mid-Cap Opp Fund", isin="INF179K01BB2",
                    category=FundCategory.MID_CAP, current_value=450000,
                    invested_amount=300000, units_held=1154, expense_ratio=0.0180,
                    direct_expense_ratio=0.0045, plan_type=PlanType.REGULAR,
                    top_holdings=[StockHolding(stock_name="Reliance", weight=0.07),
                                  StockHolding(stock_name="HDFC Bank", weight=0.06)]),
        FundHolding(fund_name="SBI Bluechip Fund", isin="INF200K01450",
                    category=FundCategory.LARGE_CAP, current_value=320000,
                    invested_amount=250000, units_held=640, expense_ratio=0.0170,
                    direct_expense_ratio=0.0040, plan_type=PlanType.REGULAR,
                    top_holdings=[StockHolding(stock_name="Reliance", weight=0.08),
                                  StockHolding(stock_name="Infosys", weight=0.07)]),
    ],
    overall_xirr=0.1420,
    fund_wise_xirr={"HDFC Mid-Cap Opp Fund": 0.162, "SBI Bluechip Fund": 0.118},
    overlap_matrix={"Reliance": {"HDFC Mid-Cap Opp Fund": 0.07, "SBI Bluechip Fund": 0.08}},
    expense_ratio_drag_inr=12600,
    total_current_value=770000,
    total_invested=550000
)
```

---

#### STEP 2 — MAYUR (Start immediately — fully independent on Day 1)

> You do NOT need Abhishek's real agents until Day 2-3 integration.
> Build with mock `PortfolioAnalytics` and `UserFinancialProfile` inputs.

**File: `prompts/advisory_system.txt`** — Start here (no code, just text)

**File: `prompts/fire_planner.txt`** — Next

**File: `prompts/tax_optimizer.txt`** — Next

**File: `agents/advisory_agent.py`** — After prompts are done
- Build each method one at a time: `generate_rebalancing_plan` → `generate_fire_plan` → `generate_tax_analysis` → `generate_health_score`
- Test each method standalone before wiring together
- Commit after each method works

**File: `agents/compliance_agent.py`** — After advisory agent works

**File: `agents/orchestrator.py`** — LAST on Day 2 (depends on all 4 agents having stub `run()` methods)

---

### 📅 DAY 2 (March 26) — Integration

**Order of operations:**
1. Abhishek: PR `analytics` branch → `main`. Mayur pulls main and replaces mock analytics with real agents in orchestrator.
2. Mayur: Wire up orchestrator end-to-end, test full pipeline with Abhishek's real parser + analytics
3. Ayush: PR `frontend` branch → `main`. Replace mock data with live call to `orchestrator.run_pipeline()`

---

### 📅 DAY 3 (March 27) — Scenario Testing

**All three mandatory judge scenarios must pass:**

| Scenario | Who runs it | Input file |
|---|---|---|
| A: FIRE Path Plan | All | Manual input in sidebar |
| B: Tax Regime | All | Manual input in sidebar |
| C: MF X-Ray + Rebalancing | All | `data/sample_cams.pdf` |

Fix any failures together. Coordinate on Slack/WhatsApp.

---

### 📅 DAY 4 (March 28) — Polish + Submission

| Task | Owner |
|---|---|
| Architecture diagram (`architecture/finsage_architecture.png`) | Mayur |
| Docker working (`docker-compose up` → app at localhost:8501) | Mayur |
| Error handling + audit trail logging | Mayur |
| Health Score radar chart final polish | Ayush |
| PDF download button tested | Ayush |
| Dynamic FIRE update (no full re-run) | Ayush |
| ChromaDB indexing + RAG tested | Abhishek |
| All unit tests passing (`pytest tests/`) | Abhishek |
| `requirements.txt` consolidated, repo public | All |
| 3-minute demo video recorded | All |
| Submission form filled | Mayur |

---

## DATA REQUIREMENTS

### 1. Synthetic CAMS PDF (Abhishek creates this)

**You CANNOT use a real person's CAMS statement** — it has PII. Create a synthetic one.

**How**: Use a PDF editor or Python (`fpdf2`) to generate a fake statement with this structure:

```
CONSOLIDATED ACCOUNT STATEMENT
PAN: AAAAA9999A | Email: test@finsage.ai | Mobile: 9999999999

Period: 01-Jan-2022 to 31-Dec-2024

Fund: HDFC Mid-Cap Opportunities Fund - Regular Growth
Folio: 1234567890 | ISIN: INF179K01BB2

Date        | Description      | Amount    | Units   | NAV     | Closing Units
------------|------------------|-----------|---------|---------|---------------
15-Jan-2022 | Purchase - SIP   | 10,000.00 | 35.714  | 280.00  | 35.714
15-Feb-2022 | Purchase - SIP   | 10,000.00 | 33.333  | 300.00  | 69.047
...6 more funds across 4 AMCs...
```

Include these 6 funds for Scenario C testing:
1. HDFC Mid-Cap Opportunities Fund (AMC: HDFC) — has Reliance 7%, HDFC Bank 6%
2. SBI Bluechip Fund (AMC: SBI) — has Reliance 8%, Infosys 7%
3. ICICI Pru Multicap Fund (AMC: ICICI) — has Reliance 5%, Infosys 6%, HDFC Bank 5%
4. Mirae Asset Large Cap Fund (AMC: Mirae) — has Infosys 8%
5. Axis ELSS Tax Saver Fund (AMC: Axis) — older purchase dates (for STCG testing)
6. Parag Parikh Flexi Cap Fund (AMC: PPFAS) — international allocation

**Save as**: `data/sample_cams.pdf`

---

### 2. Fund Factsheet PDFs (Abhishek downloads these)

Download the **latest monthly factsheet** (March 2026) for each of the 6 funds above:

| Fund | Where to Download |
|---|---|
| HDFC Mid-Cap Opportunities | [hdfcfund.com](https://www.hdfcfund.com) → Downloads → Factsheets |
| SBI Bluechip Fund | [sbimf.com](https://www.sbimf.com) → Resources → Factsheets |
| ICICI Pru Multicap | [icicipruamc.com](https://www.icicipruamc.com) → Downloads → Factsheets |
| Mirae Asset Large Cap | [miraeassetmf.co.in](https://www.miraeassetmf.co.in) → Downloads |
| Axis ELSS Tax Saver | [axismf.com](https://www.axismf.com) → Downloads → Factsheets |
| Parag Parikh Flexi Cap | [amc.ppfas.com](https://amc.ppfas.com) → Resources → Factsheets |

**Save all** in `data/fund_factsheets/` as PDFs — ChromaDB will index them at startup.

---

## Git Workflow

```bash
# Your daily flow:
git add -A
git commit -m "feat: [what you built]"
git push origin [your-branch]

# To get latest shared changes (schemas, config):
git fetch origin main
git merge origin/main   # resolve any conflicts

# To submit your work (after Day 2+):
# Open a Pull Request on GitHub: your-branch → main
# Ping Mayur to review and merge
```

**PR checklist before merging:**
- [ ] No hardcoded API keys
- [ ] No real PII data in any test file
- [ ] Your module's placeholder tests pass: `pytest tests/test_[your_module].py`
- [ ] `requirements.txt` updated with your dependencies

---

## Questions? Ping Mayur (orchestration branch owner)
