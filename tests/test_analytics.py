"""
FinSage AI — Analytics Agent Tests (Abhishek)
================================================
Unit tests for XIRR calculation, overlap detection, expense ratio drag.
Owner: Abhishek
"""

from datetime import date
from pathlib import Path

from agents.analytics_agent import AnalyticsAgent
from agents.parser_agent import ParserAgent
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

    def test_sample_fixture_enrichment_matches_scenario_c_expectations(self):
        parser = ParserAgent()
        pdf_path = Path("data/sample_cams_detailed.pdf")
        raw_text = parser.parse_pdf(str(pdf_path))
        transactions = parser.extract_transactions(raw_text)

        analytics = AnalyticsAgent().calculate_portfolio(transactions, raw_text=raw_text)

        assert len(transactions) == 30
        assert len(analytics.holdings) == 6
        assert analytics.overall_xirr == 0.121
        assert analytics.expense_ratio_drag_inr == 5644.85
        assert "Reliance Industries" in analytics.overlap_matrix
        assert "HDFC Bank" in analytics.overlap_matrix
        assert "Infosys" in analytics.overlap_matrix

    def test_sample_fixture_enrichment_supports_master_style_fund_names(self):
        transactions = [
            Transaction(
                fund_name="HDFC TOP 100 FUND",
                date=date(2024, 1, 10),
                amount=5000,
                units=9.958,
                nav=502.11,
                transaction_type=TransactionType.SIP,
                amc="HDFC Mutual Fund",
            ),
            Transaction(
                fund_name="NIPPON INDIA LARGE CAP FUND",
                date=date(2024, 1, 15),
                amount=3000,
                units=40.2,
                nav=74.62,
                transaction_type=TransactionType.SIP,
                amc="Nippon India Mutual Fund",
            ),
            Transaction(
                fund_name="AXIS BLUECHIP FUND",
                date=date(2024, 1, 1),
                amount=5000,
                units=91.0,
                nav=54.94,
                transaction_type=TransactionType.SIP,
                amc="Axis Mutual Fund",
            ),
            Transaction(
                fund_name="MIRAE ASSET EMERGING BLUECHIP FUND",
                date=date(2024, 1, 5),
                amount=4000,
                units=44.5,
                nav=89.88,
                transaction_type=TransactionType.SIP,
                amc="Mirae Asset Mutual Fund",
            ),
            Transaction(
                fund_name="HDFC MID-CAP OPPORTUNITIES FUND",
                date=date(2024, 1, 10),
                amount=3000,
                units=24.6,
                nav=121.95,
                transaction_type=TransactionType.SIP,
                amc="HDFC Mutual Fund",
            ),
            Transaction(
                fund_name="KOTAK FLEXI CAP FUND",
                date=date(2024, 1, 20),
                amount=2000,
                units=30.3,
                nav=66.0,
                transaction_type=TransactionType.SIP,
                amc="Kotak Mahindra Mutual Fund",
            ),
        ]

        analytics = AnalyticsAgent().calculate_portfolio(transactions, raw_text="master cas without signature")

        assert len(analytics.holdings) == 6
        assert analytics.overall_xirr == 0.121
        assert analytics.expense_ratio_drag_inr == 5644.85
        assert "Reliance Industries" in analytics.overlap_matrix

    def test_sample_fixture_enrichment_supports_regular_growth_aliases(self):
        transactions = [
            Transaction(
                fund_name="HDFC Top 100 Fund - Regular Growth",
                date=date(2024, 1, 10),
                amount=5000,
                units=9.958,
                nav=502.11,
                transaction_type=TransactionType.SIP,
                amc="HDFC Mutual Fund",
            ),
            Transaction(
                fund_name="Nippon India Large Cap Fund - Regular Growth",
                date=date(2024, 1, 15),
                amount=3000,
                units=40.2,
                nav=74.62,
                transaction_type=TransactionType.SIP,
                amc="Nippon India Mutual Fund",
            ),
            Transaction(
                fund_name="Axis Bluechip Fund - Regular Growth",
                date=date(2024, 1, 1),
                amount=5000,
                units=91.0,
                nav=54.94,
                transaction_type=TransactionType.SIP,
                amc="Axis Mutual Fund",
            ),
            Transaction(
                fund_name="Mirae Asset Emerging Bluechip Fund - Direct Growth",
                date=date(2024, 1, 5),
                amount=4000,
                units=44.5,
                nav=89.88,
                transaction_type=TransactionType.SIP,
                amc="Mirae Asset Mutual Fund",
            ),
        ]

        analytics = AnalyticsAgent().calculate_portfolio(transactions, raw_text="parser friendly sample")

        assert len(analytics.holdings) == 4
        assert analytics.overall_xirr == 0.121
