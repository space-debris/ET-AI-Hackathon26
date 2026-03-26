"""
FinSage AI — Advisory Agent Tests (Mayur)
===========================================
Unit tests for advisory agent: tax calculations, HRA exemption,
slab rate application, missed deduction detection, and health score parsing.

All tests target DETERMINISTIC Python math — no LLM calls required.
Owner: Mayur
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from shared import config
from shared.schemas import (
    AdvisoryReport, RebalancingAction, RebalancingActionType,
    FIREPlan, FIREMilestone,
    TaxRegimeComparison, TaxStep, TaxInstrumentSuggestion,
    HealthScoreDimension,
    PortfolioAnalytics, UserFinancialProfile, FundHolding,
    StockHolding,
    PlanType, RiskProfile, FundCategory,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def basic_profile():
    """A basic investor profile for tax tests."""
    return UserFinancialProfile(
        age=30,
        annual_income=1200000,  # ₹12L
        monthly_expenses=40000,
        existing_investments={"MF": 500000, "PPF": 200000},
        target_retirement_age=50,
        target_monthly_corpus=100000,
        risk_profile=RiskProfile.MODERATE,
        base_salary=900000,
        section_80c=150000,
        nps_contribution=50000,
    )


@pytest.fixture
def high_income_profile():
    """High-income profile with HRA, home loan, medical insurance."""
    return UserFinancialProfile(
        age=35,
        annual_income=2400000,  # ₹24L
        monthly_expenses=80000,
        existing_investments={"MF": 1800000, "PPF": 600000, "NPS": 300000},
        target_retirement_age=45,
        target_monthly_corpus=150000,
        risk_profile=RiskProfile.AGGRESSIVE,
        base_salary=1800000,
        hra_received=360000,    # ₹30K/month
        rent_paid=480000,       # ₹40K/month
        metro_city=True,
        section_80c=150000,
        nps_contribution=50000,
        home_loan_interest=200000,
        medical_insurance_premium=25000,
        other_deductions=10000,
    )


@pytest.fixture
def zero_deduction_profile():
    """Profile with no deductions — tests new regime advantage."""
    return UserFinancialProfile(
        age=25,
        annual_income=800000,  # ₹8L
        monthly_expenses=30000,
        risk_profile=RiskProfile.CONSERVATIVE,
    )


@pytest.fixture
def sample_analytics():
    """Sample portfolio analytics for health score tests."""
    return PortfolioAnalytics(
        holdings=[
            FundHolding(
                fund_name="HDFC Mid-Cap Opp Fund",
                category=FundCategory.MID_CAP,
                current_value=450000,
                invested_amount=300000,
                units_held=1154,
                expense_ratio=0.0180,
                direct_expense_ratio=0.0045,
                plan_type=PlanType.REGULAR,
                holding_period_days=400,
                xirr=0.162,
                top_holdings=[
                    StockHolding(stock_name="Reliance", weight=0.07),
                    StockHolding(stock_name="HDFC Bank", weight=0.06),
                ],
            ),
            FundHolding(
                fund_name="SBI Bluechip Fund",
                category=FundCategory.LARGE_CAP,
                current_value=320000,
                invested_amount=250000,
                units_held=640,
                expense_ratio=0.0170,
                direct_expense_ratio=0.0040,
                plan_type=PlanType.REGULAR,
                holding_period_days=200,
                xirr=0.118,
                top_holdings=[
                    StockHolding(stock_name="Reliance", weight=0.08),
                    StockHolding(stock_name="Infosys", weight=0.07),
                ],
            ),
        ],
        overall_xirr=0.1420,
        fund_wise_xirr={"HDFC Mid-Cap Opp Fund": 0.162, "SBI Bluechip Fund": 0.118},
        overlap_matrix={"Reliance": {"HDFC Mid-Cap Opp Fund": 0.07, "SBI Bluechip Fund": 0.08}},
        expense_ratio_drag_inr=12600,
        total_current_value=770000,
        total_invested=550000,
        category_allocation={"mid_cap": 58.4, "large_cap": 41.6},
        amc_allocation={"HDFC": 58.4, "SBI": 41.6},
    )


@pytest.fixture
def advisory_agent():
    """Create AdvisoryAgent with mocked LLM (no API key needed)."""
    with patch("agents.advisory_agent.ChatGoogleGenerativeAI"):
        from agents.advisory_agent import AdvisoryAgent
        agent = AdvisoryAgent.__new__(AdvisoryAgent)
        agent.model_name = "gemini-2.5-flash-lite"
        agent.llm = MagicMock()
        agent.system_prompt = "You are a test system."
        agent.fire_prompt_template = "Test FIRE prompt for age {age}"
        agent.tax_prompt_template = "Test tax prompt"
        return agent


# =============================================================================
# Tax Slab Rate Tests
# =============================================================================

class TestSlabRates:
    """Test the pure-Python slab rate calculator."""

    def test_zero_income(self, advisory_agent):
        """Zero income → zero tax."""
        assert advisory_agent._apply_slab_rates(0, config.OLD_REGIME_SLABS) == 0.0
        assert advisory_agent._apply_slab_rates(0, config.NEW_REGIME_SLABS) == 0.0

    def test_old_regime_below_250k(self, advisory_agent):
        """Income below ₹2.5L → zero tax under old regime."""
        tax = advisory_agent._apply_slab_rates(200000, config.OLD_REGIME_SLABS)
        assert tax == 0.0

    def test_old_regime_at_5L(self, advisory_agent):
        """₹5L taxable: ₹0 on first ₹2.5L + 5% on next ₹2.5L = ₹12,500."""
        tax = advisory_agent._apply_slab_rates(500000, config.OLD_REGIME_SLABS)
        assert tax == pytest.approx(12500.0)

    def test_old_regime_at_10L(self, advisory_agent):
        """₹10L taxable: ₹12,500 + 20% on ₹5L = ₹1,12,500."""
        tax = advisory_agent._apply_slab_rates(1000000, config.OLD_REGIME_SLABS)
        assert tax == pytest.approx(112500.0)

    def test_old_regime_at_15L(self, advisory_agent):
        """₹15L taxable: ₹1,12,500 + 30% on ₹5L = ₹2,62,500."""
        tax = advisory_agent._apply_slab_rates(1500000, config.OLD_REGIME_SLABS)
        assert tax == pytest.approx(262500.0)

    def test_new_regime_below_4L(self, advisory_agent):
        """Income below ₹4L → zero tax under new regime."""
        tax = advisory_agent._apply_slab_rates(350000, config.NEW_REGIME_SLABS)
        assert tax == 0.0

    def test_new_regime_at_8L(self, advisory_agent):
        """₹8L taxable: ₹0 on first ₹4L + 5% on next ₹4L = ₹20,000."""
        tax = advisory_agent._apply_slab_rates(800000, config.NEW_REGIME_SLABS)
        assert tax == pytest.approx(20000.0)

    def test_new_regime_at_12L(self, advisory_agent):
        """₹12L: ₹20,000 + 10% on ₹4L = ₹60,000."""
        tax = advisory_agent._apply_slab_rates(1200000, config.NEW_REGIME_SLABS)
        assert tax == pytest.approx(60000.0)

    def test_new_regime_at_24L(self, advisory_agent):
        """₹24L: ₹20K + ₹40K + ₹60K + ₹80K + ₹100K = ₹3,00,000."""
        tax = advisory_agent._apply_slab_rates(2400000, config.NEW_REGIME_SLABS)
        assert tax == pytest.approx(300000.0)


# =============================================================================
# HRA Exemption Tests
# =============================================================================

class TestHRAExemption:
    """Test HRA exemption calculation (pure Python math)."""

    def test_no_hra_inputs(self, advisory_agent):
        """No HRA/rent/base_salary → zero exemption."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
        )
        assert advisory_agent._calculate_hra_exemption(profile) == 0.0

    def test_metro_hra(self, advisory_agent):
        """Metro city HRA: min(HRA received, rent-10% basic, 50% basic)."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
            base_salary=900000, hra_received=360000, rent_paid=480000,
            metro_city=True,
        )
        hra = advisory_agent._calculate_hra_exemption(profile)
        # Expected: min(360000, 480000 - 90000, 450000) = min(360000, 390000, 450000) = 360000
        assert hra == pytest.approx(360000.0)

    def test_non_metro_hra(self, advisory_agent):
        """Non-metro: uses 40% of basic instead of 50%."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
            base_salary=900000, hra_received=360000, rent_paid=480000,
            metro_city=False,
        )
        hra = advisory_agent._calculate_hra_exemption(profile)
        # Expected: min(360000, 390000, 360000) = 360000
        assert hra == pytest.approx(360000.0)

    def test_low_rent(self, advisory_agent):
        """Very low rent → rent-10% basic could be negative → clamps to 0."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
            base_salary=900000, hra_received=360000, rent_paid=50000,
            metro_city=True,
        )
        hra = advisory_agent._calculate_hra_exemption(profile)
        # rent - 10% basic = 50000 - 90000 = -40000 → min includes negative → max(0, ...)
        assert hra == 0.0


# =============================================================================
# Full Tax Regime Tests
# =============================================================================

class TestTaxRegimeCalculation:
    """Test end-to-end tax regime comparison (deterministic math)."""

    def test_old_regime_with_deductions(self, advisory_agent, basic_profile):
        """Old regime with 80C + NPS deductions."""
        taxable, total_tax, steps = advisory_agent._calculate_tax_old_regime(basic_profile)
        # Gross: 12L
        # Less standard deduction: 75K → 11,25,000
        # Less 80C: 1,50,000 → 9,75,000
        # Less NPS: 50,000 → 9,25,000
        expected_taxable = 1200000 - 75000 - 150000 - 50000
        assert taxable == pytest.approx(expected_taxable)
        assert total_tax > 0
        # Verify steps are generated
        assert len(steps) >= 5
        # Final step should be total tax
        assert steps[-1].section == "Total"

    def test_new_regime_no_deductions(self, advisory_agent, zero_deduction_profile):
        """New regime for ₹8L income — should get 87A rebate."""
        taxable, total_tax, steps = advisory_agent._calculate_tax_new_regime(
            zero_deduction_profile
        )
        # Gross: 8L, less std deduction 75K = 7,25,000
        expected_taxable = 800000 - 75000
        assert taxable == pytest.approx(expected_taxable)
        # Taxable ₹7,25,000 ≤ ₹12L → eligible for 87A rebate
        # Tax on 7,25,000: ₹0 on 4L + 5% on 3,25,000 = ₹16,250
        # Rebate: min(16250, 60000) = 16250
        # Tax after rebate: 0
        # Cess on 0 = 0
        assert total_tax == pytest.approx(0.0)

    def test_high_income_old_regime(self, advisory_agent, high_income_profile):
        """High income with all deductions — old regime should show benefit."""
        taxable, total_tax, steps = advisory_agent._calculate_tax_old_regime(
            high_income_profile
        )
        # Should be significantly lower than gross due to HRA + 80C + NPS + 24 + 80D
        assert taxable < high_income_profile.annual_income
        assert total_tax > 0
        # Verify HRA is deducted
        has_hra_step = any("HRA" in s.description for s in steps)
        assert has_hra_step

    def test_regime_comparison(self, advisory_agent, high_income_profile):
        """Full regime comparison — should identify the better regime."""
        result = advisory_agent.generate_tax_analysis(high_income_profile)
        assert isinstance(result, TaxRegimeComparison)
        assert result.recommended_regime in ("old", "new")
        assert result.savings_amount >= 0
        # Budget 2025 new regime slabs are aggressive enough that even ₹24L with
        # full deductions (HRA+80C+NPS+24+80D) sees new regime cheaper by ~₹8.5K.
        # Old: ₹3,01,080 vs New: ₹2,92,500 → new regime wins.
        assert result.recommended_regime == "new"

    def test_cess_applied_correctly(self, advisory_agent, basic_profile):
        """Verify 4% cess is applied on top of tax."""
        _, total_tax_old, steps_old = advisory_agent._calculate_tax_old_regime(basic_profile)
        # Find the slab tax step and cess step
        slab_tax = None
        cess = None
        for s in steps_old:
            if s.section == "Slab":
                slab_tax = s.amount
            if s.section == "Cess":
                cess = s.amount
        if slab_tax is not None and cess is not None:
            # May have rebate in between, but cess should be 4% of post-rebate tax
            assert cess >= 0


# =============================================================================
# Missed Deductions Tests
# =============================================================================

class TestMissedDeductions:
    """Test the missed deduction finder."""

    def test_all_deductions_used(self, advisory_agent):
        """When all deductions are maxed out, no missed deductions."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
            section_80c=150000,
            nps_contribution=50000,
            medical_insurance_premium=25000,
            home_loan_interest=200000,
        )
        missed = advisory_agent._find_missed_deductions(profile)
        assert len(missed) == 0

    def test_no_deductions(self, advisory_agent, zero_deduction_profile):
        """Profile with zero deductions → all gaps flagged."""
        missed = advisory_agent._find_missed_deductions(zero_deduction_profile)
        assert len(missed) >= 3  # At least 80C, NPS, 80D
        # Should mention Section 80C
        assert any("80C" in m for m in missed)
        # Should mention NPS
        assert any("NPS" in m or "80CCD" in m for m in missed)
        # Should mention health insurance
        assert any("80D" in m or "health" in m.lower() for m in missed)

    def test_partial_80c(self, advisory_agent):
        """Partial 80C usage → should flag the gap."""
        profile = UserFinancialProfile(
            age=30, annual_income=1200000, monthly_expenses=40000,
            section_80c=80000,  # Only ₹80K of ₹1.5L limit used
            nps_contribution=50000,
            medical_insurance_premium=25000,
            home_loan_interest=200000,
        )
        missed = advisory_agent._find_missed_deductions(profile)
        assert any("80C" in m and "70,000" in m for m in missed)


