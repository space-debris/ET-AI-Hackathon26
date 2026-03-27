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

    def test_extract_transactions_parses_cams_table_layout(self):
        agent = ParserAgent()
        raw_text = (
            "SBI Bluechip Fund - Regular Plan - Growth\n"
            "AMC SBI Mutual Fund Folio No. 1158702/09\n"
            "Registrar CAMS Plan / Option Regular / Growth\n"
            "Date Transaction Type Amount (?) Units NAV Unit Balance\n"
            "07-Apr-2023 SIP 12,000.00 195.440 61.40 195.440\n"
            "07-May-2023 SIP 12,000.00 190.870 62.87 386.310\n"
            "HDFC Short Term Debt Fund - Regular Plan - Growth\n"
            "AMC HDFC Mutual Fund Folio No. 8204761/31\n"
            "20-Apr-2023 Purchase 50,000.00 1937.984 25.80 1937.984"
        )

        transactions = agent.extract_transactions(raw_text)

        assert len(transactions) == 3
        assert transactions[0].fund_name == "SBI Bluechip Fund - Regular Plan - Growth"
        assert transactions[0].amc == "SBI Mutual Fund"
        assert transactions[0].folio_number == "1158702/09"
        assert transactions[0].transaction_type == TransactionType.SIP
        assert transactions[0].date == date(2023, 4, 7)
        assert transactions[2].fund_name == "HDFC Short Term Debt Fund - Regular Plan - Growth"
        assert transactions[2].transaction_type == TransactionType.PURCHASE

    def test_extract_transactions_parses_synthetic_summary_layout(self):
        agent = ParserAgent()
        raw_text = (
            "HDFC Top 100 Fund - Regular Plan - Growth\n"
            "AMC: HDFC Mutual Fund Folio: 1234567/89 ISIN: INF179K01VV5 Plan: Regular\n"
            "Date Type Amount (Rs.) NAV Units\n"
            "10-Apr-2020 Purchase (SIP) 5,000.00 412.3500 12.127\n"
            "10-Jun-2021 Purchase (SIP) 5,000.00 548.7600 9.112\n"
        )

        transactions = agent.extract_transactions(raw_text)

        assert len(transactions) == 2
        assert transactions[0].fund_name == "HDFC Top 100 Fund - Regular Plan - Growth"
        assert transactions[0].amc == "HDFC Mutual Fund"
        assert transactions[0].folio_number == "1234567/89"
        assert transactions[0].isin == "INF179K01VV5"
        assert transactions[0].transaction_type == TransactionType.SIP
        assert transactions[0].date == date(2020, 4, 10)
