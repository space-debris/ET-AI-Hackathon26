"""
FinSage AI — Shared Pydantic Schemas
=====================================
Inter-agent data contracts used by all team members.
This file is the SINGLE SOURCE OF TRUTH for all data structures
flowing through the multi-agent pipeline.

Team Contract:
- Mayur: PipelineState, AdvisoryReport, FinalReport, UserFinancialProfile
- Abhishek: Transaction, FundHolding, PortfolioAnalytics
- Ayush: Consumes FinalReport for rendering

DO NOT modify field names without team consensus — breaking change.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import date as DateType
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class TransactionType(str, Enum):
    """Type of mutual fund transaction."""
    PURCHASE = "purchase"
    REDEMPTION = "redemption"
    DIVIDEND = "dividend"
    SIP = "sip"
    SWITCH_IN = "switch_in"
    SWITCH_OUT = "switch_out"


class PlanType(str, Enum):
    """Direct vs Regular plan."""
    DIRECT = "direct"
    REGULAR = "regular"


class RiskProfile(str, Enum):
    """Investor risk profile."""
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class FundCategory(str, Enum):
    """Mutual fund category classification."""
    LARGE_CAP = "large_cap"
    MID_CAP = "mid_cap"
    SMALL_CAP = "small_cap"
    FLEXI_CAP = "flexi_cap"
    MULTI_CAP = "multi_cap"
    ELSS = "elss"
    DEBT_SHORT = "debt_short_duration"
    DEBT_MEDIUM = "debt_medium_duration"
    DEBT_LONG = "debt_long_duration"
    LIQUID = "liquid"
    HYBRID_AGGRESSIVE = "hybrid_aggressive"
    HYBRID_CONSERVATIVE = "hybrid_conservative"
    INDEX_FUND = "index_fund"
    SECTORAL = "sectoral"
    INTERNATIONAL = "international"
    OTHER = "other"


class RebalancingActionType(str, Enum):
    """Type of rebalancing action."""
    HOLD = "hold"
    EXIT = "exit"
    REDUCE = "reduce"
    INCREASE = "increase"
    SWITCH = "switch"


# =============================================================================
# Parser Agent Output
# =============================================================================

class Transaction(BaseModel):
    """A single mutual fund transaction extracted from CAMS/KFintech statement."""
    fund_name: str = Field(..., description="Full fund name as it appears on statement")
    isin: Optional[str] = Field(None, description="ISIN code if available")
    amc: Optional[str] = Field(None, description="AMC name (e.g., HDFC, SBI, ICICI)")
    date: DateType = Field(..., description="Transaction date")
    amount: float = Field(..., description="Transaction amount in INR")
    units: float = Field(..., description="Number of units transacted")
    nav: float = Field(..., description="NAV at time of transaction")
    transaction_type: TransactionType = Field(..., description="Type of transaction")
    folio_number: Optional[str] = Field(None, description="Folio number")

    class Config:
        json_schema_extra = {
            "example": {
                "fund_name": "HDFC Mid-Cap Opportunities Fund - Growth",
                "isin": "INF179K01BB2",
                "amc": "HDFC",
                "date": "2023-06-15",
                "amount": 10000.00,
                "units": 25.641,
                "nav": 390.00,
                "transaction_type": "purchase",
                "folio_number": "1234567890"
            }
        }


# =============================================================================
# Analytics Agent Output
# =============================================================================

class StockHolding(BaseModel):
    """A single stock holding within a mutual fund."""
    stock_name: str = Field(..., description="Company name")
    weight: float = Field(..., description="Weight in portfolio (0.0 to 1.0)")
    sector: Optional[str] = Field(None, description="Sector classification")


class FundHolding(BaseModel):
    """Current state of a single mutual fund holding in the portfolio."""
    fund_name: str = Field(..., description="Full fund name")
    isin: Optional[str] = Field(None, description="ISIN code")
    amc: Optional[str] = Field(None, description="AMC name")
    category: FundCategory = Field(FundCategory.OTHER, description="Fund category")
    current_value: float = Field(..., description="Current market value in INR")
    invested_amount: float = Field(..., description="Total amount invested in INR")
    units_held: float = Field(..., description="Current units held")
    current_nav: Optional[float] = Field(None, description="Current NAV")
    expense_ratio: float = Field(0.0, description="Expense ratio (e.g., 0.0150 for 1.5%)")
    direct_expense_ratio: Optional[float] = Field(
        None, description="Expense ratio of equivalent direct plan"
    )
    plan_type: PlanType = Field(PlanType.REGULAR, description="Direct or Regular plan")
    top_holdings: List[StockHolding] = Field(
        default_factory=list, description="Top stock holdings in this fund"
    )
    holding_period_days: Optional[int] = Field(
        None, description="Days since first purchase (for STCG calculation)"
    )
    xirr: Optional[float] = Field(None, description="Fund-level XIRR")
    absolute_return: Optional[float] = Field(None, description="Simple absolute return percentage")

    @property
    def unrealised_gain(self) -> float:
        """Unrealised gain/loss in INR."""
        return self.current_value - self.invested_amount

    @property
    def unrealised_gain_pct(self) -> float:
        """Unrealised gain/loss as percentage."""
        if self.invested_amount == 0:
            return 0.0
        return (self.unrealised_gain / self.invested_amount) * 100

    @property
    def expense_drag_inr(self) -> Optional[float]:
        """Annual expense ratio drag in INR vs direct plan."""
        if self.direct_expense_ratio is not None:
            return self.current_value * (self.expense_ratio - self.direct_expense_ratio)
        return None

    @property
    def is_stcg_eligible(self) -> bool:
        """Whether redemption would trigger STCG (held < 365 days for equity)."""
        if self.holding_period_days is not None:
            return self.holding_period_days < 365
        return False


class OverlapDetail(BaseModel):
    """Overlap detail for a single stock across funds."""
    stock_name: str
    funds: Dict[str, float] = Field(
        ..., description="Fund name → weight of this stock in that fund"
    )
    total_portfolio_exposure: float = Field(
        ..., description="Weighted exposure to this stock across entire portfolio"
    )


class PortfolioAnalytics(BaseModel):
    """Complete portfolio analytics — output of the Analytics Agent."""
    holdings: List[FundHolding] = Field(..., description="All fund holdings")
    overall_xirr: float = Field(..., description="Portfolio-level XIRR")
    fund_wise_xirr: Dict[str, float] = Field(
        default_factory=dict, description="Fund name → XIRR"
    )
    overlap_matrix: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Stock → {Fund → weight}. Stocks appearing in 2+ funds."
    )
    overlap_details: List[OverlapDetail] = Field(
        default_factory=list, description="Detailed overlap analysis"
    )
    expense_ratio_drag_inr: float = Field(
        0.0, description="Total annual expense drag vs direct plans in INR"
    )
    total_current_value: float = Field(..., description="Total portfolio market value")
    total_invested: float = Field(..., description="Total amount invested")
    category_allocation: Dict[str, float] = Field(
        default_factory=dict, description="Category → percentage allocation"
    )
    amc_allocation: Dict[str, float] = Field(
        default_factory=dict, description="AMC → percentage allocation"
    )

    @property
    def total_gain(self) -> float:
        return self.total_current_value - self.total_invested

    @property
    def total_gain_pct(self) -> float:
        if self.total_invested == 0:
            return 0.0
        return (self.total_gain / self.total_invested) * 100


# =============================================================================
# User Financial Profile (Input for Advisory Agent)
# =============================================================================

class UserFinancialProfile(BaseModel):
    """User's financial profile for advisory and FIRE planning."""
    # Basic info
    age: int = Field(..., ge=18, le=80, description="Current age")
    annual_income: float = Field(..., gt=0, description="Annual gross income in INR")
    monthly_expenses: float = Field(..., gt=0, description="Monthly expenses in INR")

    # Existing investments
    existing_investments: Dict[str, float] = Field(
        default_factory=dict,
        description='Investment type → value. e.g. {"MF": 1800000, "PPF": 600000}'
    )

    # FIRE planning inputs
    target_retirement_age: int = Field(60, description="Target retirement age")
    target_monthly_corpus: float = Field(
        0.0, description="Desired monthly income post-retirement (today's value)"
    )
    risk_profile: RiskProfile = Field(
        RiskProfile.MODERATE, description="Investment risk profile"
    )

    # Tax inputs (for Scenario B — Tax Regime Optimisation)
    base_salary: Optional[float] = Field(None, description="Base salary component in INR")
    hra_received: Optional[float] = Field(None, description="HRA received per annum in INR")
    rent_paid: Optional[float] = Field(None, description="Rent paid per annum in INR")
    metro_city: bool = Field(True, description="Whether living in metro city (for HRA calc)")
    section_80c: Optional[float] = Field(
        None, description="Total 80C investments (PPF, ELSS, LIC, etc.) in INR"
    )
    nps_contribution: Optional[float] = Field(
        None, description="NPS contribution under 80CCD(1B) in INR"
    )
    home_loan_interest: Optional[float] = Field(
        None, description="Home loan interest under Section 24 in INR"
    )
    medical_insurance_premium: Optional[float] = Field(
        None, description="Health insurance premium under 80D in INR"
    )
    other_deductions: Optional[float] = Field(
        None, description="Any other deductions (80G, 80E, etc.) in INR"
    )

    # Tax bracket (computed or provided)
    tax_bracket: Optional[str] = Field(None, description="Current tax bracket if known")

    class Config:
        json_schema_extra = {
            "example": {
                "age": 34,
                "annual_income": 2400000,
                "monthly_expenses": 80000,
                "existing_investments": {"MF": 1800000, "PPF": 600000},
                "target_retirement_age": 50,
                "target_monthly_corpus": 150000,
                "risk_profile": "moderate",
                "base_salary": 1800000,
                "hra_received": 360000,
                "section_80c": 150000,
                "nps_contribution": 50000,
                "home_loan_interest": 40000
            }
        }


