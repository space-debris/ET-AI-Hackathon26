"""
FinSage AI — LangGraph Orchestrator (Mayur)
=============================================
Wires up the 4-agent pipeline using LangGraph StateGraph:
    Parser → Analytics → Advisory → Compliance

Supports:
- Full pipeline (PDF + profile → FinalReport)
- Partial pipeline (profile-only → FIRE + Tax + Health)
- Graceful error recovery at each node
- Conditional routing based on available data

Dependencies: langgraph, agents/*, shared/schemas.py
"""

import logging
from typing import Any, Dict, Optional, TypedDict, List, Annotated
from datetime import datetime

from langgraph.graph import StateGraph, END

from shared.schemas import (
    PipelineState,
    UserFinancialProfile,
    FinalReport,
    PortfolioAnalytics,
    AdvisoryReport,
    Transaction,
)

logger = logging.getLogger(__name__)


# =============================================================================
# LangGraph State TypedDict
# =============================================================================

class GraphState(TypedDict, total=False):
    """LangGraph state — mirrors PipelineState but as TypedDict for LangGraph."""
    # Input
    pdf_path: Optional[str]
    raw_text: Optional[str]
    user_profile: Optional[dict]

    # Parser output
    transactions: list

    # Analytics output
    analytics: Optional[dict]

    # Advisory output
    advisory_report: Optional[dict]

    # Compliance output
    final_report: Optional[dict]

    # Metadata
    errors: list
    current_agent: Optional[str]
    pipeline_status: str


# =============================================================================
# Orchestrator
# =============================================================================

