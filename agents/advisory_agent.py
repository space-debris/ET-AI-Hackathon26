"""
FinSage AI — Advisory Agent (Mayur)
=====================================
LLM-powered financial advisory agent that generates:
1. Portfolio rebalancing recommendations (fund-specific actions)
2. FIRE Path Plan (month-by-month SIP glidepath)
3. Tax Regime Comparison (old vs new, step-by-step)
4. Money Health Score (6 dimensions, 0-100 each)

Design:
- Each sub-task is a SEPARATE LLM call with its own specialised prompt
- Local Python calculations for tax math (no LLM arithmetic)
- All outputs parsed into Pydantic models via Gemini JSON mode
- Audit trail logged for every LLM call

Dependencies: langchain-google-genai, shared/schemas.py, shared/config.py, prompts/*.txt
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from shared import config
from shared.schemas import (
    PortfolioAnalytics,
    UserFinancialProfile,
    RebalancingAction,
    RebalancingActionType,
    FIREPlan,
    FIREMilestone,
    TaxRegimeComparison,
    TaxStep,
    TaxInstrumentSuggestion,
    HealthScoreDimension,
    AdvisoryReport,
    PipelineState,
    FundCategory,
    RiskProfile,
)

logger = logging.getLogger(__name__)


class AdvisoryAgent:
    """
    Agent 3: LLM-powered financial advisory engine.

    Responsibilities:
    - Generate fund-specific rebalancing actions with tax context
    - Build FIRE roadmap with age-based glidepath
    - Compare old vs new tax regimes step-by-step
    - Score portfolio health across 6 dimensions

    Owner: Mayur
    """

    def __init__(self, model_name: str = None):
        self.model_name = model_name or config.GEMINI_MODEL
        self.llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=config.GEMINI_API_KEY,
            temperature=config.GEMINI_TEMPERATURE,
            max_output_tokens=config.GEMINI_MAX_OUTPUT_TOKENS,
        )
        # Load prompt templates
        self.system_prompt = self._load_prompt("advisory_system.txt")
        self.fire_prompt_template = self._load_prompt("fire_planner.txt")
        self.tax_prompt_template = self._load_prompt("tax_optimizer.txt")

    # =========================================================================
    # Prompt Loading
    # =========================================================================

    @staticmethod
    def _load_prompt(filename: str) -> str:
        """Load a prompt template from the prompts directory."""
        prompt_path = config.PROMPTS_DIR / filename
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text(encoding="utf-8")

    # =========================================================================
    # LLM Call Helper
    # =========================================================================

    def _call_llm(self, user_prompt: str, system_prompt: str = None) -> str:
        """
        Make a single LLM call with retry logic.

        Args:
            user_prompt: The user/task-specific prompt
            system_prompt: Optional system prompt override

        Returns:
            Raw LLM response text
        """
        sys_prompt = system_prompt or self.system_prompt
        messages = [
            SystemMessage(content=sys_prompt),
            HumanMessage(content=user_prompt),
        ]

        for attempt in range(config.MAX_RETRIES):
            try:
                response = self.llm.invoke(messages)
                return response.content
            except Exception as e:
                logger.warning(f"LLM call attempt {attempt + 1} failed: {e}")
                if attempt == config.MAX_RETRIES - 1:
                    raise RuntimeError(
                        f"LLM call failed after {config.MAX_RETRIES} attempts: {e}"
                    )
                import time
                time.sleep(config.RETRY_DELAY_SECONDS * (attempt + 1))

    def _parse_json_response(self, response: str) -> dict:
        """
        Extract and parse JSON from LLM response.
        Handles cases where LLM wraps JSON in markdown code blocks.
        """
        text = response.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}\nRaw: {text[:500]}")
            raise ValueError(f"LLM returned invalid JSON: {e}")

    # =========================================================================
    # 1. REBALANCING PLAN
    # =========================================================================

    def generate_rebalancing_plan(
        self,
        analytics: PortfolioAnalytics,
        profile: UserFinancialProfile,
    ) -> List[RebalancingAction]:
        """
        Generate fund-specific rebalancing actions based on portfolio analytics.

        Uses LLM to interpret analytics data and produce actionable recommendations
        considering overlap, expense ratios, category allocation, and tax impact.
        """
        # Build a summary of the portfolio for the LLM
        holdings_summary = []
        for h in analytics.holdings:
            holdings_summary.append({
                "fund_name": h.fund_name,
                "category": h.category.value if h.category else "other",
                "current_value": h.current_value,
                "invested_amount": h.invested_amount,
                "unrealised_gain": h.unrealised_gain,
                "unrealised_gain_pct": round(h.unrealised_gain_pct, 2),
                "expense_ratio": h.expense_ratio,
                "direct_expense_ratio": h.direct_expense_ratio,
                "plan_type": h.plan_type.value if h.plan_type else "regular",
                "holding_period_days": h.holding_period_days,
                "is_stcg_eligible": h.is_stcg_eligible,
                "xirr": h.xirr,
                "top_holdings": [
                    {"stock": s.stock_name, "weight": s.weight}
                    for s in h.top_holdings[:5]
                ],
            })

        user_prompt = f"""Analyse this mutual fund portfolio and generate specific rebalancing actions.