# =============================================================================
# Advisory Agent Output
# =============================================================================

class RebalancingAction(BaseModel):
    """A specific, actionable rebalancing recommendation at fund level."""
    fund_name: str = Field(..., description="Fund to act on")
    action: RebalancingActionType = Field(..., description="Action to take")
    percentage: Optional[float] = Field(
        None, description="Percentage to exit/reduce (e.g., 50.0 means exit 50%)"
    )
    amount_inr: Optional[float] = Field(None, description="Amount in INR to act on")
    target_fund: Optional[str] = Field(
        None, description="Fund to switch/redirect to (for SWITCH actions)"
    )
    tax_impact: str = Field(
        "", description="Tax implication (e.g., 'No STCG — held > 1 year')"
    )
    rationale: str = Field(..., description="Why this action is recommended")
    priority: int = Field(
        1, ge=1, le=5, description="Priority 1 (highest) to 5 (lowest)"
    )


class FIREMilestone(BaseModel):
    """A single month/year in the FIRE roadmap."""
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2024)
    equity_sip: float = Field(0.0, description="Monthly SIP into equity in INR")
    debt_sip: float = Field(0.0, description="Monthly SIP into debt in INR")
    gold_sip: float = Field(0.0, description="Monthly SIP into gold/alternatives in INR")
    total_sip: float = Field(0.0, description="Total monthly SIP")
    projected_corpus: float = Field(0.0, description="Projected total corpus at this point")
    equity_pct: float = Field(0.0, description="Target equity allocation %")
    debt_pct: float = Field(0.0, description="Target debt allocation %")
    gold_pct: float = Field(0.0, description="Target gold/alternatives allocation %")
    notes: Optional[str] = Field(None, description="Special notes for this period")