class FinSageOrchestrator:
    """
    LangGraph pipeline orchestrator for the FinSage AI system.

    Flow:
        START → parser_node → analytics_node → advisory_node → compliance_node → END
                    ↓ (on error or no pdf)
            skip to advisory_node (profile-only mode)

    Usage:
        >>> orchestrator = FinSageOrchestrator()
        >>> result = orchestrator.run_pipeline(
        ...     pdf_path="data/sample_cams.pdf",
        ...     user_profile=UserFinancialProfile(age=34, ...)
        ... )
    """

    def __init__(self):
        self.graph = self._build_graph()
        self.compiled_graph = self.graph.compile()
        logger.info("FinSageOrchestrator: Pipeline graph compiled successfully")

    # =========================================================================
    # Node Functions
    # =========================================================================

    @staticmethod
    def _parser_node(state: dict) -> dict:
        """Node 1: Parse CAMS PDF into transactions."""
        logger.info("Pipeline: Running Parser Agent...")
        try:
            from agents.parser_agent import ParserAgent
            agent = ParserAgent()
            return agent.run(state)
        except Exception as e:
            error_msg = f"Parser Agent failed: {e}"
            logger.error(error_msg)
            errors = state.get("errors", [])
            errors.append(error_msg)
            return {
                "transactions": [],
                "current_agent": "parser",
                "errors": errors,
            }

    @staticmethod
    def _analytics_node(state: dict) -> dict:
        """Node 2: Compute portfolio analytics from transactions."""
        logger.info("Pipeline: Running Analytics Agent...")
        transactions = state.get("transactions", [])
        if not transactions:
            logger.warning("Analytics Agent: No transactions to analyse — skipping")
            return {
                "analytics": None,
                "current_agent": "analytics",
            }
        try:
            from agents.analytics_agent import AnalyticsAgent
            agent = AnalyticsAgent()
            return agent.run(state)
        except Exception as e:
            error_msg = f"Analytics Agent failed: {e}"
            logger.error(error_msg)
            errors = state.get("errors", [])
            errors.append(error_msg)
            return {
                "analytics": None,
                "current_agent": "analytics",
                "errors": errors,
            }

    @staticmethod
    def _advisory_node(state: dict) -> dict:
        """Node 3: Generate advisory recommendations using LLM."""
        logger.info("Pipeline: Running Advisory Agent...")
        try:
            from agents.advisory_agent import AdvisoryAgent
            agent = AdvisoryAgent()
            return agent.run(state)
        except Exception as e:
            error_msg = f"Advisory Agent failed: {e}"
            logger.error(error_msg)
            errors = state.get("errors", [])
            errors.append(error_msg)
            return {
                "advisory_report": None,
                "current_agent": "advisory_agent",
                "errors": errors,
            }

    @staticmethod
    def _compliance_node(state: dict) -> dict:
        """Node 4: Compliance scanning and disclaimer addition."""
        logger.info("Pipeline: Running Compliance Agent...")
        try:
            from agents.compliance_agent import ComplianceAgent
            agent = ComplianceAgent()
            return agent.run(state)
        except Exception as e:
            error_msg = f"Compliance Agent failed: {e}"
            logger.error(error_msg)
            errors = state.get("errors", [])
            errors.append(error_msg)
            return {
                "final_report": None,
                "current_agent": "compliance_agent",
                "pipeline_status": "failed",
                "errors": errors,
            }

    # =========================================================================
    # Routing Functions
    # =========================================================================

    @staticmethod
    def _route_after_start(state: dict) -> str:
        """Decide whether to parse PDF or skip to advisory (profile-only mode)."""
        if state.get("pdf_path"):
            return "parser"
        logger.info("Pipeline: No PDF provided — skipping to advisory (profile-only)")
        return "advisory"

    @staticmethod
    def _route_after_parser(state: dict) -> str:
        """After parsing, always go to analytics (even if empty — analytics handles it)."""
        return "analytics"

    @staticmethod
    def _route_after_analytics(state: dict) -> str:
        """After analytics, always go to advisory."""
        return "advisory"

    @staticmethod
    def _route_after_advisory(state: dict) -> str:
        """After advisory, go to compliance if we have a report."""
        if state.get("advisory_report"):
            return "compliance"
        logger.warning("Pipeline: No advisory report — ending pipeline")
        return END

    # =========================================================================
    # Graph Construction
    # =========================================================================

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph StateGraph with conditional routing."""
        graph = StateGraph(GraphState)

        # Add nodes
        graph.add_node("parser", self._parser_node)
        graph.add_node("analytics", self._analytics_node)
        graph.add_node("advisory", self._advisory_node)
        graph.add_node("compliance", self._compliance_node)

        # Set entry point with conditional routing
        graph.set_conditional_entry_point(
            self._route_after_start,
            {"parser": "parser", "advisory": "advisory"},
        )

        # Add edges
        graph.add_edge("parser", "analytics")
        graph.add_edge("analytics", "advisory")

        # Conditional edge after advisory
        graph.add_conditional_edges(
            "advisory",
            self._route_after_advisory,
            {"compliance": "compliance", END: END},
        )

        # Compliance always ends the pipeline
        graph.add_edge("compliance", END)

        return graph

    # =========================================================================
    # Public API
    # =========================================================================

    def run_pipeline(
        self,
        pdf_path: Optional[str] = None,
        user_profile: Optional[UserFinancialProfile] = None,
    ) -> dict:
        """
        Execute the complete FinSage pipeline.

        Args:
            pdf_path: Path to CAMS/KFintech PDF statement (optional)
            user_profile: User's financial profile (optional but needed for
                         FIRE planning, tax analysis, and health score)

        Returns:
            Final pipeline state dict containing all intermediate and final results

        Examples:
            # Full pipeline (PDF + Profile)
            result = orchestrator.run_pipeline(
                pdf_path="data/sample_cams.pdf",
                user_profile=UserFinancialProfile(age=34, annual_income=2400000, ...)
            )

            # Profile-only mode (no PDF)
            result = orchestrator.run_pipeline(
                user_profile=UserFinancialProfile(age=34, annual_income=2400000, ...)
            )
        """
        logger.info(
            f"FinSageOrchestrator: Starting pipeline | "
            f"PDF={'YES' if pdf_path else 'NO'} | "
            f"Profile={'YES' if user_profile else 'NO'}"
        )

        # Build initial state
        initial_state: GraphState = {
            "pdf_path": pdf_path,
            "raw_text": None,
            "user_profile": user_profile.model_dump() if user_profile else None,
            "transactions": [],
            "analytics": None,
            "advisory_report": None,
            "final_report": None,
            "errors": [],
            "current_agent": None,
            "pipeline_status": "running",
        }

        # Execute the graph
        try:
            final_state = self.compiled_graph.invoke(initial_state)
            logger.info(
                f"FinSageOrchestrator: Pipeline complete | "
                f"Status={final_state.get('pipeline_status', 'unknown')} | "
                f"Errors={len(final_state.get('errors', []))}"
            )
            return final_state
        except Exception as e:
            logger.error(f"FinSageOrchestrator: Pipeline execution failed: {e}")
            initial_state["errors"].append(f"Pipeline execution failed: {e}")
            initial_state["pipeline_status"] = "failed"
            return initial_state

    def run_pipeline_stream(
        self,
        pdf_path: Optional[str] = None,
        user_profile: Optional[UserFinancialProfile] = None,
    ):
        """
        Execute the pipeline with streaming — yields state updates after each node.
        Useful for real-time UI updates in Streamlit.

        Yields:
            dict: State update from each node as it completes
        """
        logger.info("FinSageOrchestrator: Starting streaming pipeline...")

        initial_state: GraphState = {
            "pdf_path": pdf_path,
            "raw_text": None,
            "user_profile": user_profile.model_dump() if user_profile else None,
            "transactions": [],
            "analytics": None,
            "advisory_report": None,
            "final_report": None,
            "errors": [],
            "current_agent": None,
            "pipeline_status": "running",
        }

        try:
            for state_update in self.compiled_graph.stream(initial_state):
                yield state_update
        except Exception as e:
            logger.error(f"FinSageOrchestrator: Streaming failed: {e}")
            yield {
                "errors": [f"Pipeline streaming failed: {e}"],
                "pipeline_status": "failed",
            }

    def get_graph_visualization(self) -> str:
        """Return a Mermaid diagram of the pipeline for documentation."""
        return """
