"""
FinSage AI — Parser Agent Tests (Abhishek)
============================================
Unit tests for PDF parsing and transaction extraction.
Owner: Abhishek
"""

from datetime import date

from agents.parser_agent import ParserAgent
from shared.schemas import TransactionType


class TestParserAgent:
    """Tests for ParserAgent."""

    def test_extract_transactions_parses_supported_line_format(self):
        agent = ParserAgent()
        raw_text = (
            "01/01/2024 HDFC Mid-Cap Opportunities Fund purchase 10,000 25.000 400.00\n"
            "15/02/2024 HDFC Mid-Cap Opportunities Fund sip 5,000 12.500 400.00\n"
            "10/01/2025 HDFC Mid-Cap Opportunities Fund redemption 2,000 4.000 500.00"
        )

        transactions = agent.extract_transactions(raw_text)

        assert len(transactions) == 3
        assert transactions[0].fund_name == "HDFC Mid-Cap Opportunities Fund"
        assert transactions[0].transaction_type == TransactionType.PURCHASE
        assert transactions[0].amount == 10000
        assert transactions[0].date == date(2024, 1, 1)

    def test_run_populates_state_fields(self, monkeypatch):
        agent = ParserAgent()
        mock_text = "01/01/2024 SBI Bluechip Fund purchase 1000 10 100"

        monkeypatch.setattr(agent, "parse_pdf", lambda _: mock_text)

        result = agent.run({"pdf_path": "dummy.pdf"})

        assert result["current_agent"] == "parser"
        assert result["raw_text"] == mock_text
        assert len(result["transactions"]) == 1
        assert result["transactions"][0]["fund_name"] == "SBI Bluechip Fund"