class FIREPlan(BaseModel):
    """Complete FIRE Path Plan."""
    current_corpus: float = Field(..., description="Starting corpus")
    target_corpus: float = Field(..., description="Required corpus at retirement")
    years_to_retirement: int = Field(..., description="Years remaining")
    expected_retirement_date: str = Field(..., description="Estimated actual retirement date")
    monthly_sip_required: float = Field(..., description="Total monthly SIP needed")
    milestones: List[FIREMilestone] = Field(
        default_factory=list, description="Month-by-month roadmap"
    )
    insurance_gap: Optional[Dict[str, Any]] = Field(
        None, description="Life/health insurance gap analysis"
    )
    assumptions: Dict[str, float] = Field(
        default_factory=dict,
        description="Assumptions used (inflation rate, equity return, debt return, etc.)"
    )
    at_current_trajectory: Optional[str] = Field(
        None, description="When would retirement happen at current savings rate"
    )


class TaxStep(BaseModel):
    """A single step in tax regime calculation (for transparency)."""
    description: str = Field(..., description="What this step calculates")
    amount: float = Field(..., description="Amount in INR")
    section: Optional[str] = Field(None, description="Relevant IT section (e.g., '80C')")


class TaxInstrumentSuggestion(BaseModel):
    """A suggested tax-saving instrument."""
    name: str = Field(..., description="Instrument name")
    section: str = Field(..., description="IT section")
    max_limit: float = Field(..., description="Maximum deduction limit")
    expected_return: str = Field(..., description="Expected return range")
    liquidity: str = Field(..., description="Liquidity profile (low/medium/high)")
    risk: str = Field(..., description="Risk level (low/medium/high)")
    rationale: str = Field(..., description="Why this is recommended")