graph LR
    START((Start)) --> |has PDF| P[Parser Agent]
    START --> |no PDF| A[Advisory Agent]
    P --> AN[Analytics Agent]
    AN --> A
    A --> |has report| C[Compliance Agent]
    A --> |no report| END_NODE((End))
    C --> END_NODE
"""


# =============================================================================
# Convenience function for CLI / testing
# =============================================================================

def run_quick_test():
    """Quick test: run pipeline with profile-only mode (no PDF)."""
    from shared.schemas import UserFinancialProfile, RiskProfile

    profile = UserFinancialProfile(
        age=34,
        annual_income=2400000,
        monthly_expenses=80000,
        existing_investments={"MF": 1800000, "PPF": 600000},
        target_retirement_age=50,
        target_monthly_corpus=150000,
        risk_profile=RiskProfile.MODERATE,
        base_salary=1800000,
        hra_received=360000,
        rent_paid=240000,
        metro_city=True,
        section_80c=150000,
        nps_contribution=50000,
        home_loan_interest=0,
        medical_insurance_premium=25000,
    )

    orchestrator = FinSageOrchestrator()
    result = orchestrator.run_pipeline(user_profile=profile)

    print(f"\nPipeline Status: {result.get('pipeline_status')}")
    print(f"Errors: {result.get('errors', [])}")
    print(f"Current Agent: {result.get('current_agent')}")

    if result.get("final_report"):
        report = result["final_report"]
        print(f"\nCompliance Cleared: {report.get('compliance_cleared')}")
        print(f"Flagged Items: {len(report.get('flagged_items', []))}")
        if report.get("tax_analysis"):
            tax = report["tax_analysis"]
            print(f"\nTax Recommendation: {tax.get('recommended_regime')} regime")
            print(f"Tax Savings: ₹{tax.get('savings_amount', 0):,.0f}")
        if report.get("fire_plan"):
            fire = report["fire_plan"]
            print(f"\nFIRE Target Corpus: ₹{fire.get('target_corpus', 0):,.0f}")
            print(f"Monthly SIP Required: ₹{fire.get('monthly_sip_required', 0):,.0f}")
    elif result.get("advisory_report"):
        print("\n[Advisory report generated but compliance not run]")

    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_quick_test()
