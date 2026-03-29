# 🧠 FinSage AI — Personal Financial X-Ray

> **ET AI Hackathon 2026** (Avataar.ai × Economic Times) — Track 9: AI Money Mentor

![FinSage AI Banner](https://img.shields.io/badge/ET_AI_Hackathon_2026-Track_9-blue?style=for-the-badge&logo=google) ![Gemini Model](https://img.shields.io/badge/Model-Gemini_3.1_Pro_Preview-orange?style=for-the-badge) ![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react) ![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)

---

## 1. Project Overview & The Hackathon Vision

### The Problem We Solve

Indian retail mutual fund investors face three critical pain points:

1. **Opaque Portfolio Health:** CAMS/KFintech statements are dense PDF tables with zero analytical insights. Investors cannot determine true XIRR, gauge stock-level overlap across mutual funds, or spot annual expense drag without arduous manual spreadsheet calculations.
2. **Expensive Advisory Access:** SEBI-registered advisors routinely charge ₹15,000–₹50,000/year. Consequently, most retail investors (holding ₹5–₹50 lakh portfolios) skip professional reviews entirely, relying on flawed intuition.
3. **Fragmented Planning:** FIRE (Financial Independence, Retire Early) planning, tax optimization, and portfolio rebalancing are treated as disparate silos. No unified tool strings them together into a holistic narrative.

### Our Solution: FinSage AI

FinSage AI was engineered specifically for the **ET AI Hackathon 2026** to prove that a **Multi-Agent LLM architecture** can deliver the core value of a SEBI-registered investment advisor: **Portfolio X-ray, intelligent rebalancing, actionable FIRE roadmaps, tax comparisons, and a holistic health score**—all rendered in under 10 seconds, completely free, and safeguarded by strict regulatory guardrails.

### Target Audience

* Indian retail mutual fund investors (Age 25–55) holding 4–15 fund investments.
* Users possessing CAMS or KFintech Consolidated Account Statements (CAS).
* Millennials and Gen Z actively charting their FIRE journey.

### Real-World Use Case

Upload your Consolidated Account Statement PDF -> Fill in a brief financial profile -> **Receive:**
* A fund-specific **rebalancing plan**.
* A month-by-month **SIP roadmap** with dynamic asset allocation.
* An **Old vs. New tax regime comparison** highlighting missed deductions.
* A robust **6-dimension Money Health Score**.
* All recommendations are strictly compliance-cleared with necessary SEBI disclaimers.

---

## 2. Key Features

| Feature | Description | Inner Workings |
|---|---|---|
| **Portfolio X-Ray** | Parses CAMS PDFs to compute true XIRR, stock overlap, and expense drag. | ParserAgent extracts PDF text (pdfplumber / camelot) -> AnalyticsAgent computes XIRR tracking custom cashflows, compares stock metadata for overlap, calculates expense ratio gap. |
| **Smart Rebalancing** | Specific holding actions (HOLD / INCREASE / SWITCH) with tax limits. | AdvisoryAgent processes JSON state to Gemini -> validates output cleanly into Pydantic schemas. Includes deterministic fallbacks. |
| **FIRE Path Planner** | Configurable monthly SIP roadmap adjusting equity/debt glidepath. | Pure Python binary-search calculator iterating exact monthly requirements over simulated investment horizons. |
| **Tax Regime Optimizer** | Step-by-step FY2025-26 tax regime (old vs new) analysis. | Deterministic math applies structural tax slabs -> LLM evaluates best tax saving strategies against the resultant corpus constraints. |
| **Money Health Score** | 6-axis radar evaluating diversification, liquidity, expenses, goal fitness. | Rule-based engine scoring factors like STCG alignment, expense ratio dragging, and liquidity buffering. |
| **SEBI Compliance** | Scans recommendations for disallowed terminology ("guaranteed"). | ComplianceAgent scans and neutralizes 18 banned phrases, applying non-destructive softening rules. |
| **Modern Frontend SPA** | A feature-rich React SPA with interactive data visualizations. | React + Vite leverages Recharts and communicates with our Python HTTP API via secure sessions. |

---

## 3. Tech Stack Deep Dive

### AI & Agent Architecture

*   **LangGraph:** Orchestrates the system as a StateGraph. A sequential typed state engine (Parser -> Analytics -> Advisory -> Compliance) offering conditional runtime routing.
*   **Google Gemini (Gemini 3.1 Pro Preview & Flash Lite):** Powering nuanced narrative generation (rebalancing justification, tax analysis, health context). Fast inference (~2s) with robust JSON structuring.
*   **Pydantic v2:** 500+ lines of robust inter-agent contracts mapping 20 typed models.

### Backend & Analytical Engine

*   **Python http.server:** Custom REST API bridging React to the LangGraph pipeline, bypassing heavy frameworks. (ThreadingHTTPServer)
*   **pandas / 
umpy / scipy:** Powers optimize.newton/rentq for high-reliability XIRR calculations.
*   **pdfplumber & camelot-py:** Precision PDF scraping logic distinguishing transaction headers from metadata.
*   **mftool:** Retrieves real-time NAVs direct from AMFI directories.

### Frontend

*   **React 19 + Vite:** Production-ready Single Page Application (SPA), styled with TailwindCSS v4 and animated with Framer Motion and Recharts.

---

## 4. System Architecture

FinSage utilizes a **Sequential Multi-Agent Pipeline**. Every agent executes within process limits, appending data asynchronously to a centralized, strictly-typed Pydantic state (PipelineState).
![Untitled Diagram](https://github.com/user-attachments/assets/9de21756-ce9c-4dd0-a0e7-c81c202ced76)

**State Continuity:** The backend caches session responses across HTTP boundaries (using custom X-Session-Id), allowing UI transitions between FIRE modeling and Rebalancing sections without redundant LLM calls.

---

## 5. Security & Compliance

*   **PII Anonymization:** In-memory runtime isolates uploaded PDFs. Temp files are expunged post-processing.
*   **Regulatory Fencing:** The ComplianceAgent uses a regex engine to scan and throttle the LLM. It intercepts "you must buy" and rewrites it to "you may consider", subsequently injecting RBI/SEBI/AMFI educational disclaimers.

---

## 6. Setup & Execution

### Prerequisites
- Python 3.11+
- Node.js 18+ (for the React UX)
- Google Gemini API Key

### Backend Setup

```ash
# Clone and prepare virtual environment
git clone https://github.com/space-debris/ET-AI-Hackathon26.git
cd ET-AI-Hackathon26
python -m venv venv

# Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Secure your keys
cp .env.example .env
# Edit .env and insert GEMINI_API_KEY
```

### Starting the Application

**Run Full Stack (React + API)**
```ash
# Terminal 1 - Start Python API Server (Serves React Data logic)
python scripts/run_api_server.py
# API runs on port 8000

# Terminal 2 - Start React Client
cd react
npm install
npm run dev
# Dashboard at http://localhost:5173
```

---

## 7. The Team

| Member | Focus | Area / Branch |
| :--- | :--- | :--- |
| ****Mayur** | Orchestration, Advisory & Compliance, Architecture | orchestration |
| ****Abhishek** | PDF Parsing, XIRR Engine, AMFI integrations | analytics |
| ****Ayush** | React SPA, FIRE Modeler Flow | frontend |

---

## 8. Impact & Future Scalability

| Metric | Traditional Model | FinSage AI |
|---|---|---|
| **Turnaround Time** | 3 - 5 Days | **< 10 seconds** |
| **Cost** | ₹25,000+ per year | **Free** |
| **Compliance Overhead** | Human audit dependent | **100% Automated regex pass** |

### Next Steps Beyond Hackathon
- Vector Database integration (ChromaDB) dynamically fetching live AMC factsheets.
- Direct execution linkages targeting BSE StAR MF to action the recommended rebalancing switches.
- Persistent user history stores migrating to PostgreSQL for longitudinal portfolio tracking.

---

**Disclaimer:** Built for the ET AI Hackathon 2026. This system evaluates financial parameters strictly for educational simulation and should not precede the consultation of a registered SEBI planner.

---
