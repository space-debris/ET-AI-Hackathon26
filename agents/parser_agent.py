"""
FinSage AI — Parser Agent (Abhishek)
======================================
Extracts transactions from CAMS/KFintech mutual fund PDF statements.

Dependencies: pdfplumber, camelot-py
Input: PipelineState with pdf_path set
Output: PipelineState with transactions populated
"""

from typing import List, Optional
from shared.schemas import Transaction, PipelineState


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
        pass  # TODO: Abhishek to implement

    def parse_pdf(self, pdf_path: str) -> str:
        """
        Extract raw text from a CAMS/KFintech PDF statement.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Raw extracted text as string
        """
        raise NotImplementedError("Abhishek: Implement PDF parsing with pdfplumber")

    def extract_transactions(self, raw_text: str) -> List[Transaction]:
        """
        Parse raw text into structured Transaction objects.
        
        Args:
            raw_text: Raw text extracted from PDF
            
        Returns:
            List of Transaction objects
        """
        raise NotImplementedError("Abhishek: Implement transaction extraction")

    def run(self, state: dict) -> dict:
        """
        LangGraph node function. Reads pdf_path from state, 
        populates raw_text and transactions.
        
        Args:
            state: PipelineState as dict (LangGraph convention)
            
        Returns:
            Partial state update with raw_text and transactions
        """
        raise NotImplementedError("Abhishek: Implement run method")
