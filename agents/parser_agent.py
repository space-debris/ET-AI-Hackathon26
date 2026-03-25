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
        self._folio_pattern = re.compile(r"folio\s*[:#]?\s*([A-Za-z0-9\-/]+)", re.IGNORECASE)
        self._isin_pattern = re.compile(r"\b([A-Z]{2}[A-Z0-9]{10})\b")

    @staticmethod
    def _parse_date(value: str):
        value = value.strip()
        formats = ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d", "%d-%m-%y", "%d/%m/%y")
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
        normalized = value.strip().lower().replace(" ", "_")
        mapping = {
            "purchase": TransactionType.PURCHASE,
            "redemption": TransactionType.REDEMPTION,
            "sip": TransactionType.SIP,
            "dividend": TransactionType.DIVIDEND,
            "switch_in": TransactionType.SWITCH_IN,
            "switch_out": TransactionType.SWITCH_OUT,
        }
        if normalized not in mapping:
            raise ValueError(f"Unsupported transaction type: {value}")
        return mapping[normalized]

    @staticmethod
    def _infer_amc(fund_name: str) -> Optional[str]:
        name = fund_name.strip()
        if not name:
            return None
        return name.split()[0].upper()

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
        for line in lines:
            match = self._line_pattern.match(line)
            if not match:
                continue

            date_value = self._parse_date(match.group("date"))
            fund_name = match.group("fund").strip(" ,-")
            txn_type = self._normalize_txn_type(match.group("txn_type"))
            amount = self._parse_amount(match.group("amount"))
            units = self._parse_amount(match.group("units"))
            nav = self._parse_amount(match.group("nav"))

            folio_match = self._folio_pattern.search(line)
            isin_match = self._isin_pattern.search(line)

            transactions.append(
                Transaction(
                    fund_name=fund_name,
                    isin=isin_match.group(1) if isin_match else None,
                    amc=self._infer_amc(fund_name),
                    date=date_value,
                    amount=amount,
                    units=units,
                    nav=nav,
                    transaction_type=txn_type,
                    folio_number=folio_match.group(1) if folio_match else None,
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