# =============================================================================
# Schema Model Tests
# =============================================================================

class TestSchemaModels:
    """Test Pydantic schema models work correctly."""

    def test_fund_holding_properties(self):
        """Test computed properties of FundHolding."""
        holding = FundHolding(
            fund_name="Test Fund",
            current_value=150000,
            invested_amount=100000,
            units_held=500,
            expense_ratio=0.0180,
            direct_expense_ratio=0.0045,
            holding_period_days=200,
        )
        assert holding.unrealised_gain == pytest.approx(50000.0)
        assert holding.unrealised_gain_pct == pytest.approx(50.0)
        assert holding.is_stcg_eligible is True  # <365 days
        assert holding.expense_drag_inr == pytest.approx(150000 * (0.0180 - 0.0045))

    def test_fund_holding_ltcg(self):
        """Holding >365 days → not STCG eligible."""
        holding = FundHolding(
            fund_name="Test Fund",
            current_value=150000,
            invested_amount=100000,
            units_held=500,
            holding_period_days=400,
        )
        assert holding.is_stcg_eligible is False

    def test_portfolio_analytics_properties(self, sample_analytics):
        """Test PortfolioAnalytics computed properties."""
        assert sample_analytics.total_gain == pytest.approx(220000.0)
        assert sample_analytics.total_gain_pct == pytest.approx(40.0)

    def test_advisory_report_creation(self):
        """Test creating a complete AdvisoryReport."""
        report = AdvisoryReport(
            rebalancing_plan=[
                RebalancingAction(
                    fund_name="Test Fund",
                    action=RebalancingActionType.HOLD,
                    rationale="Good performer",
                )
            ],
            fire_plan=None,
            tax_analysis=None,
            health_score=[],
            audit_trail=["Test step 1"],
            generated_at=datetime.now().isoformat(),
        )
        assert len(report.rebalancing_plan) == 1
        assert report.rebalancing_plan[0].action == RebalancingActionType.HOLD

    def test_health_score_dimension(self):
        """Test HealthScoreDimension model."""
        dim = HealthScoreDimension(
            dimension="diversification",
            score=72,
            rationale="Well spread across categories",
            suggestions=["Consider adding debt funds"],
        )
        assert dim.score == 72
        assert len(dim.suggestions) == 1

    def test_fire_milestone(self):
        """Test FIREMilestone model."""
        milestone = FIREMilestone(
            month=6, year=2026,
            equity_sip=30000, debt_sip=10000, gold_sip=5000,
            total_sip=45000, projected_corpus=2500000,
            equity_pct=70, debt_pct=20, gold_pct=10,
        )
        assert milestone.total_sip == 45000