PORTFOLIO DATA:
- Total Value: ₹{analytics.total_current_value:,.0f}
- Total Invested: ₹{analytics.total_invested:,.0f}
- Overall XIRR: {analytics.overall_xirr * 100:.1f}%
- Expense Ratio Drag (vs Direct): ₹{analytics.expense_ratio_drag_inr:,.0f}/year
- Category Allocation: {json.dumps(analytics.category_allocation)}
- AMC Allocation: {json.dumps(analytics.amc_allocation)}

FUND HOLDINGS:
{json.dumps(holdings_summary, indent=2)}

OVERLAP MATRIX (stocks in 2+ funds):
{json.dumps(analytics.overlap_matrix, indent=2)}

INVESTOR PROFILE:
- Age: {profile.age}
- Risk Profile: {profile.risk_profile.value}
- Annual Income: ₹{profile.annual_income:,.0f}

Generate a JSON array of RebalancingAction objects. Each must have:
- fund_name, action (HOLD/EXIT/REDUCE/INCREASE/SWITCH), percentage (if applicable),
  target_fund (if SWITCH), tax_impact, rationale, priority (1=highest to 5=lowest)

Return ONLY a JSON array: [{{"fund_name": "...", "action": "...", ...}}, ...]
"""
        response = self._call_llm(user_prompt)
        parsed = self._parse_json_response(response)

        # Ensure it's a list
        if isinstance(parsed, dict) and "rebalancing_plan" in parsed:
            parsed = parsed["rebalancing_plan"]
        if not isinstance(parsed, list):
            parsed = [parsed]

        actions = []
        for item in parsed:
            try:
                action_type = item.get("action", "hold").lower()
                actions.append(RebalancingAction(
                    fund_name=item["fund_name"],
                    action=RebalancingActionType(action_type),
                    percentage=item.get("percentage"),
                    amount_inr=item.get("amount_inr"),
                    target_fund=item.get("target_fund"),
                    tax_impact=item.get("tax_impact", ""),
                    rationale=item.get("rationale", ""),
                    priority=item.get("priority", 3),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse rebalancing action: {e}, item: {item}")
                continue

        return actions

    # =========================================================================
    # 2. FIRE PLAN
    # =========================================================================

    def generate_fire_plan(
        self, profile: UserFinancialProfile
    ) -> FIREPlan:
        """
        Generate a comprehensive FIRE Path Plan with month-by-month glidepath.

        Fills the prompt template with user profile data and sends to LLM.
        """
        existing_corpus = sum(profile.existing_investments.values())
        current_sip = max(0, profile.annual_income / 12 - profile.monthly_expenses)

        prompt = self.fire_prompt_template.format(
            age=profile.age,
            annual_income=f"{profile.annual_income:,.0f}",
            monthly_expenses=f"{profile.monthly_expenses:,.0f}",
            existing_corpus=f"{existing_corpus:,.0f}",
            existing_investments=json.dumps(profile.existing_investments),
            target_retirement_age=profile.target_retirement_age,
            target_monthly_draw=f"{profile.target_monthly_corpus:,.0f}",
            risk_profile=profile.risk_profile.value,
            current_sip=f"{current_sip:,.0f}",
            inflation_rate=config.ASSUMED_INFLATION_RATE * 100,
            equity_return=config.ASSUMED_EQUITY_RETURN * 100,
            debt_return=config.ASSUMED_DEBT_RETURN * 100,
            gold_return=config.ASSUMED_GOLD_RETURN * 100,
            swr=config.SAFE_WITHDRAWAL_RATE * 100,
            life_expectancy=config.LIFE_EXPECTANCY,
        )

        response = self._call_llm(prompt)
        parsed = self._parse_json_response(response)

        # Parse milestones
        milestones = []
        for m in parsed.get("milestones", []):
            try:
                milestones.append(FIREMilestone(
                    month=m.get("month", 1),
                    year=m.get("year", 2026),
                    equity_sip=m.get("equity_sip", 0),
                    debt_sip=m.get("debt_sip", 0),
                    gold_sip=m.get("gold_sip", 0),
                    total_sip=m.get("total_sip", 0),
                    projected_corpus=m.get("projected_corpus", 0),
                    equity_pct=m.get("equity_pct", 0),
                    debt_pct=m.get("debt_pct", 0),
                    gold_pct=m.get("gold_pct", 0),
                    notes=m.get("notes"),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse FIRE milestone: {e}")

        return FIREPlan(
            current_corpus=parsed.get("current_corpus", existing_corpus),
            target_corpus=parsed.get("target_corpus", 0),
            years_to_retirement=parsed.get(
                "years_to_retirement",
                profile.target_retirement_age - profile.age,
            ),
            expected_retirement_date=parsed.get("expected_retirement_date", ""),
            monthly_sip_required=parsed.get("monthly_sip_required", 0),
            milestones=milestones,
            insurance_gap=parsed.get("insurance_gap"),
            assumptions=parsed.get("assumptions", {
                "inflation_rate": config.ASSUMED_INFLATION_RATE,
                "equity_return": config.ASSUMED_EQUITY_RETURN,
                "debt_return": config.ASSUMED_DEBT_RETURN,
                "gold_return": config.ASSUMED_GOLD_RETURN,
                "swr": config.SAFE_WITHDRAWAL_RATE,
            }),
            at_current_trajectory=parsed.get("at_current_trajectory"),
        )

    # =========================================================================
    # 3. TAX ANALYSIS (Hybrid: Python math + LLM interpretation)
    # =========================================================================

    def _calculate_hra_exemption(self, profile: UserFinancialProfile) -> float:
        """Calculate HRA exemption — pure Python, no LLM."""
        if not profile.hra_received or not profile.rent_paid or not profile.base_salary:
            return 0.0

        hra_received = profile.hra_received
        rent_minus_10pct = profile.rent_paid - (0.10 * profile.base_salary)
        metro_pct = (
            config.HRA_METRO_PERCENTAGE
            if profile.metro_city
            else config.HRA_NON_METRO_PERCENTAGE
        )
        metro_component = metro_pct * profile.base_salary

        return max(0, min(hra_received, rent_minus_10pct, metro_component))

    def _calculate_tax_old_regime(
        self, profile: UserFinancialProfile
    ) -> tuple[float, float, List[TaxStep]]:
        """
        Calculate tax under OLD regime — pure Python.
        Returns: (taxable_income, total_tax, steps)
        """
        steps = []
        gross = profile.annual_income
        steps.append(TaxStep(
            description="Gross Total Income", amount=gross, section="Gross"
        ))

        # Standard deduction
        taxable = gross - config.STANDARD_DEDUCTION_OLD
        steps.append(TaxStep(
            description="Less: Standard Deduction",
            amount=-config.STANDARD_DEDUCTION_OLD,
            section="Std Deduction",
        ))

        # HRA exemption
        hra_exemption = self._calculate_hra_exemption(profile)
        if hra_exemption > 0:
            taxable -= hra_exemption
            steps.append(TaxStep(
                description="Less: HRA Exemption",
                amount=-hra_exemption,
                section="10(13A)",
            ))

        # Section 80C
        sec_80c = min(profile.section_80c or 0, config.SECTION_80C_LIMIT)
        if sec_80c > 0:
            taxable -= sec_80c
            steps.append(TaxStep(
                description="Less: Section 80C (PPF, ELSS, LIC, etc.)",
                amount=-sec_80c,
                section="80C",
            ))

        # NPS 80CCD(1B)
        nps = min(profile.nps_contribution or 0, config.SECTION_80CCD_1B_LIMIT)
        if nps > 0:
            taxable -= nps
            steps.append(TaxStep(
                description="Less: NPS Contribution",
                amount=-nps,
                section="80CCD(1B)",
            ))

        # Home loan interest Section 24
        home_loan = min(profile.home_loan_interest or 0, config.SECTION_24_LIMIT)
        if home_loan > 0:
            taxable -= home_loan
            steps.append(TaxStep(
                description="Less: Home Loan Interest",
                amount=-home_loan,
                section="24(b)",
            ))

        # Medical insurance 80D
        medical = min(
            profile.medical_insurance_premium or 0, config.SECTION_80D_LIMIT_SELF
        )
        if medical > 0:
            taxable -= medical
            steps.append(TaxStep(
                description="Less: Medical Insurance",
                amount=-medical,
                section="80D",
            ))

        # Other deductions
        other = profile.other_deductions or 0
        if other > 0:
            taxable -= other
            steps.append(TaxStep(
                description="Less: Other Deductions",
                amount=-other,
                section="Other",
            ))

        taxable = max(0, taxable)
        steps.append(TaxStep(
            description="Taxable Income (Old Regime)",
            amount=taxable,
            section="Computed",
        ))

        # Apply slab rates
        tax = self._apply_slab_rates(taxable, config.OLD_REGIME_SLABS)
        steps.append(TaxStep(
            description="Tax on Taxable Income (slab rates)",
            amount=tax,
            section="Slab",
        ))

        # 87A rebate
        if taxable <= config.REBATE_87A_OLD_LIMIT:
            rebate = min(tax, config.REBATE_87A_OLD_AMOUNT)
            tax -= rebate
            steps.append(TaxStep(
                description="Less: Rebate u/s 87A",
                amount=-rebate,
                section="87A",
            ))

        # Cess
        cess = tax * config.CESS_RATE
        total_tax = tax + cess
        steps.append(TaxStep(
            description="Add: Health & Education Cess (4%)",
            amount=cess,
            section="Cess",
        ))
        steps.append(TaxStep(
            description="Total Tax Payable (Old Regime)",
            amount=total_tax,
            section="Total",
        ))

        return taxable, total_tax, steps

    def _calculate_tax_new_regime(
        self, profile: UserFinancialProfile
    ) -> tuple[float, float, List[TaxStep]]:
        """
        Calculate tax under NEW regime — pure Python.
        Returns: (taxable_income, total_tax, steps)
        """
        steps = []
        gross = profile.annual_income
        steps.append(TaxStep(
            description="Gross Total Income", amount=gross, section="Gross"
        ))

        # Standard deduction only
        taxable = gross - config.STANDARD_DEDUCTION_NEW
        steps.append(TaxStep(
            description="Less: Standard Deduction",
            amount=-config.STANDARD_DEDUCTION_NEW,
            section="Std Deduction",
        ))

        taxable = max(0, taxable)
        steps.append(TaxStep(
            description="Taxable Income (New Regime)",
            amount=taxable,
            section="Computed",
        ))

        # Apply slab rates
        tax = self._apply_slab_rates(taxable, config.NEW_REGIME_SLABS)
        steps.append(TaxStep(
            description="Tax on Taxable Income (slab rates)",
            amount=tax,
            section="Slab",
        ))

        # 87A rebate
        if taxable <= config.REBATE_87A_NEW_LIMIT:
            rebate = min(tax, config.REBATE_87A_NEW_AMOUNT)
            tax -= rebate
            steps.append(TaxStep(
                description="Less: Rebate u/s 87A",
                amount=-rebate,
                section="87A",
            ))

        # Cess
        cess = tax * config.CESS_RATE
        total_tax = tax + cess
        steps.append(TaxStep(
            description="Add: Health & Education Cess (4%)",
            amount=cess,
            section="Cess",
        ))
        steps.append(TaxStep(
            description="Total Tax Payable (New Regime)",
            amount=total_tax,
            section="Total",
        ))

        return taxable, total_tax, steps

    @staticmethod
    def _apply_slab_rates(income: float, slabs: list) -> float:
        """Apply progressive slab-based tax rates."""
        tax = 0.0
        prev_limit = 0.0
        for limit, rate in slabs:
            if income <= prev_limit:
                break
            taxable_in_slab = min(income, limit) - prev_limit
            tax += taxable_in_slab * rate
            prev_limit = limit
        return tax

    def _find_missed_deductions(
        self, profile: UserFinancialProfile
    ) -> List[str]:
        """Identify deductions the user is not fully utilising."""
        missed = []
        sec_80c = profile.section_80c or 0
        if sec_80c < config.SECTION_80C_LIMIT:
            gap = config.SECTION_80C_LIMIT - sec_80c
            missed.append(
                f"Section 80C: ₹{gap:,.0f} unused out of ₹1.5L limit. "
                f"Consider PPF, ELSS, or life insurance premiums."
            )
        if not profile.nps_contribution or profile.nps_contribution == 0:
            missed.append(
                f"Section 80CCD(1B): ₹50,000 additional NPS deduction not utilised. "
                f"Opens extra tax saving beyond 80C limit."
            )
        if not profile.medical_insurance_premium:
            missed.append(
                "Section 80D: No health insurance premium declared. "
                "Get a ₹10L+ family floater — deduction up to ₹25,000 (self) + ₹50,000 (parents)."
            )
        if not profile.home_loan_interest:
            missed.append(
                "Section 24(b): No home loan interest declared. "
                "If you have a home loan, claim up to ₹2L deduction."
            )
        return missed

    def generate_tax_analysis(
        self, profile: UserFinancialProfile
    ) -> TaxRegimeComparison:
        """
        Generate step-by-step tax regime comparison.

        Tax math is done in Python for accuracy.
        LLM is used to generate additional instrument suggestions.
        """
        old_taxable, old_tax, old_steps = self._calculate_tax_old_regime(profile)
        new_taxable, new_tax, new_steps = self._calculate_tax_new_regime(profile)

        recommended = "old" if old_tax <= new_tax else "new"
        savings = abs(old_tax - new_tax)
        missed = self._find_missed_deductions(profile)

        # Use LLM to generate instrument suggestions
        instruments = self._generate_instrument_suggestions(profile, missed)

        return TaxRegimeComparison(
            gross_income=profile.annual_income,
            old_regime_steps=old_steps,
            old_taxable_income=old_taxable,
            old_total_tax=old_tax,
            new_regime_steps=new_steps,
            new_taxable_income=new_taxable,
            new_total_tax=new_tax,
            recommended_regime=recommended,
            savings_amount=savings,
            missed_deductions=missed,
            additional_instruments=instruments,
        )

    def _generate_instrument_suggestions(
        self,
        profile: UserFinancialProfile,
        missed_deductions: List[str],
    ) -> List[TaxInstrumentSuggestion]:
        """Use LLM to suggest 2-3 tax-saving instruments."""
        prompt = f"""Based on this investor profile, suggest exactly 3 tax-saving instruments
