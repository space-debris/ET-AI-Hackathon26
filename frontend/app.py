"""
FinSage AI — Streamlit Frontend (Ayush)
=========================================
Stripe-inspired dark fintech dashboard with glassmorphism,
KPI cards, transactions table, AI insights, and report preview/download.

Run: streamlit run frontend/app.py
Owner: Ayush
"""

import streamlit as st
from datetime import date

# ── Page Config (MUST be first Streamlit call) ─────────────────────────────
st.set_page_config(
    page_title="FinSage AI — Financial X-Ray",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Imports ────────────────────────────────────────────────────────────────
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.schemas import (
    PortfolioAnalytics, FundHolding, StockHolding, FundCategory, PlanType,
    UserFinancialProfile, RiskProfile, AdvisoryReport, FinalReport,
    RebalancingAction, RebalancingActionType, FIREPlan, FIREMilestone,
    TaxRegimeComparison, TaxStep, TaxInstrumentSuggestion,
    HealthScoreDimension,
)
from frontend.components.portfolio_charts import (
    render_portfolio_summary, render_allocation_pie, render_xirr_bar,
    render_overlap_heatmap, render_rebalancing_table,
)
from frontend.components.fire_planner_ui import render_fire_planner
from frontend.components.health_score_ui import render_health_score
from frontend.utils.report_generator import generate_pdf


import html as html_mod

def _esc(text):
    """HTML-escape dynamic text."""
    return html_mod.escape(str(text)) if text else ""


# =============================================================================
# Dark Theme CSS
# =============================================================================

def _get_theme_css() -> str:
    """Returns dark theme CSS for the application."""
    css_body = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    :root {
        --bg-primary: #0E1117; --bg-secondary: #12161E;
        --sidebar-bg: linear-gradient(180deg, #12161E, #0E1117);
        --sidebar-border: rgba(255,255,255,0.04);
        --card-bg: rgba(255,255,255,0.03); --card-border: rgba(255,255,255,0.05);
        --card-hover-bg: rgba(255,255,255,0.05); --card-hover-border: rgba(99,91,255,0.15);
        --text-primary: #E8ECF1; --text-secondary: #C1C8D4; --text-muted: #8A94A6;
        --divider: rgba(255,255,255,0.05); --header-border: rgba(255,255,255,0.04);
        --tab-bg: rgba(255,255,255,0.02); --tab-border: rgba(255,255,255,0.04);
        --tab-active-bg: rgba(99,91,255,0.1);
        --insight-hover-bg: rgba(255,255,255,0.045); --insight-hover-border: rgba(99,91,255,0.12);
        --report-bg: linear-gradient(135deg, rgba(99,91,255,0.06), rgba(0,212,170,0.03));
        --report-border: rgba(99,91,255,0.1);
        --success-bg: rgba(0,212,170,0.08); --success-border: rgba(0,212,170,0.15);
        --tax-step-bg: rgba(255,255,255,0.02); --tax-step-border: rgba(255,255,255,0.03);
        --footer-text: #555B6E;
        --chip-bg: rgba(255,255,255,0.03); --chip-border: rgba(255,255,255,0.05);
        --gradient-line: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
        --expander-bg: rgba(255,255,255,0.025); --expander-border: rgba(255,255,255,0.04);
    }

    .stApp {
        background: var(--bg-primary);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: var(--text-secondary);
    }
    [data-testid="stMainBlockContainer"] { max-width: 1280px; }

    section[data-testid="stSidebar"] {
        background: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-border);
    }
    section[data-testid="stSidebar"] .stMarkdown h1,
    section[data-testid="stSidebar"] .stMarkdown h2,
    section[data-testid="stSidebar"] .stMarkdown h3 { color: var(--text-primary); }

    /* ── Top Header Bar ────────────────────────────────── */
    .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0 24px;
        border-bottom: 1px solid var(--header-border);
        margin-bottom: 28px;
    }
    .header-brand {
        display: flex;
        align-items: center;
        gap: 14px;
    }
    .header-brand h1 {
        font-size: 1.65em;
        font-weight: 800;
        background: linear-gradient(135deg, #635BFF 0%, #00D4AA 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        letter-spacing: -0.5px;
    }
    .header-brand .version-badge {
        background: rgba(99,91,255,0.12);
        color: #635BFF;
        font-size: 0.7em;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 20px;
        border: 1px solid rgba(99,91,255,0.2);
    }
    .header-right {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .header-btn {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 10px;
        padding: 8px 14px;
        color: var(--text-muted);
        font-size: 0.85em;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .header-btn:hover { background: var(--card-hover-bg); color: var(--text-primary); }
    .user-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #635BFF, #00D4AA);
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; color: #fff; font-size: 0.85em;
    }

    /* ── KPI Cards ─────────────────────────────────────── */
    .kpi-card {
        background: var(--card-bg); border: 1px solid var(--card-border);
        border-radius: 16px; padding: 22px 20px 18px;
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        transition: all 0.2s ease; position: relative; overflow: hidden;
    }
    .kpi-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: var(--gradient-line);
    }
    .kpi-card:hover {
        background: var(--card-hover-bg); border-color: var(--card-hover-border);
        transform: translateY(-2px);
    }
    .kpi-label {
        color: var(--text-muted); font-size: 0.78em; font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
    }
    .kpi-value {
        color: var(--text-primary); font-size: 1.55em; font-weight: 700; letter-spacing: -0.3px;
    }
    .kpi-delta { font-size: 0.82em; font-weight: 600; margin-top: 6px; }

    /* ── Section Headers ───────────────────────────────── */
    .section-header {
        margin-bottom: 20px; padding-bottom: 14px;
        border-bottom: 1px solid var(--divider);
    }
    .section-header h2 {
        color: var(--text-primary); font-size: 1.35em; font-weight: 700;
        margin-bottom: 4px; letter-spacing: -0.3px;
    }
    .section-header p { color: var(--text-muted); font-size: 0.88em; margin: 0; }

    /* ── Transaction Rows ──────────────────────────────── */
    .txn-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px 20px; background: var(--card-bg);
        border: 1px solid var(--card-border); border-radius: 12px;
        margin-bottom: 8px; transition: all 0.15s ease;
    }
    .txn-row:hover { background: var(--card-hover-bg); border-color: var(--card-hover-border); }
    .txn-icon {
        width: 38px; height: 38px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1em; font-weight: 700;
    }
    .txn-name { color: var(--text-primary); font-weight: 600; font-size: 0.92em; }
    .txn-detail { color: var(--text-muted); font-size: 0.82em; margin-top: 2px; }
    .status-badge {
        padding: 4px 12px; border-radius: 20px; font-size: 0.72em;
        font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
    }

    /* ── Insight Cards (AI) ────────────────────────────── */
    .insight-card {
        background: var(--card-bg); border: 1px solid var(--card-border);
        border-radius: 12px; padding: 18px 20px; margin-bottom: 10px;
        display: flex; align-items: flex-start; gap: 12px; transition: all 0.15s ease;
    }
    .insight-card:hover { background: var(--insight-hover-bg); border-color: var(--insight-hover-border); }

    /* ── Report Preview Module ─────────────────────────── */
    .report-module {
        background: var(--report-bg); border: 1px solid var(--report-border);
        border-radius: 16px; padding: 28px; margin-top: 8px;
    }
    .report-module h3 { color: var(--text-primary); font-size: 1.1em; font-weight: 700; margin-bottom: 12px; }
    .report-success {
        background: var(--success-bg); border: 1px solid var(--success-border);
        border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
        display: flex; align-items: center; gap: 10px; color: #00D4AA; font-weight: 500;
    }

    /* ── Tax Cards ──────────────────────────────────────── */
    .tax-card {
        background: var(--card-bg); border: 1px solid var(--card-border);
        border-radius: 16px; padding: 24px; text-align: center; backdrop-filter: blur(20px);
    }
    .tax-card h3 { color: var(--text-primary); margin-bottom: 8px; font-size: 1em; }
    .tax-amount { font-size: 2em; font-weight: 800; margin: 8px 0; letter-spacing: -0.5px; }
    .tax-step {
        background: var(--tax-step-bg); border: 1px solid var(--tax-step-border);
        border-radius: 10px; padding: 10px 14px; margin: 5px 0;
        display: flex; justify-content: space-between; align-items: center; font-size: 0.88em;
    }

    /* ── Dividers ──────────────────────────────────────── */
    .stripe-divider { height: 1px; background: var(--gradient-line); margin: 28px 0; }
    .chip {
        background: var(--chip-bg); border: 1px solid var(--chip-border);
        border-radius: 8px; padding: 8px 12px; margin: 4px 0; font-size: 0.85em;
    }

    /* ── Tabs ──────────────────────────────────────────── */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0; background: var(--tab-bg); border-radius: 12px;
        padding: 4px; border: 1px solid var(--tab-border);
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 10px; padding: 10px 22px; color: var(--text-muted);
        font-weight: 500; font-size: 0.9em;
    }
    .stTabs [aria-selected="true"] { background: var(--tab-active-bg); color: var(--text-primary); }

    /* ── Buttons ───────────────────────────────────────── */
    .stButton > button {
        background: linear-gradient(135deg, #635BFF 0%, #5851EA 100%);
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 10px 24px;
        font-weight: 600;
        font-size: 0.9em;
        transition: all 0.15s ease;
        box-shadow: 0 2px 8px rgba(99,91,255,0.2);
    }
    .stButton > button:hover {
        background: linear-gradient(135deg, #5851EA 0%, #4A44D4 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(99,91,255,0.35);
    }

    /* ── Download Button ──────────────────────────────── */
    .stDownloadButton > button {
        background: linear-gradient(135deg, #635BFF 0%, #00D4AA 100%);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.95em;
        padding: 12px 28px;
        box-shadow: 0 2px 12px rgba(99,91,255,0.25);
        transition: all 0.15s ease;
    }
    .stDownloadButton > button:hover {
        box-shadow: 0 4px 20px rgba(99,91,255,0.4);
        transform: translateY(-1px);
    }

    /* ── Expanders ─────────────────────────────────────── */
    .streamlit-expanderHeader {
        background: var(--expander-bg); border-radius: 10px;
        border: 1px solid var(--expander-border); color: var(--text-secondary);
    }

    /* ── File Uploader ─────────────────────────────────── */
    [data-testid="stFileUploader"] {
        border-radius: 12px;
    }

    /* ── Slider ────────────────────────────────────────── */
    .stSlider > div > div > div { background: #635BFF; }

    /* ── Footer ────────────────────────────────────────── */
    .app-footer {
        margin-top: 48px; padding: 24px 0;
        border-top: 1px solid var(--divider); text-align: center;
    }
    .app-footer p {
        color: var(--footer-text); font-size: 0.72em;
        max-width: 800px; margin: 0 auto; line-height: 1.6;
    }
</style>
"""
    return css_body

# =============================================================================
# Mock Data
# =============================================================================

def _get_mock_analytics() -> PortfolioAnalytics:
    return PortfolioAnalytics(
        holdings=[
            FundHolding(
                fund_name="HDFC Mid-Cap Opp Fund", isin="INF179K01BB2", amc="HDFC",
                category=FundCategory.MID_CAP, current_value=450000, invested_amount=300000,
                units_held=1154, expense_ratio=0.0180, direct_expense_ratio=0.0045,
                plan_type=PlanType.REGULAR, holding_period_days=730, xirr=0.162,
                top_holdings=[StockHolding(stock_name="Reliance", weight=0.07),
                              StockHolding(stock_name="HDFC Bank", weight=0.06),
                              StockHolding(stock_name="Bajaj Finance", weight=0.04)],
            ),
            FundHolding(
                fund_name="SBI Bluechip Fund", isin="INF200K01450", amc="SBI",
                category=FundCategory.LARGE_CAP, current_value=320000, invested_amount=250000,
                units_held=640, expense_ratio=0.0170, direct_expense_ratio=0.0040,
                plan_type=PlanType.REGULAR, holding_period_days=900, xirr=0.118,
                top_holdings=[StockHolding(stock_name="Reliance", weight=0.08),
                              StockHolding(stock_name="Infosys", weight=0.07),
                              StockHolding(stock_name="TCS", weight=0.05)],
            ),
            FundHolding(
                fund_name="ICICI Pru Multicap Fund", isin="INF109K01AZ1", amc="ICICI",
                category=FundCategory.MULTI_CAP, current_value=280000, invested_amount=220000,
                units_held=520, expense_ratio=0.0195, direct_expense_ratio=0.0055,
                plan_type=PlanType.REGULAR, holding_period_days=540, xirr=0.135,
                top_holdings=[StockHolding(stock_name="Reliance", weight=0.05),
                              StockHolding(stock_name="Infosys", weight=0.06),
                              StockHolding(stock_name="HDFC Bank", weight=0.05)],
            ),
            FundHolding(
                fund_name="Mirae Asset Large Cap", isin="INF769K01AX2", amc="Mirae",
                category=FundCategory.LARGE_CAP, current_value=195000, invested_amount=160000,
                units_held=320, expense_ratio=0.0155, direct_expense_ratio=0.0035,
                plan_type=PlanType.REGULAR, holding_period_days=600, xirr=0.109,
                top_holdings=[StockHolding(stock_name="Infosys", weight=0.08),
                              StockHolding(stock_name="HDFC Bank", weight=0.07)],
            ),
            FundHolding(
                fund_name="Axis ELSS Tax Saver", isin="INF846K01A35", amc="Axis",
                category=FundCategory.ELSS, current_value=150000, invested_amount=130000,
                units_held=280, expense_ratio=0.0165, direct_expense_ratio=0.0050,
                plan_type=PlanType.REGULAR, holding_period_days=1100, xirr=0.098,
                top_holdings=[StockHolding(stock_name="TCS", weight=0.06),
                              StockHolding(stock_name="Bharti Airtel", weight=0.05)],
            ),
            FundHolding(
                fund_name="Parag Parikh Flexi Cap", isin="INF879O01027", amc="PPFAS",
                category=FundCategory.FLEXI_CAP, current_value=380000, invested_amount=280000,
                units_held=680, expense_ratio=0.0163, direct_expense_ratio=0.0058,
                plan_type=PlanType.REGULAR, holding_period_days=800, xirr=0.178,
                top_holdings=[StockHolding(stock_name="Alphabet", weight=0.06),
                              StockHolding(stock_name="Microsoft", weight=0.05),
                              StockHolding(stock_name="Bajaj Holdings", weight=0.04)],
            ),
        ],
        overall_xirr=0.1420,
        fund_wise_xirr={
            "HDFC Mid-Cap Opp Fund": 0.162, "SBI Bluechip Fund": 0.118,
            "ICICI Pru Multicap Fund": 0.135, "Mirae Asset Large Cap": 0.109,
            "Axis ELSS Tax Saver": 0.098, "Parag Parikh Flexi Cap": 0.178,
        },
        overlap_matrix={
            "Reliance": {"HDFC Mid-Cap Opp Fund": 0.07, "SBI Bluechip Fund": 0.08, "ICICI Pru Multicap Fund": 0.05},
            "Infosys": {"SBI Bluechip Fund": 0.07, "ICICI Pru Multicap Fund": 0.06, "Mirae Asset Large Cap": 0.08},
            "HDFC Bank": {"HDFC Mid-Cap Opp Fund": 0.06, "ICICI Pru Multicap Fund": 0.05, "Mirae Asset Large Cap": 0.07},
        },
        expense_ratio_drag_inr=18500,
        total_current_value=1775000,
        total_invested=1340000,
        category_allocation={"Large Cap": 29.0, "Mid Cap": 25.4, "Multi Cap": 15.8, "Flexi Cap": 21.4, "ELSS": 8.4},
        amc_allocation={"HDFC": 25.4, "SBI": 18.0, "ICICI": 15.8, "Mirae": 11.0, "Axis": 8.4, "PPFAS": 21.4},
    )


def _get_mock_report() -> FinalReport:
    milestones = []
    base_eq, base_dt, base_gd = 35000, 10000, 5000
    corpus = 2400000
    for year_offset in range(16):
        yr = 2026 + year_offset
        progress = year_offset / 15
        equity_pct = 70 - progress * 25
        debt_pct = 25 + progress * 20
        gold_pct = 5 + progress * 5
        eq_sip = base_eq * (1 + 0.08 * year_offset)
        dt_sip = base_dt * (1 + 0.10 * year_offset)
        gd_sip = base_gd * (1 + 0.06 * year_offset)
        corpus += (eq_sip + dt_sip + gd_sip) * 12 * 1.10
        for month in [1, 7]:
            milestones.append(FIREMilestone(
                month=month, year=yr,
                equity_sip=round(eq_sip), debt_sip=round(dt_sip), gold_sip=round(gd_sip),
                total_sip=round(eq_sip + dt_sip + gd_sip),
                projected_corpus=round(corpus),
                equity_pct=round(equity_pct, 1), debt_pct=round(debt_pct, 1), gold_pct=round(gold_pct, 1),
            ))

    return FinalReport(
        rebalancing_plan=[
            RebalancingAction(
                fund_name="SBI Bluechip Fund", action=RebalancingActionType.SWITCH,
                percentage=100, target_fund="SBI Bluechip Direct Growth",
                tax_impact="No STCG — held > 1 year. LTCG ~₹8,750 (12.5% on ₹70K gain above ₹1.25L exemption)",
                rationale="Regular plan has 1.3% higher expense ratio than direct. Switching saves ~₹4,160/year.",
                priority=1,
            ),
            RebalancingAction(
                fund_name="ICICI Pru Multicap Fund", action=RebalancingActionType.REDUCE,
                percentage=50, amount_inr=140000,
                tax_impact="STCG applicable — held < 365 days. STCG tax ~₹6,000 on ₹30K gain.",
                rationale="High overlap with SBI Bluechip (Reliance, Infosys, HDFC Bank). Reducing concentration risk.",
                priority=2,
            ),
            RebalancingAction(
                fund_name="Parag Parikh Flexi Cap", action=RebalancingActionType.INCREASE,
                percentage=20, tax_impact="N/A — additional investment",
                rationale="Best risk-adjusted returns (17.8% XIRR) with international diversification. Low overlap.",
                priority=2,
            ),
            RebalancingAction(
                fund_name="HDFC Mid-Cap Opp Fund", action=RebalancingActionType.HOLD,
                tax_impact="No action needed",
                rationale="Strong performer (16.2% XIRR). Expense ratio acceptable for mid-cap category.",
                priority=3,
            ),
            RebalancingAction(
                fund_name="Axis ELSS Tax Saver", action=RebalancingActionType.HOLD,
                tax_impact="ELSS lock-in expired",
                rationale="Lowest XIRR (9.8%) but provides 80C tax benefit. Hold for tax efficiency.",
                priority=4,
            ),
        ],
        fire_plan=FIREPlan(
            current_corpus=2400000, target_corpus=45000000,
            years_to_retirement=16, expected_retirement_date="April 2042",
            monthly_sip_required=50000, milestones=milestones,
            insurance_gap={
                "term_life": "Current: ₹0. Recommended: ₹2 Cr. Premium: ~₹12,000/year.",
                "health": "Recommended: ₹10L super top-up. Premium: ~₹5,000/year.",
            },
            assumptions={"inflation_rate": 0.06, "equity_return": 0.12, "debt_return": 0.07,
                         "gold_return": 0.08, "safe_withdrawal_rate": 0.03, "life_expectancy": 85},
            at_current_trajectory="At current ₹35K SIP, target reached by age 58 — 8 years later than goal.",
        ),
        tax_analysis=TaxRegimeComparison(
            gross_income=2400000,
            old_regime_steps=[
                TaxStep(description="Gross Salary", amount=2400000),
                TaxStep(description="Less: Standard Deduction", amount=-75000, section="Std"),
                TaxStep(description="Less: HRA Exemption", amount=-180000, section="HRA"),
                TaxStep(description="Less: Section 80C", amount=-150000, section="80C"),
                TaxStep(description="Less: NPS 80CCD(1B)", amount=-50000, section="80CCD"),
                TaxStep(description="Less: Home Loan Interest", amount=-200000, section="24"),
                TaxStep(description="Less: Health Insurance 80D", amount=-25000, section="80D"),
                TaxStep(description="Taxable Income", amount=1720000),
            ],
            old_taxable_income=1720000, old_total_tax=335920,
            new_regime_steps=[
                TaxStep(description="Gross Salary", amount=2400000),
                TaxStep(description="Less: Standard Deduction", amount=-75000, section="Std"),
                TaxStep(description="Taxable Income", amount=2325000),
            ],
            new_taxable_income=2325000, new_total_tax=378300,
            recommended_regime="old", savings_amount=42380,
            missed_deductions=[
                "Section 80E (Education Loan Interest) — not utilized",
                "Section 80G (Donations) — not utilized",
                "Section 80TTA (Savings Interest up to ₹10,000) — not claimed",
            ],
            additional_instruments=[
                TaxInstrumentSuggestion(
                    name="NPS Tier II", section="80CCD(1B)", max_limit=50000,
                    expected_return="10-12%", liquidity="Medium", risk="Medium",
                    rationale="Maximize to ₹50K for extra ₹15K tax saving at 30% slab.",
                ),
                TaxInstrumentSuggestion(
                    name="ELSS (Additional)", section="80C", max_limit=150000,
                    expected_return="12-15%", liquidity="Medium (3yr lock-in)", risk="High",
                    rationale="Best post-tax returns among 80C options if not fully utilized.",
                ),
            ],
        ),
        health_score=[
            HealthScoreDimension(dimension="diversification", score=62,
                                 rationale="6 funds across 5 AMCs, but 3 stocks appear in 3+ funds (15% overlap).",
                                 suggestions=["Reduce ICICI Pru Multicap", "Add debt/international allocation"]),
            HealthScoreDimension(dimension="cost_efficiency", score=45,
                                 rationale="All Regular plans. Avg ER 1.72%. Annual drag ₹18,500 vs Direct.",
                                 suggestions=["Switch to Direct plans", "Consider index funds for large-cap"]),
            HealthScoreDimension(dimension="tax_efficiency", score=71,
                                 rationale="ELSS provides 80C benefit. Most holdings long-term (no STCG).",
                                 suggestions=["Maximize NPS for 80CCD(1B)", "Claim Section 80TTA"]),
            HealthScoreDimension(dimension="risk_alignment", score=78,
                                 rationale="100% equity aligns with moderate profile at age 34, 16 yrs to retirement.",
                                 suggestions=["Add 10-15% debt", "Consider 5% gold allocation"]),
            HealthScoreDimension(dimension="goal_readiness", score=55,
                                 rationale="₹24L corpus vs ₹4.5 Cr target. ₹35K SIP needs increase to ₹50K.",
                                 suggestions=["Increase SIP by ₹15K/month", "Step-up SIP 10% annually"]),
            HealthScoreDimension(dimension="liquidity", score=82,
                                 rationale="All equity MF holdings liquid (T+2). No lock-in except ELSS (expired).",
                                 suggestions=["Maintain 3-6 months expenses in liquid fund"]),
        ],
        compliance_cleared=True,
        disclaimer=(
            "This analysis is generated by an AI system for educational and informational purposes only. "
            "It does NOT constitute financial advice. Consult a SEBI-registered investment advisor. "
            "Past performance does not guarantee future results. MF investments are subject to market risks."
        ),
        flagged_items=[],
        audit_trail=[
            "[Parser] Extracted 42 transactions from 6 funds across 4 AMCs.",
            "[Analytics] Portfolio XIRR: 14.2%. Detected 3 overlapping stocks.",
            "[Advisory] Rebalancing plan: 5 actions. FIRE: 16 yrs, ₹50K/month SIP.",
            "[Advisory] Tax: Old regime saves ₹42,380. Health score avg: 65.5.",
            "[Compliance] 0 banned phrases. Disclaimers added. Audit complete.",
        ],
    )


# =============================================================================
# Tax Comparison UI
# =============================================================================

def render_tax_analysis(tax: TaxRegimeComparison):
    st.markdown(
        """<div class="section-header">
            <h2>💰 Tax Regime Optimizer</h2>
            <p>Step-by-step comparison — Old vs New regime for FY 2025-26</p>
        </div>""", unsafe_allow_html=True)

    if tax is None:
        st.warning("Fill in tax details and run analysis.")
        return

    winner = tax.recommended_regime.upper()
    savings = tax.savings_amount
    st.markdown(
        f"""<div class="insight-card" style="border-left:3px solid #00D4AA;">
            <span style="font-size:1.3em;">🏆</span>
            <div>
                <strong style="color:#00D4AA; font-size:1.05em;">{winner} REGIME</strong>
                <span style="color:var(--text-secondary);"> saves you </span>
                <strong style="color:#00D4AA; font-size:1.05em;">₹{savings:,.0f}</strong>
            </div>
        </div>""", unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    for col, (label, emoji, taxable, total, steps, is_winner) in [
        (col1, ("Old Regime", "📜", tax.old_taxable_income, tax.old_total_tax, tax.old_regime_steps, tax.recommended_regime == "old")),
        (col2, ("New Regime", "🆕", tax.new_taxable_income, tax.new_total_tax, tax.new_regime_steps, tax.recommended_regime == "new")),
    ]:
        color = "#00D4AA" if is_winner else "#FF5C8A"
        with col:
            st.markdown(
                f"""<div class="tax-card" {"style='border-color:rgba(0,212,170,0.2);'" if is_winner else ""}>
                    <h3>{emoji} {label}</h3>
                    <div class="tax-amount" style="color:{color};">₹{total:,.0f}</div>
                    <p style="color:var(--text-muted); font-size:0.82em;">Taxable: ₹{taxable:,.0f}</p>
                </div>""", unsafe_allow_html=True)
            for step in steps:
                sec = f"<span style='color:#635BFF;font-size:0.75em;'>§{step.section}</span>" if step.section else ""
                c = "#FF5C8A" if step.amount < 0 else "var(--text-secondary)"
                st.markdown(
                    f"""<div class="tax-step">
                        <span style="color:var(--text-muted);">{step.description} {sec}</span>
                        <span style="color:{c};font-weight:600;">₹{step.amount:,.0f}</span>
                    </div>""", unsafe_allow_html=True)

    if tax.missed_deductions:
        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
        st.markdown("### ⚠️ Missed Deductions")
        for d in tax.missed_deductions:
            st.markdown(f"- {d}")

    if tax.additional_instruments:
        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
        st.markdown("### 💡 Suggested Tax-Saving Instruments")
        for inst in tax.additional_instruments:
            with st.expander(f"📌 {inst.name} (§{inst.section})", expanded=False):
                ca, cb, cc = st.columns(3)
                ca.metric("Max Limit", f"₹{inst.max_limit:,.0f}")
                cb.metric("Return", inst.expected_return)
                cc.metric("Risk", inst.risk)
                st.markdown(f"**Rationale:** {inst.rationale}")


# =============================================================================
# AI Insights Section
# =============================================================================

def render_ai_insights(report: FinalReport, analytics: PortfolioAnalytics):
    """AI-powered insights cards."""
    st.markdown(
        """<div class="section-header">
            <h2>🤖 AI Insights</h2>
            <p>Intelligent recommendations from the FinSage advisory engine</p>
        </div>""", unsafe_allow_html=True)

    insights = [
        ("💸", "#FF5C8A", "Cost Optimization",
         f"Switching all Regular plans to Direct could save ₹{analytics.expense_ratio_drag_inr:,.0f}/year in expense ratio drag."),
        ("🔄", "#635BFF", "Portfolio Overlap",
         f"{len(analytics.overlap_matrix)} stocks appear across 3+ funds. Reducing ICICI Multicap by 50% lowers concentration risk."),
        ("🎯", "#00D4AA", "FIRE Readiness",
         f"Monthly SIP needs to increase from ₹35K to ₹50K to hit ₹4.5 Cr target by age 50."),
        ("🏛️", "#FFBB38", "Tax Efficiency",
         f"Old regime saves ₹{report.tax_analysis.savings_amount:,.0f}. Section 80TTA (₹10K) and 80G remain unclaimed."),
    ]

    cols = st.columns(2)
    for i, (icon, color, title, text) in enumerate(insights):
        with cols[i % 2]:
            st.markdown(
                f"""<div class="insight-card" style="border-left:3px solid {color};">
                    <div style="font-size:1.3em; line-height:1;">{icon}</div>
                    <div>
                        <div style="color:var(--text-primary); font-weight:600; font-size:0.92em; margin-bottom:4px;">{title}</div>
                        <div style="color:var(--text-muted); font-size:0.85em; line-height:1.5;">{text}</div>
                    </div>
                </div>""", unsafe_allow_html=True)


# =============================================================================
# Report Preview & Download Module
# =============================================================================

def render_report_module(analytics, report):
    """Report preview + download with confirmation UX."""
    st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
    st.markdown(
        """<div class="section-header">
            <h2>📄 Report Center</h2>
            <p>Generate and download your comprehensive financial health report</p>
        </div>""", unsafe_allow_html=True)

    with st.expander("📋 Preview & Download Report", expanded=False):
        st.markdown(
            """<div class="report-module">
                <h3>📊 What's included in your report</h3>
            </div>""", unsafe_allow_html=True)

        report_sections = [
            ("Portfolio Summary", "Fund holdings, allocation, XIRR, expense drag"),
            ("Rebalancing Plan", "Fund-specific actions with tax context"),
            ("FIRE Roadmap", "Month-by-month SIP glidepath and corpus projection"),
            ("Tax Analysis", "Old vs New regime comparison with missed deductions"),
            ("Health Score", "6-dimension assessment with improvement suggestions"),
            ("Compliance", "SEBI disclaimer and audit trail"),
        ]

        for section, desc in report_sections:
            st.markdown(
                f"""<div class="txn-row">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="txn-icon" style="background:rgba(99,91,255,0.1); color:#635BFF;">✓</div>
                        <div>
                            <div class="txn-name">{section}</div>
                            <div class="txn-detail">{desc}</div>
                        </div>
                    </div>
                </div>""", unsafe_allow_html=True)

        st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

        # Success message
        st.markdown(
            """<div class="report-success">
                <span style="font-size:1.2em;">✓</span>
                <span>Report generated successfully — review the sections above, then download below.</span>
            </div>""", unsafe_allow_html=True)

        st.markdown(
            "<p style='color:#8A94A6; font-size:0.85em; margin-bottom:12px;'>"
            "📎 The report will be saved as a PDF file with all sections listed above. "
            "Make sure to review your data before sharing.</p>",
            unsafe_allow_html=True,
        )

        # Generate PDF bytes
        pdf_data = generate_pdf(analytics=analytics, advisory_report=report, final_report=report)
        # Ensure bytes (not bytearray)
        pdf_bytes = bytes(pdf_data) if not isinstance(pdf_data, bytes) else pdf_data

        st.download_button(
            label="⬇️  Download Full Report (PDF)",
            data=pdf_bytes,
            file_name=f"FinSage_Report_{date.today().strftime('%Y%m%d')}.pdf",
            mime="application/pdf",
            use_container_width=True,
        )


# =============================================================================
# Sidebar
# =============================================================================

def render_sidebar():
    with st.sidebar:
        st.markdown(
            """<div style="text-align:center; padding:20px 0 16px;">
                <div style="font-size:1.8em; margin-bottom:6px;">🧠</div>
                <h2 style="color:var(--text-primary); margin:4px 0; font-size:1.2em; font-weight:700;">FinSage AI</h2>
                <p style="color:var(--text-muted); font-size:0.75em;">Personal Financial X-Ray</p>
            </div>""", unsafe_allow_html=True)

        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)

        # Sidebar Nav
        st.markdown("### ⚙️ Navigation")
        st.markdown(
            """<div style="margin-bottom:16px;">
                <div class="txn-row" style="padding:10px 14px; margin-bottom:4px; cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span>📊</span><span class="txn-name" style="font-size:0.85em;">Dashboard</span>
                    </div>
                </div>
                <div class="txn-row" style="padding:10px 14px; margin-bottom:4px; background:rgba(99,91,255,0.06); border-color:rgba(99,91,255,0.12);">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span>🔬</span><span class="txn-name" style="font-size:0.85em;">Analysis</span>
                    </div>
                </div>
                <div class="txn-row" style="padding:10px 14px; margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span>📄</span><span class="txn-name" style="font-size:0.85em;">Reports</span>
                    </div>
                </div>
            </div>""", unsafe_allow_html=True)

        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)

        st.markdown("### 📄 Upload Statement")
        uploaded_file = st.file_uploader("CAMS/KFintech PDF", type=["pdf"], label_visibility="collapsed")

        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)

        st.markdown("### 👤 Profile")
        with st.expander("Basic Info", expanded=True):
            age = st.slider("Age", 18, 80, 34, key="age")
            annual_income = st.number_input("Annual Income (₹)", value=2400000, step=100000, format="%d", key="income")
            monthly_expenses = st.number_input("Monthly Expenses (₹)", value=80000, step=5000, format="%d", key="expenses")

        with st.expander("🔥 FIRE Planning", expanded=True):
            retirement_age = st.slider("Retirement Age", 35, 70, 50, key="ret_age")
            target_monthly = st.number_input("Target Monthly (₹)", value=150000, step=10000, format="%d", key="target")
            risk_profile = st.selectbox("Risk Profile", ["Conservative", "Moderate", "Aggressive"], index=1, key="risk")

        with st.expander("💰 Tax Details", expanded=False):
            base_salary = st.number_input("Base Salary (₹)", value=1800000, step=100000, format="%d", key="sal")
            hra = st.number_input("HRA (₹/yr)", value=360000, step=10000, format="%d", key="hra")
            sec80c = st.number_input("80C (₹)", value=150000, step=10000, format="%d", key="80c")
            nps = st.number_input("NPS (₹)", value=50000, step=10000, format="%d", key="nps")
            home_loan = st.number_input("Home Loan (₹)", value=0, step=10000, format="%d", key="hl")
            medical = st.number_input("80D (₹)", value=25000, step=5000, format="%d", key="80d")

        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
        run_clicked = st.button("🚀 Run Analysis", use_container_width=True, type="primary")

        if run_clicked:
            st.session_state["analysis_run"] = True
            st.session_state["user_profile"] = UserFinancialProfile(
                age=age, annual_income=float(annual_income), monthly_expenses=float(monthly_expenses),
                existing_investments={"MF": 1800000, "PPF": 600000},
                target_retirement_age=retirement_age, target_monthly_corpus=float(target_monthly),
                risk_profile=RiskProfile(risk_profile.lower()),
                base_salary=float(base_salary), hra_received=float(hra),
                section_80c=float(sec80c), nps_contribution=float(nps),
                home_loan_interest=float(home_loan) if home_loan else None,
                medical_insurance_premium=float(medical),
            )

        return uploaded_file


# =============================================================================
# Main App
# =============================================================================

def main():
    st.markdown(_get_theme_css(), unsafe_allow_html=True)
    uploaded_file = render_sidebar()

    # ── Header Bar ────────────────────────────────────────────────────
    st.markdown(
        """<div class="header-bar">
            <div class="header-brand">
                <h1>FinSage AI</h1>
                <span class="version-badge">beta</span>
            </div>
            <div class="header-right">
                <div class="header-btn">🔔</div>
                <div class="header-btn">⚙️ Settings</div>
                <div class="user-avatar">A</div>
            </div>
        </div>""", unsafe_allow_html=True)

    # Load data
    analytics = _get_mock_analytics()
    report = _get_mock_report()

    # ── Tab Navigation ────────────────────────────────────────────────
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📊 Portfolio", "🔄 Rebalancing", "🔥 FIRE Planner", "💰 Tax Optimizer", "🏥 Health Score",
    ])

    with tab1:
        st.markdown(
            """<div class="section-header">
                <h2>📊 Portfolio X-Ray</h2>
                <p>Deep analysis of your mutual fund portfolio performance</p>
            </div>""", unsafe_allow_html=True)
        render_portfolio_summary(analytics)
        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)

        col_l, col_r = st.columns([1, 1])
        with col_l:
            render_allocation_pie(analytics)
        with col_r:
            render_xirr_bar(analytics)

        st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
        render_overlap_heatmap(analytics)

    with tab2:
        st.markdown(
            """<div class="section-header">
                <h2>🔄 Smart Rebalancing</h2>
                <p>Fund-specific recommendations with tax-aware context</p>
            </div>""", unsafe_allow_html=True)
        render_rebalancing_table(report.rebalancing_plan)

    with tab3:
        render_fire_planner(report.fire_plan, st.session_state.get("user_profile"))

    with tab4:
        render_tax_analysis(report.tax_analysis)

    with tab5:
        render_health_score(report.health_score)

    # ── AI Insights ───────────────────────────────────────────────────
    st.markdown("<div class='stripe-divider'></div>", unsafe_allow_html=True)
    render_ai_insights(report, analytics)

    # ── Report Preview & Download ─────────────────────────────────────
    render_report_module(analytics, report)

    # ── Footer ────────────────────────────────────────────────────────
    st.markdown(
        f"""<div class="app-footer">
            <p>{report.disclaimer}</p>
        </div>""", unsafe_allow_html=True)


if __name__ == "__main__":
    main()
