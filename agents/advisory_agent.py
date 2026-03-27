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
        self.llm_available = bool(config.GEMINI_API_KEY)
        self.llm = None
        if self.llm_available:
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
        if not self.llm_available or self.llm is None:
            raise RuntimeError("GEMINI_API_KEY is not configured for live advisory generation.")

        sys_prompt = system_prompt or self.system_prompt
        messages = [
            SystemMessage(content=sys_prompt),
            HumanMessage(content=user_prompt),
        ]

        for attempt in range(config.MAX_RETRIES):
            try:
                response = self.llm.invoke(messages)
                return self._coerce_response_text(response.content)
            except Exception as e:
                logger.warning(f"LLM call attempt {attempt + 1} failed: {e}")
                if attempt == config.MAX_RETRIES - 1:
                    raise RuntimeError(
                        f"LLM call failed after {config.MAX_RETRIES} attempts: {e}"
                    )
                import time
                time.sleep(config.RETRY_DELAY_SECONDS * (attempt + 1))

    @staticmethod
    def _coerce_response_text(content: Any) -> str:
        """Normalize LangChain/Gemini content blocks into a single text payload."""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                    continue
                if isinstance(item, dict):
                    text = item.get("text") or item.get("content") or ""
                    if text:
                        parts.append(str(text))
                    continue
                text = getattr(item, "text", None) or getattr(item, "content", None)
                if text:
                    parts.append(str(text))
            return "".join(part for part in parts if part).strip()
        return str(content)

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
            sanitized = self._sanitize_json_text(text)
            if sanitized != text:
                try:
                    return json.loads(sanitized)
                except json.JSONDecodeError:
                    pass

            logger.error(f"Failed to parse LLM JSON response: {e}\nRaw: {text[:500]}")
            raise ValueError(f"LLM returned invalid JSON: {e}")

    @staticmethod
    def _sanitize_json_text(text: str) -> str:
        """
        Best-effort cleanup for malformed LLM JSON.

        Gemini occasionally emits literal newlines or tabs inside quoted strings,
        which breaks strict JSON parsing even when the overall payload is recoverable.
        """
        cleaned = []
        in_string = False
        escaped = False

        for char in text:
            if char == '"' and not escaped:
                in_string = not in_string
                cleaned.append(char)
                continue

            if in_string and char in {"\n", "\r", "\t"}:
                cleaned.append({
                    "\n": "\\n",
                    "\r": "\\r",
                    "\t": "\\t",
                }[char])
                escaped = False
                continue

            cleaned.append(char)
            if char == "\\" and not escaped:
                escaped = True
            else:
                escaped = False

        return "".join(cleaned)

    # =========================================================================
    # 1. REBALANCING PLAN
    # =========================================================================

    @staticmethod
    def _safe_pct(value: float) -> float:
        return max(0.0, min(100.0, float(value)))

    @staticmethod
    def _format_inr(value: float) -> str:
        return f"₹{value:,.0f}"

    def _generate_deterministic_rebalancing_plan(
        self,
        analytics: PortfolioAnalytics,
        profile: UserFinancialProfile,
    ) -> List[RebalancingAction]:
        actions: List[RebalancingAction] = []
        category_totals = analytics.category_allocation or {}
        large_category = max(category_totals.values(), default=0.0)
        overlap_stocks = set(analytics.overlap_matrix.keys())

        for holding in analytics.holdings:
            rationale_parts: List[str] = []
            tax_impact = "Review capital-gains impact before switching."
            priority = 3
            percentage: Optional[float] = None
            target_fund: Optional[str] = None
            action = RebalancingActionType.HOLD

            expense_gap = (
                (holding.expense_ratio - holding.direct_expense_ratio)
                if holding.direct_expense_ratio is not None
                else 0.0
            )
            overlap_count = sum(
                1
                for stock in overlap_stocks
                if holding.fund_name in analytics.overlap_matrix.get(stock, {})
            )
            category_key = holding.category.value if holding.category else "other"
            category_weight = category_totals.get(category_key, 0.0)
            underperforming = (holding.xirr or 0.0) < max(analytics.overall_xirr - 0.03, 0.08)

            if holding.plan_type == "regular" or getattr(holding.plan_type, "value", None) == "regular":
                if expense_gap > 0.003:
                    action = RebalancingActionType.SWITCH
                    priority = 1
                    target_fund = f"{holding.fund_name} Direct Plan"
                    annual_drag = holding.current_value * expense_gap
                    tax_impact = (
                        "Likely LTCG-friendly if held over one year."
                        if not holding.is_stcg_eligible
                        else "STCG may apply if switched before one year."
                    )
                    rationale_parts.append(
                        f"Switching can reduce annual cost drag by about {self._format_inr(annual_drag)}."
                    )

            if action == RebalancingActionType.HOLD and overlap_count >= 1 and category_weight >= 35:
                action = RebalancingActionType.REDUCE
                percentage = 10 if overlap_count == 1 else 15
                priority = 2
                tax_impact = (
                    "STCG may apply if units are held for less than one year."
                    if holding.is_stcg_eligible
                    else "LTCG rules may apply on realised gains."
                )
                rationale_parts.append(
                    f"The fund overlaps on {overlap_count} recurring stock signal(s) inside a {category_weight:.1f}% category tilt."
                )

            if action == RebalancingActionType.HOLD and underperforming and holding.unrealised_gain_pct > 20:
                action = RebalancingActionType.REDUCE
                percentage = 10
                priority = 3
                tax_impact = (
                    "Review realised gains before trimming."
                    if holding.unrealised_gain > 0
                    else "Minimal tax friction if gains are limited."
                )
                rationale_parts.append(
                    f"Fund XIRR of {(holding.xirr or 0.0) * 100:.1f}% is lagging the portfolio trend."
                )

            if action == RebalancingActionType.HOLD:
                tax_impact = (
                    "No immediate tax action required."
                    if not holding.is_stcg_eligible
                    else "Avoid unnecessary churn while units are still in STCG period."
                )
                rationale_parts.append(
                    f"The holding remains broadly aligned with a {profile.risk_profile.value} risk profile."
                )

            rationale_parts.append(
                f"Current value is {self._format_inr(holding.current_value)} with {(holding.xirr or analytics.overall_xirr) * 100:.1f}% XIRR."
            )

            actions.append(
                RebalancingAction(
                    fund_name=holding.fund_name,
                    action=action,
                    percentage=percentage,
                    amount_inr=None,
                    target_fund=target_fund,
                    tax_impact=tax_impact,
                    rationale=" ".join(rationale_parts),
                    priority=priority,
                )
            )

        return actions

    def _generate_deterministic_health_score(
        self,
        analytics: PortfolioAnalytics,
        profile: UserFinancialProfile,
    ) -> List[HealthScoreDimension]:
        holdings = analytics.holdings
        total_value = analytics.total_current_value or 1.0
        overlap_count = len(analytics.overlap_matrix)
        regular_count = sum(1 for holding in holdings if holding.plan_type.value == "regular")
        short_term_count = sum(1 for holding in holdings if holding.is_stcg_eligible)
        emergency_months = total_value / max(profile.monthly_expenses, 1) if profile.monthly_expenses > 0 else 0
        years_to_retirement = max(profile.target_retirement_age - profile.age, 0)
        target_corpus = self.generate_fire_plan(profile).target_corpus if profile.target_monthly_corpus > 0 else 0
        goal_progress = (
            analytics.total_current_value / target_corpus if target_corpus > 0 else 0
        )

        category_count = len([weight for weight in analytics.category_allocation.values() if weight > 0])
        max_category = max(analytics.category_allocation.values(), default=100.0)
        max_amc = max(analytics.amc_allocation.values(), default=100.0)
        diversification_score = self._safe_pct(
            45 + category_count * 10 - max(0, max_category - 35) - max(0, max_amc - 45) - overlap_count * 6
        )

        avg_expense = (
            sum(holding.expense_ratio for holding in holdings) / len(holdings)
            if holdings
            else 0.0
        )
        cost_efficiency_score = self._safe_pct(
            92 - regular_count * 12 - analytics.expense_ratio_drag_inr / 2500 - avg_expense * 1200
        )

        tax_efficiency_score = self._safe_pct(
            88 - short_term_count * 18 - max(0, regular_count - 1) * 4
        )

        equity_categories = {FundCategory.LARGE_CAP, FundCategory.MID_CAP, FundCategory.SMALL_CAP, FundCategory.FLEXI_CAP, FundCategory.ELSS}
        equity_weight = sum(
            analytics.category_allocation.get(category.value, 0.0)
            for category in equity_categories
        )
        target_equity = {
            RiskProfile.CONSERVATIVE: 45.0,
            RiskProfile.MODERATE: 65.0,
            RiskProfile.AGGRESSIVE: 80.0,
        }.get(profile.risk_profile, 65.0)
        risk_alignment_score = self._safe_pct(
            94 - abs(equity_weight - target_equity) * 1.4
        )

        goal_readiness_score = self._safe_pct(
            35
            + min(goal_progress * 45, 45)
            + min(max(analytics.overall_xirr, 0) * 120, 20)
            + (8 if years_to_retirement >= 10 else 0)
        )

        liquidity_score = self._safe_pct(
            30 + min(emergency_months * 8, 50) + (10 if profile.monthly_expenses <= profile.annual_income / 24 else 0)
        )

        score_map = [
            (
                "diversification",
                diversification_score,
                f"The portfolio is spread across {category_count} active categories with the largest bucket at {max_category:.1f}% and AMC concentration at {max_amc:.1f}%.",
                [
                    "Trim category concentration if a single segment dominates the portfolio.",
                    "Reduce repeated stock overlap across multiple funds."
                ],
            ),
            (
                "cost_efficiency",
                cost_efficiency_score,
                f"{regular_count} fund(s) still look like regular plans and the annual expense drag is about {self._format_inr(analytics.expense_ratio_drag_inr)}.",
                [
                    "Review direct-plan equivalents for regular holdings.",
                    "Prioritise funds with the highest expense gap first."
                ],
            ),
            (
                "tax_efficiency",
                tax_efficiency_score,
                f"{short_term_count} holding(s) may still be inside the STCG window, which can reduce flexibility on exits or switches.",
                [
                    "Avoid unnecessary churn before one year when possible.",
                    "Use ELSS or long-held units more efficiently for tax-aware rebalancing."
                ],
            ),
            (
                "risk_alignment",
                risk_alignment_score,
                f"Equity-oriented allocation is about {equity_weight:.1f}% versus an estimated {target_equity:.0f}% range for a {profile.risk_profile.value} profile.",
                [
                    "Adjust the equity-debt mix if the portfolio is drifting away from your risk profile.",
                    "Review mid-cap and sector concentration during volatility."
                ],
            ),
            (
                "goal_readiness",
                goal_readiness_score,
                f"Current corpus of {self._format_inr(analytics.total_current_value)} is building toward the retirement goal over the next {years_to_retirement} years.",
                [
                    "Increase SIPs when surplus improves to accelerate goal progress.",
                    "Review the retirement target yearly against inflation."
                ],
            ),
            (
                "liquidity",
                liquidity_score,
                f"The current portfolio value covers roughly {emergency_months:.1f} month(s) of expenses at the current burn rate.",
                [
                    "Keep a dedicated emergency buffer outside long-term market-linked allocations.",
                    "Add liquid or low-volatility assets if near-term cash needs are rising."
                ],
            ),
        ]

        return [
            HealthScoreDimension(
                dimension=dimension,
                score=round(score, 1),
                rationale=rationale,
                suggestions=suggestions,
            )
            for dimension, score, rationale, suggestions in score_map
        ]

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
        try:
            response = self._call_llm(user_prompt)
            parsed = self._parse_json_response(response)
        except Exception as exc:
            logger.warning("Falling back to deterministic rebalancing plan: %s", exc)
            return self._generate_deterministic_rebalancing_plan(analytics, profile)

        # Ensure it's a list
        if isinstance(parsed, dict) and "rebalancing_plan" in parsed:
            parsed = parsed["rebalancing_plan"]
        if not isinstance(parsed, list):
            parsed = [parsed]

        actions = []
        valid_fund_names = {holding.fund_name for holding in analytics.holdings}
        for item in parsed:
            try:
                fund_name = item.get("fund_name")
                if not fund_name or fund_name not in valid_fund_names:
                    logger.warning(
                        "Skipping rebalancing action for unknown holding: %s",
                        fund_name,
                    )
                    continue
                action_type = item.get("action", "hold").lower()
                actions.append(RebalancingAction(
                    fund_name=fund_name,
                    action=RebalancingActionType(action_type),
                    percentage=item.get("percentage"),
                    amount_inr=item.get("amount_inr"),
                    target_fund=item.get("target_fund"),
                    tax_impact=item.get("tax_impact") or "",
                    rationale=item.get("rationale") or "",
                    priority=item.get("priority", 3),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse rebalancing action: {e}, item: {item}")
                continue

        return actions or self._generate_deterministic_rebalancing_plan(analytics, profile)

    # =========================================================================
    # 2. FIRE PLAN
    # =========================================================================

    def generate_fire_plan(
        self, profile: UserFinancialProfile
    ) -> FIREPlan:
        """
        Generate a comprehensive FIRE Path Plan with deterministic local math.

        This intentionally avoids LLM latency and retry variance so the
        standalone FIRE planner remains fast and reliable.
        """
        existing_corpus = sum(profile.existing_investments.values())
        current_sip = max(0, profile.annual_income / 12 - profile.monthly_expenses)
        years_to_retirement = max(profile.target_retirement_age - profile.age, 0)
        inflation_factor = (1 + config.ASSUMED_INFLATION_RATE) ** years_to_retirement
        annual_retirement_need = profile.target_monthly_corpus * 12 * inflation_factor
        target_corpus = (
            annual_retirement_need / config.SAFE_WITHDRAWAL_RATE
            if config.SAFE_WITHDRAWAL_RATE > 0
            else 0.0
        )
        monthly_sip_required = self._solve_required_monthly_sip(
            profile,
            target_corpus,
            years_to_retirement,
        )
        milestones, projected_corpus = self._simulate_fire_path(
            profile,
            monthly_sip_required,
            years_to_retirement,
        )
        expected_retirement_date = self._format_year_month_offset(years_to_retirement * 12)
        insurance_gap = self._estimate_insurance_gap(profile, existing_corpus)
        at_current_trajectory = self._estimate_fire_trajectory(
            profile,
            target_corpus,
            current_sip,
            years_to_retirement,
        )

        return FIREPlan(
            current_corpus=round(existing_corpus, 2),
            target_corpus=round(target_corpus, 2),
            years_to_retirement=years_to_retirement,
            expected_retirement_date=expected_retirement_date,
            monthly_sip_required=round(monthly_sip_required, 2),
            milestones=milestones,
            insurance_gap=insurance_gap,
            assumptions={
                "inflation_rate": config.ASSUMED_INFLATION_RATE,
                "equity_return": config.ASSUMED_EQUITY_RETURN,
                "debt_return": config.ASSUMED_DEBT_RETURN,
                "gold_return": config.ASSUMED_GOLD_RETURN,
                "swr": config.SAFE_WITHDRAWAL_RATE,
                "projected_corpus_at_retirement": round(projected_corpus, 2),
            },
            at_current_trajectory=at_current_trajectory,
        )

    @staticmethod
    def _get_fire_allocation(risk_profile: RiskProfile, year_index: int, years_to_retirement: int) -> tuple[float, float, float]:
        base_allocations = {
            RiskProfile.CONSERVATIVE: (45.0, 45.0, 10.0, 30.0),
            RiskProfile.MODERATE: (65.0, 25.0, 10.0, 35.0),
            RiskProfile.AGGRESSIVE: (80.0, 15.0, 5.0, 40.0),
        }
        base_equity, _, gold_pct, floor_equity = base_allocations.get(
            risk_profile,
            base_allocations[RiskProfile.MODERATE],
        )
        if years_to_retirement <= 1:
            equity_pct = floor_equity if years_to_retirement == 0 else base_equity
        else:
            reduction_span = years_to_retirement - 1
            reduction = ((base_equity - floor_equity) * min(year_index, reduction_span)) / reduction_span
            equity_pct = base_equity - reduction

        equity_pct = max(floor_equity, equity_pct)
        debt_pct = max(0.0, 100.0 - equity_pct - gold_pct)
        return round(equity_pct, 1), round(debt_pct, 1), round(gold_pct, 1)

    @staticmethod
    def _blended_annual_return(equity_pct: float, debt_pct: float, gold_pct: float) -> float:
        return (
            (equity_pct / 100.0) * config.ASSUMED_EQUITY_RETURN
            + (debt_pct / 100.0) * config.ASSUMED_DEBT_RETURN
            + (gold_pct / 100.0) * config.ASSUMED_GOLD_RETURN
        )

    @staticmethod
    def _format_year_month_offset(months_ahead: int) -> str:
        now = datetime.now()
        total_month = (now.month - 1) + months_ahead
        year = now.year + (total_month // 12)
        month = (total_month % 12) + 1
        return f"{year:04d}-{month:02d}"

    def _simulate_fire_path(
        self,
        profile: UserFinancialProfile,
        monthly_sip: float,
        years_to_retirement: int,
    ) -> tuple[List[FIREMilestone], float]:
        current_corpus = float(sum(profile.existing_investments.values()))
        if years_to_retirement <= 0:
            equity_pct, debt_pct, gold_pct = self._get_fire_allocation(profile.risk_profile, 0, 0)
            milestone = FIREMilestone(
                month=datetime.now().month,
                year=datetime.now().year,
                equity_sip=round(monthly_sip * equity_pct / 100.0, 2),
                debt_sip=round(monthly_sip * debt_pct / 100.0, 2),
                gold_sip=round(monthly_sip * gold_pct / 100.0, 2),
                total_sip=round(monthly_sip, 2),
                projected_corpus=round(current_corpus, 2),
                equity_pct=equity_pct,
                debt_pct=debt_pct,
                gold_pct=gold_pct,
                notes="Target retirement age is already reached. Review your withdrawal readiness.",
            )
            return [milestone], current_corpus

        milestones: List[FIREMilestone] = []
        corpus = current_corpus
        total_months = years_to_retirement * 12

        for month_offset in range(1, total_months + 1):
            year_index = (month_offset - 1) // 12
            equity_pct, debt_pct, gold_pct = self._get_fire_allocation(
                profile.risk_profile,
                year_index,
                years_to_retirement,
            )
            annual_return = self._blended_annual_return(equity_pct, debt_pct, gold_pct)
            monthly_return = (1 + annual_return) ** (1 / 12) - 1
            corpus = corpus * (1 + monthly_return) + monthly_sip

            if month_offset % 12 == 0 or month_offset == total_months:
                milestone_date = self._format_year_month_offset(month_offset)
                milestone_year, milestone_month = milestone_date.split("-")
                notes = self._build_fire_milestone_note(
                    year_index=year_index,
                    years_to_retirement=years_to_retirement,
                    equity_pct=equity_pct,
                    debt_pct=debt_pct,
                    monthly_sip=monthly_sip,
                )
                milestones.append(
                    FIREMilestone(
                        month=int(milestone_month),
                        year=int(milestone_year),
                        equity_sip=round(monthly_sip * equity_pct / 100.0, 2),
                        debt_sip=round(monthly_sip * debt_pct / 100.0, 2),
                        gold_sip=round(monthly_sip * gold_pct / 100.0, 2),
                        total_sip=round(monthly_sip, 2),
                        projected_corpus=round(corpus, 2),
                        equity_pct=equity_pct,
                        debt_pct=debt_pct,
                        gold_pct=gold_pct,
                        notes=notes,
                    )
                )

        return milestones, corpus

    @staticmethod
    def _build_fire_milestone_note(
        year_index: int,
        years_to_retirement: int,
        equity_pct: float,
        debt_pct: float,
        monthly_sip: float,
    ) -> str:
        if year_index == 0:
            return f"Start with a monthly SIP of about ₹{monthly_sip:,.0f} while keeping equity at {equity_pct:.0f}%."
        if year_index >= years_to_retirement - 1:
            return f"Approach retirement with a more defensive mix: {equity_pct:.0f}% equity and {debt_pct:.0f}% debt."
        return f"Gradually de-risk the portfolio by shifting toward debt as retirement approaches."

    def _solve_required_monthly_sip(
        self,
        profile: UserFinancialProfile,
        target_corpus: float,
        years_to_retirement: int,
    ) -> float:
        current_corpus = float(sum(profile.existing_investments.values()))
        if target_corpus <= current_corpus or years_to_retirement <= 0:
            return max(target_corpus - current_corpus, 0.0)

        _, corpus_without_sip = self._simulate_fire_path(profile, 0.0, years_to_retirement)
        if corpus_without_sip >= target_corpus:
            return 0.0

        lower = 0.0
        upper = max(profile.annual_income / 12, 1000.0)

        while upper < target_corpus:
            _, projected = self._simulate_fire_path(profile, upper, years_to_retirement)
            if projected >= target_corpus:
                break
            upper *= 2
            if upper > 1e8:
                break

        for _ in range(50):
            mid = (lower + upper) / 2
            _, projected = self._simulate_fire_path(profile, mid, years_to_retirement)
            if projected >= target_corpus:
                upper = mid
            else:
                lower = mid

        return upper

    def _estimate_fire_trajectory(
        self,
        profile: UserFinancialProfile,
        target_corpus: float,
        current_sip: float,
        target_years_to_retirement: int,
    ) -> str:
        current_corpus = float(sum(profile.existing_investments.values()))
        if current_corpus >= target_corpus:
            return "Your current corpus already meets the FIRE target."

        if current_sip <= 0:
            return (
                "At the current savings rate, the target corpus is unlikely to be reached. "
                "A positive monthly surplus is needed to move the FIRE date forward."
            )

        max_years = max(config.LIFE_EXPECTANCY - profile.age, target_years_to_retirement)
        corpus = current_corpus
        total_months = max_years * 12

        for month_offset in range(1, total_months + 1):
            year_index = (month_offset - 1) // 12
            equity_pct, debt_pct, gold_pct = self._get_fire_allocation(
                profile.risk_profile,
                year_index,
                max(max_years, 1),
            )
            annual_return = self._blended_annual_return(equity_pct, debt_pct, gold_pct)
            monthly_return = (1 + annual_return) ** (1 / 12) - 1
            corpus = corpus * (1 + monthly_return) + current_sip
            if corpus >= target_corpus:
                target_date = self._format_year_month_offset(month_offset)
                achieved_age = profile.age + (month_offset / 12.0)
                delta_years = (month_offset / 12.0) - target_years_to_retirement
                if abs(delta_years) < 0.5:
                    timing_text = "around your target retirement age"
                elif delta_years < 0:
                    timing_text = f"about {abs(delta_years):.1f} years earlier than your target"
                else:
                    timing_text = f"about {delta_years:.1f} years later than your target"
                return (
                    f"At the current savings rate of ₹{current_sip:,.0f}/month, "
                    f"the target corpus is projected around {target_date} at age {achieved_age:.1f}, "
                    f"{timing_text}."
                )

        return (
            f"At the current savings rate of ₹{current_sip:,.0f}/month, "
            f"the target corpus is unlikely to be reached before age {config.LIFE_EXPECTANCY}."
        )

    @staticmethod
    def _estimate_insurance_gap(profile: UserFinancialProfile, existing_corpus: float) -> Dict[str, Any]:
        life_cover_gap = max(profile.annual_income * 10 - existing_corpus, 0.0)
        health_cover_recommendation = "Maintain at least a ₹10L family floater health policy."
        return {
            "total_gap": round(life_cover_gap, 2),
            "life_cover_gap": round(life_cover_gap, 2),
            "health_cover_recommendation": health_cover_recommendation,
            "summary": (
                f"Estimated life cover gap: ₹{life_cover_gap:,.0f}. "
                f"{health_cover_recommendation}"
            ),
        }

    @staticmethod
    def _coerce_fire_milestone(milestone: dict) -> FIREMilestone:
        """
        Accept a few common LLM variants for milestone month/year fields.

        Models sometimes emit relative years (1, 5, 10) or combined date strings
        like "2024-07" instead of the strict schema.
        """
        current_year = datetime.now().year
        raw_month = milestone.get("month", 1)
        raw_year = milestone.get("year", current_year)

        if isinstance(raw_year, str):
            raw_year = raw_year.strip()
            if len(raw_year) >= 7 and raw_year[4] == "-" and raw_year[:4].isdigit():
                if "month" not in milestone:
                    raw_month = raw_year[5:7]
                raw_year = raw_year[:4]

        month = int(raw_month) if str(raw_month).strip() else 1
        year = int(raw_year) if str(raw_year).strip() else current_year

        if year < 100:
            year = current_year + max(year - 1, 0)
        month = min(max(month, 1), 12)

        return FIREMilestone(
            month=month,
            year=year,
            equity_sip=milestone.get("equity_sip", 0),
            debt_sip=milestone.get("debt_sip", 0),
            gold_sip=milestone.get("gold_sip", 0),
            total_sip=milestone.get("total_sip", 0),
            projected_corpus=milestone.get("projected_corpus", 0),
            equity_pct=milestone.get("equity_pct", 0),
            debt_pct=milestone.get("debt_pct", 0),
            gold_pct=milestone.get("gold_pct", 0),
            notes=milestone.get("notes"),
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
        """Return deterministic tax-saving suggestions without blocking on LLM runtime."""
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

        try:
            response = self._call_llm(prompt)
            parsed = self._parse_json_response(response)
        except Exception as exc:
            logger.warning("Falling back to deterministic health score: %s", exc)
            return self._generate_deterministic_health_score(analytics, profile)

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

        if len(dimensions) != 6:
            return self._generate_deterministic_health_score(analytics, profile)

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