ranked by suitability.

Profile: Age {profile.age}, Income ₹{profile.annual_income:,.0f}, 
Risk profile: {profile.risk_profile.value}
Current gaps: {json.dumps(missed_deductions)}

Return a JSON array of exactly 3 objects, each with:
- name, section, max_limit (number), expected_return (string like "7-9%"),
  liquidity (low/medium/high), risk (low/medium/high), rationale

Return ONLY the JSON array: [{{"name": "...", ...}}, ...]"""

        try:
            response = self._call_llm(prompt)
            parsed = self._parse_json_response(response)
            if not isinstance(parsed, list):
                parsed = [parsed]

            instruments = []
            for item in parsed[:3]:
                instruments.append(TaxInstrumentSuggestion(
                    name=item.get("name", ""),
                    section=item.get("section", ""),
                    max_limit=float(item.get("max_limit", 0)),
                    expected_return=item.get("expected_return", ""),
                    liquidity=item.get("liquidity", "medium"),
                    risk=item.get("risk", "medium"),
                    rationale=item.get("rationale", ""),
                ))
            return instruments
        except Exception as e:
            logger.warning(f"Failed to generate instrument suggestions: {e}")
            # Fallback: return hardcoded sensible defaults
            return [
                TaxInstrumentSuggestion(
                    name="ELSS Mutual Fund",
                    section="80C",
                    max_limit=150000,
                    expected_return="10-14%",
                    liquidity="medium",
                    risk="medium",
                    rationale="Shortest lock-in (3 years) among 80C instruments with equity market returns",
                ),
                TaxInstrumentSuggestion(
                    name="NPS Tier-1",
                    section="80CCD(1B)",
                    max_limit=50000,
                    expected_return="8-10%",
                    liquidity="low",
                    risk="medium",
                    rationale="Additional ₹50K deduction beyond 80C limit, market-linked returns",
                ),
                TaxInstrumentSuggestion(
                    name="PPF (Public Provident Fund)",
                    section="80C",
                    max_limit=150000,
                    expected_return="7.1%",
                    liquidity="low",
                    risk="low",
                    rationale="Sovereign guarantee, tax-free returns, part of 80C limit",
                ),
            ]

    # =========================================================================
    # 4. HEALTH SCORE
    # =========================================================================

    def generate_health_score(
        self,
        analytics: PortfolioAnalytics,
        profile: UserFinancialProfile,
    ) -> List[HealthScoreDimension]:
        """
        Generate 6-dimension Money Health Score.

        Uses LLM to evaluate and score each dimension based on portfolio data.
        """
        portfolio_summary = {
            "total_value": analytics.total_current_value,
            "total_invested": analytics.total_invested,
            "overall_xirr": analytics.overall_xirr,
            "num_funds": len(analytics.holdings),
            "expense_drag_inr": analytics.expense_ratio_drag_inr,
            "category_allocation": analytics.category_allocation,
            "amc_allocation": analytics.amc_allocation,
            "overlap_count": len(analytics.overlap_matrix),
            "holdings": [
                {
                    "fund": h.fund_name,
                    "category": h.category.value,
                    "value": h.current_value,
                    "expense_ratio": h.expense_ratio,
                    "plan_type": h.plan_type.value,
                    "holding_days": h.holding_period_days,
                    "is_stcg": h.is_stcg_eligible,
                }
                for h in analytics.holdings
            ],
        }

        prompt = f"""Evaluate this mutual fund portfolio across exactly 6 health dimensions.