class TaxRegimeComparison(BaseModel):
    """Step-by-step tax calculation under both regimes — for Scenario B."""
    gross_income: float = Field(..., description="Gross total income")

    # Old regime
    old_regime_steps: List[TaxStep] = Field(
        default_factory=list, description="Step-by-step deductions under old regime"
    )
    old_taxable_income: float = Field(0.0, description="Taxable income under old regime")
    old_total_tax: float = Field(0.0, description="Total tax under old regime (incl cess)")

    # New regime
    new_regime_steps: List[TaxStep] = Field(
        default_factory=list, description="Step-by-step deductions under new regime"
    )
    new_taxable_income: float = Field(0.0, description="Taxable income under new regime")
    new_total_tax: float = Field(0.0, description="Total tax under new regime (incl cess)")

    # Recommendation
    recommended_regime: str = Field(..., description="'old' or 'new'")
    savings_amount: float = Field(..., description="How much the better regime saves in INR")

    # Additional insights
    missed_deductions: List[str] = Field(
        default_factory=list, description="Deductions the user is not utilizing"
    )
    additional_instruments: List[TaxInstrumentSuggestion] = Field(
        default_factory=list, description="2-3 additional tax-saving instruments ranked"
    )


class HealthScoreDimension(BaseModel):
    """One dimension of the Money Health Score."""
    dimension: str = Field(
        ...,
        description="Dimension name: diversification, cost_efficiency, "
                    "tax_efficiency, risk_alignment, goal_readiness, liquidity"
    )
    score: float = Field(..., ge=0, le=100, description="Score out of 100")
    rationale: str = Field(..., description="Why this score was assigned")
    suggestions: List[str] = Field(
        default_factory=list, description="Improvement suggestions"
    )


class AdvisoryReport(BaseModel):
    """Complete advisory output — generated by the Advisory Agent."""
    rebalancing_plan: List[RebalancingAction] = Field(
        default_factory=list, description="Specific fund-level rebalancing actions"
    )
    fire_plan: Optional[FIREPlan] = Field(None, description="FIRE Path Plan")
    tax_analysis: Optional[TaxRegimeComparison] = Field(
        None, description="Tax regime comparison"
    )
    health_score: List[HealthScoreDimension] = Field(
        default_factory=list, description="6-dimension Money Health Score"
    )
    audit_trail: List[str] = Field(
        default_factory=list, description="Log of agent reasoning steps"
    )
    generated_at: Optional[str] = Field(None, description="Timestamp of generation")


# =============================================================================
# Compliance Agent Output (Final Report)
# =============================================================================

class FinalReport(AdvisoryReport):
    """Compliance-cleared final report — output of the Compliance Agent."""
    compliance_cleared: bool = Field(
        False, description="Whether all compliance checks passed"
    )
    disclaimer: str = Field(
        "",
        description="SEBI/AMFI disclaimer appended to all recommendations"
    )
    flagged_items: List[str] = Field(
        default_factory=list,
        description="Items flagged during compliance review (softened, not removed)"
    )
    compliance_audit: List[str] = Field(
        default_factory=list,
        description="Log of compliance checks performed"
    )


# =============================================================================
# LangGraph Pipeline State
# =============================================================================

class PipelineState(BaseModel):
    """
    Complete state object that flows through the LangGraph pipeline.
    Each agent reads what it needs and writes its output to the state.

    Flow: Parser → Analytics → Advisory → Compliance
    """
    # --- Input ---
    pdf_path: Optional[str] = Field(None, description="Path to uploaded CAMS PDF")
    raw_text: Optional[str] = Field(None, description="Raw extracted text from PDF")
    user_profile: Optional[UserFinancialProfile] = Field(
        None, description="User's financial profile (manual input or from PDF)"
    )

    # --- Parser Agent Output ---
    transactions: List[Transaction] = Field(
        default_factory=list, description="Parsed transactions from CAMS PDF"
    )

    # --- Analytics Agent Output ---
    analytics: Optional[PortfolioAnalytics] = Field(
        None, description="Portfolio analytics results"
    )

    # --- Advisory Agent Output ---
    advisory_report: Optional[AdvisoryReport] = Field(
        None, description="Advisory recommendations"
    )

    # --- Compliance Agent Output ---
    final_report: Optional[FinalReport] = Field(
        None, description="Compliance-cleared final report"
    )

    # --- Pipeline Metadata ---
    errors: List[str] = Field(
        default_factory=list, description="Errors encountered during pipeline execution"
    )
    current_agent: Optional[str] = Field(
        None, description="Name of the currently executing agent"
    )
    pipeline_status: str = Field(
        "initialized", description="Pipeline status: initialized | running | completed | failed"
    )
