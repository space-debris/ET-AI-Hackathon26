# 🧠 FinSage AI — Personal Financial X-Ray

> **ET AI Hackathon 2026** (Avataar.ai × Economic Times) — Track 9: AI Money Mentor

A multi-agent AI system that transforms a CAMS/KFintech mutual fund statement into a comprehensive financial health report with specific, actionable, tax-aware recommendations.

---

## 🚀 What It Does

| Feature | Description |
|---|---|
| **Portfolio X-Ray** | Parses CAMS PDF → calculates true XIRR, detects fund overlap, measures expense ratio drag |
| **Smart Rebalancing** | Fund-specific recommendations (not vague "reduce large-cap") with STCG-aware tax context |
| **FIRE Path Planner** | Month-by-month SIP roadmap with asset allocation glidepath, dynamically updates on input change |
| **Tax Regime Optimizer** | Step-by-step old vs new regime comparison with missed deduction identification |
| **Money Health Score** | 6-dimension radar: diversification, cost efficiency, tax efficiency, risk alignment, goal readiness, liquidity |
| **SEBI Compliance** | Every recommendation passes regulatory guardrails — no unlicensed financial advice |

---

## 🏗️ Architecture

```
User Input (PDF / Manual Data)
        ↓
[Agent 1: Parser]        → Extract transactions from CAMS PDF
        ↓
[Agent 2: Analytics]     → XIRR, overlap, expense ratio drag
        ↓
[Agent 3: Advisory]      → Rebalancing + FIRE Plan + Tax Analysis + Health Score
        ↓
[Agent 4: Compliance]    → SEBI guardrails + disclaimers
        ↓
[Streamlit Frontend]     → Interactive dashboard + PDF download
```

**Orchestrated by**: LangGraph `StateGraph` with typed state, error recovery, and audit trail at every step.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Agent Framework | LangGraph (sequential multi-agent pipeline) |
| LLM | Google Gemini 1.5 Flash (fast, financially capable) |
| PDF Parsing | pdfplumber + camelot-py |
| Financial Math | scipy (XIRR), pandas, numpy |
| Fund Data | mftool (live NAV, no API key) |
| Vector DB | ChromaDB (RAG on fund factsheets) |
| Frontend | Streamlit + Plotly |
| Deployment | Docker + docker-compose |

---

## 📁 Project Structure

```
finsage-ai/
├── agents/
│   ├── orchestrator.py          # LangGraph StateGraph pipeline
│   ├── parser_agent.py          # CAMS PDF parsing
│   ├── analytics_agent.py       # XIRR, overlap, expense analysis
│   ├── advisory_agent.py        # LLM-powered recommendations
│   └── compliance_agent.py      # SEBI regulatory guardrails
├── shared/
│   ├── schemas.py               # Pydantic models (inter-agent contracts)
│   └── config.py                # API keys, constants, tax slabs
├── prompts/
│   ├── advisory_system.txt      # Advisory agent system prompt
│   ├── fire_planner.txt         # FIRE planning prompt template
│   └── tax_optimizer.txt        # Tax regime comparison prompt
├── utils/
│   ├── xirr_calculator.py       # XIRR via scipy
│   ├── overlap_detector.py      # Stock-level overlap detection
│   └── fund_fetcher.py          # mftool wrapper
├── frontend/
│   ├── app.py                   # Main Streamlit app
│   ├── components/              # UI components (charts, FIRE, health score)
│   └── utils/                   # PDF report generator
├── data/                        # Sample PDFs + fund factsheets
├── tests/                       # Unit tests
├── architecture/                # Architecture docs + diagrams
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.11+
- Google Gemini API key ([Get one free](https://aistudio.google.com/apikey))

### Setup
```bash
# Clone the repository
git clone https://github.com/space-debris/ET-AI-Hackathon26.git
cd ET-AI-Hackathon26

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the application
streamlit run frontend/app.py
```

### Docker
```bash
docker-compose up --build
# Access at http://localhost:8501
```

---

## 📊 Impact Quantification

| Metric | Before (Manual) | After (FinSage AI) |
|---|---|---|
| Analysis Time | 3-4 hours | < 10 seconds |
| Annual Advisor Cost | ₹25,000+ | ₹0 |
| Tax Optimization | Often missed | Automated detection |
| Addressable Market | — | ₹3,500 crore |
| Portfolio Reviews/Year | 1-2 (manual) | Unlimited (on-demand) |

---

## 👥 Team

| Member | Role | Branch |
|---|---|---|
| **Mayur** | Orchestration + Advisory + Compliance + Architecture | `orchestration` |
| **Abhishek** | Parser + Analytics + XIRR + Overlap + Fund Data | `analytics` |
| **Ayush** | Streamlit Frontend + Charts + FIRE UI + PDF Report | `frontend` |

---

## 📜 Compliance

All recommendations are processed through a compliance layer that:
- Scans for language constituting licensed financial advice
- Adds SEBI/AMFI/RBI disclaimers
- Softens absolute buy/sell language
- Maintains audit trail for every agent decision

> **Disclaimer**: This system is for educational and informational purposes only. It does not constitute investment advice. Consult a SEBI-registered advisor for personalised financial planning.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
