"""
React API bridge for FinSage.

This file provides a minimal HTTP interface for the React frontend while reusing
existing parser and analytics agents. It is intentionally isolated so existing
Streamlit or orchestration flows are not modified.
"""

from __future__ import annotations

import base64
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.analytics_agent import AnalyticsAgent
from agents.parser_agent import ParserAgent


class AnalyzeRequest(BaseModel):
	pdf_base64: str = Field(..., description="Base64-encoded PDF bytes")
	filename: str = Field("statement.pdf", description="Original uploaded filename")
	user_profile: Optional[Dict[str, Any]] = Field(
		default=None,
		description="Reserved for future advisory integration",
	)


def _decode_pdf_to_temp_file(pdf_base64: str, filename: str) -> Path:
	pdf_bytes = base64.b64decode(pdf_base64, validate=True)
	suffix = Path(filename).suffix.lower() or ".pdf"
	with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
		temp_file.write(pdf_bytes)
		return Path(temp_file.name)


app = FastAPI(title="FinSage React API", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=False,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
	return {"status": "ok"}


@app.post("/api/analyze")
def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
	parser = ParserAgent()
	analytics = AnalyticsAgent()

	temp_path = _decode_pdf_to_temp_file(payload.pdf_base64, payload.filename)
	try:
		raw_text = parser.parse_pdf(str(temp_path))
		transactions = parser.extract_transactions(raw_text)
		analytics_result = analytics.calculate_portfolio(transactions)
		return {
			"raw_text_length": len(raw_text),
			"transaction_count": len(transactions),
			"analytics": analytics_result.model_dump(),
		}
	finally:
		if temp_path.exists():
			temp_path.unlink(missing_ok=True)

