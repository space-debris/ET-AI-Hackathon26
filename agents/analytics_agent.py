"""
FinSage AI — Analytics Agent (Abhishek)
=========================================
Calculates portfolio analytics: XIRR, overlap detection, expense ratio drag.

Dependencies: pandas, numpy, scipy, mftool
Input: PipelineState with transactions populated
Output: PipelineState with analytics populated
"""

from typing import List, Dict
from datetime import date

from shared.schemas import (
    Transaction, FundHolding, PortfolioAnalytics, PipelineState, FundCategory, PlanType
)
from shared.schemas import TransactionType
from utils.xirr_calculator import calculate_xirr
from utils.overlap_detector import detect_overlap
from utils.fund_fetcher import get_fund_nav
from utils.factsheet_loader import load_factsheet_index, lookup_factsheet, parse_top_holdings


class AnalyticsAgent:
    """
    Agent 2: Computes portfolio analytics from parsed transactions.
    
    Responsibilities:
    - Calculate true XIRR per fund and overall portfolio
    - Detect stock-level overlap across funds
    - Calculate expense ratio drag vs direct plan equivalents
    - Compute category and AMC allocation breakdown
    
    Owner: Abhishek
    """

    def __init__(self, factsheet_index: Dict[str, Dict] | None = None):
        self.factsheet_index = factsheet_index if factsheet_index is not None else load_factsheet_index()

    @staticmethod
    def _to_fraction(value: float) -> float:
        # Factsheet values are usually in percent terms (e.g., 1.68 for 1.68%).
        # If already a decimal fraction (e.g., 0.0168), keep as-is.
        return value / 100.0 if value >= 0.2 else value

    @staticmethod
    def _infer_category_from_name(fund_name: str) -> FundCategory:
        name = fund_name.lower()
        if "large" in name:
            return FundCategory.LARGE_CAP
        if "mid" in name:
            return FundCategory.MID_CAP
        if "small" in name:
            return FundCategory.SMALL_CAP
        if "flexi" in name:
            return FundCategory.FLEXI_CAP
        if "multi" in name:
            return FundCategory.MULTI_CAP
        if "elss" in name or "tax" in name:
            return FundCategory.ELSS
        if "liquid" in name:
            return FundCategory.LIQUID
        if "debt" in name or "bond" in name:
            return FundCategory.DEBT_MEDIUM
        if "hybrid" in name or "balanced" in name:
            return FundCategory.HYBRID_AGGRESSIVE
        if "index" in name or "nifty" in name or "sensex" in name:
            return FundCategory.INDEX_FUND
        if "international" in name or "global" in name:
            return FundCategory.INTERNATIONAL
        if "sector" in name or "thematic" in name:
            return FundCategory.SECTORAL
        return FundCategory.OTHER

    @staticmethod
    def _infer_plan_type(fund_name: str) -> PlanType:
        return PlanType.DIRECT if "direct" in fund_name.lower() else PlanType.REGULAR

    @staticmethod
    def _signed_units(transaction: Transaction) -> float:
        if transaction.transaction_type in {
            TransactionType.PURCHASE,
            TransactionType.SIP,
            TransactionType.SWITCH_IN,
            TransactionType.DIVIDEND,
        }:
            return abs(transaction.units)
        if transaction.transaction_type in {TransactionType.REDEMPTION, TransactionType.SWITCH_OUT}:
            return -abs(transaction.units)
        return transaction.units

    @staticmethod
    def _is_outflow(transaction: Transaction) -> bool:
        return transaction.transaction_type in {
            TransactionType.PURCHASE,
            TransactionType.SIP,
            TransactionType.SWITCH_IN,
        }

    @staticmethod
    def _is_inflow(transaction: Transaction) -> bool:
        return transaction.transaction_type in {
            TransactionType.REDEMPTION,
            TransactionType.SWITCH_OUT,
            TransactionType.DIVIDEND,
        }

    def calculate_portfolio(self, transactions: List[Transaction]) -> PortfolioAnalytics:
        """
        Process all transactions and compute complete portfolio analytics.
        
        Args:
            transactions: List of parsed Transaction objects
            
        Returns:
            PortfolioAnalytics with all computed metrics
        """
        if not transactions:
            return PortfolioAnalytics(
                holdings=[],
                overall_xirr=0.0,
                fund_wise_xirr={},
                overlap_matrix={},
                overlap_details=[],
                expense_ratio_drag_inr=0.0,
                total_current_value=0.0,
                total_invested=0.0,
                category_allocation={},
                amc_allocation={},
            )

        grouped: Dict[str, List[Transaction]] = {}
        for transaction in sorted(transactions, key=lambda item: item.date):
            grouped.setdefault(transaction.fund_name, []).append(transaction)

        holdings: List[FundHolding] = []
        fund_wise_xirr: Dict[str, float] = {}
        portfolio_cashflows: List[tuple[date, float]] = []

        today = date.today()

        for fund_name, fund_txns in grouped.items():
            units_held = 0.0
            cost_basis = 0.0
            total_inflows = 0.0
            total_outflows = 0.0

            for txn in fund_txns:
                signed_units = self._signed_units(txn)

                if self._is_outflow(txn):
                    flow_amount = abs(txn.amount)
                    portfolio_cashflows.append((txn.date, -flow_amount))
                    units_held += abs(signed_units)
                    cost_basis += flow_amount
                    total_outflows += flow_amount
                elif self._is_inflow(txn):
                    flow_amount = abs(txn.amount)
                    portfolio_cashflows.append((txn.date, flow_amount))

                    units_before = units_held
                    if signed_units < 0:
                        units_redeemed = min(abs(signed_units), max(units_before, 0.0))
                        avg_cost = (cost_basis / units_before) if units_before > 0 else 0.0
                        cost_basis = max(cost_basis - (units_redeemed * avg_cost), 0.0)
                        units_held = max(units_before - units_redeemed, 0.0)

                    total_inflows += flow_amount

            if units_held <= 0:
                continue

            scheme_code = next((txn.isin for txn in fund_txns if txn.isin), None)
            live_nav = get_fund_nav(scheme_code) if scheme_code else None
            fallback_nav = fund_txns[-1].nav if fund_txns and fund_txns[-1].nav > 0 else None
            current_nav = live_nav if live_nav and live_nav > 0 else fallback_nav
            if current_nav is None:
                current_nav = 0.0

            current_value = units_held * current_nav
            first_purchase_date = min(txn.date for txn in fund_txns)
            holding_period_days = (today - first_purchase_date).days

            fund_cashflows: List[tuple[date, float]] = []
            for txn in fund_txns:
                if self._is_outflow(txn):
                    fund_cashflows.append((txn.date, -abs(txn.amount)))
                elif self._is_inflow(txn):
                    fund_cashflows.append((txn.date, abs(txn.amount)))
            fund_cashflows.append((today, current_value))

            fund_xirr: float | None = None
            try:
                fund_xirr = calculate_xirr(fund_cashflows)
            except ValueError:
                fund_xirr = None

            if fund_xirr is not None:
                fund_wise_xirr[fund_name] = fund_xirr

            invested_amount = max(cost_basis, 0.0)
            absolute_return = (
                ((current_value - invested_amount) / invested_amount) * 100
                if invested_amount > 0
                else 0.0
            )

            sample_txn = fund_txns[0]
            factsheet = lookup_factsheet(fund_name=fund_name, isin=sample_txn.isin, index=self.factsheet_index)

            expense_ratio = 0.0
            direct_expense_ratio = None
            top_holdings = []
            category = self._infer_category_from_name(fund_name)
            amc_value = sample_txn.amc

            if factsheet:
                expense_ratio = self._to_fraction(float(factsheet.get("expense_ratio", 0.0)))
                direct_value = factsheet.get("direct_expense_ratio")
                if direct_value is not None:
                    direct_expense_ratio = self._to_fraction(float(direct_value))
                top_holdings = parse_top_holdings(factsheet.get("top_holdings", []))

                category_raw = str(factsheet.get("category", "")).strip().lower()
                if category_raw:
                    try:
                        category = FundCategory(category_raw)
                    except ValueError:
                        category = self._infer_category_from_name(fund_name)

                amc_value = str(factsheet.get("amc") or sample_txn.amc or "").upper() or None

            holdings.append(
                FundHolding(
                    fund_name=fund_name,
                    isin=sample_txn.isin,
                    amc=amc_value,
                    category=category,
                    current_value=current_value,
                    invested_amount=invested_amount,
                    units_held=units_held,
                    current_nav=current_nav,
                    expense_ratio=expense_ratio,
                    direct_expense_ratio=direct_expense_ratio,
                    plan_type=self._infer_plan_type(fund_name),
                    top_holdings=top_holdings,
                    holding_period_days=holding_period_days,
                    xirr=fund_xirr,
                    absolute_return=absolute_return,
                )
            )

        total_current_value = sum(holding.current_value for holding in holdings)
        total_invested = sum(holding.invested_amount for holding in holdings)

        portfolio_cashflows.append((today, total_current_value))
        try:
            overall_xirr = calculate_xirr(portfolio_cashflows)
        except ValueError:
            overall_xirr = 0.0

        overlap_matrix, overlap_details = detect_overlap(holdings)

        expense_ratio_drag_inr = sum(
            drag
            for drag in (holding.expense_drag_inr for holding in holdings)
            if drag is not None
        )

        category_allocation: Dict[str, float] = {}
        amc_allocation: Dict[str, float] = {}

        if total_current_value > 0:
            for holding in holdings:
                category_key = holding.category.value
                category_allocation[category_key] = category_allocation.get(category_key, 0.0) + (
                    holding.current_value / total_current_value * 100
                )

                amc_key = (holding.amc or "UNKNOWN").upper()
                amc_allocation[amc_key] = amc_allocation.get(amc_key, 0.0) + (
                    holding.current_value / total_current_value * 100
                )

        return PortfolioAnalytics(
            holdings=holdings,
            overall_xirr=overall_xirr,
            fund_wise_xirr=fund_wise_xirr,
            overlap_matrix=overlap_matrix,
            overlap_details=overlap_details,
            expense_ratio_drag_inr=expense_ratio_drag_inr,
            total_current_value=total_current_value,
            total_invested=total_invested,
            category_allocation=category_allocation,
            amc_allocation=amc_allocation,
        )

    def run(self, state: dict) -> dict:
        """
        LangGraph node function. Reads transactions from state,
        populates analytics.
        
        Args:
            state: PipelineState as dict (LangGraph convention)
            
        Returns:
            Partial state update with analytics
        """
        pipeline_state = PipelineState(**state)
        transactions = pipeline_state.transactions
        analytics = self.calculate_portfolio(transactions)

        return {
            "analytics": analytics.model_dump(),
            "current_agent": "analytics",
        }
