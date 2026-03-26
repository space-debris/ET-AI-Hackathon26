"""
Live Gemini smoke validation for Scenario A (FIRE) and Scenario C (rebalancing).

Usage:
    .\.venv\Scripts\python.exe scripts\live_gemini_smoke.py
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from agents.advisory_agent import AdvisoryAgent
from agents.analytics_agent import AnalyticsAgent
from agents.parser_agent import ParserAgent
from shared import config
from shared.schemas import PortfolioAnalytics, RiskProfile, UserFinancialProfile


logger = logging.getLogger("live_gemini_smoke")


def build_profile(retirement_age: int) -> UserFinancialProfile:
    return UserFinancialProfile(
        age=34,
        annual_income=2400000,
        monthly_expenses=80000,
        existing_investments={"MF": 1800000, "PPF": 600000},
        target_retirement_age=retirement_age,
        target_monthly_corpus=150000,
        risk_profile=RiskProfile.MODERATE,
        base_salary=1800000,
        hra_received=360000,
        rent_paid=480000,
        metro_city=True,
        section_80c=150000,
        nps_contribution=50000,
        medical_insurance_premium=25000,
    )


def summarize_fire(plan) -> dict:
    milestone_sample = []
    for milestone in plan.milestones[:3]:
        milestone_sample.append(
            {
                "month": milestone.month,
                "year": milestone.year,
                "total_sip": milestone.total_sip,
                "projected_corpus": milestone.projected_corpus,
            }
        )

    return {
        "target_corpus": plan.target_corpus,
        "years_to_retirement": plan.years_to_retirement,
        "expected_retirement_date": plan.expected_retirement_date,
        "monthly_sip_required": plan.monthly_sip_required,
        "milestone_count": len(plan.milestones),
        "milestone_sample": milestone_sample,
    }


def validate_fire_plan_shift(fire_50, fire_55) -> list[dict]:
    summary_50 = summarize_fire(fire_50)
    summary_55 = summarize_fire(fire_55)
    return [
        {
            "name": "years_to_retirement_updates",
            "passed": fire_55.years_to_retirement > fire_50.years_to_retirement,
            "details": {
                "age_50": fire_50.years_to_retirement,
                "age_55": fire_55.years_to_retirement,
            },
        },
        {
            "name": "target_corpus_updates",
            "passed": fire_55.target_corpus >= fire_50.target_corpus,
            "details": {
                "age_50": fire_50.target_corpus,
                "age_55": fire_55.target_corpus,
            },
        },
        {
            "name": "monthly_sip_updates",
            "passed": fire_55.monthly_sip_required != fire_50.monthly_sip_required,
            "details": {
                "age_50": fire_50.monthly_sip_required,
                "age_55": fire_55.monthly_sip_required,
            },
        },
        {
            "name": "milestone_glidepath_updates",
            "passed": summary_50["milestone_sample"] != summary_55["milestone_sample"],
            "details": {
                "age_50": summary_50["milestone_sample"],
                "age_55": summary_55["milestone_sample"],
            },
        },
    ]


def load_analytics(pdf_path: Path) -> tuple[PortfolioAnalytics, int]:
    parser_agent = ParserAgent()
    raw_text = parser_agent.parse_pdf(str(pdf_path))
    transactions = parser_agent.extract_transactions(raw_text)
    analytics = AnalyticsAgent().calculate_portfolio(transactions, raw_text=raw_text)
    return analytics, len(transactions)


def validate_rebalancing(actions, analytics: PortfolioAnalytics) -> list[dict]:
    known_funds = {holding.fund_name for holding in analytics.holdings}
    action_text = " ".join(
        f"{action.rationale} {action.tax_impact} {action.target_fund or ''}"
        for action in actions
    ).lower()
    analytics_terms = [term for term in ("overlap", "expense", "direct", "regular") if term in action_text]
    tax_terms = [term for term in ("stcg", "ltcg", "tax") if term in action_text]

    return [
        {
            "name": "actions_are_fund_specific",
            "passed": bool(actions) and all(action.fund_name in known_funds for action in actions),
            "details": [action.fund_name for action in actions],
        },
        {
            "name": "all_actions_include_tax_context",
            "passed": bool(actions) and all(action.tax_impact.strip() for action in actions),
            "details": [action.tax_impact for action in actions],
        },
        {
            "name": "analytics_signals_show_up_in_rationale",
            "passed": bool(analytics_terms),
            "details": analytics_terms,
        },
        {
            "name": "tax_signals_show_up_in_output",
            "passed": bool(tax_terms),
            "details": tax_terms,
        },
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run live Gemini smoke validation.")
    parser.add_argument(
        "--pdf",
        default=str(PROJECT_ROOT / "data" / "sample_cams_detailed.pdf"),
        help="Path to the Scenario C PDF sample.",
    )
    parser.add_argument(
        "--model",
        default=config.GEMINI_MODEL,
        help="Gemini model id to use for the live smoke run.",
    )
    args = parser.parse_args()

    if not config.GEMINI_API_KEY:
        print("GEMINI_API_KEY is not configured in the environment.", file=sys.stderr)
        return 2

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 2

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    advisory = AdvisoryAgent(model_name=args.model)
    profile_50 = build_profile(50)
    profile_55 = build_profile(55)
    result = {
        "scenario_a": {},
        "scenario_c": {"pdf_path": str(pdf_path)},
        "model": args.model,
    }
    fire_checks: list[dict] = []
    rebalancing_checks: list[dict] = []

    try:
        logger.info("Running Scenario A FIRE validation for retirement ages 50 and 55")
        fire_50 = advisory.generate_fire_plan(profile_50)
        fire_55 = advisory.generate_fire_plan(profile_55)
        fire_checks = validate_fire_plan_shift(fire_50, fire_55)
        result["scenario_a"] = {
            "status": "passed" if all(check["passed"] for check in fire_checks) else "failed",
            "retirement_age_50": summarize_fire(fire_50),
            "retirement_age_55": summarize_fire(fire_55),
            "checks": fire_checks,
        }
    except Exception as exc:
        result["scenario_a"] = {
            "status": "error",
            "error": str(exc),
        }

    analytics, transaction_count = load_analytics(pdf_path)
    result["scenario_c"].update(
        {
            "transaction_count": transaction_count,
            "holding_count": len(analytics.holdings),
            "overlap_count": len(analytics.overlap_matrix),
            "expense_ratio_drag_inr": analytics.expense_ratio_drag_inr,
        }
    )
    logger.info(
        "Parsed %s transactions across %s holdings; overlap=%s expense_drag=%.2f",
        transaction_count,
        len(analytics.holdings),
        len(analytics.overlap_matrix),
        analytics.expense_ratio_drag_inr,
    )

    try:
        logger.info("Running Scenario C rebalancing validation")
        rebalancing_actions = advisory.generate_rebalancing_plan(analytics, profile_50)
        rebalancing_checks = validate_rebalancing(rebalancing_actions, analytics)
        result["scenario_c"].update(
            {
                "status": "passed" if all(check["passed"] for check in rebalancing_checks) else "failed",
                "actions": [
                    {
                        "fund_name": action.fund_name,
                        "action": action.action.value,
                        "target_fund": action.target_fund,
                        "tax_impact": action.tax_impact,
                        "rationale": action.rationale,
                        "priority": action.priority,
                    }
                    for action in rebalancing_actions
                ],
                "checks": rebalancing_checks,
            }
        )
    except Exception as exc:
        result["scenario_c"].update(
            {
                "status": "error",
                "error": str(exc),
            }
        )

    print(json.dumps(result, indent=2))

    failed_checks = [
        check["name"]
        for check in fire_checks + rebalancing_checks
        if not check["passed"]
    ]
    has_errors = any(
        scenario.get("status") == "error"
        for scenario in (result["scenario_a"], result["scenario_c"])
    )
    if failed_checks or has_errors:
        failure_summary = ", ".join(failed_checks) if failed_checks else "runtime error"
        logger.error("Smoke validation failed: %s", failure_summary)
        return 1

    logger.info("Smoke validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
