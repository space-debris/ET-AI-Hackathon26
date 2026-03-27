"""
FinSage AI — Parser Agent (Abhishek)
======================================
Extracts transactions from CAMS/KFintech mutual fund PDF statements.

Dependencies: pdfplumber, camelot-py
Input: PipelineState with pdf_path set
Output: PipelineState with transactions populated
"""

from typing import List, Optional
from datetime import datetime
import re

from shared.schemas import Transaction, PipelineState
from shared.schemas import TransactionType


class ParserAgent:
    """
    Agent 1: Parses CAMS/KFintech mutual fund PDF statements.
    
    Responsibilities:
    - Extract raw text from PDF using pdfplumber
    - Parse tabular data using camelot for structured extraction
    - Map extracted data to Transaction Pydantic models
    - Handle multiple PDF formats (CAMS, KFintech, NSDL)
    
    Owner: Abhishek
    """

    def __init__(self):
        self._line_pattern = re.compile(
            r"^(?P<date>\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}|\d{4}[\-/]\d{1,2}[\-/]\d{1,2})\s+"
            r"(?P<fund>.*?)\s+"
            r"(?P<txn_type>purchase|redemption|sip|dividend|switch\s*in|switch\s*out)\s+"
            r"(?P<amount>-?[\d,]+(?:\.\d+)?)\s+"
            r"(?P<units>-?[\d,]+(?:\.\d+)?)\s+"
            r"(?P<nav>[\d,]+(?:\.\d+)?)",
            flags=re.IGNORECASE,
        )
        self._table_row_pattern = re.compile(
            r"^(?P<date>\d{1,2}-[A-Za-z]{3}-\d{4})\s+"
            r"(?P<txn_type>purchase(?:\s*\([^)]+\))?|redemption|sip|dividend|switch\s*in|switch\s*out)\s+"
            r"(?P<amount>-?[\d,]+(?:\.\d+)?)\s+"
            r"(?P<units>-?[\d,]+(?:\.\d+)?)\s+"
            r"(?P<nav>[\d,]+(?:\.\d+)?)\s+"
            r"(?P<unit_balance>-?[\d,]+(?:\.\d+)?)$",
            flags=re.IGNORECASE,
        )
        self._folio_pattern = re.compile(r"folio\s*[:#]?\s*([A-Za-z0-9\-/]+)", re.IGNORECASE)
        self._isin_pattern = re.compile(r"\b([A-Z]{2}[A-Z0-9]{10})\b")
        self._meta_pattern = re.compile(
            r"^AMC\s+(?P<amc>.+?)\s+Folio\s+No\.?\s+(?P<folio>[A-Za-z0-9\-/]+)$",
            flags=re.IGNORECASE,
        )
        self._inline_meta_pattern = re.compile(
            r"^AMC:\s*(?P<amc>.+?)\s+Folio:\s*(?P<folio>[A-Za-z0-9\-/]+)\s+"
            r"ISIN:\s*(?P<isin>[A-Z0-9]+)\s+Plan:\s*(?P<plan>.+)$",
            flags=re.IGNORECASE,
        )
        self._summary_row_pattern = re.compile(
            r"^(?P<date>\d{1,2}-[A-Za-z]{3}-\d{4})\s+"
            r"(?P<txn_type>.+?)\s+"
            r"(?P<amount>-?[\d,]+(?:\.\d+)?)\s+"
            r"(?P<nav>[\d,]+(?:\.\d+)?)\s+"
            r"(?P<units>-?[\d,]+(?:\.\d+)?)$",
            flags=re.IGNORECASE,
        )

    @staticmethod
    def _parse_date(value: str):
        value = value.strip()
        formats = (
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%y",
            "%d/%m/%y",
            "%d-%b-%Y",
            "%d-%B-%Y",
        )
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Unsupported date format: {value}")

    @staticmethod
    def _parse_amount(value: str) -> float:
        return float(value.replace(",", "").strip())

    @staticmethod
    def _normalize_txn_type(value: str) -> TransactionType:
        normalized = re.sub(r"[^a-z]+", " ", value.strip().lower()).strip()
        if "switch" in normalized and "in" in normalized:
            return TransactionType.SWITCH_IN
        if "switch" in normalized and "out" in normalized:
            return TransactionType.SWITCH_OUT
        if "purchase" in normalized and "sip" in normalized:
            return TransactionType.SIP
        if "sip" in normalized:
            return TransactionType.SIP
        if "purchase" in normalized:
            return TransactionType.PURCHASE
        if "redemption" in normalized:
            return TransactionType.REDEMPTION
        if "dividend" in normalized:
            return TransactionType.DIVIDEND
        raise ValueError(f"Unsupported transaction type: {value}")

    @staticmethod
    def _infer_amc(fund_name: str) -> Optional[str]:
        name = fund_name.strip()
        if not name:
            return None
        return name.split()[0].upper()

    @staticmethod
    def _is_scheme_header(line: str) -> bool:
        if not line or line.startswith(("AMC ", "AMC:", "Registrar ", "Date ", "Net Invested:", "Synthetic CAMS")):
            return False
        if line.startswith(
            (
                "Computer Age",
                "Consolidated Account",
                "Portfolio Summary",
                "Statement Period:",
                "Investor Name",
                "Email ",
                "Investor Profile",
                "Profile ",
                "Investor ",
                "Funds Covered",
                "Funds ",
                "AMCs ",
                "Total ",
                "Approx ",
                "Stock ",
                "Current Value",
                "Unrealised Gain",
                "Units:",
                "DISCLAIMER:",
            )
        ):
            return False
        return "fund" in line.lower() and "plan" in line.lower()

    def parse_pdf(self, pdf_path: str) -> str:
        """
        Extract raw text from a CAMS/KFintech PDF statement.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Raw extracted text as string
        """
        text_chunks: List[str] = []

        try:
            import pdfplumber  # type: ignore
        except Exception as exc:
            raise RuntimeError("pdfplumber is required for PDF parsing") from exc

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_chunks.append(page_text)

        try:
            import camelot  # type: ignore

            tables = camelot.read_pdf(pdf_path, pages="all", flavor="stream")
            for table in tables:
                df = table.df
                if not df.empty:
                    text_chunks.append(df.to_csv(index=False))
        except Exception:
            # Camelot is best-effort. pdfplumber extraction is primary.
            pass

        return "\n".join(text_chunks).strip()

    def extract_transactions(self, raw_text: str) -> List[Transaction]:
        """
        Parse raw text into structured Transaction objects.
        
        Args:
            raw_text: Raw text extracted from PDF
            
        Returns:
            List of Transaction objects
        """
        transactions: List[Transaction] = []
        if not raw_text.strip():
            return transactions

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        current_fund: Optional[str] = None
        current_amc: Optional[str] = None
        current_folio: Optional[str] = None
        current_isin: Optional[str] = None

        for line in lines:
            if self._is_scheme_header(line):
                current_fund = line.strip()
                continue

            meta_match = self._meta_pattern.match(line)
            if meta_match:
                current_amc = meta_match.group("amc").strip()
                current_folio = meta_match.group("folio").strip()
                continue

            inline_meta_match = self._inline_meta_pattern.match(line)
            if inline_meta_match:
                current_amc = inline_meta_match.group("amc").strip()
                current_folio = inline_meta_match.group("folio").strip()
                current_isin = inline_meta_match.group("isin").strip()
                continue

            isin_match = self._isin_pattern.search(line)
            if isin_match:
                current_isin = isin_match.group(1)

            summary_match = self._summary_row_pattern.match(line)
            if summary_match and current_fund:
                transactions.append(
                    Transaction(
                        fund_name=current_fund,
                        isin=current_isin,
                        amc=current_amc or self._infer_amc(current_fund),
                        date=self._parse_date(summary_match.group("date")),
                        amount=self._parse_amount(summary_match.group("amount")),
                        units=self._parse_amount(summary_match.group("units")),
                        nav=self._parse_amount(summary_match.group("nav")),
                        transaction_type=self._normalize_txn_type(summary_match.group("txn_type")),
                        folio_number=current_folio,
                    )
                )
                continue

            table_match = self._table_row_pattern.match(line)
            if table_match and current_fund:
                transactions.append(
                    Transaction(
                        fund_name=current_fund,
                        isin=current_isin,
                        amc=current_amc or self._infer_amc(current_fund),
                        date=self._parse_date(table_match.group("date")),
                        amount=self._parse_amount(table_match.group("amount")),
                        units=self._parse_amount(table_match.group("units")),
                        nav=self._parse_amount(table_match.group("nav")),
                        transaction_type=self._normalize_txn_type(table_match.group("txn_type")),
                        folio_number=current_folio,
                    )
                )
                continue

            match = self._line_pattern.match(line)
            if not match:
                continue

            fund_name = match.group("fund").strip(" ,-")
            folio_match = self._folio_pattern.search(line)
            inline_isin_match = self._isin_pattern.search(line)

            transactions.append(
                Transaction(
                    fund_name=fund_name,
                    isin=inline_isin_match.group(1) if inline_isin_match else current_isin,
                    amc=self._infer_amc(fund_name),
                    date=self._parse_date(match.group("date")),
                    amount=self._parse_amount(match.group("amount")),
                    units=self._parse_amount(match.group("units")),
                    nav=self._parse_amount(match.group("nav")),
                    transaction_type=self._normalize_txn_type(match.group("txn_type")),
                    folio_number=folio_match.group(1) if folio_match else current_folio,
                )
            )

        return transactions

    def run(self, state: dict) -> dict:
        """
        LangGraph node function. Reads pdf_path from state, 
        populates raw_text and transactions.
        
        Args:
            state: PipelineState as dict (LangGraph convention)
            
        Returns:
            Partial state update with raw_text and transactions
        """
        pipeline_state = PipelineState(**state)
        if not pipeline_state.pdf_path:
            raise ValueError("pdf_path is required in pipeline state for parser agent")

        raw_text = self.parse_pdf(pipeline_state.pdf_path)
        transactions = self.extract_transactions(raw_text)

        return {
            "raw_text": raw_text,
            "transactions": [transaction.model_dump() for transaction in transactions],
            "current_agent": "parser",
        }