Score each 0-100 and provide rationale + improvement suggestions.

PORTFOLIO:
{json.dumps(portfolio_summary, indent=2)}

INVESTOR:
- Age: {profile.age}, Risk Profile: {profile.risk_profile.value}
- Monthly Expenses: ₹{profile.monthly_expenses:,.0f}
- Target Retirement Age: {profile.target_retirement_age}

DIMENSIONS (score each):
1. diversification — category spread, AMC spread, single fund concentration
2. cost_efficiency — expense ratios vs category averages, regular vs direct gap
3. tax_efficiency — STCG exposure, ELSS utilisation, holding period
4. risk_alignment — actual allocation vs risk profile match
5. goal_readiness — current trajectory vs retirement target, SIP adequacy
6. liquidity — liquid/short-term fund allocation, emergency corpus

Return a JSON array of exactly 6 objects:
[{{"dimension": "diversification", "score": 72, "rationale": "...", "suggestions": ["...", "..."]}}, ...]

Return ONLY the JSON array."""

        response = self._call_llm(prompt)
        parsed = self._parse_json_response(response)

        if not isinstance(parsed, list):
            parsed = [parsed]

        dimensions = []
        for item in parsed:
            try:
                dimensions.append(HealthScoreDimension(
                    dimension=item["dimension"],
                    score=float(item["score"]),
                    rationale=item.get("rationale", ""),
                    suggestions=item.get("suggestions", []),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse health score dimension: {e}")

        return dimensions

    # =========================================================================
    # LangGraph Node Function
    # =========================================================================

    def run(self, state: dict) -> dict:
        """
        LangGraph node function.

        Reads analytics and user_profile from state.
        Produces advisory_report with rebalancing, FIRE, tax, and health score.

        Args:
            state: PipelineState as dict (LangGraph convention)

        Returns:
            Partial state update with advisory_report populated
        """
        logger.info("AdvisoryAgent: Starting advisory analysis...")
        audit_trail = []
        errors = state.get("errors", [])

        # Parse state inputs
        analytics_data = state.get("analytics")
        profile_data = state.get("user_profile")

        if analytics_data and isinstance(analytics_data, dict):
            analytics = PortfolioAnalytics(**analytics_data)
        elif isinstance(analytics_data, PortfolioAnalytics):
            analytics = analytics_data
        else:
            analytics = None

        if profile_data and isinstance(profile_data, dict):
            profile = UserFinancialProfile(**profile_data)
        elif isinstance(profile_data, UserFinancialProfile):
            profile = profile_data
        else:
            profile = None

        # 1. Rebalancing Plan (needs analytics + profile)
        rebalancing_plan = []
        if analytics and profile:
            try:
                rebalancing_plan = self.generate_rebalancing_plan(analytics, profile)
                audit_trail.append(
                    f"[Rebalancing] Generated {len(rebalancing_plan)} actions "
                    f"for {len(analytics.holdings)} holdings"
                )
            except Exception as e:
                err = f"AdvisoryAgent: Rebalancing failed — {e}"
                logger.error(err)
                errors.append(err)
                audit_trail.append(f"[Rebalancing] FAILED: {e}")
        else:
            audit_trail.append("[Rebalancing] Skipped — missing analytics or profile")

        # 2. FIRE Plan (needs profile only)
        fire_plan = None
        if profile and profile.target_monthly_corpus > 0:
            try:
                fire_plan = self.generate_fire_plan(profile)
                audit_trail.append(
                    f"[FIRE] Target corpus ₹{fire_plan.target_corpus:,.0f}, "
                    f"SIP needed ₹{fire_plan.monthly_sip_required:,.0f}/month, "
                    f"{fire_plan.years_to_retirement} years"
                )
            except Exception as e:
                err = f"AdvisoryAgent: FIRE plan failed — {e}"
                logger.error(err)
                errors.append(err)
                audit_trail.append(f"[FIRE] FAILED: {e}")
        else:
            audit_trail.append("[FIRE] Skipped — no target monthly corpus provided")

        # 3. Tax Analysis (needs profile with tax inputs)
        tax_analysis = None
        if profile and profile.annual_income > 0:
            try:
                tax_analysis = self.generate_tax_analysis(profile)
                audit_trail.append(
                    f"[Tax] Recommended: {tax_analysis.recommended_regime} regime, "
                    f"saves ₹{tax_analysis.savings_amount:,.0f}"
                )
            except Exception as e:
                err = f"AdvisoryAgent: Tax analysis failed — {e}"
                logger.error(err)
                errors.append(err)
                audit_trail.append(f"[Tax] FAILED: {e}")
        else:
            audit_trail.append("[Tax] Skipped — no income data provided")

        # 4. Health Score (needs analytics + profile)
        health_score = []
        if analytics and profile:
            try:
                health_score = self.generate_health_score(analytics, profile)
                avg_score = (
                    sum(d.score for d in health_score) / len(health_score)
                    if health_score
                    else 0
                )
                audit_trail.append(
                    f"[Health] Scored {len(health_score)} dimensions, "
                    f"avg score: {avg_score:.0f}/100"
                )
            except Exception as e:
                err = f"AdvisoryAgent: Health score failed — {e}"
                logger.error(err)
                errors.append(err)
                audit_trail.append(f"[Health] FAILED: {e}")
        else:
            audit_trail.append("[Health] Skipped — missing analytics or profile")

        # Assemble report
        advisory_report = AdvisoryReport(
            rebalancing_plan=rebalancing_plan,
            fire_plan=fire_plan,
            tax_analysis=tax_analysis,
            health_score=health_score,
            audit_trail=audit_trail,
            generated_at=datetime.now().isoformat(),
        )

        logger.info(
            f"AdvisoryAgent: Complete. "
            f"{len(rebalancing_plan)} actions, "
            f"FIRE={'YES' if fire_plan else 'NO'}, "
            f"Tax={'YES' if tax_analysis else 'NO'}, "
            f"{len(health_score)} health dimensions"
        )

        return {
            "advisory_report": advisory_report.model_dump(),
            "current_agent": "advisory_agent",
            "errors": errors,
        }