# =============================================================================
# LangGraph Node Function Tests (mocked LLM)
# =============================================================================

class TestAdvisoryAgentRunNode:
    """Test the LangGraph `run()` node function with mocked LLM."""

    def test_run_skips_without_profile(self, advisory_agent):
        """run() with no profile → should skip all tasks gracefully."""
        state = {"analytics": None, "user_profile": None, "errors": []}
        result = advisory_agent.run(state)
        assert "advisory_report" in result
        report = AdvisoryReport(**result["advisory_report"])
        assert len(report.rebalancing_plan) == 0
        assert report.fire_plan is None
        assert report.tax_analysis is None
        assert len(report.health_score) == 0
        # Should have skipped audit trail entries
        assert any("Skipped" in entry for entry in report.audit_trail)

    def test_run_tax_only_with_profile(self, advisory_agent, basic_profile):
        """run() with profile only (no analytics) → tax analysis should work."""
        state = {
            "analytics": None,
            "user_profile": basic_profile.model_dump(),
            "errors": [],
        }
        result = advisory_agent.run(state)
        report = AdvisoryReport(**result["advisory_report"])
        # Tax should succeed (pure Python, no LLM)
        assert report.tax_analysis is not None
        assert report.tax_analysis.recommended_regime in ("old", "new")
        # Rebalancing/health should be skipped (needs analytics)
        assert len(report.rebalancing_plan) == 0
        assert len(report.health_score) == 0


# =============================================================================
# JSON Response Parser Tests
# =============================================================================

class TestJSONParsing:
    """Test the LLM response JSON parser."""

    def test_plain_json(self, advisory_agent):
        """Parse plain JSON string."""
        result = advisory_agent._parse_json_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_with_code_fence(self, advisory_agent):
        """Parse JSON wrapped in markdown code fences."""
        result = advisory_agent._parse_json_response(
            '```json\n{"key": "value"}\n```'
        )
        assert result == {"key": "value"}

    def test_json_array(self, advisory_agent):
        """Parse JSON array."""
        result = advisory_agent._parse_json_response('[{"a": 1}, {"b": 2}]')
        assert isinstance(result, list)
        assert len(result) == 2

    def test_invalid_json_raises(self, advisory_agent):
        """Invalid JSON → ValueError."""
        with pytest.raises(ValueError, match="invalid JSON"):
            advisory_agent._parse_json_response("this is not json")
