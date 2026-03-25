"""
FinSage AI — Analytics Agent Tests (Abhishek)
================================================
Unit tests for XIRR calculation, overlap detection, expense ratio drag.
Owner: Abhishek
"""

from datetime import date

from agents.analytics_agent import AnalyticsAgent
from shared.schemas import (
    FundCategory,
    FundHolding,
    StockHolding,
    Transaction,
    TransactionType,
)
from utils.overlap_detector import detect_overlap
from utils.xirr_calculator import calculate_xirr


class TestAnalyticsAgent:
    """Tests for AnalyticsAgent."""

    def test_calculate_xirr_returns_positive_for_growth(self):
        cashflows = [
            (date(2022, 1, 1), -100000.0),
            (date(2023, 1, 1), -20000.0),
            (date(2026, 1, 1), 180000.0),
        ]

        xirr = calculate_xirr(cashflows)
        assert xirr > 0

    def test_detect_overlap_finds_common_stock(self):
        holdings = [
            FundHolding(
                fund_name="Fund A",
                category=FundCategory.FLEXI_CAP,
                current_value=100000,
                invested_amount=90000,
                units_held=1000,
                expense_ratio=0.015,
                top_holdings=[
                    StockHolding(stock_name="Reliance Industries", weight=0.08),
                    StockHolding(stock_name="TCS", weight=0.06),
                ],
            ),
            FundHolding(
                fund_name="Fund B",
                category=FundCategory.LARGE_CAP,
                current_value=50000,
                invested_amount=45000,
                units_held=500,
                expense_ratio=0.012,
                top_holdings=[
                    StockHolding(stock_name="Reliance Industries", weight=0.07),
                    StockHolding(stock_name="Infosys", weight=0.05),
                ],
            ),
        ]

        overlap_matrix, overlap_details = detect_overlap(holdings)

        assert "Reliance Industries" in overlap_matrix
        assert len(overlap_details) == 1
        assert overlap_details[0].total_portfolio_exposure > 0

    def test_analytics_agent_calculates_portfolio_from_transactions(self):
        agent = AnalyticsAgent()
        transactions = [
            Transaction(
                fund_name="HDFC Flexi Cap Fund",
                date=date(2024, 1, 1),
                amount=10000,
                units=100,
                nav=100,
                transaction_type=TransactionType.PURCHASE,
                amc="HDFC",
            ),
            Transaction(
                fund_name="HDFC Flexi Cap Fund",
                date=date(2024, 6, 1),
                amount=5000,
                units=45.4545,
                nav=110,
                transaction_type=TransactionType.SIP,
                amc="HDFC",
            ),
        ]

        result = agent.run({"transactions": [txn.model_dump() for txn in transactions]})

        assert result["current_agent"] == "analytics"
        assert result["analytics"]["total_invested"] > 0
        assert len(result["analytics"]["holdings"]) == 1

    def test_analytics_uses_factsheet_for_expense_and_holdings(self):
        factsheet_index = {
            "hdfc top 100": {
                "scheme": "HDFC Top 100 Fund - Regular Plan - Growth",
                "isin": "INF179K01VV5",
                "amc": "HDFC",
                "category": "large_cap",
                "expense_ratio": 1.68,
                "direct_expense_ratio": 0.55,
                "top_holdings": [
                    {"stock_name": "Reliance Industries", "weight": 0.092, "sector": "Energy"},
                    {"stock_name": "HDFC Bank", "weight": 0.081, "sector": "Banking"},
                ],
            },
            "nippon india large cap": {
                "scheme": "Nippon India Large Cap Fund - Regular Plan - Growth",
                "isin": "INF204K01EY1",
                "amc": "NIPPON",
                "category": "large_cap",
                "expense_ratio": 1.72,
                "direct_expense_ratio": 0.58,
                "top_holdings": [
                    {"stock_name": "Reliance Industries", "weight": 0.088, "sector": "Energy"},
                ],
            },
        }
        agent = AnalyticsAgent(factsheet_index=factsheet_index)

        transactions = [
            Transaction(
                fund_name="HDFC Top 100 Fund - Regular Growth",
                date=date(2024, 1, 1),
                amount=10000,
                units=100,
                nav=100,
                transaction_type=TransactionType.PURCHASE,
                amc="HDFC",
                isin="INF179K01VV5",
            ),
            Transaction(
                fund_name="Nippon India Large Cap Fund - Regular Growth",
                date=date(2024, 1, 1),
                amount=9000,
                units=90,
                nav=100,
                transaction_type=TransactionType.PURCHASE,
                amc="NIPPON",
                isin="INF204K01EY1",
            ),
        ]

        result = agent.calculate_portfolio(transactions)

        assert result.expense_ratio_drag_inr > 0
        assert len(result.overlap_matrix) > 0
